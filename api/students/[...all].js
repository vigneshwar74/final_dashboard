const studentRoutes = require('../../server/src/routes/students');
const { createRouteHandler } = require('../_routeHandler');

module.exports = createRouteHandler(studentRoutes);
