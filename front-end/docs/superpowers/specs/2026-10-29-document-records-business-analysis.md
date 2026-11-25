# Phân tích nghiệp vụ đề xuất — hệ thống quản lý hồ sơ/công văn

> Cập nhật FE-3 ngày 15/11/2026: người dùng đã chốt Admin có toàn quyền trên các route và mọi đơn vị. Ma trận Admin trong tài liệu lịch sử này đã được thay thế bởi [plan FE-3](../plans/2026-11-14-fe3-document-drafts.md) và [contract documents](../../api/documents-contract.md). Toàn quyền vẫn tuân thủ validation, trạng thái DRAFT và version khi sửa/xóa; backend thật phải thực thi quyền tương ứng.

Ngày: 29/10/2026. Nguồn: tên đề tài và checklist frontend người dùng cung cấp.
Đây là mô hình làm việc do FE đề xuất khi chưa có tài liệu BE, không phải quy trình
đã khảo sát hoặc đặc tả pháp lý. Theo yêu cầu mới, không cần BE xác nhận để tiến hành.

## 1. Mục đích

Tập trung hồ sơ và công văn, biết tài liệu thuộc hồ sơ nào, ai phụ trách, hạn xử lý
và trạng thái hiện tại. Người dùng chỉ truy cập dữ liệu trong phạm vi được giao.

## 2. Phân biệt đối tượng

| Đối tượng | Ý nghĩa | Dữ liệu chính đề xuất |
|---|---|---|
| Công văn | Văn bản đến/đi cần tiếp nhận, xử lý hoặc phát hành | id, loại đến/đi, số ký hiệu, trích yếu, nơi gửi/nhận, ngày văn bản, phòng phụ trách, người tạo/người xử lý, hạn xử lý, trạng thái |
| Hồ sơ | Tập hợp công văn/tài liệu của một vụ việc hoặc công việc | id, mã, tên, mô tả, phòng phụ trách, người phụ trách, ngày mở/đóng, trạng thái |
| Công việc xử lý | Một lần giao người thực hiện trên công văn | công văn, người giao, người nhận, hạn, tiến độ, kết quả |
| Tệp đính kèm | Nội dung file đi cùng hồ sơ/công văn | tên, loại, dung lượng, người tải lên, thời điểm, id lưu trữ |
| Nhật ký | Lịch sử các thao tác có ý nghĩa | đối tượng, hành động, người thực hiện, thời gian, trạng thái trước/sau |
| Người dùng/phòng ban/danh mục | Dữ liệu tổ chức và phân loại | tài khoản, role, phòng ban, loại văn bản, độ ưu tiên |

Một công văn có nhiều tệp và công việc; nhiều công văn thuộc một hồ sơ qua liên
kết, không sao chép file. Trong mô hình đề xuất, công văn có thể chưa gắn hồ sơ và
có thể được tham chiếu ở nhiều hồ sơ. Quyền xem hồ sơ không tự động cấp quyền tải
mọi file của công văn liên kết. Mô hình quan hệ này là đầu vào cho giai đoạn CRUD sau.

## 3. Các luồng nghiệp vụ đề xuất

### Công văn đến

Tiếp nhận → kiểm tra/phân loại → giao xử lý → người nhận cập nhật kết quả →
quản lý kiểm tra, hoàn tất hoặc trả lại → liên kết hồ sơ/lưu trữ.

- Manager tiếp nhận/phân công trong phòng; Employee cập nhật công việc được giao.
- Hạn xử lý tạo nhãn quá hạn từ ngày hạn và trạng thái, không thay thế trạng thái.
- Trả lại phải có lý do, quay về đang xử lý và giữ lịch sử.

### Công văn đi

Employee/Manager soạn nháp → gửi duyệt → Manager duyệt hoặc trả lại → phát hành
→ liên kết hồ sơ/lưu trữ. Chỉ bản đã duyệt được phát hành; bản đã phát hành không
sửa trực tiếp nội dung. Tạm đề xuất không tự duyệt bản do chính mình soạn.

### Hồ sơ

Tạo hồ sơ mở → thêm/liên kết tài liệu → cập nhật công việc → đóng hồ sơ khi hoàn
tất → lưu trữ. Khi đóng, nội dung chỉ đọc; mở lại là thao tác riêng của Manager,
có lý do và nhật ký. Chưa đặt thời hạn lưu trữ hay quy trình hủy tài liệu.

### Tài khoản

Admin tạo/gán role/phòng ban → user đăng nhập → nhận menu và phạm vi tương ứng →
đổi mật khẩu hoặc gửi yêu cầu quên mật khẩu → logout/hết phiên.
Không tự đăng ký tài khoản nghiệp vụ trong phạm vi này.

## 4. Vai trò và phạm vi dữ liệu

| Vai trò | Vai trò nghiệp vụ | Phạm vi mặc định |
|---|---|---|
| Admin | Quản trị tài khoản, phòng ban, danh mục; xem tổng quan hệ thống | Dữ liệu cấu hình hệ thống; không mặc nhiên xem nội dung tất cả công văn/hồ sơ |
| Manager | Quản lý, phân công, duyệt, hoàn tất và đóng hồ sơ | Phòng ban của mình |
| Employee | Soạn tài liệu, xử lý việc, xem hồ sơ được giao | Do mình tạo hoặc được phân công/cho phép |

Không có quy tắc Admin tự kế thừa quyền Manager. Mỗi tài khoản demo có đúng một
role ADMIN/MANAGER/EMPLOYEE, đặt trong mảng roles để nhất quán model FE.
User có departmentId; dữ liệu tài liệu có departmentId, createdBy, assigneeIds.
Ẩn menu và guard theo role là bước đầu; kiểm tra phạm vi đối tượng là bước riêng.
Mock phải phản ánh phân biệt 401 chưa có phiên và 403 đã có phiên nhưng không đủ quyền.

## 5. Menu và route cho FE foundation

| Menu | Route | Admin | Manager | Employee |
|---|---|---|---|---|
| Tổng quan | /dashboard | Tổng quan hệ thống | Tổng quan phòng | Tổng quan cá nhân |
| Công văn đến | /documents/incoming | Không | Có | Có, theo phạm vi |
| Công văn đi | /documents/outgoing | Không | Có | Có, theo phạm vi |
| Hồ sơ | /records | Không | Có | Có, theo phạm vi |
| Công việc của tôi | /tasks | Không | Có | Có |
| Chờ duyệt | /approvals | Không | Có | Không |
| Người dùng | /admin/users | Có | Không | Không |
| Phòng ban | /admin/departments | Có | Không | Không |
| Danh mục | /admin/categories | Có | Không | Không |
| Đổi mật khẩu | /change-password | Có | Có | Có |

Các route public: /, /login, /forgot-password, /403, trang404 ở URL không tồn tại.
Route nghiệp vụ trong ticket foundation chỉ cần trang khung có tiêu đề, mô tả
phạm vi và dữ liệu minh họa khi cần kiểm tra quyền; không hàm ý đã làm CRUD.

## 6. Nhóm API cần định hướng

- Auth/phiên: login, me, refresh, logout, forgot-password, change-password.
- Tổ chức: users, departments, categories.
- Tài liệu: documents?direction=INCOMING/OUTGOING; chi tiết, tệp, lịch sử.
- Hồ sơ: records, liên kết công văn vào hồ sơ, đóng/mở lại.
- Xử lý: tasks, phân công, gửi kết quả; approvals, duyệt/trả lại/phát hành.

Lần này chỉ đặc tả và triển khai mock nhóm auth cùng dữ liệu tối thiểu để chứng
minh phân quyền/phạm vi. API CRUD nhóm khác được định hướng, chưa đưa vào checklist
hoàn thành hiện tại. Không mở rộng sang OCR, chữ ký số, email thật, tích hợp lưu
trữ file, hoặc quy trình hành chính chuyên ngành khi chưa có yêu cầu.

## 7. Quy ước FE chủ động chốt cho mock v0.1

- Base URL logic /api/v1. Endpoint auth giữ tên rõ ràng, tài liệu có version.
- User: id, email, displayName, roles, departmentId; role lạ bị từ chối mặc định.
- Access token giữ trong bộ nhớ; TTL mock 5 phút. Refresh session TTL mock 8 giờ.
- Đề xuất BE tương lai cấp refresh cookie HttpOnly; mock chỉ giả lập phiên,
  không khẳng định có bảo mật cookie HttpOnly thật.
- Mật khẩu mock: 8–128 ký tự; confirm phải khớp. Không coi đây là chính sách BE.
- Đổi mật khẩu thành công: thu hồi phiên mock và chuyển về login.
- Quên mật khẩu: phản hồi trung tính; không gửi email thật hay trả reset token cho UI.
- Tài khoản bị khóa trả mã riêng; user không được tự chọn role trên form login.
- Không chờ xác nhận BE: triển khai và nghiệm thu FE theo v0.1; sau này dùng adapter
  để ánh xạ contract khác của BE và chạy lại kiểm tra tích hợp.

## 8. Phạm vi được hoàn thành ở lần triển khai tiếp theo

Toàn bộ checklist foundation: router, lint/format, layout/menu có nghĩa nghiệp vụ,
3 role, login/forgot/change-password, guard403/404, mock auth theo proposal FE,
refresh có giới hạn, kiểm thử và hướng dẫn chạy một lệnh.

"Hoàn thành FE với mock" không phải "hoàn thành mọi CRUD của đề tài" hay "đã
tích hợp BE thật". Giai đoạn BE thật không chặn việc hoàn thành foundation.
