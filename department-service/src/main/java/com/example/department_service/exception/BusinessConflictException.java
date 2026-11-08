package com.example.department_service.exception;

public class BusinessConflictException extends RuntimeException {
    private final String field;

    public BusinessConflictException(String field, String message) {
        super(message);
        this.field = field;
    }

    public BusinessConflictException(String message) {
        this(null, message);
    }

    public String getField() {
        return field;
    }
}
