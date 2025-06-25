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
      <button class="more-menu-btn" title="More options">
        <img src='/fluentui-system-icons/more-menu.svg' alt='More options' style='width: 16px; height: 16px;'>
      </button>
    </div>
    <div class="custom-player">
      <button class="play-btn"><img src='/fluentui-system-icons/play.svg' alt='Play' style='width: 20px; height: 20px;'></button>
      <div class="progress"><div class="progress-bar"></div></div>
      <div class="time">0:00</div>
      <button class="download-btn" title="Download file">
        <img src='/fluentui-system-icons/download.svg' alt='Download'>
      </button>
      <button class="favorite-btn" title="Toggle favorite">
        <img src='/${isFavorite ? 'fluentui-system-icons/heart_on.svg' : 'fluentui-system-icons/heart_off.svg'}' alt='${isFavorite ? 'Favorited' : 'Not favorited'}'>
      </button>
    </div>
    <div class="context-menu" style="display: none;">
      <button class="rename-btn"><img src='/fluentui-system-icons/edit.svg' alt='Rename' style='width:16px;height:16px;margin-right:4px;'>Rename</button>
      <button class="delete-btn"><img src='/fluentui-system-icons/delete.svg' alt='Delete' style='width:16px;height:16px;margin-right:4px;'>Delete</button>
    </div>
  `;

  const audio = new Audio(`/sfx/${encodeURIComponent(file)}`);
  audio.preload = "metadata"; // Load metadata to get duration

  const playBtn = div.querySelector(".play-btn");
  const progress = div.querySelector(".progress");
  const progressBar = div.querySelector(".progress-bar");
  const timeText = div.querySelector(".time");
  const downloadBtn = div.querySelector(".download-btn");
  const favoriteBtn = div.querySelector(".favorite-btn");
  const contextMenu = div.querySelector(".context-menu");
  const renameBtn = div.querySelector(".rename-btn");
  const deleteBtn = div.querySelector(".delete-btn");
  const moreMenuBtn = div.querySelector(".more-menu-btn");

  let isPlaying = false;
  let animationId = null;
  let duration = 0;

  // Load duration when metadata is available
  audio.addEventListener("loadedmetadata", () => {
    duration = audio.duration;
    if (!isPlaying) {
      timeText.textContent = formatTime(duration);
    }
  });

  // Handle cases where duration might be available immediately
  if (audio.duration && !isNaN(audio.duration)) {
    duration = audio.duration;
    timeText.textContent = formatTime(duration);
  }

  // Shared function to open context menu
  const openContextMenu = () => {
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
  };

  // More menu button functionality
  moreMenuBtn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    openContextMenu();
  });

  // Right-click menu functionality
  div.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    openContextMenu();
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
    const renameError = document.getElementById("rename-input-error");

    // Reset modal state
    modalInput.value = displayName;
    
    // Remove any existing event listeners by cloning the buttons
    const newModalCancel = modalCancel.cloneNode(true);
    const newModalConfirm = modalConfirm.cloneNode(true);
    modalCancel.parentNode.replaceChild(newModalCancel, modalCancel);
    modalConfirm.parentNode.replaceChild(newModalConfirm, modalConfirm);

    // Validation function for rename modal
    function updateRenameValidationState() {
      const currentValue = modalInput.value.trim();
      let isValid = true;
      
      // Check for invalid characters (blocking error)
      if (currentValue && !validateSoundName(currentValue)) {
        modalInput.classList.add('error');
        renameError.textContent = 'Your title can only contain letters, numbers, spaces, hyphens, and underscores';
        renameError.style.display = 'block';
        renameError.className = 'input-error'; // Red error
        isValid = false;
      } 
      // Check if file name already exists (blocking error) - but allow keeping the same name
      else if (currentValue && currentValue !== displayName && fileNameExists(currentValue)) {
        modalInput.classList.add('error');
        renameError.textContent = 'A sound with this name already exists. Please choose a different name.';
        renameError.style.display = 'block';
        renameError.className = 'input-warning'; // Orange warning
        isValid = false;
      } 
      // Check if not in title case (non-blocking warning)
      else if (currentValue && !isTitleCase(currentValue)) {
        modalInput.classList.remove('error'); // Remove error styling
        renameError.textContent = 'Consider using Title Case for better consistency (e.g., "My Sound Name")';
        renameError.style.display = 'block';
        renameError.className = 'input-suggestion'; // Yellow suggestion
        // Don't set isValid to false - this is just a suggestion
      } 
      else {
        modalInput.classList.remove('error');
        renameError.style.display = 'none';
      }
      
      // Check if name is provided and not empty
      if (!currentValue || currentValue.length === 0) {
        isValid = false;
      }
      
      newModalConfirm.disabled = !isValid;
    }

    // Add real-time validation to rename input
    modalInput.addEventListener('input', updateRenameValidationState);
    modalInput.addEventListener('paste', () => {
      // Use setTimeout to allow paste to complete before validation
      setTimeout(updateRenameValidationState, 0);
    });

    // Center modal by using flex display (matches CSS)
    modal.style.display = "flex";
    
    // Focus input after a brief delay to ensure modal is visible
    setTimeout(() => {
      modalInput.focus();
      modalInput.select();
      // Run initial validation
      updateRenameValidationState();
    }, 100);

    // Function to close modal
    const closeModal = () => {
      modal.style.display = "none";
      // Reset validation state
      modalInput.classList.remove('error');
      renameError.style.display = 'none';
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
      if (newName && newName !== displayName && !newModalConfirm.disabled) {
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
        if (!newModalConfirm.disabled) {
          newModalConfirm.click();
        }
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
      img.src = `/${newFavoriteStatus ? 'fluentui-system-icons/heart_on.svg' : 'fluentui-system-icons/heart_off.svg'}`;
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
    playBtn.innerHTML = "<img src='/fluentui-system-icons/pause.svg' alt='Pause' style='width: 20px; height: 20px;'>";
    // Start smooth animation
    if (animationId) cancelAnimationFrame(animationId);
    updateProgress();
  });

  audio.addEventListener("pause", () => {
    isPlaying = false;
    playBtn.innerHTML = "<img src='/fluentui-system-icons/play.svg' alt='Play' style='width: 20px; height: 20px;'>";
    // Stop smooth animation
    if (animationId) {
      cancelAnimationFrame(animationId);
      animationId = null;
    }
    
    // Show duration instead of current time when paused
    timeText.textContent = formatTime(duration);
  });

  audio.addEventListener("ended", () => {
    isPlaying = false;
    playBtn.innerHTML = "<img src='/fluentui-system-icons/play.svg' alt='Play' style='width: 20px; height: 20px;'>";
    progressBar.style.width = `0%`;
    // Stop smooth animation
    if (animationId) {
      cancelAnimationFrame(animationId);
      animationId = null;
    }
    
    // Show duration instead of current time when ended
    timeText.textContent = formatTime(duration);
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
  const criticalErrorScreen = document.getElementById("critical-error");
  const emptyDirectoryScreen = document.getElementById("empty-directory");
  const noResultsContainer = document.getElementById("no-results");
  
  // Hide all screens initially
  loadingScreen.style.display = "flex";
  soundsContainer.style.display = "none";
  if (criticalErrorScreen) criticalErrorScreen.style.display = "none";
  if (emptyDirectoryScreen) emptyDirectoryScreen.style.display = "none";
  if (noResultsContainer) noResultsContainer.style.display = "none";
  
  try {
    const response = await fetch("/api/sounds");
    
    if (!response.ok) {
      const errorData = await response.json();
      showCriticalError(errorData);
      return;
    }
    
    const data = await response.json();
    allSounds = data.sounds;
    allFavorites = data.favorites;

    loadingScreen.style.display = "none";
    
    // Check if directory is empty
    if (allSounds.length === 0) {
      showEmptyDirectory();
      return;
    }
    
    // Show normal UI
    soundsContainer.style.display = "grid";
    
    // Clear container and populate with sounds
    soundsContainer.innerHTML = "";
    
    // Sort all sounds alphabetically (case-insensitive)
    const sortedSounds = [...allSounds].sort((a, b) => 
      a.toLowerCase().localeCompare(b.toLowerCase())
    );
    
    // Display all sounds in alphabetical order
    sortedSounds.forEach(sound => {
      const isFavorite = allFavorites[sound] || false;
      const soundItem = createSoundItem(sound, isFavorite);
      soundsContainer.appendChild(soundItem);
    });
    
    // Initialize search after sounds are loaded
    initializeSearch();
    initializeUpload();
    initializeInfoModal();
    
  } catch (err) {
    console.error("Network error:", err);
    showCriticalError({
      error: "NETWORK_ERROR",
      message: "Failed to connect to the server",
      details: err.message
    });
  }
}

// Global variables for search and sounds
let allSounds = [];
let allFavorites = {};
let isHeartFilterActive = false;

// Validation functions (shared between upload and rename modals)
function validateSoundName(name) {
  // Allow letters, numbers, spaces, hyphens, and underscores only
  const validPattern = /^[a-zA-Z0-9\s\-_]*$/;
  return validPattern.test(name);
}

// Function to check if file name already exists
function fileNameExists(name) {
  const nameWithExtension = name + '.mp3';
  return allSounds.some(sound => sound.toLowerCase() === nameWithExtension.toLowerCase());
}

// Function to check if string is in title case
function isTitleCase(str) {
  // Split by spaces, hyphens, and underscores to handle multi-word titles
  const words = str.split(/[\s\-_]+/).filter(word => word.length > 0);
  
  return words.every(word => {
    // Skip empty words
    if (word.length === 0) return true;
    
    // Check if first character is uppercase and rest are lowercase
    // Allow numbers and special characters to pass through
    const firstChar = word.charAt(0);
    const restOfWord = word.slice(1);
    
    // If first character is a letter, it should be uppercase
    if (/[a-zA-Z]/.test(firstChar)) {
      if (firstChar !== firstChar.toUpperCase()) return false;
    }
    
    // If rest of word contains letters, they should be lowercase
    if (/[a-zA-Z]/.test(restOfWord)) {
      return restOfWord === restOfWord.toLowerCase();
    }
    
    return true;
  });
}

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
  soundsContainer.style.display = "grid";
  soundsContainer.innerHTML = "";
  
  // Sort results alphabetically by sound name (case-insensitive)
  results.sort((a, b) => {
    return a.sound.toLowerCase().localeCompare(b.sound.toLowerCase());
  });
  
  results.forEach(({ sound, isFavorite }) => {
    const soundItem = createSoundItem(sound, isFavorite);
    soundsContainer.appendChild(soundItem);
  });
}

// Search functionality
function initializeSearch() {
  const searchInput = document.getElementById("search-input");
  const searchClear = document.getElementById("search-clear");
  const heartFilter = document.getElementById("heart-filter");
  
  // Check if elements exist
  if (!searchInput || !heartFilter || !searchClear) {
    console.error("Search elements not found");
    return;
  }
  
  // Function to toggle clear button visibility
  function toggleClearButton() {
    if (searchInput.value.trim() !== '') {
      searchClear.style.display = 'flex';
    } else {
      searchClear.style.display = 'none';
    }
  }
  
  // Clear button click handler
  searchClear.addEventListener("click", (e) => {
    e.preventDefault();
    searchInput.value = '';
    searchClear.style.display = 'none';
    searchInput.focus();
    refreshResults();
  });
  
  // Heart filter functionality
  heartFilter.addEventListener("click", (e) => {
    e.preventDefault();
    toggleHeartFilter();
  });
  
  // Search input handler
  searchInput.addEventListener("input", (e) => {
    toggleClearButton();
    refreshResults();
  });
  
  // Keyboard shortcuts
  document.addEventListener("keydown", (e) => {
    // Focus search on Cmd+F (Mac) or Ctrl+F (Windows/Linux)
    if ((e.metaKey || e.ctrlKey) && e.key === "f" && !document.querySelector('.modal[style*="flex"]') && !document.querySelector('.upload-modal[style*="flex"]')) {
      e.preventDefault(); // Prevent browser's default find dialog
      searchInput.focus();
      searchInput.select();
    }
    
    // Quick sound search with '/' key (like GitHub, Reddit)
    if (e.key === "/" && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
      e.preventDefault();
      searchInput.focus();
      searchInput.select();
    }
  });
  
  function toggleHeartFilter() {
    isHeartFilterActive = !isHeartFilterActive;
    const heartFilterIcon = heartFilter.querySelector('.heart-filter-icon');
    
    if (isHeartFilterActive) {
      heartFilter.classList.add('active');
      heartFilterIcon.src = '/fluentui-system-icons/heart_on.svg';
      heartFilterIcon.alt = 'Show favorites only';
      heartFilter.title = 'Show all sounds';
    } else {
      heartFilter.classList.remove('active');
      heartFilterIcon.src = '/fluentui-system-icons/heart_off.svg';
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
  const fileUploadArea = document.querySelector(".file-upload-area");
  const fileUploadText = document.querySelector(".file-upload-text");
  
  // Preview functionality variables
  let previewAudio = null;
  let previewContainer = null;
  let isPreviewPlaying = false;
  
  if (!uploadToggle || !uploadModal) {
    console.error("Upload elements not found");
    return;
  }

  // Create preview player UI
  function createPreviewPlayer() {
    // Remove any existing preview player first
    removePreviewPlayer();
    
    previewContainer = document.createElement('div');
    previewContainer.className = 'preview-player';
    previewContainer.style.cssText = `
      margin-top: 12px;
      padding: 12px;
      background: rgba(74, 144, 226, 0.1);
      border: 1px solid rgba(74, 144, 226, 0.3);
      border-radius: 8px;
      display: flex;
      align-items: center;
      gap: 12px;
    `;
    
    previewContainer.innerHTML = `
      <button type="button" class="preview-play-btn" style="
        background: #4a90e2;
        border: none;
        border-radius: 50%;
        width: 36px;
        height: 36px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: all 0.2s ease;
      ">
        <img src='/fluentui-system-icons/play.svg' alt='Play preview' style='width: 18px; height: 18px; filter: invert(1);'>
      </button>
      <div class="preview-info" style="flex: 1; min-width: 0;">
        <div class="preview-progress" style="
          width: 100%;
          height: 4px;
          background: rgba(255, 255, 255, 0.2);
          border-radius: 2px;
          margin-bottom: 4px;
          cursor: pointer;
        ">
          <div class="preview-progress-bar" style="
            width: 0%;
            height: 100%;
            background: #4a90e2;
            border-radius: 2px;
            transition: width 0.1s ease;
          "></div>
        </div>
        <div class="preview-time" style="
          font-size: 12px;
          color: #666;
        ">0:00</div>
      </div>
      <span class="preview-label" style="
        font-size: 12px;
        color: #4a90e2;
        font-weight: 500;
      ">Preview</span>
    `;
    
    // Insert after file upload area
    fileUploadArea.parentNode.insertBefore(previewContainer, fileUploadArea.nextSibling);
    
    return previewContainer;
  }

  // Setup preview player functionality
  function setupPreviewPlayer(file) {
    if (previewAudio) {
      previewAudio.pause();
      previewAudio = null;
    }
    
    const container = createPreviewPlayer();
    const playBtn = container.querySelector('.preview-play-btn');
    const progressBar = container.querySelector('.preview-progress-bar');
    const progressContainer = container.querySelector('.preview-progress');
    const timeDisplay = container.querySelector('.preview-time');
    
    // Create audio object with file URL
    const fileURL = URL.createObjectURL(file);
    previewAudio = new Audio(fileURL);
    previewAudio.preload = 'metadata';
    
    let duration = 0;
    let animationId = null;
    
    // Load duration when metadata is available
    previewAudio.addEventListener('loadedmetadata', () => {
      duration = previewAudio.duration;
      timeDisplay.textContent = formatTime(duration);
    });
    
    // Update progress during playback
    function updatePreviewProgress() {
      if (isPreviewPlaying && !previewAudio.paused) {
        if (duration > 0) {
          const percent = (previewAudio.currentTime / duration) * 100;
          progressBar.style.width = `${percent}%`;
          timeDisplay.textContent = `${formatTime(previewAudio.currentTime)} / ${formatTime(duration)}`;
        }
        animationId = requestAnimationFrame(updatePreviewProgress);
      }
    }
    
    // Play/pause button
    playBtn.addEventListener('click', () => {
      if (isPreviewPlaying) {
        previewAudio.pause();
      } else {
        previewAudio.play();
      }
    });
    
    // Audio event listeners
    previewAudio.addEventListener('play', () => {
      isPreviewPlaying = true;
      playBtn.innerHTML = "<img src='/fluentui-system-icons/pause.svg' alt='Pause preview' style='width: 18px; height: 18px; filter: invert(1);'>";
      playBtn.style.background = '#e74c3c';
      if (animationId) cancelAnimationFrame(animationId);
      updatePreviewProgress();
    });
    
    previewAudio.addEventListener('pause', () => {
      isPreviewPlaying = false;
      playBtn.innerHTML = "<img src='/fluentui-system-icons/play.svg' alt='Play preview' style='width: 18px; height: 18px; filter: invert(1);'>";
      playBtn.style.background = '#4a90e2';
      if (animationId) {
        cancelAnimationFrame(animationId);
        animationId = null;
      }
      timeDisplay.textContent = `${formatTime(previewAudio.currentTime)} / ${formatTime(duration)}`;
    });
    
    previewAudio.addEventListener('ended', () => {
      isPreviewPlaying = false;
      playBtn.innerHTML = "<img src='/fluentui-system-icons/play.svg' alt='Play preview' style='width: 18px; height: 18px; filter: invert(1);'>";
      playBtn.style.background = '#4a90e2';
      progressBar.style.width = '0%';
      if (animationId) {
        cancelAnimationFrame(animationId);
        animationId = null;
      }
      timeDisplay.textContent = formatTime(duration);
    });
    
    // Progress bar click to seek
    progressContainer.addEventListener('click', (e) => {
      if (duration > 0) {
        const rect = progressContainer.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const percent = x / rect.width;
        previewAudio.currentTime = percent * duration;
      }
    });
    
    // Cleanup function
    container._cleanup = () => {
      if (previewAudio) {
        previewAudio.pause();
        URL.revokeObjectURL(fileURL);
        previewAudio = null;
      }
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
      isPreviewPlaying = false;
    };
  }

  // Remove preview player
  function removePreviewPlayer() {
    // Clean up the current preview container if it exists
    if (previewContainer) {
      if (previewContainer._cleanup) {
        previewContainer._cleanup();
      }
      previewContainer.remove();
      previewContainer = null;
    }
    
    // Also remove any orphaned preview players that might exist
    const existingPreviews = document.querySelectorAll('.preview-player');
    existingPreviews.forEach(preview => {
      if (preview._cleanup) {
        preview._cleanup();
      }
      preview.remove();
    });
  }

  // Update file upload text when file is selected
  function updateFileUploadText(fileName) {
    if (fileName) {
      fileUploadText.innerHTML = `
        <span class="file-upload-main">✔︎ File Uploaded</span>
        <span class="file-upload-sub">Click to choose a different file</span>
      `;
      fileUploadArea.classList.add('file-selected');
    } else {
      fileUploadText.innerHTML = `
        <span class="file-upload-main">Click to choose a file</span>
        <span class="file-upload-sub">or drop a file here</span>
      `;
      fileUploadArea.classList.remove('file-selected');
    }
  }

  // Function to update validation state
  function updateValidationState() {
    const soundNameError = document.getElementById("sound-name-error");
    const uploadSubmitBtn = document.getElementById("upload-submit");
    const currentValue = soundNameInput.value.trim();
    const hasFile = soundFileInput.files.length > 0;
    
    let isValid = true;
    let showWarning = false;
    
    // Check for invalid characters (blocking error)
    if (currentValue && !validateSoundName(currentValue)) {
      soundNameInput.classList.add('error');
      soundNameError.textContent = 'Your title can only contain letters, numbers, spaces, hyphens, and underscores';
      soundNameError.style.display = 'block';
      soundNameError.className = 'input-error'; // Red error
      isValid = false;
    } 
    // Check if file name already exists (blocking error)
    else if (currentValue && fileNameExists(currentValue)) {
      soundNameInput.classList.add('error');
      soundNameError.textContent = 'A sound with this name already exists. Please choose a different name.';
      soundNameError.style.display = 'block';
      soundNameError.className = 'input-warning'; // Orange warning
      isValid = false;
    } 
    // Check if not in title case (non-blocking warning)
    else if (currentValue && !isTitleCase(currentValue)) {
      soundNameInput.classList.remove('error'); // Remove error styling
      soundNameError.textContent = 'Consider using Title Case for better consistency (e.g., "My Sound Name")';
      soundNameError.style.display = 'block';
      soundNameError.className = 'input-suggestion'; // Yellow suggestion
      showWarning = true;
      // Don't set isValid to false - this is just a suggestion
    } 
    else {
      soundNameInput.classList.remove('error');
      soundNameError.style.display = 'none';
    }
    
    // Check if both file and name are provided
    if (!hasFile || !currentValue || currentValue.length === 0) {
      isValid = false;
    }
    
    uploadSubmitBtn.disabled = !isValid;
  }

  // Add real-time validation to sound name input
  soundNameInput.addEventListener('input', updateValidationState);
  soundNameInput.addEventListener('paste', () => {
    // Use setTimeout to allow paste to complete before validation
    setTimeout(updateValidationState, 0);
  });

  // Drag and drop functionality
  let dragCounter = 0;

  fileUploadArea.addEventListener('dragenter', (e) => {
    e.preventDefault();
    dragCounter++;
    fileUploadArea.classList.add('drag-over');
  });

  fileUploadArea.addEventListener('dragleave', (e) => {
    e.preventDefault();
    dragCounter--;
    if (dragCounter === 0) {
      fileUploadArea.classList.remove('drag-over');
    }
  });

  fileUploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
  });

  fileUploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    dragCounter = 0;
    fileUploadArea.classList.remove('drag-over');
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      // Check if file is audio
      const file = files[0];
      if (file.type.startsWith('audio/') || file.name.toLowerCase().endsWith('.mp3')) {
        soundFileInput.files = files;
        updateFileUploadText(file.name);
        setupPreviewPlayer(file);
        
        // Auto-generate filename if name input is empty
        if (!soundNameInput.value.trim()) {
          const fileName = file.name;
          const nameWithoutExt = fileName.replace(/\.[^/.]+$/, "");
          soundNameInput.value = nameWithoutExt;
        }
        
        // Update validation state after file drop
        updateValidationState();
        
        // Focus the sound name input after file drop
        setTimeout(() => {
          soundNameInput.focus();
          soundNameInput.select();
        }, 100);
      } else {
        alert('Please select an audio file (.mp3, .wav, .ogg, etc.)');
      }
    }
  });
  
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
    if (e.target.files.length > 0) {
      const file = e.target.files[0];
      
      // Check if file is audio
      if (file.type.startsWith('audio/') || file.name.toLowerCase().endsWith('.mp3')) {
        updateFileUploadText(file.name);
        setupPreviewPlayer(file);
        
        if (!soundNameInput.value.trim()) {
          const nameWithoutExt = file.name.replace(/\.[^/.]+$/, "");
          soundNameInput.value = nameWithoutExt;
        }
        
        // Update validation state after file selection
        updateValidationState();
        
        // Focus the sound name input after file selection
        setTimeout(() => {
          soundNameInput.focus();
          soundNameInput.select();
        }, 100);
      } else {
        alert('Please select an audio file (.mp3, .wav, .ogg, etc.)');
        soundFileInput.value = ''; // Clear the invalid file
      }
    } else {
      updateFileUploadText(null);
      removePreviewPlayer();
      // Update validation state when file is removed
      updateValidationState();
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
    updateFileUploadText(null);
    removePreviewPlayer();
    uploadProgress.style.display = "none";
    uploadForm.style.display = "flex";
    
    // Reset validation state
    updateValidationState();
    
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
    removePreviewPlayer();
    uploadProgress.style.display = "none";
    uploadForm.style.display = "flex";
    
    // Reset validation state
    updateValidationState();
    
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
      
      // Keep error message visible - don't auto-hide on failure
      // User can manually close the modal or try again
    }
  }
}

// Info modal functionality
function initializeInfoModal() {
  const infoButton = document.getElementById("info-button");
  const infoModal = document.getElementById("info-modal");
  const infoClose = document.getElementById("info-close");
  
  if (!infoButton || !infoModal) {
    console.error("Info modal elements not found");
    return;
  }

  // Update info stats
  async function updateInfoStats() {
    const totalSoundsCount = document.getElementById("total-sounds-count");
    const favoritedSoundsCount = document.getElementById("favorited-sounds-count");
    const librarySize = document.getElementById("library-size");
    const libraryPath = document.getElementById("library-path");
    const favoritesPath = document.getElementById("favorites-path");
    
    if (totalSoundsCount) {
      totalSoundsCount.textContent = allSounds.length;
    }
    
    if (favoritedSoundsCount && allFavorites) {
      const favoritedCount = Object.values(allFavorites).filter(Boolean).length;
      favoritedSoundsCount.textContent = favoritedCount;
    }

    // Fetch library information from server
    try {
      const response = await fetch("/api/library-info");
      if (response.ok) {
        const data = await response.json();
        
        if (librarySize) {
          librarySize.textContent = data.librarySize.formatted;
        }
        
        if (libraryPath) {
          libraryPath.textContent = data.paths.libraryPath;
        }
        
        if (favoritesPath) {
          favoritesPath.textContent = data.paths.favoritesPath;
        }
      } else {
        const errorData = await response.json();
        console.error("Failed to fetch library info:", errorData);
        
        if (librarySize) {
          librarySize.textContent = "Error loading";
        }
        
        if (libraryPath && errorData.paths?.libraryPath) {
          libraryPath.textContent = errorData.paths.libraryPath;
        }
        
        if (favoritesPath && errorData.paths?.favoritesPath) {
          favoritesPath.textContent = errorData.paths.favoritesPath;
        }
      }
    } catch (error) {
      console.error("Error fetching library info:", error);
      
      if (librarySize) {
        librarySize.textContent = "Error loading";
      }
      
      if (libraryPath) {
        libraryPath.textContent = "Error loading path";
      }
      
      if (favoritesPath) {
        favoritesPath.textContent = "Error loading path";
      }
    }
  }

  // Open info modal
  async function openInfoModal() {
    infoModal.style.display = "flex";
    await updateInfoStats();
    
    // Add escape key handler
    const handleEscape = (event) => {
      if (event.key === "Escape") {
        closeInfoModal();
      }
    };
    
    document.addEventListener("keydown", handleEscape);
    
    // Store the handler for cleanup
    infoModal._escapeHandler = handleEscape;
  }

  // Close info modal
  function closeInfoModal() {
    infoModal.style.display = "none";
    
    // Remove escape key handler
    if (infoModal._escapeHandler) {
      document.removeEventListener("keydown", infoModal._escapeHandler);
      delete infoModal._escapeHandler;
    }
  }

  // Info button click handler
  infoButton.addEventListener("click", (e) => {
    e.preventDefault();
    openInfoModal();
  });

  // Close button click handler
  if (infoClose) {
    infoClose.addEventListener("click", closeInfoModal);
  }

  // Close modal when clicking outside
  infoModal.addEventListener("click", (e) => {
    if (e.target === infoModal) {
      closeInfoModal();
    }
  });
}

// Error handling functions
function showCriticalError(errorData) {
  const loadingScreen = document.getElementById("loading");
  const criticalErrorScreen = document.getElementById("critical-error");
  const criticalErrorMessage = document.getElementById("critical-error-message");
  const criticalErrorDetails = document.getElementById("critical-error-details");
  
  loadingScreen.style.display = "none";
  
  let message = "";
  let details = "";
  
  switch (errorData.error) {
    case "DIRECTORY_NOT_FOUND":
      message = "The sound effects directory could not be found. Please check your configuration.";
      details = `
        <h4>What to do:</h4>
        <p>1. Create the directory: <code>${errorData.path}</code></p>
        <p>2. Or update the path in: <code>${errorData.configPath}</code></p>
        <p>3. Restart the server after making changes</p>
      `;
      break;
      
    case "DIRECTORY_ACCESS_DENIED":
      message = "Cannot access the sound effects directory. Please check permissions.";
      details = `
        <h4>What to do:</h4>
        <p>1. Check folder permissions for: <code>${errorData.path}</code></p>
        <p>2. Make sure the server has read/write access</p>
        <p>3. Error details: ${errorData.details}</p>
      `;
      break;
      
    case "DIRECTORY_READ_ERROR":
      message = "An error occurred while reading the sound effects directory.";
      details = `
        <h4>What to do:</h4>
        <p>1. Check if the directory exists: <code>${errorData.path}</code></p>
        <p>2. Verify folder permissions</p>
        <p>3. Error details: ${errorData.details}</p>
      `;
      break;
      
    case "FAVORITES_FILE_ERROR":
      message = "The favorites file is corrupted or cannot be accessed.";
      details = `
        <h4>What to do:</h4>
        <p>1. Check if file exists: <code>${errorData.path}</code></p>
        <p>2. If corrupted, delete it (will be recreated as <code>{}</code>)</p>
        <p>3. Or update the path in: <code>${errorData.configPath}</code></p>
      `;
      break;
      
    case "NETWORK_ERROR":
      message = "Could not connect to the server. Please check if the server is running.";
      details = `
        <h4>What to do:</h4>
        <p>1. Make sure the server is running on port 3000</p>
        <p>2. Check your internet connection</p>
        <p>3. Try refreshing the page</p>
      `;
      break;
      
    default:
      message = errorData.message || "An unknown error occurred.";
      details = `
        <h4>Error details:</h4>
        <p>${errorData.details || "No additional details available"}</p>
      `;
  }
  
  criticalErrorMessage.textContent = message;
  criticalErrorDetails.innerHTML = details;
  criticalErrorScreen.style.display = "flex";
}

function showEmptyDirectory() {
  const emptyDirectoryScreen = document.getElementById("empty-directory");
  
  // Show empty directory screen
  emptyDirectoryScreen.style.display = "flex";
  
  // Initialize upload functionality even when empty
  initializeUpload();
  initializeInfoModal();
}

// Load sounds when page loads
loadSounds();

// Initialize retry button functionality
document.addEventListener("DOMContentLoaded", function() {
  const retryButton = document.getElementById("retry-button");
  if (retryButton) {
    retryButton.addEventListener("click", function() {
      location.reload(); // Simple page reload to retry
    });
  }
});