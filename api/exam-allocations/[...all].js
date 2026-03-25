const examAllocationRoutes = require('../../server/src/routes/examAllocations');
const { createRouteHandler } = require('../_routeHandler');

module.exports = createRouteHandler(examAllocationRoutes);
