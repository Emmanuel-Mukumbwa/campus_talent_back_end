// File: src/routes/gigRequirements.routes.js
const express            = require('express');
const { authenticate }   = require('../middleware/auth.middleware');
const {
  upsertRequirements,
  listRequirements
} = require('../controllers/gigRequirements.controller');

const router = express.Router({ mergeParams: true });

// All routes require authentication
router.use(authenticate);

/**
 * GET /api/gigs/:gigId/requirements
 * Returns the array of requirement records for a gig.
 */
router.get('/', listRequirements); 

/**
 * POST /api/gigs/:gigId/requirements
 * Upsert the gig’s requirements.
 * Only the recruiter who owns the gig may call this.
 */
router.post('/', upsertRequirements);

module.exports = router;
