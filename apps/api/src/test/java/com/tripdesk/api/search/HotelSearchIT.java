package com.tripdesk.api.search;

import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.containsInAnyOrder;
import static org.hamcrest.Matchers.empty;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.not;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.test.web.servlet.ResultActions;

import com.tripdesk.api.support.AbstractIntegrationTest;

/** Fixed clock: 2026-10-29 (see FixedClockConfig). */
class HotelSearchIT extends AbstractIntegrationTest {

    private long hanoi;

    @BeforeEach
    void setUp() {
        fixtures.truncate();
        hanoi = fixtures.insertCity("Hanoi");
    }

    private ResultActions search(String city, String checkIn, String checkOut, int guests) throws Exception {
        return mockMvc.perform(get("/api/v1/hotels/search")
                .param("city", city)
                .param("checkIn", checkIn)
                .param("checkOut", checkOut)
                .param("guests", String.valueOf(guests)));
    }

    @Test
    void returnsOnlyHotelsOfTheRequestedCityWithTheirFields() throws Exception {
        long hotel = fixtures.insertHotel(hanoi, "Lakeside", 4, 12550, 4, "/images/hotels/hotel-03.png");
        long saigon = fixtures.insertCity("Ho Chi Minh City");
        fixtures.insertHotel(saigon, "Riverside", 3, 9000, 4);

        search("Hanoi", "2026-11-05", "2026-11-07", 2)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items", hasSize(1)))
                .andExpect(jsonPath("$.items[0].id").value(hotel))
                .andExpect(jsonPath("$.items[0].name").value("Lakeside"))
                .andExpect(jsonPath("$.items[0].starRating").value(4))
                .andExpect(jsonPath("$.items[0].pricePerNightCents").value(12550))
                .andExpect(jsonPath("$.items[0].currency").value("USD"))
                .andExpect(jsonPath("$.items[0].imageUrl").value("/images/hotels/hotel-03.png"))
                .andExpect(jsonPath("$.nextCursor").value(nullValue()));
    }

    @Test
    void theCityIsMatchedTrimmedAndCaseInsensitively() throws Exception {
        fixtures.insertHotel(hanoi, "Lakeside", 4, 12550, 4);

        search("  hAnOi ", "2026-11-05", "2026-11-07", 2)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items", hasSize(1)));
    }

    @Test
    void differentDatesReturnDifferentSets() throws Exception {
        long busy = fixtures.insertHotel(hanoi, "Busy", 3, 10000, 4);
        fixtures.insertHotel(hanoi, "Free", 3, 11000, 4);
        fixtures.insertUnavailability(busy, LocalDate.of(2026, 11, 10), LocalDate.of(2026, 11, 15));

        search("Hanoi", "2026-11-05", "2026-11-07", 2)
                .andExpect(jsonPath("$.items[*].name", containsInAnyOrder("Busy", "Free")));
        search("Hanoi", "2026-11-11", "2026-11-13", 2)
                .andExpect(jsonPath("$.items[*].name", contains("Free")));
    }

    @Test
    void noCredentialsAreNeeded() throws Exception {
        fixtures.insertHotel(hanoi, "Lakeside", 4, 12550, 4);

        search("Hanoi", "2026-11-05", "2026-11-07", 2)
                .andExpect(status().isOk())
                .andExpect(header().doesNotExist("WWW-Authenticate"));
    }

    @Test
    void aHotelBelowEqualToAndAboveTheRequestedGuestsIsExcludedIncludedIncluded() throws Exception {
        fixtures.insertHotel(hanoi, "Below", 3, 10000, 1);
        fixtures.insertHotel(hanoi, "Equal", 3, 11000, 2);
        fixtures.insertHotel(hanoi, "Above", 3, 12000, 3);

        search("Hanoi", "2026-11-05", "2026-11-07", 2)
                .andExpect(jsonPath("$.items[*].name", contains("Equal", "Above")));
    }

    /** Hotel unavailable for the half-open range [2026-11-10, 2026-11-15). */
    @ParameterizedTest(name = "stay {0} to {1} included={2}")
    @CsvSource({
            "2026-11-08, 2026-11-10, true",
            "2026-11-15, 2026-11-17, true",
            "2026-11-01, 2026-11-05, true",
            "2026-11-09, 2026-11-11, false",
            "2026-11-14, 2026-11-16, false",
            "2026-11-12, 2026-11-13, false",
            "2026-11-01, 2026-11-20, false" })
    void unavailableRangesAreHalfOpen(String checkIn, String checkOut, boolean included) throws Exception {
        long hotel = fixtures.insertHotel(hanoi, "Ranged", 3, 10000, 4);
        fixtures.insertUnavailability(hotel, LocalDate.of(2026, 11, 10), LocalDate.of(2026, 11, 15));

        search("Hanoi", checkIn, checkOut, 2)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items", included ? hasSize(1) : empty()));
    }

    @Test
    void aCityWhoseEveryHotelIsUnavailableReturnsAnEmptyPage() throws Exception {
        long first = fixtures.insertHotel(hanoi, "One", 3, 10000, 4);
        long second = fixtures.insertHotel(hanoi, "Two", 3, 11000, 4);
        fixtures.insertUnavailability(first, LocalDate.of(2026, 11, 1), LocalDate.of(2026, 12, 1));
        fixtures.insertUnavailability(second, LocalDate.of(2026, 11, 1), LocalDate.of(2026, 12, 1));

        search("Hanoi", "2026-11-05", "2026-11-07", 2)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items", empty()))
                .andExpect(jsonPath("$.nextCursor").value(nullValue()));
    }

    @Test
    void anUnknownCityIsNotFound() throws Exception {
        search("Atlantis", "2026-11-05", "2026-11-07", 2)
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("CITY_NOT_FOUND"))
                .andExpect(jsonPath("$.errors[0].field").value("city"));
    }

    private record Inserted(long id, int price) {
    }

    @Test
    void theFirstPageHoldsTwentyHotelsByAscendingPriceAndTheCursorReachesTheRest() throws Exception {
        List<Inserted> inserted = new ArrayList<>();
        // Prices come in groups of three so a tie straddles the page boundary (indexes 18, 19, 20).
        for (int i = 24; i >= 0; i--) {
            int price = 10000 + (i / 3) * 100;
            inserted.add(new Inserted(fixtures.insertHotel(hanoi, "Hotel " + i, 3, price, 4), price));
        }
        List<Long> expected = inserted.stream()
                .sorted(Comparator.comparingInt(Inserted::price).thenComparingLong(Inserted::id))
                .map(Inserted::id)
                .toList();

        String cursor = search("Hanoi", "2026-11-05", "2026-11-07", 2)
                .andExpect(jsonPath("$.items", hasSize(20)))
                .andExpect(jsonPath("$.items[*].id", contains(expected.subList(0, 20).stream()
                        .map(Long::intValue).toArray())))
                .andExpect(jsonPath("$.nextCursor", not(nullValue())))
                .andReturn().getResponse().getContentAsString();
        String nextCursor = com.jayway.jsonpath.JsonPath.read(cursor, "$.nextCursor");

        mockMvc.perform(get("/api/v1/hotels/search")
                .param("city", "Hanoi")
                .param("checkIn", "2026-11-05")
                .param("checkOut", "2026-11-07")
                .param("guests", "2")
                .param("cursor", nextCursor))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[*].id", contains(expected.subList(20, 25).stream()
                        .map(Long::intValue).toArray())))
                .andExpect(jsonPath("$.nextCursor").value(nullValue()));
    }
}
