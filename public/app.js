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

  // Remove .mp3 extension for display
  const displayName = file.replace(/\.mp3$/i, '');

  div.innerHTML = `
    <div class="sound-title">
      <span class="filename">${displayName}</span>
    </div>
    <div class="custom-player">
      <button class="play-btn"><img src='/play.svg' alt='Play' style='width: 20px; height: 20px;'></button>
      <div class="progress"><div class="progress-bar"></div></div>
      <div class="time">0:00</div>
      <button class="download-btn" title="Download file">
        <img src='/download.svg' alt='Download'>
      </button>
      <button class="favorite-btn" title="Toggle favorite">
        <img src='/${isFavorite ? 'heart_on.svg' : 'heart_off.svg'}' alt='${isFavorite ? 'Favorited' : 'Not favorited'}'>
      </button>
    </div>
    <div class="context-menu" style="display: none;">
      <button class="rename-btn"><img src='/edit.svg' alt='Rename' style='width:16px;height:16px;margin-right:4px;'>Rename</button>
      <button class="delete-btn"><img src='/delete.svg' alt='Delete' style='width:16px;height:16px;margin-right:4px;'>Delete</button>
    </div>
  `;

  const audio = new Audio(`/sfx/${encodeURIComponent(file)}`);
  audio.preload = "none";

  const playBtn = div.querySelector(".play-btn");
  const progress = div.querySelector(".progress");
  const progressBar = div.querySelector(".progress-bar");
  const timeText = div.querySelector(".time");
  const downloadBtn = div.querySelector(".download-btn");
  const favoriteBtn = div.querySelector(".favorite-btn");
  const contextMenu = div.querySelector(".context-menu");
  const renameBtn = div.querySelector(".rename-btn");
  const deleteBtn = div.querySelector(".delete-btn");

  let isPlaying = false;
  let animationId = null;

  // Right-click menu functionality
  div.addEventListener("contextmenu", (e) => {
    e.preventDefault();

    // Close any other open context menus first
    document.querySelectorAll('.sound-item').forEach(item => {
      if (item !== div) {
        const otherMenu = item.querySelector('.context-menu');
        if (otherMenu) {
          otherMenu.style.display = "none";
          item.classList.remove("blurred");
        }
      }
    });

    // Add blur effect to the sound content
    div.classList.add("blurred");
    
    // Show the context menu overlay
    contextMenu.style.display = "flex";
    
    // Add keyboard navigation
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        closeContextMenu();
      }
    };
    
    const closeContextMenu = () => {
      contextMenu.style.display = "none";
      div.classList.remove("blurred");
      document.removeEventListener("keydown", handleKeyDown);
    };
    
    // Store the close function for other event handlers
    div._closeContextMenu = closeContextMenu;
    
    document.addEventListener("keydown", handleKeyDown);
  });

  // Close context menu when clicking anywhere
  document.addEventListener("click", (e) => {
    // Only close if clicking outside the current sound item or on the sound item but not on the context menu
    if (!div.contains(e.target) || (div.contains(e.target) && !contextMenu.contains(e.target))) {
      if (div._closeContextMenu) {
        div._closeContextMenu();
      } else {
        contextMenu.style.display = "none";
        div.classList.remove("blurred");
      }
    }
  });

  // Prevent context menu from closing when clicking on it
  contextMenu.addEventListener("click", (e) => {
    e.stopPropagation();
  });

  // Rename functionality
  renameBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    
    // Hide context menu and remove blur
    if (div._closeContextMenu) {
      div._closeContextMenu();
    } else {
      contextMenu.style.display = "none";
      div.classList.remove("blurred");
    }
    
    const modal = document.getElementById("rename-modal");
    const modalInput = document.getElementById("rename-input");
    const modalConfirm = document.getElementById("rename-confirm");
    const modalCancel = document.getElementById("rename-cancel");

    // Reset modal state
    modalInput.value = displayName;
    
    // Remove any existing event listeners by cloning the buttons
    const newModalCancel = modalCancel.cloneNode(true);
    const newModalConfirm = modalConfirm.cloneNode(true);
    modalCancel.parentNode.replaceChild(newModalCancel, modalCancel);
    modalConfirm.parentNode.replaceChild(newModalConfirm, modalConfirm);

    // Center modal by using flex display (matches CSS)
    modal.style.display = "flex";
    
    // Focus input after a brief delay to ensure modal is visible
    setTimeout(() => {
      modalInput.focus();
      modalInput.select();
    }, 100);

    // Function to close modal
    const closeModal = () => {
      modal.style.display = "none";
      // Remove escape key listener
      document.removeEventListener("keydown", escapeHandler);
    };

    // Escape key handler
    const escapeHandler = (event) => {
      if (event.key === "Escape") {
        closeModal();
      }
    };

    // Add escape key listener
    document.addEventListener("keydown", escapeHandler);

    newModalCancel.addEventListener("click", closeModal);

    newModalConfirm.addEventListener("click", async () => {
      const newName = modalInput.value.trim();
      if (newName && newName !== displayName) {
        try {
          const response = await fetch(`/api/rename/${encodeURIComponent(file)}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ newName })
          });
          
          if (response.ok) {
            // Reload the page to refresh the sound list with new name
            location.reload();
          } else {
            const error = await response.json();
            console.error("Failed to rename file:", error.error);
            alert(`Failed to rename file: ${error.error}`);
          }
        } catch (err) {
          console.error("Error renaming file:", err);
          alert("Error renaming file. Please try again.");
        }
      }
      closeModal();
    });

    // Handle Enter key in input
    modalInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        newModalConfirm.click();
      }
    });

    // Close modal when clicking outside
    modal.addEventListener("click", (event) => {
      if (event.target === modal) {
        closeModal();
      }
    });
  });

  // Delete functionality
  deleteBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    // Hide context menu and remove blur
    if (div._closeContextMenu) {
      div._closeContextMenu();
    } else {
      contextMenu.style.display = "none";
      div.classList.remove("blurred");
    }
    
    const modal = document.getElementById("delete-modal");
    const modalCheckbox = document.getElementById("delete-checkbox");
    const modalConfirm = document.getElementById("delete-confirm");
    const modalCancel = document.getElementById("delete-cancel");
    
    // Reset modal state
    modalCheckbox.checked = false;
    modalConfirm.disabled = true;
    
    // Show the name of the sound to be deleted
    let modalSoundName = document.getElementById("delete-sound-name");
    if (!modalSoundName) {
      modalSoundName = document.createElement("div");
      modalSoundName.id = "delete-sound-name";
      modalSoundName.style.marginBottom = "12px";
      modalSoundName.style.fontWeight = "600";
      modalSoundName.style.textAlign = "center";
      modalSoundName.style.color = "#e74c3c";
      modalSoundName.style.fontSize = "1.1rem";
      modalSoundName.style.padding = "0.75rem";
      modalSoundName.style.background = "rgba(231, 76, 60, 0.05)";
      modalSoundName.style.borderRadius = "8px";
      modalSoundName.style.border = "1px solid rgba(231, 76, 60, 0.2)";
      
      // Insert before the checkbox in the modal body
      const modalBody = modal.querySelector(".modal-body");
      const checkboxLabel = modalBody.querySelector(".checkbox-label");
      if (checkboxLabel) {
        modalBody.insertBefore(modalSoundName, checkboxLabel);
      } else {
        modalBody.appendChild(modalSoundName);
      }
    }
    modalSoundName.textContent = `Deleting: ${displayName}`;
    
    // Remove any existing event listeners by cloning the elements
    const newModalCheckbox = modalCheckbox.cloneNode(true);
    const newModalCancel = modalCancel.cloneNode(true);
    const newModalConfirm = modalConfirm.cloneNode(true);
    
    modalCheckbox.parentNode.replaceChild(newModalCheckbox, modalCheckbox);
    modalCancel.parentNode.replaceChild(newModalCancel, modalCancel);
    modalConfirm.parentNode.replaceChild(newModalConfirm, modalConfirm);
    
    // Reset the new checkbox state
    newModalCheckbox.checked = false;
    newModalConfirm.disabled = true;
    
    modal.style.display = "flex";
    
    // Function to close modal and reset state
    const closeModal = () => {
      modal.style.display = "none";
      newModalCheckbox.checked = false;
      newModalConfirm.disabled = true;
      // Remove escape key listener
      document.removeEventListener("keydown", escapeHandler);
    };
    
    // Escape key handler
    const escapeHandler = (event) => {
      if (event.key === "Escape") {
        closeModal();
      }
    };

    // Add escape key listener
    document.addEventListener("keydown", escapeHandler);
    
    newModalCheckbox.addEventListener("change", () => {
      newModalConfirm.disabled = !newModalCheckbox.checked;
    });
    
    newModalCancel.addEventListener("click", closeModal);
    
    newModalConfirm.addEventListener("click", async () => {
      if (!newModalCheckbox.checked) return;
      
      try {
        const response = await fetch(`/api/delete/${encodeURIComponent(file)}`, { 
          method: "DELETE" 
        });
        
        if (response.ok) {
          // Add smooth fade-out animation
          div.style.transition = "all 0.3s ease";
          div.style.opacity = "0";
          div.style.transform = "translateX(-20px)";
          
          setTimeout(() => {
            div.remove();
            
            // If this was the last sound and we're in search/filter mode, check if we need to show "no results"
            const remainingSounds = document.querySelectorAll('.sound-item');
            if (remainingSounds.length === 0) {
              const noResultsContainer = document.getElementById("no-results");
              const soundsContainer = document.getElementById("sounds");
              if (noResultsContainer && soundsContainer) {
                soundsContainer.style.display = "none";
                noResultsContainer.style.display = "flex";
              }
            }
          }, 300);
          
          closeModal();
          console.log(`🗑️ File deleted successfully: ${file}`);
        } else {
          const error = await response.json();
          console.error("Failed to delete file:", error.error);
          alert(`Failed to delete file: ${error.error}`);
        }
      } catch (err) {
        console.error("Error deleting file:", err);
        alert("Error deleting file. Please try again.");
      }
    });

    // Close modal when clicking outside
    modal.addEventListener("click", (event) => {
      if (event.target === modal) {
        closeModal();
      }
    });
  });

  // Download button functionality
  downloadBtn.addEventListener("click", async () => {
    try {
      const response = await fetch(`/sfx/${encodeURIComponent(file)}`);
      if (!response.ok) throw new Error(`Failed to fetch ${file}`);
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      
      // Create a temporary download link
      const a = document.createElement('a');
      a.href = url;
      a.download = file;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      // Clean up the blob URL
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error(`Failed to download ${file}:`, err);
      alert(`Failed to download ${file}. Please try again.`);
    }
  });

  // Favorite button functionality
  favoriteBtn.addEventListener("click", async () => {
    // Add immediate visual feedback
    favoriteBtn.style.transform = 'scale(0.95)';
    setTimeout(() => {
      favoriteBtn.style.transform = 'scale(1)';
    }, 150);
    
    const newFavoriteStatus = await toggleFavorite(file);
    if (newFavoriteStatus !== null) {
      const img = favoriteBtn.querySelector('img');
      img.src = `/${newFavoriteStatus ? 'heart_on.svg' : 'heart_off.svg'}`;
      img.alt = newFavoriteStatus ? 'Favorited' : 'Not favorited';
      
      // Add a subtle animation for the heart change
      img.style.transform = 'scale(1.2)';
      setTimeout(() => {
        img.style.transform = 'scale(1)';
      }, 200);
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
    
    // Initialize upload functionality
    initializeUpload();
    
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
let isHeartFilterActive = false;

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
  let soundsToSearch = allSounds;
  
  // If heart filter is active, only search favorited sounds
  if (isHeartFilterActive) {
    soundsToSearch = allSounds.filter(sound => allFavorites[sound]);
  }
  
  if (!query.trim()) {
    return soundsToSearch.map(sound => ({ sound, isFavorite: allFavorites[sound] || false }));
  }
  
  const results = [];
  
  soundsToSearch.forEach(sound => {
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
  const heartFilter = document.getElementById("heart-filter");
  
  // Check if elements exist
  if (!searchToggle || !searchBar || !searchInput || !searchClose || !heartFilter) {
    console.error("Search elements not found");
    return;
  }
  
  // Ensure search toggle is visible initially
  searchToggle.style.display = "block";
  searchBar.style.display = "none";
  
  // Heart filter functionality
  heartFilter.addEventListener("click", (e) => {
    e.preventDefault();
    toggleHeartFilter();
  });
  
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
    refreshResults();
  });
  
  // Keyboard shortcuts
  document.addEventListener("keydown", (e) => {
    // Close search on Escape key (only if no other modals are open)
    if (e.key === "Escape" && isSearchActive && !document.querySelector('.modal[style*="flex"]') && !document.querySelector('.upload-modal[style*="flex"]')) {
      closeSearch();
    }
    
    // Open search on Cmd+F (Mac) or Ctrl+F (Windows/Linux)
    if ((e.metaKey || e.ctrlKey) && e.key === "f" && !isSearchActive && !document.querySelector('.modal[style*="flex"]') && !document.querySelector('.upload-modal[style*="flex"]')) {
      e.preventDefault(); // Prevent browser's default find dialog
      openSearch();
    }
    
    // Quick sound search with '/' key (like GitHub, Reddit)
    if (e.key === "/" && !isSearchActive && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
      e.preventDefault();
      openSearch();
    }
  });
  
  function openSearch() {
    isSearchActive = true;
    searchBar.style.display = "flex";
    searchBar.classList.add("active");
    searchToggle.style.display = "none";
    
    // Focus input after a brief delay to ensure animation is smooth
    setTimeout(() => {
      searchInput.focus();
    }, 100);
  }
  
  function closeSearch() {
    isSearchActive = false;
    searchBar.style.display = "none";
    searchBar.classList.remove("active");
    searchToggle.style.display = "block";
    searchInput.value = "";
    
    // Refresh results based on current heart filter state
    refreshResults();
  }
  
  function toggleHeartFilter() {
    isHeartFilterActive = !isHeartFilterActive;
    const heartFilterIcon = heartFilter.querySelector('.heart-filter-icon');
    
    if (isHeartFilterActive) {
      heartFilter.classList.add('active');
      heartFilterIcon.src = '/heart_on.svg';
      heartFilterIcon.alt = 'Show favorites only';
      heartFilter.title = 'Show all sounds';
    } else {
      heartFilter.classList.remove('active');
      heartFilterIcon.src = '/heart_off.svg';
      heartFilterIcon.alt = 'Show all';
      heartFilter.title = 'Filter favorites';
    }
    
    // Refresh results based on current search and filter state
    refreshResults();
  }
  
  function refreshResults() {
    const query = searchInput.value;
    const results = searchSounds(query);
    displaySearchResults(results);
  }
}

// Upload functionality
function initializeUpload() {
  const uploadToggle = document.getElementById("upload-toggle");
  const uploadModal = document.getElementById("upload-modal");
  const uploadModalClose = document.getElementById("upload-modal-close");
  const uploadCancel = document.getElementById("upload-cancel");
  const uploadForm = document.getElementById("upload-form");
  const soundNameInput = document.getElementById("sound-name");
  const soundFileInput = document.getElementById("sound-file");
  const uploadProgress = document.getElementById("upload-progress");
  const uploadProgressFill = document.querySelector(".upload-progress-fill");
  const uploadProgressText = document.querySelector(".upload-progress-text");
  
  if (!uploadToggle || !uploadModal) {
    console.error("Upload elements not found");
    return;
  }
  
  // Open upload modal
  uploadToggle.addEventListener("click", (e) => {
    e.preventDefault();
    openUploadModal();
  });
  
  // Close modal events
  uploadModalClose.addEventListener("click", closeUploadModal);
  uploadCancel.addEventListener("click", closeUploadModal);
  
  // Close modal when clicking outside
  uploadModal.addEventListener("click", (e) => {
    if (e.target === uploadModal) {
      closeUploadModal();
    }
  });
  
  // Handle form submission
  uploadForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    await handleUpload();
  });
  
  // Auto-generate filename from file selection
  soundFileInput.addEventListener("change", (e) => {
    if (e.target.files.length > 0 && !soundNameInput.value.trim()) {
      const fileName = e.target.files[0].name;
      const nameWithoutExt = fileName.replace(/\.[^/.]+$/, "");
      soundNameInput.value = nameWithoutExt;
    }
  });
  
  // Keyboard shortcuts and modal management
  let escapeHandler = null;
  
  const setupModalEscapeHandler = () => {
    escapeHandler = (e) => {
      if (e.key === "Escape" && uploadModal.style.display !== "none") {
        closeUploadModal();
      }
    };
    document.addEventListener("keydown", escapeHandler);
  };
  
  const removeModalEscapeHandler = () => {
    if (escapeHandler) {
      document.removeEventListener("keydown", escapeHandler);
      escapeHandler = null;
    }
  };
  
  function openUploadModal() {
    uploadModal.style.display = "flex";
    uploadToggle.classList.add("active");
    
    // Reset form and UI
    uploadForm.reset();
    uploadProgress.style.display = "none";
    uploadForm.style.display = "flex";
    
    // Setup escape handler
    setupModalEscapeHandler();
    
    // Focus the name input after a brief delay to ensure modal is visible
    setTimeout(() => {
      soundNameInput.focus();
    }, 100);
  }
  
  function closeUploadModal() {
    uploadModal.style.display = "none";
    uploadToggle.classList.remove("active");
    uploadForm.reset();
    uploadProgress.style.display = "none";
    uploadForm.style.display = "flex";
    
    // Remove escape handler
    removeModalEscapeHandler();
  }
  
  async function handleUpload() {
    const soundName = soundNameInput.value.trim();
    const soundFile = soundFileInput.files[0];
    
    if (!soundName || !soundFile) {
      alert("Please provide both a sound name and file.");
      return;
    }
    
    // Show progress
    uploadForm.style.display = "none";
    uploadProgress.style.display = "block";
    uploadProgressFill.style.width = "0%";
    uploadProgressText.textContent = "Uploading...";
    
    try {
      const formData = new FormData();
      formData.append("soundFile", soundFile);
      formData.append("soundName", soundName);
      
      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Upload failed");
      }
      
      const result = await response.json();
      
      // Simulate progress completion
      uploadProgressFill.style.width = "100%";
      uploadProgressText.textContent = "Upload complete!";
      
      setTimeout(() => {
        closeUploadModal();
        // Reload sounds to show the new upload
        loadSounds();
      }, 1000);
      
    } catch (error) {
      console.error("Upload error:", error);
      uploadProgressText.textContent = `Upload failed: ${error.message}`;
      uploadProgressFill.style.width = "0%";
      
      setTimeout(() => {
        uploadForm.style.display = "flex";
        uploadProgress.style.display = "none";
      }, 2000);
    }
  }
}

// Load sounds when page loads
loadSounds();