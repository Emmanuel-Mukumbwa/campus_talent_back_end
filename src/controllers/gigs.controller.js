// src/controllers/gigs.controller.js
const pool = require('../config/database');

exports.getGigsBySkill = async (req, res, next) => {
  try {
    const { skill } = req.query;
    if (!skill) {
      return res.status(400).json({ message: 'Missing required query param: skill' });
    }

    const sql = `
      SELECT
       g.id,
        g.title,
        u.company_name      AS company,
        CONCAT(u.name)      AS recruiter,
        g.location,
        g.duration,
        g.description,
        g.deliverables,
        FORMAT(g.payment_amount, 0) AS price,
        -- total paid so far
        IFNULL((
          SELECT SUM(amount)
            FROM escrows
           WHERE gig_id = g.id
             AND paid = 1
        ), 0) AS paid_amount,
        DATE_FORMAT(g.expires_at, '%Y-%m-%d') AS deadline,

        -- **Skill-matching metadata**
        COUNT(s.id) AS matched_skills_count,
        (
          SELECT COUNT(*) 
          FROM gig_skills 
          WHERE gig_id = g.id
        ) AS total_skills_count,
        JSON_ARRAYAGG(s.name) AS matched_skills

      FROM gigs g
      JOIN gig_skills gs ON gs.gig_id = g.id
      JOIN skills s     ON s.id = gs.skill_id
      JOIN users u      ON u.id = g.recruiter_id

      WHERE s.name     = ?
        AND g.status   = 'Open'
        AND g.expires_at >= CURDATE()

      GROUP BY
        g.id,
        g.title, 
        u.company_name,
        g.location,
        g.duration,
        g.expires_at

      ORDER BY g.expires_at ASC
    `;

    const [rows] = await pool.execute(sql, [skill]);
    res.json(rows);
  } catch (err) {
    next(err);
  }
};
 