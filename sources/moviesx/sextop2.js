// Plugin SexTop2 cho app lai HQH — v1.0.0 — NGUON 18+
// Goc: plugin "Sextop2" v1.0.0 trong he sinh thai VAX Player
// (repo plugin cua Tuangayxx/youngbi), chuyen sang hop dong HQH.
// Site dich: https://sextop1.forum — cung ho site/engine voi
// SexTop1 (vnsextop1.com), chi khac mien. Co che giong het
// sextop1.js: cao the .item o /{slug} va /the-loai/{slug}, tim
// kiem /search?k=, chi tiet boc data-source (URL nhung) roi giai
// link truc tiep trong getDetail, referer = goc site.
// (Ban VAX goc co loi tron ten mien sextop1.movie vao duong chi
// tiet — ban be nay dung nhat quan sextop1.forum.)
// TINH TRANG KIEM CHUNG (21/11/2026): sextop1.forum khong ket
// noi duoc tu VM nay (timeout); ho site song da duoc xac nhan
// qua vnsextop1.com (trinh duyet cao moi trong ngay). Danh dau
// "VM-blocked — CAN KIEM LAI TREN MAY THAT", chua kiem dau-cuoi
// duoc tu VM (tien le novahd/sextop1).
// Host API: httpGet(url) -> string, log(msg). Moi ham tra ve CHUOI JSON (xem CONTRACT.md).
// ES5 (Rhino): var, khong arrow function, khong template literal.
// Bay Rhino: httpGet tra Java String — ep String(html) truoc khi dung regex.

var SX_BASE = "https://sextop1.forum";
var SX_NAME = "SexTop2";

function sxEmpty(page) {
  return JSON.stringify({ items: [], page: page || 1, totalPages: 1 });
}

function sxClean(s) {
  if (!s) return "";
  return String(s).replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\s+/g, " ").replace(/^\s+|\s+$/g, "");
}

function sxParseList(html, page) {
  var items = [];
  if (!html) return JSON.stringify({ items: items, page: page, totalPages: 1 });
  html = String(html);
  var seen = {};
  var parts = html.split('<div class="item');
  for (var i = 1; i < parts.length; i++) {
    var card = parts[i];
    var lm = /href="https?:\/\/[^"]+\/(phim-sex|actresses)\/([^"\/]+)\/?"/.exec(card);
    if (!lm) continue;
    var slug = lm[2];
    if (seen[slug]) continue;
    var tm = /<h4[^>]*>([\s\S]*?)<\/h4>/.exec(card);
    var title = tm ? sxClean(tm[1]) : slug;
    var im = /<img[^>]+(?:data-src|data-lazy-src|src)="([^"]+)"/.exec(card);
    var poster = "";
    if (im && im[1].indexOf("data:image") !== 0) poster = im[1];
    var lb = /item__labels">([\s\S]*?)<\/div>/.exec(card);
    var label = "";
    if (lb) {
      var sm = /<span[^>]*>([^<]+)<\/span>/.exec(lb[1]);
      if (sm) label = sxClean(sm[1]);
    }
    seen[slug] = true;
    items.push({
      id: slug,
      title: title,
      origin_name: "",
      poster: poster,
      thumb: poster,
      year: 0,
      quality: "HD",
      lang: label || "Vietsub",
      episode_current: label,
      type: "single"
    });
  }
  var totalPages = page;
  var pm = html.match(/page=(\d+)/g);
  if (pm) {
    for (var j = 0; j < pm.length; j++) {
      var n = parseInt(pm[j].replace("page=", ""), 10);
      if (n > totalPages) totalPages = n;
    }
  }
  return JSON.stringify({ items: items, page: page, totalPages: totalPages });
}

function getCategories() {
  return JSON.stringify([
    { id: "p:phim-sex-moi", name: "Mới cập nhật" },
    { id: "p:phim-sex-viet-nam", name: "Việt Nam" },
    { id: "p:phim-sex-trung-quoc", name: "Trung Quốc" },
    { id: "p:phim-sex-nhat-ban", name: "Nhật Bản" },
    { id: "p:phim-sex-han-quoc", name: "Hàn Quốc" },
    { id: "p:phim-sex-chau-au", name: "Châu Âu" },
    { id: "g:loan-luan", name: "Loạn luân" },
    { id: "g:tap-the", name: "Tập thể" },
    { id: "g:hoc-duong", name: "Học đường" },
    { id: "g:vung-trom", name: "Vụng trộm" },
    { id: "g:gai-teen", name: "Gái teen" },
    { id: "g:dit-nhau", name: "Tổng hợp" }
  ]);
}

function getList(categoryId, page) {
  page = page || 1;
  try {
    var url;
    if (categoryId && categoryId.indexOf("g:") === 0) url = SX_BASE + "/the-loai/" + categoryId.substring(2);
    else if (categoryId && categoryId.indexOf("p:") === 0) url = SX_BASE + "/" + categoryId.substring(2);
    else url = SX_BASE + "/phim-sex-moi";
    if (page > 1) url += "?page=" + page;
    var html = httpGet(url);
    if (!html) return sxEmpty(page);
    return sxParseList(html, page);
  } catch (e) { log(SX_NAME + " getList loi: " + e); return sxEmpty(page); }
}

function search(keyword, page) {
  page = page || 1;
  try {
    var url = SX_BASE + "/search?k=" + encodeURIComponent(keyword) + "&page=" + page;
    var html = httpGet(url);
    if (!html) return sxEmpty(page);
    return sxParseList(html, page);
  } catch (e) { log(SX_NAME + " search loi: " + e); return sxEmpty(page); }
}

// Giai nen Dean Edwards (dung cho trang nhung file-host)
function sxUnpack(html) {
  var re = /\}\('([\s\S]*?)',(\d+),(\d+),'([\s\S]*?)'\.split\('\|'\)/;
  var m = re.exec(html);
  if (!m) return "";
  var payload = m[1];
  var radix = parseInt(m[2], 10);
  var count = parseInt(m[3], 10);
  var words = m[4].split("|");
  if (radix > 36 || radix < 2) return "";
  for (var i = count - 1; i >= 0; i--) {
    var w = words[i];
    if (!w) continue;
    payload = payload.replace(new RegExp("\\b" + i.toString(radix) + "\\b", "g"), w);
  }
  return payload;
}

function sxFindDirect(text) {
  if (!text) return "";
  var pats = [
    /links\.hls3\s*=\s*["']([^"']+)["']/,
    /links\.hls2\s*=\s*["']([^"']+)["']/,
    /file\s*:\s*["'](https?:[^"']+\.(?:m3u8|mp4)[^"']*)["']/,
    /["']file["']\s*:\s*["'](https?:[^"']+\.(?:m3u8|mp4)[^"']*)["']/,
    /source\s*:\s*["'](https?:[^"']+\.(?:m3u8|mp4)[^"']*)["']/,
    /(https?:[^\s"'<>\\]+\.m3u8[^\s"'<>\\]*)/,
    /(https?:[^\s"'<>\\]+\.mp4[^\s"'<>\\]*)/
  ];
  for (var i = 0; i < pats.length; i++) {
    var m = pats[i].exec(text);
    if (m) return m[1].replace(/\\\//g, "/");
  }
  return "";
}

function sxResolveEmbed(embedUrl) {
  var html = httpGet(embedUrl);
  if (!html) return "";
  html = String(html);
  var direct = sxFindDirect(html);
  if (direct) return direct;
  var unpacked = sxUnpack(html);
  if (unpacked) return sxFindDirect(unpacked);
  return "";
}

function getDetail(id) {
  try {
    var slug = String(id || "").replace(/^https?:\/\/[^\/]+\//, "").replace(/^phim-sex\//, "").replace(/\/$/, "");
    var html = httpGet(SX_BASE + "/phim-sex/" + slug);
    if (!html) return JSON.stringify({});
    html = String(html);
    var tm = /<h1[^>]*class="[^"]*heading__title[^"]*"[^>]*>([\s\S]*?)<\/h1>/.exec(html)
      || /<h1[^>]*>([\s\S]*?)<\/h1>/.exec(html);
    var title = tm ? sxClean(tm[1]) : slug;
    var om = /property="og:image"\s+content="([^"]+)"/.exec(html);
    var poster = om ? om[1] : "";
    var am = /<article[^>]*>([\s\S]*?)<\/article>/.exec(html);
    var content = am ? sxClean(am[1]) : "";
    if (content.length > 600) content = content.substring(0, 600);
    // Cac nut nguon phat: class chua set-player-source / player__cdn
    // kem data-source = URL nhung (ca hai thu tu thuoc tinh)
    var embeds = [];
    var seen = {};
    var re1 = /class="[^"]*(?:set-player-source|player__cdn)[^"]*"[^>]*data-source="([^"]+)"/g;
    var re2 = /data-source="([^"]+)"[^>]*class="[^"]*(?:set-player-source|player__cdn)[^"]*"/g;
    var m;
    while ((m = re1.exec(html)) !== null) { if (!seen[m[1]]) { seen[m[1]] = true; embeds.push(m[1]); } }
    while ((m = re2.exec(html)) !== null) { if (!seen[m[1]]) { seen[m[1]] = true; embeds.push(m[1]); } }
    if (!embeds.length) return JSON.stringify({});
    var servers = [];
    for (var i = 0; i < embeds.length; i++) {
      var direct = sxResolveEmbed(embeds[i]);
      if (direct) {
        servers.push({
          name: "Server " + (servers.length + 1),
          episodes: [{ name: "Full", url: direct, embed: embeds[i], referer: SX_BASE + "/" }]
        });
      }
    }
    if (!servers.length) return JSON.stringify({});
    return JSON.stringify({
      id: slug,
      title: title,
      origin_name: "",
      poster: poster,
      thumb: poster,
      year: 0,
      quality: "HD",
      lang: "Vietsub",
      episode_current: "Full",
      episode_total: "1",
      content: content,
      type: "single",
      servers: servers
    });
  } catch (e) { log(SX_NAME + " getDetail loi: " + e); return JSON.stringify({}); }
}
