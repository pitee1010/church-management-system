const token = localStorage.getItem("token");
let authPayload = null;

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

const membersTable = document.getElementById("membersTable");
const addMemberForm = document.getElementById("addMemberForm");
const departmentList = document.getElementById("departmentList");
const membersHeading = document.getElementById("membersHeading");
const membersSubheading = document.getElementById("membersSubheading");
const activeDepartmentBadge = document.getElementById("activeDepartmentBadge");
const membersEmptyState = document.getElementById("membersEmptyState");
const logoutBtn = document.getElementById("logoutBtn");
const qrModal = document.getElementById("qrModal");
const qrImage = document.getElementById("qrImage");
const qrMemberName = document.getElementById("qrMemberName");
const qrCodeValue = document.getElementById("qrCodeValue");
const copyQrCodeBtn = document.getElementById("copyQrCodeBtn");
const openQrImageBtn = document.getElementById("openQrImageBtn");
const closeQrModalBtn = document.getElementById("closeQrModalBtn");
let currentEditingMemberId = null;
let allMembers = [];
let currentQrMember = null;

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
    "Correspondents",
    "Kitchen",
    "Sunday School Teachers",
    "Protocal",
    "Evangelism",
];

const urlParams = new URLSearchParams(window.location.search);
const requestedDepartment = String(urlParams.get("department") || "").trim();
let activeDepartment = requestedDepartment || MASTER_LABEL;

function escapeHtml(value) {
    return String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function photoCell(photoUrl, name) {
    if (photoUrl) {
        return `<img src="${escapeHtml(photoUrl)}" alt="${escapeHtml(name)}" class="avatar">`;
    }
    return `<div class="avatar-placeholder">${escapeHtml((name || "?").slice(0, 1).toUpperCase())}</div>`;
}

function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
        if (!file) return resolve(null);
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

function buildAttendanceQrValue(member) {
    const code = String(member?.attendance_code || "").trim();
    return code ? `CMS-ATTENDANCE:${code}` : "";
}

function buildQrImageUrl(member) {
    const qrValue = buildAttendanceQrValue(member);
    if (!qrValue) return "";
    return `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(qrValue)}`;
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

function formatDepartmentLabels(value) {
    const departments = parseDepartments(value);
    return departments.length ? departments.join(", ") : UNASSIGNED_LABEL;
}

function memberHasDepartment(member, department) {
    const departments = getMemberDepartments(member);
    if (department === UNASSIGNED_LABEL) {
        return departments.length === 0;
    }
    return departments.includes(department);
}

function getDepartmentSelections(selectId) {
    const select = document.getElementById(selectId);
    if (!select) return [];
    return Array.from(select.selectedOptions || []).map((option) => option.value).filter(Boolean);
}

function setDepartmentSelections(selectId, departments) {
    const select = document.getElementById(selectId);
    if (!select) return;
    const selected = new Set(parseDepartments(departments));
    Array.from(select.options).forEach((option) => {
        option.selected = selected.has(option.value);
    });
}

function buildDepartmentList() {
    const seen = new Set();
    const ordered = [MASTER_LABEL];

    const addDept = (dept) => {
        const label = String(dept || "").trim();
        if (!label || label === MASTER_LABEL || label === UNASSIGNED_LABEL) return;
        if (!seen.has(label)) {
            seen.add(label);
            ordered.push(label);
        }
    };

    DEFAULT_DEPARTMENTS.forEach(addDept);

    let hasUnassigned = false;
    allMembers.forEach((member) => {
        const departments = getMemberDepartments(member);
        if (!departments.length) {
            hasUnassigned = true;
        } else {
            departments.forEach(addDept);
        }
    });

    if (hasUnassigned) {
        ordered.push(UNASSIGNED_LABEL);
    }

    return ordered;
}

function syncDepartmentDatalist() {
    const allDepartments = buildDepartmentList();
    const departments = allDepartments
        .filter((dept) => dept !== MASTER_LABEL && dept !== UNASSIGNED_LABEL);

    if (activeDepartment !== MASTER_LABEL && activeDepartment !== UNASSIGNED_LABEL && !departments.includes(activeDepartment)) {
        departments.push(activeDepartment);
    }

    const filterDepartments = allDepartments
        .filter((dept) => dept !== MASTER_LABEL);

    ["department", "edit_department"].forEach((selectId) => {
        const select = document.getElementById(selectId);
        if (!select) return;

        const currentSelection = getDepartmentSelections(selectId);
        select.innerHTML = departments
            .map((dept) => `<option value="${escapeHtml(dept)}">${escapeHtml(dept)}</option>`)
            .join("");
        setDepartmentSelections(selectId, currentSelection);
    });

    const filterSelect = document.getElementById("filterDepartment");
    if (filterSelect) {
        const previousValue = filterSelect.value;
        filterSelect.innerHTML = "<option value=\"\">All departments</option>" + filterDepartments
            .map((dept) => `<option value="${escapeHtml(dept)}">${escapeHtml(dept)}</option>`)
            .join("");
        if (previousValue) filterSelect.value = previousValue;
    }
}

function syncDepartmentFormDefaults() {
    const departmentInput = document.getElementById("department");
    if (!departmentInput) return;

    const currentSelection = getDepartmentSelections("department");
    if (currentSelection.length) {
        return;
    }

    if (activeDepartment === MASTER_LABEL) {
        return;
    }

    if (activeDepartment === UNASSIGNED_LABEL) {
        return;
    }

    setDepartmentSelections("department", [activeDepartment]);
}

function updatePageContext(filteredCount) {
    const isMasterList = activeDepartment === MASTER_LABEL;
    const headingLabel = isMasterList ? "All Members (Master List)" : `${activeDepartment} Members`;
    const subheadingText = isMasterList
        ? "You are viewing the full master list of members."
        : `You are viewing only members in the ${activeDepartment} department. Members can appear in more than one department.`;
    const badgeText = isMasterList ? "All Members" : activeDepartment;

    if (membersHeading) {
        membersHeading.textContent = `${headingLabel} (${filteredCount})`;
    }

    if (membersSubheading) {
        membersSubheading.textContent = subheadingText;
    }

    if (activeDepartmentBadge) {
        activeDepartmentBadge.textContent = badgeText;
    }
}

function getFilteredMembers() {
    if (activeDepartment === MASTER_LABEL) {
        return allMembers;
    }

    return allMembers.filter((member) => memberHasDepartment(member, activeDepartment));
}

function renderMembers() {
    if (!membersTable) return;
    const tbody = membersTable.querySelector("tbody");
    if (!tbody) return;

    const filtered = getFilteredMembers();
    tbody.innerHTML = "";

    filtered.forEach((member, index) => {
        const tr = document.createElement("tr");
        const displayId = index + 1;
        const graphUrl = `member-graph.html?id=${encodeURIComponent(member.id)}&name=${encodeURIComponent(member.name)}&department=${encodeURIComponent(activeDepartment)}`;
        const nameLink = `<a href="${graphUrl}" class="text-link-strong">${escapeHtml(member.name)}</a>`;
        const deptLabel = formatDepartmentLabels(member.departments || member.department);

        tr.innerHTML = `
            <td title="DB ID: ${member.id}">${displayId}</td>
            <td>${photoCell(member.photo_url, member.name)}</td>
            <td>${nameLink}</td>
            <td>${escapeHtml(member.gender || "")}</td>
            <td>${escapeHtml(deptLabel)}</td>
            <td>${escapeHtml(member.phone || "")}</td>
            <td>${escapeHtml(member.address || "")}</td>
            <td class="qr-cell"></td>
            <td class="actions-cell"></td>
        `;

        const qrCell = tr.querySelector(".qr-cell");
        const actionsCell = tr.querySelector(".actions-cell");
        const qrBtn = document.createElement("button");
        qrBtn.className = "small-btn btn-secondary";
        qrBtn.textContent = "Show QR";
        qrBtn.disabled = !member.attendance_code;
        qrBtn.addEventListener("click", () => openQrModal(member.id));
        qrCell.appendChild(qrBtn);

        const editBtn = document.createElement("button");
        editBtn.className = "small-btn btn-primary";
        editBtn.textContent = "Edit";
        editBtn.addEventListener("click", () =>
            openEditModal(
                member.id,
                member.name,
                member.phone || "",
                member.address || "",
                member.photo_url || "",
                member.gender || "",
                member.departments || member.department || ""
            )
        );

        const deleteBtn = document.createElement("button");
        deleteBtn.className = "small-btn btn-danger";
        deleteBtn.textContent = "Delete";
        deleteBtn.addEventListener("click", () => deleteMember(member.id));

        const canRemoveFromDepartment =
            activeDepartment !== MASTER_LABEL &&
            activeDepartment !== UNASSIGNED_LABEL &&
            memberHasDepartment(member, activeDepartment);

        if (canRemoveFromDepartment) {
            const removeDeptBtn = document.createElement("button");
            removeDeptBtn.className = "small-btn btn-warning";
            removeDeptBtn.textContent = "Remove From Department";
            removeDeptBtn.addEventListener("click", () => removeMemberFromDepartment(member));
            actionsCell.appendChild(removeDeptBtn);
        }

        actionsCell.appendChild(editBtn);
        actionsCell.appendChild(deleteBtn);
        tbody.appendChild(tr);
    });

    if (membersEmptyState) {
        membersEmptyState.style.display = filtered.length ? "none" : "block";
        membersEmptyState.textContent = activeDepartment === MASTER_LABEL
            ? "No members have been added yet."
            : `No members found in ${activeDepartment} yet.`;
    }

    updatePageContext(filtered.length);
}

function openQrModal(memberId) {
    const member = allMembers.find((item) => Number(item.id) === Number(memberId));
    if (!member) {
        alert("Member record not found");
        return;
    }

    if (!member.attendance_code) {
        alert("This member does not have an attendance code yet.");
        return;
    }

    currentQrMember = member;
    const qrValue = buildAttendanceQrValue(member);
    const imageUrl = buildQrImageUrl(member);

    if (qrMemberName) {
        qrMemberName.textContent = `${member.name} can scan this QR when arriving at church.`;
    }
    if (qrCodeValue) {
        qrCodeValue.textContent = member.attendance_code;
    }
    if (qrImage) {
        qrImage.src = imageUrl;
    }
    if (qrModal) {
        qrModal.style.display = "block";
    }
}

function closeQrModal() {
    if (qrModal) {
        qrModal.style.display = "none";
    }
    currentQrMember = null;
}

async function fetchMembers() {
    const res = await fetch("/api/members", {
        headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
        throw new Error("Failed to load members");
    }

    const data = await res.json();
    allMembers = Array.isArray(data) ? data : [];
    allMembers.sort((a, b) => Number(a.id) - Number(b.id));

    syncDepartmentDatalist();
    syncDepartmentFormDefaults();
    renderMembers();
}

window.openEditModal = function (id, name, phone, address, photoUrl, gender, department) {
    currentEditingMemberId = id;
    document.getElementById("edit_name").value = name;
    document.getElementById("edit_gender").value = gender || "";
    document.getElementById("edit_phone").value = phone;
    document.getElementById("edit_address").value = address;
    document.getElementById("edit_photo_url").value = photoUrl || "";
    document.getElementById("edit_photo").value = "";
    setDepartmentSelections("edit_department", department || []);
    document.getElementById("editModal").style.display = "block";
};

window.closeEditModal = function () {
    document.getElementById("editModal").style.display = "none";
    currentEditingMemberId = null;
};

const editMemberForm = document.getElementById("editMemberForm");
if (editMemberForm) {
    editMemberForm.addEventListener("submit", async function (e) {
        e.preventDefault();

        const name = document.getElementById("edit_name").value;
        const gender = document.getElementById("edit_gender").value;
        const departments = getDepartmentSelections("edit_department");
        const phone = document.getElementById("edit_phone").value;
        const address = document.getElementById("edit_address").value;
        const existingPhotoUrl = document.getElementById("edit_photo_url").value || null;
        const newPhotoFile = document.getElementById("edit_photo").files[0];
        const newPhotoDataUrl = await fileToDataUrl(newPhotoFile);
        const photo_url = newPhotoDataUrl || existingPhotoUrl;

        if (!departments.length) {
            alert("Please select at least one department");
            return;
        }

        try {
            const res = await fetch(`/api/members/${currentEditingMemberId}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ name, gender, departments, phone, address, photo_url }),
            });

            if (res.ok) {
                alert("Member updated successfully");
                closeEditModal();
                fetchMembers();
            } else {
                alert("Failed to update member");
            }
        } catch (err) {
            console.error(err);
            alert("Server error");
        }
    });
}

window.deleteMember = async function (id) {
    if (!confirm("Are you sure you want to delete this member? All related data (attendance, contributions) will also be deleted.")) return;

    try {
        const res = await fetch(`/api/members/${id}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token}` },
        });

        if (res.ok) {
            alert("Member deleted successfully");
            fetchMembers();
        } else {
            const error = await res.json();
            alert(`Failed to delete member: ${error.message || error.error}`);
        }
    } catch (err) {
        console.error(err);
        alert(`Server error: ${err.message}`);
    }
};

async function removeMemberFromDepartment(member) {
    const currentDepartments = getMemberDepartments(member);
    const updatedDepartments = currentDepartments.filter((department) => department !== activeDepartment);

    if (!confirm(`Remove ${member.name} from ${activeDepartment}? The member will remain in the master list.`)) {
        return;
    }

    try {
        const res = await fetch(`/api/members/${member.id}`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
                name: member.name,
                gender: member.gender || null,
                departments: updatedDepartments,
                phone: member.phone || "",
                address: member.address || "",
                photo_url: member.photo_url || null,
            }),
        });

        if (res.ok) {
            alert(`${member.name} was removed from ${activeDepartment}.`);
            fetchMembers();
        } else {
            const error = await res.json().catch(() => ({}));
            alert(error.error || error.message || "Failed to remove member from department");
        }
    } catch (err) {
        console.error(err);
        alert("Server error");
    }
}

if (addMemberForm) {
    addMemberForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const name = document.getElementById("name").value;
        const gender = document.getElementById("gender").value;
        const departments = getDepartmentSelections("department");
        const phone = document.getElementById("phone").value;
        const address = document.getElementById("address").value;
        const photoFile = document.getElementById("photo").files[0];
        const photo_url = await fileToDataUrl(photoFile);

        if (!departments.length) {
            alert("Please select at least one department");
            return;
        }

        try {
            const res = await fetch("/api/members", {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify({ name, gender, departments, phone, address, photo_url }),
            });

            if (res.ok) {
                alert("Member added successfully");
                addMemberForm.reset();
                syncDepartmentFormDefaults();
                fetchMembers();
            } else {
                alert("Failed to add member");
            }
        } catch (err) {
            console.error(err);
            alert("Server error");
        }
    });
}

window.addEventListener("click", function (e) {
    const modal = document.getElementById("editModal");
    if (e.target === modal) {
        closeEditModal();
    }
});

if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
        localStorage.removeItem("token");
        window.location.href = "index.html";
    });
}

copyQrCodeBtn?.addEventListener("click", async () => {
    if (!currentQrMember?.attendance_code) return;
    try {
        await navigator.clipboard.writeText(currentQrMember.attendance_code);
        alert("Attendance code copied");
    } catch (err) {
        console.error(err);
        alert("Unable to copy attendance code");
    }
});

openQrImageBtn?.addEventListener("click", () => {
    if (!currentQrMember) return;
    const imageUrl = buildQrImageUrl(currentQrMember);
    if (!imageUrl) return;
    window.open(imageUrl, "_blank", "noopener,noreferrer");
});

closeQrModalBtn?.addEventListener("click", closeQrModal);

fetchMembers().catch((err) => {
    console.error(err);
    alert("Failed to load members");
    if (membersEmptyState) {
        membersEmptyState.style.display = "block";
        membersEmptyState.textContent = "Unable to load members right now.";
    }
});

window.addEventListener("click", (event) => {
    if (event.target === qrModal) {
        closeQrModal();
    }
});
