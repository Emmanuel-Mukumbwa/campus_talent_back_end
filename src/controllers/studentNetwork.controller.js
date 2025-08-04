// File: controllers/studentNetwork.controller.js

const pool = require('../config/database');

exports.getNetwork = async (req, res, next) => {
  try {
    // 0) Who are we fetching?
    const viewerRole = req.user.role;           // from JWT
    const targetRole = viewerRole === 'student' ? 'recruiter' : 'student';

    // 1) Pagination & filters
    const page     = parseInt(req.query.page,     10) || 1;
    const pageSize = parseInt(req.query.pageSize, 10) || 4;
    const offset   = (page - 1) * pageSize;
    const { search, program, dateJoined, skills } = req.query;

    // 2) Build WHERE clause, excluding the current user
    const filters = [
      'role = ?',   // only the opposite role
      'id <> ?',    // exclude the viewer themself
    ];
    const params = [
      targetRole,
      req.user.id,
    ];

    if (search) {
      filters.push('name LIKE ?');
      params.push(`%${search}%`);
    }
    if (program) {
      filters.push('program = ?');
      params.push(program);
    }
    if (dateJoined) {
      filters.push('DATE(created_at) >= ?');
      params.push(dateJoined);
    }
    if (skills) {
      const list = skills
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);
      if (list.length) {
        filters.push(`EXISTS (
          SELECT 1
          FROM portfolios p
          JOIN portfolio_skills ps ON ps.portfolio_id = p.id
          JOIN skills s ON s.id = ps.skill_id
          WHERE p.student_id = users.id
            AND s.name IN (?))
        `);
        params.push(list);
      }
    }

    const whereSQL = filters.length ? 'WHERE ' + filters.join(' AND ') : '';

    // 3) Total count
    const countSQL = `
      SELECT COUNT(*) AS total
      FROM users
      ${whereSQL}
    `;
    const [[{ total }]] = await pool.query(countSQL, params);

    // 4) Fetch page of users
    const dataSQL = `
      SELECT
        id,
        role,
        name,
        program,                -- students only
        university,             -- students only
        university    AS location,
        year,                   -- students only
        avatar_url    AS avatar,
        profile_strength,       -- students only
        last_active,
        is_verified,
        company_name            -- recruiters only
      FROM users
      ${whereSQL}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `;
    const [users] = await pool.query(dataSQL, [...params, pageSize, offset]);

    if (!users.length) { 
      return res.json({
        totalCount: total,
        totalPages: 0,
        page,
        pageSize,
        data: []
      });
    }

    const ids = users.map(u => u.id);

    // 5a) Student-only: project counts
    let projMap = {};
    if (targetRole === 'student') {
      const [projRows] = await pool.query(`
        SELECT p.student_id, COUNT(pp.id) AS majorProjects
        FROM portfolios p
        JOIN portfolio_projects pp ON pp.portfolio_id = p.id
        WHERE p.student_id IN (?)
        GROUP BY p.student_id
      `, [ids]);
      projMap = Object.fromEntries(
        projRows.map(r => [r.student_id, r.majorProjects])
      );
    }

    // 5b) Student-only: skills overlap
    let skillsMap = {};
    if (targetRole === 'student') {
      const [skillRows] = await pool.query(`
        SELECT p.student_id, s.name AS skill
        FROM portfolios p
        JOIN portfolio_skills ps ON ps.portfolio_id = p.id
        JOIN skills s ON s.id = ps.skill_id
        WHERE p.student_id IN (?)
      `, [ids]);
      skillsMap = skillRows.reduce((acc, { student_id, skill }) => {
        acc[student_id] = acc[student_id] || [];
        acc[student_id].push(skill);
        return acc;
      }, {});
    }

    // 5c) Student-only: badges
    let badgesMap = {};
    if (targetRole === 'student') {
      const [badgeRows] = await pool.query(`
        SELECT student_id, badge_name AS badge
        FROM user_badges
        WHERE student_id IN (?)
      `, [ids]);
      badgesMap = badgeRows.reduce((acc, { student_id, badge }) => {
        acc[student_id] = acc[student_id] || [];
        acc[student_id].push(badge);
        return acc;
      }, {});
    }

    // 6) Recruiter-only: open gigs count
    let gigMap = {};
    if (targetRole === 'recruiter') {
      const [gigRows] = await pool.query(`
        SELECT recruiter_id, COUNT(*) AS openGigs
        FROM gigs
        WHERE recruiter_id IN (?) AND status = 'Open'
        GROUP BY recruiter_id
      `, [ids]);
      gigMap = Object.fromEntries(
        gigRows.map(r => [r.recruiter_id, r.openGigs])
      );
    }

    // 6b) Recruiter-only: aggregate required skills
let reqSkillsMap = {};
if (targetRole === 'recruiter') {
  const [skillReqRows] = await pool.query(`
    SELECT g.recruiter_id AS recruiter_id, s.name AS skill
    FROM gigs g
    JOIN gig_skills gs ON gs.gig_id = g.id
    JOIN skills s      ON s.id      = gs.skill_id
    WHERE g.recruiter_id IN (?)
      AND g.status = 'Open'
  `, [ids]);

  // build with a Set to automatically dedupe
  reqSkillsMap = skillReqRows.reduce((acc, { recruiter_id, skill }) => {
    if (!acc[recruiter_id]) acc[recruiter_id] = new Set();
    acc[recruiter_id].add(skill);
    return acc;
  }, {});

  // convert Sets back to arrays
  for (const id in reqSkillsMap) {
    reqSkillsMap[id] = Array.from(reqSkillsMap[id]);
  }
}


    // 7) Assemble response
    const data = users.map(u => {
      const base = {
        id:         u.id,
        role:       u.role,
        name:       u.name,
        avatar:     u.avatar,
        lastActive: u.last_active,
        isVerified: u.is_verified === 1,
      };

      if (targetRole === 'student') {
        return {
          ...base,
          program:         u.program,
          university:      u.university,
          location:        u.location,
          year:            u.year,
          profileStrength: u.profile_strength,
          majorProjects:   projMap[u.id]   || 0,
          skillsOverlap:   skillsMap[u.id] || [],
          badges:          badgesMap[u.id] || []
        };
      } else {
        return {
          ...base,
          company:       u.company_name || u.name,
          openGigs:      gigMap[u.id]    || 0,
          matchedSkills: reqSkillsMap[u.id] || []
        };
      }
    });

    // 8) Send paginated response
    res.json({
      totalCount: total,
      totalPages: Math.ceil(total / pageSize),
      page,
      pageSize,
      data
    });

  } catch (err) {
    console.error('[getNetwork] error:', err);
    next(err);
  }
};
