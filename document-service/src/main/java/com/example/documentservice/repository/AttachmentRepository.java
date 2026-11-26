package com.example.documentservice.repository;

import com.example.documentservice.entity.Attachment;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface AttachmentRepository extends JpaRepository<Attachment, Long> {
    List<Attachment> findByDocumentIdAndIsCurrentTrueOrderByIdDesc(Long documentId);

    List<Attachment> findByDocumentIdOrderByIdDesc(Long documentId);

    Optional<Attachment> findByIdAndDocumentId(Long id, Long documentId);

    List<Attachment> findByDocumentIdAndFileGroupIdOrderByVersionNoDesc(Long documentId, String fileGroupId);
}
