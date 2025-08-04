// src/controllers/adminSubscriptions.controller.js
const db = require('../config/database');

/**
 * GET /api/admin/subscriptions
 * List all subscriptions, including recruiter name.
 */
exports.listSubscriptions = async (req, res, next) => {
  try {
    const [rows] = await db.query(
      `SELECT s.id,
              s.recruiter_id,
              u.name       AS recruiterName,
              s.plan,
              s.status,
              s.current_period_start,
              s.current_period_end,
              s.created_at
         FROM subscriptions s
         JOIN users u ON u.id = s.recruiter_id
        ORDER BY s.created_at DESC`
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/admin/subscriptions/:id/cancel
 * Cancel a subscription (mark status = 'canceled').
 */
exports.cancelSubscription = async (req, res, next) => {
  const { id } = req.params;
  try {
    const [result] = await db.query(
      `UPDATE subscriptions
          SET status = 'canceled',
              updated_at = NOW()
        WHERE id = ?`,
      [id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Subscription not found' });
    }
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/admin/subscriptions/:id/reactivate
 * Reactivate a canceled or past_due subscription
 */
exports.reactivateSubscription = async (req, res, next) => {
  const { id } = req.params;
  try {
    const [result] = await db.query(
      `UPDATE subscriptions
         SET status     = 'active',
             updated_at = NOW()
       WHERE id = ?`,
      [id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Subscription not found' });
    }
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};
