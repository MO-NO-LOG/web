const images = [];
for (let i = 1; i <= 55; i++) {
  images.push(`images/imgnum/${i}.webp`);
}

document.querySelectorAll(".slider-track").forEach((track) => {
  const startIdx = parseInt(track.dataset.start) || 0;
  const ordered = images.slice(startIdx).concat(images.slice(0, startIdx));
  // duplicate for seamless loop
  const sequence = ordered.concat(ordered);
  track.innerHTML = sequence
    .map((src) => `<img src="${src}" alt="">`)
    .join("");
});
