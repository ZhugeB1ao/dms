package com.example.documentservice.config;

/** Danh tính người gọi, lấy từ header X-User-Id, X-User-Role, X-Department-Id do api-gateway gắn sau khi xác thực token. */
public record Caller(long id, String role, long departmentId) {
    public boolean isAdmin() {
        return "ADMIN".equals(role);
    }
}
