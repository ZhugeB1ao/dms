package com.example.documentservice;

import com.example.documentservice.client.CatalogClient;
import com.example.documentservice.entity.*;
import com.example.documentservice.repository.DocumentHistoryRepository;
import com.example.documentservice.repository.DocumentRepository;
import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** Chạy cả stack (resolver danh tính → controller → service → JPA) trên H2 với migration Flyway thật. Header X-* giả lập gateway. */
@SpringBootTest
@AutoConfigureMockMvc
class DocumentApiIntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired DocumentRepository documents;
    @Autowired DocumentHistoryRepository histories;
    @Autowired JdbcTemplate jdbc;
    // category-service được giả: mặc định mọi danh mục đang hoạt động
    @MockitoBean CatalogClient catalog;

    // Người dùng thử: owner và đồng nghiệp cùng đơn vị 1, một người đơn vị 2, một admin đơn vị 9
    static final long OWNER = 10, COLLEAGUE = 11, STRANGER = 20, ADMIN = 1;

    @BeforeEach
    void reset() {
        when(catalog.isActive(any(), anyLong())).thenReturn(true);
        jdbc.update("delete from attachments");
        histories.deleteAll();
        documents.deleteAll();
        jdbc.update("delete from dossiers");
    }

    private static MockHttpServletRequestBuilder as(long id, MockHttpServletRequestBuilder b) {
        long dept = id == STRANGER ? 2 : id == ADMIN ? 9 : 1;
        return b.header("X-User-Id", id).header("X-User-Role", id == ADMIN ? "ADMIN" : "EMPLOYEE")
                .header("X-Department-Id", dept).contentType(MediaType.APPLICATION_JSON);
    }

    private static String body(String direction, String summary) {
        return """
                {"direction":"%s","docTypeId":1,"summary":"%s","urgencyId":2,"confidentialityId":3}""".formatted(direction, summary);
    }

    /** Tạo thẳng qua repository để dựng trạng thái mà API của task này chưa tạo được (chờ công bố, đã công bố). */
    private Document doc(long owner, long dept, DocumentStatus status) {
        return documents.save(Document.builder().direction(DocumentDirection.INTERNAL).docTypeId(1L).summary("s")
                .urgencyId(2L).confidentialityId(3L).departmentId(dept).ownerId(owner).status(status).build());
    }

    private long create(long caller, String json) throws Exception {
        String res = mvc.perform(as(caller, post("/api/documents")).content(json)).andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return ((Number) JsonPath.read(res, "$.id")).longValue();
    }

    // ── OpenAPI & danh tính ────────────────────────────────────────────────────

    @Test
    void openApi_documentsEveryOperation_andHidesCaller() throws Exception {
        mvc.perform(get("/v3/api-docs"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.paths['/api/documents'].get").exists())
                .andExpect(jsonPath("$.paths['/api/documents'].post").exists())
                .andExpect(jsonPath("$.paths['/api/documents/{id}'].get").exists())
                .andExpect(jsonPath("$.paths['/api/documents/{id}'].put").exists())
                .andExpect(jsonPath("$.paths['/api/documents/{id}'].delete").exists())
                .andExpect(jsonPath("$.paths['/api/documents/{id}/history'].get").exists())
                .andExpect(jsonPath("$.paths['/api/documents'].get.parameters[?(@.name=='caller')]").isEmpty());
    }

    @Test
    void missingOrMalformedIdentity_401() throws Exception {
        mvc.perform(get("/api/documents")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/documents").header("X-User-Id", "abc").header("X-User-Role", "ADMIN").header("X-Department-Id", 1))
                .andExpect(status().isUnauthorized());
        mvc.perform(get("/api/documents").header("X-User-Id", 1).header("X-User-Role", "ADMIN"))
                .andExpect(status().isUnauthorized());
    }

    // ── Tạo ────────────────────────────────────────────────────────────────────

    @Test
    void create_returns201Draft_ownerAndDepartmentFromCaller_andWritesHistory() throws Exception {
        String res = mvc.perform(as(OWNER, post("/api/documents")).content(body("OUTGOING", "Thông báo nghỉ lễ")))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("DRAFT"))
                .andExpect(jsonPath("$.direction").value("OUTGOING"))
                .andExpect(jsonPath("$.ownerId").value(OWNER))
                .andExpect(jsonPath("$.departmentId").value(1))
                .andExpect(jsonPath("$.revoked").value(false))
                .andExpect(jsonPath("$.docNumber").doesNotExist())
                .andReturn().getResponse().getContentAsString();

        long id = ((Number) JsonPath.read(res, "$.id")).longValue();
        List<DocumentHistory> h = histories.findByDocumentIdOrderByIdAsc(id);
        assertThat(h).hasSize(1);
        assertThat(h.get(0).getAction()).isEqualTo(HistoryAction.CREATE);
        assertThat(h.get(0).getFromStatus()).isNull();
        assertThat(h.get(0).getToStatus()).isEqualTo(DocumentStatus.DRAFT);
        assertThat(h.get(0).getActorId()).isEqualTo(OWNER);
    }

    @Test
    void create_ignoresClientSuppliedOwnerStatusAndNumber() throws Exception {
        mvc.perform(as(OWNER, post("/api/documents")).content("""
                {"direction":"INTERNAL","docTypeId":1,"summary":"x","urgencyId":2,"confidentialityId":3,
                 "ownerId":99,"departmentId":99,"status":"PUBLISHED","docNumber":"1/QD"}"""))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.ownerId").value(OWNER))
                .andExpect(jsonPath("$.departmentId").value(1))
                .andExpect(jsonPath("$.status").value("DRAFT"))
                .andExpect(jsonPath("$.docNumber").doesNotExist());
    }

    @Test
    void create_inactiveOrUnknownCategory_400_andNothingSaved() throws Exception {
        for (var type : CatalogClient.Type.values()) {
            when(catalog.isActive(any(), anyLong())).thenReturn(true);
            when(catalog.isActive(type, type == CatalogClient.Type.DOC_TYPE ? 1L : type == CatalogClient.Type.URGENCY ? 2L : 3L)).thenReturn(false);
            mvc.perform(as(OWNER, post("/api/documents")).content(body("INTERNAL", "x")))
                    .andExpect(status().isBadRequest());
        }
        assertThat(documents.count()).isZero();
        assertThat(histories.count()).isZero();
    }

    @Test
    void create_categoryServiceDown_503_notMistakenForInvalidCategory() throws Exception {
        when(catalog.isActive(any(), anyLong())).thenThrow(new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Category service unavailable"));

        mvc.perform(as(OWNER, post("/api/documents")).content(body("INTERNAL", "x"))).andExpect(status().isServiceUnavailable());
        assertThat(documents.count()).isZero();
    }

    @Test
    void create_incomingColumns_onlyForIncoming() throws Exception {
        mvc.perform(as(OWNER, post("/api/documents")).content("""
                {"direction":"INCOMING","docTypeId":1,"summary":"CV đến","urgencyId":2,"confidentialityId":3,
                 "incomingNumber":"123","receivedDate":"2026-11-10","sender":"Sở GD&ĐT"}"""))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.incomingNumber").value("123"))
                .andExpect(jsonPath("$.receivedDate").value("2026-11-10"))
                .andExpect(jsonPath("$.sender").value("Sở GD&ĐT"));

        mvc.perform(as(OWNER, post("/api/documents")).content("""
                {"direction":"OUTGOING","docTypeId":1,"summary":"x","urgencyId":2,"confidentialityId":3,"sender":"Sở GD&ĐT"}"""))
                .andExpect(status().isBadRequest());
        assertThat(documents.count()).isEqualTo(1);
    }

    @Test
    void create_invalidBody_400() throws Exception {
        for (String json : new String[]{
                "{}",
                body("INTERNAL", ""),
                body("SIDEWAYS", "x"),
                """
                {"direction":"INTERNAL","docTypeId":1,"summary":"x","confidentialityId":3}"""}) {
            mvc.perform(as(OWNER, post("/api/documents")).content(json)).andExpect(status().isBadRequest());
        }
    }

    @Test
    void create_dossier_mustExist() throws Exception {
        mvc.perform(as(OWNER, post("/api/documents")).content("""
                {"direction":"INTERNAL","docTypeId":1,"summary":"x","urgencyId":2,"confidentialityId":3,"dossierId":9999}"""))
                .andExpect(status().isBadRequest());
        assertThat(documents.count()).isZero();
        assertThat(histories.count()).isZero();

        jdbc.update("insert into dossiers (code, code_normalized, name, dossier_year, department_id) values ('HS-01', 'hs-01', 'Hồ sơ A', 2026, 1)");
        long dossierId = jdbc.queryForObject("select max(id) from dossiers", Long.class);
        mvc.perform(as(OWNER, post("/api/documents")).content("""
                {"direction":"INTERNAL","docTypeId":1,"summary":"x","urgencyId":2,"confidentialityId":3,"dossierId":%d}""".formatted(dossierId)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.dossierId").value(dossierId));
    }

    // ── Sửa ────────────────────────────────────────────────────────────────────

    @Test
    void update_byOwner_replacesFields_andWritesHistory() throws Exception {
        long id = create(OWNER, """
                {"direction":"INCOMING","docTypeId":1,"summary":"cũ","urgencyId":2,"confidentialityId":3,"sender":"Sở"}""");

        mvc.perform(as(OWNER, put("/api/documents/" + id)).content("""
                {"direction":"INTERNAL","docTypeId":4,"summary":"mới","urgencyId":5,"confidentialityId":6}"""))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.direction").value("INTERNAL"))
                .andExpect(jsonPath("$.docTypeId").value(4))
                .andExpect(jsonPath("$.summary").value("mới"))
                .andExpect(jsonPath("$.urgencyId").value(5))
                .andExpect(jsonPath("$.confidentialityId").value(6))
                .andExpect(jsonPath("$.sender").doesNotExist())
                .andExpect(jsonPath("$.status").value("DRAFT"));

        List<DocumentHistory> h = histories.findByDocumentIdOrderByIdAsc(id);
        assertThat(h).extracting(DocumentHistory::getAction).containsExactly(HistoryAction.CREATE, HistoryAction.UPDATE);
        assertThat(h.get(1).getFromStatus()).isEqualTo(DocumentStatus.DRAFT);
        assertThat(h.get(1).getToStatus()).isEqualTo(DocumentStatus.DRAFT);
        assertThat(h.get(1).getActorId()).isEqualTo(OWNER);
    }

    @Test
    void update_inactiveCategory_400_andDocumentUnchanged() throws Exception {
        long id = create(OWNER, body("INTERNAL", "gốc"));
        when(catalog.isActive(CatalogClient.Type.URGENCY, 2L)).thenReturn(false);

        mvc.perform(as(OWNER, put("/api/documents/" + id)).content(body("INTERNAL", "đổi"))).andExpect(status().isBadRequest());

        assertThat(documents.findById(id).orElseThrow().getSummary()).isEqualTo("gốc");
        assertThat(histories.findByDocumentIdOrderByIdAsc(id)).hasSize(1);
    }

    @Test
    void update_notOwner_neverChangesTheDocument() throws Exception {
        long draft = create(OWNER, body("INTERNAL", "gốc"));
        Document published = doc(OWNER, 1, DocumentStatus.PUBLISHED);

        // Bản thảo của người khác không xem được → 404; văn bản đã công bố xem được nhưng không phải owner → 403
        mvc.perform(as(COLLEAGUE, put("/api/documents/" + draft)).content(body("INTERNAL", "đổi"))).andExpect(status().isNotFound());
        mvc.perform(as(ADMIN, put("/api/documents/" + draft)).content(body("INTERNAL", "đổi"))).andExpect(status().isNotFound());
        mvc.perform(as(COLLEAGUE, put("/api/documents/" + published.getId())).content(body("INTERNAL", "đổi"))).andExpect(status().isForbidden());

        assertThat(documents.findById(draft).orElseThrow().getSummary()).isEqualTo("gốc");
        assertThat(documents.findById(published.getId()).orElseThrow().getSummary()).isEqualTo("s");
    }

    @Test
    void update_afterPendingOrPublished_409_evenForOwner() throws Exception {
        for (DocumentStatus status : new DocumentStatus[]{DocumentStatus.PENDING_PUBLICATION, DocumentStatus.PUBLISHED}) {
            Document d = doc(OWNER, 1, status);
            mvc.perform(as(OWNER, put("/api/documents/" + d.getId())).content(body("INTERNAL", "đổi"))).andExpect(status().isConflict());
            assertThat(documents.findById(d.getId()).orElseThrow().getSummary()).isEqualTo("s");
            assertThat(histories.findByDocumentIdOrderByIdAsc(d.getId())).isEmpty();
        }
    }

    @Test
    void update_unknownOrDeleted_404() throws Exception {
        mvc.perform(as(OWNER, put("/api/documents/99999")).content(body("INTERNAL", "x"))).andExpect(status().isNotFound());

        long id = create(OWNER, body("INTERNAL", "x"));
        mvc.perform(as(OWNER, delete("/api/documents/" + id))).andExpect(status().isNoContent());
        mvc.perform(as(OWNER, put("/api/documents/" + id)).content(body("INTERNAL", "y"))).andExpect(status().isNotFound());
    }

    // ── Xóa mềm ────────────────────────────────────────────────────────────────

    @Test
    void delete_isSoft_hidesDocument_andWritesHistory() throws Exception {
        long id = create(OWNER, body("INTERNAL", "x"));

        mvc.perform(as(OWNER, delete("/api/documents/" + id))).andExpect(status().isNoContent());

        Document row = documents.findById(id).orElseThrow(); // dòng vẫn còn trong DB
        assertThat(row.getDeletedAt()).isNotNull();
        mvc.perform(as(OWNER, get("/api/documents/" + id))).andExpect(status().isNotFound());
        mvc.perform(as(OWNER, get("/api/documents/" + id + "/history"))).andExpect(status().isNotFound());
        mvc.perform(as(OWNER, get("/api/documents"))).andExpect(jsonPath("$.totalElements").value(0));
        List<DocumentHistory> h = histories.findByDocumentIdOrderByIdAsc(id);
        assertThat(h).extracting(DocumentHistory::getAction).containsExactly(HistoryAction.CREATE, HistoryAction.DELETE);
        assertThat(h.get(1).getActorId()).isEqualTo(OWNER);
        mvc.perform(as(OWNER, delete("/api/documents/" + id))).andExpect(status().isNotFound()); // xóa lần hai
    }

    @Test
    void delete_notOwner_orNotDraft_isRefused_andNothingDeleted() throws Exception {
        long draft = create(OWNER, body("INTERNAL", "x"));
        Document pending = doc(OWNER, 1, DocumentStatus.PENDING_PUBLICATION);

        mvc.perform(as(COLLEAGUE, delete("/api/documents/" + draft))).andExpect(status().isNotFound());
        mvc.perform(as(ADMIN, delete("/api/documents/" + draft))).andExpect(status().isNotFound());
        mvc.perform(as(COLLEAGUE, delete("/api/documents/" + pending.getId()))).andExpect(status().isForbidden());
        mvc.perform(as(OWNER, delete("/api/documents/" + pending.getId()))).andExpect(status().isConflict());

        assertThat(documents.findAll()).allSatisfy(d -> assertThat(d.getDeletedAt()).isNull());
    }

    // ── Xem: chi tiết, danh sách, lịch sử ──────────────────────────────────────

    @Test
    void visibility_draftOnlyOwner_sentToDepartmentApproverAndAdmin() throws Exception {
        Document draft = doc(OWNER, 1, DocumentStatus.DRAFT);
        Document pending = doc(OWNER, 1, DocumentStatus.PENDING_PUBLICATION);
        Document approverOnly = doc(OWNER, 1, DocumentStatus.PENDING_PUBLICATION);
        approverOnly.setCurrentApproverId(STRANGER);
        documents.save(approverOnly);

        // [người gọi] → các văn bản thấy được
        assertThat(visibleIds(OWNER)).containsExactlyInAnyOrder(draft.getId(), pending.getId(), approverOnly.getId());
        assertThat(visibleIds(COLLEAGUE)).containsExactlyInAnyOrder(pending.getId(), approverOnly.getId()); // cùng đơn vị, không thấy bản thảo
        assertThat(visibleIds(STRANGER)).containsExactly(approverOnly.getId());                              // khác đơn vị, chỉ thấy cái mình là approver
        assertThat(visibleIds(ADMIN)).containsExactlyInAnyOrder(pending.getId(), approverOnly.getId());      // admin cũng không thấy bản thảo người khác

        mvc.perform(as(STRANGER, get("/api/documents/" + pending.getId()))).andExpect(status().isNotFound());
        mvc.perform(as(COLLEAGUE, get("/api/documents/" + draft.getId()))).andExpect(status().isNotFound());
        mvc.perform(as(COLLEAGUE, get("/api/documents/" + pending.getId()))).andExpect(status().isOk());
    }

    private List<Long> visibleIds(long caller) throws Exception {
        String res = mvc.perform(as(caller, get("/api/documents")).param("size", "100")).andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return JsonPath.<List<Number>>read(res, "$.content[*].id").stream().map(Number::longValue).toList();
    }

    @Test
    void list_paginates_newestFirst() throws Exception {
        for (int i = 0; i < 5; i++) doc(OWNER, 1, DocumentStatus.PUBLISHED);

        mvc.perform(as(OWNER, get("/api/documents")).param("size", "2").param("page", "1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(2))
                .andExpect(jsonPath("$.page").value(1))
                .andExpect(jsonPath("$.size").value(2))
                .andExpect(jsonPath("$.totalElements").value(5))
                .andExpect(jsonPath("$.totalPages").value(3));
        List<Long> ids = visibleIds(OWNER);
        assertThat(ids).isSortedAccordingTo(java.util.Comparator.reverseOrder());
    }

    @Test
    void list_filtersByDirectionStatusDocTypeAndDepartment() throws Exception {
        documents.save(Document.builder().direction(DocumentDirection.INCOMING).docTypeId(7L).summary("a").urgencyId(2L)
                .confidentialityId(3L).departmentId(1L).ownerId(OWNER).status(DocumentStatus.PUBLISHED).build());
        doc(OWNER, 1, DocumentStatus.PENDING_PUBLICATION);
        doc(STRANGER, 2, DocumentStatus.PUBLISHED);
        doc(OWNER, 1, DocumentStatus.DRAFT);

        mvc.perform(as(ADMIN, get("/api/documents")).param("direction", "INCOMING")).andExpect(jsonPath("$.totalElements").value(1));
        mvc.perform(as(ADMIN, get("/api/documents")).param("status", "PUBLISHED")).andExpect(jsonPath("$.totalElements").value(2));
        mvc.perform(as(ADMIN, get("/api/documents")).param("docTypeId", "7")).andExpect(jsonPath("$.totalElements").value(1));
        mvc.perform(as(ADMIN, get("/api/documents")).param("departmentId", "2")).andExpect(jsonPath("$.totalElements").value(1));
        mvc.perform(as(OWNER, get("/api/documents")).param("status", "DRAFT")).andExpect(jsonPath("$.totalElements").value(1));
        mvc.perform(as(COLLEAGUE, get("/api/documents")).param("status", "DRAFT")).andExpect(jsonPath("$.totalElements").value(0));
        mvc.perform(as(ADMIN, get("/api/documents")).param("departmentId", "1").param("status", "PUBLISHED").param("direction", "INTERNAL"))
                .andExpect(jsonPath("$.totalElements").value(0));
    }

    @Test
    void list_rejectsBadParams_400() throws Exception {
        mvc.perform(as(OWNER, get("/api/documents")).param("size", "101")).andExpect(status().isBadRequest());
        mvc.perform(as(OWNER, get("/api/documents")).param("page", "-1")).andExpect(status().isBadRequest());
        mvc.perform(as(OWNER, get("/api/documents")).param("status", "NOPE")).andExpect(status().isBadRequest());
    }

    @Test
    void history_listsEveryChangeOldestFirst_forWhoeverCanView() throws Exception {
        long id = create(OWNER, body("INTERNAL", "x"));
        mvc.perform(as(OWNER, put("/api/documents/" + id)).content(body("INTERNAL", "y"))).andExpect(status().isOk());

        mvc.perform(as(OWNER, get("/api/documents/" + id + "/history")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].action").value("CREATE"))
                .andExpect(jsonPath("$[0].fromStatus").doesNotExist())
                .andExpect(jsonPath("$[0].toStatus").value("DRAFT"))
                .andExpect(jsonPath("$[0].actorId").value(OWNER))
                .andExpect(jsonPath("$[0].createdAt").exists())
                .andExpect(jsonPath("$[1].action").value("UPDATE"))
                .andExpect(jsonPath("$[1].fromStatus").value("DRAFT"));

        // Bản thảo của người khác: không lộ lịch sử
        mvc.perform(as(COLLEAGUE, get("/api/documents/" + id + "/history"))).andExpect(status().isNotFound());
        mvc.perform(as(OWNER, get("/api/documents/99999/history"))).andExpect(status().isNotFound());
    }
}
