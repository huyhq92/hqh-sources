// Plugin Anime Vietsub cho app lai HQH — v1.0.0
// Nguon: https://animevsub.co.uk — viet 2026-11-20, chep co che cua plugin
// (ten mien dpluss.nl cua ban SuperOK nay da 301 chuyen sang animevsub.co.uk
//  — dung thang ten mien moi vi httpGet khong tu theo redirect 301.)
// SuperOK (animevietsub v1.0.1) sang hop dong HQH:
//   - Danh sach: cao HTML, lay cac the <a> tro toi /phim/ (title o thuoc
//     tinh title/alt, poster o <img src>, nhan chat luong/ngon ngu/tap
//     o cac badge top-0/bottom-1). Phan trang kieu path: {path}/{page}.
//   - Tim kiem: GET /tim-kiem?q=&page=
//   - Chi tiet: trang phim chua san du lieu tap dang ban ghi JSON long
//     trong HTML: "server","name","slug","type","link". Neu trang chi
//     tiet chua co thi tai tiep trang xem (link /tap- dau tien) de lay.
//   - Loc tap: CHI giu tap co link truc tiep dang m3u8 — type "m3u8",
//     hoac link (sau khi go boc player.phimapi.com/player/?url=) chua
//     .m3u8/.mp4. Tap dang embed (phai mo WebView) thi BO, vi app chi
//     phat bang ExoPlayer.
// Host API: httpGet(url) -> string, log(msg). Moi ham tra ve CHUOI JSON (xem CONTRACT.md).

var AV_BASE = "https://animevsub.co.uk";

function avAbs(u) {
  if (!u) return "";
  u = u.replace(/&amp;/g, "&");
  if (u.indexOf("//") === 0) return "https:" + u;
  if (u.indexOf("http") === 0) return u;
  return AV_BASE + (u.charAt(0) === "/" ? u : "/" + u);
}

function avEmpty(page) {
  return JSON.stringify({ items: [], page: page || 1, totalPages: 1 });
}

function avParseList(html, page) {
  var items = [];
  if (!html) return items;
  var seen = {};
  var linkRegex = /<a\s+[^>]*href="([^"]*\/phim\/[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
  var m;
  while ((m = linkRegex.exec(html)) !== null) {
    var href = m[1];
    if (href.indexOf("/tap-") !== -1) continue;
    if (seen[href]) continue;
    seen[href] = true;
    var fullTag = m[0];
    var inner = m[2];
    var title = "";
    var titleMatch = fullTag.match(/title="([^"]+)"/i) || inner.match(/alt="([^"]+)"/i);
    if (titleMatch) title = titleMatch[1].replace(/^\s+|\s+$/g, "");
    if (!title) continue;
    var src = "";
    var srcMatch = inner.match(/src="([^"]+)"/i);
    if (srcMatch) src = avAbs(srcMatch[1].replace(/^\s+|\s+$/g, ""));
    var quality = "";
    var qMatch = inner.match(/class="[^"]*top-0\s+right-1[^"]*"[^>]*>([^<]+)</i) ||
                 inner.match(/class="[^"]*bg-yellow-500[^"]*"[^>]*>([^<]+)</i);
    if (qMatch) quality = qMatch[1].replace(/^\s+|\s+$/g, "");
    var lang = "";
    var lMatch = inner.match(/class="[^"]*top-0\s+left-1[^"]*"[^>]*>([^<]+)</i);
    if (lMatch) lang = lMatch[1].replace(/^\s+|\s+$/g, "");
    var current = "";
    var cMatch = inner.match(/class="[^"]*bottom-1[^"]*"[^>]*>([^<]+)</i);
    if (cMatch) current = cMatch[1].replace(/^\s+|\s+$/g, "");
    items.push({
      id: avAbs(href),
      title: title,
      origin_name: "",
      poster: src,
      thumb: src,
      year: 0,
      quality: quality || "FHD",
      lang: lang || "Vietsub",
      episode_current: current,
      episode_total: "",
      type: ""
    });
  }
  return items;
}

function avListResult(html, page) {
  var items = avParseList(html, page);
  var totalPages = items.length > 0 ? page + 1 : page;
  return JSON.stringify({ items: items, page: page, totalPages: totalPages });
}

function getCategories() {
  return JSON.stringify([
    { id: "/danh-sach/phim-bo", name: "Anime Bộ" },
    { id: "/danh-sach/phim-le", name: "Anime Lẻ" },
    { id: "/the-loai/hoat-hinh", name: "Phim Hoạt Hình" },
    { id: "/the-loai/hanh-dong", name: "Hành Động" },
    { id: "/the-loai/tinh-cam", name: "Tình Cảm" },
    { id: "/the-loai/hai-huoc", name: "Hài Hước" },
    { id: "/the-loai/co-trang", name: "Cổ Trang" },
    { id: "/the-loai/chien-tranh", name: "Chiến Tranh" },
    { id: "/the-loai/the-thao", name: "Thể Thao" },
    { id: "/the-loai/vo-thuat", name: "Võ Thuật" },
    { id: "/the-loai/vien-tuong", name: "Viễn Tưởng" },
    { id: "/the-loai/phieu-luu", name: "Phiêu Lưu" },
    { id: "/the-loai/khoa-hoc", name: "Khoa Học" },
    { id: "/the-loai/kinh-di", name: "Kinh Dị" },
    { id: "/the-loai/than-thoai", name: "Thần Thoại" },
    { id: "/the-loai/gia-dinh", name: "Gia Đình" },
    { id: "/the-loai/bi-an", name: "Bí Ẩn" },
    { id: "/the-loai/hoc-duong", name: "Học Đường" },
    { id: "/the-loai/harem", name: "Anime Harem" },
    { id: "/the-loai/isekai", name: "Anime Isekai" },
    { id: "/the-loai/shounen", name: "Anime Shounen" },
    { id: "/the-loai/lang-man", name: "Anime Lãng Mạn" },
    { id: "/nam-phat-hanh/2026", name: "Năm 2026" },
    { id: "/nam-phat-hanh/2025", name: "Năm 2025" },
    { id: "/nam-phat-hanh/2024", name: "Năm 2024" },
    { id: "/nam-phat-hanh/2023", name: "Năm 2023" },
    { id: "/nam-phat-hanh/2022", name: "Năm 2022" },
    { id: "/nam-phat-hanh/2021", name: "Năm 2021" },
    { id: "/nam-phat-hanh/2020", name: "Năm 2020" }
  ]);
}

function getList(categoryId, page) {
  page = page || 1;
  try {
    var path = categoryId || "/danh-sach/phim-bo";
    var url = AV_BASE + (path.charAt(0) === "/" ? path : "/" + path);
    if (page > 1) url += "/" + page;
    url = url.replace(/([^:]\/)\/+/g, "$1");
    var html = httpGet(url);
    if (!html) return avEmpty(page);
    return avListResult(html, page);
  } catch (e) { log("animevietsub getList loi: " + e); return avEmpty(page); }
}

function search(keyword, page) {
  page = page || 1;
  try {
    // Ban SuperOK dung /tim-kiem?q= tren dpluss.nl; ten mien moi doi
    // sang /search?q= (khai bao trong structured data cua trang).
    // Khong thay phan trang tim kiem -> chi tra 1 trang.
    var url = AV_BASE + "/search?q=" + encodeURIComponent(keyword || "");
    if (page > 1) url += "&page=" + page;
    var html = httpGet(url);
    if (!html) return avEmpty(page);
    var items = avParseList(html, page);
    return JSON.stringify({ items: items, page: page, totalPages: page });
  } catch (e) { log("animevietsub search loi: " + e); return avEmpty(page); }
}

function avUnwrap(link) {
  var u = link || "";
  if (u.indexOf("player.phimapi.com/player/?url=") !== -1) {
    var raw = u.split("player/?url=")[1];
    if (raw) {
      var decoded = raw;
      try { decoded = decodeURIComponent(raw); } catch (e) {}
      return decoded;
    }
  }
  return u;
}

function avParseEpisodes(html) {
  // Tra ve [{name, episodes:[{name, url, embed}]}] — chi tap link thang.
  var servers = [];
  if (!html) return servers;
  var unescaped = html.replace(/\\"/g, '"').replace(/\\\\/g, "\\");
  var serverOrder = [];
  var serverMap = {};
  var epRegex = /"server"\s*:\s*"([^"]+)"\s*,\s*"name"\s*:\s*"([^"]+)"\s*,\s*"slug"\s*:\s*"([^"]+)"\s*,\s*"type"\s*:\s*"([^"]+)"\s*,\s*"link"\s*:\s*"([^"]+)"/gi;
  var m;
  while ((m = epRegex.exec(unescaped)) !== null) {
    var sName = m[1].replace(/^\s+|\s+$/g, "");
    sName = sName.replace(/#H.*?N.*?i/i, "#Hà Nội").replace(/L.*?ng\s*Ti.*?ng/i, "Lồng Tiếng");
    var epName = m[2].replace(/^\s+|\s+$/g, "");
    var epSlug = m[3].replace(/^\s+|\s+$/g, "");
    var epType = m[4].replace(/^\s+|\s+$/g, "");
    var epLink = m[5].replace(/^\s+|\s+$/g, "").replace(/\\\//g, "/");
    if (!epLink || epLink.indexOf("http") !== 0) continue;
    var direct = avUnwrap(epLink);
    var isDirect = (epType === "m3u8") || direct.indexOf(".m3u8") > -1 || direct.indexOf(".mp4") > -1;
    if (!isDirect) continue; // tap embed -> bo
    if (!serverMap[sName]) { serverMap[sName] = {}; serverOrder.push(sName); }
    var numMatch = (epName || "").match(/Tập\s*(\d+)/i) || (epName || "").match(/(\d+)/);
    var num = numMatch ? parseInt(numMatch[1], 10) : 0;
    var prev = serverMap[sName][epSlug];
    if (!prev || epType === "m3u8") {
      serverMap[sName][epSlug] = { name: epName, url: direct, embed: epLink, num: num };
    }
  }
  for (var i = 0; i < serverOrder.length; i++) {
    var epObj = serverMap[serverOrder[i]];
    var eps = [];
    for (var key in epObj) eps.push(epObj[key]);
    eps.sort(function (a, b) { return a.num - b.num; });
    var outEps = [];
    for (var j = 0; j < eps.length; j++) {
      outEps.push({ name: eps[j].name, url: eps[j].url, embed: eps[j].embed });
    }
    if (outEps.length > 0) servers.push({ name: serverOrder[i], episodes: outEps });
  }
  return servers;
}

function getDetail(id) {
  try {
    if (!id) return JSON.stringify({});
    var url = avAbs(id);
    var html = httpGet(url);
    if (!html) return JSON.stringify({});
    var realId = url;
    var idMatch = /<link\s+rel="canonical"\s+href="([^"]+)"/i.exec(html) ||
                  /<meta\s+property="og:url"\s+content="([^"]+)"/i.exec(html);
    if (idMatch) realId = idMatch[1];
    var title = "";
    var rmatch = html.match(/meta\s+property="og:title"\s+content="([^"]+)"/i);
    if (rmatch && rmatch[1]) title = rmatch[1].replace(/ - AnimeVietSub.*$/i, "").replace(/^Phim /i, "");
    var poster = "";
    rmatch = html.match(/meta\s+property="og:image"\s+content="([^"]+)"/i);
    if (rmatch && rmatch[1]) poster = rmatch[1];
    var content = "";
    rmatch = html.match(/meta\s+property="og:description"\s+content="([^"]+)"/i);
    if (rmatch && rmatch[1]) content = rmatch[1];

    var servers = avParseEpisodes(html);
    if (servers.length === 0) {
      var watchPageUrl = "";
      var tapMatch = html.match(/href="([^"]*\/tap-[^"]*)"/i);
      if (tapMatch) {
        watchPageUrl = avAbs(tapMatch[1]);
      } else if (realId.indexOf("/phim/") !== -1) {
        watchPageUrl = realId.replace(/\/$/, "") + "/tap-01";
      }
      if (watchPageUrl) {
        var watchHtml = httpGet(watchPageUrl);
        if (watchHtml) servers = avParseEpisodes(watchHtml);
      }
    }
    if (!title && servers.length === 0) return JSON.stringify({});
    return JSON.stringify({
      id: realId,
      title: title || "",
      origin_name: "",
      poster: poster,
      thumb: poster,
      year: 0,
      quality: "FHD",
      lang: "Vietsub",
      episode_current: "",
      episode_total: "",
      content: content,
      type: "",
      servers: servers
    });
  } catch (e) { log("animevietsub getDetail loi: " + e); return JSON.stringify({}); }
}
