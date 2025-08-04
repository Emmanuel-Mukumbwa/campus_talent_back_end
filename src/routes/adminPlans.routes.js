const express           = require('express');
const { authenticate }  = require('../middleware/auth.middleware');
const { authorizeAdmin }= require('../middleware/admin.middleware');
const ctrl              = require('../controllers/adminPlans.controller');

const router = express.Router();

// all admin routes require auth + admin role
router.use(authenticate, authorizeAdmin);

router.get   ('/',        ctrl.listPlans);
router.post  ('/',        ctrl.createPlan);
router.put   ('/:id',     ctrl.updatePlan);
router.delete('/:id',     ctrl.deletePlan);

module.exports = router;
