const db = require('../config/database');

exports.listNotifications = async (req, res, next) => {
  try {
    const recipientId = req.user.id;
    const [rows] = await db.execute(
      `SELECT id, type, data, is_read, created_at
         FROM notifications
        WHERE recipient_id = ?
        ORDER BY created_at DESC
        LIMIT 50`,
      [recipientId]
    );
    res.json(rows);
  } catch (e) {
    next(e);
  }
};

exports.markAsRead = async (req, res, next) => {
  try {
    const recipientId = req.user.id;
    const id = Number(req.params.id);
    await db.execute(
      `UPDATE notifications
          SET is_read = 1
        WHERE id = ? AND recipient_id = ?`,
      [id, recipientId]
    );
    res.json({ success: true });
  } catch (e) {
    next(e);
  }
};

exports.createNotification = async (req, res, next) => {
  try {
    const { recipient_id, type, data } = req.body;

    // Basic validation
    if (recipient_id == null) {
      return res.status(400).json({ error: 'recipient_id is required' });
    }
    if (!type) {
      return res.status(400).json({ error: 'type is required' });
    }
    if (data === undefined) {
      return res.status(400).json({ error: 'data is required' });
    }

    // Prepare JSON payload
    const payload = JSON.stringify(data);

    // Insert into notifications
    const [result] = await db.execute(
      `INSERT INTO notifications (recipient_id, type, data)
           VALUES (?, ?, ?)`,
      [recipient_id, type, payload]
    );

    res.status(201).json({
      success: true,
      id: result.insertId
    });
  } catch (e) {
    next(e);
  }
};
