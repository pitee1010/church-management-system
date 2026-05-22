const db = require("../utils/db");

const MANAGER_ROLES = new Set(["admin", "user"]);
const ADMIN_ROLES = new Set(["admin"]);

function setNoStoreHeaders(res) {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    res.setHeader("Vary", "Authorization");
}

function isValidDataUrl(value, allowedPrefix) {
    const raw = String(value || "").trim();
    return raw.startsWith(`data:${allowedPrefix}`);
}

function isValidDateOnly(value) {
    return /^\d{4}-\d{2}-\d{2}$/.test(String(value || "").trim());
}

function buildFolderName(serviceDate) {
    const parsed = new Date(`${serviceDate}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) {
        return "Sunday Service";
    }

    const formatted = new Intl.DateTimeFormat("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric"
    }).format(parsed);
    return `Sunday Service - ${formatted}`;
}

exports.getFolders = async (req, res) => {
    try {
        setNoStoreHeaders(res);
        const [rows] = await db.execute(
            `SELECT id, folder_name, service_date, created_at
             FROM worship_song_folders
             ORDER BY service_date DESC, id DESC`
        );
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.getFolderById = async (req, res) => {
    try {
        setNoStoreHeaders(res);
        const id = Number(req.params.id);
        if (!id) {
            return res.status(400).json({ error: "Invalid folder id" });
        }

        const [rows] = await db.execute(
            `SELECT id, folder_name, service_date, created_at
             FROM worship_song_folders
             WHERE id = ?
             LIMIT 1`,
            [id]
        );
        if (!rows.length) {
            return res.status(404).json({ error: "Worship folder not found" });
        }

        res.json(rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.createFolder = async (req, res) => {
    try {
        if (!req.user || !ADMIN_ROLES.has(req.user.role)) {
            return res.status(403).json({ error: "Only admins can create worship folders" });
        }

        const serviceDate = String(req.body?.service_date || "").trim();
        const customFolderName = String(req.body?.folder_name || "").trim();

        if (!serviceDate || !isValidDateOnly(serviceDate)) {
            return res.status(400).json({ error: "A valid service date is required" });
        }

        const folderName = customFolderName || buildFolderName(serviceDate);

        const [existingRows] = await db.execute(
            `SELECT id FROM worship_song_folders WHERE service_date = ? LIMIT 1`,
            [serviceDate]
        );
        if (existingRows.length) {
            return res.status(409).json({ error: "A folder for that Sunday service date already exists" });
        }

        const [result] = await db.execute(
            `INSERT INTO worship_song_folders (folder_name, service_date, created_by)
             VALUES (?, ?, ?)`,
            [folderName, serviceDate, req.user.id]
        );

        res.status(201).json({
            message: "Worship folder created",
            id: result.insertId,
            folder_name: folderName,
            service_date: serviceDate
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.getSongs = async (req, res) => {
    try {
        setNoStoreHeaders(res);
        const folderId = Number(req.query?.folder_id);
        const hasFolderFilter = Number.isInteger(folderId) && folderId > 0;
        const includeFileData = String(req.query?.include_file_data || "").trim() === "1";
        const [rows] = await db.execute(
            `SELECT
                ws.id,
                ws.title,
                ws.artist,
                ws.description,
                ws.folder_id,
                ws.file_name,
                ${includeFileData ? "ws.file_data" : "NULL AS file_data"},
                ws.mime_type,
                ws.created_at,
                wf.folder_name,
                wf.service_date
             FROM worship_songs ws
             LEFT JOIN worship_song_folders wf ON wf.id = ws.folder_id
             ${hasFolderFilter ? "WHERE ws.folder_id = ?" : ""}
             ORDER BY wf.service_date DESC, ws.created_at DESC, ws.id DESC`,
            hasFolderFilter ? [folderId] : []
        );
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.createSong = async (req, res) => {
    try {
        if (!req.user || !MANAGER_ROLES.has(req.user.role)) {
            return res.status(403).json({ error: "Forbidden" });
        }

        const title = String(req.body?.title || "").trim();
        const artist = String(req.body?.artist || "").trim();
        const description = String(req.body?.description || "").trim();
        const folderId = Number(req.body?.folder_id);
        const fileName = String(req.body?.file_name || "").trim();
        const fileData = String(req.body?.file_data || "").trim();
        const mimeType = String(req.body?.mime_type || "").trim();

        if (!title || !folderId || !fileName || !fileData || !mimeType) {
            return res.status(400).json({ error: "Folder, title, and audio file are required" });
        }

        if (!mimeType.startsWith("audio/") || !isValidDataUrl(fileData, "audio/")) {
            return res.status(400).json({ error: "Only audio files are allowed" });
        }

        const [folderRows] = await db.execute(
            `SELECT id FROM worship_song_folders WHERE id = ? LIMIT 1`,
            [folderId]
        );
        if (!folderRows.length) {
            return res.status(400).json({ error: "Selected worship folder was not found" });
        }

        const [result] = await db.execute(
            `INSERT INTO worship_songs (title, artist, description, folder_id, file_name, file_data, mime_type, created_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [title, artist || null, description || null, folderId, fileName, fileData, mimeType, req.user.id]
        );

        res.status(201).json({ message: "Worship song added", id: result.insertId });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.deleteSong = async (req, res) => {
    try {
        if (!req.user || !MANAGER_ROLES.has(req.user.role)) {
            return res.status(403).json({ error: "Forbidden" });
        }

        const id = Number(req.params.id);
        if (!id) {
            return res.status(400).json({ error: "Invalid id" });
        }

        const [result] = await db.execute("DELETE FROM worship_songs WHERE id = ?", [id]);
        if (!result.affectedRows) {
            return res.status(404).json({ error: "Song not found" });
        }

        res.json({ message: "Worship song deleted" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
