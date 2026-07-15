const ACCESS_TOKEN_KEY = "access_token";

function kakaoLogin() {
    location.href = "https://api.mono-log.fun/api/oauth/kakao/login";
}

function injectKakaoButton(containerId, options = {}) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const divider = document.createElement("div");
    divider.className = "oauth-divider";
    divider.innerHTML = "<span>또는</span>";

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn-kakao";
    btn.onclick = kakaoLogin;

    const label = options.label || "카카오로 시작하기";
    btn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 3C6.48 3 2 6.58 2 11c0 2.79 1.79 5.24 4.5 6.65L5.5 21l3.65-2.42c.93.18 1.89.27 2.85.27 5.52 0 10-3.58 10-8s-4.48-7.85-10-7.85z"/>
        </svg>
        ${label}
    `;

    container.appendChild(divider);
    container.appendChild(btn);
}

// On page load: if oauth_access_token cookie exists, move to localStorage and clear cookie
(function moveTokenFromCookie() {
    const match = document.cookie.match(/(?:^|; )oauth_access_token=([^;]*)/);
    if (match) {
        localStorage.setItem(ACCESS_TOKEN_KEY, decodeURIComponent(match[1]));
        document.cookie = "oauth_access_token=; max-age=0; path=/";
    }
})();
