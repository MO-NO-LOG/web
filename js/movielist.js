const moviesPerPage = 24;
let currentPage = 1;

/* 영화 데이터 (장르 직접 지정) */
const movies = [
    { title: "주토피아2", genre: "ANIMATION", date: "2025.11.26", rating: "3.9", image: "images/imgnum/1.webp" },
    { title: "어벤져스", genre: "ACTION", date: "2024.05.01", rating: "4.5", image: "images/imgnum/2.webp" },
    { title: "인터스텔라", genre: "SF", date: "2024.03.10", rating: "4.7", image: "images/imgnum/3.webp" },
    { title: "기생충", genre: "DRAMA", date: "2024.02.20", rating: "4.6", image: "images/imgnum/4.webp" }
];

/* 테스트용으로 자동 추가 */
for (let i = 5; i <= 55; i++) {
    movies.push({
        title: `영화 제목 ${i}`,
        genre: "ACTION",
        date: "2024.01.01",
        rating: (Math.random() * 2 + 3).toFixed(1),
        image: `images/imgnum/${i}.webp`
    });
}

function renderMovies() {
    const grid = document.getElementById("movieGrid");
    grid.innerHTML = "";

    const start = (currentPage - 1) * moviesPerPage;
    const pageMovies = movies.slice(start, start + moviesPerPage);

    pageMovies.forEach(movie => {
        const card = document.createElement("article");
        card.className = "movie-card";

        card.innerHTML = `
            <img src="${movie.image}">
            <div class="card-info">
                <div class="card-top">
                    <span class="genre">${movie.genre}</span>
                    <span class="rating">⭐ ${movie.rating}</span>
                </div>
                <div class="title">${movie.title}</div>
                <div class="date">${movie.date}</div>
            </div>
        `;

        grid.appendChild(card);
    });
}

function renderPagination() {
    const totalPages = Math.ceil(movies.length / moviesPerPage);
    const pagination = document.getElementById("pagination");
    pagination.innerHTML = "";

    // 페이지 번호 버튼
    for (let i = 1; i <= totalPages; i++) {
        const btn = document.createElement("button");
        btn.textContent = i;

        if (i === currentPage) btn.classList.add("active");

        btn.onclick = () => {
            currentPage = i;
            renderMovies();
            renderPagination();
            window.scrollTo({ top: 0, behavior: "smooth" });
        };

        pagination.appendChild(btn);
    }

    // ▶ 다음 화살표 버튼
    const nextBtn = document.createElement("button");
    nextBtn.className = "arrow-btn";
    nextBtn.textContent = "▶";

    nextBtn.onclick = () => {
        if (currentPage < totalPages) {
            currentPage++;
            renderMovies();
            renderPagination();
            window.scrollTo({ top: 0, behavior: "smooth" });
        }
    };

    pagination.appendChild(nextBtn);
}

renderMovies();
renderPagination();
