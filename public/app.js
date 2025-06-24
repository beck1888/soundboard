fetch("/api/sounds")
  .then(res => {
    if (!res.ok) throw new Error("API request failed");
    return res.json();
  })
  .then(files => {
    const container = document.getElementById("sounds");
    container.innerHTML = ""; // clear loading text

    if (!files.length) {
      container.innerHTML = "<p>No MP3s found 😢</p>";
      return;
    }

    files.forEach(file => {
      const div = document.createElement("div");
      div.innerHTML = `
        <p><strong>${file}</strong></p>
        <audio controls src="/sfx/${encodeURIComponent(file)}"></audio>
        <hr/>
      `;
      container.appendChild(div);
    });
  })
  .catch(err => {
    console.error("Failed to fetch sounds:", err);
    document.getElementById("sounds").innerHTML = "<p>Failed to load sounds 🫠</p>";
  });