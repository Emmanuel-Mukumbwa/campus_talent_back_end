// File: src/controllers/deliverables.controller.js

const pool = require('../config/database');
const path = require('path');
const fs   = require('fs').promises;

/**
 * GET all submitted deliverables for an application
 */
async function listDeliverables(req, res, next) {
  const userId        = req.user?.id;
  const applicationId = parseInt(req.params.applicationId, 10);

  if (!userId) {
    return res.status(401).json({ message: 'Not authenticated' });
  }

  let conn;
  try {
    conn = await pool.getConnection();

    // Verify ownership: student or recruiter
    const [apps] = await conn.query(
      `SELECT a.student_id, g.recruiter_id
         FROM gig_applications a
         JOIN gigs g ON a.gig_id = g.id
        WHERE a.id = ?`,
      [applicationId]
    );

    if (
      !apps.length ||
      (apps[0].student_id !== userId && apps[0].recruiter_id !== userId)
    ) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    // Fetch deliverables
    const [dels] = await conn.query(
      `SELECT id, description, status, created_at
         FROM deliverables
        WHERE application_id = ?
        ORDER BY created_at DESC`,
      [applicationId]
    );

    // Fetch files for each deliverable
    for (let d of dels) {
      const [files] = await conn.query(
        `SELECT file_url FROM deliverable_files
           WHERE deliverable_id = ?`,
        [d.id]
      );
      d.files = files;
    }

    return res.json(dels);
  } catch (err) {
    next(err);
  } finally {
    if (conn) conn.release();
  }
}

/**
 * POST a new deliverable
 */
async function createDeliverable(req, res, next) {
  if (!req.user?.id) {
    return res.status(401).json({ message: 'Not authenticated' });
  }
  const studentId     = req.user.id;
  const applicationId = parseInt(req.params.applicationId, 10);
  const description   = req.body.description?.trim();
  const files         = req.files || [];

  if (!description) {
    return res.status(400).json({ message: 'Description is required' });
  }

  let conn;
  try {
    conn = await pool.getConnection();
    await conn.beginTransaction();

    // 1) Lock & check student ownership
    const [apps] = await conn.query(
      'SELECT student_id FROM gig_applications WHERE id = ? FOR UPDATE',
      [applicationId]
    );
    if (!apps.length || apps[0].student_id !== studentId) {
      await conn.rollback();
      return res.status(403).json({ message: 'Not authorized' });
    }

    // 2) Insert the deliverable row
    const [ins] = await conn.query(
      `INSERT INTO deliverables
         (application_id, description)
       VALUES (?, ?)`,
      [applicationId, description]
    );
    const deliverableId = ins.insertId;

    // 3) Prepare the final folder for this deliverable
    const finalDir = path.join(
      __dirname, '..', 'uploads', 'deliverables', String(deliverableId)
    );
    await fs.mkdir(finalDir, { recursive: true });

    // 4) Move each file from temp → finalDir, then insert its URL
    const fileRecords = [];
    for (const file of files) {
      const filename = path.basename(file.path);
      const oldPath  = file.path; // .../uploads/deliverables/temp/...
      const newPath  = path.join(finalDir, filename);
      await fs.rename(oldPath, newPath);

      // Build the public URL
      const publicUrl = `${req.protocol}://${req.get('host')}` +
        `/uploads/deliverables/${deliverableId}/${filename}`;

      await conn.query(
        `INSERT INTO deliverable_files
           (deliverable_id, file_url)
         VALUES (?, ?)`,
        [deliverableId, publicUrl]
      );
      fileRecords.push({ file_url: publicUrl });
    }

    await conn.commit();

    // 5) Return the new deliverable (with files)
    return res.status(201).json({
      id:         deliverableId,
      description,
      status:     'pending',
      created_at: new Date().toISOString(),
      files:      fileRecords
    });

  } catch (err) {
    if (conn) await conn.rollback();
    next(err);
  } finally {
    if (conn) conn.release();
  }
}

/**
 * PATCH a deliverable's status (approve/reject)
 */
async function updateDeliverableStatus(req, res, next) {
  const recruiterId   = req.user?.id;
  const applicationId = parseInt(req.params.applicationId, 10);
  const deliverableId = parseInt(req.params.deliverableId, 10);
  const { status }    = req.body; // expect 'approved' or 'rejected'

  if (!['approved','rejected'].includes(status)) {
    return res.status(400).json({ message: 'Invalid status' });
  }

  let conn;
  try {
    conn = await pool.getConnection();
    await conn.beginTransaction();

    // 1) Verify this recruiter actually owns the gig for this application
    const [rows] = await conn.query(
      `SELECT g.recruiter_id
         FROM gig_applications a
         JOIN gigs g ON a.gig_id = g.id
        WHERE a.id = ?
          FOR UPDATE`,
      [applicationId]
    );
    if (!rows.length || rows[0].recruiter_id !== recruiterId) {
      await conn.rollback();
      return res.status(403).json({ message: 'Not authorized' });
    }

    // 2) Update the deliverable's status
    const [upd] = await conn.query(
      `UPDATE deliverables
          SET status = ?
        WHERE id = ?
          AND application_id = ?`,
      [status, deliverableId, applicationId]
    );
    if (upd.affectedRows === 0) {
      await conn.rollback();
      return res.status(404).json({ message: 'Deliverable not found' });
    }

    // 3) Fetch and return the updated deliverable
    const [dels] = await conn.query(
      `SELECT id, description, status, created_at
         FROM deliverables
        WHERE id = ?`,
      [deliverableId]
    );
    const deliverable = dels[0];
    const [files] = await conn.query(
      `SELECT file_url FROM deliverable_files
         WHERE deliverable_id = ?`,
      [deliverableId]
    );
    deliverable.files = files;

    await conn.commit();
    return res.json(deliverable);

  } catch (err) {
    if (conn) await conn.rollback();
    next(err);
  } finally {
    if (conn) conn.release();
  }
}

module.exports = {
  listDeliverables,
  createDeliverable,
  updateDeliverableStatus
};
