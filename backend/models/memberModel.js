const db = require("../utils/db");

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
            // Fall back to comma-separated parsing below.
        }
    }

    return [...new Set(raw.split(",").map(normalizeDepartmentLabel).filter(Boolean))];
}

function serializeDepartments(value) {
    const departments = parseDepartments(value);
    return departments.length ? departments.join(", ") : null;
}

function attachDepartments(row) {
    if (!row) return row;
    return { ...row, departments: parseDepartments(row.department) };
}

exports.createMember = async (member) => {
    const { name, gender, department, departments, phone, address, photo_url, created_by } = member;
    const serializedDepartments = serializeDepartments(departments ?? department);
    const [result] = await db.execute(
        "INSERT INTO members (name,gender,department,phone,photo_url,address,created_by) VALUES (?,?,?,?,?,?,?)",
        [name, gender || null, serializedDepartments, phone, photo_url || null, address, created_by]
    );
    const attendanceCode = `CHM-${String(result.insertId).padStart(6, "0")}`;
    await db.execute("UPDATE members SET attendance_code = ? WHERE id = ?", [attendanceCode, result.insertId]);
    return result.insertId;
};

exports.getMembersByUser = async (userId, role) => {
    // All users (admin and normal) can see all members
    const [rows] = await db.execute("SELECT * FROM members ORDER BY id ASC");
    return rows.map(attachDepartments);
};

// Promise-based helper for exports and other flows
exports.getAll = async (user) => {
    // All users (admin and normal) can see all members
    const [rows] = await db.execute("SELECT * FROM members ORDER BY id ASC");
    return rows.map(attachDepartments);
};

exports.getById = async (id) => {
    const [rows] = await db.execute("SELECT * FROM members WHERE id = ?", [id]);
    return attachDepartments(rows[0]);
};

exports.getMemberByName = async (name) => {
    const [rows] = await db.execute("SELECT * FROM members WHERE name = ?", [name]);
    return attachDepartments(rows[0]);
};

exports.getMemberByAttendanceCode = async (attendanceCode) => {
    const [rows] = await db.execute("SELECT * FROM members WHERE attendance_code = ? LIMIT 1", [attendanceCode]);
    return attachDepartments(rows[0]);
};

exports.findByName = async (name) => {
    const [rows] = await db.execute(
        "SELECT * FROM members WHERE LOWER(TRIM(name)) = LOWER(TRIM(?))",
        [name]
    );
    return rows.map(attachDepartments);
};

exports.deleteById = async (id) => {
    // Delete all related attendance records first
    await db.execute("DELETE FROM attendance WHERE member_id = ?", [id]);
    
    // Delete all related donations records
    await db.execute("DELETE FROM donations WHERE donor_name = (SELECT name FROM members WHERE id = ?)", [id]);
    
    // Now delete the member
    const [result] = await db.execute("DELETE FROM members WHERE id = ?", [id]);
    return result.affectedRows;
};

exports.updateById = async (id, { name, gender, department, departments, phone, address, photo_url }) => {
    const serializedDepartments = serializeDepartments(departments ?? department);
    const [result] = await db.execute(
        "UPDATE members SET name = ?, gender = ?, department = ?, phone = ?, photo_url = ?, address = ? WHERE id = ?",
        [name, gender || null, serializedDepartments, phone, photo_url || null, address, id]
    );
    return result.affectedRows;
};

exports.getStats = async (user) => {
    // All users can see total member count
    const [rows] = await db.execute("SELECT COUNT(*) as total FROM members");
    return rows[0];
};
