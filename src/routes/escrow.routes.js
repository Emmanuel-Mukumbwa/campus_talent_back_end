// File: src/routes/escrow.routes.js
const express           = require('express');
const { authenticate }  = require('../middleware/auth.middleware');
const {
  initiateEscrow,
  releaseEscrow,
  getEscrowByRef
} = require('../controllers/escrow.controller');

const router = express.Router(); 

// 1) Hold funds (card or mobile)
router.post('/', authenticate, initiateEscrow);

// 2) No‑op callback for Pay Changu 
router.post('/noop', (_req, res) => {
  res.sendStatus(200);
}); 

// 3) Poll & release escrow
router.post('/release', authenticate, releaseEscrow);

// 4) Fetch one escrow by tx_ref
router.get('/:tx_ref', authenticate, getEscrowByRef);

module.exports = router;
