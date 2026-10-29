package com.tripdesk.api.error;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class ApiExceptionHandler {

    @ExceptionHandler(ApiValidationException.class)
    public ResponseEntity<Void> handle(ApiValidationException exception) {
        return ResponseEntity.internalServerError().build();
    }
}
