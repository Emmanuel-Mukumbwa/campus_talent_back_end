// src/controllers/student.controller.js
const pool = require('../config/database');

const WEIGHTS = {
  endorsements:    0.30,
  profileStrength: 0.20,
  projectCount:    0.15,
  badgeScore:      0.10,
  completedGigs:   0.15,
  rating:          0.10,
};

function normalize(value, max) {
  return max > 0 ? value / max : 0;
}

exports.getTrendingStudents = async (req, res, next) => {
  try {
    // 1) Parse query params
    const page   = parseInt(req.query.page, 10) || 1;
    const limit  = parseInt(req.query.limit, 10) || 10;
    const offset = (page - 1) * limit;
    const { q, skill, badge } = req.query;

    // 2) Build WHERE clauses
    const whereClauses = ["u.role = 'student'", "u.is_active = 1"];
    const params = [];

    if (q) {
      whereClauses.push("u.name LIKE ?");
      params.push(`%${q}%`);
    }

    // skill filter via gig_skills → skills.category
    if (skill) {
      whereClauses.push(`
        EXISTS (
          SELECT 1
            FROM gig_applications ga
            JOIN gig_skills gs     ON gs.gig_id = ga.gig_id
            JOIN skills s          ON s.id     = gs.skill_id
           WHERE ga.student_id = u.id
             AND ga.status      = 'Completed'
             AND s.category     = ?
        )
      `);
      params.push(skill);
    }

    if (badge) {
      whereClauses.push(`
        EXISTS (
          SELECT 1 FROM user_badges ub2
           WHERE ub2.student_id = u.id
             AND ub2.badge_name = ?
        )
      `);
      params.push(badge);
    }

    const whereSQL = whereClauses.length
      ? "WHERE " + whereClauses.join(" AND ")
      : "";

    // 3) Main query: user info + metrics + badge array
    const [rows] = await pool.query(
      `
      SELECT
        u.id,
        u.name,
        u.avatar_url,
        u.university,
        u.program,
        u.profile_strength,
        u.rating,

        /* recent endorsements */
        COALESCE(e.endorse_count, 0)    AS endorsements,

        /* project count via portfolios → portfolio_projects */
        COALESCE(pp.project_count, 0)   AS projectCount,

        /* badge score */
        COALESCE(ub.badge_score, 0)     AS badgeScore,

        /* completed gigs */
        COALESCE(ga.completed_count, 0) AS completedGigs,

        /* actual badge names array */
        COALESCE(ubad.badges, '[]')     AS badges
      FROM users u

      /* endorsements in last 14d */
      LEFT JOIN (
        SELECT student_id, COUNT(*) AS endorse_count
          FROM endorsements
         WHERE awarded_at >= DATE_SUB(NOW(), INTERVAL 14 DAY)
         GROUP BY student_id
      ) e ON u.id = e.student_id

      /* project count join */
      LEFT JOIN (
        SELECT p.student_id, COUNT(pp.id) AS project_count
          FROM portfolios p
          JOIN portfolio_projects pp
            ON pp.portfolio_id = p.id
         GROUP BY p.student_id
      ) pp ON u.id = pp.student_id

      /* badge score sum */
      LEFT JOIN (
        SELECT student_id,
               SUM(
                 CASE badge_name
                   WHEN 'bronze' THEN 1
                   WHEN 'silver' THEN 2
                   WHEN 'gold'   THEN 3
                   ELSE 0
                 END
               ) AS badge_score
          FROM user_badges
         GROUP BY student_id
      ) ub ON u.id = ub.student_id

      /* completed gigs count */
      LEFT JOIN (
        SELECT student_id, COUNT(*) AS completed_count
          FROM gig_applications
         WHERE status = 'Completed'
         GROUP BY student_id
      ) ga ON u.id = ga.student_id

      /* actual badge names */
      LEFT JOIN (
        SELECT student_id,
               JSON_ARRAYAGG(badge_name) AS badges
          FROM user_badges
         GROUP BY student_id
      ) ubad ON u.id = ubad.student_id

      ${whereSQL}
      ORDER BY NULL
      LIMIT ? OFFSET ?
      `,
      [...params, limit, offset]
    );

    if (!rows.length) {
      return res.json({ students: [], page, limit, hasMore: false });
    }

    // 4) Compute maxima for normalization
    const maxVals = rows.reduce((acc, r) => {
      acc.endorsements    = Math.max(acc.endorsements,    r.endorsements);
      acc.profileStrength = Math.max(acc.profileStrength, r.profile_strength);
      acc.projectCount    = Math.max(acc.projectCount,    r.projectCount);
      acc.badgeScore      = Math.max(acc.badgeScore,      r.badgeScore);
      acc.completedGigs   = Math.max(acc.completedGigs,   r.completedGigs);
      acc.rating          = Math.max(acc.rating,          r.rating);
      return acc;
    }, {
      endorsements:    0,
      profileStrength: 0,
      projectCount:    0,
      badgeScore:      0,
      completedGigs:   0,
      rating:          0,
    });

    // 5) Attach composite trendingScore & parse badges JSON
    const studentsWithScore = rows.map(r => {
      const scores = {
        endorsements:    normalize(r.endorsements,    maxVals.endorsements),
        profileStrength: normalize(r.profile_strength, maxVals.profileStrength),
        projectCount:    normalize(r.projectCount,    maxVals.projectCount),
        badgeScore:      normalize(r.badgeScore,      maxVals.badgeScore),
        completedGigs:   normalize(r.completedGigs,   maxVals.completedGigs),
        rating:          normalize(r.rating,          maxVals.rating),
      };

      const trendingScore =
        scores.endorsements    * WEIGHTS.endorsements    +
        scores.profileStrength * WEIGHTS.profileStrength +
        scores.projectCount    * WEIGHTS.projectCount    +
        scores.badgeScore      * WEIGHTS.badgeScore      +
        scores.completedGigs   * WEIGHTS.completedGigs   +
        scores.rating          * WEIGHTS.rating;

      return {
        id:              r.id,
        name:            r.name,
        avatar_url:      r.avatar_url,
        university:      r.university,
        program:         r.program,
        profileStrength: r.profile_strength,
        rating:          r.rating,
        endorsements:    r.endorsements,
        projectCount:    r.projectCount,
        badgeScore:      r.badgeScore,
        completedGigs:   r.completedGigs,
        badges:          JSON.parse(r.badges),
        trendingScore,
      };
    });

    // 6) Sort by trendingScore desc
    studentsWithScore.sort((a, b) => b.trendingScore - a.trendingScore);

    // 7) Fetch recent endorsements (last 7d)
    const studentIds = studentsWithScore.map(s => s.id);
    const [reRecent] = await pool.query(
      `
      SELECT student_id,
             skill_category AS skill,
             COUNT(*)       AS count
        FROM endorsements
       WHERE awarded_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
         AND student_id IN (?)
       GROUP BY student_id, skill_category
      `,
      [studentIds]
    );
    const recMap = reRecent.reduce((acc, e) => {
      (acc[e.student_id] ||= []).push({ skill: e.skill, count: e.count });
      return acc;
    }, {});

    // 8) Attach recentEndorsements & respond
    const result = studentsWithScore.map(s => ({
      ...s,
      recentEndorsements: recMap[s.id] || [],
    }));

    res.json({
      students: result,
      page,
      limit,
      hasMore: rows.length === limit,
    });
  } catch (err) {
    next(err);
  }
};

exports.getNewStudents = async (req, res, next) => {
  try {
    // 1) Parse params
    const page   = parseInt(req.query.page, 10) || 1;
    const limit  = parseInt(req.query.limit, 10) || 10;
    const offset = (page - 1) * limit;
    const { q, skill, badge } = req.query;

    // 2) Build WHERE
    const whereClauses = ["u.role = 'student'", "u.is_active = 1"];
    const params = [];

    if (q) {
      whereClauses.push("u.name LIKE ?");
      params.push(`%${q}%`);
    }

    if (skill) {
      whereClauses.push(`
        EXISTS (
          SELECT 1
            FROM gig_applications ga
            JOIN gig_skills gs     ON gs.gig_id = ga.gig_id
            JOIN skills s          ON s.id     = gs.skill_id
           WHERE ga.student_id = u.id
             AND ga.status      = 'Completed'
             AND s.category     = ?
        )
      `);
      params.push(skill);
    }

    if (badge) {
      whereClauses.push(`
        EXISTS (
          SELECT 1 FROM user_badges ub
           WHERE ub.student_id = u.id
             AND ub.badge_name = ?
        )
      `);
      params.push(badge);
    }

    const whereSQL = whereClauses.length
      ? "WHERE " + whereClauses.join(" AND ")
      : "";

    // 3) Query & respond
    const [rows] = await pool.query(
      `
      SELECT
        u.id,
        u.name,
        u.avatar_url,
        u.university,
        u.program,
        u.created_at,
        COALESCE(pp.project_count, 0) AS projectCount,
        COALESCE(e.endorse_count, 0)  AS endorsements,
        COALESCE(ubad.badges, '[]')    AS badges
      FROM users u

      LEFT JOIN (
        SELECT p.student_id, COUNT(pp.id) AS project_count
          FROM portfolios p
          JOIN portfolio_projects pp
            ON pp.portfolio_id = p.id
         GROUP BY p.student_id
      ) pp ON u.id = pp.student_id

      LEFT JOIN (
        SELECT student_id, COUNT(*) AS endorse_count
          FROM endorsements
         WHERE awarded_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
         GROUP BY student_id
      ) e ON u.id = e.student_id

      LEFT JOIN (
        SELECT student_id, JSON_ARRAYAGG(badge_name) AS badges
          FROM user_badges
         GROUP BY student_id
      ) ubad ON u.id = ubad.student_id

      ${whereSQL}
      ORDER BY u.created_at DESC
      LIMIT ? OFFSET ?
      `,
      [...params, limit, offset]
    );

    res.json({
      students: rows.map(r => ({
        id:             r.id,
        name:           r.name,
        avatar_url:     r.avatar_url,
        university:     r.university,
        program:        r.program,
        created_at:     r.created_at,
        projectCount:   r.projectCount,
        endorsements:   r.endorsements,
        badges:         JSON.parse(r.badges),
      })),
      page,
      limit,
      hasMore: rows.length === limit,
    });
  } catch (err) {
    next(err);
  }
};
