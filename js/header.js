const HEADER_ACCESS_TOKEN_KEY = "access_token";
const HEADER_API = "https://api.mono-log.fun";
const HEADER_DEFAULT_PROFILE_IMAGE = "images/default-user.png";

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
            ? resolveProfileImage(user.img)
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

/* ====================
   햄버거 메뉴 토글
==================== */
function initHamburger() {
  const hamburger = document.querySelector(".hamburger");
  const menu = document.querySelector(".menu");
  if (!hamburger || !menu) return;

  hamburger.addEventListener("click", () => {
    const isOpen = menu.classList.toggle("open");
    hamburger.classList.toggle("open");
    hamburger.setAttribute("aria-expanded", isOpen);
    document.body.style.overflow = isOpen ? "hidden" : "";
  });

  /* 메뉴 링크 클릭 시 닫기 */
  menu.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      menu.classList.remove("open");
      hamburger.classList.remove("open");
      hamburger.setAttribute("aria-expanded", "false");
      document.body.style.overflow = "";
    });
  });
}

/* 햄버거가 DOM에 추가된 후 실행 */
const observer = new MutationObserver(() => {
  if (document.querySelector(".hamburger")) {
    initHamburger();
    observer.disconnect();
  }
});
observer.observe(document.body, { childList: true, subtree: true });
