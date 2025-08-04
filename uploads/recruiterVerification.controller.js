// File: src/controllers/recruiterVerification.controller.js

const db         = require('../config/database');
const nodemailer = require('nodemailer');
const { randomInt } = require('crypto');
const multer     = require('multer');
const path       = require('path');

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

    // ensure a row exists
    await conn.query(
      `INSERT INTO recruiter_verifications (user_id, email_verified, verification_status)
         VALUES (?, 0, 'pending')
       ON DUPLICATE KEY UPDATE user_id = user_id`,
      [userId]
    );

    // store OTP + expiry
    await conn.query(
      `UPDATE recruiter_verifications
          SET email_otp         = ?,
              email_otp_expires = ?,
              verification_status = 'pending'
        WHERE user_id = ?`,
      [code, expires, userId]
    );

    // send OTP email
    await transporter.sendMail({
      from:    `"CampusTalent" <${process.env.SMTP_FROM}>`,
      to:      email,
      subject: 'Your CampusTalent verification code',
      text:    `Your verification code is: ${code}\nCode expires in 15 minutes.`
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

    // mark basic verified
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
    const dir = path.join(
      __dirname, '..', 'uploads', 'verifications', String(req.user.id)
    );
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    cb(
      null,
      `${file.fieldname}-${timestamp}${path.extname(file.originalname)}`
    );
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
 */
exports.handleBusinessVerification = async (req, res, next) => {
  const userId      = req.user.id;
  const { entityType, onlineURL } = req.body;
  const files       = req.files;

  // prepare file paths
  let letterhead_path = null;
  let tin_number      = null;
  let domain          = null;
  let id_front_path   = null;
  let id_back_path    = null;
  let selfie_path     = null;

  if (entityType === 'company') {
    if (!files.businessCert || !files.pinCert) {
      return res
        .status(400)
        .json({ message: 'businessCert and pinCert are required' });
    }
    letterhead_path = files.businessCert[0].path;
    tin_number      = files.pinCert[0].path;
    if (onlineURL) domain = onlineURL;
  } else {
    if (!files.idFront || !files.idBack || !files.selfie) {
      return res
        .status(400)
        .json({ message: 'idFront, idBack, and selfie are required' });
    }
    id_front_path = files.idFront[0].path;
    id_back_path  = files.idBack[0].path;
    selfie_path   = files.selfie[0].path;
  }

  let conn;
  try {
    conn = await db.getConnection();
    await conn.query(
      `UPDATE recruiter_verifications
          SET
            entity_type     = ?,
            letterhead_path = COALESCE(?, letterhead_path),
            tin_number      = COALESCE(?, tin_number),
            domain          = COALESCE(?, domain),
            id_front_path   = COALESCE(?, id_front_path),
            id_back_path    = COALESCE(?, id_back_path),
            selfie_path     = COALESCE(?, selfie_path)
        WHERE user_id = ?`,
      [
        entityType,
        letterhead_path,
        tin_number,
        domain,
        id_front_path,
        id_back_path,
        selfie_path,
        userId
      ]
    );

    res.json({
      success: true,
      verification_status: 'fully_verified'
    });
  } catch (err) {
    next(err);
  } finally {
    conn?.release();
  }
};

// GET /api/recruiters/verify/business/status
exports.getBusinessStatus = async (req, res, next) => {
  const userId = req.user.id;
  try {
    const [[row]] = await db.query(
      `SELECT
         entity_type,
         letterhead_path,
         tin_number,
         domain,
         id_front_path,
         id_back_path,
         selfie_path,
         verification_status
       FROM recruiter_verifications
       WHERE user_id = ?`,
      [userId]
    );
    if (!row) {
      return res.status(404).json({ message: 'No verification record found.' });
    }

    // ────────────────────────────────────────────────────
    // Convert disk paths into public URLs under /uploads/verifications/…
    const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');
    const makePublic = (diskPath) => {
      if (!diskPath) return null;
      let rel = path.relative(UPLOADS_DIR, diskPath);
      rel = rel.split(path.sep).join('/');
      return `/uploads/${rel}`;
    }; 

    row.letterhead_path = makePublic(row.letterhead_path);
    row.tin_number      = makePublic(row.tin_number);
    // domain stays unchanged
    row.id_front_path   = makePublic(row.id_front_path);
    row.id_back_path    = makePublic(row.id_back_path);
    row.selfie_path     = makePublic(row.selfie_path);
    // ────────────────────────────────────────────────────

    return res.json(row);
  } catch (err) {
    next(err); 
  }
};
