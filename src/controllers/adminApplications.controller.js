

const db = require('../config/database');

// GET /api/admin/applications
exports.listApplications = async (req, res, next) => {
  try {
    const [rows] = await db.query(
      `
      SELECT
        ga.id,
        g.title        AS gigTitle,
        u.name         AS studentName,
        ga.status,
        ga.applied_at
      FROM gig_applications ga
      JOIN gigs g      ON ga.gig_id     = g.id
      JOIN users u     ON ga.student_id = u.id
      ORDER BY ga.applied_at DESC
      `
    );
    return res.json(rows);
  } catch (err) {
    return next(err);
  }
};

// GET /api/admin/applications/:id
exports.getApplicationDetail = async (req, res, next) => {
  const { id } = req.params;
  try {
    const [rows] = await db.query(
      `
      SELECT
        ga.*,
        g.title        AS gigTitle,
        g.description  AS gigDescription,
        u.name         AS studentName,
        u.email        AS studentEmail
      FROM gig_applications ga
      JOIN gigs g      ON ga.gig_id     = g.id
      JOIN users u     ON ga.student_id = u.id
      WHERE ga.id = ?
      `,
      [id]
    );
    if (!rows.length) {
      return res.status(404).json({ message: 'Application not found' });
    }
    return res.json(rows[0]);
  } catch (err) {
    return next(err);
  }
};

// POST /api/admin/applications/:id/update-status
exports.updateApplicationStatus = async (req, res, next) => {
  const { id } = req.params;
  const { status } = req.body;
  const valid = ['draft','Applied','Shortlisted','Accepted','Completed','Rejected'];
  if (!valid.includes(status)) {
    return res.status(400).json({ message: 'Invalid status' });
  }
  try {
    await db.query(
      `UPDATE gig_applications
         SET status = ?, 
             completed_at = CASE WHEN status = 'Completed' THEN NOW() ELSE completed_at END
       WHERE id = ?`,
      [status, id]
    );
    return res.json({ success: true, message: 'Status updated' });
  } catch (err) {
    return next(err);
  }
};
