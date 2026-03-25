const express = require('express');
const cors = require('cors');
const { createNoopIo, parseAllowedOrigins } = require('../server/src/app');

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

const createRouteHandler = (router, { withHealth = false } = {}) => {
  const app = express();

  app.set('io', createNoopIo());
  app.use(cors(createCorsOptions()));
  app.use(express.json());

  if (withHealth) {
    app.get(['/health', '/'], (req, res) => {
      res.json({ status: 'ok', timestamp: new Date().toISOString() });
    });
  }

  app.use('/', router);

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
  createRouteHandler,
};
