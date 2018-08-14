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
const dns = require('dns');
const util = require('util');

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
			for (let i = 0; i < attachedDevices.length; i += 1) {
				if (!Object.prototype.hasOwnProperty.call(this.knownDevices, attachedDevices[i].MAC)) {	// new device detected!
					this.log(`new device added: ${attachedDevices[i].MAC} ${attachedDevices[i].Name}`);
					persistent = true;
					this.knownDevices[attachedDevices[i].MAC] = attachedDevices[i];
					const tokens = {
						mac: attachedDevices[i].MAC,
						name: attachedDevices[i].Name,
						ip: attachedDevices[i].IP,
					};
					this.newAttachedDevice
						.trigger(this, tokens)
						// .then(this.log(tokens))
						.catch((error) => {
							this.error('trigger error', error);
						});
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
					this.deviceOnline
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
				const device = this.knownDevices[key];
				if ((new Date() - Date.parse(device.lastSeen)) > offlineDelay) {
					if (device.online) {
						this.log(`Offline: ${device.MAC} ${device.Name}`);
						const tokens = {
							mac: device.MAC,
							name: device.Name,
							ip: device.IP,
						};
						this.deviceOffline
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
				this.setUnavailable(error.message)
					.catch(this.error);
			});
		return Promise.resolve(loggedIn);
	}

	async getRouterData() {		// call with NetgearDevice as this
		const readings = {};
		try {
			// get new data from router
			if (!this.routerSession.loggedIn) {
				await this._driver.login.call(this);
			}
			readings.currentSetting = await this.routerSession.getCurrentSetting();
			readings.info = await this.routerSession.getInfo();
			if (this.routerSession.soapVersion >= 3) {
				readings.attachedDevices = await this.routerSession.getAttachedDevices2();
			} else {
				readings.attachedDevices = await this.routerSession.getAttachedDevices();
			}
			readings.trafficMeter = await this.routerSession.getTrafficMeter();
			readings.timestamp = new Date();
			return Promise.resolve(readings);
		} catch (error) {
			return Promise.reject(error);
		}
	}

	async blockOrAllow(mac, action) { // call with NetgearDevice as this
		try {
			this.log(`${action} requested for device ${mac}`);
			if (!this.routerSession.loggedIn) {
				await this.routerSession.login();
			}
			await this.routerSession.setBlockDevice(mac, action);
			Promise.resolve(true);
		}	catch (error) {
			this.error('blockOrAllow error', error.message);
			Promise.resolve(false);
		}
	}

	async setGuestAccessEnabled(action) { // call with NetgearDevice as this
		try {
			this.log(`2.4GHz guest wifi ${action} requested`);
			if (!this.routerSession.loggedIn) {
				await this.routerSession.login();
			}
			const onOff = (action === 'on');
			await this.routerSession.setGuestAccessEnabled(onOff);
			Promise.resolve(true);
		}	catch (error) {
			this.error('setGuestAccessEnabled error', error.message);
			Promise.resolve(false);
		}
	}

	async set5GGuestAccessEnabled(action) { // call with NetgearDevice as this
		try {
			this.log(`5GHz guest wifi ${action} requested`);
			if (!this.routerSession.loggedIn) {
				await this.routerSession.login();
			}
			const onOff = (action === 'on');
			await this.routerSession.set5GGuestAccessEnabled(onOff);
			Promise.resolve(true);
		}	catch (error) {
			this.error('set5GGuestAccessEnabled error', error.message);
			Promise.resolve(false);
		}
	}

	async reboot() { // call with NetgearDevice as this
		try {
			this.log('router reboot requested');
			await this.routerSession.login();
			await this.routerSession.reboot();
			Promise.resolve(true);
		}	catch (error) {
			this.error('reboot error', error);
			Promise.reject(error);
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
				// get setting for debug purposes
				const currentSetting = await router.getCurrentSetting(host);
				this.log(JSON.stringify(currentSetting));
				// try to resolve the router url
				const dnsLookup = util.promisify(dns.lookup);
				const lookUp = await dnsLookup(host);
				host = lookUp || host;
				// try to find the soap Port automatically
				if (port === 0) {
					port = await router.getSoapPort(host);
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
				if (error.code === 'EHOSTUNREACH') {
					callback(Error('Incorrect IP address'));
				}
				callback(error);
			}
		});
	}

}

module.exports = NetgearDriver;
