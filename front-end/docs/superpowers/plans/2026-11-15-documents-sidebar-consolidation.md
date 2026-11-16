# Documents Sidebar Consolidation — Implementation Plan

> **Thực thi ngày 15/11/2026:** Người dùng đã cho phép triển khai. Đã hoàn thành theo `superpowers:executing-plans`, TDD, Ponytail và GitNexus; chưa commit/push.

**Goal:** Sidebar chỉ có một mục Documents; người dùng chuyển Incoming/Outgoing/Internal bằng các tab trong trang, vẫn truy cập được toàn bộ URL hiện có.

**Architecture:** Giữ `routes` làm nguồn đăng ký route và quyền. Thêm metadata tùy chọn để quyết định mục nào xuất hiện trên sidebar, không dùng metadata này để cấp quyền. Thêm route gốc `/documents` chuyển đến Incoming; dùng prefix matching có sẵn của `NavLink` để Documents active ở các route con.

**Tech Stack:** React, TypeScript, React Router, Vitest, React Testing Library và MSW hiện có; không thêm dependency.

**Spec:** Yêu cầu người dùng ngày 15/11/2026 áp dụng đề xuất một mục Documents + ba tab; hành vi chi tiết được chốt trong phần Đặc tả dưới đây. Plan này thay thế riêng quyết định ba mục sidebar của [plan FE-3](2026-11-14-fe3-document-drafts.md).

## Global Constraints

- UI dùng tiếng Anh. Tái sử dụng DocumentsPage, ba tab, Sidebar và NavLink hiện có.
- Giữ quyền Admin/Manager/Employee, guard và object scope; menu visibility không phải authorization.
- Không đổi API, mock, form, dialog, bảng hoặc nghiệp vụ document. Lỗi tải dữ liệu trong ảnh là vấn đề riêng, không được coi là đã sửa bằng việc gom menu.
- Không thêm page, hook, store, submenu hoặc lưu tab cuối vào localStorage.
- Giữ query trên URL; đổi hướng qua tab vẫn reset filter/page theo hành vi hiện tại. Không tự thêm cơ chế nhớ bộ lọc riêng từng hướng.
- Trước sửa symbol chạy lại impact upstream; UNKNOWN đối chiếu source; HIGH/CRITICAL thông báo trước khi sửa. Trước nghiệm thu chạy `npm run check` và detect_changes; không xem báo cáo partial/truncated là kết quả đầy đủ.
- Workspace có thay đổi FE-3 và thay đổi khác ở users/FormField/Icons/useFetch. Giữ nguyên công việc đang có; không reset, stage toàn bộ hoặc commit/push tự động.

## Review Focus

1. Ẩn menu nhưng vô tình xóa route: deep link cả ba hướng vẫn mở đúng page — Task 1/2.
2. Documents không active khi mở Outgoing/Internal/detail hoặc active nhầm `/documents-other` — Task 2.
3. Redirect `/documents` làm mất query/hash hoặc thêm bước thừa vào browser history — Task 1.
4. Sidebar mobile hiển thị mục trùng hoặc không đóng sau click — Task 2.
5. Route bị ẩn khỏi menu bị loại khỏi safeDestination hoặc bypass guard — Task 1/2.

## Đặc tả hành vi

| Tình huống | Kết quả |
| --- | --- |
| Sidebar desktop/mobile | Một link nhãn Documents ở vị trí nhóm văn bản hiện tại; không còn ba link Incoming/Outgoing/Internal correspondence |
| Click Documents | Đi `/documents`, redirect bằng replace tới `/documents/incoming` |
| Mở `/documents?status=DRAFT&size=20#anchor` | Chuyển sang `/documents/incoming?status=DRAFT&size=20#anchor`; page có thể chuẩn hóa/thêm page=0 như hiện tại |
| Ba URL danh sách hiện có | Giữ nguyên route, hướng dữ liệu, ba tab, bộ lọc và pagination |
| `/documents/:id` | Giữ trang chi tiết; sidebar Documents active |
| Active state | NavLink tới `/documents`, không đặt `end`; giữ class is-active và aria-current do router cung cấp |
| Route ngoài nhóm, như `/records`, `/ocr`, `/documents-other` | Documents không active; route lạ vẫn theo 404 hiện có |
| Chọn tab khác | Điều hướng URL hướng mới, reset query theo hành vi hiện tại; Back/Forward phục hồi URL/filter |
| Click Documents khi đang ở Outgoing/Internal | Trở về Incoming mặc định; không ghi nhớ tab cuối |
| Sau đăng nhập | safeDestination vẫn chấp nhận `/documents`, ba URL hướng và detail hợp lệ, giữ query/hash; chặn URL ngoài hệ thống như hiện tại |
| Anonymous/role lạ | Guard và canAccess xử lý như hiện tại; route gốc Documents không phải đường vòng vượt quyền |

Các nhãn heading Incoming documents/Outgoing documents/Internal documents vẫn giữ vì mô tả tab đang xem. Personal profile tiếp tục nằm trong thẻ danh tính ngoài menu.

## Khảo sát và vùng ảnh hưởng

- `Sidebar` map trực tiếp `routes`, cùng component dùng trong AppLayout desktop và mobile drawer.
- `AppRouter` cũng map `routes`; vì vậy không xóa route con chỉ để thu gọn menu.
- `safeDestination` dùng `routes` để whitelist đường dẫn sau login; không lọc theo hiển thị sidebar.
- `RouteConfig` hiện chỉ có path/label/roles. Chỉ cần thêm `showInSidebar?: boolean`, mặc định hiển thị nếu khác false.

GitNexus repo `docs`, snapshot 15/11/2026:

| Symbol | Impact và xác minh source |
| --- | --- |
| RouteConfig | MEDIUM, 12 direct/25 tổng theo graph; graph nhập file domain chung có thể gom cả consumer của User/Role. Text xác nhận type RouteConfig được dùng cho routes trong access.ts. |
| routes | UNKNOWN; source xác nhận Sidebar, AppRouter, safeDestination. Phải regression menu, route và login redirect. |
| Sidebar | UNKNOWN; source xác nhận hai nơi render trong AppLayout và test Sidebar. |
| AppRouter | UNKNOWN; source xác nhận App, App.test và các render helper. |

Query tìm được luồng AccountPage → CanAccess qua safeDestination. Context RouteConfig đã đối chiếu với source; không suy ra an toàn từ các kết quả zero caller. Không đổi chữ ký/logic canAccess và safeDestination; bổ sung test cho dữ liệu routes mới.

## Files và trách nhiệm

Đường dẫn tương đối với `front-end/`; không cần thư mục hoặc production component mới.

| File | Thay đổi |
| --- | --- |
| src/shared/types/domain.ts | Thêm showInSidebar?: boolean vào RouteConfig |
| src/app/router/access.ts | Thêm /documents; ẩn ba route con trong menu bằng metadata; profile cũng dùng false thay cho kiểm tra path ở Sidebar |
| src/app/router/AppRouter.tsx | Xử lý /documents bằng Navigate replace, giữ search/hash; giữ nhánh render ba hướng/detail |
| src/layouts/AppLayout/Sidebar.tsx | Filter showInSidebar !== false kết hợp canAccess; giữ NavLink, mobile onClose và thẻ profile |
| src/app/App.test.tsx | Cập nhật assertion nhãn menu; thêm redirect, quyền và safeDestination cases |
| src/layouts/AppLayout/Sidebar.test.tsx | Kiểm tra một mục Documents, active state và mobile callback |
| src/features/documents/pages/DocumentsPage.test.tsx | Regression ba tab/deep link/query với sidebar đã gom |
| docs/document-drafts-acceptance.md | Ghi kết quả navigation QA mới |
| docs/superpowers/plans/2026-11-14-fe3-document-drafts.md | Ghi chú quyết định sidebar được thay thế bởi plan này khi triển khai |

## Task 1 — Khai báo route gốc và metadata menu

**Interfaces:** RouteConfig thêm `showInSidebar?: boolean`; `routes: RouteConfig[]`, canAccess và safeDestination giữ nguyên API. AppRouter vẫn default export không props.

- [x] Viết test trong App.test.tsx: `/documents` mở Incoming documents; `/documents?status=DRAFT&size=20#anchor` giữ status/size/hash khi redirect. Dùng một probe useLocation trong test để kiểm tra URL, không thêm probe vào production.
- [x] Test redirect dùng replace: MemoryRouter initialEntries `['/dashboard','/documents']`, initialIndex=1; sau redirect Back phải về dashboard, không quay lại /documents.
- [x] Test safeDestination với ba role: giữ `/documents`, ba URL hướng và `/documents/1?tab=history`; null/role lạ và `//host`, backslash, detail id không hợp lệ vẫn bị từ chối. Test anonymous mở /documents phải tới login.
- [x] Chạy `npx vitest run src/app/App.test.tsx`, ghi nhận test mới FAIL vì /documents chưa được đăng ký.
- [x] Thêm showInSidebar vào RouteConfig. Trong routes, thêm `{path:'/documents',label:'Documents',roles:staff}` trước ba route hướng; đặt showInSidebar:false cho cả ba route và /profile. Không thay đổi roles.
- [x] AppRouter lấy location bằng useLocation; xử lý chính xác `/documents` trước nhánh `/documents/…` bằng Navigate replace với pathname `/documents/incoming`, search và hash từ location. Không truyền hướng rỗng vào DocumentsPage.
- [x] Chạy lại App.test.tsx, xác nhận PASS trước chuyển sang Task 2.

## Task 2 — Gom menu và bảo toàn điều hướng

**Interfaces:** SidebarProps giữ nguyên mobile/onClose/collapsed. Sidebar chỉ dùng metadata từ Task 1 để hiển thị; route registration và safeDestination không dùng cờ này.

- [x] Test Sidebar cho từng admin/manager/employee: trong navigation Navigation chỉ có một Documents với href /documents; không còn ba nhãn correspondence. Đổi assertion Employee menu trong App.test.tsx sang Documents ở bước test này.
- [x] Test Documents có class is-active và aria-current=page trên incoming/outgoing/internal và detail hợp lệ; không active trên /records hoặc /documents-other. Scope assertion vào một nav vì layout có cả desktop và drawer.
- [x] Test render Sidebar mobile với onClose spy trong auth/router test harness: click Documents gọi onClose; thẻ profile vẫn ở ngoài nav. Không import đồng thời hai test helper có setupServer riêng vào cùng một file test.
- [x] Regression DocumentsPage: ba tab vẫn mở đúng heading/direction; link detail hoạt động; filter/page trong deep link vẫn được khôi phục. Dùng helper MSW hiện có, không thêm request API production.
- [x] Chạy `npx vitest run src/layouts/AppLayout/Sidebar.test.tsx src/app/App.test.tsx src/features/documents/pages/DocumentsPage.test.tsx`, xác nhận FAIL ở kỳ vọng một mục menu.
- [x] Sidebar filter `route.showInSidebar !== false && canAccess(user, route.roles)` thay điều kiện path /profile; giữ NavLink mặc định prefix matching, class callback, onClick và thẻ profile. Không dùng startsWith thủ công để đánh dấu active.
- [x] Chạy lại ba file test, xác nhận PASS. Kiểm tra tên Documents chính xác để không nhầm với mục OCR & Documents.

## Task 3 — Regression, browser QA và cập nhật tài liệu

- [x] Chạy `npm run check` trong front-end: lint 0 warning, format, toàn bộ test và build PASS; phân biệt lỗi baseline nếu có do thay đổi khác trong workspace.
- [x] Browser mock desktop 1366×768 và mobile 390px: một Documents, ba tab hoạt động, Documents active trên detail; mobile drawer đóng khi chọn; Back/Forward giữ filter; profile/menu khác vẫn đúng.
- [x] Cập nhật acceptance và ghi chú superseded trong plan FE-3 cũ; ghi mock/viewport/kết quả thực tế. Không đánh dấu BE-3/FS-3 đã hoàn tất.
- [x] Refresh index nếu cần bằng `node .gitnexus/run.cjs analyze --index-only` từ root; chạy MCP `detect_changes({repo:'docs',scope:'all'})` hoặc CLI `node .gitnexus/run.cjs detect-changes --scope all --repo docs`. Nếu partial/truncated, chạy lại để giải quyết, ghi rõ giới hạn còn lại; không gọi đó là all-clear.
- [x] Review diff đối chiếu phạm vi navigation; bảo toàn các thay đổi đang có. Chỉ commit/push khi người dùng yêu cầu.

## Tiêu chí nghiệm thu và tự review

Một mục Documents trên cả hai sidebar; cả ba URL cũ và detail còn hoạt động; route gốc redirect không mất query/hash; active state đúng; không đổi quyền/API hoặc hành vi filter. Mỗi yêu cầu ở Review Focus đã có test/task tương ứng. Giải pháp chỉ bổ sung metadata tùy chọn và một redirect, không cần tách lại feature documents hay xây framework menu mới.
