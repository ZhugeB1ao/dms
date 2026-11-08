package com.example.department_service.controller;

import com.example.department_service.dto.DepartmentRequest;
import com.example.department_service.dto.DepartmentResponse;
import com.example.department_service.dto.DepartmentTreeResponse;
import com.example.department_service.exception.BusinessConflictException;
import com.example.department_service.exception.ResourceNotFoundException;
import com.example.department_service.exception.ServiceUnavailableException;
import com.example.department_service.security.GatewayOrMockAuthFilter;
import com.example.department_service.security.SecurityConfig;
import com.example.department_service.service.DepartmentService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Collections;
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(controllers = DepartmentController.class)
@Import({SecurityConfig.class, GatewayOrMockAuthFilter.class})
class DepartmentControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private DepartmentService departmentService;

    // =========================================================================
    // 1. ADMIN THAO TÁC THÀNH CÔNG (TREE, ACTIVE, POST, PUT, PATCH)
    // =========================================================================

    @Test
    @DisplayName("Admin lấy cây đơn vị -> Trả về 200 OK với cấu trúc phân cấp")
    void getDepartmentTree_AsAdmin_Success() throws Exception {
        DepartmentTreeResponse leaf = new DepartmentTreeResponse(4L, "CNPM", "Bộ môn CNPM", 3L, true, Collections.emptyList());
        DepartmentTreeResponse mid = new DepartmentTreeResponse(3L, "CNTT", "Khoa CNTT", 1L, true, List.of(leaf));
        DepartmentTreeResponse root = new DepartmentTreeResponse(1L, "BGH", "Ban Giám hiệu", null, true, List.of(mid));

        when(departmentService.getDepartmentTree()).thenReturn(List.of(root));

        mockMvc.perform(get("/api/departments/tree")
                        .header("Authorization", "Bearer mock-admin-token"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].code").value("BGH"))
                .andExpect(jsonPath("$[0].children[0].code").value("CNTT"))
                .andExpect(jsonPath("$[0].children[0].children[0].code").value("CNPM"));
    }

    @Test
    @DisplayName("Admin lấy danh sách active -> Trả về 200 OK")
    void getActiveDepartments_AsAdmin_Success() throws Exception {
        List<DepartmentResponse> activeList = List.of(
                new DepartmentResponse(1L, "BGH", "Ban Giám hiệu", null, true),
                new DepartmentResponse(2L, "HCNS", "Phòng HCNS", 1L, true)
        );
        when(departmentService.getActiveDepartments()).thenReturn(activeList);

        mockMvc.perform(get("/api/departments/active")
                        .header("Authorization", "Bearer mock-admin-token"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].code").value("BGH"));
    }

    @Test
    @DisplayName("Admin tạo đơn vị mới -> Trả về 201 Created")
    void createDepartment_AsAdmin_Success() throws Exception {
        String payload = """
                {
                    "code": "KHTN",
                    "name": "Khoa Khoa học Tự nhiên",
                    "parentId": 1
                }
                """;
        when(departmentService.createDepartment(any(DepartmentRequest.class)))
                .thenReturn(new DepartmentResponse(5L, "KHTN", "Khoa Khoa học Tự nhiên", 1L, true));

        mockMvc.perform(post("/api/departments")
                        .header("Authorization", "Bearer mock-admin-token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(5L))
                .andExpect(jsonPath("$.code").value("KHTN"))
                .andExpect(jsonPath("$.parentId").value(1L));
    }

    @Test
    @DisplayName("Admin sửa đơn vị -> Trả về 200 OK")
    void updateDepartment_AsAdmin_Success() throws Exception {
        String payload = """
                {
                    "code": "CNTT_UPDATE",
                    "name": "Khoa CNTT Đổi tên",
                    "parentId": 1
                }
                """;
        when(departmentService.updateDepartment(eq(3L), any(DepartmentRequest.class)))
                .thenReturn(new DepartmentResponse(3L, "CNTT_UPDATE", "Khoa CNTT Đổi tên", 1L, true));

        mockMvc.perform(put("/api/departments/3")
                        .header("Authorization", "Bearer mock-admin-token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value("CNTT_UPDATE"));
    }

    @Test
    @DisplayName("Admin ngưng dùng đơn vị -> Trả về 200 OK với isActive = false")
    void deactivateDepartment_AsAdmin_Success() throws Exception {
        when(departmentService.deactivateDepartment(4L))
                .thenReturn(new DepartmentResponse(4L, "CNPM", "Bộ môn CNPM", 3L, false));

        mockMvc.perform(patch("/api/departments/4/deactivate")
                        .header("Authorization", "Bearer mock-admin-token"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(4L))
                .andExpect(jsonPath("$.isActive").value(false));
    }

    // =========================================================================
    // 2. PHÂN QUYỀN - MANAGER & EMPLOYEE BỊ 403 TRÊN QUẢN LÝ, NHƯNG 200 TRÊN /ACTIVE; 401 KHI KHÔNG AUTH
    // =========================================================================

    @Test
    @DisplayName("Manager gọi /tree -> 403 Forbidden")
    void getTree_AsManager_Forbidden() throws Exception {
        mockMvc.perform(get("/api/departments/tree")
                        .header("Authorization", "Bearer mock-manager-token"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.status").value(403));
    }

    @Test
    @DisplayName("Employee gọi POST /api/departments -> 403 Forbidden")
    void createDepartment_AsEmployee_Forbidden() throws Exception {
        String payload = """
                {
                    "code": "TEST",
                    "name": "Test Dept",
                    "parentId": null
                }
                """;
        mockMvc.perform(post("/api/departments")
                        .header("Authorization", "Bearer mock-employee-token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.status").value(403));
    }

    @Test
    @DisplayName("Manager và Employee gọi /api/departments/active -> Được phép 200 OK")
    void getActive_AsManagerOrEmployee_Success() throws Exception {
        when(departmentService.getActiveDepartments()).thenReturn(Collections.emptyList());

        mockMvc.perform(get("/api/departments/active")
                        .header("Authorization", "Bearer mock-manager-token"))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/departments/active")
                        .header("Authorization", "Bearer mock-employee-token"))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("Chưa đăng nhập gọi /tree -> 401 Unauthorized")
    void getTree_Unauthenticated_Unauthorized() throws Exception {
        mockMvc.perform(get("/api/departments/tree"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.status").value(401));
    }

    // =========================================================================
    // 3. GATEWAY AUTH HEADER (X-User-Role)
    // =========================================================================

    @Test
    @DisplayName("Gateway header X-User-Role: ADMIN -> 200 OK")
    void gatewayHeader_Admin_Success() throws Exception {
        when(departmentService.getDepartmentTree()).thenReturn(Collections.emptyList());

        mockMvc.perform(get("/api/departments/tree")
                        .header("X-User-Role", "ADMIN"))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("Gateway header X-User-Role: EMPLOYEE -> 403 Forbidden")
    void gatewayHeader_Employee_Forbidden() throws Exception {
        mockMvc.perform(get("/api/departments/tree")
                        .header("X-User-Role", "EMPLOYEE"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.status").value(403));
    }

    // =========================================================================
    // 4. LỖI NGHIỆP VỤ (409 CONFLICT với fieldErrors / errors, 400 VALIDATION, 503 SERVICE UNAVAILABLE)
    // =========================================================================

    @Test
    @DisplayName("Xung đột chu trình/độ sâu -> 409 Conflict với fieldErrors.parentId và errors.parentId")
    void createDepartment_CycleOrDepthConflict_Returns409WithFieldErrors() throws Exception {
        String payload = """
                {
                    "code": "LV4",
                    "name": "Level 4 Node",
                    "parentId": 4
                }
                """;
        when(departmentService.createDepartment(any(DepartmentRequest.class)))
                .thenThrow(new BusinessConflictException("parentId", "Cây đơn vị chỉ cho phép tối đa 3 cấp"));

        mockMvc.perform(post("/api/departments")
                        .header("Authorization", "Bearer mock-admin-token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.status").value(409))
                .andExpect(jsonPath("$.error").value("Conflict"))
                .andExpect(jsonPath("$.fieldErrors.parentId").value("Cây đơn vị chỉ cho phép tối đa 3 cấp"))
                .andExpect(jsonPath("$.errors.parentId").value("Cây đơn vị chỉ cho phép tối đa 3 cấp"));
    }

    @Test
    @DisplayName("Lỗi xác thực DTO -> 400 Bad Request với fieldErrors và errors")
    void createDepartment_InvalidDto_Returns400() throws Exception {
        String payload = """
                {
                    "code": "",
                    "name": ""
                }
                """;

        mockMvc.perform(post("/api/departments")
                        .header("Authorization", "Bearer mock-admin-token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400))
                .andExpect(jsonPath("$.fieldErrors.code").exists())
                .andExpect(jsonPath("$.errors.code").exists())
                .andExpect(jsonPath("$.fieldErrors.name").exists())
                .andExpect(jsonPath("$.errors.name").exists());
    }

    @Test
    @DisplayName("gRPC Account Service lỗi / timeout -> 503 Service Unavailable")
    void deactivateDepartment_GrpcUnavailable_Returns503() throws Exception {
        when(departmentService.deactivateDepartment(eq(1L)))
                .thenThrow(new ServiceUnavailableException("Không thể kiểm tra trạng thái tài khoản từ account-service, vui lòng thử lại sau."));

        mockMvc.perform(patch("/api/departments/1/deactivate")
                        .header("Authorization", "Bearer mock-admin-token"))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.status").value(503))
                .andExpect(jsonPath("$.error").value("Service Unavailable"))
                .andExpect(jsonPath("$.message").value("Không thể kiểm tra trạng thái tài khoản từ account-service, vui lòng thử lại sau."));
    }
}
