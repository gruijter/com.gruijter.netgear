/*
Copyright 2017 - 2022, Robin de Gruijter (gruijter@hotmail.com)

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
const util = require('util');
const dns = require('dns');

const dnsLookupPromise = util.promisify(dns.lookup);

const deviceModes = ['Router', 'Access Point', 'Bridge', '3: Unknown', '4: Unknown'];

class NetgearDevice extends Homey.Device {

	async updateSpeed() {
		try {
			if (!this.settings.use_traffic_info) return Promise.resolve(false);
			const lastTrafficMeter = this.readings.trafficMeter;
			this.readings.trafficMeter = await this.routerSession.getTrafficMeter()
				.catch(() => {
					this.log('error getting traffic meter info');
					return undefined;
				});
			if (!this.readings.trafficMeter) return Promise.resolve(false);
			this.readings.trafficMeter.pollTime = new Date();
			if (!lastTrafficMeter) return Promise.resolve(false); // there are no previous readings for trafficmeter
			// calculate speed
			const downloadSpeed = Math.round((100 * 1000 * 8
				* (this.readings.trafficMeter.newTodayDownload - lastTrafficMeter.newTodayDownload))
				/ (this.readings.trafficMeter.pollTime - lastTrafficMeter.pollTime)) / 100;
			const uploadSpeed = Math.round((100 * 1000 * 8
				* (this.readings.trafficMeter.newTodayUpload - lastTrafficMeter.newTodayUpload))
				/ (this.readings.trafficMeter.pollTime - lastTrafficMeter.pollTime)) / 100;
			// set capabilitie values and trigger flow card
			if (downloadSpeed >= 0 && uploadSpeed >= 0) {	// disregard midnight measurements
				if ((this.getCapabilityValue('download_speed') !== downloadSpeed) || (this.getCapabilityValue('upload_speed') !== uploadSpeed)) {
					this.setCapability('download_speed', downloadSpeed);
					this.setCapability('upload_speed', uploadSpeed);
					const tokens = {
						upload_speed: uploadSpeed,
						download_speed: downloadSpeed,
					};
					this.flows.speedChangedTrigger
						.trigger(this, tokens)
						.catch(this.error);
				}
			}
			return Promise.resolve(true);
		} catch (error) {
			return Promise.reject(error);
		}
	}

	async updateSystemInfo() {
		try {
			if (!this.settings.use_system_info) return Promise.resolve(false);
			this.readings.systemInfo = await this.routerSession.getSystemInfo()
				.catch(() => {
					this.log('error getting system info');
					return undefined;
				});
			if (!this.readings.systemInfo) return Promise.resolve(false);
			// set capabilitie values
			this.setCapability('cpu_utilization', this.readings.systemInfo.NewCPUUtilization);
			this.setCapability('mem_utilization', this.readings.systemInfo.NewMemoryUtilization);
			return Promise.resolve(true);
		} catch (error) {
			return Promise.reject(error);
		}
	}

	async updateFirmwareInfo() {
		try {
			if (!this.settings.use_firmware_check) return Promise.resolve(false);
			this.readings.info = await this.routerSession.getInfo()
				.catch(() => {
					this.log('error getting router info');
					return undefined;
				});
			this.readings.newFirmware = await this.routerSession.checkNewFirmware()
				.catch(() => {
					this.log('error getting new Firmware info');
					return undefined;
				});
			this.extraPollTime = new Date();
			// check for new firmware_version and trigger flow
			const { newFirmware } = this.readings;
			if (this.readings.newFirmware.newVersion && this.readings.newFirmware.newVersion !== '') {
				const tokens = {
					current_version: newFirmware.currentVersion,
					new_version: newFirmware.newVersion,
					release_note: newFirmware.releaseNote,
				};
				this.flows.newRouterFirmwareTrigger
					.trigger(this, tokens)
					.catch(this.error);
			}
			// update settings info
			if (this.readings.info) {
				if (this.readings.info.Firmwareversion !== this.settings.firmware_version) {
					this.log('New router firmware installed: ', this.readings.info.Firmwareversion);
				}
				if (deviceModes[Number(this.readings.info.DeviceMode)] !== this.settings.device_mode) {
					this.log('New device mode selected: ', deviceModes[Number(this.readings.info.DeviceMode)]);
				}
				this.setSettings({
					model_name: this.readings.info.ModelName || this.readings.info.DeviceName || 'Netgear',
					serial_number: this.readings.info.SerialNumber,
					firmware_version: this.readings.info.Firmwareversion,
					device_mode: deviceModes[Number(this.readings.info.DeviceMode)],
				});
			}
			return Promise.resolve(true);
		} catch (error) {
			return Promise.reject(error);
		}
	}

	async updateInternetConnectionState() {
		try {
			let internetConnectionStatus = true;
			if (this.settings.internet_connection_check === 'netgear') {
				this.readings.getEthernetLinkStatus = await this.routerSession.getEthernetLinkStatus()
					.catch(() => {
						this.log('error getting new Internet connection status');
						return undefined;
					});
				if (!this.readings.getEthernetLinkStatus) return Promise.resolve(false);
				internetConnectionStatus = this.readings.getEthernetLinkStatus.toLowerCase() === 'up';
			} else {
				internetConnectionStatus = await dnsLookupPromise('www.google.com')
					.then(() => true)
					.catch(() => false);
			}
			// update capability values and flowcards
			if (internetConnectionStatus !== !this.getCapabilityValue('alarm_generic')) {
				if (internetConnectionStatus) {
					this.log('the internet connection came up');
				} else {
					this.log('the internet connection went down');
				}
			}
			this.setCapability('alarm_generic', !internetConnectionStatus);
			return Promise.resolve(true);
		} catch (error) {
			return Promise.reject(error);
		}
	}

	async updateLogs() {
		try {
			if (!this.hasLogAnalyzer) return Promise.resolve(false);
			const logs = await this.routerSession.getSystemLogs(true)
				.catch(() => {
					this.log('error getting Logs from router');
					return undefined;
				});
			if (logs) {
				// this.logs = logs;
				Homey.emit(`log_${this.getData().id}`, JSON.stringify({ router: this.getData().id, logs }));	// send to log_analyzer driver
			}
			return Promise.resolve(true);
		} catch (error) {
			return Promise.reject(error);
		}
	}

	// function to keep a list of known attached devices, and update the device state
	async updateKnownDeviceList() {
		try {
			const method = Number(this.settings.attached_devices_method);
			const attDevs = await this.routerSession.getAttachedDevices(method);
			if (attDevs.length === 0) throw Error('Attached devicelist came back empty');
			this.readings.pollTime = new Date();
			this.readings.attachedDevices = attDevs;

			// console.log(this.readings);
			const { readings } = this;
			const { knownDevices } = this;
			const { attachedDevices } = readings;
			const now = readings.pollTime.toISOString();
			// get the list of attached devices that are individually paired
			const pairedDeviceDriver = Homey.ManagerDrivers.getDriver('attached_device');
			await pairedDeviceDriver.ready(() => null);
			const attachedList = {};
			pairedDeviceDriver.getDevices().forEach((device) => {
				const settings = device.getSettings();
				attachedList[settings.mac] = { offlineDelay: settings.offline_after * 1000 };
			});

			// detect online and new attached devices
			attachedDevices.forEach((attachedDevice) => {
				// filter corrupt stuff
				if (!knownDevices[attachedDevice.MAC] || (knownDevices[attachedDevice.MAC].MAC.length !== 17)) {	// knownDevice is corrupt
					this.log('deleting corrupt device', knownDevices[attachedDevice.MAC]);
					delete knownDevices[attachedDevice.MAC];
				}
				// detect new device
				if (!Object.prototype.hasOwnProperty.call(knownDevices, attachedDevice.MAC)) {
					this.log(`new device added: ${attachedDevice.MAC} ${attachedDevice.Name}`);
					const tokens = {
						mac: attachedDevice.MAC,
						name: attachedDevice.Name,
						ip: attachedDevice.IP,
					};
					this.flows.newAttachedDeviceTrigger
						.trigger(this, tokens)
						// .then(this.log(tokens))
						.catch((error) => {
							this.error('trigger error', error);
						});
				}
				// detect device coming online, add online and lastSeen
				const lastOnline = (knownDevices[attachedDevice.MAC] !== undefined) ? knownDevices[attachedDevice.MAC].online : false;
				knownDevices[attachedDevice.MAC] = attachedDevice;
				knownDevices[attachedDevice.MAC].online = true;
				knownDevices[attachedDevice.MAC].lastSeen = now;
				if (!lastOnline) {
					if (!attachedList[attachedDevice.MAC]) {
						this.log(`Online: ${attachedDevice.MAC} ${attachedDevice.Name} ${attachedDevice.IP}`);
					}
					const tokens = {
						mac: attachedDevice.MAC,
						name: attachedDevice.Name,
						ip: attachedDevice.IP,
					};
					this.flows.deviceOnlineTrigger
						.trigger(this, tokens)
						// .then(this.log(tokens))
						.catch((error) => {
							this.error('trigger error', error);
						});
				}
			});

			// calculate number online, detect devices going offline, add pollTime
			const offlineDelay = this.getSettings().offline_after * 1000;	// default 5 minutes
			let onlineCount = 0;
			Object.keys(knownDevices).forEach((key) => {
				const device = knownDevices[key];
				// filter corrupt stuff
				if (!device || !device.MAC || (key.length !== 17)) {
					this.log(`deleting corrupt device@detachCheck: ${key}`);
					delete knownDevices[key];
					return;
				}
				// add polltime
				device.pollTime = now;
				// check if gone offline
				// take offlineDelay from paired attached_devices
				const delay = attachedList[device.MAC] ? attachedList[device.MAC].offlineDelay : offlineDelay;
				if ((Date.parse(now) - Date.parse(device.lastSeen)) > delay) {
					if (device.online) {
						if (!attachedList[device.MAC]) {
							this.log(`Offline: ${device.MAC} ${device.Name}`);
						}
						const tokens = {
							mac: device.MAC,
							name: device.Name,
							ip: device.IP,
						};
						this.flows.deviceOfflineTrigger
							.trigger(this, tokens)
							// .then(this.log(tokens))
							.catch((error) => {
								this.error('trigger error', error);
							});
					}
					device.online = false;
				}
				// update knownDevices
				knownDevices[device.MAC] = device;
				// calculate online devices count
				if (device.online) {
					onlineCount += 1;
				}
			});
			// store online devices count and set capability
			this.knownDevices = knownDevices;
			this.onlineDeviceCount = onlineCount;
			this.setCapability('attached_devices', onlineCount);
			// send to attached_device driver
			Homey.emit('listUpdate', JSON.stringify({ routerID: this.getData().id, knownDevices }));	// send to attached_device driver
			// save devicelist to persistent storage
			const knownDevicesString = JSON.stringify(knownDevices).replace('&lt', '').replace('&gt', '').replace(';', '');
			await this.setStoreValue('knownDevicesString', knownDevicesString);
			return Promise.resolve(true);
		}	catch (error) {
			// this.error('error:', error);
			return Promise.reject(error);
		}
	}

	async updateRouterDeviceState() {
		try {
			this.busy = true;
			await this._driver.login.call(this);
			await this.updateKnownDeviceList();	// attached devices state
			await this.updateInternetConnectionState();	// disconnect alarm
			await this.updateSpeed();	// up/down internet bandwidth
			await this.updateSystemInfo();	// mem/cpu load
			await this.updateLogs();	// system logs EXPERIMENTAL
			// update exta info once an hour
			if ((Date.now() - this.readings.extraPollTime) > (60 * 60 * 1000)) {
				await this.updateFirmwareInfo();	// firmware and router mode
			}
			this.busy = false;
			return Promise.resolve(this.busy);
		} catch (error) {
			this.busy = false;
			return Promise.reject(error);
		}
	}

	// this method is called when the Device is inited
	async onInit() {
		try {
			this.log(`device init: ${this.getName()} id: ${this.getData().id}`);

			// init some values
			this._driver = this.getDriver();
			await this._driver.ready(() => null);
			this.readings = {
				getEthernetLinkStatus: 'Up',
				info: {},
				newFirmware: {},
				trafficMeter: undefined,
				attachedDevices: [],
				pollTime: 0,
				extraPollTime: 0,
			};
			this.busy = false;
			this.watchDogCounter = 4;
			this.hasLogAnalyzer = false;
			this.logs = [];

			// create router session
			this.settings = this.getSettings();
			const options = {
				password: this.settings.password,
				username: this.settings.username,
				host: this.settings.host,
				port: this.settings.port,
				tls: this.settings.port === 443 || this.settings.port === 5555,
			};
			this.routerSession = new NetgearRouter(options);

			// get known device from store
			this.log('retrieving knownDevices from persistent storage');
			const knownDevicesString = await this.getStoreValue('knownDevicesString');
			this.knownDevices = knownDevicesString ? JSON.parse(knownDevicesString) : {};
			// sanitize knownDevices
			Object.keys(this.knownDevices).forEach((key) => {
				if (key.length !== 17) {	// this is not a mac address
					this.log(`Deleting corrupt known device: ${key}`);
					delete this.knownDevices[key];
				}
			});

			// activate traffic meter and access control
			if (this.settings.use_traffic_info) {
				await this._driver.enableTrafficMeter.call(this, true)
					.catch(() => this.log('Traffic meter could not be enabled'));
			}
			await this._driver.setBlockDeviceEnable.call(this, true)
				.catch(() => this.log('Device Access Control could not be enabled'));
			// store known devices when app unloads
			Homey.on('unload', async () => {
				this.log('unload called, storing knownDevices state');
				const devicesString = JSON.stringify(this.knownDevices).replace('&lt', '').replace('&gt', '').replace(';', '');
				await this.setStoreValue('knownDevicesString', devicesString);
			});

			// register all flow cards
			await this.registerFlowCards();

			// start polling router for info
			await this.startPolling();
			await this.updateRouterDeviceState();

			this.log(`device ready: ${this.getName()} id: ${this.getData().id}`);

		} catch (error) {
			this.error(error);
		}

	}

	// this method is called when the Device is added
	onAdded() {
		const settings = this.getSettings();
		this.log(`router ${settings.model_name} added as device @ ${settings.host}:${settings.port}`);
	}

	// this method is called when the Device is deleted
	onDeleted() {
		// stop polling
		clearInterval(this.interval.devicePoll);
		this.log('router deleted as device');
	}

	// this method is called when the user has changed the device's settings in Homey.
	async onSettings(oldSettingsObj, newSettingsObj) {
		// first stop polling the device, then start init after short delay
		clearInterval(this.interval.devicePoll);
		this.log('router device settings changed');
		// this.log(newSettingsObj);
		this.setAvailable()
			.catch(this.error);
		setTimeout(() => {
			this.onInit();
		}, 10000);
		if (newSettingsObj.clear_known_devices) {
			this.knownDevices = {};
			await this.setStoreValue('knownDevicesString', JSON.stringify(this.knownDevices));
			this.log('known devices were deleted on request of user');
			return Promise.reject(Error('Deleting known devices list'));
			// return callback('Deleting known devices list', null);
		}
		if (newSettingsObj.use_traffic_info) {
			await this.addCapability('download_speed');
			await this.addCapability('upload_speed');
		} else {
			await this.removeCapability('download_speed');
			await this.removeCapability('upload_speed');
		}
		if (newSettingsObj.use_system_info) {
			await this.addCapability('cpu_utilization');
			await this.addCapability('mem_utilization');
		} else {
			await this.removeCapability('cpu_utilization');
			await this.removeCapability('mem_utilization');
		}
		// do callback to confirm settings change
		return Promise.resolve(true);
		// return callback(null, true);
	}

	setCapability(capability, value) {
		if (this.hasCapability(capability)) {
			this.setCapabilityValue(capability, value)
				.catch((error) => {
					this.log(error, capability, value);
				});
		}
	}

	// register flow cards
	async registerFlowCards() {
		try {
			// unregister cards first
			if (!this.flows) this.flows = {};
			const ready = Object.keys(this.flows).map((flow) => Promise.resolve(Homey.ManagerFlow.unregisterCard(this.flows[flow])));
			await Promise.all(ready);

			// register trigger flow cards
			this.flows.speedChangedTrigger = new Homey.FlowCardTriggerDevice('uldl_speed_changed')
				.register();
			this.flows.newAttachedDeviceTrigger = new Homey.FlowCardTriggerDevice('new_attached_device')
				.register();
			this.flows.deviceOnlineTrigger = new Homey.FlowCardTriggerDevice('device_online')
				.register();
			this.flows.deviceOfflineTrigger = new Homey.FlowCardTriggerDevice('device_offline')
				.register();
			this.flows.speedTestResultTrigger = new Homey.FlowCardTriggerDevice('speed_test_result')
				.register();
			this.flows.newRouterFirmwareTrigger = new Homey.FlowCardTriggerDevice('new_router_firmware')
				.register();

			const autoComplete = (query) => {
				try {
					let results = this._driver.makeAutocompleteList.call(this);
					results = results.filter((result) => {		// filter for query on MAC and Name
						const macFound = result.name.toLowerCase().indexOf(query.toLowerCase()) > -1;
						const nameFound = result.description.toLowerCase().indexOf(query.toLowerCase()) > -1;
						return macFound || nameFound;
					});
					return Promise.resolve(results);
				} catch (error) {
					return Promise.reject(error);
				}
			};

			// register condition flow flowcards
			this.flows.internetConnectedCondition = new Homey.FlowCardCondition('alarm_generic');
			this.flows.internetConnectedCondition
				.register()
				.registerRunListener((args) => {
					if (Object.prototype.hasOwnProperty.call(args, 'device')) {
						return Promise.resolve(!args.device.getCapabilityValue('alarm_generic'));
					}
					return Promise.reject(Error('The netgear device is unknown or not ready'));
				});

			this.flows.deviceOnlineCondition = new Homey.FlowCardCondition('device_online_condition');
			this.flows.deviceOnlineCondition
				.register()
				.registerRunListener((args) => {
					if (Object.prototype.hasOwnProperty.call(args, 'device')) {
						let deviceOnline = false;
						if (Object.prototype.hasOwnProperty.call(args.device.knownDevices, args.mac.name)) {
							deviceOnline = args.device.knownDevices[args.mac.name].online;	// true or false
						}
						return Promise.resolve(deviceOnline);
					}
					return Promise.reject(Error('The netgear device is unknown or not ready'));
				})
				.getArgument('mac')
				.registerAutocompleteListener(autoComplete);

			this.flows.deviceOnlineIpRangeCondition = new Homey.FlowCardCondition('device_online_ip_range');
			this.flows.deviceOnlineIpRangeCondition
				.register()
				.registerRunListener((args) => {
					if (Object.prototype.hasOwnProperty.call(args, 'device')) {
						const OnlineInIpRange = (total, knownDevice) => {
							if (!knownDevice.online) { return total; }
							if (!knownDevice.IP) { return total; }
							const hostOctet = Number(knownDevice.IP.split('.').pop());
							if (hostOctet >= args.ip_from && hostOctet <= args.ip_to) {
								return total + 1;
							}
							return total;
						};
						const devicesOnlineInIpRange = Object.values(args.device.knownDevices).reduce(OnlineInIpRange, 0);
						return Promise.resolve(devicesOnlineInIpRange > 0);
					}
					return Promise.reject(Error('The netgear device is unknown or not ready'));
				});

			this.flows.newFirmwareCondition = new Homey.FlowCardCondition('new_firmware_condition');
			this.flows.newFirmwareCondition
				.register()
				.registerRunListener((args) => {
					if (Object.prototype.hasOwnProperty.call(args, 'device')) {
						if (args.device.readings.newFirmware.newVersion && args.device.readings.newFirmware.newVersion !== '') {
							return Promise.resolve(true);
						}
						return Promise.resolve(false);
					}
					return Promise.reject(Error('The netgear device is unknown or not ready'));
				});

			// register action flow cards
			this.flows.blockDevice = new Homey.FlowCardAction('block_device');
			this.flows.blockDevice
				.register()
				.on('run', async (args, state, callback) => {
					await this._driver.blockOrAllow.call(this, args.mac.name, 'Block')
						.catch(this.error);
					callback(null, true);
				})
				.getArgument('mac')
				.registerAutocompleteListener(autoComplete);

			this.flows.blockDeviceText = new Homey.FlowCardAction('block_device_text');
			this.flows.blockDeviceText
				.register()
				.on('run', async (args, state, callback) => {
					await this._driver.blockOrAllow.call(this, args.mac.replace(' ', ''), 'Block')
						.catch(this.error);
					callback(null, true);
				});

			this.flows.allowDevice = new Homey.FlowCardAction('allow_device');
			this.flows.allowDevice
				.register()
				.on('run', async (args, state, callback) => {
					await this._driver.blockOrAllow.call(this, args.mac.name, 'Allow')
						.catch(this.error);
					callback(null, true);
				})
				.getArgument('mac')
				.registerAutocompleteListener(autoComplete);

			this.flows.allowDeviceText = new Homey.FlowCardAction('allow_device_text');
			this.flows.allowDeviceText
				.register()
				.on('run', async (args, state, callback) => {
					await this._driver.blockOrAllow.call(this, args.mac.replace(' ', ''), 'Allow')
						.catch(this.error);
					callback(null, true);
				});

			this.flows.wol = new Homey.FlowCardAction('wol');
			this.flows.wol
				.register()
				.on('run', async (args, state, callback) => {
					await this._driver.wol.call(this, args.mac.name, args.password)
						.catch(this.error);
					callback(null, true);
				})
				.getArgument('mac')
				.registerAutocompleteListener(autoComplete);

			this.flows.setGuestWifi = new Homey.FlowCardAction('set_guest_wifi');
			this.flows.setGuestWifi
				.register()
				.on('run', async (args, state, callback) => {
					if (args.network === '5') {
						await this._driver.set5GGuestWifi.call(this, args.on_off)
							.catch(this.error);
					} else if (args.network === '5-2') {
						await this._driver.set5GGuestWifi2.call(this, args.on_off)
							.catch(this.error);
					} else if (args.network === '2.4') {
						await this._driver.setGuestwifi.call(this, args.on_off)
							.catch(this.error);
					} else {
						await this._driver.setGuestwifi2.call(this, args.on_off)
							.catch(this.error);
					}
					callback(null, true);
				});

			this.flows.speedTestStart = new Homey.FlowCardAction('speed_test_start');
			this.flows.speedTestStart
				.register()
				.on('run', async (args, state, callback) => {
					const speed = await this._driver.speedTest.call(this)
						.catch(this.error);
					callback(null, true);
					const tokens = {
						uplink_bandwidth: speed.uplinkBandwidth,
						downlink_bandwidth: speed.downlinkBandwidth,
						average_ping: speed.averagePing,
					};
					this.flows.speedTestResultTrigger
						.trigger(this, tokens)
						.then(this.log(tokens))
						.catch((error) => {
							this.error('trigger error', error);
						});
				});

			this.flows.updateFirmware = new Homey.FlowCardAction('update_firmware');
			this.flows.updateFirmware
				.register()
				.on('run', (args, state, callback) => {
					this._driver.updateNewFirmware.call(this)
						.catch(this.error);
					callback(null, true);
				});

			this.flows.reboot = new Homey.FlowCardAction('reboot');
			this.flows.reboot
				.register()
				.on('run', (args, state, callback) => {
					this._driver.reboot.call(this)
						.catch(this.error);
					callback(null, true);
				});

			return Promise.resolve(this.flows);
		} catch (error) {
			return Promise.resolve(error);
		}

	}

	// register polling stuff
	async startPolling() {
		try {
			// clear intervals first
			if (!this.interval) this.interval = {};
			const ready = Object.keys(this.interval).map((interval) => Promise.resolve(clearInterval(this.interval[interval])));
			await Promise.all(ready);

			// start polling router
			this.interval.devicePoll = setInterval(async () => {
				try {
					if (this.watchDogCounter <= 0) {
						// restart the app here
						this.log('watchdog triggered, restarting Homey device now');
						clearInterval(this.interval.devicePoll);
						setTimeout(() => {
							this.onInit();
						}, 60000);
						return;
					}
					if (this.busy) {
						this.log('Still busy. Skipping a poll');
						return;
					}
					// get new routerdata and update the state
					await this.updateRouterDeviceState();
					this.watchDogCounter = 4;
				} catch (error) {
					this.watchDogCounter -= 1;
					this.error('DevicePoll', error.message || error);
				}
			}, 1000 * this.settings.polling_interval);

		} catch (error) {
			this.error(error);
		}

	}

}

module.exports = NetgearDevice;
