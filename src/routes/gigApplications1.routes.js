//src/routes/gigApplications1.routes.js
const express = require('express');
const {
  listApplications, 
  getApplicationById,  
  updateStatus, 
   deleteApplication
} = require('../controllers/gigApplications1.controller');
const authenticate = require('../middleware/auth.middleware').authenticate;
const router = express.Router();

// GET /api/gig_applications?status=...             (student)
// GET /api/gig_applications?gig_id=...&status=...  (recruiter)
router.get('/', authenticate, listApplications);

// GET /api/gig_applications/:id
router.get('/:id', authenticate, getApplicationById);

// PATCH /api/gig_applications/:id/status
router.patch('/:id/status', authenticate, updateStatus);

router.delete('/:id', authenticate, deleteApplication);


module.exports = router;
