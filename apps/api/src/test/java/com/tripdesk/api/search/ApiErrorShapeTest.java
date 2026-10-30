package com.tripdesk.api.search;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.tripdesk.api.error.ApiValidationException;
import com.tripdesk.api.error.ErrorCode;
import com.tripdesk.api.error.FieldError;

@WebMvcTest(controllers = ApiErrorShapeTest.ThrowingController.class)
@Import(ApiErrorShapeTest.ThrowingController.class)
class ApiErrorShapeTest {

    @RestController
    static class ThrowingController {

        @GetMapping("/test/single")
        void single(@RequestParam ErrorCode code) {
            throw new ApiValidationException(List.of(new FieldError("field", code, null)));
        }

        @GetMapping("/test/several")
        void several() {
            throw new ApiValidationException(List.of(
                    new FieldError("checkOut", ErrorCode.INVALID_DATE_RANGE, null),
                    new FieldError("guests", ErrorCode.GUESTS_OUT_OF_RANGE, Map.of("min", 1, "max", 10))));
        }
    }

    @Autowired
    MockMvc mockMvc;

    @Test
    void reportsAllViolationsTogetherAsProblemJson() throws Exception {
        mockMvc.perform(get("/test/several"))
                .andExpect(status().isBadRequest())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.title").isNotEmpty())
                .andExpect(jsonPath("$.status").value(400))
                .andExpect(jsonPath("$.errors.length()").value(2))
                .andExpect(jsonPath("$.errors[0].field").value("checkOut"))
                .andExpect(jsonPath("$.errors[0].code").value("INVALID_DATE_RANGE"))
                .andExpect(jsonPath("$.errors[1].field").value("guests"))
                .andExpect(jsonPath("$.errors[1].code").value("GUESTS_OUT_OF_RANGE"))
                .andExpect(jsonPath("$.errors[1].meta.min").value(1))
                .andExpect(jsonPath("$.errors[1].meta.max").value(10));
    }

    @Test
    void topLevelCodeEqualsTheFirstEntryCode() throws Exception {
        mockMvc.perform(get("/test/several"))
                .andExpect(jsonPath("$.code").value("INVALID_DATE_RANGE"));
    }

    @Test
    void anAbsentMetaIsReturnedAsAnEmptyObject() throws Exception {
        mockMvc.perform(get("/test/single").param("code", "REQUIRED"))
                .andExpect(jsonPath("$.errors[0].meta").isMap())
                .andExpect(jsonPath("$.errors[0].meta").isEmpty());
    }

    @ParameterizedTest
    @EnumSource(value = ErrorCode.class, mode = EnumSource.Mode.EXCLUDE, names = "CITY_NOT_FOUND")
    void validationCodesReturn400(ErrorCode code) throws Exception {
        mockMvc.perform(get("/test/single").param("code", code.name()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400))
                .andExpect(jsonPath("$.code").value(code.name()));
    }

    @Test
    void cityNotFoundReturns404() throws Exception {
        mockMvc.perform(get("/test/single").param("code", "CITY_NOT_FOUND"))
                .andExpect(status().isNotFound())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.status").value(404))
                .andExpect(jsonPath("$.code").value("CITY_NOT_FOUND"));
    }
}
