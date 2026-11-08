package com.example.organization_service.controller;

import com.example.organization_service.dto.OrganizationRequest;
import com.example.organization_service.dto.OrganizationResponse;
import com.example.organization_service.exception.DuplicateResourceException;
import com.example.organization_service.security.GatewayOrMockAuthFilter;
import com.example.organization_service.security.SecurityConfig;
import com.example.organization_service.service.OrganizationService;
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

@WebMvcTest(controllers = OrganizationController.class)
@Import({SecurityConfig.class, GatewayOrMockAuthFilter.class})
class OrganizationControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private OrganizationService organizationService;

    // =========================================================================
    // 1. ADMIN THAO TÁC TẠO THÀNH CÔNG VỚI EMAIL/ADDRESS RỖNG -> PERSIST NULL
    // =========================================================================

    @Test
    @DisplayName("Admin tạo cơ quan ngoài với email và address rỗng -> Trả về 201 Created và email/address là null")
    void createOrganization_AsAdmin_BlankEmailAndAddress_Success() throws Exception {
        String payload = """
                {
                    "name": "Sở Tài chính",
                    "email": "",
                    "address": ""
                }
                """;

        when(organizationService.createOrganization(any(OrganizationRequest.class)))
                .thenReturn(new OrganizationResponse(1L, "Sở Tài chính", null, null, true));

        mockMvc.perform(post("/api/organizations")
                        .header("Authorization", "Bearer mock-admin-token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(1L))
                .andExpect(jsonPath("$.name").value("Sở Tài chính"))
                .andExpect(jsonPath("$.email").doesNotExist())
                .andExpect(jsonPath("$.address").doesNotExist())
                .andExpect(jsonPath("$.isActive").value(true));
    }

    // =========================================================================
    // 2. VALIDATION LỖI EMAIL KHÔNG ĐÚNG ĐỊNH DẠNG -> 400 VỚI fieldErrors.email
    // =========================================================================

    @Test
    @DisplayName("Admin tạo cơ quan ngoài với email sai định dạng -> 400 Bad Request kèm fieldErrors.email")
    void createOrganization_InvalidEmail_Returns400() throws Exception {
        String payload = """
                {
                    "name": "Sở Ngoại vụ",
                    "email": "not-an-email",
                    "address": "123 Lê Duẩn"
                }
                """;

        mockMvc.perform(post("/api/organizations")
                        .header("Authorization", "Bearer mock-admin-token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400))
                .andExpect(jsonPath("$.error").value("Bad Request"))
                .andExpect(jsonPath("$.fieldErrors.email").exists())
                .andExpect(jsonPath("$.errors.email").exists());
    }

    // =========================================================================
    // 3. TRÙNG TÊN BÁO LỖI 409 CONFLICT KÈM fieldErrors.name
    // =========================================================================

    @Test
    @DisplayName("Admin tạo cơ quan ngoài bị trùng tên -> 409 Conflict kèm fieldErrors.name")
    void createOrganization_DuplicateName_Returns409() throws Exception {
        String payload = """
                {
                    "name": "Bộ Giáo dục và Đào tạo",
                    "email": "bogddt@moet.gov.vn",
                    "address": "35 Đại Cồ Việt"
                }
                """;

        when(organizationService.createOrganization(any(OrganizationRequest.class)))
                .thenThrow(new DuplicateResourceException("name", "Tên cơ quan ngoài 'Bộ Giáo dục và Đào tạo' đã tồn tại"));

        mockMvc.perform(post("/api/organizations")
                        .header("Authorization", "Bearer mock-admin-token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.status").value(409))
                .andExpect(jsonPath("$.error").value("Conflict"))
                .andExpect(jsonPath("$.message").value("Tên cơ quan ngoài 'Bộ Giáo dục và Đào tạo' đã tồn tại"))
                .andExpect(jsonPath("$.fieldErrors.name").exists())
                .andExpect(jsonPath("$.errors.name").exists());
    }

    // =========================================================================
    // 4. ADMIN CẬP NHẬT VÀ NGƯNG HOẠT ĐỘNG
    // =========================================================================

    @Test
    @DisplayName("Admin sửa cơ quan ngoài thành công -> 200 OK")
    void updateOrganization_AsAdmin_Success() throws Exception {
        String payload = """
                {
                    "name": "Sở Giáo dục và Đào tạo TP.HCM (Cập nhật)",
                    "email": "sgddt@tphcm.gov.vn",
                    "address": "66 Lê Thánh Tôn"
                }
                """;

        when(organizationService.updateOrganization(eq(2L), any(OrganizationRequest.class)))
                .thenReturn(new OrganizationResponse(2L, "Sở Giáo dục và Đào tạo TP.HCM (Cập nhật)", "66 Lê Thánh Tôn", "sgddt@tphcm.gov.vn", true));

        mockMvc.perform(put("/api/organizations/2")
                        .header("Authorization", "Bearer mock-admin-token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(2L))
                .andExpect(jsonPath("$.name").value("Sở Giáo dục và Đào tạo TP.HCM (Cập nhật)"));
    }

    @Test
    @DisplayName("Admin ngưng hoạt động cơ quan ngoài -> 200 OK và isActive = false")
    void deactivateOrganization_AsAdmin_Success() throws Exception {
        when(organizationService.deactivateOrganization(1L))
                .thenReturn(new OrganizationResponse(1L, "Bộ Giáo dục và Đào tạo", null, null, false));

        mockMvc.perform(patch("/api/organizations/1/deactivate")
                        .header("Authorization", "Bearer mock-admin-token"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(1L))
                .andExpect(jsonPath("$.isActive").value(false));
    }

    // =========================================================================
    // 5. PHÂN QUYỀN: MANAGER / EMPLOYEE / UNAUTHENTICATED
    // =========================================================================

    @Test
    @DisplayName("Manager gọi API quản lý cơ quan ngoài -> 403 Forbidden")
    void callApi_AsManager_Returns403() throws Exception {
        mockMvc.perform(get("/api/organizations")
                        .header("Authorization", "Bearer mock-manager-token"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.status").value(403))
                .andExpect(jsonPath("$.message").value("Bạn không có quyền thực hiện chức năng này (Chỉ dành cho ADMIN)"));
    }

    @Test
    @DisplayName("Employee gọi API quản lý cơ quan ngoài -> 403 Forbidden")
    void callApi_AsEmployee_Returns403() throws Exception {
        mockMvc.perform(get("/api/organizations")
                        .header("Authorization", "Bearer mock-employee-token"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.status").value(403));
    }

    @Test
    @DisplayName("Không truyền Authorization header -> 401 Unauthorized")
    void callApi_Unauthenticated_Returns401() throws Exception {
        mockMvc.perform(get("/api/organizations"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.status").value(401))
                .andExpect(jsonPath("$.message").value("Vui lòng đăng nhập (thiếu hoặc sai token)"));
    }

    @Test
    @DisplayName("Người dùng đã đăng nhập (Manager/Employee) gọi GET /api/organizations/active -> 200 OK")
    void getActiveOrganizations_AsManager_Success() throws Exception {
        when(organizationService.getOrganizations(true)).thenReturn(List.of(
                new OrganizationResponse(1L, "Bộ GD&ĐT", "Hà Nội", "bogd@moet.gov.vn", true)
        ));

        mockMvc.perform(get("/api/organizations/active")
                        .header("Authorization", "Bearer mock-manager-token"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].isActive").value(true));
    }

    // =========================================================================
    // 6. GATEWAY HEADERS (X-User-Role)
    // =========================================================================

    @Test
    @DisplayName("Gateway header X-User-Role: ADMIN -> 200 OK")
    void callApi_WithGatewayHeaderAdmin_Success() throws Exception {
        when(organizationService.getOrganizations(null)).thenReturn(List.of());

        mockMvc.perform(get("/api/organizations")
                        .header("X-User-Role", "ADMIN"))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("Gateway header X-User-Role: MANAGER trên POST -> 403 Forbidden")
    void callApi_WithGatewayHeaderManager_Returns403() throws Exception {
        String payload = """
                {
                    "name": "Sở Công Thương",
                    "email": "soct@tphcm.gov.vn",
                    "address": "163 Hai Bà Trưng"
                }
                """;

        mockMvc.perform(post("/api/organizations")
                        .header("X-User-Role", "MANAGER")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isForbidden());
    }
}
