/* This Source Code Form is subject to the terms of the Mozilla Public
	License, v. 2.0. If a copy of the MPL was not distributed with this
	file, You can obtain one at http://mozilla.org/MPL/2.0/.

	Copyright 2017 - 2026, Robin de Gruijter <gruijter@hotmail.com> */

'use strict';

// Imported directly from the `undici` package (rather than off `globalThis.fetch`) so
// that this module and the test suite's MockAgent always share the same Dispatcher
// implementation - Node's own global fetch is undici-backed internally, so this is
// the same code, just imported explicitly instead of via the global.
const { fetch, Agent } = require('undici');

// Router SOAP endpoints use self-signed certificates; this replaces the original
// `rejectUnauthorized: false` option that http(s).request() accepted directly. A
// single shared Agent is reused for connection pooling.
const insecureAgent = new Agent({ connect: { rejectUnauthorized: false } });

// The dispatcher actually used for insecure:true requests - a separate mutable binding
// from the `insecureAgent` export above so tests can redirect it at a MockAgent (an
// explicit per-request `dispatcher`, unlike a plain global fetch call, is NOT
// intercepted by `setGlobalDispatcher()`, so without this seam HTTPS probing would be
// untestable). Production code never touches this - only test code should.
let insecureDispatcher = insecureAgent;
const _setInsecureDispatcherForTesting = (dispatcher) => {
	insecureDispatcher = dispatcher || insecureAgent;
};

/**
* A single fetch-based transport for every HTTP(S) call this package makes, replacing
* the original's 4 near-duplicate http/https-module-based helpers. `fetch` already picks
* HTTP vs HTTPS from the URL scheme, so no manual module switch is needed.
* @param {string} url
* @param {object} [opts]
* @param {string} [opts.method='GET']
* @param {Record<string,string>} [opts.headers]
* @param {string|Buffer} [opts.body]
* @param {number} [opts.timeout] - ms, mapped to AbortSignal.timeout(); omit for no timeout
* @param {boolean} [opts.insecure=false] - bypass self-signed cert rejection (https: only)
* @returns {Promise<{ statusCode: number, headers: Record<string, string|string[]>, body: string }>}
*/
const request = async (url, opts = {}) => {
	const {
		method = 'GET', headers, body, timeout, insecure = false,
	} = opts;
	// The original http(s).request()-based implementation never auto-followed redirects;
	// fetch()'s default (`redirect: 'follow'`) would silently forward the session cookie
	// to wherever a 3xx response pointed. Reject instead, matching the original's behavior
	// and treating an unexpected redirect the same as any other failed request.
	const fetchOpts = {
		method, headers, body, redirect: 'error',
	};
	if (insecure && url.startsWith('https:')) fetchOpts.dispatcher = insecureDispatcher;
	if (timeout) fetchOpts.signal = AbortSignal.timeout(timeout);

	const response = await fetch(url, fetchOpts);
	const bodyText = await response.text();

	const responseHeaders = {};
	response.headers.forEach((value, key) => {
		if (key === 'set-cookie') return; // handled separately below: spec-correct multi-value array
		responseHeaders[key] = value;
	});
	const setCookie = response.headers.getSetCookie();
	if (setCookie.length > 0) responseHeaders['set-cookie'] = setCookie;

	return { statusCode: response.status, headers: responseHeaders, body: bodyText };
};

module.exports = { request, insecureAgent, _setInsecureDispatcherForTesting };
