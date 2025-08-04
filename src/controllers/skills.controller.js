// File: src/controllers/skills.controller.js

const pool = require('../config/database');

/**
 * GET /api/skills
 * Returns all skills sorted alphabetically.
 */
exports.getAllSkills = async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, name FROM skills ORDER BY name ASC'
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/skills/trending?days=7
 * Returns skills ordered by number of new open gigs requiring them
 * in the last `days` days (default 7), limited to top 10.
 */
exports.getTrendingSkills = async (req, res, next) => {
  const days = parseInt(req.query.days, 10) || 7;

  try {
    const sql = `
     SELECT
       s.name,
       COUNT(*)           AS gig_count,
       MAX(g.created_at)  AS last_seen
     FROM skills s
     JOIN gig_skills gs  ON gs.skill_id = s.id
     JOIN gigs g        ON g.id        = gs.gig_id
     WHERE g.status      = 'Open'
       AND g.created_at  >= DATE_SUB(NOW(), INTERVAL ? DAY)
     GROUP BY s.name
     ORDER BY
       gig_count DESC,
       last_seen DESC
     LIMIT 10
   `;

    const [rows] = await pool.execute(sql, [days]);
    res.json(rows);
  } catch (err) {
    next(err);
  }
};
