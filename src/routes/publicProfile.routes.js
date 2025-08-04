// src/routes/publicProfile.routes.js

const express = require('express');
const ctrl    = require('../controllers/publicProfile.controller');

const router = express.Router();

// Public batch avatar lookup
router.get('/batch', ctrl.batchProfiles);

// Public student‑by‑ID core profile
router.get('/:userId', ctrl.getProfileById);

// Public student skills
router.get('/:userId/skills', ctrl.getStudentSkills);

// Public student portfolio
router.get('/:userId/portfolio', ctrl.getStudentPortfolio);

// Public recruiter gigs
router.get('/:userId/gigs', ctrl.getRecruiterGigs); 

module.exports = router;
