// Plugin TV Hay cho app lai HQH — v1.0.0
// Nguon: https://tvhay.buzz — viet 2026-11-20, chep co che cua plugin
// SuperOK (tvhay v1.0.2) sang hop dong HQH (cung ho site voi Phim TM):
//   - Danh sach / tim kiem: cao HTML trang danh sach (khoi .movie-item).
//     List:  GET {path}?page=N
//     Search: GET /?view=tim-kiem&keyword=&page=
//   - Chi tiet: trang phim co nut Xem Phim (btn-watch) tro toi trang xem
//     /xem/{slug}/tap-NN. Danh sach tap lay theo href tap THAT cung slug
//     thay trong trang (plugin goc da kiem chung: server tvhay khong
//     resolve /tap-2 khong dem 0, va tap "ma" theo status se phat nham
//     noi dung tap 1 — nen chi dung href that, khong noi theo status).
//   - Giai link (trong getDetail): tai trang xem cua tung tap, lay
//     iframe #movie-iframe / bien linkHPro:
//       + tham so url= cua iframe -> link thang;
//       + streamvsmov.com/video/<id> -> doi thanh /stream/<id>/master.m3u8
//         (ban SuperOK thieu buoc nay, tra ve embed — ban nay bo sung);
//       + iframe tro thang .m3u8/.mp4 -> link thang;
//       + khong co iframe thi tim .m3u8 tran trong trang;
//       + host nhung khac -> bo tap do (app khong co WebView).
// Host API: httpGet(url) -> string, log(msg). Moi ham tra ve CHUOI JSON (xem CONTRACT.md).

var TV_BASE = "https://tvhay.buzz";

function tvAbs(u) {
  if (!u) return "";
  u = u.replace(/&amp;/g, "&");
  if (u.indexOf("//") === 0) return "https:" + u;
  if (u.indexOf("http") === 0) return u;
  return TV_BASE + (u.charAt(0) === "/" ? u : "/" + u);
}

function tvStrip(s) {
  if (!s) return "";
  return s.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").replace(/^\s+|\s+$/g, "");
}

function tvCleanStream(url) {
  if (!url) return "";
  if (url.indexOf("streamvsmov.com/video/") > -1) {
    var clean = url.split("?")[0].split("#")[0];
    if (clean.charAt(clean.length - 1) === "/") clean = clean.substring(0, clean.length - 1);
    var parts = clean.split("/video/");
    if (parts.length === 2) return parts[0] + "/stream/" + parts[1] + "/master.m3u8";
  }
  return url;
}

function tvEmpty(page) {
  return JSON.stringify({ items: [], page: page || 1, totalPages: 1 });
}

function tvParseList(html, page) {
  var items = [];
  if (!html) return items;
  var itemRegex = /<div[^>]+class=["'][^"']*movie-item[^"']*["'][^>]*>([\s\S]*?)(?=<div[^>]+class=["'][^"']*movie-item[^"']*["']|$)/gi;
  var itemMatch;
  while ((itemMatch = itemRegex.exec(html)) !== null) {
    var block = itemMatch[1];
    var linkMatch = block.match(/<a[^>]+href=["']([^"']+)["'][^>]*title=["']([^"']+)["']/i) ||
                    block.match(/title=["']([^"']+)["'][^>]*<a[^>]+href=["']([^"']+)["']/i);
    if (!linkMatch) continue;
    var itemUrl = linkMatch[1];
    var itemTitle = linkMatch[2];
    if (itemUrl.indexOf("/") !== 0 && itemUrl.indexOf("http") !== 0) {
      itemUrl = linkMatch[2];
      itemTitle = linkMatch[1];
    }
    if (!itemTitle) continue;
    itemUrl = tvAbs(itemUrl);
    var thumbMatch = block.match(/<img[^>]*?\bsrc=["']([^"']+)["']/i) ||
                     block.match(/data-src=["']([^"']+)["']/i);
    var thumb = thumbMatch ? tvAbs(thumbMatch[1]) : "";
    var quality = "";
    var qualityMatch = block.match(/class=["'][^"']*movie-label[^"']*["'][^>]*>([^<]+)/i);
    if (qualityMatch) quality = tvStrip(qualityMatch[1]);
    var epStatus = "";
    var durationMatch = block.match(/class=["'][^"']*movie-ep-status[^"']*["'][^>]*>([^<]+)/i);
    if (durationMatch) epStatus = tvStrip(durationMatch[1]);
    items.push({
      id: itemUrl,
      title: tvStrip(itemTitle),
      origin_name: "",
      poster: thumb,
      thumb: thumb,
      year: 0,
      quality: quality,
      lang: "",
      episode_current: epStatus,
      episode_total: "",
      type: ""
    });
  }
  return items;
}

function tvListResult(html, page) {
  var items = tvParseList(html, page);
  // Site khong cho tong so trang tin cay duoc: con phim o trang nay thi
  // bao con trang sau (giong co che hasNext cua ban SuperOK).
  var totalPages = items.length > 0 ? page + 1 : page;
  return JSON.stringify({ items: items, page: page, totalPages: totalPages });
}

function getCategories() {
  return JSON.stringify([
    { id: "/", name: "Mới Cập Nhật" },
    { id: "/phim-bo", name: "Phim Bộ" },
    { id: "/phim-le", name: "Phim Lẻ" },
    { id: "/short-drama", name: "Short Drama" },
    { id: "/the-loai/hanh-dong", name: "Hành Động" },
    { id: "/the-loai/vo-thuat", name: "Võ Thuật" },
    { id: "/the-loai/tinh-cam", name: "Tình Cảm" },
    { id: "/the-loai/tam-ly", name: "Tâm Lý" },
    { id: "/the-loai/hai-huoc", name: "Hài Hước" },
    { id: "/the-loai/kinh-di", name: "Kinh Dị" },
    { id: "/the-loai/vien-tuong", name: "Viễn Tưởng" },
    { id: "/the-loai/hinh-su", name: "Hình Sự" },
    { id: "/the-loai/co-trang", name: "Cổ Trang" },
    { id: "/the-loai/the-thao", name: "Thể Thao" },
    { id: "/the-loai/am-nhac", name: "Âm Nhạc" },
    { id: "/the-loai/tai-lieu", name: "Tài Liệu" },
    { id: "/the-loai/gia-dinh", name: "Gia Đình" },
    { id: "/the-loai/chinh-kich", name: "Chính Kịch" },
    { id: "/the-loai/bi-an", name: "Bí Ẩn" },
    { id: "/the-loai/chien-tranh", name: "Chiến Tranh" },
    { id: "/the-loai/than-thoai", name: "Thần Thoại" },
    { id: "/quoc-gia/trung-quoc", name: "Trung Quốc" },
    { id: "/quoc-gia/han-quoc", name: "Hàn Quốc" },
    { id: "/quoc-gia/thai-lan", name: "Thái Lan" },
    { id: "/quoc-gia/nhat-ban", name: "Nhật Bản" },
    { id: "/quoc-gia/my", name: "Mỹ" },
    { id: "/quoc-gia/viet-nam", name: "Việt Nam" }
  ]);
}

function getList(categoryId, page) {
  page = page || 1;
  try {
    var path = categoryId || "/";
    var url = TV_BASE + (path.charAt(0) === "/" ? path : "/" + path);
    if (page > 1) url += "?page=" + page;
    var html = httpGet(url);
    if (!html) return tvEmpty(page);
    return tvListResult(html, page);
  } catch (e) { log("tvhay getList loi: " + e); return tvEmpty(page); }
}

function search(keyword, page) {
  page = page || 1;
  try {
    var url = TV_BASE + "/?view=tim-kiem&keyword=" + encodeURIComponent(keyword || "") + "&page=" + page;
    var html = httpGet(url);
    if (!html) return tvEmpty(page);
    return tvListResult(html, page);
  } catch (e) { log("tvhay search loi: " + e); return tvEmpty(page); }
}

function tvExtractMeta(html, label) {
  var regex = new RegExp("<li>\\s*" + label + "\\s*:.*?<span[^>]*>([^<]+)<\\/span>", "i");
  var m = html.match(regex);
  if (!m) {
    var regex2 = new RegExp(label + ".*?<span[^>]*>([^<]+)<\\/span>", "i");
    m = html.match(regex2);
  }
  return m ? m[1].replace(/^\s+|\s+$/g, "") : "";
}

function tvParseDetail(html) {
  var out = {
    title: "", origin_name: "", poster: "", content: "", year: 0,
    episode_current: "", episodes: []
  };
  if (!html) return out;
  var tMatch = html.match(/class=["'][^"']*movie-name-vi[^"']*["'][^>]*>([^<]+)/i);
  if (tMatch) out.title = tvStrip(tMatch[1]);
  var oMatch = html.match(/class=["'][^"']*movie-name-en[^"']*["'][^>]*>([^<]+)/i);
  if (oMatch) out.origin_name = tvStrip(oMatch[1]);
  var pMatch = html.match(/property=["']og:image["']\s+content=["']([^"']+)["']/i);
  if (pMatch) out.poster = tvAbs(pMatch[1]);
  var dMatch = html.match(/class=["'][^"']*movie-description[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);
  if (dMatch) out.content = tvStrip(dMatch[1]);
  out.year = parseInt(tvExtractMeta(html, "Năm Sản Xuất"), 10) || 0;
  var status = tvExtractMeta(html, "Tình Trạng");
  out.episode_current = status;

  var watchMatch = html.match(/class=["'][^"']*btn-watch[^"']*["'][^>]*href=["']([^"']+)["']/i) ||
                   html.match(/href=["']([^"']+)["'][^>]*class=["'][^"']*btn-watch[^"']*["']/i);
  var watchHref = watchMatch ? watchMatch[1] : "";
  var episodes = [];
  if (watchHref && watchHref.indexOf("tap-full") === -1 && watchHref.indexOf("tap-Full") === -1 && /\/tap-\d+/i.test(watchHref)) {
    var seriesSlug = "";
    var swm = watchHref.match(/\/xem\/([^\/]+)\/tap-/i);
    if (swm) seriesSlug = swm[1];
    var seenEp = {};
    var padWidth = 0;
    var maxEp = 1;
    var baseUrlPart = "";
    var epHrefRegex = /href=["']([^"']*\/xem\/([^"'\/]+)\/tap-(\d+)[^"']*)["']/gi;
    var hm;
    while ((hm = epHrefRegex.exec(html)) !== null) {
      var hrefSlug = hm[2];
      var numStr = hm[3];
      if (seriesSlug && hrefSlug !== seriesSlug) continue;
      var epNum = parseInt(numStr, 10);
      if (!epNum || seenEp[epNum]) continue;
      seenEp[epNum] = true;
      if (numStr.length > padWidth) padWidth = numStr.length;
      if (!baseUrlPart) baseUrlPart = hrefSlug;
      if (epNum > maxEp) maxEp = epNum;
    }
    if (!baseUrlPart) baseUrlPart = seriesSlug;
    if (!padWidth) {
      var wNum = watchHref.match(/tap-(\d+)/i);
      if (wNum) padWidth = wNum[1].length;
    }
    if (maxEp <= 1 && !seenEp[1]) {
      var statusMatch = status.match(/Tập\s+(\d+)/i) || status.match(/\((\d+)\)/i);
      if (statusMatch && parseInt(statusMatch[1], 10) > maxEp) maxEp = parseInt(statusMatch[1], 10);
    }
    if (baseUrlPart) {
      if (padWidth < 2 && maxEp >= 10) padWidth = 2;
      for (var i = 1; i <= maxEp; i++) {
        var numStr2 = "" + i;
        while (numStr2.length < padWidth) numStr2 = "0" + numStr2;
        episodes.push({ name: "Tập " + i, watch: TV_BASE + "/xem/" + baseUrlPart + "/tap-" + numStr2 });
      }
    }
  } else if (watchHref) {
    episodes.push({ name: "Full", watch: tvAbs(watchHref) });
  }
  out.episodes = episodes;
  return out;
}

function tvResolve(watchUrl) {
  var html = httpGet(watchUrl);
  if (!html) return null;
  var iframeMatch = html.match(/id=["']movie-iframe["'][^>]*src=["']([^"']+)["']/i) ||
                    html.match(/var\s+linkHPro\s*=\s*["']([^"']+)["']/i) ||
                    html.match(/<iframe[^>]+src=["']([^"']+)["']/i);
  if (iframeMatch && iframeMatch[1]) {
    var iframeSrc = iframeMatch[1].replace(/&amp;/g, "&").replace(/^\s+|\s+$/g, "");
    var urlParamMatch = iframeSrc.match(/[?&]url=([^&"'<>]+)/i);
    if (urlParamMatch) {
      var direct = urlParamMatch[1];
      try { direct = decodeURIComponent(direct); } catch (e) {}
      return { url: direct, embed: iframeSrc };
    }
    if (iframeSrc.indexOf("streamvsmov.com/video/") > -1) {
      return { url: tvCleanStream(iframeSrc), embed: iframeSrc };
    }
    if (iframeSrc.indexOf(".m3u8") > -1 || iframeSrc.indexOf(".mp4") > -1) {
      return { url: iframeSrc, embed: iframeSrc };
    }
    return null; // host nhung khong giai duoc -> bo tap
  }
  var directM3u8Match = html.match(/https?:\/\/[^"'\s<>]+\.m3u8[^\s"']*/i);
  if (directM3u8Match) return { url: directM3u8Match[0], embed: watchUrl };
  return null;
}

function getDetail(id) {
  try {
    if (!id) return JSON.stringify({});
    var url = tvAbs(id);
    var html = httpGet(url);
    if (!html) return JSON.stringify({});
    var meta = tvParseDetail(html);
    if (!meta.title && meta.episodes.length === 0) return JSON.stringify({});
    var eps = [];
    for (var j = 0; j < meta.episodes.length; j++) {
      var resolved = tvResolve(meta.episodes[j].watch);
      if (!resolved || !resolved.url) continue;
      eps.push({ name: meta.episodes[j].name, url: resolved.url, embed: resolved.embed || meta.episodes[j].watch });
    }
    var servers = [];
    if (eps.length > 0) servers.push({ name: "TV Hay", episodes: eps });
    return JSON.stringify({
      id: id,
      title: meta.title || "",
      origin_name: meta.origin_name || "",
      poster: meta.poster || "",
      thumb: meta.poster || "",
      year: meta.year || 0,
      quality: "",
      lang: "",
      episode_current: meta.episode_current || "",
      episode_total: "",
      content: meta.content || "",
      type: "",
      servers: servers
    });
  } catch (e) { log("tvhay getDetail loi: " + e); return JSON.stringify({}); }
}
