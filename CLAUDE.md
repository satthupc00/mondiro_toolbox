# Quy tắc làm việc với repo này

Chủ repo (Mondiro) là artist, không phải lập trình viên. Trả lời bằng tiếng Việt, giải thích dễ hiểu.

## Phiên bản và phát hành

- **Không tự ý tăng `version` trong `package.json`.** Chỉ tăng khi Mondiro nói rõ là nâng version.
  Sửa code mà không được dặn nâng version thì chỉ commit và push, không phát hành bản mới.
- Khi nâng version, nội dung bảng thông báo cập nhật lấy từ `release-notes.md`
  (tiêu đề `# v<version>` + các dòng bên dưới). **Chỉ ghi đúng những dòng Mondiro note**,
  không tự viết thêm và không chép commit message vào.
- Nếu Mondiro dặn nâng version mà chưa đưa nội dung note, **phải hỏi lại** muốn ghi gì
  trước khi sửa `release-notes.md` và push.
- Đổi `version` (hoặc `release-notes.md`) rồi push lên `main` thì GitHub Actions sẽ tự build và phát hành.
  App đã cài sẽ tự cập nhật.

## Key

- Danh sách key **dùng chung với Spine Preview**: nằm ở `access/keys.json` trong repo `satthupc00/Spine_Preview`.
  Không tạo danh sách key riêng trong repo này. Không đổi tiền tố `SPV-` và chuỗi muối băm
  `spine-preview:` trong `license.js`, nếu đổi thì key cũ sẽ không khớp nữa.

## Bí mật

- Không ghi phím tắt mở bảng Admin vào bất kỳ file công khai nào (README, release notes, commit message).
  Repo để Public.
