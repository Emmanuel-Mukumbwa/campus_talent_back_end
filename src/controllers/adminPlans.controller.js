const db = require('../config/database');

/**
 * GET /api/admin/plans
 */
exports.listPlans = async (req, res, next) => {
  try {
    const [rows] = await db.query(
      `SELECT id, \`key\`, label, price, max_posts, created_at, updated_at
         FROM plans
        ORDER BY id`
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/admin/plans
 */
exports.createPlan = async (req, res, next) => {
  const { key, label, price, max_posts } = req.body;
  try {
    const [result] = await db.query(
      `INSERT INTO plans (\`key\`, label, price, max_posts)
       VALUES (?, ?, ?, ?)`,
      [key, label, price, max_posts]
    );
    const [[plan]] = await db.query(`SELECT * FROM plans WHERE id = ?`, [result.insertId]);
    res.status(201).json(plan);
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/admin/plans/:id
 */
exports.updatePlan = async (req, res, next) => {
  const { id } = req.params;
  const { label, price, max_posts } = req.body;
  try {
    const [result] = await db.query(
      `UPDATE plans
          SET label = ?, price = ?, max_posts = ?, updated_at = NOW()
        WHERE id = ?`,
      [label, price, max_posts, id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Plan not found' });
    }
    const [[plan]] = await db.query(`SELECT * FROM plans WHERE id = ?`, [id]);
    res.json(plan);
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/admin/plans/:id
 */
exports.deletePlan = async (req, res, next) => {
  const { id } = req.params;
  try {
    const [result] = await db.query(
      `DELETE FROM plans WHERE id = ?`,
      [id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Plan not found' });
    }
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};
