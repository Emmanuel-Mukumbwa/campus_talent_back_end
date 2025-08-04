//src/routes/gigs1.routes.js
const express    = require('express');
const router     = express.Router();
const { authenticate } = require('../middleware/auth.middleware');
const gigsCtrl   = require('../controllers/gigs1.controller');

// Simple role check middleware factory
const authorize = requiredRole => (req, res, next) => {
  if (req.user.role !== requiredRole) {
    return res.status(403).json({ message: 'Forbidden' });
  }
  next();
};

// List & detail (all authenticated users) 
router.get(
  '/',
  authenticate, 
  gigsCtrl.listGigs
);
router.get(
  '/:id',
  authenticate,
  gigsCtrl.getGigById
);

// Recruiter-only: create, update, soft-delete
router.post( 
  '/',
  authenticate,
  authorize('recruiter'),
  gigsCtrl.createGig
);
router.put(
  '/:id',
  authenticate,
  authorize('recruiter'),
  gigsCtrl.updateGig
);
router.delete(
  '/:id',
  authenticate,
  authorize('recruiter'),
  gigsCtrl.deleteGig
);

module.exports = router;
