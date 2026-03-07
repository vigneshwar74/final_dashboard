const express = require('express');
const { body } = require('express-validator');
const db = require('../db/pool');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

const router = express.Router();

// GET /api/feedback - get feedback for a resource or all
router.get('/', authenticate, async (req, res) => {
  try {
    const { resource_id } = req.query;
    let query = `
      SELECT f.*, u.name as user_name, u.role as user_role,
             r.name as resource_name, r.type as resource_type
      FROM feedback f
      JOIN users u ON f.user_id = u.id
      JOIN resources r ON f.resource_id = r.id
    `;
    const params = [];

    if (resource_id) {
      params.push(resource_id);
      query += ` WHERE f.resource_id = $${params.length}`;
    }

    query += ' ORDER BY f.created_at DESC';
    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Get feedback error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// GET /api/feedback/resource-ratings - avg ratings per resource
router.get('/resource-ratings', authenticate, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT r.id, r.name, r.type, r.location,
             ROUND(AVG(f.rating)::numeric,1) as avg_rating,
             COUNT(f.id) as review_count
      FROM resources r
      LEFT JOIN feedback f ON r.id = f.resource_id
      GROUP BY r.id, r.name, r.type, r.location
      ORDER BY avg_rating DESC NULLS LAST
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// POST /api/feedback
router.post(
  '/',
  authenticate,
  [
    body('resource_id').isInt().withMessage('Resource ID required'),
    body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be 1-5'),
    body('comment').optional().trim(),
    body('booking_id').optional({ nullable: true }).isInt(),
  ],
  validate,
  async (req, res) => {
    try {
      const { resource_id, booking_id, rating, comment } = req.body;

      // Check if already rated this booking
      if (booking_id) {
        const existing = await db.query(
          'SELECT id FROM feedback WHERE booking_id = $1', [booking_id]
        );
        if (existing.rows.length > 0) {
          return res.status(400).json({ error: 'You have already rated this booking.' });
        }
      }

      const result = await db.query(
        `INSERT INTO feedback (resource_id, booking_id, user_id, rating, comment)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [resource_id, booking_id || null, req.user.id, rating, comment || null]
      );

      res.status(201).json(result.rows[0]);
    } catch (err) {
      console.error('Create feedback error:', err);
      res.status(500).json({ error: 'Server error.' });
    }
  }
);

module.exports = router;
