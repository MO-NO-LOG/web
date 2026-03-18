const API = "https://api.mono-log.fun";
const REQUIRE_EMAIL_VERIFY = false; // 배포 시 true

// ========================
// DOM 참조
// ========================
const genderBtns = document.querySelectorAll(".gender-btn");
const genderInput = document.getElementById("gender");
const yearSelect = document.getElementById("birthYear");
const monthSelect = document.getElementById("birthMonth");
const daySelect = document.getElementById("birthDay");
const emailInput = document.getElementById("email");
const emailCodeInput = document.getElementById("emailCode");
const sendCodeBtn = document.getElementById("sendCodeBtn");
const confirmCodeBtn = document.getElementById("confirmCodeBtn");
const verifyStatusText = document.getElementById("verifyStatusText");
let isEmailVerified = false;

// ========================
// 유틸 함수
// ========================
function pad2(v) {
  return String(v).padStart(2, "0");
}

function getDaysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

function detailMessage(data, fallback) {
  if (!data) return fallback;
  if (typeof data.detail === "string") return data.detail;
  if (Array.isArray(data.detail) && data.detail[0]?.msg)
    return data.detail[0].msg;
  return fallback;
}

// ========================
// 생년월일 셀렉트 초기화
// ========================
function fillYears() {
  const now = new Date().getFullYear();
  for (let y = now; y >= 1900; y--) {
    const opt = document.createElement("option");
    opt.value = String(y);
    opt.textContent = `${y}년`;
    yearSelect.appendChild(opt);
  }
}

function fillMonths() {
  for (let m = 1; m <= 12; m++) {
    const opt = document.createElement("option");
    opt.value = pad2(m);
    opt.textContent = `${m}월`;
    monthSelect.appendChild(opt);
  }
}

function fillDays() {
  const y = Number(yearSelect.value);
  const m = Number(monthSelect.value);

  daySelect.innerHTML = '<option value="">일</option>';
  if (!y || !m) return;

  const max = getDaysInMonth(y, m);
  for (let d = 1; d <= max; d++) {
    const opt = document.createElement("option");
    opt.value = pad2(d);
    opt.textContent = `${d}일`;
    daySelect.appendChild(opt);
  }
}

fillYears();
fillMonths();
fillDays();

// ========================
// 생년월일 변경 이벤트
// ========================
yearSelect.addEventListener("change", fillDays);
monthSelect.addEventListener("change", fillDays);

// ========================
// 이메일 인증 처리
// ========================
emailInput.addEventListener("input", () => {
  isEmailVerified = false;
  verifyStatusText.textContent = "이메일 인증 필요";
  verifyStatusText.style.color = "#ffd36b";
});

sendCodeBtn.addEventListener("click", async () => {
  const email = emailInput.value.trim();
  if (!email) {
    alert("이메일을 먼저 입력하세요.");
    return;
  }

  try {
    const res = await fetch(`${API}/api/auth/verify-email/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = await res.json();
    if (!res.ok) {
      alert(detailMessage(data, "인증코드 발송 실패"));
      return;
    }
    alert("인증코드를 보냈습니다. 이메일을 확인하세요.");
  } catch (err) {
    console.error(err);
    alert("인증코드 발송 중 오류가 발생했습니다.");
  }
});

confirmCodeBtn.addEventListener("click", async () => {
  const email = emailInput.value.trim();
  const code = emailCodeInput.value.trim();
  if (!email || !code) {
    alert("이메일과 인증코드를 입력하세요.");
    return;
  }

  try {
    const res = await fetch(`${API}/api/auth/verify-email/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, code }),
    });
    const data = await res.json();
    if (!res.ok) {
      isEmailVerified = false;
      verifyStatusText.textContent = "인증 실패";
      verifyStatusText.style.color = "#ff7b7b";
      alert(detailMessage(data, "이메일 인증 실패"));
      return;
    }
    isEmailVerified = true;
    verifyStatusText.textContent = "이메일 인증 완료";
    verifyStatusText.style.color = "#7dff8a";
    alert("이메일 인증이 완료되었습니다.");
  } catch (err) {
    console.error(err);
    alert("이메일 인증 중 오류가 발생했습니다.");
  }
});

// ========================
// 성별 선택 처리
// ========================
genderBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    genderBtns.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    genderInput.value = btn.dataset.gender === "male" ? "M" : "F";
  });
});

// ========================
// 회원가입 제출 처리
// ========================
document.querySelector("form").addEventListener("submit", async (e) => {
  e.preventDefault();

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  const repassword = document.getElementById("repassword").value;
  const nickname = document.getElementById("nickname").value.trim();
  const gender = genderInput.value;

  const y = yearSelect.value;
  const m = monthSelect.value;
  const d = daySelect.value;
  const birth_date = y && m && d ? `${y}-${m}-${d}` : null;

  // ===== 입력 검증 =====
  if (!email || !password || !nickname) {
    alert("필수 항목을 모두 입력하세요.");
    return;
  }

  if (password !== repassword) {
    alert("비밀번호가 일치하지 않습니다.");
    return;
  }

  if (!gender) {
    alert("성별을 선택하세요.");
    return;
  }

  if (!birth_date) {
    alert("생년월일을 선택하세요.");
    return;
  }

  if (REQUIRE_EMAIL_VERIFY && !isEmailVerified) {
    try {
      const statusRes = await fetch(`${API}/api/auth/verify-email/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const statusData = await statusRes.json();
      isEmailVerified = Boolean(statusData.verified);
    } catch (err) {
      console.error(err);
    }
  }

  if (REQUIRE_EMAIL_VERIFY && !isEmailVerified) {
    alert("이메일 인증을 완료한 뒤 회원가입하세요.");
    return;
  }

  // ===== 회원가입 API 요청 =====
  try {
    const res = await fetch(`${API}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        password,
        nickname,
        gender,
        birth_date,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      alert(typeof data.detail === "string" ? data.detail : "회원가입 실패");
      return;
    }

    // ===== 가입 성공 =====
    alert("회원가입 완료! 로그인 페이지로 이동합니다.");
    location.href = "login.html";
  } catch (err) {
    // ===== 네트워크/서버 오류 =====
    console.error(err);
    alert("서버 오류가 발생했습니다.");
  }
});
