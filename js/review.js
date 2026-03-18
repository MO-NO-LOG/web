const API = "https://api.mono-log.fun";
const ACCESS_TOKEN_KEY = "access_token";
const API_HOST = new URL(API).hostname;

let csrfTokenCache = null;
let allReviews = [];
let reviewExpanded = false;
let currentReviewPage = 1;

const reviewReactionState = new Map();
const REVIEWS_PREVIEW_COUNT = 3;
const REVIEWS_PAGE_SIZE = 5;
const FALLBACK_POSTER = "images/ui/break.png";
const PROFILE_IMAGE_CDN_BASE = "https://cdn.mono-log.fun/profile_images/";
const PROFILE_IMAGE_CDN_HOST = "cdn.mono-log.fun";
const DEFAULT_PROFILE_IMAGE = "images/default-user.png";
const REVIEW_FOCUS_CLASS = "review-target";
const REVIEW_FOCUS_ACTIVE_CLASS = "review-target-active";
const REVIEW_REACTION_STORAGE_KEY = "review_reaction_state";

let currentViewerProfileImage = DEFAULT_PROFILE_IMAGE;
let pendingFocusReviewId = 0;
const profileImageCacheByNickname = new Map();
const profileImageRequestByNickname = new Map();

function readCookie(name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = document.cookie.match(
    new RegExp(`(?:^|; )${escaped}=([^;]*)`)
  );
  return match ? decodeURIComponent(match[1]) : "";
}

function readStoredReactionState() {
  try {
    const raw = localStorage.getItem(REVIEW_REACTION_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeStoredReactionState(reviewId, state) {
  if (!reviewId) return;

  const stored = readStoredReactionState();
  stored[String(reviewId)] = {
    likeCount: Number(state.likeCount || 0),
    dislikeCount: Number(state.dislikeCount || 0),
    myReaction: state.myReaction || null,
  };

  try {
    localStorage.setItem(REVIEW_REACTION_STORAGE_KEY, JSON.stringify(stored));
  } catch {}
}

function getStoredReactionState(reviewId) {
  const stored = readStoredReactionState()[String(reviewId)];
  return stored && typeof stored === "object" ? stored : null;
}

function readReactionCount(review, type) {
  const candidates =
    type === "LIKE"
      ? [
          review?.likeCount,
          review?.likes,
          review?.like_count,
          review?.likeCnt,
          review?.positiveCount,
          review?.upCount,
        ]
      : [
          review?.dislikeCount,
          review?.dislikes,
          review?.dislike_count,
          review?.dislikeCnt,
          review?.negativeCount,
          review?.downCount,
        ];

  const value = candidates.find(
    (item) => Number.isFinite(Number(item)) && Number(item) >= 0,
  );

  return value === undefined ? 0 : Number(value);
}

function readMyReaction(review) {
  const candidates = [
    review?.myReaction,
    review?.my_reaction,
    review?.reaction,
    review?.reactionType,
    review?.reaction_type,
    review?.userReaction,
  ];

  const value = candidates.find((item) => typeof item === "string" && item.trim());
  const normalized = String(value || "").trim().toUpperCase();
  return normalized === "LIKE" || normalized === "DISLIKE" ? normalized : null;
}

function syncReactionStateToReviews(reviewId, state) {
  allReviews = allReviews.map((review) => {
    if (Number(review.reviewId) !== Number(reviewId)) return review;

    return {
      ...review,
      likeCount: state.likeCount,
      likes: state.likeCount,
      dislikeCount: state.dislikeCount,
      dislikes: state.dislikeCount,
      myReaction: state.myReaction,
    };
  });
}

function getMovieId() {
  return new URLSearchParams(window.location.search).get("movieId");
}

function getTargetReviewId() {
  const reviewId = Number(new URLSearchParams(window.location.search).get("reviewId"));
  return Number.isFinite(reviewId) && reviewId > 0 ? reviewId : 0;
}

function getToken() {
  return localStorage.getItem(ACCESS_TOKEN_KEY) || "";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

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
      if (url.hostname === PROFILE_IMAGE_CDN_HOST) {
        return `https://${PROFILE_IMAGE_CDN_HOST}${url.pathname}${url.search}${url.hash}`;
      }
      if (url.hostname !== API_HOST) {
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

  if (path && !/\.(?:avif|png|jpe?g|gif|webp|svg)$/i.test(path)) {
    path = `${path}.avif`;
  }

  if (!path || /(?:^|\/)images\/default-user\.png$/i.test(path)) {
    return DEFAULT_PROFILE_IMAGE;
  }

  return `${PROFILE_IMAGE_CDN_BASE}${path}${suffix}`;
}

function getProfileImageFromData(source) {
  if (!source || typeof source !== "object") return "";

  const candidates = [
    source.img,
    source.userImg,
    source.profileImage,
    source.userProfileImage,
    source.profile_image,
    source.avatar,
  ];

  return candidates.find((value) => typeof value === "string" && value.trim()) || "";
}

function getNicknameFromData(source) {
  if (!source || typeof source !== "object") return "";

  const candidates = [
    source.userNickname,
    source.nickname,
    source.writerNickname,
    source.authorNickname,
    source.user?.nickname,
  ];

  return candidates.find((value) => typeof value === "string" && value.trim()) || "";
}

async function fetchProfileImageByNickname(nickname) {
  const key = typeof nickname === "string" ? nickname.trim() : "";
  if (!key) return DEFAULT_PROFILE_IMAGE;

  if (profileImageCacheByNickname.has(key)) {
    return profileImageCacheByNickname.get(key);
  }

  if (profileImageRequestByNickname.has(key)) {
    return profileImageRequestByNickname.get(key);
  }

  const request = fetch(
    `${API}/api/user/profile/${encodeURIComponent(key)}?limit=1`,
    { credentials: "include" },
  )
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const profile = await response.json();
      const profileImage = resolveProfileImage(getProfileImageFromData(profile));
      profileImageCacheByNickname.set(key, profileImage);
      return profileImage;
    })
    .catch(() => DEFAULT_PROFILE_IMAGE)
    .finally(() => {
      profileImageRequestByNickname.delete(key);
    });

  profileImageRequestByNickname.set(key, request);
  return request;
}

async function hydrateProfileImages(root = document) {
  const imageElements = [...root.querySelectorAll("img[data-profile-nickname]")];

  await Promise.all(
    imageElements.map(async (imgEl) => {
      const nickname = imgEl.dataset.profileNickname?.trim();
      const sourceValue = imgEl.dataset.profileSource || "";
      if (!nickname || sourceValue.trim()) return;

      const profileImage = await fetchProfileImageByNickname(nickname);
      if (!profileImage || profileImage === DEFAULT_PROFILE_IMAGE) return;

      applyProfileImageFallback(imgEl);
      imgEl.src = profileImage;
    }),
  );
}

function getCommentId(comment) {
  const candidates = [
    comment?.commentId,
    comment?.comment_id,
    comment?.reviewCommentId,
    comment?.id,
  ];

  const commentId = candidates.find(
    (value) => Number.isFinite(Number(value)) && Number(value) > 0,
  );
  return commentId ? Number(commentId) : 0;
}

function applyProfileImageFallback(imgEl) {
  if (!imgEl) return;
  imgEl.onerror = () => {
    imgEl.onerror = null;
    imgEl.src = DEFAULT_PROFILE_IMAGE;
  };
}

function starRatingHTML(rating) {
  const value = Math.max(
    0.5,
    Math.min(5, Math.round((Number(rating) || 0) * 2) / 2)
  );
  const fullCount = Math.floor(value);
  const hasHalf = value % 1 !== 0;
  const emptyCount = 5 - fullCount - (hasHalf ? 1 : 0);

  return `
    <span class="star-rating-display" aria-label="${value}점">
      ${'<span class="star-icon full"></span>'.repeat(fullCount)}
      ${hasHalf ? '<span class="star-icon half"></span>' : ""}
      ${'<span class="star-icon empty"></span>'.repeat(emptyCount)}
    </span>
  `;
}

async function getCsrfToken() {
  const cookieToken = readCookie("csrf_token");
  if (cookieToken) {
    csrfTokenCache = cookieToken;
    return cookieToken;
  }

  if (csrfTokenCache) return csrfTokenCache;

  const response = await fetch(`${API}/api/auth/csrf`, {
    credentials: "include",
  });
  if (!response.ok) {
    throw new Error(`CSRF ${response.status}`);
  }

  const data = await response.json();
  csrfTokenCache = readCookie("csrf_token") || data.csrfToken || null;
  if (!csrfTokenCache) {
    throw new Error("CSRF token missing");
  }
  return csrfTokenCache;
}

async function readErrorMessage(response, fallback) {
  try {
    const data = await response.json();
    if (typeof data.detail === "string") return data.detail;
    if (typeof data.message === "string") return data.message;
  } catch {}
  return fallback;
}

function getReactionState(review) {
  const reviewId = Number(review.reviewId);
  if (!reviewReactionState.has(reviewId)) {
    const storedState = getStoredReactionState(reviewId);
    const nextState = storedState || {
      likeCount: readReactionCount(review, "LIKE"),
      dislikeCount: readReactionCount(review, "DISLIKE"),
      myReaction: readMyReaction(review),
    };

    reviewReactionState.set(reviewId, nextState);
    syncReactionStateToReviews(reviewId, nextState);
  }

  return reviewReactionState.get(reviewId);
}

function reviewActionIcons(review) {
  const state = getReactionState(review);

  return `
    <div class="action reaction-btn ${state.myReaction === "LIKE" ? "active" : ""}" data-reaction="LIKE" role="button" tabindex="0" aria-label="좋아요">
      <img src="images/ui/like.webp" alt="좋아요">
      <span>${state.likeCount}</span>
    </div>
    <div class="action reaction-btn ${state.myReaction === "DISLIKE" ? "active" : ""}" data-reaction="DISLIKE" role="button" tabindex="0" aria-label="싫어요">
      <img src="images/ui/like.webp" class="rotate-180" alt="싫어요">
      <span>${state.dislikeCount}</span>
    </div>
    <div class="action reply-toggle-btn" role="button" tabindex="0" aria-label="댓글 열기">
      <img src="images/ui/comment.webp" alt="댓글">
    </div>
  `;
}

function passiveActionIcons() {
  return `
    <div class="action"><img src="images/ui/like.webp" alt="좋아요"><span>0</span></div>
    <div class="action"><img src="images/ui/like.webp" class="rotate-180" alt="싫어요"><span>0</span></div>
  `;
}

function makeReplyHTML(reply) {
  const replyNickname = getNicknameFromData(reply);
  const replyProfileSource = getProfileImageFromData(reply);
  const replyProfileImage = resolveProfileImage(replyProfileSource);

  return `
    <div class="reply nested-reply">
      <img
        src="${escapeHtml(replyProfileImage)}"
        class="reply-profile"
        alt="reply-user"
        data-profile-nickname="${escapeHtml(replyNickname)}"
        data-profile-source="${escapeHtml(replyProfileSource)}"
      >
      <div class="reply-content">
        <span class="reply-user">${escapeHtml(reply.userNickname || "익명")}</span>
        <div class="reply-body">${escapeHtml(reply.content || "")}</div>
      </div>
      <div class="reply-actions">
        ${passiveActionIcons()}
      </div>
    </div>
  `;
}

function makeCommentThreadHTML(comment) {
  const commentId = getCommentId(comment);
  const replies = Array.isArray(comment.replies) ? comment.replies : [];
  const commentNickname = getNicknameFromData(comment);
  const commentProfileSource = getProfileImageFromData(comment);
  const commentProfileImage = resolveProfileImage(commentProfileSource);

  return `
    <div class="comment-thread" data-comment-id="${commentId}">
      <div class="reply">
        <img
          src="${escapeHtml(commentProfileImage)}"
          class="reply-profile"
          alt="comment-user"
          data-profile-nickname="${escapeHtml(commentNickname)}"
          data-profile-source="${escapeHtml(commentProfileSource)}"
        >
        <div class="reply-content">
          <span class="reply-user">${escapeHtml(comment.userNickname || "익명")}</span>
          <div class="reply-body">${escapeHtml(comment.content || "")}</div>
        </div>
        <div class="reply-actions">
          <div class="action"><img src="images/ui/like.webp" alt="좋아요"><span>0</span></div>
          <div class="action"><img src="images/ui/like.webp" class="rotate-180" alt="싫어요"><span>0</span></div>
          <div class="action reply-toggle-btn" role="button" tabindex="0" aria-label="대댓글 작성">
            <img src="images/ui/comment.webp" alt="댓글">
          </div>
        </div>
      </div>
      <div class="nested-reply-form" style="display:none;">
        <img src="${escapeHtml(currentViewerProfileImage)}" class="reply-profile" alt="me">
        <input type="text" class="nested-reply-input" placeholder="대댓글을 입력하세요">
        <button type="button" class="nested-reply-cancel-btn">취소</button>
        <button type="button" class="nested-reply-submit-btn">등록</button>
      </div>
      <div class="nested-replies">
        ${replies.map(makeReplyHTML).join("")}
      </div>
    </div>
  `;
}

function makeReviewHTML(review) {
  const reviewNickname = getNicknameFromData(review);
  const reviewProfileSource = getProfileImageFromData(review);
  const reviewProfileImage = resolveProfileImage(reviewProfileSource);

  return `
    <article class="review" data-review-id="${review.reviewId}">
      <div class="review-top">
        <img
          src="${escapeHtml(reviewProfileImage)}"
          alt="User"
          data-profile-nickname="${escapeHtml(reviewNickname)}"
          data-profile-source="${escapeHtml(reviewProfileSource)}"
        >
        <span class="user">${escapeHtml(review.userNickname || "익명")}</span>
        <span class="star">${starRatingHTML(review.rating)}</span>
      </div>
      <p>${escapeHtml(review.content || "")}</p>

      <div class="review-actions">
        <div class="action-row">
          ${reviewActionIcons(review)}
        </div>

        <div class="action comment-btn" data-count="0" style="display:none;">
          <span class="reply-count">답글 0개</span>
          <img src="images/ui/up.png" class="reply-arrow" alt="toggle">
        </div>
      </div>

      <div class="replies" style="display:none;">
        <div class="reply-form">
          <img src="${escapeHtml(currentViewerProfileImage)}" class="reply-profile" alt="me">
          <input type="text" class="reply-input" placeholder="댓글을 입력하세요">
          <button type="button" class="cancel-btn">취소</button>
          <button type="button" class="reply-submit-btn">등록</button>
        </div>
        <div class="replies-list"></div>
      </div>
    </article>
  `;
}

function resetReviewForm() {
  const textarea = document.querySelector("#review-form textarea");
  if (textarea) textarea.value = "";

  document.querySelectorAll('input[name="rating"]').forEach((input) => {
    input.checked = false;
  });
}

function updateReviewReactionUI(reviewEl) {
  const reviewId = Number(reviewEl.dataset.reviewId);
  const state = reviewReactionState.get(reviewId);
  if (!state) return;

  reviewEl.querySelectorAll(".reaction-btn").forEach((button) => {
    const reaction = button.dataset.reaction;
    const countElement = button.querySelector("span");
    const count =
      reaction === "LIKE" ? state.likeCount : state.dislikeCount;

    button.classList.toggle("active", state.myReaction === reaction);
    if (countElement) {
      countElement.textContent = String(count);
    }
  });
}

function applyReactionChange(state, nextReaction) {
  const previousReaction = state.myReaction;

  if (previousReaction === "LIKE") {
    state.likeCount = Math.max(0, state.likeCount - 1);
  }
  if (previousReaction === "DISLIKE") {
    state.dislikeCount = Math.max(0, state.dislikeCount - 1);
  }

  state.myReaction = nextReaction;

  if (nextReaction === "LIKE") {
    state.likeCount += 1;
  }
  if (nextReaction === "DISLIKE") {
    state.dislikeCount += 1;
  }
}

async function sendReaction(reviewId, reaction) {
  const token = getToken();
  if (!token) {
    alert("로그인 후 이용 가능합니다.");
    window.location.href = "login.html";
    return;
  }

  const csrfToken = await getCsrfToken();
  const endpoint =
    reaction === null
      ? "/api/reviews/reaction/cancel"
      : reaction === "LIKE"
        ? "/api/reviews/like"
        : "/api/reviews/dislike";

  const response = await fetch(`${API}${endpoint}`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      "X-CSRF-Token": csrfToken,
    },
    body: JSON.stringify({ reviewId }),
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "반응 처리 실패"));
  }
}

async function toggleReaction(reviewEl, reaction) {
  const reviewId = Number(reviewEl.dataset.reviewId);
  if (!reviewId) return;

  const state = reviewReactionState.get(reviewId);
  if (!state) return;

  const nextReaction = state.myReaction === reaction ? null : reaction;
  const previous = { ...state };

  applyReactionChange(state, nextReaction);
  syncReactionStateToReviews(reviewId, state);
  writeStoredReactionState(reviewId, state);
  updateReviewReactionUI(reviewEl);

  try {
    await sendReaction(reviewId, nextReaction);
  } catch (error) {
    reviewReactionState.set(reviewId, previous);
    syncReactionStateToReviews(reviewId, previous);
    writeStoredReactionState(reviewId, previous);
    updateReviewReactionUI(reviewEl);
    alert(error.message || "반응 처리 실패");
  }
}

async function fillReviewProfile() {
  const token = getToken();
  const profileImg = document.querySelector(".review-input-wrap .profile");
  const writeBtn = document.querySelector(".reviews-header .write");
  if (!profileImg || !writeBtn) return;

  if (!token) {
    currentViewerProfileImage = DEFAULT_PROFILE_IMAGE;
    applyProfileImageFallback(profileImg);
    profileImg.src = DEFAULT_PROFILE_IMAGE;
    writeBtn.textContent = "리뷰 작성";
    return;
  }

  try {
    const response = await fetch(`${API}/api/auth/me`, {
      credentials: "include",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) return;

    const user = await response.json();
    currentViewerProfileImage = resolveProfileImage(user.img);
    applyProfileImageFallback(profileImg);
    profileImg.src = currentViewerProfileImage;
    writeBtn.textContent = `${user.nickname}님의 리뷰 작성`;
  } catch (error) {
    console.error("review profile load failed:", error);
  }
}

async function loadMovieDetail() {
  const movieId = getMovieId();
  if (!movieId) return;

  const response = await fetch(`${API}/api/movies/detail/${movieId}`);
  if (!response.ok) return;

  const movie = await response.json();
  const meta = document.querySelector(".detail-top .meta");
  const poster = document.querySelector(".detail-top .poster img");
  const title = document.querySelector(".detail-top .title");
  const score = document.querySelector(".detail-top .score strong");
  const summary = document.querySelector(".detail-top .summary p");

  if (meta) {
    meta.innerHTML = "";
    (movie.genres || []).forEach((genre) => {
      meta.innerHTML += `<span>${escapeHtml(genre)}</span>`;
    });
    if (movie.releaseDate) {
      meta.innerHTML += `<span>${String(movie.releaseDate).slice(0, 4)}</span>`;
    }
  }

  if (poster) poster.src = movie.posterUrl || FALLBACK_POSTER;
  if (title) title.textContent = movie.title || "";
  if (score) score.textContent = String(movie.averageRating ?? 0);
  if (summary) summary.textContent = movie.description || "";
}

async function loadRecommendedMovies() {
  const container = document.querySelector(".recommend-list");
  if (!container) return;

  try {
    const response = await fetch(`${API}/api/movies/recommended?limit=4`);
    if (!response.ok) return;

    const movies = await response.json();
    if (!Array.isArray(movies) || movies.length === 0) return;

    container.innerHTML = movies
      .map(
        (movie) => `
          <article class="movie-card" data-movie-id="${movie.id}">
            <img src="${escapeHtml(movie.posterUrl || FALLBACK_POSTER)}" alt="${escapeHtml(movie.title)}">
            <div class="movie-overlay">
              <h4>${escapeHtml(movie.title)}</h4>
              <div class="text-box">
                <p>${escapeHtml((movie.genres || []).join(", ") || "-")}</p>
                <span class="rating">★${Number(movie.averageRating || 0).toFixed(1)}</span>
              </div>
            </div>
          </article>
        `
      )
      .join("");

    container.querySelectorAll(".movie-card").forEach((card) => {
      card.addEventListener("click", () => {
        const movieId = Number(card.dataset.movieId);
        if (movieId) {
          window.location.href = `review.html?movieId=${movieId}`;
        }
      });
    });
  } catch (error) {
    console.error("recommended movies load failed:", error);
  }
}

function getVisibleReviews() {
  if (!reviewExpanded) {
    return allReviews.slice(0, REVIEWS_PREVIEW_COUNT);
  }

  if (allReviews.length <= REVIEWS_PAGE_SIZE) {
    return allReviews;
  }

  const start = (currentReviewPage - 1) * REVIEWS_PAGE_SIZE;
  return allReviews.slice(start, start + REVIEWS_PAGE_SIZE);
}

function prepareReviewFocusTarget() {
  if (!pendingFocusReviewId) return;

  const targetIndex = allReviews.findIndex(
    (review) => Number(review.reviewId) === pendingFocusReviewId,
  );
  if (targetIndex < 0) {
    pendingFocusReviewId = 0;
    return;
  }

  if (targetIndex >= REVIEWS_PREVIEW_COUNT) {
    reviewExpanded = true;
    currentReviewPage = Math.floor(targetIndex / REVIEWS_PAGE_SIZE) + 1;
  }
}

function focusTargetReview() {
  if (!pendingFocusReviewId) return;

  const reviewEl = document.querySelector(
    `.review[data-review-id="${pendingFocusReviewId}"]`,
  );
  if (!reviewEl) return;

  pendingFocusReviewId = 0;
  reviewEl.classList.remove(REVIEW_FOCUS_CLASS, REVIEW_FOCUS_ACTIVE_CLASS);
  void reviewEl.offsetWidth;
  reviewEl.classList.add(REVIEW_FOCUS_CLASS, REVIEW_FOCUS_ACTIVE_CLASS);
  reviewEl.tabIndex = -1;

  window.requestAnimationFrame(() => {
    reviewEl.scrollIntoView({ behavior: "smooth", block: "center" });
    reviewEl.focus({ preventScroll: true });
  });

  window.setTimeout(() => {
    reviewEl.classList.remove(REVIEW_FOCUS_CLASS, REVIEW_FOCUS_ACTIVE_CLASS);
    reviewEl.removeAttribute("tabindex");
  }, 2400);
}

function renderReviewPagination() {
  const pagination = document.getElementById("reviewPagination");
  if (!pagination) return;

  if (!reviewExpanded || allReviews.length <= REVIEWS_PAGE_SIZE) {
    pagination.style.display = "none";
    pagination.innerHTML = "";
    return;
  }

  const totalPages = Math.ceil(allReviews.length / REVIEWS_PAGE_SIZE);
  pagination.style.display = "flex";
  pagination.innerHTML = "";

  for (let page = 1; page <= totalPages; page += 1) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = String(page);
    button.classList.toggle("active", page === currentReviewPage);
    button.addEventListener("click", () => {
      currentReviewPage = page;
      renderReviews();
      window.scrollTo({ top: pagination.offsetTop - 120, behavior: "smooth" });
    });
    pagination.appendChild(button);
  }
}

function updateReviewControls() {
  const viewMoreButton = document.querySelector(".reviews .view-more");
  if (viewMoreButton) {
    viewMoreButton.style.display =
      !reviewExpanded && allReviews.length > REVIEWS_PREVIEW_COUNT ? "block" : "none";
  }

  renderReviewPagination();
}

function renderReplies(reviewEl) {
  const list = reviewEl.querySelector(".replies-list");
  const comments = reviewEl.__comments || [];
  if (!list) return;

  if (comments.length === 0) {
    list.innerHTML = `
      <div class="reply">
        <div class="reply-content">
          <div class="reply-body">아직 답글이 없습니다.</div>
        </div>
      </div>
    `;
    return;
  }

  list.innerHTML = comments.map(makeCommentThreadHTML).join("");
}

function getReplyCount(comments) {
  return comments.reduce((total, comment) => {
    const replies = Array.isArray(comment.replies) ? comment.replies.length : 0;
    return total + 1 + replies;
  }, 0);
}

function extractCommentsFromResponse(data) {
  if (Array.isArray(data)) return data;

  const candidates = [
    data?.comments,
    data?.data?.comments,
    data?.items,
    data?.results,
    data?.data,
  ];

  const comments = candidates.find((value) => Array.isArray(value));
  return Array.isArray(comments) ? comments : [];
}

function updateReplyCountUI(reviewEl) {
  const button = reviewEl.querySelector(".comment-btn");
  if (!button) return;

  const comments = reviewEl.__comments || [];
  const count = getReplyCount(comments);
  const text = button.querySelector(".reply-count");

  button.dataset.count = String(count);
  button.style.display = count > 0 ? "inline-flex" : "none";

  if (!text) return;
  text.innerText = button.classList.contains("open")
    ? "답글 접기"
    : `답글 ${count}개`;
}

async function loadComments(reviewEl) {
  const reviewId = Number(reviewEl.dataset.reviewId);
  if (!reviewId) return;

  const response = await fetch(`${API}/api/reviews/comment/list`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reviewId }),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const data = await response.json();
  reviewEl.__comments = Array.isArray(data.comments) ? data.comments : [];
  renderReplies(reviewEl);
  updateReplyCountUI(reviewEl);
}

function updateReplyCountUI(reviewEl) {
  const button = reviewEl.querySelector(".comment-btn");
  if (!button) return;

  const comments = reviewEl.__comments || [];
  const count = getReplyCount(comments);
  const text = button.querySelector(".reply-count");

  button.dataset.count = String(count);
  button.style.display = count > 0 ? "inline-flex" : "none";
  reviewEl.classList.toggle("has-replies", count > 0);

  if (!text) return;
  text.textContent = button.classList.contains("open")
    ? "답글 접기"
    : `답글 ${count}개`;
}

async function loadComments(reviewEl) {
  const reviewId = Number(reviewEl.dataset.reviewId);
  if (!reviewId) return;

  const response = await fetch(`${API}/api/reviews/comment/list`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reviewId }),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const data = await response.json();
  reviewEl.__comments = extractCommentsFromResponse(data);
  renderReplies(reviewEl);
  reviewEl
    .querySelectorAll(".reply-profile")
    .forEach((imgEl) => applyProfileImageFallback(imgEl));
  hydrateProfileImages(reviewEl).catch((error) => {
    console.error("comment profile image hydrate failed:", error);
  });
  updateReplyCountUI(reviewEl);
}

async function preloadCommentCounts() {
  const reviewElements = [...document.querySelectorAll(".review")];

  await Promise.all(
    reviewElements.map(async (reviewEl) => {
      try {
        await loadComments(reviewEl);
      } catch (error) {
        console.error("comment count preload failed:", error);
      }
    })
  );
}

function renderReviews() {
  const container = document.querySelector(".review-list");
  if (!container) return;

  if (allReviews.length === 0) {
    container.innerHTML = `<p>아직 작성된 리뷰가 없습니다.</p>`;
    updateReviewControls();
    return;
  }

  container.innerHTML = getVisibleReviews().map(makeReviewHTML).join("");

  document.querySelectorAll(".review").forEach((reviewEl) => {
    reviewEl.__comments = [];
    updateReplyCountUI(reviewEl);
    updateReviewReactionUI(reviewEl);
  });

  document
    .querySelectorAll(".review-top > img, .reply-profile")
    .forEach((imgEl) => applyProfileImageFallback(imgEl));

  hydrateProfileImages(container).catch((error) => {
    console.error("review profile image hydrate failed:", error);
  });

  preloadCommentCounts();
  updateReviewControls();
  focusTargetReview();
}

async function loadReviews() {
  const movieId = getMovieId();
  const container = document.querySelector(".review-list");
  if (!movieId || !container) return;

  const response = await fetch(`${API}/api/reviews/by-movie/${movieId}`);
  if (!response.ok) {
    container.innerHTML = `<p>리뷰를 불러오지 못했습니다.</p>`;
    return;
  }

  const data = await response.json();
  allReviews = Array.isArray(data.reviews) ? data.reviews : [];
  reviewReactionState.clear();
  reviewExpanded = false;
  currentReviewPage = 1;
  prepareReviewFocusTarget();
  renderReviews();
}

async function submitComment(reviewEl) {
  const reviewId = Number(reviewEl.dataset.reviewId);
  const input = reviewEl.querySelector(".reply-input");
  const content = input?.value?.trim();

  if (!reviewId) return;
  if (!content) {
    alert("댓글 내용을 입력하세요.");
    return;
  }

  const token = getToken();
  if (!token) {
    alert("로그인 후 댓글 작성이 가능합니다.");
    return;
  }

  const csrfToken = await getCsrfToken();

  const response = await fetch(`${API}/api/reviews/comment/create`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      "X-CSRF-Token": csrfToken,
    },
    body: JSON.stringify({ reviewId, content }),
  });

  if (!response.ok) {
    alert(await readErrorMessage(response, "댓글 작성 실패"));
    return;
  }

  if (input) input.value = "";
  await loadComments(reviewEl);
}

function toggleNestedReplyForm(commentEl, forceOpen) {
  const form = commentEl?.querySelector(".nested-reply-form");
  if (!form) return;

  const shouldOpen =
    typeof forceOpen === "boolean" ? forceOpen : form.style.display !== "flex";
  form.style.display = shouldOpen ? "flex" : "none";

  if (shouldOpen) {
    form.querySelector(".nested-reply-input")?.focus();
  }
}

async function submitReply(reviewEl, commentEl) {
  const commentId = Number(commentEl.dataset.commentId);
  const input = commentEl.querySelector(".nested-reply-input");
  const content = input?.value?.trim();

  if (!commentId) {
    alert("대댓글 대상을 찾을 수 없습니다.");
    return;
  }
  if (!content) {
    alert("대댓글 내용을 입력하세요.");
    return;
  }

  const token = getToken();
  if (!token) {
    alert("로그인 후 대댓글 작성이 가능합니다.");
    return;
  }

  const csrfToken = await getCsrfToken();

  const response = await fetch(`${API}/api/reviews/comment/reply/create`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      "X-CSRF-Token": csrfToken,
    },
    body: JSON.stringify({ commentId, content }),
  });

  if (!response.ok) {
    alert(await readErrorMessage(response, "대댓글 작성 실패"));
    return;
  }

  if (input) input.value = "";
  toggleNestedReplyForm(commentEl, false);
  await loadComments(reviewEl);
}

async function submitReview() {
  const movieId = Number(getMovieId());
  const content = document.querySelector("#review-form textarea")?.value?.trim();
  const rating = document.querySelector('input[name="rating"]:checked')?.value;

  if (!movieId) return;
  if (!rating || !content) {
    alert("별점과 내용을 입력하세요.");
    return;
  }

  const token = getToken();
  if (!token) {
    alert("로그인 후 리뷰 작성이 가능합니다.");
    return;
  }

  const csrfToken = await getCsrfToken();

  const response = await fetch(`${API}/api/reviews/create`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      "X-CSRF-Token": csrfToken,
    },
    body: JSON.stringify({
      movieId,
      rating: Number(rating),
      content,
    }),
  });

  if (!response.ok) {
    alert(await readErrorMessage(response, "리뷰 작성 실패"));
    return;
  }

  resetReviewForm();
  document.getElementById("review-form")?.classList.remove("show");
  await loadReviews();
  await loadMovieDetail();
  alert("리뷰가 등록되었습니다.");
}

window.toggleReviewForm = function toggleReviewForm() {
  const form = document.getElementById("review-form");
  const token = getToken();
  if (!form) return;

  if (!token) {
    alert("로그인 후 리뷰 작성이 가능합니다.");
    window.location.href = "login.html";
    return;
  }

  form.classList.toggle("show");
};

window.toggleReplies = function toggleReplies(button) {
  const review = button.closest(".review");
  const replies = review?.querySelector(".replies");
  const text = button.querySelector(".reply-count");
  if (!review || !replies || !text) return;

  const opened = replies.style.display === "block";
  if (opened) {
    replies.style.display = "none";
    button.classList.remove("open");
    updateReplyCountUI(review);
    return;
  }

  replies.style.display = "block";
  button.classList.add("open");
  text.innerText = "답글 접기";
  loadComments(review).catch((error) => {
    console.error("comment list load failed:", error);
  });
};

document.addEventListener("click", (event) => {
  const reactionButton = event.target.closest(".review .reaction-btn");
  if (reactionButton) {
    const review = reactionButton.closest(".review");
    const reaction = reactionButton.dataset.reaction;
    if (review && reaction) {
      toggleReaction(review, reaction);
    }
    return;
  }

  const commentButton = event.target.closest(".comment-btn");
  if (commentButton) {
    toggleReplies(commentButton);
    return;
  }

  const replyToggleButton = event.target.closest(".reply-toggle-btn");
  if (replyToggleButton) {
    const commentEl = replyToggleButton.closest(".comment-thread");
    if (commentEl) {
      toggleNestedReplyForm(commentEl);
      return;
    }

    const review = replyToggleButton.closest(".review");
    const commentButtonInReview = review?.querySelector(".comment-btn");
    if (commentButtonInReview) {
      toggleReplies(commentButtonInReview);
    }
    return;
  }

  const cancelButton = event.target.closest(".cancel-btn");
  if (cancelButton) {
    const replies = cancelButton.closest(".replies");
    const review = replies?.closest(".review");
    const commentButtonInReview = review?.querySelector(".comment-btn");
    if (!replies || !review || !commentButtonInReview) return;

    replies.style.display = "none";
    commentButtonInReview.classList.remove("open");
    updateReplyCountUI(review);
    return;
  }

  const nestedReplyCancelButton = event.target.closest(".nested-reply-cancel-btn");
  if (nestedReplyCancelButton) {
    const commentEl = nestedReplyCancelButton.closest(".comment-thread");
    if (commentEl) {
      toggleNestedReplyForm(commentEl, false);
    }
    return;
  }

  const replySubmitButton = event.target.closest(".reply-submit-btn");
  if (replySubmitButton) {
    const review = replySubmitButton.closest(".review");
    if (review) {
      submitComment(review);
    }
    return;
  }

  const nestedReplySubmitButton = event.target.closest(".nested-reply-submit-btn");
  if (nestedReplySubmitButton) {
    const commentEl = nestedReplySubmitButton.closest(".comment-thread");
    const review = nestedReplySubmitButton.closest(".review");
    if (commentEl && review) {
      submitReply(review, commentEl);
    }
  }
});

document.addEventListener("DOMContentLoaded", async () => {
  pendingFocusReviewId = getTargetReviewId();
  await fillReviewProfile();
  await loadMovieDetail();
  await loadReviews();
  await loadRecommendedMovies();

  const submitButton = document.querySelector(
    "#review-form .form-actions button:last-child"
  );
  if (submitButton) {
    submitButton.addEventListener("click", submitReview);
  }

  const viewMoreButton = document.querySelector(".reviews .view-more");
  if (viewMoreButton) {
    viewMoreButton.addEventListener("click", () => {
      reviewExpanded = true;
      currentReviewPage = 1;
      renderReviews();
    });
  }
});
