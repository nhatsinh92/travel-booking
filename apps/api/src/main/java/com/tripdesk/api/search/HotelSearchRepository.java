package com.tripdesk.api.search;

import java.util.List;
import java.util.Optional;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

import com.tripdesk.api.search.dto.HotelResult;

@Repository
public class HotelSearchRepository {

    private static final String CURRENCY = "USD";

    private final JdbcClient jdbc;

    public HotelSearchRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public Optional<Long> findCityId(String city) {
        return jdbc.sql("SELECT id FROM city WHERE lower(name) = lower(:city)")
                .param("city", city.trim())
                .query(Long.class)
                .optional();
    }

    /** Returns up to {@code limit} hotels ordered by price then id, after the cursor when given. */
    public List<HotelResult> search(long cityId, SearchRequest request, Cursor after, int limit) {
        String keyset = after == null ? "" : "AND (h.price_per_night_cents, h.id) > (:afterPrice, :afterId)";
        JdbcClient.StatementSpec statement = jdbc.sql("""
                SELECT h.id, h.name, h.star_rating, h.price_per_night_cents, h.image_path
                FROM hotel h
                WHERE h.city_id = :cityId
                  AND h.max_guests >= :guests
                  AND NOT EXISTS (
                      SELECT 1 FROM hotel_unavailability u
                      WHERE u.hotel_id = h.id
                        AND u.start_date < :checkOut
                        AND u.end_date > :checkIn)
                  %s
                ORDER BY h.price_per_night_cents, h.id
                LIMIT :limit
                """.formatted(keyset))
                .param("cityId", cityId)
                .param("guests", request.guests())
                .param("checkIn", request.checkIn())
                .param("checkOut", request.checkOut())
                .param("limit", limit);
        if (after != null) {
            statement = statement.param("afterPrice", after.price()).param("afterId", after.hotelId());
        }
        return statement
                .query((rs, rowNum) -> new HotelResult(
                        rs.getLong("id"),
                        rs.getString("name"),
                        rs.getInt("star_rating"),
                        rs.getInt("price_per_night_cents"),
                        CURRENCY,
                        rs.getString("image_path")))
                .list();
    }
}
