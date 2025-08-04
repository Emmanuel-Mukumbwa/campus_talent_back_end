// File: src/controllers/gigApplications.controller.js

const pool = require('../config/database');

/**
 * Safely parse a JSON string, falling back to []
 */
function safeParse(jsonStr) {
  try {
    return JSON.parse(jsonStr);
  } catch {
    return [];
  }
}

/**
 * GET /api/gig_applications?gig_id=123
 * Returns the single application (if any) for the current student & gig.
 */
exports.getByGig = async (req, res, next) => {
  try {
    const studentId = req.user.id;
    const gigId     = Number(req.query.gig_id);
    if (!gigId) {
      return res.status(400).json({ message: 'Missing gig_id' });
    }

    const [rows] = await pool.execute(
      `SELECT
         id,
         proposal_text,
         status,
         duration,
         deliverables,
         payment_amount
       FROM gig_applications
      WHERE student_id = ? AND gig_id = ?
      LIMIT 1`,
      [studentId, gigId]
    );

    if (!rows.length) {
      return res.status(404).json({ message: 'No application found' });
    }

    // send back the single application object
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/gig_applications
 * Query params:
 *   - gig_id (optional)
 *   - status (optional)
 *
 * Recruiters may omit gig_id to see all apps; students without a gig_id see only their own.
 */
exports.listApplications = async (req, res, next) => {
  try {
    const isRecruiter = req.user.role === 'recruiter';
    const studentId   = req.user.id;
    const { gig_id, status } = req.query;
    const params = [];

    let sql = `
      SELECT
        ga.id,
        ga.gig_id,
        ga.student_id,
        ga.status,
        ga.proposal_text,
        ga.duration,
        ga.deliverables,
        ga.attachments,
        ga.payment_amount,
        ga.applied_at,
        u.name   AS student_name,
        u.rating AS student_rating
      FROM gig_applications ga
      JOIN users u
        ON u.id = ga.student_id
       AND u.role = 'student'
    `;

    // Build WHERE clauses
    const where = [];
    if (gig_id) {
      where.push('ga.gig_id = ?');
      params.push(gig_id);
    } else if (!isRecruiter) {
      // students see only their own apps if they didn't specify a gig_id
      where.push('ga.student_id = ?');
      params.push(studentId);
    }
    if (status) {
      where.push('ga.status = ?');
      params.push(status);
    }
    if (where.length) {
      sql += ' WHERE ' + where.join(' AND ');
    }

    sql += ' ORDER BY ga.applied_at DESC';

    const [rows] = await pool.query(sql, params);

    const apps = rows.map(r => ({
      id:             r.id,
      gig_id:         r.gig_id,
      status:         r.status,
      proposal_text:  r.proposal_text,
      duration:       r.duration,
      deliverables:   safeParse(r.deliverables),
      attachments:    safeParse(r.attachments),
      payment_amount: r.payment_amount,
      applied_at:     r.applied_at,
      student: {
        id:     r.student_id,
        name:   r.student_name,
        rating: parseFloat(r.student_rating),
        skills: []  // optionally populate via extra join
      }
    }));

    res.json(apps);
  } catch (err) {
    next(err);
  }
};

/**
 * POST or PUT /api/gig_applications
 * Body:
 *   - id (optional, to update)
 *   - gig_id, proposal_text, duration, deliverables, status, payment_amount
 *   - files in req.files for attachments
 */
exports.createOrUpdateApplication = async (req, res, next) => {
  try {
    const studentId = req.user.id;
    const {
      id,
      gig_id,
      proposal_text,
      duration,
      deliverables,
      status = 'draft',
      payment_amount
    } = req.body;

    // Normalize payment_amount
    let paymentAmountVal =
      payment_amount == null || payment_amount === ''
        ? null
        : parseFloat(payment_amount);

    // Drop any NaN into SQL NULL
    if (Number.isNaN(paymentAmountVal)) {
      paymentAmountVal = null;
    }

    // Collect uploaded file URLs
    const attachments = (req.files || []).map(
      f => `/uploads/portfolios/${f.filename}`
    );
    const attachmentsVal = attachments.length ? JSON.stringify(attachments) : null;

    if (id) {
      // Update existing
      await pool.query(
        `UPDATE gig_applications
           SET proposal_text  = ?,
               duration       = ?,
               deliverables   = ?,
               status         = ?,
               payment_amount = ?,
               attachments    = ?
         WHERE id = ? AND student_id = ?`,
        [
          proposal_text,
          duration,
          deliverables,
          status,
          paymentAmountVal,
          attachmentsVal,
          id,
          studentId
        ]
      );
      return res.json({ id });
    }

    // Insert new
    const [result] = await pool.query(
      `INSERT INTO gig_applications
        (gig_id, student_id, proposal_text, duration, deliverables,
         status, payment_amount, attachments)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        gig_id,
        studentId,
        proposal_text,
        duration,
        deliverables,
        status,
        paymentAmountVal,
        attachmentsVal
      ]
    );

    res.status(201).json({ id: result.insertId });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/gig_applications/:id
 */
exports.getApplicationById = async (req, res, next) => {
  try {
    const studentId = req.user.id;
    const appId     = req.params.id;
    const [rows]    = await pool.query(
      `SELECT
         id,
         gig_id,
         student_id,
         status,
         applied_at,
         proposal_text,
         duration,
         deliverables,
         attachments,
         payment_amount,
         completed_at
       FROM gig_applications
      WHERE id = ? AND student_id = ?`,
      [appId, studentId]
    );

    if (!rows.length) {
      return res.status(404).json({ message: 'Application not found' });
    }

    const app = rows[0]; 
    app.attachments = app.attachments ? JSON.parse(app.attachments) : [];

    res.json(app);
  } catch (err) {
    next(err);
  }
};
