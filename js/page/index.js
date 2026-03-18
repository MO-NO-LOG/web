const API = "https://api.mono-log.fun";

function bindSimpleSlider(slider) {
  const list = slider.querySelector(".movie-list");
  const leftBtn = slider.querySelector(".left.next");
  const rightBtn = slider.querySelector(".right.next");
  if (!list) return;

  const step = () => Math.max(list.clientWidth * 0.9, 240);

  if (leftBtn) {
    leftBtn.addEventListener("click", () => {
      list.scrollBy({ left: -step(), behavior: "smooth" });
    });
  }

  if (rightBtn) {
    rightBtn.addEventListener("click", () => {
      list.scrollBy({ left: step(), behavior: "smooth" });
    });
  }

  let startX = 0;
  let endX = 0;

  list.addEventListener(
    "touchstart",
    (e) => {
      startX = e.touches[0].clientX;
      endX = startX;
    },
    { passive: true },
  );

  list.addEventListener(
    "touchmove",
    (e) => {
      endX = e.touches[0].clientX;
    },
    { passive: true },
  );

  list.addEventListener("touchend", () => {
    const delta = startX - endX;
    if (Math.abs(delta) < 40) return;
    list.scrollBy({ left: delta > 0 ? step() : -step(), behavior: "smooth" });
  });
}

document.querySelectorAll(".movie_slider").forEach(bindSimpleSlider);

/* 공통 카드 생성 (rank-card + clip 구조) */
function renderMovieCard(movie, rank = null) {
  return `
    <article class="movie-card ${rank ? "rank-card" : ""}">
      ${rank ? `<span class="rank-num">${rank}</span>` : ""}

      <a href="review.html?movieId=${movie.id}">
        <div class="clip">
          <img src="${movie.posterUrl || "images/no-poster.png"}" alt="${movie.title}">
          <div class="movie-overlay">
            <h4>${movie.title}</h4>
            <div class="text-box">
              <p>${movie.releaseDate || ""}</p>
              <span class="rating">★${movie.averageRating ?? 0}</span>
            </div>
          </div>
        </div>
      </a>
    </article>
  `;
}

/* 트렌드 */
fetch(API + "/api/movies/trend")
  .then((res) => res.json())
  .then((movies) => {
    document.getElementById("trendList").innerHTML = movies
      .map((m) => renderMovieCard(m))
      .join("");
  });

/* recommended 1회 호출 후 재사용 */
fetch(API + "/api/movies/recommended?limit=30")
  .then((res) => res.json())
  .then((movies) => {
    const sorted = [...movies].sort(
      (a, b) => (b.averageRating ?? 0) - (a.averageRating ?? 0),
    );

    document.getElementById("top7List").innerHTML = sorted
      .slice(0, 7)
      .map((m, i) => renderMovieCard(m, i + 1))
      .join("");

    document.getElementById("ratingList").innerHTML = sorted
      .map((m) => renderMovieCard(m))
      .join("");

    document.getElementById("endingList").innerHTML = movies
      .map((m) => renderMovieCard(m))
      .join("");
  });
