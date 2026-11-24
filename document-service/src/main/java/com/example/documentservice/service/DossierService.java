package com.example.documentservice.service;

import com.example.documentservice.config.Caller;
import com.example.documentservice.config.FieldConflictException;
import com.example.documentservice.dto.DocumentResponse;
import com.example.documentservice.dto.DossierRequest;
import com.example.documentservice.dto.DossierResponse;
import com.example.documentservice.dto.PageResponse;
import com.example.documentservice.entity.Document;
import com.example.documentservice.entity.Dossier;
import com.example.documentservice.repository.DocumentRepository;
import com.example.documentservice.repository.DossierRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class DossierService {
    private static final Sort DOSSIER_SORT = Sort.by(Sort.Order.desc("year"), Sort.Order.desc("id"));
    private static final Sort DOC_SORT = Sort.by(Sort.Direction.DESC, "id");

    private final DossierRepository dossiers;
    private final DocumentRepository documents;
    private final DocumentService documentService;

    @Transactional(readOnly = true)
    public PageResponse<DossierResponse> list(Caller caller, Integer year, Boolean closed, int page, int size) {
        requireStaff(caller);
        Specification<Dossier> spec = equal("departmentId", caller.departmentId())
                .and(equal("year", year))
                .and(equal("closed", closed));
        Page<Dossier> result = dossiers.findAll(spec, PageRequest.of(page, size, DOSSIER_SORT));
        List<Long> ids = result.getContent().stream().map(Dossier::getId).toList();
        Map<Long, Long> counts = batchCounts(ids);
        return PageResponse.of(result.map(d -> DossierResponse.from(d, counts.getOrDefault(d.getId(), 0L))));
    }

    @Transactional(readOnly = true)
    public DossierResponse get(Caller caller, long id) {
        requireStaff(caller);
        Dossier dossier = findOwned(caller, id);
        return DossierResponse.from(dossier, documents.countByDossierIdAndDeletedAtIsNull(id));
    }

    @Transactional
    public DossierResponse create(Caller caller, DossierRequest req) {
        requireStaff(caller);
        String code = req.code().trim();
        String normalized = code.toLowerCase(Locale.ROOT);
        String name = req.name().trim();
        if (dossiers.existsByDepartmentIdAndYearAndCodeNormalized(caller.departmentId(), req.year(), normalized)) {
            throw duplicateCode();
        }
        Dossier dossier = saveHandlingConflict(Dossier.builder()
                .code(code)
                .codeNormalized(normalized)
                .name(name)
                .year(req.year())
                .departmentId(caller.departmentId())
                .build());
        return DossierResponse.from(dossier, 0L);
    }

    @Transactional
    public DossierResponse update(Caller caller, long id, DossierRequest req) {
        requireStaff(caller);
        Dossier dossier = findOwned(caller, id);
        if (dossier.isClosed()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Closed dossier cannot be modified.");
        }
        String code = req.code().trim();
        String normalized = code.toLowerCase(Locale.ROOT);
        String name = req.name().trim();
        if (dossiers.existsByDepartmentIdAndYearAndCodeNormalizedAndIdNot(
                caller.departmentId(), req.year(), normalized, id)) {
            throw duplicateCode();
        }
        dossier.setCode(code);
        dossier.setCodeNormalized(normalized);
        dossier.setName(name);
        dossier.setYear(req.year());
        dossier = saveHandlingConflict(dossier);
        return DossierResponse.from(dossier, documents.countByDossierIdAndDeletedAtIsNull(id));
    }

    @Transactional
    public DossierResponse close(Caller caller, long id) {
        requireStaff(caller);
        Dossier dossier = findOwned(caller, id);
        if (dossier.isClosed()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Dossier is already closed.");
        }
        dossier.setClosed(true);
        dossier = dossiers.saveAndFlush(dossier);
        return DossierResponse.from(dossier, documents.countByDossierIdAndDeletedAtIsNull(id));
    }

    @Transactional(readOnly = true)
    public List<DocumentResponse> listDocuments(Caller caller, long id) {
        requireStaff(caller);
        findOwned(caller, id);
        Specification<Document> spec = DocumentService.visibleToSpec(caller)
                .and((root, query, cb) -> cb.equal(root.get("dossierId"), id));
        return documents.findAll(spec, DOC_SORT).stream().map(DocumentResponse::from).toList();
    }

    @Transactional(readOnly = true)
    public List<DocumentResponse> listAvailableDocuments(Caller caller, long id) {
        requireStaff(caller);
        Dossier dossier = findOwned(caller, id);
        Specification<Document> spec = DocumentService.visibleToSpec(caller)
                .and((root, query, cb) -> cb.and(
                        cb.isNull(root.get("dossierId")),
                        cb.equal(root.get("departmentId"), dossier.getDepartmentId())));
        return documents.findAll(spec, DOC_SORT).stream().map(DocumentResponse::from).toList();
    }

    @Transactional
    public DocumentResponse attachDocument(Caller caller, long id, long documentId) {
        requireStaff(caller);
        Dossier dossier = findOwned(caller, id);
        if (dossier.isClosed()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Cannot attach documents to a closed dossier.");
        }
        Document doc = documentService.requireVisible(caller, documentId);
        if (!doc.getDepartmentId().equals(dossier.getDepartmentId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "Cannot attach a document from another department.");
        }
        if (doc.getDossierId() != null) {
            if (doc.getDossierId().equals(id)) {
                return DocumentResponse.from(doc);
            }
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Document is already attached to another dossier.");
        }
        doc.setDossierId(id);
        return DocumentResponse.from(documents.saveAndFlush(doc));
    }

    @Transactional
    public void detachDocument(Caller caller, long id, long documentId) {
        requireStaff(caller);
        Dossier dossier = findOwned(caller, id);
        if (dossier.isClosed()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Cannot detach documents from a closed dossier.");
        }
        Document doc = documentService.requireVisible(caller, documentId);
        if (!Long.valueOf(id).equals(doc.getDossierId())) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Document is not attached to this dossier.");
        }
        doc.setDossierId(null);
        documents.saveAndFlush(doc);
    }

    private static void requireStaff(Caller caller) {
        if (caller.isAdmin() || (!"MANAGER".equals(caller.role()) && !"EMPLOYEE".equals(caller.role()))) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only department staff can access dossiers.");
        }
    }

    private Dossier findOwned(Caller caller, long id) {
        return dossiers.findByIdAndDepartmentId(id, caller.departmentId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Dossier not found"));
    }

    private Dossier saveHandlingConflict(Dossier dossier) {
        try {
            return dossiers.saveAndFlush(dossier);
        } catch (DataIntegrityViolationException e) {
            throw duplicateCode();
        }
    }

    private Map<Long, Long> batchCounts(List<Long> ids) {
        if (ids.isEmpty()) {
            return Map.of();
        }
        Map<Long, Long> counts = new HashMap<>();
        for (Object[] row : documents.countActiveByDossierIds(ids)) {
            counts.put(((Number) row[0]).longValue(), ((Number) row[1]).longValue());
        }
        return counts;
    }

    private static Specification<Dossier> equal(String field, Object value) {
        return (root, query, cb) -> value == null ? cb.conjunction() : cb.equal(root.get(field), value);
    }

    private static FieldConflictException duplicateCode() {
        return new FieldConflictException(
                "Record code already exists for this department and year.",
                Map.of("code", "This code already exists for this department and year."));
    }
}
