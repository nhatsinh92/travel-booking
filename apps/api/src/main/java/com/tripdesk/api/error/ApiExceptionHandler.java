package com.tripdesk.api.error;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class ApiExceptionHandler {

    @ExceptionHandler(ApiValidationException.class)
    public ResponseEntity<ProblemDetail> handle(ApiValidationException exception) {
        List<FieldError> errors = exception.errors();
        boolean cityNotFound = errors.stream().anyMatch(error -> error.code() == ErrorCode.CITY_NOT_FOUND);
        HttpStatus status = cityNotFound ? HttpStatus.NOT_FOUND : HttpStatus.BAD_REQUEST;

        ProblemDetail problem = ProblemDetail.forStatus(status);
        problem.setTitle(cityNotFound ? "City not found" : "Validation failed");
        problem.setProperty("code", errors.get(0).code());
        problem.setProperty("errors", errors);
        return ResponseEntity.status(status).contentType(MediaType.APPLICATION_PROBLEM_JSON).body(problem);
    }
}
