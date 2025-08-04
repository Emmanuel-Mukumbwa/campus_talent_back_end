// src/routes/student1.routes.js
const express = require('express');
const router  = express.Router();
const studentCtrl = require('../controllers/student.controller');

// GET /api/students/trending
router.get('/trending', studentCtrl.getTrendingStudents);

// GET /api/students/new
router.get('/new',     studentCtrl.getNewStudents);

module.exports = router;    