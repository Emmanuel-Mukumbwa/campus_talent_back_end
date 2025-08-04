//src/routes/adminUsers.routes.js
const express            = require('express');
const { authenticate }   = require('../middleware/auth.middleware');
const { authorizeAdmin } = require('../middleware/admin.middleware');
const userCtrl           = require('../controllers/adminUsers.controller');

const router = express.Router();

// GET /api/admin/users
// Supports ?page=&limit=&role=&status=&search=
router.get(
  '/',
  authenticate,
  authorizeAdmin,
  userCtrl.listUsers
);

// GET /api/admin/users/:id
router.get(
  '/:id',
  authenticate,
  authorizeAdmin,
  userCtrl.getUserDetail
);

// POST /api/admin/users/:id/suspend
router.post(
  '/:id/suspend',
  authenticate,
  authorizeAdmin,
  userCtrl.suspendUser
);

// POST /api/admin/users/:id/activate
router.post(
  '/:id/activate',
  authenticate,
  authorizeAdmin,
  userCtrl.activateUser
);

// POST /api/admin/users/:id/set-role
router.post(
  '/:id/set-role',
  authenticate,
  authorizeAdmin,
  userCtrl.setRole
);

// POST /api/admin/users/bulk/activate
router.post(
  '/bulk/activate',
  authenticate,
  authorizeAdmin,
  userCtrl.bulkActivate
);

// POST /api/admin/users/bulk/suspend
router.post(
  '/bulk/suspend',
  authenticate,
  authorizeAdmin,
  userCtrl.bulkSuspend
);

module.exports = router;
