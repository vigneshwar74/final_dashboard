const express = require('express');
const { body } = require('express-validator');
const db = require('../db/pool');
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

const router = express.Router();

// GET /api/messages - get messages for current user
router.get('/', authenticate, async (req, res) => {
  try {
    let query, params;

    if (req.user.role === 'admin') {
      // Admin sees all sent messages
      query = `
        SELECT m.*, s.name as sender_name, s.role as sender_role,
               r.name as recipient_name
        FROM messages m
        JOIN users s ON m.sender_id = s.id
        LEFT JOIN users r ON m.recipient_id = r.id
        ORDER BY m.created_at DESC
      `;
      params = [];
    } else {
      // Staff/Student sees messages sent to them (by id or by role broadcast)
      query = `
        SELECT m.*, s.name as sender_name, s.role as sender_role
        FROM messages m
        JOIN users s ON m.sender_id = s.id
        WHERE (m.recipient_id = $1) OR (m.recipient_role = $2 AND m.recipient_id IS NULL)
        ORDER BY m.created_at DESC
      `;
      params = [req.user.id, req.user.role];
    }

    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('List messages error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// GET /api/messages/unread-count
router.get('/unread-count', authenticate, async (req, res) => {
  try {
    let query, params;
    if (req.user.role === 'admin') {
      return res.json({ count: 0 });
    }
    query = `
      SELECT COUNT(*) as count FROM messages
      WHERE is_read = false
        AND ((recipient_id = $1) OR (recipient_role = $2 AND recipient_id IS NULL))
    `;
    params = [req.user.id, req.user.role];
    const result = await db.query(query, params);
    res.json({ count: parseInt(result.rows[0].count) });
  } catch (err) {
    console.error('Unread count error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// POST /api/messages - send a message (admin→staff/student, staff→student)
router.post(
  '/',
  authenticate,
  authorize('admin', 'staff'),
  [
    body('subject').trim().notEmpty().withMessage('Subject required'),
    body('body').trim().notEmpty().withMessage('Message body required'),
    body('recipient_role').isIn(['staff', 'student']).withMessage('Recipient role must be staff or student'),
    body('recipient_id').optional({ nullable: true }).isInt(),
  ],
  validate,
  async (req, res) => {
    try {
      const { subject, body: msgBody, recipient_role, recipient_id } = req.body;

      // Staff can only send to students
      if (req.user.role === 'staff' && recipient_role !== 'student') {
        return res.status(403).json({ error: 'Staff can only send messages to students.' });
      }

      // If recipient_id provided, verify the user exists with that role
      if (recipient_id) {
        const recipientUser = await db.query('SELECT id, role FROM users WHERE id = $1', [recipient_id]);
        if (recipientUser.rows.length === 0) {
          return res.status(404).json({ error: 'Recipient not found.' });
        }
        if (recipientUser.rows[0].role !== recipient_role) {
          return res.status(400).json({ error: `Recipient is not a ${recipient_role}.` });
        }
      }

      const result = await db.query(
        `INSERT INTO messages (sender_id, recipient_role, recipient_id, subject, body)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [req.user.id, recipient_role, recipient_id || null, subject, msgBody]
      );

      res.status(201).json(result.rows[0]);
    } catch (err) {
      console.error('Send message error:', err);
      res.status(500).json({ error: 'Server error.' });
    }
  }
);

// PUT /api/messages/:id/read - mark message as read
router.put('/:id/read', authenticate, async (req, res) => {
  try {
    await db.query('UPDATE messages SET is_read = true WHERE id = $1', [req.params.id]);
    res.json({ message: 'Marked as read.' });
  } catch (err) {
    console.error('Mark read error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// GET /api/messages/users/:role - get users by role for recipient dropdown
router.get('/users/:role', authenticate, authorize('admin', 'staff'), async (req, res) => {
  try {
    const { role } = req.params;
    if (!['staff', 'student'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role.' });
    }
    // Staff can only get student list
    if (req.user.role === 'staff' && role !== 'student') {
      return res.status(403).json({ error: 'Staff can only view student list.' });
    }
    const result = await db.query(
      'SELECT id, name, email, department, year FROM users WHERE role = $1 ORDER BY name',
      [role]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Get users error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

module.exports = router;
