const express = require('express');
const db = require('../db/pool');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// Helper: create a notification
const createNotification = async (io, { user_id, role, type, title, body, link }) => {
  const result = await db.query(
    `INSERT INTO notifications (user_id, role, type, title, body, link) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [user_id || null, role || null, type, title, body || null, link || null]
  );
  const notif = result.rows[0];

  // Emit via Socket.io
  if (user_id) {
    io.to(`user_${user_id}`).emit('notification', notif);
  } else if (role) {
    io.to(`role_${role}`).emit('notification', notif);
  }
  return notif;
};

// GET /api/notifications
router.get('/', authenticate, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT * FROM notifications
       WHERE (user_id = $1 OR role = $2)
       ORDER BY created_at DESC LIMIT 50`,
      [req.user.id, req.user.role]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Get notifications error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// GET /api/notifications/unread-count
router.get('/unread-count', authenticate, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT COUNT(*) as count FROM notifications
       WHERE (user_id = $1 OR role = $2) AND is_read = false`,
      [req.user.id, req.user.role]
    );
    res.json({ count: parseInt(result.rows[0].count) });
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// PUT /api/notifications/:id/read
router.put('/:id/read', authenticate, async (req, res) => {
  try {
    await db.query(
      'UPDATE notifications SET is_read = true WHERE id = $1 AND (user_id = $2 OR role = $3)',
      [req.params.id, req.user.id, req.user.role]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// PUT /api/notifications/read-all
router.put('/read-all', authenticate, async (req, res) => {
  try {
    await db.query(
      'UPDATE notifications SET is_read = true WHERE (user_id = $1 OR role = $2) AND is_read = false',
      [req.user.id, req.user.role]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

module.exports = router;
module.exports.createNotification = createNotification;
