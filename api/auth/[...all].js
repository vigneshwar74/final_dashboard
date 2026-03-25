const authRoutes = require('../../server/src/routes/auth');
const { createRouteHandler } = require('../_routeHandler');

module.exports = createRouteHandler(authRoutes);
