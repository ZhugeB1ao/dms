package com.example.department_service.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record DepartmentRequest(
        @NotBlank(message = "Mã đơn vị (code) không được để trống")
        @Size(max = 50, message = "Mã đơn vị tối đa 50 ký tự")
        String code,

        @NotBlank(message = "Tên đơn vị (name) không được để trống")
        @Size(max = 255, message = "Tên đơn vị tối đa 255 ký tự")
        String name,

        Long parentId
) {}
