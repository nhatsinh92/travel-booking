package com.tripdesk.api.search.dto;

import java.util.List;

public record SearchResponse(List<HotelResult> items, String nextCursor) {
}
