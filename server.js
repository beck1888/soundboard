const express = require("express");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const ffmpeg = require("fluent-ffmpeg");
const ffmpegStatic = require("ffmpeg-static");

// Set ffmpeg path
ffmpeg.setFfmpegPath(ffmpegStatic);

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

// Function to strip metadata except title
function stripMetadataExceptTitle(inputPath, outputPath, title) {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .outputOptions([
        '-map', '0:a', // Copy audio stream
        '-c:a', 'copy', // Don't re-encode audio (faster)
        '-map_metadata', '-1', // Remove all metadata
        '-metadata', `title=${title}`, // Add back only the title
        '-write_id3v1', '0', // Don't write ID3v1 tags
        '-write_id3v2', '1' // Write minimal ID3v2 tags
      ])
      .output(outputPath)
      .on('end', () => {
        console.log('✅ Metadata stripped successfully');
        resolve();
      })
      .on('error', (err) => {
        console.error('❌ Error stripping metadata:', err);
        reject(err);
      })
      .run();
  });
}

// Serve static files from "public"
app.use(express.static("public"));
app.use(express.json()); // Parse JSON bodies

// Upload endpoint
app.post("/api/upload", upload.single('soundFile'), async (req, res) => {
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
    
    // Create a temporary path for the processed file
    const processedTempPath = path.join(SFX_DIR, `processed_${Date.now()}_${finalFilename}`);
    
    try {
      // Strip metadata except title
      await stripMetadataExceptTitle(req.file.path, processedTempPath, sanitizedName.replace('.mp3', ''));
      
      // Remove the original uploaded file
      fs.unlinkSync(req.file.path);
      
      // Rename the processed file to the final filename
      fs.renameSync(processedTempPath, finalPath);
      
      console.log(`✅ File uploaded and processed successfully: ${finalFilename}`);
      
    } catch (processingError) {
      console.error('Error processing file:', processingError);
      
      // Clean up files on error
      if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      if (fs.existsSync(processedTempPath)) fs.unlinkSync(processedTempPath);
      
      return res.status(500).json({ error: "Error processing file metadata" });
    }
    
    // Update favorites to include the new sound
    let favorites = loadFavorites();
    favorites[finalFilename] = false; // New sounds are not favorited by default
    saveFavorites(favorites);
    
    res.json({ 
      success: true, 
      filename: finalFilename,
      message: "File uploaded and processed successfully"
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