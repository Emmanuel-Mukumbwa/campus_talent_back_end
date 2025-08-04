// File: src/routes/escrow.routes.js
const express = require('express');
const { createDeposit } = require('../controllers/escrow.controller');
const { authenticate }  = require('../middleware/auth.middleware');

const router = express.Router();

// All escrow endpoints require authentication
router.use(authenticate);

// POST /api/escrow
router.post('/', createDeposit);

module.exports = router;
