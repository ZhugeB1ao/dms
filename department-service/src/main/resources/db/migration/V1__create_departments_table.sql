CREATE TABLE departments (
    id        BIGSERIAL    PRIMARY KEY,
    code      VARCHAR(50)  NOT NULL,
    name      VARCHAR(255) NOT NULL,
    parent_id BIGINT       REFERENCES departments(id),
    is_active BOOLEAN      NOT NULL DEFAULT TRUE,

    CONSTRAINT uq_departments_code UNIQUE (code),
    CONSTRAINT chk_departments_no_self_parent CHECK (parent_id IS NULL OR parent_id <> id)
);

CREATE INDEX idx_departments_parent_active ON departments (parent_id, is_active);

INSERT INTO departments (code, name, parent_id, is_active) VALUES
    ('BGH', 'Ban Giám hiệu', NULL, TRUE),
    ('HCNS', 'Phòng Hành chính - Nhân sự', 1, TRUE),
    ('CNTT', 'Khoa Công nghệ Thông tin', 1, TRUE),
    ('CNPM', 'Bộ môn Công nghệ Phần mềm', 3, TRUE);
