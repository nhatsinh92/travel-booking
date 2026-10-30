package com.tripdesk.api.search;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.function.Predicate;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import com.jayway.jsonpath.JsonPath;
import com.tripdesk.api.support.AbstractIntegrationTest;

/**
 * Fixed clock: 2026-10-29 (see FixedClockConfig). 45 hotels in one city; stars cycle 1 to 5 and price
 * cycles over seven values, so every sort has many ties that straddle page boundaries.
 */
class HotelSearchPagingIT extends AbstractIntegrationTest {

    private record Inserted(long id, int stars, int price) {
    }

    private enum Sort {
        PRICE_ASC("price_asc", Comparator.comparingInt(Inserted::price).thenComparingLong(Inserted::id)),
        PRICE_DESC("price_desc",
                Comparator.comparingInt(Inserted::price).thenComparingLong(Inserted::id).reversed()),
        STARS_DESC("stars_desc",
                Comparator.comparingInt(Inserted::stars).thenComparingLong(Inserted::id).reversed()),
        STARS_ASC("stars_asc", Comparator.comparingInt(Inserted::stars).thenComparingLong(Inserted::id));

        final String wire;
        final Comparator<Inserted> expectedOrder;

        Sort(String wire, Comparator<Inserted> expectedOrder) {
            this.wire = wire;
            this.expectedOrder = expectedOrder;
        }
    }

    private record Page(List<Long> ids, String nextCursor) {
    }

    private final List<Inserted> hotels = new ArrayList<>();

    @BeforeEach
    void setUp() {
        fixtures.truncate();
        hotels.clear();
        long hanoi = fixtures.insertCity("Hanoi");
        for (int i = 0; i < 45; i++) {
            int stars = 1 + (i % 5);
            int price = 10000 + (i % 7) * 500;
            hotels.add(new Inserted(fixtures.insertHotel(hanoi, "Hotel " + i, stars, price, 4), stars, price));
        }
    }

    private MockHttpServletRequestBuilder request(String sort, String cursor, String... filters) {
        MockHttpServletRequestBuilder request = get("/api/v1/hotels/search")
                .param("city", "Hanoi")
                .param("checkIn", "2026-11-05")
                .param("checkOut", "2026-11-07")
                .param("guests", "2")
                .param("sort", sort);
        for (int i = 0; i < filters.length; i += 2) {
            request.param(filters[i], filters[i + 1]);
        }
        if (cursor != null) {
            request.param("cursor", cursor);
        }
        return request;
    }

    private Page fetch(String sort, String cursor, String... filters) throws Exception {
        String body = mockMvc.perform(request(sort, cursor, filters))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        List<Integer> ids = JsonPath.read(body, "$.items[*].id");
        return new Page(ids.stream().map(Integer::longValue).toList(), JsonPath.read(body, "$.nextCursor"));
    }

    private List<Page> followCursors(String sort, String... filters) throws Exception {
        List<Page> pages = new ArrayList<>();
        String cursor = null;
        do {
            Page page = fetch(sort, cursor, filters);
            pages.add(page);
            cursor = page.nextCursor();
        } while (cursor != null);
        return pages;
    }

    private void assertWalksTheWholeListInOrder(Sort sort, Predicate<Inserted> filter, List<Integer> pageSizes,
            String... filters) throws Exception {
        List<Long> expected = hotels.stream().filter(filter).sorted(sort.expectedOrder).map(Inserted::id).toList();

        List<Page> pages = followCursors(sort.wire, filters);

        assertThat(pages.stream().map(page -> page.ids().size()).toList()).isEqualTo(pageSizes);
        assertThat(pages.stream().flatMap(page -> page.ids().stream()).toList())
                .as("no duplicates, no gaps, in %s order", sort.wire)
                .containsExactlyElementsOf(expected);
        assertThat(pages.get(pages.size() - 1).nextCursor()).isNull();
    }

    @ParameterizedTest
    @EnumSource(Sort.class)
    void followingTheCursorYieldsPagesOf20And20And5WithNoDuplicatesAndNoGaps(Sort sort) throws Exception {
        assertWalksTheWholeListInOrder(sort, hotel -> true, List.of(20, 20, 5));
    }

    @ParameterizedTest
    @EnumSource(Sort.class)
    void followingTheCursorAlsoWorksWithFiltersApplied(Sort sort) throws Exception {
        Predicate<Inserted> filter = hotel -> hotel.stars() >= 2 && hotel.price() >= 10500
                && hotel.price() <= 12500;
        int matching = (int) hotels.stream().filter(filter).count();
        assertThat(matching).as("fixture must need more than one page").isGreaterThan(20).isLessThan(40);

        assertWalksTheWholeListInOrder(sort, filter, List.of(20, matching - 20),
                "minStars", "2", "minPrice", "10500", "maxPrice", "12500");
    }

    @Test
    void theLastPageHasANullNextCursor() throws Exception {
        List<Page> pages = followCursors("price_asc", "minStars", "2");

        assertThat(hotels.stream().filter(hotel -> hotel.stars() >= 2).count()).isEqualTo(36);
        assertThat(pages).hasSize(2);
        assertThat(pages.get(0).nextCursor()).isNotNull();
        assertThat(pages.get(1).ids()).hasSize(16);
        assertThat(pages.get(1).nextCursor()).isNull();
    }

    @ParameterizedTest
    @EnumSource(Sort.class)
    void aCursorFromOneSortUsedWithAnotherSortIsRejected(Sort issuedFor) throws Exception {
        String cursor = fetch(issuedFor.wire, null).nextCursor();

        for (Sort other : Sort.values()) {
            if (other != issuedFor) {
                mockMvc.perform(request(other.wire, cursor))
                        .andExpect(status().isBadRequest())
                        .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
                        .andExpect(jsonPath("$.code").value("INVALID_CURSOR"))
                        .andExpect(jsonPath("$.errors[0].field").value("cursor"));
            }
        }
    }

    @ParameterizedTest
    @ValueSource(strings = { "not-a-cursor", "%%%%", "cHJpY2VfYXNjOmFiYzox", "cHJpY2VfYXNjOjEyOjQyOjc" })
    void aMalformedCursorIsRejected(String malformed) throws Exception {
        for (Sort sort : Sort.values()) {
            mockMvc.perform(request(sort.wire, malformed))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.code").value("INVALID_CURSOR"));
        }
    }
}
