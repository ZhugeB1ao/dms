package com.example.department_service.entity;

import jakarta.persistence.*;

@Entity
@Table(name = "departments")
public class Department {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 50, unique = true)
    private String code;

    @Column(nullable = false, length = 255)
    private String name;

    @Column(name = "parent_id")
    private Long parentId;

    @Column(name = "is_active", nullable = false)
    private boolean isActive = true;

    public Department() {
    }

    public Department(String code, String name, Long parentId) {
        this.code = code;
        this.name = name;
        this.parentId = parentId;
        this.isActive = true;
    }

    public Department(Long id, String code, String name, Long parentId, boolean isActive) {
        this.id = id;
        this.code = code;
        this.name = name;
        this.parentId = parentId;
        this.isActive = isActive;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getCode() {
        return code;
    }

    public void setCode(String code) {
        this.code = code;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public Long getParentId() {
        return parentId;
    }

    public void setParentId(Long parentId) {
        this.parentId = parentId;
    }

    public boolean isActive() {
        return isActive;
    }

    public void setActive(boolean active) {
        isActive = active;
    }
}
