package com.tripdesk.api.search;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;
import java.util.stream.Stream;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.MethodSource;
import org.junit.jupiter.params.provider.ValueSource;

import com.tripdesk.api.config.SearchProperties;
import com.tripdesk.api.error.ApiValidationException;
import com.tripdesk.api.error.FieldError;

class SearchValidatorTest {

    private static final ZoneId UTC = ZoneId.of("UTC");

    private final Clock clock = Clock.fixed(Instant.parse("2026-10-29T12:00:00Z"), UTC);
    private final SearchValidator validator = new SearchValidator(new SearchProperties(10, 20, UTC), clock);

    /** The required criteria only; filters and sort are left out. */
    private SearchRequest validate(String city, String checkIn, String checkOut, String guests) {
        return validator.validate(city, checkIn, checkOut, guests, null, null, null, null);
    }

    /** Valid criteria with the given filters and sort. */
    private SearchRequest validateRefinements(String minPrice, String maxPrice, String minStars, String sort) {
        return validator.validate("Hanoi", "2026-11-05", "2026-11-07", "2", minPrice, maxPrice, minStars, sort);
    }

    private List<FieldError> refinementErrors(String minPrice, String maxPrice, String minStars, String sort) {
        return assertThrows(ApiValidationException.class,
                () -> validateRefinements(minPrice, maxPrice, minStars, sort)).errors();
    }

    private List<FieldError> errorsOf(String city, String checkIn, String checkOut, String guests) {
        return assertThrows(ApiValidationException.class, () -> validate(city, checkIn, checkOut, guests))
                .errors();
    }

    private static List<String> summary(List<FieldError> errors) {
        return errors.stream().map(error -> error.field() + ":" + error.code()).toList();
    }

    @Test
    void acceptsValidInputAndParsesIt() {
        SearchRequest request = validate(" Hanoi ", "2026-11-05", "2026-11-07", "2");

        assertThat(request.city()).isEqualTo("Hanoi");
        assertThat(request.checkIn()).isEqualTo(LocalDate.of(2026, 11, 5));
        assertThat(request.checkOut()).isEqualTo(LocalDate.of(2026, 11, 7));
        assertThat(request.guests()).isEqualTo(2);
    }

    @Test
    void checkOutEqualToCheckInIsAnInvalidDateRange() {
        assertThat(summary(errorsOf("Hanoi", "2026-11-05", "2026-11-05", "2")))
                .containsExactly("checkOut:INVALID_DATE_RANGE");
    }

    @Test
    void checkOutBeforeCheckInIsAnInvalidDateRange() {
        assertThat(summary(errorsOf("Hanoi", "2026-11-05", "2026-11-04", "2")))
                .containsExactly("checkOut:INVALID_DATE_RANGE");
    }

    @Test
    void checkInYesterdayIsInThePast() {
        assertThat(summary(errorsOf("Hanoi", "2026-10-28", "2026-10-30", "2")))
                .containsExactly("checkIn:CHECK_IN_IN_PAST");
    }

    @Test
    void checkInToday() {
        SearchRequest request = validate("Hanoi", "2026-10-29", "2026-10-30", "2");

        assertThat(request.checkIn()).isEqualTo(LocalDate.of(2026, 10, 29));
    }

    @ParameterizedTest
    @ValueSource(strings = { "0", "11", "-3" })
    void guestsOutsideTheRangeCarryTheAllowedRange(String guests) {
        List<FieldError> errors = errorsOf("Hanoi", "2026-11-05", "2026-11-07", guests);

        assertThat(summary(errors)).containsExactly("guests:GUESTS_OUT_OF_RANGE");
        assertThat(errors.get(0).meta()).isEqualTo(Map.of("min", 1, "max", 10));
    }

    @ParameterizedTest
    @ValueSource(strings = { "1", "10" })
    void guestsAtTheLimitsAreAccepted(String guests) {
        SearchRequest request = validate("Hanoi", "2026-11-05", "2026-11-07", guests);

        assertThat(request.guests()).isEqualTo(Integer.parseInt(guests));
    }

    static Stream<Arguments> missingValues() {
        return Stream.of("city", "checkIn", "checkOut", "guests")
                .flatMap(field -> Stream.of(Arguments.of(field, null), Arguments.of(field, ""),
                        Arguments.of(field, "   ")));
    }

    @ParameterizedTest
    @MethodSource("missingValues")
    void aMissingOrBlankRequiredFieldIsReportedByName(String field, String value) {
        String city = field.equals("city") ? value : "Hanoi";
        String checkIn = field.equals("checkIn") ? value : "2026-11-05";
        String checkOut = field.equals("checkOut") ? value : "2026-11-07";
        String guests = field.equals("guests") ? value : "2";

        assertThat(summary(errorsOf(city, checkIn, checkOut, guests))).containsExactly(field + ":REQUIRED");
    }

    @Test
    void severalViolationsAreReturnedTogetherInFieldOrder() {
        assertThat(summary(errorsOf(" ", "2026-10-28", "2026-10-27", "11")))
                .containsExactly(
                        "city:REQUIRED",
                        "checkIn:CHECK_IN_IN_PAST",
                        "checkOut:INVALID_DATE_RANGE",
                        "guests:GUESTS_OUT_OF_RANGE");
    }

    @Test
    void aVeryLongStayIsAccepted() {
        SearchRequest request = validate("Hanoi", "2026-11-05", "2030-01-01", "2");

        assertThat(request.checkOut()).isEqualTo(LocalDate.of(2030, 1, 1));
    }

    @ParameterizedTest
    @ValueSource(strings = { "2027-13-45", "2027-02-30", "tomorrow", "05/11/2026" })
    void anUnparseableDateIsAnInvalidValueAndSkipsTheDateRules(String bad) {
        assertThat(summary(errorsOf("Hanoi", bad, "2026-10-01", "2")))
                .containsExactly("checkIn:INVALID_VALUE");
        assertThat(summary(errorsOf("Hanoi", "2026-11-05", bad, "2")))
                .containsExactly("checkOut:INVALID_VALUE");
    }

    @ParameterizedTest
    @ValueSource(strings = { "99999999999", "-99999999999", "99999999999999999999999" })
    void aWellFormedIntegerBeyondTheIntRangeIsOutOfRangeNotInvalid(String huge) {
        List<FieldError> errors = errorsOf("Hanoi", "2026-11-05", "2026-11-07", huge);

        assertThat(summary(errors)).containsExactly("guests:GUESTS_OUT_OF_RANGE");
        assertThat(errors.get(0).meta()).isEqualTo(Map.of("min", 1, "max", 10));
    }

    @ParameterizedTest
    @ValueSource(strings = { "+999999999-01-01", "+10000-01-01", "-0001-01-01" })
    void aDateThePostgresDateColumnsCannotHoldIsAnInvalidValue(String extreme) {
        assertThat(summary(errorsOf("Hanoi", extreme, "2026-11-07", "2")))
                .containsExactly("checkIn:INVALID_VALUE");
        assertThat(summary(errorsOf("Hanoi", "2026-11-05", extreme, "2")))
                .containsExactly("checkOut:INVALID_VALUE");
    }

    @ParameterizedTest
    @ValueSource(strings = { "abc", "2.5", "1e1" })
    void aNonNumericGuestCountIsAnInvalidValue(String bad) {
        assertThat(summary(errorsOf("Hanoi", "2026-11-05", "2026-11-07", bad)))
                .containsExactly("guests:INVALID_VALUE");
    }

    @Test
    void aMinimumPriceAboveTheMaximumPriceIsAnInvalidPriceRange() {
        assertThat(summary(refinementErrors("20000", "10000", null, null)))
                .containsExactly("maxPrice:INVALID_PRICE_RANGE");
    }

    @Test
    void aMinimumPriceEqualToTheMaximumPriceIsAccepted() {
        SearchRequest request = validateRefinements("10000", "10000", null, null);

        assertThat(request.minPrice()).isEqualTo(10000L);
        assertThat(request.maxPrice()).isEqualTo(10000L);
    }

    @Test
    void onlyOneOfTheTwoPriceBoundsIsAccepted() {
        assertThat(validateRefinements("5000", null, null, null).minPrice()).isEqualTo(5000L);
        assertThat(validateRefinements(null, "5000", null, null).maxPrice()).isEqualTo(5000L);
    }

    @ParameterizedTest
    @ValueSource(strings = { "0", "6", "-1", "99999999999" })
    void aMinimumStarsOutsideOneToFiveIsInvalidStars(String stars) {
        assertThat(summary(refinementErrors(null, null, stars, null))).containsExactly("minStars:INVALID_STARS");
    }

    @ParameterizedTest
    @ValueSource(strings = { "1", "5" })
    void aMinimumStarsAtTheLimitsIsAccepted(String stars) {
        assertThat(validateRefinements(null, null, stars, null).minStars()).isEqualTo(Integer.parseInt(stars));
    }

    @ParameterizedTest
    @ValueSource(strings = { "cheapest", "PRICE_ASC", "price", "stars" })
    void anUnknownSortIsInvalidSort(String sort) {
        assertThat(summary(refinementErrors(null, null, null, sort))).containsExactly("sort:INVALID_SORT");
    }

    @Test
    void theSortDefaultsToPriceAscending() {
        assertThat(validateRefinements(null, null, null, null).sort()).isEqualTo(SortOrder.PRICE_ASC);
        assertThat(validateRefinements(null, null, null, "  ").sort()).isEqualTo(SortOrder.PRICE_ASC);
    }

    @ParameterizedTest
    @CsvSource({ "price_asc, PRICE_ASC", "price_desc, PRICE_DESC", "stars_desc, STARS_DESC",
            "stars_asc, STARS_ASC" })
    void everyDocumentedSortIsAccepted(String wire, SortOrder expected) {
        assertThat(validateRefinements(null, null, null, wire).sort()).isEqualTo(expected);
    }

    @ParameterizedTest
    @ValueSource(strings = { "abc", "12.5", "1e3", "-1", "99999999999999999999" })
    void aNonIntegerOrNegativePriceBoundIsAnInvalidValue(String bad) {
        assertThat(summary(refinementErrors(bad, null, null, null))).containsExactly("minPrice:INVALID_VALUE");
        assertThat(summary(refinementErrors(null, bad, null, null))).containsExactly("maxPrice:INVALID_VALUE");
    }

    @Test
    void aNonNumericMinimumStarsIsAnInvalidValue() {
        assertThat(summary(refinementErrors(null, null, "abc", null))).containsExactly("minStars:INVALID_VALUE");
    }

    @Test
    void thePriceRangeRuleIsSkippedWhenABoundIsUnparseable() {
        assertThat(summary(refinementErrors("abc", "10000", null, null))).containsExactly("minPrice:INVALID_VALUE");
    }

    @Test
    void refinementViolationsAreReportedTogetherWithTheCriteriaViolations() {
        List<FieldError> errors = assertThrows(ApiValidationException.class,
                () -> validator.validate(" ", "2026-11-05", "2026-11-07", "2", "20000", "10000", "9", "up"))
                .errors();

        assertThat(summary(errors)).containsExactly(
                "city:REQUIRED",
                "maxPrice:INVALID_PRICE_RANGE",
                "minStars:INVALID_STARS",
                "sort:INVALID_SORT");
    }
}
