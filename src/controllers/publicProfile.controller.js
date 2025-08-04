// src/controllers/publicProfile.controller.js

const db = require('../config/database');

// fields we allow clients to update (unused here, but kept for parity)
const PICKABLE = [
  'name','bio','avatar_url','phone','program','university',
  'faculty','year','company_name','department','availability','payment_pref'
];

/**
 * Public version of getProfileById (no auth):
 * GET /api/public/profile/:userId
 */
exports.getProfileById = async (req, res, next) => {
  try {
    const userId = parseInt(req.params.userId, 10);
    if (!Number.isInteger(userId)) {
      return res.status(400).json({ message: 'Invalid userId' });
    }

    const [[user]] = await db.query(
      `SELECT
         id, name, bio, avatar_url, phone, program, university,
         faculty, year, company_name, department, availability,
         payment_pref, role
       FROM users
      WHERE id = ? AND deleted_at IS NULL`,
      [userId]
    );

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(user);

  } catch (err) {
    next(err);
  }
};

/**
 * Public batch avatar lookup (no auth):
 * GET /api/public/profile/batch?ids=1,2,3
 */
exports.batchProfiles = async (req, res, next) => {
  try {
    const raw = req.query.ids;
    if (!raw) {
      return res.status(400).json({ message: 'Missing ids query parameter' });
    }
    const ids = raw
      .split(',')
      .map(s => parseInt(s, 10))
      .filter(Number.isInteger);

    if (!ids.length) {
      return res.status(400).json({ message: 'No valid IDs provided' });
    }

    const [rows] = await db.query(
      `SELECT id, avatar_url FROM users WHERE id IN (?)`,
      [ids]
    );

    // Prepend full URL if desired
    const host = `${req.protocol}://${req.get('host')}`;
    const payload = rows.map(r => ({
      id: r.id,
      avatar_url: r.avatar_url
        ? host + r.avatar_url
        : null
    }));

    res.json(payload);
  } catch (err) {
    next(err);
  }
};

/**
 * Public student skills:
 * GET /api/public/profile/:userId/skills
 */
exports.getStudentSkills = async (req, res, next) => {
  try {
    const userId = parseInt(req.params.userId, 10);
    if (!Number.isInteger(userId)) {
      return res.status(400).json({ message: 'Invalid userId' });
    }

    const [rows] = await db.query(
      `SELECT s.id, s.name, COUNT(e.id) AS endorsements
         FROM skills s
    LEFT JOIN endorsements e
           ON e.student_id     = ?
          AND e.skill_category = s.category
        GROUP BY s.id, s.name
       HAVING endorsements > 0`,
      [userId]
    );

    res.json(rows);
  } catch (err) {
    next(err);
  }
};

/**
 * Public student portfolio:
 * GET /api/public/profile/:userId/portfolio
 */
exports.getStudentPortfolio = async (req, res, next) => {
  try {
    const userId = parseInt(req.params.userId, 10);
    if (!Number.isInteger(userId)) {
      return res.status(400).json({ message: 'Invalid userId' });
    }

    const [rows] = await db.query(
      `SELECT pp.id,
              pp.title,
              JSON_UNQUOTE(JSON_EXTRACT(pp.evidence_links,'$[0]')) AS link
         FROM portfolios p
    INNER JOIN portfolio_projects pp
            ON pp.portfolio_id = p.id
        WHERE p.student_id = ?`,
      [userId]
    );

    res.json(rows);
  } catch (err) {
    next(err);
  }
};

/**
 * Public recruiter gigs:
 * GET /api/public/profile/:userId/gigs
 */
exports.getRecruiterGigs = async (req, res, next) => {
  try {
    const userId = parseInt(req.params.userId, 10);
    if (!Number.isInteger(userId)) {
      return res.status(400).json({ message: 'Invalid userId' });
    }

    const [rows] = await db.query(
      `SELECT id, title FROM gigs WHERE recruiter_id = ?`,
      [userId]
    );

    res.json(rows);
  } catch (err) {
    next(err);
  }
};
