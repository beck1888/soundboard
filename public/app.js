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
        <p>${file}</p>
        <audio controls preload="none" src="/sfx/${encodeURIComponent(file)}"></audio>
      `;
      container.appendChild(div);
    });
  })
  .catch(err => {
    console.error("Failed to fetch sounds:", err);
    document.getElementById("sounds").innerHTML = "<p>Failed to load sounds 🫠</p>";
  });