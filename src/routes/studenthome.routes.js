// File: routes/studentRoutes.js
const express = require('express');
const router = express.Router();

const { authenticate } = require('../middleware/auth.middleware');
const validateNetworkQuery = require('../middleware/validateNetworkQuery');
const { getNetwork } = require('../controllers/studentNetwork.controller');
const {
  getTopStudents,
  getNewStudents
} = require('../controllers/studenthome.controller');

// GET top 3 students (by profile_strength, then badge count)
router.get('/top', getTopStudents);

// GET newest 3 students (by created_at desc) 
router.get('/new', getNewStudents); 

// GET paginated “Students You May Know” (protected + validated)
router.get(
  '/network',
  authenticate,
  validateNetworkQuery,
  getNetwork
);

module.exports = router;
