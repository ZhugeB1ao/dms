package com.example.organization_service.exception;

public class DuplicateResourceException extends RuntimeException {
    private final String field;

    public DuplicateResourceException(String field, String message) {
        super(message);
        this.field = field;
    }

    public DuplicateResourceException(String message) {
        this("name", message);
    }

    public String getField() {
        return field;
    }
}
