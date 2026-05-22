let allGalleryItems = [];

async function fetchGallery() {
    try {
        const response = await fetch('/api/gallery');
        allGalleryItems = await response.json();
        renderGallery('all');
    } catch (error) {
        console.error("Gallery fetch failed:", error);
    }
}

function renderGallery(filterType) {
    const grid = document.getElementById('galleryGrid');
    grid.innerHTML = '';

    const filteredItems = filterType === 'all' 
        ? allGalleryItems 
        : allGalleryItems.filter(item => item.type === filterType);

    filteredItems.forEach(item => {
        const card = document.createElement('div');
        // Randomly assign wide/tall classes for masonry effect if not specified in DB
        card.className = `gallery-item ${item.displayClass || ''}`;
        
        if (item.type === 'image') {
            card.innerHTML = `
                <img src="${item.url}" alt="Ministry Photo" loading="lazy">
                <span class="badge">IMAGE</span>
            `;
        } else {
            card.innerHTML = `
                <video muted loop onmouseover="this.play()" onmouseout="this.pause()">
                    <source src="${item.url}" type="video/mp4">
                </video>
                <span class="badge">VIDEO</span>
            `;
        }
        grid.appendChild(card);
    });
}

// Function for the tab buttons
function filterGallery(type, btn) {
    // UI Update
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    
    // Logic Update
    renderGallery(type);
}

document.addEventListener('DOMContentLoaded', fetchGallery);