package com.tripdesk.api.error;

import io.swagger.v3.oas.annotations.media.Schema;

/**
 * Shape of the {@code application/problem+json} body of an unexpected failure (HTTP 500), for the
 * OpenAPI document only. It has no {@code code} or {@code errors}: nothing about the cause is exposed.
 */
public record ServerProblem(
        String type,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED, example = "Internal server error") String title,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) int status,
        String detail) {
}
