<!-- gitnexus:start -->

# GitNexus — Code Intelligence

Frontend dùng chung chỉ mục `docs` của checkout này. Áp dụng quy tắc về impact, mức rủi ro và kiểm tra thay đổi trong [AGENTS.md ở gốc](../AGENTS.md). Các lệnh chạy từ `front-end/` nằm ở mục 1.3.

<!-- gitnexus:end -->

---

# QUY TẮC PHÁT TRIỂN & TIÊU CHUẨN MÃ NGUỒN (FRONT-END RULES)

Bộ quy tắc này áp dụng cho toàn bộ AI Assistant và Developer khi làm việc trên `front-end`. Mọi hoạt động tư vấn, thiết kế và sinh code phải tuân thủ nghiêm ngặt các điều khoản dưới đây:

---

## 1. NGUYÊN TẮC CỐT LÕI (CORE DIRECTIVES)

### 1.1. Phạm vi theo yêu cầu

- Khi được yêu cầu review hoặc tư vấn, phân tích và đưa nhận xét kèm vị trí cụ thể. Có thể minh họa bằng diff để người dùng xem xét.
- Khi được yêu cầu triển khai, sửa lỗi hoặc áp dụng thay đổi, chỉnh trực tiếp các file thuộc phạm vi được giao và kiểm chứng kết quả.

### 1.2. PLAN KỸ RỒI MỚI LÀM (SUPERPOWERS SKILLS)

- **BẮT BUỘC** kích hoạt và tuân thủ bộ skill **Superpowers** (`using-superpowers`, `brainstorming`, `writing-plans`, `executing-plans`, `test-driven-development`, `systematic-debugging`, `verification-before-completion`):
  - **KHÔNG** bắt đầu sinh code khi chưa có kế hoạch rõ ràng.
  - Với mọi tính năng, refactor hoặc bugfix, phải thực hiện theo quy trình Superpowers:
    1. **Đặc tả & Phân tích (`brainstorming`)**: Xác định rõ use case, role người dùng (Admin, Manager, Employee), luồng dữ liệu, input/output, edge cases.
    2. **Khảo sát GitNexus**: Phân tích quan hệ phụ thuộc và vùng ảnh hưởng (blast radius).
    3. **Lập Kế hoạch Thực thi (`writing-plans`)**:
       - Đầy đủ `Goal`, `Architecture`, `Tech Stack`, `Spec`, `Global Constraints`, `Review Focus`.
       - Chia nhỏ công việc thành checklist bite-sized (`- [ ]`) theo chu trình TDD (Red → Green → Refactor).
       - Xác định danh sách file cần tạo/chỉnh sửa và chiến lược test (MSW handlers, mock data, unit test với Vitest).
    4. **Kiểm chứng (`verification-before-completion`)**: Đảm bảo mọi giải pháp đều vượt qua kiểm tra toàn diện (`npm run check`) và `gitnexus detect-changes` không có lỗi.

### 1.3. ĐỌC KỸ GITNEXUS TRƯỚC KHI ĐỀ XUẤT SỬA GÌ (GITNEXUS CODE INTELLIGENCE)

- Từ `front-end/`, chạy các lệnh sau cho symbol hoặc luồng liên quan trước khi đề xuất thay đổi mã nguồn:
  - Tra cứu ngữ cảnh symbol: `node ../.gitnexus/run.cjs context "<symbol>" --repo docs`
  - Đánh giá mức độ ảnh hưởng: `node ../.gitnexus/run.cjs impact "<symbol>" --direction upstream --repo docs`
  - Tìm kiếm luồng nghiệp vụ: `node ../.gitnexus/run.cjs query "<concept>" --repo docs`
  - Kiểm tra thay đổi đồ thị: `node ../.gitnexus/run.cjs detect-changes --scope all --repo docs`
- Nếu `risk: UNKNOWN`, bắt buộc xác minh thêm bằng text search (`grep`) trước khi kết luận an toàn.
- Trong câu trả lời, AI phải báo cáo rõ: Symbol này đang được gọi bởi ai, thuộc luồng xử lý (process) nào, và mức độ rủi ro (risk level) của thay đổi là gì.

### 1.4. TRIẾT LÝ PONYTAIL (PONYTAIL SKILL — MINIMALIST & YAGNI)

- **BẮT BUỘC** kích hoạt và áp dụng skill **Ponytail** (`ponytail`, `ponytail-review`, `ponytail-audit`):
  - **YAGNI (You Aren't Gonna Need It)**: Chọn cách triển khai dễ đọc, dễ kiểm thử và đủ cho yêu cầu hiện tại.
  - Tận dụng tối đa Standard Web APIs (`flatMap`, `Map`, `Set`, Fetch, `FormData`, `input.validity`, `AbortController`, native `<dialog>`) và những gì có sẵn trong React 19 / dự án.
  - **KHÔNG** tự ý cài thêm thư viện npm mới (như Redux, Zustand, Formik, Yup, Lodash, component library bên thứ ba) khi chưa có sự đồng thuận kiến trúc.
  - Áp dụng Rule of Three khi cân nhắc đưa hành vi vào module dùng chung. Trong một feature, có thể tách logic có trách nhiệm riêng ngay từ lần dùng đầu, ví dụ hàm chuẩn hóa bộ lọc từ URL có thể kiểm thử độc lập.
  - Tránh thêm wrapper hoặc cờ cấu hình chỉ để dự phòng.

---

## 2. CODE ĐỒNG BỘ VỚI DỰ ÁN (TEAM CONSISTENCY)

Toàn bộ mã nguồn do AI gợi ý phải nhất quán 100% với phong cách và quy ước hiện có của team:

### 2.1. Định dạng mã & Linter (ESLint & Prettier)

- **Prettier**:
  - Không sử dụng dấu chấm phẩy: `semi: false`
  - Sử dụng dấu nháy đơn: `singleQuote: true`
  - Tự động ngắt dòng: `endOfLine: "auto"`
- **ESLint 10**:
  - Tiêu chuẩn **0 warning** (`--max-warnings 0`). Mọi biến không sử dụng (trừ biến bắt đầu bằng chữ hoa cho JSX) đều bị cấm.
  - Tuân thủ tuyệt đối quy tắc hook: `react-hooks/rules-of-hooks: 'error'` và `react-hooks/exhaustive-deps: 'error'`.
  - Loại trừ thư mục `.gitnexus/`, `dist/`, `node_modules/`, `public/mockServiceWorker.js`.

### 2.2. Cấu trúc thư mục chuẩn (`src/`)

- `src/features/<feature-name>/`: Module hóa theo tính năng nghiệp vụ.
  - `api/`: Các hàm gọi API (ví dụ: `authApi.ts`). Xuất dạng object: `export const authApi = { login: ..., me: ... }`.
  - `components/`: Component giao diện đặc thù của feature (ví dụ: `SignupDemoModal.tsx`).
  - `context/`: Context & hook nội bộ feature (ví dụ: `AuthProvider.tsx`, `useAuth.ts`).
  - `pages/`: Các trang nghiệp vụ thuộc feature (ví dụ: `AccountPage.tsx`).
- `src/layouts/`: Khung giao diện dùng chung (`AppLayout/` chứa `AppLayout.tsx`, `Header.tsx`, `Sidebar.tsx`).
- `src/pages/`: Các trang dùng chung hệ thống (`Workspace.tsx`, `ForbiddenPage.tsx`, `NotFoundPage.tsx`, `ErrorPage.tsx`).
- `src/shared/`: Tiện ích dùng chung toàn ứng dụng:
  - `api/http.ts`: Quản lý Axios instances (`api`, `authHttp`), singleton `session`, interceptor và hàng đợi `refreshSession()`.
  - `components/`: Primitives tái sử dụng (`Button.tsx`, `Icons.tsx`).
  - `styles/styles.css`: CSS toàn cục, tiện ích semantic.
- `src/mocks/`: Mock API với MSW v3 (`handlers.ts`, `browser.ts`) phục vụ phát triển mock-first độc lập với Backend.
- `src/app/router/`: Quản lý route (`AppRouter.tsx`) và phân quyền truy cập theo role (`access.ts`).

### 2.3. Quy ước viết mã React 19 & TypeScript

- **Quy tắc đặt tên file**:
  - React Component: PascalCase (`Button.tsx`, `AppRouter.tsx`, `AccountPage.tsx`).
  - File logic, hook, helper, config: camelCase (`useAuth.ts`, `access.ts`, `http.ts`, `authApi.ts`).
  - Đuôi mở rộng: `.tsx` cho file có JSX, `.ts` cho file TypeScript không chứa JSX.
- Dùng alias `@/` cho import nội bộ trỏ vào `src/`, ví dụ `import Button from '@/shared/components/Button'`. Import thư viện ngoài theo tên package.
- **React 19 Context**: Sử dụng cú pháp mới `<AuthContext value={{ ... }}>`, tuyệt đối không dùng `<AuthContext.Provider>`.
- **Xử lý Form & Validation**:
  - Thu thập dữ liệu form tự nhiên bằng `new FormData(event.currentTarget)`.
  - Kiểm tra tính hợp lệ bằng Native HTML Constraint Validation (`input.validity`).
  - Tự động focus vào trường lỗi đầu tiên: `form.elements[firstErrorKey].focus()`.
- **Quản lý Bất đồng bộ & Race Conditions**:
  - Luôn sử dụng `AbortController` và truyền `signal` vào các lệnh gọi API.
  - Hủy request khi component unmount: `useEffect(() => () => controller.abort(), [])`.
  - Dùng cờ `revision.current` hoặc generation id để đảm bảo không áp dụng dữ liệu từ request cũ nếu trạng thái đã thay đổi.
- **Styling & Accessibility (a11y)**:
  - Kết hợp class tiện ích của Tailwind CSS v4 với semantic classes trong `styles.css`.
  - Bảo đảm khả năng tiếp cận: `aria-label`, `aria-labelledby`, `role="status"`, `role="alert"`, `inert`, skip-link `#main-content`, điều khiển modal bằng `<dialog>`.
- **Kiểm thử (Testing)**:
  - Viết test với Vitest và React Testing Library.
  - Mock API với MSW, đảm bảo chạy thành công lệnh kiểm tra:
    ```sh
    npm run check
    ```

---

## 3. CHECKLIST KIỂM DUYỆT TRƯỚC KHI TRẢ LỜI NGƯỜI DÙNG

1. [ ] **Phạm vi**: Đã làm đúng yêu cầu review, tư vấn hoặc triển khai ở mục 1.1 chưa?
2. [ ] **GitNexus**: Đã chạy tra cứu caller, callee, route và blast radius của symbol liên quan chưa?
3. [ ] **Kế hoạch (Plan)**: Đã phác thảo rõ logic và các bước thực hiện trước khi cung cấp code chưa?
4. [ ] **Ponytail**: Giải pháp có ngắn gọn, đơn giản, tận dụng platform native và tránh thư viện thừa không?
5. [ ] **Đồng bộ phong cách**: Code có đúng chuẩn Prettier (singleQuote, không chấm phẩy), React 19, cấu trúc feature/shared của dự án không?
