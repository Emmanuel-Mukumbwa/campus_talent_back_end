// File: src/controllers/gigRequirements.controller.js
const pool = require('../config/database');

/**
 * POST /api/gigs/:gigId/requirements
 * Body: [ { type, required, details }, ... ]
 * Only the recruiter who owns the gig may upsert.
 */
exports.upsertRequirements = async (req, res, next) => {
  const recruiterId = req.user.id;
  const gigId       = parseInt(req.params.gigId, 10);
  const reqs        = req.body;

  if (!Array.isArray(reqs)) {
    return res.status(400).json({ message: 'Expected an array of requirements' });
  }

  const conn = await pool.getConnection();
  try {
    // Verify recruiter owns this gig
    const [grows] = await conn.query(
      'SELECT recruiter_id FROM gigs WHERE id = ?',
      [gigId]
    );
    if (!grows.length || grows[0].recruiter_id !== recruiterId) {
      return res.status(403).json({ message: 'Not authorized for this gig' });
    }

    await conn.beginTransaction();

    // Remove any existing requirements for this gig
    await conn.query(
      'DELETE FROM gig_requirements WHERE gig_id = ?',
      [gigId]
    );

    // Only persist those that are actually required
    const toInsert = reqs
      .filter(r => r.required)                    // ← only required ones
      .map(r => [ gigId, r.type, 1, r.details || null ]);

    if (toInsert.length) {
      await conn.query(
        'INSERT INTO gig_requirements (gig_id, type, required, details) VALUES ?',
        [toInsert]
      );
    }

    await conn.commit();
    res.status(200).json({ message: 'Requirements saved' });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
};

/**
 * GET /api/gigs/:gigId/requirements
 * Returns the array of requirement records.
 * Anybody logged in may fetch (students and recruiters).
 */
exports.listRequirements = async (req, res, next) => {
  const gigId = parseInt(req.params.gigId, 10);

  try {
    // Fetch requirements
    const [rows] = await pool.query(
      'SELECT id, type, required, details FROM gig_requirements WHERE gig_id = ?',
      [gigId]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
};
