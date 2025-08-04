// src/routes/notifications.routes.js
const express = require('express');
const { authenticate } = require('../middleware/auth.middleware');
const {
  listNotifications,
  markAsRead,
  createNotification
} = require('../controllers/notifications.controller');

const router = express.Router();
router.use(authenticate);

// GET /api/notifications
router.get('/', listNotifications);

// PATCH /api/notifications/:id/read
router.patch('/:id/read', markAsRead);

// (Optional) POST /api/notifications
router.post('/', createNotification);

module.exports = router;
