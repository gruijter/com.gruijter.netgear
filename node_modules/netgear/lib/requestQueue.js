/* This Source Code Form is subject to the terms of the Mozilla Public
	License, v. 2.0. If a copy of the MPL was not distributed with this
	file, You can obtain one at http://mozilla.org/MPL/2.0/.

	Copyright 2017 - 2026, Robin de Gruijter <gruijter@hotmail.com> */

'use strict';

/* eslint-disable no-await-in-loop */

const timersPromises = require('node:timers/promises');

// accessed as timersPromises.setTimeout(...) at call time, not destructured at module
// load time, so that test-time timer mocking (node:test's t.mock.timers) can intercept it

// Self-written replacement for `smart-request-balancer`. The router hardware this
// package talks to can't handle a burst of SOAP calls, so every request funnels
// through here. The original config only ever used a flat rate limit (3 req/sec,
// with a looser 10 req/sec overall cap that was never actually the binding
// constraint) and never exercised its retry-on-throttle code path - so this only
// reimplements the part that mattered: "at most `ratePerSecond` requests may start
// within any rolling 1-second window". It does not limit concurrency - a slow
// in-flight request (e.g. the ~55s speed test) does not block later requests from
// starting, matching the original's rate-limiting (not concurrency-limiting) semantics.
class RequestQueue {
	constructor({ ratePerSecond = 3 } = {}) {
		this.ratePerSecond = ratePerSecond;
		this.pending = [];
		this.dispatchTimestamps = [];
		this.draining = false;
	}

	// @param {() => Promise<*>} fn
	// @returns {Promise<*>} resolves/rejects with fn()'s own outcome
	enqueue(fn) {
		return new Promise((resolve, reject) => {
			this.pending.push({ fn, resolve, reject });
			this._drain();
		});
	}

	async _drain() {
		if (this.draining) return;
		this.draining = true;
		while (this.pending.length > 0) {
			const waitMs = this._nextSlotDelayMs();
			if (waitMs > 0) await timersPromises.setTimeout(waitMs);
			const { fn, resolve, reject } = this.pending.shift();
			this.dispatchTimestamps.push(Date.now());
			fn().then(resolve, reject);
		}
		this.draining = false;
	}

	_nextSlotDelayMs() {
		const now = Date.now();
		this.dispatchTimestamps = this.dispatchTimestamps.filter((t) => now - t < 1000);
		if (this.dispatchTimestamps.length < this.ratePerSecond) return 0;
		const oldest = this.dispatchTimestamps[0];
		return Math.max(0, 1000 - (now - oldest));
	}
}

module.exports = RequestQueue;
