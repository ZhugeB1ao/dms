# Documents API — FE-3 mock contract v0.1

Status: implemented in MSW; proposed HTTP contract, **not confirmed BE-3 OpenAPI or FS-3 contract**. See [implementation plan](../superpowers/plans/2026-11-14-fe3-document-drafts.md).

## Decisions and scope

- User decision: ADMIN can access every registered application route and all document departments. Existing unfinished routes remain workspace placeholders.
- MANAGER reads and manages drafts in their department. EMPLOYEE reads owned or assigned documents; only owned drafts can be edited/deleted. Each role grants its own scope; multiple roles must not combine a broad read scope with unrelated mutation authority.
- All modifications require DRAFT and current version. Admin does not bypass state or validation. Staff cannot change the responsible department; staff without a department cannot create.
- English UI. No publish, approve, assignment, OCR or file operations added by FE-3.

## Transport and models

Base URL comes from `VITE_API_BASE_URL` (development `/api`). All calls use the existing authenticated Axios client and accept `AbortSignal`. No automatic mock fallback on real API errors.

Authoritative FE definitions: `src/features/documents/types.ts`.

| Model | Shape |
| --- | --- |
| Direction | INCOMING / OUTGOING / INTERNAL |
| Status | DRAFT / READY_TO_PUBLISH / PUBLISHED; other values are displayed as Unknown, read-only |
| DraftInput | direction, summary, documentTypeId, urgencyId, confidentialityId, issuingOrganizationId, departmentId |
| DocumentSummary | DraftInput + id, status, createdBy, assigneeIds[], documentTypeName, issuingOrganizationName, departmentName, createdAt, updatedAt |
| DocumentDetail | Summary + version, lookups.{documentType,urgency,confidentiality,issuingOrganization,department} |
| Lookup | id:number, name:string, isActive:boolean |
| Page | content:DocumentSummary[], totalElements, totalPages, page, size |
| History | id, fromStatus:string/null, toStatus, actorName, occurredAt, note? |
| Attachment | id, fileName, sizeBytes, contentType, uploadedBy, uploadedAt (metadata only) |

IDs are positive numbers; dates use ISO 8601. Summary is trimmed and requires 1–1000 characters (FE proposal). Category IDs must match DOC_TYPE, URGENCY, CONFIDENTIALITY respectively. Organization and department IDs are distinct concepts. Active lookups are required for new selections; updates may keep an unchanged inactive selection. GET detail reports current lookup activity and preserves names for existing selections.

## Endpoints

| Method and path | Request | Response |
| --- | --- | --- |
| GET /documents | direction; optional status/documentTypeId/departmentId; page>=0; size=10/20/50 | Page, scope then filters then count/pagination |
| GET /documents/:id | — | DocumentDetail |
| POST /documents | DraftInput | 201 DocumentDetail, server assigns creator/DRAFT/version=1 |
| PUT /documents/:id | DraftInput + version | DocumentDetail, version increments; direction immutable |
| DELETE /documents/:id?version=N | — | 204, no response JSON |
| GET /documents/:id/history | — | History[], ordered by time then id |
| GET /documents/:id/attachments | — | Attachment[], provisional metadata contract |

Status and ID filters combine with AND. Empty results have totalPages=0. List order is descending id in mock. Create adds a null→DRAFT history entry; editing content does not manufacture status transitions. All detail/history/attachment routes check object access. Mutation checks existing object scope before destination department. Extra client fields such as status, createdBy or assigneeIds cannot grant privileges.

Errors have `{message, fieldErrors?: Record<string,string>}`. A backend `code` may be added; UI uses HTTP status and sanitized string field errors. 400/422 invalid input, 401 no session, 403 denied scope, 404 absent document, 409 stale version or non-DRAFT status. UI preserves form input on failure and requires explicit discard/reload after conflict; it never automatically resubmits stale data.

## Mock mode

Set `VITE_ENABLE_MOCKS=true` in development and restart Vite. Existing `.env` settings are not modified. Both auth and document endpoints use MSW. Seed contains 90 documents, three directions/statuses, two departments, owner/assignee scope, histories and sample attachment metadata. In-memory document changes reset on full browser reload; mock sessions follow the existing auth mock behavior. HMR of handler modules may require a full reload to restart the worker.

For real integration set `VITE_ENABLE_MOCKS=false`. Production builds never enable MSW. No document/file content is persisted to localStorage.

## FE-4 workflow mock

Các operation sau chạy trên cùng kho văn bản MSW với FE-3. Đây là hợp đồng mock phục vụ triển khai FE-4. BE-4 và FS-3 cần xác nhận path, payload, quyền và kiểu response trước khi nghiệm thu API thật.

| Operation | Hợp đồng đang dùng trên mock | BE-4 / FS-3 cần xác nhận |
| --- | --- | --- |
| `GET /documents/:id/workflow/reviewers` | Trả `{id, name}[]` cho tác giả của bản thảo. Reviewer là Manager đang hoạt động cùng đơn vị. | Reviewer được phép nhận theo loại, hướng và đơn vị. |
| `GET /documents/pending-approvals` | Manager nhận việc được giao cho mình. Hỗ trợ `page` từ 0, `size` 10/20/50, `direction` và `documentTypeId`. Trả `content`, `page`, `size`, `totalPages`, `totalElements` sau lọc và `pendingCount` trước lọc. | Nguồn tổng chờ, thứ tự và quyền truy cập inbox. |
| `POST /documents/:id/workflow/transition` | Nhận `action`, `version`, thêm `reviewerId` khi submit hoặc `reason` khi reject/recall. Trả chi tiết mới. Adapter cũng xử lý 204 bằng một lần GET riêng ở trang chi tiết. | Có dùng endpoint tách theo action hoặc ETag, mã lỗi và kiểu response. |
| `GET /documents/:id` và `/history` | Chi tiết có thể thêm reviewer, thời điểm trình, `documentNumber` và `canPublish` theo tài khoản gọi. History thêm `action` và ghi người duyệt, số hoặc lý do trong `note`. | Mã trạng thái, quyền cấp số, cấu trúc và thứ tự phụ của sự kiện. |
| `GET /documents/:id/attachments/:fileId/content` | Trả nội dung tệp mẫu nếu người gọi có quyền xem văn bản và metadata có `canDownload`. Dùng cùng phiên xác thực với Documents. | Cách xem/tải tệp thật và xử lý quyền đọc từ FS-3. |

Mock chuyển `DRAFT` → `PENDING_APPROVAL` → `READY_TO_PUBLISH` → `PUBLISHED` → `RECALLED`. Từ chối chuyển sang `REJECTED`. Manager được giao mới duyệt hoặc từ chối. Quyền cấp số được cấp cho Manager mẫu trên văn bản cùng đơn vị, còn quyền thu hồi áp dụng cho Manager cùng đơn vị khi văn bản đã công bố. Số do mock cấp được lưu cùng phiên bản mới và sự kiện lịch sử. Lý do được trim, chuỗi rỗng trả 422, quyền sai trả 403, và version hoặc trạng thái cũ trả 409.

Kho mock giữ thay đổi trong bộ nhớ của trang. Đổi role qua đăng xuất và đăng nhập trong cùng tab để kiểm luồng nhiều vai trò. Tải lại toàn trang khởi tạo lại dữ liệu mẫu.

## Pending BE-3 and FS-3 handoff

- Confirm endpoints, response envelope, ID types, statuses, pagination, sorting, validation and permissions against OpenAPI. Adapt only `documentsApi`/types when needed; do not treat this proposal as backend approval.
- Confirm version field versus ETag/If-Match and durable DELETE behavior. Backend owns attachment unlink/cleanup; frontend never deletes files before deleting the document.
- Confirm active lookup endpoints work for staff, and detail supports inactive names/IDs.
- Check Admin access at real API level, including other app routes; an FE guard cannot grant backend permissions.
- FS-3 integration point: `DocumentAttachmentsTab({documentId, canManage})`; no separate authentication. Replace provisional metadata fetch with supplied file area if it owns loading. Confirm file types/size, upload progress, download, removal, errors and object permission checks.
- Run real API create→list/filter/page→detail→edit→delete for all roles, 401 refresh, 403/404/409, and deletion with attached files. These checks are pending; MSW tests do not satisfy them.
