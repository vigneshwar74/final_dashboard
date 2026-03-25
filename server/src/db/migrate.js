const db = require('./pool');

const migrate = async () => {
  try {
    console.log('Running migrations...');

    await db.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(20) NOT NULL DEFAULT 'student' CHECK (role IN ('admin','staff','student')),
        department VARCHAR(100),
        year VARCHAR(20),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    await db.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS department VARCHAR(100)`);
    await db.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS year VARCHAR(20)`);
    console.log('  ✓ users table');

    await db.query(`
      CREATE TABLE IF NOT EXISTS resources (
        id SERIAL PRIMARY KEY,
        name VARCHAR(150) NOT NULL,
        type VARCHAR(50) NOT NULL CHECK (type IN ('classroom','lab','equipment','computer','exam_hall')),
        location VARCHAR(200),
        building VARCHAR(100),
        capacity INT,
        status VARCHAR(30) NOT NULL DEFAULT 'available' CHECK (status IN ('available','in_use','maintenance')),
        description TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    // Update type constraint to include exam_hall if table already existed
    await db.query(`ALTER TABLE resources DROP CONSTRAINT IF EXISTS resources_type_check`);
    await db.query(`ALTER TABLE resources ADD CONSTRAINT resources_type_check CHECK (type IN ('classroom','lab','equipment','computer','exam_hall'))`);
    console.log('  ✓ resources table');

    await db.query(`
      CREATE TABLE IF NOT EXISTS bookings (
        id SERIAL PRIMARY KEY,
        resource_id INT NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
        user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        date DATE NOT NULL,
        start_time TIME NOT NULL,
        end_time TIME NOT NULL,
        purpose VARCHAR(500),
        status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','cancelled','completed')),
        admin_note TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('  ✓ bookings table');

    await db.query(`
      CREATE TABLE IF NOT EXISTS refresh_tokens (
        id SERIAL PRIMARY KEY,
        user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token TEXT NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('  ✓ refresh_tokens table');

    // Assignments: admin assigns staff to a venue
    await db.query(`
      CREATE TABLE IF NOT EXISTS assignments (
        id SERIAL PRIMARY KEY,
        resource_id INT NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
        staff_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        date DATE NOT NULL,
        start_time TIME NOT NULL,
        end_time TIME NOT NULL,
        title VARCHAR(300) NOT NULL,
        description TEXT,
        assigned_by INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active','cancelled','completed')),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('  ✓ assignments table');

    // Messages: admin→staff, admin→student, staff→student
    await db.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY,
        sender_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        recipient_role VARCHAR(20) CHECK (recipient_role IN ('staff','student')),
        recipient_id INT REFERENCES users(id) ON DELETE CASCADE,
        subject VARCHAR(200) NOT NULL,
        body TEXT NOT NULL,
        is_read BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('  ✓ messages table');

    // Mentor groups: admin assigns student mentees to a staff mentor
    await db.query(`
      CREATE TABLE IF NOT EXISTS mentor_groups (
        id SERIAL PRIMARY KEY,
        name VARCHAR(200) NOT NULL,
        staff_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_by INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    await db.query(`
      CREATE TABLE IF NOT EXISTS mentor_group_members (
        id SERIAL PRIMARY KEY,
        mentor_group_id INT NOT NULL REFERENCES mentor_groups(id) ON DELETE CASCADE,
        student_id INT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE (student_id)
      );
    `);
    console.log('  ✓ mentor_groups tables');

    // Student assignments: staff/admin assigns activity to students
    await db.query(`
      CREATE TABLE IF NOT EXISTS student_assignments (
        id SERIAL PRIMARY KEY,
        student_id INT REFERENCES users(id) ON DELETE CASCADE,
        assigned_by INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        resource_id INT REFERENCES resources(id) ON DELETE SET NULL,
        title VARCHAR(300) NOT NULL,
        description TEXT,
        date DATE,
        start_time TIME,
        end_time TIME,
        status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active','cancelled','completed')),
        target VARCHAR(20) DEFAULT 'specific' CHECK (target IN ('specific','all_students')),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('  ✓ student_assignments table');

    // Indexes
    await db.query(`CREATE INDEX IF NOT EXISTS idx_bookings_resource_date ON bookings(resource_id, date, start_time, end_time)`);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_bookings_user ON bookings(user_id)`);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status)`);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_resources_type ON resources(type)`);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_resources_status ON resources(status)`);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_assignments_staff ON assignments(staff_id, date)`);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_assignments_resource ON assignments(resource_id, date)`);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_messages_recipient ON messages(recipient_id)`);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_messages_role ON messages(recipient_role)`);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_mentor_groups_staff ON mentor_groups(staff_id)`);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_mentor_group_members_group ON mentor_group_members(mentor_group_id)`);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_student_assignments_student ON student_assignments(student_id)`);
    console.log('  ✓ indexes created');

    // Notifications
    await db.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,
        user_id INT REFERENCES users(id) ON DELETE CASCADE,
        role VARCHAR(20),
        type VARCHAR(50) NOT NULL,
        title VARCHAR(200) NOT NULL,
        body TEXT,
        link VARCHAR(200),
        is_read BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('  ✓ notifications table');

    // Audit log
    await db.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id SERIAL PRIMARY KEY,
        user_id INT REFERENCES users(id) ON DELETE SET NULL,
        user_name VARCHAR(100),
        user_role VARCHAR(20),
        action VARCHAR(50) NOT NULL,
        entity_type VARCHAR(50) NOT NULL,
        entity_id INT,
        details JSONB,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('  ✓ audit_logs table');

    // Feedback / ratings
    await db.query(`
      CREATE TABLE IF NOT EXISTS feedback (
        id SERIAL PRIMARY KEY,
        resource_id INT NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
        booking_id INT REFERENCES bookings(id) ON DELETE SET NULL,
        user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
        comment TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    await db.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_feedback_booking ON feedback(booking_id) WHERE booking_id IS NOT NULL`);
    console.log('  ✓ feedback table');

    // Exam hall allocation
    await db.query(`
      CREATE TABLE IF NOT EXISTS exam_allocations (
        id SERIAL PRIMARY KEY,
        resource_id INT NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
        department VARCHAR(100) NOT NULL,
        num_students INT NOT NULL,
        exam_name VARCHAR(200) NOT NULL,
        date DATE NOT NULL,
        start_time TIME NOT NULL,
        end_time TIME NOT NULL,
        allocated_by INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        status VARCHAR(20) NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','ongoing','completed','cancelled')),
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('  ✓ exam_allocations table');

    // Students table (exam-specific, separate from users)
    await db.query(`
      CREATE TABLE IF NOT EXISTS students (
        id SERIAL PRIMARY KEY,
        name VARCHAR(150) NOT NULL,
        roll_number VARCHAR(50) UNIQUE NOT NULL,
        department VARCHAR(100) NOT NULL,
        year VARCHAR(20),
        email VARCHAR(255),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('  ✓ students table');

    // Exam-student allocations: tracks which students are allocated to which exam
    await db.query(`
      CREATE TABLE IF NOT EXISTS exam_student_allocations (
        id SERIAL PRIMARY KEY,
        exam_allocation_id INT NOT NULL REFERENCES exam_allocations(id) ON DELETE CASCADE,
        student_id INT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
        seat_no INT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    await db.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_esa_exam_student ON exam_student_allocations(exam_allocation_id, student_id)`);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_esa_student ON exam_student_allocations(student_id)`);
    console.log('  ✓ exam_student_allocations table');

    // Ensure mentor group members reference students table
    await db.query(`ALTER TABLE mentor_group_members DROP CONSTRAINT IF EXISTS mentor_group_members_student_id_fkey`);
    await db.query(`ALTER TABLE mentor_group_members ADD CONSTRAINT mentor_group_members_student_id_fkey FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE`);

    // Occupancy tracking
    await db.query(`
      CREATE TABLE IF NOT EXISTS occupancy (
        id SERIAL PRIMARY KEY,
        resource_id INT NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
        user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        checked_in_at TIMESTAMP DEFAULT NOW(),
        checked_out_at TIMESTAMP
      );
    `);
    console.log('  ✓ occupancy table');

    // Extra indexes
    await db.query(`CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read)`);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action, entity_type)`);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_feedback_resource ON feedback(resource_id)`);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_exam_alloc_date ON exam_allocations(date, resource_id)`);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_occupancy_resource ON occupancy(resource_id, checked_out_at)`);
    console.log('  ✓ extra indexes created');

    console.log('Migrations complete!');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
};

migrate();
