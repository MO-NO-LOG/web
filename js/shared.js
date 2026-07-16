(function () {
  const API = "https://api.mono-log.fun";
  const API_HOST = new URL(API).hostname;
  const CDN_HOST = "cdn.mono-log.fun";
  const CDN_BASE = "https://cdn.mono-log.fun/profile_images/";
  const DEFAULT_IMG = "images/default-user.png";

  let csrfTokenCache = null;

  window.GENRE_KEYWORDS = new Set([
    "액션",
    "코미디",
    "드라마",
    "sf",
    "스릴러",
    "공포",
    "로맨스",
    "애니메이션",
    "판타지",
    "미스터리",
    "범죄",
    "모험",
    "다큐멘터리",
    "전쟁",
    "뮤지컬",
  ]);

  window.escapeHtml = function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  };

  window.readCookie = function readCookie(name) {
    var escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    var match = document.cookie.match(
      new RegExp("(?:^|; )" + escaped + "=([^;]*)"),
    );
    return match ? decodeURIComponent(match[1]) : "";
  };

  window.formatDate = function formatDate(value) {
    if (!value) return "-";
    var d = new Date(value);
    if (Number.isNaN(d.getTime())) return "-";
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, "0");
    var day = String(d.getDate()).padStart(2, "0");
    return y + "." + m + "." + day;
  };

  window.resolveProfileImage = function resolveProfileImage(src) {
    var value = typeof src === "string" ? src.trim() : "";
    if (!value) return DEFAULT_IMG;
    if (
      value === DEFAULT_IMG ||
      value === "/" + DEFAULT_IMG ||
      /(?:^|\/)images\/default-user\.png$/i.test(value)
    ) {
      return DEFAULT_IMG;
    }
    if (value.startsWith("blob:") || value.startsWith("data:")) return value;
    if (value.startsWith("//")) return "https:" + value;

    if (/^https?:\/\//i.test(value)) {
      try {
        var url = new URL(value);
        if (url.hostname === CDN_HOST) {
          return "https://" + CDN_HOST + url.pathname + url.search + url.hash;
        }
        if (url.hostname !== API_HOST) return value;
        return resolveProfileImage(url.pathname + url.search + url.hash);
      } catch (e) {
        return value;
      }
    }

    var match = value.match(/^([^?#]*)(.*)$/);
    var path = (match?.[1] || value).replace(/^\/+/, "");
    var suffix = match?.[2] || "";

    path = path
      .replace(/^api\/file\/profile-image\/+/i, "")
      .replace(/^profile_images\/+/i, "");

    if (path && !/\.(?:avif|png|jpe?g|gif|webp|svg)$/i.test(path)) {
      path = path + ".avif";
    }

    if (!path || /(?:^|\/)images\/default-user\.png$/i.test(path)) {
      return DEFAULT_IMG;
    }

    return CDN_BASE + path + suffix;
  };

  window.getCsrfToken = async function getCsrfToken() {
    var cookieToken = window.readCookie("csrf_token");
    if (cookieToken) {
      csrfTokenCache = cookieToken;
      return cookieToken;
    }
    if (csrfTokenCache) return csrfTokenCache;

    var response = await fetch(API + "/api/auth/csrf", {
      credentials: "include",
    });
    if (!response.ok) throw new Error("CSRF " + response.status);

    var data = await response.json();
    csrfTokenCache = window.readCookie("csrf_token") || data.csrfToken || null;
    if (!csrfTokenCache) throw new Error("CSRF token missing");
    return csrfTokenCache;
  };

  window.readErrorMessage = async function readErrorMessage(response, fallback) {
    try {
      var data = await response.json();
      if (typeof data.message === "string" && data.message.trim()) return data.message.trim();
      if (typeof data.detail === "string" && data.detail.trim()) return data.detail.trim();
    } catch {}
    return fallback;
  };

  window.fetchMovieDetail = async function fetchMovieDetail(movieId, token) {
    try {
      var response = await fetch(API + "/api/movies/detail/" + movieId, {
        credentials: "include",
        headers: token ? { Authorization: "Bearer " + token } : {},
      });
      if (!response.ok) return null;
      return response.json();
    } catch (error) {
      console.error("movie detail load failed:", error);
      return null;
    }
  };

  window.formatRating = function formatRating(rating) {
    return Number(rating || 0).toFixed(1);
  };

  window.makeTextStars = function makeTextStars(rating) {
    var filled = Math.max(0, Math.min(5, Math.round(Number(rating) || 0)));
    return "★".repeat(filled) + "☆".repeat(5 - filled);
  };
})();
