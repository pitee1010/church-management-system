// Function to fetch and display Worship content
async function initializeWorship() {
    try {
        // Fetching data from your Express API
        const response = await fetch('/api/worship');
        const data = await response.json(); // Expected: { videos: [], audios: [] }

        const videoContainer = document.getElementById('videoPlaylist');
        const audioContainer = document.getElementById('audioPlaylist');

        // Populate Videos
        videoContainer.innerHTML = data.videos.map(v => `
            <div class="video-item" onclick="changeMainPlayer('${v.videoUrl}', '${v.title}')">
                <img src="${v.thumbnailUrl || 'assets/default-thumb.jpg'}" width="80">
                <div>
                    <div style="font-size:0.9rem; font-weight:600;">${v.title}</div>
                    <small>${v.category}</small>
                </div>
            </div>
        `).join('');

        // Populate Audios
        data.audios.forEach((track, i) => {
            const row = document.createElement('div');
            row.className = 'audio-row';
            row.innerHTML = `
                <span>${i + 1}</span>
                <span>${track.title}</span>
                <span>${track.artist || 'Ministry Choir'}</span>
                <audio controls src="${track.fileUrl}"></audio>
            `;
            audioContainer.appendChild(row);
        });

    } catch (error) {
        console.error("Error loading worship content:", error);
    }
}

// Function to switch the main video player source
function changeMainPlayer(url, title) {
    const player = document.getElementById('worshipVideo');
    player.src = url;
    player.play();
    console.log(`Now playing: ${title}`);
}

document.addEventListener('DOMContentLoaded', initializeWorship);