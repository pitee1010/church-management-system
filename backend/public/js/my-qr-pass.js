const token = localStorage.getItem("token");
let authPayload = null;
let currentMember = null;

if (!token) {
    window.location.href = "index.html";
}

try {
    authPayload = JSON.parse(atob(token.split(".")[1]));
} catch (err) {
    localStorage.removeItem("token");
    window.location.href = "index.html";
}

if (authPayload?.role !== "normaluser") {
    window.location.href = "dashboard.html";
}

const logoutBtn = document.getElementById("logoutBtn");
const memberNameEl = document.getElementById("memberName");
const passSubtitleEl = document.getElementById("passSubtitle");
const qrImageEl = document.getElementById("qrImage");
const qrUnavailableEl = document.getElementById("qrUnavailable");
const attendanceCodeEl = document.getElementById("attendanceCode");
const memberAttendanceCodeEl = document.getElementById("memberAttendanceCode");
const accountNameEl = document.getElementById("accountName");
const memberFullNameEl = document.getElementById("memberFullName");
const memberDepartmentsEl = document.getElementById("memberDepartments");
const statusCardEl = document.getElementById("statusCard");
const copyCodeBtn = document.getElementById("copyCodeBtn");
const downloadQrBtn = document.getElementById("downloadQrBtn");
const openQrBtn = document.getElementById("openQrBtn");

function setStatus(message, visible = true) {
    if (!statusCardEl) return;
    statusCardEl.textContent = message || "";
    statusCardEl.classList.toggle("hidden", !visible || !message);
}

function setActionState(disabled) {
    [copyCodeBtn, downloadQrBtn, openQrBtn].forEach((button) => {
        if (button) {
            button.disabled = disabled;
        }
    });
}

function buildAttendanceQrValue(member) {
    const code = String(member?.attendance_code || "").trim();
    return code ? `CMS-ATTENDANCE:${code}` : "";
}

function buildQrImageUrl(member) {
    const qrValue = buildAttendanceQrValue(member);
    if (!qrValue) return "";
    return `https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=${encodeURIComponent(qrValue)}`;
}

function updatePassView(member, accountName, message, multipleMatches) {
    currentMember = member || null;
    accountNameEl.textContent = accountName || authPayload?.name || "-";

    if (!member) {
        memberNameEl.textContent = "No pass available yet";
        passSubtitleEl.textContent = "Your account has not been linked to a matching member profile.";
        memberFullNameEl.textContent = "-";
        memberAttendanceCodeEl.textContent = "-";
        memberDepartmentsEl.textContent = "-";
        attendanceCodeEl.textContent = "No code available";
        qrImageEl.classList.add("hidden");
        qrImageEl.removeAttribute("src");
        qrUnavailableEl.classList.remove("hidden");
        setActionState(true);
        setStatus(message || "Ask an admin to make sure your account name matches your member profile.");
        return;
    }

    const attendanceCode = String(member.attendance_code || "").trim();
    const qrImageUrl = buildQrImageUrl(member);
    const departments = Array.isArray(member.departments) && member.departments.length
        ? member.departments.join(", ")
        : "No department recorded";

    memberNameEl.textContent = member.name || "My Church Pass";
    passSubtitleEl.textContent = "Show this QR at church so your attendance can be captured quickly.";
    memberFullNameEl.textContent = member.name || "-";
    memberAttendanceCodeEl.textContent = attendanceCode || "-";
    memberDepartmentsEl.textContent = departments;
    attendanceCodeEl.textContent = attendanceCode || "No code available";

    if (qrImageUrl) {
        qrImageEl.src = qrImageUrl;
        qrImageEl.classList.remove("hidden");
        qrUnavailableEl.classList.add("hidden");
        setActionState(false);
    } else {
        qrImageEl.classList.add("hidden");
        qrImageEl.removeAttribute("src");
        qrUnavailableEl.classList.remove("hidden");
        setActionState(true);
    }

    if (multipleMatches) {
        setStatus("More than one member profile matched this account name. The system is showing the first match. Ask an admin to make the names unique.");
        return;
    }

    setStatus(message || "", Boolean(message));
}

async function loadMyPass() {
    try {
        const res = await fetch("/api/members/my-pass", {
            headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();

        if (!res.ok) {
            throw new Error(data.error || "Failed to load your QR pass");
        }

        updatePassView(data.member, data.accountName, data.message, data.multipleMatches);
    } catch (err) {
        console.error(err);
        updatePassView(null, authPayload?.name || "", err.message, false);
    }
}

async function copyAttendanceCode() {
    const attendanceCode = String(currentMember?.attendance_code || "").trim();
    if (!attendanceCode) return;
    try {
        await navigator.clipboard.writeText(attendanceCode);
        setStatus("Attendance code copied.");
    } catch (err) {
        console.error(err);
        setStatus("Unable to copy the attendance code right now.");
    }
}

async function downloadQrImage() {
    const imageUrl = buildQrImageUrl(currentMember);
    const attendanceCode = String(currentMember?.attendance_code || "church-pass").trim() || "church-pass";
    if (!imageUrl) return;

    try {
        const res = await fetch(imageUrl, { mode: "cors" });
        if (!res.ok) {
            throw new Error("Unable to fetch QR image");
        }
        const blob = await res.blob();
        const blobUrl = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = blobUrl;
        link.download = `${attendanceCode}.png`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(blobUrl);
        setStatus("QR image downloaded.");
    } catch (err) {
        console.error(err);
        setStatus("Direct download was blocked, so the QR image will open in a new tab instead.");
        window.open(imageUrl, "_blank", "noopener,noreferrer");
    }
}

function openQrImage() {
    const imageUrl = buildQrImageUrl(currentMember);
    if (!imageUrl) return;
    window.open(imageUrl, "_blank", "noopener,noreferrer");
}

logoutBtn?.addEventListener("click", () => {
    localStorage.removeItem("token");
    window.location.href = "index.html";
});

copyCodeBtn?.addEventListener("click", copyAttendanceCode);
downloadQrBtn?.addEventListener("click", downloadQrImage);
openQrBtn?.addEventListener("click", openQrImage);

setActionState(true);
loadMyPass();
