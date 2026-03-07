const express = require('express');
const { body } = require('express-validator');
const db = require('../db/pool');
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

const router = express.Router();

// GET /api/exam-allocations
router.get('/', authenticate, async (req, res) => {
  try {
    const { department, date, status } = req.query;
    let query = `
      SELECT ea.*, r.name as resource_name, r.type as resource_type,
             r.location, r.capacity, u.name as allocated_by_name
      FROM exam_allocations ea
      JOIN resources r ON ea.resource_id = r.id
      JOIN users u ON ea.allocated_by = u.id
      WHERE 1=1
    `;
    const params = [];

    if (department) {
      params.push(department);
      query += ` AND ea.department = $${params.length}`;
    }
    if (date) {
      params.push(date);
      query += ` AND ea.date = $${params.length}`;
    }
    if (status) {
      params.push(status);
      query += ` AND ea.status = $${params.length}`;
    }

    query += ' ORDER BY ea.date DESC, ea.start_time ASC';
    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Get exam allocations error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// GET /api/exam-allocations/suitable-venues?num_students=50&date=2026-03-10&start_time=09:00&end_time=12:00
router.get('/suitable-venues', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { num_students, date, start_time, end_time } = req.query;

    if (!num_students || !date || !start_time || !end_time) {
      return res.status(400).json({ error: 'num_students, date, start_time, and end_time required.' });
    }

    // Find venues with enough capacity, not already booked/allocated at that time
    const result = await db.query(`
      SELECT r.* FROM resources r
      WHERE r.capacity >= $1
        AND r.status = 'available'
        AND r.id NOT IN (
          SELECT resource_id FROM bookings
          WHERE date = $2 AND status IN ('approved','pending')
            AND start_time < $4 AND end_time > $3
        )
        AND r.id NOT IN (
          SELECT resource_id FROM exam_allocations
          WHERE date = $2 AND status IN ('scheduled','ongoing')
            AND start_time < $4 AND end_time > $3
        )
        AND r.id NOT IN (
          SELECT resource_id FROM assignments
          WHERE date = $2 AND status = 'active'
            AND start_time < $4 AND end_time > $3
        )
      ORDER BY r.capacity ASC
    `, [parseInt(num_students), date, start_time, end_time]);

    res.json(result.rows);
  } catch (err) {
    console.error('Get suitable venues error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// GET /api/exam-allocations/departments
router.get('/departments', authenticate, async (req, res) => {
  try {
    const result = await db.query(
      "SELECT DISTINCT department FROM users WHERE department IS NOT NULL AND department != '' ORDER BY department"
    );
    res.json(result.rows.map(r => r.department));
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// POST /api/exam-allocations
router.post(
  '/',
  authenticate,
  authorize('admin'),
  [
    body('resource_id').isInt(),
    body('department').trim().notEmpty(),
    body('num_students').isInt({ min: 1 }),
    body('exam_name').trim().notEmpty(),
    body('date').isDate(),
    body('start_time').matches(/^\d{2}:\d{2}$/),
    body('end_time').matches(/^\d{2}:\d{2}$/),
    body('notes').optional().trim(),
  ],
  validate,
  async (req, res) => {
    try {
      const { resource_id, department, num_students, exam_name, date, start_time, end_time, notes } = req.body;

      // Check venue capacity
      const venue = await db.query('SELECT * FROM resources WHERE id = $1', [resource_id]);
      if (venue.rows.length === 0) return res.status(404).json({ error: 'Venue not found.' });

      if (venue.rows[0].capacity && venue.rows[0].capacity < num_students) {
        return res.status(400).json({
          error: `Venue capacity (${venue.rows[0].capacity}) is less than required students (${num_students}).`
        });
      }

      // Check conflicts
      const conflicts = await db.query(`
        SELECT ea.*, r.name as resource_name FROM exam_allocations ea
        JOIN resources r ON ea.resource_id = r.id
        WHERE ea.resource_id = $1 AND ea.date = $2 AND ea.status IN ('scheduled','ongoing')
          AND ea.start_time < $4 AND ea.end_time > $3
      `, [resource_id, date, start_time, end_time]);

      if (conflicts.rows.length > 0) {
        return res.status(409).json({
          error: 'Venue already has an exam allocated at this time.',
          conflicts: conflicts.rows
        });
      }

      const result = await db.query(
        `INSERT INTO exam_allocations (resource_id, department, num_students, exam_name, date, start_time, end_time, allocated_by, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
        [resource_id, department, num_students, exam_name, date, start_time, end_time, req.user.id, notes || null]
      );

      res.status(201).json(result.rows[0]);
    } catch (err) {
      console.error('Create exam allocation error:', err);
      res.status(500).json({ error: 'Server error.' });
    }
  }
);

// PUT /api/exam-allocations/:id/status
router.put(
  '/:id/status',
  authenticate,
  authorize('admin'),
  [
    body('status').isIn(['scheduled', 'ongoing', 'completed', 'cancelled']),
  ],
  validate,
  async (req, res) => {
    try {
      const result = await db.query(
        'UPDATE exam_allocations SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
        [req.body.status, req.params.id]
      );
      if (result.rows.length === 0) return res.status(404).json({ error: 'Not found.' });
      res.json(result.rows[0]);
    } catch (err) {
      res.status(500).json({ error: 'Server error.' });
    }
  }
);

// DELETE /api/exam-allocations/:id
router.delete('/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const result = await db.query('DELETE FROM exam_allocations WHERE id = $1 RETURNING id', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found.' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

module.exports = router;
