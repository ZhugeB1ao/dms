package com.example.documentservice.dto;

import com.example.documentservice.entity.Attachment;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.time.Instant;

public record AttachmentResponse(
        Long id,
        Long documentId,
        String fileGroupId,
        String fileName,
        String mimeType,
        long fileSize,
        int versionNo,
        @JsonProperty("isCurrent")
        boolean isCurrent,
        Long uploadedBy,
        Instant uploadedAt
) {
    public static AttachmentResponse from(Attachment a) {
        return new AttachmentResponse(
                a.getId(),
                a.getDocumentId(),
                a.getFileGroupId(),
                a.getFileName(),
                a.getMimeType(),
                a.getFileSize(),
                a.getVersionNo(),
                a.isCurrent(),
                a.getUploadedBy(),
                a.getCreatedAt()
        );
    }
}
