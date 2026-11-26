package com.example.documentservice.dto;

import com.example.documentservice.entity.Dossier;

import java.time.Instant;

public record DossierResponse(
        long id,
        String code,
        String name,
        int year,
        long departmentId,
        boolean closed,
        long documentCount,
        Instant createdAt
) {
    public static DossierResponse from(Dossier d, long documentCount) {
        return new DossierResponse(
                d.getId(),
                d.getCode(),
                d.getName(),
                d.getYear(),
                d.getDepartmentId(),
                d.isClosed(),
                documentCount,
                d.getCreatedAt());
    }
}
