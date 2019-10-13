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
const util = require('util');
const dns = require('dns');

const dnsLookupPromise = util.promisify(dns.lookup);

const deviceModes = ['Router', 'Access Point', 'Bridge', '3: Unknown', '4: Unknown'];

const hasLogAnalyzer = async () => {
	try {
		const logAnalyzerDriver = Homey.ManagerDrivers.getDriver('log_analyzer');
		await logAnalyzerDriver.ready(() => null);
		const analyzer = await logAnalyzerDriver.getDevices();
		if (!analyzer || !analyzer[0]) {
			return Promise.resolve(false);
		}
		return Promise.resolve(true);
	} catch (error) {
		return Promise.reject(error);
	}
};

class NetgearDevice extends Homey.Device {

	async updateRouterDeviceState() {
		try {
			this.busy = true;
			// store parameters from last readings
			const settings = this.getSettings();
			const lastTrafficMeter = this.readings.trafficMeter;
			const lastPollTime = this.readings.pollTime;
			const lastExtraPollTime = this.readings.extraPollTime;

			// get new readings from router and update the knownDevices list
			const newReadings = await this._driver.getRouterData.call(this);
			// get exta readings once an hour
			if ((Date.now() - lastExtraPollTime) > (60 * 60 * 1000)) {
				const newExtraReadings = await this._driver.getExtraRouterData.call(this);
				Object.assign(newReadings, newExtraReadings);
			}
			this.readings = newReadings;
			// update attached devices state and update the knownDeviceList
			await this.updateKnownDeviceList();
			// calculate speed
			let downloadSpeed = 0;
			let uploadSpeed = 0;
			if (this.readings.trafficMeter && lastTrafficMeter && lastPollTime) { // new readings and previous readings contain traffic
				downloadSpeed = Math.round((100 * 1000 * 8
					* (this.readings.trafficMeter.newTodayDownload - lastTrafficMeter.newTodayDownload))
					/ (this.readings.pollTime - lastTrafficMeter.pollTime)) / 100;
				uploadSpeed = Math.round((100 * 1000 * 8
					* (this.readings.trafficMeter.newTodayUpload - lastTrafficMeter.newTodayUpload))
					/ (this.readings.pollTime - lastTrafficMeter.pollTime)) / 100;
			}
			// update capability values and flowcards
			let internetConnectionStatus = true;
			if (settings.internet_connection_check === 'homey') {
				internetConnectionStatus = await dnsLookupPromise('www.google.com')
					.then(() => true)
					.catch(() => false);
			} else {
				const connectStatus = this.readings.getEthernetLinkStatus || '';
				internetConnectionStatus = connectStatus.toLowerCase() === 'up';
			}
			if (internetConnectionStatus !== !this.getCapabilityValue('alarm_generic')) {
				if (internetConnectionStatus) {
					this.log('the internet connection came up');
				} else {
					this.log('the internet connection went down');
				}
			}
			this.setCapability('alarm_generic', !internetConnectionStatus);
			this.setCapability('cpu_utilization', this.readings.systemInfo.NewCPUUtilization);
			this.setCapability('mem_utilization', this.readings.systemInfo.NewMemoryUtilization);

			if (downloadSpeed >= 0 && uploadSpeed >= 0) {	// disregard midnight measurements
				if ((this.getCapabilityValue('download_speed') !== downloadSpeed) || (this.getCapabilityValue('upload_speed') !== uploadSpeed)) {
					this.setCapability('download_speed', downloadSpeed);
					this.setCapability('upload_speed', uploadSpeed);
					const tokens = {
						upload_speed: uploadSpeed,
						download_speed: downloadSpeed,
					};
					this.speedChangedTrigger
						.trigger(this, tokens)
						.catch(this.error);
				}
			}
			// check for new firmware_version
			const { newFirmware } = this.readings;
			if (this.readings.newFirmware.newVersion && this.readings.newFirmware.newVersion !== '') {
				const tokens = {
					current_version: newFirmware.currentVersion,
					new_version: newFirmware.newVersion,
					release_note: newFirmware.releaseNote,
				};
				this.newRouterFirmwareTrigger
					.trigger(this, tokens)
					.catch(this.error);
			}
			// update settings info
			if (this.readings.info) {
				if (this.readings.info.Firmwareversion !== settings.firmware_version) {
					this.log('New router firmware installed: ', this.readings.info.Firmwareversion);
				}
				if (deviceModes[Number(this.readings.info.DeviceMode)] !== settings.device_mode) {
					this.log('New device mode selected: ', deviceModes[Number(this.readings.info.DeviceMode)]);
				}
				this.setSettings({
					model_name: this.readings.info.ModelName || this.readings.info.DeviceName || 'Netgear',
					serial_number: this.readings.info.SerialNumber,
					firmware_version: this.readings.info.Firmwareversion,
					device_mode: deviceModes[Number(this.readings.info.DeviceMode)],
				});
			}

			/*
			// get router logs EXPERIMENTAL
			// console.log(this.hasLogAnalyzer);
			const logs = await this._driver.getSystemLogs.call(this);
			if (logs) {
				// this.logs = logs;
				Homey.emit('logUpdate', JSON.stringify(logs));	// send to log_analyzer driver
			}
			*/

			this.busy = false;
		} catch (error) {
			this.busy = false;
			this.error('updateRouterDeviceState error: ', error.message || error);
		}
	}

	// function to keep a list of known attached devices, and update the device state
	async updateKnownDeviceList() {
		try {
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
				if (knownDevices[attachedDevice.MAC] === null) {	// knownDevice is null
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
					this.newAttachedDeviceTrigger
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
					this.deviceOnlineTrigger
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
						this.deviceOfflineTrigger
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
			const knownDevicesString = JSON.stringify(knownDevices).replace('&lt', '').replace('&gt', '').replace(';', '');
			Homey.emit('listUpdate', knownDevicesString);	// send to attached_device driver
			// save devicelist to persistent storage
			await this.setStoreValue('knownDevicesString', knownDevicesString);
			return Promise.resolve(knownDevices);
		}	catch (error) {
			// this.error('error:', error);
			return Promise.reject(error);
		}
	}

	// this method is called when the Device is inited
	async onInit() {
		try {
			this.log('device init: ', this.getName(), 'id:', this.getData().id);
			// migrate from Homey fw < 3
			// console.log(`${this.getName()} ${this.getClass()} ${this.getCapabilities()}`);
			if ((this.getClass() !== 'sensor') || this.hasCapability('internet_connection_status') || !this.hasCapability('alarm_generic')
				|| !this.hasCapability('cpu_utilization') || !this.hasCapability('mem_utilization')) {
				this.log('Migrating device to Homey V3.');
				await this.removeCapability('internet_connection_status');
				await this.removeCapability('download_speed');
				await this.removeCapability('upload_speed');
				await this.removeCapability('attached_devices');
				// add migrated capabilities
				await this.setClass('sensor');
				await this.addCapability('alarm_generic');
				await this.addCapability('attached_devices');
				await this.addCapability('download_speed');
				await this.addCapability('upload_speed');
				await this.addCapability('cpu_utilization');
				await this.addCapability('mem_utilization');
				this.log('Migration to V3 ready. CHECK YOUR FLOWS! (sorry)');
				const options = { excerpt: 'THE NETGEAR ROUTER APP WAS MIGRATED TO HOMEY V3. CHECK YOUR FLOWS! (sorry)' };
				const notification = new Homey.Notification(options);
				notification.register()
					.catch(this.log);
			}

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
			this.hasLogAnalyzer = await hasLogAnalyzer();
			this.logs = [];
			// create router session
			const settings = this.getSettings();
			const options = {
				password: settings.password,
				username: settings.username,
				host: settings.host,
				port: settings.port,
				tls: settings.port === 443,
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
			await this._driver.enableTrafficMeter.call(this, true)
				.catch(() => this.log('Traffic meter could not be enabled'));
			await this._driver.setBlockDeviceEnable.call(this, true)
				.catch(() => this.log('Device Access Control could not be enabled'));
			// store known devices when app unloads
			Homey.on('unload', async () => {
				this.log('unload called, storing knownDevices state');
				const devicesString = JSON.stringify(this.knownDevices).replace('&lt', '').replace('&gt', '').replace(';', '');
				await this.setStoreValue('knownDevicesString', devicesString);
			});
			// register all flow cards
			this.registerFlowCards();
			// start polling router for info
			await this.updateRouterDeviceState();
			this.intervalIdDevicePoll = setInterval(async () => {
				try {
					if (this.busy) {
						this.log('Still busy. Skipping a poll');
						return;
					}
					// get new routerdata and update the state
					await this.updateRouterDeviceState();
				} catch (error) { this.log('intervalIdDevicePoll error', error); }
			}, 1000 * settings.polling_interval);

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
		clearInterval(this.intervalIdDevicePoll);
		this.log('router deleted as device');
	}

	// this method is called when the user has changed the device's settings in Homey.
	async onSettings(oldSettingsObj, newSettingsObj) {
		// first stop polling the device, then start init after short delay
		clearInterval(this.intervalIdDevicePoll);
		this.log('router device settings changed');
		this.setAvailable()
			.catch(this.error);
		setTimeout(() => {
			this.onInit();
		}, 10000);
		if (newSettingsObj.clear_known_devices) {
			this.knownDevices = {};
			await this.setStoreValue('knownDevicesString', JSON.stringify(this.knownDevices));
			this.log('known devices were deleted on request of user');
			return Promise.resolve('Deleting known devices list');
			// return callback('Deleting known devices list', null);
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

	registerFlowCards() {
		// register trigger flow cards
		this.speedChangedTrigger = new Homey.FlowCardTriggerDevice('uldl_speed_changed')
			.register();
		this.newAttachedDeviceTrigger = new Homey.FlowCardTriggerDevice('new_attached_device')
			.register();
		this.deviceOnlineTrigger = new Homey.FlowCardTriggerDevice('device_online')
			.register();
		this.deviceOfflineTrigger = new Homey.FlowCardTriggerDevice('device_offline')
			.register();
		this.speedTestResultTrigger = new Homey.FlowCardTriggerDevice('speed_test_result')
			.register();
		this.newRouterFirmwareTrigger = new Homey.FlowCardTriggerDevice('new_router_firmware')
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
		const deviceOnlineCondition = new Homey.FlowCardCondition('device_online');
		deviceOnlineCondition.register()
			.registerRunListener((args) => {
				if (Object.prototype.hasOwnProperty.call(args, 'NetgearDevice')) {
					let deviceOnline = false;
					if (Object.prototype.hasOwnProperty.call(args.NetgearDevice.knownDevices, args.mac.name)) {
						deviceOnline = args.NetgearDevice.knownDevices[args.mac.name].online;	// true or false
					}
					return Promise.resolve(deviceOnline);
				}
				return Promise.reject(Error('The netgear device is unknown or not ready'));
			})
			.getArgument('mac')
			.registerAutocompleteListener(autoComplete);

		const deviceOnlineIpRangeCondition = new Homey.FlowCardCondition('device_online_ip_range');
		deviceOnlineIpRangeCondition.register()
			.registerRunListener((args) => {
				if (Object.prototype.hasOwnProperty.call(args, 'NetgearDevice')) {
					const OnlineInIpRange = (total, knownDevice) => {
						if (!knownDevice.online) { return total; }
						if (!knownDevice.IP) { return total; }
						const hostOctet = Number(knownDevice.IP.split('.').pop());
						if (hostOctet >= args.ip_from && hostOctet <= args.ip_to) {
							return total + 1;
						}
						return total;
					};
					const devicesOnlineInIpRange = Object.values(args.NetgearDevice.knownDevices).reduce(OnlineInIpRange, 0);
					return Promise.resolve(devicesOnlineInIpRange > 0);
				}
				return Promise.reject(Error('The netgear device is unknown or not ready'));
			});

		const newFirmwareCondition = new Homey.FlowCardCondition('new_firmware_condition');
		newFirmwareCondition.register()
			.registerRunListener((args) => {
				if (Object.prototype.hasOwnProperty.call(args, 'NetgearDevice')) {
					if (args.NetgearDevice.readings.newFirmware.newVersion !== '') {
						return Promise.resolve(true);
					}
					return Promise.resolve(false);
				}
				return Promise.reject(Error('The netgear device is unknown or not ready'));
			});

		// register action flow cards
		const blockDevice = new Homey.FlowCardAction('block_device');
		blockDevice.register()
			.on('run', async (args, state, callback) => {
				await this._driver.blockOrAllow.call(this, args.mac.name, 'Block')
					.catch(this.error);
				callback(null, true);
			})
			.getArgument('mac')
			.registerAutocompleteListener(autoComplete);

		const blockDeviceText = new Homey.FlowCardAction('block_device_text');
		blockDeviceText.register()
			.on('run', async (args, state, callback) => {
				await this._driver.blockOrAllow.call(this, args.mac.replace(' ', ''), 'Block')
					.catch(this.error);
				callback(null, true);
			});

		const allowDevice = new Homey.FlowCardAction('allow_device');
		allowDevice.register()
			.on('run', async (args, state, callback) => {
				await this._driver.blockOrAllow.call(this, args.mac.name, 'Allow')
					.catch(this.error);
				callback(null, true);
			})
			.getArgument('mac')
			.registerAutocompleteListener(autoComplete);

		const allowDeviceText = new Homey.FlowCardAction('allow_device_text');
		allowDeviceText.register()
			.on('run', async (args, state, callback) => {
				await this._driver.blockOrAllow.call(this, args.mac.replace(' ', ''), 'Allow')
					.catch(this.error);
				callback(null, true);
			});

		const wol = new Homey.FlowCardAction('wol');
		wol.register()
			.on('run', async (args, state, callback) => {
				await this._driver.wol.call(this, args.mac.name, args.password)
					.catch(this.error);
				callback(null, true);
			})
			.getArgument('mac')
			.registerAutocompleteListener(autoComplete);

		const setGuestWifi = new Homey.FlowCardAction('set_guest_wifi');
		setGuestWifi.register()
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

		const speedTestStart = new Homey.FlowCardAction('speed_test_start');
		speedTestStart.register()
			.on('run', async (args, state, callback) => {
				const speed = await this._driver.speedTest.call(this)
					.catch(this.error);
				callback(null, true);
				const tokens = {
					uplink_bandwidth: speed.uplinkBandwidth,
					downlink_bandwidth: speed.downlinkBandwidth,
					average_ping: speed.averagePing,
				};
				this.speedTestResultTrigger
					.trigger(this, tokens)
					.then(this.log(tokens))
					.catch((error) => {
						this.error('trigger error', error);
					});
			});

		const updateFirmware = new Homey.FlowCardAction('update_firmware');
		updateFirmware.register()
			.on('run', (args, state, callback) => {
				this._driver.updateNewFirmware.call(this)
					.catch(this.error);
				callback(null, true);
			});

		const reboot = new Homey.FlowCardAction('reboot');
		reboot.register()
			.on('run', (args, state, callback) => {
				this._driver.reboot.call(this)
					.catch(this.error);
				callback(null, true);
			});
	}

}

module.exports = NetgearDevice;
