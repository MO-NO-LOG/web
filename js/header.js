const HEADER_ACCESS_TOKEN_KEY = "access_token";
const HEADER_API = "https://api.mono-log.fun";
const HEADER_API_HOST = new URL(HEADER_API).hostname;
const HEADER_PROFILE_IMAGE_CDN_BASE = "https://cdn.mono-log.fun/profile_images/";
const HEADER_PROFILE_IMAGE_CDN_HOST = "cdn.mono-log.fun";
const HEADER_DEFAULT_PROFILE_IMAGE = "images/default-user.png";

function resolveHeaderProfileImage(src) {
  const value = typeof src === "string" ? src.trim() : "";
  if (!value) return HEADER_DEFAULT_PROFILE_IMAGE;

  if (
    value === HEADER_DEFAULT_PROFILE_IMAGE ||
    value === `/${HEADER_DEFAULT_PROFILE_IMAGE}` ||
    /(?:^|\/)images\/default-user\.png$/i.test(value)
  ) {
    return HEADER_DEFAULT_PROFILE_IMAGE;
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
      if (url.hostname === HEADER_PROFILE_IMAGE_CDN_HOST) {
        return `https://${HEADER_PROFILE_IMAGE_CDN_HOST}${url.pathname}${url.search}${url.hash}`;
      }
      if (url.hostname !== HEADER_API_HOST) {
        return value;
      }
      return resolveHeaderProfileImage(`${url.pathname}${url.search}${url.hash}`);
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
    return HEADER_DEFAULT_PROFILE_IMAGE;
  }

  return `${HEADER_PROFILE_IMAGE_CDN_BASE}${path}${suffix}`;
}

if (!document.querySelector('script[data-logout-js="1"]')) {
  const logoutScript = document.createElement("script");
  logoutScript.src = "js/logout.js";
  logoutScript.dataset.logoutJs = "1";
  document.head.appendChild(logoutScript);
}

fetch("../header.html")
  .then((res) => res.text())
  .then((html) => {
    const header = document.querySelector("header");
    if (!header) return;

    header.innerHTML = html;

    const userMenu = header.querySelector(".user-menu");
    if (!userMenu) return;

    userMenu.innerHTML = `
      <a href="login.html">로그인</a>
      <a href="join.html">회원가입</a>
    `;

    const token = localStorage.getItem(HEADER_ACCESS_TOKEN_KEY);
    if (!token) return;

    fetch(`${HEADER_API}/api/auth/me`, {
      credentials: "include",
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (res.status === 401) {
          localStorage.removeItem(HEADER_ACCESS_TOKEN_KEY);
          return null;
        }
        if (!res.ok) return null;
        return res.json();
      })
      .then((user) => {
        if (!user) return;
        const profileImg =
          user.img && String(user.img).trim()
            ? resolveHeaderProfileImage(user.img)
            : HEADER_DEFAULT_PROFILE_IMAGE;

        userMenu.innerHTML = `
            <img src="${profileImg}" alt="user">
            ${user.nickname}
            <ul>
              <li>
                <a href="mypage.html">
                  <img src="images/ui/user-1.png" alt="mypage">
                  <span>마이페이지</span>
                </a>
              </li>
              <li>
                <a href="#" class="js-logout">
                  <img src="images/ui/exit.png" alt="logout">
                  <span>로그아웃</span>
                </a>
              </li>
            </ul>
        `;
        const profileImageEl = userMenu.querySelector('img[alt="user"]');
        if (profileImageEl) {
          profileImageEl.onerror = () => {
            profileImageEl.onerror = null;
            profileImageEl.src = HEADER_DEFAULT_PROFILE_IMAGE;
          };
        }
        userMenu.classList.add("login");
      })
      .catch((err) => console.error("header user fetch failed:", err));
  })
  .catch((err) => console.error("header load failed:", err));
