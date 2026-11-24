package com.example.documentservice;

import com.example.documentservice.client.CatalogClient;
import com.example.documentservice.entity.Document;
import com.example.documentservice.entity.DocumentDirection;
import com.example.documentservice.entity.DocumentStatus;
import com.example.documentservice.entity.Dossier;
import com.example.documentservice.repository.DocumentHistoryRepository;
import com.example.documentservice.repository.DocumentRepository;
import com.example.documentservice.repository.DossierRepository;
import com.jayway.jsonpath.JsonPath;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import java.time.Instant;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
class DossierApiIntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired DossierRepository dossiers;
    @Autowired DocumentRepository documents;
    @Autowired DocumentHistoryRepository histories;
    @Autowired JdbcTemplate jdbc;

    @MockitoBean CatalogClient catalog;

    static final long OWNER = 10L;
    static final long COLLEAGUE = 11L;
    static final long MANAGER = 12L;
    static final long STRANGER = 20L;
    static final long ADMIN = 1L;

    @BeforeEach
    void reset() {
        when(catalog.isActive(any(), anyLong())).thenReturn(true);
        jdbc.update("delete from attachments");
        histories.deleteAll();
        documents.deleteAll();
        dossiers.deleteAll();
    }

    private static MockHttpServletRequestBuilder as(long id, MockHttpServletRequestBuilder b) {
        long dept = id == STRANGER ? 2L : id == ADMIN ? 9L : 1L;
        String role = id == ADMIN ? "ADMIN" : id == MANAGER ? "MANAGER" : "EMPLOYEE";
        return asRole(id, role, dept, b);
    }

    private static MockHttpServletRequestBuilder asRole(long id, String role, long dept, MockHttpServletRequestBuilder b) {
        return b.header("X-User-Id", id)
                .header("X-User-Role", role)
                .header("X-Department-Id", dept)
                .contentType(MediaType.APPLICATION_JSON);
    }

    private long createDossier(long caller, String code, String name, int year) throws Exception {
        String body = """
                {"code":"%s","name":"%s","year":%d}""".formatted(code, name, year);
        String res = mvc.perform(as(caller, post("/api/dossiers")).content(body))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return ((Number) JsonPath.read(res, "$.id")).longValue();
    }

    private Document saveDoc(long owner, long dept, DocumentStatus status, Long dossierId) {
        return documents.save(Document.builder()
                .direction(DocumentDirection.INTERNAL)
                .docTypeId(1L)
                .summary("Văn bản " + status)
                .urgencyId(2L)
                .confidentialityId(3L)
                .departmentId(dept)
                .ownerId(owner)
                .status(status)
                .dossierId(dossierId)
                .build());
    }

    // ── OpenAPI & Auth ──────────────────────────────────────────────────────────

    @Test
    void openApi_documentsAllDossierOperations_andHidesCaller() throws Exception {
        mvc.perform(get("/v3/api-docs").accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.paths['/api/dossiers'].get").exists())
                .andExpect(jsonPath("$.paths['/api/dossiers'].post").exists())
                .andExpect(jsonPath("$.paths['/api/dossiers/{id}'].get").exists())
                .andExpect(jsonPath("$.paths['/api/dossiers/{id}'].put").exists())
                .andExpect(jsonPath("$.paths['/api/dossiers/{id}/close'].post").exists())
                .andExpect(jsonPath("$.paths['/api/dossiers/{id}/documents'].get").exists())
                .andExpect(jsonPath("$.paths['/api/dossiers/{id}/documents'].post").exists())
                .andExpect(jsonPath("$.paths['/api/dossiers/{id}/available-documents'].get").exists())
                .andExpect(jsonPath("$.paths['/api/dossiers/{id}/documents/{documentId}'].delete").exists())
                .andExpect(jsonPath("$.paths['/api/dossiers'].get.parameters[?(@.name=='caller')]").isEmpty())
                .andExpect(jsonPath("$.paths['/api/dossiers'].post.parameters").doesNotExist())
                .andExpect(jsonPath("$.paths['/api/dossiers/{id}'].get.parameters[?(@.name=='caller')]").isEmpty())
                .andExpect(jsonPath("$.paths['/api/dossiers/{id}'].put.parameters[?(@.name=='caller')]").isEmpty())
                .andExpect(jsonPath("$.paths['/api/dossiers/{id}/close'].post.parameters[?(@.name=='caller')]").isEmpty())
                .andExpect(jsonPath("$.paths['/api/dossiers/{id}/documents'].get.parameters[?(@.name=='caller')]").isEmpty())
                .andExpect(jsonPath("$.paths['/api/dossiers/{id}/documents'].post.parameters[?(@.name=='caller')]").isEmpty())
                .andExpect(jsonPath("$.paths['/api/dossiers/{id}/available-documents'].get.parameters[?(@.name=='caller')]").isEmpty())
                .andExpect(jsonPath("$.paths['/api/dossiers/{id}/documents/{documentId}'].delete.parameters[?(@.name=='caller')]").isEmpty());
    }

    @Test
    void missingOrMalformedIdentity_401() throws Exception {
        mvc.perform(get("/api/dossiers")).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/dossiers").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"code\":\"HS-01\",\"name\":\"Test\",\"year\":2026}"))
                .andExpect(status().isUnauthorized());
        mvc.perform(get("/api/dossiers")
                        .header("X-User-Id", "bad")
                        .header("X-User-Role", "EMPLOYEE")
                        .header("X-Department-Id", 1))
                .andExpect(status().isUnauthorized());
        mvc.perform(get("/api/dossiers")
                        .header("X-User-Id", 10)
                        .header("X-User-Role", "EMPLOYEE"))
                .andExpect(status().isUnauthorized());
    }

    // ── Create, Validation & Duplicate Conflict ─────────────────────────────────

    @Test
    void create_trimsFields_setsDepartmentAndDefaults() throws Exception {
        mvc.perform(as(OWNER, post("/api/dossiers"))
                        .content("{\"code\":\"  HS-01  \",\"name\":\"  Hồ sơ hành chính  \",\"year\":2026}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").isNumber())
                .andExpect(jsonPath("$.code").value("HS-01"))
                .andExpect(jsonPath("$.name").value("Hồ sơ hành chính"))
                .andExpect(jsonPath("$.year").value(2026))
                .andExpect(jsonPath("$.departmentId").value(1))
                .andExpect(jsonPath("$.closed").value(false))
                .andExpect(jsonPath("$.documentCount").value(0))
                .andExpect(jsonPath("$.createdAt").exists());
    }

    @Test
    void create_invalidBody_returns400WithFieldErrors() throws Exception {
        mvc.perform(as(OWNER, post("/api/dossiers")).content("{\"code\":\"  \",\"name\":\"\",\"year\":1899}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400))
                .andExpect(jsonPath("$.message").exists())
                .andExpect(jsonPath("$.fieldErrors.code").exists())
                .andExpect(jsonPath("$.fieldErrors.name").exists())
                .andExpect(jsonPath("$.fieldErrors.year").exists());

        mvc.perform(as(OWNER, post("/api/dossiers")).content("{\"code\":\"HS-01\",\"name\":\"Valid\",\"year\":2101}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors.year").exists());
    }

    @Test
    void create_duplicateCode_409WithFieldErrors_caseInsensitiveAndTrimmed_butAllowedAcrossYearsOrDepts() throws Exception {
        createDossier(OWNER, "HS-01", "Hồ sơ gốc", 2026);

        // Same dept + same year + different case & whitespace -> 409 + fieldErrors.code
        mvc.perform(as(COLLEAGUE, post("/api/dossiers"))
                        .content("{\"code\":\"  hs-01 \",\"name\":\"Trùng mã\",\"year\":2026}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.status").value(409))
                .andExpect(jsonPath("$.error").value("Conflict"))
                .andExpect(jsonPath("$.message").value("Record code already exists for this department and year."))
                .andExpect(jsonPath("$.fieldErrors.code").value("This code already exists for this department and year."));

        // Same code in different year -> 201
        mvc.perform(as(OWNER, post("/api/dossiers"))
                        .content("{\"code\":\"hs-01\",\"name\":\"Năm khác\",\"year\":2025}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.year").value(2025));

        // Same code and year in different department -> 201
        mvc.perform(as(STRANGER, post("/api/dossiers"))
                        .content("{\"code\":\"HS-01\",\"name\":\"Đơn vị khác\",\"year\":2026}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.departmentId").value(2));

        // DB unique constraint itself enforces case-insensitive uniqueness via code_normalized (race-condition protection)
        assertThatThrownBy(() -> dossiers.saveAndFlush(Dossier.builder()
                .code("hS-01")
                .name("Concurrent race")
                .year(2026)
                .departmentId(1L)
                .build()))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    // ── List, Filter, Get & DocumentCount ──────────────────────────────────────

    @Test
    void listAndGet_filterByYearAndClosed_sortYearDescIdDesc_countActiveDocs_andIsolateDepartments() throws Exception {
        long d2025 = createDossier(OWNER, "HS-25", "Hồ sơ 2025", 2025);
        long d2026a = createDossier(OWNER, "HS-26A", "Hồ sơ 2026 A", 2026);
        long d2026b = createDossier(OWNER, "HS-26B", "Hồ sơ 2026 B", 2026);
        long otherDept = createDossier(STRANGER, "HS-99", "Hồ sơ phòng 2", 2026);

        mvc.perform(as(OWNER, post("/api/dossiers/" + d2025 + "/close"))).andExpect(status().isOk());

        // Add 2 active docs (1 DRAFT, 1 PUBLISHED) and 1 soft-deleted doc to d2026a
        saveDoc(OWNER, 1L, DocumentStatus.DRAFT, d2026a);
        saveDoc(COLLEAGUE, 1L, DocumentStatus.PUBLISHED, d2026a);
        Document deleted = saveDoc(OWNER, 1L, DocumentStatus.DRAFT, d2026a);
        deleted.setDeletedAt(Instant.now());
        documents.save(deleted);

        // List all for dept 1 -> sorted year DESC, id DESC: d2026b, d2026a, d2025 (otherDept excluded)
        mvc.perform(as(COLLEAGUE, get("/api/dossiers")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(3))
                .andExpect(jsonPath("$.content[0].id").value(d2026b))
                .andExpect(jsonPath("$.content[0].documentCount").value(0))
                .andExpect(jsonPath("$.content[1].id").value(d2026a))
                .andExpect(jsonPath("$.content[1].documentCount").value(2))
                .andExpect(jsonPath("$.content[2].id").value(d2025))
                .andExpect(jsonPath("$.content[2].closed").value(true));

        // Filter year=2026 & closed=false
        mvc.perform(as(OWNER, get("/api/dossiers").param("year", "2026").param("closed", "false")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(2))
                .andExpect(jsonPath("$.content[0].id").value(d2026b))
                .andExpect(jsonPath("$.content[1].id").value(d2026a));

        // Filter closed=true
        mvc.perform(as(OWNER, get("/api/dossiers").param("closed", "true")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].id").value(d2025));

        // Pagination
        mvc.perform(as(OWNER, get("/api/dossiers").param("page", "1").param("size", "2")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.page").value(1))
                .andExpect(jsonPath("$.size").value(2))
                .andExpect(jsonPath("$.totalElements").value(3))
                .andExpect(jsonPath("$.totalPages").value(2))
                .andExpect(jsonPath("$.content.length()").value(1))
                .andExpect(jsonPath("$.content[0].id").value(d2025));

        // Bad pagination params -> 400
        mvc.perform(as(OWNER, get("/api/dossiers").param("page", "-1"))).andExpect(status().isBadRequest());
        mvc.perform(as(OWNER, get("/api/dossiers").param("size", "101"))).andExpect(status().isBadRequest());
        mvc.perform(as(OWNER, get("/api/dossiers").param("size", "0"))).andExpect(status().isBadRequest());

        // Get owned dossier -> 200 with documentCount; other dept -> 404; ADMIN -> 403
        mvc.perform(as(COLLEAGUE, get("/api/dossiers/" + d2026a)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.documentCount").value(2));
        mvc.perform(as(OWNER, get("/api/dossiers/" + otherDept))).andExpect(status().isNotFound());
        mvc.perform(as(ADMIN, get("/api/dossiers/" + d2026a))).andExpect(status().isForbidden());
        mvc.perform(as(ADMIN, get("/api/dossiers"))).andExpect(status().isForbidden());
    }

    @Test
    void roleAccess_onlyEmployeeAndManagerAllowed_adminAndOtherRoles403() throws Exception {
        long d1 = createDossier(OWNER, "HS-EMP", "Hồ sơ nhân viên", 2026);
        long otherDept = createDossier(STRANGER, "HS-DEPT2", "Hồ sơ phòng 2", 2026);
        Document doc1 = saveDoc(OWNER, 1L, DocumentStatus.PUBLISHED, null);

        // MANAGER in same department can list, create, get, update, attach, view, detach, close; other dept -> 404
        mvc.perform(as(MANAGER, get("/api/dossiers"))).andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1));
        long d2 = createDossier(MANAGER, "HS-MGR", "Hồ sơ trưởng phòng", 2026);
        mvc.perform(as(MANAGER, get("/api/dossiers/" + d1))).andExpect(status().isOk());
        mvc.perform(as(MANAGER, put("/api/dossiers/" + d2))
                        .content("{\"code\":\"HS-MGR-2\",\"name\":\"Cập nhật\",\"year\":2026}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value("HS-MGR-2"));
        mvc.perform(as(MANAGER, get("/api/dossiers/" + d2 + "/available-documents"))).andExpect(status().isOk());
        mvc.perform(as(MANAGER, post("/api/dossiers/" + d2 + "/documents"))
                        .content("{\"documentId\":" + doc1.getId() + "}"))
                .andExpect(status().isOk());
        mvc.perform(as(MANAGER, get("/api/dossiers/" + d2 + "/documents"))).andExpect(status().isOk());
        mvc.perform(as(MANAGER, delete("/api/dossiers/" + d2 + "/documents/" + doc1.getId())))
                .andExpect(status().isNoContent());
        mvc.perform(as(MANAGER, post("/api/dossiers/" + d2 + "/close"))).andExpect(status().isOk());
        mvc.perform(as(MANAGER, get("/api/dossiers/" + otherDept))).andExpect(status().isNotFound());

        // ADMIN receives 403 on ALL dossier endpoints even when X-Department-Id matches an existing dossier's departmentId
        mvc.perform(asRole(ADMIN, "ADMIN", 1L, get("/api/dossiers"))).andExpect(status().isForbidden());
        mvc.perform(asRole(ADMIN, "ADMIN", 1L, post("/api/dossiers"))
                        .content("{\"code\":\"HS-ADM\",\"name\":\"Admin\",\"year\":2026}"))
                .andExpect(status().isForbidden());
        mvc.perform(asRole(ADMIN, "ADMIN", 1L, get("/api/dossiers/" + d1))).andExpect(status().isForbidden());
        mvc.perform(asRole(ADMIN, "ADMIN", 1L, put("/api/dossiers/" + d1))
                        .content("{\"code\":\"HS-ADM\",\"name\":\"Admin\",\"year\":2026}"))
                .andExpect(status().isForbidden());
        mvc.perform(asRole(ADMIN, "ADMIN", 1L, post("/api/dossiers/" + d1 + "/close"))).andExpect(status().isForbidden());
        mvc.perform(asRole(ADMIN, "ADMIN", 1L, get("/api/dossiers/" + d1 + "/documents"))).andExpect(status().isForbidden());
        mvc.perform(asRole(ADMIN, "ADMIN", 1L, get("/api/dossiers/" + d1 + "/available-documents"))).andExpect(status().isForbidden());
        mvc.perform(asRole(ADMIN, "ADMIN", 1L, post("/api/dossiers/" + d1 + "/documents"))
                        .content("{\"documentId\":" + doc1.getId() + "}"))
                .andExpect(status().isForbidden());
        mvc.perform(asRole(ADMIN, "ADMIN", 1L, delete("/api/dossiers/" + d1 + "/documents/" + doc1.getId())))
                .andExpect(status().isForbidden());

        // Unrecognized role also gets 403
        mvc.perform(asRole(99L, "GUEST", 1L, get("/api/dossiers"))).andExpect(status().isForbidden());
    }

    // ── Update & Close ──────────────────────────────────────────────────────────

    @Test
    void update_checksOwnershipClosedAndDuplicateCode() throws Exception {
        long id1 = createDossier(OWNER, "HS-01", "Hồ sơ 1", 2026);
        long id2 = createDossier(OWNER, "HS-02", "Hồ sơ 2", 2026);
        long otherDept = createDossier(STRANGER, "HS-99", "Phòng khác", 2026);
        saveDoc(OWNER, 1L, DocumentStatus.PUBLISHED, id1);

        // Self update with same code (case change) and trimmed name -> 200
        mvc.perform(as(COLLEAGUE, put("/api/dossiers/" + id1))
                        .content("{\"code\":\"  hs-01 \",\"name\":\"  Hồ sơ 1 mới  \",\"year\":2026}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value("hs-01"))
                .andExpect(jsonPath("$.name").value("Hồ sơ 1 mới"))
                .andExpect(jsonPath("$.documentCount").value(1));

        // Conflict with id2's code -> 409 + fieldErrors.code
        mvc.perform(as(OWNER, put("/api/dossiers/" + id1))
                        .content("{\"code\":\"hs-02\",\"name\":\"Đổi\",\"year\":2026}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.fieldErrors.code").exists());

        // Other department -> 404
        mvc.perform(as(OWNER, put("/api/dossiers/" + otherDept))
                        .content("{\"code\":\"HS-X\",\"name\":\"Đổi\",\"year\":2026}"))
                .andExpect(status().isNotFound());

        // Close id1 -> 200; repeat close -> 409; update closed -> 409; close other dept -> 404
        mvc.perform(as(OWNER, post("/api/dossiers/" + id1 + "/close")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.closed").value(true))
                .andExpect(jsonPath("$.documentCount").value(1));

        mvc.perform(as(OWNER, post("/api/dossiers/" + id1 + "/close")))
                .andExpect(status().isConflict());

        mvc.perform(as(OWNER, put("/api/dossiers/" + id1))
                        .content("{\"code\":\"HS-01B\",\"name\":\"Sửa sau đóng\",\"year\":2026}"))
                .andExpect(status().isConflict());

        mvc.perform(as(OWNER, post("/api/dossiers/" + otherDept + "/close")))
                .andExpect(status().isNotFound());
    }

    // ── Attach, Available Documents, Dossier Documents, Detach ──────────────────

    @Test
    void attachAvailableListAndDetach_enforceVisibilityOwnershipClosedAndIdempotency() throws Exception {
        long dossier1 = createDossier(OWNER, "HS-01", "Hồ sơ 1", 2026);
        long dossier2 = createDossier(OWNER, "HS-02", "Hồ sơ 2", 2026);
        long otherDeptDossier = createDossier(STRANGER, "HS-03", "Hồ sơ phòng 2", 2026);

        Document myDraft = saveDoc(OWNER, 1L, DocumentStatus.DRAFT, null);
        Document colleagueDraft = saveDoc(COLLEAGUE, 1L, DocumentStatus.DRAFT, null);
        Document published = saveDoc(COLLEAGUE, 1L, DocumentStatus.PUBLISHED, null);
        Document approverDocOtherDept = saveDoc(STRANGER, 2L, DocumentStatus.PENDING_PUBLICATION, null);
        approverDocOtherDept.setCurrentApproverId(OWNER);
        documents.save(approverDocOtherDept);
        Document deletedDoc = saveDoc(OWNER, 1L, DocumentStatus.DRAFT, null);
        deletedDoc.setDeletedAt(Instant.now());
        documents.save(deletedDoc);

        // Available documents for OWNER in dossier1: published + myDraft, sorted id DESC;
        // excludes colleagueDraft (not visible), approverDocOtherDept (dept 2!), deletedDoc
        String availJson = mvc.perform(as(OWNER, get("/api/dossiers/" + dossier1 + "/available-documents")))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        List<Long> availIds = JsonPath.<List<Number>>read(availJson, "$[*].id").stream().map(Number::longValue).toList();
        assertThat(availIds).containsExactly(published.getId(), myDraft.getId());

        // Attach DRAFT and PUBLISHED -> 200
        mvc.perform(as(OWNER, post("/api/dossiers/" + dossier1 + "/documents"))
                        .content("{\"documentId\":" + myDraft.getId() + "}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.dossierId").value(dossier1));
        mvc.perform(as(OWNER, post("/api/dossiers/" + dossier1 + "/documents"))
                        .content("{\"documentId\":" + published.getId() + "}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.dossierId").value(dossier1));

        // Idempotent re-attach to same dossier -> 200
        mvc.perform(as(OWNER, post("/api/dossiers/" + dossier1 + "/documents"))
                        .content("{\"documentId\":" + published.getId() + "}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.dossierId").value(dossier1));

        // Attach doc already attached to dossier1 into dossier2 -> 409
        mvc.perform(as(OWNER, post("/api/dossiers/" + dossier2 + "/documents"))
                        .content("{\"documentId\":" + published.getId() + "}"))
                .andExpect(status().isConflict());

        // Attach invisible doc (colleagueDraft to OWNER) -> 404; missing doc -> 404
        mvc.perform(as(OWNER, post("/api/dossiers/" + dossier1 + "/documents"))
                        .content("{\"documentId\":" + colleagueDraft.getId() + "}"))
                .andExpect(status().isNotFound());
        mvc.perform(as(OWNER, post("/api/dossiers/" + dossier1 + "/documents"))
                        .content("{\"documentId\":99999}"))
                .andExpect(status().isNotFound());

        // Attach visible doc from dept 2 (OWNER is currentApproverId) into dept 1 dossier -> 403
        mvc.perform(as(OWNER, post("/api/dossiers/" + dossier1 + "/documents"))
                        .content("{\"documentId\":" + approverDocOtherDept.getId() + "}"))
                .andExpect(status().isForbidden());

        // Attach/list/available on other dept's dossier -> 404
        mvc.perform(as(OWNER, post("/api/dossiers/" + otherDeptDossier + "/documents"))
                        .content("{\"documentId\":" + myDraft.getId() + "}"))
                .andExpect(status().isNotFound());
        mvc.perform(as(OWNER, get("/api/dossiers/" + otherDeptDossier + "/documents"))).andExpect(status().isNotFound());
        mvc.perform(as(OWNER, get("/api/dossiers/" + otherDeptDossier + "/available-documents"))).andExpect(status().isNotFound());

        // List dossier documents: OWNER sees published + myDraft (id DESC); COLLEAGUE only sees published
        mvc.perform(as(OWNER, get("/api/dossiers/" + dossier1 + "/documents")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].id").value(published.getId()))
                .andExpect(jsonPath("$[1].id").value(myDraft.getId()));
        mvc.perform(as(COLLEAGUE, get("/api/dossiers/" + dossier1 + "/documents")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].id").value(published.getId()));

        // Available documents now empty for OWNER in dossier1
        mvc.perform(as(OWNER, get("/api/dossiers/" + dossier1 + "/available-documents")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(0));

        // Detach doc not in dossier2 -> 404
        mvc.perform(as(OWNER, delete("/api/dossiers/" + dossier2 + "/documents/" + published.getId())))
                .andExpect(status().isNotFound());

        // Detach published from dossier1 -> 204
        mvc.perform(as(OWNER, delete("/api/dossiers/" + dossier1 + "/documents/" + published.getId())))
                .andExpect(status().isNoContent());
        assertThat(documents.findById(published.getId()).orElseThrow().getDossierId()).isNull();

        // Now close dossier1 -> blocks attach and detach with 409, while read endpoints still return 200
        mvc.perform(as(OWNER, post("/api/dossiers/" + dossier1 + "/close"))).andExpect(status().isOk());
        mvc.perform(as(OWNER, post("/api/dossiers/" + dossier1 + "/documents"))
                        .content("{\"documentId\":" + published.getId() + "}"))
                .andExpect(status().isConflict());
        mvc.perform(as(OWNER, delete("/api/dossiers/" + dossier1 + "/documents/" + myDraft.getId())))
                .andExpect(status().isConflict());
        mvc.perform(as(OWNER, get("/api/dossiers/" + dossier1 + "/documents")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1));
        mvc.perform(as(OWNER, get("/api/dossiers/" + dossier1 + "/available-documents")))
                .andExpect(status().isOk());
    }

    // ── Document Create / Update Dossier Guards ─────────────────────────────────

    @Test
    void documentCreateAndUpdate_enforceDossierDepartmentAndClosedGuards() throws Exception {
        long openDossier = createDossier(OWNER, "HS-OPEN", "Đang mở", 2026);
        long secondOpenDossier = createDossier(OWNER, "HS-OPEN-2", "Đang mở 2", 2026);
        long closedDossier = createDossier(OWNER, "HS-CLOSED", "Đã đóng", 2026);
        long otherDeptDossier = createDossier(STRANGER, "HS-OTHER", "Phòng 2", 2026);
        mvc.perform(as(OWNER, post("/api/dossiers/" + closedDossier + "/close"))).andExpect(status().isOk());

        // POST /api/documents guards
        mvc.perform(as(OWNER, post("/api/documents")).content("""
                {"direction":"INTERNAL","docTypeId":1,"summary":"x","urgencyId":2,"confidentialityId":3,"dossierId":%d}"""
                .formatted(closedDossier))).andExpect(status().isConflict());

        mvc.perform(as(OWNER, post("/api/documents")).content("""
                {"direction":"INTERNAL","docTypeId":1,"summary":"x","urgencyId":2,"confidentialityId":3,"dossierId":%d}"""
                .formatted(otherDeptDossier))).andExpect(status().isForbidden());

        // Create doc inside openDossier -> 201
        String createdJson = mvc.perform(as(OWNER, post("/api/documents")).content("""
                {"direction":"INTERNAL","docTypeId":1,"summary":"ban đầu","urgencyId":2,"confidentialityId":3,"dossierId":%d}"""
                .formatted(openDossier))).andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        long docId = ((Number) JsonPath.read(createdJson, "$.id")).longValue();

        // Now close openDossier while docId is already attached
        mvc.perform(as(OWNER, post("/api/dossiers/" + openDossier + "/close"))).andExpect(status().isOk());

        // Updating other fields while keeping same closed dossierId -> 200
        mvc.perform(as(OWNER, put("/api/documents/" + docId)).content("""
                {"direction":"INTERNAL","docTypeId":1,"summary":"đã sửa nội dung","urgencyId":2,"confidentialityId":3,"dossierId":%d}"""
                .formatted(openDossier)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.summary").value("đã sửa nội dung"))
                .andExpect(jsonPath("$.dossierId").value(openDossier));

        // Detaching (dossierId null) away from closed dossier -> 409
        mvc.perform(as(OWNER, put("/api/documents/" + docId)).content("""
                {"direction":"INTERNAL","docTypeId":1,"summary":"tách hồ sơ","urgencyId":2,"confidentialityId":3}"""))
                .andExpect(status().isConflict());

        // Moving away from closed dossier to another open dossier -> 409
        mvc.perform(as(OWNER, put("/api/documents/" + docId)).content("""
                {"direction":"INTERNAL","docTypeId":1,"summary":"chuyển hồ sơ","urgencyId":2,"confidentialityId":3,"dossierId":%d}"""
                .formatted(secondOpenDossier)))
                .andExpect(status().isConflict());

        // Create unattached draft, try attaching to closed/otherDept -> 409/403, then attach to secondOpenDossier -> 200
        String freeJson = mvc.perform(as(OWNER, post("/api/documents")).content("""
                {"direction":"INTERNAL","docTypeId":1,"summary":"tự do","urgencyId":2,"confidentialityId":3}"""))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        long freeId = ((Number) JsonPath.read(freeJson, "$.id")).longValue();

        mvc.perform(as(OWNER, put("/api/documents/" + freeId)).content("""
                {"direction":"INTERNAL","docTypeId":1,"summary":"tự do","urgencyId":2,"confidentialityId":3,"dossierId":%d}"""
                .formatted(closedDossier))).andExpect(status().isConflict());
        mvc.perform(as(OWNER, put("/api/documents/" + freeId)).content("""
                {"direction":"INTERNAL","docTypeId":1,"summary":"tự do","urgencyId":2,"confidentialityId":3,"dossierId":%d}"""
                .formatted(otherDeptDossier))).andExpect(status().isForbidden());
        mvc.perform(as(OWNER, put("/api/documents/" + freeId)).content("""
                {"direction":"INTERNAL","docTypeId":1,"summary":"tự do","urgencyId":2,"confidentialityId":3,"dossierId":%d}"""
                .formatted(secondOpenDossier)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.dossierId").value(secondOpenDossier));
    }

    // ── Flyway V5 Migration Backfill Check ─────────────────────────────────────

    @Test
    void flywayV5_backfillsLegacyRowsCleanly() {
        DriverManagerDataSource ds = new DriverManagerDataSource(
                "jdbc:h2:mem:v5_backfill_test;MODE=PostgreSQL;DB_CLOSE_DELAY=-1", "sa", "");
        Flyway toV1 = Flyway.configure().dataSource(ds).locations("classpath:db/migration").target("1").load();
        toV1.migrate();

        JdbcTemplate isolatedJdbc = new JdbcTemplate(ds);
        isolatedJdbc.update("insert into dossiers (name, department_id, created_at) values (?, ?, TIMESTAMP WITH TIME ZONE '2024-05-10 08:00:00Z')",
                "Hồ sơ cũ", 3L);

        Flyway toLatest = Flyway.configure().dataSource(ds).locations("classpath:db/migration").load();
        toLatest.migrate();

        Map<String, Object> row = isolatedJdbc.queryForMap(
                "select code, code_normalized, dossier_year, is_closed from dossiers");
        assertThat(row.get("code")).isEqualTo("LEGACY-1");
        assertThat(row.get("code_normalized")).isEqualTo("legacy-1");
        assertThat(((Number) row.get("dossier_year")).intValue()).isEqualTo(2024);
        assertThat(row.get("is_closed")).isEqualTo(Boolean.FALSE);
    }
}
