package com.example.documentservice.service;

import com.example.documentservice.config.AttachmentProperties;
import com.example.documentservice.config.Caller;
import com.example.documentservice.dto.AttachmentResponse;
import com.example.documentservice.dto.PresignedUrlResponse;
import com.example.documentservice.entity.Attachment;
import com.example.documentservice.repository.AttachmentRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.io.InputStream;
import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

@Slf4j
@Service
public class AttachmentService {
    private final AttachmentRepository attachments;
    private final DocumentService documentService;
    private final ObjectStorage storage;
    private final FileValidator fileValidator;
    private final AttachmentProperties properties;
    private final TransactionTemplate tx;
    private final String bucket;

    public AttachmentService(
            AttachmentRepository attachments,
            DocumentService documentService,
            ObjectStorage storage,
            FileValidator fileValidator,
            AttachmentProperties properties,
            TransactionTemplate tx,
            @Value("${minio.bucket}") String bucket) {
        this.attachments = attachments;
        this.documentService = documentService;
        this.storage = storage;
        this.fileValidator = fileValidator;
        this.properties = properties;
        this.tx = tx;
        this.bucket = bucket;
    }

    @Transactional(readOnly = true)
    public List<AttachmentResponse> list(Caller caller, long docId, boolean includeHistory) {
        documentService.requireVisible(caller, docId);
        List<Attachment> rows = includeHistory
                ? attachments.findByDocumentIdOrderByIdDesc(docId)
                : attachments.findByDocumentIdAndIsCurrentTrueOrderByIdDesc(docId);
        return rows.stream().map(AttachmentResponse::from).toList();
    }

    @Transactional(readOnly = true)
    public List<AttachmentResponse> versions(Caller caller, long docId, long attachmentId) {
        documentService.requireVisible(caller, docId);
        Attachment target = attachments.findByIdAndDocumentId(attachmentId, docId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Attachment not found"));
        return attachments.findByDocumentIdAndFileGroupIdOrderByVersionNoDesc(docId, target.getFileGroupId())
                .stream().map(AttachmentResponse::from).toList();
    }

    public AttachmentResponse upload(Caller caller, long docId, MultipartFile file) {
        documentService.requireEditableDraft(caller, docId);
        FileValidator.ValidatedFile validated = fileValidator.validate(file);
        String groupId = UUID.randomUUID().toString();
        String key = buildStorageKey(docId, groupId, 1, validated.extension());
        putToStorage(key, file, validated);
        try {
            Attachment saved = tx.execute(status -> {
                documentService.requireEditableDraft(caller, docId);
                return attachments.saveAndFlush(Attachment.builder()
                        .documentId(docId)
                        .fileGroupId(groupId)
                        .fileName(validated.fileName())
                        .bucket(bucket)
                        .storageKey(key)
                        .mimeType(validated.mimeType())
                        .fileSize(validated.size())
                        .versionNo(1)
                        .isCurrent(true)
                        .uploadedBy(caller.id())
                        .build());
            });
            return AttachmentResponse.from(saved);
        } catch (RuntimeException e) {
            safeDelete(bucket, key);
            throw e;
        }
    }

    public AttachmentResponse replace(Caller caller, long docId, long attachmentId, MultipartFile file) {
        documentService.requireEditableDraft(caller, docId);
        Attachment target = attachments.findByIdAndDocumentId(attachmentId, docId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Attachment not found"));
        String groupId = target.getFileGroupId();
        Attachment latest = attachments.findByDocumentIdAndFileGroupIdOrderByVersionNoDesc(docId, groupId)
                .stream().findFirst()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Attachment not found"));
        int nextVersion = latest.getVersionNo() + 1;

        FileValidator.ValidatedFile validated = fileValidator.validate(file);
        String newKey = buildStorageKey(docId, groupId, nextVersion, validated.extension());
        putToStorage(newKey, file, validated);
        try {
            Attachment saved = tx.execute(status -> {
                documentService.requireEditableDraft(caller, docId);
                List<Attachment> currentVersions = attachments.findByDocumentIdAndFileGroupIdOrderByVersionNoDesc(docId, groupId);
                if (currentVersions.isEmpty()) {
                    throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Attachment not found");
                }
                int maxVersion = currentVersions.get(0).getVersionNo();
                if (maxVersion >= nextVersion) {
                    throw new ResponseStatusException(HttpStatus.CONFLICT, "Attachment was modified concurrently");
                }
                for (Attachment existing : currentVersions) {
                    if (existing.isCurrent()) {
                        existing.setCurrent(false);
                        attachments.saveAndFlush(existing);
                    }
                }
                return attachments.saveAndFlush(Attachment.builder()
                        .documentId(docId)
                        .fileGroupId(groupId)
                        .fileName(validated.fileName())
                        .bucket(bucket)
                        .storageKey(newKey)
                        .mimeType(validated.mimeType())
                        .fileSize(validated.size())
                        .versionNo(nextVersion)
                        .isCurrent(true)
                        .uploadedBy(caller.id())
                        .build());
            });
            return AttachmentResponse.from(saved);
        } catch (DataIntegrityViolationException e) {
            safeDelete(bucket, newKey);
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Attachment was modified concurrently", e);
        } catch (RuntimeException e) {
            safeDelete(bucket, newKey);
            throw e;
        }
    }

    public void delete(Caller caller, long docId, long attachmentId) {
        List<Attachment> deletedRows = tx.execute(status -> {
            documentService.requireEditableDraft(caller, docId);
            Attachment target = attachments.findByIdAndDocumentId(attachmentId, docId)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Attachment not found"));
            List<Attachment> groupRows = attachments.findByDocumentIdAndFileGroupIdOrderByVersionNoDesc(
                    docId, target.getFileGroupId());
            attachments.deleteAll(groupRows);
            attachments.flush();
            return groupRows;
        });
        if (deletedRows != null) {
            for (Attachment row : deletedRows) {
                safeDelete(row.getBucket(), row.getStorageKey());
            }
        }
    }

    @Transactional(readOnly = true)
    public PresignedUrlResponse presignUrl(Caller caller, long docId, long attachmentId, String disposition) {
        String normalized = disposition == null ? "inline" : disposition.trim().toLowerCase(Locale.ROOT);
        if (!"inline".equals(normalized) && !"attachment".equals(normalized)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "disposition must be 'inline' or 'attachment'");
        }
        documentService.requireVisible(caller, docId);
        Attachment attachment = attachments.findByIdAndDocumentId(attachmentId, docId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Attachment not found"));
        boolean inline = "inline".equals(normalized) && fileValidator.isPreviewable(attachment.getMimeType());
        String effectiveDisposition = inline ? "inline" : "attachment";
        int expirySeconds = properties.getPresignExpirySeconds();
        String url = storage.presignGet(
                attachment.getBucket(),
                attachment.getStorageKey(),
                attachment.getFileName(),
                attachment.getMimeType(),
                inline,
                expirySeconds);
        return new PresignedUrlResponse(url, Instant.now().plusSeconds(expirySeconds), expirySeconds, effectiveDisposition);
    }

    private void putToStorage(String key, MultipartFile file, FileValidator.ValidatedFile validated) {
        try (InputStream in = file.getInputStream()) {
            storage.put(bucket, key, in, validated.size(), validated.mimeType());
        } catch (IOException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unable to read uploaded file", e);
        }
    }

    private static String buildStorageKey(long docId, String groupId, int versionNo, String extension) {
        return "documents/" + docId + "/" + groupId + "/v" + versionNo + "/" + UUID.randomUUID() + extension;
    }

    private void safeDelete(String targetBucket, String key) {
        try {
            storage.delete(targetBucket, key);
        } catch (RuntimeException ex) {
            log.warn("Best-effort object cleanup failed for bucket={} key={}", targetBucket, key, ex);
        }
    }
}
