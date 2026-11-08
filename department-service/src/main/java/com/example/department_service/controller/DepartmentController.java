package com.example.department_service.controller;

import com.example.department_service.dto.DepartmentRequest;
import com.example.department_service.dto.DepartmentResponse;
import com.example.department_service.dto.DepartmentTreeResponse;
import com.example.department_service.service.DepartmentService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/departments")
public class DepartmentController {

    private final DepartmentService departmentService;

    public DepartmentController(DepartmentService departmentService) {
        this.departmentService = departmentService;
    }

    @GetMapping("/tree")
    public List<DepartmentTreeResponse> getDepartmentTree() {
        return departmentService.getDepartmentTree();
    }

    @GetMapping("/active")
    public List<DepartmentResponse> getActiveDepartments() {
        return departmentService.getActiveDepartments();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public DepartmentResponse createDepartment(@Valid @RequestBody DepartmentRequest request) {
        return departmentService.createDepartment(request);
    }

    @PutMapping("/{id}")
    public DepartmentResponse updateDepartment(
            @PathVariable Long id,
            @Valid @RequestBody DepartmentRequest request
    ) {
        return departmentService.updateDepartment(id, request);
    }

    @PatchMapping("/{id}/deactivate")
    public DepartmentResponse deactivateDepartment(@PathVariable Long id) {
        return departmentService.deactivateDepartment(id);
    }
}
