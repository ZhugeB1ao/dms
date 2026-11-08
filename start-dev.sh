#!/usr/bin/env bash
# ==============================================================================
# HSU Document Management System - Runner Script Môi Trường Dev Cục Bộ
# Khởi chạy: FE (Vite) + 6 Microservices (Java/Spring Boot) + 5 Databases (Docker)
# Loại trừ: OCR (file-service) & AI (ai-service) để tối ưu RAM/CPU.
# Toàn bộ dịch vụ chạy 100% trong thư mục docs/ độc lập.
# ==============================================================================

set -eo pipefail

DOCS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_DIR="$DOCS_DIR/.logs"
PID_FILE="$LOG_DIR/dev.pids"
COMPOSE_FILE="$DOCS_DIR/docker-compose.db.yml"

# Màu hiển thị console
CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BOLD='\033[1m'
NC='\033[0m' # No Color

mkdir -p "$LOG_DIR"

# ------------------------------------------------------------------------------
# 1. Phát hiện Java 21
# ------------------------------------------------------------------------------
setup_java() {
  if [ -x "/usr/libexec/java_home" ]; then
    local j21
    j21="$(/usr/libexec/java_home -v 21 2>/dev/null || true)"
    if [ -n "$j21" ]; then
      export JAVA_HOME="$j21"
      export PATH="$JAVA_HOME/bin:$PATH"
    fi
  fi

  if ! command -v java >/dev/null 2>&1; then
    echo -e "${RED}[LỖI] Không tìm thấy lệnh java trên máy. Vui lòng cài đặt OpenJDK 21.${NC}"
    exit 1
  fi

  local version
  version="$(java -version 2>&1 | awk -F '"' '/version/ {print $2}')"
  echo -e "${CYAN}→ Java Runtime:${NC} ${GREEN}${version}${NC} (JAVA_HOME=${JAVA_HOME:-system})"
}

# ------------------------------------------------------------------------------
# 2. Kiểm tra Docker Daemon
# ------------------------------------------------------------------------------
check_docker() {
  if ! docker info >/dev/null 2>&1; then
    echo -e "${YELLOW}[!] Docker daemon chưa khởi động.${NC}"
    if [ "$(uname)" = "Darwin" ]; then
      echo -e "${CYAN}→ Đang mở Docker Desktop trên macOS...${NC}"
      open -a Docker 2>/dev/null || true
      echo -n "Đang đợi Docker sẵn sàng"
      for i in {1..30}; do
        if docker info >/dev/null 2>&1; then
          echo -e " ${GREEN}OK${NC}"
          return 0
        fi
        echo -n "."
        sleep 1
      done
    fi
    echo -e "\n${RED}[LỖI] Không thể kết nối tới Docker API. Vui lòng bật Docker Desktop rồi chạy lại.${NC}"
    exit 1
  fi
}

# ------------------------------------------------------------------------------
# 3. Khởi động Databases qua Docker
# ------------------------------------------------------------------------------
start_databases() {
  echo -e "\n${BOLD}${CYAN}=== [1/3] KHỞI ĐỘNG CÁC DATABASE TRÊN DOCKER ===${NC}"
  docker compose -f "$COMPOSE_FILE" up -d

  echo -n "Đang kiểm tra kết nối PostgreSQL"
  local ports=(5433 5434 5435 5436 5437)
  for port in "${ports[@]}"; do
    for i in {1..20}; do
      if nc -z localhost "$port" 2>/dev/null; then
        break
      fi
      echo -n "."
      sleep 1
    done
  done
  echo -e " ${GREEN}SẴN SÀNG!${NC}"
  echo -e "  • category_db:     ${GREEN}localhost:5433${NC}"
  echo -e "  • department_db:   ${GREEN}localhost:5434${NC}"
  echo -e "  • organization_db: ${GREEN}localhost:5435${NC}"
  echo -e "  • auth_db:         ${GREEN}localhost:5436${NC}"
  echo -e "  • account_db:      ${GREEN}localhost:5437${NC}"
}

# ------------------------------------------------------------------------------
# 4. Chạy một service Java (dùng JAR nếu có để siêu nhẹ, fallback mvnw)
# ------------------------------------------------------------------------------
run_java_service() {
  local name="$1"
  local dir="$2"
  local log_file="$LOG_DIR/${name}.log"
  shift 2
  local env_vars=("$@")

  chmod +x "$dir/mvnw" 2>/dev/null || true

  local jar_file
  jar_file="$(find "$dir/target" -maxdepth 1 -name "*.jar" ! -name "*.original" 2>/dev/null | head -n 1 || true)"

  (
    cd "$dir"
    for e in "${env_vars[@]}"; do
      export "$e"
    done

    if [ -n "$jar_file" ] && [ -f "$jar_file" ]; then
      exec java -Xmx256m -Xms64m -XX:+UseG1GC -jar "$jar_file" > "$log_file" 2>&1
    else
      exec ./mvnw spring-boot:run -Dspring-boot.run.jvmArguments="-Xmx256m -Xms64m -XX:+UseG1GC" > "$log_file" 2>&1
    fi
  ) &
  local pid=$!
  echo "$pid" >> "$PID_FILE"
}

# ------------------------------------------------------------------------------
# 5. Khởi động 6 dịch vụ Backend Java (chạy trực tiếp trong docs/)
# ------------------------------------------------------------------------------
start_backend() {
  echo -e "\n${BOLD}${CYAN}=== [2/3] KHỞI ĐỘNG CÁC SERVICE BACKEND (JAVA) ===${NC}"
  : > "$PID_FILE"
  local gw_secret="${GATEWAY_SHARED_SECRET:-hsu-dev-gateway-secret-2026}"

  echo -e "  • Đang chạy ${BOLD}auth-service${NC} (Port 8081, gRPC 9091)..."
  run_java_service "auth" "$DOCS_DIR/auth-service" \
    "SERVER_PORT=8081" \
    "GRPC_SERVER_PORT=9091" \
    "ACCOUNT_GRPC_HOST=localhost" \
    "ACCOUNT_GRPC_PORT=9092" \
    "SPRING_DATASOURCE_URL=jdbc:postgresql://localhost:5436/auth_db" \
    "SPRING_DATASOURCE_USERNAME=postgres" \
    "SPRING_DATASOURCE_PASSWORD=Bao1234567890@" \
    "APPLICATION_JWT_SECRET_KEY=404E635266556A586E3272357538782F413F4428472B4B6250645367566B5970"

  echo -e "  • Đang chạy ${BOLD}account-service${NC} (Port 8084, gRPC 9092)..."
  run_java_service "account" "$DOCS_DIR/account-service" \
    "SERVER_PORT=8084" \
    "GRPC_SERVER_PORT=9092" \
    "AUTH_GRPC_HOST=localhost" \
    "AUTH_GRPC_PORT=9091" \
    "SPRING_DATASOURCE_URL=jdbc:postgresql://localhost:5437/account_db" \
    "SPRING_DATASOURCE_USERNAME=postgres" \
    "SPRING_DATASOURCE_PASSWORD=postgres" \
    "APP_SEED_ENABLED=true" \
    "APP_SECURITY_GATEWAY_SECRET=$gw_secret"

  echo -e "  • Đang chạy ${BOLD}category-service${NC} (Port 8080)..."
  run_java_service "category" "$DOCS_DIR/category-service" \
    "SERVER_PORT=8080" \
    "SPRING_DATASOURCE_URL=jdbc:postgresql://localhost:5433/category_db" \
    "SPRING_DATASOURCE_USERNAME=postgres" \
    "SPRING_DATASOURCE_PASSWORD=postgres" \
    "APP_SECURITY_MOCK_ENABLED=false" \
    "APP_SECURITY_GATEWAY_SECRET=$gw_secret"

  echo -e "  • Đang chạy ${BOLD}department-service${NC} (Port 8082)..."
  run_java_service "department" "$DOCS_DIR/department-service" \
    "SERVER_PORT=8082" \
    "SPRING_DATASOURCE_URL=jdbc:postgresql://localhost:5434/department_db" \
    "SPRING_DATASOURCE_USERNAME=postgres" \
    "SPRING_DATASOURCE_PASSWORD=postgres" \
    "APP_SECURITY_MOCK_ENABLED=false" \
    "APP_SECURITY_GATEWAY_SECRET=$gw_secret" \
    "APP_ACCOUNT_GRPC_ENABLED=true" \
    "APP_ACCOUNT_GRPC_HOST=localhost" \
    "APP_ACCOUNT_GRPC_PORT=9092"

  echo -e "  • Đang chạy ${BOLD}organization-service${NC} (Port 8083)..."
  run_java_service "organization" "$DOCS_DIR/organization-service" \
    "SERVER_PORT=8083" \
    "SPRING_DATASOURCE_URL=jdbc:postgresql://localhost:5435/organization_db" \
    "SPRING_DATASOURCE_USERNAME=postgres" \
    "SPRING_DATASOURCE_PASSWORD=postgres" \
    "APP_SECURITY_MOCK_ENABLED=false" \
    "APP_SECURITY_GATEWAY_SECRET=$gw_secret"

  echo -e "  • Đang chạy ${BOLD}api-gateway${NC} (Port 9090)..."
  run_java_service "gateway" "$DOCS_DIR/api-gateway" \
    "SERVER_PORT=9090" \
    "AUTH_SERVICE_URL=http://localhost:8081" \
    "ACCOUNT_SERVICE_URL=http://localhost:8084" \
    "CATEGORY_SERVICE_URL=http://localhost:8080" \
    "DEPARTMENT_SERVICE_URL=http://localhost:8082" \
    "ORGANIZATION_SERVICE_URL=http://localhost:8083" \
    "AUTH_GRPC_HOST=localhost" \
    "AUTH_GRPC_PORT=9091" \
    "GATEWAY_SHARED_SECRET=$gw_secret"

  echo -n "Đang đợi các service backend lắng nghe cổng"
  local sv_ports=(8080 8081 8082 8083 8084 9090)
  for port in "${sv_ports[@]}"; do
    for i in {1..35}; do
      if nc -z localhost "$port" 2>/dev/null; then
        break
      fi
      echo -n "."
      sleep 1
    done
  done
  echo -e " ${GREEN}HOÀN TẤT!${NC}"
}

# ------------------------------------------------------------------------------
# 6. Dọn dẹp tiến trình khi dừng
# ------------------------------------------------------------------------------
cleanup() {
  echo -e "\n${YELLOW}→ Đang dừng các service Java & Frontend...${NC}"
  if [ -f "$PID_FILE" ]; then
    while IFS= read -r pid; do
      if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
        kill "$pid" 2>/dev/null || true
      fi
    done < "$PID_FILE"
    rm -f "$PID_FILE"
  fi

  # Dọn dẹp triệt để các process con trên cổng dev
  for port in 8080 8081 8082 8083 8084 9090 5173; do
    local p
    p="$(lsof -t -i :"$port" 2>/dev/null || true)"
    if [ -n "$p" ]; then
      kill "$p" 2>/dev/null || true
    fi
  done

  echo -e "${GREEN}✓ Đã dừng toàn bộ service thành công.${NC}"
  echo -e "${CYAN}Lưu ý: Các container Database trong Docker vẫn đang chạy ngầm để lần sau bật nhanh.${NC}"
  echo -e "Muốn tắt hẳn Database Docker, hãy chạy: ${BOLD}./start-dev.sh stop${NC}\n"
}

# ------------------------------------------------------------------------------
# 7. Khởi động Frontend và gắn cờ Trap
# ------------------------------------------------------------------------------
start_frontend() {
  trap cleanup SIGINT SIGTERM EXIT

  echo -e "\n${BOLD}${CYAN}=== [3/3] KHỞI ĐỘNG FRONTEND (REACT 19 / VITE) ===${NC}"
  echo -e "${GREEN}┌──────────────────────────────────────────────────────────────┐${NC}"
  echo -e "${GREEN}│${NC} ${BOLD}HỆ THỐNG ĐÃ SẴN SÀNG HOẠT ĐỘNG!${NC}                              ${GREEN}│${NC}"
  echo -e "${GREEN}├──────────────────────────────────────────────────────────────┤${NC}"
  echo -e "${GREEN}│${NC} • Frontend UI:       ${CYAN}http://localhost:5173${NC}                    ${GREEN}│${NC}"
  echo -e "${GREEN}│${NC} • API Gateway:       ${CYAN}http://localhost:9090${NC}                    ${GREEN}│${NC}"
  echo -e "${GREEN}│${NC} • Auth Service:      ${CYAN}http://localhost:8081${NC} (gRPC :9091)       ${GREEN}│${NC}"
  echo -e "${GREEN}│${NC} • Account Service:   ${CYAN}http://localhost:8084${NC} (gRPC :9092)       ${GREEN}│${NC}"
  echo -e "${GREEN}│${NC} • Category Service:  ${CYAN}http://localhost:8080${NC}                    ${GREEN}│${NC}"
  echo -e "${GREEN}│${NC} • Department Service:${CYAN}http://localhost:8082${NC}                    ${GREEN}│${NC}"
  echo -e "${GREEN}│${NC} • Org Service:       ${CYAN}http://localhost:8083${NC}                    ${GREEN}│${NC}"
  echo -e "${GREEN}│${NC}                                                              ${GREEN}│${NC}"
  echo -e "${GREEN}│${NC} ${YELLOW}Tài khoản test (seed sẵn):${NC}                                   ${GREEN}│${NC}"
  echo -e "${GREEN}│${NC}   - Admin:    ${BOLD}admin${NC}     / ${BOLD}Admin@123${NC}                         ${GREEN}│${NC}"
  echo -e "${GREEN}│${NC}   - Manager:  ${BOLD}manager${NC}   / ${BOLD}Manager@123${NC}                       ${GREEN}│${NC}"
  echo -e "${GREEN}│${NC}   - Employee: ${BOLD}employee1${NC} / ${BOLD}Employee@123${NC}                      ${GREEN}│${NC}"
  echo -e "${GREEN}│${NC}                                                              ${GREEN}│${NC}"
  echo -e "${GREEN}│${NC} Nhấn ${BOLD}Ctrl+C${NC} để dừng các service an toàn bất cứ lúc nào.       ${GREEN}│${NC}"
  echo -e "${GREEN}└──────────────────────────────────────────────────────────────┘${NC}\n"

  cd "$DOCS_DIR/front-end"
  npm run dev
}

# ------------------------------------------------------------------------------
# Lệnh bổ trợ: Dừng toàn bộ (gồm cả Docker DB)
# ------------------------------------------------------------------------------
cmd_stop() {
  echo -e "${YELLOW}→ Đang dừng toàn bộ service và database...${NC}"
  cleanup
  if docker info >/dev/null 2>&1; then
    docker compose -f "$COMPOSE_FILE" down
    echo -e "${GREEN}✓ Đã tắt các container Database trong Docker.${NC}"
  fi
}

# ------------------------------------------------------------------------------
# Lệnh bổ trợ: Kiểm tra trạng thái
# ------------------------------------------------------------------------------
cmd_status() {
  echo -e "\n${BOLD}${CYAN}=== TRẠNG THÁI HỆ THỐNG ===${NC}"
  echo -e "${BOLD}1. Database Containers (Docker):${NC}"
  if docker info >/dev/null 2>&1; then
    docker compose -f "$COMPOSE_FILE" ps
  else
    echo -e "${RED}Docker daemon chưa chạy.${NC}"
  fi

  echo -e "\n${BOLD}2. Các cổng dịch vụ đang lắng nghe:${NC}"
  local ports=(
    "5173:Frontend (Vite)"
    "9090:API Gateway"
    "8081:Auth Service (REST)"
    "9091:Auth Service (gRPC)"
    "8084:Account Service (REST)"
    "9092:Account Service (gRPC)"
    "8080:Category Service"
    "8082:Department Service"
    "8083:Organization Service"
    "5433:Category DB"
    "5434:Department DB"
    "5435:Organization DB"
    "5436:Auth DB"
    "5437:Account DB"
  )
  for item in "${ports[@]}"; do
    local p="${item%%:*}"
    local desc="${item#*:}"
    if nc -z localhost "$p" 2>/dev/null; then
      printf "  • %-26s Port %-5s: ${GREEN}ĐANG CHẠY${NC}\n" "$desc" "$p"
    else
      printf "  • %-26s Port %-5s: ${RED}ĐÃ TẮT${NC}\n" "$desc" "$p"
    fi
  done
  echo ""
}

# ------------------------------------------------------------------------------
# Lệnh bổ trợ: Pre-build JAR cho tất cả service Java để khởi động siêu nhanh
# ------------------------------------------------------------------------------
cmd_build() {
  setup_java
  echo -e "\n${BOLD}${CYAN}=== BUILD PACKAGING TẤT CẢ SERVICE JAVA SANG JAR ===${NC}"
  echo -e "${CYAN}Sau khi build, các lần chạy sau chỉ mất ~2 giây và tốn cực ít RAM!${NC}\n"

  local services=(
    "$DOCS_DIR/auth-service"
    "$DOCS_DIR/account-service"
    "$DOCS_DIR/category-service"
    "$DOCS_DIR/department-service"
    "$DOCS_DIR/organization-service"
    "$DOCS_DIR/api-gateway"
  )

  for s in "${services[@]}"; do
    local name
    name="$(basename "$s")"
    echo -e "→ Building ${BOLD}$name${NC}..."
    (cd "$s" && chmod +x ./mvnw 2>/dev/null || true && ./mvnw -Dmaven.test.skip=true package)
    echo -e "${GREEN}✓ Hoàn tất $name${NC}\n"
  done
  echo -e "${GREEN}${BOLD}Tất cả service Java đã được đóng gói JAR thành công!${NC}"
}

# ------------------------------------------------------------------------------
# Entrypoint Router
# ------------------------------------------------------------------------------
case "${1:-start}" in
  start|"")
    setup_java
    check_docker
    start_databases
    start_backend
    start_frontend
    ;;
  stop)
    cmd_stop
    ;;
  status)
    cmd_status
    ;;
  build)
    cmd_build
    ;;
  logs)
    target="${2:-auth}"
    log_file="$LOG_DIR/${target}.log"
    if [ -f "$log_file" ]; then
      echo -e "${CYAN}→ Đang theo dõi log: $log_file (Ctrl+C để thoát)${NC}"
      tail -f "$log_file"
    else
      echo -e "${RED}Chưa tìm thấy log cho '${target}'. Danh sách log có sẵn:${NC}"
      ls -lh "$LOG_DIR"/*.log 2>/dev/null || echo "Chưa có log nào."
    fi
    ;;
  *)
    echo "Cách sử dụng: $0 [start|stop|status|build|logs <service>]"
    exit 1
    ;;
esac
