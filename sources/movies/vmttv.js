// Plugin VMT TV cho app lai HQH — v1.0.0
// Goc: plugin "VMT TV" v1.0.2 trong he sinh thai VAX Player
// (repo plugin cua Tuangayxx/youngbi), chuyen sang hop dong HQH.
// Site dich: playlist M3U cong khai cua vuminhthanh12 tren GitHub:
//   https://raw.githubusercontent.com/vuminhthanh12/vuminhthanh12/refs/heads/main/vmttv
// Co che: tai file M3U, tach #EXTINF (group-title = muc, tvg-logo = anh,
// dong URL ngay sau = link phat truc tiep cua kenh). Day la nguon
// TRUYEN HINH truc tiep (kenh TV + su kien the thao), khong phai phim bo/le:
// moi "phim" trong danh sach la 1 kenh, chi tiet co 1 tap duy nhat = link
// stream cua kenh (m3u8/mp4 truc tiep, khong can giai ma).
// Da kiem chung truc tiep 21/11/2026 tu VM: file M3U tra HTTP 200,
// 526 kenh; link kenh mau (TVB Vietnam, amagi.tv) tra playlist m3u8 that.
// Chu y: mot so kenh trong M3U gan kem http-user-agent rieng (#EXTVLCOPT) —
// hop dong plugin khong co cho truyen UA rieng theo tung tap nen bo qua;
// phan lon kenh phat tot voi UA mac dinh cua app.
// Host API: httpGet(url) -> string, log(msg). Moi ham tra ve CHUOI JSON (xem CONTRACT.md).
// ES5 (Rhino): var, khong arrow function, khong template literal.

var VM_M3U = "https://raw.githubusercontent.com/vuminhthanh12/vuminhthanh12/refs/heads/main/vmttv";
var VM_PER_PAGE = 100;

var VM_CATS = [
  { id: "all", name: "Tất cả kênh" },
  { id: "g:Sự Kiện", name: "Sự Kiện" },
  { id: "g:THỂ THAO QUỐC TẾ", name: "Thể thao quốc tế" },
  { id: "g:TVB", name: "TVB" },
  { id: "g:LIVE EVENTS 🔴", name: "LIVE EVENTS" },
  { id: "g:Sự Kiện TV360", name: "Sự Kiện TV360" },
  { id: "g:Sự Kiện VTVPrime", name: "Sự Kiện VTVPrime" },
  { id: "g:Rạp Phim", name: "Rạp Phim" },
  { id: "g:VTV", name: "VTV" },
  { id: "g:VTVcab", name: "VTVcab" },
  { id: "g:SCTV", name: "SCTV" },
  { id: "g:HTV", name: "HTV" },
  { id: "g:HTVC", name: "HTVC" },
  { id: "g:Địa phương", name: "Địa phương" },
  { id: "g:Quốc Tế", name: "Quốc Tế" },
  { id: "g:Radio", name: "Radio" }
];

function vmEmpty(page) {
  return JSON.stringify({ items: [], page: page || 1, totalPages: 1 });
}

function vmFetchChannels() {
  var text = httpGet(VM_M3U);
  if (!text) return [];
  text = String(text);
  var lines = text.split("\n");
  var channels = [];
  var cur = null;
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i].replace(/^\s+|\s+$/g, "");
    if (line.indexOf("#EXTINF:") === 0) {
      var gm = line.match(/group-title="([^"]*)"/);
      var lm = line.match(/tvg-logo="([^"]*)"/);
      var tm = line.match(/tvg-id="([^"]*)"/);
      var comma = line.lastIndexOf(",");
      var name = comma >= 0 ? line.substring(comma + 1).replace(/^\s+|\s+$/g, "") : "";
      cur = {
        group: gm ? gm[1] : "",
        logo: lm ? lm[1] : "",
        tvgId: tm ? tm[1] : "",
        name: name,
        index: channels.length
      };
    } else if (line.indexOf("#") === 0) {
      // bo qua directive (#EXTVLCOPT, #KODIPROP...)
    } else if (line.length > 0 && (line.indexOf("http") === 0 || line.indexOf("//") === 0)) {
      if (cur) {
        cur.url = line.indexOf("//") === 0 ? "https:" + line : line;
        channels.push(cur);
        cur = null;
      }
    }
  }
  return channels;
}

function vmChannelId(ch) {
  if (ch.tvgId) return ch.tvgId;
  return "idx::" + ch.index;
}

function vmToItem(ch) {
  return {
    id: vmChannelId(ch),
    title: ch.name || "",
    origin_name: "",
    poster: ch.logo || "",
    thumb: ch.logo || "",
    year: 0,
    quality: "LIVE",
    lang: ch.group || "",
    episode_current: ch.group || "Live",
    type: "live"
  };
}

function vmPageResult(all, page) {
  var totalPages = Math.max(1, Math.ceil(all.length / VM_PER_PAGE));
  if (page > totalPages) page = totalPages;
  var start = (page - 1) * VM_PER_PAGE;
  var items = [];
  for (var i = start; i < all.length && i < start + VM_PER_PAGE; i++) items.push(vmToItem(all[i]));
  return JSON.stringify({ items: items, page: page, totalPages: totalPages });
}

function getCategories() {
  return JSON.stringify(VM_CATS);
}

function getList(categoryId, page) {
  page = page || 1;
  try {
    var channels = vmFetchChannels();
    if (!channels.length) return vmEmpty(page);
    var filtered = channels;
    if (categoryId && categoryId.indexOf("g:") === 0) {
      var gname = categoryId.substring(2);
      filtered = [];
      for (var i = 0; i < channels.length; i++) {
        if (channels[i].group === gname) filtered.push(channels[i]);
      }
    }
    return vmPageResult(filtered, page);
  } catch (e) { log("vmttv getList loi: " + e); return vmEmpty(page); }
}

function getDetail(id) {
  try {
    var channels = vmFetchChannels();
    var found = null;
    for (var i = 0; i < channels.length; i++) {
      if (vmChannelId(channels[i]) === id) { found = channels[i]; break; }
    }
    if (!found && id.indexOf("idx::") === 0) {
      var idx = parseInt(id.substring(5), 10);
      if (!isNaN(idx)) {
        for (var j = 0; j < channels.length; j++) {
          if (channels[j].index === idx) { found = channels[j]; break; }
        }
      }
    }
    if (!found) return JSON.stringify({});
    return JSON.stringify({
      id: vmChannelId(found),
      title: found.name || "",
      origin_name: "",
      poster: found.logo || "",
      thumb: found.logo || "",
      year: 0,
      quality: "LIVE",
      lang: found.group || "",
      episode_current: "Live",
      episode_total: "1",
      content: "Kênh: " + (found.name || "") + (found.group ? " | Nhóm: " + found.group : ""),
      type: "live",
      servers: [{
        name: found.group || "Live",
        episodes: [{ name: found.name || "Live", url: found.url, embed: "" }]
      }]
    });
  } catch (e) { log("vmttv getDetail loi: " + e); return JSON.stringify({}); }
}

function search(keyword, page) {
  page = page || 1;
  try {
    if (!keyword) return vmEmpty(page);
    var kw = String(keyword).toLowerCase();
    var channels = vmFetchChannels();
    var filtered = [];
    for (var i = 0; i < channels.length; i++) {
      if ((channels[i].name || "").toLowerCase().indexOf(kw) >= 0) filtered.push(channels[i]);
    }
    return vmPageResult(filtered, page);
  } catch (e) { log("vmttv search loi: " + e); return vmEmpty(page); }
}
