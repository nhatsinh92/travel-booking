package com.tripdesk.api.support;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Set;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.annotation.DirtiesContext;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

/**
 * Runs against the migrated database WITHOUT truncation. It has its own container and context
 * (it does not extend AbstractIntegrationTest), so no fixture-based test can truncate the seed first.
 */
@SpringBootTest
@Testcontainers
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
class SeedDataIT {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine");

    @Autowired
    JdbcClient jdbc;

    private List<String> strings(String sql) {
        return jdbc.sql(sql).query(String.class).list();
    }

    private long count(String sql) {
        return jdbc.sql(sql).query(Long.class).single();
    }

    @Test
    void hasExactlyTheFiveCities() {
        assertThat(strings("SELECT name FROM city"))
                .containsExactlyInAnyOrder("Hanoi", "Ho Chi Minh City", "Da Nang", "Singapore", "Bangkok");
    }

    @Test
    void everyCityHasFortyFiveToFiftyFiveHotels() {
        var counts = jdbc.sql("""
                SELECT c.name, count(h.id) FROM city c LEFT JOIN hotel h ON h.city_id = c.id GROUP BY c.name
                """).query((rs, i) -> rs.getLong(2)).list();
        assertThat(counts).hasSize(5).allSatisfy(n -> assertThat(n).isBetween(45L, 55L));
    }

    @Test
    void everyCityHasAllStarRatingsOneToFive() {
        assertThat(count("""
                SELECT count(*) FROM city c
                WHERE (SELECT count(DISTINCT star_rating) FROM hotel h WHERE h.city_id = c.id) < 5
                """)).isZero();
        assertThat(count("SELECT count(*) FROM city")).isEqualTo(5);
    }

    @Test
    void everyCityHasHotelsSharingAPriceAndHotelsSharingAStarRating() {
        assertThat(count("""
                SELECT count(*) FROM city c WHERE NOT EXISTS (
                    SELECT 1 FROM hotel h WHERE h.city_id = c.id
                    GROUP BY h.price_per_night_cents HAVING count(*) >= 2)
                """)).isZero();
        assertThat(count("""
                SELECT count(*) FROM city c WHERE NOT EXISTS (
                    SELECT 1 FROM hotel h WHERE h.city_id = c.id
                    GROUP BY h.star_rating HAVING count(*) >= 2)
                """)).isZero();
        assertThat(count("SELECT count(*) FROM city")).isEqualTo(5);
    }

    @Test
    void everyCityHasHotelsForTenGuestsAndForOneGuest() {
        assertThat(count("""
                SELECT count(*) FROM city c WHERE
                    NOT EXISTS (SELECT 1 FROM hotel h WHERE h.city_id = c.id AND h.max_guests = 10)
                 OR NOT EXISTS (SELECT 1 FROM hotel h WHERE h.city_id = c.id AND h.max_guests = 1)
                """)).isZero();
        assertThat(count("SELECT count(*) FROM city")).isEqualTo(5);
    }

    @Test
    void everyImagePathIsOneOfTheEightPlaceholders() {
        Set<String> allowed = Set.of("/images/hotels/hotel-01.png", "/images/hotels/hotel-02.png",
                "/images/hotels/hotel-03.png", "/images/hotels/hotel-04.png", "/images/hotels/hotel-05.png",
                "/images/hotels/hotel-06.png", "/images/hotels/hotel-07.png", "/images/hotels/hotel-08.png");
        List<String> paths = strings("SELECT DISTINCT image_path FROM hotel");
        assertThat(paths).isNotEmpty().allSatisfy(p -> assertThat(allowed).contains(p));
    }

    @Test
    void someHotelsHaveUnavailabilityRanges() {
        assertThat(count("SELECT count(DISTINCT hotel_id) FROM hotel_unavailability")).isPositive();
    }

    @Test
    void everyDaNangHotelIsUnavailableFromDec20Of2028UntilJan1Of2029() {
        assertThat(count("SELECT count(*) FROM hotel h JOIN city c ON c.id = h.city_id WHERE c.name = 'Da Nang'"))
                .isPositive();
        assertThat(count("""
                SELECT count(*) FROM hotel h JOIN city c ON c.id = h.city_id
                WHERE c.name = 'Da Nang' AND NOT EXISTS (
                    SELECT 1 FROM hotel_unavailability u WHERE u.hotel_id = h.id
                    AND u.start_date <= DATE '2028-12-20' AND u.end_date >= DATE '2029-01-01')
                """)).isZero();
    }

    @Test
    void everyOtherCityFillsAFirstPageForTwoGuestsOnEveryTwoNightStay() {
        assertThat(count("SELECT count(*) FROM city WHERE name <> 'Da Nang'")).isEqualTo(4);
        assertThat(count("""
                SELECT count(*) FROM (
                    SELECT c.id, d::date AS check_in FROM city c
                    CROSS JOIN generate_series(DATE '2026-10-30', DATE '2028-11-30', INTERVAL '1 day') d
                    WHERE c.name <> 'Da Nang'
                ) s
                WHERE (SELECT count(*) FROM hotel h WHERE h.city_id = s.id AND h.max_guests >= 2
                       AND NOT EXISTS (SELECT 1 FROM hotel_unavailability u WHERE u.hotel_id = h.id
                           AND u.start_date < s.check_in + 2 AND u.end_date > s.check_in)) <= 20
                """)).isZero();
    }
}
