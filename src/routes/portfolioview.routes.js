//src/routes/portfolio.routes.js
const express       = require('express');
const { authenticate } = require('../middleware/auth.middleware');
const { getPortfolioView } = require('../controllers/portfolioview.controller');

const router = express.Router();

// GET /api/portfolio/:studentId?page=&limit=  (logged-in only)
router.get('/:studentId', authenticate, getPortfolioView);

module.exports = router;
