const express            = require('express');
const { authenticate }   = require('../middleware/auth.middleware');
const ctrl               = require('../controllers/gigdetail.controller');

const router = express.Router();

// All detail requests must be authenticated
router.get('/:id', authenticate, ctrl.getGigDetail);

module.exports = router;
