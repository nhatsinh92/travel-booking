package com.tripdesk.api.search.dto;

import io.swagger.v3.oas.annotations.media.Schema;

public record HotelResult(
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) long id,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String name,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED, minimum = "1", maximum = "5") int starRating,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) int pricePerNightCents,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED, example = "USD") String currency,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED,
                description = "Path of a static image served by the web app")
        String imageUrl) {
}
