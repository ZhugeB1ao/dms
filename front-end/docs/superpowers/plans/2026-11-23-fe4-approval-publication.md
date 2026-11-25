# FE-4 · Kế hoạch triển khai màn hình duyệt và công bố

> Khi được giao triển khai, dùng `executing-plans` hoặc `subagent-driven-development` theo cách làm đã thống nhất. Đánh dấu từng bước sau khi kiểm tra kết quả.

**Goal** — Tác giả chọn người duyệt và gửi bản thảo. Manager xử lý đúng văn bản được giao. Người có quyền cấp số và công bố văn bản đã duyệt. Manager thu hồi kèm lý do. Người xem theo dõi được toàn bộ quá trình trong cùng một trang chi tiết.

**Architecture** — Mở rộng feature `documents` của FE-3. Inbox là trang riêng trong Documents. Review dùng lại `/documents/:id`. API của workflow là ranh giới giữa component và BE-4. MSW dùng chung kho văn bản, phiên bản và lịch sử với FE-3. Mỗi hành động lấy trạng thái cuối từ server.

**Tech Stack** — React 19, TypeScript, React Router, Axios, MSW 3, Vitest, React Testing Library, CSS/Tailwind hiện có và native `<dialog>`.

**Spec** — Checklist FE-4 trong thẻ công việc, thiết kế đã chuẩn bị trong [Figma FE-4](https://www.figma.com/design/jID4Nzj6D5DfM62c4EDpoh?node-id=0-1), [hợp đồng FE-3](../../api/documents-contract.md) và [nghiệm thu FE-3](../../document-drafts-acceptance.md). Phạm vi FE-4 bắt đầu ở bản thảo đã lưu.

## Màn hình và điều hướng đã chọn

| Từ đâu | Người dùng làm gì | Kết quả phải nhìn thấy |
| --- | --- | --- |
| [Documents của Manager](https://www.figma.com/design/jID4Nzj6D5DfM62c4EDpoh?node-id=16-186) | Bấm **Pending approvals** cạnh **Create draft** | Vào [inbox](https://www.figma.com/design/jID4Nzj6D5DfM62c4EDpoh?node-id=2-874). Sidebar vẫn chọn Documents. Số chờ là tổng việc được giao cho mình, độc lập với bộ lọc và trang hiện tại. Có thể mở khi tổng bằng 0. |
| [Bản thảo](https://www.figma.com/design/jID4Nzj6D5DfM62c4EDpoh?node-id=2-1053) | Bấm **Submit for approval**, chọn người duyệt, xác nhận | Thấy trạng thái chờ duyệt. Quyền sửa/xóa bản thảo kết thúc ngay sau thành công. |
| Inbox | Lọc theo loại hoặc hướng văn bản, chuyển trang, bấm **Review** trên một dòng | Mở [chi tiết của chính văn bản đó](https://www.figma.com/design/jID4Nzj6D5DfM62c4EDpoh?node-id=2-970) với ba tab Information, Attachments, Status history. **Back to pending approvals** đưa về đúng bộ lọc và trang. |
| Chi tiết đang chờ | Người được giao bấm **Approve** hoặc [**Reject**](https://www.figma.com/design/jID4Nzj6D5DfM62c4EDpoh?node-id=2-1152) | Giữ người dùng ở chi tiết để thấy kết quả. Inbox bỏ đúng dòng đã xử lý khi quay lại. Nhánh từ chối hiển thị lý do trong [lịch sử](https://www.figma.com/design/jID4Nzj6D5DfM62c4EDpoh?node-id=2-1684). |
| [Ready to publish](https://www.figma.com/design/jID4Nzj6D5DfM62c4EDpoh?node-id=2-1247) | Người có quyền xác nhận **Issue number and publish** | [Chi tiết Published](https://www.figma.com/design/jID4Nzj6D5DfM62c4EDpoh?node-id=2-1343) hiển thị số văn bản server trả về, kể cả sau khi tải lại. |
| Published | Manager mở [Recall document](https://www.figma.com/design/jID4Nzj6D5DfM62c4EDpoh?node-id=2-1427), nhập lý do và xác nhận | Chi tiết và [timeline thu hồi](https://www.figma.com/design/jID4Nzj6D5DfM62c4EDpoh?node-id=2-1522) hiển thị lý do, người thực hiện và thời điểm. |
| Bất kỳ thao tác chuyển trạng thái nào | Server báo [409 Conflict](https://www.figma.com/design/jID4Nzj6D5DfM62c4EDpoh?node-id=2-1593) | Có giải thích và nút tải bản mới. Chỉ mở lại hành động còn hợp lệ sau khi tải. |

Hai điều chỉnh sau buổi thiết kế lấy theo [bản mẫu HTML cục bộ](../../../../output/fe4-documents-list.html): số chờ nằm trong badge nền xanh, và hai liên kết Back dùng cùng kiểu pill tối. File HTML nằm trong thư mục output cục bộ. Dialog dùng nút × ở góc phải, vùng bấm 44 × 44 px và tên truy cập được. Timeline ưu tiên sự kiện mới nhất.

## Global Constraints

- Tuân thủ [AGENTS.md gốc](../../../../AGENTS.md) và [quy tắc frontend](../../../AGENTS.md). UI tiếng Anh, tài liệu bàn giao tiếng Việt. Import nội bộ dùng `@/`. Dùng các dependency đã có.
- Trước khi sửa **mỗi symbol hiện có**, tra `context`, chạy `impact --direction upstream`, ghi caller/process/risk. Báo HIGH hoặc CRITICAL trước khi sửa. Với UNKNOWN, kiểm thêm nơi import/render/gọi bằng `rg`. Trước mỗi commit, chạy `detect-changes --scope all --repo docs` từ gốc và xử lý kết quả partial/truncated.
- Quyền phụ thuộc vai trò, phạm vi đối tượng, người duyệt được giao và trạng thái. Backend quyết định quyền thực tế. UI ẩn thao tác ngoài quyền. Trạng thái lạ tiếp tục dùng fallback chỉ đọc của FE-3.
- Mỗi mutation gửi version hoặc điều kiện cạnh tranh theo OpenAPI. Disable xác nhận đang gửi. Phân biệt thành công của mutation với lỗi tải lại. Dùng AbortSignal và bảo vệ phản hồi cũ khi đổi văn bản, người dùng hoặc bộ lọc.
- Giữ ba luồng Incoming/Outgoing/Internal, phân trang, quản lý bản thảo và deep link của FE-3. Không thêm dependency, global store hay vai trò auth mới chỉ để phục vụ màn hình này.

## Review Focus

| Tình huống dễ lọt | Test chịu trách nhiệm |
| --- | --- |
| Manager cùng đơn vị nhưng văn bản được giao cho Manager khác; tài khoản có nhiều role | GĐ 1, 3 và 4 xác nhận danh sách, GET chi tiết, quyền quyết định và phản hồi 403 theo cùng hợp đồng. |
| Hai người hoặc hai tab cùng duyệt/công bố một phiên bản | GĐ 4–5 chỉ có một kết quả thành công, một sự kiện, một số cấp. Tab đến sau thấy 409 và tải được trạng thái thực. |
| Dòng cuối trang cuối vừa được duyệt hoặc người dùng quay lại inbox đã lọc | GĐ 3–4 bảo toàn bộ lọc, lùi về trang hợp lệ, badge tổng cập nhật cả khi kết quả lọc rỗng. |
| Lý do chỉ có khoảng trắng, đóng dialog, hoặc nhập lý do rồi gặp lỗi | GĐ 4–5 focus trường lỗi, Cancel/Escape không gửi, lỗi có thể sửa giữ nguyên nội dung, 409 yêu cầu tải lại có chủ ý. |
| Lịch sử lặp trạng thái, sự kiện trùng thời điểm, hoặc phản hồi của văn bản trước đến muộn | GĐ 6 kiểm thời điểm tuyệt đối, thứ tự phụ ổn định, mọi lý do và đúng ID đang mở. |

## Khảo sát code và các quyết định cần từ BE-4

Đã làm mới chỉ mục GitNexus và kiểm tra lại năm symbol bằng CLI trên checkout hiện tại. Bảng dưới ghi caller và process mà graph tìm được, bổ sung nơi sử dụng trong source với các kết quả UNKNOWN. Khi triển khai, chạy lại impact cho symbol ngay trước khi sửa.

| Điểm mở rộng | Caller và luồng đã kiểm | Impact tại lúc khảo sát |
| --- | --- | --- |
| `DocumentList` trong `DocumentsPage.tsx` | `DocumentsPage` gọi trực tiếp. Ba luồng GitNexus là Change, Open, Positive. | LOW |
| `DocumentDetailView` trong `DocumentDetailPage.tsx` | `DocumentDetailPage` gọi trực tiếp; graph không gắn process. View giữ dữ liệu, tab và revision. | LOW |
| `AppRouter`, `DocumentHistoryTab` | Source xác nhận `App` render router, `DocumentDetailView` render history. Graph không trả caller/process. | UNKNOWN |
| `canEditDraft` | Source xác nhận bảng, list, detail và form dùng cùng điều kiện; `canDeleteDraft` dùng lại hàm. Graph không trả caller/process. | UNKNOWN |

FE-3 đã có `version`, ba nhãn Draft/Ready to publish/Published, kiểm tra edit/delete theo DRAFT và helper lỗi 409. Route `/approvals` đã giới hạn Manager nhưng đang render `Workspace`. Router cũng đang đưa mọi route cấu hình bắt đầu bằng `/documents/` vào trang danh sách theo hướng. Tab History đang sort tăng dần. Tab Attachments mới đọc metadata.

Mốc đối chiếu trước khi bắt đầu FE-4, ngày 23/11: chạy `npm run check` với runtime mocks đang bật cho demo thì 146/147 test đạt. Test `src/shared/api/http.test.ts:17` kỳ vọng mock mặc định tắt. Chạy lại với `VITE_ENABLE_MOCKS=false` chỉ trong tiến trình kiểm thử thì lint, format, 147/147 test và production build đều đạt. Khi đối chiếu thiết kế, Figma MCP báo hết lượt đọc trên gói Starter; các link ở trên trỏ đến frame đã ghi nhận từ buổi thiết kế trước.

| Cần BE-4/FS-3 xác nhận | Giả định dùng cho mock và cách thay khi tích hợp |
| --- | --- |
| Enum, hướng văn bản áp dụng, từ chối trả về Draft hay Rejected, có được trình lại/khôi phục sau thu hồi? | Fixture minh họa trên văn bản đi, một reviewer, Draft → Pending approval → Ready to publish → Published → Recalled. Nhánh Reject hiển thị Rejected và lý do. Không tự mở quyền sửa/trình lại từ Rejected. Khi BE trả Draft, dùng trạng thái trả về để xét quyền và vẫn giữ event Reject cùng lý do. |
| Ai được trình, danh sách reviewer lấy từ đâu, phạm vi Manager và người được cấp số? | Mock có tác giả bản thảo, Manager được giao và một tài khoản được phép công bố. “Publisher” trong Figma chỉ người thực hiện thao tác. Không suy ra mọi Admin hoặc Manager đều có quyền cấp số. Dùng permission/role+scope do BE xác nhận cho adapter thật. |
| Path, payload, phân trang và tổng chưa lọc, trường version, lỗi 403/404/409, nguồn số, sự kiện và lý do? | Chốt từng operation với OpenAPI, ví dụ request/response đã bỏ dữ liệu cá nhân và bản API đang chạy. FE hiển thị nguyên số server cấp. Phân biệt assignee FE-3 với reviewer FE-4. |
| Reviewer có thể mở nội dung tệp bằng API/URL nào? | FS-3 xác nhận quyền đọc và cơ chế preview/download. Mock có fixture mở được. Nghiệm thu thật phải mở được ít nhất một tệp với tài khoản reviewer. |

## Cấu trúc file FE-4

Cây dưới đây liệt kê các file liên quan trong `front-end/`. Dấu `+` là tạo mới, `~` là chỉnh sửa, `=` là dùng lại.

```text
front-end/
├── docs/api/
│   └── documents-contract.md                ~ Hợp đồng FE-3 và phần bổ sung BE-4
└── src/
    ├── app/
    │   ├── App.test.tsx                     ~ Kiểm route, sidebar và quyền truy cập
    │   └── router/
    │       ├── AppRouter.tsx                ~ Route inbox và redirect link cũ
    │       └── access.ts                    ~ Quyền theo route và hiển thị sidebar
    ├── features/documents/
    │   ├── types.ts                         ~ Kiểu dữ liệu văn bản, sự kiện và lệnh workflow
    │   ├── permissions.ts                   ~ Quyền hành động trên từng văn bản
    │   ├── permissions.test.ts              ~ Các tổ hợp role, scope, reviewer và status
    │   ├── api/
    │   │   ├── documentsApi.ts              = Đọc detail, history và metadata tệp
    │   │   ├── documentErrors.ts            = Thông báo lỗi HTTP của feature
    │   │   ├── documentWorkflowApi.ts       + Reviewer, inbox và lệnh chuyển trạng thái
    │   │   └── documentWorkflowApi.test.ts  + Kiểm request và dữ liệu trả về
    │   ├── pages/
    │   │   ├── DocumentsPage.tsx            ~ Điểm vào inbox và số chờ
    │   │   ├── DocumentsPage.test.tsx       ~ Kiểm nút theo quyền và badge
    │   │   ├── PendingApprovalsPage.tsx     + Danh sách chờ, lọc và phân trang
    │   │   ├── PendingApprovalsPage.test.tsx + Kiểm inbox và điều hướng qua Review
    │   │   ├── DocumentDetailPage.tsx       ~ Dùng cho cả xem và duyệt, giữ tab và refresh
    │   │   ├── DocumentDetailPage.test.tsx  ~ Kiểm trình duyệt, lịch sử và tệp
    │   │   └── DocumentWorkflow.test.tsx    + Kiểm xuyên luồng quyết định, công bố và 409
    │   └── components/
    │       ├── SubmitForApprovalDialog.tsx  + Chọn reviewer và xác nhận trình
    │       ├── DocumentWorkflowActions.tsx  + Điều phối nút, dialog và kết quả thao tác
    │       ├── WorkflowReasonDialog.tsx     + Nhập lý do khi từ chối hoặc thu hồi
    │       ├── DocumentStatusBadge.tsx      ~ Nhãn và màu trạng thái mới
    │       ├── DocumentStatusBadge.test.tsx ~ Kiểm nhãn trạng thái và fallback
    │       ├── DocumentHistoryTab.tsx       ~ Timeline mới nhất trước, hiển thị lý do
    │       └── DocumentAttachmentsTab.tsx   ~ Mở nội dung tệp theo hợp đồng FS-3
    ├── shared/components/
    │   ├── CrudPageLayout.tsx               ~ Tùy chọn nhãn/kiểu nút của hai dialog
    │   └── CrudPageLayout.test.tsx          ~ Mặc định của caller cũ và tùy chọn FE-4
    └── mocks/
        ├── documents.ts                     ~ Dữ liệu chung cho bản thảo và workflow
        ├── handlers.ts                      ~ Đăng ký handler mới
        ├── documentWorkflowHandlers.ts      + Xử lý API workflow giả lập
        └── documentWorkflowHandlers.test.ts + Kiểm quyền, chuyển trạng thái và version
```

**Ranh giới khi viết code.** Router quyết định ai được vào inbox. `permissions.ts` quyết định hành động nào được hiển thị trên văn bản đang mở. `DocumentDetailPage` sở hữu dữ liệu chi tiết và cập nhật các tab sau thao tác; `DocumentWorkflowActions` gọi adapter khi người dùng xác nhận. Path, payload và cách đọc response của BE-4 tập trung ở `documentWorkflowApi.ts`. Test quyền và adapter đặt cạnh file phụ trách; test đi qua nhiều màn hình đặt ở `pages/` và chạy qua router cùng MSW.

### Dialog dùng lại trong FE-4

| Tác vụ | Khung giao diện và phần riêng của Documents |
| --- | --- |
| Submit for approval | `SubmitForApprovalDialog` dùng `CrudFormDialog` từ `src/shared/components/CrudPageLayout.tsx`. Feature cung cấp select reviewer, lỗi trường và lệnh submit. |
| Reject / Recall | Cả hai dùng `WorkflowReasonDialog` trên cùng `CrudFormDialog`. Dùng chung textarea bắt buộc, trim, focus lỗi. Thay tiêu đề, ngữ cảnh, nhãn xác nhận và lệnh theo action; Recall hiển thị số văn bản. |
| Approve | Nút ở trang detail thực hiện quyết định theo thiết kế Review. |
| Issue number and publish | Dùng `ConfirmDeactivateDialog` với nội dung xác nhận, nhãn publish/publishing và kiểu nút chính trung tính. Component hiện cho đổi nhãn nhưng gắn cứng màu đỏ ở cả tiêu đề và nút. |
| 409 / Reload document | Tái dùng thông báo của `documentError` và mẫu reload của `DeleteDraftDialog`. Hiển thị trạng thái xung đột tại nơi thực hiện hành động, thay xác nhận bằng Reload document. Với Approve trực tiếp, hiển thị trên detail. |

Khi triển khai GĐ 2, bổ sung vào `CrudFormDialog` khả năng đặt nhãn submit/pending và kiểu nút cảnh báo cho thao tác cần nhấn mạnh. GĐ 5 bổ sung kiểu xác nhận trung tính cho `ConfirmDeactivateDialog`. Giữ mặc định Create/Save/Saving và màu cảnh báo như hiện tại cho các caller cũ. Hai component nghiệp vụ mới chỉ phụ trách nội dung, validation và callback. Kiểm nút × có vùng bấm 44 × 44, Escape/Cancel, khóa khi đang gửi và trả focus sau đóng.

GitNexus trả UNKNOWN cho cả hai khung dialog, chưa xác định được caller/process qua graph. Đã đối chiếu JSX trong Documents, Categories, Departments và Organizations. Trước khi sửa shared, chạy lại impact trên index hiện hành; thêm test mặc định cũ và tùy chọn mới trong `src/shared/components/CrudPageLayout.test.tsx`, rồi chạy test các màn hình dùng chung.

## Trình tự triển khai

Đường dẫn code dưới đây tương đối với `front-end/`. Các tên mới là đề xuất nội bộ FE. Đường dẫn HTTP và enum wire cuối cùng theo OpenAPI. Với từng nhóm test, thêm ca trước, chạy lệnh để thấy đúng lỗi hành vi, viết phần tối thiểu, chạy lại cùng lệnh rồi refactor khi còn xanh. Đặt các test tích hợp đi qua router và MSW để những lỗi nối màn hình cũng bị phát hiện.

### GĐ 1 · Hợp đồng, quyền và dữ liệu mock dùng chung

- [ ] Ghi bảng operation trong `docs/api/documents-contract.md` với hai cột “mock đề xuất” và “đã xác nhận BE-4”. Bao phủ reviewer hợp lệ, inbox và tổng, submit, approve, reject, publish, recall, history, attachments. Chốt cả đầu vào, dữ liệu trả về, quyền và mã lỗi cho từng operation.
- [ ] **Red** — thêm ma trận role × scope × reviewer × status trong `src/features/documents/permissions.test.ts`, thêm ca status lạ, phiên bản cũ, không có quyền và nhiều role. Bổ sung test mới bên cạnh adapter/handler. Chạy `npm test -- permissions.test documentWorkflowApi.test documentWorkflowHandlers.test`.
- [ ] **Green** — mở rộng `src/features/documents/types.ts`, `permissions.ts`, `components/DocumentStatusBadge.tsx` và test badge. Thêm `api/documentWorkflowApi.ts` trong feature, `src/mocks/documentWorkflowHandlers.ts` và đăng ký ở `src/mocks/handlers.ts`. Dùng `src/mocks/documents.ts` cùng auth/scope với `documentHandlers.ts`; kiểm tra thứ tự handler cụ thể trước matcher `/documents/:id`. Giữ dữ liệu FE-3 có trước vẫn đọc được.
- [ ] Quy ước adapter FE: `reviewers(id, signal)` trả danh sách người có thể chọn; `pending(query, signal)` trả items, tổng theo lọc, thông tin trang. Badge dùng tổng của truy vấn không lọc theo Manager đăng nhập (hoặc trường tổng chuyên biệt nếu BE cung cấp). `transition(id, command, signal): Promise<DocumentDetail | null>` trả chi tiết khi server gửi body hoặc null cho 204. Với 204, trang ghi nhận thao tác thành công, khóa các nút dùng phiên bản cũ và gọi GET riêng. Nếu GET lỗi, Retry chỉ gọi GET; nhận detail mới rồi mới tính lại quyền. Command là union của submit (reviewerId), approve, reject (reason), publish, recall (reason); mỗi nhánh có version.
- [ ] Chốt quyền mock để có thể chạy test: tác giả gửi Draft thuộc phạm vi của mình; reviewer là Manager đang hoạt động cùng đơn vị; chỉ Manager được giao mới duyệt/từ chối Pending. Manager cùng đơn vị khác vẫn đọc được detail, lịch sử và tệp theo quyền FE-3. Với mock, gán quyền publish cho tài khoản Manager mẫu trong phạm vi của tài khoản; recall yêu cầu Manager đúng phạm vi với Published. Kiểm riêng quyền đọc và quyền quyết định. Khi BE-4 xác nhận quy tắc khác, sửa ma trận, adapter và test tương ứng.
- [ ] Chạy lại nhóm test trên và `npm test -- DocumentStatusBadge documentHandlers.test documentsApi.test`. Dùng fixture riêng cho hai Manager cùng đơn vị và hai nhánh quyết định. Dùng lại `resetMock()/resetDocuments()` để trả danh sách, history, version và bộ đếm cấp số về dữ liệu ban đầu giữa các test. Giữ ổn định các ca FE-3 kiểm 30 văn bản mỗi hướng và ID mẫu. Các mutation được thêm cùng ca kiểm thử trong giai đoạn sở hữu chúng.

### GĐ 2 · Trình bản thảo và chọn đúng người duyệt

- [ ] **Red** — trong `pages/DocumentDetailPage.test.tsx` và `src/mocks/documentWorkflowHandlers.test.ts`, kiểm bản thảo hợp lệ mở dialog, chưa chọn thì không gửi, Cancel không đổi dữ liệu, chọn reviewer → lưu đúng người và version. Danh sách rỗng/lỗi tải có thông báo; reviewer vừa mất quyền được server từ chối. Chạy `npm test -- DocumentDetailPage documentWorkflowHandlers`.
- [ ] **Green** — thêm `components/SubmitForApprovalDialog.tsx` trong feature. Nối nút trên chi tiết bản thảo với adapter và handler submit. Dùng native select, label, focus đầu tiên và danh sách reviewer theo tài liệu. Sau thành công hiển thị trạng thái mới, thông báo và refresh history. Xác nhận nút sửa/xóa biến mất ở chi tiết lẫn danh sách khi quay lại.
- [ ] Chạy lại nhóm test. Nghiệm thu lát cắt này bằng một bản thảo thử: tác giả gửi đúng một lần, tải lại còn trạng thái chờ và có lịch sử ghi người trình/người nhận.

### GĐ 3 · Inbox nằm trong Documents và điều hướng hai chiều

Inbox có header riêng với số chờ, hai bộ lọc loại/hướng văn bản và một liên kết Review trên mỗi dòng. Dùng `Select` cho bộ lọc và dùng lại `CrudPagination` từ `src/shared/components/CrudPageLayout.tsx` cho phân trang 10/20/50. Các quyết định Approve/Reject thuộc trang chi tiết.

- [ ] **Red** — thêm `pages/PendingApprovalsPage.test.tsx`, cập nhật `pages/DocumentsPage.test.tsx` và `src/app/App.test.tsx`. Manager thấy badge, kể cả 0; Employee và tài khoản chỉ có Admin theo quyền inbox hiện tại đều không thấy nút, truy cập trực tiếp nhận 403. Kiểm sidebar, link cũ, list rỗng/loading/error/retry, hai bộ lọc, phân trang, URL quay lại và count tổng độc lập với filter. Chạy `npm test -- PendingApprovalsPage DocumentsPage App.test`.
- [ ] **Green** — dùng route chuẩn `/documents/pending-approvals` để sidebar Documents active tự nhiên; xử lý route này trước nhánh danh sách theo hướng trong `src/app/router/AppRouter.tsx`. Trong `access.ts`, đặt `showInSidebar: false` cho cả route chuẩn lẫn `/approvals`; cả hai giữ guard Manager. Route cũ redirect bằng replace và bảo toàn query. Kiểm sidebar của Manager chỉ có một mục Documents và deep link hoạt động sau đăng nhập.
- [ ] Thêm `pages/PendingApprovalsPage.tsx`. Trong `pages/DocumentsPage.tsx`, đặt link + badge cạnh Create draft. Tại inbox hiển thị Summary, Submitted by, Department, Submitted, Review. Lưu filter/page trong query string, đưa ngữ cảnh nguồn qua router state với đường dẫn nội bộ hợp lệ. Review mở đúng `/documents/:id`. Back trên detail và inbox là link kiểu pill; mở chi tiết trực tiếp vẫn có đường về Documents theo hướng.
- [ ] Chạy lại nhóm test. Kiểm Manager A và B nhận hai inbox riêng, trang cuối rỗng sau xử lý tự về trang còn dữ liệu, badge lỗi tải có trạng thái phân biệt với 0.

### GĐ 4 · Duyệt, từ chối và xử lý xung đột

- [ ] Với response 204, mô phỏng GET kế tiếp lỗi rồi thành công. Kiểm thông báo đã ghi nhận quyết định, hành động cũ bị khóa, chỉ có một mutation và GET cuối trả version mới. Với 409, đóng dialog rồi mở lại cũng phải giữ khóa đến khi lấy được detail mới. Kiểm trên cả nút Approve trực tiếp và form Reject.

- [ ] **Red** — thêm `pages/DocumentWorkflow.test.tsx` và ca MSW cho đúng/sai reviewer, approve thành công, reject với chuỗi rỗng/khoảng trắng, reject hợp lệ, lỗi API, Cancel, nhấn đôi và hai tab dùng cùng version. Chạy `npm test -- DocumentWorkflow documentWorkflowHandlers`.
- [ ] **Green** — thêm `components/DocumentWorkflowActions.tsx` để trang detail chỉ điều phối dữ liệu và tab. Thêm `components/WorkflowReasonDialog.tsx` cho reject và recall, truyền action, tài liệu, callback. Dùng `FormData`, trim, báo lỗi có liên kết đến textarea, trả focus đúng khi đóng; nếu nút mở đã biến mất thì focus tiêu đề hoặc thông báo. Bổ sung handler approve/reject dùng cùng version và lịch sử.
- [ ] Tái dùng `api/documentErrors.ts` và cơ chế reload ở detail. Với 409, hiển thị lỗi, dừng gửi lại, cho người dùng tải bản mới rồi tính lại quyền. Với 400/422 giữ nội dung và hiển thị lỗi trường; với 403/404 hiển thị mất quyền hoặc văn bản không còn. Chỉ phát thông báo thành công sau khi server xác nhận. Nếu mutation đã thành công nhưng đọc lại lỗi thì cho retry đọc.
- [ ] Chạy lại nhóm test và thực hành Review → Reject và Review → Approve trên **hai văn bản khác nhau**. Sau mỗi quyết định kiểm count giảm đúng một, lịch sử thêm đúng một event và nút quyết định biến mất. Mở lại inbox đang lọc để xác nhận dòng đã xử lý biến mất.

### GĐ 5 · Cấp số, công bố và thu hồi

- [ ] **Red** — mở rộng hai test file GĐ 4 cho người được phép publish, sai trạng thái/quyền, hai lần xác nhận cùng version, trạng thái sau reload; kiểm recall chỉ ở Published đúng quyền Manager và bắt buộc lý do đã trim. Chạy `npm test -- DocumentWorkflow documentWorkflowHandlers`.
- [ ] **Green** — thêm confirm publish trong workflow actions, nối handler publish và recall, dùng lại reason dialog. Lấy số từ response hoặc đọc lại detail. Hiển thị số trên Information sau khi công bố và trong sự kiện tương ứng. Mock mô phỏng cấp số, đổi trạng thái và ghi lịch sử trong cùng một thao tác thành công. Một lỗi 409 không được sinh thêm số hoặc event.
- [ ] Chạy lại nhóm test và `npm test -- DocumentMutation DocumentsRegression`. Kiểm danh sách/chi tiết đều khóa edit/delete ngoài Draft, kể cả mở form khi còn Draft rồi tài liệu đổi trạng thái ở tab khác. Sau thu hồi vẫn tra được việc cấp số trước đó và lý do thu hồi.

### GĐ 6 · Timeline và xem nội dung tệp

- [ ] **Red** — bổ sung test tab trong `pages/DocumentDetailPage.test.tsx`. Dữ liệu có timezone offset khác nhau, hai sự kiện cùng thời điểm, hai bước lặp trạng thái, lý do từ chối/thu hồi, history cũ chỉ có note, tệp có thể mở/cấm đọc. Chạy `npm test -- DocumentDetailPage DocumentsRegression`.
- [ ] **Green** — sửa `components/DocumentHistoryTab.tsx` sắp theo thời điểm tuyệt đối giảm dần, dùng sequence từ BE để phân xử khi trùng (mock dùng id giảm dần). Mỗi mục có hành động, actor, thời điểm và chi tiết phù hợp: người duyệt, số hoặc lý do. Sau mutation và reload, chỉ tab của document hiện tại được cập nhật.
- [ ] Nối `components/DocumentAttachmentsTab.tsx` với cơ chế xem/tải được FS-3 cho phép. Reviewer mở được nội dung qua luồng có kiểm quyền. Xử lý tệp thiếu hoặc quyền vừa đổi. Mock minh họa được thao tác mở; ghi trạng thái phụ thuộc nếu chưa có endpoint thật.
- [ ] Chạy lại nhóm test, kiểm tab bằng bàn phím, focus, tên nút ×, trạng thái loading/empty/error, phép đọc của người chỉ xem và hiển thị trên màn hình hẹp.

### GĐ 7 · Nối API thật và nghiệm thu tám tiêu chí

**Phân biệt môi trường nghiệm thu.** MSW hiện giữ văn bản trong bộ nhớ của từng trang. Trong các bước mock trên, “tải lại” là GET lại hoặc quay lại route trong cùng phiên SPA. Để chứng minh xung đột trên mock, gửi hai quyết định dùng cùng version tới cùng một MSW store; trong UI dùng response 409 được điều khiển để kiểm Reload. Hard refresh, hai tab độc lập và chuyển tài khoản qua nhiều trình duyệt dùng chung một văn bản là các ca trên API thật ngày 24/11. Nếu chưa có môi trường này thì ghi Blocked cho các ca tương ứng.

- [ ] **23/11 — mốc demo mock.** Trên MSW, dùng các tài khoản thử cho tác giả, đúng/sai reviewer, người công bố và Manager thu hồi. Demo hai nhánh độc lập, kiểm hai nút Back, số chờ, số văn bản, thứ tự timeline và 409. Ghi kết quả thực tế theo từng mục.
- [ ] **24/11 — mốc API thật.** Đối chiếu OpenAPI BE-4 (mốc phụ thuộc theo thẻ là 20/11) với bảng operation GĐ 1. Tắt runtime mocks, kiểm gateway trỏ đúng dịch vụ văn bản, nhất là `/documents` dùng chung tên với OCR. Chạy lại hai nhánh bằng browser với dữ liệu thử, refresh trang sau publish/recall và mở nội dung tệp thật. Ghi version OpenAPI, môi trường, role, ID thử, expected/actual. Phần chưa có BE-4/FS-3 ghi **Blocked**, tách khỏi kết quả **Pass trên mock**.
- [ ] **Trước 18:00 ngày 25/11 — bàn giao.** Chạy `npm run check` từ `front-end/` ở cấu hình mặc định của test (runtime mocks tắt). Chạy `node .gitnexus/run.cjs detect-changes --scope all --repo docs` từ gốc; nếu CLI bị khóa DB, dùng MCP tương đương. Kết quả partial/truncated cần chạy lại và xác minh. Review diff, hồi quy FE-3 và ghi từng tiêu chí dưới đây là Pass/Fail/Blocked có bằng chứng. Chỉ báo hoàn thành FE-4 khi luồng API thật đáp ứng tiêu chí tương ứng.

| Checklist thẻ FE-4 | Bằng chứng để đánh Pass |
| --- | --- |
| 1. Trình bản thảo, chọn người duyệt | Đúng tác giả/phạm vi gửi được, đúng reviewer nhận được sau reload. |
| 2. Inbox Manager và tổng chờ | Đúng tổng, đúng danh sách theo người nhận, filter/page và số 0 hoạt động. |
| 3. Xem văn bản/tệp, duyệt/từ chối | Mở tệp bằng reviewer, Approve và Reject đều chạy, lý do từ chối bắt buộc và tra lại được. |
| 4. Cấp số và công bố | Đúng quyền, số do server cấp hiển thị sau refresh, không cấp trùng trên một lần chuyển trạng thái. |
| 5. Thu hồi cho Manager | Đúng trạng thái và phạm vi, yêu cầu lý do, có event sau reload. |
| 6. Timeline chi tiết | Mới nhất trước, đúng người/giờ/số/lý do, đủ mọi lần chuyển trạng thái. |
| 7. Khóa chỉnh sửa ngoài Draft | Kiểm cả list, detail và form đã mở trước khi trạng thái đổi. |
| 8. Thông báo thành công và 409 rõ ràng | Thành công có thông báo; dùng hai tab tái hiện lỗi, tải lại đúng trạng thái, không gửi lặp. |

## Kết quả triển khai mock

- Playwright trên localhost đã kiểm hai nhánh với văn bản đi 31 và 37. Tác giả trình duyệt, Manager mở inbox từ Documents, tải tệp mẫu, duyệt, công bố có số và thu hồi văn bản 31. Manager từ chối văn bản 37. Inbox giữ bộ lọc khi quay lại, số chờ giảm từ 2 xuống 0.
- Vitest và MSW dùng lại API và router của feature để kiểm xung đột version, 204 rồi GET lỗi, quyền xem của Manager cùng đơn vị và quyền quyết định của reviewer được giao. Trường hợp quyết định thành công rồi GET trả 403 vẫn giữ thông báo thành công, đồng thời ẩn nội dung chi tiết.
- API thật đang chờ OpenAPI BE-4 và hợp đồng xem/tải FS-3. Các operation đang chạy và giả định về quyền, trạng thái được ghi trong [hợp đồng mock](../../api/documents-contract.md#fe-4-workflow-mock).
