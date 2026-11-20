// Plugin NOVA films (NovaHD) cho app lai HQH — v1.0.0 (2026-11-20)
// Nguon: https://novahd.cc — API JSON cong khai:
//   - Thinh hanh:  GET /api/trending?type=all (trang 1; trang sau qua /api/movies)
//   - Phim le/bo:  GET /api/movies?page=&genre=  |  /api/shows?page=&genre=
//   - Tim kiem:    GET /api/search?search=&page=
//   - Chi tiet:    GET /api/movies/{tmdbId}  |  /api/shows/{tmdbId}
//     (id cua ITEM dang "movie/{tmdbId}" hoac "show/{tmdbId}")
//   - Link phat: moi tap chi la mot endpoint /api/sources?type=&tmdbId=
//     (&season=&episode= voi phim bo); goi endpoint do moi ra
//     sources[].url la link HLS truc tiep (uu tien 1080p/4k nhu ban goc).
//     Plugin giai link ngay trong getDetail vi hop dong yeu cau url
//     phat duoc. Phu de (/api/subs-status) bo qua — hop dong chua co
//     truong phu de.
// Host API: httpGet(url) -> string, log(msg). Moi ham tra ve CHUOI JSON (xem CONTRACT.md).

var NV_BASE = "https://novahd.cc";
var NV_POSTER = "https://image.tmdb.org/t/p/w500";
var NV_BACKDROP = "https://image.tmdb.org/t/p/w1280";

var NV_CATS = [
  { id: "trending", name: "Thịnh Hành (Trending)" },
  { id: "movies", name: "Phim Lẻ (Movies)" },
  { id: "shows", name: "Phim Bộ (TV Shows)" },
  { id: "movies?genre=Action", name: "Hành Động" },
  { id: "movies?genre=Adventure", name: "Phiêu Lưu" },
  { id: "movies?genre=Animation", name: "Hoạt Hình" },
  { id: "movies?genre=Comedy", name: "Hài Hước" },
  { id: "movies?genre=Crime", name: "Tội Phạm" },
  { id: "movies?genre=Drama", name: "Tâm Lý" },
  { id: "movies?genre=Fantasy", name: "Kỳ Ảo (Fantasy)" },
  { id: "movies?genre=Horror", name: "Kinh Dị" },
  { id: "movies?genre=Mystery", name: "Bí Ẩn" },
  { id: "movies?genre=Romance", name: "Lãng Mạn" },
  { id: "movies?genre=Science Fiction", name: "Khoa Học Viễn Tưởng" },
  { id: "movies?genre=Thriller", name: "Giật Gân / Thriller" },
  { id: "movies?genre=War", name: "Chiến Tranh" },
  { id: "shows?genre=Action%20%26%20Adventure", name: "Bộ: Hành Động & Phiêu Lưu" },
  { id: "shows?genre=Sci-Fi%20%26%20Fantasy", name: "Bộ: Viễn Tưởng & Kỳ Ảo" }
];

function nvJson(url) {
  var raw = httpGet(url);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch (e) { log("novahd parse loi: " + e); return null; }
}

function nvYearOf(item) {
  var s = item.releaseDate || item.firstAirDate || "";
  var y = parseInt(String(s).substring(0, 4), 10);
  return isNaN(y) ? 0 : y;
}

function nvItem(item) {
  var tmdbId = item.tmdbId || item.id;
  var isShow = (item.type === "show" || item.type === "tv" || item.firstAirDate != null || item.seasons != null);
  var poster = item.posterPath ? (NV_POSTER + item.posterPath) : "";
  var backdrop = item.backdropPath ? (NV_BACKDROP + item.backdropPath) : poster;
  return {
    id: (isShow ? "show/" : "movie/") + tmdbId,
    title: (item.title || item.name || "").replace(/^\s+|\s+$/g, ""),
    origin_name: item.originalTitle || item.originalName || "",
    poster: poster,
    thumb: backdrop,
    year: nvYearOf(item),
    quality: "FHD",
    lang: "",
    episode_current: "",
    episode_total: "",
    type: isShow ? "series" : "movie"
  };
}

function nvListResult(d, page, isTrending) {
  var items = [];
  var totalPages = 1;
  if (d) {
    var arr = [];
    if (d instanceof Array) arr = d;
    else if (d.results && d.results instanceof Array) arr = d.results;
    for (var i = 0; i < arr.length; i++) {
      if (!arr[i] || !(arr[i].tmdbId || arr[i].id)) continue;
      var it = nvItem(arr[i]);
      if (it.title) items.push(it);
    }
    if (d.totalPages) totalPages = parseInt(d.totalPages, 10) || 1;
    else if (isTrending) totalPages = 5;
  }
  return JSON.stringify({ items: items, page: page, totalPages: totalPages });
}

function nvEmpty(page) {
  return JSON.stringify({ items: [], page: page || 1, totalPages: 1 });
}

function getCategories() {
  return JSON.stringify(NV_CATS);
}

function getList(categoryId, page) {
  page = page || 1;
  try {
    var path = categoryId || "trending";
    var url;
    var isTrending = false;
    if (path === "trending") {
      if (page > 1) {
        url = NV_BASE + "/api/movies?page=" + page;
      } else {
        url = NV_BASE + "/api/trending?type=all";
        isTrending = true;
      }
    } else {
      var endpoint = path.indexOf("shows") !== -1 ? "/api/shows" : "/api/movies";
      var genreParam = "";
      if (path.indexOf("genre=") !== -1) {
        var rawGenre = path.substring(path.indexOf("genre=") + 6);
        if (rawGenre.indexOf("&") !== -1) rawGenre = rawGenre.substring(0, rawGenre.indexOf("&"));
        try { rawGenre = decodeURIComponent(rawGenre); } catch (e) {}
        genreParam = "&genre=" + encodeURIComponent(rawGenre);
      }
      url = NV_BASE + endpoint + "?page=" + page + genreParam;
    }
    var d = nvJson(url);
    if (!d) return nvEmpty(page);
    return nvListResult(d, page, isTrending);
  } catch (e) { log("novahd getList loi: " + e); return nvEmpty(page); }
}

// Goi /api/sources -> chon url phat truc tiep (uu tien 1080p/4k nhu ban goc).
function nvResolve(sourcesUrl) {
  var d = nvJson(sourcesUrl);
  if (!d || !(d.sources instanceof Array) || d.sources.length === 0) return "";
  var first = d.sources[0].url || "";
  for (var i = 0; i < d.sources.length; i++) {
    var q = d.sources[i].quality || "";
    if (q === "1080p" || q === "4k") return d.sources[i].url || first;
  }
  return first;
}

function getDetail(id) {
  try {
    var isShow = id.indexOf("show/") === 0;
    var tmdbId = id.replace("show/", "").replace("movie/", "").replace(/[^\d]/g, "");
    if (!tmdbId) return JSON.stringify({});
    var d = nvJson(NV_BASE + (isShow ? "/api/shows/" : "/api/movies/") + tmdbId);
    if (!d) return JSON.stringify({});
    isShow = isShow || d.seasons != null || d.firstAirDate != null;
    var realId = d.tmdbId || d.id || tmdbId;

    var servers = [];
    if (isShow && d.seasons instanceof Array && d.seasons.length > 0) {
      for (var s = 0; s < d.seasons.length; s++) {
        var season = d.seasons[s];
        if (!season) continue;
        var sNum = season.seasonNumber != null ? season.seasonNumber : (s + 1);
        var list = [];
        var eps = (season.episodes instanceof Array && season.episodes.length > 0) ? season.episodes : null;
        var count = eps ? eps.length : (season.episodeCount || 0);
        for (var e = 0; e < count; e++) {
          var epNum = eps && eps[e] && eps[e].episodeNumber != null ? eps[e].episodeNumber : (e + 1);
          var epTitle = eps && eps[e] && eps[e].title ? ("Tập " + epNum + ": " + eps[e].title) : ("Tập " + epNum);
          var url = nvResolve(NV_BASE + "/api/sources?type=show&tmdbId=" + realId + "&season=" + sNum + "&episode=" + epNum);
          if (!url) continue;
          list.push({ name: epTitle, url: url, embed: "" });
        }
        if (list.length > 0) {
          servers.push({ name: "Mùa " + sNum + (season.name ? (" - " + season.name) : ""), episodes: list });
        }
      }
    }
    if (servers.length === 0 && !isShow) {
      var movieUrl = nvResolve(NV_BASE + "/api/sources?type=movie&tmdbId=" + realId);
      if (movieUrl) {
        servers.push({ name: "NovaHD (HLS)", episodes: [{ name: "Full", url: movieUrl, embed: "" }] });
      }
    }
    if (servers.length === 0) return JSON.stringify({});

    var poster = d.posterPath ? (NV_POSTER + d.posterPath) : "";
    var backdrop = d.backdropPath ? (NV_BACKDROP + d.backdropPath) : poster;
    return JSON.stringify({
      id: (isShow ? "show/" : "movie/") + realId,
      title: (d.title || d.name || "").replace(/^\s+|\s+$/g, ""),
      origin_name: d.originalTitle || d.originalName || "",
      poster: poster,
      thumb: backdrop,
      year: nvYearOf(d),
      quality: "FHD",
      lang: "",
      episode_current: "",
      episode_total: "",
      content: d.overview || "",
      type: isShow ? "series" : "movie",
      servers: servers
    });
  } catch (e) { log("novahd getDetail loi: " + e); return JSON.stringify({}); }
}

function search(keyword, page) {
  page = page || 1;
  try {
    var url = NV_BASE + "/api/search?search=" + encodeURIComponent(keyword || "") + "&page=" + page;
    var d = nvJson(url);
    if (!d) return nvEmpty(page);
    return nvListResult(d, page, false);
  } catch (e) { log("novahd search loi: " + e); return nvEmpty(page); }
}
