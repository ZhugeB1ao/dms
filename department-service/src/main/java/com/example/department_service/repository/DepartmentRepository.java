package com.example.department_service.repository;

import com.example.department_service.entity.Department;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface DepartmentRepository extends JpaRepository<Department, Long> {

    List<Department> findAllByOrderByIdAsc();

    List<Department> findAllByIsActiveTrueOrderByIdAsc();

    boolean existsByCodeIgnoreCase(String code);

    boolean existsByCodeIgnoreCaseAndIdNot(String code, Long id);

    boolean existsByParentIdAndIsActiveTrue(Long parentId);
}
