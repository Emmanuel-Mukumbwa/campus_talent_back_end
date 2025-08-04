

const express            = require('express');
const { authenticate }   = require('../middleware/auth.middleware');
const { authorizeAdmin } = require('../middleware/admin.middleware');
const dashCtrl           = require('../controllers/adminDashboard.controller');

const router = express.Router();

// GET /api/admin/dashboard
router.get(
  '/',
  authenticate,
  authorizeAdmin,
  dashCtrl.getOverview
);

module.exports = router;
