// Plugin PhimAPI (KKPhim) cho app lai HQH — v1.0.1
// v1.0.1 (20/11/2026): ten the loai bo tien to "The loai · " cho gon cot muc.
// API: https://phimapi.com — da kiem chung truc tiep 19/11/2026:
//   - Moi cap nhat:  GET /danh-sach/phim-moi-cap-nhat?page=
//   - Danh sach v1:  GET /v1/api/danh-sach/{phim-bo|phim-le|hoat-hinh|tv-shows}?page=&limit=24
//   - The loai:      GET /v1/api/the-loai  va  /v1/api/the-loai/{slug}?page=&limit=24
//   - Quoc gia:      GET /v1/api/quoc-gia/{slug}?page=&limit=24
//   - Chi tiet:      GET /phim/{slug}  -> movie + episodes[].server_data[].link_m3u8
//   - Tim kiem:      GET /v1/api/tim-kiem?keyword=&page=&limit=24
// Host API: httpGet(url) -> string, log(msg). Moi ham tra ve CHUOI JSON (xem CONTRACT.md).

var PA_BASE = "https://phimapi.com";
var PA_IMG = "https://phimimg.com";
var PA_LIMIT = 24;

function paJson(url) {
  var raw = httpGet(url);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch (e) { log("phimapi parse loi: " + e); return null; }
}

function paImg(u) {
  if (!u) return "";
  if (u.indexOf("http") === 0) return u;
  return PA_IMG + (u.charAt(0) === "/" ? u : "/" + u);
}

function paItem(m) {
  return {
    id: m.slug || "",
    title: m.name || "",
    origin_name: m.origin_name || "",
    poster: paImg(m.poster_url),
    thumb: paImg(m.thumb_url),
    year: m.year || 0,
    quality: m.quality || "",
    lang: m.lang || "",
    episode_current: m.episode_current || "",
    type: m.type || ""
  };
}

function paListResult(d, page) {
  var items = [];
  var arr = [];
  var totalPages = 1;
  if (d) {
    if (d.items) { // dang cu: /danh-sach/phim-moi-cap-nhat
      arr = d.items;
      if (d.pagination && d.pagination.totalPages) totalPages = d.pagination.totalPages;
    } else if (d.data && d.data.items) { // dang v1
      arr = d.data.items;
      var pg = (d.data.params && d.data.params.pagination) || d.data.pagination;
      if (pg && pg.totalPages) totalPages = pg.totalPages;
    }
  }
  for (var i = 0; i < arr.length; i++) items.push(paItem(arr[i]));
  return JSON.stringify({ items: items, page: page, totalPages: totalPages });
}

function paEmpty(page) {
  return JSON.stringify({ items: [], page: page || 1, totalPages: 1 });
}

function getCategories() {
  var cats = [
    { id: "new", name: "Mới cập nhật" },
    { id: "phim-bo", name: "Phim bộ" },
    { id: "phim-le", name: "Phim lẻ" },
    { id: "hoat-hinh", name: "Hoạt hình" },
    { id: "tv-shows", name: "TV Shows" }
  ];
  try {
    var d = paJson(PA_BASE + "/v1/api/the-loai");
    var arr = (d && d.data && d.data.items) || [];
    for (var i = 0; i < arr.length; i++) {
      cats.push({ id: "theloai:" + arr[i].slug, name: arr[i].name });
    }
  } catch (e) { log("phimapi the-loai loi: " + e); }
  return JSON.stringify(cats);
}

function getList(categoryId, page) {
  page = page || 1;
  try {
    var url;
    if (categoryId === "new") {
      url = PA_BASE + "/danh-sach/phim-moi-cap-nhat?page=" + page;
    } else if (categoryId.indexOf("theloai:") === 0) {
      url = PA_BASE + "/v1/api/the-loai/" + categoryId.substring(8) + "?page=" + page + "&limit=" + PA_LIMIT;
    } else if (categoryId.indexOf("quocgia:") === 0) {
      url = PA_BASE + "/v1/api/quoc-gia/" + categoryId.substring(8) + "?page=" + page + "&limit=" + PA_LIMIT;
    } else {
      url = PA_BASE + "/v1/api/danh-sach/" + categoryId + "?page=" + page + "&limit=" + PA_LIMIT;
    }
    var d = paJson(url);
    if (!d) return paEmpty(page);
    return paListResult(d, page);
  } catch (e) { log("phimapi getList loi: " + e); return paEmpty(page); }
}

function getDetail(id) {
  try {
    var d = paJson(PA_BASE + "/phim/" + id);
    if (!d || !d.movie) return JSON.stringify({});
    var m = d.movie;
    var servers = [];
    var eps = d.episodes || [];
    for (var i = 0; i < eps.length; i++) {
      var list = [];
      var data = eps[i].server_data || [];
      for (var j = 0; j < data.length; j++) {
        list.push({
          name: data[j].name || ("Tập " + (j + 1)),
          url: data[j].link_m3u8 || "",
          embed: data[j].link_embed || ""
        });
      }
      servers.push({ name: eps[i].server_name || ("Server " + (i + 1)), episodes: list });
    }
    return JSON.stringify({
      id: m.slug || id,
      title: m.name || "",
      origin_name: m.origin_name || "",
      poster: paImg(m.poster_url),
      thumb: paImg(m.thumb_url),
      year: m.year || 0,
      quality: m.quality || "",
      lang: m.lang || "",
      episode_current: m.episode_current || "",
      episode_total: m.episode_total || "",
      content: m.content || "",
      type: m.type || "",
      servers: servers
    });
  } catch (e) { log("phimapi getDetail loi: " + e); return JSON.stringify({}); }
}

function search(keyword, page) {
  page = page || 1;
  try {
    var url = PA_BASE + "/v1/api/tim-kiem?keyword=" + encodeURIComponent(keyword) + "&page=" + page + "&limit=" + PA_LIMIT;
    var d = paJson(url);
    if (!d) return paEmpty(page);
    return paListResult(d, page);
  } catch (e) { log("phimapi search loi: " + e); return paEmpty(page); }
}
