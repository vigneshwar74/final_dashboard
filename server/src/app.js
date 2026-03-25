require('dotenv').config();
const express = require('express');
const cors = require('cors');

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

const parseAllowedOrigins = () => {
  const configuredOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map((origin) => origin.trim()).filter(Boolean)
    : [];

  if (process.env.NODE_ENV !== 'production') {
    return ['http://localhost:3000', 'http://localhost:3001', ...configuredOrigins];
  }

  return configuredOrigins;
};

const createNoopIo = () => ({
  to: () => createNoopIo(),
  emit: () => {},
});

const createCorsOptions = () => {
  const allowedOrigins = [...new Set(parseAllowedOrigins())];

  return {
    origin(origin, callback) {
      if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
  };
};

const createApp = ({ io = createNoopIo() } = {}) => {
  const app = express();
  const mountRoute = (apiPath, router) => {
    app.use(apiPath, router);

    const vercelPath = apiPath.replace(/^\/api/, '') || '/';
    if (vercelPath !== apiPath) {
      app.use(vercelPath, router);
    }
  };

  app.set('io', io);

  app.use(cors(createCorsOptions()));
  app.use(express.json());

  mountRoute('/api/auth', authRoutes);
  mountRoute('/api/resources', resourceRoutes);
  mountRoute('/api/bookings', bookingRoutes);
  mountRoute('/api/analytics', analyticsRoutes);
  mountRoute('/api/assignments', assignmentRoutes);
  mountRoute('/api/messages', messageRoutes);
  mountRoute('/api/student-assignments', studentAssignmentRoutes);
  mountRoute('/api/notifications', notificationRoutes);
  mountRoute('/api/audit-logs', auditLogRoutes);
  mountRoute('/api/exam-allocations', examAllocationRoutes);
  mountRoute('/api/students', studentRoutes);
  mountRoute('/api/mentor-groups', mentorGroupRoutes);

  app.get(['/api/health', '/health'], (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  app.use((req, res) => {
    res.status(404).json({ error: 'Route not found.' });
  });

  app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  });

  return app;
};

module.exports = {
  createApp,
  createNoopIo,
  parseAllowedOrigins,
};
