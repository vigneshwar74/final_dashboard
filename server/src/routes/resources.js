const express = require('express');
const { body, param } = require('express-validator');
const db = require('../db/pool');
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

const router = express.Router();

// GET /api/resources - list all resources (any authenticated user)
router.get('/', authenticate, async (req, res) => {
  try {
    const { type, status, search } = req.query;
    let query = 'SELECT * FROM resources WHERE 1=1';
    const params = [];

    if (type) {
      params.push(type);
      query += ` AND type = $${params.length}`;
    }
    if (status) {
      params.push(status);
      query += ` AND status = $${params.length}`;
    }
    if (search) {
      params.push(`%${search}%`);
      query += ` AND (name ILIKE $${params.length} OR location ILIKE $${params.length} OR building ILIKE $${params.length})`;
    }

    query += ' ORDER BY type, name';
    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('List resources error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// GET /api/resources/:id
router.get('/:id', authenticate, async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM resources WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Resource not found.' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Get resource error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// POST /api/resources - admin only
router.post(
  '/',
  authenticate,
  authorize('admin'),
  [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('type').isIn(['classroom', 'lab', 'equipment', 'computer']).withMessage('Invalid type'),
    body('status').optional().isIn(['available', 'in_use', 'maintenance']),
    body('capacity').optional({ nullable: true }).isInt({ min: 1 }),
  ],
  validate,
  async (req, res) => {
    try {
      const { name, type, location, building, capacity, status, description } = req.body;
      const result = await db.query(
        `INSERT INTO resources (name, type, location, building, capacity, status, description)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [name, type, location || null, building || null, capacity || null, status || 'available', description || null]
      );
      res.status(201).json(result.rows[0]);
    } catch (err) {
      console.error('Create resource error:', err);
      res.status(500).json({ error: 'Server error.' });
    }
  }
);

// PUT /api/resources/:id - admin only
router.put(
  '/:id',
  authenticate,
  authorize('admin'),
  [
    body('name').optional().trim().notEmpty(),
    body('type').optional().isIn(['classroom', 'lab', 'equipment', 'computer']),
    body('status').optional().isIn(['available', 'in_use', 'maintenance']),
    body('capacity').optional({ nullable: true }).isInt({ min: 1 }),
  ],
  validate,
  async (req, res) => {
    try {
      const existing = await db.query('SELECT * FROM resources WHERE id = $1', [req.params.id]);
      if (existing.rows.length === 0) {
        return res.status(404).json({ error: 'Resource not found.' });
      }

      const current = existing.rows[0];
      const name = req.body.name ?? current.name;
      const type = req.body.type ?? current.type;
      const location = req.body.location ?? current.location;
      const building = req.body.building ?? current.building;
      const capacity = req.body.capacity ?? current.capacity;
      const status = req.body.status ?? current.status;
      const description = req.body.description ?? current.description;

      const result = await db.query(
        `UPDATE resources SET name=$1, type=$2, location=$3, building=$4, capacity=$5, status=$6, description=$7, updated_at=NOW()
         WHERE id=$8 RETURNING *`,
        [name, type, location, building, capacity, status, description, req.params.id]
      );
      res.json(result.rows[0]);
    } catch (err) {
      console.error('Update resource error:', err);
      res.status(500).json({ error: 'Server error.' });
    }
  }
);

// DELETE /api/resources/:id - admin only
router.delete('/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const result = await db.query('DELETE FROM resources WHERE id = $1 RETURNING id', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Resource not found.' });
    }
    res.json({ message: 'Resource deleted.' });
  } catch (err) {
    console.error('Delete resource error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

module.exports = router;
