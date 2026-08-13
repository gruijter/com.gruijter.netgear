/* This Source Code Form is subject to the terms of the Mozilla Public
	License, v. 2.0. If a copy of the MPL was not distributed with this
	file, You can obtain one at http://mozilla.org/MPL/2.0/.

	Copyright 2017 - 2026, Robin de Gruijter <gruijter@hotmail.com> */

'use strict';

/* eslint-disable no-await-in-loop */

/**
* Maps items through an async fn with at most `limit` calls in flight at once - distinct from
* Promise.all (which starts everything at once, unbounded) and from the time-based RequestQueue
* (which paces dispatches per second rather than capping how many can be in flight
* simultaneously). Used for the LAN subnet scan in discovery, which talks to up to 254 different
* hosts and has no authenticated-router rate limit to go through.
* @param {Array<*>} items
* @param {number} limit
* @param {(item: *, index: number) => Promise<*>} fn
* @returns {Promise<Array<*>>} results in the same order as items
*/
const mapWithConcurrency = async (items, limit, fn) => {
	const results = new Array(items.length);
	let nextIndex = 0;
	const worker = async () => {
		while (nextIndex < items.length) {
			const current = nextIndex;
			nextIndex += 1;
			results[current] = await fn(items[current], current);
		}
	};
	const workerCount = Math.min(limit, items.length);
	await Promise.all(Array.from({ length: workerCount }, worker));
	return results;
};

module.exports = { mapWithConcurrency };
