// src/controllers/gigsstatus.controller.js

const pool = require('../config/database');

/**
 * Safely parse JSON only if raw is a string.
 * Otherwise, return raw (assuming it's already parsed).
 */
function safeParse(raw, fallback = {}) {
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  }
  // Already an object/array
  return raw ?? fallback;
}

/**
 * GET /api/gigsstatus/:studentId/applications?status=!draft
 * Returns { count: X } — unchanged.
 */
exports.getGigsByRecruiter = async (req, res) => {
  const recruiterId = parseInt(req.query.recruiterId, 10);
  if (req.user.role !== 'recruiter' || req.user.id !== recruiterId) {
    return res.status(403).json({ message: 'Forbidden' });
  }

  try {
    const [rows] = await pool.query(
      `SELECT id, title, description, status, created_at, expires_at
       FROM gigs
       WHERE recruiter_id = ?`,
      [recruiterId]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Database error' });
  }
};

/**
 * GET /api/gigsstatus/:gigId/applications?status=Applied
 * Returns { count: X } — unchanged.
 */
exports.getApplicationCountForGig = async (req, res) => {
  const gigId = parseInt(req.params.gigId, 10);
  const status = req.query.status;

  try {
    const [gigs] = await pool.query(
      `SELECT recruiter_id FROM gigs WHERE id = ?`,
      [gigId]
    );
    if (!gigs.length || gigs[0].recruiter_id !== req.user.id) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    const [countResult] = await pool.query(
      `SELECT COUNT(*) AS count
       FROM gig_applications
       WHERE gig_id = ? AND status = ?`,
      [gigId, status]
    );
    res.json({ count: countResult[0].count });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Database error' });
  }
};

/**
 * GET /api/studentsreviewedgigs/:studentId/applications?status=!draft
 * Returns array of application objects for student (excluding drafts),
 * with JSON fields safely parsed.
 */
exports.getReviewedApplicationsForStudent = async (req, res) => {
  const studentId    = parseInt(req.params.studentId, 10);
  const statusFilter = req.query.status; // e.g. "!draft"

  if (req.user.role !== 'student' || req.user.id !== studentId) {
    return res.status(403).json({ message: 'Forbidden' });
  }

  // build WHERE clause
  let whereClause = '`status` != ?';
  let params = ['draft'];
  if (statusFilter !== '!draft') {
    whereClause = '`status` = ?';
    params = [statusFilter];
  }

  try {
    const [rows] = await pool.query(
      `
      SELECT
        id,
        gig_id,
        status,
        applied_at,
        requirements,
        attachments
      FROM gig_applications
      WHERE student_id = ? AND ${whereClause}
      ORDER BY applied_at DESC
      `,
      [studentId, ...params]
    );

    // Parse only if string
    const apps = rows.map(row => ({
      id:           row.id,
      gig_id:       row.gig_id,
      status:       row.status,
      applied_at:   row.applied_at,
      requirements: safeParse(row.requirements, {}),
      attachments:  safeParse(row.attachments, []),
    }));

    return res.json(apps);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Database error' });
  }
};
