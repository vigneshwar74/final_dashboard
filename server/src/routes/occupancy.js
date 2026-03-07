const express = require('express');
const db = require('../db/pool');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// GET /api/occupancy - live occupancy for all resources
router.get('/', authenticate, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT r.id, r.name, r.type, r.location, r.capacity,
             COUNT(o.id) as current_count
      FROM resources r
      LEFT JOIN occupancy o ON r.id = o.resource_id AND o.checked_out_at IS NULL
      GROUP BY r.id, r.name, r.type, r.location, r.capacity
      ORDER BY r.name
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('Get occupancy error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// GET /api/occupancy/:resourceId/people - who is currently checked in
router.get('/:resourceId/people', authenticate, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT o.id, o.checked_in_at, u.name, u.role, u.department
      FROM occupancy o
      JOIN users u ON o.user_id = u.id
      WHERE o.resource_id = $1 AND o.checked_out_at IS NULL
      ORDER BY o.checked_in_at DESC
    `, [req.params.resourceId]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// POST /api/occupancy/checkin
router.post('/checkin', authenticate, async (req, res) => {
  try {
    const { resource_id } = req.body;
    if (!resource_id) return res.status(400).json({ error: 'resource_id required.' });

    // Already checked in?
    const already = await db.query(
      'SELECT id FROM occupancy WHERE resource_id = $1 AND user_id = $2 AND checked_out_at IS NULL',
      [resource_id, req.user.id]
    );
    if (already.rows.length > 0) {
      return res.status(400).json({ error: 'Already checked in to this venue.' });
    }

    const result = await db.query(
      'INSERT INTO occupancy (resource_id, user_id) VALUES ($1, $2) RETURNING *',
      [resource_id, req.user.id]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Check-in error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// POST /api/occupancy/checkout
router.post('/checkout', authenticate, async (req, res) => {
  try {
    const { resource_id } = req.body;
    if (!resource_id) return res.status(400).json({ error: 'resource_id required.' });

    const result = await db.query(
      `UPDATE occupancy SET checked_out_at = NOW()
       WHERE resource_id = $1 AND user_id = $2 AND checked_out_at IS NULL
       RETURNING *`,
      [resource_id, req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No active check-in found for this venue.' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Check-out error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// GET /api/occupancy/my-checkins
router.get('/my-checkins', authenticate, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT o.*, r.name as resource_name, r.location
      FROM occupancy o
      JOIN resources r ON o.resource_id = r.id
      WHERE o.user_id = $1 AND o.checked_out_at IS NULL
    `, [req.user.id]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

module.exports = router;
