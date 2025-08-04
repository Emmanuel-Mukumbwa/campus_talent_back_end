// src/routes/adminSubscriptions.routes.js
const express = require('express');
const { authenticate }    = require('../middleware/auth.middleware');
const { authorizeAdmin }  = require('../middleware/admin.middleware');
const ctrl                = require('../controllers/adminSubscriptions.controller');

const router = express.Router();

// All admin‑only routes go through both authenticate + authorizeAdmin
router.use(authenticate);
router.use(authorizeAdmin);

// List all
router.get('/', ctrl.listSubscriptions);

// Cancel one
router.post('/:id/cancel', ctrl.cancelSubscription);

// Reactivate one
router.post('/:id/reactivate', ctrl.reactivateSubscription);

module.exports = router;
