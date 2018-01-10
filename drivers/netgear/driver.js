'use strict';

const Homey = require('homey');
const NetgearRouter = require('netgear');
// const	Logger = require('../../logger.js');
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
				if (!this.knownDevices.hasOwnProperty(attachedDevices[i].MAC)) {	// new device detected!
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
			list.push(
				{
					name: device.MAC,
					description: device.Name,
				},
			);
		});
		return list;
	}

	login()	{	// call with NetgearDevice as this
		return new Promise((resolve, reject) => {
			this.routerSession.login()
				.then((result) => {
					this.log('login succsesfull @ driver');
					this.setAvailable()
						.catch(this.error);
					return resolve(result);
				})
				.catch((error) => {
					this.error('Login error @ driver', error.message);
					this.setUnavailable(error.message)
						.catch(this.error);
					return reject(error);
				});
		});
	}

	getRouterData() {		// call with NetgearDevice as this
		const readings = {};
		return new Promise(async (resolve, reject) => {
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
				return resolve(readings);
			} catch (error) {
				// this.error('getRouterData error', error);
				return reject(error);
			}
		});
	}

	blockOrAllow(mac, action) { // call with NetgearDevice as this
		return new Promise(async (resolve, reject) => {
			try {
				this.log(`${action} requested for device ${mac}`);
				if (!this.routerSession.loggedIn) {
					await this.routerSession.login();
				}
				await this.routerSession.setBlockDevice(mac, action);
				resolve(true);
			}	catch (error) {
				this.error('blockOrAllow error', error.message);
				resolve(false);
			}
		});
	}

	async reboot() { // call with NetgearDevice as this
		try {
			this.log('router reboot requested');
			// this.logger.log('router reboot requested');
			await this.routerSession.login();
			await this.routerSession.reboot();
		}	catch (error) {
			this.error('reboot error', error);
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
				// this.log(JSON.stringify(info));
				if (info.hasOwnProperty('SerialNumber')) {
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

	// function to add all Netgear attached devices to Homey
	// onPairListDevices(data, callback) {
	// 	const router = new NetgearRouter(data.password, data.host, data.username, data.port);
	// 	router.getAttachedDevices2()
	// 	.then((result) => {
	// 		console.log(result);
	// 		const devicelist = [];
	// 		while (result.length >= 1) {
	// 			const device = result.pop();
	// 			devicelist.push(
	// 				{
	// 					name: `${device.MAC}___${device.Name}`,
	// 					data: {	id: device.MAC },
	// 				}
	// 			);
	// 		}
	// 		console.log(devicelist);
	// 		callback(null, devicelist);
	// 	})
	// 	.catch((error) => {
	// 		console.log(error);
	// 		callback(error, error);
	// 	});
	// }

}

module.exports = NetgearDriver;

// console.log(util.inspect(router));
