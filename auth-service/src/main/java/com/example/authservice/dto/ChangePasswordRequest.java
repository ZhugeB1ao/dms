package com.example.authservice.dto;

public record ChangePasswordRequest(
        String currentPassword,
        String newPassword
) {
}
