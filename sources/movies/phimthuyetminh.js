// Plugin Phim TM cho app lai HQH — v1.0.0
// Nguon: https://phimthuyetminh.date — viet 2026-11-20, chep co che cua
// plugin SuperOK (phimthuyetminh v1.0.3) sang hop dong HQH:
//   - Danh sach / tim kiem: cao HTML trang danh sach (khoi .movie-item).
//     List:  GET {path}?page=N        (path = /phim-moi, /the-loai/...)
//     Search: GET /?view=tim-kiem&keyword=&page=
//   - Chi tiet: vao trang xem /xem/{slug}/tap-01, doc cac khoi
//     .source-container -> link trang xem cua tung tap; neu trang chi
//     co nut Xem Phim (btn-watch) thi sinh link tap theo so tap lon nhat
//     thay trong trang (giong ban SuperOK).
//   - Giai link (trong getDetail): tai trang xem cua tung tap, lay
//     iframe #movie-iframe / bien linkHPro / linkSPro:
//       + tham so url= cua iframe (player phimapi) -> link thang;
//       + streamvsmov.com/video/<id> -> doi thanh /stream/<id>/master.m3u8;
//       + iframe tro thang .m3u8/.mp4 -> link thang;
//       + khong co iframe thi tim .m3u8 tran trong trang;
//       + host nhung la (vd streamc.xyz) -> bo tap do (app khong co WebView).
// Host API: httpGet(url) -> string, log(msg). Moi ham tra ve CHUOI JSON (xem CONTRACT.md).

var PT_BASE = "https://phimthuyetminh.date";

function ptAbs(u) {
  if (!u) return "";
  u = u.replace(/&amp;/g, "&");
  if (u.indexOf("//") === 0) return "https:" + u;
  if (u.indexOf("http") === 0) return u;
  return PT_BASE + (u.charAt(0) === "/" ? u : "/" + u);
}

function ptStrip(s) {
  if (!s) return "";
  return s.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").replace(/^\s+|\s+$/g, "");
}

function ptCleanStream(url) {
  if (!url) return "";
  if (url.indexOf("streamvsmov.com/video/") > -1) {
    var clean = url.split("?")[0].split("#")[0];
    if (clean.charAt(clean.length - 1) === "/") clean = clean.substring(0, clean.length - 1);
    var parts = clean.split("/video/");
    if (parts.length === 2) return parts[0] + "/stream/" + parts[1] + "/master.m3u8";
  }
  return url;
}

function ptEmpty(page) {
  return JSON.stringify({ items: [], page: page || 1, totalPages: 1 });
}

function ptParseList(html, page) {
  var items = [];
  if (!html) return { items: items, totalPages: 1 };
  var trimmed = html.replace(/^\s+/, "");
  if (trimmed.charAt(0) === "[" || trimmed.charAt(0) === "{") {
    try {
      var json = JSON.parse(trimmed);
      var arr = (json instanceof Array) ? json : (json.data || json.items || []);
      for (var j = 0; j < arr.length; j++) {
        var m = arr[j];
        if (!m.slug) continue;
        items.push({
          id: PT_BASE + "/phim/" + m.slug,
          title: m.name || m.title || "",
          origin_name: "",
          poster: m.thumb || m.poster || "",
          thumb: m.thumb || m.poster || "",
          year: m.year || 0,
          quality: "FHD",
          lang: m.lang || "",
          episode_current: "",
          episode_total: "",
          type: ""
        });
      }
      return { items: items, totalPages: 1 };
    } catch (e) { /* khong phai JSON thi cao HTML tiep */ }
  }
  var itemRegex = /<div[^>]+class=["'][^"']*movie-item[^"']*["'][^>]*>([\s\S]*?)(?=<div[^>]+class=["'][^"']*movie-item[^"']*["']|$)/gi;
  var match;
  while ((match = itemRegex.exec(html)) !== null) {
    var block = match[1];
    var linkMatch = block.match(/<a[^>]+href=["']([^"']+)["'][^>]*title=["']([^"']+)["']/i) ||
                    block.match(/title=["']([^"']+)["'][^>]*<a[^>]+href=["']([^"']+)["']/i) ||
                    block.match(/<a[^>]+href=["']([^"']+)["']/i);
    if (!linkMatch) continue;
    var itemUrl = linkMatch[1];
    if (itemUrl.indexOf("${movie.slug}") !== -1) continue;
    var title = (linkMatch[2] || "").replace(/^\s+|\s+$/g, "");
    if (!title) {
      var titleTag = block.match(/class=["'][^"']*movie-title[^"']*["'][^>]*>([^<]+)/i);
      if (titleTag) title = titleTag[1].replace(/^\s+|\s+$/g, "");
    }
    if (!title) {
      var imgAlt = block.match(/alt=["']([^"']+)["']/i);
      if (imgAlt) title = imgAlt[1].replace(/^\s+|\s+$/g, "");
    }
    if (!title) continue;
    itemUrl = ptAbs(itemUrl);
    var thumbMatch = block.match(/<img[^>]*?\bsrc=["']([^"']+)["']/i) ||
                     block.match(/data-src=["']([^"']+)["']/i);
    var thumb = thumbMatch ? ptAbs(thumbMatch[1]) : "";
    var year = 0;
    var yearMatch = block.match(/class=["'][^"']*movie-year[^"']*["'][^>]*>(\d+)/i);
    if (yearMatch) year = parseInt(yearMatch[1], 10) || 0;
    var quality = "";
    var qMatch = block.match(/class=["'][^"']*movie-quality[^"']*["'][^>]*>([^<]+)/i);
    if (qMatch) quality = ptStrip(qMatch[1]);
    var epStatus = "";
    var epMatch = block.match(/class=["'][^"']*movie-ep-status[^"']*["'][^>]*>([^<]+)/i);
    if (epMatch) epStatus = ptStrip(epMatch[1]);
    var lang = "";
    var lMatch = block.match(/class=["'][^"']*movie-label[^"']*["'][^>]*>([^<]+)/i);
    if (lMatch) lang = ptStrip(lMatch[1]);
    items.push({
      id: itemUrl,
      title: title,
      origin_name: "",
      poster: thumb,
      thumb: thumb,
      year: year,
      quality: quality || "FHD",
      lang: lang,
      episode_current: epStatus,
      episode_total: "",
      type: ""
    });
  }
  var totalPages = page;
  var pRegex = /href=["'][^"']*[?&]page=(\d+)[^"']*["']/gi;
  var pm;
  while ((pm = pRegex.exec(html)) !== null) {
    var pVal = parseInt(pm[1], 10);
    if (pVal > totalPages) totalPages = pVal;
  }
  var hasNext = /class=["'][^"']*pagination[^"']*["'][\s\S]*?>»<\/a>/i.test(html);
  if (hasNext && totalPages <= page) totalPages = page + 1;
  return { items: items, totalPages: totalPages };
}

function ptListResult(html, page) {
  var r = ptParseList(html, page);
  return JSON.stringify({ items: r.items, page: page, totalPages: Math.max(1, r.totalPages) });
}

function getCategories() {
  return JSON.stringify([
    { id: "/phim-moi", name: "Phim Mới" },
    { id: "/phim-le", name: "Phim Lẻ" },
    { id: "/phim-bo", name: "Phim Bộ" },
    { id: "/the-loai/hanh-dong", name: "Hành Động" },
    { id: "/the-loai/co-trang", name: "Cổ Trang" },
    { id: "/the-loai/hoat-hinh", name: "Hoạt Hình" },
    { id: "/the-loai/vo-thuat", name: "Võ Thuật" },
    { id: "/the-loai/tinh-cam", name: "Tình Cảm" },
    { id: "/the-loai/hai-huoc", name: "Hài Hước" },
    { id: "/the-loai/kinh-di", name: "Kinh Dị" },
    { id: "/the-loai/vien-tuong", name: "Viễn Tưởng" },
    { id: "/the-loai/hinh-su", name: "Hình Sự" },
    { id: "/the-loai/tam-ly", name: "Tâm Lý" },
    { id: "/the-loai/chien-tranh", name: "Chiến Tranh" },
    { id: "/the-loai/chinh-kich", name: "Chính Kịch" },
    { id: "/the-loai/than-thoai", name: "Thần Thoại" },
    { id: "/the-loai/hoc-duong", name: "Học Đường" }
  ]);
}

function getList(categoryId, page) {
  page = page || 1;
  try {
    var path = categoryId || "/phim-moi";
    var url = PT_BASE + (path.charAt(0) === "/" ? path : "/" + path);
    if (page > 1) url += (url.indexOf("?") > -1 ? "&" : "?") + "page=" + page;
    var html = httpGet(url);
    if (!html) return ptEmpty(page);
    return ptListResult(html, page);
  } catch (e) { log("phimtm getList loi: " + e); return ptEmpty(page); }
}

function search(keyword, page) {
  page = page || 1;
  try {
    var url = PT_BASE + "/?view=tim-kiem&keyword=" + encodeURIComponent(keyword || "") + (page > 1 ? "&page=" + page : "");
    var html = httpGet(url);
    if (!html) return ptEmpty(page);
    return ptListResult(html, page);
  } catch (e) { log("phimtm search loi: " + e); return ptEmpty(page); }
}

function ptWatchUrl(id) {
  if (!id) return "";
  var s = id;
  if (s.indexOf("http") === 0) {
    var clean = s.split("?")[0].split("#")[0];
    if (clean.indexOf("/xem/") > -1) return s;
    if (clean.indexOf("/phim/") > -1) s = clean.split("/phim/")[1];
    else s = clean;
  }
  s = s.replace(/^\/+|\/+$/g, "");
  if (s.indexOf("xem/") === 0) return PT_BASE + "/" + s;
  if (s.indexOf("phim/") === 0) s = s.substring(5);
  return PT_BASE + "/xem/" + s + "/tap-01";
}

function ptExtractMeta(html, label) {
  var regex = new RegExp("<li>[\\s\\S]*?" + label + "[\\s\\S]*?:[\\s\\S]*?<span[^>]*>([\\s\\S]*?)<\\/span>", "i");
  var m = html.match(regex);
  if (!m) {
    var regex2 = new RegExp(label + "[\\s\\S]*?:[\\s\\S]*?<span[^>]*>([\\s\\S]*?)<\\/span>", "i");
    m = html.match(regex2);
  }
  return m ? ptStrip(m[1]) : "";
}

function ptParseDetail(html, pageUrl) {
  var out = {
    title: "", origin_name: "", poster: "", content: "", year: 0,
    episode_current: "", servers: []
  };
  if (!html) return out;
  var tMatch = html.match(/class=["'][^"']*movie-name-vi[^"']*["'][^>]*>([\s\S]*?)<\/h1>/i) ||
               html.match(/class=["'][^"']*movie-h1[^"']*["'][^>]*>([\s\S]*?)<\/h1>/i) ||
               html.match(/property=["']og:title["']\s+content=["']([^"']+)["']/i);
  if (tMatch) out.title = ptStrip(tMatch[1]).replace(/\s*—\s*TẬP[\s\S]*$/i, "").replace(/Xem phim\s*/i, "").replace(/^\s+|\s+$/g, "");
  var oMatch = html.match(/class=["'][^"']*movie-name-en[^"']*["'][^>]*>([\s\S]*?)<\/p>/i) ||
               html.match(/class=["'][^"']*movie-h2[^"']*["'][^>]*>([\s\S]*?)<\/h2>/i);
  if (oMatch) out.origin_name = ptStrip(oMatch[1]);
  var pMatch = html.match(/property=["']og:image["']\s+content=["']([^"']+)["']/i) ||
               html.match(/class=["']poster-img-box["'][\s\S]*?<img[^>]+src=["']([^"']+)["']/i);
  if (pMatch) out.poster = ptAbs(pMatch[1]);
  var dMatch = html.match(/class=["'][^"']*movie-desc[^"']*["'][^>]*>([\s\S]*?)<\/div>/i) ||
               html.match(/class=["'][^"']*movie-description[^"']*["'][^>]*>([\s\S]*?)<\/div>/i) ||
               html.match(/property=["']og:description["']\s+content=["']([^"']+)["']/i);
  if (dMatch) out.content = ptStrip(dMatch[1].replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, "\"").replace(/&amp;/g, "&"));
  var yearStr = ptExtractMeta(html, "Năm");
  out.year = parseInt(yearStr, 10) || 0;
  if (!out.year) {
    var yMatch = out.origin_name.match(/\((\d{4})\)/) || out.title.match(/\((\d{4})\)/);
    if (yMatch) out.year = parseInt(yMatch[1], 10) || 0;
  }
  var status = ptExtractMeta(html, "Tình Trạng");
  out.episode_current = status;

  // Layout trang xem: cac khoi .source-container chua link tung tap.
  var sourceRegex = /<div[^>]+class=["'][^"']*source-container[^"']*["'][^>]*>([\s\S]*?)(?=<div[^>]+class=["'][^"']*source-container[^"']*["']|<\/div>\s*<\/div>\s*<div[^>]+class=["']movie-info-block|$)/gi;
  var sMatch;
  while ((sMatch = sourceRegex.exec(html)) !== null) {
    var sBlock = sMatch[1];
    var titleMatch = sBlock.match(/class=["'][^"']*source-title[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);
    var serverName = titleMatch ? ptStrip(titleMatch[1]) : ("Server " + (out.servers.length + 1));
    var epRegex = /<a[^>]+href=["']([^"']+)["'][^>]*class=["'][^"']*ep-btn[^"']*["'][^>]*>([\s\S]*?)<\/a>/gi;
    var epMatch;
    var sEpisodes = [];
    while ((epMatch = epRegex.exec(sBlock)) !== null) {
      var epHref = ptAbs(epMatch[1].split("#")[0].replace(/^\s+|\s+$/g, ""));
      var epName = ptStrip(epMatch[2]);
      if (epHref) sEpisodes.push({ name: epName || ("Tập " + (sEpisodes.length + 1)), watch: epHref });
    }
    if (sEpisodes.length > 0) out.servers.push({ name: serverName, episodes: sEpisodes });
  }

  // Fallback: trang chi co nut Xem Phim -> sinh tap theo so lon nhat tim thay.
  if (out.servers.length === 0) {
    var episodes = [];
    var watchMatch = html.match(/class=["'][^"']*btn-watch[^"']*["'][^>]*href=["']([^"']+)["']/i) ||
                     html.match(/href=["']([^"']+)["'][^>]*class=["'][^"']*btn-watch[^"']*["']/i);
    var watchHref = watchMatch ? watchMatch[1] : "";
    var isSeries = false;
    var maxEp = 1;
    var baseUrlPart = "";
    var padDigits = 1;
    if (watchHref && watchHref.indexOf("tap-full") === -1 && watchHref.indexOf("tap-Full") === -1 && /\/tap-/i.test(watchHref)) {
      isSeries = true;
      var epRe = /\/xem\/([^\/]+)\/tap-(\d+)/gi;
      var em;
      while ((em = epRe.exec(html)) !== null) {
        baseUrlPart = em[1];
        if (em[2].length > padDigits) padDigits = em[2].length;
        var epNum = parseInt(em[2], 10);
        if (epNum > maxEp) maxEp = epNum;
      }
      var statusMatch = status.match(/\((?:[^\/]+\/)?(\d+)\)/i) || status.match(/Tập\s+(\d+)/i);
      if (statusMatch && parseInt(statusMatch[1], 10) > maxEp) maxEp = parseInt(statusMatch[1], 10);
      if (!baseUrlPart) {
        var wum = watchHref.match(/\/xem\/([^\/]+)\/tap-/i);
        if (wum) baseUrlPart = wum[1];
      }
    }
    if (isSeries && baseUrlPart) {
      for (var i = 1; i <= maxEp; i++) {
        var epSlugPart = "tap-";
        if (padDigits === 2 && i < 10) epSlugPart += "0" + i;
        else if (padDigits === 3 && i < 10) epSlugPart += "00" + i;
        else if (padDigits === 3 && i < 100) epSlugPart += "0" + i;
        else epSlugPart += i;
        episodes.push({ name: "Tập " + i, watch: PT_BASE + "/xem/" + baseUrlPart + "/" + epSlugPart });
      }
    } else if (watchHref) {
      episodes.push({ name: "Full", watch: ptAbs(watchHref) });
    }
    if (episodes.length > 0) out.servers.push({ name: "Thuyết Minh", episodes: episodes });
  }
  return out;
}

function ptResolve(watchUrl) {
  var html = httpGet(watchUrl);
  if (!html) return null;
  var iframeMatch = html.match(/id=["']movie-iframe["'][^>]*src=["']([^"']+)["']/i) ||
                    html.match(/var\s+linkHPro\s*=\s*["']([^"']+)["']/i) ||
                    html.match(/var\s+linkSPro\s*=\s*["']([^"']+)["']/i) ||
                    html.match(/var\s+link\w*\s*=\s*["']([^"']+)["']/i) ||
                    html.match(/<iframe[^>]+src=["']([^"']+)["']/i);
  if (iframeMatch && iframeMatch[1]) {
    var rawSrc = iframeMatch[1].replace(/\\/g, "").replace(/&amp;/g, "&").replace(/^\s+|\s+$/g, "");
    var urlParamMatch = rawSrc.match(/[?&]url=([^&]+)/i);
    if (urlParamMatch) {
      var direct = urlParamMatch[1];
      try { direct = decodeURIComponent(direct); } catch (e) {}
      return { url: direct, embed: rawSrc };
    }
    if (rawSrc.indexOf("streamvsmov.com/video/") > -1) {
      return { url: ptCleanStream(rawSrc), embed: rawSrc };
    }
    if (rawSrc.indexOf(".m3u8") > -1 || rawSrc.indexOf(".mp4") > -1) {
      return { url: rawSrc, embed: rawSrc };
    }
    return null; // host nhung khong giai duoc -> bo tap
  }
  var directM3u8Match = html.match(/https?:\/\/[^"'\s<>]+\.m3u8[^\s"']*/i);
  if (directM3u8Match) return { url: directM3u8Match[0], embed: watchUrl };
  return null;
}

function getDetail(id) {
  try {
    var watchUrl = ptWatchUrl(id);
    if (!watchUrl) return JSON.stringify({});
    var html = httpGet(watchUrl);
    if (!html) return JSON.stringify({});
    var meta = ptParseDetail(html, watchUrl);
    if (!meta.title && meta.servers.length === 0) return JSON.stringify({});
    var servers = [];
    for (var i = 0; i < meta.servers.length; i++) {
      var eps = [];
      var rawEps = meta.servers[i].episodes;
      for (var j = 0; j < rawEps.length; j++) {
        var resolved = ptResolve(rawEps[j].watch);
        if (!resolved || !resolved.url) continue;
        eps.push({ name: rawEps[j].name, url: resolved.url, embed: resolved.embed || rawEps[j].watch });
      }
      if (eps.length > 0) servers.push({ name: meta.servers[i].name, episodes: eps });
    }
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
  } catch (e) { log("phimtm getDetail loi: " + e); return JSON.stringify({}); }
}
