const API = "https://api.mono-log.fun";
const ACCESS_TOKEN_KEY = "access_token";

const params = new URLSearchParams(location.search);
const setupToken = params.get("token");
const missingFields = (params.get("missing") || "").split(",").filter(Boolean);

if (!setupToken) {
    location.href = "login.html";
}

const fieldMap = {
    email: document.getElementById("field-email"),
    nickname: document.getElementById("field-nickname"),
    gender: document.getElementById("field-gender"),
    birth_date: document.getElementById("field-birth"),
};

missingFields.forEach((field) => {
    const el = fieldMap[field];
    if (el) el.classList.remove("hidden");
});

let selectedGender = null;
document.querySelectorAll(".gender-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
        document.querySelectorAll(".gender-btn").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        selectedGender = btn.dataset.gender;
    });
});

document.getElementById("profileForm").addEventListener("submit", async (e) => {
    e.preventDefault();

    const payload = { setup_token: setupToken };

    if (missingFields.includes("email")) {
        payload.email = document.getElementById("email").value.trim();
        if (!payload.email) return alert("이메일을 입력하세요.");
    }
    if (missingFields.includes("nickname")) {
        payload.nickname = document.getElementById("nickname").value.trim();
        if (!payload.nickname) return alert("닉네임을 입력하세요.");
    }
    if (missingFields.includes("gender")) {
        payload.gender = selectedGender;
        if (!payload.gender) return alert("성별을 선택하세요.");
    }
    if (missingFields.includes("birth_date")) {
        payload.birth_date = document.getElementById("birthDate").value;
        if (!payload.birth_date) return alert("생년월일을 선택하세요.");
    }

    try {
        const res = await fetch(`${API}/api/oauth/kakao/complete-profile`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify(payload),
        });

        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            alert(data.detail || "프로필 업데이트 실패");
            return;
        }

        const data = await res.json();
        localStorage.setItem(ACCESS_TOKEN_KEY, data.access_token);
        location.href = "index.html";
    } catch (err) {
        console.error(err);
        alert("서버 오류가 발생했습니다.");
    }
});
