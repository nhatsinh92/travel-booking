package com.tripdesk.api.search;

public record Cursor(long price, long hotelId) {

    public String encode() {
        throw new UnsupportedOperationException("not implemented");
    }

    public static Cursor decode(String value) {
        throw new UnsupportedOperationException("not implemented");
    }
}
