

const express            = require('express'); 
const { authenticate }   = require('../middleware/auth.middleware');
const { authorizeAdmin } = require('../middleware/admin.middleware');
const gigsCtrl           = require('../controllers/adminGigs.controller');

const router = express.Router();

// GET /api/admin/gigs
router.get(
  '/',
  authenticate,
  authorizeAdmin,
  gigsCtrl.listAllGigs
);

// POST /api/admin/gigs/:id/deactivate
router.post(
  '/:id/deactivate',
  authenticate,
  authorizeAdmin,
  gigsCtrl.deactivateGig
);

// POST /api/admin/gigs/:id/activate
router.post(
  '/:id/activate',
  authenticate,
  authorizeAdmin,
  gigsCtrl.activateGig
);

module.exports = router;
