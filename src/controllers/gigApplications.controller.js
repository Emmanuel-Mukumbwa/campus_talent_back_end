// File: src/controllers/gigApplications.controller.js

const pool = require('../config/database');

/**
 * Safely parse JSON (string or object) into an object or array.
 * @param {string|object} raw     The incoming value.
 * @param {object|array}  fallback What to return if parsing fails.
 */
function safeParse(raw, fallback = {}) {
  if (typeof raw === 'object') {
    return raw;
  }
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

/**
 * GET /api/gig_applications/reviewed
 * Returns all non‑draft applications for the current student,
 * with `duration`, `deliverables`, `requirements` & `attachments` parsed.
 */
exports.getReviewedApplicationsForStudent = async (req, res, next) => {
  try {
    const studentId = req.user.id;
    const [rows] = await pool.execute(
      `
      SELECT
        id,
        gig_id,
        status,
        applied_at,
        duration,
        deliverables,
        requirements,
        attachments
      FROM gig_applications
      WHERE student_id = ? AND status != 'draft'
      ORDER BY applied_at DESC
      `,
      [studentId]
    );

    const apps = rows.map(row => ({
      id:            row.id,
      gig_id:        row.gig_id,
      status:        row.status,
      applied_at:    row.applied_at,
      duration:      row.duration,
      deliverables:  row.deliverables,
      requirements:  safeParse(row.requirements, {}),
      attachments:   safeParse(row.attachments, []),
    }));

    return res.json(apps);
  } catch (err) {
    next(err);
  }
};

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
      `
      SELECT *
      FROM gig_applications
      WHERE student_id = ? AND gig_id = ?
      LIMIT 1
      `,
      [studentId, gigId]
    );

    if (!rows.length) {
      return res.status(404).json({ message: 'No application found' });
    }

    const app = rows[0];
    app.requirements = safeParse(app.requirements, {});
    app.attachments  = safeParse(app.attachments, []);

    return res.json({
      id:             app.id,
      gig_id:         app.gig_id,
      status:         app.status,
      duration:       app.duration,
      deliverables:   app.deliverables,
      payment_amount: app.payment_amount,
      requirements:   app.requirements,
      attachments:    app.attachments,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/gig_applications
 * List all applications (filtered by gig_id, status, and role).
 */
exports.listApplications = async (req, res, next) => {
  try {
    const isRecruiter = req.user.role === 'recruiter';
    const studentId   = req.user.id;
    const { gig_id, status } = req.query;
    const params = [];

    let sql = `
      SELECT
        ga.*,
        u.name   AS student_name,
        u.rating AS student_rating
      FROM gig_applications ga
      JOIN users u
        ON u.id = ga.student_id
       AND u.role = 'student'
    `;

    const where = [];
    if (gig_id) {
      where.push('ga.gig_id = ?');
      params.push(gig_id);
    } else if (!isRecruiter) {
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
      duration:       r.duration,
      deliverables:   r.deliverables,
      requirements:   safeParse(r.requirements, {}),
      attachments:    safeParse(r.attachments, []),
      payment_amount: r.payment_amount,
      applied_at:     r.applied_at,
      student: {
        id:     r.student_id,
        name:   r.student_name,
        rating: parseFloat(r.student_rating),
      },
    }));

    return res.json(apps);
  } catch (err) {
    next(err);
  }
};

/**
 * POST or PUT /api/gig_applications
 * Create or update an application.
 * Body:
 *   - id (optional)
 *   - gig_id, status, payment_amount, duration, deliverables
 *   - requirements (JSON)
 *   - files in req.files for attachments 
 */

exports.createOrUpdateApplication = async (req, res, next) => {
  try {
    console.log('Multer parsed these file fields:', Object.keys(req.files), req.files);
    const studentId = req.user.id;
    const {
      id,
      gig_id,
      status = 'draft',
      payment_amount,
      duration,
      deliverables,
      requirements: rawReqs
    } = req.body;

    // 1) Parse incoming requirements JSON
    const reqsParsed = safeParse(rawReqs, {});
    if (typeof reqsParsed !== 'object' || Array.isArray(reqsParsed)) {
      return res.status(400).json({ message: 'Invalid requirements JSON' });
    }

    // 2) Build URL arrays for any uploaded files
    //    multer.fields(...) in your routes put files here:
    //    req.files.attachments[], req.files.resume_upload[], req.files.code_sample[]
    const files = req.files || {};

    const makeUrls = fieldName =>
      (files[fieldName] || []).map(f => `/uploads/applications/${f.filename}`);

    const attachmentsUrls = makeUrls('attachments');
    const resumeUrls      = makeUrls('resume_upload');
    const codeUrls        = makeUrls('code_sample');

    // 3) Merge file URLs into the requirements object
    const finalReqs = { ...reqsParsed };
    if (resumeUrls.length) finalReqs.resume_upload = resumeUrls;
    if (codeUrls.length)   finalReqs.code_sample   = codeUrls;

    // 4) Normalize payment amount
    let paymentAmountVal =
      payment_amount == null || payment_amount === ''
        ? null
        : parseFloat(payment_amount);
    if (Number.isNaN(paymentAmountVal)) paymentAmountVal = null;

    // 5) If updating an existing draft, merge with existing DB values
    if (id) {
      // Fetch old row to preserve fields not resubmitted
      const [[oldRow]] = await pool.query(
        `SELECT attachments, requirements
           FROM gig_applications
          WHERE id = ? AND student_id = ?`,
        [id, studentId]
      );
      if (!oldRow) {
        return res.status(404).json({ message: 'Application not found' });
      }

      // Merge requirements
      const existingReqs = safeParse(oldRow.requirements, {});
      const mergedReqs   = { ...existingReqs, ...finalReqs };

      // Determine attachments JSON: only overwrite if new
      const attachmentsVal =
        attachmentsUrls.length
          ? JSON.stringify(attachmentsUrls)
          : oldRow.attachments;

      await pool.query(
        `UPDATE gig_applications
            SET status       = ?,
                payment_amount = ?,
                duration     = ?,
                deliverables = ?,
                attachments  = ?,
                requirements = ?
          WHERE id = ? AND student_id = ?`,
        [
          status,
          paymentAmountVal,
          duration,
          deliverables,
          attachmentsVal,
          JSON.stringify(mergedReqs),
          id,
          studentId
        ]
      );

      return res.json({ id });
    }

    // 6) Insert new application
    const attachmentsVal = attachmentsUrls.length
      ? JSON.stringify(attachmentsUrls)
      : null;

    const [ins] = await pool.query(
      `INSERT INTO gig_applications
         (gig_id, student_id, status, payment_amount, duration, deliverables, attachments, requirements)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        gig_id,
        studentId,
        status,
        paymentAmountVal,
        duration,
        deliverables,
        attachmentsVal,
        JSON.stringify(finalReqs)
      ]
    );

    return res.status(201).json({ id: ins.insertId });
  } catch (err) {
    next(err);
  }
};
/**
 * GET /api/gig_applications/:id
 * Fetch one application by its ID.
 *   - Students can only fetch their own.
 *   - Recruiters can fetch if they own the gig.
 */
exports.getApplicationById = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const role   = req.user.role;      // 'student' or 'recruiter'
    const appId  = Number(req.params.id);

    let rows;
    if (role === 'student') {
      [rows] = await pool.query(
        `SELECT * FROM gig_applications
           WHERE id = ? AND student_id = ?`,
        [appId, userId]
      );
    } else if (role === 'recruiter') {
      [rows] = await pool.query(
        `SELECT ga.*
           FROM gig_applications ga
           JOIN gigs g
             ON ga.gig_id = g.id
          WHERE ga.id = ?
            AND g.recruiter_id = ?`,
        [appId, userId]
      );
    } else {
      return res.status(403).json({ message: 'Not authorized' });
    }

    if (!rows.length) {
      return res.status(404).json({ message: 'Application not found' });
    }

    const app = rows[0];
    app.requirements = safeParse(app.requirements, {});
    app.attachments  = safeParse(app.attachments, []);

    return res.json({
      id:             app.id,
      gig_id:         app.gig_id,
      status:         app.status,
      duration:       app.duration,
      deliverables:   app.deliverables,
      payment_amount: app.payment_amount,
      requirements:   app.requirements,
      attachments:    app.attachments,
    });
  } catch (err) {
    next(err);
  }
};
