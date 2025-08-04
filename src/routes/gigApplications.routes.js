// File: src/routes/gigApplications.routes.js

const express    = require('express');
const path       = require('path');
const fs         = require('fs');
const multer     = require('multer');
const router     = express.Router();
const { authenticate } = require('../middleware/auth.middleware');
const controller = require('../controllers/gigApplications.controller');

// All routes require a valid user
router.use(authenticate);

/**
 * 1) STUDENT ONLY: fetch a student’s app for a given gig
 *    GET /api/gig_applications?gig_id=123
 */
router.get('/', controller.getByGig);

/** 
 * 2) LIST & FILTER
 *    GET /api/gig_applications
 *    (Recruiter or student listing)
 */
router.get('/', controller.listApplications);

/**
 * 3) CREATE or UPDATE
 *    POST /api/gig_applications
 */

// configure multer storage for application attachments and requirement files
const storage = multer.diskStorage({
  destination(req, file, cb) {
    // ensure the uploads/applications folder exists
    const dir = path.join(__dirname, '../uploads/applications');
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename(req, file, cb) {
    const ts = Date.now();
    cb(null, `${file.fieldname}-${ts}${path.extname(file.originalname)}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 } // 5 MB max per file
});

// expect fields: attachments[], resume_upload[], code_sample[]
router.post(
  '/',
  upload.fields([
    { name: 'attachments',   maxCount: 5 },
    { name: 'resume_upload', maxCount: 1 },
    { name: 'code_sample',   maxCount: 1 }
  ]),
  controller.createOrUpdateApplication
);

/**
 * 4) FETCH ONE
 *    GET /api/gig_applications/:id
 */
router.get('/:id', controller.getApplicationById);

module.exports = router;
