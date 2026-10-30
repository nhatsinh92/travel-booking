package com.tripdesk.api.search;

import java.time.LocalDate;

public record SearchRequest(
        String city,
        LocalDate checkIn,
        LocalDate checkOut,
        int guests,
        Long minPrice,
        Long maxPrice,
        Integer minStars,
        SortOrder sort) {
}
