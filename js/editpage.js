const API = "https://api.mono-log.fun";
const ACCESS_TOKEN_KEY = "access_token";
const API_HOST = new URL(API).hostname;
const PROFILE_IMAGE_CDN_BASE = "https://cdn.mono-log.fun/profile_images/";
const PROFILE_IMAGE_CDN_HOST = "cdn.mono-log.fun";
const DEFAULT_PROFILE_IMAGE = "images/default-user.png";

const state = {
  token: localStorage.getItem(ACCESS_TOKEN_KEY) || "",
  me: null,
  currentImage: "",
};

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

  if (!path || /(?:^|\/)images\/default-user\.png$/i.test(path)) {
    return DEFAULT_PROFILE_IMAGE;
  }

  return `${PROFILE_IMAGE_CDN_BASE}${path}${suffix}`;
}

function readCookie(name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = document.cookie.match(new RegExp(`(?:^|; )${escaped}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : "";
}

async function getCsrfToken() {
  const cookieToken = readCookie("csrf_token");
  if (cookieToken) return cookieToken;

  const response = await fetch(`${API}/api/auth/csrf`, {
    credentials: "include",
  });
  if (!response.ok) {
    throw new Error(`CSRF ${response.status}`);
  }

  const data = await response.json();
  return readCookie("csrf_token") || data.csrfToken || "";
}

async function readErrorMessage(response, fallback) {
  try {
    const data = await response.json();
    if (typeof data.message === "string" && data.message.trim()) {
      return data.message;
    }
    if (typeof data.detail === "string" && data.detail.trim()) {
      return data.detail;
    }
  } catch {}
  return fallback;
}

function showToast(message, isError = false) {
  const toast = document.getElementById("toast");
  if (!toast) return;

  toast.textContent = message;
  toast.classList.remove("hidden", "error");
  if (isError) {
    toast.classList.add("error");
  }

  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => {
    toast.classList.add("hidden");
  }, 2600);
}

function setProfileImage(src) {
  const image = document.getElementById("profilePreview");
  if (!image) return;
  image.onerror = () => {
    image.onerror = null;
    image.src = DEFAULT_PROFILE_IMAGE;
  };
  image.src = src && String(src).trim() ? resolveProfileImage(src) : DEFAULT_PROFILE_IMAGE;
}

function openImagePicker() {
  document.getElementById("profileImageInput")?.click();
}

function updateBioCounter() {
  const bio = document.getElementById("bio");
  const bioCount = document.getElementById("bioCount");
  if (!bio || !bioCount) return;
  bioCount.textContent = String(bio.value.length);
}

function fillForm(user) {
  document.getElementById("email").value = user.email || "";
  document.getElementById("nickname").value = user.nickname || "";
  document.getElementById("bio").value = user.bio || "";
  document.getElementById("password").value = "";
  document.getElementById("passwordConfirm").value = "";

  state.currentImage = user.img || "";
  setProfileImage(state.currentImage);
  updateBioCounter();
}

async function fetchMe() {
  const response = await fetch(`${API}/api/auth/me`, {
    credentials: "include",
    headers: {
      Authorization: `Bearer ${state.token}`,
    },
  });

  if (response.status === 401) {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    window.location.href = "login.html";
    return null;
  }

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const user = await response.json();
  state.me = user;
  fillForm(user);
  return user;
}

async function uploadProfileImage(file) {
  if (!file) return;

  const csrfToken = await getCsrfToken();
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${API}/api/file/profile-image`, {
    method: "POST",
    credentials: "include",
    headers: {
      Authorization: `Bearer ${state.token}`,
      "X-CSRF-Token": csrfToken,
    },
    body: formData,
  });

  if (!response.ok) {
    throw new Error(
      await readErrorMessage(response, "프로필 이미지 업로드에 실패했습니다."),
    );
  }

  await fetchMe();
  showToast("프로필 이미지를 변경했습니다.");
}

async function deleteProfileImage() {
  const csrfToken = await getCsrfToken();

  const response = await fetch(`${API}/api/file/profile-image`, {
    method: "DELETE",
    credentials: "include",
    headers: {
      Authorization: `Bearer ${state.token}`,
      "X-CSRF-Token": csrfToken,
    },
  });

  if (!response.ok) {
    throw new Error(
      await readErrorMessage(response, "프로필 이미지 삭제에 실패했습니다."),
    );
  }

  state.currentImage = "";
  setProfileImage("");
  await fetchMe();
  showToast("프로필 이미지를 삭제했습니다.");
}

async function saveProfile(event) {
  event.preventDefault();

  const password = document.getElementById("password").value;
  const passwordConfirm = document.getElementById("passwordConfirm").value;

  if (password || passwordConfirm) {
    if (password !== passwordConfirm) {
      throw new Error("비밀번호와 비밀번호 확인이 일치하지 않습니다.");
    }
  }

  const payload = {
    nickname: document.getElementById("nickname").value.trim() || null,
    bio: document.getElementById("bio").value.trim() || null,
    img: state.currentImage || null,
  };

  const csrfToken = await getCsrfToken();
  const response = await fetch(`${API}/api/auth/me/edit`, {
    method: "PUT",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${state.token}`,
      "X-CSRF-Token": csrfToken,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(
      await readErrorMessage(response, "프로필 저장에 실패했습니다."),
    );
  }

  const user = await response.json();
  state.me = user;
  state.currentImage = user.img || state.currentImage || "";
  fillForm(user);
  window.location.href = "mypage.html";
}

function bindEvents() {
  document
    .getElementById("editProfileForm")
    ?.addEventListener("submit", async (event) => {
      try {
        await saveProfile(event);
      } catch (error) {
        console.error("profile save failed:", error);
        showToast(error.message || "프로필 저장에 실패했습니다.", true);
      }
    });

  document.getElementById("bio")?.addEventListener("input", updateBioCounter);
  document
    .getElementById("changeImageBtn")
    ?.addEventListener("click", openImagePicker);
  document
    .getElementById("avatarEditBtn")
    ?.addEventListener("click", openImagePicker);
  document
    .getElementById("profilePreview")
    ?.addEventListener("click", openImagePicker);

  document
    .getElementById("profileImageInput")
    ?.addEventListener("change", async (event) => {
      const file = event.target.files?.[0];
      if (!file) return;

      const previewUrl = URL.createObjectURL(file);
      setProfileImage(previewUrl);

      try {
        await uploadProfileImage(file);
      } catch (error) {
        console.error("profile image upload failed:", error);
        showToast(error.message || "이미지 업로드에 실패했습니다.", true);
        setProfileImage(state.currentImage);
      } finally {
        URL.revokeObjectURL(previewUrl);
        event.target.value = "";
      }
    });

  document
    .getElementById("deleteImageBtn")
    ?.addEventListener("click", async () => {
      try {
        await deleteProfileImage();
      } catch (error) {
        console.error("profile image delete failed:", error);
        showToast(error.message || "이미지 삭제에 실패했습니다.", true);
      }
    });
}

async function init() {
  if (!state.token) {
    window.location.href = "login.html";
    return;
  }

  bindEvents();

  try {
    await fetchMe();
  } catch (error) {
    console.error("editpage load failed:", error);
    showToast("프로필 정보를 불러오지 못했습니다.", true);
  }
}

init();
