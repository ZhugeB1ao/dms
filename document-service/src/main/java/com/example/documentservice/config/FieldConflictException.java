package com.example.documentservice.config;

import java.util.Map;

public class FieldConflictException extends RuntimeException {
    private final Map<String, String> fieldErrors;

    public FieldConflictException(String message, Map<String, String> fieldErrors) {
        super(message);
        this.fieldErrors = fieldErrors == null ? Map.of() : Map.copyOf(fieldErrors);
    }

    public Map<String, String> getFieldErrors() {
        return fieldErrors;
    }
}
