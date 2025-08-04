// src/routes/subscriptions.routes.js

const express         = require('express');
const { authenticate }= require('../middleware/auth.middleware');
const ctrl            = require('../controllers/subscriptions.controller');
const { checkCanPostGigs } = require('../middleware/subscription.middleware');

const router = express.Router();

// 1) Start a new subscription payment
router.post('/', authenticate, ctrl.initiateSubscription);

// 2) Callback/webhook endpoint for PayChangu
//    Note: express.json() ensures we can read JSON payload
router.post('/webhook', express.json(), ctrl.handleWebhook); 

// 3) Poll subscription status
router.get('/status', authenticate, ctrl.getSubscriptionStatus);

// 4) (Optional) enforce limit on gig posting
// router.post('/gigs', authenticate, checkCanPostGigs, gigsController.createGig);

module.exports = router;
