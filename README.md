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

## Cài trên máy đồng nghiệp

Gửi cho đồng nghiệp file `MondiroToolbox-<version>-setup.exe` (lấy ở mục **Releases** của repo trên GitHub).
Họ cài một lần, mở app và nhập key là dùng được. Từ đó về sau app tự cập nhật.

## Đóng gói thử trên máy mình

```
npm run dist          # build file Setup .exe
npm run dist:folder   # chỉ build ra thư mục (nhanh, để test)
```

File nằm trong thư mục `dist/`.

## Phát hành bản mới (tự động cập nhật)

1. Sửa code, đổi `"version"` trong `package.json` (ví dụ `1.1.0` → `1.1.1`).
2. Ghi nội dung muốn hiện trong bảng thông báo cập nhật vào `release-notes.md`:
   ```
   # v1.1.1
   - Thêm tính năng ...
   ```
   Tiêu đề phải trùng version, nếu không GitHub sẽ không build.
3. Push lên nhánh `main`.

GitHub Actions sẽ tự build `MondiroToolbox-<version>-setup.exe` và đăng lên mục **Releases** (khoảng 5–10 phút, xem ở tab **Actions**).
App trên máy đồng nghiệp kiểm tra bản mới lúc mở app và mỗi 1 tiếng, tự tải về, rồi hỏi
"Cập nhật ngay / Để sau". Chọn "Để sau" thì lần tắt app tới sẽ tự cài.
Khi đang dùng bản mới nhất, cạnh số phiên bản góc trái hiện chữ **(latest)** màu xanh.

> **Lưu ý:**
> - Repo phải để **Public** thì app mới tải được bản cập nhật.
> - Bản Toolbox cũ (1.0.0) chưa có tự cập nhật, cần cài tay bản 1.1.0 một lần.

## Quản lý quyền sử dụng (key)

Toolbox **dùng chung key với Spine Preview**: danh sách key nằm ở `access/keys.json` trong repo
`Spine_Preview`. Đồng nghiệp đã có key `SPV-...` thì nhập luôn key đó vào Toolbox.
Thu hồi hoặc xóa key ở bảng Admin (của Spine Preview hoặc của Toolbox, giống nhau) sẽ khóa cả 2 app.

- Mở bảng Admin bằng phím tắt riêng (giống Spine Preview) → dán GitHub token có quyền ghi vào repo
  `Spine_Preview` (dùng lại token đã tạo cho Spine Preview được) → **Đăng nhập Admin**.
  Lần đầu dùng Toolbox cần đăng nhập Admin một lần trên Toolbox, vì token được mã hóa riêng cho từng app.
- Key chỉ hiện được trên app đã tạo ra nó. Key tạo trong Spine Preview sẽ báo "Key không lưu trên
  máy này" khi xem trong Toolbox, nhưng vẫn dùng được bình thường.
- Sau khi thu hồi hoặc xóa, máy kia bị khóa trong khoảng **15–20 phút** (hoặc ngay lần mở app tiếp theo).
- Mất mạng thì máy đã kích hoạt vẫn dùng được thêm **7 ngày**.

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
license.js           — kiểm tra key (danh sách chung với Spine Preview), bảng Admin
updater.js           — tự động cập nhật từ GitHub Releases
renderer/license-ui.js — màn hình nhập key, bảng Admin, nút cập nhật
release-notes.md     — nội dung bảng thông báo cập nhật của bản sắp phát hành
.github/workflows/release.yml — tự build và đăng bản mới khi đổi version
lib/imaging.js        — toàn bộ xử lý ảnh (blur, crop, resize) bằng Jimp
renderer/index.html    — giao diện (sidebar + 6 tab nội dung)
renderer/styles.css    — style (dark theme, bo góc, đồng bộ mockup)
renderer/renderer.js   — toàn bộ logic tương tác (drag-drop, nút bấm, FBF Viewer)
build/icon.ico, icon.png — icon app (thay được)
```
