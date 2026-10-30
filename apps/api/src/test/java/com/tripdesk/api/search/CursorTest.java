package com.tripdesk.api.search;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.util.Base64;
import java.util.List;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.junit.jupiter.params.provider.ValueSource;

import com.tripdesk.api.error.ApiValidationException;
import com.tripdesk.api.error.ErrorCode;
import com.tripdesk.api.error.FieldError;

class CursorTest {

    @Test
    void encodeThenDecodeReturnsTheSamePriceAndHotelId() {
        Cursor decoded = Cursor.decode(new Cursor(SortOrder.PRICE_ASC, 12550, 42L).encode(), SortOrder.PRICE_ASC);

        assertThat(decoded.value()).isEqualTo(12550);
        assertThat(decoded.hotelId()).isEqualTo(42L);
    }

    @ParameterizedTest
    @EnumSource(SortOrder.class)
    void encodeThenDecodeKeepsTheSortAndTheSortValueForEverySort(SortOrder sort) {
        // For the star sorts the value is a star rating, for the price sorts a price in cents.
        long value = sort == SortOrder.STARS_ASC || sort == SortOrder.STARS_DESC ? 4 : 12550;

        Cursor decoded = Cursor.decode(new Cursor(sort, value, 42L).encode(), sort);

        assertThat(decoded).isEqualTo(new Cursor(sort, value, 42L));
    }

    @ParameterizedTest
    @EnumSource(SortOrder.class)
    void decodingWithADifferentSortIsRejected(SortOrder issuedFor) {
        String encoded = new Cursor(issuedFor, 4, 42L).encode();

        for (SortOrder other : SortOrder.values()) {
            if (other != issuedFor) {
                assertInvalidCursor(encoded, other);
            }
        }
    }

    @Test
    void aCursorWithAnUnknownSortNameIsRejected() {
        assertInvalidCursor(encode("bogus:4:42"), SortOrder.STARS_DESC);
    }

    @Test
    void theEncodedFormIsUrlSafe() {
        assertThat(new Cursor(SortOrder.PRICE_ASC, 2_000_000_000, 9_000_000_000L).encode())
                .matches("[A-Za-z0-9_-]+");
    }

    @ParameterizedTest
    @ValueSource(strings = { "", "   ", "not base64 !!", "%%%%" })
    void aStringThatIsNotBase64IsRejected(String malformed) {
        assertInvalidCursor(malformed, SortOrder.PRICE_ASC);
    }

    @Test
    void validBase64OfTheWrongContentIsRejected() {
        assertInvalidCursor(encode("abc"), SortOrder.PRICE_ASC);
        assertInvalidCursor(encode("price_asc:12:x"), SortOrder.PRICE_ASC);
        assertInvalidCursor(encode("price_asc:12:34:56"), SortOrder.PRICE_ASC);
        assertInvalidCursor(encode("12:34"), SortOrder.PRICE_ASC);
        assertInvalidCursor(encode("::"), SortOrder.PRICE_ASC);
    }

    private static String encode(String text) {
        return Base64.getUrlEncoder().withoutPadding().encodeToString(text.getBytes());
    }

    private static void assertInvalidCursor(String malformed, SortOrder sort) {
        List<FieldError> errors = assertThrows(ApiValidationException.class,
                () -> Cursor.decode(malformed, sort)).errors();

        assertThat(errors).hasSize(1);
        assertThat(errors.get(0).field()).isEqualTo("cursor");
        assertThat(errors.get(0).code()).isEqualTo(ErrorCode.INVALID_CURSOR);
    }
}
