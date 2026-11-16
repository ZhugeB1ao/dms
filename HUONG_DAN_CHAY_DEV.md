# Hướng Dẫn Khởi Chạy Môi Trường Phát Triển Cục Bộ (Dev Environment)

Tài liệu này hướng dẫn cách khởi chạy toàn bộ hệ thống (Frontend + 6 Backend Microservices; Database trên Neon) bằng **1 lệnh duy nhất** thông qua script `start-dev.sh` đặt tại thư mục `docs/`.

---

## 1. Tổng Quan Kiến Trúc Khi Chạy Dev

Hệ thống được thiết kế theo tiêu chí **nhẹ - mát máy - khởi động nhanh**:
- **Chạy trên Host (Java 21 / Node.js)**: Không đóng gói ứng dụng vào Docker. Toàn bộ 6 microservice chạy trực tiếp bằng OpenJDK 21 với cờ giới hạn RAM `-Xmx256m -Xms64m`, giúp tiết kiệm tối đa tài nguyên máy.
- **Database trên Neon** (PostgreSQL 16 cloud): không chạy Postgres trên máy, không cần Docker để chạy dev. Thông tin kết nối đặt trong `.env`, xem [HUONG_DAN_DB_CHUNG.md](HUONG_DAN_DB_CHUNG.md).
- **Tự trị 100% trong `docs/`**: Toàn bộ Frontend và Backend Services đều nằm trong thư mục `docs/`.
- **Loại trừ**: Tạm thời loại bỏ `file-service` (OCR), `ai-service` (RAG AI), MinIO, RabbitMQ và Qdrant để tránh tiêu tốn CPU/GPU/RAM.

```mermaid
flowchart TD
    subgraph Host ["Máy Cục Bộ (Host OS)"]
        FE["Frontend (React 19 / Vite)\n:5173"]
        GW["API Gateway (Spring Boot)\n:9090"]
        AUTH["Auth Service\nREST :8081 | gRPC :9091"]
        ACC["Account Service\nREST :8084 | gRPC :9092"]
        CAT["Category Service\n:8080"]
        DEPT["Department Service\n:8082"]
        ORG["Organization Service\n:8083"]
    end

    subgraph Neon ["Neon (PostgreSQL 16, branch dev)"]
        DB_AUTH["auth_db"]
        DB_ACC["account_db"]
        DB_CAT["category_db"]
        DB_DEPT["department_db"]
        DB_ORG["organization_db"]
    end

    FE -->|"/api/*"| GW
    GW --> AUTH & ACC & CAT & DEPT & ORG
    GW -->|gRPC :9091| AUTH
    AUTH <-->|gRPC :9091/:9092| ACC
    DEPT -->|gRPC :9092| ACC
    AUTH --> DB_AUTH
    ACC --> DB_ACC
    CAT --> DB_CAT
    DEPT --> DB_DEPT
    ORG --> DB_ORG
```

---

## 2. Bảng Phân Bổ Cổng & Cơ Sở Dữ Liệu

| Phân hệ | Cổng Service | Database (Neon, host `DB_HOST` trong `.env`) |
| :--- | :--- | :--- |
| **Frontend** | `http://localhost:5173` | — |
| **API Gateway** | `http://localhost:9090` | — |
| **Auth Service** | `http://localhost:8081` *(gRPC :9091)* | `auth_db` |
| **Account Service** | `http://localhost:8084` *(gRPC :9092)* | `account_db` |
| **Category Service** | `http://localhost:8080` | `category_db` |
| **Department Service** | `http://localhost:8082` | `department_db` |
| **Organization Service**| `http://localhost:8083` | `organization_db` |

---

## 3. Yêu Cầu Môi Trường (Prerequisites)

1. **Java Runtime**: OpenJDK 21 (Temurin, Microsoft, hoặc Oracle JDK 21). Script sẽ tự động nhận diện qua `/usr/libexec/java_home -v 21` trên macOS.
2. **Node.js & npm**: Node.js v20+ hoặc v22+.
3. **File `.env`** với thông tin Neon: `cp .env.example .env` rồi điền `DB_HOST`, `DB_USERNAME`, `DB_PASSWORD` (xin admin). Máy cần có Internet.

---

## 4. Các Lệnh Sử Dụng Chính

Toàn bộ lệnh được thực thi bên trong thư mục `docs/`:

```bash
cd docs
```

### 4.1. Khởi chạy toàn bộ hệ thống (Chạy 1 lần)
```bash
./start-dev.sh
```

**Quy trình script tự động xử lý**:
1. Kiểm tra môi trường Java 21, đọc `.env`.
2. Kiểm tra kết nối tới Neon (`DB_HOST:5432`).
3. Khởi động ngầm 6 dịch vụ Java bằng các gói JAR siêu nhẹ (hoặc qua Maven Spring Boot nếu chưa build).
4. Kiểm tra sức khỏe các cổng mạng (8080, 8081, 8082, 8083, 8084, 9090).
5. Khởi chạy Frontend Vite (`npm run dev`) ở foreground để bạn theo dõi log và mở trình duyệt tại `http://localhost:5173`.

> [!NOTE]
> **Cách dừng**: Nhấn `Ctrl+C` tại cửa sổ terminal đang chạy script. Toàn bộ tiến trình Java và Frontend sẽ dừng lại an toàn ngay lập tức. Neon tự tắt compute sau vài phút không dùng.

---

### 4.2. Dừng toàn bộ hệ thống
Khi còn tiến trình chạy ngầm (ví dụ terminal bị đóng đột ngột):
```bash
./start-dev.sh stop
```
Lệnh này tắt các service Java và Frontend còn sót lại trên các cổng dev.

---

### 4.3. Kiểm tra trạng thái hệ thống
Xem kết nối tới Neon và các cổng dịch vụ đang lắng nghe:
```bash
./start-dev.sh status
```

---

### 4.4. Xem log chi tiết của từng service khi cần debug
Các file log được lưu tự động trong thư mục `docs/.logs/`. Bạn có thể theo dõi trực tiếp:
```bash
./start-dev.sh logs auth          # Theo dõi log auth-service
./start-dev.sh logs account       # Theo dõi log account-service
./start-dev.sh logs category      # Theo dõi log category-service
./start-dev.sh logs department    # Theo dõi log department-service
./start-dev.sh logs organization  # Theo dõi log organization-service
./start-dev.sh logs gateway       # Theo dõi log api-gateway
```

---

### 4.5. Đóng gói lại các gói JAR (Khi có chỉnh sửa code Backend)
Nếu bạn thay đổi mã nguồn Java của bất kỳ microservice nào, hãy chạy lệnh sau để build lại các file `.jar`:
```bash
./start-dev.sh build
```
Khi có file `.jar` trong thư mục `target/`, script sẽ tự động kích hoạt chế độ chạy siêu tốc `java -jar` thay vì thông qua Maven daemon.

---

## 5. Tài Khoản Đăng Nhập Mẫu

`auth-service` và `account-service` đã được kích hoạt tính năng seed dữ liệu mẫu (`APP_SEED_ENABLED=true`), bạn có thể đăng nhập ngay trên giao diện Frontend:

| Vai trò (Role) | Username | Password | Quyền hạn |
| :--- | :--- | :--- | :--- |
| **Quản trị viên (ADMIN)** | `admin` | `Admin@123` | Toàn quyền quản trị tài khoản, danh mục, phòng ban, cơ quan |
| **Trưởng phòng (MANAGER)** | `manager` | `Manager@123` | Quản lý theo phạm vi phòng ban |
| **Chuyên viên (EMPLOYEE)** | `employee1` | `Employee@123` | Tra cứu và lập văn bản |

---

## 6. Xử Lý Sự Cố Thường Gặp (Troubleshooting)

1. **Bị báo lỗi cổng bị chiếm (Port already in use)**:
   - Hãy chạy:
     ```bash
     ./start-dev.sh stop
     ```
     Script sẽ tự động tìm và kill các process tồn đọng trên các cổng 8080, 8081, 8082, 8083, 8084, 9090, 5173.
2. **Không kết nối được cơ sở dữ liệu**:
   - Chạy `./start-dev.sh status` để kiểm tra có kết nối được tới `DB_HOST` không.
   - `password authentication failed`: sai `DB_USERNAME` / `DB_PASSWORD` trong `.env`.
   - `database "xxx_db" does not exist`: database chưa được tạo trên branch Neon đó, báo admin.
   - Flyway treo hoặc lỗi lock: `DB_HOST` đang là endpoint có `-pooler`, đổi sang host không có `-pooler`.
   - Chi tiết: [HUONG_DAN_DB_CHUNG.md](HUONG_DAN_DB_CHUNG.md).
3. **Frontend báo lỗi kết nối mạng**:
   - Kiểm tra xem `api-gateway` (port 9090) hoặc các service thành phần đã sẵn sàng chưa bằng lệnh `./start-dev.sh logs gateway`.
