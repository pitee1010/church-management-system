const db = require("../utils/db");

exports.addDonation = async ({ donor_name, amount, donation_date, contribution_type, createdBy, description, payment_method, payment_reference }) => {
  const [result] = await db.execute(
    "INSERT INTO donations (donor_name, amount, donation_date, contribution_type, payment_method, payment_reference, created_by, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    [donor_name, amount, donation_date, contribution_type || 'general', payment_method || 'manual', payment_reference || null, createdBy, description]
  );
  return { insertId: result.insertId, donor_name, amount, donation_date, contribution_type, description, payment_method, payment_reference };
};

exports.getAll = async (user, contributionType) => {
  const filters = [];
  const values = [];

  if (contributionType && contributionType !== 'all') {
    filters.push('d.contribution_type = ?');
    values.push(contributionType);
  }

  if (!user || user.role !== 'admin') {
    const accountName = String(user?.name || '').trim();
    if (!accountName) {
      return [];
    }

    filters.push('LOWER(TRIM(d.donor_name)) = LOWER(TRIM(?))');
    values.push(accountName);
  }

  const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
  const [rows] = await db.execute(
    `SELECT d.id, d.donor_name as user_name, d.amount, d.donation_date as date, d.contribution_type, d.payment_method, d.payment_reference, d.description, d.created_by
     FROM donations d
     ${whereClause}
     ORDER BY d.donation_date DESC`,
    values
  );

  return rows;
};

exports.getById = async (id) => {
  const [rows] = await db.execute(
    `SELECT id, donor_name as user_name, amount, donation_date as date, contribution_type, payment_method, payment_reference, description, created_by FROM donations WHERE id = ?`,
    [id]
  );
  return rows[0];
};

exports.updateById = async (id, { donor_name, amount, donation_date, contribution_type, description, payment_method, payment_reference }) => {
  const [result] = await db.execute(
    `UPDATE donations SET donor_name = ?, amount = ?, donation_date = ?, contribution_type = ?, payment_method = ?, payment_reference = ?, description = ? WHERE id = ?`,
    [donor_name, amount, donation_date, contribution_type || 'general', payment_method || 'manual', payment_reference || null, description, id]
  );
  return result.affectedRows;
};

exports.deleteById = async (id) => {
  const [result] = await db.execute(`DELETE FROM donations WHERE id = ?`, [id]);
  return result.affectedRows;
};
