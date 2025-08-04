// File: src/routes/index.js
const express                 = require('express');
const pool                    = require('../config/database');
const authRoutes              = require('./auth.routes');
const portfolioRoutes         = require('./portfolio.routes');
const gigpostRoutes           = require('./gigpost.routes'); 
const gigsRoutes              = require('./gigs.routes');       
const gigs1Routes             = require('./gigs1.routes');       
const gigsstatusRoutes        = require('./gigsstatus.routes');
const skillsRoutes            = require('./skills.routes');
const studentRoutes           = require('./studenthome.routes');
const student1Routes          = require('./student1.routes');
const legacyGigApplications   = require('./gigApplications1.routes');
const modernGigApplications   = require('./gigApplications.routes');
const portfolioAttachRoutes   = require('./portfolioattach.routes');
const deliverablesRoutes      = require('./deliverables.routes');
const endorseRoutes = require('./endorse.routes');
const portfolioViewRoutes = require('./portfolioview.routes'); 
const rvRoutes     = require('./recruiterVerification.routes'); 
const adminRvRoutes= require('./adminVerification.routes'); 
const publicProfileRoutes = require('./publicProfile.routes');
const profileRoutes = require('./profile.routes');
//const escrowRoutes = require('./escrow.routes');
const escrowRoutes = require('./escrow.routes'); 
const gigReqRoutes = require('./gigRequirements.routes');
const assessmentRoutes = require('./assessment.routes');
const recruiterVerifRoutes = require('./recruiterVerification.routes');
const adminUsersRoutes = require('./adminUsers.routes');
const adminGigsRoutes       = require('./adminGigs.routes');
const adminApplicationsRoutes = require('./adminApplications.routes');
const adminDashboardRoutes = require('./adminDashboard.routes');
const adminSkillsRoutes   = require('./adminSkills.routes');
const adminSubscriptionsroutes = require('./adminSubscriptions.routes');
const adminPlansRoutes         = require('./adminPlans.routes');
const messagesRoutes          = require('./messages.routes');
const notificationsRoutes     = require('./notifications.routes'); 
const subscriptionsRoutes = require('./subscriptions.routes');
const gigDetailRoutes = require('./gigdetail.routes');

const router = express.Router();

// Health check
router.get('/health', async (req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT 1 AS result');
    return res.json({
      server:   'up',
      database: rows[0].result === 1 ? 'connected' : 'error'
    });
  } catch (err) {
    next(err); 
  }
});

router.use('/auth',                           authRoutes);
router.use('/portfolio',                      portfolioRoutes);
router.use('/recruiter',                      gigpostRoutes);
router.use('/gigs/:gigId/requirements',      gigReqRoutes);
router.use('/gigs',                           gigsRoutes);
router.use('/skills',                         skillsRoutes);
router.use('/public/profile', publicProfileRoutes);
router.use('/students',                       studentRoutes); 
router.use('/students1',                       student1Routes);
router.use('/gigs1',                          gigs1Routes);
router.use('/gigsstatus',                     gigsstatusRoutes);
router.use('/notifications',                  notificationsRoutes);
router.use('/students', endorseRoutes);
router.use('/legacy/gig_applications',legacyGigApplications); 
router.use('/gig_applications',  modernGigApplications);
router.use('/gig_applications_deliverable',   deliverablesRoutes);
router.use('/portfolioview', portfolioViewRoutes);
router.use('/recruiters',           recruiterVerifRoutes); 
router.use('/messages',                       messagesRoutes);
router.use('/admin/users',         adminUsersRoutes);
router.use('/gigdetail', gigDetailRoutes);
router.use('/admin/verifications', adminRvRoutes); 
router.use('/admin/applications', adminApplicationsRoutes); 
router.use('/admin/dashboard',     adminDashboardRoutes);
router.use('/admin/gigs',          adminGigsRoutes);
router.use('/admin/skills',        adminSkillsRoutes);
router.use('/admin/subscriptions',adminSubscriptionsroutes);
router.use('/admin/plans',     adminPlansRoutes);
router.use('/profile', profileRoutes);  
//router.use('/escrow', escrowRoutes); 
router.use('/escrow', escrowRoutes);
router.use('/assessments', assessmentRoutes); 
router.use('/subscriptions', subscriptionsRoutes);
router.use('/',                               portfolioAttachRoutes);

module.exports = router;
 