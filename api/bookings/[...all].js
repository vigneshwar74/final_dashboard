const bookingRoutes = require('../../server/src/routes/bookings');
const { createRouteHandler } = require('../_routeHandler');

module.exports = createRouteHandler(bookingRoutes);
