package com.example.organization_service.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record OrganizationRequest(
        @NotBlank(message = "Tên cơ quan ngoài (name) không được để trống")
        @Size(max = 255, message = "Tên cơ quan ngoài tối đa 255 ký tự")
        String name,

        @Size(max = 500, message = "Địa chỉ tối đa 500 ký tự")
        String address,

        @Email(message = "Email không đúng định dạng")
        @Size(max = 255, message = "Email tối đa 255 ký tự")
        String email
) {}
