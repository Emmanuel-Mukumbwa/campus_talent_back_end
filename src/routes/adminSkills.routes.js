// src/routes/adminSkills.routes.js
const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/adminSkills.controller');
// const { isAdmin } = require('../middleware/auth'); // if you have an admin‑check middleware

// router.use(isAdmin);

router
  .route('/')
  .get(ctrl.listSkills)
  .post(ctrl.createSkill);

router
  .route('/:id')
  .put(ctrl.updateSkill)
  .delete(ctrl.deleteSkill);

module.exports = router;
