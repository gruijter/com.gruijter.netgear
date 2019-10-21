/* This Source Code Form is subject to the terms of the Mozilla Public
	License, v. 2.0. If a copy of the MPL was not distributed with this
	file, You can obtain one at http://mozilla.org/MPL/2.0/.

	Copyright 2019, Robin de Gruijter <gruijter@hotmail.com> */


'use strict';

const http = require('http');
const https = require('https');
const util = require('util');

const setTimeoutPromise = util.promisify(setTimeout);
const regexIP = /^(([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])\.){3}([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])$/;
// const regexIP = /\b(?:\d{1,3}\.){3}\d{1,3}\b/;
const regexPrivateIP = /(^127\.)|(^10\.)|(^172\.1[6-9]\.)|(^172\.2[0-9]\.)|(^172\.3[0-1]\.)|(^192\.168\.)/;

class GetIPIntel {

	constructor(opts) {
		const options = opts || {};
		// http(s) api properties
		this.host = 'check.getipintel.net';
		this.port = options.port || 443;
		this.contact = options.contact || 'anonymous@anonymous.com';
		this.timeout = options.timeout || 6000;
		this.lastResponse = undefined;
		// cache properties
		this.cache = {};
		this.cacheTime = options.cacheTime || 60 * 60;	// in seconds
		// queue properties
		// eslint-disable-next-line eqeqeq
		this.rateLimit = options.rateLimit != false;
		this.queue = 0;

	}


	/**
	* Check an IP address.
	* @param {string} IP - The IP address under investigation ,e.g. '185.94.111.1'
	* @param {flags} [flags = ''] - Flags, see https://getipintel.net/free-proxy-vpn-tor-detection-api/#flags_compare
	* @param {flags} [oflags = 'bc'] - Output Flags, see https://getipintel.net/free-proxy-vpn-tor-detection-api/#oflagsb
	* @returns {Promise.<IPintel>} Intel on the IP address.
	*/
	async getIntel(IP, flgs, oflgs) {
		try {
			this.queue += 1;
			const ip = IP.replace(/[:-]/g, '.').replace(/\b0+\B/, '');	// remove leading 0's and replace seperators with .
			if (!regexIP.test(ip)) throw Error('No or incorrect IP address provided');
			if (regexPrivateIP.test(ip)) throw Error('Private IP addresses cannot be tested');
			const flags = flgs || '';
			const oflags = oflgs || 'bc';

			// remove old cache entries
			const now = Date.now();
			Object.keys(this.cache).forEach((key) => {
				if ((now - this.cache[key].ts) > this.cacheTime * 1000) delete this.cache[key];
			});
			// search cache
			if (this.cache[ip] && this.cache[ip].queryFlags === flags && this.cache[ip].contact === this.contact) {
				this.queue -= 1;
				return Promise.resolve(this.cache[ip]);
			}
			// rate limit
			if (this.rateLimit && this.queue > 25) throw Error('Too many requests in queue');
			if (this.rateLimit && this.queue > 1) await setTimeoutPromise(this.queue * 2000, 'waiting is done');
			const intel = await this._getIntel(ip, flags, oflags);
			this.queue -= 1;
			return Promise.resolve(intel);
		} catch (error) {
			this.queue -= 1;
			return Promise.reject(error);
		}
	}

	async _getIntel(ip, flags, oflags) {
		try {
			const headers = {
				'cache-control': 'no-cache',
				'user-agent': 'node-getipinteljs',
				connection: 'Keep-Alive',
			};
			const options = {
				hostname: this.host,
				port: this.port,
				path: `/check.php?ip=${ip}&contact=${this.contact}&format=json&oflags=${oflags}&flags=${flags}`,
				headers,
				method: 'GET',
			};
			let result;
			if (this.port === 443) {
				result = await this._makeHttpsRequest(options);
			} else {
				result = await this._makeHttpRequest(options);
			}
			this.lastResponse = result.statusCode;
			if (result.statusCode !== 200) {
				if (result.statusCode === 429) throw Error('Number of allowed queries exceeded');
				throw Error(`HTTP request Failed. Status Code: ${result.statusCode}`);
			}
			const contentType = result.headers['content-type'];
			if (!/^application\/json/.test(contentType)) {
				throw Error(`Invalid content-type. Expected application/json but received ${contentType}`);
			}
			const intel = JSON.parse(result.body);
			if (!intel.status || intel.status !== 'success') {
				throw Error(result.body);
			}
			this.cache[ip] = intel;
			this.cache[ip].ts = Date.now();
			return Promise.resolve(intel);
		} catch (error) {
			return Promise.reject(error);
		}
	}

	_makeHttpRequest(options, postData, timeout) {
		return new Promise((resolve, reject) => {
			const req = http.request(options, (res) => {
				let resBody = '';
				res.on('data', (chunk) => {
					resBody += chunk;
				});
				res.once('end', () => {
					if (!res.complete) {
						return reject(Error('The connection was terminated while the message was still being sent'));
					}
					res.body = resBody;
					return resolve(res); // resolve the request
				});
			});
			req.setTimeout(timeout || this.timeout, () => {
				req.abort();
			});
			req.once('error', (e) => {
				req.abort();
				this.lastResponse = e;	// e.g. ECONNREFUSED on wrong soap port or wrong IP // ECONNRESET on wrong IP
				return reject(e);
			});
			// req.write(postData);
			req.end(postData);
		});
	}

	_makeHttpsRequest(options, postData, timeout) {
		return new Promise((resolve, reject) => {
			const req = https.request(options, (res) => {
				let resBody = '';
				res.on('data', (chunk) => {
					resBody += chunk;
				});
				res.once('end', () => {
					if (!res.complete) {
						return reject(Error('The connection was terminated while the message was still being sent'));
					}
					res.body = resBody;
					return resolve(res); // resolve the request
				});
			});
			req.setTimeout(timeout || this.timeout, () => {
				req.abort();
			});
			req.once('error', (e) => {
				req.abort();
				this.lastResponse = e;	// e.g. ECONNREFUSED on wrong soap port or wrong IP // ECONNRESET on wrong IP
				return reject(e);
			});
			// req.write(postData);
			req.end(postData);
		});
	}

}

module.exports = GetIPIntel;

// definitions for JSDoc

/**
* @class GetIPIntel
* @classdesc Class representing a session with a the getipintel API.
* @param {sessionOptions} [options] - configurable session options
* @example // create a session, do a quick test an IP address
	const GetIPIntel = require('getipintel');

	const intel = new GetIPIntel({ contact: 'youremail@real.address' });

	async function getIntel(IP, flags, oflags) {
		try {
			const result = await intel.getIntel(IP, flags, oflags);
			console.log(result);
		} catch (error) {
			console.log(error);
		}
	}

	getIntel('185.94.111.1');
*/

/**
* @typedef sessionOptions
* @description sessionOptions is an object used to setup a new session
* @property {string} contact e.g. 'youremail@real.address'. See https://getipintel.net/free-proxy-vpn-tor-detection-api/#expected_input
* @property {number} [port = 443] e.g. 80
* @property {number} [timeout = 6000] the http(s) timeout in ms.
* @property {number} [cacheTime = 3600] the maximum time for intel results to be cached locally, in seconds.
* @property {boolean} [rateLimit = true] when set to FALSE no rate limiting will be applied
* @example // sessionOptions
{
	contact: 'youremail@real.address',
	cacheTime: 0,
}
*/

/**
* @typedef IPintel
* @description IPintel is an object with properties similar to this.
* @property {string} status e.g. 'success'
* @property {string} result e.g. '0.99992799758911'. see https://getipintel.net/free-proxy-vpn-tor-detection-api/#expected_output
* @property {string} queryIP e.g. '185.94.111.1'
* @property {number} BadIP e.g. 1 for bad
* @property {string} Country geolocation of the IP address in ISO-3166 format e.g. 'RU'
* @property {number} ts timestamp of the query result e.g. 1570792169764
* @example // IPintel
{	status: 'success',
	result: '0.99992799758911',
	queryIP: '185.94.111.1',
	queryFlags: 'f',
	queryOFlags: 'coflags=b',
	queryFormat: 'json',
	contact: 'test@anonymous.com',
	BadIP: 1,
	Country: 'RU'
	ts: 1570792169764},
*/
