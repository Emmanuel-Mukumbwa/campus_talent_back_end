// File: src/routes/skills.routes.js

const express = require('express');
const {
  getAllSkills,
  getTrendingSkills
} = require('../controllers/skills.controller');

const router = express.Router();

// GET /api/skills/trending
// Returns top 10 skills by # of new open gigs in the last X days (default 7)
router.get('/trending', getTrendingSkills);

// GET /api/skills
router.get('/', getAllSkills);

module.exports = router;
