package com.example.documentservice;

import com.example.documentservice.client.CatalogClient;
import com.example.documentservice.entity.Attachment;
import com.example.documentservice.entity.Document;
import com.example.documentservice.entity.DocumentDirection;
import com.example.documentservice.entity.DocumentStatus;
import com.example.documentservice.repository.AttachmentRepository;
import com.example.documentservice.repository.DocumentHistoryRepository;
import com.example.documentservice.repository.DocumentRepository;
import com.example.documentservice.service.ObjectStorage;
import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.AbstractMockHttpServletRequestBuilder;
import org.springframework.web.multipart.MaxUploadSizeExceededException;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
class AttachmentApiIntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired DocumentRepository documents;
    @Autowired DocumentHistoryRepository histories;
    @Autowired AttachmentRepository attachments;
    @Autowired JdbcTemplate jdbc;

    @MockitoBean ObjectStorage storage;
    @MockitoBean CatalogClient catalog;

    static final long OWNER = 10L;
    static final long COLLEAGUE = 11L;
    static final long STRANGER = 20L;

    @BeforeEach
    void reset() {
        when(catalog.isActive(any(), anyLong())).thenReturn(true);
        when(storage.presignGet(anyString(), anyString(), anyString(), anyString(), anyBoolean(), anyInt()))
                .thenAnswer(inv -> "http://localhost:9000/" + inv.getArgument(0) + "/" + inv.getArgument(1)
                        + "?inline=" + inv.getArgument(4));
        jdbc.update("delete from attachments");
        histories.deleteAll();
        documents.deleteAll();
        jdbc.update("delete from dossiers");
    }

    private static <T extends AbstractMockHttpServletRequestBuilder<T>> T as(long id, T b) {
        long dept = id == STRANGER ? 2L : 1L;
        return b.header("X-User-Id", id)
                .header("X-User-Role", "EMPLOYEE")
                .header("X-Department-Id", dept);
    }

    private Document createDoc(long owner, long dept, DocumentStatus status) {
        return documents.save(Document.builder()
                .direction(DocumentDirection.INTERNAL)
                .docTypeId(1L)
                .summary("Văn bản kiểm thử")
                .urgencyId(2L)
                .confidentialityId(3L)
                .departmentId(dept)
                .ownerId(owner)
                .status(status)
                .build());
    }

    private static MockMultipartFile pdfFile(String name) {
        return new MockMultipartFile("file", name, "application/pdf",
                "%PDF-1.7\n1 0 obj\n<<>>\nendobj\n".getBytes(StandardCharsets.US_ASCII));
    }

    private static MockMultipartFile docxFile(String name) {
        return new MockMultipartFile("file", name,
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                new byte[]{0x50, 0x4B, 0x03, 0x04, 0x14, 0x00, 0x06, 0x00});
    }

    private long uploadAttachment(long caller, long docId, MockMultipartFile file) throws Exception {
        String json = mvc.perform(as(caller, multipart("/api/documents/" + docId + "/attachments").file(file)))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return ((Number) JsonPath.read(json, "$.id")).longValue();
    }

    // 1. Upload valid files & metadata-only DB
    @Test
    void upload_validFile_storesMetadataOnlyAndHidesStorageFields() throws Exception {
        Document draft = createDoc(OWNER, 1L, DocumentStatus.DRAFT);

        mvc.perform(as(OWNER, multipart("/api/documents/" + draft.getId() + "/attachments")
                        .file(pdfFile("Công văn số 01.pdf"))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.documentId").value(draft.getId()))
                .andExpect(jsonPath("$.fileName").value("Công văn số 01.pdf"))
                .andExpect(jsonPath("$.mimeType").value("application/pdf"))
                .andExpect(jsonPath("$.versionNo").value(1))
                .andExpect(jsonPath("$.isCurrent").value(true))
                .andExpect(jsonPath("$.uploadedBy").value(OWNER))
                .andExpect(jsonPath("$.uploadedAt").exists())
                .andExpect(jsonPath("$.bucket").doesNotExist())
                .andExpect(jsonPath("$.storageKey").doesNotExist());

        List<Attachment> saved = attachments.findByDocumentIdOrderByIdDesc(draft.getId());
        assertThat(saved).hasSize(1);
        Attachment row = saved.get(0);
        assertThat(row.getBucket()).isEqualTo("attachments");
        assertThat(row.getStorageKey()).startsWith("documents/" + draft.getId() + "/" + row.getFileGroupId() + "/v1/");
        assertThat(row.getStorageKey()).endsWith(".pdf");

        verify(storage).put(eq("attachments"), eq(row.getStorageKey()), any(), eq(row.getFileSize()), eq("application/pdf"));
    }

    // 2. Reject oversize / empty / spoofed + MaxUploadSizeExceededException 413 JSON
    @Test
    void upload_rejectsInvalidFilesBeforeTouchingStorage() throws Exception {
        Document draft = createDoc(OWNER, 1L, DocumentStatus.DRAFT);

        mvc.perform(as(OWNER, multipart("/api/documents/" + draft.getId() + "/attachments")
                        .file(new MockMultipartFile("file", "empty.pdf", "application/pdf", new byte[0]))))
                .andExpect(status().isBadRequest());

        byte[] oversize = new byte[10_485_761];
        System.arraycopy("%PDF-".getBytes(StandardCharsets.US_ASCII), 0, oversize, 0, 5);
        mvc.perform(as(OWNER, multipart("/api/documents/" + draft.getId() + "/attachments")
                        .file(new MockMultipartFile("file", "big.pdf", "application/pdf", oversize))))
                .andExpect(status().isContentTooLarge());

        mvc.perform(as(OWNER, multipart("/api/documents/" + draft.getId() + "/attachments")
                        .file(new MockMultipartFile("file", "spoof.pdf", "application/pdf",
                                "<script>alert(1)</script>".getBytes(StandardCharsets.UTF_8)))))
                .andExpect(status().isUnsupportedMediaType());

        mvc.perform(as(OWNER, multipart("/api/documents/" + draft.getId() + "/attachments")
                        .file(new MockMultipartFile("file", "icon.svg", "image/svg+xml",
                                "<svg/>".getBytes(StandardCharsets.UTF_8)))))
                .andExpect(status().isUnsupportedMediaType());

        assertThat(attachments.count()).isZero();
        verifyNoInteractions(storage);
    }

    @Test
    void maxUploadSizeExceeded_returns413Json() throws Exception {
        Document draft = createDoc(OWNER, 1L, DocumentStatus.DRAFT);
        doAnswer(inv -> {
            throw new MaxUploadSizeExceededException(26_214_400L);
        }).when(storage).put(anyString(), anyString(), any(), anyLong(), anyString());

        mvc.perform(as(OWNER, multipart("/api/documents/" + draft.getId() + "/attachments")
                        .file(pdfFile("doc.pdf"))))
                .andExpect(status().isContentTooLarge())
                .andExpect(jsonPath("$.status").value(413))
                .andExpect(jsonPath("$.error").exists())
                .andExpect(jsonPath("$.message").exists());
    }

    // 3. Non-owner 403 / stranger 404 / non-draft 409
    @Test
    void uploadAndReplace_enforceOwnerAndDraftOnly() throws Exception {
        Document draft = createDoc(OWNER, 1L, DocumentStatus.DRAFT);
        long attId = uploadAttachment(OWNER, draft.getId(), pdfFile("v1.pdf"));

        // Colleague cannot view owner's draft -> 404
        mvc.perform(as(COLLEAGUE, multipart("/api/documents/" + draft.getId() + "/attachments").file(pdfFile("x.pdf"))))
                .andExpect(status().isNotFound());
        // Stranger cannot view -> 404
        mvc.perform(as(STRANGER, multipart("/api/documents/" + draft.getId() + "/attachments").file(pdfFile("x.pdf"))))
                .andExpect(status().isNotFound());

        // Move document to PUBLISHED: colleague can view but is not owner -> 403; owner is not draft -> 409
        draft.setStatus(DocumentStatus.PUBLISHED);
        documents.save(draft);

        mvc.perform(as(COLLEAGUE, multipart("/api/documents/" + draft.getId() + "/attachments").file(pdfFile("x.pdf"))))
                .andExpect(status().isForbidden());
        mvc.perform(as(COLLEAGUE, multipart("/api/documents/" + draft.getId() + "/attachments/" + attId + "/replace").file(pdfFile("v2.pdf"))))
                .andExpect(status().isForbidden());

        mvc.perform(as(OWNER, multipart("/api/documents/" + draft.getId() + "/attachments").file(pdfFile("x.pdf"))))
                .andExpect(status().isConflict());
        mvc.perform(as(OWNER, multipart("/api/documents/" + draft.getId() + "/attachments/" + attId + "/replace").file(pdfFile("v2.pdf"))))
                .andExpect(status().isConflict());
    }

    // 4. Replace creates v2 & marks v1 isCurrent=false with distinct MinIO key
    @Test
    void replace_createsV2WithNewStorageKeyAndMarksV1NonCurrent() throws Exception {
        Document draft = createDoc(OWNER, 1L, DocumentStatus.DRAFT);
        long v1Id = uploadAttachment(OWNER, draft.getId(), pdfFile("v1.pdf"));
        Attachment v1Before = attachments.findById(v1Id).orElseThrow();

        String v2Json = mvc.perform(as(OWNER, multipart("/api/documents/" + draft.getId() + "/attachments/" + v1Id + "/replace")
                        .file(pdfFile("v2.pdf"))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.fileGroupId").value(v1Before.getFileGroupId()))
                .andExpect(jsonPath("$.versionNo").value(2))
                .andExpect(jsonPath("$.isCurrent").value(true))
                .andExpect(jsonPath("$.fileName").value("v2.pdf"))
                .andReturn().getResponse().getContentAsString();

        long v2Id = ((Number) JsonPath.read(v2Json, "$.id")).longValue();
        Attachment v1After = attachments.findById(v1Id).orElseThrow();
        Attachment v2 = attachments.findById(v2Id).orElseThrow();

        assertThat(v1After.isCurrent()).isFalse();
        assertThat(v2.isCurrent()).isTrue();
        assertThat(v2.getVersionNo()).isEqualTo(2);
        assertThat(v2.getStorageKey()).isNotEqualTo(v1Before.getStorageKey());
        assertThat(v2.getStorageKey()).contains("/v2/");

        ArgumentCaptor<String> keyCaptor = ArgumentCaptor.forClass(String.class);
        verify(storage, times(2)).put(eq("attachments"), keyCaptor.capture(), any(), anyLong(), eq("application/pdf"));
        assertThat(keyCaptor.getAllValues()).containsExactly(v1Before.getStorageKey(), v2.getStorageKey());

        mvc.perform(as(OWNER, get("/api/documents/" + draft.getId() + "/attachments")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].id").value(v2Id));

        mvc.perform(as(OWNER, get("/api/documents/" + draft.getId() + "/attachments").param("includeHistory", "true")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2));
    }

    // 5. Versions descending & both presignable
    @Test
    void versions_returnsDescending_andBothVersionsArePresignable() throws Exception {
        Document draft = createDoc(OWNER, 1L, DocumentStatus.DRAFT);
        long v1Id = uploadAttachment(OWNER, draft.getId(), pdfFile("v1.pdf"));
        String v2Json = mvc.perform(as(OWNER, multipart("/api/documents/" + draft.getId() + "/attachments/" + v1Id + "/replace")
                        .file(pdfFile("v2.pdf"))))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        long v2Id = ((Number) JsonPath.read(v2Json, "$.id")).longValue();

        mvc.perform(as(OWNER, get("/api/documents/" + draft.getId() + "/attachments/" + v1Id + "/versions")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].id").value(v2Id))
                .andExpect(jsonPath("$[0].versionNo").value(2))
                .andExpect(jsonPath("$[0].isCurrent").value(true))
                .andExpect(jsonPath("$[1].id").value(v1Id))
                .andExpect(jsonPath("$[1].versionNo").value(1))
                .andExpect(jsonPath("$[1].isCurrent").value(false));

        Attachment v1 = attachments.findById(v1Id).orElseThrow();
        Attachment v2 = attachments.findById(v2Id).orElseThrow();

        mvc.perform(as(OWNER, get("/api/documents/" + draft.getId() + "/attachments/" + v1Id + "/url")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.url").value(org.hamcrest.Matchers.containsString(v1.getStorageKey())));
        mvc.perform(as(OWNER, get("/api/documents/" + draft.getId() + "/attachments/" + v2Id + "/url")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.url").value(org.hamcrest.Matchers.containsString(v2.getStorageKey())));
    }

    // 6. Delete draft 204 vs non-draft 409 / non-owner 403
    @Test
    void delete_removesAllVersionsFromDbAndMinio_andEnforcesOwnerAndDraft() throws Exception {
        Document draft = createDoc(OWNER, 1L, DocumentStatus.DRAFT);
        long v1Id = uploadAttachment(OWNER, draft.getId(), pdfFile("v1.pdf"));
        mvc.perform(as(OWNER, multipart("/api/documents/" + draft.getId() + "/attachments/" + v1Id + "/replace")
                        .file(pdfFile("v2.pdf"))))
                .andExpect(status().isCreated());
        List<String> keys = attachments.findByDocumentIdOrderByIdDesc(draft.getId())
                .stream().map(Attachment::getStorageKey).toList();

        mvc.perform(as(OWNER, delete("/api/documents/" + draft.getId() + "/attachments/" + v1Id)))
                .andExpect(status().isNoContent());

        assertThat(attachments.findByDocumentIdOrderByIdDesc(draft.getId())).isEmpty();
        for (String key : keys) {
            verify(storage).delete("attachments", key);
        }

        // Non-draft & non-owner checks
        Document pending = createDoc(OWNER, 1L, DocumentStatus.DRAFT);
        long att2 = uploadAttachment(OWNER, pending.getId(), pdfFile("keep.pdf"));
        pending.setStatus(DocumentStatus.PENDING_PUBLICATION);
        documents.save(pending);

        mvc.perform(as(COLLEAGUE, delete("/api/documents/" + pending.getId() + "/attachments/" + att2)))
                .andExpect(status().isForbidden());
        mvc.perform(as(OWNER, delete("/api/documents/" + pending.getId() + "/attachments/" + att2)))
                .andExpect(status().isConflict());
        verify(storage, never()).delete(eq("attachments"), eq(attachments.findById(att2).orElseThrow().getStorageKey()));
    }

    // 7. Presign authorized inline & non-previewable DOCX downgrade to attachment
    @Test
    void presign_allowsInlineForPreviewableAndDowngradesDocxToAttachment() throws Exception {
        Document draft = createDoc(OWNER, 1L, DocumentStatus.DRAFT);
        long pdfId = uploadAttachment(OWNER, draft.getId(), pdfFile("preview.pdf"));
        long docxId = uploadAttachment(OWNER, draft.getId(), docxFile("vanban.docx"));

        mvc.perform(as(OWNER, get("/api/documents/" + draft.getId() + "/attachments/" + pdfId + "/url")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.disposition").value("inline"))
                .andExpect(jsonPath("$.expiresInSeconds").value(300))
                .andExpect(jsonPath("$.expiresAt").exists())
                .andExpect(jsonPath("$.url").exists());

        mvc.perform(as(OWNER, get("/api/documents/" + draft.getId() + "/attachments/" + pdfId + "/url")
                        .param("disposition", "attachment")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.disposition").value("attachment"));

        mvc.perform(as(OWNER, get("/api/documents/" + draft.getId() + "/attachments/" + docxId + "/url")
                        .param("disposition", "inline")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.disposition").value("attachment"));

        mvc.perform(as(OWNER, get("/api/documents/" + draft.getId() + "/attachments/" + pdfId + "/url")
                        .param("disposition", "invalid")))
                .andExpect(status().isBadRequest());
    }

    // 8. Unauthorized / unauthenticated presign denial + cross-doc IDOR 404
    @Test
    void presignAndEndpoints_enforceAuthVisibilityAndCrossDocumentIdor() throws Exception {
        Document doc1 = createDoc(OWNER, 1L, DocumentStatus.DRAFT);
        Document doc2 = createDoc(OWNER, 1L, DocumentStatus.DRAFT);
        long att1 = uploadAttachment(OWNER, doc1.getId(), pdfFile("secret.pdf"));

        // Unauthenticated
        mvc.perform(get("/api/documents/" + doc1.getId() + "/attachments/" + att1 + "/url"))
                .andExpect(status().isUnauthorized());

        // Colleague cannot presign owner's DRAFT -> 404
        mvc.perform(as(COLLEAGUE, get("/api/documents/" + doc1.getId() + "/attachments/" + att1 + "/url")))
                .andExpect(status().isNotFound());

        // Publish doc1; stranger in dept 2 still cannot view -> 404; colleague in dept 1 CAN presign -> 200
        doc1.setStatus(DocumentStatus.PUBLISHED);
        documents.save(doc1);
        mvc.perform(as(STRANGER, get("/api/documents/" + doc1.getId() + "/attachments/" + att1 + "/url")))
                .andExpect(status().isNotFound());
        mvc.perform(as(COLLEAGUE, get("/api/documents/" + doc1.getId() + "/attachments/" + att1 + "/url")))
                .andExpect(status().isOk());

        // Cross-doc IDOR: att1 belongs to doc1, requesting under doc2 (even when doc2 is editable DRAFT) -> 404
        mvc.perform(as(OWNER, get("/api/documents/" + doc2.getId() + "/attachments/" + att1 + "/url")))
                .andExpect(status().isNotFound());
        mvc.perform(as(OWNER, get("/api/documents/" + doc2.getId() + "/attachments/" + att1 + "/versions")))
                .andExpect(status().isNotFound());
        mvc.perform(as(OWNER, multipart("/api/documents/" + doc2.getId() + "/attachments/" + att1 + "/replace").file(pdfFile("x.pdf"))))
                .andExpect(status().isNotFound());
        mvc.perform(as(OWNER, delete("/api/documents/" + doc2.getId() + "/attachments/" + att1)))
                .andExpect(status().isNotFound());
    }

    // 9. DB failure cleans up MinIO object (upload & replace)
    @Test
    void dbFailureDuringUploadOrReplace_cleansUpNewlyUploadedObject() throws Exception {
        Document draft = createDoc(OWNER, 1L, DocumentStatus.DRAFT);

        // Simulate document becoming PUBLISHED while MinIO upload is in flight -> tx fails with 409
        doAnswer(inv -> {
            Document d = documents.findById(draft.getId()).orElseThrow();
            d.setStatus(DocumentStatus.PUBLISHED);
            documents.saveAndFlush(d);
            return null;
        }).when(storage).put(anyString(), anyString(), any(), anyLong(), anyString());

        mvc.perform(as(OWNER, multipart("/api/documents/" + draft.getId() + "/attachments").file(pdfFile("race.pdf"))))
                .andExpect(status().isConflict());

        ArgumentCaptor<String> putKey = ArgumentCaptor.forClass(String.class);
        verify(storage).put(eq("attachments"), putKey.capture(), any(), anyLong(), eq("application/pdf"));
        verify(storage).delete("attachments", putKey.getValue());
        assertThat(attachments.count()).isZero();

        // Now reset storage mock and test replace conflict cleanup when a concurrent v2 inserts first
        org.mockito.Mockito.reset(storage);
        draft.setStatus(DocumentStatus.DRAFT);
        documents.saveAndFlush(draft);
        long v1Id = uploadAttachment(OWNER, draft.getId(), pdfFile("v1.pdf"));
        Attachment v1 = attachments.findById(v1Id).orElseThrow();

        doAnswer(inv -> {
            attachments.saveAndFlush(Attachment.builder()
                    .documentId(draft.getId())
                    .fileGroupId(v1.getFileGroupId())
                    .fileName("winner.pdf")
                    .bucket("attachments")
                    .storageKey("documents/" + draft.getId() + "/" + v1.getFileGroupId() + "/v2/" + UUID.randomUUID() + ".pdf")
                    .mimeType("application/pdf")
                    .fileSize(10L)
                    .versionNo(2)
                    .isCurrent(true)
                    .uploadedBy(OWNER)
                    .build());
            return null;
        }).when(storage).put(anyString(), anyString(), any(), anyLong(), anyString());

        mvc.perform(as(OWNER, multipart("/api/documents/" + draft.getId() + "/attachments/" + v1Id + "/replace")
                        .file(pdfFile("loser.pdf"))))
                .andExpect(status().isConflict());

        ArgumentCaptor<String> replaceKeys = ArgumentCaptor.forClass(String.class);
        verify(storage, times(2)).put(eq("attachments"), replaceKeys.capture(), any(), anyLong(), eq("application/pdf"));
        String failedV2Key = replaceKeys.getAllValues().get(1);
        verify(storage).delete("attachments", failedV2Key);
    }

    // 10. OpenAPI paths check + caller hidden
    @Test
    void openApi_documentsAllAttachmentOperations_andHidesCaller() throws Exception {
        mvc.perform(get("/v3/api-docs").accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.paths['/api/documents/{documentId}/attachments'].get").exists())
                .andExpect(jsonPath("$.paths['/api/documents/{documentId}/attachments'].post").exists())
                .andExpect(jsonPath("$.paths['/api/documents/{documentId}/attachments/{attachmentId}/versions'].get").exists())
                .andExpect(jsonPath("$.paths['/api/documents/{documentId}/attachments/{attachmentId}/replace'].post").exists())
                .andExpect(jsonPath("$.paths['/api/documents/{documentId}/attachments/{attachmentId}'].delete").exists())
                .andExpect(jsonPath("$.paths['/api/documents/{documentId}/attachments/{attachmentId}/url'].get").exists())
                .andExpect(jsonPath("$.paths['/api/documents/{documentId}/attachments'].get.parameters[?(@.name=='caller')]").isEmpty())
                .andExpect(jsonPath("$.paths['/api/documents/{documentId}/attachments'].post.parameters[?(@.name=='caller')]").isEmpty())
                .andExpect(jsonPath("$.paths['/api/documents/{documentId}/attachments/{attachmentId}/versions'].get.parameters[?(@.name=='caller')]").isEmpty())
                .andExpect(jsonPath("$.paths['/api/documents/{documentId}/attachments/{attachmentId}/replace'].post.parameters[?(@.name=='caller')]").isEmpty())
                .andExpect(jsonPath("$.paths['/api/documents/{documentId}/attachments/{attachmentId}'].delete.parameters[?(@.name=='caller')]").isEmpty())
                .andExpect(jsonPath("$.paths['/api/documents/{documentId}/attachments/{attachmentId}/url'].get.parameters[?(@.name=='caller')]").isEmpty());
    }
}
