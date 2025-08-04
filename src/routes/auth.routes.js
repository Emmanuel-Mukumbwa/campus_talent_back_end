// File: src/routes/auth.routes.js
const express = require('express');
const { register, login, me } = require('../controllers/auth.controller'); 
const { authenticate } = require('../middleware/auth.middleware');

const router = express.Router();

// Public: user registration 
router.post('/register', register);
 
// Public: user login 
router.post('/login', login);

// Protected: get current user profile
router.get('/me', authenticate, me);


module.exports = router;
