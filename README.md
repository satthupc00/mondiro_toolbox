# Mondiro Toolbox (bản Electron)

Gộp 6 tool: Merge Atlas, Blur Symbols, Crop FBF, Rename, Resize, FBF Viewer thành 1 app duy nhất,
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

Đổi `"version"` trong `package.json` (ví dụ `1.3.0` → `1.3.1`) rồi push lên nhánh `main`.
GitHub Actions sẽ tự build `MondiroToolbox-<version>-setup.exe` và đăng lên mục **Releases** (khoảng 5–10 phút, xem ở tab **Actions**).
App trên máy đồng nghiệp kiểm tra bản mới lúc mở app và mỗi 1 tiếng (hoặc khi bấm icon **mũi tên xoay**
ở góc phải trên), tự tải về, rồi hỏi "Cập nhật ngay / Để sau". Chọn "Để sau" thì lần tắt app tới sẽ tự cài.
App không hiện số version, chỉ hiện chữ **latest** màu xanh dưới tên app khi đang dùng bản mới nhất.

> **Lưu ý:**
> - Repo phải để **Public** thì app mới tải được bản cập nhật.
> - Bản Toolbox cũ (1.0.0) chưa có tự cập nhật, cần cài tay bản mới một lần.

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

## Giao diện & icon

Giao diện theo chuẩn chung của các app Mondiro (m-skill): header = thanh tiêu đề cửa sổ (đã ẩn thanh
tiêu đề trắng của Windows, kéo cửa sổ bằng header, 3 nút thu nhỏ / phóng to / đóng nằm góc phải cùng màu header),
logo + **Mondiro** đỏ + Toolbox trắng trên 1 hàng, chữ `latest` xanh khi là bản mới nhất; góc phải trên là nút
**kiểm tra cập nhật** chỉ có icon mũi tên xoay (xoay = đang kiểm tra/tải, xanh lá = đã mới nhất, xanh lá nhấp
nháy = có bản mới, bấm để cập nhật). Sidebar chọn tool bên trái, footer có "Created by Mondiro".

Icon "M": chữ M trắng nét bo tròn ở giữa, vòng 12 chấm màu quanh, nền xanh navy bo góc. File gốc:
`build/icon.svg` (bản đầy đủ, 48px trở lên) và `build/icon-small.svg` (bản cho 16–40px và logo header:
chỉ giữ 4 chấm lớn, M dày hơn — để rõ khi pin trên taskbar). `build/icon.png` (512px) và `build/icon.ico`
(16, 20, 24, 32, 40, 48, 64, 128, 256) được xuất từ 2 file này.

## Các tool bên trong

- **Merge Atlas** — kéo 1 file PNG muốn giữ lại; app hiện trước danh sách **sẽ thực hiện** (PNG giữ,
  các PNG thừa sẽ xoá, dòng nào trong `.atlas` sẽ đổi tên) và xem trước ảnh. Mặc định PNG thừa được
  **đưa vào Thùng rác** (khôi phục được), bỏ tick để xoá hẳn. Atlas nhiều trang sẽ được cảnh báo.
- **Blur Symbols** — batch motion blur (theo chiều dọc) + chỉnh Lightness cho PNG symbol, không cần
  Photoshop. Thanh trượt + ô số cho từng thông số, **xem trước trực tiếp** kết quả (nút Trước/Sau,
  click tên file để xem file khác). Thuật toán port 1:1 từ bản Python (premultiplied alpha để không
  lem viền, chỉnh Lightness qua HSL giữ nguyên Hue/Saturation). Ghi đè file gốc.
- **Rename** — 2 chế độ: **Đặt tên mới** (hậu tố `##` để tự đánh số thứ tự) và **Tìm và thay thế**
  (ô **Tìm** + ô **Thay bằng**, áp dụng cho mọi file có chứa chữ cần tìm, không phân biệt hoa/thường;
  để trống ô Thay bằng thì xóa luôn chữ đó và tự gọn dấu nối thừa, vd `walk_noCT_00` → `walk_00`).
  Danh sách xem trước tên mới; file trùng tên, đã tồn tại, tên trống hoặc có ký tự không hợp lệ sẽ được báo và bỏ qua.
- **Resize** — scale hàng loạt theo % (thanh trượt + nút nhanh 25/50/75/150/200%) hoặc theo pixel
  (chỉ cần nhập Rộng hoặc Cao, chiều còn lại tự tính theo đúng tỉ lệ ảnh gốc của từng file).
  Xem trước kích thước **cũ → mới** với khung so sánh. Ghi đè trực tiếp lên file gốc.
- **FBF Viewer** — kéo thả 1 hoặc **nhiều folder cùng lúc** (hoặc kéo thẳng các file ảnh, vd `walk_00.png`
  ... `walk_23.png`). App quét cả folder con, mỗi chuỗi ảnh thành 1 dòng trong **Playlist** bên trái
  (folder có nhiều chuỗi khác tên thì hiện `tên folder / tên chuỗi`). Click tên nào thì play chuỗi đó.
  Playlist luôn hiện sẵn, thả thêm sẽ nối vào playlist, nút ✕ để bỏ 1 chuỗi, **Xóa hết** để làm mới.
  Play/Pause, tua từng khung, chỉnh FPS (mặc định 30, có 3 nút chọn nhanh 30/15/12), tốc độ x1–x4, nút Loop Ping-pong và Tua ngược.
  Phím tắt: ↑/↓ chuyển chuỗi trong playlist, Delete bỏ chuỗi đang xem, Space để Play/Stop, P bật/tắt Ping-pong, R bật/tắt Tua ngược.

- **Crop FBF** — tự cắt phần trong suốt thừa hoặc crop theo kích thước (kéo thả file hoặc folder). 2 chế độ:
  **Auto Crop**: tìm vùng có pixel được vẽ rồi cắt bỏ phần trong suốt thừa, với khung crop **Chung cả chuỗi**
  (mọi frame ra cùng kích thước, không lệch vị trí — cho chuỗi FBF) hoặc **Riêng từng ảnh** (mỗi ảnh theo
  vùng vẽ của nó — cho symbol rời); tuỳ chọn chừa lề px và **Giữ tâm ảnh** để pivot Spine/Cocos không lệch
  (Riêng từng ảnh + Giữ tâm = Smart Crop cũ). **Theo kích thước W×H** với điểm neo 3×3 (nhập lớn hơn ảnh thì
  phần dư là nền trong suốt). Có khung xem trước từng frame. Ghi đè file gốc.

## Cấu trúc thư mục

```
main.js              — tiến trình chính Electron, tạo cửa sổ app
license.js           — kiểm tra key (danh sách chung với Spine Preview), bảng Admin
updater.js           — tự động cập nhật từ GitHub Releases
renderer/license-ui.js — màn hình nhập key, bảng Admin, nút cập nhật
.github/workflows/release.yml — tự build và đăng bản mới khi đổi version
lib/imaging.js        — toàn bộ xử lý ảnh (blur, crop, resize) bằng Jimp
renderer/index.html    — giao diện (sidebar + 6 tab nội dung)
renderer/styles.css    — style (dark theme, bo góc, đồng bộ mockup)
renderer/renderer.js   — toàn bộ logic tương tác (drag-drop, nút bấm, FBF Viewer)
build/icon.ico, icon.png — icon app (thay được)
```
