const API = "https://api.mono-log.fun";
const ACCESS_TOKEN_KEY = "access_token";

const state = {
  reviews: [],
  visibleCount: 5,
};

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

function toStars(rating) {
  const n = Math.max(0, Math.min(5, Math.round(Number(rating) || 0)));
  return "*".repeat(n) + "-".repeat(5 - n);
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
    const movieTitle = item.movieTitle || "Movie";
    const createdAt = formatDate(item.createdAt);
    const content = item.content || "";
    const stars = toStars(item.rating);

    const row = document.createElement("div");
    row.className = "review-item";
    row.innerHTML = `
      <div>
        <strong>${movieTitle}</strong>
        <div class="review-date">${createdAt}</div>
        <p>${content}</p>
      </div>
      <div class="stars">${stars}</div>
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
      ? profile.profileImage
      : "/images/default-user.png";

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
