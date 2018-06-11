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
along with com.gruijter.netgear.  If not, see <http://www.gnu.org/licenses/>.
*/

'use strict';

const Homey = require('homey');
const Logger = require('./captureLogs.js');
// const util = require('util');
// const NetgearRouter = require('netgear');

class MyApp extends Homey.App {

	onInit() {
		this.logger = new Logger('netgearLog', 200);
		this.log('Netgear App is running!');

		// register some listeners
		process.on('unhandledRejection', (error) => {
			this.error('unhandledRejection! ', error);
		});
		process.on('uncaughtException', (error) => {
			this.error('uncaughtException! ', error);
		});
		Homey
			.on('unload', () => {
				this.log('app unload called');
				// save logs to persistant storage
				this.logger.saveLogs();
			})
			.on('memwarn', () => {
				this.log('memwarn!');
			});
	}

	//  stuff for frontend API
	deleteLogs() {
		return this.logger.deleteLogs();
	}
	getLogs() {
		return this.logger.logArray;
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
