package com.tripdesk.api.support;

import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.LocalDate;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.dao.DataIntegrityViolationException;

class SchemaConstraintsIT extends AbstractIntegrationTest {

    private long cityId;

    @BeforeEach
    void setUp() {
        fixtures.truncate();
        cityId = fixtures.insertCity("Hanoi");
    }

    @ParameterizedTest
    @ValueSource(ints = {0, 6})
    void rejectsStarRatingOutsideOneToFive(int stars) {
        assertThatThrownBy(() -> fixtures.insertHotel(cityId, "H", stars, 1000, 2))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void rejectsPricePerNightOfZero() {
        assertThatThrownBy(() -> fixtures.insertHotel(cityId, "H", 3, 0, 2))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void rejectsMaxGuestsOfZero() {
        assertThatThrownBy(() -> fixtures.insertHotel(cityId, "H", 3, 1000, 0))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void rejectsUnavailabilityEndingOnItsStartDate() {
        long hotelId = fixtures.insertHotel(cityId, "H", 3, 1000, 2);
        LocalDate day = LocalDate.of(2027, 1, 10);
        assertThatThrownBy(() -> fixtures.insertUnavailability(hotelId, day, day))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void rejectsUnavailabilityEndingBeforeItsStartDate() {
        long hotelId = fixtures.insertHotel(cityId, "H", 3, 1000, 2);
        assertThatThrownBy(() -> fixtures.insertUnavailability(hotelId,
                LocalDate.of(2027, 1, 10), LocalDate.of(2027, 1, 9)))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void rejectsDuplicateCityNameDifferingOnlyByCase() {
        assertThatThrownBy(() -> fixtures.insertCity("HANOI"))
                .isInstanceOf(DataIntegrityViolationException.class);
    }
}
