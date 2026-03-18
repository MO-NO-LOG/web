const WISH_API = "https://api.mono-log.fun";
const WISH_ACCESS_TOKEN_KEY = "access_token";

window.WishFeature = (() => {
  let favoriteMovieIds = new Set();
  let loaded = false;
  let csrfTokenCache = null;

  function getToken() {
    return localStorage.getItem(WISH_ACCESS_TOKEN_KEY) || "";
  }

  function readCookie(name) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = document.cookie.match(
      new RegExp(`(?:^|; )${escaped}=([^;]*)`)
    );
    return match ? decodeURIComponent(match[1]) : "";
  }

  async function getCsrfToken() {
    const cookieToken = readCookie("csrf_token");
    if (cookieToken) {
      csrfTokenCache = cookieToken;
      return cookieToken;
    }

    if (csrfTokenCache) return csrfTokenCache;

    const response = await request(`${WISH_API}/api/auth/csrf`, {
      credentials: "include",
    });

    const data = await response.json();
    csrfTokenCache = readCookie("csrf_token") || data.csrfToken || null;
    if (!csrfTokenCache) {
      throw new Error("CSRF token missing");
    }
    return csrfTokenCache;
  }

  async function request(url, options = {}) {
    const response = await fetch(url, options);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return response;
  }

  async function loadFavorites(force = false) {
    const token = getToken();

    if (!token) {
      favoriteMovieIds = new Set();
      loaded = true;
      return favoriteMovieIds;
    }

    if (loaded && !force) {
      return favoriteMovieIds;
    }

    const response = await request(`${WISH_API}/api/favorites/list`, {
      credentials: "include",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await response.json();
    const favorites = Array.isArray(data.favorites) ? data.favorites : [];
    favoriteMovieIds = new Set(
      favorites
        .map((item) => Number(item.movieId))
        .filter((movieId) => Number.isFinite(movieId) && movieId > 0)
    );
    loaded = true;
    return favoriteMovieIds;
  }

  function syncButtons(root = document) {
    root.querySelectorAll(".wish-btn[data-movie-id]").forEach((button) => {
      const movieId = Number(button.dataset.movieId);
      button.classList.toggle("on", favoriteMovieIds.has(movieId));
    });
  }

  async function init(root = document) {
    try {
      await loadFavorites();
      syncButtons(root);
    } catch (error) {
      console.error("wish init failed:", error);
    }
  }

  async function toggle(movieId, root = document) {
    const token = getToken();
    if (!token) {
      window.location.href = "login.html";
      return false;
    }

    const csrfToken = await getCsrfToken();

    await request(`${WISH_API}/api/favorites/toggle`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        "X-CSRF-Token": csrfToken,
      },
      body: JSON.stringify({ movieId }),
    });

    const isFavorite = !favoriteMovieIds.has(movieId);
    if (isFavorite) {
      favoriteMovieIds.add(movieId);
    } else {
      favoriteMovieIds.delete(movieId);
    }

    syncButtons(root);
    return isFavorite;
  }

  document.addEventListener("click", async (event) => {
    const button = event.target.closest(".wish-btn[data-movie-id]");
    if (!button) return;

    event.preventDefault();
    event.stopPropagation();

    const movieId = Number(button.dataset.movieId);
    if (!Number.isFinite(movieId) || movieId <= 0) return;

    try {
      const isFavorite = await toggle(movieId, document);
      button.dispatchEvent(
        new CustomEvent("wish:toggled", {
          bubbles: true,
          detail: { movieId, isFavorite },
        })
      );
    } catch (error) {
      console.error("wish toggle failed:", error);
    }
  });

  return {
    init,
    loadFavorites,
    syncButtons,
    toggle,
    has(movieId) {
      return favoriteMovieIds.has(Number(movieId));
    },
  };
})();
