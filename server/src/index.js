const http = require('http');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const { createApp, parseAllowedOrigins } = require('./app');

const PORT = process.env.PORT || 5000;
const allowedOrigins = parseAllowedOrigins();
const app = createApp();
const server = http.createServer(app);

// Socket.io setup
const io = new Server(server, {
  cors: { origin: allowedOrigins, credentials: true },
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

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;
