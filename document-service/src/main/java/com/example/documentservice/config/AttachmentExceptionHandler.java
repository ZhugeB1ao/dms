package com.example.documentservice.config;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.multipart.MaxUploadSizeExceededException;

import java.util.LinkedHashMap;
import java.util.Map;

@RestControllerAdvice
public class AttachmentExceptionHandler {

    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ResponseEntity<Map<String, Object>> handleMaxUploadSizeExceeded(MaxUploadSizeExceededException ex) {
        HttpStatus status = HttpStatus.CONTENT_TOO_LARGE;
        return ResponseEntity.status(status).body(Map.of(
                "status", status.value(),
                "error", status.getReasonPhrase(),
                "message", "Uploaded file exceeds maximum allowed upload size"
        ));
    }

    @ExceptionHandler(FieldConflictException.class)
    public ResponseEntity<Map<String, Object>> handleFieldConflict(FieldConflictException ex) {
        HttpStatus status = HttpStatus.CONFLICT;
        String message = ex.getMessage() == null ? status.getReasonPhrase() : ex.getMessage();
        return ResponseEntity.status(status).body(Map.of(
                "status", status.value(),
                "error", status.getReasonPhrase(),
                "message", message,
                "fieldErrors", ex.getFieldErrors()
        ));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, Object>> handleMethodArgumentNotValid(MethodArgumentNotValidException ex) {
        Map<String, String> fieldErrors = new LinkedHashMap<>();
        for (FieldError err : ex.getBindingResult().getFieldErrors()) {
            String msg = err.getDefaultMessage() == null ? "Invalid value" : err.getDefaultMessage();
            fieldErrors.putIfAbsent(err.getField(), msg);
        }
        String message = fieldErrors.isEmpty()
                ? "Validation failed"
                : fieldErrors.values().iterator().next();
        HttpStatus status = HttpStatus.BAD_REQUEST;
        return ResponseEntity.status(status).body(Map.of(
                "status", status.value(),
                "error", status.getReasonPhrase(),
                "message", message,
                "fieldErrors", fieldErrors
        ));
    }
}
