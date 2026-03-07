const express = require('express');
const { body } = require('express-validator');
const db = require('../db/pool');
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

const router = express.Router();

// GET /api/student-assignments - list student assignments
router.get('/', authenticate, async (req, res) => {
  try {
    let query = `
      SELECT sa.*,
             s.name as student_name, s.email as student_email, s.department as student_department,
             ab.name as assigned_by_name, ab.role as assigned_by_role,
             r.name as resource_name, r.type as resource_type, r.location as resource_location
      FROM student_assignments sa
      LEFT JOIN users s ON sa.student_id = s.id
      JOIN users ab ON sa.assigned_by = ab.id
      LEFT JOIN resources r ON sa.resource_id = r.id
      WHERE 1=1
    `;
    const params = [];

    // Students see only their own + broadcast assignments
    if (req.user.role === 'student') {
      params.push(req.user.id);
      query += ` AND (sa.student_id = $${params.length} OR sa.target = 'all_students')`;
    }

    query += ' ORDER BY sa.date DESC NULLS LAST, sa.created_at DESC';
    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('List student assignments error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// POST /api/student-assignments - admin or staff assigns activity to student
router.post(
  '/',
  authenticate,
  authorize('admin', 'staff'),
  [
    body('title').trim().notEmpty().withMessage('Title required'),
    body('description').optional().trim(),
    body('student_id').optional({ nullable: true }).isInt(),
    body('resource_id').optional({ nullable: true }).isInt(),
    body('date').optional().isDate(),
    body('start_time').optional().matches(/^\d{2}:\d{2}$/),
    body('end_time').optional().matches(/^\d{2}:\d{2}$/),
    body('target').optional().isIn(['specific', 'all_students']),
  ],
  validate,
  async (req, res) => {
    try {
      const { title, description, student_id, resource_id, date, start_time, end_time, target } = req.body;

      const assignTarget = target || (student_id ? 'specific' : 'all_students');

      if (assignTarget === 'specific' && !student_id) {
        return res.status(400).json({ error: 'Student ID required for specific assignment.' });
      }

      // Verify student exists
      if (student_id) {
        const student = await db.query("SELECT id FROM users WHERE id = $1 AND role = 'student'", [student_id]);
        if (student.rows.length === 0) {
          return res.status(404).json({ error: 'Student not found.' });
        }
      }

      const result = await db.query(
        `INSERT INTO student_assignments (student_id, assigned_by, resource_id, title, description, date, start_time, end_time, target)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
        [student_id || null, req.user.id, resource_id || null, title, description || null,
         date || null, start_time || null, end_time || null, assignTarget]
      );

      res.status(201).json(result.rows[0]);
    } catch (err) {
      console.error('Create student assignment error:', err);
      res.status(500).json({ error: 'Server error.' });
    }
  }
);

// PUT /api/student-assignments/:id/status
router.put(
  '/:id/status',
  authenticate,
  [
    body('status').isIn(['active', 'cancelled', 'completed']).withMessage('Invalid status'),
  ],
  validate,
  async (req, res) => {
    try {
      // Students can only update their own assignments
      if (req.user.role === 'student') {
        const check = await db.query(
          "SELECT id FROM student_assignments WHERE id = $1 AND (student_id = $2 OR target = 'all_students')",
          [req.params.id, req.user.id]
        );
        if (check.rows.length === 0) {
          return res.status(403).json({ error: 'Not authorized.' });
        }
      }
      const result = await db.query(
        'UPDATE student_assignments SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
        [req.body.status, req.params.id]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Assignment not found.' });
      }
      res.json(result.rows[0]);
    } catch (err) {
      console.error('Update student assignment error:', err);
      res.status(500).json({ error: 'Server error.' });
    }
  }
);

module.exports = router;
