const API = "https://api.mono-log.fun";
const ACCESS_TOKEN_KEY = "access_token";
const FALLBACK_POSTER = "images/ui/break.png";

const movieGrid = document.getElementById("movieGrid");
const emptyState = document.getElementById("emptyState");
const totalCount = document.getElementById("totalCount");
const sortBox = document.getElementById("sortBox");
const sortLabel = document.getElementById("sortLabel");
const sortList = document.getElementById("sortList");

let wishlistMovies = [];
let currentSort = "kor";

function getToken() {
  return localStorage.getItem(ACCESS_TOKEN_KEY) || "";
}

function escapeHtml(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (char) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[char]
  );
}

function updateCountAndEmpty() {
  totalCount.textContent = wishlistMovies.length;

  if (wishlistMovies.length === 0) {
    emptyState.classList.add("show");
    movieGrid.style.display = "none";
  } else {
    emptyState.classList.remove("show");
    movieGrid.style.display = "grid";
  }
}

function sortMovies(type) {
  currentSort = type;

  wishlistMovies.sort((a, b) => {
    if (type === "kor") {
      return a.title.localeCompare(b.title, "ko");
    }
    if (type === "latest") {
      return new Date(b.addedAt || 0) - new Date(a.addedAt || 0);
    }
    if (type === "year") {
      return (b.releaseYear || 0) - (a.releaseYear || 0);
    }
    if (type === "rating") {
      return (b.averageRating || 0) - (a.averageRating || 0);
    }
    return 0;
  });
}

function renderMovies() {
  movieGrid.innerHTML = "";

  wishlistMovies.forEach((movie) => {
    const card = document.createElement("article");
    card.className = "movie-card";
    card.dataset.title = movie.title;
    card.dataset.year = String(movie.releaseYear || 0);
    card.dataset.rating = String(movie.averageRating || 0);
    card.dataset.added = movie.addedAt || "";
    card.dataset.movieId = String(movie.movieId);

    card.innerHTML = `
      <a class="movie-link" href="review.html?movieId=${movie.movieId}">
        <div class="poster">
          <img src="${escapeHtml(movie.posterUrl || FALLBACK_POSTER)}" alt="${escapeHtml(movie.title)}">
          <button class="wish-btn on" type="button" aria-label="위시리스트 제거" data-movie-id="${movie.movieId}">
            <span class="wish-icon allow" aria-hidden="true"></span>
          </button>
        </div>
        <div class="movie-info">
          <h4 class="movie-title">${escapeHtml(movie.title)}</h4>
          <div class="movie-meta">
            <span>${escapeHtml(movie.genreText || "ETC")}</span>
            <span class="dot">·</span>
            <span>${escapeHtml(movie.releaseYear ? String(movie.releaseYear) : "-")}</span>
            <span class="dot">·</span>
            <span>★${Number(movie.averageRating || 0).toFixed(1)}</span>
          </div>
        </div>
      </a>
    `;

    movieGrid.appendChild(card);
  });

  window.WishFeature?.init(movieGrid);
  updateCountAndEmpty();
}

async function fetchMovieDetail(movieId, token) {
  try {
    const response = await fetch(`${API}/api/movies/detail/${movieId}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      credentials: "include",
    });

    if (!response.ok) return null;
    return response.json();
  } catch (error) {
    console.error("wishlist detail load failed:", error);
    return null;
  }
}

async function loadWishlist() {
  const token = getToken();

  if (!token) {
    wishlistMovies = [];
    renderMovies();
    return;
  }

  movieGrid.innerHTML = "";

  try {
    const response = await fetch(`${API}/api/favorites/list`, {
      headers: { Authorization: `Bearer ${token}` },
      credentials: "include",
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    const favorites = Array.isArray(data.favorites) ? data.favorites : [];

    const details = await Promise.all(
      favorites.map((item) => fetchMovieDetail(item.movieId, token))
    );

    wishlistMovies = favorites.map((item, index) => {
      const detail = details[index] || {};
      const genres = Array.isArray(detail.genres) ? detail.genres : [];
      const releaseDate = detail.releaseDate || "";

      return {
        movieId: item.movieId,
        title: item.title || detail.title || "제목 없음",
        posterUrl: item.posterUrl || detail.posterUrl || FALLBACK_POSTER,
        addedAt: item.createdAt || "",
        averageRating: Number(detail.averageRating || 0),
        releaseYear: releaseDate ? Number(String(releaseDate).slice(0, 4)) : 0,
        genreText: genres.length > 0 ? genres.join(", ") : "ETC",
      };
    });

    sortMovies(currentSort);
    renderMovies();
  } catch (error) {
    console.error("wishlist load failed:", error);
    wishlistMovies = [];
    renderMovies();
  }
}

document.addEventListener("wish:toggled", (event) => {
  const movieId = Number(event.detail?.movieId);
  const isFavorite = Boolean(event.detail?.isFavorite);

  if (!movieId || isFavorite) return;

  wishlistMovies = wishlistMovies.filter((movie) => movie.movieId !== movieId);
  renderMovies();
});

sortBox.addEventListener("click", (event) => {
  sortBox.classList.toggle("open");

  const item = event.target.closest(".sort-item");
  if (!item) return;

  [...sortList.querySelectorAll(".sort-item")].forEach((element) =>
    element.classList.remove("active")
  );
  item.classList.add("active");
  sortLabel.textContent = item.textContent;

  sortMovies(item.dataset.sort);
  renderMovies();
});

document.addEventListener("click", (event) => {
  if (!sortBox.contains(event.target)) {
    sortBox.classList.remove("open");
  }
});

movieGrid.innerHTML = "";
loadWishlist();
