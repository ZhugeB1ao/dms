# FE-3 — Màn hình văn bản bản thảo — Implementation Plan

> Quyết định ba mục sidebar bên dưới đã được thay thế và triển khai theo [Documents Sidebar Consolidation](2026-11-15-documents-sidebar-consolidation.md): một mục Documents, giữ ba tab Incoming/Outgoing/Internal và các URL hiện có.

## Trạng thái thực thi — 15/11/2026

Người dùng đã cho phép thực hiện plan, bao gồm sửa source. Đã triển khai mốc mock trên nhánh `feature/fe3-document-drafts`, base `ccc2f84`, chưa commit/push. Các ràng buộc “chỉ lập plan” bên dưới là bối cảnh lúc soạn, không còn chặn việc thực thi đã được yêu cầu.

| Task | Kết quả thực thi |
| --- | --- |
| 1 | Types, quyền độc lập theo từng role, contract mock và ghi chú superseded trong spec cũ đã có. |
| 2 | Admin toàn route, internal/detail routes và safeDestination đã ghép; giữ object authorization ở API. |
| 3 | API client + MSW, version conflict, lookup inactive, scope/history/attachments và reset đã triển khai. |
| 4 | Ba danh sách, URL filters, paging/clamp, abort request cũ, lỗi/retry và các dialog đã ghép. |
| 5 | Form dùng CrudFormDialog, validation, lookup/retry/inactive, pending guard, API errors và discard/reload đã có. |
| 6 | Xóa qua ConfirmDeactivateDialog với nhãn tùy chỉnh, version và conflict/reload đã có. |
| 7 | Detail + keyboard tabs + history + metadata tệp đã có; **FS-3 thật pending**. |
| 8 | `npm run check` đạt 124 test/27 file, browser QA và review đã chạy; **BE-3/API thật pending**. |

Chi tiết kiểm chứng và giới hạn GitNexus nằm trong [acceptance](../../document-drafts-acceptance.md); [contract](../../api/documents-contract.md) phân biệt rõ mock proposal và BE/FS handoff. Các checklist chi tiết ban đầu bên dưới được giữ để truy vết tiêu chí và kiểm tra lại khi nối API thật; bảng này ghi kết quả thực thi hiện tại, không tuyên bố mọi tổ hợp lỗi đã được kiểm thử exhaustive.

> **For agentic workers:** dùng `superpowers:executing-plans` khi triển khai trực tiếp; dùng `test-driven-development`, Ponytail và GitNexus cho từng task. Checklist chưa đánh dấu là công việc chưa thực hiện. Đây là plan để review, chưa phải lệnh sửa `src/**`, commit hoặc push. Tuân thủ AGENTS.md ở root và front-end; quyền sửa source cần được người dùng cho phép khi bắt đầu triển khai.

**Goal:** Hoàn thành danh sách, tạo/sửa/xóa bản thảo và trang chi tiết văn bản có Thông tin/Tệp đính kèm/Lịch sử trạng thái; chạy được bằng mock, sau đó kiểm chứng với BE-3 và khu vực tệp FS-3.

**Architecture:** Feature `documents` theo cấu trúc `api/components/pages/types.ts` hiện có. Page điều phối dữ liệu và điều hướng; bảng, form, xác nhận xóa và tab có trách nhiệm riêng. Dùng Axios client chung với MSW ở biên HTTP, không nhúng dữ liệu giả trong component. Mock và API thật đi cùng luồng UI.

**Tech Stack:** TypeScript, React 19, React Router, Vite, Tailwind/CSS hiện có; Axios, MSW, Vitest, React Testing Library. Native `FormData`, `input.validity`, `AbortController`, `<dialog>`. Không thêm dependency, Redux, thư viện form hoặc framework CRUD.

**Spec:** Hai ảnh ticket FE-3 người dùng cung cấp và quyết định trong chat ngày 14/11/2026: Admin có toàn quyền; Manager quản lý văn bản trong đơn vị; Employee xem văn bản tự tạo/được giao và chỉ sửa/xóa bản thảo tự tạo. Phần 1 dưới đây lưu lại đặc tả và các đề xuất cần review. Spec cũ `../specs/2026-10-29-document-records-business-analysis.md` chỉ dùng làm bối cảnh; quy tắc Admin mới thay thế quy tắc Admin không có quyền nghiệp vụ trong tài liệu cũ.

## Global Constraints

- Chỉ lập plan trong lần này. Các quyết định giao diện, schema và endpoint bên dưới là đề xuất FE, chưa được coi là OpenAPI BE đã duyệt.
- Giữ UI tiếng Anh như các trang hiện có; văn bản tiếng Việt trong ticket được ánh xạ sang nhãn UI bên dưới.
- Dùng `.ts/.tsx` theo source thực tế; không quay lại `.js/.jsx` chỉ vì ví dụ cũ trong AGENTS.md.
- Tái sử dụng `Button`, `Select`, `CrudHeader`, style bảng/toolbar hiện có. Không import helper nghiệp vụ từ `features/users` sang `documents`.
- Phân trang/lọc tại API, kể cả mock. Không tải một trang rồi lọc phía client và coi đó là toàn bộ kết quả.
- Mọi request dùng signal; bỏ kết quả cũ khi đổi bộ lọc, id hoặc người dùng. Không hiện dữ liệu người trước khi logout/login.
- Giữ input khi lỗi; chặn double submit; ẩn thao tác khi không đủ quyền hoặc sai trạng thái. API/mock vẫn kiểm tra lại quyền và trạng thái.
- Không tự thêm duyệt, công bố, ký số, OCR, gửi email, phân công hoặc workflow ngoài ticket.
- Trước sửa symbol: impact upstream; UNKNOWN phải đối chiếu text search; HIGH/CRITICAL phải báo người dùng. Trước commit và nghiệm thu: `npm run check` và GitNexus detect_changes hoàn chỉnh, không partial/truncated.

## Review Focus

1. Quyền Admin mới ảnh hưởng guard, menu, chuyển hướng sau login và object scope; test đầy đủ ở Task 2/3/8.
2. Bản thảo bị người khác chuyển trạng thái trong lúc đang mở form: API trả 409, không ghi đè, reload trạng thái; Task 5/6.
3. Đổi tab/bộ lọc/id nhanh hoặc xóa hàng cuối trang: không hiện dữ liệu cũ; reset/clamp page đúng; Task 4/6/7.
4. Danh mục/đơn vị ngừng hoạt động hoặc lookup lỗi: giữ giá trị cũ có nhãn, không tự thay id, không gửi form chưa đủ dữ liệu; Task 5.
5. Mock pass nhưng API thật thiếu filter, quyền hoặc file contract: checklist tích hợp riêng; Task 8 không được đánh dấu dựa vào test MSW.

## 1. Đặc tả và phạm vi

### Các màn hình

- Danh sách có ba tab điều hướng: Incoming, Outgoing, Internal. URL tương ứng `/documents/incoming`, `/documents/outgoing`, `/documents/internal`.
- Lọc trạng thái, loại văn bản và đơn vị phụ trách; page bắt đầu 0, size 10/20/50. Đổi hướng/lọc/size đưa về page 0. Các giá trị query không hợp lệ được chuẩn hóa, không gửi NaN.
- Cột tối thiểu: trích yếu (link chi tiết), loại, đơn vị phụ trách, đơn vị ban hành, trạng thái, thao tác. Không thêm search khi ticket chưa yêu cầu/BE chưa có contract.
- Badge: `DRAFT` → Draft (Bản thảo); `READY_TO_PUBLISH` → Ready to publish (Hoàn thành chờ công bố); `PUBLISHED` → Published (Đã công bố). Luôn có chữ, không chỉ phân biệt bằng màu. Giá trị không nhận biết hiển thị Unknown và không mở quyền sửa/xóa.
- Create/Edit dùng một `DocumentFormDialog`; danh sách và chi tiết mở cùng component. Hướng lấy từ tab khi tạo, bất biến khi sửa. Trường: document type, summary, urgency, confidentiality, issuing organization. Không tự tạo số công văn hoặc trạng thái từ form.
- Chi tiết `/documents/:id`: ba tab Information, Attachments, Status history; mặc định Information. Nội dung tab hiển thị loading/empty/error/retry độc lập.
- Delete mở xác nhận có trích yếu, Cancel và Delete draft. Thành công từ chi tiết quay về tab hướng tương ứng; từ danh sách tải lại và lùi trang nếu trang cuối rỗng.
- Keyboard: tabs chi tiết có tablist/tab/tabpanel, arrow/Home/End và aria-selected; dialog quản lý focus, Escape, trả focus cho trigger; pending không cho đóng giữa mutation.
- Desktop nghiệm thu ở 1366×768 và 1920×1080; kiểm tra 390px để không tràn ngang toàn trang. Bảng được cuộn ngang trong vùng có nhãn và có thể focus.

### Ma trận quyền

| Role | Xem | Tạo | Sửa/xóa |
| --- | --- | --- | --- |
| ADMIN | Mọi đơn vị, cả ba hướng | Chọn đơn vị phụ trách bất kỳ đang hoạt động | Mọi văn bản còn DRAFT |
| MANAGER | Đơn vị của mình | Trong đơn vị của mình | Mọi DRAFT trong đơn vị mình |
| EMPLOYEE | Tự tạo hoặc được giao | Trong đơn vị của mình | DRAFT do mình tạo |

- Người dùng đã chốt Admin có toàn quyền với toàn bộ chức năng. Task 2 cập nhật kiểm tra role chung để Admin truy cập các route đã đăng ký, bao gồm approvals/records/tasks. Các nghiệp vụ chưa triển khai vẫn là trang khung; không tuyên bố đã hoàn thành chức năng đó.
- Toàn quyền không bỏ qua trạng thái, validation, xác nhận xóa hay quy tắc tự bảo vệ tài khoản hiện có. Đây là cách áp dụng đề xuất để đáp ứng tiêu chí ticket “nút bị ẩn khi sai trạng thái”.
- Người không đăng nhập: 401; sai role/phạm vi: 403; không tồn tại: 404. Người ngoài phạm vi không được xem tệp hoặc lịch sử qua URL trực tiếp.
- Employee/Manager thiếu departmentId không được tạo; hiện thông báo liên hệ quản trị. Phạm vi quyết định phía server, không tin createdBy/assigneeIds/status do client gửi.
- Mock kiểm tra độc lập từ session và dữ liệu lưu trữ, không dùng lại hàm quyền FE làm oracle duy nhất trong test.

### Lựa chọn thiết kế

Đề xuất dùng một feature documents với form dialog, tương tự users/categories. Một page gom tất cả sẽ trộn list/form/detail/file; một framework CRUD chung cần nhiều cấu hình cho state và object permission. Cấu trúc theo feature là lựa chọn ít thay đổi nền nhất. Không áp dụng plan Radix chưa triển khai vào FE-3.

## 2. Hiện trạng và GitNexus

- Chưa có `src/features/documents`; router chỉ render Workspace cho incoming/outgoing. Chưa có internal/detail route.
- Chưa tìm thấy BE-3 document controller/OpenAPI trong checkout; API OCR là hệ khác, không dùng thay contract văn bản hành chính. Chưa thấy component khu vực tệp FS-3.
- `categoryApi` có DOC_TYPE/URGENCY/CONFIDENTIALITY; `organizationApi.listActive` cho đơn vị ban hành; `departmentApi.listActive` cho đơn vị phụ trách. Không đánh đồng organizationId với departmentId.
- `useCrudPage` trả mảng và quản lý deactivate; không phù hợp list phân trang + xóa thật + history. Không mở rộng hook chung chỉ phục vụ FE-3.
- `mocks/handlers.ts` đã hơn 900 dòng: document handlers/data nằm file riêng, chỉ nối factory và reset ở file cũ.
- GitNexus MCP đã dùng được. Repo đúng là **docs**, HEAD/index cùng `ccc2f84c8354a3770ccdf3d696edd7d449ac5b43`, index ngày 14/11/2026. Alias `document-management-frontend` trong front-end/AGENTS.md trỏ checkout cũ khác đường dẫn; mọi truy vấn ở đây dùng `repo: docs`.

| Symbol dự kiến chạm | Kết quả graph và xác minh |
| --- | --- |
| AppRouter | UNKNOWN, graph không resolve caller; text xác nhận App và test render. Context có AppRouter → CanAccess và AppRouter → UseAuth. Không coi zero là an toàn. |
| routes | UNKNOWN; text có AppRouter, Sidebar, safeDestination; cần regression navigation toàn app. |
| canAccess | LOW, 3 direct/5 tổng; Guard, Sidebar, safeDestination; luồng AppRouter và AccountPage. |
| safeDestination | LOW; AccountPage; luồng login → chuyển hướng. Phải hỗ trợ link chi tiết mà không mở redirect tùy ý. |
| userFor | LOW, 3 direct/5 tổng trong graph; scope mock/master data. Giữ logic session, truyền callback vào factory documents. |
| handlers/resetMock | UNKNOWN; text có browser worker, test helper, auth/account/master-data tests. Chỉ mở rộng composition/reset và chạy regression. |

Các kết quả là snapshot lập plan; phải chạy lại impact trước khi thực thi, gồm symbol khác nếu scope thay đổi.

## 3. Contract mock v0.1 đề xuất

Ghi contract chi tiết tại `docs/api/documents-contract.md` trong Task 1; base `/api` theo code hiện tại, không dùng `/api/v1` từ spec cũ.

- `DocumentDirection = 'INCOMING' | 'OUTGOING' | 'INTERNAL'`; status như phần 1; id dùng number dương trong mock.
- `DocumentSummary`: id, direction, summary, documentTypeId, urgencyId, confidentialityId, issuingOrganizationId, departmentId, createdBy, assigneeIds:number[], status, createdAt, updatedAt; kèm documentTypeName, issuingOrganizationName, departmentName để bảng không phụ thuộc lookup active. Thời gian ISO 8601. `DocumentDetail` thêm version:number để phát hiện sửa/xóa stale và `lookups:{documentType,urgency,confidentiality,issuingOrganization,department}`, mỗi mục `{id:number,name:string,isActive:boolean}`; dùng để giữ tên/giá trị inactive khi sửa. Đây là schema proposal, adapter ánh xạ response thật nếu khác.
- `DocumentQuery`: direction, status?, documentTypeId?, departmentId?, page:number, size:10|20|50. Kết quả `{content,totalElements,totalPages,page,size}`. Quyền được áp dụng trước filter/count/pagination.
- `DraftInput`: direction, summary, documentTypeId, urgencyId, confidentialityId, issuingOrganizationId, departmentId. Các id bắt buộc; summary trim, 1–1000 ký tự (giới hạn đề xuất FE). Khi update gửi cùng fields nhưng hướng không đổi và thêm version; không gửi status/createdBy/assigneeIds.
- `StatusHistoryEntry`: id, fromStatus:null|string, toStatus:string, actorName, occurredAt, note?:string. Sắp tăng dần thời gian rồi id; tạo mới có entry null→DRAFT; sửa nội dung không giả tạo chuyển trạng thái.
- `DocumentAttachment`: id, fileName, sizeBytes, contentType, uploadedBy, uploadedAt. Đây là metadata đề xuất, không phải FS-3 contract đã chốt.

| Method/path | Request → response |
| --- | --- |
| GET /documents | DocumentQuery → page DocumentSummary |
| GET /documents/:id | → DocumentDetail |
| POST /documents | DraftInput → 201 DocumentDetail; server gán DRAFT/creator/version=1 |
| PUT /documents/:id | DraftInput + version → DocumentDetail; kiểm tra scope, DRAFT và version; tăng version |
| DELETE /documents/:id?version=N | → 204; chỉ DRAFT, đúng scope/version |
| GET /documents/:id/history | → StatusHistoryEntry[] |
| GET /documents/:id/attachments | → DocumentAttachment[]; provisional, ánh xạ lại khi FS-3 bàn giao |

Lỗi `{code,message,fieldErrors?}`: 400/422 invalid field; 401 session; 403 scope; 404 missing; 409 trạng thái/version đổi. `documentsApi` không tự fallback mock khi API thật lỗi. Unknown status chỉ đọc. BE có ETag/If-Match thay version thì adapter ánh xạ tại API, không ép BE theo proposal.

Đề xuất FE cho cập nhật đơn vị: Admin được chuyển DRAFT sang đơn vị đang hoạt động; staff không được đổi departmentId. API kiểm tra quyền trên văn bản hiện tại trước khi kiểm tra đơn vị đích, không lấy scope từ payload để quyết định quyền. Khi giữ đơn vị cũ inactive, cho giữ nguyên nhưng không cho chọn mới. Có test PUT giả departmentId ngoài phạm vi.

Xóa bản thảo có tệp: FE chỉ gọi DELETE document; BE-3/FS-3 chịu trách nhiệm unlink/cleanup tệp và tính nhất quán. FE không xóa từng tệp trước rồi xóa văn bản. Contract tích hợp phải chốt 204 chỉ khi thao tác xóa đã được backend chấp nhận bền vững; thất bại thì giữ document/UI với lỗi, cleanup retry thuộc backend. Test integration có bản thảo gắn tệp, DELETE thất bại và thành công, không để client tự xử lý giao dịch phân tán.

Mock dùng dữ liệu in-memory có reset, reload trình duyệt trở về seed; không lưu file nhạy cảm trong localStorage. Seed đủ >20 văn bản, đủ ba hướng/trạng thái, hai đơn vị, owner/assignee khác nhau và các tệp/history minh họa. Bật bằng `VITE_ENABLE_MOCKS=true`; khi false phải gọi API thật. Chưa triển khai chế độ auth thật + documents mock vì chưa có cách xác minh session thật trong mock.

## 4. Cấu trúc file dự kiến

### Quyết định tái sử dụng dialog (bổ sung sau review)

`DocumentFormDialog` và `DeleteDraftDialog` là component nghiệp vụ, không phải hai khung modal mới. `DocumentFormDialog` dùng `CrudFormDialog` để render dialog/form/footer; chỉ sở hữu field, lookup, validation và mutation văn bản. `DeleteDraftDialog` sở hữu id/version, DELETE và xử lý conflict; dùng khung xác nhận dùng chung sau khi tổng quát hóa tối thiểu `ConfirmDeactivateDialog`.

Không dựng lại `<dialog>`, header/footer và nút chung trong hai file feature. Không import AccountDialog từ users. `CrudFormDialog` cần prop tùy chọn `submitDisabled` (mặc định false) cho lookup chưa sẵn sàng. Khung xác nhận cần `confirmLabel`/`pendingLabel` (mặc định Deactivate/Deactivating…) để dùng Delete draft/Deleting…. Nếu đổi tên sang `ConfirmActionDialog`, dùng GitNexus rename và cập nhật toàn bộ caller; không rename bằng replace. Không ghép logic API document vào component shared.

Cả hai khung hiện cho đóng qua nút X/backdrop dù submitting, chưa đồng bộ native cancel với state. Trước tái sử dụng, bổ sung kiểm tra submitting cho X/backdrop/Escape, onCancel cập nhật state khi không pending, và kiểm tra trả focus sau đóng; lỗi form có role alert. Test shared cho Save bị khóa khi submitDisabled, nút xác nhận đúng nhãn và mọi đường đóng khi idle/pending; regression ba trang cũ với default props.

GitNexus impact upstream cho cả CrudFormDialog và ConfirmDeactivateDialog trả **HIGH**: 3 caller trực tiếp CategoriesPage/DepartmentsPage/OrganizationsPage, các luồng CRUD của ba trang. Đây là cảnh báo trước triển khai; phải chạy lại impact và regression khi sửa, không xem mở rộng prop là vô hại. Thay đổi này là bước đầu của Task 5; Task 6 dùng lại khung đã kiểm chứng. Thêm vào danh sách Files Task 5: `src/shared/components/CrudPageLayout.tsx`, test mới `src/shared/components/CrudPageLayout.test.tsx` và caller nếu rename. Hai file feature chỉ cần nếu thực tế có logic riêng như plan mô tả; không tạo wrapper chỉ chuyển tiếp props.

Các đường dẫn dưới đây tương đối với `front-end/`. Test đặt cạnh file như users; chỉ tạo file test cho hành vi thực tế.

```text
src/features/documents/
  types.ts
  permissions.ts                 # canViewDocument/canEditDraft/canDeleteDraft
  permissions.test.ts
  api/
    documentsApi.ts              # list/get/create/update/remove/history/attachments
    documentsApi.test.ts
    documentErrors.ts            # lỗi đặc thù 403/404/409 + field errors
    documentErrors.test.ts
  pages/
    DocumentsPage.tsx            # query, tải list/lookups, mở dialog, refresh
    DocumentsPage.test.tsx
    DocumentDetailPage.tsx       # tải theo id, tab, trạng thái, điều phối sửa/xóa
    DocumentDetailPage.test.tsx
  components/
    DocumentsTable.tsx          # bảng/empty/loading, chỉ nhận data + callbacks
    DocumentStatusBadge.tsx     # ba nhãn và unknown fallback
    DocumentFormDialog.tsx      # create/edit, lookup, validation và submit
    DocumentFormDialog.test.tsx
    DeleteDraftDialog.tsx       # xác nhận và mutation xóa
    DeleteDraftDialog.test.tsx
    DocumentHistoryTab.tsx      # tải/hiển thị lịch sử theo documentId
    DocumentAttachmentsTab.tsx  # điểm ghép FS-3; mock metadata trước
src/mocks/
  documents.ts                 # seed + store/reset, không import handlers.ts
  documentHandlers.ts          # createDocumentHandlers(base, getUser)
  documentHandlers.test.ts
src/test/documentFeature.tsx    # render route + session + reset dùng trong test feature
docs/api/documents-contract.md
docs/document-drafts-acceptance.md
```

File hiện có dự kiến sửa: `src/app/router/AppRouter.tsx`, `src/app/router/access.ts`, `src/app/App.test.tsx`, `src/mocks/handlers.ts`, `src/mocks/handlers.test.ts`, spec quyền cũ (ghi rõ quyết định mới). Không tạo barrel index, context/global store hay generic form mới. `DocumentsTable` không fetch; quyền nằm ở permissions; API không quản lý UI. Tách hook riêng chỉ khi có logic tái sử dụng thực tế, không theo ngưỡng số dòng.

## 5. Các task thực thi

### Task 1 — Khóa contract và policy cho mock

**Files:** tạo `types.ts`, `permissions.ts`, `permissions.test.ts`, `docs/api/documents-contract.md`; cập nhật phần quyền trong spec nghiệp vụ cũ bằng ghi chú superseded, không xóa lịch sử.

**Interfaces:** `canViewDocument(user: User|null, doc: DocumentSummary): boolean`, `canEditDraft(...)`, `canDeleteDraft(...)`. Chuẩn hóa id string của auth khi so với id number của API; không so nhầm `'3'` với `3`.

- [ ] Test trước bằng ma trận role × scope × ownership × trạng thái: Admin mọi đơn vị; Manager cùng đơn vị; Employee owner/assignee chỉ xem, chỉ owner sửa/xóa; unknown role/status và null user bị từ chối.
- [ ] Chạy `npx vitest run src/features/documents/permissions.test.ts`, xác nhận FAIL do chưa có implementation.
- [ ] Định nghĩa types/permissions tối thiểu; document contract ghi riêng quyết định người dùng, đề xuất FE, pending BE/FS.
- [ ] Chạy lại test, xác nhận PASS. Không chia sẻ permission implementation với mock authorization.

### Task 2 — Route/menu và quyền Admin toàn ứng dụng

**Files:** `app/router/access.ts`, `AppRouter.tsx`, `app/App.test.tsx`.

**Interfaces:** giữ chữ ký `canAccess`/`safeDestination`; Admin được phép trên mọi route đã đăng ký. Thêm internal vào routes menu. Ba list routes render `DocumentsPage({direction})`; `/documents/:id` dưới Guard cho ba role và render detail, không xuất hiện thành mục sidebar riêng.

- [ ] Test đỏ: Admin thấy/đi được incoming/outgoing/internal/records/tasks/approvals; Manager/Employee giữ quyền cũ; anonymous redirect login.
- [ ] Test link chi tiết sau login giữ id/query; `//host`, backslash, path lạ vẫn về dashboard. Chỉ chấp nhận detail id số dương và đúng path; có role guard/object authorization sau đó.
- [ ] Chạy `npx vitest run src/app/App.test.tsx`, ghi nhận case mới FAIL.
- [ ] Thay đổi role check tối thiểu, đăng ký routes sau khi page tương ứng từ Task 4/7 sẵn sàng; có thể viết test trước, hoàn tất integration khi hai task đó xong, không ship placeholder như đã xong feature.
- [ ] Cập nhật assertion cũ Admin bị chặn approvals theo quyết định mới; giữ assertion chống open redirect. Cập nhật `/demo/documents/:id` cho Admin và regression test demo scope trong Task 3.
- [ ] Chạy lại App tests khi route được ghép. Không nới quyền object bằng mỗi `canAccess`.

### Task 3 — API client và MSW độc lập với UI

**Files:** `api/documentsApi.ts`, `api/documentErrors.ts`, test tương ứng; `mocks/documents.ts`, `documentHandlers.ts`, `documentHandlers.test.ts`; nối `handlers.ts/resetMock` và demo scope.

**Interfaces:** `documentsApi.list(query, signal?)`, `get(id,signal?)`, `create(input,signal?)`, `update(id,inputWithVersion,signal?)`, `remove(id,version,signal?):Promise<void>`, `history(id,signal?)`, `attachments(id,signal?)`. Factory `createDocumentHandlers(base:string, getUser:(request:Request)=>{id:number;role:Role;departmentId:number|null}|null)`; reset store gọi từ resetMock. Truyền userFor vào factory tại composition, không tạo import cycle.

- [ ] Test HTTP đỏ: params/omission đúng, page totals sau scope+filter; create→detail→edit→delete đồng nhất; abort truyền qua client; xóa 204 không đọc JSON.
- [ ] Test API mock độc lập: 401/403/404; Admin xuyên đơn vị; Manager ngoài đơn vị; Employee sửa bản được giao không phải owner; ready/published và version stale trả 409; body giả createdBy/status không nâng quyền; field ids inactive/không tồn tại trả field errors.
- [ ] Chạy `npx vitest run src/features/documents/api src/mocks/documentHandlers.test.ts`, xác nhận FAIL.
- [ ] Implement API và handlers đúng contract, check scope trước mutation, reset giữa tests. Sửa demo scope theo quyết định Admin để không còn hai chính sách trái nhau.
- [ ] Chạy lại cùng test và `npx vitest run src/mocks src/features/auth`; đủ PASS mới chuyển tiếp.

### Task 4 — Danh sách, tab hướng, lọc và phân trang

**Files:** `DocumentsPage.tsx`, `DocumentsTable.tsx`, `DocumentStatusBadge.tsx`, `DocumentsPage.test.tsx`, `test/documentFeature.tsx`; ghép list routes Task 2.

**Interfaces:** page nhận `direction:DocumentDirection`; table nhận rows/loading/permissions và callbacks edit/delete, link detail; badge nhận status:string.

- [ ] Test đỏ: ba hướng tách dữ liệu; filter kết hợp AND; đổi filter/size về page 0; Admin chọn đơn vị, Manager/Employee chỉ thấy phạm vi mình; badge đủ ba status; unknown status không mở actions.
- [ ] Test request chậm không ghi đè kết quả mới; loading/empty/error/retry; logout không giữ dữ liệu cũ. URL query lưu filter/page/size bằng useSearchParams, Back/Forward khôi phục đúng; direction lấy từ route, không nhân đôi state.
- [ ] Chạy `npx vitest run src/features/documents/pages/DocumentsPage.test.tsx`, xác nhận FAIL.
- [ ] Implement tối thiểu; tải lookup song song; ẩn edit/delete khi policy từ Task 1 từ chối. Không dùng client-side filter trên một page. Render số lượng từ totalElements.
- [ ] Chạy lại test PASS; nút create/edit/delete được nối với dialog Task 5/6 trước nghiệm thu.

### Task 5 — Form tạo/sửa bản thảo và validation

**Files:** `DocumentFormDialog.tsx`, test tương ứng; nối page/list/detail khi có.

**Interfaces:** props `{document:DocumentDetail|null, direction:DocumentDirection, onClose():void, onSaved(document:DocumentDetail):void}`; lấy auth bằng useAuth, lookup từ category/organization/department API. Edit từ list phải tải detail/version trước khi cho submit.

- [ ] Test đỏ create và edit: đủ năm trường ticket; summary chỉ whitespace bị chặn; giới hạn 1000; id bắt buộc; chọn sai category type bị API chặn; lỗi API giữ input và focus field đầu.
- [ ] Test lookup lỗi có retry, Save bị khóa; Admin chọn departmentId, staff dùng đơn vị mình; đơn vị/danh mục cũ inactive được hiện nhãn và giữ nguyên khi sửa nhưng không chọn mới. Mock giữ lựa chọn inactive chỉ nếu đúng giá trị cũ; get detail cung cấp nhãn lookup hiện tại để không mất hiển thị.
- [ ] Test double click một mutation; abort khi unmount; 409 giữ nội dung người dùng, hiện conflict và thao tác reload (cảnh báo sẽ bỏ thay đổi), không tự retry ghi đè; 403 không báo success.
- [ ] Chạy `npx vitest run src/features/documents/components/DocumentFormDialog.test.tsx`, xác nhận FAIL.
- [ ] Implement FormData + native validity cho cả input/select/textarea; không dùng formValidation của users vì helper đó gắn mật khẩu và chưa duyệt textarea. Dùng CrudFormDialog sau bước mở rộng/test shared ở phần quyết định tái sử dụng; không dựng shell dialog riêng.
- [ ] Chạy lại PASS. Save xong refresh list/detail/history theo dữ liệu API; không tự chuyển status.

### Task 6 — Xóa có xác nhận và xử lý stale

**Files:** `DeleteDraftDialog.tsx`, test tương ứng; nối vào list/detail.

**Interfaces:** props `{document:DocumentDetail,onClose():void,onDeleted():void,onConflict():void}`. List lấy detail/version trước xác nhận; sau refetch nếu không còn DRAFT thì không cho xóa.

- [ ] Test đỏ Cancel không gọi DELETE, Confirm gửi id/version đúng, double submit chỉ một request, pending khóa thao tác đóng.
- [ ] Test 409 không xóa UI giả; refresh trạng thái; 403/500 giữ dialog với lỗi; 404 báo đã không tồn tại và cho reload list. Xóa hàng cuối trang cuối tự về trang hợp lệ.
- [ ] Chạy `npx vitest run src/features/documents/components/DeleteDraftDialog.test.tsx src/features/documents/pages/DocumentsPage.test.tsx`, xác nhận FAIL rồi implement minimal và chạy lại PASS.

### Task 7 — Chi tiết, lịch sử, điểm ghép tệp FS-3

**Files:** `DocumentDetailPage.tsx`, `DocumentHistoryTab.tsx`, `DocumentAttachmentsTab.tsx`, `DocumentDetailPage.test.tsx`; ghép detail route Task 2.

**Interfaces:** history tab nhận `documentId:number`; attachments tab nhận `{documentId:number,canManage:boolean}`. canManage theo quyền sửa bản thảo; tải/xem file còn cần quyền xem đối tượng. FS-3 nhận cùng id và quyền, không có auth/token riêng.

- [ ] Test đỏ deep link/reload, 403/404, loading/retry, chuyển id không giữ tab data cũ; tabs keyboard và hiển thị đúng metadata/status.
- [ ] Test history: creator/time/from→to/note, thứ tự ổn định, rỗng/lỗi; không cho frontend tự viết history. Tệp dùng fixture metadata khi mock bật và hiển thị rõ trạng thái chưa ghép FS-3, không có nút upload/download giả thành công.
- [ ] Chạy `npx vitest run src/features/documents/pages/DocumentDetailPage.test.tsx`, xác nhận FAIL rồi implement và chạy lại PASS cùng App tests.
- [ ] Khi FS-3 bàn giao: kiểm tra props, export path, auth, endpoints, allowed types/size, progress/errors, download và delete quyền. Chốt trong contract rồi import component thật vào một điểm DocumentAttachmentsTab; bỏ placeholder và endpoint metadata provisional nếu FS-3 sở hữu data fetch.
- [ ] Test integration FS-3: đổi documentId không lẫn file; Admin mọi đơn vị; staff đúng scope; ready/published chỉ đọc; lỗi upload/download/remove có feedback; không làm mất form/document khi file API lỗi. Chưa có FS-3 thì mục ghép tệp vẫn pending, không ghi toàn bộ FE-3 hoàn tất.

### Task 8 — API thật, regression và nghiệm thu

**Files:** `docs/api/documents-contract.md`, `docs/document-drafts-acceptance.md`; API adapter/test nếu contract thật khác. Chỉ tạo OpenAPI proposal riêng nếu BE cần, không duy trì hai contract thủ công trùng nhau.

- [ ] Nhận BE-3 OpenAPI và đối chiếu từng endpoint, direction/status, pagination, lookup permission, version/ETag, delete, field errors và history. Thiếu endpoint ghi blocker, không âm thầm quay về mock.
- [ ] Xác nhận quyền Admin với backend của mọi route nghiệp vụ được mở; frontend không thể cấp quyền API. BE-3 phải thực thi ma trận object scope và trạng thái; API các chức năng khác chưa hỗ trợ Admin là dependency riêng, không tuyên bố đã sửa backend bằng guard FE.
- [ ] Với `VITE_ENABLE_MOCKS=false`, chạy luồng create→list/filter/page→detail→edit→delete, ba role, 401 refresh, 403, 404, 409; xác nhận Network gọi API thật và response thực sự đổi theo filter.
- [ ] Nghiệm thu ba badge/history bằng fixture backend hợp lệ (không thêm nút publish ngoài scope); kiểm tra danh mục active cho staff, inactive giữ được khi sửa; kiểm tra FS-3 với file thật.
- [ ] Chạy `npm run check` ở front-end; lint 0 warning, prettier, toàn bộ test, TypeScript/build PASS. Kiểm tra browser desktop/mobile, focus/tab/dialog. Ghi phiên bản commit, mock/real, viewport, bước đạt/lỗi vào acceptance.
- [ ] Chạy `detect_changes({repo:'docs',scope:'all'})`; partial/truncated phải chạy lại đầy đủ. Nếu index stale refresh bằng `gitnexus analyze --index-only .` từ repo root. Với nhánh đã commit dùng thêm compare với main. Review callers/processes bị ảnh hưởng.
- [ ] Chỉ commit/push khi người dùng yêu cầu; mỗi commit gồm implementation và test cùng nghiệp vụ, không đưa log/.playwright-mcp vào commit.

## 6. Thứ tự, mốc và tiêu chí hoàn tất

Thực hiện Task 1 → 3 → 4 → 5 → 6 → 7 → 8. Task 2 viết test/quyền trước, hoàn tất route integration cùng Task 4/7. Không chia implementation giữa nhiều người trước khi types/contract Task 1 ổn định.

Theo ticket: bắt đầu 12/11, checkpoint mock 16/11, từ 17/11 nối API thật, hạn 18/11/2026 lúc 18:00 Asia/Saigon. Đây là mốc yêu cầu, không cam kết tiến độ khi BE/FS chưa sẵn sàng.

- **Mốc mock:** Task 1–6 và phần detail/history/mock attachment của Task 7; tests xanh; list/form/delete/scope hoạt động xuyên suốt. Ghi rõ còn thiếu tích hợp tệp thật.
- **Mốc tích hợp:** Task 7 FS-3 và Task 8; check backend đáp ứng Admin mới; làm rõ khác biệt contract trước sửa API client.
- **FE-3 hoàn tất:** đủ 7 mục checklist ảnh, FS-3 đã ghép, API thật đã kiểm chứng nếu bàn giao theo ticket yêu cầu. Nếu chỉ đạt mock thì báo “FE-3 chạy được với mock; BE-3/FS-3 còn pending”, không báo hoàn thành toàn bộ.

Checklist truy vết: danh sách/tabs/filter/page → Task 4; badges → Task 4/7; form → Task 5; delete confirm → Task 6; detail tabs/history → Task 7; ghép FS-3 → Task 7/8; validation/API errors → Task 3/5/6/8; nút đúng quyền/status → Task 1/3/4/7/8.

## 7. Tự review plan

- Đã phân biệt yêu cầu người dùng (Admin toàn quyền, mock được phép) với đề xuất FE (schema/status codes/version/giới hạn summary/form dialog).
- Không thêm chức năng publish/approve; trạng thái ngoài DRAFT chỉ đọc trong FE-3.
- Dữ liệu tệp và văn bản có ranh giới; không trùng việc FS-3 và không giả hoàn tất integration.
- Mỗi task có file, interface, test failure và pass criteria; các điểm race/scope/stale/lookup/mode mock được gắn test.
- Phải đọc lại source/AGENTS và chạy impact khi bắt đầu triển khai; graph UNKNOWN chưa được coi là LOW.
