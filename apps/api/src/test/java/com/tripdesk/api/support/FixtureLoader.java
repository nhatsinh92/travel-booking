package com.tripdesk.api.support;

import java.time.LocalDate;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;

@Component
public class FixtureLoader {

    private final JdbcClient jdbc;

    public FixtureLoader(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public void truncate() {
        jdbc.sql("TRUNCATE hotel_unavailability, hotel, city RESTART IDENTITY CASCADE").update();
    }

    public long insertCity(String name) {
        return jdbc.sql("INSERT INTO city (name) VALUES (:name) RETURNING id")
                .param("name", name)
                .query(Long.class)
                .single();
    }

    public long insertHotel(long cityId, String name, int starRating, int priceCents, int maxGuests) {
        return insertHotel(cityId, name, starRating, priceCents, maxGuests, "/images/hotels/hotel-01.png");
    }

    public long insertHotel(long cityId, String name, int starRating, int priceCents, int maxGuests,
            String imagePath) {
        return jdbc.sql("""
                INSERT INTO hotel (city_id, name, star_rating, price_per_night_cents, max_guests, image_path)
                VALUES (:cityId, :name, :stars, :price, :maxGuests, :imagePath) RETURNING id
                """)
                .param("cityId", cityId)
                .param("name", name)
                .param("stars", starRating)
                .param("price", priceCents)
                .param("maxGuests", maxGuests)
                .param("imagePath", imagePath)
                .query(Long.class)
                .single();
    }

    public long insertUnavailability(long hotelId, LocalDate startDate, LocalDate endDate) {
        return jdbc.sql("""
                INSERT INTO hotel_unavailability (hotel_id, start_date, end_date)
                VALUES (:hotelId, :startDate, :endDate) RETURNING id
                """)
                .param("hotelId", hotelId)
                .param("startDate", startDate)
                .param("endDate", endDate)
                .query(Long.class)
                .single();
    }
}
