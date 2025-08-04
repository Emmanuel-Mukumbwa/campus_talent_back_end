// File: src/controllers/gigs1.controller.js

// File: src/controllers/gigs1.controller.js

const pool = require('../config/database');

/**
 * GET /gigs1
 * Supports pagination & filtering:
 *  - page (default 1), pageSize (default 10)
 *  - search (title/description LIKE)
 *  - gig_type, budget_type, status, location
 *  - skill_ids (comma-separated list of skill IDs)
 *  - deadline (expires_at >= date)
 *
 * Students only see Open gigs matching:
 *   • gig_skills.skill_id IN (student’s portfolio skills OR explicit skill_ids)
 *   • AND their assessed level ≥ gig_skills.proficiency
 *
 * Recruiters see their own Open & Draft gigs (no proficiency check).
 */
exports.listGigs = async (req, res, next) => {
  try {
    // 1. Parse pagination & filters
    const {
      page      = 1,
      pageSize  = 10,
      search,
      gig_type,
      budget_type,
      status,
      location,
      skill_ids,
      deadline
    } = req.query;

    const offset       = (page - 1) * pageSize;
    const params       = [];
    const whereClauses = [];
    const isRecruiter  = req.user.role === 'recruiter';

    // ── Student: load portfolio skill IDs ───────────────────────────────
    let studentSkillIds = [];
    if (!isRecruiter) {
      const [[portfolioRow]] = await pool.query(
        `SELECT id FROM portfolios WHERE student_id = ? LIMIT 1`,
        [req.user.id]
      );
      if (portfolioRow?.id) {
        const [skillRows] = await pool.query(
          `SELECT skill_id FROM portfolio_skills WHERE portfolio_id = ?`,
          [portfolioRow.id]
        );
        studentSkillIds = skillRows.map(r => r.skill_id);
      }
      // no skills → immediate empty
      if (studentSkillIds.length === 0) {
        return res.json({ page: +page, pageSize: +pageSize, total: 0, gigs: [] });
      }
    }
    // ────────────────────────────────────────────────────────────────────

    // 2. Base visibility
    if (isRecruiter) {
      whereClauses.push('g.recruiter_id = ?');
      params.push(req.user.id);
      whereClauses.push("g.status IN ('Open','Draft')");
    } else {
      whereClauses.push("g.status = 'Open'");
    }

    // 3. Text search
    if (search) {
      whereClauses.push('(g.title LIKE ? OR g.description LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }

    // 4. Enum filters & location
    ['gig_type','budget_type','status'].forEach(f => {
      if (req.query[f]) {
        whereClauses.push(`g.${f} = ?`);
        params.push(req.query[f]);
      }
    });
    if (location) {
      whereClauses.push('g.location LIKE ?');
      params.push(`%${location}%`);
    }

    // 5. Deadline filter
    if (deadline) {
      whereClauses.push('g.expires_at >= ?');
      params.push(deadline);
    }

    // 6. Build base FROM
    let baseSQL = `
      SELECT SQL_CALC_FOUND_ROWS
        g.id, g.recruiter_id, g.title, g.description,
        g.gig_type, g.budget_type, g.location,
        g.payment_amount, g.payment_method, g.duration,
        g.deliverables, g.expires_at, g.status, g.created_at
      FROM gigs g
    `;

    // 7. Skill + proficiency filtering
    const skillFilters = [];
    if (skill_ids) {
      skillFilters.push(
        ...skill_ids
          .split(',')
          .map(id => parseInt(id,10))
          .filter(Boolean)
      );
    }
    if (!isRecruiter) {
      skillFilters.push(...studentSkillIds);
    }

    if (skillFilters.length) {
      const unique = Array.from(new Set(skillFilters));

      // join gig_skills
      baseSQL += ` JOIN gig_skills gs ON gs.gig_id = g.id`;

      if (!isRecruiter) {
        // also join assessments to enforce student’s level >= required
        baseSQL += `
          JOIN skill_assessments sa
            ON sa.student_id = ?
           AND sa.skill = (
                SELECT name FROM skills WHERE id = gs.skill_id
              )
           AND FIELD(sa.level,'Beginner','Intermediate','Expert')
             >= FIELD(gs.proficiency,'Beginner','Intermediate','Expert')
        `;
        params.unshift(req.user.id);
      }

      // restrict to those skill IDs
      whereClauses.push(`gs.skill_id IN (${unique.map(()=>'?').join(',')})`);
      params.push(...unique);
    }

    // 8. Assemble full SQL
    const whereSQL = whereClauses.length
      ? `WHERE ${whereClauses.join(' AND ')}`
      : '';
    const paginatedSQL = `
      ${baseSQL}
      ${whereSQL}
      ORDER BY g.created_at DESC
      LIMIT ${+pageSize} OFFSET ${offset}
    `;

    // 9. Execute + total count
    const [gigs] = await pool.execute(paginatedSQL, params);
    const [[{ 'FOUND_ROWS()': totalCount }]] = await pool.query(
      'SELECT FOUND_ROWS()'
    );

    // 10. Recruiter: applicant counts
    let applicantCounts = {};
    if (isRecruiter && gigs.length) {
      const gigIds        = gigs.map(g => g.id);
      const placeholders  = gigIds.map(() => '?').join(',');
      const [counts] = await pool.execute(
        `SELECT gig_id, COUNT(*) AS cnt
           FROM gig_applications
          WHERE gig_id IN (${placeholders})
          GROUP BY gig_id`,
        gigIds
      );
      applicantCounts = counts.reduce((m,r) => {
        m[r.gig_id] = r.cnt; return m;
      }, {});
    }

    // 11. Fetch all skills for these gigs
    const gigIds = gigs.map(g => g.id);
    let skillsByGig = {};
    if (gigIds.length) {
      const placeholders = gigIds.map(() => '?').join(',');
      const [links] = await pool.execute(
        `
          SELECT
            gs.gig_id,
            s.id         AS skill_id,
            s.category   AS skill
          FROM gig_skills gs
          JOIN skills s ON s.id = gs.skill_id
          WHERE gs.gig_id IN (${placeholders})
        `,
        gigIds
      );
      skillsByGig = links.reduce((acc,r) => {
        (acc[r.gig_id] = acc[r.gig_id]||[]).push({
          skill_id: r.skill_id,
          skill:    r.skill
        });
        return acc;
      }, {});
    }

    // 12. Hydrate each gig object
    let data = gigs.map(g => ({
      ...g,
      skills:     skillsByGig[g.id] || [],
      applicants: applicantCounts[g.id] || 0
    }));

    // 13. Students: attach application info
    if (!isRecruiter && gigIds.length) {
      const placeholders = gigIds.map(() => '?').join(',');
      const [apps] = await pool.execute(
        `SELECT
           id            AS applicationId,
           gig_id,
           status        AS applicationStatus
         FROM gig_applications
        WHERE student_id = ? AND gig_id IN (${placeholders})`,
        [req.user.id, ...gigIds]
      );
      const appMap = apps.reduce((m,a) => { m[a.gig_id]=a; return m; }, {});
      data = data.map(g => {
        const a = appMap[g.id];
        return {
          ...g,
          isApplied:         Boolean(a),
          applicationId:     a?.applicationId ?? null,
          applicationStatus: a?.applicationStatus ?? null
        };
      });
    } else {
      data = data.map(g => ({
        ...g,
        isApplied: false,
        applicationId: null,
        applicationStatus: null
      }));
    }

    // 14. Return paginated payload
    return res.json({
      page:     +page,
      pageSize: +pageSize,
      total:    totalCount,
      gigs:     data
    });

  } catch (err) {
    next(err);
  }
};

/**
 * GET /gigs1/:id
 * (unchanged)
 */
exports.getGigById = async (req, res, next) => {
  const gigId = Number(req.params.id);
  try {
    const [rows] = await pool.execute(
      `SELECT * FROM gigs WHERE id = ? AND status = 'Open'`,
      [gigId]
    );
    if (!rows.length) {
      return res.status(404).json({ message: 'Gig not found or not open' });
    }
    const gig = rows[0];

    // fetch skills
    const [links] = await pool.execute(
      `
        SELECT
          s.id   AS skill_id,
          s.category AS skill
        FROM gig_skills gs
        JOIN skills s ON s.id = gs.skill_id
        WHERE gs.gig_id = ?
      `,
      [gigId]
    );
    gig.skills = links;

    // student application state
    if (req.user.role !== 'recruiter') {
      const [appRows] = await pool.execute(
        `SELECT id AS applicationId, status AS applicationStatus
           FROM gig_applications
          WHERE student_id = ? AND gig_id = ?
          LIMIT 1`,
        [req.user.id, gigId]
      );
      if (appRows.length) {
        gig.isApplied         = true;
        gig.applicationId     = appRows[0].applicationId;
        gig.applicationStatus = appRows[0].applicationStatus;
      } else {
        gig.isApplied         = false;
        gig.applicationId     = null;
        gig.applicationStatus = null;
      }
    } else {
      gig.isApplied         = false;
      gig.applicationId     = null;
      gig.applicationStatus = null;
    }

    return res.json(gig);
  } catch (err) {
    next(err);
  }
};


/**
 * POST /gigs1
 * (Recruiter only)
 */
exports.createGig = async (req, res, next) => {
  const recruiterId = req.user.id;
  const {
    title,
    description,
    gig_type,
    budget_type,
    payment_amount    = null,
    payment_method    = null,
    bank_account_number = null,
    bank_name         = null,
    duration,
    deliverables,
    contact_info,
    expires_at        = null,
    location          = null,
    status            = 'Draft',
    skills            = []
  } = req.body;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Insert gig
    const [result] = await conn.execute(
      `
        INSERT INTO gigs (
          recruiter_id, title, description, gig_type, budget_type,
          payment_amount, payment_method, bank_account_number, bank_name,
          duration, deliverables, contact_info, expires_at, location, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        recruiterId,
        title,
        description,
        gig_type,
        budget_type,
        payment_amount,
        payment_method,
        bank_account_number,
        bank_name,
        duration,
        deliverables,
        contact_info,
        expires_at,
        location,
        status
      ]
    );
    const newId = result.insertId;

    // Link skills
    if (skills.length) {
      const vals = skills.map(sid => `(${newId},${sid})`).join(',');
      await conn.query(
        `INSERT INTO gig_skills (gig_id, skill_id) VALUES ${vals}`
      );
    }

    await conn.commit();
    res.status(201).json({ message: 'Gig created', gigId: newId });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
};

/**
 * PUT /gigs1/:id
 * (Recruiter only)
 */
exports.updateGig = async (req, res, next) => {
  const recruiterId = req.user.id;
  const gigId        = Number(req.params.id);
  const {
    title,
    description,
    gig_type,
    budget_type,
    payment_amount    = null,
    payment_method    = null,
    bank_account_number = null,
    bank_name         = null,
    duration,
    deliverables,
    contact_info,
    expires_at        = null,
    location          = null,
    status,
    skills            = []
  } = req.body;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Update base gig
    const [result] = await conn.execute(
      `
        UPDATE gigs SET
          title               = ?,
          description         = ?,
          gig_type            = ?,
          budget_type         = ?,
          payment_amount      = ?,
          payment_method      = ?,
          bank_account_number = ?,
          bank_name           = ?,
          duration            = ?,
          deliverables        = ?,
          contact_info        = ?,
          expires_at          = ?,
          location            = ?,
          status              = ?
        WHERE id = ? AND recruiter_id = ?
      `,
      [
        title,
        description,
        gig_type,
        budget_type,
        payment_amount,
        payment_method,
        bank_account_number,
        bank_name,
        duration,
        deliverables,
        contact_info,
        expires_at,
        location,
        status,
        gigId,
        recruiterId
      ]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Not found or unauthorized' });
    }

    // Re‑link skills
    await conn.execute(`DELETE FROM gig_skills WHERE gig_id = ?`, [gigId]);
    if (skills.length) {
      const [skillRows] = await conn.query(
        `SELECT id FROM skills WHERE category IN (?)`,
        [skills]
      );
      if (skillRows.length) {
        const vals = skillRows.map(r => `(${gigId}, ${r.id})`).join(',');
        await conn.query(
          `INSERT INTO gig_skills (gig_id, skill_id) VALUES ${vals}`
        );
      }
    }

    await conn.commit();
    res.json({ message: 'Gig updated' });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
};

/**
 * DELETE /gigs1/:id
 * Soft‑close (Recruiter only)
 */
exports.deleteGig = async (req, res, next) => {
  const recruiterId = req.user.id;
  const gigId        = Number(req.params.id);

  try {
    const [result] = await pool.execute(
      `
        UPDATE gigs
        SET status = 'Closed' 
        WHERE id = ? AND recruiter_id = ?
      `,
      [gigId, recruiterId]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Not found or unauthorized' });
    }
    res.json({ message: 'Gig closed' });
  } catch (err) { 
    next(err);
  }
};
