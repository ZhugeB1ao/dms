package com.example.documentservice.dto;

import com.example.documentservice.entity.DocumentDirection;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;

/**
 * Dùng cho cả tạo và sửa bản thảo. Đơn vị và owner lấy từ danh tính người gọi, số hiệu và ngày ban hành cấp lúc công bố
 * nên không nhận từ client. Ba cột cuối chỉ dành cho công văn đến (INCOMING), các loại khác phải để trống.
 */
public record DocumentRequest(
        @NotNull DocumentDirection direction,
        @NotNull Long docTypeId,
        @NotBlank @Size(max = 2000) String summary,
        @NotNull Long urgencyId,
        @NotNull Long confidentialityId,
        Long dossierId,
        @Size(max = 100) String incomingNumber,
        LocalDate receivedDate,
        @Size(max = 255) String sender
) {}
