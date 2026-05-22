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

if (String(authPayload?.role || "").toLowerCase() === "normaluser") {
    window.location.href = "dashboard.html";
}

const scannerVideo = document.getElementById("scannerVideo");
const scanStatus = document.getElementById("scanStatus");
const startScannerBtn = document.getElementById("startScannerBtn");
const stopScannerBtn = document.getElementById("stopScannerBtn");
const manualQrForm = document.getElementById("manualQrForm");
const manualQrInput = document.getElementById("manualQrInput");
const recentScanList = document.getElementById("recentScanList");

let scannerStream = null;
let barcodeDetector = null;
let scanLoopHandle = null;
let lastScanValue = "";
let lastScanAt = 0;
const recentScans = [];

if ("BarcodeDetector" in window) {
    try {
        barcodeDetector = new BarcodeDetector({ formats: ["qr_code"] });
    } catch (err) {
        console.error("BarcodeDetector init failed", err);
    }
}

document.getElementById("logoutBtn")?.addEventListener("click", () => {
    localStorage.removeItem("token");
    window.location.href = "index.html";
});

function setStatus(message, tone = "") {
    if (!scanStatus) return;
    scanStatus.textContent = message;
    scanStatus.className = `scan-status${tone ? ` ${tone}` : ""}`;
}

function formatTimestamp(date = new Date()) {
    return new Intl.DateTimeFormat(undefined, {
        hour: "numeric",
        minute: "2-digit",
        second: "2-digit"
    }).format(date);
}

function renderRecentScans() {
    if (!recentScanList) return;
    if (!recentScans.length) {
        recentScanList.innerHTML = `
            <div class="recent-scan-item">
                <strong>No scans yet</strong>
                <span class="muted">Scanned members will appear here during this session.</span>
            </div>
        `;
        return;
    }

    recentScanList.innerHTML = recentScans.map((item) => `
        <div class="recent-scan-item">
            <strong>${item.name}</strong>
            <span>${item.message}</span><br>
            <span class="muted">${item.time}</span>
        </div>
    `).join("");
}

function pushRecentScan(name, message) {
    recentScans.unshift({
        name,
        message,
        time: formatTimestamp()
    });
    if (recentScans.length > 8) {
        recentScans.length = 8;
    }
    renderRecentScans();
}

async function submitAttendanceCode(rawValue) {
    const attendanceCode = String(rawValue || "").trim();
    if (!attendanceCode) return;

    try {
        setStatus("Submitting attendance...", "");
        const res = await fetch("/api/attendance/scan/qr", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({ attendanceCode })
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            setStatus(data.error || "Failed to mark attendance from QR.", "error");
            pushRecentScan("Scan failed", data.error || "QR attendance failed");
            return;
        }

        const memberName = data.member?.name || "Member";
        setStatus(data.message || `${memberName} checked in successfully.`, "success");
        pushRecentScan(memberName, data.message || "Attendance captured");
        if (manualQrInput) {
            manualQrInput.value = "";
        }
    } catch (err) {
        console.error(err);
        setStatus("Server error while processing the QR code.", "error");
        pushRecentScan("Scan failed", "Server error");
    }
}

async function detectFrame() {
    if (!barcodeDetector || !scannerVideo || scannerVideo.readyState < 2) {
        scanLoopHandle = requestAnimationFrame(detectFrame);
        return;
    }

    try {
        const codes = await barcodeDetector.detect(scannerVideo);
        if (codes.length) {
            const rawValue = String(codes[0].rawValue || "").trim();
            const now = Date.now();
            if (rawValue && (rawValue !== lastScanValue || now - lastScanAt > 2500)) {
                lastScanValue = rawValue;
                lastScanAt = now;
                await submitAttendanceCode(rawValue);
            }
        }
    } catch (err) {
        console.error("Scan failed", err);
    }

    scanLoopHandle = requestAnimationFrame(detectFrame);
}

async function startScanner() {
    if (!navigator.mediaDevices?.getUserMedia) {
        setStatus("This browser does not support camera scanning. Use manual code entry instead.", "error");
        return;
    }

    if (!barcodeDetector) {
        setStatus("This browser does not support QR detection from the camera. Use manual code entry instead.", "error");
        return;
    }

    try {
        scannerStream = await navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: { ideal: "environment" }
            },
            audio: false
        });

        scannerVideo.srcObject = scannerStream;
        await scannerVideo.play();
        setStatus("Camera scanner active. Point the QR code inside the frame.", "");

        if (scanLoopHandle) {
            cancelAnimationFrame(scanLoopHandle);
        }
        scanLoopHandle = requestAnimationFrame(detectFrame);
    } catch (err) {
        console.error(err);
        setStatus("Unable to access the camera. Please allow camera permission or use manual code entry.", "error");
    }
}

function stopScanner() {
    if (scanLoopHandle) {
        cancelAnimationFrame(scanLoopHandle);
        scanLoopHandle = null;
    }

    if (scannerStream) {
        scannerStream.getTracks().forEach((track) => track.stop());
        scannerStream = null;
    }

    if (scannerVideo) {
        scannerVideo.srcObject = null;
    }

    setStatus("Scanner stopped. Start the camera or use manual code entry.", "");
}

manualQrForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    await submitAttendanceCode(manualQrInput?.value || "");
});

startScannerBtn?.addEventListener("click", startScanner);
stopScannerBtn?.addEventListener("click", stopScanner);

window.addEventListener("beforeunload", stopScanner);
renderRecentScans();
