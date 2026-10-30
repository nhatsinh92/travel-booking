package com.tripdesk.api.search;

import java.time.Clock;

import org.springframework.stereotype.Component;

import com.tripdesk.api.config.SearchProperties;

@Component
public class SearchValidator {

    public SearchValidator(SearchProperties properties, Clock clock) {
    }

    public SearchRequest validate(String city, String checkIn, String checkOut, String guests) {
        throw new UnsupportedOperationException("not implemented");
    }
}
