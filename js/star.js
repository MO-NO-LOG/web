function setAllStarFill() {
	const totalHeight = 27.5;
	const startY = 1.5;

	document.querySelectorAll(".fillRect").forEach(rect => {
		const percent = rect.dataset.rating;

		const height = totalHeight * (percent / 100);
		const y = startY + (totalHeight - height);

		rect.setAttribute("y", y);
		rect.setAttribute("height", height);
	});
}


document.addEventListener("DOMContentLoaded", () => {
	document.querySelectorAll(".movie-card").forEach(card => {
		const percent = card.dataset.rating;
		if (!percent) return;

		createStarRating(card, percent);
	});
});

function createStarRating(card, percent) {
	const totalHeight = 27.5;
	const startY = 1.5;

	const height = totalHeight * (percent / 100);
	const y = startY + (totalHeight - height);

	// mask / symbol id 중복 방지
	const uid = Math.random().toString(36).slice(2, 8);
	const maskId = `mask-${uid}`;
	const starId = `star-${uid}`;
	const ratingHTML = `
	<div class="rating">
		<svg width="32" height="32"
		viewBox="2 1.5 28 27.5"
		xmlns="http://www.w3.org/2000/svg">
		<defs>
			<mask id="${maskId}">
			<rect x="2" y="${y}" width="28" height="${height}" fill="white"/>
			</mask>
			<symbol id="${starId}" viewBox="2 1.5 28 27.5">
			<path d="
				M16 1.5
				L20.5 11.5
				L30 12.5
				L22 18.5
				L24 29
				L16 23.5
				L8 29
				L10 18.5
				L2 12.5
				L11.5 11.5
				Z"/>
			</symbol>
		</defs>
		<use href="#${starId}" fill="#ddd"/>
		<use href="#${starId}" fill="#facc15" mask="url(#${maskId})"/>
		</svg>
		<span class="rating-text">${percent}%</span>
	</div>
	`;
	// 이미지 바로 아래에 삽입
	const img = card.querySelector("img");
	img.insertAdjacentHTML("afterend", ratingHTML);
}
