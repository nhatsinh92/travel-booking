package com.tripdesk.api.search;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.util.Base64;
import java.util.List;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import com.tripdesk.api.error.ApiValidationException;
import com.tripdesk.api.error.ErrorCode;
import com.tripdesk.api.error.FieldError;

class CursorTest {

    @Test
    void encodeThenDecodeReturnsTheSamePriceAndHotelId() {
        Cursor decoded = Cursor.decode(new Cursor(12550, 42L).encode());

        assertThat(decoded.price()).isEqualTo(12550);
        assertThat(decoded.hotelId()).isEqualTo(42L);
    }

    @Test
    void theEncodedFormIsUrlSafe() {
        assertThat(new Cursor(2_000_000_000, 9_000_000_000L).encode()).matches("[A-Za-z0-9_-]+");
    }

    @ParameterizedTest
    @ValueSource(strings = { "", "   ", "not base64 !!", "%%%%" })
    void aStringThatIsNotBase64IsRejected(String malformed) {
        assertInvalidCursor(malformed);
    }

    @Test
    void validBase64OfTheWrongContentIsRejected() {
        assertInvalidCursor(encode("abc"));
        assertInvalidCursor(encode("12:x"));
        assertInvalidCursor(encode("12:34:56"));
        assertInvalidCursor(encode(":"));
    }

    private static String encode(String text) {
        return Base64.getUrlEncoder().withoutPadding().encodeToString(text.getBytes());
    }

    private static void assertInvalidCursor(String malformed) {
        List<FieldError> errors = assertThrows(ApiValidationException.class, () -> Cursor.decode(malformed))
                .errors();

        assertThat(errors).hasSize(1);
        assertThat(errors.get(0).field()).isEqualTo("cursor");
        assertThat(errors.get(0).code()).isEqualTo(ErrorCode.INVALID_CURSOR);
    }
}
