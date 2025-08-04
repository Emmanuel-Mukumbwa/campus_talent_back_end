//src/routes/gigpost.routes.js
const express = require('express');
const { authenticate } = require('../middleware/auth.middleware');
const {
  createOrUpdateGig,
  countCompletedApplications,
  listGigs
} = require('../controllers/gigpost.controller'); 

const router = express.Router(); 

// Protect all gig-post routes
router.use(authenticate);

// Create or update a gig (draft vs open)
router.post('/gigs', createOrUpdateGig); 
 
// List all gigs for this recruiter
router.get('/gigs', listGigs); 

router.put('/gigs/:id', createOrUpdateGig);

router.get('/gigs/count', countCompletedApplications);


module.exports = router;
 