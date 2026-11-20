// Plugin Anime Hay cho app lai HQH — v1.0.0
// Nguon: https://animehay21.site — viet 2026-11-20, chep co che cua
// plugin SuperOK (animehay v1.0.4) sang hop dong HQH:
//   - Danh sach: cao HTML, lay cac the <a> tro toi /thong-tin-phim/.
//     Phan trang: duong dan ...-N.html doi thanh .../trang-{page}.html.
//   - Tim kiem: GET /tim-kiem/?keyword= (trang > 1: /tim-kiem/trang-N.html?keyword=)
//   - Chi tiet: trang thong tin (/thong-tin-phim/) -> doi sang trang xem
//     (/xem-phim/) de lay danh sach tap (the <a class="wp-ep">).
//   - Giai link (trong getDetail): tai trang xem cua tung tap, tim URL
//     /embed-jw/ trong trang, tai trang embed do va boc bien
//     var M3U8_URL -> link m3u8 thang. Khong thay embed-jw thi tim
//     M3U8_URL / .m3u8 tran ngay trong trang xem.
//   - LUU Y REFERER: CDN cua nguon nay bat gui Referer la host embed
//     (https://main.vipah06.xyz/ — dung gia tri plugin SuperOK dung).
//     Moi tap mang them truong "referer" de app gui kem khi phat;
//     khong co referer nay link se bi CDN tu choi.
// Host API: httpGet(url) -> string, log(msg). Moi ham tra ve CHUOI JSON (xem CONTRACT.md).

var AH_BASE = "https://animehay21.site";
var AH_REFERER = "https://main.vipah06.xyz/";

function ahAbs(u) {
  if (!u) return "";
  u = u.replace(/&amp;/g, "&");
  if (u.indexOf("//") === 0) return "https:" + u;
  if (u.indexOf("http") === 0) return u;
  return AH_BASE + (u.charAt(0) === "/" ? u : "/" + u);
}

function ahEmpty(page) {
  return JSON.stringify({ items: [], page: page || 1, totalPages: 1 });
}

function ahParseList(html, page) {
  var items = [];
  if (!html) return items;
  var seen = {};
  var linkRegex = /<a\s+[^>]*href="([^"]*\/thong-tin-phim\/[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
  var m;
  while ((m = linkRegex.exec(html)) !== null) {
    var href = m[1];
    if (seen[href]) continue;
    seen[href] = true;
    var fullTag = m[0];
    var inner = m[2];
    var title = "";
    var titleMatch = fullTag.match(/title="([^"]+)"/i) || inner.match(/alt="([^"]+)"/i);
    if (titleMatch) title = titleMatch[1].replace(/^\s+|\s+$/g, "");
    if (!title) continue;
    var src = "";
    var srcMatch = inner.match(/data-src="([^"]+)"/i) || inner.match(/src="([^"]+)"/i);
    if (srcMatch) src = ahAbs(srcMatch[1].replace(/^\s+|\s+$/g, ""));
    var episode = "";
    var epMatch = inner.match(/class="[^"]*ep-badge[^"]*"[^>]*>([^<]+)</i) ||
                  inner.match(/class="[^"]*episode[^"]*"[^>]*>([^<]+)</i);
    if (epMatch) episode = epMatch[1].replace(/^\s+|\s+$/g, "");
    var quality = "";
    var qMatch = inner.match(/class="[^"]*score[^"]*"[^>]*>([^<]+)</i) ||
                 inner.match(/class="[^"]*quality[^"]*"[^>]*>([^<]+)</i);
    if (qMatch) quality = qMatch[1].replace(/^\s+|\s+$/g, "");
    items.push({
      id: ahAbs(href),
      title: title,
      origin_name: "",
      poster: src,
      thumb: src,
      year: 0,
      quality: quality || "FHD",
      lang: "Vietsub",
      episode_current: episode,
      episode_total: "",
      type: ""
    });
  }
  return items;
}

function ahListResult(html, page) {
  var items = ahParseList(html, page);
  var totalPages = items.length > 0 ? page + 1 : page;
  return JSON.stringify({ items: items, page: page, totalPages: totalPages });
}

function getCategories() {
  return JSON.stringify([
    { id: "/phim-moi-cap-nhap/tat-ca-1.html", name: "Phim Mới" },
    { id: "/the-loai/anime-1.html", name: "Anime" },
    { id: "/the-loai/hanh-dong-2.html", name: "Hành động" },
    { id: "/the-loai/hai-huoc-3.html", name: "Hài hước" },
    { id: "/the-loai/tinh-cam-4.html", name: "Tình cảm" },
    { id: "/the-loai/harem-5.html", name: "Harem" },
    { id: "/the-loai/bi-an-6.html", name: "Bí ẩn" },
    { id: "/the-loai/bi-kich-7.html", name: "Bi kịch" },
    { id: "/the-loai/gia-tuong-8.html", name: "Giả tưởng" },
    { id: "/the-loai/hoc-duong-9.html", name: "Học đường" },
    { id: "/the-loai/doi-thuong-10.html", name: "Đời thường" },
    { id: "/the-loai/vo-thuat-11.html", name: "Võ thuật" },
    { id: "/the-loai/tro-choi-12.html", name: "Trò chơi" },
    { id: "/the-loai/tham-tu-13.html", name: "Thám tử" },
    { id: "/the-loai/lich-su-14.html", name: "Lịch sử" },
    { id: "/the-loai/sieu-nang-luc-15.html", name: "Siêu năng lực" },
    { id: "/the-loai/shounen-16.html", name: "Shounen" },
    { id: "/the-loai/the-thao-20.html", name: "Thể thao" },
    { id: "/the-loai/am-nhac-21.html", name: "Âm nhạc" },
    { id: "/the-loai/mecha-23.html", name: "Mecha" },
    { id: "/the-loai/drama-25.html", name: "Drama" },
    { id: "/the-loai/seinen-26.html", name: "Seinen" },
    { id: "/the-loai/sieu-nhien-27.html", name: "Siêu nhiên" },
    { id: "/the-loai/phieu-luu-28.html", name: "Phiêu lưu" },
    { id: "/the-loai/kinh-di-29.html", name: "Kinh dị" }
  ]);
}

function ahListUrl(path, page) {
  var resultUrl = AH_BASE + (path.charAt(0) === "/" ? path : "/" + path);
  if (page > 1) {
    if (resultUrl.indexOf(".html") !== -1) {
      resultUrl = resultUrl.replace(/\.html$/i, "") + "/trang-" + page + ".html";
    } else {
      resultUrl += (resultUrl.charAt(resultUrl.length - 1) === "/" ? "" : "/") + "trang-" + page + ".html";
    }
  }
  return resultUrl.replace(/([^:]\/)\/+/g, "$1");
}

function getList(categoryId, page) {
  page = page || 1;
  try {
    var url = ahListUrl(categoryId || "/phim-moi-cap-nhap/tat-ca-1.html", page);
    var html = httpGet(url);
    if (!html) return ahEmpty(page);
    return ahListResult(html, page);
  } catch (e) { log("animehay getList loi: " + e); return ahEmpty(page); }
}

function search(keyword, page) {
  page = page || 1;
  try {
    var url;
    if (page > 1) url = AH_BASE + "/tim-kiem/trang-" + page + ".html?keyword=" + encodeURIComponent(keyword || "");
    else url = AH_BASE + "/tim-kiem/?keyword=" + encodeURIComponent(keyword || "");
    var html = httpGet(url);
    if (!html) return ahEmpty(page);
    return ahListResult(html, page);
  } catch (e) { log("animehay search loi: " + e); return ahEmpty(page); }
}

function ahParseEpisodes(html) {
  var episodes = [];
  if (!html) return episodes;
  var seen = {};
  var epRegex = /<a\s+[^>]*href="([^"]*\/xem-phim\/[^"]*)"[^>]*class="[^"]*wp-ep[^"]*"[^>]*(?:title="([^"]*)")?[^>]*>([\s\S]*?)<\/a>/gi;
  var m;
  while ((m = epRegex.exec(html)) !== null) {
    var href = m[1];
    if (seen[href]) continue;
    seen[href] = true;
    var titleAttr = m[2] || "";
    var innerText = m[3].replace(/<[^>]*>/g, "").replace(/^\s+|\s+$/g, "");
    var rawName = titleAttr || innerText;
    var numMatch = rawName.match(/\d+/);
    var num = numMatch ? parseInt(numMatch[0], 10) : 0;
    var displayName = rawName.indexOf("Tập") === -1 ? ("Tập " + rawName) : rawName;
    episodes.push({ name: displayName, watch: ahAbs(href), num: num });
  }
  episodes.sort(function (a, b) { return a.num - b.num; });
  return episodes;
}

function ahResolve(watchUrl) {
  var pageHtml = httpGet(watchUrl);
  if (!pageHtml) return null;
  var embedMatch = pageHtml.match(/https?:\/\/[^"'\s]+\/embed-jw\/\d+/i) ||
                   pageHtml.match(/['"]AHS['"]\s*:\s*['"]([^'"]+)['"]/i);
  var embedUrl = "";
  if (embedMatch) embedUrl = embedMatch[1] || embedMatch[0];
  var streamUrl = "";
  if (embedUrl) {
    var embedHtml = httpGet(embedUrl);
    if (embedHtml) {
      var m3u8Match = embedHtml.match(/var\s+M3U8_URL\s*=\s*['"]([^'"]+)['"]/i) ||
                      embedHtml.match(/(https?:\/\/[^"'\s]+\.m3u8[^"'\s]*)/i);
      if (m3u8Match) streamUrl = m3u8Match[1];
    }
  }
  if (!streamUrl) {
    var directM3u8 = pageHtml.match(/var\s+M3U8_URL\s*=\s*['"]([^'"]+)['"]/i) ||
                     pageHtml.match(/(https?:\/\/[^"'\s]+\.m3u8[^"'\s]*)/i);
    if (directM3u8) streamUrl = directM3u8[1] || directM3u8[0];
  }
  if (!streamUrl || streamUrl.indexOf(".m3u8") === -1) return null;
  return { url: streamUrl, embed: embedUrl || watchUrl };
}

function getDetail(id) {
  try {
    if (!id) return JSON.stringify({});
    var url = ahAbs(id);
    var html = httpGet(url);
    if (!html) return JSON.stringify({});
    var realId = url;
    var idMatch = /<link\s+rel="canonical"\s+href="([^"]+)"/i.exec(html) ||
                  /<meta\s+property="og:url"\s+content="([^"]+)"/i.exec(html);
    if (idMatch) realId = idMatch[1];
    var title = "";
    var rmatch = html.match(/meta\s+property="og:title"\s+content="([^"]+)"/i);
    if (rmatch && rmatch[1]) title = rmatch[1].replace(/ - AnimeHay.*$/i, "").replace(/ - Anime Hay.*$/i, "").replace(/^Phim /i, "");
    var poster = "";
    rmatch = html.match(/meta\s+property="og:image"\s+content="([^"]+)"/i);
    if (rmatch && rmatch[1]) poster = ahAbs(rmatch[1]);
    var content = "";
    rmatch = html.match(/meta\s+property="og:description"\s+content="([^"]+)"/i);
    if (rmatch && rmatch[1]) content = rmatch[1];

    var watchPageUrl = realId.replace("/thong-tin-phim/", "/xem-phim/");
    var rawEps = [];
    var watchHtml = httpGet(watchPageUrl);
    if (watchHtml) {
      rawEps = ahParseEpisodes(watchHtml);
      if (!title) {
        var wTitle = watchHtml.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
        if (wTitle) title = wTitle[1].replace(/<[^>]*>/g, "").replace(/ - AnimeHay.*$/i, "").replace(/^\s+|\s+$/g, "");
      }
    }
    if (rawEps.length === 0) rawEps = ahParseEpisodes(html);
    if (!title && rawEps.length === 0) return JSON.stringify({});

    var eps = [];
    for (var i = 0; i < rawEps.length; i++) {
      var resolved = ahResolve(rawEps[i].watch);
      if (!resolved || !resolved.url) continue;
      eps.push({ name: rawEps[i].name, url: resolved.url, embed: resolved.embed, referer: AH_REFERER });
    }
    var servers = [];
    if (eps.length > 0) servers.push({ name: "AnimeHay", episodes: eps });
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
  } catch (e) { log("animehay getDetail loi: " + e); return JSON.stringify({}); }
}
