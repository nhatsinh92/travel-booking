package com.tripdesk.api.error;

import java.util.Map;

public record FieldError(String field, ErrorCode code, Map<String, Object> meta) {
}
