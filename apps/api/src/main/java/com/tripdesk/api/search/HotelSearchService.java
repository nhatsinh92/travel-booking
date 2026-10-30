package com.tripdesk.api.search;

import org.springframework.stereotype.Service;

import com.tripdesk.api.config.SearchProperties;
import com.tripdesk.api.search.dto.SearchResponse;

@Service
public class HotelSearchService {

    public HotelSearchService(SearchValidator validator, HotelSearchRepository repository,
            SearchProperties properties) {
    }

    public SearchResponse search(String city, String checkIn, String checkOut, String guests, String cursor) {
        throw new UnsupportedOperationException("not implemented");
    }
}
