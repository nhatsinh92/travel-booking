package com.tripdesk.api.search;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.tripdesk.api.search.dto.SearchResponse;

@RestController
@RequestMapping("/api/v1/hotels")
public class HotelSearchController {

    private final HotelSearchService service;

    public HotelSearchController(HotelSearchService service) {
        this.service = service;
    }

    @GetMapping("/search")
    public SearchResponse search(
            @RequestParam(required = false) String city,
            @RequestParam(required = false) String checkIn,
            @RequestParam(required = false) String checkOut,
            @RequestParam(required = false) String guests,
            @RequestParam(required = false) String cursor) {
        return service.search(city, checkIn, checkOut, guests, cursor);
    }
}
