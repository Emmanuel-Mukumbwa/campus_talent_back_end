// File: src/controllers/adminVerification.controller.js

const db   = require('../config/database');
const path = require('path');

/**
 * Turn a stored disk path into a full URL under /uploads
 */
function buildFileUrl(req, storedPath) {
  if (!storedPath) return null;
  const segments = path.normalize(storedPath).split(path.sep);
  const idx = segments.lastIndexOf('uploads');
  if (idx < 0) return null;
  const relPath = segments.slice(idx).join('/'); 
  return `${req.protocol}://${req.get('host')}/${relPath}`;
}

/**
 * GET /api/admin/verifications
 * List all recruiter verification records (including per-file statuses)
 */
exports.listAll = async (req, res, next) => {
  try {
    const [rows] = await db.query(
      `SELECT rv.*,
              u.name AS recruiterName
         FROM recruiter_verifications rv
         JOIN users u ON u.id = rv.user_id
        ORDER BY
          (rv.verification_status = 'pending') DESC,
          rv.updated_at DESC`
    );

    const mapped = rows.map(r => ({
      id:                  r.id,
      userId:              r.user_id,
      recruiterName:       r.recruiterName,
      email_verified:      Boolean(r.email_verified),
      letterhead_path:     buildFileUrl(req, r.letterhead_path),
      tin_number:          buildFileUrl(req, r.tin_number),
      id_front_path:       buildFileUrl(req, r.id_front_path),
      id_back_path:        buildFileUrl(req, r.id_back_path),
      selfie_path:         buildFileUrl(req, r.selfie_path),
      domain:              r.domain,
      entity_type:         r.entity_type,
      verification_status: r.verification_status,
      updated_at:          r.updated_at,

      // per-file statuses
      letterhead_status:   r.letterhead_status,
      tin_status:          r.tin_status,
      id_front_status:     r.id_front_status,
      id_back_status:      r.id_back_status,
      selfie_status:       r.selfie_status,
    }));

    res.json(mapped);
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/admin/verifications/:id
 * Detail view of a specific recruiter verification
 */
exports.getDetail = async (req, res, next) => {
  const { id } = req.params;
  try {
    const [rows] = await db.query(
      `SELECT rv.*,
              u.name AS recruiterName
         FROM recruiter_verifications rv
         JOIN users u ON u.id = rv.user_id
        WHERE rv.id = ?`,
      [id]
    );
    if (!rows.length) {
      return res.status(404).json({ message: 'Not found' });
    }

    const r = rows[0];
    const detailed = {
      id:                  r.id,
      userId:              r.user_id,
      recruiterName:       r.recruiterName,
      email_verified:      Boolean(r.email_verified),
      letterhead_path:     buildFileUrl(req, r.letterhead_path),
      tin_number:          buildFileUrl(req, r.tin_number),
      id_front_path:       buildFileUrl(req, r.id_front_path),
      id_back_path:        buildFileUrl(req, r.id_back_path),
      selfie_path:         buildFileUrl(req, r.selfie_path),
      domain:              r.domain,
      entity_type:         r.entity_type,
      verification_status: r.verification_status,
      updated_at:          r.updated_at,

      // per-file statuses
      letterhead_status:   r.letterhead_status,
      tin_status:          r.tin_status,
      id_front_status:     r.id_front_status,
      id_back_status:      r.id_back_status,
      selfie_status:       r.selfie_status,
    };

    res.json(detailed);
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/admin/verifications/:id/update-status
 * Body: { status: 'pending'|'basic_verified'|'fully_verified'|'rejected' }
 */
exports.updateStatus = async (req, res, next) => {
  const { id } = req.params;
  const { status } = req.body;
  const valid = ['pending','basic_verified','fully_verified','rejected'];
  if (!valid.includes(status)) {
    return res.status(400).json({ message: 'Invalid status' });
  }

  try {
    await db.query(
      `UPDATE recruiter_verifications
          SET verification_status = ?,
              updated_at          = NOW()
        WHERE id = ?`,
      [status, id]
    );
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/admin/verifications/:id/file-status
 * Body: { fileKey: 'letterhead'|'tin'|'id_front'|'id_back'|'selfie', status: 'approved'|'rejected'|'pending' }
 */
exports.updateFileStatus = async (req, res, next) => {
  const { id }  = req.params;
  const { fileKey, status } = req.body;

  const validKeys = ['letterhead','tin','id_front','id_back','selfie'];
  // ← added 'pending' here:
  const validStatuses = ['approved','rejected','pending'];
  if (!validKeys.includes(fileKey) || !validStatuses.includes(status)) {
    return res.status(400).json({ message: 'Invalid fileKey or status' });
  }

  const statusCol = `${fileKey}_status`;

  try {
    await db.query( 
      `UPDATE recruiter_verifications
          SET ${statusCol} = ?,
              updated_at    = NOW()
        WHERE id = ?`,
      [status, id]
    );
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};
