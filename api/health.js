const express = require('express');
const { createRouteHandler } = require('./_routeHandler');

const router = express.Router();

router.get('/', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

module.exports = createRouteHandler(router, { withHealth: true });
