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

class NetgearDevice extends Homey.Device {

	async updateRouterDeviceState() {
		try {
			// init some values
			const lastCurrentSetting = this.readings.currentSetting || {};
			const lastInternetConnectionStatus = lastCurrentSetting.InternetConnectionStatus || 'Up';
			const lastTrafficMeter = this.readings.trafficMeter || {};
			let lastTimestamp = this.readings.timestamp || {};
			if (lastTrafficMeter === {} || lastTimestamp === {}) {
				lastTrafficMeter.newTodayDownload = 0;
				lastTrafficMeter.newTodayUpload = 0;
				lastTimestamp = new Date();
			}
			// get new readings from router and update the knownDevices list
			this.readings = await this._driver.getRouterData.call(this);
			this._driver.updateDeviceList.call(this);
			// calculate speed
			const downloadSpeed = Math.round((100 * 1000 * 8 *
				(lastTrafficMeter.newTodayDownload - this.readings.trafficMeter.newTodayDownload)) /
				(lastTimestamp - this.readings.timestamp)) / 100;
			const uploadSpeed = Math.round((100 * 1000 * 8 *
				(lastTrafficMeter.newTodayUpload - this.readings.trafficMeter.newTodayUpload)) /
				(lastTimestamp - this.readings.timestamp)) / 100;
			// update capability values and flowcards
			this.setCapabilityValue('internet_connection_status', this.readings.currentSetting.InternetConnectionStatus === 'Up');
			if (this.readings.currentSetting.InternetConnectionStatus !== lastInternetConnectionStatus) {
				if (this.readings.currentSetting.InternetConnectionStatus === 'Up') {
					this.log('the internet connection came up');
					this.internetConnectedTrigger
						.trigger(this)
						.catch(this.error);
				} else {
					this.log('the internet connection went down');
					this.internetDisconnectedTrigger
						.trigger(this)
						.catch(this.error);
				}
			}
			if (this.getCapabilityValue('attached_devices') !== this.onlineDeviceCount) {
				this.setCapabilityValue('attached_devices', this.onlineDeviceCount);
			}
			if (downloadSpeed >= 0 && uploadSpeed >= 0) {	// disregard midnight measurements
				if ((this.getCapabilityValue('download_speed') !== downloadSpeed) || (this.getCapabilityValue('upload_speed') !== uploadSpeed)) {
					this.setCapabilityValue('download_speed', downloadSpeed);
					this.setCapabilityValue('upload_speed', uploadSpeed);
					// trigger the flowcard
					const tokens = {
						upload_speed: uploadSpeed,
						download_speed: downloadSpeed,
					};
					this.speedChangedTrigger
						.trigger(this, tokens)
						.catch(this.error);
				}
			}
			// update settings info when firmware has changed
			const settings = this.getSettings();
			if (this.readings.info.Firmwareversion !== settings.firmware_version) {
				this.setSettings({
					model_name: this.readings.info.ModelName,
					serial_number: this.readings.info.SerialNumber,
					firmware_version: this.readings.info.Firmwareversion,
					smart_agent_version: this.readings.info.SmartAgentversion,
				})
					.then(() => {
						this.log('new router firmware detected: ', this.readings.info.Firmwareversion);
					})
					.catch(this.error);
			}
		} catch (error) {
			this.error('updateRouterDeviceState error: ', error.message || error);
		}
	}

	// this method is called when the Device is inited
	async onInit() {
		this.log('device init: ', this.getName(), 'id:', this.getData().id);

		// init some values
		this._driver = this.getDriver();
		// this.logger = this._driver.logger;
		this.readings = {};
		// create router session
		const settings = this.getSettings();
		this.routerSession = new NetgearRouter(settings.password, settings.username, settings.host, settings.port);
		// get known device from store
		this.log('retrieving knownDevices from persistent storage');
		// this.logger.log('retrieving knownDevices from persistent storage');
		this.knownDevices = this.getStoreValue('knownDevices');
		// store known devices when app unloads
		Homey.on('unload', () => {
			this.log('unload called, storing knownDevices state');
			this.setStoreValue('knownDevices', this.knownDevices);
		});

		// register trigger flow cards
		this.speedChangedTrigger = new Homey.FlowCardTriggerDevice('uldl_speed_changed')
			.register();
		this.internetConnectedTrigger = new Homey.FlowCardTriggerDevice('connection_start')
			.register();
		this.internetDisconnectedTrigger = new Homey.FlowCardTriggerDevice('connection_stop')
			.register();
		this.newAttachedDevice = new Homey.FlowCardTriggerDevice('new_attached_device')
			.register();
		this.deviceOnline = new Homey.FlowCardTriggerDevice('device_online')
			.register();
		this.deviceOffline = new Homey.FlowCardTriggerDevice('device_offline')
			.register();

		// register condition flow flowcards
		const deviceOnline = new Homey.FlowCardCondition('device_online');
		deviceOnline.register()
			.registerRunListener((args) => {
				if (Object.prototype.hasOwnProperty.call(args, 'NetgearDevice')) {
					let deviceOnline2 = false;
					if (Object.prototype.hasOwnProperty.call(args.NetgearDevice.knownDevices, args.mac.name)) {
						deviceOnline2 = args.NetgearDevice.knownDevices[args.mac.name].online;	// true or false
					}
					return Promise.resolve(deviceOnline2);
				}
				return Promise.reject(Error('The netgear device is unknown or not ready'));
			})
			.getArgument('mac')
			.registerAutocompleteListener((query) => {
				let results = this._driver.makeAutocompleteList.call(this);
				results = results.filter((result) => {		// filter for query on MAC and Name
					const macFound = result.name.toLowerCase().indexOf(query.toLowerCase()) > -1;
					const nameFound = result.description.toLowerCase().indexOf(query.toLowerCase()) > -1;
					return macFound || nameFound;
				});
				return Promise.resolve(results);
			});

		// register action flow cards
		const blockDevice = new Homey.FlowCardAction('block_device');
		blockDevice.register()
			.on('run', async (args, state, callback) => {
				await this._driver.blockOrAllow.call(this, args.mac.name, 'Block');
				// this.log(args.mac.name);
				callback(null, true);
			})
			.getArgument('mac')
			.registerAutocompleteListener((query) => {
				let results = this._driver.makeAutocompleteList.call(this);
				results = results.filter((result) => {		// filter for query on MAC and Name
					const macFound = result.name.toLowerCase().indexOf(query.toLowerCase()) > -1;
					const nameFound = result.description.toLowerCase().indexOf(query.toLowerCase()) > -1;
					return macFound || nameFound;
				});
				return Promise.resolve(results);
			});

		const allowDevice = new Homey.FlowCardAction('allow_device');
		allowDevice.register()
			.on('run', async (args, state, callback) => {
				await this._driver.blockOrAllow.call(this, args.mac.name, 'Allow');
				// this.log(args.mac.name);
				callback(null, true);
			})
			.getArgument('mac')
			.registerAutocompleteListener((query) => {
				let results = this._driver.makeAutocompleteList.call(this);
				results = results.filter((result) => {		// filter for query on MAC and Name
					const macFound = result.name.toLowerCase().indexOf(query.toLowerCase()) > -1;
					const nameFound = result.description.toLowerCase().indexOf(query.toLowerCase()) > -1;
					return macFound || nameFound;
				});
				return Promise.resolve(results);
			});

		const setGuestWifi = new Homey.FlowCardAction('set_guest_wifi');
		setGuestWifi.register()
			.on('run', async (args, state, callback) => {
				if (args.network === '5') {
					await this._driver.set5GGuestAccessEnabled.call(this, args.on_off);
				} else if (args.network === '5-2') {
					await this._driver.set5GGuestAccessEnabled2.call(this, args.on_off);
				} else if (args.network === '2.4') {
					await this._driver.setGuestAccessEnabled.call(this, args.on_off);
				} else {
					await this._driver.setGuestAccessEnabled2.call(this, args.on_off);
				}
				callback(null, true);
			});

		const reboot = new Homey.FlowCardAction('reboot');
		reboot.register()
			.on('run', (args, state, callback) => {
				this._driver.reboot.call(this);
				callback(null, true);
			});

		// start polling router for info
		this.intervalIdDevicePoll = setInterval(() => {
			try {
				// get new routerdata and update the state
				this.updateRouterDeviceState();
			} catch (error) { this.log('intervalIdDevicePoll error', error); }
		}, 1000 * settings.polling_interval);

	}

	// this method is called when the Device is added
	onAdded() {
		this.log('router added as device');
	}

	// this method is called when the Device is deleted
	onDeleted() {
		// stop polling
		clearInterval(this.intervalIdDevicePoll);
		this.log('router deleted as device');
	}

	// this method is called when the user has changed the device's settings in Homey.
	onSettings(oldSettingsObj, newSettingsObj, changedKeysArr, callback) {
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
			this.setStoreValue('knownDevices', this.knownDevices);
			this.log('known devices were deleted on request of user');
			return callback('Deleting known devices list', null);
		}
		// do callback to confirm settings change
		return callback(null, true);
	}

}

module.exports = NetgearDevice;
