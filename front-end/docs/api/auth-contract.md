# DMS auth proposal v0.1.0

Account management extension: login/me/refresh/change-password now read the same mock account store as `/users`. Disabled accounts cannot log in or refresh; disabling/resetting revokes old synthetic session metadata. `/auth/me` and login keep the original User schema; expanded profile is `/users/me`. All account/password mutations reset on reload. See `users-contract.md`; these additions do not imply real backend integration.

FE tự chốt và dùng để triển khai mock, không yêu cầu BE xác nhận. OpenAPI nằm ở
`openapi-auth.proposal.yaml` (biểu diễn JSON, hợp lệ theo cú pháp YAML).

- Base URL mặc định: http://localhost/api/v1, đổi qua VITE_API_BASE_URL.
- Login trả accessToken/expiresIn/user; me trả User trực tiếp. expiresIn là giây.
- Một role trong roles: ADMIN, MANAGER, EMPLOYEE; departmentId nullable cho Admin.
- Access token chỉ trong bộ nhớ, 5 phút; refresh session giả 8 giờ.
- HttpOnly cookie là kiến trúc đề xuất cho BE, không phải cookie thật của MSW.
  Khi có BE: kiểm tra Secure/SameSite/Path/Domain/CORS/credentials/CSRF theo origin thật.
- Lỗi JSON: code, message, fieldErrors tùy chọn. 401: chưa có phiên/token hết hạn;
  403: thiếu quyền; 422: validation/sai mật khẩu hiện tại; 429/500: kịch bản kiểm thử.
- Login sai không refresh. Request protected 401 chỉ replay một lần, refresh lỗi logout.
- Logout và đổi mật khẩu thành công trả204 không body. Forgot trả202 và message
  trung tính, không gửi email thật. Mật khẩu mới 8–128 ký tự.
- Đổi mật khẩu hủy phiên hiện tại; mật khẩu demo mới giữ trong bộ nhớ mock và reset
  khi reload trang (giới hạn demo được công khai, không phải lưu trữ user thật).
- Metadata phiên tổng hợp lưu sessionStorage với namespace dms-mock-session-v1
  để thử reload; không lưu password hay access token trong storage.
- API demo/documents/a và /b chỉ chứng minh quyền phạm vi, không thuộc CRUD.
- Kịch bản demo/session nhận access-expired hoặc refresh-expired; chỉ có ở mock.

## Ví dụ

Login: POST /auth/login với {"email":"employee@demo.test","password":"Demo12345!"}.
Response200 có token, expiresIn=300, user.id=employee, roles=[EMPLOYEE],
departmentId=office-a. GET /demo/documents/a trả200; /b trả403 cho tài khoản này.

Để nối BE, tắt worker, thay baseURL, sửa mapping trong authApi.js nếu schema đổi.
Không đặt logic mock vào component. Không xem kết quả mock là kiểm tra BE thật.
