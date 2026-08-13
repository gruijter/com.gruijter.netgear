'use strict';

// Forwards a NetgearRouter's 'log' events (see netgear >=5.0.0) into the given
// Homey device/driver's own log/error methods, dispatching on the event's
// `level` so raising `logLevel` (e.g. `router.logLevel = 'debug'` for
// troubleshooting) doesn't misreport routine traffic as errors.
// e.g. `attachRouterLogging(this.routerSession, this)`.
function attachRouterLogging(router, target) {
  router.on('log', ({ level, message, ...context }) => {
    const logFn = level === 'error' ? target.error : target.log;
    logFn(`[netgear] ${message}`, context);
  });
}

module.exports = attachRouterLogging;
