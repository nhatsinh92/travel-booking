package com.tripdesk.api.search.dto;

public record HotelResult(
        long id,
        String name,
        int starRating,
        int pricePerNightCents,
        String currency,
        String imageUrl) {
}
