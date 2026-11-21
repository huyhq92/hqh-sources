// Plugin MissKon cho app lai HQH — v1.0.0 — TRUYEN/GALLERY 18+
// !!! DAY LA NGUON TRUYEN TRANH / GALLERY ANH 18+, KHONG PHAI
// !!! VIDEO. DATA-PREP ONLY: "tap" o day la TUNG TRANG ANH cua
// !!! bai viet (URL anh truc tiep), app phim hien CHUA hien/phat
// !!! duoc dang nay. File nam o moviesx/ de san du lieu cho
// !!! registry 18+ khi app co man xem anh/truyen.
// Goc: plugin "MissKon" v1.0.0 trong he sinh thai VAX Player
// (repo plugin cua Tuangayxx/youngbi), chuyen sang hop dong HQH.
// Site dich: https://misskon.com — WordPress theme Sahifa/TieLabs,
// chuyen gallery anh gravure/cosplay 18+ (site song, tra 200 tu
// VM — kiem 21/11/2026).
// Co che:
//   - Danh sach: cao <article class="...item-list..."> (tieu de +
//     link o h2.post-box-title, anh bia o img data-src); phan
//     trang /page/{n}/. Tim kiem chuan WP: /?s={kw}.
//   - Chi tiet: "tap" = cac URL anh trong than bai viet
//     (<article id="the-post">, CDN *.misskon.com — kul./pok. —
//     duong dan /uploads/ hoac /media/), bo khoi lien quan yarpp,
//     bo anh placeholder SVG. Bai viet chi nhung san mot phan anh
//     xem truoc (vd bai "97 photos" co 11 anh tinh trong HTML).
// Host API: httpGet(url) -> string, log(msg). Moi ham tra ve CHUOI JSON (xem CONTRACT.md).
// ES5 (Rhino): var, khong arrow function, khong template literal.
// Bay Rhino: httpGet tra Java String — ep String(html) truoc khi dung regex.

var MK_BASE = "https://misskon.com";

function mkEmpty(page) {
  return JSON.stringify({ items: [], page: page || 1, totalPages: 1 });
}

function mkClean(s) {
  if (!s) return "";
  return String(s).replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\s+/g, " ").replace(/^\s+|\s+$/g, "");
}

function mkSlug(url) {
  if (!url) return "";
  var m = /^https?:\/\/[^\/]+\/(.+?)\/?$/.exec(url);
  return m ? m[1] : url;
}

function mkParseList(html, page) {
  var items = [];
  if (!html) return JSON.stringify({ items: items, page: page, totalPages: 1 });
  html = String(html);
  var seen = {};
  var parts = html.split("<article");
  for (var i = 1; i < parts.length; i++) {
    var card = parts[i];
    if (card.indexOf("item-list") === -1 && card.indexOf("post-box-title") === -1) continue;
    var lm = /<h2[^>]*class="[^"]*post-box-title[^"]*"[^>]*>\s*<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/.exec(card);
    if (!lm) continue;
    var slug = mkSlug(lm[1]);
    if (!slug || seen[slug]) continue;
    var im = /<img[^>]+(?:data-src|data-lazy-src)="([^"]+)"/.exec(card) || /<img[^>]+src="([^"]+)"/.exec(card);
    var thumb = "";
    if (im && im[1].indexOf("data:image") !== 0) thumb = im[1];
    seen[slug] = true;
    items.push({
      id: slug,
      title: mkClean(lm[2]) || slug,
      origin_name: "",
      poster: thumb,
      thumb: thumb,
      year: 0,
      quality: "Gallery",
      lang: "18+",
      episode_current: "",
      type: "manga"
    });
  }
  var totalPages = page;
  var pm = html.match(/\/page\/(\d+)\//g);
  if (pm) {
    for (var j = 0; j < pm.length; j++) {
      var n = parseInt(pm[j].replace(/[^0-9]/g, ""), 10);
      if (n > totalPages) totalPages = n;
    }
  }
  return JSON.stringify({ items: items, page: page, totalPages: totalPages });
}

function getCategories() {
  return JSON.stringify([
    { id: "latest", name: "Mới nhất" }
  ]);
}

function getList(categoryId, page) {
  page = page || 1;
  try {
    var url = page > 1 ? MK_BASE + "/page/" + page + "/" : MK_BASE + "/";
    var html = httpGet(url);
    if (!html) return mkEmpty(page);
    return mkParseList(html, page);
  } catch (e) { log("misskon getList loi: " + e); return mkEmpty(page); }
}

function search(keyword, page) {
  page = page || 1;
  try {
    var url = (page > 1 ? MK_BASE + "/page/" + page + "/?s=" : MK_BASE + "/?s=") + encodeURIComponent(keyword);
    var html = httpGet(url);
    if (!html) return mkEmpty(page);
    return mkParseList(html, page);
  } catch (e) { log("misskon search loi: " + e); return mkEmpty(page); }
}

function getDetail(id) {
  try {
    var slug = String(id || "").replace(/^https?:\/\/[^\/]+\//, "").replace(/\/$/, "");
    var html = httpGet(MK_BASE + "/" + slug + "/");
    if (!html) return JSON.stringify({});
    html = String(html);
    var tm = /<h1[^>]*class="[^"]*post-title[^"]*"[^>]*>([\s\S]*?)<\/h1>/.exec(html)
      || /property="og:title"\s+content="([^"]+)"/.exec(html);
    var title = tm ? mkClean(tm[1]) : slug;
    var om = /property="og:image"\s+content="([^"]+)"/.exec(html);
    var poster = om ? om[1] : "";
    // Than bai viet
    var body = html;
    var bi = html.indexOf('id="the-post"');
    if (bi >= 0) body = html.substring(bi);
    var ei = body.indexOf("</article>");
    if (ei >= 0) body = body.substring(0, ei);
    // Bo khoi bai lien quan yarpp
    var yi = body.indexOf("yarpp");
    if (yi >= 0) body = body.substring(0, yi);
    var eps = [];
    var seen = {};
    var re = /<img[^>]+(?:data-src|data-lazy-src|src)="([^"]+)"/g;
    var m;
    while ((m = re.exec(body)) !== null) {
      var u = m[1];
      if (u.indexOf("data:image") === 0) continue;
      // Anh noi dung nam tren CDN *.misskon.com (kul./pok.) duong
      // dan /uploads/ hoac /media/; bo anh theme o /wp-content/
      if (u.indexOf("misskon.com") === -1) continue;
      if (u.indexOf("/uploads/") === -1 && u.indexOf("/media/") === -1) continue;
      if (/avatar|gravatar|icon|logo|emoji/i.test(u)) continue;
      if (seen[u]) continue;
      seen[u] = true;
      eps.push({ name: "Trang " + (eps.length + 1), url: u, embed: "" });
    }
    if (!eps.length) return JSON.stringify({});
    return JSON.stringify({
      id: slug,
      title: title,
      origin_name: "",
      poster: poster,
      thumb: poster,
      year: 0,
      quality: "Gallery",
      lang: "18+",
      episode_current: eps.length + " ảnh",
      episode_total: String(eps.length),
      content: "",
      type: "manga",
      servers: [{ name: "MissKon", episodes: eps }]
    });
  } catch (e) { log("misskon getDetail loi: " + e); return JSON.stringify({}); }
}
