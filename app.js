'use strict';

const Homey = require('homey');
// const util = require('util');
// const NetgearRouter = require('./netgear.js');
// const fs = require('fs');

class MyApp extends Homey.App {

	onInit() {
		this.log('Netgear App is running!');

		// // rerouting console to logfile
		// fs.unlink('./userdata/logfile.txt', (err) => {
		// 	if (err) {
		// 		console.log('error deleting logfile: ', err);
		// 	}
		// });
		// const logfile = fs.createWriteStream('./userdata/logfile.txt');
		// process.stdout.write = process.stderr.write = logfile.write.bind(logfile);

		process.on('unhandledRejection', (error) => {
			const logger = Homey.ManagerDrivers.getDriver('netgear').logger;
			this.error('unhandledRejection! ', error);
			logger.log('unhandledRejection! ', error);
		});
		Homey.on('unload', () => {
			const logger = Homey.ManagerDrivers.getDriver('netgear').logger;
			this.log('app unload called');
			logger.log('app unload called');
			logger.setLogFile();
		});

	}

	getLogs() {		// provide logs to api for frontend
		const logger = Homey.ManagerDrivers.getDriver('netgear').logger;
		return logger.getLogs();
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

// const blockme = async () => {
// 	try {
// 		await router.login();
// 		await router.setBlockDevice('68:A4:0E:04:B1:0F', 'Block');
// 		// console.log(await router.getAttachedDevices2());
// 		await router.setBlockDevice('68:A4:0E:04:B1:0F', 'Allow');
// 		router.setBlockDevice('68:A4:0E:04:B1:0F', 'Block')
// 			.catch((error) => {
// 				console.log(error);
// 			});
// 		router.setBlockDevice('68:A4:0E:04:B1:0F', 'Allow')
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
