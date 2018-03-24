/*
Copyright 2017, 2018, Robin de Gruijter (gruijter@hotmail.com)

This file is part of com.gruijter.netgear.

com.gruijter.netgear is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

com.gruijter.netgear is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with Foobar.  If not, see <http://www.gnu.org/licenses/>.
*/

'use strict';

const Homey = require('homey');
const StdOutFixture = require('fixture-stdout');
const fs = require('fs');
// const util = require('util');
// const NetgearRouter = require('netgear');

class MyApp extends Homey.App {

	onInit() {
		this.initLogCapture(200, 'netgearLog');
		this.log('Netgear App is running!');

		process.on('unhandledRejection', (error) => {
			this.error('unhandledRejection! ', error);
		});
		Homey.on('unload', () => {
			this.log('app unload called');
			// save logs to persistant storage
			this.setLogFile();
		});
	}

	// capture all logs for frontend
	initLogCapture(logLength, logName) {
		logLength = logLength || 100;
		logName = logName || 'log';
		const logFile = `/userdata/${logName}.json`;
		this.logArray = [];
		this.getLogFile = () => {
			fs.readFile(logFile, 'utf8', (err, data) => {
				if (err) {
					this.log('error reading logfile: ', err);
					return [];
				}
				try {
					this.logArray = JSON.parse(data);
					// console.log(this.logArray);
				} catch (error) {
					this.log('error parsing logfile: ', error);
					return [];
				}
				return this.logArray;
			});
		};
		this.setLogFile = () => {
			fs.writeFile(logFile, JSON.stringify(this.logArray), (err) => {
				if (err) {
					this.log('error writing logfile: ', err);
				} else {
					this.log('logfile saved');
				}
			});
		};
		this.unsetLogFile = () => {
			fs.unlink(logFile, (err) => {
				if (err) {
					this.log('error deleting logfile: ', err);
				}
			});
		};
		// load logFile into memory
		this.getLogFile();
		// provide logs function for frontend api
		this.getLogs = () => {
			// this.log('getting logs for frontend');
			return this.logArray;
		};
		// Capture all writes to stdout (e.g. this.log)
		const captureStdout = new StdOutFixture({ stream: process.stdout });
		captureStdout.capture((string) => {
			if (this.logArray.length >= this.logLength) {
				this.logArray.shift();
			}
			this.logArray.push(string);
			// return false;	// prevent the write to the original stream
		});
		// captureStdout.release();
		// Capture all writes to stderr (e.g. this.error)
		const captureStderr = new StdOutFixture({ stream: process.stderr });
		captureStderr.capture((string) => {
			if (this.logArray.length >= this.logLength) {
				this.logArray.shift();
			}
			this.logArray.push(string);
			// return false;	// prevent the write to the original stream
		});
		// captureStderr.release();
	}

}

module.exports = MyApp;

// const router = new NetgearRouter([password], [user], [host], [port]);
//
// router.login()	// [password], [user], [host], [port]
// 	.then(() => {
// 		console.log(util.inspect(router));
// 	})
// 	.catch((error) => {
// 		console.log(error);
// 	});
//
// router.getInfo()
// 	.then((result) => {
// 		console.log(result);
// 	})
// 	.catch((error) => {
// 		console.log(error.message);
// 	});

// router.getAttachedDevices()
// .then((result) => {
// 	console.log(result);
// })
// .catch((error) => {
// 	console.log(error);
// });

// router.getAttachedDevices2()
// .then((result) => {
// 	console.log(result);
// })
// .catch((error) => {
// 	console.log(error);
// });

// router.getTrafficMeter()
// 	.then((result) => {
// 		console.log(result);
// 	})
// 	.catch((error) => {
// 		console.log(error);
// 	});

// router.setGuestAccessEnabled(true)
// 	.then((result) => {
// 		console.log(result);
// 	})
// 	.catch((error) => {
// 		console.log(error);
// 	});

// router.set5GGuestAccessEnabled(false)
// 	.then((result) => {
// 		console.log(result);
// 	})
// 	.catch((error) => {
// 		console.log(error);
// 	});

// const blockme = async () => {
// 	try {
// 		await router.login();
// 		await router.setBlockDevice('AA:BB:CC:DD:EE:FF', 'Block');
// 		// console.log(await router.getAttachedDevices2());
// 		await router.setBlockDevice('AA:BB:CC:DD:EE:FF', 'Allow');
// 		router.setBlockDevice('AA:BB:CC:DD:EE:FF', 'Block')
// 			.catch((error) => {
// 				console.log(error);
// 			});
// 		router.setBlockDevice('AA:BB:CC:DD:EE:FF', 'Allow')
// 			.catch((error) => {
// 				console.log(error);
// 			});
// 		// console.log(await router.getAttachedDevices());
// 	}	catch (error) {
// 		console.log(error);
// 	}
// };
//
// blockme();

// router.reboot()
// 	.then((result) => {
// 		console.log(result);
// 	})
// 	.catch((error) => {
// 		console.log(error);
// 	});
