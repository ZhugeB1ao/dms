package com.example.documentservice.dto;

import com.example.documentservice.entity.DocumentHistory;
import com.example.documentservice.entity.DocumentStatus;
import com.example.documentservice.entity.HistoryAction;

import java.time.Instant;

public record HistoryResponse(long id, HistoryAction action, DocumentStatus fromStatus, DocumentStatus toStatus,
                              long actorId, Instant createdAt) {
    public static HistoryResponse from(DocumentHistory h) {
        return new HistoryResponse(h.getId(), h.getAction(), h.getFromStatus(), h.getToStatus(), h.getActorId(), h.getCreatedAt());
    }
}
