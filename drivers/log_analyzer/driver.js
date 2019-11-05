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
// const util = require('util');

class LogAnalyzerDriver extends Homey.Driver {

	onInit() {
		this.log('LogAnalyzerDriver onInit');
		// Homey
		// 	.on('logUpdate', (info) => {
		// 		const logs = JSON.parse(info);
		// 		// console.log(logs[0]);
		// 		this.updateLogDevice(logs)
		// 			.catch(this.log);
		// 		// console.log(util.inspect(knownDevices, true, 4, true));
		// 		// this.updateDevices(knownDevices);
		// 	});
	}

	// async updateLogDevice(logs) {	// HOW TO FILTER THE RIGHT LOG FROM WHAT NETGEAR ROUTER?
	// 	try {
	// 		const analyzer = await this.getDevices();
	// 		if (!analyzer || !analyzer[0]) {
	// 			// throw Error('No log analyzer found');
	// 			return Promise.resolve(false);
	// 		}
	// 		analyzer[0].updateInfo(logs);
	// 		return Promise.resolve(true);
	// 	} catch (error) {
	// 		return Promise.reject(error);
	// 	}
	// }

	onPair(socket) {
		socket.on('list_devices', async (data, callback) => {
			this.log('pairing started by user');
			try {
				const netgearDriver = Homey.ManagerDrivers.getDriver('netgear');
				await netgearDriver.ready(() => null);
				const routers = await netgearDriver.getDevices();
				if (!routers || !routers[0]) { throw Error('Cannot find a router device in Homey. Router needs to be added first!'); }

				const devices = [];
				Object.keys(routers).forEach((router) => {
					// const icon = iconTable[knownDevices[attachedDevice].DeviceType] || 'default';
					const device = {
						name: `${routers[router].getName()} Cyber Detector`,
						// icon: `../assets/${icon}.svg`,	// change the icon?
						data: {
							id: `cd_${routers[router].getData().id}`,
						},
						settings: {
							router_model: routers[router].getSettings().model_name,
							router_id: routers[router].getData().id,
							// mac: knownDevices[attachedDevice].MAC,
							// offline_after: 180,	// seconds
							// use_link_info: true,	// wifi link speed and signal strength
							// use_bandwidth_info: true,	// up/down speed
							// report_power: true,	// linked to onoff capability
						},
						capabilities: ['alarm_cyber', 'attack_rate', 'last_attack', 'last_log'],
					};
					devices.push(device);
				});
				callback(null, devices);
			} catch (error) {
				this.error(error);
				callback(error, null);
			}
		});

	}

}

module.exports = LogAnalyzerDriver;
