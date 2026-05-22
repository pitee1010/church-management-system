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

const params = new URLSearchParams(window.location.search);
const folderId = Number(params.get("id"));

const folderPageTitle = document.getElementById("folderPageTitle");
const folderPageIntro = document.getElementById("folderPageIntro");
const folderServiceBadge = document.getElementById("folderServiceBadge");
const folderRoleNote = document.getElementById("folderRoleNote");
const folderPageStatus = document.getElementById("folderPageStatus");
const folderSongsEmptyState = document.getElementById("folderSongsEmptyState");
const folderSongsGrid = document.getElementById("folderSongsGrid");
const folderUploadCard = document.getElementById("folderUploadCard");
const folderSongForm = document.getElementById("folderSongForm");
const folderSongStatus = document.getElementById("folderSongStatus");

let activeFolder = null;

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
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw new Error(data.error || "Request failed");
    }
    return data;
}

if (canManageSongs && folderUploadCard) {
    folderUploadCard.style.display = "block";
}

if (folderRoleNote) {
    folderRoleNote.textContent = canManageSongs
        ? "Your role can upload and delete worship audios inside this folder."
        : "Your role can listen to and download the worship audios inside this folder.";
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

function showFolderPageStatus(message, tone = "info") {
    if (!folderPageStatus) return;
    folderPageStatus.style.display = "block";
    folderPageStatus.textContent = message;
    folderPageStatus.className = `status-panel ${tone === "error" ? "status-error" : tone === "success" ? "status-success" : "status-info"}`;
}

function showFolderSongStatus(message, tone = "info") {
    if (!folderSongStatus) return;
    folderSongStatus.style.display = "block";
    folderSongStatus.textContent = message;
    folderSongStatus.className = `status-panel ${tone === "error" ? "status-error" : tone === "success" ? "status-success" : "status-info"}`;
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

function formatServiceDate(value) {
    const parsed = value ? new Date(`${value}T00:00:00`) : null;
    if (!parsed || Number.isNaN(parsed.getTime())) {
        return "Unknown service date";
    }

    return new Intl.DateTimeFormat(undefined, {
        weekday: "long",
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

function renderFolderHeader(folder) {
    const folderName = folder?.folder_name || "Sunday Service";
    const serviceLabel = formatServiceDate(folder?.service_date);

    if (folderPageTitle) {
        folderPageTitle.textContent = folderName;
    }
    if (folderPageIntro) {
        folderPageIntro.textContent = canManageSongs
            ? "Open the worship audio for this Sunday service and manage uploads inside the folder."
            : "Open the worship audio for this Sunday service, listen online, and download what you need.";
    }
    if (folderServiceBadge) {
        folderServiceBadge.textContent = serviceLabel;
    }
}

function renderFolderSongs(items) {
    if (!folderSongsGrid || !folderSongsEmptyState) return;

    folderSongsGrid.innerHTML = "";
    folderSongsEmptyState.style.display = items.length ? "none" : "block";
    folderSongsEmptyState.textContent = "No worship audio has been uploaded to this folder yet.";

    items.forEach((item) => {
        const card = document.createElement("article");
        card.className = "songs-audio-card";

        const title = document.createElement("h4");
        title.textContent = item.title || "Untitled song";

        const meta = document.createElement("div");
        meta.className = "media-meta";
        meta.innerHTML = `
            <span>${escapeHtml(item.file_name || "Audio file")}</span>
            <span>${escapeHtml(formatSongTimestamp(item.created_at))}</span>
        `;

        const audio = document.createElement("audio");
        audio.className = "audio-player";
        audio.controls = true;
        audio.preload = "metadata";
        audio.src = item.file_data;

        const actions = document.createElement("div");
        actions.className = "media-actions";

        const downloadLink = document.createElement("a");
        downloadLink.className = "download-link";
        downloadLink.href = item.file_data;
        downloadLink.download = item.file_name || `${item.title || "worship-song"}.mp3`;
        downloadLink.textContent = "Download";
        actions.appendChild(downloadLink);

        if (canManageSongs) {
            const deleteBtn = document.createElement("button");
            deleteBtn.className = "small-btn btn-danger";
            deleteBtn.textContent = "Delete";
            deleteBtn.addEventListener("click", () => deleteSong(item.id, item.title));
            actions.appendChild(deleteBtn);
        }

        card.appendChild(title);
        card.appendChild(meta);
        card.appendChild(audio);
        card.appendChild(actions);
        folderSongsGrid.appendChild(card);
    });
}

async function loadFolder() {
    const data = await fetchFreshJson(`/api/worship-songs/folders/${folderId}`);
    activeFolder = data;
    renderFolderHeader(activeFolder);
}

async function loadFolderSongs() {
    const data = await fetchFreshJson("/api/worship-songs", { folder_id: folderId, include_file_data: 1 });
    renderFolderSongs(Array.isArray(data) ? data : []);
}

async function loadFolderPage() {
    if (!folderId) {
        showFolderPageStatus("This folder link is invalid.", "error");
        if (folderSongsEmptyState) {
            folderSongsEmptyState.style.display = "block";
            folderSongsEmptyState.textContent = "Choose a valid worship folder from the main library page.";
        }
        return;
    }

    try {
        showFolderPageStatus("Loading folder...");
        await Promise.all([loadFolder(), loadFolderSongs()]);
        folderPageStatus.style.display = "none";
    } catch (err) {
        console.error(err);
        showFolderPageStatus(err.message || "Unable to load this folder right now.", "error");
        if (folderSongsEmptyState) {
            folderSongsEmptyState.style.display = "block";
            folderSongsEmptyState.textContent = "Unable to load worship audio for this folder right now.";
        }
    }
}

async function deleteSong(id, title) {
    if (!canManageSongs) return;
    if (!confirm(`Delete "${title || "this song"}"?`)) return;

    try {
        const res = await fetch(`/api/worship-songs/${id}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            alert(data.error || "Failed to delete song");
            return;
        }
        await loadFolderSongs();
    } catch (err) {
        console.error(err);
        alert("Server error while deleting song");
    }
}

folderSongForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!canManageSongs || !folderId) return;

    const file = document.getElementById("folderSongFile").files[0];
    const title = buildSongTitleFromFile(file?.name);

    if (!file) {
        showFolderSongStatus("Audio file is required.", "error");
        return;
    }

    if (!file.type.startsWith("audio/")) {
        showFolderSongStatus("Please choose a valid audio file.", "error");
        return;
    }

    if (file.size > 20 * 1024 * 1024) {
        showFolderSongStatus("Audio file is too large. Please keep it under 20 MB.", "error");
        return;
    }

    try {
        showFolderSongStatus("Uploading worship audio...");
        const fileData = await fileToDataUrl(file);
        const res = await fetch("/api/worship-songs", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({
                folder_id: folderId,
                title,
                artist: "",
                description: "",
                file_name: file.name,
                file_data: fileData,
                mime_type: file.type
            })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            showFolderSongStatus(data.error || "Failed to upload audio.", "error");
            return;
        }

        folderSongForm.reset();
        showFolderSongStatus("Worship audio uploaded successfully.", "success");
        await loadFolderSongs();
    } catch (err) {
        console.error(err);
        showFolderSongStatus("Server error while uploading audio.", "error");
    }
});

loadFolderPage();
