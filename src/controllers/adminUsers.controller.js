//src/controllers/adminUsers.controller.js

const db = require('../config/database');

// Utility to build WHERE clauses for filters
function buildWhere(filters, params) {
  let where = 'WHERE role != "admin"';
  if (filters.role) {
    where += ' AND role = ?';
    params.push(filters.role);
  }
  if (filters.status) {
    where += ' AND is_active = ?';
    params.push(filters.status === 'active' ? 1 : 0);
  }
  if (filters.search) {
    where += ' AND (name LIKE ? OR email LIKE ?)';
    const term = `%${filters.search}%`;
    params.push(term, term);
  }
  return where;
}

// GET /api/admin/users
exports.listUsers = async (req, res, next) => {
  const page   = parseInt(req.query.page, 10)  || 1;
  const limit  = parseInt(req.query.limit, 10) || 10;
  const offset = (page - 1) * limit;

  const filters = {
    role:   req.query.role,
    status: req.query.status,
    search: req.query.search,
  };

  const paramsCount = [];
  const whereClause = buildWhere(filters, paramsCount);

  try {
    // total count
    const countSql = `SELECT COUNT(*) AS total FROM users ${whereClause}`;
    const [countRows] = await db.query(countSql, paramsCount);
    const total = countRows[0].total;

    // fetch page
    const paramsData = [...paramsCount, limit, offset];
    const dataSql = `
      SELECT
        id,
        name,
        email,
        role,
        IF(is_active=1,'active','suspended') AS status,
        last_active,
        is_verified
      FROM users
      ${whereClause}
      ORDER BY updated_at DESC
      LIMIT ? OFFSET ?
    `;
    const [rows] = await db.query(dataSql, paramsData);

    res.json({
      data: rows,
      meta: {
        total,
        page,
        lastPage: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/admin/users/:id
exports.getUserDetail = async (req, res, next) => {
  const { id } = req.params;
  try {
    const [rows] = await db.query(
      `SELECT
         id,
         name,
         email,
         role,
         program,
         university,
         faculty,
         year,
         availability,
         payment_pref,
         profile_strength,
         response_rate,
         last_active,
         is_verified,
         company_name,
         department,
         IF(is_active=1,'active','suspended') AS status,
         avatar_url,
         bio,
         phone,
         created_at,
         updated_at
       FROM users
       WHERE id = ?
       AND role != 'admin'`,
      [id]
    );
    if (!rows.length) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
};

// POST /api/admin/users/:id/suspend
exports.suspendUser = async (req, res, next) => {
  const { id } = req.params;
  try {
    await db.query(
      `UPDATE users SET is_active = 0, updated_at = NOW() WHERE id = ? AND role != 'admin'`,
      [id]
    );
    res.json({ success: true, message: 'User suspended' });
  } catch (err) {
    next(err);
  }
};

// POST /api/admin/users/:id/activate
exports.activateUser = async (req, res, next) => {
  const { id } = req.params;
  try {
    await db.query(
      `UPDATE users SET is_active = 1, updated_at = NOW() WHERE id = ? AND role != 'admin'`,
      [id]
    );
    res.json({ success: true, message: 'User activated' });
  } catch (err) {
    next(err);
  }
};

// POST /api/admin/users/:id/set-role
exports.setRole = async (req, res, next) => {
  const { id } = req.params;
  const { role } = req.body;
  if (!['student','recruiter','admin'].includes(role)) {
    return res.status(400).json({ message: 'Invalid role' });
  }
  try {
    await db.query(
      `UPDATE users SET role = ?, updated_at = NOW() WHERE id = ? AND role != 'admin'`,
      [role, id]
    );
    res.json({ success: true, message: 'Role updated' });
  } catch (err) {
    next(err);
  }
};

// POST /api/admin/users/bulk/activate
exports.bulkActivate = async (req, res, next) => {
  const { userIds } = req.body; // expect array of IDs
  if (!Array.isArray(userIds) || !userIds.length) {
    return res.status(400).json({ message: 'No user IDs provided' });
  }
  try {
    await db.query(
      `UPDATE users SET is_active = 1, updated_at = NOW()
       WHERE id IN (?) AND role != 'admin'`,
      [userIds]
    );
    res.json({ success: true, message: 'Users activated' });
  } catch (err) {
    next(err);
  }
};

// POST /api/admin/users/bulk/suspend
exports.bulkSuspend = async (req, res, next) => {
  const { userIds } = req.body;
  if (!Array.isArray(userIds) || !userIds.length) {
    return res.status(400).json({ message: 'No user IDs provided' });
  }
  try {
    await db.query(
      `UPDATE users SET is_active = 0, updated_at = NOW()
       WHERE id IN (?) AND role != 'admin'`,
      [userIds]
    );
    res.json({ success: true, message: 'Users suspended' });
  } catch (err) {
    next(err);
  }
};
