const resourceRoutes = require('../../server/src/routes/resources');
const { createRouteHandler } = require('../_routeHandler');

module.exports = createRouteHandler(resourceRoutes);
