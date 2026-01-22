let current = "";

function openPopup(type) {
    current = type;

    const modal = document.getElementById("modal");
    const box = document.getElementById("modalBox");
    const title = document.getElementById("modal-title");
    const body = document.getElementById("modal-body");

    modal.classList.remove("hidden");

    // 🔥 핵심: 기존 타입 클래스 제거
    box.className = "modal-box";

    // 🔥 핵심: 현재 타입 클래스 추가
    box.classList.add(type);

    if (type === "nickname") {
        title.innerText = "닉네임 변경";
        body.innerHTML = `
            <p class="guide">새 닉네임</p>
            <input placeholder="새 닉네임 입력" />
            <p class="guide">닉네임은 변경 후 7일 이내에 다시 변경할 수 있습니다.</p>
        `;
    }

    if (type === "id") {
        title.innerText = "아이디 변경";
        body.innerHTML = `
            <p class="guide">새로운 아이디</p>
            <input placeholder="새 아이디 입력" />
            <p class="guide">아이디는 변경 후 14일 이내에 다시 변경할 수 있습니다.</p>
        `;
    }

    if (type === "email") {
        title.innerText = "이메일 변경";
        body.innerHTML = `
            <p class="guide">새 이메일 주소</p>
            <input type="email" class="email2" placeholder="example@gmail.com" />
            <button class="send-code">코드 전송</button>
            <p class="guide">인증 코드</p>
            <input type="password" placeholder="인증코드 6자리를 입력해주세요" />`;
    }

    if (type === "password") {
        title.innerText = "비밀번호 변경";
        body.innerHTML = `
            <p class="guide">새 비밀번호</p>
            <input type="password" placeholder="새 비밀번호 (8자 이상)" />
            <p class="guide">새 비밀번호 확인</p>
            <input type="password" placeholder="비밀번호 재확인" />
        `;
    }
}


function closeModal() {
    document.getElementById("modal").classList.add("hidden");
}

function outsideClose(e) {
    if (e.target.id === "modal") closeModal();
}

function saveChange() {
    closeModal();

    const toast = document.getElementById("toast");
    const msg = {
        nickname: "✅ 닉네임이 성공적으로 변경되었습니다.",
        id: "✅ 아이디가 성공적으로 변경되었습니다.",
        email: "✅ 이메일이 성공적으로 변경되었습니다.",
        password: "✅ 비밀번호가 성공적으로 변경되었습니다."
    };

    toast.innerText = msg[current];
    toast.classList.remove("hidden");
    setTimeout(() => toast.classList.add("hidden"), 3000);
}
