const studentAssignmentRoutes = require('../../server/src/routes/studentAssignments');
const { createRouteHandler } = require('../_routeHandler');

module.exports = createRouteHandler(studentAssignmentRoutes);
