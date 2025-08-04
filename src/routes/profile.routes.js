//src/routes/profile.routes.js
const express          = require('express');
const { authenticate } = require('../middleware/auth.middleware');
const ctrl             = require('../controllers/profile.controller');
const upload           = require('../middleware/multer');  // our single multer export

const router = express.Router();

// Core profile for “me”
router.get('/', authenticate, ctrl.getOwnProfile);

 
// Batch lookup for avatars
router.get('/batch', authenticate, ctrl.batchProfiles); 


// Student-specific **before** the generic param route
router.get('/:userId/skills',    authenticate, ctrl.getStudentSkills);
router.get('/:userId/portfolio', authenticate, ctrl.getStudentPortfolio);
router.get('/:userId/reviews',   authenticate, ctrl.getUserReviews);

// Recruiter-specific
router.get('/:userId/gigs',      authenticate, ctrl.getRecruiterGigs);

// Now the generic profile-by-id
router.get('/:userId', authenticate, ctrl.getProfileById);

// Update your own profile 
router.put('/', authenticate, ctrl.updateProfile);

// --- NEW: upload a new avatar image under field name "avatar" ---
router.post(
  '/avatar',
  authenticate,
  upload.profile.single('avatar'),
  ctrl.uploadAvatar
);

router.post(
  '/activity', 
  authenticate,
  ctrl.updateActivity     // ← new controller method
);

router.get(
  '/public/batch', 
  ctrl.publicBatchProfiles
);
module.exports = router;
