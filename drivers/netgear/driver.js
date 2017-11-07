'use strict';

const Homey = require('homey');
const NetgearRouter = require('../../netgear.js');
const	Logger = require('../../logger.js');
const dns = require('dns');
// const util = require('util');


class NetgearDriver extends Homey.Driver {

	onInit() {
		this.log('NetgearDriver onInit');
		// console.log(util.inspect(this.getDevices()));
		this.logger = new Logger('netgearLog', 200);	// create logger instance
	}

	// function to keep a list of known attached devices
	async updateDeviceList() {		// call with NetgearDevice as this
		try {
			let persistent = false;
			const attachedDevices = this.readings.attachedDevices;
			this.knownDevices = this.knownDevices || {};
			for (let i = 0; i < attachedDevices.length; i++) {
				if (!this.knownDevices.hasOwnProperty(attachedDevices[i].MAC)) {	// new device detected!
					this.log(`new device added: ${attachedDevices[i].MAC} ${attachedDevices[i].Name}`);
					this.logger.log(`new device added: ${attachedDevices[i].MAC} ${attachedDevices[i].Name}`);
					persistent = true;
					this.knownDevices[attachedDevices[i].MAC] = attachedDevices[i];
					let tokens = {
							'mac': attachedDevices[i].MAC,
							'name': attachedDevices[i].Name,
							'ip': attachedDevices[i].IP
					};
					this.newAttachedDevice
							.trigger(this, tokens)
							.then( this.log(tokens) )
							.catch((error) => {
								this.error('trigger error', error);
								this.logger.log('trigger error', error)
							});
				}
				const lastOnline = this.knownDevices[attachedDevices[i].MAC].online || 0;
				this.knownDevices[attachedDevices[i].MAC] = attachedDevices[i];
				this.knownDevices[attachedDevices[i].MAC].online = lastOnline;
				let lastSeen = new Date();
				this.knownDevices[attachedDevices[i].MAC].lastSeen = lastSeen.toISOString(); // to turn it back into a date: Date.parse(test.lastSeen)
				if (!this.knownDevices[attachedDevices[i].MAC].online) {
					this.log(`Device came online: ${attachedDevices[i].MAC} ${attachedDevices[i].Name} ${attachedDevices[i].IP}`);
					this.logger.log(`Device came online: ${attachedDevices[i].MAC} ${attachedDevices[i].Name} ${attachedDevices[i].IP}`);
					let tokens = {
							'mac': attachedDevices[i].MAC,
							'name': attachedDevices[i].Name,
							'ip': attachedDevices[i].IP
					};
					this.deviceOnline
							.trigger(this, tokens)
							.then( this.log(tokens) )
							.catch((error) => {
								this.error('trigger error', error);
								this.logger.log('trigger error', error)
							});
				}
				this.knownDevices[attachedDevices[i].MAC].online = true;
			}

			// Loop through all known devices to see if they got detached
			const offlineDelay = this.getSettings().offline_after*1000;	// default 5 minutes
			let onlineCount = 0;
			for (let key in this.knownDevices) {
		    if( this.knownDevices.hasOwnProperty(key) ) {
		      const device = this.knownDevices[key];
					if ( (new Date() - Date.parse(device.lastSeen)) > offlineDelay ) {	// if not seen for more than offlineDelay
						// console.log(`device ${device.MAC} went missing for too long ....`);
						if (device.online) {
							this.log(`Device went offline: ${device.MAC} ${device.Name} ${device.IP}`);
							this.logger.log(`Device went offline: ${device.MAC} ${device.Name}`);
							let tokens = {
									'mac': device.MAC,
									'name': device.Name,
									'ip': device.IP
							};
							this.deviceOffline
									.trigger(this, tokens)
									.then( this.log(tokens) )
									.catch((error) => {
										this.error('trigger error', error);
										this.logger.log('trigger error', error)
									});
						}
						this.knownDevices[key].online = false;
					}
					// calculate online devices count
					if (this.knownDevices[key].online) {
						onlineCount++;
					};
		    }
		  }
			// store online devices count
			this.onlineDeviceCount = onlineCount;

			// save devicelist to persistent storage
			if (persistent) {
				this.setStoreValue('knownDevices', this.knownDevices);
			}

		}
		catch (error) {
			this.error('error:', error);
			this.logger.log('error:', error);
		}
	}

	login()	{	// call with NetgearDevice as this
		return new Promise ((resolve, reject) => {
			this.routerSession.login()
				.then((result) => {
					this.log('login succsesfull @ driver');
					this.logger.log('login succsesfull @ driver');
					this.setAvailable()
						.catch(this.error);
					resolve(result);
				})
				.catch((error) => {
					this.error('Login error @ driver', error.message);
					this.logger.log('Login error @ driver', error.message);
					this.setUnavailable(error.message)
						.catch(this.error);
					reject(error);
				});
		});
	}

	getRouterData() {		// call with NetgearDevice as this
		let readings = {};
		return new Promise ( async (resolve, reject) => {
			try {
				// get new data from router
				if (!this.routerSession.logged_in) {
					await this._driver.login.call(this);
				}
				readings.currentSetting = await this.routerSession.getCurrentSetting();
				readings.info = await this.routerSession.getInfo();
				readings.attachedDevices = await this.routerSession.getAttachedDevices();
				readings.trafficMeter = await this.routerSession.getTrafficMeter();
				readings.timestamp = new Date ();
				// console.log(util.inspect(readings));
				resolve(readings);
			} catch (error) {
					this.error('getRouterData error', error);
					this.logger.log('getRouterData error', error);
					// this.setUnavailable(error.message)
					// 	.catch(this.error);
					reject(error);
				}
		});
	}

	async blockOrAllow(mac, action) {   // call with NetgearDevice as this
		try {
			if (!this.routerSession.logged_in) {
				await this.routerSession.login();
			}
			await this.routerSession.configurationStarted();
			await this.routerSession.setBlockDevice(mac, action);
			await this.routerSession.configurationFinished();
		}
		catch (error) {
			this.error('blockOrAllow error', error);
			this.logger.log('blockOrAllow error', error);
		}
	}

	async reboot() {   // call with NetgearDevice as this
		try {
			await this.routerSession.login();
			await this.routerSession.configurationStarted();
			await this.routerSession.reboot();
			await this.routerSession.configurationFinished();
		}
		catch (error) {
			this.error('reboot error', error);
			this.logger.log('reboot error', error);
		}
	}

	onPair(socket) {
		socket.on('save', (data, callback) => {
			const router = new NetgearRouter(data.password, data.username, data.host, Number(data.port));
			this.log('save button pressed in frontend', router);
			this.logger.log('save button pressed in frontend');

			// get setting for debug purposes
			router.getCurrentSetting('routerlogin.net')
				.then( (result) => {
					this.logger.log(JSON.stringify(result));
				})
				.catch((error) => {
					this.logger.log('getCurentSetting error ', error);
				});

			// try to resolve url and login
			dns.lookup(data.host, (err, address, family) => {
				if (!err) {
					data.host = address || data.host;
				}
			  this.log(`using as router address: ${data.host}`);
				this.logger.log(`using as router address: ${data.host}`);
				// try to login
				router.login()
					.then( () => {
						router.getInfo()
							.then((result) => {
								this.logger.log(JSON.stringify(result));
								if (result.hasOwnProperty('SerialNumber')) {
									result.host = data.host;
									callback(null, JSON.stringify(result));
								} else { callback(Error('No Netgear Model found')); }
							})
							.catch((error) => {
								this.error('getInfo error ', error);
								this.logger.log('getInfo error ', error);
								callback(error);
							});
					})
					.catch((error) => {
						this.log('login error', error);
						this.logger.log('login  error ', error);
						callback(error);
					});
			});

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
