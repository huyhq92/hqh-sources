// Plugin MissAV cho app lai HQH — v1.0.0 — NGUON 18+
// Goc: plugin "MissAV" v1.1.1 trong he sinh thai VAX Player
// (repo plugin cua Tuangayxx/youngbi), chuyen sang hop dong HQH.
// Site dich: MissAV (JAV) — mien chinh https://missav.media,
// mien phu https://missav123.com (plugin thu ca hai, mien nao tra
// trang that thi dung; MissAV doi mien lien tuc).
// Co che:
//   - Danh sach: cao HTML cac trang /vi/... (the "thumbnail group":
//     link /vi/{ma-phim}, anh cover-t.jpg -> cover.jpg, alt = tieu de).
//   - Tim kiem: /vi/search/{tu-khoa} — trang co san card tinh trong
//     HTML (da kiem 21/11/2026: 12 card), cao nhu danh sach.
//   - Chi tiet: trang phim chua UUID cua video (trong URL anh seek
//     surrit.mrstcdn.store/{uuid}/seek/... va trong script packer).
//     Link phat = https://surrit.com/{uuid}/playlist.m3u8, bat buoc
//     kem Referer https://missav123.com/ (truong "referer" tung tap).
// Tinh trang kiem chung 21/11/2026 tu VM: missav.media tra 200,
// danh sach 12 card/trang, chi tiet boc duoc UUID that. RIENG host
// phat surrit.com bi Cloudflare chan IP VM (403 "Cloudflare
// protection") -> chua kiem phat duoc tu VM, danh dau
// "can kiem lai tren may that". missav123.com cung 403 tu VM nen
// ban nay uu tien missav.media.
// Host API: httpGet(url) -> string, log(msg). Moi ham tra ve CHUOI JSON (xem CONTRACT.md).
// ES5 (Rhino): var, khong arrow function, khong template literal.
// Bay Rhino: httpGet tra Java String — ep String(html) truoc khi dung regex.

var MA_HOSTS = ["https://missav.media", "https://missav123.com"];
var MA_REFERER = "https://missav123.com/";

var MA_RESERVED = {
  "new": 1, "release": 1, "vip": 1, "genres": 1, "actresses": 1, "makers": 1,
  "series": 1, "search": 1, "uncensored-leak": 1, "today-hot": 1, "weekly-hot": 1,
  "monthly-hot": 1, "english-subtitle": 1, "chinese-subtitle": 1, "ranking": 1
};

function maEmpty(page) {
  return JSON.stringify({ items: [], page: page || 1, totalPages: 1 });
}

function maClean(s) {
  if (!s) return "";
  return String(s).replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\s+/g, " ").replace(/^\s+|\s+$/g, "");
}

// Tai trang theo duong dan (khong chua host); thu tung host, tra ve
// {host, html} cua host dau tien tra trang that (khong phai trang
// chan Cloudflare), hoac null.
function maFetch(path) {
  for (var i = 0; i < MA_HOSTS.length; i++) {
    var raw = httpGet(MA_HOSTS[i] + path);
    if (!raw) continue;
    var html = String(raw);
    if (html.length < 3000) continue;
    if (html.indexOf("Attention Required") >= 0 || html.indexOf("Just a moment") >= 0) continue;
    if (html.indexOf("missav") === -1 && html.indexOf("thumbnail") === -1) continue;
    return { host: MA_HOSTS[i], html: html };
  }
  return null;
}

function maParseCards(html, host) {
  var items = [];
  var seen = {};
  var parts = String(html).split("thumbnail group");
  for (var i = 1; i < parts.length; i++) {
    var card = parts[i];
    var lm = /href="https?:\/\/[^"]+\/vi\/([a-zA-Z0-9][a-zA-Z0-9\-]*)"/.exec(card);
    if (!lm) continue;
    var code = lm[1];
    if (MA_RESERVED[code]) continue;
    if (seen[code]) continue;
    var im = /<img[^>]+data-src="([^"]+)"/.exec(card) || /<img[^>]+src="([^"]+)"/.exec(card);
    var thumb = im ? im[1] : "";
    if (thumb.indexOf("cover-t.jpg") >= 0) thumb = thumb.replace("cover-t.jpg", "cover.jpg");
    var alt = /<img[^>]+alt="([^"]+)"/.exec(card);
    var title = alt ? maClean(alt[1]) : "";
    if (!title) title = code.toUpperCase();
    var dur = /<span[^>]*>\s*(\d+:\d+:\d+)\s*<\/span>/.exec(card);
    seen[code] = true;
    items.push({
      id: code,
      title: title,
      origin_name: code.toUpperCase(),
      poster: thumb,
      thumb: thumb,
      year: 0,
      quality: "HD",
      lang: "Vietsub",
      episode_current: dur ? dur[1] : "",
      type: "single"
    });
  }
  return items;
}

function maListResult(html, host, page) {
  var items = maParseCards(html, host);
  var totalPages = page;
  var pm = String(html).match(/[?&]page=(\d+)/g);
  if (pm) {
    for (var i = 0; i < pm.length; i++) {
      var n = parseInt(pm[i].replace(/[^0-9]/g, ""), 10);
      if (n > totalPages) totalPages = n;
    }
  }
  return JSON.stringify({ items: items, page: page, totalPages: totalPages });
}

function getCategories() {
  return JSON.stringify([
    { id: "vi/new", name: "Mới cập nhật" },
    { id: "vi/release", name: "Phát hành mới" },
    { id: "vi/today-hot", name: "Hot hôm nay" },
    { id: "vi/weekly-hot", name: "Hot tuần này" },
    { id: "vi/monthly-hot", name: "Hot tháng này" },
    { id: "vi/uncensored-leak", name: "Không che (rò rỉ)" },
    { id: "vi/series/FC2", name: "FC2" },
    { id: "vi/series/HEYZO", name: "HEYZO" },
    { id: "vi/series/1pondo", name: "1pondo" },
    { id: "vi/series/Caribbeancom", name: "Caribbeancom" },
    { id: "vi/series/SIRO", name: "SIRO" },
    { id: "vi/series/LUXU", name: "LUXU" },
    { id: "vi/series/GANA", name: "GANA" },
    { id: "vi/genres/VR", name: "VR" }
  ]);
}

function getList(categoryId, page) {
  page = page || 1;
  try {
    var path = "/" + (categoryId || "vi/new") + "?page=" + page;
    var r = maFetch(path);
    if (!r) return maEmpty(page);
    return maListResult(r.html, r.host, page);
  } catch (e) { log("missav getList loi: " + e); return maEmpty(page); }
}

function search(keyword, page) {
  page = page || 1;
  try {
    var r = maFetch("/vi/search/" + encodeURIComponent(keyword) + "?page=" + page);
    if (!r) return maEmpty(page);
    return maListResult(r.html, r.host, page);
  } catch (e) { log("missav search loi: " + e); return maEmpty(page); }
}

function maExtractUuid(html) {
  html = String(html);
  // 1) UUID canh "surrit" (URL anh seek / script player)
  var re = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
  var m;
  var first = "";
  while ((m = re.exec(html)) !== null) {
    var u = m[0];
    if (!first) first = u;
    var ctx = html.substring(Math.max(0, m.index - 100), Math.min(html.length, m.index + 140));
    if (ctx.indexOf("surrit") >= 0 || ctx.indexOf("seek") >= 0) return u;
  }
  // 2) Giai script packer chua cac manh UUID + token "surrit":
  //    cac manh hex trong mang split('|') nam NGUOC thu tu doan.
  var em = /eval\(function\(p,a,c,k,e,d\)[\s\S]*?'([^']+)'\.split\('\|'\)/i.exec(html);
  if (em && (em[1].indexOf("surrit") >= 0 || em[1].indexOf("sixyik") >= 0)) {
    var parts = em[1].split("|");
    var hex = [];
    for (var i = 0; i < parts.length; i++) {
      if (/^[0-9a-f]{8}$/.test(parts[i]) || /^[0-9a-f]{12}$/.test(parts[i]) || /^[0-9a-f]{4}$/.test(parts[i])) hex.push(parts[i]);
    }
    // Thu ca hai chieu ghep 5 manh dau tien
    if (hex.length >= 5) {
      var fwd = hex[0] + "-" + hex[1] + "-" + hex[2] + "-" + hex[3] + "-" + hex[4];
      var rev = hex[4] + "-" + hex[3] + "-" + hex[2] + "-" + hex[1] + "-" + hex[0];
      if (html.indexOf(fwd) >= 0) return fwd;
      if (html.indexOf(rev) >= 0) return rev;
      return rev; // ban hien tai: thu tu nguoc khop UUID in thuong tren trang
    }
  }
  return first;
}

function getDetail(id) {
  try {
    var code = String(id || "").replace(/^\/+/, "").replace(/^vi\//, "");
    var r = maFetch("/vi/" + code);
    if (!r) return JSON.stringify({});
    var html = r.html;
    var tm = /property="og:title"\s+content="([^"]+)"/.exec(html);
    var im = /property="og:image"\s+content="([^"]+)"/.exec(html);
    var dm = /property="og:description"\s+content="([^"]+)"/.exec(html);
    var uuid = maExtractUuid(html);
    if (!uuid) return JSON.stringify({});
    var stream = "https://surrit.com/" + uuid + "/playlist.m3u8";
    return JSON.stringify({
      id: code,
      title: tm ? maClean(tm[1]) : code.toUpperCase(),
      origin_name: code.toUpperCase(),
      poster: im ? im[1] : "",
      thumb: im ? im[1] : "",
      year: 0,
      quality: "HD",
      lang: "Vietsub",
      episode_current: "Full",
      episode_total: "1",
      content: dm ? maClean(dm[1]) : "",
      type: "single",
      servers: [{
        name: "Surrit",
        episodes: [{ name: "Full", url: stream, embed: r.host + "/vi/" + code, referer: MA_REFERER }]
      }]
    });
  } catch (e) { log("missav getDetail loi: " + e); return JSON.stringify({}); }
}
