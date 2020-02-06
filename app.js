/*
Copyright 2017 - 2019, Robin de Gruijter (gruijter@hotmail.com)

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
const _test = require('netgear/test/_test.js');
const Logger = require('./captureLogs.js');
// require('inspector').open(9229, '0.0.0.0', false);

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
		// do garbage collection every 10 minutes
		this.intervalIdGc = setInterval(() => {
			global.gc();
		}, 1000 * 60 * 10);
	}

	//  stuff for frontend API
	deleteLogs() {
		return this.logger.deleteLogs();
	}

	getLogs() {
		return this.logger.logArray;
	}

	runTest(data) {
		this.log('Router compatibility test started');
		const options = {
			password: data.password,
			host: data.host,
			port: data.port,
			info: `Homey fw:${Homey.version} app: ${Homey.manifest.version}`,
			shorttest: true,
		};
		const output = _test.test(options);
		return Promise.resolve(output);
	}

	discover() {
		this.log('Router discovery started');
		const discover = _test.discover();
		return Promise.resolve(discover);
	}

	async getKnownDevices() {
		this.log('Retrieving known devices list');
		const driver = Homey.ManagerDrivers.getDriver('netgear');
		const routers = driver.getDevices();
		// const kdArray = [];
		// routers.forEach((router) => { kdArray[router.getName()] = router.knownDevices; });
		return Promise.resolve(routers[0].knownDevices);
	}

}

module.exports = MyApp;
