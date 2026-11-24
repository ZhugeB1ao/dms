package com.example.documentservice.controller;

import com.example.documentservice.config.Caller;
import com.example.documentservice.dto.AttachDocumentRequest;
import com.example.documentservice.dto.DocumentResponse;
import com.example.documentservice.dto.DossierRequest;
import com.example.documentservice.dto.DossierResponse;
import com.example.documentservice.dto.PageResponse;
import com.example.documentservice.service.DossierService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@Tag(name = "Dossiers", description = "Hồ sơ lưu trữ văn bản theo đơn vị và năm. Chỉ MANAGER và EMPLOYEE được phép truy cập (ADMIN trả 403); mọi API cần đăng nhập (401); hồ sơ ngoài đơn vị hoặc không tồn tại trả 404.")
@RestController
@RequestMapping("/api/dossiers")
@RequiredArgsConstructor
public class DossierController {
    private final DossierService dossiers;

    @Operation(summary = "Danh sách hồ sơ thuộc đơn vị người gọi (phân trang, sắp xếp theo năm giảm dần, id giảm dần)")
    @ApiResponse(responseCode = "403", description = "Chỉ MANAGER hoặc EMPLOYEE được phép thao tác hồ sơ", content = @Content)
    @GetMapping
    public PageResponse<DossierResponse> listDossiers(
            Caller caller,
            @RequestParam(required = false) Integer year,
            @RequestParam(required = false) Boolean closed,
            @RequestParam(defaultValue = "0") @Min(0) int page,
            @RequestParam(defaultValue = "20") @Min(1) @Max(100) int size) {
        return dossiers.list(caller, year, closed, page, size);
    }

    @Operation(summary = "Chi tiết hồ sơ thuộc đơn vị người gọi")
    @ApiResponse(responseCode = "403", description = "Chỉ MANAGER hoặc EMPLOYEE được phép thao tác hồ sơ", content = @Content)
    @ApiResponse(responseCode = "404", description = "Hồ sơ không tồn tại hoặc thuộc đơn vị khác", content = @Content)
    @GetMapping("/{id}")
    public DossierResponse getDossier(Caller caller, @PathVariable long id) {
        return dossiers.get(caller, id);
    }

    @Operation(summary = "Tạo mới hồ sơ cho đơn vị người gọi")
    @ApiResponse(responseCode = "201", description = "Created")
    @ApiResponse(responseCode = "400", description = "Dữ liệu không hợp lệ", content = @Content)
    @ApiResponse(responseCode = "403", description = "Chỉ MANAGER hoặc EMPLOYEE được phép thao tác hồ sơ", content = @Content)
    @ApiResponse(responseCode = "409", description = "Trùng mã hồ sơ trong cùng đơn vị và năm", content = @Content)
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public DossierResponse createDossier(Caller caller, @Valid @RequestBody DossierRequest req) {
        return dossiers.create(caller, req);
    }

    @Operation(summary = "Cập nhật thông tin hồ sơ (chỉ khi hồ sơ chưa đóng)")
    @ApiResponse(responseCode = "400", description = "Dữ liệu không hợp lệ", content = @Content)
    @ApiResponse(responseCode = "403", description = "Chỉ MANAGER hoặc EMPLOYEE được phép thao tác hồ sơ", content = @Content)
    @ApiResponse(responseCode = "404", description = "Hồ sơ không tồn tại hoặc thuộc đơn vị khác", content = @Content)
    @ApiResponse(responseCode = "409", description = "Hồ sơ đã đóng hoặc trùng mã hồ sơ trong cùng đơn vị và năm", content = @Content)
    @PutMapping("/{id}")
    public DossierResponse updateDossier(Caller caller, @PathVariable long id, @Valid @RequestBody DossierRequest req) {
        return dossiers.update(caller, id, req);
    }

    @Operation(summary = "Đóng hồ sơ lưu trữ")
    @ApiResponse(responseCode = "403", description = "Chỉ MANAGER hoặc EMPLOYEE được phép thao tác hồ sơ", content = @Content)
    @ApiResponse(responseCode = "404", description = "Hồ sơ không tồn tại hoặc thuộc đơn vị khác", content = @Content)
    @ApiResponse(responseCode = "409", description = "Hồ sơ đã được đóng trước đó", content = @Content)
    @PostMapping("/{id}/close")
    public DossierResponse closeDossier(Caller caller, @PathVariable long id) {
        return dossiers.close(caller, id);
    }

    @Operation(summary = "Danh sách văn bản trong hồ sơ mà người gọi được xem (mới nhất trước)")
    @ApiResponse(responseCode = "403", description = "Chỉ MANAGER hoặc EMPLOYEE được phép thao tác hồ sơ", content = @Content)
    @ApiResponse(responseCode = "404", description = "Hồ sơ không tồn tại hoặc thuộc đơn vị khác", content = @Content)
    @GetMapping("/{id}/documents")
    public List<DocumentResponse> listDossierDocuments(Caller caller, @PathVariable long id) {
        return dossiers.listDocuments(caller, id);
    }

    @Operation(summary = "Danh sách văn bản cùng đơn vị chưa gắn hồ sơ và người gọi được xem")
    @ApiResponse(responseCode = "403", description = "Chỉ MANAGER hoặc EMPLOYEE được phép thao tác hồ sơ", content = @Content)
    @ApiResponse(responseCode = "404", description = "Hồ sơ không tồn tại hoặc thuộc đơn vị khác", content = @Content)
    @GetMapping("/{id}/available-documents")
    public List<DocumentResponse> listAvailableDocuments(Caller caller, @PathVariable long id) {
        return dossiers.listAvailableDocuments(caller, id);
    }

    @Operation(summary = "Gắn văn bản vào hồ sơ (idempotent nếu đã gắn đúng hồ sơ này)")
    @ApiResponse(responseCode = "400", description = "Thiếu documentId", content = @Content)
    @ApiResponse(responseCode = "403", description = "Không phải MANAGER/EMPLOYEE hoặc văn bản thuộc đơn vị khác", content = @Content)
    @ApiResponse(responseCode = "404", description = "Không tìm thấy hồ sơ hoặc không có quyền xem văn bản", content = @Content)
    @ApiResponse(responseCode = "409", description = "Hồ sơ đã đóng hoặc văn bản đã thuộc hồ sơ khác", content = @Content)
    @PostMapping("/{id}/documents")
    public DocumentResponse attachDocument(
            Caller caller,
            @PathVariable long id,
            @Valid @RequestBody AttachDocumentRequest req) {
        return dossiers.attachDocument(caller, id, req.documentId());
    }

    @Operation(summary = "Gỡ văn bản khỏi hồ sơ")
    @ApiResponse(responseCode = "204", description = "No Content")
    @ApiResponse(responseCode = "403", description = "Chỉ MANAGER hoặc EMPLOYEE được phép thao tác hồ sơ", content = @Content)
    @ApiResponse(responseCode = "404", description = "Không tìm thấy hồ sơ, không xem được văn bản, hoặc văn bản không nằm trong hồ sơ này", content = @Content)
    @ApiResponse(responseCode = "409", description = "Hồ sơ đã đóng", content = @Content)
    @DeleteMapping("/{id}/documents/{documentId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void detachDocument(Caller caller, @PathVariable long id, @PathVariable long documentId) {
        dossiers.detachDocument(caller, id, documentId);
    }
}
