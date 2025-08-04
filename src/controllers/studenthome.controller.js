// File: src/controllers/studenthome.controller.js
const pool = require('../config/database');

async function getTopStudents(req, res, next) {
  try {
    // 1) Fetch top 3 users by profile_strength & badge count
    const [users] = await pool.query(`
      SELECT 
        u.id,
        u.name,
        u.program,
        u.year,
        u.university,
        u.profile_strength        AS profileStrength,
        u.availability,
        u.payment_pref            AS paymentPreference,
        u.is_verified             AS isVerified,
        u.payment_verified        AS paymentVerified,
        u.last_active             AS lastActive,
        u.response_rate           AS responseRate,
        COUNT(ub.id)              AS badgeCount
      FROM users u
      LEFT JOIN user_badges ub
        ON u.id = ub.student_id
      GROUP BY u.id
      ORDER BY u.profile_strength DESC, badgeCount DESC
      LIMIT 3
    `);

    const ids = users.map(u => u.id);
    if (ids.length === 0) return res.json([]);

    // 2) Fetch skills via portfolios → portfolio_skills → skills
    const [skillRows] = await pool.query(`
      SELECT p.student_id, s.name AS skill
      FROM portfolios p
      JOIN portfolio_skills ps ON p.id = ps.portfolio_id
      JOIN skills s            ON ps.skill_id = s.id
      WHERE p.student_id IN (?)
    `, [ids]);

    const skillsMap = skillRows.reduce((acc, row) => {
      acc[row.student_id] = acc[row.student_id] || [];
      acc[row.student_id].push(row.skill);
      return acc;
    }, {});

    // 3) Fetch badges for those users
    const [badgeRows] = await pool.query(`
      SELECT 
        student_id,
        badge_name      AS name,
        DATE_FORMAT(awarded_at, '%Y-%m-%d') AS date
      FROM user_badges
      WHERE student_id IN (?)
    `, [ids]);

    const badgesMap = badgeRows.reduce((acc, row) => {
      acc[row.student_id] = acc[row.student_id] || [];
      acc[row.student_id].push({
        name: row.name,
        date: row.date
      });
      return acc;
    }, {});

    // 4) Assemble response
    const result = users.map(u => ({
      id: u.id,
      name: u.name,
      program: u.program,
      year: u.year,
      university: u.university,
      profileStrength: u.profileStrength,
      availability: u.availability,
      paymentPreference: u.paymentPreference,
      isVerified: !!u.isVerified,
      paymentVerified: !!u.paymentVerified,
      lastActive: u.lastActive,
      responseRate: u.responseRate,
      skills: skillsMap[u.id] || [],
      badges: badgesMap[u.id] || []
      // projects, endorsements, recommendedJobs omitted for now
    }));

    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function getNewStudents(req, res, next) {
  try {
    // 1) Fetch 3 most recently created users
    const [users] = await pool.query(`
      SELECT 
        id,
        name,
        program,
        year,
        university,
        profile_strength   AS profileStrength,
        availability,
        payment_pref       AS paymentPreference,
        is_verified        AS isVerified,
        payment_verified   AS paymentVerified,
        last_active        AS lastActive,
        response_rate      AS responseRate,
        created_at         AS createdAt
      FROM users
      ORDER BY created_at DESC
      LIMIT 3
    `);

    const ids = users.map(u => u.id);
    if (ids.length === 0) return res.json([]);

    // 2) Fetch skills via portfolios → portfolio_skills → skills
    const [skillRows] = await pool.query(`
      SELECT p.student_id, s.name AS skill
      FROM portfolios p
      JOIN portfolio_skills ps ON p.id = ps.portfolio_id
      JOIN skills s            ON ps.skill_id = s.id
      WHERE p.student_id IN (?)
    `, [ids]);

    const skillsMap = skillRows.reduce((acc, row) => {
      acc[row.student_id] = acc[row.student_id] || [];
      acc[row.student_id].push(row.skill);
      return acc;
    }, {});

    // 3) Fetch badges for those users
    const [badgeRows] = await pool.query(`
      SELECT 
        student_id,
        badge_name      AS name,
        DATE_FORMAT(awarded_at, '%Y-%m-%d') AS date
      FROM user_badges
      WHERE student_id IN (?)
    `, [ids]);

    const badgesMap = badgeRows.reduce((acc, row) => {
      acc[row.student_id] = acc[row.student_id] || [];
      acc[row.student_id].push({
        name: row.name,
        date: row.date
      });
      return acc;
    }, {});

    // 4) Assemble response
    const result = users.map(u => ({
      id: u.id,
      name: u.name,
      program: u.program,
      year: u.year,
      university: u.university,
      profileStrength: u.profileStrength,
      availability: u.availability,
      paymentPreference: u.paymentPreference,
      isVerified: !!u.isVerified,
      paymentVerified: !!u.paymentVerified,
      lastActive: u.lastActive,
      responseRate: u.responseRate,
      skills: skillsMap[u.id] || [],
      badges: badgesMap[u.id] || []
      // projects, endorsements, recommendedJobs omitted for now
    }));

    res.json(result);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getTopStudents,
  getNewStudents
};
