package com.example.department_service;

import com.example.department_service.dto.DepartmentRequest;
import com.example.department_service.dto.DepartmentResponse;
import com.example.department_service.dto.DepartmentTreeResponse;
import com.example.department_service.entity.Department;
import com.example.department_service.exception.BusinessConflictException;
import com.example.department_service.grpc.AccountGrpcClient;
import com.example.department_service.repository.DepartmentRepository;
import com.example.department_service.service.DepartmentService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.when;

@SpringBootTest
@Transactional
class DepartmentServiceIntegrationTest {

    @Autowired
    private DepartmentService departmentService;

    @Autowired
    private DepartmentRepository departmentRepository;

    @MockitoBean
    private AccountGrpcClient accountGrpcClient;

    @Test
    @DisplayName("Cây đơn vị khớp với seed Flyway V1 (BGH -> CNTT -> CNPM & BGH -> HCNS)")
    void treeStructure_MatchesFlywaySeed() {
        List<DepartmentTreeResponse> tree = departmentService.getDepartmentTree();

        assertEquals(1, tree.size());
        DepartmentTreeResponse bgh = tree.get(0);
        assertEquals("BGH", bgh.code());
        assertEquals(2, bgh.children().size());

        DepartmentTreeResponse hcns = bgh.children().stream()
                .filter(c -> "HCNS".equals(c.code()))
                .findFirst()
                .orElseThrow();
        assertEquals(0, hcns.children().size());

        DepartmentTreeResponse cntt = bgh.children().stream()
                .filter(c -> "CNTT".equals(c.code()))
                .findFirst()
                .orElseThrow();
        assertEquals(1, cntt.children().size());

        DepartmentTreeResponse cnpm = cntt.children().get(0);
        assertEquals("CNPM", cnpm.code());
        assertEquals(0, cnpm.children().size());
    }

    @Test
    @DisplayName("Chặn tạo đơn vị cấp 4 dưới CNPM (đang ở cấp 3) -> fieldErrors.parentId")
    void createDepartment_Level4UnderCNPM_ThrowsConflict() {
        DepartmentRequest req = new DepartmentRequest("TO_WEB", "Tổ Lập trình Web", 4L);

        BusinessConflictException ex = assertThrows(
                BusinessConflictException.class,
                () -> departmentService.createDepartment(req)
        );

        assertEquals("parentId", ex.getField());
        assertTrue(ex.getMessage().contains("tối đa 3 cấp"));
    }

    @Test
    @DisplayName("Chặn chọn chính mình làm đơn vị cha (BGH.parentId = BGH.id)")
    void updateDepartment_SelfParent_ThrowsConflict() {
        DepartmentRequest req = new DepartmentRequest("BGH", "Ban Giám hiệu Cập nhật", 1L);

        BusinessConflictException ex = assertThrows(
                BusinessConflictException.class,
                () -> departmentService.updateDepartment(1L, req)
        );

        assertEquals("parentId", ex.getField());
        assertTrue(ex.getMessage().contains("chính đơn vị này"));
    }

    @Test
    @DisplayName("Review Focus #3: Chặn vòng lặp gián tiếp 3 cấp (BGH.parentId = CNPM.id)")
    void updateDepartment_IndirectCycle_ThrowsConflict() {
        DepartmentRequest req = new DepartmentRequest("BGH", "Ban Giám hiệu", 4L);

        BusinessConflictException ex = assertThrows(
                BusinessConflictException.class,
                () -> departmentService.updateDepartment(1L, req)
        );

        assertEquals("parentId", ex.getField());
        assertTrue(ex.getMessage().contains("vòng lặp"));
    }

    @Test
    @DisplayName("Review Focus #2: Chặn di chuyển nhánh 2 cấp (A -> A1) dưới nút cấp 2 (CNTT) làm đẩy A1 lên cấp 4")
    void updateDepartment_BranchMoveExceedsLevel3_ThrowsConflict() {
        DepartmentResponse deptA = departmentService.createDepartment(
                new DepartmentRequest("KHOA_A", "Khoa A", null)
        );
        DepartmentResponse deptA1 = departmentService.createDepartment(
                new DepartmentRequest("BM_A1", "Bộ môn A1", deptA.id())
        );

        // CNTT is at depth 2 (under BGH). Moving KHOA_A (which has child BM_A1) under CNTT
        // would make KHOA_A depth 3 and BM_A1 depth 4.
        DepartmentRequest req = new DepartmentRequest("KHOA_A", "Khoa A", 3L);

        BusinessConflictException ex = assertThrows(
                BusinessConflictException.class,
                () -> departmentService.updateDepartment(deptA.id(), req)
        );

        assertEquals("parentId", ex.getField());
        assertTrue(ex.getMessage().contains("3 cấp"));
    }

    @Test
    @DisplayName("Review Focus #3: Chặn chọn đơn vị cha đã ngưng hoạt động khi tạo và sửa")
    void createAndModify_WithInactiveParent_ThrowsConflict() {
        when(accountGrpcClient.hasActiveUsers(4L)).thenReturn(false);
        departmentService.deactivateDepartment(4L);

        // Try creating child under inactive CNPM
        DepartmentRequest createReq = new DepartmentRequest("TO_NEW", "Tổ Mới", 4L);
        BusinessConflictException createEx = assertThrows(
                BusinessConflictException.class,
                () -> departmentService.createDepartment(createReq)
        );
        assertEquals("parentId", createEx.getField());
        assertTrue(createEx.getMessage().contains("ngưng hoạt động"));

        // Try updating existing department to have inactive CNPM as parent
        DepartmentResponse activeDept = departmentService.createDepartment(
                new DepartmentRequest("DEPT_TEMP", "Đơn vị tạm", null)
        );
        DepartmentRequest updateReq = new DepartmentRequest("DEPT_TEMP", "Đơn vị tạm", 4L);
        BusinessConflictException updateEx = assertThrows(
                BusinessConflictException.class,
                () -> departmentService.updateDepartment(activeDept.id(), updateReq)
        );
        assertEquals("parentId", updateEx.getField());
        assertTrue(updateEx.getMessage().contains("ngưng hoạt động"));
    }

    @Test
    @DisplayName("Quy tắc ngưng sử dụng đơn vị: Chặn khi còn đơn vị con hoặc tài khoản; thành công với lá")
    void deactivateDepartment_Rules() {
        // 1. Chặn ngưng dùng BGH vì còn HCNS và CNTT đang hoạt động
        BusinessConflictException exChild = assertThrows(
                BusinessConflictException.class,
                () -> departmentService.deactivateDepartment(1L)
        );
        assertTrue(exChild.getMessage().contains("vẫn còn đơn vị trực thuộc đang hoạt động"));

        // 2. Chặn ngưng dùng CNPM khi AccountGrpcClient báo còn tài khoản hoạt động
        when(accountGrpcClient.hasActiveUsers(4L)).thenReturn(true);
        BusinessConflictException exUser = assertThrows(
                BusinessConflictException.class,
                () -> departmentService.deactivateDepartment(4L)
        );
        assertTrue(exUser.getMessage().contains("vẫn còn tài khoản đang hoạt động"));

        // 3. Cho phép ngưng dùng CNPM khi không còn tài khoản hoạt động
        when(accountGrpcClient.hasActiveUsers(4L)).thenReturn(false);
        DepartmentResponse deactivated = departmentService.deactivateDepartment(4L);

        assertFalse(deactivated.isActive());
        Department fromDb = departmentRepository.findById(4L).orElseThrow();
        assertFalse(fromDb.isActive());
    }
}
