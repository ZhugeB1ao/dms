package com.example.documentservice.dto;

import com.example.documentservice.entity.Document;
import com.example.documentservice.entity.DocumentDirection;
import com.example.documentservice.entity.DocumentStatus;

import java.time.Instant;
import java.time.LocalDate;

public record DocumentResponse(
        long id,
        DocumentDirection direction,
        String docNumber,
        long docTypeId,
        String summary,
        long urgencyId,
        long confidentialityId,
        long departmentId,
        long ownerId,
        Long dossierId,
        DocumentStatus status,
        Long currentApproverId,
        LocalDate issueDate,
        boolean revoked,
        String incomingNumber,
        LocalDate receivedDate,
        String sender,
        Instant createdAt
) {
    public static DocumentResponse from(Document d) {
        return new DocumentResponse(d.getId(), d.getDirection(), d.getDocNumber(), d.getDocTypeId(), d.getSummary(),
                d.getUrgencyId(), d.getConfidentialityId(), d.getDepartmentId(), d.getOwnerId(), d.getDossierId(),
                d.getStatus(), d.getCurrentApproverId(), d.getIssueDate(), d.isRevoked(),
                d.getIncomingNumber(), d.getReceivedDate(), d.getSender(), d.getCreatedAt());
    }
}
