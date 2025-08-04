// File: src/routes/portfolioattach.routes.js
const express             = require('express');
const router              = express.Router();
const { authenticate }    = require('../middleware/auth.middleware');
const upload              = require('../middleware/multer');
const {
  uploadPortfolioAttachmentsToProject
} = require('../controllers/portfolioattach.controller');

router.use(authenticate);

router.post(
  '/student/portfolio/:projectId/attachments',
  upload.attachments.array('attachments', 10),
  uploadPortfolioAttachmentsToProject
);

module.exports = router;
