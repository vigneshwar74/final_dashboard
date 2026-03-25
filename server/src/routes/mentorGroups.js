const express = require('express');
const { body } = require('express-validator');
const db = require('../db/pool');
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

const router = express.Router();

let fkChecked = false;
const ensureMentorMemberStudentFK = async () => {
  if (fkChecked) return;
  await db.query('ALTER TABLE mentor_group_members DROP CONSTRAINT IF EXISTS mentor_group_members_student_id_fkey');
  await db.query(
    'ALTER TABLE mentor_group_members ADD CONSTRAINT mentor_group_members_student_id_fkey FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE'
  );
  fkChecked = true;
};

const getMemberRefTable = async (client = db) => {
  const result = await client.query(
    `SELECT confrelid::regclass::text AS ref_table
     FROM pg_constraint
     WHERE conrelid = 'mentor_group_members'::regclass
       AND contype = 'f'
       AND conname = 'mentor_group_members_student_id_fkey'
     LIMIT 1`
  );
  return result.rows[0]?.ref_table || 'students';
};

const resolveMemberIds = async (client, studentIds) => {
  const refTable = await getMemberRefTable(client);
  if (refTable === 'users') {
    const mapResult = await client.query(
      `SELECT s.id AS student_id, u.id AS member_id, s.name
       FROM students s
       LEFT JOIN users u ON LOWER(u.email) = LOWER(s.email) AND u.role = 'student'
       WHERE s.id = ANY($1)`,
      [studentIds]
    );
    const map = new Map(mapResult.rows.map((r) => [r.student_id, r]));
    const missing = studentIds.filter((id) => !map.get(id)?.member_id);
    if (missing.length > 0) {
      return {
        refTable,
        error: `Student user account missing for selected students: ${missing.join(', ')}`,
      };
    }
    return {
      refTable,
      memberIds: studentIds.map((id) => map.get(id).member_id),
    };
  }
  return { refTable, memberIds: studentIds };
};

const buildAutoGroupName = (staffName, staffId) => {
  const safeName = (staffName || 'Staff').trim();
  return `Mentor Group - ${safeName} (${staffId})`;
};

const getGroupsWithMembers = async (whereSql = '', params = []) => {
  const refTable = await getMemberRefTable();
  const groupsResult = await db.query(
    `SELECT mg.id, mg.name, mg.staff_id, mg.created_by, mg.created_at, mg.updated_at,
            u.name AS staff_name, u.email AS staff_email, u.department AS staff_department
     FROM mentor_groups mg
     JOIN users u ON mg.staff_id = u.id
     ${whereSql}
     ORDER BY mg.created_at DESC`,
    params
  );

  if (groupsResult.rows.length === 0) return [];

  const groupIds = groupsResult.rows.map((g) => g.id);
  const membersResult = refTable === 'users'
    ? await db.query(
      `SELECT mgm.mentor_group_id, s.id, s.name, s.email, s.department, s.year
       FROM mentor_group_members mgm
       JOIN users u ON u.id = mgm.student_id
       JOIN students s ON LOWER(s.email) = LOWER(u.email)
       WHERE mgm.mentor_group_id = ANY($1)
       ORDER BY s.name`,
      [groupIds]
    )
    : await db.query(
      `SELECT mgm.mentor_group_id, s.id, s.name, s.email, s.department, s.year
       FROM mentor_group_members mgm
       JOIN students s ON s.id = mgm.student_id
       WHERE mgm.mentor_group_id = ANY($1)
       ORDER BY s.name`,
      [groupIds]
    );

  const memberMap = new Map();
  membersResult.rows.forEach((row) => {
    const list = memberMap.get(row.mentor_group_id) || [];
    list.push({
      id: row.id,
      name: row.name,
      email: row.email,
      department: row.department,
      year: row.year,
    });
    memberMap.set(row.mentor_group_id, list);
  });

  return groupsResult.rows.map((g) => {
    const members = memberMap.get(g.id) || [];
    return {
      ...g,
      students: members,
      student_count: members.length,
    };
  });
};

// GET /api/mentor-groups - admin gets all groups, staff gets own groups
router.get('/', authenticate, authorize('admin', 'staff'), async (req, res) => {
  try {
    const groups = req.user.role === 'admin'
      ? await getGroupsWithMembers('')
      : await getGroupsWithMembers('WHERE mg.staff_id = $1', [req.user.id]);

    res.json(groups);
  } catch (err) {
    console.error('List mentor groups error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// GET /api/mentor-groups/meta - list staff and currently ungrouped students (admin only)
router.get('/meta', authenticate, authorize('admin'), async (req, res) => {
  try {
    const [staffResult, studentsResult] = await Promise.all([
      db.query(
        `SELECT u.id, u.name, u.email, u.department,
                (
                  SELECT mg.id
                  FROM mentor_groups mg
                  WHERE mg.staff_id = u.id
                  LIMIT 1
                ) AS current_group_id
         FROM users u
         WHERE u.role = 'staff'
         ORDER BY u.name`
      ),
      db.query(
        `SELECT s.id, s.name, s.email, s.department, s.year,
                (
                  SELECT mgm.mentor_group_id
                  FROM mentor_group_members mgm
                  LEFT JOIN users u2 ON u2.id = mgm.student_id
                  WHERE mgm.student_id = s.id OR LOWER(u2.email) = LOWER(s.email)
                  LIMIT 1
                ) AS current_group_id
         FROM students s
         ORDER BY s.name`
      ),
    ]);

    const availableStaff = staffResult.rows.filter((s) => !s.current_group_id);
    const availableStudents = studentsResult.rows.filter((s) => !s.current_group_id);

    res.json({
      staff: staffResult.rows,
      availableStaff,
      availableStudents,
    });
  } catch (err) {
    console.error('Mentor groups meta error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// GET /api/mentor-groups/my-mentees - staff list of mentees
router.get('/my-mentees', authenticate, authorize('staff'), async (req, res) => {
  try {
    const groups = await getGroupsWithMembers('WHERE mg.staff_id = $1', [req.user.id]);
    const mentees = groups.flatMap((g) =>
      g.students.map((s) => ({
        ...s,
        mentor_group_id: g.id,
        mentor_group_name: g.name,
      }))
    );

    res.json({ groups, mentees, totalMentees: mentees.length });
  } catch (err) {
    console.error('My mentees error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// GET /api/mentor-groups/my-mentor - student view of assigned mentor group
router.get('/my-mentor', authenticate, authorize('student'), async (req, res) => {
  try {
    const refTable = await getMemberRefTable();
    const params = [req.user.id, req.user.email || ''];
    const query = refTable === 'users'
      ? `SELECT mg.id AS mentor_group_id,
                mg.name AS mentor_group_name,
                st.id AS mentor_id,
                st.name AS mentor_name,
                st.email AS mentor_email,
                st.department AS mentor_department
         FROM mentor_group_members mgm
         JOIN mentor_groups mg ON mg.id = mgm.mentor_group_id
         JOIN users st ON st.id = mg.staff_id
         WHERE mgm.student_id = $1
         LIMIT 1`
      : `SELECT mg.id AS mentor_group_id,
                mg.name AS mentor_group_name,
                st.id AS mentor_id,
                st.name AS mentor_name,
                st.email AS mentor_email,
                st.department AS mentor_department
         FROM mentor_group_members mgm
         JOIN mentor_groups mg ON mg.id = mgm.mentor_group_id
         JOIN students s ON s.id = mgm.student_id
         JOIN users st ON st.id = mg.staff_id
         WHERE LOWER(s.email) = LOWER($2)
         LIMIT 1`;

    const result = await db.query(query, params);
    if (result.rows.length === 0) {
      return res.json({ assigned: false });
    }

    return res.json({ assigned: true, ...result.rows[0] });
  } catch (err) {
    console.error('My mentor error:', err);
    return res.status(500).json({ error: 'Server error.' });
  }
});

// POST /api/mentor-groups - create mentor group (admin)
router.post(
  '/',
  authenticate,
  authorize('admin'),
  [
    body('staff_id').isInt().withMessage('staff_id is required.'),
    body('student_ids').isArray({ min: 1 }).withMessage('Select at least one student.'),
  ],
  validate,
  async (req, res) => {
    const client = await db.pool.connect();
    try {
      const { name, staff_id, student_ids } = req.body;

      const staffResult = await client.query(
        "SELECT id, name FROM users WHERE id = $1 AND role = 'staff'",
        [staff_id]
      );
      if (staffResult.rows.length === 0) {
        return res.status(404).json({ error: 'Staff member not found.' });
      }

      const existingStaffGroup = await client.query(
        'SELECT id FROM mentor_groups WHERE staff_id = $1 LIMIT 1',
        [staff_id]
      );
      if (existingStaffGroup.rows.length > 0) {
        return res.status(409).json({ error: 'Selected staff is already assigned to a mentor group.' });
      }

      const studentIds = [...new Set(student_ids.map((v) => parseInt(v, 10)).filter(Boolean))];
      if (studentIds.length === 0) {
        return res.status(400).json({ error: 'Select at least one valid student.' });
      }

      const validStudents = await client.query(
        "SELECT id FROM students WHERE id = ANY($1)",
        [studentIds]
      );
      if (validStudents.rows.length !== studentIds.length) {
        return res.status(400).json({ error: 'One or more selected students are invalid.' });
      }

      const resolved = await resolveMemberIds(client, studentIds);
      if (resolved.error) {
        return res.status(400).json({ error: resolved.error });
      }

      const conflicts = resolved.refTable === 'users'
        ? await client.query(
          `SELECT mgm.student_id, COALESCE(s.name, u.name) AS name
           FROM mentor_group_members mgm
           JOIN users u ON u.id = mgm.student_id
           LEFT JOIN students s ON LOWER(s.email) = LOWER(u.email)
           WHERE mgm.student_id = ANY($1)`,
          [resolved.memberIds]
        )
        : await client.query(
          `SELECT mgm.student_id, s.name
           FROM mentor_group_members mgm
           JOIN students s ON s.id = mgm.student_id
           WHERE mgm.student_id = ANY($1)`,
          [resolved.memberIds]
        );
      if (conflicts.rows.length > 0) {
        return res.status(409).json({
          error: 'Some students are already in another mentor group.',
          conflicts: conflicts.rows,
        });
      }

      await client.query('BEGIN');
      const finalName = (name || '').trim() || buildAutoGroupName(staffResult.rows[0].name, staff_id);
      const groupResult = await client.query(
        `INSERT INTO mentor_groups (name, staff_id, created_by)
         VALUES ($1, $2, $3)
         RETURNING id`,
        [finalName, staff_id, req.user.id]
      );

      const groupId = groupResult.rows[0].id;
      await client.query(
        `INSERT INTO mentor_group_members (mentor_group_id, student_id)
         SELECT $1, unnest($2::int[])`,
        [groupId, resolved.memberIds]
      );

      await client.query('COMMIT');

      const created = await getGroupsWithMembers('WHERE mg.id = $1', [groupId]);
      res.status(201).json(created[0]);
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('Create mentor group error:', err);
      if (err.code === '23505') {
        return res.status(409).json({ error: 'One or more students are already grouped. Refresh and try again.' });
      }
      if (err.code === '23503') {
        return res.status(400).json({ error: 'Student mapping mismatch detected. Run server migration once and retry.' });
      }
      res.status(500).json({ error: 'Server error.' });
    } finally {
      client.release();
    }
  }
);

// PUT /api/mentor-groups/:id - update staff/group/students (admin)
router.put(
  '/:id',
  authenticate,
  authorize('admin'),
  [
    body('staff_id').isInt().withMessage('staff_id is required.'),
    body('student_ids').isArray({ min: 1 }).withMessage('Select at least one student.'),
  ],
  validate,
  async (req, res) => {
    const client = await db.pool.connect();
    try {
      const groupId = parseInt(req.params.id, 10);
      const { name, staff_id, student_ids } = req.body;

      const existing = await client.query('SELECT id FROM mentor_groups WHERE id = $1', [groupId]);
      if (existing.rows.length === 0) {
        return res.status(404).json({ error: 'Mentor group not found.' });
      }

      const staffResult = await client.query(
        "SELECT id, name FROM users WHERE id = $1 AND role = 'staff'",
        [staff_id]
      );
      if (staffResult.rows.length === 0) {
        return res.status(404).json({ error: 'Staff member not found.' });
      }

      const existingStaffGroup = await client.query(
        'SELECT id FROM mentor_groups WHERE staff_id = $1 AND id <> $2 LIMIT 1',
        [staff_id, groupId]
      );
      if (existingStaffGroup.rows.length > 0) {
        return res.status(409).json({ error: 'Selected staff is already assigned to another mentor group.' });
      }

      const studentIds = [...new Set(student_ids.map((v) => parseInt(v, 10)).filter(Boolean))];
      if (studentIds.length === 0) {
        return res.status(400).json({ error: 'Select at least one valid student.' });
      }

      const validStudents = await client.query(
        "SELECT id FROM students WHERE id = ANY($1)",
        [studentIds]
      );
      if (validStudents.rows.length !== studentIds.length) {
        return res.status(400).json({ error: 'One or more selected students are invalid.' });
      }

      const resolved = await resolveMemberIds(client, studentIds);
      if (resolved.error) {
        return res.status(400).json({ error: resolved.error });
      }

      const conflicts = resolved.refTable === 'users'
        ? await client.query(
          `SELECT mgm.student_id, COALESCE(s.name, u.name) AS name
           FROM mentor_group_members mgm
           JOIN users u ON u.id = mgm.student_id
           LEFT JOIN students s ON LOWER(s.email) = LOWER(u.email)
           WHERE mgm.student_id = ANY($1)
             AND mgm.mentor_group_id <> $2`,
          [resolved.memberIds, groupId]
        )
        : await client.query(
          `SELECT mgm.student_id, s.name
           FROM mentor_group_members mgm
           JOIN students s ON s.id = mgm.student_id
           WHERE mgm.student_id = ANY($1)
             AND mgm.mentor_group_id <> $2`,
          [resolved.memberIds, groupId]
        );
      if (conflicts.rows.length > 0) {
        return res.status(409).json({
          error: 'Some students are already in another mentor group.',
          conflicts: conflicts.rows,
        });
      }

      await client.query('BEGIN');
      const finalName = (name || '').trim() || buildAutoGroupName(staffResult.rows[0].name, staff_id);
      await client.query(
        'UPDATE mentor_groups SET name = $1, staff_id = $2, updated_at = NOW() WHERE id = $3',
        [finalName, staff_id, groupId]
      );
      await client.query('DELETE FROM mentor_group_members WHERE mentor_group_id = $1', [groupId]);
      await client.query(
        `INSERT INTO mentor_group_members (mentor_group_id, student_id)
         SELECT $1, unnest($2::int[])`,
        [groupId, resolved.memberIds]
      );
      await client.query('COMMIT');

      const updated = await getGroupsWithMembers('WHERE mg.id = $1', [groupId]);
      res.json(updated[0]);
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('Update mentor group error:', err);
      if (err.code === '23505') {
        return res.status(409).json({ error: 'One or more students are already grouped. Refresh and try again.' });
      }
      if (err.code === '23503') {
        return res.status(400).json({ error: 'Student mapping mismatch detected. Run server migration once and retry.' });
      }
      res.status(500).json({ error: 'Server error.' });
    } finally {
      client.release();
    }
  }
);

// DELETE /api/mentor-groups/:id (admin)
router.delete('/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const result = await db.query('DELETE FROM mentor_groups WHERE id = $1 RETURNING id', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Mentor group not found.' });
    }
    res.json({ success: true, message: 'Mentor group deleted.' });
  } catch (err) {
    console.error('Delete mentor group error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

module.exports = router;
