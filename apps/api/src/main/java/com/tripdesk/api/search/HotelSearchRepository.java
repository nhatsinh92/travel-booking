package com.tripdesk.api.search;

import java.util.List;
import java.util.Optional;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

import com.tripdesk.api.search.dto.HotelResult;

@Repository
public class HotelSearchRepository {

    public HotelSearchRepository(JdbcClient jdbc) {
    }

    public Optional<Long> findCityId(String city) {
        throw new UnsupportedOperationException("not implemented");
    }

    /** Returns up to {@code limit} hotels ordered by price then id, after the cursor when given. */
    public List<HotelResult> search(long cityId, SearchRequest request, Cursor after, int limit) {
        throw new UnsupportedOperationException("not implemented");
    }
}
