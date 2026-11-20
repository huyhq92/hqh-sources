// Plugin YAN HH3D cho app lai HQH — v1.0.0 (2026-11-20)
// Nguon: https://phimapi.com (API KKPhim/PhimAPI) — ban SuperOK ghi
//   baseUrl yanhh3d.nyc nhung moi duong du lieu deu tro ve phimapi.com,
//   lat cat hoat hinh (loc category=hoat-hinh) nhu ban goc.
//   - Muc chinh:   GET /v1/api/danh-sach/hoat-hinh?page=&limit=24
//   - The loai:    GET /v1/api/the-loai/{slug}?page=&limit=24&category=hoat-hinh
//   - Tim kiem:    GET /v1/api/tim-kiem?keyword=&page=&limit=24&category=hoat-hinh
//   - Chi tiet:    GET /v1/api/phim/{slug} -> data.item + item.episodes[].
//     server_data[].link_m3u8 la link HLS truc tiep; neu bi boc dang
//     player.phimapi.com/player/?url= thi goi url= ra link that.
//   Luu y: cac the loai "tien hiep / huyen huyen / kiem hiep..." cua ban
//   SuperOK khong con ton tai tren phimapi.com (API tra 404) nen ban nay
//   dung cac the loai con song co giao voi hoat hinh (da dem: Hài Hước
//   289, Phiêu Lưu 360, Hành Động 274, Viễn Tưởng 248, Tâm Lý 179 phim).
// Host API: httpGet(url) -> string, log(msg). Moi ham tra ve CHUOI JSON (xem CONTRACT.md).

var YH_BASE = "https://phimapi.com";
var YH_IMG = "https://phimimg.com";
var YH_LIMIT = 24;

function yhJson(url) {
  var raw = httpGet(url);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch (e) { log("yanhh3d parse loi: " + e); return null; }
}

function yhImg(u) {
  if (!u) return "";
  if (u.indexOf("http") === 0) return u;
  return YH_IMG + (u.charAt(0) === "/" ? u : "/" + u);
}

function yhItem(m) {
  return {
    id: m.slug || "",
    title: m.name || "",
    origin_name: m.origin_name || "",
    poster: yhImg(m.poster_url),
    thumb: yhImg(m.thumb_url),
    year: m.year || 0,
    quality: m.quality || "",
    lang: m.lang || "",
    episode_current: m.episode_current || "",
    episode_total: m.episode_total || "",
    type: m.type || ""
  };
}

function yhListResult(d, page) {
  var items = [];
  var arr = [];
  var totalPages = 1;
  if (d) {
    if (d.items) {
      arr = d.items;
      if (d.pagination && d.pagination.totalPages) totalPages = d.pagination.totalPages;
    } else if (d.data && d.data.items) {
      arr = d.data.items;
      var pg = (d.data.params && d.data.params.pagination) || d.data.pagination;
      if (pg && pg.totalPages) totalPages = pg.totalPages;
    }
  }
  for (var i = 0; i < arr.length; i++) items.push(yhItem(arr[i]));
  return JSON.stringify({ items: items, page: page, totalPages: totalPages });
}

function yhEmpty(page) {
  return JSON.stringify({ items: [], page: page || 1, totalPages: 1 });
}

function getCategories() {
  return JSON.stringify([
    { id: "hoat-hinh", name: "Hoạt Hình 3D" },
    { id: "theloai:hanh-dong", name: "Hành Động" },
    { id: "theloai:hai-huoc", name: "Hài Hước" },
    { id: "theloai:phieu-luu", name: "Phiêu Lưu" },
    { id: "theloai:vien-tuong", name: "Viễn Tưởng" },
    { id: "theloai:tam-ly", name: "Tâm Lý" }
  ]);
}

function getList(categoryId, page) {
  page = page || 1;
  try {
    var url;
    if (categoryId === "hoat-hinh") {
      url = YH_BASE + "/v1/api/danh-sach/hoat-hinh?page=" + page + "&limit=" + YH_LIMIT;
    } else if (categoryId.indexOf("theloai:") === 0) {
      url = YH_BASE + "/v1/api/the-loai/" + categoryId.substring(8) + "?page=" + page + "&limit=" + YH_LIMIT + "&category=hoat-hinh";
    } else if (categoryId.indexOf("quoc-gia:") === 0) {
      url = YH_BASE + "/v1/api/quoc-gia/" + categoryId.substring(8) + "?page=" + page + "&limit=" + YH_LIMIT + "&category=hoat-hinh";
    } else {
      url = YH_BASE + "/v1/api/danh-sach/hoat-hinh?page=" + page + "&limit=" + YH_LIMIT;
    }
    var d = yhJson(url);
    if (!d) return yhEmpty(page);
    return yhListResult(d, page);
  } catch (e) { log("yanhh3d getList loi: " + e); return yhEmpty(page); }
}

function yhStreamUrl(ep) {
  var url = ep.link_m3u8 || "";
  if (url.indexOf("player.phimapi.com/player/?url=") >= 0) {
    var raw = url.split("player/?url=")[1];
    if (raw) {
      var cut = raw.indexOf("&");
      if (cut >= 0) raw = raw.substring(0, cut);
      try { url = decodeURIComponent(raw); } catch (e) { url = raw; }
    }
  }
  return url;
}

function getDetail(id) {
  try {
    var d = yhJson(YH_BASE + "/v1/api/phim/" + id);
    var m = (d && d.data && d.data.item) || (d && d.movie) || null;
    if (!m) return JSON.stringify({});
    var rawEps = m.episodes || (d && d.episodes) || [];
    var servers = [];
    for (var i = 0; i < rawEps.length; i++) {
      var list = [];
      var data = rawEps[i].server_data || [];
      for (var j = 0; j < data.length; j++) {
        var url = yhStreamUrl(data[j]);
        if (!url) continue;
        list.push({
          name: data[j].name || ("Tập " + (j + 1)),
          url: url,
          embed: data[j].link_embed || ""
        });
      }
      if (list.length > 0) {
        servers.push({ name: rawEps[i].server_name || ("Server " + (i + 1)), episodes: list });
      }
    }
    if (servers.length === 0) return JSON.stringify({});
    return JSON.stringify({
      id: m.slug || id,
      title: m.name || "",
      origin_name: m.origin_name || "",
      poster: yhImg(m.poster_url),
      thumb: yhImg(m.thumb_url),
      year: m.year || 0,
      quality: m.quality || "",
      lang: m.lang || "",
      episode_current: m.episode_current || "",
      episode_total: m.episode_total || "",
      content: (m.content || "").replace(/<[^>]*>/g, ""),
      type: m.type || "",
      servers: servers
    });
  } catch (e) { log("yanhh3d getDetail loi: " + e); return JSON.stringify({}); }
}

function search(keyword, page) {
  page = page || 1;
  try {
    var url = YH_BASE + "/v1/api/tim-kiem?keyword=" + encodeURIComponent(keyword) + "&page=" + page + "&limit=" + YH_LIMIT + "&category=hoat-hinh";
    var d = yhJson(url);
    if (!d) return yhEmpty(page);
    return yhListResult(d, page);
  } catch (e) { log("yanhh3d search loi: " + e); return yhEmpty(page); }
}
