const express = require("express");
const fs = require("fs");
const path = require("path");
const multer = require("multer");

const app = express();
const PORT = 3000;

// 👇 CHANGE THIS to your actual sound folder path
const SFX_DIR = path.resolve("/Users/beckorion/Documents/Developer/Web/soundboard/sfx");
const FAVORITES_FILE = path.resolve("/Users/beckorion/Documents/Developer/Web/soundboard/user_storage/favorites.json");

console.log("🎯 Looking for files in:", SFX_DIR);

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // Ensure SFX directory exists
    if (!fs.existsSync(SFX_DIR)) {
      fs.mkdirSync(SFX_DIR, { recursive: true });
    }
    cb(null, SFX_DIR);
  },
  filename: function (req, file, cb) {
    // Generate a temporary filename first, we'll rename it later
    const timestamp = Date.now();
    const tempFilename = `temp_${timestamp}_${file.originalname}`;
    cb(null, tempFilename);
  }
});

const upload = multer({
  storage: storage,
  fileFilter: function (req, file, cb) {
    // Only allow MP3 files
    if (file.mimetype === 'audio/mpeg' || file.originalname.toLowerCase().endsWith('.mp3')) {
      cb(null, true);
    } else {
      cb(new Error('Only MP3 files are allowed'));
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

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

// Upload endpoint
app.post("/api/upload", upload.single('soundFile'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }
    
    if (!req.body.soundName) {
      // Clean up the temporary file
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: "Sound name is required" });
    }
    
    // Sanitize the sound name and ensure .mp3 extension
    const soundName = req.body.soundName.trim();
    const sanitizedName = soundName.replace(/[^a-zA-Z0-9\s\-_]/g, '').trim();
    const finalFilename = sanitizedName.endsWith('.mp3') ? sanitizedName : sanitizedName + '.mp3';
    const finalPath = path.join(SFX_DIR, finalFilename);
    
    // Check if file already exists
    if (fs.existsSync(finalPath)) {
      fs.unlinkSync(req.file.path); // Clean up temp file
      return res.status(400).json({ error: "A sound with this name already exists" });
    }
    
    // Rename the temporary file to the final filename
    fs.renameSync(req.file.path, finalPath);
    
    console.log(`✅ File uploaded successfully: ${finalFilename}`);
    
    // Update favorites to include the new sound
    let favorites = loadFavorites();
    favorites[finalFilename] = false; // New sounds are not favorited by default
    saveFavorites(favorites);
    
    res.json({ 
      success: true, 
      filename: finalFilename,
      message: "File uploaded successfully"
    });
    
  } catch (error) {
    console.error("Upload error:", error);
    
    // Clean up the uploaded file if it exists
    if (req.file && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (cleanupError) {
        console.error("Error cleaning up file:", cleanupError);
      }
    }
    
    res.status(500).json({ error: error.message || "Upload failed" });
  }
});

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