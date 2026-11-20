// Plugin Onflix cho app lai HQH — v1.0.0
// Nguon: https://onflix.lat — API: https://k8s.onflixcdn.com/api — viet 2026-11-20
// Chep co che cua plugin SuperOK (onflix), viet lai theo hop dong hqh-sources:
//   - Danh sach:  GET k8s.onflixcdn.com/api/movies?sort=...&category=... | /themes/<slug>
//                 (API tra {data:[...], pagination:{current_page,total_pages}})
//   - Tim kiem:   GET k8s.onflixcdn.com/api/search?q=<kw>&page= (tra {movies:[...]})
//   - Chi tiet:   GET onflix.lat/phim/<slug> — trang Next.js, du lieu phim + tap nam
//                 trong cac khoi self.__next_f.push(...) (RSC); plugin boc tach
//                 object "movie" va mang "episodes" roi ghep server theo server_name.
//   - Link phat:  CHI giu tap co link_m3u8 truc tiep (.m3u8/.mp4). Tap nao
//                 link_m3u8 la link boc ss.onflixstream.site/playlist?url=<goc>
//                 thi giai param url= va GET thu playlist goc: dung dang #EXTM3U
//                 moi giu, khong thi bo tap. Khong dung link_embed (trang phat WebView).
// Host API: httpGet(url) -> string, log(msg). Moi ham tra ve CHUOI JSON (xem CONTRACT.md).

var OF_BASE = "https://onflix.lat";
var OF_API = "https://k8s.onflixcdn.com/api";

var OF_THEMES = [
  ["de-xuat-cho-ban", "Đề Xuất"],
  ["dang-chieu-phat", "Đang Chiếu"],
  ["phim-chat-luong-cao-va-phu-de-song-ngu", "Song Ngữ"],
  ["hoat-hinh-chon-loc", "Hoạt hình"],
  ["phieu-luu-mao-hiem", "Phiêu Lưu"],
  ["phim-truyen-hinh-trung-quoc-dai-luc", "Phim Trung Quốc"],
  ["tinh-yeu-la-nhung-gi-trai-tim-muon", "Tình Yêu"],
  ["phim-han-quoc", "Hàn Quốc"],
  ["thanh-xuan", "Thanh xuân"],
  ["phim-chua-lanh-tam-hon", "Phim Chữa Lành"],
  ["phim-chuyen-the-tu-tac-pham-van-hoc", "Phim Chuyển Thể"],
  ["phim-cong-so", "Phim Công Sở"],
  ["hinh-su-toi-pham-han-quoc", "Hình Sự"],
  ["dien-anh-au-my", "Âu Mỹ"]
];

var OF_GENRES = [
  ["kinh-di", "Kinh Dị"],
  ["co-trang", "Cổ Trang"],
  ["18-plus", "Phim 18+"],
  ["action-&-adventure", "Action & Adventure"],
  ["am-nhac", "Âm Nhạc"],
  ["bi-an", "Bí Ẩn"],
  ["chien-tranh", "Chiến Tranh"],
  ["chinh-kich", "Chính Kịch"],
  ["chuong-trinh-truyen-hinh", "Chương Trình Truyền Hình"],
  ["chuyen-the", "Chuyển Thể"],
  ["dang-cap-nhat", "Đang cập nhật"],
  ["gay-can", "Gây Cấn"],
  ["gia-dinh", "Gia Đình"],
  ["gia-tuong", "Giả Tưởng"],
  ["hai-huoc", "Hài Hước"],
  ["hanh-dong", "Hành Động"],
  ["hinh-su", "Hình Sự"],
  ["hoat-hinh", "Hoạt Hình"],
  ["hoc-duong", "Học Đường"],
  ["huyen-huyen", "Huyền Huyễn"],
  ["khoa-hoc", "Khoa Học"],
  ["kinh-dien", "Kinh Điển"],
  ["lang-man", "Lãng Mạn"],
  ["lgbt", "LGBT"],
  ["lich-su", "Lịch Sử"],
  ["mien-tay", "Miền Tây"],
  ["phieu-luu", "Phiêu Lưu"],
  ["hai", "Phim Hài"],
  ["ngan", "Phim Ngắn"],
  ["nhac", "Phim Nhạc"],
  ["sci-fi-&-fantasy", "Sci-Fi & Fantasy"],
  ["short-drama", "Short Drama"],
  ["sitcom", "Sitcom"],
  ["soap", "Soap"],
  ["tai-lieu", "Tài Liệu"],
  ["talk", "Talk"],
  ["tam-ly", "Tâm Lý"],
  ["than-thoai", "Thần Thoại"],
  ["than-tuong", "Thần Tượng"],
  ["thanh-xuan", "Thanh Xuân"],
  ["the-thao", "Thể Thao"],
  ["thuong-truong", "Thương Trường"],
  ["tien-hiep", "Tiên Hiệp"],
  ["tinh-cam", "Tình Cảm"],
  ["tinh-tiet", "Tình Tiết"],
  ["tinh-yeu-ngot-ngao", "Tình Yêu Ngọt Ngào"],
  ["toi-pham", "Tội Phạm"],
  ["tre-em", "Trẻ Em"],
  ["vien-tuong", "Viễn Tưởng"],
  ["vo-thuat", "Võ Thuật"]
];

function ofJson(url) {
  var raw = httpGet(url);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch (e) { log("onflix parse loi: " + e); return null; }
}

function ofYear(value) {
  if (typeof value === "number") return value;
  var y = parseInt(value, 10);
  return isNaN(y) ? 0 : y;
}

function ofItem(b) {
  var poster = b.poster_url || "";
  return {
    id: b.slug || "",
    title: (b.title || b.name || "").replace(/^\s+|\s+$/g, ""),
    origin_name: b.original_title || b.origin_name || b.original_name || "",
    poster: poster,
    thumb: b.thumb_url || poster,
    year: ofYear(b.year),
    quality: b.quality || "",
    lang: b.lang || "",
    episode_current: b.episode_current || "",
    episode_total: b.episode_total ? String(b.episode_total) : "",
    type: b.type || ""
  };
}

function ofListResult(d, page) {
  var items = [];
  var arr = [];
  if (d) {
    if (Object.prototype.toString.call(d) === "[object Array]") arr = d;
    else if (d.movies) arr = d.movies;
    else if (d.data && Object.prototype.toString.call(d.data) === "[object Array]") arr = d.data;
    else if (d.data && d.data.items) arr = d.data.items;
  }
  for (var i = 0; i < arr.length; i++) {
    if (arr[i]) items.push(ofItem(arr[i]));
  }
  var totalPages = 1;
  if (d && d.pagination) {
    totalPages = parseInt(d.pagination.total_pages || d.pagination.totalPages, 10) || 1;
  } else if (items.length >= 24) {
    totalPages = page + 1;
  } else {
    totalPages = page;
  }
  return JSON.stringify({ items: items, page: page, totalPages: totalPages });
}

function ofEmpty(page) {
  return JSON.stringify({ items: [], page: page || 1, totalPages: 1 });
}

function getCategories() {
  var cats = [{ id: "new", name: "Phim Mới" }];
  var i;
  for (i = 0; i < OF_THEMES.length; i++) {
    cats.push({ id: "theme:" + OF_THEMES[i][0], name: OF_THEMES[i][1] });
  }
  for (i = 0; i < OF_GENRES.length; i++) {
    cats.push({ id: "genre:" + OF_GENRES[i][0], name: OF_GENRES[i][1] });
  }
  return JSON.stringify(cats);
}

function ofListPath(categoryId) {
  if (!categoryId || categoryId === "new") return "/movies?sort=newest&limit=24";
  if (categoryId.indexOf("theme:") === 0) return "/themes/" + categoryId.substring(6);
  if (categoryId.indexOf("genre:") === 0) {
    return "/movies?sort=year_desc&limit=24&category=" + encodeURIComponent(categoryId.substring(6));
  }
  if (categoryId.indexOf("/") === 0) return categoryId;
  return "/movies?sort=newest&limit=24";
}

function getList(categoryId, page) {
  page = page || 1;
  try {
    var path = ofListPath(categoryId);
    var url = OF_API + path + (path.indexOf("?") >= 0 ? "&" : "?") + "page=" + page;
    var d = ofJson(url);
    if (!d) return ofEmpty(page);
    return ofListResult(d, page);
  } catch (e) { log("onflix getList loi: " + e); return ofEmpty(page); }
}

function search(keyword, page) {
  page = page || 1;
  try {
    var url = OF_API + "/search?q=" + encodeURIComponent(keyword || "") + "&page=" + page;
    var d = ofJson(url);
    if (!d) return ofEmpty(page);
    return ofListResult(d, page);
  } catch (e) { log("onflix search loi: " + e); return ofEmpty(page); }
}

// --- Chi tiet: boc tach du lieu RSC trong trang phim ---

// Gop noi dung cac khoi self.__next_f.push([1,"..."]) thanh mot van ban.
function ofRscText(html) {
  var parts = [];
  var re = /self\.__next_f\.push\(\[1,("(?:[^"\\]|\\.)*")\]\)/g;
  var m;
  while ((m = re.exec(html)) !== null) {
    try { parts.push(JSON.parse(m[1])); } catch (e) { /* bo qua khoi hong */ }
  }
  return parts.join("\n");
}

// Cat dung mot khoi JSON can bang ngoac bat dau tai vi tri start (ky tu { hoac [).
function ofExtract(text, start) {
  var open = text.charAt(start);
  var close = open === "{" ? "}" : "]";
  var depth = 0;
  var inStr = false;
  var esc = false;
  for (var i = start; i < text.length; i++) {
    var c = text.charAt(i);
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === '"') inStr = false;
    } else {
      if (c === '"') inStr = true;
      else if (c === open) depth++;
      else if (c === close) {
        depth--;
        if (depth === 0) return text.substring(start, i + 1);
      }
    }
  }
  return "";
}

function ofParseAt(text, start) {
  var raw = ofExtract(text, start);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch (e) { return null; }
}

function ofRenameServer(name) {
  if (!name) return "Server";
  if (name.indexOf("PA") >= 0) return name.replace("PA", "KK Phim");
  if (name.indexOf("OP") >= 0) return name.replace("OP", "Ổ Phim");
  if (name.indexOf("NC") >= 0) return name.replace("NC", "Nguồn C");
  return name;
}

// Giai link boc ss.onflixstream.site/playlist?url=<goc>: GET playlist goc,
// chi chap nhan khi noi dung dung la playlist HLS.
function ofUnwrap(url) {
  var i = url.indexOf("url=");
  if (i < 0) return "";
  var raw = url.substring(i + 4);
  var amp = raw.indexOf("&");
  if (amp >= 0) raw = raw.substring(0, amp);
  var origin = raw;
  try { origin = decodeURIComponent(raw); } catch (e) { /* giu nguyen raw */ }
  if (!origin || origin.indexOf("http") !== 0) return "";
  var body = httpGet(origin);
  if (body && body.indexOf("#EXTM3U") >= 0) return origin;
  return "";
}

function getDetail(id) {
  try {
    var slug = String(id || "");
    var p = slug.indexOf("/phim/");
    if (p >= 0) slug = slug.substring(p + 6);
    slug = slug.split("?")[0].split("#")[0].replace(/^\/+|\/+$/g, "");
    if (!slug) return JSON.stringify({});
    var html = httpGet(OF_BASE + "/phim/" + encodeURIComponent(slug));
    if (!html) return JSON.stringify({});
    var text = ofRscText(html);
    if (!text) return JSON.stringify({});

    var movie = null;
    var mi = text.indexOf('"movie":{');
    if (mi >= 0) movie = ofParseAt(text, mi + 8);
    if (!movie) return JSON.stringify({});

    // Gop moi mang "episodes" tim thay (movie o mot khoi, link tap o khoi khac).
    var rawEps = [];
    var seen = {};
    var from = 0;
    while (true) {
      var ei = text.indexOf('"episodes":[', from);
      if (ei < 0) break;
      var arr = ofParseAt(text, ei + 11);
      from = ei + 12;
      if (!arr) continue;
      for (var j = 0; j < arr.length; j++) {
        var ep = arr[j];
        if (!ep || (!ep.link_m3u8 && !ep.link_embed)) continue;
        var key = (ep.server_name || "") + "|" + (ep.slug || "") + "|" + (ep.link_m3u8 || "");
        if (seen[key]) continue;
        seen[key] = true;
        rawEps.push(ep);
      }
    }

    var servers = [];
    var serverIndex = {};
    for (var k = 0; k < rawEps.length; k++) {
      var e = rawEps[k];
      var lm = e.link_m3u8 || "";
      var url = "";
      if (lm.indexOf("ss.onflixstream.site/playlist?url") >= 0) {
        url = ofUnwrap(lm);
      } else if (lm.indexOf(".m3u8") >= 0 || lm.indexOf(".mp4") >= 0) {
        url = lm;
      }
      if (!url) continue;
      var sName = ofRenameServer(e.server_name || "Server");
      var sPos = serverIndex[sName];
      if (sPos === undefined) {
        sPos = servers.length;
        serverIndex[sName] = sPos;
        servers.push({ name: sName, episodes: [] });
      }
      servers[sPos].episodes.push({
        name: "Tập " + (e.slug || e.name || (servers[sPos].episodes.length + 1)),
        url: url,
        embed: e.link_embed || ""
      });
    }
    if (servers.length === 0) return JSON.stringify({});

    var poster = movie.poster_url || "";
    return JSON.stringify({
      id: movie.slug || slug,
      title: movie.title || "",
      origin_name: movie.original_title || movie.origin_name || movie.original_name || "",
      poster: poster,
      thumb: movie.thumb_url || poster,
      year: ofYear(movie.year),
      quality: movie.quality || "",
      lang: movie.lang || "",
      episode_current: movie.episode_current || "",
      episode_total: movie.episode_total ? String(movie.episode_total) : "",
      content: movie.content || "",
      type: movie.type || "",
      servers: servers
    });
  } catch (e) { log("onflix getDetail loi: " + e); return JSON.stringify({}); }
}
