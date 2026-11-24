package com.example.documentservice.repository;

import com.example.documentservice.entity.Dossier;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import java.util.Optional;

public interface DossierRepository extends JpaRepository<Dossier, Long>, JpaSpecificationExecutor<Dossier> {
    Optional<Dossier> findByIdAndDepartmentId(Long id, Long departmentId);

    boolean existsByDepartmentIdAndYearAndCodeNormalized(Long departmentId, int year, String codeNormalized);

    boolean existsByDepartmentIdAndYearAndCodeNormalizedAndIdNot(
            Long departmentId, int year, String codeNormalized, Long id);
}
