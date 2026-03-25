const bcrypt = require('bcryptjs');
const db = require('./pool');

const run = async () => {
  const defaultPassword = 'student123';
  const passwordHash = await bcrypt.hash(defaultPassword, 10);

  const beforeResult = await db.query("SELECT COUNT(*)::int AS c FROM users WHERE role = 'student'");

  const missingResult = await db.query(`
    SELECT s.id, s.name, s.email, s.department, s.year
    FROM students s
    WHERE s.email IS NOT NULL
      AND s.email != ''
      AND NOT EXISTS (
        SELECT 1
        FROM users u
        WHERE LOWER(u.email) = LOWER(s.email)
      )
    ORDER BY s.id
  `);

  for (const s of missingResult.rows) {
    await db.query(
      `INSERT INTO users (name, email, password, role, department, year)
       VALUES ($1, $2, $3, 'student', $4, $5)`,
      [s.name, s.email, passwordHash, s.department || null, s.year || null]
    );
  }

  const afterResult = await db.query("SELECT COUNT(*)::int AS c FROM users WHERE role = 'student'");

  console.log(JSON.stringify({
    studentUsersBefore: beforeResult.rows[0].c,
    missingStudents: missingResult.rows.length,
    created: missingResult.rows.length,
    studentUsersAfter: afterResult.rows[0].c,
    defaultPassword,
  }, null, 2));
};

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Create student users failed:', err);
    process.exit(1);
  });
