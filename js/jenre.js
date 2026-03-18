const API = "https://api.mono-log.fun";

const genreRow = document.getElementById("genreRow");
const movieGrid = document.getElementById("movieGrid");
const matchModeToggle = document.getElementById("matchModeToggle");

const genreMap = {
  comedy: "코미디",
  romance: "로맨스",
  sf: "SF",
  action: "액션",
  thriller: "스릴러",
  animation: "애니메이션",
  drama: "드라마",
  horror: "공포",
  fantasy: "판타지",
  mystery: "미스터리",
  documentary: "다큐멘터리",
  crime: "범죄",
  adventure: "모험",
  war: "전쟁",
  musical: "뮤지컬",
};

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function toDateText(movie) {
  if (!movie.releaseDate) return "-";
  return String(movie.releaseDate).slice(0, 4);
}

function toGenreText(movie) {
  if (!Array.isArray(movie.genres) || movie.genres.length === 0)
    return "장르 없음";
  return movie.genres.join(", ");
}

function toRatingText(movie) {
  const rating = Number(movie.averageRating || 0);
  return `${rating.toFixed(1)}★`;
}

function getMatchMode() {
  return matchModeToggle?.checked ? "OR" : "AND";
}

function getEmptyDescription(selectedGenres) {
  const mode = getMatchMode();
  if (selectedGenres.length === 0) {
    return "최대 3개까지 선택한 뒤 AND / OR 방식을 골라 결과를 볼 수 있습니다.";
  }
  if (mode === "OR") {
    return "선택한 장르 중 하나라도 포함하는 영화가 없습니다.";
  }
  return "선택한 장르를 모두 포함하는 영화가 없습니다.";
}

function renderEmpty(title, description) {
  if (!movieGrid) return;
  movieGrid.innerHTML = `
    <div class="genre-empty">
      <strong>${escapeHtml(title)}</strong>
      <p>${escapeHtml(description)}</p>
    </div>
  `;
}

function renderMovies(movies, selectedGenres) {
  if (!movieGrid) return;

  if (!Array.isArray(movies) || movies.length === 0) {
    renderEmpty(
      selectedGenres.length ? selectedGenres.join(", ") : "장르를 선택하세요",
      getEmptyDescription(selectedGenres),
    );
    return;
  }

  movieGrid.innerHTML = movies
    .map(
      (movie) => `
        <article class="movie-card">
          <a class="movie-link" href="review.html?movieId=${movie.id}" aria-label="${escapeHtml(movie.title)} 상세">
            <div class="poster">
              <img src="${movie.posterUrl || "images/no-poster.png"}" alt="${escapeHtml(movie.title)}">
              <button class="wish-btn" type="button" aria-label="위시리스트">
                <span class="wish-icon" aria-hidden="true"></span>
              </button>
            </div>
            <div class="movie-info">
              <div class="movie-head">
                <h4 class="movie-title">${escapeHtml(movie.title)}</h4>
                <span class="movie-rating">${escapeHtml(toRatingText(movie))}</span>
              </div>
              <div class="movie-meta">
                <div class="movie-meta-left">
                  <span>${escapeHtml(toGenreText(movie))}</span>
                  <span class="dot">·</span>
                  <span>${escapeHtml(toDateText(movie))}</span>
                </div>
              </div>
            </div>
          </a>
        </article>
      `,
    )
    .join("");
}

function getSelectedGenres() {
  if (!genreRow) return [];

  return Array.from(genreRow.querySelectorAll(".genre-btn.active"))
    .map((btn) => {
      const genreKey = btn.dataset.genre || "";
      return genreMap[genreKey] || btn.textContent.trim();
    })
    .filter(Boolean);
}

async function fetchGenreMovies(keyword) {
  const url = `${API}/api/movies/search?keyword=${encodeURIComponent(keyword)}&searchType=GENRE&page=0&size=100`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const data = await res.json();
  return Array.isArray(data.movies) ? data.movies : [];
}

function intersectMovies(movieLists) {
  if (movieLists.length === 0) return [];
  if (movieLists.length === 1) return movieLists[0];

  const countMap = new Map();
  const movieMap = new Map();

  movieLists.forEach((movies) => {
    const seenInList = new Set();

    movies.forEach((movie) => {
      if (seenInList.has(movie.id)) return;
      seenInList.add(movie.id);
      movieMap.set(movie.id, movie);
      countMap.set(movie.id, (countMap.get(movie.id) || 0) + 1);
    });
  });

  return Array.from(movieMap.values()).filter(
    (movie) => countMap.get(movie.id) === movieLists.length,
  );
}

function unionMovies(movieLists) {
  const movieMap = new Map();

  movieLists.forEach((movies) => {
    movies.forEach((movie) => {
      if (!movieMap.has(movie.id)) {
        movieMap.set(movie.id, movie);
      }
    });
  });

  return Array.from(movieMap.values());
}

async function loadSelectedGenres() {
  const selectedGenres = getSelectedGenres();

  if (selectedGenres.length === 0) {
    renderEmpty("장르를 선택하세요", getEmptyDescription(selectedGenres));
    return;
  }

  const mode = getMatchMode();
  renderEmpty(
    `${selectedGenres.join(", ")} · ${mode}`,
    "영화 목록을 불러오는 중입니다.",
  );

  try {
    const movieLists = await Promise.all(
      selectedGenres.map((genre) => fetchGenreMovies(genre)),
    );

    const movies =
      mode === "OR" ? unionMovies(movieLists) : intersectMovies(movieLists);

    renderMovies(movies, selectedGenres);
  } catch (err) {
    console.error("genre movies load failed:", err);
    renderEmpty(selectedGenres.join(", "), "영화 목록을 불러오지 못했습니다.");
  }
}

if (genreRow) {
  genreRow.addEventListener("click", (e) => {
    const btn = e.target.closest(".genre-btn");
    if (!btn) return;

    if (btn.classList.contains("active")) {
      btn.classList.remove("active");
      loadSelectedGenres();
      return;
    }

    const activeCount = genreRow.querySelectorAll(".genre-btn.active").length;
    if (activeCount >= 3) {
      alert("장르는 최대 3개까지 선택할 수 있습니다.");
      return;
    }

    btn.classList.add("active");
    loadSelectedGenres();
  });
}

if (matchModeToggle) {
  matchModeToggle.addEventListener("change", () => {
    loadSelectedGenres();
  });
}

document.addEventListener("click", (e) => {
  const wishBtn = e.target.closest(".wish-btn");
  if (!wishBtn) return;

  e.preventDefault();
  e.stopPropagation();
  wishBtn.classList.toggle("on");
});

renderEmpty("장르를 선택하세요", getEmptyDescription([]));
