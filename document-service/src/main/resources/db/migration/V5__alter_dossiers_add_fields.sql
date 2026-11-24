ALTER TABLE dossiers ADD COLUMN code VARCHAR(50);
ALTER TABLE dossiers ADD COLUMN code_normalized VARCHAR(50);
ALTER TABLE dossiers ADD COLUMN dossier_year INT;
ALTER TABLE dossiers ADD COLUMN is_closed BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE dossiers
SET code = CONCAT('LEGACY-', id),
    code_normalized = LOWER(CONCAT('LEGACY-', id)),
    dossier_year = CAST(EXTRACT(YEAR FROM created_at) AS INTEGER)
WHERE code IS NULL OR code_normalized IS NULL OR dossier_year IS NULL;

ALTER TABLE dossiers ALTER COLUMN code SET NOT NULL;
ALTER TABLE dossiers ALTER COLUMN code_normalized SET NOT NULL;
ALTER TABLE dossiers ALTER COLUMN dossier_year SET NOT NULL;

ALTER TABLE dossiers ADD CONSTRAINT uq_dossiers_dept_year_code UNIQUE (department_id, dossier_year, code_normalized);
CREATE INDEX idx_dossiers_dept_year ON dossiers (department_id, dossier_year);
