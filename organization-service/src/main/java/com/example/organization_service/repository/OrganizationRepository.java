package com.example.organization_service.repository;

import com.example.organization_service.entity.Organization;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface OrganizationRepository extends JpaRepository<Organization, Long> {
    List<Organization> findAllByOrderByIdAsc();
    List<Organization> findAllByIsActiveTrueOrderByIdAsc();
    boolean existsByNameIgnoreCase(String name);
    boolean existsByNameIgnoreCaseAndIdNot(String name, Long id);
}
