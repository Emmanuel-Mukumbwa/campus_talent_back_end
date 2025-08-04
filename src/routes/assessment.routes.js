// src/routes/assessment.routes.js
const express = require('express');
const { authenticate } = require('../middleware/auth.middleware');
const ctrl = require('../controllers/assessment.controller');

const router = express.Router();

// get the student’s assessment for one skill (or 404 if not taken)
router.get('/:skill', authenticate, ctrl.getAssessmentBySkill);

// submit a new assessment (only if none exists yet)
router.post('/:skill', authenticate, ctrl.submitAssessment);

module.exports = router;
