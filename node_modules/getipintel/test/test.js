/* eslint-disable no-console */
/* eslint-disable prefer-destructuring */
/* This Source Code Form is subject to the terms of the Mozilla Public
	License, v. 2.0. If a copy of the MPL was not distributed with this
	file, You can obtain one at http://mozilla.org/MPL/2.0/.

	Copyright 2019, Robin de Gruijter <gruijter@hotmail.com> */

// INSTRUCTIONS FOR TESTING FROM DESKTOP:
// install node (https://nodejs.org)
// install this package: > npm i getipintel
// run the test (from the install folder): > npm test ip=x.x.x.x contact=your@email.address flags=['m', 'b', 'f']

'use strict';

const _test = require('./_test.js');

console.log('Testing now. Hang on.....');

const options = {};
const args = process.argv.slice(2);
Object.keys(args).forEach((arg) => {
	const info = args[arg].split(/=+/g);
	if (info.length === 2) {
		options[info[0]] = info[1].replace(/['"]+/g, '');
	}
});

if (Object.keys(options).length === 0) {
	options.ip = process.argv[2];
}

options.contact = options.contact || 'test@anonymous.com';
options.flags = options.flags || 'f';

if (options.port) {
	options.port = Number(options.port);
}

// if (options.tls) {
// 	options.tls = options.tls.toLowerCase() === 'true';
// }

if (options.timeout) {
	options.timeout = Number(options.timeout);
}

_test.test(options)
	.then((log) => {
		for (let i = 0; i < (log.length); i += 1) {
			console.log(log[i]);
		}
	})
	.catch((error) => console.log(error));
