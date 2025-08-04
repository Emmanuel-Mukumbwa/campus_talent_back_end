// File: src/controllers/profile.controller.js

const db = require('../config/database');

// fields we allow clients to update
const PICKABLE = [
  'name','bio','avatar_url','phone','program','university',
  'faculty','year','company_name','department','availability','payment_pref'
];
function pick(body) {
  return PICKABLE.reduce((o, key) => {
    if (body[key] !== undefined) o[key] = body[key];
    return o;
  }, {});
}

/**
 * Attach endorsementPoints (sum of points_awarded in endorsements)
 * and badge (highest badge_name in user_badges) to a student user object.
 */
async function attachPointTotals(user) {
  // only for students
  if (user.role !== 'student') {
    user.endorsementPoints = 0;
    user.badge             = null;
    return user;
  }

  const userId = user.id;

  // 1) Sum endorsement points
  const [[{ endorsementPoints = 0 }]] = await db.query(
    `SELECT COALESCE(SUM(points_awarded), 0) AS endorsementPoints
       FROM endorsements
      WHERE student_id = ?`,
    [userId]
  );

  // 2) Pick highest badge (gold > silver > bronze)
  //    We can use FIELD() for ordering in MySQL
  const [[badgeRow]] = await db.query(
    `SELECT badge_name
       FROM user_badges
      WHERE student_id = ?
      ORDER BY FIELD(badge_name, 'gold','silver','bronze') ASC
      LIMIT 1`,
    [userId]
  );
  // note: FIELD('gold','silver','bronze') returns position (1,2,3) so ASC picks gold first

  return {
    ...user,
    endorsementPoints,
    badge: badgeRow?.badge_name ?? null
  };
}


// GET /api/profile  → own profile
exports.getOwnProfile = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const [[user]] = await db.query(
      `SELECT * FROM users
        WHERE id = ? AND deleted_at IS NULL`,
      [userId]
    );
    if (!user) return res.status(404).json({ message: 'User not found' });

    const enriched = await attachPointTotals(user);
    res.json(enriched);
  } catch (err) {
    next(err);
  }
};

// GET /api/profile/:userId  → any user’s profile
exports.getProfileById = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const [[user]] = await db.query(
      `SELECT * FROM users
        WHERE id = ? AND deleted_at IS NULL`,
      [userId]
    );
    if (!user) return res.status(404).json({ message: 'User not found' });

    const enriched = await attachPointTotals(user);
    res.json(enriched);
  } catch (err) {
    next(err);
  }
};

// PUT /api/profile → update own profile
exports.updateProfile = async (req, res, next) => {
  try {
    const userId  = req.user.id;
    const updates = pick(req.body);
    const fields  = Object.keys(updates);
    if (!fields.length) {
      return res.status(400).json({ message: 'No updatable fields' });
    }

    const setClause = fields.map(f => `${f} = ?`).join(', ');
    await db.query(
      `UPDATE users SET ${setClause} WHERE id = ?`,
      [...fields.map(f => updates[f]), userId]
    );

    const [[user]] = await db.query(
      `SELECT * FROM users WHERE id = ?`,
      [userId]
    );
    const enriched = await attachPointTotals(user);
    res.json(enriched);

  } catch (err) {
    next(err);
  }
};

// POST /api/profile/avatar → upload new avatar
exports.uploadAvatar = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded.' });
    }
    const avatarUrl = `/uploads/profilepictures/${req.file.filename}`;
    await db.query(
      `UPDATE users SET avatar_url = ? WHERE id = ?`,
      [avatarUrl, req.user.id]
    );
    res.json({ success: true, avatar_url: avatarUrl });
  } catch (err) {
    next(err);
  }
};

// GET student skills
exports.getStudentSkills = async (req, res, next) => {
  try {
    const { userId } = req.params;
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

// GET student portfolio
exports.getStudentPortfolio = async (req, res, next) => {
  try {
    const { userId } = req.params;
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

// GET student reviews (stubbed)
exports.getUserReviews = async (_req, res) => {
  res.json([]);
};

// GET recruiter gigs
exports.getRecruiterGigs = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const [rows] = await db.query(
      `SELECT id, title FROM gigs WHERE recruiter_id = ?`,
      [userId]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
};

// Batch avatar fetch (unchanged)
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
    res.json(rows);
  } catch (err) {
    next(err);
  }
};

// File: src/controllers/profile.controller.js
exports.updateActivity = async (req, res, next) => {
  const userId = req.user.id;
  const db = require('../config/database');

  try {
    // 1) Base flags from users
    const [[ user ]] = await db.query(
      `SELECT avatar_url IS NOT NULL        AS hasAvatar,
              bio           IS NOT NULL AND bio <> '' AS hasBio,
              role
         FROM users
        WHERE id = ?`,
      [userId]
    );

    // 2) Count published portfolios
    const [[{ publishedCount }]] = await db.query(
      `SELECT COUNT(*) AS publishedCount
         FROM portfolios
        WHERE student_id = ? AND status = 'published'`,
      [userId]
    );

    // 3) Count all portfolio projects
    const [[{ projectCount }]] = await db.query(
      `SELECT COUNT(pp.id) AS projectCount
         FROM portfolios p
    INNER JOIN portfolio_projects pp
            ON pp.portfolio_id = p.id
        WHERE p.student_id = ?`,
      [userId]
    );

    // 4) Count distinct endorsed skill categories directly from endorsements
   const [[{ endorsedCount }]] = await db.query(
     `SELECT COUNT(DISTINCT skill_category) AS endorsedCount
        FROM endorsements
       WHERE student_id = ?`,
     [userId]
   );

    // 5) Recruiter verification bonus
    let verificationBonus = 0;
    if (user.role === 'recruiter') {
      const [[ rv ]] = await db.query(
        `SELECT verification_status
           FROM recruiter_verifications
          WHERE user_id = ?`,
        [userId]
      );
      if (rv?.verification_status === 'fully_verified') {
        verificationBonus = 20;
      }
    }

    // 6) Compute the new profile_strength
    let score = 0;
    if (user.hasAvatar)          score += 10;
    if (user.hasBio)             score += 15;
    if (publishedCount >= 1)     score += 20;
    if (projectCount   >= 1)     score += 20;
    if (endorsedCount  >= 1)     score += 15;
    score += verificationBonus;

    if (score > 100) score = 100;

    // 7) Persist last_active + profile_strength
    await db.query(
      `UPDATE users
          SET profile_strength = ?,
              last_active      = NOW()
        WHERE id = ?`,
      [score, userId]
    );

    res.json({ success: true, profile_strength: score });
  } catch (err) { 
    next(err);
  }
};

// In src/controllers/profile.controller.js

// Public version of batchProfiles (no auth)
exports.publicBatchProfiles = async (req, res, next) => {
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
    // Prepend full URL if you like:
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
