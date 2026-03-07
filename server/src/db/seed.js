const bcrypt = require('bcryptjs');
const db = require('./pool');

const seed = async () => {
  try {
    console.log('Seeding database...');

    // Clear existing data
    await db.query('DELETE FROM occupancy');
    await db.query('DELETE FROM exam_allocations');
    await db.query('DELETE FROM feedback');
    await db.query('DELETE FROM audit_logs');
    await db.query('DELETE FROM notifications');
    await db.query('DELETE FROM student_assignments');
    await db.query('DELETE FROM messages');
    await db.query('DELETE FROM assignments');
    await db.query('DELETE FROM bookings');
    await db.query('DELETE FROM refresh_tokens');
    await db.query('DELETE FROM resources');
    await db.query('DELETE FROM users');

    // Reset sequences
    await db.query("ALTER SEQUENCE users_id_seq RESTART WITH 1");
    await db.query("ALTER SEQUENCE resources_id_seq RESTART WITH 1");
    await db.query("ALTER SEQUENCE bookings_id_seq RESTART WITH 1");
    await db.query("ALTER SEQUENCE assignments_id_seq RESTART WITH 1");
    await db.query("ALTER SEQUENCE messages_id_seq RESTART WITH 1");
    await db.query("ALTER SEQUENCE student_assignments_id_seq RESTART WITH 1");
    await db.query("ALTER SEQUENCE notifications_id_seq RESTART WITH 1");
    await db.query("ALTER SEQUENCE audit_logs_id_seq RESTART WITH 1");
    await db.query("ALTER SEQUENCE feedback_id_seq RESTART WITH 1");
    await db.query("ALTER SEQUENCE exam_allocations_id_seq RESTART WITH 1");
    await db.query("ALTER SEQUENCE occupancy_id_seq RESTART WITH 1");

    // Seed users with department and year
    const adminPw = await bcrypt.hash('admin123', 10);
    const staffPw = await bcrypt.hash('staff123', 10);
    const studentPw = await bcrypt.hash('student123', 10);

    await db.query(`
      INSERT INTO users (name, email, password, role, department, year) VALUES
        ('Admin User', 'admin@college.edu', $1, 'admin', 'Administration', NULL),
        ('Dr. Smith', 'staff@college.edu', $2, 'staff', 'Computer Science', NULL),
        ('Prof. Johnson', 'johnson@college.edu', $2, 'staff', 'Physics', NULL),
        ('Jane Student', 'student@college.edu', $3, 'student', 'Computer Science', '3rd Year'),
        ('Bob Student', 'bob@college.edu', $3, 'student', 'Physics', '2nd Year')
    `, [adminPw, staffPw, studentPw]);
    console.log('  ✓ users seeded');

    // Seed resources
    await db.query(`
      INSERT INTO resources (name, type, location, building, capacity, status, description) VALUES
        ('Room 101', 'classroom', 'First Floor', 'Main Building', 40, 'available', 'Standard lecture hall with whiteboard and AV system'),
        ('Room 102', 'classroom', 'First Floor', 'Main Building', 30, 'available', 'Seminar room with round tables'),
        ('Room 201', 'classroom', 'Second Floor', 'Main Building', 60, 'available', 'Large lecture hall with tiered seating'),
        ('Room 301', 'classroom', 'Third Floor', 'Main Building', 25, 'maintenance', 'Small classroom - AC under repair'),
        ('Computer Lab A', 'lab', 'Ground Floor', 'Tech Building', 30, 'available', '30 workstations with Windows/Linux dual boot'),
        ('Computer Lab B', 'lab', 'Ground Floor', 'Tech Building', 25, 'available', '25 workstations with Mac OS'),
        ('Physics Lab', 'lab', 'First Floor', 'Science Building', 20, 'available', 'Fully equipped physics laboratory'),
        ('Chemistry Lab', 'lab', 'Second Floor', 'Science Building', 20, 'in_use', 'Chemistry lab with fume hoods'),
        ('Projector P-01', 'equipment', 'AV Room', 'Main Building', NULL, 'available', 'Epson 4K projector - portable'),
        ('Projector P-02', 'equipment', 'AV Room', 'Main Building', NULL, 'available', 'BenQ HD Projector'),
        ('Laptop Cart A', 'equipment', 'IT Storage', 'Tech Building', 20, 'available', 'Cart with 20 Chromebooks'),
        ('3D Printer', 'equipment', 'Maker Space', 'Tech Building', NULL, 'available', 'Prusa i3 MK3S 3D Printer'),
        ('Desktop PC-01', 'computer', 'Library', 'Library Building', 1, 'available', 'Dell OptiPlex with 27" monitor'),
        ('Desktop PC-02', 'computer', 'Library', 'Library Building', 1, 'available', 'Dell OptiPlex with 27" monitor'),
        ('Desktop PC-03', 'computer', 'Library', 'Library Building', 1, 'in_use', 'HP Elite with dual monitors'),
        ('iMac Lab Station', 'computer', 'Design Lab', 'Arts Building', 1, 'available', 'iMac 27" for design work')
    `);
    console.log('  ✓ resources seeded');

    // Seed bookings (staff only)
    const today = new Date().toISOString().split('T')[0];
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
    const dayAfter = new Date(Date.now() + 2 * 86400000).toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    const twoDaysAgo = new Date(Date.now() - 2 * 86400000).toISOString().split('T')[0];

    await db.query(`
      INSERT INTO bookings (resource_id, user_id, date, start_time, end_time, purpose, status) VALUES
        (1, 2, $1, '09:00', '11:00', 'Data Structures Lecture', 'approved'),
        (1, 3, $1, '14:00', '16:00', 'Algorithms Tutorial', 'approved'),
        (2, 2, $1, '10:00', '12:00', 'Faculty Meeting', 'approved'),
        (5, 3, $1, '13:00', '15:00', 'Programming Lab Session', 'approved'),
        (9, 2, $1, '09:00', '11:00', 'Guest Lecture Presentation', 'approved'),
        (1, 2, $2, '09:00', '11:00', 'Operating Systems Lecture', 'pending'),
        (5, 3, $2, '10:00', '12:00', 'Database Lab', 'pending'),
        (7, 2, $2, '14:00', '17:00', 'Physics Practical', 'approved'),
        (3, 3, $3, '08:00', '10:00', 'Compiler Design Lecture', 'pending'),
        (6, 2, $3, '11:00', '13:00', 'iOS Development Workshop', 'approved'),
        (1, 2, $4, '09:00', '11:00', 'ML Lecture', 'completed'),
        (2, 3, $4, '10:00', '12:00', 'Department Seminar', 'completed'),
        (5, 2, $4, '14:00', '16:00', 'Web Dev Lab', 'completed'),
        (8, 3, $5, '09:00', '12:00', 'Chemistry Practical Exam', 'completed'),
        (3, 2, $5, '13:00', '15:00', 'AI Lecture', 'completed')
    `, [today, tomorrow, dayAfter, yesterday, twoDaysAgo]);
    console.log('  ✓ bookings seeded');

    // Seed assignments (admin assigns staff to venue)
    await db.query(`
      INSERT INTO assignments (resource_id, staff_id, date, start_time, end_time, title, description, assigned_by, status) VALUES
        (1, 2, $1, '09:00', '11:00', 'Data Structures Lecture', 'Cover Chapter 5 - Trees and Graphs', 1, 'active'),
        (5, 3, $1, '13:00', '15:00', 'Programming Lab Session', 'Python practical exercises', 1, 'active'),
        (7, 3, $2, '14:00', '17:00', 'Physics Practical', 'Optics experiment batch B', 1, 'active'),
        (2, 2, $3, '10:00', '12:00', 'Department Meeting', 'Monthly review meeting', 1, 'completed')
    `, [today, tomorrow, yesterday]);
    console.log('  ✓ assignments seeded');

    // Seed messages
    await db.query(`
      INSERT INTO messages (sender_id, recipient_role, recipient_id, subject, body) VALUES
        (1, 'staff', NULL, 'Staff Meeting Tomorrow', 'All staff are required to attend the meeting in Room 201 at 10:00 AM tomorrow.'),
        (1, 'student', NULL, 'Exam Schedule Update', 'Mid-term exams have been rescheduled to next week. Check the notice board for details.'),
        (1, 'staff', 2, 'Lab Assignment', 'Dr. Smith, please prepare the Computer Lab A for the workshop on Friday.'),
        (2, 'student', 4, 'Assignment Due Date', 'Jane, your Data Structures assignment is due by Friday 5 PM.'),
        (1, 'student', 4, 'Scholarship Update', 'Jane, please submit your scholarship documents to the admin office.'),
        (2, 'student', NULL, 'Class Cancelled', 'Tomorrow morning class is cancelled. Self-study assigned.')
    `);
    console.log('  ✓ messages seeded');

    // Seed student assignments
    await db.query(`
      INSERT INTO student_assignments (student_id, assigned_by, resource_id, title, description, date, start_time, end_time, status, target) VALUES
        (4, 2, 5, 'Python Lab Exercise', 'Complete exercises 1-10 from Chapter 3', $1, '13:00', '15:00', 'active', 'specific'),
        (5, 3, 7, 'Physics Practical', 'Optics experiment - measure focal length', $1, '14:00', '16:00', 'active', 'specific'),
        (NULL, 1, 3, 'Orientation Session', 'All students must attend the orientation in Room 201', $2, '10:00', '12:00', 'active', 'all_students')
    `, [today, tomorrow]);
    console.log('  ✓ student assignments seeded');

    // Seed exam allocations
    await db.query(`
      INSERT INTO exam_allocations (resource_id, department, num_students, exam_name, date, start_time, end_time, allocated_by, status, notes) VALUES
        (1, 'Computer Science', 35, 'Data Structures Mid-Term', $1, '09:00', '12:00', 1, 'scheduled', 'Seating arrangement: roll number order'),
        (3, 'Physics', 50, 'Physics Final Exam', $2, '10:00', '13:00', 1, 'scheduled', 'Students need calculator'),
        (2, 'Computer Science', 25, 'Database Systems Quiz', $1, '14:00', '15:30', 1, 'completed', NULL)
    `, [tomorrow, dayAfter]);
    console.log('  ✓ exam allocations seeded');

    // Seed feedback
    await db.query(`
      INSERT INTO feedback (resource_id, booking_id, user_id, rating, comment) VALUES
        (1, 11, 2, 5, 'Excellent classroom with great AV setup. Projector works perfectly.'),
        (2, 12, 3, 4, 'Good seminar room. Could use better lighting.'),
        (5, 13, 2, 5, 'Well-maintained lab. All workstations are functional.'),
        (8, 14, 3, 3, 'Lab is decent but some equipment needs calibration.'),
        (1, 1, 2, 4, 'Nice room, comfortable seating for lectures.'),
        (7, 8, 2, 4, 'Good physics lab, well-equipped for practicals.')
    `);
    console.log('  ✓ feedback seeded');

    // Seed audit logs
    await db.query(`
      INSERT INTO audit_logs (user_id, user_name, user_role, action, entity_type, entity_id, details) VALUES
        (1, 'Admin User', 'admin', 'approved', 'booking', 1, '{"resource":"Room 101","purpose":"Data Structures Lecture"}'),
        (1, 'Admin User', 'admin', 'approved', 'booking', 2, '{"resource":"Room 101","purpose":"Algorithms Tutorial"}'),
        (1, 'Admin User', 'admin', 'created', 'assignment', 1, '{"resource":"Room 101","staff":"Dr. Smith"}'),
        (2, 'Dr. Smith', 'staff', 'created', 'booking', 6, '{"resource":"Room 101","purpose":"Operating Systems Lecture"}'),
        (1, 'Admin User', 'admin', 'created', 'exam_allocation', 1, '{"exam":"Data Structures Mid-Term","venue":"Room 101"}')
    `);
    console.log('  ✓ audit logs seeded');

    // Seed notifications
    await db.query(`
      INSERT INTO notifications (user_id, role, type, title, body, link, is_read) VALUES
        (2, 'staff', 'booking', 'Booking Approved', 'Your booking for Room 101 has been approved.', '/bookings', true),
        (3, 'staff', 'booking', 'Booking Approved', 'Your booking for Room 101 (Algorithms Tutorial) has been approved.', '/bookings', false),
        (4, 'student', 'assignment', 'New Activity Assigned', 'You have been assigned Python Lab Exercise.', '/my-activities', false),
        (1, 'admin', 'booking', 'New Booking Request', 'Dr. Smith requested Room 101 for Operating Systems Lecture.', '/approvals', false)
    `);
    console.log('  ✓ notifications seeded');

    console.log('Seed complete!');
    process.exit(0);
  } catch (err) {
    console.error('Seed failed:', err);
    process.exit(1);
  }
};

seed();
