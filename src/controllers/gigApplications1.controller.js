// src/controllers/gigApplications1.controller.js

const pool = require('../config/database');

/**
 * Helper to parse JSON strings or fallback. If parsing fails on a string,
 * split on newlines into an array; otherwise return fallback.
 */
function safeParseJson(raw, fallback = []) {
  if (raw == null) return fallback;
  if (typeof raw === 'object') return raw;
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw);
    } catch {
      return raw
        .split('\n')
        .map(s => s.trim())
        .filter(Boolean);
    }
  }
  return fallback;
}

/**
 * GET /api/gig_applications1
 * List applications, filtered by status/gig and role.
 */
exports.listApplications = async (req, res, next) => {
  try {
    const userId   = req.user.id;
    const userRole = req.user.role;      // 'student' or 'recruiter'
    const { status, gig_id } = req.query;

    const whereClauses = [];
    const params       = [];

    if (status) {
      whereClauses.push('a.status = ?');
      params.push(status);
    }

    if (userRole === 'student') {
      whereClauses.push('a.student_id = ?');
      params.push(userId);
    } else {
      whereClauses.push('g.recruiter_id = ?');
      params.push(userId);
      if (gig_id) {
        whereClauses.push('a.gig_id = ?');
        params.push(gig_id);
      }
    }

    const whereSQL = whereClauses.length
      ? 'WHERE ' + whereClauses.join(' AND ')
      : '';

    const [rows] = await pool.query(
      `
      SELECT
        a.id,
        a.gig_id,
        a.student_id,
        a.status,
        a.applied_at,
        a.attachments         AS attachments_json,
        a.payment_amount,
        a.duration,
        a.deliverables        AS deliverables_json,
        a.completed_at,
        g.title               AS gig_title,
        g.expires_at          AS gig_deadline,
        g.payment_amount      AS gig_budget,
        r.name                AS recruiter_name,
        u.name                AS student_name,
        u.email               AS student_email,
        u.rating              AS student_rating,
        (
          SELECT JSON_ARRAYAGG(s.name)
          FROM portfolios p
          JOIN portfolio_skills ps ON ps.portfolio_id = p.id
          JOIN skills s          ON s.id = ps.skill_id
          WHERE p.student_id = a.student_id
            AND p.status = 'published'
        ) AS skills_json
      FROM gig_applications a
      JOIN gigs   g ON g.id = a.gig_id
      JOIN users  r ON r.id = g.recruiter_id
      JOIN users  u ON u.id = a.student_id
      ${whereSQL}
      ORDER BY a.applied_at DESC
      `,
      params
    );

    const apps = rows.map(r => ({
      id:             r.id,
      gig_id:         r.gig_id,
      student_id:     r.student_id,
      status:         r.status,
      applied_at:     r.applied_at,
      attachments:    safeParseJson(r.attachments_json),
      payment_amount: r.payment_amount,
      duration:       r.duration,
      deliverables:   safeParseJson(r.deliverables_json),
      completed_at:   r.completed_at,
      gig: {
        title:         r.gig_title,
        deadline:      r.gig_deadline,
        budget:        r.gig_budget,
        recruiterName: r.recruiter_name
      },
      student: {
        name:   r.student_name,
        email:  r.student_email,
        rating: r.student_rating,
        skills: safeParseJson(r.skills_json)
      }
    }));

    res.json(apps);
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/gig_applications1/:id
 * Fetch a single application by ID, enforcing access,
 * and include fee breakdown + latest escrow info.
 */
exports.getApplicationById = async (req, res, next) => {
  try {
    const userId   = req.user.id;
    const userRole = req.user.role;
    const appId    = req.params.id;

    let accessSQL     = '';
    const accessParams = [appId];

    if (userRole === 'student') {
      accessSQL = 'AND a.student_id = ?';
      accessParams.push(userId);
    } else {
      accessSQL = 'AND g.recruiter_id = ?';
      accessParams.push(userId);
    }

    const [rows] = await pool.query(
      `
      SELECT
        a.id,
        a.gig_id,
        a.student_id,
        a.status,
        a.applied_at,
        a.attachments         AS attachments_json,
        a.payment_amount,
        a.duration,
        a.deliverables        AS deliverables_json,
        a.completed_at,
        g.title               AS gig_title,
        g.expires_at          AS gig_deadline,
        g.payment_amount      AS gig_budget,
        u.name                AS student_name,
        u.email               AS student_email,
        u.rating              AS student_rating,
        -- count of student's completed gigs
        (
          SELECT COUNT(*)
          FROM gig_applications ga2
          WHERE ga2.student_id = a.student_id
            AND ga2.status = 'Completed'
        ) AS completed_gigs_count,
        -- latest escrow record for this gig
        (
          SELECT e.order_reference
          FROM escrows e
          WHERE e.gig_id = a.gig_id
          ORDER BY e.created_at DESC
          LIMIT 1
        ) AS escrow_tx_ref,
        (
          SELECT e.paid
          FROM escrows e
          WHERE e.gig_id = a.gig_id
          ORDER BY e.created_at DESC
          LIMIT 1
        ) AS escrow_paid,
        (
          SELECT e.paid_at
          FROM escrows e
          WHERE e.gig_id = a.gig_id
          ORDER BY e.created_at DESC
          LIMIT 1
        ) AS escrow_paid_at
      FROM gig_applications a
      JOIN gigs   g ON g.id = a.gig_id
      JOIN users  u ON u.id = a.student_id
      WHERE a.id = ?
        ${accessSQL}
      `,
      accessParams
    );

    if (!rows.length) {
      return res.status(404).json({ message: 'Application not found or access denied' });
    }

    const r = rows[0];

    // Determine fee tiers
    const completedCount       = r.completed_gigs_count;
    const isFirstGig           = completedCount <= 1;
    const isPowerUser          = completedCount >= 5;
    const recruiterFeePercent  = isFirstGig ? 0 : isPowerUser ? 8 : 10;
    const studentFeePercent    = isPowerUser ? 3 : 5;
    const grossAmount          = parseFloat(r.payment_amount);
    const recruiterFeeAmount   = +(grossAmount * recruiterFeePercent  / 100).toFixed(2);
    const studentFeeAmount     = +(grossAmount * studentFeePercent    / 100).toFixed(2);
    const netToStudent         = +(grossAmount - studentFeeAmount).toFixed(2);

    const app = {
      id:             r.id,
      gig_id:         r.gig_id,
      student_id:     r.student_id,
      status:         r.status,
      applied_at:     r.applied_at,
      attachments:    safeParseJson(r.attachments_json),
      payment_amount: grossAmount,
      duration:       r.duration,
      deliverables:   safeParseJson(r.deliverables_json),
      completed_at:   r.completed_at,
      gig: {
        title:    r.gig_title,
        deadline: r.gig_deadline,
        budget:   r.gig_budget
      },
      student: {
        name:   r.student_name,
        email:  r.student_email,
        rating: r.student_rating
      },
      fees: {
        completedCount,
        isFirstGig,
        isPowerUser,
        recruiterFeePercent,
        studentFeePercent,
        recruiterFeeAmount,
        studentFeeAmount,
        netToStudent
      },
      escrow: {
        tx_ref:   r.escrow_tx_ref,
        paid:     Boolean(r.escrow_paid),
        paid_at:  r.escrow_paid_at
      }
    };

    res.json(app);
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/gig_applications1/:id/status
 * Update application status (student drafts or recruiter decisions).
 */
exports.updateStatus = async (req, res, next) => {
  try {
    const userId   = req.user.id;
    const userRole = req.user.role;
    const appId    = req.params.id;
    const { status } = req.body;

    const studentAllowed   = userRole === 'student'   && status === 'draft';
    const recruiterAllowed = userRole === 'recruiter' &&
      ['Shortlisted','Accepted','Rejected','Completed'].includes(status);

    if (!studentAllowed && !recruiterAllowed) {
      return res.status(403).json({ message: 'Not allowed to set this status' });
    }

    let sql      = 'UPDATE gig_applications a ';
    const params = [status];

    if (userRole === 'recruiter') {
      sql += 'JOIN gigs g ON g.id = a.gig_id ';
    }

    sql += 'SET a.status = ? ';

    if (userRole === 'student') {
      sql += 'WHERE a.id = ? AND a.student_id = ?';
      params.push(appId, userId);
    } else {
      sql += 'WHERE a.id = ? AND g.recruiter_id = ?';
      params.push(appId, userId);
    }

    const [result] = await pool.query(sql, params);
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Application not found or access denied' });
    }

    res.json({ success: true, status });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/gig_applications1/:id
 * Students can delete their own applications.
 */
exports.deleteApplication = async (req, res, next) => {
  try {
    if (req.user.role !== 'student') {
      return res.status(403).json({ message: 'Only students can delete applications' });
    }

    const appId  = req.params.id;
    const userId = req.user.id;
    const [result] = await pool.query(
      'DELETE FROM gig_applications WHERE id = ? AND student_id = ?',
      [appId, userId]
    ); 

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Application not found or not yours' });
    }

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};
 