// File: src/routes/adminVerification.routes.js

const express            = require('express');
const { authenticate }   = require('../middleware/auth.middleware');
const { authorizeAdmin } = require('../middleware/admin.middleware');
const adminCtrl          = require('../controllers/adminVerification.controller');

const router = express.Router();

// GET all verifications
// → GET /api/admin/verifications
router.get(
  '/',
  authenticate, 
  authorizeAdmin,
  adminCtrl.listAll
);

// GET single verification detail
// → GET /api/admin/verifications/:id
router.get(
  '/:id',
  authenticate,
  authorizeAdmin,
  adminCtrl.getDetail
);

// POST update overall status
// → POST /api/admin/verifications/:id/update-status
router.post(
  '/:id/update-status',
  authenticate,
  authorizeAdmin,
  adminCtrl.updateStatus
);

// POST update a single file’s status (approve/reject)
// → POST /api/admin/verifications/:id/file-status
router.post(
  '/:id/file-status',
  authenticate,
  authorizeAdmin,
  adminCtrl.updateFileStatus
);

module.exports = router;
