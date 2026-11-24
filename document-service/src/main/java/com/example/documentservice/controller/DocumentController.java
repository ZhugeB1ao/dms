package com.example.documentservice.controller;

import com.example.documentservice.config.Caller;
import com.example.documentservice.dto.DocumentRequest;
import com.example.documentservice.dto.DocumentResponse;
import com.example.documentservice.dto.HistoryResponse;
import com.example.documentservice.dto.PageResponse;
import com.example.documentservice.entity.DocumentDirection;
import com.example.documentservice.entity.DocumentStatus;
import com.example.documentservice.service.DocumentService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Tag(name = "Documents", description = "Văn bản đến, đi, nội bộ. Mọi API cần đăng nhập (401). Văn bản không thuộc quyền xem của người gọi trả 404.")
@RestController
@RequestMapping("/api/documents")
@RequiredArgsConstructor
public class DocumentController {
    private final DocumentService documents;

    @Operation(summary = "Danh sách văn bản (phân trang, mới nhất trước), lọc theo hướng / trạng thái / loại văn bản / đơn vị; chỉ gồm văn bản người gọi được xem")
    @GetMapping
    public PageResponse<DocumentResponse> list(
            Caller caller,
            @RequestParam(required = false) DocumentDirection direction,
            @RequestParam(required = false) DocumentStatus status,
            @RequestParam(required = false) Long docTypeId,
            @RequestParam(required = false) Long departmentId,
            @RequestParam(defaultValue = "0") @Min(0) int page,
            @RequestParam(defaultValue = "20") @Min(1) @Max(100) int size) {
        return documents.list(caller, direction, status, docTypeId, departmentId, page, size);
    }

    @Operation(summary = "Chi tiết văn bản")
    @ApiResponse(responseCode = "404", description = "Không có văn bản, đã xóa, hoặc người gọi không được xem", content = @Content)
    @GetMapping("/{id}")
    public DocumentResponse get(Caller caller, @PathVariable long id) {
        return documents.get(caller, id);
    }

    @Operation(summary = "Tạo bản thảo (status DRAFT). Owner và đơn vị lấy từ người gọi; loại văn bản, độ khẩn, độ mật phải là danh mục đang hoạt động")
    @ApiResponse(responseCode = "400", description = "Danh mục không tồn tại hoặc ngưng hoạt động, hồ sơ không tồn tại, hoặc cột công văn đến dùng cho văn bản không phải INCOMING", content = @Content)
    @ApiResponse(responseCode = "503", description = "Không gọi được category-service", content = @Content)
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public DocumentResponse create(Caller caller, @Valid @RequestBody DocumentRequest req) {
        return documents.create(caller, req);
    }

    @Operation(summary = "Sửa bản thảo (thay toàn bộ các trường). Chỉ owner, và chỉ khi còn là DRAFT")
    @ApiResponse(responseCode = "400", description = "Như tạo bản thảo", content = @Content)
    @ApiResponse(responseCode = "403", description = "Xem được nhưng không phải owner", content = @Content)
    @ApiResponse(responseCode = "404", description = "Không có văn bản hoặc không được xem", content = @Content)
    @ApiResponse(responseCode = "409", description = "Đã hoàn thành chờ công bố hoặc đã công bố", content = @Content)
    @PutMapping("/{id}")
    public DocumentResponse update(Caller caller, @PathVariable long id, @Valid @RequestBody DocumentRequest req) {
        return documents.update(caller, id, req);
    }

    @Operation(summary = "Xóa mềm bản thảo (đặt deleted_at). Chỉ owner, và chỉ khi còn là DRAFT")
    @ApiResponse(responseCode = "403", description = "Xem được nhưng không phải owner", content = @Content)
    @ApiResponse(responseCode = "404", description = "Không có văn bản hoặc không được xem", content = @Content)
    @ApiResponse(responseCode = "409", description = "Đã hoàn thành chờ công bố hoặc đã công bố", content = @Content)
    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(Caller caller, @PathVariable long id) {
        documents.delete(caller, id);
    }

    @Operation(summary = "Lịch sử thay đổi của văn bản (cũ nhất trước): hành động, trạng thái trước/sau, người thực hiện, thời điểm")
    @ApiResponse(responseCode = "404", description = "Không có văn bản hoặc không được xem", content = @Content)
    @GetMapping("/{id}/history")
    public List<HistoryResponse> history(Caller caller, @PathVariable long id) {
        return documents.history(caller, id);
    }
}
