const HEADER_ACCESS_TOKEN_KEY = "access_token";
const HEADER_API = "https://api.mono-log.fun";

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
            ? user.img
            : "/images/default-user.png";

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
        userMenu.classList.add("login");
      })
      .catch((err) => console.error("header user fetch failed:", err));
  })
  .catch((err) => console.error("header load failed:", err));
