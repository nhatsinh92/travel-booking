package com.tripdesk.api.error;

import java.util.List;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.web.ErrorResponse;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class ApiExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(ApiExceptionHandler.class);

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

    /**
     * Any other failure becomes a problem+json 500 that says nothing about the cause (it is logged).
     * Exceptions that already carry their own status (such as a 405) are passed on unchanged.
     */
    @ExceptionHandler(Exception.class)
    public ResponseEntity<ProblemDetail> handleUnexpected(Exception exception) throws Exception {
        if (exception instanceof ErrorResponse) {
            throw exception;
        }
        log.error("Unexpected error while handling a request", exception);
        ProblemDetail problem = ProblemDetail.forStatus(HttpStatus.INTERNAL_SERVER_ERROR);
        problem.setTitle("Internal server error");
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .contentType(MediaType.APPLICATION_PROBLEM_JSON).body(problem);
    }
}
