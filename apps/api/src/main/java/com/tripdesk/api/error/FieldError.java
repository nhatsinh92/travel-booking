package com.tripdesk.api.error;

import java.util.Map;

import io.swagger.v3.oas.annotations.media.Schema;

public record FieldError(
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED, example = "guests") String field,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) ErrorCode code,
        @Schema(description = "Extra values for the message, e.g. { min: 1, max: 10 } for GUESTS_OUT_OF_RANGE")
        Map<String, Object> meta) {

    public FieldError {
        meta = meta == null ? Map.of() : Map.copyOf(meta);
    }
}
