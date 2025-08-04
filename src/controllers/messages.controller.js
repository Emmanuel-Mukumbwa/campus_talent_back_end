const db = require('../config/database');

/**
 * List all conversations for the current user,
 * including the peer’s name/avatar/last_active,
 * the last message + timestamp, and unread count.
 */
exports.getConversations = async (req, res, next) => {
  const me = req.user.id;
  try {
    const sql = `
      SELECT
        u.id            AS otherId,
        u.name          AS otherName,
        u.avatar_url    AS otherAvatar,
        u.last_active   AS otherLastSeen,
        m2.last_text,
        m2.last_at,
        COALESCE(unread.unread_count, 0) AS unreadCount
      FROM (
        /* subquery: for each peer, get last_at & last_text */
        SELECT
          CASE
            WHEN sender_id = ? THEN recipient_id
            ELSE sender_id
          END AS other_id,
          MAX(sent_at) AS last_at,
          SUBSTRING_INDEX(
            GROUP_CONCAT(message_text ORDER BY sent_at DESC),
            ',', 1
          ) AS last_text
        FROM messages
        WHERE sender_id = ? OR recipient_id = ?
        GROUP BY other_id
      ) AS m2
      JOIN users u
        ON u.id = m2.other_id
      LEFT JOIN (
        /* count unread per peer */
        SELECT sender_id AS other_id, COUNT(*) AS unread_count
        FROM messages
        WHERE recipient_id = ? AND is_read = 0
        GROUP BY sender_id
      ) AS unread
        ON unread.other_id = m2.other_id
      ORDER BY m2.last_at DESC
    `;
    const [rows] = await db.execute(sql, [me, me, me, me]);
    res.json(rows);
  } catch (err) {
    next(err);
  }
};

/**
 * Fetch a single conversation's messages in chronological order,
 * then mark any incoming messages as read (set is_read=1, read_at=NOW()).
 */
exports.getConversation = async (req, res, next) => {
  const me    = req.user.id;
  const other = Number(req.params.otherId);
  try {
    // 1) Get all msgs
    const [msgs] = await db.execute(
      `SELECT
         id,
         sender_id,
         recipient_id,
         message_text,
         sent_at,
         read_at
       FROM messages
       WHERE (sender_id = ? AND recipient_id = ?)
          OR (sender_id = ? AND recipient_id = ?)
       ORDER BY sent_at ASC`,
      [me, other, other, me]
    );

    // 2) Mark unread incoming as read
    await db.execute(
      `UPDATE messages
         SET is_read = 1,
             read_at = NOW()
       WHERE recipient_id = ? AND sender_id = ? AND is_read = 0`,
      [me, other]
    );

    res.json(msgs);
  } catch (err) {
    next(err);
  }
};

/**
 * Send a new message → INSERT and return success.
 */
exports.sendMessage = async (req, res, next) => {
  const senderId = req.user.id;
  const { to, message } = req.body;
  if (!to || !message?.trim()) {
    return res.status(400).json({ message: 'Recipient and message are required' });
  }
  try {
    await db.execute(
      `INSERT INTO messages (sender_id, recipient_id, message_text)
       VALUES (?, ?, ?)`,
      [senderId, to, message.trim()]
    );
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};
