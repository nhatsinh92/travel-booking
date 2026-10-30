package com.tripdesk.api.search.dto;

import java.util.List;

import io.swagger.v3.oas.annotations.media.ArraySchema;
import io.swagger.v3.oas.annotations.media.Schema;

public record SearchResponse(
        @ArraySchema(maxItems = 20, arraySchema = @Schema(requiredMode = Schema.RequiredMode.REQUIRED))
        List<HotelResult> items,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED, nullable = true,
                description = "Null when there are no more results")
        String nextCursor) {
}
