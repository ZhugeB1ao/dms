package com.example.documentservice.dto;

import java.time.Instant;

public record PresignedUrlResponse(
        String url,
        Instant expiresAt,
        int expiresInSeconds,
        String disposition
) {}
