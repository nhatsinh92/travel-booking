package com.tripdesk.api.error;

import java.util.List;

public class ApiValidationException extends RuntimeException {

    private final List<FieldError> errors;

    public ApiValidationException(List<FieldError> errors) {
        super("Request validation failed");
        this.errors = List.copyOf(errors);
    }

    public List<FieldError> errors() {
        return errors;
    }
}
