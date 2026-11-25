package com.example.documentservice.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.util.Locale;

/** Hồ sơ lưu trữ văn bản theo phòng ban và năm. */
@Entity
@Table(name = "dossiers")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Dossier {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 50)
    private String code;

    @Column(name = "code_normalized", nullable = false, length = 50)
    private String codeNormalized;

    @Column(nullable = false, length = 255)
    private String name;

    @Column(name = "dossier_year", nullable = false)
    private int year;

    @Column(name = "department_id", nullable = false)
    private Long departmentId;

    @Column(name = "is_closed", nullable = false)
    @Builder.Default
    private boolean closed = false;

    @Column(name = "created_at", nullable = false, updatable = false)
    @Builder.Default
    private Instant createdAt = Instant.now();

    @PrePersist
    @PreUpdate
    void normalizeCode() {
        if (code != null) {
            code = code.trim();
            codeNormalized = code.toLowerCase(Locale.ROOT);
        }
    }
}
