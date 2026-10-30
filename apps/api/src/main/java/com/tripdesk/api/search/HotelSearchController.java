package com.tripdesk.api.search;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.tripdesk.api.error.Problem;
import com.tripdesk.api.search.dto.SearchResponse;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;

@RestController
@RequestMapping("/api/v1/hotels")
public class HotelSearchController {

    private static final String PROBLEM_JSON = "application/problem+json";

    private final HotelSearchService service;

    public HotelSearchController(HotelSearchService service) {
        this.service = service;
    }

    @Operation(
            operationId = "searchHotels",
            summary = "Search available hotels by city and dates",
            description = "Returns one page (20 items) of hotels in the city that are available for the stay "
                    + "[checkIn, checkOut) and can accommodate the requested number of guests "
                    + "(hotel max_guests >= guests). No authentication. Input is always validated on the "
                    + "server; when validation fails no search is performed.")
    @ApiResponse(responseCode = "200", description = "A page of results (possibly empty)",
            content = @Content(mediaType = "application/json",
                    schema = @Schema(implementation = SearchResponse.class)))
    @ApiResponse(responseCode = "400", description = "Validation failed; no search was performed",
            content = @Content(mediaType = PROBLEM_JSON, schema = @Schema(implementation = Problem.class)))
    @ApiResponse(responseCode = "404", description = "City not found (`CITY_NOT_FOUND`)",
            content = @Content(mediaType = PROBLEM_JSON, schema = @Schema(implementation = Problem.class)))
    @GetMapping("/search")
    public SearchResponse search(
            @Parameter(required = true, description = "Matched trimmed, case-insensitive")
            @RequestParam(required = false) String city,
            @Parameter(required = true, schema = @Schema(type = "string", format = "date"))
            @RequestParam(required = false) String checkIn,
            @Parameter(required = true, schema = @Schema(type = "string", format = "date"))
            @RequestParam(required = false) String checkOut,
            @Parameter(required = true, schema = @Schema(type = "integer"),
                    description = "Validated against the configured range (1 to 10); only hotels whose "
                            + "capacity is at least this number are returned")
            @RequestParam(required = false) String guests,
            @RequestParam(required = false) String minPrice,
            @RequestParam(required = false) String maxPrice,
            @RequestParam(required = false) String minStars,
            @RequestParam(required = false) String sort,
            @Parameter(description = "Opaque; use nextCursor from the previous page with unchanged "
                    + "criteria, filters and sort")
            @RequestParam(required = false) String cursor) {
        return service.search(city, checkIn, checkOut, guests, minPrice, maxPrice, minStars, sort, cursor);
    }
}
