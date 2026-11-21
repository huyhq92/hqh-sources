// Plugin PhimHDCS cho app lai HQH — v1.0.0
// Goc: plugin "PhimHDCS" v1.0.3 trong he sinh thai VAX Player
// (repo plugin cua Tuangayxx/youngbi), chuyen sang hop dong HQH.
// LUU Y TEN MIEN: phimhdcs.com (mien ban goc VAX tro toi) DA HET HAN —
// kiem 21/11/2026 trang chu la trang "Domain registration has expired"
// cua Namecheap. Site da chuyen sang https://phimhdcss.com (them mot
// chu "s"), cung mot nen tang/giao dien/du lieu. Ban be nay chay tren
// phimhdcss.com, host nam trong 1 hang so HD_BASE o dau file.
// Co che:
//   - Danh sach/tim kiem: cao HTML (/danh-sach/{slug}, /the-loai/{slug},
//     loc ?filter[category]={id}, tim kiem ?search=) — the phim
//     <li class="item"> + nhan trang thai + link /{slug-id}.
//   - Chi tiet: trang phim chua cac muc "Danh sach Server X:" voi link
//     xem dang /{slug}/tap-{n}-{episodeId}.
//   - Giai link (trong getDetail, tung tap mot): trang xem chua
//     _0xData = {episodeId: [cac manh base64]} va muoi _0xS. Giai:
//     noi cac manh -> DAO NGUOC chuoi -> xoa chuoi muoi -> base64
//     decode -> URL HLS truc tiep (play.streamxemphimhd.site).
//     Da kiem chung that 21/11/2026: giai ra master.txt dang HLS.
//   - CDN phat (play.streamxemphimhd.site) CHAN IP VM nay (403 ca khi
//     gan Referer, chan ca trang goc cua CDN) -> link giai ra chua
//     kiem phat duoc tu VM, danh dau "can kiem lai tren may that";
//     moi tap gan kem referer = goc site de may that phat.
//   - Phim bo dai tap: getDetail phai tai tung trang xem nen se cham
//     (gioi han giai 200 tap/lan goi; tap thua van liet ke voi embed).
// Host API: httpGet(url) -> string, log(msg). Moi ham tra ve CHUOI JSON (xem CONTRACT.md).
// ES5 (Rhino): var, khong arrow function, khong template literal.
// Bay Rhino: httpGet tra Java String — ep String(html) truoc khi dung regex.

var HD_BASE = "https://phimhdcss.com";
var HD_MAX_RESOLVE = 200;

function hdEmpty(page) {
  return JSON.stringify({ items: [], page: page || 1, totalPages: 1 });
}

function hdClean(s) {
  if (!s) return "";
  return String(s).replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/\s+/g, " ").replace(/^\s+|\s+$/g, "");
}

function hdAbs(u) {
  if (!u) return "";
  if (u.indexOf("http") === 0) return u;
  return HD_BASE + (u.charAt(0) === "/" ? u : "/" + u);
}

function hdB64Decode(str) {
  var lookup = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  var result = "";
  str = String(str).replace(/[^A-Za-z0-9+\/=]/g, "");
  var len = str.length;
  for (var i = 0; i < len; i += 4) {
    var a = lookup.indexOf(str.charAt(i));
    var b = i + 1 < len ? lookup.indexOf(str.charAt(i + 1)) : 0;
    var c = i + 2 < len ? lookup.indexOf(str.charAt(i + 2)) : -1;
    var d = i + 3 < len ? lookup.indexOf(str.charAt(i + 3)) : -1;
    if (a < 0 || b < 0) break;
    result += String.fromCharCode((a << 2) | (b >> 4));
    if (c !== -1) result += String.fromCharCode(((b & 15) << 4) | (c >> 2));
    if (d !== -1) result += String.fromCharCode(((c & 3) << 6) | d);
  }
  return result;
}

function hdParseList(html, page) {
  var items = [];
  if (!html) return JSON.stringify({ items: items, page: page, totalPages: 1 });
  html = String(html);
  var re = /<li\s+class="item[^"]*">\s*<span\s+class="label">([^<]+)<\/span>\s*<a\s+href="https:\/\/phimhdcss\.com\/([^"]+)"\s+title="([^"]+)">\s*<img[^>]+src="([^"]+)"/gi;
  var m;
  while ((m = re.exec(html)) !== null) {
    var label = hdClean(m[1]);
    var ep = "";
    var em = /(Tập \d+|Hoàn [tT]ất \(\d+\/\d+\)|Full)/i.exec(label);
    if (em) ep = em[1];
    var lang = label.replace(ep, "").replace(/^\s*\+\s*/, "").replace(/^\s+|\s+$/g, "");
    var ym = /(\d{4})/.exec(m[3]);
    items.push({
      id: m[2],
      title: hdClean(m[3]),
      origin_name: "",
      poster: hdAbs(m[4]),
      thumb: hdAbs(m[4]),
      year: ym ? parseInt(ym[1], 10) : 0,
      quality: label.indexOf("4K") >= 0 ? "4K" : "HD",
      lang: lang,
      episode_current: ep,
      type: ""
    });
  }
  var totalPages = 1;
  var pm = html.match(/page=(\d+)/g);
  if (pm) {
    for (var i = 0; i < pm.length; i++) {
      var n = parseInt(pm[i].replace("page=", ""), 10);
      if (n > totalPages) totalPages = n;
    }
  }
  return JSON.stringify({ items: items, page: page, totalPages: totalPages });
}

function getCategories() {
  return JSON.stringify([
    { id: "new", name: "Mới cập nhật" },
    { id: "list:bang-xep-hang", name: "Bảng xếp hạng" },
    { id: "list:phim-chieu-rap", name: "Phim chiếu rạp" },
    { id: "list:top-phim-ngay", name: "Top phim ngày" },
    { id: "genre:10", name: "Hành Động" },
    { id: "genre:5", name: "Hài Hước" },
    { id: "genre:2", name: "Tình Cảm" },
    { id: "genre:12", name: "Kinh Dị" },
    { id: "genre:4", name: "Hoạt Hình" },
    { id: "genre:9", name: "Phiêu Lưu" },
    { id: "genre:15", name: "Cổ Trang" },
    { id: "genre:48", name: "Netflix" }
  ]);
}

function getList(categoryId, page) {
  page = page || 1;
  try {
    var url;
    if (categoryId && categoryId.indexOf("list:") === 0) {
      url = HD_BASE + "/danh-sach/" + categoryId.substring(5);
    } else if (categoryId && categoryId.indexOf("genre:") === 0) {
      url = HD_BASE + "/?filter[category]=" + categoryId.substring(6);
    } else {
      url = HD_BASE + "/danh-sach/phim-moi";
    }
    if (page > 1) url += (url.indexOf("?") >= 0 ? "&" : "?") + "page=" + page;
    var html = httpGet(url);
    if (!html) return hdEmpty(page);
    return hdParseList(html, page);
  } catch (e) { log("phimhdcs getList loi: " + e); return hdEmpty(page); }
}

function search(keyword, page) {
  page = page || 1;
  try {
    var url = HD_BASE + "/?search=" + encodeURIComponent(keyword).replace(/%20/g, "+");
    if (page > 1) url += "&page=" + page;
    var html = httpGet(url);
    if (!html) return hdEmpty(page);
    return hdParseList(html, page);
  } catch (e) { log("phimhdcs search loi: " + e); return hdEmpty(page); }
}

// Trich danh sach tap tu trang phim: cac muc "Danh sach Server X:"
// moi muc chua link /tap-{n}-{episodeId}. Khong co muc thi gom tat ca
// link tap vao 1 server. Tra ve [{name, eps:[{name, watch}]}] (chua giai).
function hdEpisodeGroups(html) {
  var groups = [];
  var headRe = /Danh sách Server ([^:<]+):/g;
  var heads = [];
  var m;
  while ((m = headRe.exec(html)) !== null) heads.push({ name: hdClean(m[1]), at: m.index });
  var linkRe = /href="(https:\/\/phimhdcss\.com\/[^"]+\/tap-[^"]+)"[^>]*title="([^"]*)"/g;
  var links = [];
  var lm;
  while ((lm = linkRe.exec(html)) !== null) links.push({ url: lm[1], name: hdClean(lm[2]), at: lm.index });
  // Loai link "Tap tiep"/dieu huong va trung lap
  var clean = [];
  var seen = {};
  for (var i = 0; i < links.length; i++) {
    if (links[i].name.indexOf("Tập tiếp") === 0) continue;
    if (seen[links[i].url]) continue;
    seen[links[i].url] = true;
    clean.push(links[i]);
  }
  if (!heads.length) {
    if (clean.length) groups.push({ name: "Vietsub", eps: clean });
    return groups;
  }
  for (var h = 0; h < heads.length; h++) {
    var from = heads[h].at;
    var to = h + 1 < heads.length ? heads[h + 1].at : html.length;
    var eps = [];
    for (var k = 0; k < clean.length; k++) {
      if (clean[k].at > from && clean[k].at < to) eps.push(clean[k]);
    }
    if (eps.length) groups.push({ name: "Server " + heads[h].name, eps: eps });
  }
  if (!groups.length && clean.length) groups.push({ name: "Vietsub", eps: clean });
  return groups;
}

function hdEpNum(name) {
  var m = /Tập\s+(\d+)/i.exec(name || "");
  return m ? parseInt(m[1], 10) : 9999;
}

// Giai 1 trang xem -> URL HLS truc tiep ("" neu that bai)
function hdResolveWatch(watchUrl) {
  var html = httpGet(watchUrl);
  if (!html) return "";
  html = String(html);
  var salt = "";
  var sm = /(?:const|let|var)\s+_0xS\s*=\s*["']([^"']+)["']/.exec(html);
  if (sm) salt = sm[1];
  var dm = /(?:const|let|var)\s+_0xData\s*=\s*(\{)/.exec(html);
  if (!dm) return "";
  var start = dm.index + dm[0].indexOf("{");
  var depth = 0, end = -1;
  for (var i = start; i < html.length && i < start + 200000; i++) {
    var ch = html.charAt(i);
    if (ch === "{") depth++;
    else if (ch === "}") { depth--; if (depth === 0) { end = i + 1; break; } }
  }
  if (end < 0) return "";
  var data;
  try { data = JSON.parse(html.substring(start, end)); } catch (e) { return ""; }
  // episodeId = so cuoi trong URL trang xem (tap-1-844591 -> 844591)
  var idm = /-(\d{4,})(?:[?#]|$)/.exec(watchUrl) || /(\d{4,})/.exec(watchUrl);
  var target = idm ? idm[1] : null;
  var chunks = null;
  if (target && data[target]) chunks = data[target];
  if (!chunks) {
    for (var k in data) { if (data.hasOwnProperty(k)) { chunks = data[k]; break; } }
  }
  if (!chunks || !chunks.length) return "";
  var joined = chunks.join("");
  var rev = joined.split("").reverse().join("");
  if (salt) rev = rev.split(salt).join("");
  var url = hdB64Decode(rev);
  return url && url.indexOf("http") === 0 ? url : "";
}

function getDetail(id) {
  try {
    var slug = String(id || "").replace(/^https:\/\/phimhdcss\.com\//, "").replace(/\/$/, "");
    var html = httpGet(HD_BASE + "/" + slug);
    if (!html) return JSON.stringify({});
    html = String(html);
    var tm = /<span\s+class="title"\s+itemprop="name">([^<]+)<\/span>/i.exec(html);
    var title = tm ? hdClean(tm[1]) : slug;
    var om = /<span\s+class="real-name">([^<]+)<\/span>/i.exec(html);
    var pm = /<img\s+itemprop="image"\s+src="([^"]+)"/i.exec(html);
    var poster = pm ? hdAbs(pm[1]) : "";
    var dm2 = /<div\s+style="text-align:\s*justify;">([\s\S]*?)<\/div>/i.exec(html);
    var content = dm2 ? hdClean(dm2[1]) : "";
    var ym = /<dt>Năm sản xuất:<\/dt>\s*<dd>([^<]+)<\/dd>/i.exec(html);
    var year = ym ? (parseInt(ym[1], 10) || 0) : 0;
    var groups = hdEpisodeGroups(html);
    if (!groups.length) {
      // Du phong: nut Xem phim (phim le) -> 1 tap Full
      var btn = /<a\s+class="btn-see btn btn-danger btn-stream-link"\s+href="([^"]+)"/i.exec(html);
      if (btn) groups = [{ name: "Vietsub", eps: [{ name: "Full", url: hdAbs(btn[1]) }] }];
    }
    if (!groups.length) return JSON.stringify({});
    var servers = [];
    var resolved = 0;
    for (var g = 0; g < groups.length; g++) {
      var eps = groups[g].eps.slice(0);
      // Trang liet ke moi nhat truoc -> dao lai cho dung thu tu tap
      eps.sort(function (a, b) { return hdEpNum(a.name) - hdEpNum(b.name); });
      var out = [];
      for (var i = 0; i < eps.length; i++) {
        var watch = eps[i].url;
        var direct = "";
        if (resolved < HD_MAX_RESOLVE) {
          direct = hdResolveWatch(watch);
          if (direct) resolved++;
        }
        out.push({
          name: eps[i].name || ("Tập " + (i + 1)),
          url: direct,
          embed: watch,
          referer: HD_BASE + "/"
        });
      }
      if (out.length) servers.push({ name: groups[g].name, episodes: out });
    }
    if (!servers.length) return JSON.stringify({});
    return JSON.stringify({
      id: slug,
      title: title,
      origin_name: om ? hdClean(om[1]) : "",
      poster: poster,
      thumb: poster,
      year: year,
      quality: "HD",
      lang: "Vietsub",
      episode_current: "",
      episode_total: "",
      content: content,
      type: "",
      servers: servers
    });
  } catch (e) { log("phimhdcs getDetail loi: " + e); return JSON.stringify({}); }
}
