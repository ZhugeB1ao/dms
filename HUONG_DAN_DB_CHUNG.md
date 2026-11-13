# Kết nối và làm việc với Database

## Database

| Việc | Ở đâu |
|---|---|
| Tạo database (DB local) | [docker-compose.db.yml](docker-compose.db.yml), mỗi service một container Postgres, tự tạo khi volume trống |
| Tạo database (DB dùng chung) | [scripts/shared-db/init-dms-databases.sql](scripts/shared-db/init-dms-databases.sql), admin chạy |
| Tạo, sửa bảng | `<service>/src/main/resources/db/migration/` (Flyway) |
| Kết nối | `.env` (copy từ [.env.example](.env.example)), `docker-compose.yml` |

- Mỗi service một database, **không query sang database của service khác**. Cần dữ liệu thì gọi API hoặc gRPC.
- Service không tự tạo database, phải tạo trước.

| Service | Database | DB local | DB dùng chung |
|---|---|---|---|
| category-service | `category_db` | `localhost:5433` | `100.67.250.1:5432` |
| department-service | `department_db` | `localhost:5434` | `100.67.250.1:5432` |
| organization-service | `organization_db` | `localhost:5435` | `100.67.250.1:5432` |
| auth-service | `auth_db` | `localhost:5436` | `100.67.250.1:5432` |
| account-service | `account_db` | `localhost:5437` | `100.67.250.1:5432` |

### Kết nối và truy vấn

```bash
# Postgres local (mỗi database một container)
docker exec -it dms-category-postgres psql -U postgres -d category_db
docker exec -it dms-auth-postgres psql -U postgres -d auth_db
```

Postgres dùng chung: xem [Dùng Postgres dùng chung (Tailscale)](#dùng-postgres-dùng-chung-tailscale).

DBeaver / IntelliJ (DB local): `localhost:<port ở bảng trên>`, user `postgres`, mật khẩu theo `docker-compose.db.yml`, database tương ứng.

```sql
\l   \c category_db   \dt   \d categories        -- DB, đổi DB, bảng, cấu trúc bảng
SELECT * FROM flyway_schema_history;              -- migration đã chạy
```

> DB local mỗi container chỉ có một database, muốn xem DB khác thì kết nối vào container khác. Trên DB dùng chung cả 5 database nằm chung một server, dùng `\c` để chuyển.

### Tạo, sửa bảng (Flyway)

Áp dụng cho `category-service`, `department-service`, `organization-service`. Tạo file `V<số>__<mô_tả>.sql` trong `db/migration/`, rồi sửa Entity cho khớp. Flyway tự chạy khi service khởi động.

```sql
-- category-service/src/main/resources/db/migration/V2__add_description_to_categories.sql
ALTER TABLE categories ADD COLUMN description VARCHAR(500);
```

```java
@Column(length = 500)
private String description;
```

- `ddl-auto=validate`: Entity không khớp bảng thì service không chạy.
- **Không sửa migration đã merge**, tạo file `V` mới (sửa file cũ sẽ gây lỗi `checksum mismatch`).
- **Không sửa bảng bằng tay** trên DB dùng chung.
- Trùng số `V` với người khác thì đổi số trước khi mở PR.
- CI không chạy migration (test dùng H2), nên phải chạy service với Postgres thật trước khi mở PR.

`auth-service` và `account-service` chưa dùng Flyway mà dùng `ddl-auto=update`: Hibernate tự thêm bảng/cột theo Entity khi khởi động, không xóa hay đổi kiểu cột cũ. Thử nghiệm Entity thì chạy với DB local, tránh để lại cột rác trên DB dùng chung.

Host của DB theo nơi chạy:

| Chạy ở | Host trong URL |
|---|---|
| IDE / `./start-dev.sh` | `localhost:<5433–5437>` |
| Docker Compose | `<tên>-postgres:5432` (vd. `category-postgres`) |
| DB dùng chung | `100.67.250.1:5432` |

## Dùng Postgres dùng chung (Tailscale)

Máy bạn phải đăng nhập tailnet của nhóm. Kiểm tra trước:

```bash
tailscale ping 100.67.250.1
nc -zv 100.67.250.1 5432
```

`cp .env.example .env`, điền tài khoản được cấp, **mỗi service một dòng URL**:

```env
DB_USERNAME=<tài khoản>
DB_PASSWORD=<mật khẩu>
AUTH_DB_URL=jdbc:postgresql://100.67.250.1:5432/auth_db
ACCOUNT_DB_URL=jdbc:postgresql://100.67.250.1:5432/account_db
CATEGORY_DB_URL=jdbc:postgresql://100.67.250.1:5432/category_db
DEPARTMENT_DB_URL=jdbc:postgresql://100.67.250.1:5432/department_db
ORGANIZATION_DB_URL=jdbc:postgresql://100.67.250.1:5432/organization_db
```

Rồi chạy `docker compose up -d --build` (`./start-dev.sh` không đọc `.env`, luôn dùng DB local). Muốn quay lại DB local thì xóa file `.env`.

DB dùng chung chỉ truy cập được khi máy chủ DB đang bật Docker và Tailscale. Database trên DB dùng chung không tự được tạo, service mới phải tạo database theo các bước dưới.

### Tạo database và bảng trên DB dùng chung (dev)

**1. Tạo lại container** (trên máy chủ DB, trong thư mục `postgres-shared`)

```bash
docker compose up -d
docker compose ps
```

**2. Tạo database và cấp quyền cho cả nhóm** (admin chạy, từ thư mục `dms`)

```bash
docker exec -i postgres-shared psql -U app_admin -d appdb -v ON_ERROR_STOP=1 \
  < scripts/shared-db/init-dms-databases.sql
```

Script tạo 5 database ở bảng trên và cấp quyền cho `baohuy`, `giabao`, `giahuy`, `kimanh`. Chạy lại nhiều lần không sao. Bảng do ai tạo cũng thuộc role chung `dms_owner`, nên thành viên khác vẫn sửa được.

**3. Vào DB để tương tác**

```bash
psql "postgresql://<role>:<mật_khẩu>@100.67.250.1:5432/category_db"
```

**4. Thêm database cho service mới**

Thêm tên database (vd. `document_db`) vào hai danh sách database trong `scripts/shared-db/init-dms-databases.sql`, chạy lại bước 2.

Sau đó thêm `<TÊN>_DB_URL=jdbc:postgresql://100.67.250.1:5432/<tên>_db` vào `.env.example`. Bảng do Flyway của service tạo khi service khởi động.

**Thêm thành viên mới:** tạo role rồi thêm tên vào hai danh sách thành viên trong script, chạy lại bước 2.

```sql
-- docker compose exec postgres psql -U app_admin -d appdb
CREATE ROLE ten_thanh_vien LOGIN PASSWORD 'mat_khau_rieng';
```

Không commit `.env` và không ghi mật khẩu vào repo.
