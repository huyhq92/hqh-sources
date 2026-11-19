# hqh-sources — Kho nguồn plugin của app lai HQH

App lai (HQH) không chứa dữ liệu nguồn. App tải 2 file registry ở repo này,
rồi tải từng file JS nguồn theo registry. Thêm / bớt / sửa nguồn chỉ cần sửa
file tại đây — không phải ra bản app mới.

| File | Vai trò |
|---|---|
| `registry-movies.json` | Danh sách nguồn phim |
| `registry-moviesx.json` | Danh sách nguồn phim 18+ (tách riêng, app mặc định ẩn + hỏi mật khẩu) |
| `registry-reading.json` | Danh sách nguồn đọc (báo / truyện chữ / truyện tranh / sách nói) |
| `sources/movies/*.js` | Từng nguồn phim (plugin JS chạy bằng Rhino trong app) |
| `sources/reading/*.js` | Từng nguồn đọc (dựng dần) |
| `CONTRACT.md` | Đặc tả hợp đồng plugin: định dạng registry, hàm JS, khuôn dữ liệu |

Nguồn hiện có: **PhimAPI (KKPhim)**, **NguonC**.
