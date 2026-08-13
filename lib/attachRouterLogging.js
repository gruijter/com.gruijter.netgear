'use strict';

// Forwards a NetgearRouter's 'log' events (see netgear >=5.0.0) into the given
// Homey log function, e.g. `attachRouterLogging(router, this.error)`.
function attachRouterLogging(router, logFn) {
  router.on('log', ({ message, ...context }) => logFn(`[netgear] ${message}`, context));
}

module.exports = attachRouterLogging;
