const express = require('express');
const {
  getGigsByRecruiter,
  getApplicationCountForGig,
  getReviewedApplicationsForStudent
} = require('../controllers/gigsstatus.controller');
const { authenticate } = require('../middleware/auth.middleware');

const router = express.Router();

// All routes below require a valid JWT
router.use(authenticate);

/**
 * GET /gigsstatus/
 *   → getGigsByRecruiter
 *   Query‑params: recruiterId=123
 */
router.get('/recruitergigs', getGigsByRecruiter);

/**
 * GET /gigsstatus/:gigId/applications
 *   → getApplicationCountForGig
 *   Query‑params: status=Applied
 */
router.get('/:gigId/applications', getApplicationCountForGig);

/**
 * GET /gigsstatus/studentsreviewedgigs/:studentId/applications
 *   → getReviewedApplicationsForStudent
 *   Query‑params: status=!draft
 */
router.get(
  '/studentsreviewedgigs/:studentId/applications',
  getReviewedApplicationsForStudent
); 

module.exports = router;
