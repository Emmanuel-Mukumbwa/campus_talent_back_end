

const express            = require('express');
const { authenticate }   = require('../middleware/auth.middleware');
const { authorizeAdmin } = require('../middleware/admin.middleware');
const appCtrl            = require('../controllers/adminApplications.controller');

const router = express.Router();

// GET /api/admin/applications
router.get(
  '/',
  authenticate,
  authorizeAdmin,
  appCtrl.listApplications
);

// GET /api/admin/applications/:id
router.get(
  '/:id',
  authenticate,
  authorizeAdmin,
  appCtrl.getApplicationDetail
);

// POST /api/admin/applications/:id/update-status
router.post(
  '/:id/update-status',
  authenticate,
  authorizeAdmin,
  appCtrl.updateApplicationStatus
);

module.exports = router;
