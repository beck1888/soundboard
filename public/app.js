function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

async function toggleFavorite(filename) {
  try {
    const response = await fetch(`/api/favorites/${encodeURIComponent(filename)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      throw new Error('Failed to toggle favorite');
    }
    
    const result = await response.json();
    return result.favorite;
  } catch (err) {
    console.error('Error toggling favorite:', err);
    return null;
  }
}

function createSoundItem(file, isFavorite) {
  const div = document.createElement("div");
  div.className = "sound-item";
  div.innerHTML = `
    <div class="sound-title">
      <span class="filename">${file}</span>
    </div>
    <div class="custom-player">
      <button class="play-btn"><img src='/play.svg' alt='Play' style='width: 20px; height: 20px;'></button>
      <div class="progress"><div class="progress-bar"></div></div>
      <div class="time">0:00</div>
      <button class="favorite-btn" title="Toggle favorite">
        <img src='/${isFavorite ? 'heart_on.svg' : 'heart_off.svg'}' alt='${isFavorite ? 'Favorited' : 'Not favorited'}'>
      </button>
    </div>
  `;

  const audio = new Audio(`/sfx/${encodeURIComponent(file)}`);
  audio.preload = "none";

  const playBtn = div.querySelector(".play-btn");
  const progress = div.querySelector(".progress");
  const progressBar = div.querySelector(".progress-bar");
  const timeText = div.querySelector(".time");
  const favoriteBtn = div.querySelector(".favorite-btn");

  let isPlaying = false;
  let animationId = null;

  // Favorite button functionality
  favoriteBtn.addEventListener("click", async () => {
    const newFavoriteStatus = await toggleFavorite(file);
    if (newFavoriteStatus !== null) {
      const img = favoriteBtn.querySelector('img');
      img.src = `/${newFavoriteStatus ? 'heart_on.svg' : 'heart_off.svg'}`;
      img.alt = newFavoriteStatus ? 'Favorited' : 'Not favorited';
    }
  });

  // Smooth progress bar animation function
  function updateProgress() {
    if (isPlaying && !audio.paused) {
      if (audio.duration && !isNaN(audio.duration)) {
        const percent = (audio.currentTime / audio.duration) * 100;
        progressBar.style.width = `${percent}%`;
        timeText.textContent = `${formatTime(audio.currentTime)}`;
      }
      animationId = requestAnimationFrame(updateProgress);
    }
  }

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
    // Start smooth animation
    if (animationId) cancelAnimationFrame(animationId);
    updateProgress();
  });

  audio.addEventListener("pause", () => {
    isPlaying = false;
    playBtn.innerHTML = "<img src='/play.svg' alt='Play' style='width: 20px; height: 20px;'>";
    // Stop smooth animation
    if (animationId) {
      cancelAnimationFrame(animationId);
      animationId = null;
    }
  });

  audio.addEventListener("ended", () => {
    isPlaying = false;
    playBtn.innerHTML = "<img src='/play.svg' alt='Play' style='width: 20px; height: 20px;'>";
    progressBar.style.width = `0%`;
    // Stop smooth animation
    if (animationId) {
      cancelAnimationFrame(animationId);
      animationId = null;
    }
  });

  progress.addEventListener("click", (e) => {
    const rect = progress.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percent = x / rect.width;
    audio.currentTime = percent * audio.duration;
  });

  return div;
}

// Main loading function
async function loadSounds() {
  const loadingScreen = document.getElementById("loading");
  const soundsContainer = document.getElementById("sounds");
  
  try {
    const response = await fetch("/api/sounds");
    if (!response.ok) throw new Error("API request failed");
    
    const data = await response.json();
    
    // Add delay to simulate loading time
    await new Promise(resolve => setTimeout(resolve, 500));
    const { sounds, favorites } = data;
    
    // Hide loading screen and show sounds container
    loadingScreen.style.display = "none";
    soundsContainer.style.display = "block";
    
    if (!sounds.length) {
      soundsContainer.innerHTML = "<p>No MP3s found 😢</p>";
      return;
    }

    // Clear container and populate with sounds
    soundsContainer.innerHTML = "";
    
    sounds.forEach(file => {
      const isFavorite = favorites[file] || false;
      const soundItem = createSoundItem(file, isFavorite);
      soundsContainer.appendChild(soundItem);
    });
    
  } catch (err) {
    console.error("Failed to fetch sounds:", err);
    loadingScreen.style.display = "none";
    soundsContainer.style.display = "block";
    soundsContainer.innerHTML = "<p>Failed to load sounds 🫠</p>";
  }
}

// Load sounds when page loads
loadSounds();