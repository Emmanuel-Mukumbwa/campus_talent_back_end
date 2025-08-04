const express = require('express');
const { authenticate } = require('../middleware/auth.middleware');
const {
  getConversations,
  getConversation,
  sendMessage
} = require('../controllers/messages.controller');

const router = express.Router();

// All routes require an authenticated user
router.use(authenticate);

/**
 * GET /api/messages/conversations
 *   → list your conversation previews
 */
router.get('/conversations', getConversations);

/**
 * GET /api/messages/:otherId
 *   → fetch full conversation with user `:otherId`
 *     • marks incoming as read (sets is_read + read_at)
 */
router.get('/:otherId', getConversation);

/**
 * POST /api/messages
 *   { to, message }
 *   → send a new message
 */
router.post('/', sendMessage);

module.exports = router;
