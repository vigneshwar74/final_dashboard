const occupancyRoutes = require('../../server/src/routes/occupancy');
const { createRouteHandler } = require('../_routeHandler');

module.exports = createRouteHandler(occupancyRoutes);
