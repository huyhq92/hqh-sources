// Plugin TCTV cho app lai HQH — v1.0.0
// Goc: plugin "TCTV" v1.0.0 trong he sinh thai VAX Player
// (repo plugin cua Tuangayxx/youngbi), chuyen sang hop dong HQH.
// Site dich: https://tctv.pro — nen tang "ThapCamTV" phat truc tiep the
// thao (bong da, bong chuyen, cau long...). Day la nguon LIVE, khong phai
// kho phim: moi muc la 1 tran/kenh dang hoac sap phat.
// Co che (JSON phuc vu thang tai goc site, dinh dang app):
//   - Trang chu: GET https://tctv.pro/ -> JSON {groups:[{id,name,
//     channels:[{id,name,image.url,labels,org_metadata,remote_data}]}]}
//   - Chi tiet:  GET https://tctv.pro/match/{id} -> {sources:[{name,
//     contents:[{streams:[{name, stream_links:[{url}], remote_data.url}]}]}]}
//     Stream nao chua co stream_links thi fetch tiep remote_data.url
//     (endpoint /stream/... tren cung host) -> {stream_links:[{url}]}.
//   - Link phat la m3u8 truc tiep; nen tang yeu cau Referer = goc site
//     (truong "referer" gan kem tung tap).
// Tinh trang 21/11/2026: goc tctv.pro con song (server tra 302 ->
// ww38.tctv.pro), noi dung JSON da doi chieu voi ban cache cua trinh
// duyet (dung cau truc groups/channels nhu tren). TU VM NAY khong tai
// duoc du lieu that (ket noi toi ww38.* bi reset) -> danh dau
// "VM-blocked, can kiem lai tren may that". Tren may that (mang VN)
// app fetch thang tctv.pro nhu VAX van lam.
// Host API: httpGet(url) -> string, log(msg). Moi ham tra ve CHUOI JSON (xem CONTRACT.md).
// ES5 (Rhino): var, khong arrow function, khong template literal.

var TC_BASE = "https://tctv.pro";
var TC_NAME = "TCTV";

function tcJson(url) {
  var raw = httpGet(url);
  if (!raw) return null;
  raw = String(raw);
  if (raw.charAt(0) !== "{") return null;
  try { return JSON.parse(raw); } catch (e) { log(TC_NAME + " parse loi: " + e); return null; }
}

function tcEmpty(page) {
  return JSON.stringify({ items: [], page: page || 1, totalPages: 1 });
}

function tcRoot() {
  return tcJson(TC_BASE + "/");
}

function tcChannelItem(ch, groupName) {
  var img = (ch.image && ch.image.url) || "";
  var label = "";
  if (ch.labels && ch.labels.length && ch.labels[0].text) label = ch.labels[0].text;
  var league = (ch.org_metadata && ch.org_metadata.league) || groupName || "";
  return {
    id: String(ch.id),
    title: ch.name || "",
    origin_name: league,
    poster: img,
    thumb: img,
    year: 0,
    quality: "LIVE",
    lang: league,
    episode_current: label || "Live",
    type: "live"
  };
}

function getCategories() {
  try {
    var root = tcRoot();
    var cats = [{ id: "live", name: "🔴 Trực tiếp" }];
    if (root && root.groups) {
      for (var i = 0; i < root.groups.length; i++) {
        var g = root.groups[i];
        if (g.id && g.name && g.channels && g.channels.length) {
          cats.push({ id: "g:" + g.id, name: g.name });
        }
      }
    }
    return JSON.stringify(cats);
  } catch (e) { log(TC_NAME + " getCategories loi: " + e); return JSON.stringify([{ id: "live", name: "🔴 Trực tiếp" }]); }
}

function tcCollect(root, groupId) {
  var items = [];
  var seen = {};
  var groups = (root && root.groups) || [];
  for (var i = 0; i < groups.length; i++) {
    var g = groups[i];
    if (g.groups) continue; // nhom long nhau (tournaments/related) — bo qua nhu ban VAX
    if (groupId && String(g.id) !== groupId) continue;
    var channels = g.channels || [];
    for (var j = 0; j < channels.length; j++) {
      var ch = channels[j];
      if (!ch.id || seen[ch.id]) continue;
      seen[ch.id] = true;
      items.push(tcChannelItem(ch, g.name));
    }
  }
  return items;
}

function getList(categoryId, page) {
  page = page || 1;
  try {
    var root = tcRoot();
    if (!root) return tcEmpty(page);
    var groupId = null;
    if (categoryId && categoryId.indexOf("g:") === 0) groupId = categoryId.substring(2);
    var items = tcCollect(root, groupId);
    return JSON.stringify({ items: items, page: 1, totalPages: 1 });
  } catch (e) { log(TC_NAME + " getList loi: " + e); return tcEmpty(page); }
}

function search(keyword, page) {
  page = page || 1;
  try {
    if (!keyword) return tcEmpty(page);
    var root = tcRoot();
    if (!root) return tcEmpty(page);
    var kw = String(keyword).toLowerCase();
    var all = tcCollect(root, null);
    var items = [];
    for (var i = 0; i < all.length; i++) {
      if ((all[i].title || "").toLowerCase().indexOf(kw) >= 0) items.push(all[i]);
    }
    return JSON.stringify({ items: items, page: 1, totalPages: 1 });
  } catch (e) { log(TC_NAME + " search loi: " + e); return tcEmpty(page); }
}

function tcEpisodesFromSources(sources) {
  var servers = [];
  for (var i = 0; i < (sources || []).length; i++) {
    var src = sources[i];
    var eps = [];
    var contents = src.contents || [];
    for (var c = 0; c < contents.length; c++) {
      var streams = contents[c].streams || [];
      for (var s = 0; s < streams.length; s++) {
        var st = streams[s];
        var links = st.stream_links || [];
        if (links.length) {
          for (var l = 0; l < links.length; l++) {
            if (links[l].url) {
              eps.push({
                name: st.name || links[l].name || "Link " + (eps.length + 1),
                url: links[l].url,
                embed: "",
                referer: TC_BASE + "/"
              });
            }
          }
        } else if (st.remote_data && st.remote_data.url) {
          // Endpoint stream tren cung host -> fetch tiep lay stream_links
          var sub = tcJson(st.remote_data.url);
          var slinks = (sub && sub.stream_links) || [];
          for (var k = 0; k < slinks.length; k++) {
            if (slinks[k].url) {
              eps.push({
                name: st.name || slinks[k].name || "Link " + (eps.length + 1),
                url: slinks[k].url,
                embed: "",
                referer: TC_BASE + "/"
              });
            }
          }
        }
      }
    }
    if (eps.length) servers.push({ name: src.name || "Live Source", episodes: eps });
  }
  return servers;
}

function getDetail(id) {
  try {
    var d = tcJson(TC_BASE + "/match/" + encodeURIComponent(id));
    if (!d) return JSON.stringify({});
    var servers = tcEpisodesFromSources(d.sources || []);
    // Du phong: ban than trang chu co san sources trong channel
    if (!servers.length) {
      var root = tcRoot();
      var groups = (root && root.groups) || [];
      for (var i = 0; i < groups.length && !servers.length; i++) {
        var channels = groups[i].channels || [];
        for (var j = 0; j < channels.length; j++) {
          if (String(channels[j].id) === String(id) && channels[j].sources) {
            servers = tcEpisodesFromSources(channels[j].sources);
            break;
          }
        }
      }
    }
    if (!servers.length) return JSON.stringify({});
    // Lay ten + anh tu trang chu (match response khong mang theo)
    var title = id, img = "", league = "";
    var root2 = tcRoot();
    var gs = (root2 && root2.groups) || [];
    for (var a = 0; a < gs.length; a++) {
      var chs = gs[a].channels || [];
      for (var b = 0; b < chs.length; b++) {
        if (String(chs[b].id) === String(id)) {
          title = chs[b].name || title;
          img = (chs[b].image && chs[b].image.url) || "";
          league = (chs[b].org_metadata && chs[b].org_metadata.league) || "";
          a = gs.length; break;
        }
      }
    }
    return JSON.stringify({
      id: String(id),
      title: title,
      origin_name: league,
      poster: img,
      thumb: img,
      year: 0,
      quality: "LIVE",
      lang: league || "Việt",
      episode_current: "Live",
      episode_total: "1",
      content: "Trực tiếp thể thao - " + TC_NAME + (league ? " | " + league : ""),
      type: "live",
      servers: servers
    });
  } catch (e) { log(TC_NAME + " getDetail loi: " + e); return JSON.stringify({}); }
}
