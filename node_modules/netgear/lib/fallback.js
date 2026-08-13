/* This Source Code Form is subject to the terms of the Mozilla Public
	License, v. 2.0. If a copy of the MPL was not distributed with this
	file, You can obtain one at http://mozilla.org/MPL/2.0/.

	Copyright 2017 - 2026, Robin de Gruijter <gruijter@hotmail.com> */

'use strict';

/* eslint-disable no-await-in-loop */

/**
* Tries a list of strategies in order, returning the first one that resolves.
* `onAttempt(label)` (if given) fires right BEFORE each attempt - not only on success -
* matching the original code's "optimistic" labeling (e.g. `guestWifiMethod.get50_1`),
* where the attempted method is recorded even if that attempt then fails and a later
* one is tried instead.
* @param {Array<{ label: *, fn: () => Promise<*> }>} strategies - tried in array order
* @param {(label: *) => void} [onAttempt]
* @returns {Promise<*>} the first strategy's resolved value
* @throws the LAST strategy's error, if every strategy rejects (no aggregation)
*/
const tryInOrder = async (strategies, onAttempt) => {
	let lastError;
	for (let i = 0; i < strategies.length; i += 1) {
		const { label, fn } = strategies[i];
		if (onAttempt) onAttempt(label);
		try {
			return await fn();
		} catch (error) {
			lastError = error;
		}
	}
	throw lastError;
};

module.exports = { tryInOrder };
