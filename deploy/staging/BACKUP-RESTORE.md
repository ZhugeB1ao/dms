# Sao lưu và khôi phục staging

Staging chạy trên một máy duy nhất (MacBook), nên nếu ổ đĩa hỏng hoặc Docker volume bị xoá nhầm thì mất hết
dữ liệu. Tài liệu này mô tả cách sao lưu tự động hằng ngày, nơi cất bản sao lưu, và **cách khôi phục từng bước**.

## 1. Tổng quan

| Hạng mục | Chi tiết |
|---|---|
| Sao lưu gì | **PostgreSQL**: mọi database `*_db` (mỗi cái một file `pg_dump -Fc`) và danh sách role (`globals.sql`). **MinIO**: toàn bộ bucket `attachments` (tệp đính kèm). |
| Khi nào | Mỗi ngày **12:30** (launchd). Máy ngủ thì chạy bù khi thức dậy. **Máy tắt hẳn thì hôm đó không có bản sao lưu.** |
| Lưu ở đâu | (1) Trên máy: `deploy/staging/backups/`. (2) **Ngoài máy: Cloudflare R2**, bucket `dms-backup`. |
| Giữ bao nhiêu | **7 bản gần nhất** ở cả hai nơi, bản cũ hơn tự xoá. |
| Bảo mật | Mỗi bản được **mã hoá AES-256** bằng `BACKUP_PASSPHRASE` trước khi rời máy, kèm checksum SHA-256. |
| Cần gì | Docker đang chạy, staging đang chạy (cần container `postgres` và `minio`). Không cần cài thêm công cụ nào khác. |

Một bản sao lưu là một file `dms-backup-AAAA-MM-DD_HHMM.tar.gz.enc` (kèm `.sha256`). Sau khi giải mã có:
`<db>.dump`, `globals.sql`, `minio/` (các tệp), `minio.sha256`, `counts.txt` (số hàng từng bảng lúc sao lưu), `manifest.txt`.

## 2. Thiết lập một lần

### 2.1 Tạo bucket R2 và khoá truy cập

1. Cloudflare Dashboard → **R2 Object Storage** → **Create bucket**, tên `dms-backup`.
2. Trong trang R2, ghi lại **S3 API endpoint** dạng `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`.
3. **Manage R2 API Tokens → Create API token**: quyền **Object Read & Write**, chỉ áp dụng cho bucket `dms-backup`.
   Lưu lại **Access Key ID** và **Secret Access Key** (Secret chỉ hiện một lần).

### 2.2 Tạo file cấu hình

```bash
cd deploy/staging/backup
cp .backup.env.example .backup.env
chmod 600 .backup.env
# Điền R2_ENDPOINT, R2_BUCKET, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY
# Tạo passphrase:  openssl rand -hex 32   rồi điền vào BACKUP_PASSPHRASE
```

**Cảnh báo vào nhóm chat (Discord):** tạo kênh riêng (ví dụ `#canh-bao-backup`) → Cài đặt kênh → **Tích hợp** → **Webhook** → Sao chép URL, rồi điền vào `ALERT_WEBHOOK_URL` trong `.backup.env`. URL này là bí mật như mật khẩu. Để trống thì chỉ có thông báo macOS trên máy.

> **Quan trọng:** hãy lưu `BACKUP_PASSPHRASE` vào trình quản lý mật khẩu cá nhân, ở nơi KHÁC với bản sao lưu.
> Mất passphrase nghĩa là **không giải mã được bất kỳ bản sao lưu nào**. File `.backup.env` đã nằm trong
> `.gitignore`, không bao giờ commit.

### 2.3 Chạy thử và bật lịch

```bash
cd deploy/staging
bash backup/backup.sh                      # chạy thật một lần, phải thấy "HOAN TAT"
tail -20 logs/backup.log

sed "s#/DUONG/DAN/TOI/deploy/staging#$(pwd)#g" backup/com.dms.staging-backup.plist.example \
  > ~/Library/LaunchAgents/com.dms.staging-backup.plist
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.dms.staging-backup.plist
launchctl list | grep com.dms.staging-backup
```

Chạy thử lịch ngay không cần đợi 12:30: `launchctl kickstart gui/$(id -u)/com.dms.staging-backup`.
Tắt lịch: `launchctl bootout gui/$(id -u)/com.dms.staging-backup`.

## 3. Kiểm tra sao lưu có đang chạy

| Việc | Cách |
|---|---|
| Xem log | `tail -30 deploy/staging/logs/backup.log` (mỗi lần chạy kết thúc bằng `HOAN TAT` hoặc `LOI`) |
| Bản trên máy | `ls -lh deploy/staging/backups/` (tối đa 7 bản) |
| Bản trên R2 | Cloudflare Dashboard → R2 → `dms-backup`, hoặc `docker run --rm -e MC_HOST_r2=https://KEY:SECRET@<ACCOUNT_ID>.r2.cloudflarestorage.com cgr.dev/chainguard/minio-client:latest ls r2/dms-backup/` |
| Khi lỗi | Tin **tự gửi vào kênh Discord** của nhóm (tên máy, giờ, nguyên nhân), kèm thông báo macOS "DMS: sao luu that bai" và dòng `LOI:` trong log |

**Mỗi tuần nên chạy thử khôi phục một lần (mục 4.1)** để chắc chắn bản sao lưu còn dùng được.

## 4. Khôi phục

### 4.1 Thử khôi phục (an toàn, không đụng staging thật)

Dựng Postgres và MinIO **trống, tạm thời**, khôi phục vào đó, rồi đối chiếu số hàng từng bảng và checksum từng tệp
với lúc sao lưu. Xong tự xoá container tạm.

```bash
cd deploy/staging
bash backup/restore.sh backups/dms-backup-AAAA-MM-DD_HHMM.tar.gz.enc    # bản trên máy
bash backup/restore.sh --from-r2 latest                                  # bản mới nhất trên R2
```

Kết quả mong đợi: các dòng `KHOP` và `KET QUA: THANH CONG`, mã thoát 0. Có dòng `KHONG KHOP` hoặc `LOI` là
bản sao lưu có vấn đề: báo ngay cho người phụ trách.

### 4.2 Khôi phục thật vào staging (ghi đè dữ liệu hiện tại)

Dùng khi dữ liệu staging bị hỏng/xoá nhầm. **Việc này thay thế toàn bộ database và bucket hiện tại.**

```bash
cd ~/staging/dms        # thư mục chứa docker-compose.staging.yml và .env.staging
DC="docker compose -f docker-compose.staging.yml --env-file .env.staging"

# 1. Dừng các service ghi vào DB (giữ postgres và minio chạy)
$DC stop front-end api-gateway auth-service account-service category-service \
         department-service organization-service document-service

# 2. Khôi phục (sẽ hỏi: phải gõ đúng "KHOI PHUC")
cd deploy/staging
bash backup/restore.sh --from-r2 latest --into-staging       # hoặc chỉ định file trên máy

# 3. Bật lại
cd ~/staging/dms && $DC up -d
```

Sau đó đăng nhập thử và mở một tệp đính kèm để chắc chắn dữ liệu đã trở lại.

### 4.3 Máy hỏng hẳn, dựng lại từ đầu

1. Máy mới: cài Docker Desktop, `git clone` repo, dựng lại staging theo `deploy/staging/README.md`
   (cần `.env.staging`; secret lưu trong trình quản lý mật khẩu, **không nằm trong bản sao lưu**).
2. Bật staging để có container `postgres` và `minio` rỗng.
3. Copy `deploy/staging/backup/.backup.env` (hoặc điền lại R2 + passphrase từ trình quản lý mật khẩu).
4. Làm các bước 4.2 với `--from-r2 latest`.

## 5. Kết quả thử khôi phục đã thực hiện

Chạy ngày 25/11/2026 trên MacBook staging (`restore.sh`, chế độ thử khôi phục vào Postgres 16 + MinIO trống):

| Thử nghiệm | Dữ liệu | Kết quả |
|---|---|---|
| Bản sao lưu **dữ liệu thật** của staging | 6 database, 14 bảng, 57 hàng; bucket `attachments` đang trống | Khớp 100% số hàng từng bảng |
| Stack thử có **tệp thật** | 2 database, 3 bảng, 1740 hàng (có chữ tiếng Việt); MinIO 3 tệp gồm tệp 5 MB, tên có dấu cách, thư mục con | Khớp 100% số hàng và checksum cả 3 tệp |
| Khôi phục thật (`--into-staging`) vào stack thử sau khi cố tình xoá 300 hàng, xoá 1 bảng, xoá 1 tệp | | Dữ liệu và tệp trở lại đủ (500/40/1200 hàng, tệp 5 MB) |
| Gõ sai xác nhận | | Huỷ, không thay đổi gì |
| Sai passphrase / file bị sửa 1 byte / không thấy file | | Dừng với thông báo rõ ràng, mã thoát khác 0 |
| Giữ 7 bản (ở máy) | Tạo 9 bản giả cũ + 1 bản mới | Còn đúng 7 bản mới nhất |
| **Upload lên Cloudflare R2** | Sao lưu thật, bucket `dms-backup` | Bản `.enc` và `.sha256` xuất hiện trên R2 |
| **Khôi phục từ R2** (`restore.sh --from-r2 latest`) | Tải bản vừa upload về, kiểm tra SHA-256, giải mã, khôi phục vào DB trống | Khớp 100% (14 bảng, 60 hàng), `KET QUA: THANH CONG` |
| Giữ 7 bản (trên R2) | Tải thêm 8 bản giả cũ lên R2 rồi chạy sao lưu | Còn đúng 7 bản, bản cũ nhất bị xoá |
| **Chạy qua launchd** (`launchctl kickstart`) | Lịch 12:30 hằng ngày đã được nạp | Chạy thành công trong môi trường của launchd, mã thoát 0 |
| **Cảnh báo lỗi vào Discord** | Chạy sao lưu với tên project sai để script không thấy container | Script thoát mã 1, tin báo lỗi xuất hiện trong kênh nhóm |

## 6. Giới hạn và rủi ro

- **Máy tắt hoặc ngủ lâu thì không có bản sao lưu mới.** Nên cắm sạc và để máy không tự ngủ khi chạy staging.
- **Mất `BACKUP_PASSPHRASE` = mất toàn bộ bản sao lưu.** Luôn cất bản dự phòng ngoài máy.
- `.env.staging` (mật khẩu Postgres, JWT, MinIO) **không** nằm trong bản sao lưu, phải tự cất trong trình quản lý mật khẩu.
- **Cảnh báo chỉ hoạt động khi script chạy được.** Máy tắt hẳn thì không có sao lưu và cũng không có tin báo. Nên xem kênh Discord/R2 định kỳ, hoặc thêm dịch vụ "heartbeat" nếu cần.
- Sao lưu hằng ngày nghĩa là có thể mất tối đa dữ liệu của ~24 giờ gần nhất.
- Dữ liệu cỡ rất nhỏ hiện nay (vài chục KB). Nếu tệp đính kèm tăng lên hàng GB, cần xem lại dung lượng R2 (gói miễn phí 10 GB).
