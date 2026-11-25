-- ==============================================================================
-- Sửa quyền sở hữu bảng trên Neon cho mô hình: nhóm dms_owner + mỗi thành viên một role.
--
-- Lỗi cần sửa: "permission denied for table ..." khi người này chạy service mà bảng
-- do người khác tạo (bảng thuộc role cá nhân thay vì nhóm dms_owner).
--
-- Chạy trong Neon Console → SQL Editor, bằng role neondb_owner (hoặc role đang sở hữu
-- bảng, ví dụ baohuy). Chạy lại nhiều lần không sao.
-- Phần 1 chạy MỘT LẦN cho mỗi database: chọn database trong SQL Editor rồi chạy lại,
-- lần lượt auth_db, account_db, category_db, department_db, organization_db, document_db.
-- ==============================================================================

-- 1. Chuyển mọi bảng/sequence do các thành viên tạo về nhóm chung (chạy trong TỪNG database)
DO $$
DECLARE m text;
BEGIN
  FOREACH m IN ARRAY ARRAY['baohuy', 'giabao', 'quocviet', 'kimanh'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = m) THEN
      EXECUTE format('REASSIGN OWNED BY %I TO dms_owner', m);
    END IF;
  END LOOP;
END $$;

-- 2. Từ nay mọi thành viên khi kết nối sẽ tự chuyển sang role dms_owner, nên bảng mới
--    do Flyway/Hibernate tạo luôn thuộc nhóm chung (chỉ cần chạy ở MỘT database).
DO $$
DECLARE m text; d text;
BEGIN
  FOREACH m IN ARRAY ARRAY['baohuy', 'giabao', 'quocviet', 'kimanh'] LOOP
    CONTINUE WHEN NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = m);
    FOREACH d IN ARRAY ARRAY['auth_db', 'account_db', 'category_db', 'department_db', 'organization_db', 'document_db'] LOOP
      EXECUTE format('ALTER ROLE %I IN DATABASE %I SET role = dms_owner', m, d);
    END LOOP;
  END LOOP;
END $$;

-- Kiểm tra: mọi bảng phải có tableowner = dms_owner
SELECT current_database() AS db, tablename, tableowner FROM pg_tables WHERE schemaname = 'public' ORDER BY 1, 2;
