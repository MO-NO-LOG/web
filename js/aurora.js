const canvas = document.getElementById("auroraCanvas");
const ctx = canvas.getContext("2d");

function resizeCanvas() {
	const dpr = window.devicePixelRatio || 1;
	const parent = canvas.parentElement;
	const rect = parent.getBoundingClientRect();

	canvas.width = rect.width * dpr;
	canvas.height = rect.height * dpr;

	ctx.setTransform(1, 0, 0, 1, 0, 0);
	ctx.scale(dpr, dpr);
}

window.addEventListener("resize", resizeCanvas);
resizeCanvas();

let time = 0;

function getAuroras() {
	const h = canvas.height / (window.devicePixelRatio || 1);
	return [
		{ baseY: 0.35, amp: h * 0.18, speed: 0.55, color: "rgba(150,190,255,0.28)" },
		{ baseY: 0.52, amp: h * 0.22, speed: 0.48, color: "rgba(190,160,255,0.25)" },
		{ baseY: 0.68, amp: h * 0.20, speed: 0.52, color: "rgba(210,190,255,0.23)" }
	];
}

function turbulence(x, t, seed) {
	return (
		Math.sin(x * 0.006 + t * 0.9 + seed) * 0.6 +
		Math.sin(x * 0.014 - t * 0.5 + seed * 2.1) * 0.3 +
		Math.sin(x * 0.028 + t * 0.25 + seed * 3.7) * 0.15
	);
}

function drawAurora() {
	const dpr = window.devicePixelRatio || 1;
	const width = canvas.width / dpr;
	const height = canvas.height / dpr;

	ctx.clearRect(0, 0, width, height);
	time += 0.012;

	const auroras = getAuroras();

	auroras.forEach((a, index) => {
		ctx.beginPath();

		for (let x = 0; x <= width; x += 6) {
			const noise =
				turbulence(x, time * a.speed, index * 10) *
				Math.sin(time * 0.6 + index) *
				a.amp;

			ctx.lineTo(x, height * a.baseY + noise);
		}

		ctx.lineTo(width, height);
		ctx.lineTo(0, height);
		ctx.closePath();

		const gradient = ctx.createLinearGradient(
			0,
			height * a.baseY - a.amp * 3,
			0,
			height * a.baseY + a.amp * 4
		);

		gradient.addColorStop(0, "rgba(0,0,0,0)");
		gradient.addColorStop(0.3, a.color);
		gradient.addColorStop(0.65, a.color);
		gradient.addColorStop(1, "rgba(0,0,0,0)");

		ctx.fillStyle = gradient;
		ctx.filter = `blur(${a.amp * 0.18}px)`;
		ctx.fill();
		ctx.filter = "none";
	});

	requestAnimationFrame(drawAurora);
}

drawAurora();