function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

fetch("/api/sounds")
  .then(res => {
    if (!res.ok) throw new Error("API request failed");
    return res.json();
  })
  .then(files => {
    const container = document.getElementById("sounds");
    container.innerHTML = "";

    if (!files.length) {
      container.innerHTML = "<p>No MP3s found 😢</p>";
      return;
    }

    files.forEach(file => {
      const div = document.createElement("div");
      div.className = "sound-item";
      div.innerHTML = `
        <div class="sound-title">${file}</div>
        <div class="custom-player">
          <button class="play-btn"><img src='/play.svg' alt='Play' style='width: 20px; height: 20px;'></button>
          <div class="progress"><div class="progress-bar"></div></div>
          <div class="time">0:00</div>
        </div>
      `;

      const audio = new Audio(`/sfx/${encodeURIComponent(file)}`);
      audio.preload = "none";

      const playBtn = div.querySelector(".play-btn");
      const progress = div.querySelector(".progress");
      const progressBar = div.querySelector(".progress-bar");
      const timeText = div.querySelector(".time");

      let isPlaying = false;

      playBtn.addEventListener("click", () => {
        if (isPlaying) {
          audio.pause();
        } else {
          audio.play();
        }
      });

      audio.addEventListener("play", () => {
        isPlaying = true;
        playBtn.innerHTML = "<img src='/pause.svg' alt='Pause' style='width: 20px; height: 20px;'>";
      });

      audio.addEventListener("pause", () => {
        isPlaying = false;
        playBtn.innerHTML = "<img src='/play.svg' alt='Play' style='width: 20px; height: 20px;'>";
      });

      audio.addEventListener("timeupdate", () => {
        const percent = (audio.currentTime / audio.duration) * 100;
        progressBar.style.width = `${percent}%`;
        timeText.textContent = `${formatTime(audio.currentTime)} / ${formatTime(audio.duration || 0)}`;
      });

      audio.addEventListener("ended", () => {
        isPlaying = false;
        playBtn.innerHTML = "<img src='/play.svg' alt='Play' style='width: 20px; height: 20px;'>";
        progressBar.style.width = `0%`;
      });

      progress.addEventListener("click", (e) => {
        const rect = progress.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const percent = x / rect.width;
        audio.currentTime = percent * audio.duration;
      });

      playBtn.style.backgroundColor = "white";

      container.appendChild(div);
    });
  })
  .catch(err => {
    console.error("Failed to fetch sounds:", err);
    document.getElementById("sounds").innerHTML = "<p>Failed to load sounds 🫠</p>";
  });