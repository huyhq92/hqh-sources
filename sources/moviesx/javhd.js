// Plugin JavHD cho app lai HQH — v1.0.0 — NGUON 18+
// Goc: plugin "JavHD" v1.0.1 trong he sinh thai VAX Player
// (repo plugin cua Tuangayxx/youngbi), chuyen sang hop dong HQH.
// Site dich: https://javhdz.today — tube JAV chay KVS, giao dien
// defboot (trang song, kiem 21/11/2026).
// Co che:
//   - Danh sach: GET /{muc}/?ajax=browse_videos&page={n} -> JSON
//     {status, html} — cao the <li id="video-..."> trong html tra ve.
//   - Chi tiet: trang video chua iframe /embed/{id}; trang embed
//     chua cac nut server mang data-name + data-embed / data-embeds
//     (BASE64 cua URL nhung file-host, dang don le hoac mang JSON).
//   - Giai link trong getDetail: tai trang nhung cua file-host,
//     giai nen script dong goi Dean Edwards (eval(function(p,a,c,
//     k,e,d))) roi doc links.hls3 / links.hls2 / file: -> HLS truc
//     tiep. Da kiem chung that 21/11/2026 voi host mycloudz.cc:
//     giai ra master.txt (hls3) va master.m3u8 co chu ky (hls2).
//   - Tap mang referer = URL trang nhung (CDN ky link theo ngu canh
//     trang nhung; chu ky ngan han nen giai tuoi moi lan mo).
// Tim kiem: trang /search/video/ cua site khong tra card ket qua
// o phia server qua GET thuong (da thu nhieu bien the 21/11/2026 —
// ca ban VAX goc cung chi tro URL nay cho WebView); search() giu
// dung URL cua VAX va cao card neu co, nhung tu VM tra 0 ket qua.
// Danh sach + chi tiet + giai link la cac duong da kiem that.
// Luu y kiem chung: CDN dich (link da ky) TU CHOI IP VM nay
// (hls3: khong ket noi duoc; hls2: 403 ngay ca voi Referer dung)
// -> chuoi giai dung den buoc boc URL truc tiep, phan phat danh
// dau "can kiem lai tren may that". Mot so host nhung khac
// (dooood/playmogo) khong toi duoc tu VM; tren may that plugin
// van thu giai binh thuong, host nao khong giai duoc thi bo.
// Host API: httpGet(url) -> string, log(msg). Moi ham tra ve CHUOI JSON (xem CONTRACT.md).
// ES5 (Rhino): var, khong arrow function, khong template literal.
// Bay Rhino: httpGet tra Java String — ep String(html) truoc khi dung regex.

var JH_BASE = "https://javhdz.today";

function jhEmpty(page) {
  return JSON.stringify({ items: [], page: page || 1, totalPages: 1 });
}

function jhClean(s) {
  if (!s) return "";
  return String(s).replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\s+/g, " ").replace(/^\s+|\s+$/g, "");
}

function jhB64Decode(str) {
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

// Giai nen 1 khoi Dean Edwards packed script -> chuoi da giai ("" neu khong co)
function jhUnpack(html) {
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
    var token = i.toString(radix);
    payload = payload.replace(new RegExp("\\b" + token + "\\b", "g"), w);
  }
  return payload;
}

// Tim URL HLS truc tiep trong van ban (da giai nen hoac tho)
function jhFindHls(text) {
  if (!text) return "";
  var pats = [
    /links\.hls3\s*=\s*["']([^"']+)["']/,
    /["']hls3["']\s*:\s*["']([^"']+)["']/,
    /links\.hls2\s*=\s*["']([^"']+)["']/,
    /["']hls2["']\s*:\s*["']([^"']+)["']/,
    /file\s*:\s*["'](https?:[^"']+\.m3u8[^"']*)["']/,
    /["']file["']\s*:\s*["'](https?:[^"']+\.m3u8[^"']*)["']/,
    /(https?:[^\s"'<>\\]+\.m3u8[^\s"'<>\\]*)/
  ];
  for (var i = 0; i < pats.length; i++) {
    var m = pats[i].exec(text);
    if (m) return m[1].replace(/\\\//g, "/");
  }
  return "";
}

// Giai 1 URL nhung file-host -> URL HLS truc tiep ("" neu that bai)
function jhResolveEmbed(embedUrl) {
  var html = httpGet(embedUrl);
  if (!html) return "";
  html = String(html);
  var direct = jhFindHls(html);
  if (direct) return direct;
  var unpacked = jhUnpack(html);
  if (unpacked) {
    direct = jhFindHls(unpacked);
    if (direct) return direct;
  }
  return "";
}

function jhParseCards(html) {
  var items = [];
  var seen = {};
  var parts = String(html).split('<li id="video-');
  for (var i = 1; i < parts.length; i++) {
    var card = parts[i];
    var am = /<a[^>]+class="thumbnail[^"]*"[^>]+href="([^"]+)"[^>]*title="([^"]*)"/.exec(card)
      || /<a[^>]+href="([^"]+)"[^>]+class="thumbnail[^"]*"[^>]*title="([^"]*)"/.exec(card)
      || /<a[^>]+href="(\/\d+\/[^"]+\/)"[^>]*title="([^"]*)"/.exec(card);
    if (!am) continue;
    var href = am[1];
    var idm = /javhdz\.today\/(\d+)\/([^\/]+)\//.exec(href) || /^\/(\d+)\/([^\/]+)\//.exec(href);
    if (!idm) continue;
    var vid = idm[1] + "/" + idm[2];
    if (seen[vid]) continue;
    var im = /<img[^>]+(?:data-src|src)="([^"]+)"/.exec(card);
    var thumb = im ? im[1] : "";
    if (thumb.indexOf("data:image") === 0) thumb = "";
    var dur = /video-overlay1?[^>]*>([^<]+)</.exec(card);
    seen[vid] = true;
    items.push({
      id: vid,
      title: jhClean(am[2]) || idm[2],
      origin_name: "",
      poster: thumb,
      thumb: thumb,
      year: 0,
      quality: "HD",
      lang: "JAV",
      episode_current: dur ? jhClean(dur[1]) : "",
      type: "single"
    });
  }
  return items;
}

function jhFetchListHtml(url) {
  var raw = httpGet(url);
  if (!raw) return "";
  raw = String(raw);
  if (raw.charAt(0) === "{") {
    try {
      var j = JSON.parse(raw);
      if (j && j.html) return String(j.html);
    } catch (e) { /* khong phai JSON -> dung tho */ }
  }
  return raw;
}

function getCategories() {
  return JSON.stringify([
    { id: "recent", name: "Mới nhất" },
    { id: "jav-sub", name: "JAV Vietsub" },
    { id: "uncensored-jav", name: "Không che" },
    { id: "beautiful-girl", name: "Gái xinh" },
    { id: "big-tits", name: "Ngực lớn" },
    { id: "cosplay", name: "Cosplay" },
    { id: "creampie", name: "Creampie" },
    { id: "schoolgirl", name: "Nữ sinh" },
    { id: "teacher", name: "Giáo viên" },
    { id: "wife", name: "Vợ người ta" },
    { id: "milf", name: "MILF" },
    { id: "mature", name: "Trưởng thành" },
    { id: "lesbian", name: "Lesbian" },
    { id: "massage", name: "Massage" },
    { id: "pov", name: "POV" },
    { id: "teen", name: "Teen" }
  ]);
}

function getList(categoryId, page) {
  page = page || 1;
  try {
    var url = JH_BASE + "/" + (categoryId || "recent") + "/?ajax=browse_videos&page=" + page;
    var html = jhFetchListHtml(url);
    if (!html) return jhEmpty(page);
    var items = jhParseCards(html);
    return JSON.stringify({ items: items, page: page, totalPages: items.length ? page + 1 : page });
  } catch (e) { log("javhd getList loi: " + e); return jhEmpty(page); }
}

function search(keyword, page) {
  page = page || 1;
  try {
    var url = JH_BASE + "/search/video/?s=" + encodeURIComponent(keyword) + "&ajax=browse_videos&page=" + page;
    var html = jhFetchListHtml(url);
    if (!html) return jhEmpty(page);
    var items = jhParseCards(html);
    return JSON.stringify({ items: items, page: page, totalPages: items.length ? page + 1 : page });
  } catch (e) { log("javhd search loi: " + e); return jhEmpty(page); }
}

function getDetail(id) {
  try {
    var pageUrl = JH_BASE + "/" + id + "/";
    var html = httpGet(pageUrl);
    if (!html) return JSON.stringify({});
    html = String(html);
    var tm = /<title>([^<]+)<\/title>/i.exec(html);
    var title = tm ? jhClean(tm[1]).replace(/\s*-\s*JavHD.*$/i, "") : id;
    var om = /property="og:image"\s+content="([^"]+)"/.exec(html);
    var poster = om ? om[1] : "";
    var em = /<iframe[^>]+src="([^"]*\/embed\/[^"]+)"/i.exec(html);
    var embedPage = em ? em[1] : "";
    if (!embedPage) return JSON.stringify({});
    if (embedPage.indexOf("http") !== 0) embedPage = "https:" + embedPage;
    var ehtml = httpGet(embedPage);
    if (!ehtml) return JSON.stringify({});
    ehtml = String(ehtml);
    // Cac nut server: trong 1 the HTML co data-name + data-embed
    // (1 URL) / data-embeds (mang JSON) — thu tu thuoc tinh thay doi
    // theo server nen quet tung the chua data-embed(s) roi doc ca hai.
    var servers = [];
    var optRe = /<[a-z]+[^>]*data-embeds?="[^"]+"[^>]*>/g;
    var m;
    var seenEmbed = {};
    var options = [];
    while ((m = optRe.exec(ehtml)) !== null) {
      var tag = m[0];
      var nm = /data-name="([^"]+)"/.exec(tag);
      var dm2 = /data-embeds?="([^"]+)"/.exec(tag);
      if (!dm2) continue;
      var name = nm ? jhClean(nm[1]) : "Server";
      var decoded = jhB64Decode(dm2[1]);
      var urls = [];
      if (decoded.charAt(0) === "[") {
        try {
          var arr = JSON.parse(decoded);
          for (var a = 0; a < arr.length; a++) if (arr[a]) urls.push(String(arr[a]));
        } catch (e2) { /* bo qua */ }
      } else if (decoded.indexOf("http") === 0) {
        urls.push(decoded);
      }
      if (urls.length) options.push({ name: name, urls: urls });
    }
    // Uu tien giai host file-host ben ngoai truoc: cac server tren
    // stream*.javhdz.today dung token phien (het han rat nhanh, thuong
    // khong giai duoc qua GET thuong) va lam cham ca chuoi.
    options.sort(function (a, b) {
      var ao = a.urls[0].indexOf("javhdz.today") >= 0 ? 1 : 0;
      var bo = b.urls[0].indexOf("javhdz.today") >= 0 ? 1 : 0;
      return ao - bo;
    });
    for (var o = 0; o < options.length; o++) {
      var opt = options[o];
      for (var u = 0; u < opt.urls.length; u++) {
        if (seenEmbed[opt.urls[u]]) continue;
        seenEmbed[opt.urls[u]] = true;
        var direct = jhResolveEmbed(opt.urls[u]);
        if (direct) {
          servers.push({
            name: opt.name,
            episodes: [{ name: "Full", url: direct, embed: opt.urls[u], referer: opt.urls[u] }]
          });
          break; // 1 link giai duoc cho moi server la du
        }
      }
    }
    // Du phong: giai thang script dong goi ngay trong trang embed
    if (!servers.length) {
      var d2 = jhFindHls(ehtml) || jhFindHls(jhUnpack(ehtml));
      if (d2) {
        servers.push({
          name: "Mặc định",
          episodes: [{ name: "Full", url: d2, embed: embedPage, referer: embedPage }]
        });
      }
    }
    if (!servers.length) return JSON.stringify({});
    return JSON.stringify({
      id: id,
      title: title,
      origin_name: "",
      poster: poster,
      thumb: poster,
      year: 0,
      quality: "HD",
      lang: "JAV",
      episode_current: "Full",
      episode_total: "1",
      content: "",
      type: "single",
      servers: servers
    });
  } catch (e) { log("javhd getDetail loi: " + e); return JSON.stringify({}); }
}
