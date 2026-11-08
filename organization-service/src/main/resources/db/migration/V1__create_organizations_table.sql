CREATE TABLE organizations (
    id        BIGSERIAL    PRIMARY KEY,
    name      VARCHAR(255) NOT NULL,
    address   VARCHAR(500),
    email     VARCHAR(255),
    is_active BOOLEAN      NOT NULL DEFAULT TRUE,
    CONSTRAINT uq_organizations_name UNIQUE (name)
);

CREATE INDEX idx_organizations_active ON organizations (is_active);

INSERT INTO organizations (name, address, email, is_active) VALUES
    ('Bộ Giáo dục và Đào tạo', '35 Đại Cồ Việt, Hai Bà Trưng, Hà Nội', 'bogddt@moet.gov.vn', TRUE),
    ('Sở Giáo dục và Đào tạo TP.HCM', '66-68 Lê Thánh Tôn, Quận 1, TP.HCM', 'vanthu.sgddt@tphcm.gov.vn', TRUE),
    ('Ủy ban Nhân dân TP.HCM', '86 Lê Thánh Tôn, Quận 1, TP.HCM', 'ubnd@tphcm.gov.vn', TRUE);
