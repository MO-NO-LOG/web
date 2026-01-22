// @ts-nocheck
const sliderTracks = document.querySelectorAll('.slider-track');

// 이미지 배열
const images = [];
for (let i = 1; i <= 55; i++) {
    images.push(`images/imgnum/${i}.webp`);
}

sliderTracks.forEach(track => {
    const direction = track.dataset.direction || 'left';
    const speedRatio = parseFloat(track.dataset.speed) || 0.15; // 화면 대비 속도
    const startIndex = parseInt(track.dataset.start) || 0;

    // 이미지 생성
    images.forEach(src => {
        const img = document.createElement('img');
        img.src = src;
        track.appendChild(img);
    });

    // clone (무한 루프용)
    images.forEach(src => {
        const img = document.createElement('img');
        img.src = src;
        track.appendChild(img);
    });

    let x = 0;
    let imgWidth = 0;
    let totalWidth = 0;
    let containerWidth = 0;

    let lastTime = performance.now();

    function recalc() {
        const container = track.parentElement;
        containerWidth = container.getBoundingClientRect().width;

        const firstImg = track.querySelector('img');
        if (!firstImg) return;

        const gap = 20;
        imgWidth = firstImg.getBoundingClientRect().width + gap;
        totalWidth = imgWidth * images.length;

        const safeIndex = startIndex % images.length;
        x = -imgWidth * safeIndex;

        if (direction === 'right') {
            x -= totalWidth;
        }
    }

    function animate(now) {
        const deltaTime = (now - lastTime) / 1000;
        lastTime = now;

        const move = containerWidth * speedRatio * deltaTime;
        x -= direction === 'left' ? move : -move;

        if (direction === 'left') {
            if (Math.abs(x) >= totalWidth) x += totalWidth;
        } else {
            if (x >= 0) x -= totalWidth;
        }

        track.style.transform = `translateX(${x}px)`;
        requestAnimationFrame(animate);
    }

    // 이미지 로드 완료 후 시작
    const imgs = track.querySelectorAll('img');
    let loaded = 0;

    imgs.forEach(img => {
        img.onload = () => {
            loaded++;
            if (loaded === images.length) {
                recalc();
                requestAnimationFrame(animate);
            }
        };
    });

    // 반응형 대응
    window.addEventListener('resize', recalc);
});
