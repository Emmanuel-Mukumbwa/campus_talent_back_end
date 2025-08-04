// File: src/controllers/endorse.controller.js

const db = require('../config/database');

// GET /api/students/:studentId/portfolio/skills
exports.getPortfolioSkills = async (req, res, next) => {
  const studentId = parseInt(req.params.studentId, 10);
  let conn;
  try {
    conn = await db.getConnection();

    // 1) fetch the student's proficiencies JSON
    const [portfolioRows] = await conn.query(
      `SELECT p.proficiencies
         FROM portfolios p
        WHERE p.student_id = ?`,
      [ studentId ]
    );
    if (portfolioRows.length === 0) {
      return res.json({ skills: [] });
    }
    const proficiencies = portfolioRows[0].proficiencies || {};

    // 2) join portfolio_skills → skills
    const [rows] = await conn.query(
      `SELECT s.id, s.name
         FROM portfolio_skills ps
         JOIN skills s
           ON s.id = ps.skill_id
        WHERE ps.portfolio_id = (
          SELECT id FROM portfolios WHERE student_id = ?
        )`,
      [ studentId ]
    );

    // 3) merge in proficiency level (default 0), then sort
    const skills = rows
      .map(r => ({
        id:    r.id,
        name:  r.name,
        level: proficiencies[r.name] || 0
      }))
      .sort((a, b) => b.level - a.level);

    return res.json({ skills });
  } catch (err) {
    return next(err);
  } finally {
    if (conn) conn.release();
  }
};

// GET /api/students/:studentId/endorsements/me
exports.getMyEndorsements = async (req, res, next) => {
  const endorserId = req.user.id;
  const studentId  = parseInt(req.params.studentId, 10);

  let conn;
  try {
    conn = await db.getConnection();
    const [rows] = await conn.query(
      `SELECT skill_category
         FROM endorsements
        WHERE student_id  = ?
          AND endorser_id = ?`,
      [ studentId, endorserId ]
    );

    // return just an array of string names, e.g. ["Coding","Design"]
    const endorsed = rows.map(r => r.skill_category);
    return res.json(endorsed);
  } catch (err) {
    return next(err);
  } finally {
    if (conn) conn.release();
  }
};

// POST /api/students/:studentId/endorse
exports.endorseStudent = async (req, res, next) => {
  const endorserId   = req.user.id;
  const endorserRole = req.user.role;         // 'student' or 'recruiter'
  const studentId    = parseInt(req.params.studentId, 10);
  const { selectedSkills } = req.body;        // e.g. ['Coding','Design']

  // 1) points per skill based on role
  const perSkillPts = endorserRole === 'recruiter' ? 100 : 50;

  // 2) badge thresholds
  const thresholds = [
    { pts: 200,  badge: 'bronze'  },
    { pts: 600,  badge: 'silver'  },
    { pts: 1000, badge: 'gold'    }
  ];
 
  let conn;
  try {
    conn = await db.getConnection();

    // ——— PREVENT DUPLICATE ENDORSEMENTS ———
    const [existing] = await conn.query(
      `SELECT skill_category
         FROM endorsements
        WHERE student_id     = ?
          AND endorser_id    = ?
          AND skill_category IN (?)`,
      [ studentId, endorserId, selectedSkills ]
    );
    if (existing.length > 0) {
      return res.status(400).json({
        success: false,
        message: `You have already endorsed this student for: ${existing
          .map(r => r.skill_category)
          .join(', ')}`
      });
    }
    // ———————————————————————————————

    await conn.beginTransaction();

    // 3) record each endorsement event
    for (let cat of selectedSkills) {
      await conn.query(
        `INSERT INTO endorsements
           (student_id, endorser_id, skill_category, points_awarded)
         VALUES (?, ?, ?, ?)`,
        [ studentId, endorserId, cat, perSkillPts ]
      );
    }

    // 4) compute total points so far
    const [[{ total }]] = await conn.query(
      `SELECT COALESCE(SUM(points_awarded),0) AS total
         FROM endorsements
        WHERE student_id = ?`,
      [ studentId ]
    );

    // 5) get already‑awarded badges
    const [earned] = await conn.query(
      `SELECT badge_name
         FROM user_badges
        WHERE student_id = ?`,
      [ studentId ]
    );
    const have = new Set(earned.map(r => r.badge_name));

    const awardedBadges = [];

    // 6) issue any new badges
    for (let { pts, badge } of thresholds) {
      if (total >= pts && !have.has(badge)) {
        const [events] = await conn.query(
          `SELECT skill_category, points_awarded
             FROM endorsements
            WHERE student_id = ?
            ORDER BY awarded_at ASC`,
          [ studentId ]
        );
        let cum = 0;
        let triggeringCat = events[events.length - 1].skill_category;
        for (let e of events) {
          cum += e.points_awarded;
          if (cum >= pts) {
            triggeringCat = e.skill_category;
            break;
          }
        }
        await conn.query(
          `INSERT INTO user_badges
             (student_id, skill_category, points_awarded, badge_name)
           VALUES (?, ?, ?, ?)`, 
          [ studentId, triggeringCat, pts, badge ]
        );
        awardedBadges.push({ badge, threshold: pts, skill_category: triggeringCat });
      }
    }

    await conn.commit();
    return res.json({
      success:     true,
      totalPoints: total,
      awardedBadges
    });
  } catch (err) {
    if (conn) await conn.rollback();
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({
        success: false,
        message: 'You have already endorsed this student for that skill.'
      });
    }
    return next(err);
  } finally {
    if (conn) conn.release();
  }
}; 

// at top, after your other exports
// File: controllers/endorse.controller.js
exports.endorseGigComplete = async (req, res, next) => {
  const endorserId = req.user.id;
  const studentId  = parseInt(req.params.studentId, 10);
  const gigId      = parseInt(req.params.gigId, 10);  // may only be for logging
  const perGigPts  = 100;
  const category   = 'Gig';  // must exist in your ENUM

  // same badge thresholds
  const thresholds = [
    { pts: 200,  badge: 'bronze' },
    { pts: 600,  badge: 'silver' },
    { pts: 1000, badge: 'gold'   },
  ];

  let conn;
  try {
    conn = await db.getConnection();
    await conn.beginTransaction();

    // 1) See if there's already a 'Gig' endorsement for this student + recruiter
    const [[ existing ]] = await conn.query(
      `SELECT id, points_awarded
         FROM endorsements
        WHERE student_id     = ?
          AND endorser_id    = ?
          AND skill_category = ?`,
      [ studentId, endorserId, category ]
    );

    if (existing) {
      // 2a) If it exists, just add points and bump the timestamp
      await conn.query(
        `UPDATE endorsements
            SET points_awarded = points_awarded + ?,
                awarded_at     = NOW()
          WHERE id = ?`,
        [ perGigPts, existing.id ]
      );
    } else {
      // 2b) First gig endorsement → insert new row
      await conn.query(
        `INSERT INTO endorsements
           (student_id, endorser_id, skill_category, points_awarded)
         VALUES (?, ?, ?, ?)`,
        [ studentId, endorserId, category, perGigPts ]
      );
    }

    // 3) Recompute total endorsement points for badge logic
    const [[{ total }]] = await conn.query(
      `SELECT COALESCE(SUM(points_awarded),0) AS total
         FROM endorsements
        WHERE student_id = ?`,
      [ studentId ]
    );

    // 4) Fetch already‑awarded badges
    const [earned] = await conn.query(
      `SELECT badge_name FROM user_badges WHERE student_id = ?`,
      [ studentId ]
    );
    const have = new Set(earned.map(r => r.badge_name));

    // 5) Issue any newly‑earned badges
    for (let { pts, badge } of thresholds) {
      if (total >= pts && !have.has(badge)) {
        // find the category that triggered threshold (optional)
        const [events] = await conn.query(
          `SELECT skill_category, points_awarded
             FROM endorsements
            WHERE student_id = ?
            ORDER BY awarded_at ASC`,
          [ studentId ]
        );
        let cum = 0, triggeringCat = category;
        for (let e of events) {
          cum += e.points_awarded;
          if (cum >= pts) {
            triggeringCat = e.skill_category;
            break;
          }
        }

        await conn.query(
          `INSERT INTO user_badges
             (student_id, skill_category, points_awarded, badge_name)
           VALUES (?, ?, ?, ?)`,
          [ studentId, triggeringCat, pts, badge ]
        );
      }
    }

    await conn.commit();
    return res.json({ success: true, totalPoints: total });
  } catch (err) {
    if (conn) await conn.rollback();
    return next(err);
  } finally {
    if (conn) conn.release();
  }
};
