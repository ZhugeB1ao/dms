package com.example.organization_service.service;

import com.example.organization_service.dto.OrganizationRequest;
import com.example.organization_service.dto.OrganizationResponse;
import com.example.organization_service.entity.Organization;
import com.example.organization_service.exception.DuplicateResourceException;
import com.example.organization_service.exception.ResourceNotFoundException;
import com.example.organization_service.repository.OrganizationRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@Transactional
public class OrganizationService {

    private final OrganizationRepository organizationRepository;

    public OrganizationService(OrganizationRepository organizationRepository) {
        this.organizationRepository = organizationRepository;
    }

    @Transactional(readOnly = true)
    public List<OrganizationResponse> getOrganizations(Boolean activeOnly) {
        List<Organization> orgs;
        if (Boolean.TRUE.equals(activeOnly)) {
            orgs = organizationRepository.findAllByIsActiveTrueOrderByIdAsc();
        } else {
            orgs = organizationRepository.findAllByOrderByIdAsc();
        }
        return orgs.stream()
                .map(OrganizationResponse::fromEntity)
                .toList();
    }

    public OrganizationResponse createOrganization(OrganizationRequest req) {
        String trimmedName = req.name() != null ? req.name().trim() : "";
        if (organizationRepository.existsByNameIgnoreCase(trimmedName)) {
            throw new DuplicateResourceException("name", "Tên cơ quan ngoài '" + trimmedName + "' đã tồn tại");
        }

        String address = req.address() != null && !req.address().isBlank() ? req.address().trim() : null;
        String email = req.email() != null && !req.email().isBlank() ? req.email().trim() : null;

        Organization org = new Organization(trimmedName, address, email);
        org = organizationRepository.save(org);
        return OrganizationResponse.fromEntity(org);
    }

    public OrganizationResponse updateOrganization(Long id, OrganizationRequest req) {
        Organization org = organizationRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy cơ quan ngoài với ID = " + id));

        String trimmedName = req.name() != null ? req.name().trim() : "";
        if (organizationRepository.existsByNameIgnoreCaseAndIdNot(trimmedName, id)) {
            throw new DuplicateResourceException("name", "Tên cơ quan ngoài '" + trimmedName + "' đã tồn tại");
        }

        String address = req.address() != null && !req.address().isBlank() ? req.address().trim() : null;
        String email = req.email() != null && !req.email().isBlank() ? req.email().trim() : null;

        org.setName(trimmedName);
        org.setAddress(address);
        org.setEmail(email);

        org = organizationRepository.save(org);
        return OrganizationResponse.fromEntity(org);
    }

    public OrganizationResponse deactivateOrganization(Long id) {
        Organization org = organizationRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy cơ quan ngoài với ID = " + id));

        org.setActive(false);
        org = organizationRepository.save(org);
        return OrganizationResponse.fromEntity(org);
    }
}
