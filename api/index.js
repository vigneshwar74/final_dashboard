const { URL } = require('url');
const { createApp } = require('../server/src/app');

const app = createApp();

module.exports = (req, res) => {
  const incomingUrl = new URL(req.url, 'http://localhost');
  const pathParts = incomingUrl.searchParams.getAll('path').filter(Boolean);

  if (pathParts.length > 0) {
    incomingUrl.pathname = `/api/${pathParts.join('/')}`.replace(/\/+/g, '/');
    incomingUrl.searchParams.delete('path');
    req.url = incomingUrl.pathname + incomingUrl.search;
  }

  return app(req, res);
};
