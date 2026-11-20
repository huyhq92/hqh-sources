# Đặc tả hệ nguồn plugin của app lai (HQH) — bản 1

Nguyên tắc: **app không chứa dữ liệu nguồn**. App chỉ biết địa chỉ 2 file registry
trên GitHub của thầy. Thêm / bớt / sửa nguồn = sửa file trên GitHub, không ra bản app mới.
Khuôn rút gọn theo Super OK, giữ đúng các trường đã kiểm chứng chạy được.

## 1. Registry (một file cho mỗi mảng nội dung)

- `registry-movies.json` — nguồn phim
- `registry-moviesx.json` — nguồn phim 18+, tách riêng; app mặc định ẩn sau Quản lý tab + mật khẩu nhãn tuổi
- `registry-reading.json` — nguồn đọc (báo / truyện chữ / truyện tranh / sách nói)

Cấu trúc:

```json
{
  "version": 1,
  "updated": "2026-11-19",
  "plugins": [
    {
      "id": "phimapi",
      "name": "PhimAPI (KKPhim)",
      "version": "1.0.0",
      "scriptUrl": "https://raw.githubusercontent.com/huyhq92/hqh-sources/main/sources/movies/phimapi.js",
      "iconUrl": "",
      "info": "Kho phim PhimAPI/KKPhim: phim bộ, phim lẻ, hoạt hình, TV shows. Link m3u8 trực tiếp (EXO).",
      "password": ""
    }
  ]
}
```

- `password`: để trống = nguồn mở. Nguồn nhạy cảm để `"16+"` — app hỏi mật khẩu
  (mật khẩu chính là nhãn độ tuổi) trước khi cài/mở nguồn đó, theo đúng cách Super OK làm.
- Tăng `version` của plugin mỗi khi sửa file JS — app dựa vào đó để tải bản mới.

## 2. App cung cấp cho JS (host API)

Chạy bằng Rhino (Java thuần). App chỉ chìa đúng 2 hàm toàn cục:

- `httpGet(url)` → trả về nội dung dạng chuỗi (đã set sẵn User-Agent trình duyệt Android).
- `log(msg)` → ghi log gỡ lỗi.

Plugin không có quyền gì khác: không file, không hệ thống.

## 3. Plugin phải định nghĩa 4 hàm — tất cả trả về CHUỖI JSON

- `getCategories()` → `[{ "id": "new", "name": "Mới cập nhật" }, ...]`
  Quy ước id: `new` = mới cập nhật; còn lại do plugin tự đặt (`phim-bo`, `theloai:hanh-dong`...).
- `getList(categoryId, page)` → `{ "items": [ITEM], "page": 1, "totalPages": 10 }`
- `getDetail(id)` → `DETAIL` (id là `id` của ITEM)
- `search(keyword, page)` → cùng dạng `getList`

**ITEM** (danh sách phim):

```json
{ "id": "xom-nho", "title": "Xóm Nhỏ", "origin_name": "Hamlet",
  "poster": "https://.../poster.webp", "thumb": "https://.../thumb.webp",
  "year": 2026, "quality": "FHD", "lang": "Vietsub",
  "episode_current": "Tập 19", "type": "series" }
```

**DETAIL**:

```json
{ "id": "xom-nho", "title": "Xóm Nhỏ", "origin_name": "Hamlet",
  "poster": "...", "thumb": "...", "year": 2026, "quality": "FHD", "lang": "Vietsub",
  "episode_current": "Hoàn tất (19/19)", "episode_total": "19",
  "content": "Mô tả...", "type": "series",
  "servers": [ { "name": "Vietsub",
                 "episodes": [ { "name": "Tập 01", "url": "https://.../index.m3u8", "embed": "https://..." } ] } ] }
```

- `url` = link phát trực tiếp (ưu tiên m3u8) cho ExoPlayer; `embed` = link nhúng dự phòng cho WebView.
- `referer` (không bắt buộc, thêm 20/11/2026 cho Anime Hay): nếu CDN của nguồn bắt trình phát gửi kèm Referer mới chịu phát, đặt thêm trường `"referer": "https://..."` vào từng tập — app (từ bản hm.19) sẽ gửi Referer đó cho mọi yêu cầu của luồng phát. Nguồn nào không cần thì bỏ qua trường này.
- Trường nào nguồn không có thì để chuỗi rỗng / 0 — app tự chịu phần hiển thị thiếu.

## 4. Kỷ luật viết plugin

- JavaScript ES5 (Rhino tương thích): `var`, không arrow function, không template literal.
- Mọi hàm bọc try/catch, lỗi thì trả JSON rỗng đúng dạng (`{"items":[],"page":1,"totalPages":1}`).
- Chỉ gọi API/JSON của nguồn khi có thể; cào HTML là phương án cuối.
- Plugin chỉ được tải từ repo của thầy — không nạp JS từ nơi khác.

## 5. Trạng thái kiểm chứng

| Plugin | Nguồn API | Kiểm chứng |
|---|---|---|
| phimapi.js | phimapi.com (danh sách v1, chi tiết /phim/, tìm kiếm, 26 thể loại) | Đã gọi API thật 19/11/2026, đủ trường |
| nguonc.js | phim.nguonc.com/api | Theo đúng cấu trúc bản HQH đã chạy trên máy thầy; từ máy chủ phân tích bị Cloudflare chặn (403) nên chờ kiểm lại trên máy khi app xong |
| vsmov.js | vsmov.com/api (mới cập nhật 24/trang, phim bộ/lẻ 20/trang, tìm kiếm, chi tiết /phim/) | Đã gọi API thật + chạy đủ 4 hàm 20/11/2026: list 24 phim/trang mới, 20 phim/trang bộ, tìm kiếm 23 kết quả, chi tiết 2 server × 37 tập; link HLS suy từ /video/ sang /stream/.../master.m3u8 trả 200, playlist thật |
| k20.js | sc.k-20.xyz (addon Stremio: catalog/meta/stream, CLB Phim Xưa) | Chép client K20 của HQH-TV (hqh.54). Đã chạy đủ 4 hàm với API thật 20/11/2026: danh sách 30 phim/trang, tìm kiếm có kết quả, chi tiết 1 tập Full, link stream giải ra MP4 (endpoint hx-mp4 trả 206 video/mp4). LƯU Ý: addon chặn theo User-Agent — curl mặc định ăn 404, phải gửi UA trình duyệt (host API của app đã set sẵn) |
