package com.tripdesk.api.error;

import java.util.List;

import io.swagger.v3.oas.annotations.media.Schema;

/**
 * Shape of the {@code application/problem+json} error body, for the OpenAPI document only. The
 * runtime body is a Spring {@code ProblemDetail} built in {@link ApiExceptionHandler}.
 */
public record Problem(
        String type,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String title,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) int status,
        String detail,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED,
                description = "Repeats the code of the first entry in errors (there is no aggregate code)")
        ErrorCode code,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<FieldError> errors) {
}
