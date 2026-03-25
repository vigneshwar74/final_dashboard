const messageRoutes = require('../../server/src/routes/messages');
const { createRouteHandler } = require('../_routeHandler');

module.exports = createRouteHandler(messageRoutes);
