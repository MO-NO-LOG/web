const searchBox = document.querySelector(".search-box");
const searchInput = searchBox?.querySelector("input");
const searchButton = searchBox?.querySelector("button");

function getSearchType(keyword) {
  const normalized = String(keyword || "")
    .trim()
    .toLowerCase();
  return GENRE_KEYWORDS.has(normalized) ? "GENRE" : "TITLE";
}

function goSearch() {
  if (!searchInput) return;

  const keyword = searchInput.value.trim();
  const searchType = getSearchType(keyword);
  const url = keyword
    ? `movielist.html?keyword=${encodeURIComponent(keyword)}&searchType=${searchType}`
    : "movielist.html";

  window.location.href = url;
}

if (searchButton) {
  searchButton.addEventListener("click", goSearch);
}

if (searchInput) {
  searchInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      goSearch();
    }
  });
}
