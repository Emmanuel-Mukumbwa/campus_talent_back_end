

const db = require('../config/database');

exports.listAllGigs = async (req, res, next) => {
  try {
    const [rows] = await db.query(
      `
      SELECT
        g.id,
        g.title,
        g.status,
        u.name AS recruiterName,
        e.order_reference AS tx_ref
      FROM gigs g
      JOIN users u ON u.id = g.recruiter_id
      LEFT JOIN escrows e ON e.gig_id = g.id
      ORDER BY g.created_at DESC
      `
    );
    return res.json(rows);
  } catch (err) {
    return next(err); 
  }
};

exports.deactivateGig = async (req, res, next) => {
  const { id } = req.params;
  try {
    await db.query(
      `UPDATE gigs 
         SET status = 'Closed',
             expires_at = CURDATE() 
       WHERE id = ?`,
      [id]
    );
    return res.json({ success: true, message: 'Gig deactivated' });
  } catch (err) {
    return next(err);
  }
};

exports.activateGig = async (req, res, next) => {
  const { id } = req.params;
  try {
    await db.query(
      `UPDATE gigs 
         SET status = 'Open', 
             created_at = NOW() 
       WHERE id = ?`,
      [id]
    );
    return res.json({ success: true, message: 'Gig activated' });
  } catch (err) {
    return next(err);
  }
};
