package com.example.documentservice.service;

import com.example.documentservice.client.CatalogClient;
import com.example.documentservice.config.Caller;
import com.example.documentservice.dto.DocumentRequest;
import com.example.documentservice.dto.DocumentResponse;
import com.example.documentservice.dto.HistoryResponse;
import com.example.documentservice.dto.PageResponse;
import com.example.documentservice.entity.*;
import com.example.documentservice.repository.DocumentHistoryRepository;
import com.example.documentservice.repository.DocumentRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.List;

@Service
@RequiredArgsConstructor
public class DocumentService {
    private final DocumentRepository documents;
    private final DocumentHistoryRepository histories;
    private final CatalogClient catalog;
    private final TransactionTemplate tx;

    // Ghi dùng TransactionTemplate chứ không @Transactional cả hàm: gọi category-service (qua mạng) xong mới mở transaction,
    // nên không giữ kết nối DB lúc chờ. Văn bản và dòng history luôn được ghi cùng một transaction.

    @Transactional(readOnly = true)
    public PageResponse<DocumentResponse> list(Caller caller, DocumentDirection direction, DocumentStatus status,
                                               Long docTypeId, Long departmentId, int page, int size) {
        Specification<Document> spec = visibleTo(caller)
                .and(equal("direction", direction)).and(equal("status", status))
                .and(equal("docTypeId", docTypeId)).and(equal("departmentId", departmentId));
        return PageResponse.of(documents.findAll(spec, PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "id")))
                .map(DocumentResponse::from));
    }

    @Transactional(readOnly = true)
    public DocumentResponse get(Caller caller, long id) {
        return DocumentResponse.from(findVisible(caller, id));
    }

    @Transactional(readOnly = true)
    public List<HistoryResponse> history(Caller caller, long id) {
        findVisible(caller, id);
        return histories.findByDocumentIdOrderByIdAsc(id).stream().map(HistoryResponse::from).toList();
    }

    public DocumentResponse create(Caller caller, DocumentRequest req) {
        validate(req);
        return tx.execute(s -> {
            Document d = save(apply(Document.builder().ownerId(caller.id()).departmentId(caller.departmentId()).build(), req));
            record(d, HistoryAction.CREATE, null, caller);
            return DocumentResponse.from(d);
        });
    }

    public DocumentResponse update(Caller caller, long id, DocumentRequest req) {
        validate(req);
        return tx.execute(s -> {
            Document d = save(apply(findEditableDraft(caller, id), req));
            record(d, HistoryAction.UPDATE, DocumentStatus.DRAFT, caller);
            return DocumentResponse.from(d);
        });
    }

    /** Xóa mềm: chỉ đặt deleted_at, dòng và history vẫn còn trong DB. */
    public void delete(Caller caller, long id) {
        tx.executeWithoutResult(s -> {
            Document d = findEditableDraft(caller, id);
            d.setDeletedAt(Instant.now());
            record(save(d), HistoryAction.DELETE, DocumentStatus.DRAFT, caller);
        });
    }

    // ── Quyền xem ──────────────────────────────────────────────────────────────

    /**
     * Quy tắc xem (SRS chưa nêu, đây là mặc định đang áp dụng, đổi ở đúng một chỗ này): bản thảo chỉ owner thấy;
     * văn bản đã gửi duyệt/công bố thì owner, người cùng đơn vị, người đang là approver, và ADMIN đều thấy. Văn bản đã xóa mềm không ai thấy.
     */
    private static Specification<Document> visibleTo(Caller c) {
        return (root, query, cb) -> {
            var mine = cb.equal(root.get("ownerId"), c.id());
            var sent = cb.notEqual(root.get("status"), DocumentStatus.DRAFT);
            var allowed = c.isAdmin() ? sent : cb.and(sent, cb.or(
                    cb.equal(root.get("departmentId"), c.departmentId()),
                    cb.equal(root.get("currentApproverId"), c.id())));
            return cb.and(cb.isNull(root.get("deletedAt")), cb.or(mine, allowed));
        };
    }

    private static Specification<Document> equal(String field, Object value) {
        return (root, query, cb) -> value == null ? cb.conjunction() : cb.equal(root.get(field), value);
    }

    /** Không thấy được thì 404 (không lộ văn bản có tồn tại hay không). */
    private Document findVisible(Caller caller, long id) {
        return documents.findOne(visibleTo(caller).and(equal("id", id)))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Document not found"));
    }

    /** Sửa/xóa: thấy được (404) → là owner (403) → còn là Bản thảo (409). */
    private Document findEditableDraft(Caller caller, long id) {
        Document d = findVisible(caller, id);
        if (d.getOwnerId() != caller.id()) throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only the owner can change this document");
        if (d.getStatus() != DocumentStatus.DRAFT) throw new ResponseStatusException(HttpStatus.CONFLICT, "Only a draft can be changed");
        return d;
    }

    // ── Ghi ────────────────────────────────────────────────────────────────────

    private void validate(DocumentRequest r) {
        if (r.direction() != DocumentDirection.INCOMING && (r.incomingNumber() != null || r.receivedDate() != null || r.sender() != null)) {
            throw badRequest("incomingNumber, receivedDate, sender only apply to INCOMING documents");
        }
        requireActive(CatalogClient.Type.DOC_TYPE, r.docTypeId());
        requireActive(CatalogClient.Type.URGENCY, r.urgencyId());
        requireActive(CatalogClient.Type.CONFIDENTIALITY, r.confidentialityId());
    }

    private void requireActive(CatalogClient.Type type, long id) {
        if (!catalog.isActive(type, id)) throw badRequest(type + " " + id + " does not exist or is inactive");
    }

    private static Document apply(Document d, DocumentRequest r) {
        d.setDirection(r.direction());
        d.setDocTypeId(r.docTypeId());
        d.setSummary(r.summary());
        d.setUrgencyId(r.urgencyId());
        d.setConfidentialityId(r.confidentialityId());
        d.setDossierId(r.dossierId());
        d.setIncomingNumber(r.incomingNumber());
        d.setReceivedDate(r.receivedDate());
        d.setSender(r.sender());
        return d;
    }

    private Document save(Document d) {
        try {
            return documents.saveAndFlush(d);
        } catch (DataIntegrityViolationException e) { // lỗi ràng buộc duy nhất còn lại sau validate là khóa ngoại dossier_id
            throw badRequest("dossierId does not exist");
        }
    }

    /** Ghi một dòng history; to_status là trạng thái sau thao tác (bản thảo vẫn là DRAFT, xóa mềm không đổi trạng thái). */
    private void record(Document d, HistoryAction action, DocumentStatus from, Caller actor) {
        histories.save(DocumentHistory.builder().documentId(d.getId()).action(action)
                .fromStatus(from).toStatus(d.getStatus()).actorId(actor.id()).build());
    }

    private static ResponseStatusException badRequest(String message) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
    }
}
