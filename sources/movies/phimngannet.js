// Plugin Phim short cho app lai HQH — v1.0.0
// Nguon: https://phimngan.net — API: https://api.phimngan.net — viet 2026-11-20
// Chep co che cua plugin SuperOK (phimngannet), viet lai theo hop dong hqh-sources:
//   - Danh sach:  GET api.phimngan.net/api/videos?view=feed | ?genre=<slug> | /api/videos/for-you
//                 (moi trang 24 muc, phan trang bang offset; API tra mang JSON tran)
//   - Tim kiem:   GET api.phimngan.net/api/search?q=<kw> — endpoint nay moi loc that;
//                 no tra TOAN BO ket qua mot lan (khong nhan limit/offset) nen plugin
//                 tu cat trang 24 muc. (Dung nham /api/videos?search= : API bo qua
//                 tham so la va tra ca kho 1740 phim.)
//   - Chi tiet:   GET api.phimngan.net/api/videos/<slug> — metadata day du, khong kem danh sach tap.
//   - Link phat:  moi phim chi co mot dia chi playlist cua API:
//                 api.phimngan.net/api/v1/video/playlist?id=<videoId>&audio=vietsub|thuyet_minh
//                 -> hai server Vietsub / Thuyet Minh tuy co phim (has_vietsub / has_thuyet_minh).
//                 LUU Y: endpoint playlist chan truy cap tu may ao kiem chung
//                 (403 "Forbidden origin" khi khong co Referer cua site, 502 khi co) —
//                 dia chi theo dung so do cua nguon, chua goi duoc tu moi truong nay.
// Host API: httpGet(url) -> string, log(msg). Moi ham tra ve CHUOI JSON (xem CONTRACT.md).

var PN_API = "https://api.phimngan.net";
var PN_LIMIT = 24;

var PN_GENRES = [
  ["ngon-tinh", "Ngôn Tình"],
  ["tong-tai", "Tổng Tài"],
  ["co-trang", "Cổ Trang"],
  ["phim-ngan-trung-quoc", "Phim Ngắn Trung Quốc"],
  ["phim-ai", "Phim AI"],
  ["huyen-huyen", "Huyền Huyễn"],
  ["trong-sinh", "Trọng Sinh"],
  ["xuyen-khong", "Xuyên Không"],
  ["do-thi", "Đô Thị"],
  ["hai-huoc", "Hài Hước"],
  ["hanh-dong", "Hành Động"],
  ["bao-thu", "Báo Thù"],
  ["nguoc-luyen", "Ngược Luyến"],
  ["ngot-sung", "Ngọt Sủng"],
  ["sinh-ton", "Sinh Tồn"],
  ["khoa-hoc-vien-tuong", "Khoa Học Viễn Tưởng"],
  ["hoat-hinh", "Hoạt Hình"],
  ["y-hoc", "Y Học"]
];

function pnJson(url) {
  var raw = httpGet(url);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch (e) { log("phimngannet parse loi: " + e); return null; }
}

function pnLang(m) {
  if (m.has_vietsub && m.has_thuyet_minh) return "Vietsub / Thuyết minh";
  if (m.has_thuyet_minh) return "Thuyết minh";
  return "Vietsub";
}

function pnItem(m) {
  var poster = m.poster_url_hd || m.poster_url || "";
  var total = 0;
  if (m.total_episodes) { var t = parseInt(m.total_episodes, 10); if (!isNaN(t)) total = t; }
  return {
    id: m.slug || m.id || "",
    title: m.title_clean || m.title || "",
    origin_name: m.original_title || "",
    poster: poster,
    thumb: m.poster_url || poster,
    year: m.release_year || 0,
    quality: m.quality || "Full HD",
    lang: pnLang(m),
    episode_current: m.part_label || (total ? total + " tập" : ""),
    episode_total: total ? String(total) : "",
    type: total > 1 ? "series" : "movie"
  };
}

function pnListResult(d, page) {
  var items = [];
  var arr = [];
  if (d) {
    if (Object.prototype.toString.call(d) === "[object Array]") arr = d;
    else if (d.videos) arr = d.videos;
  }
  for (var i = 0; i < arr.length; i++) {
    if (arr[i]) items.push(pnItem(arr[i]));
  }
  var totalPages = items.length >= PN_LIMIT ? page + 1 : page;
  return JSON.stringify({ items: items, page: page, totalPages: totalPages });
}

function pnEmpty(page) {
  return JSON.stringify({ items: [], page: page || 1, totalPages: 1 });
}

function pnListUrl(categoryId, page) {
  var offset = (page - 1) * PN_LIMIT;
  var url;
  if (categoryId === "for-you") {
    url = PN_API + "/api/videos/for-you?limit=" + PN_LIMIT;
  } else if (categoryId.indexOf("genre:") === 0) {
    url = PN_API + "/api/videos?genre=" + encodeURIComponent(categoryId.substring(6)) + "&limit=" + PN_LIMIT;
  } else {
    url = PN_API + "/api/videos?view=feed&limit=" + PN_LIMIT;
  }
  if (offset > 0) url += "&offset=" + offset;
  return url;
}

function getCategories() {
  var cats = [
    { id: "new", name: "Phim Mới Nhất" },
    { id: "for-you", name: "Thịnh Hành" }
  ];
  for (var i = 0; i < PN_GENRES.length; i++) {
    cats.push({ id: "genre:" + PN_GENRES[i][0], name: PN_GENRES[i][1] });
  }
  return JSON.stringify(cats);
}

function getList(categoryId, page) {
  page = page || 1;
  try {
    var d = pnJson(pnListUrl(categoryId || "new", page));
    if (!d) return pnEmpty(page);
    return pnListResult(d, page);
  } catch (e) { log("phimngannet getList loi: " + e); return pnEmpty(page); }
}

function pnPlaylist(videoId, audio) {
  return PN_API + "/api/v1/video/playlist?id=" + encodeURIComponent(videoId) + "&audio=" + audio;
}

function getDetail(id) {
  try {
    var d = pnJson(PN_API + "/api/videos/" + encodeURIComponent(id));
    if (!d || d.error || !d.id) return JSON.stringify({});
    var base = pnItem(d);
    var vsEps = [];
    var tmEps = [];
    if (d.has_vietsub !== false) {
      vsEps.push({ name: "Full", url: pnPlaylist(d.id, "vietsub"), embed: "" });
    }
    if (d.has_thuyet_minh) {
      tmEps.push({ name: "Full", url: pnPlaylist(d.id, "thuyet_minh"), embed: "" });
    }
    if (vsEps.length === 0 && tmEps.length === 0) {
      vsEps.push({ name: "Full", url: pnPlaylist(d.id, "vietsub"), embed: "" });
    }
    var servers = [];
    if (vsEps.length > 0) servers.push({ name: "Vietsub", episodes: vsEps });
    if (tmEps.length > 0) servers.push({ name: "Thuyết Minh", episodes: tmEps });
    return JSON.stringify({
      id: base.id,
      title: base.title,
      origin_name: base.origin_name,
      poster: base.poster,
      thumb: base.thumb,
      year: base.year,
      quality: base.quality,
      lang: base.lang,
      episode_current: base.episode_current,
      episode_total: base.episode_total,
      content: d.synopsis_short || d.description || d.hashtag || "",
      type: base.type,
      servers: servers
    });
  } catch (e) { log("phimngannet getDetail loi: " + e); return JSON.stringify({}); }
}

function search(keyword, page) {
  page = page || 1;
  try {
    // /api/search tra toan bo ket qua trong mot lan — plugin tu phan trang.
    var d = pnJson(PN_API + "/api/search?q=" + encodeURIComponent(keyword || ""));
    if (!d) return pnEmpty(page);
    var arr = [];
    if (Object.prototype.toString.call(d) === "[object Array]") arr = d;
    else if (d.videos) arr = d.videos;
    var totalPages = Math.max(1, Math.ceil(arr.length / PN_LIMIT));
    if (page > totalPages) {
      return JSON.stringify({ items: [], page: page, totalPages: totalPages });
    }
    var items = [];
    var start = (page - 1) * PN_LIMIT;
    var end = Math.min(arr.length, start + PN_LIMIT);
    for (var i = start; i < end; i++) {
      if (arr[i]) items.push(pnItem(arr[i]));
    }
    return JSON.stringify({ items: items, page: page, totalPages: totalPages });
  } catch (e) { log("phimngannet search loi: " + e); return pnEmpty(page); }
}
