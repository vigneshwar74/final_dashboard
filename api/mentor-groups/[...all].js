const mentorGroupRoutes = require('../../server/src/routes/mentorGroups');
const { createRouteHandler } = require('../_routeHandler');

module.exports = createRouteHandler(mentorGroupRoutes);
