// Plugin MFlix cho app lai HQH — v1.0.0
// Goc: SuperOK 3.3, plugin "MFlix (EXO)" v1.0.3 — thuc chat la site
// ChillPhim.City (https://chill.phim.city), khong phai mflix.to.
// Tim duoc trong lich su repo shoshjvn/movies (commit 2026-10-15,
// mflix_plugin.js), giai ma bang khoa ENC chung cua SuperOK; registry
// SuperOK hien tai (16 nguon, kiem 2026-11-20) da bo MFlix + Ga Mo.
//   - Danh sach / tim kiem: cao HTML trang danh sach (card
//     <a href="/phim-le|bo/slug"> + <img data-src alt="Title">).
//     List:  GET {path}?page=N   (24 phim/trang)
//     Search: GET /tim-kiem/<keyword>?page=N
//   - Chi tiet: trang phim co link /tap-phim/<slug>/<mua>-<tap> (phim bo)
//     hoac chua san link 123Embed (phim le -> 1 tap Full).
//   - Giai link (trong getDetail, buoc SuperOK THIEU — ban goc chi tra
//     embed ve cho player web cua ho): moi tap:
//       tap-phim -> boc link play.123embed.net -> tai trang embed ->
//       boc loadMovieServer('id','server') / loadSerieEpisode('id','tap','server')
//       -> GET /ajax/movie|serie/get_sources/{id}[/{tap}]/{server}, thu
//       lan luot theo thu tu server tren trang, lay sources[0].file.
//     Da kiem that 2026-11-20 tu VM: phim le "Nguoi Hau" server gd-hls
//     tra link MP4 truc tiep (GET Range tra 206 video/mp4); tap 1 phim bo
//     server tikpho tra HLS master.m3u8 that. Tap nao giai khong ra thi bo.
//   - Chu y: mo phim bo se cham hon cac nguon khac vi phai giai tung tap;
//     nhung embed_id cua 123Embed KHONG doi theo tap trong cung mua nen
//     chi tap 1 giai duong day du (trang tap-phim + trang embed + AJAX),
//     cac tap sau chi can 1 request AJAX/tap (mfResolveFast); phim le
//     chi ~2 request.
// Host API: httpGet(url) -> string, log(msg). Moi ham tra ve CHUOI JSON (xem CONTRACT.md).
// ES5 (Rhino): var, khong arrow function, khong template literal.
// Bay Rhino: httpGet tra Java String — ep String(html) truoc khi replace regex.

var MF_BASE = "https://chill.phim.city";
var MF_EMBED = "https://play.123embed.net";

function mfAbs(u) {
  if (!u) return "";
  u = u.replace(/&amp;/g, "&");
  if (u.indexOf("//") === 0) return "https:" + u;
  if (u.indexOf("http") === 0) return u;
  return MF_BASE + (u.charAt(0) === "/" ? u : "/" + u);
}

function mfStrip(s) {
  if (!s) return "";
  return s.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").replace(/^\s+|\s+$/g, "");
}

function mfNorm(html) {
  if (!html) return "";
  var s = String(html);
  s = s.split("&quot;").join('"');
  s = s.split("&#039;").join("'");
  s = s.split("&amp;").join("&");
  s = s.split("\\/").join("/");
  s = s.split('\\"').join('"');
  return s;
}

function mfEmpty(page) {
  return JSON.stringify({ items: [], page: page || 1, totalPages: 1 });
}

function mfParseList(html, page) {
  var items = [];
  if (!html) return items;
  var src = mfNorm(html);
  var seen = {};
  var aRe = /<a[^>]+href="([^"]*\/phim-(?:le|bo)\/[a-z0-9\-]+)"[^>]*>([\s\S]{0,6000}?)<\/a>/gi;
  var m;
  while ((m = aRe.exec(src)) !== null) {
    var href = m[1];
    if (seen[href]) continue;
    var inner = m[2];
    var img = inner.match(/data-src="([^"]+)"/i) || inner.match(/src="([^"]+)"/i);
    var alt = inner.match(/alt="([^"]*)"/i);
    var title = alt ? mfStrip(alt[1]) : "";
    if (!title) continue;
    var poster = img ? mfAbs(img[1]) : "";
    if (poster.indexOf("data:image") === 0) poster = "";
    seen[href] = true;
    var year = 0;
    var epStatus = "";
    var idx = src.indexOf(href);
    if (idx > -1) {
      var win = src.substring(idx, idx + 3000);
      var y = win.match(/absolute right-0">((?:19|20)\d{2})</);
      if (y) year = parseInt(y[1], 10) || 0;
      var d = win.match(/(\d+\s*phút)/i) || win.match(/(Tập\s*\d+[^<]{0,20})/i);
      if (d) epStatus = mfStrip(d[1]);
    }
    items.push({
      id: href, title: title, origin_name: "", poster: poster, thumb: poster,
      year: year, quality: "", lang: "Vietsub",
      episode_current: epStatus, episode_total: "", type: ""
    });
  }
  return items;
}

function mfListResult(html, page) {
  var items = mfParseList(html, page);
  var totalPages = items.length > 0 ? page + 1 : page;
  return JSON.stringify({ items: items, page: page, totalPages: totalPages });
}

function getCategories() {
  return JSON.stringify([
    { id: "/phim-le", name: "Phim Lẻ" },
    { id: "/phim-bo", name: "Phim Bộ" },
    { id: "/xu-huong", name: "Xu Hướng" },
    { id: "/the-loai/hanh-dong", name: "Hành Động" },
    { id: "/the-loai/tinh-cam", name: "Tình Cảm" },
    { id: "/the-loai/hai-huoc", name: "Hài Hước" },
    { id: "/the-loai/co-trang", name: "Cổ Trang" },
    { id: "/the-loai/hinh-su", name: "Hình Sự" },
    { id: "/the-loai/vien-tuong", name: "Viễn Tưởng" },
    { id: "/the-loai/phieu-luu", name: "Phiêu Lưu" },
    { id: "/the-loai/tam-ly", name: "Tâm Lý" },
    { id: "/the-loai/gia-dinh", name: "Gia Đình" },
    { id: "/the-loai/chinh-kich", name: "Chính Kịch" },
    { id: "/the-loai/bi-an", name: "Bí Ẩn" },
    { id: "/the-loai/anime", name: "Anime" },
    { id: "/quoc-gia/trung-quoc", name: "Trung Quốc" },
    { id: "/quoc-gia/han-quoc", name: "Hàn Quốc" },
    { id: "/quoc-gia/nhat-ban", name: "Nhật Bản" },
    { id: "/quoc-gia/thai-lan", name: "Thái Lan" },
    { id: "/quoc-gia/viet-nam", name: "Việt Nam" }
  ]);
}

function getList(categoryId, page) {
  page = page || 1;
  try {
    var path = categoryId || "/phim-le";
    var url = MF_BASE + (path.charAt(0) === "/" ? path : "/" + path);
    if (page > 1) url += "?page=" + page;
    var html = httpGet(url);
    if (!html) return mfEmpty(page);
    return mfListResult(html, page);
  } catch (e) { log("mflix getList loi: " + e); return mfEmpty(page); }
}

function search(keyword, page) {
  page = page || 1;
  try {
    var url = MF_BASE + "/tim-kiem/" + encodeURIComponent(keyword || "");
    if (page > 1) url += "?page=" + page;
    var html = httpGet(url);
    if (!html) return mfEmpty(page);
    return mfListResult(html, page);
  } catch (e) { log("mflix search loi: " + e); return mfEmpty(page); }
}

// ---- Giai 123Embed -> link phat truc tiep (buoc SuperOK khong co) ----
function mfExtractEmbed(html) {
  var src = mfNorm(html);
  var cands = [];
  var re, m;
  re = /playVideo\('([^']*play\.123embed\.net[^']*)',\s*'123Embed'/gi;
  while ((m = re.exec(src)) !== null) cands.push(m[1]);
  re = /(currentLink|data-src)\s*[:=]\s*['"]([^'"]*play\.123embed\.net[^'"]*)['"]/gi;
  while ((m = re.exec(src)) !== null) cands.push(m[2]);
  re = /play\.123embed\.net\/[^\s"'\\]*/gi;
  while ((m = re.exec(src)) !== null) {
    var u = m[0].replace(/["'<>,\s]+$/g, "");
    if (u.indexOf("http") !== 0) u = "https://" + u;
    cands.push(u);
  }
  re = /<iframe[^>]+src="([^"]+)"/gi;
  while ((m = re.exec(src)) !== null) {
    if (m[1].indexOf("javascript") === 0) continue;
    if (m[0].indexOf(":src=") > -1 && m[0].indexOf('src="http') === -1 && m[0].indexOf('src="/') === -1) continue;
    cands.push(m[1].replace(/&amp;/g, "&"));
  }
  for (var i = 0; i < cands.length; i++) {
    if (cands[i].indexOf("123embed") > -1) return cands[i];
  }
  return cands.length > 0 ? cands[0] : "";
}

function mfParseSources(jsonText) {
  try {
    var d = JSON.parse(jsonText);
    var s = d.sources;
    if (typeof s === "string") s = JSON.parse(s || "[]");
    if (!s || !s.length) return "";
    for (var i = 0; i < s.length; i++) {
      var f = s[i] && s[i].file ? s[i].file : "";
      if (f && (f.indexOf(".m3u8") > -1 || f.indexOf(".mp4") > -1 || f.indexOf("videoplayback") > -1)) return f;
    }
    return s[0].file || "";
  } catch (e) { return ""; }
}

function mfResolveEmbed(embedUrl, isSeries, epNum) {
  try {
    if (!embedUrl || embedUrl.indexOf("123embed") === -1) return null;
    var emb = httpGet(embedUrl);
    if (!emb) return null;
    var src = String(emb);
    var calls = [];
    var re, m;
    if (isSeries) {
      re = /loadSerieEpisode\('(\d+)'\s*,\s*['"]?(\d+)['"]?\s*,\s*'([^']+)'\)/g;
      while ((m = re.exec(src)) !== null) calls.push({ id: m[1], ep: m[2], server: m[3] });
    } else {
      re = /loadMovieServer\('(\d+)'\s*,\s*'([^']+)'\)/g;
      while ((m = re.exec(src)) !== null) calls.push({ id: m[1], server: m[2] });
    }
    if (calls.length === 0) return null;
    var seen = {};
    var servers = [];
    for (var s = 0; s < calls.length; s++) {
      if (!seen[calls[s].server]) { seen[calls[s].server] = true; servers.push(calls[s].server); }
    }
    for (var i = 0; i < calls.length; i++) {
      var c = calls[i];
      var key = c.server;
      if (seen[key] === "done") continue;
      seen[key] = "done";
      var ajax = isSeries
        ? MF_EMBED + "/ajax/serie/get_sources/" + c.id + "/" + (epNum || c.ep || "1") + "/" + c.server
        : MF_EMBED + "/ajax/movie/get_sources/" + c.id + "/" + c.server;
      var js = httpGet(ajax);
      if (!js) continue;
      var file = mfParseSources(String(js));
      if (file) return { url: file, embed: embedUrl, referer: embedUrl, embedId: c.id, servers: servers };
    }
    return null;
  } catch (e) { log("mflix resolve loi: " + e); return null; }
}

// Giai nhanh tap phim bo: embed_id KHONG doi theo tap trong cung bo
// (kiem that 20/11/2026: tap 1 va tap 2 cung id 393846) nen sau khi giai
// xong tap 1, cac tap sau chi can 1 request AJAX/tap thay vi 3 request
// (trang tap-phim + trang embed + AJAX). servers = thu tu server lay tu
// tap 1; tap nao giai nhanh that bai thi roi ve duong day du.
function mfResolveFast(embedId, servers, embedBase, epNum) {
  try {
    if (!embedId || !servers || servers.length === 0) return null;
    for (var i = 0; i < servers.length; i++) {
      var ajax = MF_EMBED + "/ajax/serie/get_sources/" + embedId + "/" + epNum + "/" + servers[i];
      var js = httpGet(ajax);
      if (!js) continue;
      var file = mfParseSources(String(js));
      if (file) {
        var emb = embedBase ? embedBase + "/" + epNum : "";
        return { url: file, embed: emb, referer: emb };
      }
    }
    return null;
  } catch (e) { log("mflix resolve nhanh loi: " + e); return null; }
}

function mfResolveWatch(watchUrl, isSeries, epNum) {
  try {
    var html = httpGet(watchUrl);
    if (!html) return null;
    var embed = mfExtractEmbed(html);
    if (!embed) return null;
    return mfResolveEmbed(embed, isSeries, epNum);
  } catch (e) { log("mflix resolveWatch loi: " + e); return null; }
}

function getDetail(id) {
  try {
    if (!id) return JSON.stringify({});
    var url = mfAbs(id);
    var html = httpGet(url);
    if (!html) return JSON.stringify({});
    var src = mfNorm(html);
    var title = "";
    var h1 = src.match(/<h1[^>]*>([\s\S]{1,300}?)<\/h1>/i);
    if (h1) title = mfStrip(h1[1]);
    if (!title) {
      var t = src.match(/<title>([^<]+)<\/title>/i);
      if (t) title = t[1].split(" Vietsub")[0].split(" | ")[0].trim();
    }
    var poster = "";
    var og = src.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/i)
        || src.match(/<meta[^>]+content="([^"]+)"[^>]+property="og:image"/i);
    if (og) poster = mfAbs(og[1]);
    var content = "";
    var dp = src.match(/<p class="text-gray-400 text-sm leading-relaxed">([\s\S]{1,4000}?)<\/p>/i);
    if (dp) content = mfStrip(dp[1]);
    if (!content) {
      var md = src.match(/<meta[^>]+name="description"[^>]+content="([^"]{1,600})/i)
          || src.match(/<meta[^>]+property="og:description"[^>]+content="([^"]{1,600})/i);
      if (md) content = md[1];
    }
    var year = 0;
    var rel = src.match(/Phát hành<\/span>[\s\S]{0,300}?((?:19|20)\d{2})/i)
        || src.match(/<title>[^<]*\(((?:19|20)\d{2})\)/i);
    if (rel) year = parseInt(rel[1], 10) || 0;

    var epMap = {};
    var epRe = /href="(https:\/\/chill\.phim\.city\/tap-phim\/[a-z0-9\-]+\/\d+-\d+)[^"]*"/gi;
    var em;
    while ((em = epRe.exec(src)) !== null) epMap[em[1]] = true;
    var epUrls = [];
    for (var k in epMap) epUrls.push(k);
    epUrls.sort(function (a, b) {
      var ma = a.match(/\/(\d+)-(\d+)$/);
      var mb = b.match(/\/(\d+)-(\d+)$/);
      var sa = ma ? parseInt(ma[1], 10) : 0, ea = ma ? parseInt(ma[2], 10) : 0;
      var sb = mb ? parseInt(mb[1], 10) : 0, eb = mb ? parseInt(mb[2], 10) : 0;
      if (sa !== sb) return sa - sb;
      return ea - eb;
    });

    var eps = [];
    if (epUrls.length > 0) {
      var multiSeason = false;
      try {
        var firstS = epUrls[0].match(/\/(\d+)-\d+$/)[1];
        var lastS = epUrls[epUrls.length - 1].match(/\/(\d+)-\d+$/)[1];
        multiSeason = firstS !== lastS;
      } catch (e2) {}
      var fastId = "";
      var fastSeason = "";
      var fastServers = [];
      var fastBase = "";
      for (var ei = 0; ei < epUrls.length; ei++) {
        var mm2 = epUrls[ei].match(/\/(\d+)-(\d+)$/);
        var sNum = mm2 ? mm2[1] : "1";
        var eNum = mm2 ? mm2[2] : String(ei + 1);
        var label = multiSeason ? ("S" + sNum + " - Tập " + eNum) : ("Tập " + eNum);
        var resolved = null;
        if (fastId && sNum === fastSeason && fastServers.length > 0) {
          resolved = mfResolveFast(fastId, fastServers, fastBase, eNum);
        }
        if (!resolved || !resolved.url) {
          resolved = mfResolveWatch(epUrls[ei], true, eNum);
        }
        if (!resolved || !resolved.url) continue;
        if ((!fastId || sNum !== fastSeason) && resolved.embedId && resolved.servers && resolved.servers.length > 0) {
          fastId = resolved.embedId;
          fastSeason = sNum;
          fastServers = resolved.servers;
          if (resolved.embed) {
            var cut = resolved.embed.lastIndexOf("/");
            if (cut > 0) fastBase = resolved.embed.substring(0, cut);
          }
        }
        eps.push({ name: label, url: resolved.url, embed: resolved.embed, referer: resolved.referer });
      }
    } else if (src.indexOf("play.123embed.net") > -1) {
      var resolvedFull = mfResolveEmbed(mfExtractEmbed(html), false, "1");
      if (resolvedFull && resolvedFull.url) {
        eps.push({ name: "Full", url: resolvedFull.url, embed: resolvedFull.embed, referer: resolvedFull.referer });
      }
    }
    var servers = [];
    if (eps.length > 0) servers.push({ name: "123Embed", episodes: eps });
    return JSON.stringify({
      id: id, title: title || "", origin_name: "", poster: poster || "", thumb: poster || "",
      year: year || 0, quality: "", lang: "Vietsub",
      episode_current: "", episode_total: epUrls.length ? String(epUrls.length) : "",
      content: content || "", type: epUrls.length > 0 ? "series" : "movie",
      servers: servers
    });
  } catch (e) { log("mflix getDetail loi: " + e); return JSON.stringify({}); }
}
