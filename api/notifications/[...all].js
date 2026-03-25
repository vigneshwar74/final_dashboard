const notificationRoutes = require('../../server/src/routes/notifications');
const { createRouteHandler } = require('../_routeHandler');

module.exports = createRouteHandler(notificationRoutes);
