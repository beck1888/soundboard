const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = 3000;

// 👇 CHANGE THIS to your actual sound folder path
const SFX_DIR = path.resolve("/Users/beckorion/Documents/Developer/Web/soundboard/sfx");
const FAVORITES_FILE = path.resolve("/Users/beckorion/Documents/Developer/Web/soundboard/user_storage/favorites.json");

console.log("🎯 Looking for files in:", SFX_DIR);

// Helper functions for favorites
function loadFavorites() {
  try {
    if (fs.existsSync(FAVORITES_FILE)) {
      const data = fs.readFileSync(FAVORITES_FILE, 'utf8');
      return JSON.parse(data);
    }
    return {};
  } catch (err) {
    console.error("Error loading favorites:", err);
    return {};
  }
}

function saveFavorites(favorites) {
  try {
    // Ensure user_storage directory exists
    const userStorageDir = path.dirname(FAVORITES_FILE);
    if (!fs.existsSync(userStorageDir)) {
      fs.mkdirSync(userStorageDir, { recursive: true });
    }
    fs.writeFileSync(FAVORITES_FILE, JSON.stringify(favorites, null, 2));
    return true;
  } catch (err) {
    console.error("Error saving favorites:", err);
    return false;
  }
}

function syncFavoritesWithSounds(sounds, favorites) {
  let updated = false;
  
  // Add any new sounds that aren't in favorites
  sounds.forEach(sound => {
    if (!(sound in favorites)) {
      favorites[sound] = false;
      updated = true;
    }
  });
  
  // Remove any favorites that no longer exist in sounds
  Object.keys(favorites).forEach(sound => {
    if (!sounds.includes(sound)) {
      delete favorites[sound];
      updated = true;
    }
  });
  
  return updated;
}

// Serve static files from "public"
app.use(express.static("public"));
app.use(express.json()); // Parse JSON bodies

// List MP3s with favorites
app.get("/api/sounds", (req, res) => {
  fs.readdir(SFX_DIR, (err, files) => {
    if (err) {
      console.error("🚨 Failed to read sound directory:", err.message);
      return res.status(500).json({ error: "Error reading sound directory" });
    }

    const mp3s = files.filter(file => file.toLowerCase().endsWith(".mp3"));
    let favorites = loadFavorites();
    
    // Sync favorites with current sounds
    const updated = syncFavoritesWithSounds(mp3s, favorites);
    if (updated) {
      saveFavorites(favorites);
    }
    
    res.json({ sounds: mp3s, favorites });
  });
});

// Toggle favorite status
app.post("/api/favorites/:filename", (req, res) => {
  const filename = req.params.filename;
  let favorites = loadFavorites();
  
  // Toggle the favorite status
  favorites[filename] = !favorites[filename];
  
  if (saveFavorites(favorites)) {
    res.json({ success: true, favorite: favorites[filename] });
  } else {
    res.status(500).json({ error: "Failed to save favorites" });
  }
});

// Serve actual MP3 files
app.get("/sfx/:filename", (req, res) => {
  const filePath = path.join(SFX_DIR, req.params.filename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).send("File not found");
  }
  res.sendFile(filePath);
});

app.listen(PORT, () => {
  console.log(`🚀 App listening at http://localhost:${PORT}`);
});