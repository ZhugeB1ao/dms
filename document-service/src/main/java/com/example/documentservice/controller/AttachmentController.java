package com.example.documentservice.controller;

import com.example.documentservice.config.Caller;
import com.example.documentservice.dto.AttachmentResponse;
import com.example.documentservice.dto.PresignedUrlResponse;
import com.example.documentservice.service.AttachmentService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@Tag(name = "Attachments", description = "Tệp đính kèm văn bản trên MinIO. Upload/thay thế/xóa chỉ áp dụng cho owner khi văn bản còn DRAFT.")
@RestController
@RequestMapping("/api/documents/{documentId}/attachments")
@RequiredArgsConstructor
public class AttachmentController {
    private final AttachmentService attachments;

    @Operation(summary = "Danh sách tệp đính kèm của văn bản (mặc định chỉ lấy phiên bản hiện hành)")
    @ApiResponse(responseCode = "404", description = "Không có văn bản hoặc không được xem", content = @Content)
    @GetMapping
    public List<AttachmentResponse> list(
            Caller caller,
            @PathVariable long documentId,
            @RequestParam(defaultValue = "false") boolean includeHistory) {
        return attachments.list(caller, documentId, includeHistory);
    }

    @Operation(summary = "Danh sách tất cả phiên bản cùng nhóm tệp đính kèm (mới nhất trước)")
    @ApiResponse(responseCode = "404", description = "Không có văn bản, không có tệp đính kèm, hoặc không được xem", content = @Content)
    @GetMapping("/{attachmentId}/versions")
    public List<AttachmentResponse> versions(
            Caller caller,
            @PathVariable long documentId,
            @PathVariable long attachmentId) {
        return attachments.versions(caller, documentId, attachmentId);
    }

    @Operation(summary = "Tải lên tệp đính kèm mới (PDF, PNG, JPEG, WEBP, DOCX, XLSX)")
    @ApiResponse(responseCode = "201", description = "Created")
    @ApiResponse(responseCode = "400", description = "Tệp rỗng hoặc tên tệp không hợp lệ", content = @Content)
    @ApiResponse(responseCode = "403", description = "Không phải owner", content = @Content)
    @ApiResponse(responseCode = "404", description = "Không có văn bản hoặc không được xem", content = @Content)
    @ApiResponse(responseCode = "409", description = "Văn bản không còn ở trạng thái DRAFT", content = @Content)
    @ApiResponse(responseCode = "413", description = "Dung lượng vượt quá giới hạn", content = @Content)
    @ApiResponse(responseCode = "415", description = "Định dạng hoặc nội dung tệp không được hỗ trợ", content = @Content)
    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    public AttachmentResponse upload(
            Caller caller,
            @PathVariable long documentId,
            @RequestPart("file") MultipartFile file) {
        return attachments.upload(caller, documentId, file);
    }

    @Operation(summary = "Thay thế tệp đính kèm bằng phiên bản mới (tăng versionNo, giữ lịch sử phiên bản cũ)")
    @ApiResponse(responseCode = "201", description = "Created")
    @ApiResponse(responseCode = "400", description = "Tệp rỗng hoặc tên tệp không hợp lệ", content = @Content)
    @ApiResponse(responseCode = "403", description = "Không phải owner", content = @Content)
    @ApiResponse(responseCode = "404", description = "Không có văn bản, không có tệp, hoặc không được xem", content = @Content)
    @ApiResponse(responseCode = "409", description = "Không còn DRAFT hoặc xung đột phiên bản đồng thời", content = @Content)
    @ApiResponse(responseCode = "413", description = "Dung lượng vượt quá giới hạn", content = @Content)
    @ApiResponse(responseCode = "415", description = "Định dạng hoặc nội dung tệp không được hỗ trợ", content = @Content)
    @PostMapping(value = "/{attachmentId}/replace", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    public AttachmentResponse replace(
            Caller caller,
            @PathVariable long documentId,
            @PathVariable long attachmentId,
            @RequestPart("file") MultipartFile file) {
        return attachments.replace(caller, documentId, attachmentId, file);
    }

    @Operation(summary = "Xóa tệp đính kèm (xóa toàn bộ các phiên bản trong nhóm)")
    @ApiResponse(responseCode = "204", description = "No Content")
    @ApiResponse(responseCode = "403", description = "Không phải owner", content = @Content)
    @ApiResponse(responseCode = "404", description = "Không có văn bản, không có tệp, hoặc không được xem", content = @Content)
    @ApiResponse(responseCode = "409", description = "Văn bản không còn ở trạng thái DRAFT", content = @Content)
    @DeleteMapping("/{attachmentId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(
            Caller caller,
            @PathVariable long documentId,
            @PathVariable long attachmentId) {
        attachments.delete(caller, documentId, attachmentId);
    }

    @Operation(summary = "Tạo presigned GET URL ngắn hạn để xem trước (inline) hoặc tải xuống (attachment)")
    @ApiResponse(responseCode = "400", description = "Tham số disposition không hợp lệ", content = @Content)
    @ApiResponse(responseCode = "404", description = "Không có văn bản, không có tệp, hoặc không được xem", content = @Content)
    @GetMapping("/{attachmentId}/url")
    public PresignedUrlResponse presignUrl(
            Caller caller,
            @PathVariable long documentId,
            @PathVariable long attachmentId,
            @RequestParam(defaultValue = "inline") String disposition) {
        return attachments.presignUrl(caller, documentId, attachmentId, disposition);
    }
}
