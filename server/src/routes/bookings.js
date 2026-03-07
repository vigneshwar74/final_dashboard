const express = require('express');
const { body } = require('express-validator');
const db = require('../db/pool');
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

const router = express.Router();

// GET /api/bookings - list bookings
router.get('/', authenticate, async (req, res) => {
  try {
    const { status, resource_id, date, my } = req.query;
    let query = `
      SELECT b.*, r.name as resource_name, r.type as resource_type, r.location as resource_location,
             u.name as user_name, u.email as user_email
      FROM bookings b
      JOIN resources r ON b.resource_id = r.id
      JOIN users u ON b.user_id = u.id
      WHERE 1=1
    `;
    const params = [];

    // Non-admin users can only see their own bookings by default
    if (req.user.role === 'student') {
      params.push(req.user.id);
      query += ` AND b.user_id = $${params.length}`;
    } else if (my === 'true') {
      params.push(req.user.id);
      query += ` AND b.user_id = $${params.length}`;
    }

    if (status) {
      params.push(status);
      query += ` AND b.status = $${params.length}`;
    }
    if (resource_id) {
      params.push(resource_id);
      query += ` AND b.resource_id = $${params.length}`;
    }
    if (date) {
      params.push(date);
      query += ` AND b.date = $${params.length}`;
    }

    query += ' ORDER BY b.date DESC, b.start_time ASC';
    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('List bookings error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// GET /api/bookings/:id
router.get('/:id', authenticate, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT b.*, r.name as resource_name, r.type as resource_type,
              u.name as user_name, u.email as user_email
       FROM bookings b
       JOIN resources r ON b.resource_id = r.id
       JOIN users u ON b.user_id = u.id
       WHERE b.id = $1`,
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Booking not found.' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Get booking error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// GET /api/bookings/available-resources - get resources available for a given time slot
router.get('/available-resources', authenticate, authorize('staff'), async (req, res) => {
  try {
    const { date, start_time, end_time } = req.query;
    if (!date || !start_time || !end_time) {
      return res.status(400).json({ error: 'date, start_time, end_time are required.' });
    }

    // Get resources not under maintenance and not booked/assigned for this slot
    const result = await db.query(
      `SELECT r.* FROM resources r
       WHERE r.status != 'maintenance'
         AND r.id NOT IN (
           SELECT b.resource_id FROM bookings b
           WHERE b.date = $1 AND b.status IN ('pending','approved')
             AND b.start_time < $3 AND b.end_time > $2
         )
         AND r.id NOT IN (
           SELECT a.resource_id FROM assignments a
           WHERE a.date = $1 AND a.status = 'active'
             AND a.start_time < $3 AND a.end_time > $2
         )
       ORDER BY r.type, r.name`,
      [date, start_time, end_time]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Available resources error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// POST /api/bookings - staff only can create
router.post(
  '/',
  authenticate,
  authorize('staff'),
  [
    body('resource_id').isInt().withMessage('Resource ID required'),
    body('date').isDate().withMessage('Valid date required (YYYY-MM-DD)'),
    body('start_time').matches(/^\d{2}:\d{2}$/).withMessage('Start time required (HH:MM)'),
    body('end_time').matches(/^\d{2}:\d{2}$/).withMessage('End time required (HH:MM)'),
    body('purpose').optional().trim(),
  ],
  validate,
  async (req, res) => {
    try {
      const { resource_id, date, start_time, end_time, purpose } = req.body;

      // Validate time ordering
      if (start_time >= end_time) {
        return res.status(400).json({ error: 'End time must be after start time.' });
      }

      // Check resource exists and is available
      const resource = await db.query('SELECT * FROM resources WHERE id = $1', [resource_id]);
      if (resource.rows.length === 0) {
        return res.status(404).json({ error: 'Resource not found.' });
      }
      if (resource.rows[0].status === 'maintenance') {
        return res.status(400).json({ error: 'Resource is under maintenance.' });
      }

      // Check for overlapping bookings on the same venue
      const overlap = await db.query(
        `SELECT id FROM bookings
         WHERE resource_id = $1
           AND date = $2
           AND status IN ('pending','approved')
           AND start_time < $4
           AND end_time > $3`,
        [resource_id, date, start_time, end_time]
      );
      if (overlap.rows.length > 0) {
        return res.status(409).json({ error: 'This venue is already booked for the selected time slot.' });
      }

      // Check for overlapping assignments on the same venue
      const assignmentOverlap = await db.query(
        `SELECT id FROM assignments
         WHERE resource_id = $1
           AND date = $2
           AND status = 'active'
           AND start_time < $4
           AND end_time > $3`,
        [resource_id, date, start_time, end_time]
      );
      if (assignmentOverlap.rows.length > 0) {
        return res.status(409).json({ error: 'This venue has an assigned activity during the selected time slot.' });
      }

      // Check if the staff member already has a booking/assignment at this time
      const staffConflict = await db.query(
        `SELECT id, 'booking' as type FROM bookings
         WHERE user_id = $1 AND date = $2 AND status IN ('pending','approved')
           AND start_time < $4 AND end_time > $3
         UNION ALL
         SELECT id, 'assignment' as type FROM assignments
         WHERE staff_id = $1 AND date = $2 AND status = 'active'
           AND start_time < $4 AND end_time > $3`,
        [req.user.id, date, start_time, end_time]
      );
      if (staffConflict.rows.length > 0) {
        return res.status(409).json({ error: 'You already have a booking or assignment during this time slot.' });
      }

      // Staff bookings are always pending (admin must approve)
      const bookingStatus = 'pending';

      const result = await db.query(
        `INSERT INTO bookings (resource_id, user_id, date, start_time, end_time, purpose, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [resource_id, req.user.id, date, start_time, end_time, purpose || null, bookingStatus]
      );

      // Fetch full booking with joins
      const full = await db.query(
        `SELECT b.*, r.name as resource_name, r.type as resource_type,
                u.name as user_name, u.email as user_email
         FROM bookings b
         JOIN resources r ON b.resource_id = r.id
         JOIN users u ON b.user_id = u.id
         WHERE b.id = $1`,
        [result.rows[0].id]
      );

      // Notify admin about new booking
      const { createNotification } = require('./notifications');
      const { logAudit } = require('./auditLog');
      const io = req.app.get('io');

      await createNotification(io, {
        role: 'admin',
        type: 'new_booking',
        title: 'New Booking Request',
        body: `${req.user.name} requested ${full.rows[0].resource_name} on ${date}`,
        link: '/approvals',
      });

      await logAudit({
        user_id: req.user.id, user_name: req.user.name, user_role: req.user.role,
        action: 'booking_created', entity_type: 'booking', entity_id: result.rows[0].id,
        details: { resource_id, date, start_time, end_time, purpose },
      });

      res.status(201).json(full.rows[0]);
    } catch (err) {
      console.error('Create booking error:', err);
      res.status(500).json({ error: 'Server error.' });
    }
  }
);

// PUT /api/bookings/:id/status - admin approve/reject
router.put(
  '/:id/status',
  authenticate,
  authorize('admin'),
  [
    body('status').isIn(['approved', 'rejected', 'cancelled', 'completed']).withMessage('Invalid status'),
    body('admin_note').optional().trim(),
  ],
  validate,
  async (req, res) => {
    try {
      const { status, admin_note } = req.body;

      const existing = await db.query('SELECT * FROM bookings WHERE id = $1', [req.params.id]);
      if (existing.rows.length === 0) {
        return res.status(404).json({ error: 'Booking not found.' });
      }

      const result = await db.query(
        `UPDATE bookings SET status = $1, admin_note = $2, updated_at = NOW()
         WHERE id = $3 RETURNING *`,
        [status, admin_note || null, req.params.id]
      );

      // Send notification to the booking owner
      const { createNotification } = require('./notifications');
      const { logAudit } = require('./auditLog');
      const io = req.app.get('io');
      const booking = existing.rows[0];

      await createNotification(io, {
        user_id: booking.user_id,
        type: 'booking_status',
        title: `Booking ${status}`,
        body: `Your booking for ${booking.date} has been ${status}.${admin_note ? ' Note: ' + admin_note : ''}`,
        link: '/bookings',
      });

      await logAudit({
        user_id: req.user.id, user_name: req.user.name, user_role: req.user.role,
        action: `booking_${status}`, entity_type: 'booking', entity_id: booking.id,
        details: { resource_id: booking.resource_id, date: booking.date, admin_note },
      });

      res.json(result.rows[0]);
    } catch (err) {
      console.error('Update booking status error:', err);
      res.status(500).json({ error: 'Server error.' });
    }
  }
);

// DELETE /api/bookings/:id - cancel own booking
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const existing = await db.query('SELECT * FROM bookings WHERE id = $1', [req.params.id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Booking not found.' });
    }

    const booking = existing.rows[0];
    if (req.user.role !== 'admin' && booking.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Cannot cancel another user\'s booking.' });
    }

    await db.query(
      "UPDATE bookings SET status = 'cancelled', updated_at = NOW() WHERE id = $1",
      [req.params.id]
    );

    res.json({ message: 'Booking cancelled.' });
  } catch (err) {
    console.error('Cancel booking error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

module.exports = router;
