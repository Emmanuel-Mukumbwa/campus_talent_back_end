// File: src/routes/endorse.routes.js

const express = require('express');
const { authenticate } = require('../middleware/auth.middleware');
const { 
  getPortfolioSkills,
  getMyEndorsements,
  endorseStudent,
  endorseGigComplete
} = require('../controllers/endorse.controller');

const router = express.Router();

// fetch portfolio skills → GET /api/students/:studentId/portfolio/skills
router.get(
  '/:studentId/portfolio/skills',
  authenticate,
  getPortfolioSkills
);

// fetch *my* past endorsements → GET /api/students/:studentId/endorsements/me
router.get(
  '/:studentId/endorsements/me',
  authenticate,
  getMyEndorsements
);

// submit an endorsement → POST /api/students/:studentId/endorse
router.post(
  '/:studentId/endorse',
  authenticate,
  endorseStudent
);

// mark a completed gig as an endorsement → POST /api/students/:studentId/endorse/gig/:gigId/complete
router.post(
  '/:studentId/endorse/gig/:gigId/complete',
  authenticate,
  endorseGigComplete
);

module.exports = router;
