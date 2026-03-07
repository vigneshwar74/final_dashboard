const express = require('express');
const { body } = require('express-validator');
const db = require('../db/pool');
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

const router = express.Router();

// GET /api/assignments - list assignments
router.get('/', authenticate, async (req, res) => {
  try {
    const { status, staff_id, date } = req.query;
    let query = `
      SELECT a.*, r.name as resource_name, r.type as resource_type, r.location as resource_location,
             r.building as resource_building,
             s.name as staff_name, s.email as staff_email, s.department as staff_department,
             ab.name as assigned_by_name
      FROM assignments a
      JOIN resources r ON a.resource_id = r.id
      JOIN users s ON a.staff_id = s.id
      JOIN users ab ON a.assigned_by = ab.id
      WHERE 1=1
    `;
    const params = [];

    // Staff can only see their own assignments
    if (req.user.role === 'staff') {
      params.push(req.user.id);
      query += ` AND a.staff_id = $${params.length}`;
    }

    if (status) {
      params.push(status);
      query += ` AND a.status = $${params.length}`;
    }
    if (staff_id && req.user.role === 'admin') {
      params.push(staff_id);
      query += ` AND a.staff_id = $${params.length}`;
    }
    if (date) {
      params.push(date);
      query += ` AND a.date = $${params.length}`;
    }

    query += ' ORDER BY a.date DESC, a.start_time ASC';
    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('List assignments error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// POST /api/assignments - admin assigns staff to venue
router.post(
  '/',
  authenticate,
  authorize('admin'),
  [
    body('resource_id').isInt().withMessage('Resource ID required'),
    body('staff_id').isInt().withMessage('Staff ID required'),
    body('date').isDate().withMessage('Valid date required'),
    body('start_time').matches(/^\d{2}:\d{2}$/).withMessage('Start time required (HH:MM)'),
    body('end_time').matches(/^\d{2}:\d{2}$/).withMessage('End time required (HH:MM)'),
    body('title').trim().notEmpty().withMessage('Title required'),
    body('description').optional().trim(),
  ],
  validate,
  async (req, res) => {
    try {
      const { resource_id, staff_id, date, start_time, end_time, title, description } = req.body;

      if (start_time >= end_time) {
        return res.status(400).json({ error: 'End time must be after start time.' });
      }

      // Verify staff exists and is a staff user
      const staffUser = await db.query("SELECT * FROM users WHERE id = $1 AND role = 'staff'", [staff_id]);
      if (staffUser.rows.length === 0) {
        return res.status(404).json({ error: 'Staff member not found.' });
      }

      // Check resource exists
      const resource = await db.query('SELECT * FROM resources WHERE id = $1', [resource_id]);
      if (resource.rows.length === 0) {
        return res.status(404).json({ error: 'Resource not found.' });
      }
      if (resource.rows[0].status === 'maintenance') {
        return res.status(400).json({ error: 'Resource is under maintenance.' });
      }

      // Check if staff is available (no overlapping assignments or bookings)
      const staffConflict = await db.query(
        `SELECT id, 'assignment' as type FROM assignments
         WHERE staff_id = $1 AND date = $2 AND status = 'active'
           AND start_time < $4 AND end_time > $3
         UNION ALL
         SELECT id, 'booking' as type FROM bookings
         WHERE user_id = $1 AND date = $2 AND status IN ('pending','approved')
           AND start_time < $4 AND end_time > $3`,
        [staff_id, date, start_time, end_time]
      );
      if (staffConflict.rows.length > 0) {
        return res.status(409).json({ error: 'Staff member is not available during this time slot. They have a conflicting booking or assignment.' });
      }

      // Check venue conflict (no overlapping bookings or assignments on the same resource)
      const venueConflict = await db.query(
        `SELECT id, 'assignment' as type FROM assignments
         WHERE resource_id = $1 AND date = $2 AND status = 'active'
           AND start_time < $4 AND end_time > $3
         UNION ALL
         SELECT id, 'booking' as type FROM bookings
         WHERE resource_id = $1 AND date = $2 AND status IN ('pending','approved')
           AND start_time < $4 AND end_time > $3`,
        [resource_id, date, start_time, end_time]
      );
      if (venueConflict.rows.length > 0) {
        return res.status(409).json({ error: 'Venue is already booked or assigned during this time slot.' });
      }

      const result = await db.query(
        `INSERT INTO assignments (resource_id, staff_id, date, start_time, end_time, title, description, assigned_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
        [resource_id, staff_id, date, start_time, end_time, title, description || null, req.user.id]
      );

      // Fetch full assignment
      const full = await db.query(
        `SELECT a.*, r.name as resource_name, r.type as resource_type, r.location as resource_location,
                s.name as staff_name, s.email as staff_email, s.department as staff_department,
                ab.name as assigned_by_name
         FROM assignments a
         JOIN resources r ON a.resource_id = r.id
         JOIN users s ON a.staff_id = s.id
         JOIN users ab ON a.assigned_by = ab.id
         WHERE a.id = $1`,
        [result.rows[0].id]
      );

      res.status(201).json(full.rows[0]);
    } catch (err) {
      console.error('Create assignment error:', err);
      res.status(500).json({ error: 'Server error.' });
    }
  }
);

// PUT /api/assignments/:id/status - update assignment status
router.put(
  '/:id/status',
  authenticate,
  authorize('admin'),
  [
    body('status').isIn(['active', 'cancelled', 'completed']).withMessage('Invalid status'),
  ],
  validate,
  async (req, res) => {
    try {
      const result = await db.query(
        'UPDATE assignments SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
        [req.body.status, req.params.id]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Assignment not found.' });
      }
      res.json(result.rows[0]);
    } catch (err) {
      console.error('Update assignment error:', err);
      res.status(500).json({ error: 'Server error.' });
    }
  }
);

// DELETE /api/assignments/:id
router.delete('/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const result = await db.query('DELETE FROM assignments WHERE id = $1 RETURNING id', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Assignment not found.' });
    }
    res.json({ message: 'Assignment deleted.' });
  } catch (err) {
    console.error('Delete assignment error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// GET /api/assignments/staff-list - get all staff for dropdown
router.get('/staff-list', authenticate, authorize('admin'), async (req, res) => {
  try {
    const result = await db.query("SELECT id, name, email, department FROM users WHERE role = 'staff' ORDER BY name");
    res.json(result.rows);
  } catch (err) {
    console.error('Staff list error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// GET /api/assignments/check-availability - check if staff is available
router.get('/check-availability', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { staff_id, date, start_time, end_time } = req.query;
    if (!staff_id || !date || !start_time || !end_time) {
      return res.status(400).json({ error: 'staff_id, date, start_time, end_time required.' });
    }

    const conflicts = await db.query(
      `SELECT a.id, a.title, 'assignment' as type, a.start_time, a.end_time, r.name as resource_name
       FROM assignments a JOIN resources r ON a.resource_id = r.id
       WHERE a.staff_id = $1 AND a.date = $2 AND a.status = 'active'
         AND a.start_time < $4 AND a.end_time > $3
       UNION ALL
       SELECT b.id, b.purpose as title, 'booking' as type, b.start_time, b.end_time, r.name as resource_name
       FROM bookings b JOIN resources r ON b.resource_id = r.id
       WHERE b.user_id = $1 AND b.date = $2 AND b.status IN ('pending','approved')
         AND b.start_time < $4 AND b.end_time > $3`,
      [staff_id, date, start_time, end_time]
    );

    res.json({
      available: conflicts.rows.length === 0,
      conflicts: conflicts.rows,
    });
  } catch (err) {
    console.error('Check availability error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

module.exports = router;
