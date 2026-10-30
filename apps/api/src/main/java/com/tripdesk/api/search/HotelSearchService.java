package com.tripdesk.api.search;

import java.util.List;

import org.springframework.stereotype.Service;

import com.tripdesk.api.config.SearchProperties;
import com.tripdesk.api.error.ApiValidationException;
import com.tripdesk.api.error.ErrorCode;
import com.tripdesk.api.error.FieldError;
import com.tripdesk.api.search.dto.HotelResult;
import com.tripdesk.api.search.dto.SearchResponse;

@Service
public class HotelSearchService {

    private final SearchValidator validator;
    private final HotelSearchRepository repository;
    private final SearchProperties properties;

    public HotelSearchService(SearchValidator validator, HotelSearchRepository repository,
            SearchProperties properties) {
        this.validator = validator;
        this.repository = repository;
        this.properties = properties;
    }

    /** Validates first, then looks the city up, then queries; no query runs when validation fails. */
    public SearchResponse search(String city, String checkIn, String checkOut, String guests, String minPrice,
            String maxPrice, String minStars, String sort, String cursor) {
        SearchRequest request = validator.validate(city, checkIn, checkOut, guests, minPrice, maxPrice, minStars,
                sort);
        Cursor after = cursor == null || cursor.isBlank() ? null : Cursor.decode(cursor, request.sort());

        long cityId = repository.findCityId(request.city())
                .orElseThrow(() -> new ApiValidationException(
                        List.of(new FieldError("city", ErrorCode.CITY_NOT_FOUND, null))));

        int pageSize = properties.pageSize();
        List<HotelResult> rows = repository.search(cityId, request, after, pageSize + 1);
        if (rows.size() <= pageSize) {
            return new SearchResponse(rows, null);
        }
        List<HotelResult> page = rows.subList(0, pageSize);
        HotelResult last = page.get(pageSize - 1);
        return new SearchResponse(page, new Cursor(request.sort(), request.sort().sortValueOf(last), last.id()).encode());
    }
}
