const sermonContainer = document.querySelector('.sermon-grid');

async function loadSermons() {
    // 1. Fetch data from your API
    const response = await fetch('/api/sermons');
    const sermons = await response.json();

    // 2. Loop through sermons and create the HTML cards dynamically
    sermonContainer.innerHTML = sermons.map(sermon => `
        <div class="sermon-card">
            <div class="thumbnail-placeholder">
                <video width="100%">
                    <source src="${sermon.videoUrl}" type="video/mp4">
                </video>
            </div>
            <div class="card-content">
                <h3>${sermon.title}</h3>
                <p>${sermon.description}</p>
                <div class="meta">
                    <span>${sermon.date}</span>
                </div>
            </div>
        </div>
    `).join('');
}

loadSermons();