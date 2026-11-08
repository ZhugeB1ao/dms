package com.example.department_service.dto;

import java.util.List;

public record DepartmentTreeResponse(
        Long id,
        String code,
        String name,
        Long parentId,
        boolean isActive,
        List<DepartmentTreeResponse> children
) {}
