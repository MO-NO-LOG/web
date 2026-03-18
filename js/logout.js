const LOGOUT_API = "https://api.mono-log.fun";
const LOGOUT_ACCESS_TOKEN_KEY = "access_token";

document.addEventListener("click", async (e) => {
  const logoutLink = e.target.closest(".js-logout");
  if (!logoutLink) return;

  e.preventDefault();

  const token = localStorage.getItem(LOGOUT_ACCESS_TOKEN_KEY);

  try {
    await fetch(`${LOGOUT_API}/api/auth/logout`, {
      method: "POST",
      credentials: "include",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  } catch (err) {
    console.error("logout failed:", err);
  } finally {
    localStorage.removeItem(LOGOUT_ACCESS_TOKEN_KEY);
    window.location.href = "login.html";
  }
});
