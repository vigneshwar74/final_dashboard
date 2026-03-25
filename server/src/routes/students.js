const express = require('express');
const { body } = require('express-validator');
const db = require('../db/pool');
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

const router = express.Router();

// GET /api/students - list all students (admin only)
router.get('/', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { department, search } = req.query;
    let query = 'SELECT * FROM students WHERE 1=1';
    const params = [];

    if (department) {
      params.push(department);
      query += ` AND department = $${params.length}`;
    }
    if (search) {
      params.push(`%${search}%`);
      query += ` AND (name ILIKE $${params.length} OR roll_number ILIKE $${params.length})`;
    }

    query += ' ORDER BY department, roll_number';
    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('List students error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// GET /api/students/departments - list distinct departments from students table
router.get('/departments', authenticate, authorize('admin'), async (req, res) => {
  try {
    const result = await db.query(
      "SELECT DISTINCT department FROM students WHERE department IS NOT NULL ORDER BY department"
    );
    res.json(result.rows.map(r => r.department));
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// GET /api/students/by-department - students grouped by department with counts (admin only)
router.get('/by-department', authenticate, authorize('admin'), async (req, res) => {
  try {
    const result = await db.query(
      'SELECT department, COUNT(*) as count FROM students GROUP BY department ORDER BY department'
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// GET /api/students/available - get students available for exam on given date+time
// Excludes students already allocated to a scheduled/ongoing exam that overlaps the given time range
router.get('/available', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { department, date, start_time, end_time } = req.query;
    if (!department) {
      return res.status(400).json({ error: 'department query param required.' });
    }

    let query = `
      SELECT s.* FROM students s
      WHERE s.department = $1
    `;
    const params = [department];

    if (date && start_time && end_time) {
      params.push(date, start_time, end_time);
      query += `
        AND s.id NOT IN (
          SELECT esa.student_id FROM exam_student_allocations esa
          JOIN exam_allocations ea ON esa.exam_allocation_id = ea.id
          WHERE ea.date = $${params.length - 2}
            AND ea.status IN ('scheduled', 'ongoing')
            AND ea.start_time < $${params.length}
            AND ea.end_time > $${params.length - 1}
        )
      `;
    } else if (date) {
      params.push(date);
      query += `
        AND s.id NOT IN (
          SELECT esa.student_id FROM exam_student_allocations esa
          JOIN exam_allocations ea ON esa.exam_allocation_id = ea.id
          WHERE ea.date = $${params.length}
            AND ea.status IN ('scheduled', 'ongoing')
        )
      `;
    }

    query += ' ORDER BY s.roll_number';
    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Available students error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// GET /api/students/stats - stats for dashboard (admin only)
router.get('/stats', authenticate, authorize('admin'), async (req, res) => {
  try {
    const total = await db.query('SELECT COUNT(*) as count FROM students');
    const byDept = await db.query(
      'SELECT department, COUNT(*) as count FROM students GROUP BY department ORDER BY department'
    );
    res.json({
      total: parseInt(total.rows[0].count),
      byDepartment: byDept.rows,
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// POST /api/students - add a student (admin only)
router.post(
  '/',
  authenticate,
  authorize('admin'),
  [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('roll_number').trim().notEmpty().withMessage('Roll number is required'),
    body('department').trim().notEmpty().withMessage('Department is required'),
    body('year').optional().trim(),
    body('email').optional().isEmail().withMessage('Invalid email'),
  ],
  validate,
  async (req, res) => {
    try {
      const { name, roll_number, department, year, email } = req.body;

      // Check uniqueness
      const exists = await db.query('SELECT id FROM students WHERE roll_number = $1', [roll_number]);
      if (exists.rows.length > 0) {
        return res.status(409).json({ error: 'A student with this roll number already exists.' });
      }

      const result = await db.query(
        `INSERT INTO students (name, roll_number, department, year, email)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [name, roll_number, department, year || null, email || null]
      );
      res.status(201).json(result.rows[0]);
    } catch (err) {
      console.error('Create student error:', err);
      res.status(500).json({ error: 'Server error.' });
    }
  }
);

// PUT /api/students/:id - update student (admin only)
router.put(
  '/:id',
  authenticate,
  authorize('admin'),
  [
    body('name').trim().notEmpty(),
    body('roll_number').trim().notEmpty(),
    body('department').trim().notEmpty(),
    body('year').optional().trim(),
    body('email').optional().isEmail(),
  ],
  validate,
  async (req, res) => {
    try {
      const { name, roll_number, department, year, email } = req.body;

      // Check uniqueness (exclude current)
      const exists = await db.query(
        'SELECT id FROM students WHERE roll_number = $1 AND id != $2',
        [roll_number, req.params.id]
      );
      if (exists.rows.length > 0) {
        return res.status(409).json({ error: 'Another student with this roll number exists.' });
      }

      const result = await db.query(
        `UPDATE students SET name=$1, roll_number=$2, department=$3, year=$4, email=$5, updated_at=NOW()
         WHERE id=$6 RETURNING *`,
        [name, roll_number, department, year || null, email || null, req.params.id]
      );
      if (result.rows.length === 0) return res.status(404).json({ error: 'Student not found.' });
      res.json(result.rows[0]);
    } catch (err) {
      console.error('Update student error:', err);
      res.status(500).json({ error: 'Server error.' });
    }
  }
);

// DELETE /api/students/:id - remove student (admin only)
router.delete('/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const result = await db.query('DELETE FROM students WHERE id = $1 RETURNING id', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Student not found.' });
    res.json({ success: true });
  } catch (err) {
    console.error('Delete student error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

module.exports = router;
