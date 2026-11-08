package com.example.organization_service.dto;

import com.example.organization_service.entity.Organization;

public record OrganizationResponse(Long id, String name, String address, String email, boolean isActive) {
    public static OrganizationResponse fromEntity(Organization org) {
        return new OrganizationResponse(
                org.getId(),
                org.getName(),
                org.getAddress(),
                org.getEmail(),
                org.isActive()
        );
    }
}
