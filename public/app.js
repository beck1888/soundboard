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
    
    // Update global favorites for search functionality
    if (allFavorites) {
      allFavorites[filename] = result.favorite;
    }
    
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
    
    // Store globally for search functionality
    allSounds = sounds;
    allFavorites = favorites;
    
    // Initialize search functionality
    initializeSearch();
    
  } catch (err) {
    console.error("Failed to fetch sounds:", err);
    loadingScreen.style.display = "none";
    soundsContainer.style.display = "block";
    soundsContainer.innerHTML = "<p>Failed to load sounds 🫠</p>";
  }
}

// Global variables for search and sounds
let allSounds = [];
let allFavorites = {};
let isSearchActive = false;

// Fuzzy search function
function fuzzyMatch(text, pattern) {
  const textLower = text.toLowerCase();
  const patternLower = pattern.toLowerCase();
  
  // Exact match gets highest score
  if (textLower.includes(patternLower)) {
    return { isMatch: true, score: 100 };
  }
  
  // Fuzzy match algorithm
  let patternIndex = 0;
  let score = 0;
  let consecutiveMatches = 0;
  
  for (let i = 0; i < textLower.length && patternIndex < patternLower.length; i++) {
    if (textLower[i] === patternLower[patternIndex]) {
      patternIndex++;
      consecutiveMatches++;
      score += consecutiveMatches * 2; // Bonus for consecutive matches
    } else {
      consecutiveMatches = 0;
    }
  }
  
  if (patternIndex === patternLower.length) {
    // All characters matched, calculate final score
    const completionRatio = patternIndex / textLower.length;
    return { isMatch: true, score: score * completionRatio };
  }
  
  return { isMatch: false, score: 0 };
}

// Search and rank sounds
function searchSounds(query) {
  if (!query.trim()) {
    return allSounds.map(sound => ({ sound, isFavorite: allFavorites[sound] || false }));
  }
  
  const results = [];
  
  allSounds.forEach(sound => {
    const isFavorite = allFavorites[sound] || false;
    const match = fuzzyMatch(sound, query);
    
    if (match.isMatch) {
      let rank;
      const isExactMatch = sound.toLowerCase().includes(query.toLowerCase());
      
      // Ranking based on your requirements
      if (isFavorite && isExactMatch) {
        rank = 1; // Favorited sounds with exact text contains match
      } else if (isFavorite && !isExactMatch) {
        rank = 2; // Favorite sounds with fuzzy text match
      } else if (!isFavorite && isExactMatch) {
        rank = 3; // Non-favorited sounds with exact text contains match
      } else {
        rank = 4; // Non-favorited sounds with fuzzy text match
      }
      
      results.push({
        sound,
        isFavorite,
        rank,
        score: match.score
      });
    }
  });
  
  // Sort by rank first, then by score within each rank
  results.sort((a, b) => {
    if (a.rank !== b.rank) {
      return a.rank - b.rank;
    }
    return b.score - a.score;
  });
  
  return results;
}

// Display search results
function displaySearchResults(results) {
  const soundsContainer = document.getElementById("sounds");
  const noResultsContainer = document.getElementById("no-results");
  
  if (results.length === 0) {
    soundsContainer.style.display = "none";
    noResultsContainer.style.display = "flex";
    return;
  }
  
  noResultsContainer.style.display = "none";
  soundsContainer.style.display = "block";
  soundsContainer.innerHTML = "";
  
  results.forEach(({ sound, isFavorite }) => {
    const soundItem = createSoundItem(sound, isFavorite);
    soundsContainer.appendChild(soundItem);
  });
}

// Search functionality
function initializeSearch() {
  const searchToggle = document.getElementById("search-toggle");
  const searchBar = document.getElementById("search-bar");
  const searchInput = document.getElementById("search-input");
  const searchClose = document.getElementById("search-close");
  
  // Check if elements exist
  if (!searchToggle || !searchBar || !searchInput || !searchClose) {
    console.error("Search elements not found");
    return;
  }
  
  // Ensure search toggle is visible initially
  searchToggle.style.display = "block";
  searchBar.style.display = "none";
  
  // Toggle search bar
  searchToggle.addEventListener("click", (e) => {
    e.preventDefault();
    if (isSearchActive) {
      closeSearch();
    } else {
      openSearch();
    }
  });
  
  // Close search
  searchClose.addEventListener("click", closeSearch);
  
  // Search input handler
  searchInput.addEventListener("input", (e) => {
    const query = e.target.value;
    const results = searchSounds(query);
    displaySearchResults(results);
  });
  
  // Close search on Escape key
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && isSearchActive) {
      closeSearch();
    }
  });
  
  function openSearch() {
    isSearchActive = true;
    searchBar.style.display = "flex";
    searchToggle.style.display = "none";
    searchInput.focus();
  }
  
  function closeSearch() {
    isSearchActive = false;
    searchBar.style.display = "none";
    searchToggle.style.display = "block";
    searchInput.value = "";
    
    // Show all sounds when closing search
    displaySearchResults(allSounds.map(sound => ({ 
      sound, 
      isFavorite: allFavorites[sound] || false 
    })));
  }
}

// Load sounds when page loads
loadSounds();