// Plugin shortflix cho app lai HQH — v1.0.0
// Nguon: https://www.shortflix.net — API JSON ngay tren domain chinh — viet 2026-11-20
// Chep co che cua plugin SuperOK (shortflix), viet lai theo hop dong hqh-sources:
//   - Danh sach / tim kiem: GET /api/search?limit=100&language=vi_VN&lang=vi_VN
//                 kem &sortBy= / &genre= / &q= ; API phan trang bang cursor
//                 (truong nextCursor / hasMore) — plugin luu cursor theo tung
//                 muc + so trang de host goi getList(categoryId, page) nhu thuong.
//   - Chi tiet:   GET /api/videos/<slug>?language=vi_VN&lang=vi_VN
//   - Link phat:  CHI giu server HLS truc tiep — episodes[].versions[] chon ban
//                 lang=vi_VN (khong co thi ban dau tien) co videoUrl (.m3u8);
//                 bo han hau to "#sub=..." (app khong dung duoc) va BO TOAN BO
//                 server "Web Player" (phat qua WebView, app khong co).
// Host API: httpGet(url) -> string, log(msg). Moi ham tra ve CHUOI JSON (xem CONTRACT.md).

var SF_BASE = "https://www.shortflix.net";
var SF_API = SF_BASE + "/api/search?limit=100&language=vi_VN&lang=vi_VN";
var SF_CURSORS = {};

var SF_GENRES = [
  ["&q=l%E1%BB%93ng+ti%E1%BA%BFng", "Lồng Tiếng"],
  ["&genre=tong-tai", "Tổng tài"],
  ["&genre=co-dai", "Cổ đại"],
  ["&genre=tam-ly", "Tâm lý"],
  ["&genre=ngon-tinh", "Ngôn tình"],
  ["&genre=hai-huoc", "Hài hước"],
  ["&genre=nu-cuong", "Nữ cường"],
  ["&genre=huyen-huyen", "Huyền huyễn"],
  ["&genre=toi-pham", "Tội phạm"],
  ["&genre=xuyen-khong", "Xuyên không"],
  ["&genre=thanh-xuan", "Thanh xuân"],
  ["&genre=hanh-dong", "Hành động"],
  ["&genre=kinh-di", "Kinh dị"],
  ["&genre=gia-dinh", "Gia Đình"],
  ["&genre=bi-an", "Bí ẩn"],
  ["&genre=dan-quoc", "Dân quốc"],
  ["&genre=trong-sinh", "Trọng sinh"],
  ["&genre=cuoi-truoc-yeu-sau", "Cưới trước yêu sau"],
  ["&genre=khoa-hoc-vien-tuong", "Khoa học viễn tưởng"],
  ["&genre=hanh-dong-ly-ky", "Hành động ly kỳ"],
  ["&genre=hien-dai", "Hiện đại"],
  ["&genre=bao-thu", "Báo thù"],
  ["&genre=the-thao", "Thể thao"],
  ["&genre=em-be", "Em bé"],
  ["&genre=nguoc-luyen", "Ngược luyến"],
  ["&genre=sung-ngot", "Sủng ngọt"],
  ["&genre=hieu-lam", "Hiểu lầm"],
  ["&genre=khac", "Khác"],
  ["&genre=hao-mon", "Hào môn"],
  ["&genre=tim-nguoi-than", "Tìm người thân"],
  ["&genre=quan-phiet", "Quân phiệt"],
  ["&genre=vuon-len-tu-so-khong", "Vươn lên từ số không"],
  ["&genre=tai-hop", "Tái hợp"],
  ["&genre=su-tro-lai", "Sự trở lại"],
  ["&genre=tam-ly-tinh-cam", "Tâm lý tình cảm"],
  ["&genre=truong-thanh", "Trưởng thành"]
];

function sfJson(url) {
  var raw = httpGet(url);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch (e) { log("shortflix parse loi: " + e); return null; }
}

function sfYear(createdAt) {
  if (!createdAt || typeof createdAt !== "string") return 0;
  var y = parseInt(createdAt.substring(0, 4), 10);
  return isNaN(y) ? 0 : y;
}

function sfItem(m) {
  var thumb = (m.thumbnailUrl || "").replace(/&amp;/g, "&");
  return {
    id: m.slug || m.id || "",
    title: (m.title || "").replace(/^\s+|\s+$/g, ""),
    origin_name: "",
    poster: thumb,
    thumb: thumb,
    year: sfYear(m.createdAt),
    quality: "HD",
    lang: "",
    episode_current: m.status ? String(m.status).replace("PUBLISHED", "Hoàn Thành") : "",
    episode_total: "",
    type: ""
  };
}

// Lay mot trang danh sach: API dung cursor nen trang N chi mo duoc khi da
// biet cursor cua no (cursor do trang N-1 tra ve). Thieu thi di lai tu trang
// truoc (moi buoc mot httpGet), dung nhu ban SuperOK lam voi CURSOR_CACHE.
function sfFetch(key, path, page) {
  if (page > 100) return null;
  var cursor = "";
  if (page > 1) {
    cursor = SF_CURSORS[key + "|" + page] || "";
    if (!cursor) {
      if (!sfFetch(key, path, page - 1)) return null;
      cursor = SF_CURSORS[key + "|" + page] || "";
      if (!cursor) return null;
    }
  }
  var url = SF_API + path + (cursor ? "&cursor=" + encodeURIComponent(cursor) : "");
  var d = sfJson(url);
  if (d && d.nextCursor) SF_CURSORS[key + "|" + (page + 1)] = d.nextCursor;
  return d;
}

function sfListResult(d, page) {
  var items = [];
  if (d && d.items) {
    for (var i = 0; i < d.items.length; i++) {
      if (d.items[i]) items.push(sfItem(d.items[i]));
    }
  }
  var more = d && (d.hasMore || d.nextCursor);
  return JSON.stringify({ items: items, page: page, totalPages: more ? page + 1 : page });
}

function sfEmpty(page) {
  return JSON.stringify({ items: [], page: page || 1, totalPages: 1 });
}

function getCategories() {
  var cats = [{ id: "&sortBy=last_episode_at", name: "Phim Mới Cập Nhật" }];
  var seen = {};
  seen["&genre=tong-tai"] = true;
  seen["&genre=co-dai"] = true;
  seen["&genre=ngon-tinh"] = true;
  cats.push({ id: "&genre=tong-tai", name: "Phim Tổng Tài" });
  cats.push({ id: "&genre=co-dai", name: "Phim Cổ Đại" });
  cats.push({ id: "&genre=ngon-tinh", name: "Phim Ngôn Tình" });
  for (var i = 0; i < SF_GENRES.length; i++) {
    if (seen[SF_GENRES[i][0]]) continue;
    seen[SF_GENRES[i][0]] = true;
    cats.push({ id: SF_GENRES[i][0], name: SF_GENRES[i][1] });
  }
  return JSON.stringify(cats);
}

function getList(categoryId, page) {
  page = page || 1;
  try {
    var path = categoryId || "&sortBy=last_episode_at";
    var d = sfFetch("list:" + path, path, page);
    if (!d) return sfEmpty(page);
    return sfListResult(d, page);
  } catch (e) { log("shortflix getList loi: " + e); return sfEmpty(page); }
}

function sfCleanSlug(id) {
  if (!id) return "";
  var s = String(id);
  var p = s.indexOf("/videos/");
  if (p >= 0) s = s.substring(p + 8);
  s = s.split("?")[0].split("#")[0];
  return s.replace(/^\/+|\/+$/g, "");
}

function getDetail(id) {
  try {
    var slug = sfCleanSlug(id);
    if (!slug) return JSON.stringify({});
    var d = sfJson(SF_BASE + "/api/videos/" + encodeURIComponent(slug) + "?language=vi_VN&lang=vi_VN");
    if (!d || !d.episodes) return JSON.stringify({});
    var episodes = [];
    var quality = "HD";
    for (var i = 0; i < d.episodes.length; i++) {
      var ep = d.episodes[i];
      if (!ep || !ep.versions) continue;
      var chosen = null;
      for (var v = 0; v < ep.versions.length; v++) {
        if (ep.versions[v] && ep.versions[v].lang === "vi_VN" && ep.versions[v].videoUrl) {
          chosen = ep.versions[v];
          break;
        }
      }
      if (!chosen) {
        for (var w = 0; w < ep.versions.length; w++) {
          if (ep.versions[w] && ep.versions[w].videoUrl) { chosen = ep.versions[w]; break; }
        }
      }
      if (!chosen) continue;
      var url = String(chosen.videoUrl).split("#")[0];
      if (!url) continue;
      if (chosen.quality) quality = chosen.quality;
      episodes.push({
        name: "Tập " + (ep.episodeNumber || (i + 1)),
        url: url,
        embed: ""
      });
    }
    if (episodes.length === 0) return JSON.stringify({});
    var thumb = d.thumbnailUrl || "";
    return JSON.stringify({
      id: d.slug || slug,
      title: d.title || (d.translate && d.translate.title) || "",
      origin_name: "",
      poster: thumb,
      thumb: thumb,
      year: d.year || sfYear(d.createdAt),
      quality: quality,
      lang: "Vietsub",
      episode_current: "Full " + episodes.length + " Tập",
      episode_total: String(episodes.length),
      content: d.description || (d.translate && d.translate.description) || "",
      type: episodes.length > 1 ? "series" : "movie",
      servers: [{ name: "HLS Direct", episodes: episodes }]
    });
  } catch (e) { log("shortflix getDetail loi: " + e); return JSON.stringify({}); }
}

function search(keyword, page) {
  page = page || 1;
  try {
    var path = "&q=" + encodeURIComponent(keyword || "");
    var d = sfFetch("search:" + (keyword || ""), path, page);
    if (!d) return sfEmpty(page);
    return sfListResult(d, page);
  } catch (e) { log("shortflix search loi: " + e); return sfEmpty(page); }
}
