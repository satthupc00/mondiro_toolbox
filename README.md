# Mondiro Toolbox (bản Electron)

Gộp 6 tool: Merge Atlas, Blur Symbols, Smart Crop, Rename, Resize, FBF Viewer thành 1 app duy nhất,
giao diện y theo bản mockup đã duyệt (sidebar icon-rail thu gọn/mở rộng, icon thật, bo góc).

Đây là bản viết lại bằng Electron (giao diện đẹp như trình duyệt thật) thay cho bản Python/Tkinter
trước đó. Toàn bộ phần xử lý ảnh (Blur, Crop, Resize, Merge Atlas) đã được viết lại bằng
Node.js + thư viện `jimp` (thuần JavaScript, không cần cài thêm phần mềm nào khác, không cần Photoshop).

## Cách chạy thử (chế độ dev)

1. Cài Node.js nếu chưa có (bản LTS tại nodejs.org).
2. Mở terminal/PowerShell tại thư mục này, chạy:
   ```
   npm install
   npm start
   ```
   Lần đầu `npm install` sẽ tải Electron về nên hơi lâu (vài phút), các lần sau sẽ nhanh.

## Đóng gói thành file cài đặt .exe (khuyên dùng khi giao cho khách hàng)

```
npm run dist
```

File installer sẽ nằm trong thư mục `dist/` (dạng `Mondiro Toolbox Setup x.x.x.exe`). Chạy file này
để cài, app sẽ nằm cố định trong Program Files, có shortcut Start Menu, pin taskbar hoạt động bình thường.

## Icon app

Đã có sẵn icon tạm (`build/icon.ico`, `build/icon.png` — hình vuông bo góc màu xanh chữ M trắng).
Nếu bạn có logo riêng, chỉ cần thay 2 file này (giữ nguyên tên, `.ico` nhiều size cho Windows,
`.png` vuông ít nhất 512x512) rồi `npm run dist` lại.

## Các tool bên trong

- **Merge Atlas** — kéo 1 file PNG muốn giữ lại, tool tự xoá các PNG thừa trong cùng thư mục và
  cập nhật lại file `.atlas` trỏ đúng tên file đó (phục vụ pipeline Spine).
- **Blur Symbols** — batch motion blur (theo chiều dọc) + chỉnh Lightness cho PNG symbol, không cần
  Photoshop. Thuật toán port lại 1:1 từ bản Python đã test (premultiplied alpha để không lem viền,
  chỉnh Lightness qua không gian màu HSL giữ nguyên Hue/Saturation).
- **Smart Crop** — tự động crop theo vùng alpha, giữ đối xứng tâm ảnh (không lệch pivot khi dùng
  trong Spine/Cocos).
- **Rename** — đổi tên hàng loạt, hậu tố `##` để tự đánh số thứ tự.
- **Resize** — scale hàng loạt theo % hoặc theo pixel (chỉ cần nhập Rộng hoặc Cao, chiều còn lại
  tự tính theo đúng tỉ lệ ảnh gốc của từng file), ghi đè trực tiếp lên file gốc.
- **FBF Viewer** — kéo thả 1 chuỗi ảnh (vd `walk_00.png` ... `walk_23.png`) để xem preview
  frame-by-frame: Play/Pause, tua từng khung, chỉnh FPS (mặc định 30, có 3 nút chọn nhanh
  30/15/12). Mỗi lần chỉ xem 1 chuỗi — thả chuỗi mới sẽ thay thế chuỗi đang xem.
  Phím tắt: Delete để xoá chuỗi đang xem, Space để Play/Stop.

## Cấu trúc thư mục

```
main.js              — tiến trình chính Electron, tạo cửa sổ app
lib/imaging.js        — toàn bộ xử lý ảnh (blur, crop, resize) bằng Jimp
renderer/index.html    — giao diện (sidebar + 6 tab nội dung)
renderer/styles.css    — style (dark theme, bo góc, đồng bộ mockup)
renderer/renderer.js   — toàn bộ logic tương tác (drag-drop, nút bấm, FBF Viewer)
build/icon.ico, icon.png — icon app (thay được)
```
