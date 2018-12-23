/* eslint-disable prefer-destructuring */
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
const NetgearRouter = require('netgear');

class NetgearDriver extends Homey.Driver {

	onInit() {
		this.log('NetgearDriver onInit');
	}

	// function to keep a list of known attached devices
	async updateDeviceList() {		// call with NetgearDevice as this
		try {
			let persistent = false;
			const attachedDevices = this.readings.attachedDevices;
			this.knownDevices = this.knownDevices || {};
			// console.log(attachedDevices);
			for (let i = 0; i < attachedDevices.length; i += 1) {
				if (!Object.prototype.hasOwnProperty.call(this.knownDevices, attachedDevices[i].MAC)) {	// new device detected!
					if (this.knownDevices[attachedDevices[i].MAC]) {	// for some reason a device is sometimes null
						delete this.knownDevices[attachedDevices[i].MAC];
						return;
					}
					this.log(`new device added: ${attachedDevices[i].MAC} ${attachedDevices[i].Name}`);
					persistent = true;
					this.knownDevices[attachedDevices[i].MAC] = attachedDevices[i];
					const tokens = {
						mac: attachedDevices[i].MAC,
						name: attachedDevices[i].Name,
						ip: attachedDevices[i].IP,
					};
					this.newAttachedDeviceTrigger
						.trigger(this, tokens)
						// .then(this.log(tokens))
						.catch((error) => {
							this.error('trigger error', error);
						});
				}
				if (this.knownDevices[attachedDevices[i].MAC] == null) {
					this.log('deleting corrupt device', this.knownDevices[attachedDevices[i].MAC]);
					delete this.knownDevices[attachedDevices[i].MAC];
					return;
				}
				const lastOnline = this.knownDevices[attachedDevices[i].MAC].online || 0;
				this.knownDevices[attachedDevices[i].MAC] = attachedDevices[i];
				this.knownDevices[attachedDevices[i].MAC].online = lastOnline;
				const lastSeen = new Date();
				this.knownDevices[attachedDevices[i].MAC].lastSeen = lastSeen.toISOString(); // to turn it back into a date: Date.parse(test.lastSeen)
				if (!this.knownDevices[attachedDevices[i].MAC].online) {
					this.log(`Online: ${attachedDevices[i].MAC} ${attachedDevices[i].Name} ${attachedDevices[i].IP}`);
					const tokens = {
						mac: attachedDevices[i].MAC,
						name: attachedDevices[i].Name,
						ip: attachedDevices[i].IP,
					};
					this.deviceOnlineTrigger
						.trigger(this, tokens)
						// .then(this.log(tokens))
						.catch((error) => {
							this.error('trigger error', error);
						});
				}
				this.knownDevices[attachedDevices[i].MAC].online = true;
			}
			// Loop through all known devices to see if they got detached
			const offlineDelay = this.getSettings().offline_after * 1000;	// default 5 minutes
			let onlineCount = 0;
			Object.keys(this.knownDevices).forEach((key) => {
				if (this.knownDevices[key] == null) {
					this.log('deleting corrupt device@detachCheck', this.knownDevices[key]);
					delete this.knownDevices[key];
					return;
				}
				const device = this.knownDevices[key];
				if ((new Date() - Date.parse(device.lastSeen)) > offlineDelay) {
					if (device.online) {
						this.log(`Offline: ${device.MAC} ${device.Name}`);
						const tokens = {
							mac: device.MAC,
							name: device.Name,
							ip: device.IP,
						};
						this.deviceOfflineTrigger
							.trigger(this, tokens)
							// .then(this.log(tokens))
							.catch((error) => {
								this.error('trigger error', error);
							});
					}
					this.knownDevices[key].online = false;
				}
				// calculate online devices count
				if (this.knownDevices[key].online) {
					onlineCount += 1;
				}
			});
			// store online devices count
			this.onlineDeviceCount = onlineCount;
			// save devicelist to persistent storage
			if (persistent) {
				this.setStoreValue('knownDevices', this.knownDevices);
			}
		}	catch (error) {
			this.error('error:', error);
		}
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

	login()	{	// call with NetgearDevice as this
		const loggedIn = this.routerSession.login()
			.then(() => {
				this.log('login succsesfull @ driver');
				this.setAvailable()
					.catch(this.error);
			})
			.catch((error) => {
				this.error('Login error:', error.message);
				// this.log('last repsonse from router:');
				// this.log(this.lastResponse);
				this.setUnavailable(error.message)
					.catch(this.error);
			});
		return Promise.resolve(loggedIn);
	}

	async getRouterData() {		// call with NetgearDevice as this
		const readings = {
			info: this.readings.info,
			newFirmware: this.readings.newFirmware,
			timestamp: this.readings.timestamp,
		};
		try {
			// get new data from router
			if (!this.routerSession.loggedIn) {
				await this._driver.login.call(this);
			}
			// get these once an hour max.
			if ((Date.now() - readings.timestamp) > (60 * 60 * 1000)) {
				readings.info = await this.routerSession.getInfo();
				readings.newFirmware = await this.routerSession.checkNewFirmware();
			}
			// get these every poll
			readings.currentSetting = await this.routerSession.getCurrentSetting();
			readings.attachedDevices = await this.routerSession.getAttachedDevices();
			readings.trafficMeter = await this.routerSession.getTrafficMeter();
			readings.timestamp = new Date();
			return Promise.resolve(readings);
		} catch (error) {
			this.log('last repsonse from router:');
			this.log(this.lastResponse);
			return Promise.reject(error);
		}
	}

	async wol(mac, password) { // call with NetgearDevice as this
		try {
			this.log(`WOL requested for device ${mac} ${this.routerSession.knownDevices[mac].Name}`);
			await this.routerSession.wol(mac, password);
			return Promise.resolve(true);
		}	catch (error) {
			this.error('WOL error', error.message);
			return Promise.resolve(false);
		}
	}

	async blockOrAllow(mac, action) { // call with NetgearDevice as this
		try {
			this.log(`${action} requested for device ${mac}`);
			if (!this.routerSession.loggedIn) {
				await this.routerSession.login();
			}
			await this.routerSession.setBlockDevice(mac, action);
			return Promise.resolve(true);
		}	catch (error) {
			this.error('blockOrAllow error', error.message);
			return Promise.resolve(false);
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
			this.error('2.4GHz-1 set guest wifi error', error.message);
			return Promise.resolve(false);
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
			this.error('2.4GHz-2 set guest wifi error error', error.message);
			return Promise.resolve(false);
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
			this.error('5GHz-1 set guest wifi error errorr', error.message);
			return Promise.resolve(false);
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
			this.error('5GHz-2 set guest wifi error error', error.message);
			return Promise.resolve(false);
		}
	}

	async speedTest() { // call with NetgearDevice as this
		try {
			this.log('router speedtest requested');
			await this.routerSession.login();
			const speed = await this.routerSession.speedTest();
			return Promise.resolve(speed);
		}	catch (error) {
			this.error('speedTest error', error);
			this.log('last repsonse from router:');
			this.log(this.lastResponse);
			return Promise.reject(error);
		}
	}

	async updateNewFirmware() { // call with NetgearDevice as this
		try {
			this.log('router firmware update requested');
			await this.routerSession.login();
			await this.routerSession.updateNewFirmware();
			return Promise.resolve(true);
		}	catch (error) {
			this.error('updateNewFirmware error', error);
			this.log('last repsonse from router:');
			this.log(this.lastResponse);
			return Promise.reject(error);
		}
	}

	async reboot() { // call with NetgearDevice as this
		try {
			this.log('router reboot requested');
			await this.routerSession.login();
			await this.routerSession.reboot();
			return Promise.resolve(true);
		}	catch (error) {
			this.error('reboot error', error);
			return Promise.reject(error);
		}
	}

	onPair(socket) {
		socket.on('save', async (data, callback) => {
			try {
				this.log('save button pressed in frontend');
				const password = data.password;
				const username = data.username;
				let host = data.host;
				let port = Number(data.port);
				const router = new NetgearRouter(password, username, host, port);
				// try to find the soap Port automatically
				const discover = await router.discover();
				if (port === 0) {
					port = discover.port;
				}
				if (host === 'routerlogin.net' || host === '') {
					host = discover.host;
				}
				// try to login
				this.log(`using as soap host/port: ${host}:${port}`);
				await router.login(password, username, host, port);
				const info = await router.getInfo();
				if (Object.prototype.hasOwnProperty.call(info, 'SerialNumber')) {
					info.host = host;
					info.port = port;
					// info.SerialNumber = 'TEST';
					callback(null, JSON.stringify(info)); // report success to frontend
				} else { callback(Error('No Netgear Model found')); }
			}	catch (error) {
				this.error('Pair error', error.message);
				this.log('last repsonse from router:');
				this.log(JSON.stringify(this.lastResponse));
				callback(error);
			}
		});
	}

}

module.exports = NetgearDriver;
