package com.example.category_service.controller;

import com.example.category_service.dto.CategoryRequest;
import com.example.category_service.dto.CategoryResponse;
import com.example.category_service.entity.CategoryType;
import com.example.category_service.exception.DuplicateResourceException;
import com.example.category_service.security.MockJwtAuthenticationFilter;
import com.example.category_service.security.SecurityConfig;
import com.example.category_service.service.CategoryService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(controllers = CategoryController.class)
@Import({SecurityConfig.class, MockJwtAuthenticationFilter.class})
class CategoryControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private CategoryService categoryService;

    // =========================================================================
    // TIÊU CHÍ 1: ADMIN THAO TÁC THÀNH CÔNG (THÊM, SỬA, NGƯNG DÙNG)
    // =========================================================================

    @Test
    @DisplayName("Admin thêm danh mục thành công -> Trả về 201 Created")
    void createCategory_AsAdmin_Success() throws Exception {
        String payload = """
                {
                    "type": "DOC_TYPE",
                    "code": "CV",
                    "name": "Công văn",
                    "symbol": "CV"
                }
                """;

        when(categoryService.createCategory(any(CategoryRequest.class)))
                .thenReturn(new CategoryResponse(1L, CategoryType.DOC_TYPE, "CV", "Công văn", "CV", true));

        mockMvc.perform(post("/api/categories")
                        .header("Authorization", "Bearer mock-admin-token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(1L))
                .andExpect(jsonPath("$.code").value("CV"))
                .andExpect(jsonPath("$.name").value("Công văn"))
                .andExpect(jsonPath("$.isActive").value(true));
    }

    @Test
    @DisplayName("Admin sửa danh mục thành công -> Trả về 200 OK")
    void updateCategory_AsAdmin_Success() throws Exception {
        String payload = """
                {
                    "type": "DOC_TYPE",
                    "code": "CV_NEW",
                    "name": "Công văn mới",
                    "symbol": "CVN"
                }
                """;

        when(categoryService.updateCategory(eq(1L), any(CategoryRequest.class)))
                .thenReturn(new CategoryResponse(1L, CategoryType.DOC_TYPE, "CV_NEW", "Công văn mới", "CVN", true));

        mockMvc.perform(put("/api/categories/1")
                        .header("Authorization", "Bearer mock-admin-token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value("CV_NEW"))
                .andExpect(jsonPath("$.name").value("Công văn mới"));
    }

    @Test
    @DisplayName("Admin ngưng dùng danh mục thành công -> Trả về 200 OK và isActive = false")
    void deactivateCategory_AsAdmin_Success() throws Exception {
        when(categoryService.deactivateCategory(1L))
                .thenReturn(new CategoryResponse(1L, CategoryType.DOC_TYPE, "CV", "Công văn", "CV", false));

        mockMvc.perform(patch("/api/categories/1/deactivate")
                        .header("Authorization", "Bearer mock-admin-token"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(1L))
                .andExpect(jsonPath("$.isActive").value(false));
    }

    // =========================================================================
    // TIÊU CHÍ 2: TRÙNG MÃ BÁO LỖI 409 CONFLICT RÕ RÀNG
    // =========================================================================

    @Test
    @DisplayName("Thêm danh mục bị trùng mã trong cùng Type -> Trả về 409 Conflict")
    void createCategory_DuplicateCode_Returns409() throws Exception {
        String payload = """
                {
                    "type": "DOC_TYPE",
                    "code": "CV",
                    "name": "Công văn trùng",
                    "symbol": "CV"
                }
                """;

        when(categoryService.createCategory(any(CategoryRequest.class)))
                .thenThrow(new DuplicateResourceException("Mã danh mục 'CV' đã tồn tại trong nhóm DOC_TYPE"));

        mockMvc.perform(post("/api/categories")
                        .header("Authorization", "Bearer mock-admin-token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.status").value(409))
                .andExpect(jsonPath("$.error").value("Conflict"))
                .andExpect(jsonPath("$.message").value("Mã danh mục 'CV' đã tồn tại trong nhóm DOC_TYPE"));
    }

    // =========================================================================
    // TIÊU CHÍ 3: PHÂN QUYỀN - MANAGER & EMPLOYEE BỊ 403, THIẾU TOKEN BỊ 401
    // =========================================================================

    @Test
    @DisplayName("Manager gọi API quản lý danh mục -> Bị chặn 403 Forbidden")
    void callApi_AsManager_Returns403() throws Exception {
        mockMvc.perform(get("/api/categories")
                        .header("Authorization", "Bearer mock-manager-token"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.status").value(403))
                .andExpect(jsonPath("$.error").value("Forbidden"))
                .andExpect(jsonPath("$.message").value("Bạn không có quyền thực hiện chức năng này (Chỉ dành cho ADMIN)"));
    }

    @Test
    @DisplayName("Employee gọi API quản lý danh mục -> Bị chặn 403 Forbidden")
    void callApi_AsEmployee_Returns403() throws Exception {
        mockMvc.perform(get("/api/categories")
                        .header("Authorization", "Bearer mock-employee-token"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.status").value(403));
    }

    @Test
    @DisplayName("Không truyền Authorization header -> Bị từ chối 401 Unauthorized")
    void callApi_Unauthenticated_Returns401() throws Exception {
        mockMvc.perform(get("/api/categories"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.status").value(401))
                .andExpect(jsonPath("$.message").value("Vui lòng đăng nhập (thiếu hoặc sai token)"));
    }

    // =========================================================================
    // TIÊU CHÍ 4: DROPDOWN CHỈ TRẢ VỀ CÁC MỤC ĐANG HOẠT ĐỘNG (IS_ACTIVE = TRUE)
    // =========================================================================

    @Test
    @DisplayName("Gọi API Dropdown /api/categories/active -> Chỉ trả về danh sách có isActive = true")
    void getActiveCategoriesForDropdown_ReturnsOnlyActive() throws Exception {
        List<CategoryResponse> activeList = List.of(
                new CategoryResponse(1L, CategoryType.URGENCY, "KHAN", "Khẩn", "K", true),
                new CategoryResponse(2L, CategoryType.URGENCY, "HOA_TOC", "Hỏa tốc", "HT", true)
        );

        when(categoryService.getCategories(CategoryType.URGENCY, true))
                .thenReturn(activeList);

        mockMvc.perform(get("/api/categories/active")
                        .param("type", "URGENCY")
                        .header("Authorization", "Bearer mock-admin-token"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].isActive").value(true))
                .andExpect(jsonPath("$[1].isActive").value(true));
    }

    // =========================================================================
    // TIÊU CHÍ 5: GATEWAY AUTH HEADERS (X-User-Role)
    // =========================================================================

    @Test
    @DisplayName("Gateway header X-User-Role: ADMIN -> Trả về 200 OK")
    void callApi_WithGatewayHeaderAdmin_Success() throws Exception {
        when(categoryService.getCategories(null, false)).thenReturn(List.of());

        mockMvc.perform(get("/api/categories")
                        .header("X-User-Role", "ADMIN"))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("Gateway header X-User-Role: EMPLOYEE -> Bị chặn 403 Forbidden khi thao tác ADMIN")
    void callApi_WithGatewayHeaderEmployee_Returns403() throws Exception {
        String payload = """
                {
                    "type": "DOC_TYPE",
                    "code": "CV",
                    "name": "Công văn",
                    "symbol": "CV"
                }
                """;

        mockMvc.perform(post("/api/categories")
                        .header("X-User-Role", "EMPLOYEE")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isForbidden());
    }
}


