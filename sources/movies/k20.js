// Plugin CLB Phim Xưa (K20) cho app lai HQH — v1.0.0
// Nguon: addon K20 https://sc.k-20.xyz — giao thuc Stremio (catalog/meta/stream).
// Chep dung client K20 cua HQH-TV (hqh.54, da chay tren may thay):
//   - Danh sach:  GET /catalog/movie/clbpx-movie[.json | /skip=N.json | /search=kw.json]
//   - Chi tiet:   GET /meta/movie/{id} -> meta.videos[] (id tap cua addon)
//   - Link phat:  moi tap khong co san URL — goi GET /stream/movie/{videoId}
//     lay streams[0].url; neu la proxy-playlist thi goi tham so url= de lay
//     playlist goc phat thang (bo proxy khoi duong phat); link MP4 cua CLB
//     giu nguyen. Plugin giai quyet link ngay trong getDetail vi hop dong
//     plugin yeu cau url phat duoc trong chi tiet.
//   - Phan trang Stremio khong cho tong so trang: do co trang theo lan tra
//     dau (HQH lam y het), trang day thi bao con trang sau.
// Host API: httpGet(url) -> string, log(msg). Moi ham tra ve CHUOI JSON (xem CONTRACT.md).

var K20_BASE = "https://sc.k-20.xyz/";
var K20_TYPE = "movie";
var K20_CATALOG = "clbpx-movie";
var k20Step = 20;

function k20Json(url) {
  var raw = httpGet(url);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch (e) { log("k20 parse loi: " + e); return null; }
}

function k20Year(releaseInfo) {
  if (!releaseInfo) return 0;
  for (var i = 0; i + 3 < releaseInfo.length; i++) {
    var c = releaseInfo.charAt(i);
    if (c >= "0" && c <= "9") {
      var n = parseInt(releaseInfo.substring(i, i + 4), 10);
      return isNaN(n) ? 0 : n;
    }
  }
  return 0;
}

function k20Item(meta) {
  var poster = meta.poster || "";
  return {
    id: meta.id || "",
    title: meta.name || meta.id || "",
    origin_name: "",
    poster: poster,
    thumb: poster,
    year: k20Year(meta.releaseInfo || ""),
    quality: "",
    lang: "",
    episode_current: "",
    type: "movie"
  };
}

function k20ListResult(root, page) {
  var items = [];
  var metas = (root && root.metas) || [];
  for (var i = 0; i < metas.length; i++) {
    if (metas[i] && metas[i].id) items.push(k20Item(metas[i]));
  }
  if (page === 1 && items.length > 0) k20Step = items.length;
  var totalPages = page;
  if (k20Step > 0 && items.length >= k20Step) totalPages = page + 1;
  return JSON.stringify({ items: items, page: page, totalPages: totalPages });
}

function k20Empty(page) {
  return JSON.stringify({ items: [], page: page || 1, totalPages: 1 });
}

function k20Catalog(extras, page) {
  var url = K20_BASE + "catalog/" + K20_TYPE + "/" + K20_CATALOG
    + (extras ? "/" + extras : "") + ".json";
  var root = k20Json(url);
  if (!root) return k20Empty(page);
  return k20ListResult(root, page);
}

function getCategories() {
  return JSON.stringify([
    { id: "clbpx", name: "CLB Phim Xưa" }
  ]);
}

function getList(categoryId, page) {
  page = page || 1;
  try {
    var extras = "";
    if (page > 1) extras = "skip=" + ((page - 1) * k20Step);
    return k20Catalog(extras, page);
  } catch (e) { log("k20 getList loi: " + e); return k20Empty(page); }
}

function k20ProxyParam(url, name) {
  var q = url.indexOf("?");
  if (q < 0) return "";
  var pairs = url.substring(q + 1).split("&");
  for (var i = 0; i < pairs.length; i++) {
    var eq = pairs[i].indexOf("=");
    if (eq < 1) continue;
    try {
      if (decodeURIComponent(pairs[i].substring(0, eq)) === name) {
        return decodeURIComponent(pairs[i].substring(eq + 1));
      }
    } catch (e) { /* tham so hong thi bo qua */ }
  }
  return "";
}

function k20Resolve(videoRef) {
  var root = k20Json(K20_BASE + "stream/" + K20_TYPE + "/" + videoRef + ".json");
  var streams = (root && root.streams) || [];
  for (var i = 0; i < streams.length; i++) {
    var url = (streams[i] && streams[i].url) || "";
    if (!url) continue;
    if (url.indexOf("proxy-playlist") >= 0) {
      var origin = k20ProxyParam(url, "url");
      if (origin) return origin;
      if (url.indexOf("directSeg=") < 0) url += (url.indexOf("?") >= 0 ? "&" : "?") + "directSeg=1";
    }
    return url;
  }
  return "";
}

function getDetail(id) {
  try {
    var root = k20Json(K20_BASE + "meta/" + K20_TYPE + "/" + id + ".json");
    var meta = root && root.meta;
    if (!meta) return JSON.stringify({});
    var episodes = [];
    var videos = meta.videos || [];
    if (videos.length > 0) {
      for (var i = 0; i < videos.length; i++) {
        var vid = (videos[i] && videos[i].id) || "";
        if (!vid) continue;
        var title = videos[i].title || videos[i].name || ("Tập " + (i + 1));
        episodes.push({ name: title, url: k20Resolve(vid), embed: "" });
      }
    } else {
      episodes.push({ name: "Full", url: k20Resolve(id), embed: "" });
    }
    var poster = meta.poster || "";
    return JSON.stringify({
      id: id,
      title: meta.name || id,
      origin_name: "",
      poster: poster,
      thumb: poster,
      year: k20Year(meta.releaseInfo || ""),
      quality: "",
      lang: "",
      episode_current: "",
      episode_total: "",
      content: meta.description || "",
      type: "movie",
      servers: [{ name: "CLB Phim Xưa", episodes: episodes }]
    });
  } catch (e) { log("k20 getDetail loi: " + e); return JSON.stringify({}); }
}

function search(keyword, page) {
  page = page || 1;
  try {
    var extras = "search=" + encodeURIComponent(keyword);
    if (page > 1) extras += "&skip=" + ((page - 1) * k20Step);
    return k20Catalog(extras, page);
  } catch (e) { log("k20 search loi: " + e); return k20Empty(page); }
}
