# Kết nối và làm việc với Database (Neon)

Toàn bộ database của DMS nằm trên **[Neon](https://neon.tech)** (PostgreSQL 16 trên cloud). Không còn chạy Postgres trong Docker.

| Việc | Ở đâu |
|---|---|
| Tạo database, role | Neon Console (làm một lần, xem [Dựng Neon lần đầu](#dựng-neon-lần-đầu-admin)) |
| Tạo, sửa bảng | `<service>/src/main/resources/db/migration/` (Flyway) |
| Kết nối (dev) | `.env` (copy từ [.env.example](.env.example)), dùng cho `./start-dev.sh` và `docker compose` |
| Kết nối (staging) | `deploy/staging/.env.staging` (copy từ [.env.staging.example](deploy/staging/.env.staging.example)) |

- Mỗi service một database, **không query sang database của service khác**. Cần dữ liệu thì gọi API hoặc gRPC.
- Service không tự tạo database, phải tạo trước trên Neon.

| Service | Database |
|---|---|
| auth-service | `auth_db` |
| account-service | `account_db` |
| category-service | `category_db` |
| department-service | `department_db` |
| organization-service | `organization_db` |

Cả 5 database nằm trên cùng một **branch** Neon. Dev và staging dùng **hai branch khác nhau** (`dev` và `staging`), mỗi branch có host riêng, nên dữ liệu thử ở dev không ảnh hưởng staging.

## Cấu hình kết nối

```env
# .env
DB_HOST=ep-xxxx-xxxx.ap-southeast-1.aws.neon.tech
DB_USERNAME=<tài khoản>
DB_PASSWORD=<mật khẩu>
```

Từ `DB_HOST`, các service tự ghép URL `jdbc:postgresql://<DB_HOST>/<tên>_db?sslmode=require`.

- **Dùng endpoint direct**, host **không** có `-pooler`. Flyway cần advisory lock theo session, mà pooler của Neon (PgBouncer, chế độ transaction) không hỗ trợ.
- Neon đưa chuỗi kết nối dạng `postgresql://user:pass@host/db`. Chỉ lấy phần **host** điền vào `DB_HOST`. Spring không nhận user/pass nằm trong URL.
- Neon tự tắt compute sau ~5 phút không có kết nối. Request đầu tiên sau đó chậm hơn ~1 giây, là bình thường. Pool Hikari của mỗi service đã được cấu hình không giữ kết nối rảnh (`minimum-idle=0`), để Neon tắt được và đỡ tốn giờ compute.

Chạy service trực tiếp từ IDE (không qua `./start-dev.sh`): đặt 3 biến môi trường `SPRING_DATASOURCE_URL`, `SPRING_DATASOURCE_USERNAME`, `SPRING_DATASOURCE_PASSWORD` trong Run Configuration.

### Kết nối và truy vấn

```bash
# Cần psql (brew install libpq) — đọc thông tin từ .env
set -a; . ./.env; set +a
psql "postgresql://$DB_USERNAME:$DB_PASSWORD@$DB_HOST/category_db?sslmode=require"
```

Hoặc dùng **SQL Editor** trong Neon Console (chọn branch, chọn database).

DBeaver / IntelliJ: host `DB_HOST`, port `5432`, database tương ứng, user/mật khẩu như `.env`, bật SSL (`sslmode=require`).

```sql
\l   \c category_db   \dt   \d categories        -- DB, đổi DB, bảng, cấu trúc bảng
SELECT * FROM flyway_schema_history;              -- migration đã chạy
```

## Tạo, sửa bảng (Flyway)

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
- **Không sửa bảng bằng tay** trên branch `dev` hoặc `staging`.
- Trùng số `V` với người khác thì đổi số trước khi mở PR.
- CI không chạy migration (test dùng H2), nên phải chạy service với Neon trước khi mở PR.

`auth-service` và `account-service` chưa dùng Flyway mà dùng `ddl-auto=update`: Hibernate tự thêm bảng/cột theo Entity khi khởi động, không xóa hay đổi kiểu cột cũ. Thử nghiệm Entity thì tạo **branch Neon riêng** (xem dưới), tránh để lại cột rác trên branch `dev` dùng chung.

### Branch riêng để thử nghiệm

Neon tạo branch gần như tức thì, có sẵn bản sao dữ liệu của branch cha. Neon Console → Branches → New branch → chọn branch cha `dev` → lấy host mới, điền vào `DB_HOST` trong `.env` của bạn. Thử xong thì xóa branch và trả `DB_HOST` về host của `dev`.

## Dựng Neon lần đầu (admin)

1. Tạo project tại https://console.neon.tech: **Postgres 16**, region **AWS Asia Pacific (Singapore)** (gần Việt Nam nhất).
2. **Roles** → New role, ví dụ `dms`. Lưu mật khẩu vào password manager.
3. **Databases** → New database, tạo 5 database ở bảng trên, owner là role `dms`.
4. **Branches** → New branch từ branch chính, tạo hai branch `dev` và `staging`. Branch con có sẵn role và database của branch cha.
5. Mỗi branch → **Connect** → tắt *Connection pooling* → lấy host:
   - host của `dev`: gửi cho thành viên (cùng user/mật khẩu) để điền vào `.env`
   - host của `staging`: điền vào `deploy/staging/.env.staging` trên máy staging

Bảng không cần tạo tay: Flyway và Hibernate tự tạo khi service khởi động lần đầu, `account-service` tự seed tài khoản mẫu.

**Thêm service mới cần database** (ví dụ `document_db`): làm trên **từng** branch `dev` và `staging`.

1. Vào Neon bằng một thành viên đã có role (ví dụ `baohuy`). Chọn một trong hai cách:
   - **SQL Editor** trong Neon Console: chọn branch, chọn database `neondb`.
   - **psql qua Docker** (không cần cài `psql`), host lấy từ `DB_HOST` của branch tương ứng, nhập mật khẩu khi được hỏi:

     ```bash
     docker run --rm -it postgres:18 psql "postgresql://<role>@<DB_HOST>/neondb?sslmode=require"
     ```

2. Tạo database với owner là nhóm chung:

   ```sql
   CREATE DATABASE document_db OWNER dms_owner;
   \q
   ```

3. Báo admin để admin gán cho từng thành viên tự chuyển sang `dms_owner` khi kết nối vào database này (thành viên chỉ làm front-end, không kết nối database, thì không cần):

   ```sql
   ALTER ROLE quocviet IN DATABASE document_db SET role = 'dms_owner';
   ALTER ROLE baohuy   IN DATABASE document_db SET role = 'dms_owner';
   ALTER ROLE giabao   IN DATABASE document_db SET role = 'dms_owner';
   ALTER ROLE kimanh   IN DATABASE document_db SET role = 'dms_owner';
   ```

4. Riêng branch `staging`, role của ứng dụng là `dms_app`:

   ```sql
   CREATE DATABASE document_db OWNER dms_owner;
   ALTER ROLE dms_app IN DATABASE document_db SET role = 'dms_owner';
   ```

5. Thêm `document_db` vào danh sách database trong [scripts/neon/fix-ownership.sql](scripts/neon/fix-ownership.sql), để lần chạy sau script cũng xử lý database mới.
6. Thêm `SPRING_DATASOURCE_URL: jdbc:postgresql://${DB_HOST}/document_db?sslmode=require` cho service đó trong `docker-compose.yml`, `deploy/staging/docker-compose.yml` và `start-dev.sh`.

**Thêm thành viên (mỗi người một role):** Neon đang dùng nhóm `dms_owner` (sở hữu 5 database) và mỗi thành viên một role (`baohuy`, `giabao`, `quocviet`, `kimanh`).

1. Tạo role cho người mới trong Neon Console → Roles, rồi chạy `GRANT dms_owner TO <role>;`.
2. Thêm tên role vào hai danh sách trong [scripts/neon/fix-ownership.sql](scripts/neon/fix-ownership.sql), rồi chạy script.

Script này làm hai việc. Thứ nhất, chuyển bảng hiện có về `dms_owner`. Thứ hai, đặt `SET role = dms_owner` cho từng thành viên, để bảng do Flyway/Hibernate tạo ra luôn thuộc nhóm chung.

> Gặp `permission denied for table ...` nghĩa là bảng đang thuộc role của người tạo ra nó, không thuộc nhóm. Chạy [scripts/neon/fix-ownership.sql](scripts/neon/fix-ownership.sql) bằng `neondb_owner` trong SQL Editor (phần 1 chạy ở từng database).

**Nghi lộ mật khẩu:** Neon Console → Roles → Reset password, rồi cập nhật `.env` / `.env.staging` và khởi động lại service.

## Chép dữ liệu cũ sang Neon (nếu cần)

Từ một Postgres cũ (ví dụ container Docker còn chạy) sang Neon, làm cho từng database:

```bash
# Nguồn: DB Docker cũ. Ví dụ auth_db ở cổng 5436
pg_dump -Fc -h localhost -p 5436 -U postgres auth_db > auth_db.dump

# Đích: Neon (đọc từ .env)
set -a; . ./.env; set +a
pg_restore --no-owner --no-acl --clean --if-exists \
  -d "postgresql://$DB_USERNAME:$DB_PASSWORD@$DB_HOST/auth_db?sslmode=require" auth_db.dump
```

Staging cũ: volume `dms-staging_postgres_data` vẫn còn trên máy staging, kể cả khi container `postgres` đã bị gỡ. Bật tạm một Postgres đọc volume đó rồi dump:

```bash
docker run -d --rm --name old-pg -v dms-staging_postgres_data:/var/lib/postgresql/data postgres:16-alpine
sleep 5
docker exec old-pg pg_dump -Fc -U <POSTGRES_USER cũ> auth_db > auth_db.dump   # lặp lại cho 4 database còn lại
docker stop old-pg
```

Chép dữ liệu khi service **chưa** chạy trên Neon, để tránh trùng dữ liệu seed. Dùng `pg_dump` 16 trở lên.

Không commit `.env` và không ghi mật khẩu vào repo.
