// Plugin SayHentai cho app lai HQH — v1.0.0 — TRUYEN TRANH 18+
// !!! DAY LA NGUON TRUYEN TRANH (hentai manga), KHONG PHAI VIDEO !!!
// !!! DATA-PREP ONLY: "tap" o day la TRANG DOC CHUONG (URL trang
// !!! doc tren web), app phim hien CHUA doc/phat duoc dang nay.
// !!! File nam o moviesx/ chi de san du lieu cho registry 18+;
// !!! khi nao app co man doc truyen moi dung den.
// Goc: plugin "SayHentai" v1.0.0 trong he sinh thai VAX Player
// (repo plugin cua Tuangayxx/youngbi), chuyen sang hop dong HQH.
// Site dich: SayHentai — WordPress Madara. Mien sayhentai.vc
// chuyen huong sang https://sayhentai.cx (plugin dung mien dich).
// Co che (chuan Madara):
//   - Danh sach: cao the <div class="page-item-detail"> (h3
//     .font-title = ten + link, img = bia, span.chapter = chuong
//     moi nhat); the loai o /genre/{slug}/, phan trang /page/{n}/.
//   - Tim kiem: /page/{n}/?s={kw}&post_type=wp-manga.
//   - Chi tiet: ten o .post-title h1, bia o .summary_image,
//     mo ta o .description-summary; chuong = cac <li
//     class="wp-manga-chapter"> (dao lai cu -> moi), url tap =
//     URL trang doc chuong.
// TINH TRANG KIEM CHUNG (21/11/2026): sayhentai.cx bi Cloudflare
// chan tu VM nay (403) -> chua kiem du lieu that duoc tu VM,
// danh dau "VM-blocked — CAN KIEM LAI TREN MAY THAT". Cau truc
// Madara la chuan cong khai, parser viet theo dung plugin VAX.
// Host API: httpGet(url) -> string, log(msg). Moi ham tra ve CHUOI JSON (xem CONTRACT.md).
// ES5 (Rhino): var, khong arrow function, khong template literal.
// Bay Rhino: httpGet tra Java String — ep String(html) truoc khi dung regex.

var SH_BASE = "https://sayhentai.cx";

function shEmpty(page) {
  return JSON.stringify({ items: [], page: page || 1, totalPages: 1 });
}

function shClean(s) {
  if (!s) return "";
  return String(s).replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\s+/g, " ").replace(/^\s+|\s+$/g, "");
}

function shPath(url) {
  if (!url) return "";
  var m = /^https?:\/\/[^\/]+\/(.+?)\/?$/.exec(url);
  return m ? m[1] : url;
}

function shParseList(html, page) {
  var items = [];
  if (!html) return JSON.stringify({ items: items, page: page, totalPages: 1 });
  html = String(html);
  var seen = {};
  var parts = html.split('page-item-detail');
  for (var i = 1; i < parts.length; i++) {
    var card = parts[i];
    var lm = /<h3[^>]*class="[^"]*font-title[^"]*"[^>]*>\s*<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/.exec(card)
      || /<a[^>]+href="(https?:\/\/[^"]+)"[^>]*class="[^"]*"/.exec(card);
    if (!lm) continue;
    var url = lm[1];
    var title = lm[2] ? shClean(lm[2]) : "";
    var id = shPath(url);
    if (!id || seen[id]) continue;
    var im = /<img[^>]+(?:data-src|data-lazy-src|src)="([^"]+)"/.exec(card);
    var poster = "";
    if (im && im[1].indexOf("data:image") !== 0) poster = im[1];
    var cm = /<span[^>]*class="chapter[^"]*"[^>]*>\s*<a[^>]*>([\s\S]*?)<\/a>/.exec(card);
    seen[id] = true;
    items.push({
      id: id,
      title: title || id,
      origin_name: "",
      poster: poster,
      thumb: poster,
      year: 0,
      quality: "Truyện",
      lang: "18+",
      episode_current: cm ? shClean(cm[1]) : "",
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
    { id: "latest", name: "Mới cập nhật" },
    { id: "g:ahegao", name: "Ahegao" },
    { id: "g:big-breasts", name: "Big Breasts" },
    { id: "g:incest", name: "Incest" },
    { id: "g:lolicon", name: "Lolicon" },
    { id: "g:milf", name: "Milf" },
    { id: "g:mind-control", name: "Mind Control" },
    { id: "g:netorare", name: "Netorare" },
    { id: "g:rape", name: "Rape" },
    { id: "g:schoolgirl", name: "Schoolgirl" },
    { id: "g:vanilla", name: "Vanilla" },
    { id: "g:yaoi", name: "Yaoi" },
    { id: "g:yuri", name: "Yuri" }
  ]);
}

function getList(categoryId, page) {
  page = page || 1;
  try {
    var url;
    if (categoryId && categoryId.indexOf("g:") === 0) {
      url = SH_BASE + "/genre/" + categoryId.substring(2) + "/" + (page > 1 ? "page/" + page + "/" : "");
    } else {
      url = SH_BASE + "/" + (page > 1 ? "page/" + page + "/" : "");
    }
    var html = httpGet(url);
    if (!html) return shEmpty(page);
    return shParseList(html, page);
  } catch (e) { log("sayhentai getList loi: " + e); return shEmpty(page); }
}

function search(keyword, page) {
  page = page || 1;
  try {
    var url = SH_BASE + "/page/" + page + "/?s=" + encodeURIComponent(keyword) + "&post_type=wp-manga";
    var html = httpGet(url);
    if (!html) return shEmpty(page);
    return shParseList(html, page);
  } catch (e) { log("sayhentai search loi: " + e); return shEmpty(page); }
}

function getDetail(id) {
  try {
    var path = String(id || "").replace(/^https?:\/\/[^\/]+\//, "").replace(/\/$/, "");
    var html = httpGet(SH_BASE + "/" + path + "/");
    if (!html) return JSON.stringify({});
    html = String(html);
    var tm = /<div[^>]*class="[^"]*post-title[^"]*"[^>]*>\s*<h1[^>]*>([\s\S]*?)<\/h1>/.exec(html);
    var title = tm ? shClean(tm[1]) : path;
    var im = /<div[^>]*class="[^"]*summary_image[^"]*"[^>]*>[\s\S]*?<img[^>]+(?:data-src|data-lazy-src|src)="([^"]+)"/.exec(html)
      || /property="og:image"\s+content="([^"]+)"/.exec(html);
    var poster = im ? im[1] : "";
    var dm = /<div[^>]*class="[^"]*description-summary[^"]*"[^>]*>[\s\S]*?<div[^>]*class="[^"]*summary__content[^"]*"[^>]*>([\s\S]*?)<\/div>/.exec(html)
      || /<div[^>]*class="[^"]*manga-summary[^"]*"[^>]*>([\s\S]*?)<\/div>/.exec(html);
    var content = dm ? shClean(dm[1]) : "";
    if (content.length > 800) content = content.substring(0, 800);
    // Chuong: li.wp-manga-chapter > a (trang liet ke moi -> cu)
    var eps = [];
    var seen = {};
    var re = /<li[^>]*class="[^"]*wp-manga-chapter[^"]*"[^>]*>\s*<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
    var m;
    while ((m = re.exec(html)) !== null) {
      if (seen[m[1]]) continue;
      seen[m[1]] = true;
      eps.push({ name: shClean(m[2]) || ("Chuong " + (eps.length + 1)), url: m[1], embed: "" });
    }
    eps.reverse(); // cu -> moi
    if (!eps.length) return JSON.stringify({});
    return JSON.stringify({
      id: path,
      title: title,
      origin_name: "",
      poster: poster,
      thumb: poster,
      year: 0,
      quality: "Truyện",
      lang: "18+",
      episode_current: eps.length + " chương",
      episode_total: String(eps.length),
      content: content,
      type: "manga",
      servers: [{ name: "SayHentai", episodes: eps }]
    });
  } catch (e) { log("sayhentai getDetail loi: " + e); return JSON.stringify({}); }
}
