-- Chi chay MOT LAN khi volume postgres_data con trong (lan khoi dong dau tien).
-- Tao 6 database cho 6 service trong cung mot container Postgres.
-- Staging DA CHAY tu truoc (volume da co du lieu) se KHONG chay lai file nay:
-- tao tay database moi, xem muc "Them document-service" trong README.md.
CREATE DATABASE auth_db;
CREATE DATABASE account_db;
CREATE DATABASE category_db;
CREATE DATABASE department_db;
CREATE DATABASE organization_db;
CREATE DATABASE document_db;
