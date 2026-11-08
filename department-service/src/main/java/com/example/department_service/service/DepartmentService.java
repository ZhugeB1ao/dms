package com.example.department_service.service;

import com.example.department_service.dto.DepartmentRequest;
import com.example.department_service.dto.DepartmentResponse;
import com.example.department_service.dto.DepartmentTreeResponse;
import com.example.department_service.entity.Department;
import com.example.department_service.exception.BusinessConflictException;
import com.example.department_service.exception.ResourceNotFoundException;
import com.example.department_service.grpc.AccountGrpcClient;
import com.example.department_service.repository.DepartmentRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@Transactional
public class DepartmentService {

    private final DepartmentRepository departmentRepository;
    private final AccountGrpcClient accountGrpcClient;

    public DepartmentService(DepartmentRepository departmentRepository, AccountGrpcClient accountGrpcClient) {
        this.departmentRepository = departmentRepository;
        this.accountGrpcClient = accountGrpcClient;
    }

    @Transactional(readOnly = true)
    public List<DepartmentTreeResponse> getDepartmentTree() {
        List<Department> all = departmentRepository.findAllByOrderByIdAsc();
        Map<Long, List<Department>> childrenByParent = new LinkedHashMap<>();
        Set<Long> allIds = new HashSet<>();

        for (Department d : all) {
            allIds.add(d.getId());
            if (d.getParentId() != null) {
                childrenByParent.computeIfAbsent(d.getParentId(), k -> new ArrayList<>()).add(d);
            }
        }

        return all.stream()
                .filter(d -> d.getParentId() == null || !allIds.contains(d.getParentId()))
                .map(root -> buildTreeNode(root, childrenByParent))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<DepartmentResponse> getActiveDepartments() {
        return departmentRepository.findAllByIsActiveTrueOrderByIdAsc().stream()
                .map(DepartmentResponse::fromEntity)
                .toList();
    }

    public DepartmentResponse createDepartment(DepartmentRequest req) {
        String code = req.code().trim().toUpperCase();
        String name = req.name().trim();

        if (departmentRepository.existsByCodeIgnoreCase(code)) {
            throw new BusinessConflictException("code", "Mã đơn vị '" + code + "' đã tồn tại");
        }

        if (req.parentId() != null) {
            Map<Long, Department> byId = departmentRepository.findAll().stream()
                    .collect(Collectors.toMap(Department::getId, Function.identity()));
            Department parent = byId.get(req.parentId());
            if (parent == null) {
                throw new BusinessConflictException("parentId", "Đơn vị cha không tồn tại");
            }
            if (!parent.isActive()) {
                throw new BusinessConflictException("parentId", "Không thể chọn đơn vị cha đã ngưng hoạt động");
            }
            int parentDepth = calculateDepth(parent, byId);
            if (parentDepth + 1 > 3) {
                throw new BusinessConflictException("parentId", "Cây đơn vị chỉ cho phép tối đa 3 cấp");
            }
        }

        Department department = new Department(code, name, req.parentId());
        Department saved = departmentRepository.save(department);
        return DepartmentResponse.fromEntity(saved);
    }

    public DepartmentResponse updateDepartment(Long id, DepartmentRequest req) {
        Department target = departmentRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy đơn vị với ID: " + id));

        String code = req.code().trim().toUpperCase();
        String name = req.name().trim();

        if (departmentRepository.existsByCodeIgnoreCaseAndIdNot(code, id)) {
            throw new BusinessConflictException("code", "Mã đơn vị '" + code + "' đã tồn tại");
        }

        if (req.parentId() != null) {
            if (req.parentId().equals(id)) {
                throw new BusinessConflictException("parentId", "Không thể chọn chính đơn vị này làm đơn vị cha");
            }
            List<Department> all = departmentRepository.findAll();
            Map<Long, Department> byId = all.stream()
                    .collect(Collectors.toMap(Department::getId, Function.identity()));
            Department parent = byId.get(req.parentId());
            if (parent == null) {
                throw new BusinessConflictException("parentId", "Đơn vị cha không tồn tại");
            }
            if (!parent.isActive()) {
                throw new BusinessConflictException("parentId", "Không thể chọn đơn vị cha đã ngưng hoạt động");
            }

            Long curr = parent.getId();
            Set<Long> visited = new HashSet<>();
            while (curr != null) {
                if (curr.equals(id)) {
                    throw new BusinessConflictException("parentId", "Không thể chọn đơn vị trực thuộc làm đơn vị cha (gây vòng lặp)");
                }
                if (!visited.add(curr)) {
                    break;
                }
                Department p = byId.get(curr);
                curr = (p != null) ? p.getParentId() : null;
            }

            int parentDepth = calculateDepth(parent, byId);
            Map<Long, List<Department>> childrenByParent = all.stream()
                    .filter(d -> d.getParentId() != null)
                    .collect(Collectors.groupingBy(Department::getParentId));
            int subtreeHeight = calculateSubtreeHeight(id, childrenByParent);
            if (parentDepth + subtreeHeight > 3) {
                throw new BusinessConflictException("parentId", "Cây đơn vị không được vượt quá 3 cấp");
            }
        }

        target.setCode(code);
        target.setName(name);
        target.setParentId(req.parentId());
        Department saved = departmentRepository.save(target);
        return DepartmentResponse.fromEntity(saved);
    }

    public DepartmentResponse deactivateDepartment(Long id) {
        Department target = departmentRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy đơn vị với ID: " + id));

        if (departmentRepository.existsByParentIdAndIsActiveTrue(id)) {
            throw new BusinessConflictException(null, "Không thể ngưng dùng đơn vị vì vẫn còn đơn vị trực thuộc đang hoạt động");
        }

        if (accountGrpcClient.hasActiveUsers(id)) {
            throw new BusinessConflictException(null, "Không thể ngưng dùng đơn vị vì vẫn còn tài khoản đang hoạt động");
        }

        target.setActive(false);
        Department saved = departmentRepository.save(target);
        return DepartmentResponse.fromEntity(saved);
    }

    private DepartmentTreeResponse buildTreeNode(Department d, Map<Long, List<Department>> childrenByParent) {
        List<Department> children = childrenByParent.getOrDefault(d.getId(), Collections.emptyList());
        List<DepartmentTreeResponse> childResponses = children.stream()
                .map(child -> buildTreeNode(child, childrenByParent))
                .toList();
        return new DepartmentTreeResponse(
                d.getId(),
                d.getCode(),
                d.getName(),
                d.getParentId(),
                d.isActive(),
                childResponses
        );
    }

    private int calculateDepth(Department dept, Map<Long, Department> byId) {
        int depth = 1;
        Set<Long> visited = new HashSet<>();
        visited.add(dept.getId());
        Long currParentId = dept.getParentId();
        while (currParentId != null) {
            if (!visited.add(currParentId)) {
                break;
            }
            Department parent = byId.get(currParentId);
            if (parent == null) {
                break;
            }
            depth++;
            currParentId = parent.getParentId();
        }
        return depth;
    }

    private int calculateSubtreeHeight(Long id, Map<Long, List<Department>> childrenByParent) {
        List<Department> children = childrenByParent.getOrDefault(id, Collections.emptyList());
        if (children.isEmpty()) {
            return 1;
        }
        int maxChildHeight = 0;
        for (Department child : children) {
            maxChildHeight = Math.max(maxChildHeight, calculateSubtreeHeight(child.getId(), childrenByParent));
        }
        return 1 + maxChildHeight;
    }
}
