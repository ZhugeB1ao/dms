package com.example.organization_service.controller;

import com.example.organization_service.dto.OrganizationRequest;
import com.example.organization_service.dto.OrganizationResponse;
import com.example.organization_service.service.OrganizationService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/organizations")
public class OrganizationController {

    private final OrganizationService organizationService;

    public OrganizationController(OrganizationService organizationService) {
        this.organizationService = organizationService;
    }

    @GetMapping
    public ResponseEntity<List<OrganizationResponse>> getOrganizations(
            @RequestParam(required = false) Boolean activeOnly
    ) {
        return ResponseEntity.ok(organizationService.getOrganizations(activeOnly));
    }

    @GetMapping("/active")
    public ResponseEntity<List<OrganizationResponse>> getActiveOrganizations() {
        return ResponseEntity.ok(organizationService.getOrganizations(true));
    }

    @PostMapping
    public ResponseEntity<OrganizationResponse> createOrganization(
            @Valid @RequestBody OrganizationRequest request
    ) {
        OrganizationResponse created = organizationService.createOrganization(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    @PutMapping("/{id}")
    public ResponseEntity<OrganizationResponse> updateOrganization(
            @PathVariable Long id,
            @Valid @RequestBody OrganizationRequest request
    ) {
        return ResponseEntity.ok(organizationService.updateOrganization(id, request));
    }

    @PatchMapping("/{id}/deactivate")
    public ResponseEntity<OrganizationResponse> deactivateOrganization(
            @PathVariable Long id
    ) {
        return ResponseEntity.ok(organizationService.deactivateOrganization(id));
    }
}
