package com.example.documentservice.dto;

import jakarta.validation.constraints.NotNull;

public record AttachDocumentRequest(@NotNull Long documentId) {}
