// File: src/controllers/portfolioview.controller.js

const pool = require('../config/database');

exports.getPortfolioView = async (req, res, next) => {
  const studentId = parseInt(req.params.studentId, 10);
  const limit     = parseInt(req.query.limit, 10) || 6;
  const page      = parseInt(req.query.page, 10)  || 1;
  const offset    = (page - 1) * limit;

  // Helper: parse only valid JSON arrays (otherwise return [])
  const safeParse = (maybeJson) => {
    let parsed;
    if (typeof maybeJson === 'string') {
      try {
        parsed = JSON.parse(maybeJson);
      } catch (e) {
        console.warn('safeParse failed, returning [] for:', maybeJson, e);
        return [];
      }
    } else {
      parsed = maybeJson;
    }
    return Array.isArray(parsed) ? parsed : [];
  };

  try {
    // 1) Increment view count
    await pool.query(
      'UPDATE portfolios SET view_count = view_count + 1 WHERE student_id = ?',
      [studentId]
    );

    // 2) Fetch portfolio + user info
    const [rows] = await pool.query(
      `SELECT
         p.id,
         p.student_id,
         p.headline,
         p.about,
         p.proficiencies,
         p.status,
         p.view_count,
         p.created_at AS portfolio_created,
         u.name,
         u.avatar_url,
         u.university,
         u.program,
         u.faculty,
         u.year,
         u.availability,
         u.payment_pref,
         u.response_rate,
         u.last_active,
         u.rating,
         u.profile_strength
       FROM portfolios p
       JOIN users u
         ON u.id = p.student_id
       WHERE p.student_id = ?`,
      [studentId]
    );

    if (!rows.length) {
      return res
        .status(404)
        .json({ message: 'Portfolio not found or you’re not authorized.' });
    }

    const portfolio = rows[0];
    portfolio.proficiencies = safeParse(portfolio.proficiencies);

    // 3) Fetch associated skills *with* assessment data (last 6 months)
    const [skills] = await pool.query(
      `SELECT
         s.id,
         s.name,
         sa.level,
         sa.score_pct
       FROM portfolio_skills ps
       JOIN skills s
         ON s.id = ps.skill_id
       LEFT JOIN skill_assessments sa
         ON sa.student_id = ?
         AND sa.skill = s.name
         AND sa.taken_at >= NOW() - INTERVAL 6 MONTH
       WHERE ps.portfolio_id = ?`,
      [studentId, portfolio.id]
    );

    // 4) Total projects count for pagination
    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total
       FROM portfolio_projects
       WHERE portfolio_id = ?`,
      [portfolio.id]
    );

    // 5) Fetch one page of projects, featured first
    const [projects] = await pool.query(
      `SELECT
         id,
         title,
         description,
         role,
         skills_used,
         evidence_links,
         media,
         start_date,
         end_date,
         is_featured,
         created_at
       FROM portfolio_projects
       WHERE portfolio_id = ?
       ORDER BY is_featured DESC, created_at DESC
       LIMIT ? OFFSET ?`,
      [portfolio.id, limit, offset]
    );

    // Parse JSON fields into arrays
    projects.forEach(p => {
      p.skills_used    = safeParse(p.skills_used);
      p.evidence_links = safeParse(p.evidence_links);
      p.media          = safeParse(p.media);
    });

    // 6) Count completed gigs *in last 6 months*
    const [[{ completedGigsCount }]] = await pool.query(
      `SELECT COUNT(*) AS completedGigsCount
       FROM gig_applications
       WHERE student_id = ?
         AND status = 'Completed'
         AND completed_at >= NOW() - INTERVAL 6 MONTH`,
      [studentId]
    );

    // 7) Assemble and send response
    return res.json({
      portfolio: {
        ...portfolio,
        skills,               
        completedGigsCount,   
        projects: {
          data: projects,
          pagination: {
            page,
            limit,
            totalPages: Math.ceil(total / limit),
            totalItems: total
          }
        }
      }
    });
  } catch (err) {
    next(err);
  }
};
