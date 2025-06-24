const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = 3000;

// 👇 CHANGE THIS to your actual sound folder path
const SFX_DIR = path.resolve("/Users/beckorion/Documents/Developer/Web/soundboard/sfx");

console.log("🎯 Looking for files in:", SFX_DIR);

// Serve static files from "public"
app.use(express.static("public"));

// List MP3s
app.get("/api/sounds", (req, res) => {
  fs.readdir(SFX_DIR, (err, files) => {
    if (err) {
      console.error("🚨 Failed to read sound directory:", err.message);
      return res.status(500).json({ error: "Error reading sound directory" }); // Send proper JSON
    }

    const mp3s = files.filter(file => file.toLowerCase().endsWith(".mp3"));
    res.json(mp3s);
  });
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