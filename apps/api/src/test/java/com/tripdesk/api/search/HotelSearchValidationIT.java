package com.tripdesk.api.search;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.mockito.Mockito.verifyNoInteractions;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import com.tripdesk.api.support.AbstractIntegrationTest;

/** Fixed clock: 2026-10-29. The search repository must never be touched when validation fails. */
class HotelSearchValidationIT extends AbstractIntegrationTest {

    @MockitoSpyBean
    HotelSearchRepository repository;

    @BeforeEach
    void setUp() {
        fixtures.truncate();
    }

    @AfterEach
    void repositoryWasNeverCalled() {
        verifyNoInteractions(repository);
    }

    /** A null value leaves the parameter out of the request. */
    private ResultActions search(String city, String checkIn, String checkOut, String guests) throws Exception {
        MockHttpServletRequestBuilder request = get("/api/v1/hotels/search");
        if (city != null) {
            request.param("city", city);
        }
        if (checkIn != null) {
            request.param("checkIn", checkIn);
        }
        if (checkOut != null) {
            request.param("checkOut", checkOut);
        }
        if (guests != null) {
            request.param("guests", guests);
        }
        return mockMvc.perform(request)
                .andExpect(status().isBadRequest())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON));
    }

    @ParameterizedTest
    @ValueSource(strings = { "2026-11-07", "2026-11-06" })
    void checkOutOnOrBeforeCheckInIsAnInvalidDateRange(String checkOut) throws Exception {
        search("Hanoi", "2026-11-07", checkOut, "2")
                .andExpect(jsonPath("$.code").value("INVALID_DATE_RANGE"))
                .andExpect(jsonPath("$.errors.length()").value(1))
                .andExpect(jsonPath("$.errors[0].field").value("checkOut"))
                .andExpect(jsonPath("$.errors[0].code").value("INVALID_DATE_RANGE"));
    }

    @Test
    void aCheckInInThePastIsRejected() throws Exception {
        search("Hanoi", "2026-10-28", "2026-10-30", "2")
                .andExpect(jsonPath("$.code").value("CHECK_IN_IN_PAST"))
                .andExpect(jsonPath("$.errors[0].field").value("checkIn"));
    }

    @ParameterizedTest
    @ValueSource(strings = { "0", "11" })
    void guestsOutOfRangeCarryTheAllowedRange(String guests) throws Exception {
        search("Hanoi", "2026-11-05", "2026-11-07", guests)
                .andExpect(jsonPath("$.code").value("GUESTS_OUT_OF_RANGE"))
                .andExpect(jsonPath("$.errors[0].field").value("guests"))
                .andExpect(jsonPath("$.errors[0].meta.min").value(1))
                .andExpect(jsonPath("$.errors[0].meta.max").value(10));
    }

    @ParameterizedTest
    @ValueSource(strings = { "city", "checkIn", "checkOut", "guests" })
    void aMissingParameterIsRequired(String field) throws Exception {
        search(field.equals("city") ? null : "Hanoi",
                field.equals("checkIn") ? null : "2026-11-05",
                field.equals("checkOut") ? null : "2026-11-07",
                field.equals("guests") ? null : "2")
                .andExpect(jsonPath("$.code").value("REQUIRED"))
                .andExpect(jsonPath("$.errors.length()").value(1))
                .andExpect(jsonPath("$.errors[0].field").value(field));
    }

    @ParameterizedTest
    @ValueSource(strings = { "city", "checkIn", "checkOut", "guests" })
    void aBlankParameterIsRequired(String field) throws Exception {
        search(field.equals("city") ? "   " : "Hanoi",
                field.equals("checkIn") ? "" : "2026-11-05",
                field.equals("checkOut") ? " " : "2026-11-07",
                field.equals("guests") ? "  " : "2")
                .andExpect(jsonPath("$.code").value("REQUIRED"))
                .andExpect(jsonPath("$.errors[0].field").value(field));
    }

    @ParameterizedTest
    @ValueSource(strings = { "2027-13-45", "2027-02-30", "soon" })
    void anImpossibleOrUnparseableDateIsAnInvalidValue(String bad) throws Exception {
        search("Hanoi", bad, "2027-01-02", "2")
                .andExpect(jsonPath("$.code").value("INVALID_VALUE"))
                .andExpect(jsonPath("$.errors.length()").value(1))
                .andExpect(jsonPath("$.errors[0].field").value("checkIn"));
        search("Hanoi", "2026-11-05", bad, "2")
                .andExpect(jsonPath("$.code").value("INVALID_VALUE"))
                .andExpect(jsonPath("$.errors[0].field").value("checkOut"));
    }

    @Test
    void aNonNumericGuestCountIsAnInvalidValue() throws Exception {
        search("Hanoi", "2026-11-05", "2026-11-07", "abc")
                .andExpect(jsonPath("$.code").value("INVALID_VALUE"))
                .andExpect(jsonPath("$.errors[0].field").value("guests"));
    }

    @Test
    void severalViolationsAreReportedTogether() throws Exception {
        search("Hanoi", "2026-10-28", "2026-10-27", "11")
                .andExpect(jsonPath("$.errors.length()").value(3))
                .andExpect(jsonPath("$.errors[0].code").value("CHECK_IN_IN_PAST"))
                .andExpect(jsonPath("$.errors[1].code").value("INVALID_DATE_RANGE"))
                .andExpect(jsonPath("$.errors[2].code").value("GUESTS_OUT_OF_RANGE"))
                .andExpect(jsonPath("$.code").value("CHECK_IN_IN_PAST"));
    }

    @Test
    void aMalformedCursorIsRejectedBeforeAnyQuery() throws Exception {
        mockMvc.perform(get("/api/v1/hotels/search")
                .param("city", "Hanoi")
                .param("checkIn", "2026-11-05")
                .param("checkOut", "2026-11-07")
                .param("guests", "2")
                .param("cursor", "garbage"))
                .andExpect(status().isBadRequest())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.code").value("INVALID_CURSOR"))
                .andExpect(jsonPath("$.errors.length()").value(1))
                .andExpect(jsonPath("$.errors[0].field").value("cursor"));
    }

    @Test
    void anUnknownCityTogetherWithAnInvalidDateReturnsOnlyTheDateError() throws Exception {
        search("Atlantis", "2026-10-28", "2026-10-30", "2")
                .andExpect(jsonPath("$.status").value(400))
                .andExpect(jsonPath("$.errors.length()").value(1))
                .andExpect(jsonPath("$.errors[0].code").value("CHECK_IN_IN_PAST"));
    }
}
