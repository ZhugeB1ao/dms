package com.example.department_service.dto;

import com.example.department_service.entity.Department;

public record DepartmentResponse(
        Long id,
        String code,
        String name,
        Long parentId,
        boolean isActive
) {
    public static DepartmentResponse fromEntity(Department d) {
        return new DepartmentResponse(
                d.getId(),
                d.getCode(),
                d.getName(),
                d.getParentId(),
                d.isActive()
        );
    }
}
