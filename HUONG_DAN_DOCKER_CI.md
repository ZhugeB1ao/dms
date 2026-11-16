# Docker, cấu hình môi trường và CI

Hướng dẫn chạy toàn bộ hệ thống bằng Docker, cấu hình bằng biến môi trường và quy trình CI. Cách chạy bằng `./start-dev.sh` xem [HUONG_DAN_CHAY_DEV.md](HUONG_DAN_CHAY_DEV.md). Kết nối và làm việc với database xem [HUONG_DAN_DB_CHUNG.md](HUONG_DAN_DB_CHUNG.md).

```
dms/
├── api-gateway/             Cổng vào duy nhất của FE        (:9090)
├── auth-service/            Đăng nhập, JWT                  (REST :8081, gRPC :9091)
├── account-service/         Tài khoản, mật khẩu             (REST :8084, gRPC :9092)
├── category-service/        Thể loại văn bản                (:8080)
├── department-service/      Phòng ban                       (:8082)
├── organization-service/    Cơ quan ban hành                (:8083)
├── front-end/               React 19 + Vite + TS            (:3000 Docker, :5173 dev)
├── config/checkstyle/       Luật lint Java dùng chung
├── docker-compose.yml       Chạy toàn bộ hệ thống (DB trên Neon)
└── .env.example             Mẫu cấu hình (thông tin Neon, copy thành .env)
```

**Stack:** Java 21, Spring Boot 4, JPA, Flyway, gRPC · React 19, Vite, TypeScript · PostgreSQL 16 trên Neon · MinIO (bucket `attachments`)

## Chạy toàn bộ bằng Docker

Chỉ cần **Docker Desktop** (đã bật) và thông tin Neon. Không cần cài Java hay Node.

```bash
git clone <repo> && cd dms
cp .env.example .env             # điền DB_HOST, DB_USERNAME, DB_PASSWORD
docker compose up -d --build     # lần đầu ~5-10 phút (tải image + dependency Maven)
docker compose ps                # dms-minio-init "Exited (0)" là bình thường
```

Mở http://localhost:3000, đăng nhập `admin` / `Admin@123`.

| Thành phần | Địa chỉ |
|---|---|
| Front-end | http://localhost:3000 |
| API Gateway | http://localhost:9090/api |
| auth / account / category / department / organization | `localhost:8081` / `8084` / `8080` / `8082` / `8083` |
| MinIO console | http://localhost:9001 (`minioadmin` / `minioadmin`) |
| PostgreSQL | Neon, host `DB_HOST` trong `.env` (xem [HUONG_DAN_DB_CHUNG.md](HUONG_DAN_DB_CHUNG.md)) |

Tài khoản mẫu: `admin` / `Admin@123`, `manager` / `Manager@123`, `employee1` / `Employee@123`.

`docker compose` và `./start-dev.sh` dùng chung cổng, **chỉ chạy một cách tại một thời điểm** (`docker compose down` trước khi chạy `start-dev.sh`, và ngược lại `./start-dev.sh stop`).

## Database

- Database nằm trên **Neon**, không chạy Postgres trong Docker. Bắt buộc có `.env` với `DB_HOST`, `DB_USERNAME`, `DB_PASSWORD`; thiếu thì `docker compose` báo lỗi ngay.
- Mỗi service một database, **không query sang database của service khác**. Cần dữ liệu thì gọi API hoặc gRPC.
- Bảng được tạo **tự động khi service khởi động**: Flyway (category, department, organization), Hibernate `ddl-auto=update` (auth, account).
- `docker compose` và `./start-dev.sh` cùng đọc `.env`, nên dùng chung một database. Chi tiết ở [HUONG_DAN_DB_CHUNG.md](HUONG_DAN_DB_CHUNG.md).

## Cấu hình

Mọi cấu hình đọc từ biến môi trường, đặt trong `.env` (không commit). Ngoài 3 biến database, không đặt gì thì dùng giá trị dev mặc định.

| Biến | Dùng cho | Mặc định |
|---|---|---|
| `DB_HOST` | Host Neon (endpoint direct, không có `-pooler`) | **bắt buộc** |
| `DB_USERNAME`, `DB_PASSWORD` | Tài khoản Neon của các service | **bắt buộc** |
| `JWT_SECRET_KEY` | Khóa ký JWT (tối thiểu 64 ký tự). **Môi trường thật bắt buộc đặt mới** | giá trị dev |
| `GATEWAY_SHARED_SECRET` | Secret giữa gateway và các service | giá trị dev |
| `MINIO_ROOT_USER`, `MINIO_ROOT_PASSWORD`, `MINIO_BUCKET` | MinIO | `minioadmin` / `minioadmin`, `attachments` |

Không commit `.env` và không ghi mật khẩu vào repo.

## Lệnh thường dùng

```bash
docker compose logs -f auth-service           # xem log
docker compose up -d --build auth-service     # build lại sau khi sửa code
docker compose down                           # tắt, giữ dữ liệu
docker compose down -v                        # tắt và XÓA dữ liệu MinIO (DB trên Neon không bị ảnh hưởng)
```

## CI và quy trình merge

GitHub Actions ([.github/workflows/ci.yml](.github/workflows/ci.yml)) chạy trên mọi pull request:

| Job | Làm gì |
|---|---|
| Backend (mỗi service) | Lint (Checkstyle), test (H2, không cần Postgres), build |
| Frontend | `npm run lint`, `format:check`, `test`, `build` |
| Docker (7 image) | Build thử Dockerfile; push vào `main` thì đẩy image lên GHCR |
| CI passed | Chỉ xanh khi mọi job trên pass |

Chạy lại trên máy trước khi mở PR:

```bash
cd <service> && ./mvnw checkstyle:check -Dcheckstyle.config.location=../config/checkstyle/checkstyle.xml && ./mvnw test
cd front-end && npm run check
```

Nhánh `main` được bảo vệ: phải qua pull request, check **CI passed** xanh và có **1 người review** mới merge được.

### Bật bảo vệ nhánh (admin repo, làm một lần)

Sau khi CI đã chạy ít nhất một lần (để GitHub biết tên check): Settings → Branches → Add branch ruleset (hoặc Add rule) cho `main`:

1. Bật **Require a pull request before merging**, **Required approvals** = 1.
2. Bật **Require status checks to pass**, chọn check **CI passed**.
3. Bật **Require branches to be up to date before merging** (khuyên dùng).
