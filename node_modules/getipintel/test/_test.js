/* This Source Code Form is subject to the terms of the Mozilla Public
	License, v. 2.0. If a copy of the MPL was not distributed with this
	file, You can obtain one at http://mozilla.org/MPL/2.0/.

	Copyright 2019, Robin de Gruijter <gruijter@hotmail.com> */

'use strict';

const os = require('os');

const GetIPIntel = require('../../getipintel.js/getipintel.js');
const { version } = require('../package.json');
// const util = require('util');

let log = [];
let errorCount = 0;
let t0 = Date.now();
const intel = new GetIPIntel();

// function to setup the router session
async function setupSession(opts) {
	try {
		log.push('========== STARTING TEST ==========');
		log.push(`Node version: ${process.version}`);
		log.push(`Netgear package version: ${version}`);
		log.push(`OS: ${os.platform()} ${os.release()}`);
		Object.keys(opts).forEach((opt) => {
			intel[opt] = opts[opt];
		});
		t0 = Date.now();
		errorCount = 0;
		log.push('t = 0');
	}	catch (error) {
		log.push(error);
		log.push(intel);
	}
}

// function to get various information
async function getIntel(IP, flags) {
	try {
		log.push(`trying to get Intel on ${IP} ...`);
		log.push(await intel.getIntel(IP, flags));
		log.push(`t = ${(Date.now() - t0) / 1000}`);

		// finish test
		if (errorCount) {
			log.push(`test finished with ${errorCount} errors`);
		} else {
			log.push('test finished without errors :)');
		}

	}	catch (error) {
		log.push(error);
		log.push(intel);
	}
}

exports.test = async (opts) => {
	log = [];	// empty the log
	try {
		await setupSession(opts);
		await getIntel(opts.ip, opts.flags);
		return Promise.resolve(log);
	}	catch (error) {
		return Promise.resolve(log);
	}
};
