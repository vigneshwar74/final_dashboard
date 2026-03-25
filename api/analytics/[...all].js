const analyticsRoutes = require('../../server/src/routes/analytics');
const { createRouteHandler } = require('../_routeHandler');

module.exports = createRouteHandler(analyticsRoutes);
