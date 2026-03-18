const API = "https://api.mono-log.fun";
const moviesPerPage = 24;
let currentPage = 1;
let totalPages = 1;
let currentMovies = [];

const params = new URLSearchParams(window.location.search);
const keyword = (params.get("keyword") || "").trim();
const GENRE_KEYWORDS = new Set([
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

const searchType = (
  params.get("searchType") ||
  (GENRE_KEYWORDS.has(keyword.toLowerCase()) ? "GENRE" : "TITLE")
)
  .trim()
  .toUpperCase();

function toGenre(movie) {
  if (Array.isArray(movie.genres) && movie.genres.length > 0) {
    return movie.genres.join(", ");
  }
  return "ETC";
}

function toDateText(movie) {
  if (!movie.releaseDate) return "-";
  return String(movie.releaseDate).replaceAll("-", ".");
}

function renderMovies() {
  const grid = document.getElementById("movieGrid");
  if (!grid) return;

  grid.innerHTML = "";

  if (currentMovies.length === 0) {
    grid.innerHTML = `<p style="grid-column:1/-1;text-align:center;color:#666;">검색 결과가 없습니다.</p>`;
    return;
  }

  currentMovies.forEach((movie) => {
    const card = document.createElement("article");
    card.className = "movie-card";
    card.style.cursor = "pointer";

    card.innerHTML = `
      <div class="card-poster">
        <img src="${movie.posterUrl || "images/no-poster.png"}" alt="${movie.title}">
        <button class="wish-btn" type="button" aria-label="위시리스트" data-movie-id="${movie.id}">
          <span class="wish-icon"></span>
        </button>
      </div>

      <div class="card-info">
        <div class="card-top">
          <span class="genre">${toGenre(movie)}</span>
          <span class="rating">★${movie.averageRating ?? 0}</span>
        </div>
        <div class="title">${movie.title}</div>
        <div class="date">${toDateText(movie)}</div>
      </div>
    `;

    card.addEventListener("click", (e) => {
      if (e.target.closest(".wish-btn")) return;
      window.location.href = `review.html?movieId=${movie.id}`;
    });

    grid.appendChild(card);
  });

  window.WishFeature?.init(grid);
}

function renderPagination() {
  const pagination = document.getElementById("pagination");
  if (!pagination) return;

  pagination.innerHTML = "";

  if (totalPages <= 1) return;

  for (let i = 1; i <= totalPages; i++) {
    const btn = document.createElement("button");
    btn.textContent = i;
    if (i === currentPage) btn.classList.add("active");

    btn.onclick = () => {
      currentPage = i;
      loadMovies();
      window.scrollTo({ top: 0, behavior: "smooth" });
    };

    pagination.appendChild(btn);
  }

  const nextBtn = document.createElement("button");
  nextBtn.className = "arrow-btn";
  nextBtn.textContent = ">";

  nextBtn.onclick = () => {
    if (currentPage < totalPages) {
      currentPage++;
      loadMovies();
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  pagination.appendChild(nextBtn);
}

async function loadMovies() {
  try {
    const page = Math.max(currentPage - 1, 0);
    const url = `${API}/api/movies/search?keyword=${encodeURIComponent(keyword)}&searchType=${encodeURIComponent(searchType)}&page=${page}&size=${moviesPerPage}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();
    currentMovies = Array.isArray(data.movies) ? data.movies : [];
    totalPages = Math.max(data.totalPages ?? 1, 1);

    const pageTitle = document.querySelector(".page-title");
    if (pageTitle && keyword) {
      const typeLabel = searchType === "GENRE" ? "장르" : "제목";
      pageTitle.textContent = `"${keyword}" ${typeLabel} 검색 결과`;
    }

    renderMovies();
    renderPagination();
  } catch (err) {
    console.error("영화 목록 로드 실패:", err);
  }
}

loadMovies();
