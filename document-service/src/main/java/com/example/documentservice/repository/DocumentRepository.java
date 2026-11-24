package com.example.documentservice.repository;

import com.example.documentservice.entity.Document;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;

public interface DocumentRepository extends JpaRepository<Document, Long>, JpaSpecificationExecutor<Document> {
    long countByDossierIdAndDeletedAtIsNull(Long dossierId);

    @Query("select d.dossierId, count(d) from Document d where d.deletedAt is null and d.dossierId in :ids group by d.dossierId")
    List<Object[]> countActiveByDossierIds(@Param("ids") Collection<Long> ids);
}
