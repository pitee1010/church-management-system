const token = localStorage.getItem("token");
let authPayload = null;
let allMembers = [];

const MASTER_LABEL = "All Members";
const UNASSIGNED_LABEL = "Unassigned";
const DEFAULT_DEPARTMENTS = [
    "Priesthood",
    "Ushers",
    "Translators",
    "Technical Team",
    "Worshippers",
    "Security",
    "Decorators",
    "Kitchen",
    "Sunday School Teachers",
    "Protocal",
    "Evangelism",
];

if (!token) {
    window.location.href = "index.html";
}

try {
    authPayload = JSON.parse(atob(token.split(".")[1]));
} catch (err) {
    localStorage.removeItem("token");
    window.location.href = "index.html";
}

if (authPayload?.role === "normaluser") {
    window.location.href = "dashboard.html";
}

function escapeHtml(value) {
    return String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function parseDepartments(value) {
    const normalizeDepartmentLabel = (item) => {
        const label = String(item || "").trim();
        if (!label) return "";
        return label.toLowerCase() === "worship" ? "Worshippers" : label;
    };

    if (Array.isArray(value)) {
        return [...new Set(value.map(normalizeDepartmentLabel).filter(Boolean))];
    }

    const raw = String(value || "").trim();
    if (!raw) return [];

    if (raw.startsWith("[")) {
        try {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
                return [...new Set(parsed.map(normalizeDepartmentLabel).filter(Boolean))];
            }
        } catch (err) {
            // Fall back to comma-separated values below.
        }
    }

    return [...new Set(raw.split(",").map(normalizeDepartmentLabel).filter(Boolean))];
}

function getMemberDepartments(member) {
    return parseDepartments(member?.departments ?? member?.department);
}

function buildDepartmentList() {
    const seen = new Set();
    const ordered = [MASTER_LABEL];

    const addDepartment = (department) => {
        const label = String(department || "").trim();
        if (!label || label === MASTER_LABEL || label === UNASSIGNED_LABEL) return;
        if (!seen.has(label)) {
            seen.add(label);
            ordered.push(label);
        }
    };

    DEFAULT_DEPARTMENTS.forEach(addDepartment);

    let hasUnassigned = false;
    allMembers.forEach((member) => {
        const departments = getMemberDepartments(member);
        if (!departments.length) {
            hasUnassigned = true;
        } else {
            departments.forEach(addDepartment);
        }
    });

    if (hasUnassigned) {
        ordered.push(UNASSIGNED_LABEL);
    }

    return ordered;
}

function getDepartmentCount(department) {
    if (department === MASTER_LABEL) {
        return allMembers.length;
    }

    if (department === UNASSIGNED_LABEL) {
        return allMembers.filter((member) => getMemberDepartments(member).length === 0).length;
    }

    return allMembers.filter((member) => getMemberDepartments(member).includes(department)).length;
}

function getDepartmentDescription(department, count) {
    if (department === MASTER_LABEL) {
        return "Open the full master list of every member.";
    }
    if (department === UNASSIGNED_LABEL) {
        return count === 1 ? "1 member still needs a department." : `${count} members still need a department.`;
    }
    return count === 1 ? `Open the ${department} page for 1 member.` : `Open the ${department} page for ${count} members.`;
}

function renderDepartments() {
    const departmentGrid = document.getElementById("departmentGrid");
    if (!departmentGrid) return;

    const departments = buildDepartmentList();
    departmentGrid.innerHTML = departments.map((department) => {
        const count = getDepartmentCount(department);
        const label = department === MASTER_LABEL ? "All Members (Master List)" : department;
        const href = `members.html?department=${encodeURIComponent(department)}`;

        return `
            <a class="department-card" href="${href}">
                <span class="department-count">${count}</span>
                <h4>${escapeHtml(label)}</h4>
                <p class="muted">${escapeHtml(getDepartmentDescription(department, count))}</p>
            </a>
        `;
    }).join("");
}

async function fetchMembers() {
    try {
        const res = await fetch("/api/members", {
            headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) {
            throw new Error("Failed to load departments");
        }

        const data = await res.json();
        allMembers = Array.isArray(data) ? data : [];
        renderDepartments();
    } catch (err) {
        console.error(err);
        const departmentGrid = document.getElementById("departmentGrid");
        if (departmentGrid) {
            departmentGrid.innerHTML = '<div class="loading">Unable to load departments right now.</div>';
        }
    }
}

const logoutBtn = document.getElementById("logoutBtn");
if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
        localStorage.removeItem("token");
        window.location.href = "index.html";
    });
}

fetchMembers();
