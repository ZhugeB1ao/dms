# Document Management System

## 🚀 Khởi Chạy Môi Trường Dev (Quick Start)

Toàn bộ hệ thống (Frontend + các dịch vụ Backend Java + Database PostgreSQL trên Docker) có thể khởi chạy bằng 1 lệnh duy nhất:

```bash
cd docs
./start-dev.sh
```

👉 **Xem hướng dẫn chi tiết đầy đủ tại**: [HOW_TO_RUN.md](./HOW_TO_RUN.md)

---

## Cấu Trúc Dự Án
- `front-end/`: Ứng dụng Frontend (React 19, TypeScript, Tailwind CSS, Vite)
- `category-service/`: Spring Boot Microservice quản lý thể loại văn bản (Port 8080)
- `department-service/`: Spring Boot Microservice quản lý phòng ban (Port 8082)
- `organization-service/`: Spring Boot Microservice quản lý cơ quan ban hành (Port 8083)

## Git Branching Conventions

All feature branches must follow the `feature/{feature}` naming pattern:
- `feature/fe`: Frontend application, UI components, and client-side integrations
- `feature/cate`: Category service backend and microservice management

