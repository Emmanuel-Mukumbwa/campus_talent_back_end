// src/controllers/portfolio.controller.js

const pool = require('../config/database');

/**
 * Helper: safely parse a JSON field, fallback to []
 */
function parseJsonField(field) {
  if (!field) return [];
  if (typeof field !== 'string') {
    return Array.isArray(field) ? field : [];
  }
  try {
    const parsed = JSON.parse(field);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * GET /api/portfolio
 */
exports.getPortfolio = async (req, res, next) => {
  const studentId = req.user.id;
  let conn;

  try {
    conn = await pool.getConnection();

    // 1) fetch portfolio row
    const [rows] = await conn.query(
      `SELECT id, about, proficiencies, status
         FROM portfolios
        WHERE student_id = ?`,
      [studentId]
    );
    if (!rows.length) {
      return res.status(404).json({ message: 'No portfolio found' });
    }
    const portfolio = rows[0];

    // 2) fetch skills
    const [skillRows] = await conn.query(
      `SELECT s.name
         FROM portfolio_skills ps
         JOIN skills s ON ps.skill_id = s.id
        WHERE ps.portfolio_id = ?`,
      [portfolio.id]
    );
    const skills = skillRows.map(r => r.name);

    // 3) fetch projects
    const [projRows] = await conn.query(
      `SELECT title, description, evidence_links, skills_used, media
         FROM portfolio_projects
        WHERE portfolio_id = ?
        ORDER BY id`,
      [portfolio.id]
    );
    const projects = projRows.map(p => ({
      title: p.title,
      description: p.description,
      evidence: parseJsonField(p.evidence_links),
      skillsUsed: parseJsonField(p.skills_used),
      media: parseJsonField(p.media)
    }));

    // 4) respond
    res.json({
      about: portfolio.about,
      skills,
      proficiencies:
        typeof portfolio.proficiencies === 'string'
          ? JSON.parse(portfolio.proficiencies)
          : portfolio.proficiencies || {},
      projects,
      status: portfolio.status
    });
  } catch (err) {
    next(err);
  } finally {
    if (conn) conn.release();
  }
};

/**
 * POST /api/portfolio
 * upsert the main portfolio data (about, skills, proficiencies, projects, status)
 */
exports.upsertPortfolio = async (req, res, next) => {
  const studentId    = req.user.id;
  const {
    about,
    skills = [],
    proficiencies = {},
    // projects may be undefined, null, empty array
    projects,
    status
  } = req.body;
  let conn, portfolioId;

  console.log(`[portfolio.controller] upsertPortfolio called with status=${status}`);

  try {
    conn = await pool.getConnection();
    await conn.beginTransaction();

    // 1) Upsert main portfolio row
    await conn.query(
      `INSERT INTO portfolios (student_id, about, proficiencies, status)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         about         = VALUES(about),
         proficiencies = VALUES(proficiencies),
         status        = VALUES(status)`,
      [ studentId, about, JSON.stringify(proficiencies), status ]
    );

    // 2) Grab the portfolio PK
    const [[{ id }]] = await conn.query(
      `SELECT id FROM portfolios WHERE student_id = ?`,
      [studentId]
    );
    portfolioId = id;

    // 3) FORCE the status by PK
    await conn.query(
      `UPDATE portfolios
          SET status = ?
        WHERE id = ?`,
      [status, portfolioId]
    );
    console.log(
      `[portfolio.controller] Forced status update to ${status} for portfolio id=${portfolioId}`
    );

    // 4) Sync skills
    await conn.query(`DELETE FROM portfolio_skills WHERE portfolio_id = ?`, [portfolioId]);
    if (skills.length) {
      const [skillRows] = await conn.query(
        `SELECT id, name FROM skills WHERE name IN (?)`,
        [skills]
      );
      const nameToId = Object.fromEntries(skillRows.map(r => [r.name, r.id]));
      const inserts = skills
        .filter(name => nameToId[name])
        .map(name => [portfolioId, nameToId[name]]);
      if (inserts.length) {
        await conn.query(
          `INSERT INTO portfolio_skills (portfolio_id, skill_id) VALUES ?`,
          [inserts]
        );
      }
    }

    // 5) **ONLY sync projects if req.body.projects is a non-empty array**
    if (Array.isArray(projects) && projects.length > 0) {
      // remove old ones
      await conn.query(`DELETE FROM portfolio_projects WHERE portfolio_id = ?`, [portfolioId]);
      // re-insert each project
      for (const p of projects) {
        await conn.query(
          `INSERT INTO portfolio_projects
             (portfolio_id, title, description, evidence_links, skills_used, media)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            portfolioId,
            p.title,
            p.description,
            JSON.stringify(Array.isArray(p.evidence) ? p.evidence : []),
            JSON.stringify(Array.isArray(p.skillsUsed) ? p.skillsUsed : []),
            JSON.stringify(Array.isArray(p.media) ? p.media : [])
          ]
        );
      }
      console.log(
        `[portfolio.controller] Synced ${projects.length} project(s) for portfolio id=${portfolioId}`
      );
    } else {
      console.log(
        `[portfolio.controller] No projects in payload; skipping project sync`
      );
    }

    await conn.commit();

    // 6) Return confirmed status
    res.json({ message: 'Portfolio saved', status });
  } catch (err) {
    if (conn) await conn.rollback();
    next(err);
  } finally {
    if (conn) conn.release();
  }
};

/**
 * POST /api/portfolio/attachments
 * upload media files for a project; does NOT change status
 */
exports.uploadPortfolioAttachments = async (req, res, next) => {
  try {
    const studentId = req.user.id;
    const conn      = await pool.getConnection();

    // ensure portfolio row exists, but do NOT update status
    const [rows] = await conn.query(
      `SELECT id FROM portfolios WHERE student_id = ?`,
      [studentId]
    );
    let portfolioId;
    if (rows.length) {
      portfolioId = rows[0].id;
    } else {
      const [result] = await conn.query(
        `INSERT INTO portfolios (student_id) VALUES (?)`,
        [studentId]
      );
      portfolioId = result.insertId;
    }
    conn.release();

    // map file URLs 
    const fileUrls = req.files.map(
      f => `/uploads/portfolios/${f.filename}`
    );

    res.json({ portfolioId, attachments: fileUrls });
  } catch (err) {
    next(err);
  }
};
  