const API = "https://api.mono-log.fun";
const ACCESS_TOKEN_KEY = "access_token";
const DEFAULT_PROFILE_IMAGE = "images/default-user.png";
const FALLBACK_POSTER = "images/ui/break.png";
const PAGE_SIZE = 20;

const PROFILE_IMAGE_CDN_BASE = "https://cdn.mono-log.fun/profile_images/";
const PROFILE_IMAGE_CDN_HOST = "cdn.mono-log.fun";
const API_HOST = new URL(API).hostname;

const state = {
  me: null,
  section: "dashboard",
  users: { page: 1, data: [] },
  movies: { page: 1, data: [] },
  reviews: { page: 1, data: [] },
  editingUserId: null,
  editingMovieId: null,
  confirmAction: null,
  csrfToken: null,
};

// ───────── 유틸 ─────────
function getToken() {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

function authHeaders() {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function readCookie(name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = document.cookie.match(new RegExp(`(?:^|; )${escaped}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : "";
}

async function getCsrfToken() {
  const cookieToken = readCookie("csrf_token");
  if (cookieToken) {
    state.csrfToken = cookieToken;
    return cookieToken;
  }
  if (state.csrfToken) return state.csrfToken;

  const response = await fetch(`${API}/api/auth/csrf`, {
    credentials: "include",
  });
  if (!response.ok) throw new Error(`CSRF ${response.status}`);

  const data = await response.json();
  state.csrfToken = readCookie("csrf_token") || data.csrfToken || null;
  if (!state.csrfToken) throw new Error("CSRF token missing");
  return state.csrfToken;
}

async function api(path, options = {}) {
  const method = (options.method || "GET").toUpperCase();
  const isStateChange = !["GET", "HEAD", "OPTIONS"].includes(method);

  const buildHeaders = async () => {
    const headers = { "Content-Type": "application/json", ...authHeaders() };
    if (isStateChange) headers["X-CSRF-Token"] = await getCsrfToken();
    return headers;
  };

  const doFetch = async () => {
    const res = await fetch(`${API}${path}`, {
      credentials: "include",
      headers: await buildHeaders(),
      ...options,
    });
    return res;
  };

  let res = await doFetch();

  // CSRF 토큰 만료/무효 시 리프레시 후 1회 재시도
  if (res.status === 403 && isStateChange) {
    let code = null;
    try {
      const body = await res.clone().json();
      code = body.code;
    } catch {
      /* ignore */
    }
    if (code === "CSRF_INVALID") {
      state.csrfToken = null;
      res = await doFetch();
    }
  }

  if (res.status === 401) {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    location.href = "login.html";
    throw new Error("Unauthorized");
  }
  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      detail = body.detail || body.message || detail;
    } catch {
      /* ignore */
    }
    throw new Error(detail);
  }
  if (res.status === 204) return null;
  return res.json();
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
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

function resolveProfileImage(src) {
  const value = typeof src === "string" ? src.trim() : "";
  if (!value) return DEFAULT_PROFILE_IMAGE;
  if (
    value === DEFAULT_PROFILE_IMAGE ||
    /(?:^|\/)images\/default-user\.png$/i.test(value)
  )
    return DEFAULT_PROFILE_IMAGE;
  if (value.startsWith("blob:") || value.startsWith("data:")) return value;
  if (value.startsWith("//")) return `https:${value}`;
  if (/^https?:\/\//i.test(value)) {
    try {
      const url = new URL(value);
      if (url.hostname === PROFILE_IMAGE_CDN_HOST)
        return `https://${PROFILE_IMAGE_CDN_HOST}${url.pathname}`;
      if (url.hostname !== API_HOST) return value;
      return resolveProfileImage(`${url.pathname}${url.search}`);
    } catch {
      return value;
    }
  }
  const path = value.replace(/^\/+/, "").replace(/^api\/file\/profile-image\/+/i, "");
  if (!path) return DEFAULT_PROFILE_IMAGE;
  return `${PROFILE_IMAGE_CDN_BASE}${path}`;
}

function toast(message, type = "success") {
  const el = document.getElementById("toast");
  el.textContent = message;
  el.className = `toast show ${type}`;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => {
    el.className = "toast";
  }, 2800);
}

function showGuard(message) {
  document.body.innerHTML = `
    <div class="admin-guard">
      <p>${escapeHtml(message)}</p>
      <a class="btn btn-primary" href="login.html">로그인으로 이동</a>
    </div>
  `;
}

// ───────── 모달 ─────────
function openModal(id) {
  document.getElementById(id).classList.add("active");
}

function closeModal(id) {
  document.getElementById(id).classList.remove("active");
}

document.querySelectorAll(".modal-overlay").forEach((overlay) => {
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay || e.target.dataset.close !== undefined) {
      overlay.classList.remove("active");
    }
  });
});

function confirmAction(message, onConfirm) {
  document.getElementById("confirmMessage").textContent = message;
  state.confirmAction = onConfirm;
  openModal("confirmModal");
}

document.getElementById("confirmOk").addEventListener("click", async () => {
  closeModal("confirmModal");
  const action = state.confirmAction;
  state.confirmAction = null;
  if (action) await action();
});

// ───────── 내비게이션 ─────────
function switchSection(name) {
  state.section = name;
  document.querySelectorAll(".admin-nav-item").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.section === name);
  });
  document.querySelectorAll(".admin-section").forEach((sec) => {
    sec.classList.toggle("active", sec.id === `section-${name}`);
  });
  document.getElementById("adminSidebar").classList.remove("open");

  if (name === "dashboard") loadDashboard();
  else if (name === "users") loadUsers();
  else if (name === "movies") loadMovies();
  else if (name === "reviews") loadReviews();
}

document.querySelectorAll(".admin-nav-item").forEach((btn) => {
  btn.addEventListener("click", () => switchSection(btn.dataset.section));
});

document.querySelectorAll("[data-goto]").forEach((btn) => {
  btn.addEventListener("click", () => switchSection(btn.dataset.goto));
});

document.getElementById("sidebarToggle").addEventListener("click", () => {
  document.getElementById("adminSidebar").classList.toggle("open");
});

document.getElementById("adminLogout").addEventListener("click", () => {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  location.href = "login.html";
});

// ───────── 대시보드 ─────────
async function loadDashboard() {
  try {
    const data = await api("/api/admin/dashboard");
    document.getElementById("statUsers").textContent = data.totalUsers;
    document.getElementById("statMovies").textContent = data.totalMovies;
    document.getElementById("statReviews").textContent = data.totalReviews;
    renderRecentUsers(data.recentUsers || []);
    renderRecentReviews(data.recentReviews || []);
  } catch (err) {
    toast(err.message, "error");
  }
}

function renderRecentUsers(users) {
  const body = document.getElementById("recentUsersBody");
  if (!users.length) {
    body.innerHTML = `<tr class="admin-empty-row"><td colspan="4">데이터 없음</td></tr>`;
    return;
  }
  body.innerHTML = users
    .map(
      (u) => `
      <tr>
        <td>
          <div class="user-cell">
            <img src="${escapeHtml(resolveProfileImage(u.img))}" alt="" onerror="this.src='${DEFAULT_PROFILE_IMAGE}'">
            <div>
              <div class="user-cell-name">${escapeHtml(u.nickname)}</div>
              <div class="user-cell-uid">#${u.uid}</div>
            </div>
          </div>
        </td>
        <td>${escapeHtml(u.email)}</td>
        <td>${u.reviewCount ?? 0}</td>
        <td>${formatDate(u.createdAt)}</td>
      </tr>`,
    )
    .join("");
}

function renderRecentReviews(reviews) {
  const body = document.getElementById("recentReviewsBody");
  if (!reviews.length) {
    body.innerHTML = `<tr class="admin-empty-row"><td colspan="4">데이터 없음</td></tr>`;
    return;
  }
  body.innerHTML = reviews
    .map(
      (r) => `
      <tr>
        <td>${escapeHtml(r.userNickname)}</td>
        <td class="cell-ellipsis">${escapeHtml(r.movieTitle)}</td>
        <td><span class="rating-badge">★ ${Number(r.rating).toFixed(1)}</span></td>
        <td>${formatDate(r.createdAt)}</td>
      </tr>`,
    )
    .join("");
}

// ───────── 사용자 관리 ─────────
async function loadUsers() {
  const body = document.getElementById("usersBody");
  body.innerHTML = `<tr class="admin-loading-row"><td colspan="7">불러오는 중…</td></tr>`;
  try {
    const data = await api(
      `/api/admin/users?page=${state.users.page}&size=${PAGE_SIZE}`,
    );
    state.users.data = data;
    renderUsers(data);
  } catch (err) {
    body.innerHTML = `<tr class="admin-empty-row"><td colspan="7">${escapeHtml(err.message)}</td></tr>`;
  }
}

function renderUsers(users) {
  const body = document.getElementById("usersBody");
  if (!users.length) {
    body.innerHTML = `<tr class="admin-empty-row"><td colspan="7">사용자가 없습니다.</td></tr>`;
    return;
  }
  body.innerHTML = users
    .map(
      (u) => `
      <tr>
        <td class="col-id">${u.uid}</td>
        <td>
          <div class="user-cell">
            <img src="${escapeHtml(resolveProfileImage(u.img))}" alt="" onerror="this.src='${DEFAULT_PROFILE_IMAGE}'">
            <div class="user-cell-name">${escapeHtml(u.nickname)}</div>
          </div>
        </td>
        <td>${escapeHtml(u.email)}</td>
        <td>${escapeHtml(u.gender || "-")}</td>
        <td>${u.reviewCount ?? 0}</td>
        <td>${formatDate(u.createdAt)}</td>
        <td>
          <div class="row-actions">
            <button class="icon-btn" title="수정" data-edit-user="${u.uid}">✎</button>
            <button class="icon-btn danger" title="삭제" data-del-user="${u.uid}">🗑</button>
          </div>
        </td>
      </tr>`,
    )
    .join("");

  body.querySelectorAll("[data-edit-user]").forEach((btn) => {
    btn.addEventListener("click", () => openUserModal(Number(btn.dataset.editUser)));
  });
  body.querySelectorAll("[data-del-user]").forEach((btn) => {
    btn.addEventListener("click", () => deleteUser(Number(btn.dataset.delUser)));
  });
  renderPagination("usersPagination", state.users.page, users.length, loadUsers, (p) => {
    state.users.page = p;
  });
}

function openUserModal(uid) {
  const user = state.users.data.find((u) => u.uid === uid);
  if (!user) return;
  state.editingUserId = uid;
  const form = document.getElementById("userForm");
  form.nickname.value = user.nickname || "";
  form.email.value = user.email || "";
  form.gender.value = user.gender || "";
  form.bio.value = user.bio || "";
  openModal("userModal");
}

document.getElementById("userForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const form = e.target;
  const payload = {
    nickname: form.nickname.value.trim(),
    email: form.email.value.trim(),
    gender: form.gender.value || null,
    bio: form.bio.value.trim() || null,
  };
  try {
    await api(`/api/admin/users/${state.editingUserId}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
    closeModal("userModal");
    toast("사용자 정보가 수정되었습니다.");
    loadUsers();
  } catch (err) {
    toast(err.message, "error");
  }
});

function deleteUser(uid) {
  if (uid === state.me?.uid) {
    toast("본인 계정은 삭제할 수 없습니다.", "error");
    return;
  }
  confirmAction("이 사용자를 삭제하시겠습니까?", async () => {
    try {
      await api(`/api/admin/users/${uid}`, { method: "DELETE" });
      toast("사용자가 삭제되었습니다.");
      loadUsers();
    } catch (err) {
      toast(err.message, "error");
    }
  });
}

// ───────── 영화 관리 ─────────
async function loadMovies() {
  const body = document.getElementById("moviesBody");
  body.innerHTML = `<tr class="admin-loading-row"><td colspan="7">불러오는 중…</td></tr>`;
  try {
    const data = await api(
      `/api/admin/movies?page=${state.movies.page}&size=${PAGE_SIZE}`,
    );
    state.movies.data = data;
    renderMovies(data);
  } catch (err) {
    body.innerHTML = `<tr class="admin-empty-row"><td colspan="7">${escapeHtml(err.message)}</td></tr>`;
  }
}

function renderMovies(movies) {
  const body = document.getElementById("moviesBody");
  if (!movies.length) {
    body.innerHTML = `<tr class="admin-empty-row"><td colspan="7">영화가 없습니다.</td></tr>`;
    return;
  }
  body.innerHTML = movies
    .map(
      (m) => `
      <tr>
        <td><img class="poster-cell" src="${escapeHtml(m.posterUrl || FALLBACK_POSTER)}" alt="" onerror="this.src='${FALLBACK_POSTER}'"></td>
        <td>${escapeHtml(m.title)}</td>
        <td>${escapeHtml(m.director || "-")}</td>
        <td>${formatDate(m.releaseDate)}</td>
        <td><span class="rating-badge">★ ${Number(m.averageRating).toFixed(1)}</span></td>
        <td>${m.reviewCount ?? 0}</td>
        <td>
          <div class="row-actions">
            <button class="icon-btn" title="수정" data-edit-movie="${m.mid}">✎</button>
            <button class="icon-btn danger" title="삭제" data-del-movie="${m.mid}">🗑</button>
          </div>
        </td>
      </tr>`,
    )
    .join("");

  body.querySelectorAll("[data-edit-movie]").forEach((btn) => {
    btn.addEventListener("click", () => openMovieModal(Number(btn.dataset.editMovie)));
  });
  body.querySelectorAll("[data-del-movie]").forEach((btn) => {
    btn.addEventListener("click", () => deleteMovie(Number(btn.dataset.delMovie)));
  });
  renderPagination("moviesPagination", state.movies.page, movies.length, loadMovies, (p) => {
    state.movies.page = p;
  });
}

document.getElementById("openMovieModal").addEventListener("click", () => {
  state.editingMovieId = null;
  document.getElementById("movieModalTitle").textContent = "영화 추가";
  document.getElementById("movieForm").reset();
  openModal("movieModal");
});

function openMovieModal(mid) {
  const movie = state.movies.data.find((m) => m.mid === mid);
  if (!movie) return;
  state.editingMovieId = mid;
  document.getElementById("movieModalTitle").textContent = "영화 수정";
  const form = document.getElementById("movieForm");
  form.title.value = movie.title || "";
  form.director.value = movie.director || "";
  form.releaseDate.value = movie.releaseDate || "";
  form.posterUrl.value = movie.posterUrl || "";
  form.genres.value = "";
  form.description.value = "";
  openModal("movieModal");
}

document.getElementById("movieForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const form = e.target;
  const isEdit = state.editingMovieId !== null;
  const payload = {
    title: form.title.value.trim(),
    director: form.director.value.trim() || null,
    releaseDate: form.releaseDate.value || null,
    posterUrl: form.posterUrl.value.trim() || null,
    description: form.description.value.trim() || null,
  };
  if (!isEdit) {
    payload.genres = form.genres.value
      .split(",")
      .map((g) => g.trim())
      .filter(Boolean);
  }
  try {
    if (isEdit) {
      await api(`/api/admin/movies/${state.editingMovieId}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
    } else {
      await api("/api/admin/movies", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    }
    closeModal("movieModal");
    toast(isEdit ? "영화 정보가 수정되었습니다." : "영화가 추가되었습니다.");
    loadMovies();
  } catch (err) {
    toast(err.message, "error");
  }
});

function deleteMovie(mid) {
  confirmAction("이 영화를 삭제하시겠습니까?", async () => {
    try {
      await api(`/api/admin/movies/${mid}`, { method: "DELETE" });
      toast("영화가 삭제되었습니다.");
      loadMovies();
    } catch (err) {
      toast(err.message, "error");
    }
  });
}

// ───────── TMDB 가져오기 ─────────
document.getElementById("openTmdbModal").addEventListener("click", () => {
  document.getElementById("tmdbForm").reset();
  openModal("tmdbModal");
});

document.getElementById("tmdbForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const form = e.target;
  const btn = form.querySelector('button[type="submit"]');
  btn.disabled = true;
  btn.textContent = "가져오는 중…";
  try {
    await api("/api/admin/movies/import-tmdb", {
      method: "POST",
      body: JSON.stringify({ tmdbUrl: form.tmdbUrl.value.trim() }),
    });
    closeModal("tmdbModal");
    toast("TMDB에서 영화를 가져왔습니다.");
    loadMovies();
  } catch (err) {
    toast(err.message, "error");
  } finally {
    btn.disabled = false;
    btn.textContent = "가져오기";
  }
});

// ───────── 리뷰 관리 ─────────
async function loadReviews() {
  const body = document.getElementById("reviewsBody");
  body.innerHTML = `<tr class="admin-loading-row"><td colspan="8">불러오는 중…</td></tr>`;
  try {
    const data = await api(
      `/api/admin/reviews?page=${state.reviews.page}&size=${PAGE_SIZE}`,
    );
    state.reviews.data = data;
    renderReviews(data);
  } catch (err) {
    body.innerHTML = `<tr class="admin-empty-row"><td colspan="8">${escapeHtml(err.message)}</td></tr>`;
  }
}

function renderReviews(reviews) {
  const body = document.getElementById("reviewsBody");
  if (!reviews.length) {
    body.innerHTML = `<tr class="admin-empty-row"><td colspan="8">리뷰가 없습니다.</td></tr>`;
    return;
  }
  body.innerHTML = reviews
    .map(
      (r) => `
      <tr>
        <td class="col-id">${r.rid}</td>
        <td>${escapeHtml(r.userNickname)}</td>
        <td class="cell-ellipsis">${escapeHtml(r.movieTitle)}</td>
        <td class="cell-ellipsis">${escapeHtml(r.title || "-")}</td>
        <td><span class="rating-badge">★ ${Number(r.rating).toFixed(1)}</span></td>
        <td class="cell-ellipsis">${escapeHtml(r.content)}</td>
        <td>${formatDate(r.createdAt)}</td>
        <td>
          <div class="row-actions">
            <button class="icon-btn danger" title="삭제" data-del-review="${r.rid}">🗑</button>
          </div>
        </td>
      </tr>`,
    )
    .join("");

  body.querySelectorAll("[data-del-review]").forEach((btn) => {
    btn.addEventListener("click", () => deleteReview(Number(btn.dataset.delReview)));
  });
  renderPagination("reviewsPagination", state.reviews.page, reviews.length, loadReviews, (p) => {
    state.reviews.page = p;
  });
}

function renderPagination(containerId, page, dataLength, loader, setPage) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const hasMore = dataLength === PAGE_SIZE;
  const hasPrev = page > 1;
  if (!hasPrev && !hasMore) {
    container.innerHTML = "";
    return;
  }
  container.innerHTML = `
    <button class="page-btn" ${hasPrev ? "" : "disabled"} data-page="${page - 1}">‹ 이전</button>
    <button class="page-btn active">${page}</button>
    <button class="page-btn" ${hasMore ? "" : "disabled"} data-page="${page + 1}">다음 ›</button>
  `;
  container.querySelectorAll("[data-page]").forEach((btn) => {
    if (btn.disabled) return;
    btn.addEventListener("click", () => {
      setPage(Number(btn.dataset.page));
      loader();
    });
  });
}

function deleteReview(rid) {
  confirmAction("이 리뷰를 삭제하시겠습니까?", async () => {
    try {
      await api(`/api/admin/reviews/${rid}`, { method: "DELETE" });
      toast("리뷰가 삭제되었습니다.");
      loadReviews();
    } catch (err) {
      toast(err.message, "error");
    }
  });
}

// ───────── 초기화 ─────────
async function init() {
  const token = getToken();
  if (!token) {
    location.href = "login.html";
    return;
  }
  try {
    const me = await api("/api/auth/me");
    if (!me.is_admin) {
      showGuard("관리자 권한이 필요합니다.");
      return;
    }
    state.me = me;
    loadDashboard();
  } catch (err) {
    showGuard(err.message || "접근할 수 없습니다.");
  }
}

init();
