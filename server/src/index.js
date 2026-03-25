require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');

const authRoutes = require('./routes/auth');
const resourceRoutes = require('./routes/resources');
const bookingRoutes = require('./routes/bookings');
const analyticsRoutes = require('./routes/analytics');
const assignmentRoutes = require('./routes/assignments');
const messageRoutes = require('./routes/messages');
const studentAssignmentRoutes = require('./routes/studentAssignments');
const notificationRoutes = require('./routes/notifications');
const auditLogRoutes = require('./routes/auditLog');
const examAllocationRoutes = require('./routes/examAllocations');
const studentRoutes = require('./routes/students');
const mentorGroupRoutes = require('./routes/mentorGroups');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5000;

// Socket.io setup
const io = new Server(server, {
  cors: { origin: ['http://localhost:3000', 'http://localhost:3001'], credentials: true },
});

// Socket.io auth middleware
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error('Authentication required'));
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.user = decoded;
    next();
  } catch (err) {
    next(new Error('Invalid token'));
  }
});

io.on('connection', (socket) => {
  const user = socket.user;
  // Join personal room and role room
  socket.join(`user_${user.id}`);
  socket.join(`role_${user.role}`);
  console.log(`Socket connected: ${user.name} (${user.role})`);

  socket.on('disconnect', () => {
    console.log(`Socket disconnected: ${user.name}`);
  });
});

// Make io accessible in routes
app.set('io', io);

// Middleware
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3001'],
  credentials: true,
}));
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/resources', resourceRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/assignments', assignmentRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/student-assignments', studentAssignmentRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/audit-logs', auditLogRoutes);
app.use('/api/exam-allocations', examAllocationRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/mentor-groups', mentorGroupRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 404
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found.' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error.' });
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;
