package com.example.documentservice.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

/** Chỉ thêm, không sửa/xóa. fromStatus null khi tạo mới. */
@Entity
@Table(name = "document_history")
@Getter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DocumentHistory {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "document_id", nullable = false)
    private Long documentId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private HistoryAction action;

    @Enumerated(EnumType.STRING)
    @Column(name = "from_status", length = 30)
    private DocumentStatus fromStatus;

    @Enumerated(EnumType.STRING)
    @Column(name = "to_status", nullable = false, length = 30)
    private DocumentStatus toStatus;

    @Column(name = "actor_id", nullable = false)
    private Long actorId;

    @Column(name = "created_at", nullable = false, updatable = false)
    @Builder.Default
    private Instant createdAt = Instant.now();
}
