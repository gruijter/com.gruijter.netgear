/* This Source Code Form is subject to the terms of the Mozilla Public
	License, v. 2.0. If a copy of the MPL was not distributed with this
	file, You can obtain one at http://mozilla.org/MPL/2.0/.

	Copyright 2017 - 2026, Robin de Gruijter <gruijter@hotmail.com> */

'use strict';

// Centralized factories for the errors that recur across many SOAP/HTTP call sites.
// Each returns a plain Error (no custom classes, see rewrite plan) with an additive
// `.code` so tests/consumers can branch structurally instead of string-matching.

const withCode = (message, code) => {
	const error = new Error(message);
	error.code = code;
	return error;
};

const httpRequestFailed = (statusCode) => withCode(`HTTP request Failed. Status Code: ${statusCode}`, statusCode);

const notNetgearRouter = () => withCode('This is not a valid Netgear router', 'NOT_NETGEAR_ROUTER');

const incompleteResponse = () => withCode('Incorrect or incomplete response from router', 'INCOMPLETE_RESPONSE');

const noResponseCode = () => withCode('no response code from router', 'NO_RESPONSE_CODE');

const incompleteSoapEnvelope = () => withCode('Incomplete soap response received', 'INCOMPLETE_SOAP_ENVELOPE');

// maps a numeric SOAP <ResponseCode> to the matching error, preserving the exact
// literal messages the original code (and test/_test.js, which string-matches the
// 404 case) has always thrown.
const soapResponseCode = (responseCode) => {
	if (responseCode === 1) return withCode('1 Unknown. The requested function is not available', 1);
	if (responseCode === 401) return withCode('401 Unauthorized. Incorrect password?', 401);
	if (responseCode === 404) return withCode('404 Not Found. The requested function/page is not available', 404);
	return withCode(`Invalid response code from router: ${responseCode}`, responseCode);
};

module.exports = {
	withCode,
	httpRequestFailed,
	notNetgearRouter,
	incompleteResponse,
	noResponseCode,
	incompleteSoapEnvelope,
	soapResponseCode,
};
