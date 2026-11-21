// Plugin TopXX cho app lai HQH — v1.0.0 — NGUON 18+
// Goc: plugin "TopXX" v1.0.1 trong he sinh thai VAX Player
// (repo plugin cua Tuangayxx/youngbi), chuyen sang hop dong HQH.
// Site dich: https://topxx.vip — API JSON cong khai tai
// https://topxx.vip/api/v1 (kho ~217 nghin video, cap nhat lien tuc).
// Co che:
//   - The loai: GET /api/v1/genres -> data[] {code, translations}
//     (+ muc mac dinh Moi nhat / Hom nay + quoc gia vn/cn/jp/us).
//   - Danh sach: GET /movies/latest, /movies/today,
//     /genres/{code}/movies, /countries/{code}/movies (phan trang
//     ?page=, meta.last_page); tim kiem: /movies/latest?q={kw}.
//   - Chi tiet: GET /movies/{code} -> data.sources[] dang
//     {embed_code, link: https://xhub.network/player/{a}/{b}}.
//     Link phat HLS duoc DUNG THANG theo quy tac cua chinh VAX:
//     https://embed.streamxx.net/stream/{a}/{b}/main.m3u8
//     kem Referer https://topxx.vip/ (truong "referer" tung tap).
// Tinh trang kiem chung 21/11/2026 tu VM: API chay tot (danh sach
// 30 muc/trang, tim kiem va chi tiet deu tra du lieu that, nguon
// phat boc dung cau truc). RIENG host phat embed.streamxx.net
// KHONG ket noi duoc tu VM nay (het thoi gian cho 2 lan thu, ke ca
// khi gan Referer) -> link phat danh dau "can kiem lai tren may
// that"; co che dung link la cua chinh plugin VAX goc.
// Host API: httpGet(url) -> string, log(msg). Moi ham tra ve CHUOI JSON (xem CONTRACT.md).
// ES5 (Rhino): var, khong arrow function, khong template literal.

var TX_API = "https://topxx.vip/api/v1";
var TX_SITE = "https://topxx.vip";

function txEmpty(page) {
  return JSON.stringify({ items: [], page: page || 1, totalPages: 1 });
}

function txJson(url) {
  var raw = httpGet(url);
  if (!raw) return null;
  raw = String(raw);
  if (raw.charAt(0) !== "{") return null;
  try { return JSON.parse(raw); } catch (e) { log("topxx parse loi: " + e); return null; }
}

function txTrans(item, key) {
  var list = (item && (item.trans || item.translations)) || [];
  var i;
  for (i = 0; i < list.length; i++) if (list[i].locale === "vi" && list[i][key]) return list[i][key];
  for (i = 0; i < list.length; i++) if (list[i].locale === "en" && list[i][key]) return list[i][key];
  if (list.length && list[0][key]) return list[0][key];
  return "";
}

function txDur(sec) {
  if (!sec) return "";
  var s = parseInt(sec, 10);
  if (isNaN(s) || s <= 0) return String(sec);
  var m = Math.floor(s / 60);
  var r = s % 60;
  return m + ":" + (r < 10 ? "0" : "") + r;
}

function txItem(it) {
  var year = 0;
  if (it.publish_at) {
    var ym = /(\d{4})/.exec(it.publish_at);
    if (ym) year = parseInt(ym[1], 10);
  }
  return {
    id: it.code || "",
    title: txTrans(it, "title") || it.code || "",
    origin_name: "",
    poster: it.poster || it.backdrop || it.thumbnail || "",
    thumb: it.thumbnail || it.backdrop || "",
    year: year,
    quality: it.quality || "HD",
    lang: "18+",
    episode_current: txDur(it.duration),
    type: "single"
  };
}

function txListResult(res, page) {
  if (!res || !res.data) return txEmpty(page);
  var items = [];
  for (var i = 0; i < res.data.length; i++) {
    if (res.data[i].code) items.push(txItem(res.data[i]));
  }
  var totalPages = 1;
  if (res.meta && res.meta.last_page) totalPages = res.meta.last_page;
  return JSON.stringify({ items: items, page: page, totalPages: totalPages });
}

function getCategories() {
  var cats = [
    { id: "latest", name: "Mới nhất" },
    { id: "today", name: "Hôm nay" },
    { id: "c:vn", name: "Việt Nam" },
    { id: "c:jp", name: "Nhật Bản" },
    { id: "c:cn", name: "Trung Quốc" },
    { id: "c:us", name: "Âu Mỹ" }
  ];
  try {
    var res = txJson(TX_API + "/genres");
    if (res && res.data) {
      for (var i = 0; i < res.data.length && i < 40; i++) {
        var g = res.data[i];
        var name = txTrans(g, "name");
        if (g.code && name) cats.push({ id: "g:" + g.code, name: name });
      }
    }
  } catch (e) { log("topxx getCategories loi: " + e); }
  return JSON.stringify(cats);
}

function getList(categoryId, page) {
  page = page || 1;
  try {
    var path;
    if (categoryId === "today") path = "/movies/today";
    else if (categoryId && categoryId.indexOf("g:") === 0) path = "/genres/" + encodeURIComponent(categoryId.substring(2)) + "/movies";
    else if (categoryId && categoryId.indexOf("c:") === 0) path = "/countries/" + encodeURIComponent(categoryId.substring(2)) + "/movies";
    else path = "/movies/latest";
    return txListResult(txJson(TX_API + path + "?page=" + page), page);
  } catch (e) { log("topxx getList loi: " + e); return txEmpty(page); }
}

function search(keyword, page) {
  page = page || 1;
  try {
    var url = TX_API + "/movies/latest?q=" + encodeURIComponent(keyword) + "&page=" + page;
    return txListResult(txJson(url), page);
  } catch (e) { log("topxx search loi: " + e); return txEmpty(page); }
}

function txStreamFromEmbed(link) {
  if (!link) return "";
  var m = /xhub\.network\/player\/(.+)$/.exec(link);
  if (!m) return "";
  var tail = m[1].replace(/\/$/, "");
  return "https://embed.streamxx.net/stream/" + tail + "/main.m3u8";
}

function getDetail(id) {
  try {
    var res = txJson(TX_API + "/movies/" + encodeURIComponent(id));
    if (!res || !res.data) return JSON.stringify({});
    var d = res.data;
    var servers = [];
    var sources = d.sources || [];
    for (var i = 0; i < sources.length; i++) {
      var stream = txStreamFromEmbed(sources[i].link);
      if (!stream) continue;
      servers.push({
        name: sources[i].embed_code || ("Server " + (i + 1)),
        episodes: [{ name: "Full", url: stream, embed: sources[i].link || "", referer: TX_SITE + "/" }]
      });
    }
    if (!servers.length) return JSON.stringify({});
    var year = 0;
    if (d.publish_at) {
      var ym = /(\d{4})/.exec(d.publish_at);
      if (ym) year = parseInt(ym[1], 10);
    }
    return JSON.stringify({
      id: d.code || String(id),
      title: txTrans(d, "title") || d.code || "",
      origin_name: "",
      poster: d.poster || d.backdrop || d.thumbnail || "",
      thumb: d.thumbnail || d.backdrop || "",
      year: year,
      quality: d.quality || "HD",
      lang: "18+",
      episode_current: "Full",
      episode_total: "1",
      content: txTrans(d, "description") || txTrans(d, "content") || "",
      type: "single",
      servers: servers
    });
  } catch (e) { log("topxx getDetail loi: " + e); return JSON.stringify({}); }
}
