/* This Source Code Form is subject to the terms of the Mozilla Public
	License, v. 2.0. If a copy of the MPL was not distributed with this
	file, You can obtain one at http://mozilla.org/MPL/2.0/.

	Copyright 2017 - 2026, Robin de Gruijter <gruijter@hotmail.com> */

'use strict';

const { XMLParser } = require('fast-xml-parser');
const errors = require('./errors');

// Some router firmware emits illegal XML 1.0 characters and/or a non-standard
// `soap-env:` namespace prefix instead of the expected `v:` prefix. Strip/normalize
// both before handing the body to any parser.
// XML 1.0 legal ranges: #x9 | #xA | #xD | [#x20-#xD7FF] | [#xE000-#xFFFD] | [#x10000-#x10FFFF]
// NOTE: the original implementation built this same character class but passed it to
// String#replace as a plain string (not a RegExp), so it silently never matched
// anything. Wrapping it in `new RegExp(..., 'g')` is one of the opportunistic bug
// fixes from the rewrite plan - it only makes the stripping actually work.
const xml10IllegalCharsSource = '[^'
	+ '\u0009\r\n'
	+ '\u0020-\uD7FF'
	+ '\uE000-\uFFFD'
	+ '\u{10000}-\u{10FFFF}'
	+ ']';
// note: needs the 'u' (unicode) flag for the astral-plane \u{10000}-\u{10FFFF} range to be valid
const xml10IllegalChars = new RegExp(xml10IllegalCharsSource, 'gu');

const patchBody = (body) => body
	.replace(xml10IllegalChars, '')
	.replace(/soap-env:envelope/gi, 'v:Envelope')
	.replace(/soap-env:body/gi, 'v:Body');

const unescapeXmlEntities = (str) => str
	.replace(/&amp;/gi, '&')
	.replace(/&lt;/gi, '<')
	.replace(/&gt;/gi, '>');

// one parser per nativeType setting is enough re-use; fast-xml-parser instances are stateless w.r.t. input
const parsers = new Map();
const getParser = (nativeType) => {
	if (!parsers.has(nativeType)) {
		parsers.set(nativeType, new XMLParser({
			ignoreAttributes: true,
			ignoreDeclaration: true,
			removeNSPrefix: true,
			parseTagValue: !!nativeType,
			// xml-js (the library this replaces) never trimmed text node whitespace;
			// fast-xml-parser trims by default. Keep trimming off so field values match
			// the original byte-for-byte, in case any router firmware pads values with
			// leading/trailing whitespace.
			trimValues: false,
		}));
	}
	return parsers.get(nativeType);
};

/**
* Parses a full SOAP envelope body into its raw parsed tree (patched + namespace-prefix-
* stripped), for the rare call site that needs to navigate the response itself (e.g. an
* array of repeated elements) rather than getting one flattened object back.
* @param {string} xmlBody
* @param {object} [opts]
* @param {boolean} [opts.nativeType=false] - auto-convert numeric/boolean-looking text to native types
* @returns {object}
*/
const parseSoapTree = (xmlBody, { nativeType = false } = {}) => getParser(nativeType).parse(patchBody(xmlBody));

/**
* Flattens one level of a parsed SOAP object's child elements into a plain
* { propName: value } object.
* @param {object} entries
* @param {boolean} [stripNewPrefix=false] - strip a leading 'New' from each field name
* @returns {Record<string, *>}
*/
const flattenEntries = (entries, stripNewPrefix = false) => {
	const result = {};
	Object.keys(entries).forEach((key) => {
		const propName = stripNewPrefix ? key.replace(/^New/, '') : key;
		const value = entries[key];
		// xml-js (the library this replaces) has no `_text` node at all for an empty/self-closing
		// tag - or one containing only whitespace - which the original code surfaced as `undefined`
		// (see e.g. the `info` typedef's documented `VPNVersion: undefined`); fast-xml-parser instead
		// yields `''`, or the literal whitespace/newline text (trimValues is deliberately off above,
		// so a real padded value like '  R7800  ' survives byte-for-byte) - normalize both back to
		// `undefined` so callers see the exact same shape as before.
		const isBlank = typeof value === 'string' && value.trim() === '';
		result[propName] = isBlank ? undefined : value;
	});
	return result;
};

/**
* Descends into a parsed SOAP tree (as returned by parseSoapTree) along responseKey (a Body
* child element name - e.g. 'GetInfoResponse'; pass an array to descend further, e.g.
* ['GetSupportFeatureListXMLResponse', 'newFeatureList', 'features']), without flattening or
* throwing. Shared by parseSoapObject and the handful of call sites that need the raw
* (unflattened) entries themselves - e.g. to distinguish a single repeated element from an array
* of them before mapping over it - rather than one flattened object.
* @param {object} rawJson - as returned by parseSoapTree
* @param {string|string[]} responseKey
* @returns {*} undefined if any segment of the path is missing
*/
const resolveSoapPath = (rawJson, responseKey) => {
	const path = Array.isArray(responseKey) ? responseKey : [responseKey];
	let entries = rawJson && rawJson.Envelope && rawJson.Envelope.Body;
	path.forEach((key) => {
		entries = entries && entries[key];
	});
	return entries;
};

/**
* Parses a SOAP envelope body down to the object at responseKey (a Body child
* element name, without namespace prefix - e.g. 'GetInfoResponse'; pass an array
* to descend further, e.g. ['GetSupportFeatureListXMLResponse', 'newFeatureList', 'features']).
* @param {string} xmlBody - raw SOAP response body
* @param {string|string[]} responseKey
* @param {object} [opts]
* @param {boolean} [opts.stripNewPrefix=false] - strip a leading 'New' from each field name
* @param {boolean} [opts.nativeType=false] - auto-convert numeric/boolean-looking text to native types
* @returns {Record<string, *>}
* @throws {Error} when responseKey (or its path) is not present in the parsed body
*/
const parseSoapObject = (xmlBody, responseKey, { stripNewPrefix = false, nativeType = false } = {}) => {
	const rawJson = parseSoapTree(xmlBody, { nativeType });
	const entries = resolveSoapPath(rawJson, responseKey);
	if (entries === undefined || entries === null || typeof entries !== 'object') throw errors.incompleteResponse();
	return flattenEntries(entries, stripNewPrefix);
};

// cache compiled regexes per (tagName, multiline) pair
const tagRegexes = new Map();
const getTagRegex = (tagName, multiline) => {
	const cacheKey = `${tagName} ${multiline}`;
	if (!tagRegexes.has(cacheKey)) {
		tagRegexes.set(cacheKey, new RegExp(`<${tagName}>(.*)</${tagName}>`, multiline ? 's' : ''));
	}
	return tagRegexes.get(cacheKey);
};

/**
* Extracts the text content of a single XML tag via regex, tolerant of surrounding
* malformed/non-well-formed XML (some router firmware emits broken responses outside
* of the one tag actually needed) - deliberately not routed through parseSoapObject.
* Throws the same uniform "incomplete response" error as parseSoapObject when the tag
* is absent, unless `optional` is set - the original code applied an equivalent presence
* check ad hoc at only some call sites (leaving others to throw a raw TypeError instead);
* defaulting to "required" here applies that same intent consistently everywhere.
* @param {string} body
* @param {string} tagName - e.g. 'NewTodayUpload'
* @param {object} [opts]
* @param {boolean} [opts.multiline=false]
* @param {boolean} [opts.optional=false] - return undefined instead of throwing when absent
* @returns {string|undefined}
* @throws {Error} when the tag is absent and `optional` is not set
*/
const extractXmlTag = (body, tagName, { multiline = false, optional = false } = {}) => {
	const match = getTagRegex(tagName, multiline).exec(body);
	if (!match) {
		if (optional) return undefined;
		throw errors.incompleteResponse();
	}
	return match[1];
};

module.exports = {
	patchBody,
	unescapeXmlEntities,
	parseSoapTree,
	resolveSoapPath,
	flattenEntries,
	parseSoapObject,
	extractXmlTag,
};
