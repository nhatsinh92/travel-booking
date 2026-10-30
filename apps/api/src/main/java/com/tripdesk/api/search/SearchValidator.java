package com.tripdesk.api.search;

import java.time.Clock;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Component;

import com.tripdesk.api.config.SearchProperties;
import com.tripdesk.api.error.ApiValidationException;
import com.tripdesk.api.error.ErrorCode;
import com.tripdesk.api.error.FieldError;

@Component
public class SearchValidator {

    private static final int MIN_GUESTS = 1;

    private final SearchProperties properties;
    private final Clock clock;

    public SearchValidator(SearchProperties properties, Clock clock) {
        this.properties = properties;
        this.clock = clock;
    }

    /**
     * Validates the raw query values and returns the parsed request. Every violation is collected
     * (in the order city, checkIn, checkOut, guests) and reported together. A rule that needs a
     * value that is missing or unparseable is skipped.
     */
    public SearchRequest validate(String city, String checkIn, String checkOut, String guests) {
        List<FieldError> errors = new ArrayList<>();

        String cityValue = trimmedOrNull(city);
        if (cityValue == null) {
            errors.add(error("city", ErrorCode.REQUIRED));
        }

        LocalDate checkInDate = parseDate("checkIn", checkIn, errors);
        if (checkInDate != null && checkInDate.isBefore(LocalDate.now(clock))) {
            errors.add(error("checkIn", ErrorCode.CHECK_IN_IN_PAST));
        }

        LocalDate checkOutDate = parseDate("checkOut", checkOut, errors);
        if (checkInDate != null && checkOutDate != null && !checkOutDate.isAfter(checkInDate)) {
            errors.add(error("checkOut", ErrorCode.INVALID_DATE_RANGE));
        }

        Integer guestCount = parseGuests(guests, errors);

        if (!errors.isEmpty()) {
            throw new ApiValidationException(errors);
        }
        return new SearchRequest(cityValue, checkInDate, checkOutDate, guestCount);
    }

    private LocalDate parseDate(String field, String raw, List<FieldError> errors) {
        String value = trimmedOrNull(raw);
        if (value == null) {
            errors.add(error(field, ErrorCode.REQUIRED));
            return null;
        }
        try {
            return LocalDate.parse(value);
        } catch (DateTimeParseException e) {
            errors.add(error(field, ErrorCode.INVALID_VALUE));
            return null;
        }
    }

    private Integer parseGuests(String raw, List<FieldError> errors) {
        String value = trimmedOrNull(raw);
        if (value == null) {
            errors.add(error("guests", ErrorCode.REQUIRED));
            return null;
        }
        int guests;
        try {
            guests = Integer.parseInt(value);
        } catch (NumberFormatException e) {
            errors.add(error("guests", ErrorCode.INVALID_VALUE));
            return null;
        }
        if (guests < MIN_GUESTS || guests > properties.maxGuests()) {
            errors.add(new FieldError("guests", ErrorCode.GUESTS_OUT_OF_RANGE,
                    Map.of("min", MIN_GUESTS, "max", properties.maxGuests())));
        }
        return guests;
    }

    private static String trimmedOrNull(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return value.trim();
    }

    private static FieldError error(String field, ErrorCode code) {
        return new FieldError(field, code, null);
    }
}
