/* eslint-disable prefer-destructuring */
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
const NetgearRouter = require('netgear');

const deviceModes = ['Router', 'Access Point', 'Bridge', '3: Unknown', '4: Unknown'];

class NetgearDriver extends Homey.Driver {

	onInit() {
		this.log('NetgearDriver onInit');
	}

	// function to return the list of known attached devices for autocomplete flowcards
	makeAutocompleteList() {	// call with NetgearDevice as this
		const list = [];
		Object.keys(this.knownDevices).forEach((key) => {
			const device = this.knownDevices[key];
			if (!device.MAC) { return; }
			list.push({
				name: device.MAC,
				description: device.Name || 'unknown',
			});
		});
		return list;
	}

	async login()	{	// call with NetgearDevice as this
		try {
			if (!this.routerSession.loggedIn) {
				this.log('Logging in');
			}
			await this.routerSession.login();
			this.setAvailable()
				.catch(this.error);
			// this.log('Login successful');
			return Promise.resolve(true);
		}	catch (error) {
			this.setUnavailable(error.message)
				.catch(this.error);
			return Promise.reject(error);
		}
	}

	// function to retrieve router data every poll
	async getRouterData() {	// call with NetgearDevice as this
		const { readings } = this;
		try {
			await this._driver.login.call(this);
			readings.currentSetting = await this.routerSession.getCurrentSetting();
			readings.attachedDevices = await this.routerSession.getAttachedDevices();
			readings.trafficMeter = await this.routerSession.getTrafficMeter()
				.catch(() => {
					this.log('error getting traffic meter info');
					return undefined;
				});
			readings.pollTime = new Date();
			if (readings.trafficMeter) readings.trafficMeter.pollTime = readings.pollTime;
			return Promise.resolve(readings);
		} catch (error) {
			return Promise.reject(error);
		}
	}

	// function to retrieve extra router data once an hour
	async getExtraRouterData() {	// call with NetgearDevice as this
		try {
			if (!this.routerSession.loggedIn) {
				await this.routerSession.login();
			}
			const extraReadings = {};
			extraReadings.info = await this.routerSession.getInfo()
				.catch(() => this.log('error getting router info'));
			extraReadings.newFirmware = await this.routerSession.checkNewFirmware()
				.catch(() => {
					this.log('error getting new Firmware info');
					return {};
				});
			extraReadings.extraPollTime = new Date();
			return Promise.resolve(extraReadings);
		} catch (error) {
			return Promise.reject(error);
		}
	}

	// function to retrieve router logs every poll
	async getLogs() {	// call with NetgearDevice as this
		try {
			// if (!this.routerSession.loggedIn) {
			// 	await this.routerSession.login();
			// }
			const logs = await this.routerSession.getLogs(true)
				.catch(() => {
					this.log('error getting Logs from router');
					return undefined;
				});
			return Promise.resolve(logs);
		} catch (error) {
			return Promise.reject(error);
		}
	}

	async wol(mac, password) { // call with NetgearDevice as this
		try {
			this.log(`WOL requested for device ${mac} ${this.knownDevices[mac].Name}`);
			if (!this.routerSession.loggedIn) {
				await this.routerSession.login();
			}
			await this.routerSession.wol(mac, password);
			return Promise.resolve(true);
		}	catch (error) {
			// this.error('WOL error', error.message);
			return Promise.reject(error);
		}
	}

	async blockOrAllow(mac, action) { // call with NetgearDevice as this
		try {
			this.log(`${action} requested for device "${mac}"`);
			if (!this.routerSession.loggedIn) {
				await this.routerSession.login();
			}
			await this.routerSession.setBlockDevice(mac, action);
			return Promise.resolve(true);
		}	catch (error) {
			// this.error('blockOrAllow error', error.message);
			return Promise.reject(error);
		}
	}

	async setGuestwifi(action) { // call with NetgearDevice as this
		try {
			this.log(`2.4GHz-1 guest wifi ${action} requested`);
			if (!this.routerSession.loggedIn) {
				await this.routerSession.login();
			}
			const onOff = (action === 'on');
			await this.routerSession.router.setGuestWifi(onOff);
			return Promise.resolve(true);
		}	catch (error) {
			// this.error('2.4GHz-1 set guest wifi error', error.message);
			return Promise.reject(error);
		}
	}

	async setGuestwifi2(action) { // call with NetgearDevice as this
		try {
			this.log(`2.4GHz-2 guest wifi ${action} requested`);
			if (!this.routerSession.loggedIn) {
				await this.routerSession.login();
			}
			const onOff = (action === 'on');
			await this.routerSession.setGuestWifi(onOff);	// there is actually no method yet to do 2.4Ghz-2
			return Promise.resolve(true);
		}	catch (error) {
			// this.error('2.4GHz-2 set guest wifi error error', error.message);
			return Promise.reject(error);
		}
	}

	async set5GGuestWifi(action) { // call with NetgearDevice as this
		try {
			this.log(`5GHz-1 guest wifi ${action} requested`);
			if (!this.routerSession.loggedIn) {
				await this.routerSession.login();
			}
			const onOff = (action === 'on');
			await this.routerSession.set5GGuestWifi(onOff);
			return Promise.resolve(true);
		}	catch (error) {
			// this.error('5GHz-1 set guest wifi error errorr', error.message);
			return Promise.reject(error);
		}
	}

	async set5GGuestWifi2(action) { // call with NetgearDevice as this
		try {
			this.log(`5GHz-2 guest wifi ${action} requested`);
			if (!this.routerSession.loggedIn) {
				await this.routerSession.login();
			}
			const onOff = (action === 'on');
			await this.routerSession.set5GGuestWifi2(onOff);
			return Promise.resolve(true);
		}	catch (error) {
			// this.error('5GHz-2 set guest wifi error error', error.message);
			return Promise.reject(error);
		}
	}

	async speedTest() { // call with NetgearDevice as this
		try {
			this.log('router speedtest requested');
			if (!this.routerSession.loggedIn) {
				await this.routerSession.login();
			}
			const speed = await this.routerSession.speedTest();
			return Promise.resolve(speed);
		}	catch (error) {
			// this.error('speedTest error', error);
			// this.log('last repsonse from router:');
			// this.log(this.routerSession.lastResponse);
			return Promise.reject(error);
		}
	}

	async updateNewFirmware() { // call with NetgearDevice as this
		try {
			this.log('router firmware update requested');
			if (!this.routerSession.loggedIn) {
				await this.routerSession.login();
			}
			await this.routerSession.updateNewFirmware();
			return Promise.resolve(true);
		}	catch (error) {
			// this.error('updateNewFirmware error', error);
			// this.log('last repsonse from router:');
			// this.log(this.routerSession.lastResponse);
			return Promise.reject(error);
		}
	}

	async reboot() { // call with NetgearDevice as this
		try {
			this.log('router reboot requested');
			if (!this.routerSession.loggedIn) {
				await this.routerSession.login();
			}
			await this.routerSession.reboot();
			return Promise.resolve(true);
		}	catch (error) {
			// this.error('reboot error', error);
			return Promise.reject(error);
		}
	}

	async enableTrafficMeter(action) { // call with NetgearDevice as this
		try {
			const enableDisable = (action && 'enable') || 'disable';
			this.log(`Traffic meter ${enableDisable} requested`);
			if (!this.routerSession.loggedIn) {
				await this.routerSession.login();
			}
			await this.routerSession.enableTrafficMeter(action);
			return Promise.resolve(true);
		}	catch (error) {
			// this.error('enableTrafficMeter error', error);
			return Promise.reject(error);
		}
	}

	async setBlockDeviceEnable(action) { // call with NetgearDevice as this
		try {
			const enableDisable = (action && 'enable') || 'disable';
			this.log(`Access control ${enableDisable} requested`);
			if (!this.routerSession.loggedIn) {
				await this.routerSession.login();
			}
			await this.routerSession.setBlockDeviceEnable(action);
			return Promise.resolve(true);
		}	catch (error) {
			// this.error('setBlockDeviceEnable error', error);
			return Promise.reject(error);
		}
	}

	onPair(socket) {
		const router = new NetgearRouter();
		socket.on('discover', async (data, callback) => {
			try {
				this.log('discover button pressed in frontend');
				const discover = await router.discover();
				this.log(discover);
				callback(null, JSON.stringify(discover)); // report success to frontend
			}	catch (error) {
				this.log(error);
				callback(error);
			}
		});
		socket.on('save', async (data, callback) => {
			try {
				this.log('save button pressed in frontend');
				const password = data.password;
				const username = data.username;
				let host = data.host;
				let port = data.port;
				let discover = {};
				if (!port || !host || host === '') {
					discover = await router.discover();
					port = port || discover.port;
					host = host || discover.host;
				}
				// try to login
				const options = {
					password,
					username,
					host,
					port,
					tls: port === 443,
				};
				await router.login(options);
				const info = await router.getInfo();
				if (!Object.prototype.hasOwnProperty.call(info, 'SerialNumber')) throw Error('No SerialNumber found');
				const device = {
					name: info.ModelName || info.DeviceName || 'Netgear',
					data: { id: info.SerialNumber },
					settings: {
						username: router.username,
						password: router.password,
						host: router.host,
						port: router.port,
						model_name: info.ModelName || info.DeviceName || 'Netgear',
						serial_number: info.SerialNumber,
						firmware_version: info.Firmwareversion,
						device_mode: deviceModes[Number(info.DeviceMode)],
						polling_interval: 60,
						internet_connection_check: 'netgear',
						offline_after: 300,
					},
					class: 'sensor',
					capabilities: ['alarm_generic', 'attached_devices', 'download_speed', 'upload_speed'],
					energy: {
						approximation: {
							usageConstant: 8,
						},
					},
					// "capabilitiesOptions": {
					// 	"onoff": {
					// 		"uiComponent": null,
					// 		"uiQuickAction": false,
					// 		"getable": true,
					// 		"setable": false,
					// 		"preventInsights": true,
					// 		"insights": false
					// 	}
					// },

				};
				callback(null, device); // report success to frontend
			}	catch (error) {
				this.error('Pair error:', error.message);
				callback(error);
			}
		});
	}

}

module.exports = NetgearDriver;
