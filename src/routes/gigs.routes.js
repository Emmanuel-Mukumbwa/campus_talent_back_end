// src/routes/gigs.routes.js
const express = require('express');
const router  = express.Router();
const { getGigsBySkill } = require('../controllers/gigs.controller');

/**
 * GET /api/gigs/by-skill?skill=Tutoring
 * Query params:
 *   - skill (string, required): the exact skills.name
 */
router.get('/by-skill', getGigsBySkill);

module.exports = router;
 