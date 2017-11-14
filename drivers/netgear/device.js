'use strict';

const Homey = require('homey');
const NetgearRouter = require('../../netgear.js');
// const util = require('util');

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
					this.internetConnectedTrigger
						.trigger(this)
						.catch(this.error);
				} else {
					this.internetDisconnectedTrigger
						.trigger(this)
						.catch(this.error);
				}
			}
			if (this.getCapabilityValue('attached_devices') !== this.onlineDeviceCount) {
				this.setCapabilityValue('attached_devices', this.onlineDeviceCount);
				// make a flowcard trigger here
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
						this.logger.log('new router firmware detected: ', this.readings.info.Firmwareversion);
					})
					.catch(this.error);
			}
		} catch (error) {
			this.error('updateRouterDeviceState error: ', error);
			this.logger.log('updateRouterDeviceState error: ', error);
		}

	}

	// this method is called when the Device is inited
	async onInit() {
		this.log('device init: ', this.getName(), 'id:', this.getData().id);

		// init some values
		this._driver = this.getDriver();
		this.logger = this._driver.logger;
		this.readings = {};
		// create router session
		const settings = this.getSettings();
		this.routerSession = new NetgearRouter(settings.password, settings.username, settings.host, settings.port);
		// get known device from store
		this.log('retrieving knownDevices from persistent storage');
		this.logger.log('retrieving knownDevices from persistent storage');
		this.knownDevices = this.getStoreValue('knownDevices');
		// store known devices when app unloads
		Homey.on('unload', () => {
			this.logger.log('unload called', 'storing knownDevices state');
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
		  .registerRunListener((args, state) => {
				if (args.hasOwnProperty('NetgearDevice')) {
					let deviceOnline2 = false;
					if (args.NetgearDevice.knownDevices.hasOwnProperty(args.mac)) {
						deviceOnline2 = args.NetgearDevice.knownDevices[args.mac].online;	// true or false
					}
					return Promise.resolve(deviceOnline2);
				}
				return Promise.reject(Error('The netgear device is unknown or not ready'));
			})
			.getArgument('mac')
			.registerAutocompleteListener((query, args) => {
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
			.on('run', (args, state, callback) => {
			// console.log(args);  //args.mac and args.device
			// console.log(state);
				this._driver.blockOrAllow.call(this, args.mac, 'Block');
				callback(null, true);
			})
			.getArgument('mac')
			.registerAutocompleteListener((query, args) => {
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
			.on('run', (args, state, callback) => {
			// console.log(args);
			// console.log(state);
				this._driver.blockOrAllow.call(this, args.mac, 'Allow');
				callback(null, true);
			})
			.getArgument('mac')
			.registerAutocompleteListener((query, args) => {
				let results = this._driver.makeAutocompleteList.call(this);
				results = results.filter((result) => {		// filter for query on MAC and Name
					const macFound = result.name.toLowerCase().indexOf(query.toLowerCase()) > -1;
					const nameFound = result.description.toLowerCase().indexOf(query.toLowerCase()) > -1;
					return macFound || nameFound;
				});
				return Promise.resolve(results);
			});

		const reboot = new Homey.FlowCardAction('reboot');
		reboot.register()
			.on('run', (args, state, callback) => {
			// console.log(args);  //args.mac and args.device
			// console.log(state);
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
		this.logger.log('router added as device');
	}

	// this method is called when the Device is deleted
	onDeleted() {
		// stop polling
		clearInterval(this.intervalIdDevicePoll);
		this.log('router deleted as device');
		this.logger.log('router deleted as device');
	}

	// this method is called when the user has changed the device's settings in Homey.
	onSettings(newSettingsObj, oldSettingsObj, changedKeysArr, callback) {
		// first stop polling the device, then start init after short delay
		clearInterval(this.intervalIdDevicePoll);
		this.log('router device settings changed');
		this.logger.log('router device settings changed');
		this.setAvailable()
			.catch(this.error);
		setTimeout(() => {
			this.onInit();
		}, 10000);
		// wait for Homey firmware fix https://github.com/athombv/homey-issues-dp/issues/126
		// if (newSettingsObj['clear_known_devices']) {
		// 	this.knownDevices = {};
		// 	this.setStoreValue('knownDevices', this.knownDevices);
		// 	return callback( 'Deleting known devices list', null );
		// }
		// do callback to confirm settings change
		callback(null, true);
	}


}

module.exports = NetgearDevice;
