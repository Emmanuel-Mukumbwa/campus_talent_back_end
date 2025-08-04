// File: src/routes/deliverables.routes.js

const express    = require('express');
const path       = require('path');
const multer     = require('multer');
const fs         = require('fs');
const { authenticate } = require('../middleware/auth.middleware');
const {
  createDeliverable,
  listDeliverables,
  updateDeliverableStatus
} = require('../controllers/deliverables.controller');

const router = express.Router({ mergeParams: true });

// Custom diskStorage so uploads go into uploads/deliverables/temp
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const tempDir = path.join(__dirname, '../uploads', 'deliverables', 'temp');
    fs.mkdirSync(tempDir, { recursive: true });
    cb(null, tempDir);
  },
  filename: (req, file, cb) => {
    // e.g. files-1627389123456.pdf
    const timestamp = Date.now();
    cb(
      null,
      `${file.fieldname}-${timestamp}${path.extname(file.originalname)}`
    );
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 } // 5 MB max per file
});

// Apply authentication to all deliverables routes
router.use(authenticate);

// GET submitted deliverables
// GET /api/gig_applications_deliverable/:applicationId/deliverables
router.get(
  '/:applicationId/deliverables',
  listDeliverables
);

// POST new deliverable (files land in .../uploads/deliverables/temp)
router.post(
  '/:applicationId/deliverables',
  upload.array('files', 5),
  createDeliverable
);

// PATCH deliverable status
// PATCH /api/gig_applications_deliverable/:applicationId/deliverables/:deliverableId
router.patch(
  '/:applicationId/deliverables/:deliverableId',
  updateDeliverableStatus
);

module.exports = router;
