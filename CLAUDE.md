# Quy tắc làm việc với repo này

Chủ repo (Mondiro) là artist, không phải lập trình viên. Trả lời bằng tiếng Việt, giải thích dễ hiểu.

## Phiên bản và phát hành

- Sửa xong thì **tự nâng `version` trong `package.json`** (Mondiro đã cho phép), merge lên `main` là
  GitHub Actions tự build và phát hành, app đã cài sẽ tự cập nhật.
  Sửa lỗi nhỏ: tăng số cuối (1.3.0 → 1.3.1). Thêm tính năng: tăng số giữa (1.3.1 → 1.4.0).
- **Không có ghi chú phát hành**: app không hiện số version, không hiện release notes hay bảng chào mừng.
  Chỉ hiện chữ `latest` màu xanh dưới tên app khi đang dùng bản mới nhất.

## Key

- Danh sách key **dùng chung với Spine Preview**: nằm ở `access/keys.json` trong repo `satthupc00/Spine_Preview`.
  Không tạo danh sách key riêng trong repo này. Không đổi tiền tố `SPV-` và chuỗi muối băm
  `spine-preview:` trong `license.js`, nếu đổi thì key cũ sẽ không khớp nữa.

## Bí mật

- Không ghi phím tắt mở bảng Admin vào bất kỳ file công khai nào (README, commit message, mô tả PR).
  Repo để Public.
