// File: src/controllers/recruiterVerification.controller.js

const db         = require('../config/database');
const nodemailer = require('nodemailer');
const { randomInt } = require('crypto');
const multer     = require('multer');
const path       = require('path');
const fs   = require('fs'); 

// ————————————————————————————————————————————————
// SMTP transporter (unchanged)
const transporter = nodemailer.createTransport({ 
  host:   process.env.SMTP_HOST,
  port:   Number(process.env.SMTP_PORT) || 587, 
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS 
  }
});
// ————————————————————————————————————————————————

// POST /api/recruiters/verify/basic/send
exports.sendBasicOTP = async (req, res, next) => {
  const userId = req.user.id;
  const { email } = req.body;
  const code    = String(randomInt(0, 1e6)).padStart(6, '0');
  const expires = new Date(Date.now() + 15 * 60 * 1000); // +15m

  let conn;
  try {
    conn = await db.getConnection();
    await conn.query(
      `INSERT INTO recruiter_verifications (user_id, email_verified, verification_status)
         VALUES (?, 0, 'pending')
       ON DUPLICATE KEY UPDATE user_id = user_id`,
      [userId]
    );
    await conn.query(
      `UPDATE recruiter_verifications
          SET email_otp         = ?,
              email_otp_expires = ?,
              verification_status = 'pending'
        WHERE user_id = ?`,
      [code, expires, userId]
    );
    await transporter.sendMail({
      from: `"CampusTalent" <${process.env.SMTP_FROM}>`,
      to: email,
      subject: 'Your CampusTalent verification code',
      text: `Your verification code is: ${code}\nCode expires in 15 minutes.`
    });
    return res.json({ success: true, message: 'OTP sent to your email.' });
  } catch (err) {
    return next(err);
  } finally {
    conn?.release();
  }
};

// POST /api/recruiters/verify/basic/confirm
exports.confirmBasicOTP = async (req, res, next) => {
  const userId = req.user.id;
  const { code } = req.body;
  let conn;
  try {
    conn = await db.getConnection();
    const [[row]] = await conn.query(
      `SELECT email_otp, email_otp_expires
         FROM recruiter_verifications
        WHERE user_id = ?`,
      [userId]
    );
    if (
      !row ||
      row.email_otp !== code ||
      new Date() > new Date(row.email_otp_expires)
    ) {
      return res.status(400).json({ success: false, message: 'Invalid or expired code.' });
    }
    await conn.query(
      `UPDATE recruiter_verifications
          SET email_verified      = 1,
              email_otp           = NULL,
              email_otp_expires   = NULL,
              verification_status = 'basic_verified'
        WHERE user_id = ?`,
      [userId]
    );
    return res.json({ success: true });
  } catch (err) {
    return next(err);
  } finally {
    conn?.release();
  }
};

// GET /api/recruiters/verify/basic/status
exports.getBasicStatus = async (req, res, next) => {
  const userId = req.user.id;
  try {
    const [[row]] = await db.query(
      `SELECT email_verified
         FROM recruiter_verifications
        WHERE user_id = ?`,
      [userId]
    );
    const email_verified = row ? Boolean(row.email_verified) : false;
    return res.json({ email_verified });
  } catch (err) {
    return next(err);
  }
};

// ————————————————————————————————————————————————
// Business verification: file uploads via multer

// configure storage for uploads/verifications/<userId>/ 
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '..', 'uploads', 'verifications', String(req.user.id));
    // ensure the directory exists
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    cb(null, `${file.fieldname}-${timestamp}${path.extname(file.originalname)}`);
  }
});
const upload = multer({ storage });

/**
 * Middleware: parse multipart/form-data for business verification
 */
exports.businessUploadMiddleware = upload.fields([
  { name: 'businessCert', maxCount: 1 },
  { name: 'pinCert',      maxCount: 1 },
  { name: 'idFront',      maxCount: 1 },
  { name: 'idBack',       maxCount: 1 },
  { name: 'selfie',       maxCount: 1 },
]);

/**
 * POST /api/recruiters/verify/business
 * - Updates only the re‑uploaded file’s path
 * - Resets that file’s status to 'pending'
 * - Leaves all other statuses untouched
 */
exports.handleBusinessVerification = async (req, res, next) => {
  const userId      = req.user.id;
  const { entityType, onlineURL } = req.body;
  const files       = req.files;

  // Field → DB column + status column mapping
  const mapping = {
    businessCert: { col: 'letterhead_path', statusCol: 'letterhead_status' },
    pinCert:      { col: 'tin_number',      statusCol: 'tin_status' },
    idFront:      { col: 'id_front_path',   statusCol: 'id_front_status' },
    idBack:       { col: 'id_back_path',    statusCol: 'id_back_status' },
    selfie:       { col: 'selfie_path',     statusCol: 'selfie_status' },
  };

  const updates = [];
  const params  = [];

  // Always update entity_type
  updates.push(`entity_type = ?`);
  params.push(entityType);

  // For each possible file, if it was just uploaded, update path & reset status
  for (const field of Object.keys(mapping)) {
    if (files[field] && files[field][0]) {
      const diskPath = files[field][0].path;
      updates.push(`${mapping[field].col} = ?`);
      params.push(diskPath);
      updates.push(`${mapping[field].statusCol} = 'pending'`);
    }
  }

  // Company-only: optional domain
  if (entityType === 'company' && onlineURL) {
    updates.push(`domain = ?`);
    params.push(onlineURL);
  }

  if (updates.length === 1) {
    // only entityType changed, nothing else to upload
    return res.status(400).json({ message: 'No new files or URL provided.' });
  }

  let conn;
  try {
    conn = await db.getConnection();
    const sql = `
      UPDATE recruiter_verifications
         SET ${updates.join(', ')}
       WHERE user_id = ?
    `;
    params.push(userId);
    await conn.query(sql, params);

    return res.json({ success: true });
  } catch (err) {
    return next(err);
  } finally {
    conn?.release();
  }
};

/**
 * GET /api/recruiters/verify/business/status
 * - Returns each file’s public URL plus its status column
 */
exports.getBusinessStatus = async (req, res, next) => {
  const userId = req.user.id;
  try {
    const [[row]] = await db.query(
      `SELECT
         entity_type,
         letterhead_path, letterhead_status,
         tin_number,      tin_status,
         domain,
         id_front_path,   id_front_status,
         id_back_path,    id_back_status,
         selfie_path,     selfie_status,
         verification_status
       FROM recruiter_verifications
       WHERE user_id = ?`,
      [userId]
    );
    if (!row) {
      return res.status(404).json({ message: 'No verification record found.' });
    }

    // Convert disk paths into public URLs
    const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');
    const makePublic = (diskPath) => {
      if (!diskPath) return null;
      let rel = path.relative(UPLOADS_DIR, diskPath).split(path.sep).join('/');
      return `/uploads/${rel}`;
    };

    ['letterhead_path','tin_number','id_front_path','id_back_path','selfie_path']
      .forEach(k => { row[k] = makePublic(row[k]); });

    return res.json(row);
  } catch (err) {
    return next(err); 
  }
};

// At bottom of the file:
exports.getBusinessStatusData = async req => {
  const userId = req.user.id;
  const [[row]] = await db.query(
    `SELECT verification_status
       FROM recruiter_verifications
      WHERE user_id = ?`,
    [userId]
  );
  if (!row) {
    const e = new Error('No verification record found');
    e.status = 404;
    throw e;
  }
  return row; // { verification_status: 'pending'|... }
};
