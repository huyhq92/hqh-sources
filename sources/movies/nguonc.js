// Plugin NguonC cho app lai HQH — v1.0.0
// API: https://phim.nguonc.com/api
// Cau truc theo dung ban HQH da chay tren may thay (gop chi tiet NguonC song song PhimAPI).
// LUU Y: tu may chu phan tich, phim.nguonc.com bi Cloudflare chan (403) nen chua kiem lai
// truc tiep duoc — can kiem lai tren may khi app xong. Code viet phong thu: chap nhan
// nhieu bien the ten truong, loi thi tra JSON rong dung dang (xem CONTRACT.md).
// Host API: httpGet(url) -> string, log(msg). Moi ham tra ve CHUOI JSON.

var NC_BASE = "https://phim.nguonc.com/api";

function ncJson(url) {
  var raw = httpGet(url);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch (e) { log("nguonc parse loi: " + e); return null; }
}

function ncItem(m) {
  return {
    id: m.slug || "",
    title: m.name || "",
    origin_name: m.original_name || m.origin_name || "",
    poster: m.poster_url || "",
    thumb: m.thumb_url || "",
    year: m.year || 0,
    quality: m.quality || "",
    lang: m.language || m.lang || "",
    episode_current: m.current_episode || m.episode_current || "",
    type: m.type || ""
  };
}

function ncListResult(d, page) {
  var items = [];
  var arr = (d && (d.items || (d.data && d.data.items))) || [];
  for (var i = 0; i < arr.length; i++) items.push(ncItem(arr[i]));
  var totalPages = 1;
  var pg = d && (d.paginate || d.pagination || (d.data && d.data.paginate));
  if (pg) totalPages = pg.total_page || pg.totalPages || pg.last_page || 1;
  return JSON.stringify({ items: items, page: page, totalPages: totalPages });
}

function ncEmpty(page) {
  return JSON.stringify({ items: [], page: page || 1, totalPages: 1 });
}

function getCategories() {
  var cats = [
    { id: "danh-sach", name: "Mới cập nhật" },
    { id: "phim-bo", name: "Phim bộ" },
    { id: "phim-le", name: "Phim lẻ" },
    { id: "hoat-hinh", name: "Hoạt hình" }
  ];
  return JSON.stringify(cats);
}

function getList(categoryId, page) {
  page = page || 1;
  try {
    var url;
    if (categoryId === "danh-sach") {
      url = NC_BASE + "/films/danh-sach?page=" + page;
    } else if (categoryId.indexOf("theloai:") === 0) {
      url = NC_BASE + "/films/the-loai/" + categoryId.substring(8) + "?page=" + page;
    } else {
      url = NC_BASE + "/films/" + categoryId + "?page=" + page;
    }
    var d = ncJson(url);
    if (!d) return ncEmpty(page);
    return ncListResult(d, page);
  } catch (e) { log("nguonc getList loi: " + e); return ncEmpty(page); }
}

function getDetail(id) {
  try {
    var d = ncJson(NC_BASE + "/film/" + id);
    var m = (d && (d.film || d.movie || d.data)) || null;
    if (!m) return JSON.stringify({});
    var servers = [];
    var eps = m.episodes || [];
    for (var i = 0; i < eps.length; i++) {
      var list = [];
      var data = eps[i].items || eps[i].server_data || [];
      for (var j = 0; j < data.length; j++) {
        list.push({
          name: data[j].name || ("Tập " + (j + 1)),
          url: data[j].m3u8 || data[j].link_m3u8 || "",
          embed: data[j].embed || data[j].link_embed || ""
        });
      }
      servers.push({ name: eps[i].server || eps[i].server_name || ("Server " + (i + 1)), episodes: list });
    }
    var detail = ncItem(m);
    detail.episode_total = m.total_episodes || m.episode_total || "";
    detail.content = m.description || m.content || "";
    detail.servers = servers;
    return JSON.stringify(detail);
  } catch (e) { log("nguonc getDetail loi: " + e); return JSON.stringify({}); }
}

function search(keyword, page) {
  page = page || 1;
  try {
    var url = NC_BASE + "/films/search?keyword=" + encodeURIComponent(keyword) + "&page=" + page;
    var d = ncJson(url);
    if (!d) return ncEmpty(page);
    return ncListResult(d, page);
  } catch (e) { log("nguonc search loi: " + e); return ncEmpty(page); }
}
