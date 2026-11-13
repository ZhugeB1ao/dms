# Staging DMS

Môi trường staging dùng chung cho cả nhóm và Tester. Mỗi khi code được merge vào `main`,
staging tự cập nhật sang bản mới trong vài phút.

## Kiến trúc

```
Trình duyệt → https://<địa-chỉ-staging>   (Cloudflare Access: chỉ email trong danh sách)
   → Cloudflare Tunnel → máy chạy staging → 127.0.0.1:8888
   → front-end (Nginx)
        ├─ "/"      → giao diện React
        └─ "/api/…" → api-gateway → auth / account / category / department / organization
                                       → postgres (1 container, 5 database) + minio
```

- Chỉ `front-end` mở cổng, và chỉ ở `127.0.0.1`. Postgres, MinIO, gateway và các service
  không mở cổng nào ra ngoài.
- Frontend và API dùng chung một địa chỉ (Nginx chuyển `/api` sang gateway), nên không cần
  URL riêng cho backend và không phải xử lý CORS.

## Luồng CD (kiểu "kéo")

```
Merge vào main → GitHub Actions (.github/workflows/ci.yml): lint, test
   → xanh: build image từng service → đẩy lên ghcr.io/<owner>/dms-<service>:latest và :sha-xxxxxxx
   → máy staging: staging-update.sh chạy mỗi 2 phút → docker compose pull → up -d
```

- CI đỏ thì không có image mới, staging giữ nguyên bản cũ.
- GitHub không cần kết nối vào máy staging (không SSH, không mở cổng), nên không cần lưu
  SSH key hay mật khẩu server trên GitHub.

## Các file

| File | Vai trò |
|---|---|
| `docker-compose.yml` | Chạy staging bằng image kéo từ GHCR |
| `staging-init/01-create-databases.sql` | Tạo 5 database trong lần chạy đầu (volume còn trống) |
| `.env.staging.example` | Mẫu biến môi trường. Bản thật `.env.staging` **không commit** |
| `staging-update.sh` | Kéo image mới và khởi động lại service có thay đổi |
| `com.dms.staging-update.plist.example` | Tác vụ hẹn giờ macOS (launchd) chạy script mỗi 2 phút |

## Dựng staging lần đầu

Yêu cầu: Docker (Docker Desktop trên macOS, bật Rosetta nếu máy chip Apple vì CI build
image `linux/amd64`), tối thiểu 6 GB RAM cho Docker.

```bash
cd deploy/staging

# 1. Tạo file secret (mỗi giá trị khác môi trường dev)
cat > .env.staging <<EOF
POSTGRES_USER=dms
POSTGRES_PASSWORD=$(openssl rand -hex 24)
JWT_SECRET_KEY=$(openssl rand -hex 32)
GATEWAY_SHARED_SECRET=$(openssl rand -hex 32)
MINIO_ROOT_USER=dms-minio
MINIO_ROOT_PASSWORD=$(openssl rand -hex 24)
MINIO_BUCKET=attachments
STAGING_ORIGIN=https://<địa-chỉ-staging>
FRONTEND_PORT=8888
EOF
chmod 600 .env.staging

# 2. Nếu image trên GHCR để private: đăng nhập bằng token chỉ có quyền read:packages
echo "<token>" | docker login ghcr.io -u <github-username> --password-stdin

# 3. Chạy thử một lần
bash staging-update.sh
tail -20 logs/update.log
docker compose -f docker-compose.yml --env-file .env.staging ps
```

Sau 1-2 phút (các service Java khởi động), mở địa chỉ staging và đăng nhập.

## Bật tự cập nhật (macOS)

```bash
sed "s#/DUONG/DAN/TOI/deploy/staging#$(pwd)#g" com.dms.staging-update.plist.example \
  > ~/Library/LaunchAgents/com.dms.staging-update.plist
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.dms.staging-update.plist
launchctl list | grep com.dms.staging-update
```

Tắt: `launchctl bootout gui/$(id -u)/com.dms.staging-update`

Trên Linux dùng cron: `*/2 * * * * /duong/dan/toi/deploy/staging/staging-update.sh`

## Vận hành

```bash
cd deploy/staging
DC="docker compose -f docker-compose.yml --env-file .env.staging"
```

| Việc | Lệnh |
|---|---|
| Xem trạng thái | `$DC ps` |
| Xem log một service | `$DC logs -f --tail 100 auth-service` |
| Khởi động lại một service | `$DC restart auth-service` |
| Tắt (giữ dữ liệu) | `$DC down` |
| Tắt và **xoá sạch dữ liệu** | `$DC down -v` (cẩn thận) |
| Sao lưu DB | `$DC exec postgres sh -c 'pg_dumpall -U "$POSTGRES_USER"' > backup-$(date +%F).sql` |
| Quay về bản cũ | Thêm `IMAGE_TAG=sha-xxxxxxx` vào `.env.staging`, chạy lại `staging-update.sh` |
| Xem lịch sử cập nhật | `tail -50 logs/update.log` |

## Dữ liệu mẫu

Tự tạo khi khởi động lần đầu, không cần nhập tay:

| Loại | Nguồn |
|---|---|
| 3 role và tài khoản mẫu (admin, manager, employee1, employee2, demo_hsu) | `account-service` DataSeeder (`APP_SEED_ENABLED=true`) |
| 4 phòng ban | Flyway `department-service` V1 |
| 12 danh mục | Flyway `category-service` V1 |
| 3 cơ quan ban hành | Flyway `organization-service` V1 |

Mật khẩu tài khoản mẫu đã công khai trong repo, chỉ dùng cho staging.

## Quản lý secret

| Secret | Lưu ở đâu |
|---|---|
| Mật khẩu DB, `JWT_SECRET_KEY`, `GATEWAY_SHARED_SECRET`, mật khẩu MinIO | `.env.staging` trên máy staging (quyền 600, không commit) |
| Token Cloudflare Tunnel | Dịch vụ `cloudflared` trên máy staging |
| Token kéo image GHCR (nếu private) | Keychain/credential store của Docker trên máy staging |
| Token đẩy image lên GHCR | `GITHUB_TOKEN` do GitHub Actions tự cấp |

Nghi lộ secret: tạo giá trị mới bằng `openssl rand -hex 32`, sửa `.env.staging`, chạy lại
`$DC up -d`. Riêng `POSTGRES_PASSWORD` phải đổi trong Postgres (`ALTER USER`) trước.

## Lưu ý

- Dùng chung tên project `dms-staging` với cấu hình build tại chỗ trước đây, nên dữ liệu
  (volume `dms-staging_postgres_data`, `dms-staging_minio_data`) được giữ nguyên khi chuyển.
- Thêm/bớt người truy cập: Cloudflare Zero Trust → Access controls → Policies → sửa danh sách Emails.
