package com.tripdesk.api.search;

import java.math.BigInteger;
import java.time.Clock;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.regex.Pattern;

import org.springframework.stereotype.Component;

import com.tripdesk.api.config.SearchProperties;
import com.tripdesk.api.error.ApiValidationException;
import com.tripdesk.api.error.ErrorCode;
import com.tripdesk.api.error.FieldError;

@Component
public class SearchValidator {

    private static final int MIN_GUESTS = 1;
    private static final int MIN_STARS = 1;
    private static final int MAX_STARS = 5;
    /** Years a PostgreSQL date column can hold with room to spare; beyond this the query would fail. */
    private static final int MIN_YEAR = 1;
    private static final int MAX_YEAR = 9999;

    /** ASCII digits only: Java's number parsers also accept a plus sign and digits of other scripts. */
    private static final Pattern DIGITS = Pattern.compile("[0-9]+");
    /** As above, with an optional minus, for values where a negative number is reported as out of range. */
    private static final Pattern SIGNED_DIGITS = Pattern.compile("-?[0-9]+");

    private final SearchProperties properties;
    private final Clock clock;

    public SearchValidator(SearchProperties properties, Clock clock) {
        this.properties = properties;
        this.clock = clock;
    }

    /**
     * Validates the raw query values and returns the parsed request. Every violation is collected
     * (in the order city, checkIn, checkOut, guests, minPrice, maxPrice, minStars, sort) and reported
     * together. A rule that needs a value that is missing or unparseable is skipped. The filters are
     * optional (a blank value is absent) and the sort defaults to price ascending.
     */
    public SearchRequest validate(String city, String checkIn, String checkOut, String guests,
            String minPrice, String maxPrice, String minStars, String sort) {
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

        Long minPriceValue = parsePrice("minPrice", minPrice, errors);
        Long maxPriceValue = parsePrice("maxPrice", maxPrice, errors);
        if (minPriceValue != null && maxPriceValue != null && minPriceValue > maxPriceValue) {
            errors.add(error("maxPrice", ErrorCode.INVALID_PRICE_RANGE));
        }
        Integer minStarsValue = parseMinStars(minStars, errors);
        SortOrder sortOrder = parseSort(sort, errors);

        if (!errors.isEmpty()) {
            throw new ApiValidationException(errors);
        }
        return new SearchRequest(cityValue, checkInDate, checkOutDate, guestCount, minPriceValue, maxPriceValue,
                minStarsValue, sortOrder);
    }

    /** An optional price bound in cents: a missing or blank value is no bound, a negative one is invalid. */
    private Long parsePrice(String field, String raw, List<FieldError> errors) {
        String value = trimmedOrNull(raw);
        if (value == null) {
            return null;
        }
        if (DIGITS.matcher(value).matches()) {
            try {
                return Long.parseLong(value);
            } catch (NumberFormatException e) {
                // Too large for a long; falls through to the error below.
            }
        }
        errors.add(error(field, ErrorCode.INVALID_VALUE));
        return null;
    }

    private Integer parseMinStars(String raw, List<FieldError> errors) {
        String value = trimmedOrNull(raw);
        if (value == null) {
            return null;
        }
        if (!SIGNED_DIGITS.matcher(value).matches()) {
            errors.add(error("minStars", ErrorCode.INVALID_VALUE));
            return null;
        }
        // BigInteger so a well-formed but huge number is out of range, not a wrong format.
        BigInteger stars = new BigInteger(value);
        if (stars.compareTo(BigInteger.valueOf(MIN_STARS)) < 0
                || stars.compareTo(BigInteger.valueOf(MAX_STARS)) > 0) {
            errors.add(error("minStars", ErrorCode.INVALID_STARS));
            return null;
        }
        return stars.intValueExact();
    }

    private SortOrder parseSort(String raw, List<FieldError> errors) {
        String value = trimmedOrNull(raw);
        if (value == null) {
            return SortOrder.PRICE_ASC;
        }
        Optional<SortOrder> sort = SortOrder.fromWire(value);
        if (sort.isEmpty()) {
            errors.add(error("sort", ErrorCode.INVALID_SORT));
            return null;
        }
        return sort.get();
    }

    private LocalDate parseDate(String field, String raw, List<FieldError> errors) {
        String value = trimmedOrNull(raw);
        if (value == null) {
            errors.add(error(field, ErrorCode.REQUIRED));
            return null;
        }
        try {
            LocalDate date = LocalDate.parse(value);
            if (date.getYear() < MIN_YEAR || date.getYear() > MAX_YEAR) {
                errors.add(error(field, ErrorCode.INVALID_VALUE));
                return null;
            }
            return date;
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
        if (!SIGNED_DIGITS.matcher(value).matches()) {
            errors.add(error("guests", ErrorCode.INVALID_VALUE));
            return null;
        }
        // BigInteger so a well-formed but huge number is out of range, not a wrong format.
        BigInteger guests = new BigInteger(value);
        if (guests.compareTo(BigInteger.valueOf(MIN_GUESTS)) < 0
                || guests.compareTo(BigInteger.valueOf(properties.maxGuests())) > 0) {
            errors.add(new FieldError("guests", ErrorCode.GUESTS_OUT_OF_RANGE,
                    Map.of("min", MIN_GUESTS, "max", properties.maxGuests())));
            return null;
        }
        return guests.intValueExact();
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
