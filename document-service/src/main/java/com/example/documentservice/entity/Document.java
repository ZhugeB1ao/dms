package com.example.documentservice.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.time.LocalDate;

/** Một bảng cho công văn đến, đi, nội bộ; 3 cột công văn đến để null khi direction != INCOMING. */
@Entity
@Table(name = "documents")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Document {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private DocumentDirection direction;

    @Column(name = "doc_number", length = 100)
    private String docNumber;

    @Column(name = "doc_type_id", nullable = false)
    private Long docTypeId;

    @Column(nullable = false, length = 2000)
    private String summary;

    @Column(name = "urgency_id", nullable = false)
    private Long urgencyId;

    @Column(name = "confidentiality_id", nullable = false)
    private Long confidentialityId;

    @Column(name = "department_id", nullable = false)
    private Long departmentId;

    @Column(name = "owner_id", nullable = false)
    private Long ownerId;

    @Column(name = "dossier_id")
    private Long dossierId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    @Builder.Default
    private DocumentStatus status = DocumentStatus.DRAFT;

    @Column(name = "current_approver_id")
    private Long currentApproverId;

    @Column(name = "issue_date")
    private LocalDate issueDate;

    @Column(name = "is_revoked", nullable = false)
    private boolean isRevoked;

    @Column(name = "incoming_number", length = 100)
    private String incomingNumber;

    @Column(name = "received_date")
    private LocalDate receivedDate;

    @Column(length = 255)
    private String sender;

    @Column(name = "created_at", nullable = false, updatable = false)
    @Builder.Default
    private Instant createdAt = Instant.now();

    @Column(name = "deleted_at")
    private Instant deletedAt;
}
