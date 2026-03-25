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

// POST /api/exam-allocations/generate-seating
// Generates alternating-department seating with REAL student names from DB
// Checks conflicts: students already allocated on the same date are excluded
router.post('/generate-seating', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { resource_id, departments, exam_name, date, start_time, end_time } = req.body;
    // departments: [{ name: "Computer Science", count: 10 }, ...]

    if (!resource_id || !departments || !Array.isArray(departments) || departments.length < 1) {
      return res.status(400).json({ error: 'resource_id and departments array required.' });
    }
    if (!exam_name || !date || !start_time || !end_time) {
      return res.status(400).json({ error: 'exam_name, date, start_time, and end_time required.' });
    }

    for (const dept of departments) {
      if (!dept.name || !dept.count || dept.count < 1) {
        return res.status(400).json({ error: 'Each department must have a name and count >= 1.' });
      }
    }

    // Fetch venue info
    const venueResult = await db.query('SELECT * FROM resources WHERE id = $1', [resource_id]);
    if (venueResult.rows.length === 0) return res.status(404).json({ error: 'Venue not found.' });
    const venue = venueResult.rows[0];

    // For each department, fetch AVAILABLE students (not already allocated on this date)
    const deptStudents = [];
    const conflictWarnings = [];

    for (const dept of departments) {
      const availableResult = await db.query(`
        SELECT s.* FROM students s
        WHERE s.department = $1
          AND s.id NOT IN (
            SELECT esa.student_id FROM exam_student_allocations esa
            JOIN exam_allocations ea ON esa.exam_allocation_id = ea.id
            WHERE ea.date = $2
              AND ea.status IN ('scheduled', 'ongoing')
              AND ea.start_time < $4
              AND ea.end_time > $3
          )
        ORDER BY s.roll_number
        LIMIT $5
      `, [dept.name, date, start_time, end_time, dept.count]);

      if (availableResult.rows.length < dept.count) {
        conflictWarnings.push(
          `${dept.name}: only ${availableResult.rows.length} available out of ${dept.count} requested (${dept.count - availableResult.rows.length} already allocated on ${date} during ${start_time}–${end_time})`
        );
      }

      const students = availableResult.rows.map(s => ({
        studentId: s.id,
        department: s.department,
        rollNo: s.roll_number,
        name: s.name,
        seatNo: null,
      }));

      deptStudents.push({ name: dept.name, students, index: 0, requestedCount: dept.count });
    }

    const totalStudents = deptStudents.reduce((sum, d) => sum + d.students.length, 0);

    // Generate alternating seating: round-robin across departments
    const seating = [];
    let placed = 0;
    let lastDept = null;

    // Sort departments by count descending for better distribution
    deptStudents.sort((a, b) => b.students.length - a.students.length);

    while (placed < totalStudents) {
      let placedThisRound = false;
      for (const dept of deptStudents) {
        if (dept.index < dept.students.length && dept.name !== lastDept) {
          const student = dept.students[dept.index];
          placed++;
          student.seatNo = placed;
          seating.push(student);
          dept.index++;
          lastDept = dept.name;
          placedThisRound = true;
        }
      }
      // If only one dept remains and was lastDept, force place
      if (!placedThisRound) {
        for (const dept of deptStudents) {
          if (dept.index < dept.students.length) {
            const student = dept.students[dept.index];
            placed++;
            student.seatNo = placed;
            seating.push(student);
            dept.index++;
            lastDept = dept.name;
            break;
          }
        }
      }
    }

    // Skip a bench between students when venue has enough extra capacity
    const canSkipBench = venue.capacity && venue.capacity >= totalStudents * 2;
    if (canSkipBench) {
      let seatNum = 0;
      for (const student of seating) {
        seatNum++;
        student.seatNo = seatNum;
        seatNum++; // skip a bench
      }
    }

    res.json({
      venue: {
        id: venue.id,
        name: venue.name,
        location: venue.location,
        building: venue.building,
        capacity: venue.capacity,
      },
      exam_name,
      date,
      start_time,
      end_time,
      totalStudents,
      departments: deptStudents.map(d => ({ name: d.name, count: d.students.length, requested: d.requestedCount })),
      seating,
      conflictWarnings,
    });
  } catch (err) {
    console.error('Generate seating error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// POST /api/exam-allocations/save-seating - save generated seating to DB
router.post('/save-seating', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { resource_id, departments, exam_name, date, start_time, end_time, seating } = req.body;

    if (!resource_id || !exam_name || !date || !start_time || !end_time || !seating || !Array.isArray(seating)) {
      return res.status(400).json({ error: 'All fields and seating array required.' });
    }

    // Check venue conflicts
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

    // Check student conflicts (already allocated on this date+time)
    const studentIds = seating.filter(s => s.studentId).map(s => s.studentId);
    if (studentIds.length > 0) {
      const conflictStudents = await db.query(`
        SELECT s.name, s.roll_number, ea.exam_name FROM exam_student_allocations esa
        JOIN students s ON esa.student_id = s.id
        JOIN exam_allocations ea ON esa.exam_allocation_id = ea.id
        WHERE esa.student_id = ANY($1)
          AND ea.date = $2
          AND ea.status IN ('scheduled', 'ongoing')
          AND ea.start_time < $4
          AND ea.end_time > $3
      `, [studentIds, date, start_time, end_time]);

      if (conflictStudents.rows.length > 0) {
        return res.status(409).json({
          error: `${conflictStudents.rows.length} student(s) already allocated to exams on this date.`,
          conflictStudents: conflictStudents.rows,
        });
      }
    }

    const deptSummary = departments || [];
    const totalStudents = seating.length;
    const deptName = deptSummary.map(d => d.name).join(', ');

    // Create the exam allocation record
    const eaResult = await db.query(
      `INSERT INTO exam_allocations (resource_id, department, num_students, exam_name, date, start_time, end_time, allocated_by, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [resource_id, deptName, totalStudents, exam_name, date, start_time, end_time, req.user.id,
       `Departments: ${deptSummary.map(d => `${d.name}(${d.count})`).join(', ')}`]
    );

    const examAllocationId = eaResult.rows[0].id;

    // Save individual student allocations
    for (const s of seating) {
      if (s.studentId) {
        await db.query(
          'INSERT INTO exam_student_allocations (exam_allocation_id, student_id, seat_no) VALUES ($1, $2, $3)',
          [examAllocationId, s.studentId, s.seatNo]
        );
      }
    }

    res.status(201).json({
      success: true,
      exam_allocation_id: examAllocationId,
      studentsAllocated: studentIds.length,
    });
  } catch (err) {
    console.error('Save seating error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// GET /api/exam-allocations/:id/seating - get full seating details for a saved allocation
router.get('/:id/seating', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    // Get the allocation record with venue info
    const eaResult = await db.query(`
      SELECT ea.*, r.name as venue_name, r.type as venue_type, r.location, r.building, r.capacity,
             u.name as allocated_by_name
      FROM exam_allocations ea
      JOIN resources r ON ea.resource_id = r.id
      JOIN users u ON ea.allocated_by = u.id
      WHERE ea.id = $1
    `, [id]);

    if (eaResult.rows.length === 0) {
      return res.status(404).json({ error: 'Allocation not found.' });
    }

    const ea = eaResult.rows[0];

    // Get the student seating assignments
    const seatingResult = await db.query(`
      SELECT esa.seat_no, s.id as student_id, s.name, s.roll_number, s.department
      FROM exam_student_allocations esa
      JOIN students s ON esa.student_id = s.id
      WHERE esa.exam_allocation_id = $1
      ORDER BY esa.seat_no
    `, [id]);

    // Build department summary
    const deptMap = {};
    seatingResult.rows.forEach(s => {
      if (!deptMap[s.department]) deptMap[s.department] = 0;
      deptMap[s.department]++;
    });
    const departments = Object.entries(deptMap).map(([name, count]) => ({ name, count }));

    res.json({
      id: ea.id,
      venue: {
        id: ea.resource_id,
        name: ea.venue_name,
        type: ea.venue_type,
        location: ea.location,
        building: ea.building,
        capacity: ea.capacity,
      },
      exam_name: ea.exam_name,
      date: ea.date,
      start_time: ea.start_time,
      end_time: ea.end_time,
      status: ea.status,
      totalStudents: ea.num_students,
      departments,
      seating: seatingResult.rows.map(s => ({
        seatNo: s.seat_no,
        studentId: s.student_id,
        name: s.name,
        rollNo: s.roll_number,
        department: s.department,
      })),
      allocatedBy: ea.allocated_by_name,
      createdAt: ea.created_at,
    });
  } catch (err) {
    console.error('Get seating details error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// GET /api/exam-allocations/venues - get all exam halls for hall selection
router.get('/venues', authenticate, async (req, res) => {
  try {
    const result = await db.query(
      "SELECT id, name, type, location, building, capacity, status FROM resources WHERE capacity IS NOT NULL AND capacity > 1 ORDER BY name"
    );
    // Check which venues have active bookings/allocations today
    const today = new Date().toISOString().split('T')[0];
    const bookedResult = await db.query(`
      SELECT DISTINCT resource_id FROM (
        SELECT resource_id FROM bookings WHERE date = $1 AND status IN ('approved','pending')
        UNION
        SELECT resource_id FROM exam_allocations WHERE date = $1 AND status IN ('scheduled','ongoing')
        UNION
        SELECT resource_id FROM assignments WHERE date = $1 AND status = 'active'
      ) combined
    `, [today]);
    const bookedIds = new Set(bookedResult.rows.map(r => r.resource_id));

    const venues = result.rows.map(v => ({
      ...v,
      booking_status: v.status === 'maintenance' ? 'maintenance' : bookedIds.has(v.id) ? 'booked' : 'available'
    }));

    res.json(venues);
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

// PUT /api/exam-allocations/:id/seating - update seating arrangement (swap seats)
router.put('/:id/seating', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { seating } = req.body;

    if (!seating || !Array.isArray(seating) || seating.length === 0) {
      return res.status(400).json({ error: 'Seating array is required.' });
    }

    // Verify allocation exists
    const eaResult = await db.query('SELECT * FROM exam_allocations WHERE id = $1', [id]);
    if (eaResult.rows.length === 0) {
      return res.status(404).json({ error: 'Allocation not found.' });
    }

    // Update each student's seat number
    for (const s of seating) {
      if (s.studentId && s.seatNo) {
        await db.query(
          'UPDATE exam_student_allocations SET seat_no = $1 WHERE exam_allocation_id = $2 AND student_id = $3',
          [s.seatNo, id, s.studentId]
        );
      }
    }

    res.json({ success: true, message: 'Seating arrangement updated.' });
  } catch (err) {
    console.error('Update seating error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// DELETE /api/exam-allocations/:id
router.delete('/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    // Delete student allocations first (CASCADE should handle this, but be explicit)
    await db.query('DELETE FROM exam_student_allocations WHERE exam_allocation_id = $1', [req.params.id]);
    const result = await db.query('DELETE FROM exam_allocations WHERE id = $1 RETURNING id', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found.' });
    res.json({ success: true, message: 'Allocation deleted. Students are now available for new allocations.' });
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

module.exports = router;
