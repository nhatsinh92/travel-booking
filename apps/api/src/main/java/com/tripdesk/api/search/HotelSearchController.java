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
            @Parameter(description = "Lower price bound per night in cents, inclusive. Blank is treated as "
                    + "absent. A negative or non-integer value is `INVALID_VALUE`.",
                    schema = @Schema(type = "integer", minimum = "0"))
            @RequestParam(required = false) String minPrice,
            @Parameter(description = "Upper price bound per night in cents, inclusive. Blank is treated as "
                    + "absent. A negative or non-integer value is `INVALID_VALUE`. A `minPrice` above "
                    + "`maxPrice` is `INVALID_PRICE_RANGE`, reported on this field.",
                    schema = @Schema(type = "integer", minimum = "0"))
            @RequestParam(required = false) String maxPrice,
            @Parameter(description = "Minimum star rating, inclusive. Blank is treated as absent. An integer "
                    + "outside 1 to 5 is `INVALID_STARS`; a non-integer value is `INVALID_VALUE`.",
                    schema = @Schema(type = "integer", minimum = "1", maximum = "5"))
            @RequestParam(required = false) String minStars,
            @Parameter(description = "Case-sensitive. Blank is treated as the default. An unknown value is "
                    + "`INVALID_SORT`.",
                    schema = @Schema(type = "string",
                            allowableValues = { "price_asc", "price_desc", "stars_desc", "stars_asc" },
                            defaultValue = "price_asc"))
            @RequestParam(required = false) String sort,
            @Parameter(description = "Opaque; use nextCursor from the previous page. Valid only with unchanged "
                    + "criteria, filters and sort; the result is undefined otherwise (a cursor issued for a "
                    + "different sort is rejected as `INVALID_CURSOR`).")
            @RequestParam(required = false) String cursor) {
        return service.search(city, checkIn, checkOut, guests, minPrice, maxPrice, minStars, sort, cursor);
    }
}
