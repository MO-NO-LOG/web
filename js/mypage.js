const API = "https://api.mono-log.fun";
const ACCESS_TOKEN_KEY = "access_token";
const PROFILE_IMAGE_CDN_BASE = "https://cdn.mono-log.fun/profile_images/";
const DEFAULT_PROFILE_IMAGE = "images/default-user.png";

const state = {
  reviews: [],
  visibleCount: 5,
  wishlist: [],
};

const FALLBACK_POSTER = "images/ui/break.png";

function resolveProfileImage(src) {
  const value = typeof src === "string" ? src.trim() : "";
  if (!value) return DEFAULT_PROFILE_IMAGE;

  if (
    value === DEFAULT_PROFILE_IMAGE ||
    value === `/${DEFAULT_PROFILE_IMAGE}` ||
    /(?:^|\/)images\/default-user\.png$/i.test(value)
  ) {
    return DEFAULT_PROFILE_IMAGE;
  }

  if (value.startsWith("blob:") || value.startsWith("data:")) {
    return value;
  }

  if (value.startsWith("//")) {
    return `https:${value}`;
  }

  if (/^https?:\/\//i.test(value)) {
    try {
      const url = new URL(value);
      if (url.origin === "https://cdn.mono-log.fun") {
        return value;
      }
      if (url.origin !== API) {
        return value;
      }
      return resolveProfileImage(`${url.pathname}${url.search}${url.hash}`);
    } catch {
      return value;
    }
  }

  const match = value.match(/^([^?#]*)(.*)$/);
  let path = (match?.[1] || value).replace(/^\/+/, "");
  const suffix = match?.[2] || "";

  path = path
    .replace(/^api\/file\/profile-image\/+/i, "")
    .replace(/^profile_images\/+/i, "");

  if (!path || /(?:^|\/)images\/default-user\.png$/i.test(path)) {
    return DEFAULT_PROFILE_IMAGE;
  }

  return `${PROFILE_IMAGE_CDN_BASE}${path}${suffix}`;
}

function formatDate(value) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}.${m}.${day}`;
}

function calcJoinedDays(value) {
  if (!value) return 0;
  const joined = new Date(value);
  if (Number.isNaN(joined.getTime())) return 0;
  const diff = Date.now() - joined.getTime();
  return Math.max(1, Math.floor(diff / (1000 * 60 * 60 * 24)));
}

function renderStars(rating) {
  const filledCount = Math.max(0, Math.min(5, Math.round(Number(rating) || 0)));
  const emptyCount = 5 - filledCount;

  return `
    <span class="stars-filled" aria-hidden="true">${"★".repeat(filledCount)}</span><span class="stars-empty" aria-hidden="true">${"☆".repeat(emptyCount)}</span>
    <span class="sr-only">별점 ${filledCount}점</span>
  `;
}

function getReviewMovieId(review) {
  const candidates = [
    review?.movieId,
    review?.movie_id,
    review?.movie?.movieId,
    review?.movie?.id,
  ];

  const movieId = candidates.find((value) => Number.isFinite(Number(value)) && Number(value) > 0);
  return movieId ? Number(movieId) : 0;
}

function getReviewId(review) {
  const candidates = [review?.reviewId, review?.review_id, review?.id];
  const reviewId = candidates.find((value) => Number.isFinite(Number(value)) && Number(value) > 0);
  return reviewId ? Number(reviewId) : 0;
}

function moveToReview(movieId, reviewId = 0) {
  if (!Number.isFinite(movieId) || movieId <= 0) return;
  const params = new URLSearchParams({ movieId: String(movieId) });
  if (Number.isFinite(reviewId) && reviewId > 0) {
    params.set("reviewId", String(reviewId));
  }
  window.location.href = `review.html?${params.toString()}`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderWishlist() {
  const grid = document.getElementById("myWishlistGrid");
  if (!grid) return;

  if (state.wishlist.length === 0) {
    grid.innerHTML = `
      <div class="mypage-wishlist-empty">
        위시리스트에 담긴 영화가 없습니다.
      </div>
    `;
    return;
  }

  grid.innerHTML = state.wishlist
    .map(
      (movie) => `
        <article class="mypage-wish-card">
          <a class="mypage-wish-link" href="review.html?movieId=${movie.movieId}">
            <div class="mypage-wish-poster">
              <img src="${escapeHtml(movie.posterUrl || FALLBACK_POSTER)}" alt="${escapeHtml(movie.title)}">
              <button class="wish-btn" type="button" aria-label="위시리스트" data-movie-id="${movie.movieId}">
                <span class="wish-icon" aria-hidden="true"></span>
              </button>
            </div>
            <div class="mypage-wish-info">
              <div class="mypage-wish-head">
                <h4 class="mypage-wish-title">${escapeHtml(movie.title)}</h4>
                <span class="mypage-wish-rating">★${Number(movie.averageRating || 0).toFixed(1)}</span>
              </div>
              <div class="mypage-wish-meta">
                <span>${escapeHtml(movie.genreText || "ETC")}</span>
                <span class="dot">·</span>
                <span>${escapeHtml(movie.releaseYear ? String(movie.releaseYear) : "-")}</span>
              </div>
            </div>
          </a>
        </article>
      `,
    )
    .join("");

  window.WishFeature?.init(grid);
}

function renderReviews() {
  const reviewList = document.getElementById("myReviewList");
  const moreBtn = document.getElementById("myReviewMoreBtn");
  if (!reviewList || !moreBtn) return;

  reviewList.innerHTML = "";

  if (state.reviews.length === 0) {
    reviewList.innerHTML = `
      <div class="review-item">
        <div><p>작성한 리뷰가 없습니다.</p></div>
      </div>
    `;
    moreBtn.style.display = "none";
    return;
  }

  const visibleReviews = state.reviews.slice(0, state.visibleCount);
  visibleReviews.forEach((item) => {
    const movieId = getReviewMovieId(item);
    const reviewId = getReviewId(item);
    const movieTitle = item.movieTitle || "Movie";
    const createdAt = formatDate(item.createdAt);
    const content = item.content || "";
    const stars = renderStars(item.rating);

    const row = document.createElement("div");
    row.className = "review-item";
    if (movieId) {
      row.classList.add("review-item-link");
      row.tabIndex = 0;
      row.setAttribute("role", "link");
      row.setAttribute("aria-label", `${movieTitle} 리뷰 보기`);
      row.addEventListener("click", () => moveToReview(movieId, reviewId));
      row.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          moveToReview(movieId, reviewId);
        }
      });
    }
    row.innerHTML = `
      <div>
        <strong>${movieTitle}</strong>
        <div class="review-date">${createdAt}</div>
        <p>${content}</p>
      </div>
      <div class="stars" aria-label="별점 ${Math.max(0, Math.min(5, Math.round(Number(item.rating) || 0)))}점">${stars}</div>
    `;
    reviewList.appendChild(row);
  });

  moreBtn.style.display =
    state.visibleCount < state.reviews.length ? "block" : "none";
}

function fillProfile(user, profile) {
  const avatarEl = document.getElementById("mypageAvatar");
  const nicknameEl = document.getElementById("mypageNickname");
  const reviewCountEl = document.getElementById("statReviewCount");
  const commentCountEl = document.getElementById("statCommentCount");
  const joinedDaysEl = document.getElementById("statJoinedDays");

  const profileImage =
    profile.profileImage && String(profile.profileImage).trim()
      ? resolveProfileImage(profile.profileImage)
      : DEFAULT_PROFILE_IMAGE;

  if (avatarEl) avatarEl.src = profileImage;
  if (nicknameEl) nicknameEl.textContent = user.nickname || "User";
  if (reviewCountEl)
    reviewCountEl.textContent = `${profile.reviewCount || 0} 개`;
  if (commentCountEl)
    commentCountEl.textContent = `${profile.commentCount || 0} 개`;
  if (joinedDaysEl) {
    joinedDaysEl.textContent = `${calcJoinedDays(profile.joinedAt || user.created_at)} 일`;
  }
}

async function fetchMovieDetail(movieId, token) {
  try {
    const response = await fetch(`${API}/api/movies/detail/${movieId}`, {
      credentials: "include",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });

    if (!response.ok) return null;
    return response.json();
  } catch (error) {
    console.error("mypage wishlist detail load failed:", error);
    return null;
  }
}

async function loadWishlist(token) {
  try {
    const response = await fetch(`${API}/api/favorites/list`, {
      credentials: "include",
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();
    const favorites = Array.isArray(data.favorites) ? data.favorites.slice(0, 4) : [];
    const details = await Promise.all(
      favorites.map((item) => fetchMovieDetail(item.movieId, token)),
    );

    state.wishlist = favorites.map((item, index) => {
      const detail = details[index] || {};
      const genres = Array.isArray(detail.genres) ? detail.genres : [];
      const releaseDate = detail.releaseDate || "";

      return {
        movieId: item.movieId,
        title: item.title || detail.title || "Movie",
        posterUrl: item.posterUrl || detail.posterUrl || FALLBACK_POSTER,
        averageRating: Number(detail.averageRating || 0),
        releaseYear: releaseDate ? Number(String(releaseDate).slice(0, 4)) : 0,
        genreText: genres.length > 0 ? genres.join(", ") : "ETC",
      };
    });
  } catch (error) {
    console.error("mypage wishlist load failed:", error);
    state.wishlist = [];
  }

  renderWishlist();
}

async function loadMyPage() {
  const token = localStorage.getItem(ACCESS_TOKEN_KEY);
  if (!token) {
    location.href = "login.html";
    return;
  }

  try {
    const meRes = await fetch(`${API}/api/auth/me`, {
      credentials: "include",
      headers: { Authorization: `Bearer ${token}` },
    });

    if (meRes.status === 401) {
      localStorage.removeItem(ACCESS_TOKEN_KEY);
      location.href = "login.html";
      return;
    }
    if (!meRes.ok) throw new Error(`HTTP ${meRes.status}`);

    const me = await meRes.json();

    const profileRes = await fetch(
      `${API}/api/user/profile/${encodeURIComponent(me.nickname)}?limit=50`,
    );
    if (!profileRes.ok) throw new Error(`HTTP ${profileRes.status}`);

    const profile = await profileRes.json();
    fillProfile(me, profile);

    state.reviews = Array.isArray(profile.reviews) ? profile.reviews : [];
    renderReviews();
    await loadWishlist(token);
  } catch (err) {
    console.error("mypage load failed:", err);
    alert("Failed to load mypage.");
  }
}

document.getElementById("myReviewMoreBtn")?.addEventListener("click", () => {
  state.visibleCount += 5;
  renderReviews();
});

loadMyPage();
