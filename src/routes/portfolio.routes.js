// File: src/routes/portfolio.routes.js
const express           = require('express');
const router            = express.Router();
const { authenticate }  = require('../middleware/auth.middleware');
const upload            = require('../middleware/multer');       // your multer config
const {
  getPortfolio,
  upsertPortfolio,
  uploadPortfolioAttachments
} = require('../controllers/portfolio.controller');

// all portfolio routes require a valid JWT
router.use(authenticate);

/**
 * GET /api/portfolio
 * → returns 404 if no portfolio exists
 */
router.get('/', getPortfolio); 

/**
 * POST /api/portfolio
 * → upsert the main portfolio record (about, skills, proficiencies, projects, status)
 */
router.post('/', upsertPortfolio); 

/**
 * POST /api/portfolio/attachments
 * → upload files, mark portfolio published
 *    Expects multipart/form-data “attachments”[]
 */
router.post(
  '/attachments',
  upload.array('attachments', 10),
  uploadPortfolioAttachments
);

module.exports = router;
