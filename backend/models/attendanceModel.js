const db = require("../utils/db");

exports.addAttendance = async ({ memberId, date, createdBy, source = "manual" }) => {
  // 'date' param maps to check_in column in DB
  let checkInStr;
  
  if (!date) {
    // Default to today at 9:00 AM
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    checkInStr = `${yyyy}-${mm}-${dd} 09:00:00`;
  } else if (typeof date === 'string') {
    // Try to parse any string into a proper datetime
    const parsed = new Date(date);
    if (!isNaN(parsed.getTime())) {
      const yyyy = parsed.getFullYear();
      const mm = String(parsed.getMonth() + 1).padStart(2, '0');
      const dd = String(parsed.getDate()).padStart(2, '0');
      const hh = String(parsed.getHours()).padStart(2, '0');
      const mi = String(parsed.getMinutes()).padStart(2, '0');
      const ss = String(parsed.getSeconds()).padStart(2, '0');
      checkInStr = `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`;
    } else if (date.includes('-') && date.includes(':')) {
      // Fallback: replace 'T' with space
      checkInStr = date.replace('T', ' ');
    } else {
      // If it's some other string, default to today at 9am
      const now = new Date();
      const yyyy = now.getFullYear();
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const dd = String(now.getDate()).padStart(2, '0');
      checkInStr = `${yyyy}-${mm}-${dd} 09:00:00`;
    }
  } else {
    // For Date objects, format fully
    const checkIn = new Date(date);
    const yyyy = checkIn.getFullYear();
    const mm = String(checkIn.getMonth() + 1).padStart(2, '0');
    const dd = String(checkIn.getDate()).padStart(2, '0');
    const hh = String(checkIn.getHours()).padStart(2, '0');
    const mi = String(checkIn.getMinutes()).padStart(2, '0');
    const ss = String(checkIn.getSeconds()).padStart(2, '0');
    checkInStr = `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`;
  }
  
  // Prevent duplicate records for the same member on the same date.
  const dateOnly = checkInStr.split(' ')[0];
  const [existing] = await db.execute(
    "SELECT id, member_id, check_in, attendance_source FROM attendance WHERE member_id = ? AND DATE(check_in) = ? LIMIT 1",
    [memberId, dateOnly]
  );
  if (existing.length > 0) {
    return {
      id: existing[0].id,
      memberId,
      check_in: existing[0].check_in,
      attendance_source: existing[0].attendance_source || source,
      alreadyMarked: true
    };
  }

  const [result] = await db.execute(
    "INSERT INTO attendance (member_id, check_in, attendance_source, created_by) VALUES (?, ?, ?, ?)",
    [memberId, checkInStr, source, createdBy]
  );
  return { insertId: result.insertId, memberId, check_in: checkInStr, attendance_source: source };
};

exports.getByMember = async (memberId) => {
  const [rows] = await db.execute("SELECT * FROM attendance WHERE member_id = ?", [memberId]);
  return rows;
};

exports.getAllRecords = async (user) => {
  // Return joined attendance with member/user name - all users can see all records
  const [rows] = await db.execute(
    `SELECT a.id, a.member_id, a.check_in, a.attendance_source, m.name as user_name
     FROM attendance a
     LEFT JOIN members m ON a.member_id = m.id
     ORDER BY a.check_in DESC LIMIT 200`
  );
  return rows;
};

// Count attendance per member between dates (inclusive)
exports.getCountsByMemberBetween = async (startDate, endDate) => {
  const [rows] = await db.execute(
    `SELECT a.member_id, m.name as member_name, COUNT(*) as count
     FROM attendance a
     LEFT JOIN members m ON a.member_id = m.id
     WHERE a.check_in BETWEEN ? AND ?
     GROUP BY a.member_id, m.name
     ORDER BY count DESC`,
    [startDate, endDate]
  );
  return rows;
};

// Count attendance for a specific member between dates
exports.getCountForMemberBetween = async (memberId, startDate, endDate) => {
  const [rows] = await db.execute(
    `SELECT COUNT(*) as count FROM attendance WHERE member_id = ? AND check_in BETWEEN ? AND ?`,
    [memberId, startDate, endDate]
  );
  return rows[0].count || 0;
};

exports.getTrends = async (user) => {
  // Trend data - all users can see all trends
  const [rows] = await db.execute(
    "SELECT DATE(check_in) as date, COUNT(*) as count FROM attendance GROUP BY DATE(check_in) ORDER BY DATE(check_in) DESC LIMIT 30"
  );
  return rows;
};

// Delete attendance record by member ID and date
exports.deleteByMemberAndDate = async (memberId, date) => {
  // Extract date part if full datetime is provided
  let datePart = date;
  if (date.includes(' ')) {
    datePart = date.split(' ')[0];
  } else if (date.includes('T')) {
    datePart = date.split('T')[0];
  }
  
  // Delete any attendance records for this member on this date
  const [result] = await db.execute(
    "DELETE FROM attendance WHERE member_id = ? AND DATE(check_in) = ?",
    [memberId, datePart]
  );
  return result;
};
