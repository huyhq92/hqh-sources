// Plugin VSMOV cho app lai HQH — v1.0.1 (21/11/2026: hoán đổi
// poster/thumb — nền Ophim của VSMOV đặt NGƯỢC hai trường so với
// PhimAPI: poster_url là ảnh NGANG (đo thật Tomb Raider:
// 3123x1757), thumb_url là ảnh DỌC (2000x3000). Hợp đồng app:
// poster = dọc, thumb = ngang.)
// API: https://vsmov.com/api — da kiem chung truc tiep 20/11/2026:
//   - Moi cap nhat:  GET /danh-sach/phim-moi-cap-nhat?page=   (24 phim/trang)
//   - Phim bo / le:  GET /danh-sach/phim-bo|phim-le?page=     (20 phim/trang)
//   - Tim kiem:      GET /tim-kiem?keyword=&page=
//   - Chi tiet:      GET /phim/{slug} -> movie + episodes[].server_data[]
//   - Link phat: API chi cho link_embed dang trang phat
//     https://vN.streamvsmov.com/video/<uuid> — link HLS that =
//     doi /video/ -> /stream/<uuid>/master.m3u8 (da kiem: tra 200,
//     playlist m3u8 that, segment tren p25.streamvsmov.com, khong can referer).
//   - Ten server ve thua khoang trang/xuong dong ("Vietsub\r\n #1") -> don sach.
//   - Phu de Viet nam trong cau hinh player cua trang phat (truong subtitles);
//     hop dong plugin hien chua co cho phu de rieng nen embed giu nguyen
//     dia chi trang phat de app doc phu de tu do khi can.
// Host API: httpGet(url) -> string, log(msg). Moi ham tra ve CHUOI JSON (xem CONTRACT.md).

var VS_BASE = "https://vsmov.com/api/";

function vsJson(url) {
  var raw = httpGet(url);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch (e) { log("vsmov parse loi: " + e); return null; }
}

function vsImage(value, base) {
  // API doi khi tra poster_url/thumb_url la {} rong thay vi chuoi.
  if (!value || typeof value !== "string") return "";
  if (value.indexOf("http") === 0) return value;
  if (!base) return value;
  var b = base.charAt(base.length - 1) === "/" ? base : base + "/";
  var v = value.charAt(0) === "/" ? value.substring(1) : value;
  return b + v;
}

function vsCleanServer(s) {
  if (!s) return "";
  return s.replace(/\s+/g, " ").replace(/^\s+|\s+$/g, "");
}

function vsItem(m, base) {
  var poster = vsImage(m.thumb_url, base);
  var thumb = vsImage(m.poster_url, base);
  if (!poster) poster = thumb;
  if (!thumb) thumb = poster;
  return {
    id: m.slug || "",
    title: m.name || "",
    origin_name: m.origin_name || "",
    poster: poster,
    thumb: thumb,
    year: m.year || 0,
    quality: m.quality || "",
    lang: m.lang || "",
    episode_current: m.episode_current || "",
    type: m.type || ""
  };
}

function vsListResult(d, page) {
  var items = [];
  var arr = [];
  var totalPages = 1;
  if (d) {
    if (d.items) {
      arr = d.items;
    } else if (d.data && d.data.items) {
      arr = d.data.items;
    }
    var pg = d.pagination || (d.data && d.data.pagination);
    if (pg && pg.totalPages) totalPages = pg.totalPages;
  }
  var base = (d && d.pathImage) || "";
  for (var i = 0; i < arr.length; i++) items.push(vsItem(arr[i], base));
  return JSON.stringify({ items: items, page: page, totalPages: totalPages });
}

function vsEmpty(page) {
  return JSON.stringify({ items: [], page: page || 1, totalPages: 1 });
}

function getCategories() {
  return JSON.stringify([
    { id: "new", name: "Mới cập nhật" },
    { id: "phim-bo", name: "Phim bộ" },
    { id: "phim-le", name: "Phim lẻ" }
  ]);
}

function getList(categoryId, page) {
  page = page || 1;
  try {
    var url;
    if (categoryId === "phim-bo" || categoryId === "phim-le") {
      url = VS_BASE + "danh-sach/" + categoryId + "?page=" + page;
    } else {
      url = VS_BASE + "danh-sach/phim-moi-cap-nhat?page=" + page;
    }
    var d = vsJson(url);
    if (!d) return vsEmpty(page);
    return vsListResult(d, page);
  } catch (e) { log("vsmov getList loi: " + e); return vsEmpty(page); }
}

function getDetail(id) {
  try {
    var d = vsJson(VS_BASE + "phim/" + id);
    if (!d || !d.movie) return JSON.stringify({});
    var m = d.movie;
    var servers = [];
    var eps = d.episodes || [];
    for (var i = 0; i < eps.length; i++) {
      var list = [];
      var data = eps[i].server_data || [];
      for (var j = 0; j < data.length; j++) {
        var embed = data[j].link_embed || "";
        var url = data[j].link_m3u8 || "";
        if (!url && embed.indexOf("/video/") >= 0) {
          url = embed.replace("/video/", "/stream/") + "/master.m3u8";
        }
        list.push({
          name: "Tập " + (data[j].name || (j + 1)),
          url: url,
          embed: embed
        });
      }
      servers.push({ name: vsCleanServer(eps[i].server_name) || ("Server " + (i + 1)), episodes: list });
    }
    return JSON.stringify({
      id: m.slug || id,
      title: m.name || "",
      origin_name: m.origin_name || "",
      poster: vsImage(m.thumb_url, ""),
      thumb: vsImage(m.poster_url, ""),
      year: m.year || 0,
      quality: m.quality || "",
      lang: m.lang || "",
      episode_current: m.episode_current || "",
      episode_total: m.episode_total || "",
      content: m.content || "",
      type: m.type || "",
      servers: servers
    });
  } catch (e) { log("vsmov getDetail loi: " + e); return JSON.stringify({}); }
}

function search(keyword, page) {
  page = page || 1;
  try {
    var url = VS_BASE + "tim-kiem?keyword=" + encodeURIComponent(keyword) + "&page=" + page;
    var d = vsJson(url);
    if (!d) return vsEmpty(page);
    return vsListResult(d, page);
  } catch (e) { log("vsmov search loi: " + e); return vsEmpty(page); }
}
