package com.tripdesk.api.search;

import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.empty;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.LocalDate;
import java.util.Comparator;
import java.util.List;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import com.tripdesk.api.support.AbstractIntegrationTest;

/** Fixed clock: 2026-10-29 (see FixedClockConfig). Stay used throughout: 2026-11-05 to 2026-11-07. */
class HotelSearchFilterSortIT extends AbstractIntegrationTest {

    private record Inserted(long id, int stars, int price) {
    }

    /** The sort names as they appear in the query string, in the order of the wire contract. */
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

    private long hanoi;

    @BeforeEach
    void setUp() {
        fixtures.truncate();
        hanoi = fixtures.insertCity("Hanoi");
    }

    private Inserted hotel(String name, int stars, int price) {
        return new Inserted(fixtures.insertHotel(hanoi, name, stars, price, 4), stars, price);
    }

    private MockHttpServletRequestBuilder request(String... extraParams) {
        MockHttpServletRequestBuilder request = get("/api/v1/hotels/search")
                .param("city", "Hanoi")
                .param("checkIn", "2026-11-05")
                .param("checkOut", "2026-11-07")
                .param("guests", "2");
        for (int i = 0; i < extraParams.length; i += 2) {
            request.param(extraParams[i], extraParams[i + 1]);
        }
        return request;
    }

    private ResultActions search(String... extraParams) throws Exception {
        return mockMvc.perform(request(extraParams));
    }

    private static Object[] ids(List<Inserted> hotels) {
        return hotels.stream().map(Inserted::id).map(Long::intValue).toArray();
    }

    @Test
    void minAndMaxPriceKeepOnlyHotelsInRangeWithInclusiveBounds() throws Exception {
        hotel("Below", 3, 9999);
        Inserted atMin = hotel("AtMin", 3, 10000);
        Inserted inside = hotel("Inside", 3, 12000);
        Inserted atMax = hotel("AtMax", 3, 15000);
        hotel("Above", 3, 15001);

        search("minPrice", "10000", "maxPrice", "15000")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[*].id", contains(ids(List.of(atMin, inside, atMax)))));
    }

    @Test
    void aSingleBoundIsEnough() throws Exception {
        Inserted cheap = hotel("Cheap", 3, 8000);
        Inserted pricey = hotel("Pricey", 3, 20000);

        search("minPrice", "10000").andExpect(jsonPath("$.items[*].id", contains(ids(List.of(pricey)))));
        search("maxPrice", "10000").andExpect(jsonPath("$.items[*].id", contains(ids(List.of(cheap)))));
    }

    @Test
    void minStarsKeepsHotelsAtOrAboveIt() throws Exception {
        hotel("Two", 2, 10000);
        hotel("Three", 3, 11000);
        Inserted four = hotel("Four", 4, 12000);
        Inserted five = hotel("Five", 5, 13000);

        search("minStars", "4")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[*].id", contains(ids(List.of(four, five)))));
    }

    @ParameterizedTest
    @EnumSource(Sort.class)
    void eachSortOrdersCorrectlyWithTiesBrokenByHotelIdInTheSameDirection(Sort sort) throws Exception {
        List<Inserted> hotels = List.of(
                hotel("A", 3, 10000),
                hotel("B", 5, 10000),
                hotel("C", 3, 20000),
                hotel("D", 5, 15000),
                hotel("E", 3, 15000),
                hotel("F", 4, 15000));
        List<Inserted> expected = hotels.stream().sorted(sort.expectedOrder).toList();

        search("sort", sort.wire)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[*].id", contains(ids(expected))));
    }

    @Test
    void withoutASortTheOrderIsPriceAscending() throws Exception {
        List<Inserted> hotels = List.of(hotel("A", 5, 30000), hotel("B", 1, 10000), hotel("C", 3, 20000));

        search().andExpect(jsonPath("$.items[*].id",
                contains(ids(hotels.stream().sorted(Sort.PRICE_ASC.expectedOrder).toList()))));
    }

    @Test
    void filtersThatRemoveEverythingReturnAnEmptyPage() throws Exception {
        hotel("Cheap", 2, 8000);
        hotel("Pricey", 5, 30000);

        search("minPrice", "10000", "maxPrice", "20000")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items", empty()))
                .andExpect(jsonPath("$.nextCursor").value((Object) null));
        search("minStars", "5", "maxPrice", "20000")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items", empty()))
                .andExpect(jsonPath("$.nextCursor").value((Object) null));
    }

    @Test
    void filtersCombineWithTheCapacityAndAvailabilityRules() throws Exception {
        Inserted match = hotel("Match", 4, 12000);
        fixtures.insertHotel(hanoi, "TooSmall", 4, 12100, 1);
        long busy = fixtures.insertHotel(hanoi, "Busy", 4, 12200, 4);
        fixtures.insertUnavailability(busy, LocalDate.of(2026, 11, 6), LocalDate.of(2026, 11, 8));
        hotel("TooFewStars", 3, 12300);
        hotel("TooExpensive", 4, 99000);

        search("minPrice", "10000", "maxPrice", "20000", "minStars", "4", "sort", "stars_desc")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[*].id", contains(ids(List.of(match)))));
    }

    @ParameterizedTest
    @ValueSource(strings = { "minPrice", "maxPrice", "minStars" })
    void aNonNumericFilterIsAnInvalidValueNamingTheField(String field) throws Exception {
        mockMvc.perform(request(field, "abc"))
                .andExpect(status().isBadRequest())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.code").value("INVALID_VALUE"))
                .andExpect(jsonPath("$.errors[0].field").value(field));
    }
}
