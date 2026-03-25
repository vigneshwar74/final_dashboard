const assignmentRoutes = require('../../server/src/routes/assignments');
const { createRouteHandler } = require('../_routeHandler');

module.exports = createRouteHandler(assignmentRoutes);
