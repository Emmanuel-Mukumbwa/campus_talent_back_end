// File: src/routes/recruiterVerification.routes.js

const express = require('express');
const { authenticate } = require('../middleware/auth.middleware');
const {
  getBasicStatus, 
  getBusinessStatus,
  sendBasicOTP,
  confirmBasicOTP,
  businessUploadMiddleware,
  handleBusinessVerification,
} = require('../controllers/recruiterVerification.controller');

const router = express.Router();

// GET /api/recruiters/verify/basic/status
router.get( 
  '/verify/basic/status',
  authenticate,
  getBasicStatus
);

// GET /api/recruiters/verify/business/status
router.get(
 '/verify/business/status',
  authenticate,
  getBusinessStatus
);

// POST /api/recruiters/verify/basic/send
router.post(
  '/verify/basic/send',
  authenticate,
  sendBasicOTP
);

// POST /api/recruiters/verify/basic/confirm
router.post(
  '/verify/basic/confirm',
  authenticate,
  confirmBasicOTP
);

// POST /api/recruiters/verify/business
router.post(
  '/verify/business',
  authenticate, 
  businessUploadMiddleware,
  handleBusinessVerification
);

// GET /api/recruiters/verification-status
router.get(
  '/verification-status',
  authenticate,
  async (req, res, next) => {
    try {
      // getBusinessStatusData might throw({ status:404 })
      const row = await require('../controllers/recruiterVerification.controller')
                        .getBusinessStatusData(req);
      return res.json({ verification_status: row.verification_status });
    } catch (err) {
      if (err.status === 404) {
        // no record → treat as "pending"
        return res.json({ verification_status: 'pending' });
      }
      next(err);
    }
  }
);


module.exports = router;
