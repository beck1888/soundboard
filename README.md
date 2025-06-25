# 🎵 Pulse Bin

A fast, self-hosted sound effects management solution designed for speed and ease of use. Perfect for streamers, content creators, or anyone who needs quick access to audio clips.

## ✨ Features

### 🚀 **Lightning-Fast Performance**
- **Instant search** with fuzzy matching and smart ranking
- **Real-time audio preview** during upload
- **Smooth playback** with visual progress indicators
- **Responsive grid layout** optimized for quick browsing

### 🎧 **Audio Management**
- **Universal format support** - Upload any audio format (MP3, WAV, FLAC, M4A, AAC, OGG, WMA, WebM)
- **Automatic conversion** to MP3 with optimized quality (192kbps, 44.1kHz stereo)
- **Metadata cleaning** - Strips unnecessary metadata while preserving title
- **Drag & drop upload** with real-time validation
- **Smart file naming** with auto-suggestions and validation

### 🔍 **Smart Search & Organization**
- **Fuzzy search** - Find sounds even with typos
- **Favorites system** with heart filter toggle
- **Real-time search** as you type
- **Keyboard shortcuts** (`/` or `Cmd/Ctrl+F` to focus search)
- **Smart ranking** - Favorites and exact matches appear first

### 🎛️ **Audio Controls**
- **Built-in audio player** with progress bar seeking
- **Play/pause controls** with visual feedback
- **Time display** showing duration and current position
- **One-click download** for any sound file
- **Context menu** with rename and delete options

### 🔧 **Management Tools**
- **In-place renaming** with validation and conflict detection
- **Safe deletion** with confirmation checkbox
- **Library statistics** showing total sounds, favorites, and storage size
- **Path configuration** via JSON config file
- **Automatic directory creation** for missing folders

### 📱 **User Experience**
- **Responsive design** works on desktop, tablet, and mobile
- **Clean, modern interface** with smooth animations
- **Keyboard navigation** and accessibility features
- **Visual feedback** for all interactions
- **Error handling** with helpful messages

## 🏗️ Architecture

Pulse Bin is built as a lightweight web application:
- **Frontend**: Vanilla HTML/CSS/JavaScript for maximum performance
- **Backend**: Node.js with Express for API and file serving
- **Audio Processing**: FFmpeg for format conversion and metadata handling
- **Storage**: File system with JSON for favorites/metadata
- **Icons**: Microsoft Fluent UI System Icons

## 📋 Requirements

- **Node.js** 16+ 
- **NPM** or **Yarn**
- **FFmpeg** (automatically installed via ffmpeg-static)

## 🚀 Quick Start

### 1. Clone and Install
```bash
git clone <repository-url>
cd soundboard
npm install
```

### 2. Configure Paths
Edit `public/config.json` to set your desired paths:
```json
{
    "soundEffectDirFilePath": "<full_file_path_to_folder>",
    "stateDataFilePath": "<full_file_path_to_favorites.json>"
}
```

### 3. Create Required Directories
```bash
# Create the sound effects directory
mkdir -p <fp_for_dir_to_save_and_read_sounds>

# Create the user storage directory  
mkdir -p <fp_to_user_storage_folder>
```

### 4. Start the Server
```bash
npm start
```

### 5. Access Pulse Bin
Open your browser and navigate to: `http://localhost:3000`

### Required Files and Directories

| Path | Type | Purpose | Auto-created? |
|------|------|---------|---------------|
| Sound effects directory | Directory | Stores all audio files | ✅ Yes (on first upload) |
| User storage directory | Directory | Contains favorites.json | ✅ Yes (when needed) |
| favorites.json | File | Stores favorite status | ✅ Yes (when first favorite is set) |

### Default Paths

If `config.json` is missing or invalid, Pulse Bin falls back to:
- **Sound effects**: `./sfx/` (relative to project root)
- **Favorites**: `./user_storage/favorites.json`

## 🎯 Self-Hosting Guide

### Raspberry Pi Setup
Perfect for a dedicated sound server:

1. **Install Node.js**:

2. **Clone and setup**:
   ```bash
   git clone https://github.com/beck1888/soundboard.git pulse-bin
   cd pulse-bin
   npm install
   ```

3. **Create systemd service** (`/etc/systemd/system/pulse-bin.service`):
   ```ini
   [Unit]
   Description=Pulse Bin Sound Server
   After=network.target

   [Service]
   Type=simple
   User=pi
   WorkingDirectory=/home/pi/pulse-bin
   ExecStart=/usr/bin/node server.js
   Restart=always

   [Install]
   WantedBy=multi-user.target
   ```

4. **Enable and start**:
   ```bash
   sudo systemctl enable pulse-bin
   sudo systemctl start pulse-bin
   ```

### Laptop/Desktop Setup
Great for local use or development:

1. **Follow the Quick Start guide above**
2. **Optional**: Set up as a system service using PM2
   ```bash
   npm install -g pm2
   pm2 start server.js --name pulse-bin
   pm2 startup
   pm2 save
   ```

## 🎮 Usage

### Uploading Sounds
1. Click the **➕ Upload** button
2. **Drag & drop** or **click to select** an audio file
3. **Preview** the audio if needed
4. **Enter a name** (auto-suggested from filename)
5. Click **Upload** - conversion happens automatically

### Managing Sounds
- **Play**: Click the play button on any sound
- **Favorite**: Click the heart icon to favorite/unfavorite
- **Search**: Use the search bar or press `/` for quick access
- **Filter**: Click the heart filter to show only favorites
- **Rename**: Right-click → Rename (or click the ⋯ menu)
- **Delete**: Right-click → Delete (or click the ⋯ menu)
- **Download**: Click the download button

### Keyboard Shortcuts
- **`/`** or **`Cmd/Ctrl+F`**: Focus search
- **`Escape`**: Close modals or clear search
- **`Enter`**: Confirm actions in modals

## 🔧 Technical Details

### Supported Audio Formats
**Input**: MP3, WAV, FLAC, M4A, AAC, OGG, WMA, WebM  
**Output**: MP3 (192kbps, 44.1kHz stereo)

### File Processing
- **Automatic conversion** to MP3 for consistency
- **Metadata stripping** (except title) for privacy
- **Quality optimization** for web playback
- **Error handling** for corrupted files

### Performance Features
- **Metadata preloading** for instant duration display
- **Smooth animations** with requestAnimationFrame
- **Debounced search** for responsive typing
- **Lazy loading** of audio content
- **Memory management** for preview players

## 🐛 Troubleshooting

### Common Issues

**🚫 "No Audio Files Found"**
- Check that your sound directory exists and contains MP3 files
- Verify the path in `config.json` is correct
- Try uploading a file to test the upload functionality

**⚠️ "Configuration Error"**
- Ensure `config.json` has valid JSON syntax
- Check that specified directories are accessible
- Verify file permissions for the directories

**🔄 Upload Fails**
- Check file size (max 50MB)
- Ensure the file is a valid audio format
- Verify disk space in the destination directory

**🔍 Search Not Working**
- Refresh the page to reload the sound library
- Check browser console for JavaScript errors
- Ensure favorites.json is not corrupted

### Logs and Debugging
- Server logs appear in the console where you ran `npm start`
- Browser errors appear in Developer Tools console (F12)
- File operations are logged with emoji indicators (✅ 🚫 ⚠️)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## Acknowledgments

- **Icons**: This project uses [Microsoft Fluent UI System Icons](https://github.com/microsoft/fluentui-system-icons) licensed under MIT
- **FFmpeg**: Audio processing powered by FFmpeg

## 📄 License

MIT License

Copyright (c) 2025

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

---

**Made with ❤️ for the audio community**  
*Fast, simple, self-hosted sound management*
