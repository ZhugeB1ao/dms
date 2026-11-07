package com.example.authservice.dto;

public record ResetPasswordRequest(
        String token,
        String newPassword
) {
}
