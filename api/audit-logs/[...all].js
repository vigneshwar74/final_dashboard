const auditLogRoutes = require('../../server/src/routes/auditLog');
const { createRouteHandler } = require('../_routeHandler');

module.exports = createRouteHandler(auditLogRoutes);
