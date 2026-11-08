package com.example.organization_service;

import com.example.organization_service.dto.OrganizationRequest;
import com.example.organization_service.dto.OrganizationResponse;
import com.example.organization_service.exception.DuplicateResourceException;
import com.example.organization_service.service.OrganizationService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
@Transactional
class OrganizationIntegrationTest {

    @Autowired
    private OrganizationService organizationService;

    @Test
    @DisplayName("Flyway V1 nạp sẵn 3 bản ghi dữ liệu mẫu")
    void flyway_SeedDataLoadsSuccessfully() {
        List<OrganizationResponse> all = organizationService.getOrganizations(false);
        assertTrue(all.size() >= 3, "Phải có ít nhất 3 bản ghi seed từ Flyway V1");

        List<OrganizationResponse> activeOnly = organizationService.getOrganizations(true);
        assertTrue(activeOnly.size() >= 3);
    }

    @Test
    @DisplayName("Tạo cơ quan ngoài với email và address để trống -> Lưu trữ giá trị null trong DB")
    void createOrganization_BlankEmailAndAddress_PersistsNull() {
        OrganizationRequest req = new OrganizationRequest("Sở Thông tin và Truyền thông", "   ", "");
        OrganizationResponse created = organizationService.createOrganization(req);

        assertNotNull(created.id());
        assertEquals("Sở Thông tin và Truyền thông", created.name());
        assertNull(created.address(), "Address rỗng phải được chuẩn hóa thành null");
        assertNull(created.email(), "Email rỗng phải được chuẩn hóa thành null");
        assertTrue(created.isActive());
    }

    @Test
    @DisplayName("Tạo cơ quan ngoài trùng tên (không phân biệt hoa thường) -> Ném lỗi DuplicateResourceException")
    void createOrganization_DuplicateName_ThrowsDuplicateResourceException() {
        OrganizationRequest req = new OrganizationRequest("bộ giáo dục và đào tạo", "Hà Nội", "test@moet.gov.vn");

        DuplicateResourceException ex = assertThrows(DuplicateResourceException.class, () -> {
            organizationService.createOrganization(req);
        });

        assertEquals("name", ex.getField());
        assertTrue(ex.getMessage().contains("đã tồn tại"));
    }

    @Test
    @DisplayName("Ngưng hoạt động cơ quan ngoài -> isActive = false và bị loại khỏi getOrganizations(true)")
    void deactivateOrganization_HidesFromActiveList() {
        List<OrganizationResponse> initialActive = organizationService.getOrganizations(true);
        Long idToDeactivate = initialActive.getFirst().id();

        OrganizationResponse deactivated = organizationService.deactivateOrganization(idToDeactivate);
        assertFalse(deactivated.isActive());

        List<OrganizationResponse> updatedActive = organizationService.getOrganizations(true);
        boolean stillPresent = updatedActive.stream().anyMatch(org -> org.id().equals(idToDeactivate));
        assertFalse(stillPresent, "Bản ghi đã ngưng hoạt động không được xuất hiện trong danh sách activeOnly=true");
    }
}
