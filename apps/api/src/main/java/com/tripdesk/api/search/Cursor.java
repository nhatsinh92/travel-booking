package com.tripdesk.api.search;

import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.List;

import com.tripdesk.api.error.ApiValidationException;
import com.tripdesk.api.error.ErrorCode;
import com.tripdesk.api.error.FieldError;

/** Opaque position after the last row of a page: the price value and the hotel id. */
public record Cursor(long price, long hotelId) {

    private static final String SEPARATOR = ":";

    public String encode() {
        String text = price + SEPARATOR + hotelId;
        return Base64.getUrlEncoder().withoutPadding().encodeToString(text.getBytes(StandardCharsets.UTF_8));
    }

    public static Cursor decode(String value) {
        try {
            String text = new String(Base64.getUrlDecoder().decode(value), StandardCharsets.UTF_8);
            String[] parts = text.split(SEPARATOR, -1);
            if (parts.length != 2) {
                throw invalid();
            }
            return new Cursor(Long.parseLong(parts[0]), Long.parseLong(parts[1]));
        } catch (IllegalArgumentException e) {
            // Also covers NumberFormatException, which extends IllegalArgumentException.
            throw invalid();
        }
    }

    private static ApiValidationException invalid() {
        return new ApiValidationException(List.of(new FieldError("cursor", ErrorCode.INVALID_CURSOR, null)));
    }
}
