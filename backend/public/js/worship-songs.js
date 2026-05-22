const token = localStorage.getItem("token");

if (!token) {
    window.location.href = "index.html";
}

let authPayload = null;
try {
    authPayload = JSON.parse(atob(token.split(".")[1]));
} catch (err) {
    localStorage.removeItem("token");
    window.location.href = "index.html";
}

const normalizedRole = String(authPayload?.role || "").toLowerCase();
const canManageSongs = ["admin", "user"].includes(normalizedRole);
const canCreateFolders = normalizedRole === "admin";

const songsIntro = document.getElementById("songsIntro");
const songsFolders = document.getElementById("songsFolders");
const songsEmptyState = document.getElementById("songsEmptyState");
const songManageCard = document.getElementById("songManageCard");
const folderManageCard = document.getElementById("folderManageCard");
const songForm = document.getElementById("songForm");
const folderForm = document.getElementById("folderForm");
const songStatus = document.getElementById("songStatus");
const folderStatus = document.getElementById("folderStatus");
const songFolderSelect = document.getElementById("songFolder");
const refreshSongsBtn = document.getElementById("refreshSongsBtn");
const songsRolePill = document.getElementById("songsRolePill");
const songsRoleNote = document.getElementById("songsRoleNote");

let folderItems = [];
let songItems = [];

function buildFreshApiUrl(path, params = {}) {
    const url = new URL(path, window.location.origin);
    Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== "") {
            url.searchParams.set(key, value);
        }
    });
    url.searchParams.set("_ts", Date.now().toString());
    return url.toString();
}

async function fetchFreshJson(path, params = {}) {
    const res = await fetch(buildFreshApiUrl(path, params), {
        headers: {
            Authorization: `Bearer ${token}`,
            "Cache-Control": "no-cache"
        },
        cache: "no-store"
    });
    const data = await res.json().catch(() => ([]));
    if (!res.ok) {
        throw new Error(data.error || "Request failed");
    }
    return data;
}

if (canManageSongs && songManageCard) {
    songManageCard.style.display = "block";
}

if (canCreateFolders && folderManageCard) {
    folderManageCard.style.display = "block";
}

if (songsIntro) {
    songsIntro.textContent = canManageSongs
        ? "Browse worship audio by Sunday service folders and upload songs into the right service date."
        : "Browse worship audio by Sunday service folders, listen online, and download what you need.";
}

if (songsRolePill) {
    const roleLabels = {
        admin: "Admin access",
        user: "Team access",
        normaluser: "Member access"
    };
    songsRolePill.textContent = roleLabels[normalizedRole] || "Library access";
    songsRolePill.style.display = "inline-flex";
}

if (songsRoleNote) {
    songsRoleNote.textContent = canCreateFolders
        ? "Admins create Sunday service folders and can upload or delete songs inside them."
        : canManageSongs
            ? "Team users can upload songs into folders created by admins, while members stay in listening and download mode."
            : "Members can open each Sunday service folder to stream or download the available worship audio.";
}

document.getElementById("logoutBtn")?.addEventListener("click", () => {
    localStorage.removeItem("token");
    window.location.href = "index.html";
});

function escapeHtml(value) {
    return String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function showSongStatus(message, tone = "info") {
    if (!songStatus) return;
    songStatus.style.display = "block";
    songStatus.textContent = message;
    songStatus.className = `status-panel ${tone === "error" ? "status-error" : tone === "success" ? "status-success" : "status-info"}`;
}

function showFolderStatus(message, tone = "info") {
    if (!folderStatus) return;
    folderStatus.style.display = "block";
    folderStatus.textContent = message;
    folderStatus.className = `status-panel ${tone === "error" ? "status-error" : tone === "success" ? "status-success" : "status-info"}`;
}

function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

function buildSongTitleFromFile(fileName) {
    return String(fileName || "")
        .replace(/\.[^.]+$/, "")
        .replace(/[_-]+/g, " ")
        .replace(/\s+/g, " ")
        .trim() || "Worship song";
}

function formatServiceDate(value, options = {}) {
    const parsed = value ? new Date(`${value}T00:00:00`) : null;
    if (!parsed || Number.isNaN(parsed.getTime())) {
        return "Unknown service date";
    }

    return new Intl.DateTimeFormat(undefined, {
        weekday: options.includeWeekday === false ? undefined : "long",
        month: "long",
        day: "numeric",
        year: "numeric"
    }).format(parsed);
}

function formatSongTimestamp(value) {
    const parsed = value ? new Date(value) : null;
    if (!parsed || Number.isNaN(parsed.getTime())) {
        return "Recently added";
    }

    return new Intl.DateTimeFormat(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric"
    }).format(parsed);
}

function buildSongsByFolder(items) {
    const map = new Map();
    items.forEach((item) => {
        const key = Number(item.folder_id) || 0;
        if (!map.has(key)) {
            map.set(key, []);
        }
        map.get(key).push(item);
    });
    return map;
}

function renderFolderOptions(folders) {
    if (!songFolderSelect) return;

    const currentValue = songFolderSelect.value;
    songFolderSelect.innerHTML = '<option value="">Choose service folder</option>';

    folders.forEach((folder) => {
        const option = document.createElement("option");
        option.value = folder.id;
        option.textContent = `${folder.folder_name} (${formatServiceDate(folder.service_date, { includeWeekday: false })})`;
        songFolderSelect.appendChild(option);
    });

    if (folders.some((folder) => String(folder.id) === currentValue)) {
        songFolderSelect.value = currentValue;
    }
}

function renderSongsLibrary() {
    if (!songsFolders || !songsEmptyState) return;

    songsFolders.innerHTML = "";

    if (!folderItems.length) {
        songsEmptyState.style.display = "block";
        songsEmptyState.textContent = canCreateFolders
            ? "No Sunday service folders have been created yet. Start by creating the first folder."
            : "No Sunday service folders are available yet. Please check back after an admin creates one.";
        return;
    }

    songsEmptyState.style.display = "none";

    const songsByFolder = buildSongsByFolder(songItems);

    folderItems.forEach((folder) => {
        const folderSongs = songsByFolder.get(Number(folder.id)) || [];
        const link = document.createElement("a");
        link.className = "songs-folder-card";
        link.href = `worship-songs-folder.html?id=${encodeURIComponent(folder.id)}`;

        const header = document.createElement("div");
        header.className = "songs-folder-header";

        const headerCopy = document.createElement("div");
        headerCopy.className = "songs-folder-copy";

        const title = document.createElement("h3");
        title.textContent = folder.folder_name || "Sunday Service";

        const subtitle = document.createElement("p");
        subtitle.className = "muted";
        subtitle.textContent = formatServiceDate(folder.service_date);

        headerCopy.appendChild(title);
        headerCopy.appendChild(subtitle);

        const count = document.createElement("span");
        count.className = "songs-folder-count";
        count.textContent = `${folderSongs.length} ${folderSongs.length === 1 ? "audio" : "audios"}`;

        header.appendChild(headerCopy);
        header.appendChild(count);

        const preview = document.createElement("div");
        preview.className = "songs-folder-preview";
        preview.innerHTML = `
            <span>${escapeHtml(folderSongs[0]?.title || "No audio uploaded yet")}</span>
            <span>${folderSongs.length ? escapeHtml(`Updated ${formatSongTimestamp(folderSongs[0]?.created_at)}`) : "Open folder to manage or view songs"}</span>
        `;

        const footer = document.createElement("div");
        footer.className = "songs-folder-footer";
        footer.innerHTML = `
            <span class="songs-folder-open">Open folder</span>
            <span class="songs-folder-arrow" aria-hidden="true">&rarr;</span>
        `;

        link.appendChild(header);
        link.appendChild(preview);
        link.appendChild(footer);
        songsFolders.appendChild(link);
    });
}

async function loadFolders() {
    const data = await fetchFreshJson("/api/worship-songs/folders");
    folderItems = Array.isArray(data) ? data : [];
    renderFolderOptions(folderItems);
}

async function loadSongs() {
    const data = await fetchFreshJson("/api/worship-songs", { include_file_data: 0 });
    songItems = Array.isArray(data) ? data : [];
}

async function loadLibrary() {
    let songsLoadFailed = false;

    try {
        await loadFolders();
    } catch (err) {
        console.error(err);
        if (songsEmptyState) {
            songsFolders.innerHTML = "";
            songsEmptyState.style.display = "block";
            songsEmptyState.textContent = "Unable to load worship folders right now.";
        }
        return;
    }

    try {
        await loadSongs();
    } catch (err) {
        console.error(err);
        songsLoadFailed = true;
        songItems = [];
    }

    renderSongsLibrary();

    if (songsLoadFailed && songsEmptyState && folderItems.length) {
        songsEmptyState.style.display = "block";
        songsEmptyState.textContent = "Folders are available, but song previews could not be refreshed right now.";
    }
}

folderForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!canCreateFolders) return;

    const serviceDate = document.getElementById("folderServiceDate").value;

    if (!serviceDate) {
        showFolderStatus("Service date is required.", "error");
        return;
    }

    try {
        showFolderStatus("Creating service folder...");
        const res = await fetch("/api/worship-songs/folders", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({ service_date: serviceDate })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            showFolderStatus(data.error || "Failed to create folder.", "error");
            return;
        }

        folderForm.reset();
        showFolderStatus("Service folder created successfully.", "success");
        await loadLibrary();
    } catch (err) {
        console.error(err);
        showFolderStatus("Server error while creating folder.", "error");
    }
});

songForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!canManageSongs) return;

    const folderId = document.getElementById("songFolder").value;
    const file = document.getElementById("songFile").files[0];
    const title = buildSongTitleFromFile(file?.name);
    const artist = "";
    const description = "";

    if (!folderId || !file) {
        showSongStatus("Folder and audio file are required.", "error");
        return;
    }

    if (!file.type.startsWith("audio/")) {
        showSongStatus("Please choose a valid audio file.", "error");
        return;
    }

    if (file.size > 20 * 1024 * 1024) {
        showSongStatus("Audio file is too large. Please keep it under 20 MB.", "error");
        return;
    }

    try {
        showSongStatus("Uploading worship song...");
        const fileData = await fileToDataUrl(file);
        const res = await fetch("/api/worship-songs", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({
                folder_id: Number(folderId),
                title,
                artist,
                description,
                file_name: file.name,
                file_data: fileData,
                mime_type: file.type
            })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            showSongStatus(data.error || "Failed to upload song.", "error");
            return;
        }

        songForm.reset();
        showSongStatus("Worship song uploaded successfully.", "success");
        await loadLibrary();
    } catch (err) {
        console.error(err);
        showSongStatus("Server error while uploading song.", "error");
    }
});

refreshSongsBtn?.addEventListener("click", loadLibrary);

loadLibrary();
