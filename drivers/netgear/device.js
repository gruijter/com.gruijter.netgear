/* eslint-disable no-await-in-loop */
/*
Copyright 2017 - 2023, Robin de Gruijter (gruijter@hotmail.com)

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
const setTimeoutPromise = util.promisify(setTimeout);

class NetgearDevice extends Homey.Device {

	async login()	{
		try {
			// login when loggedOut or session is almost 1hr old
			if (!this.routerSession.loggedIn || ((Date.now() - this.routerSession.lastLoginTm) > 59 * 60 * 1000)) {
				this.log('Logging in');
				const method = Number(this.settings.login_method);
				await this.routerSession.login({ method });
				this.routerSession.lastLoginTm = Date.now();
				this.log('Login successful');
			}
			this.setAvailable().catch(this.error);
			return Promise.resolve(true);
		}	catch (error) {
			return Promise.reject(error);
		}
	}

	async wol(mac, password) {
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

	async blockOrAllow(mac, action) {
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

	async setGuestwifi(action) {
		try {
			this.log(`2.4GHz-1 guest wifi ${action} requested`);
			if (!this.routerSession.loggedIn) {
				await this.routerSession.login();
			}
			const onOff = (action === 'on');
			await this.routerSession.setGuestWifi(onOff);
			return Promise.resolve(true);
		}	catch (error) {
			// this.error('2.4GHz-1 set guest wifi error', error.message);f
			return Promise.reject(error);
		}
	}

	async setGuestwifi2(action) {
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

	async set5GGuestWifi(action) {
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

	async setCapability(capability, value) {
		if (this.hasCapability(capability) && value !== undefined) {
			// only update changed capabilities
			if (value !== await this.getCapabilityValue(capability)) {
				this.setCapabilityValue(capability, value)
					.catch((error) => {
						this.error(error, capability, value);
					});
			}
		}
	}

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
				if ((this.getCapabilityValue('meter_download_speed') !== downloadSpeed)
					|| (this.getCapabilityValue('meter_upload_speed') !== uploadSpeed)) {
					this.setCapability('meter_download_speed', downloadSpeed);
					this.setCapability('meter_upload_speed', uploadSpeed);
					const tokens = {
						upload_speed: uploadSpeed,
						download_speed: downloadSpeed,
					};
					this.homey.app.triggerSpeedChanged(this, tokens, {});
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
			this.setCapability('meter_cpu_utilization', this.readings.systemInfo.NewCPUUtilization);
			this.setCapability('meter_mem_utilization', this.readings.systemInfo.NewMemoryUtilization);
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
			if (this.readings.newFirmware && this.readings.newFirmware.newVersion && this.readings.newFirmware.newVersion !== '') {
				const tokens = {
					current_version: newFirmware.currentVersion,
					new_version: newFirmware.newVersion,
					release_note: newFirmware.releaseNote,
				};
				this.homey.app.triggerNewRouterFirmware(this, tokens, {});
			}
			// update settings info
			if (this.readings.info) {
				if (this.readings.info.Firmwareversion !== this.settings.firmware_version) {
					this.log('New router firmware installed: ', this.readings.info.Firmwareversion);
				}
				if (this.driver.deviceModes[Number(this.readings.info.DeviceMode)] !== this.settings.device_mode) {
					this.log('New device mode selected: ', this.driver.deviceModes[Number(this.readings.info.DeviceMode)]);
				}
				this.setSettings({
					model_name: this.readings.info.ModelName || this.readings.info.DeviceName || 'Netgear',
					serial_number: this.readings.info.SerialNumber,
					firmware_version: this.readings.info.Firmwareversion,
					device_mode: this.driver.deviceModes[Number(this.readings.info.DeviceMode)],
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
				// this.homey.emit(`log_${this.getData().id}`, JSON.stringify({ router: this.getData().id, logs }));	// send to log_analyzer driver
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
			const pairedDeviceDriver = this.homey.drivers.getDriver('attached_device');
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
					this.homey.app.triggerNewAttachedDevice(this, tokens, {});
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
					this.homey.app.triggerCameOnline(this, tokens, {});
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
				const tokens = {
					mac: device.MAC,
					name: device.Name,
					ip: device.IP,
				};
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
						this.homey.app.triggerWentOffline(this, tokens, {});
					}
					device.online = false;
				}

				// trigger when IP changed
				if (device.Name !== knownDevices[device.MAC].IP) {
					this.homey.app.triggerNameChanged(this, tokens, {});
				}
				// trigger when name changed
				if (device.IP !== knownDevices[device.MAC].Name) {
					this.homey.app.triggerIPChanged(this, tokens, {});
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
			this.setCapability('meter_attached_devices', onlineCount);
			// send to attached_device driver
			this.homey.emit('listUpdate', JSON.stringify({ routerID: this.getData().id, knownDevices }));	// send to attached_device driver
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
			await this.login();
			await this.updateKnownDeviceList();	// attached devices state
			await this.updateInternetConnectionState().catch(this.error);	// disconnect alarm
			await this.updateSpeed().catch(this.error);	// up/down internet bandwidth
			await this.updateSystemInfo().catch(this.error);	// mem/cpu load
			await this.updateLogs().catch(this.error);	// system logs EXPERIMENTAL
			// update exta info once an hour
			if ((Date.now() - this.readings.extraPollTime) > (60 * 60 * 1000)) {
				await this.updateFirmwareInfo().catch(this.error);	// firmware and router mode
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
			this.setAvailable().catch(this.error);
			this.settings = await this.getSettings();

			// migrate stuff
			if (!this.migrated) await this.checkCaps(true);

			// init some values
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
			// this.hasLogAnalyzer = false;
			this.logs = [];

			// create router session
			const options = {
				password: this.settings.password,
				username: this.settings.username,
				host: this.settings.host,
				port: this.settings.port,
				tls: this.settings.port === 443 || this.settings.port === 5555,
			};
			this.routerSession = new NetgearRouter(options);
			await this.login().catch(() => this.error('failed to login during init'));

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
				await this.enableTrafficMeter(true)
					.catch(() => this.log('Traffic meter could not be enabled'));
			}
			await this.setBlockDeviceEnable(true)
				.catch(() => this.log('Device Access Control could not be enabled'));
			// store known devices when app unloads
			this.homey.on('unload', async () => {
				this.log('unload called, storing knownDevices state');
				const devicesString = JSON.stringify(this.knownDevices).replace('&lt', '').replace('&gt', '').replace(';', '');
				await this.setStoreValue('knownDevicesString', devicesString);
			});

			// start polling router for info
			await this.updateRouterDeviceState();
			this.startPolling(this.settings.polling_interval);

			this.log(`device ready: ${this.getName()} id: ${this.getData().id}`);

		} catch (error) {
			this.error(error);
			this.setUnavailable(error.message).catch(this.error);
			await this.restartDevice(5 * 60 * 1000);
		}

	}

	// migrate stuff from old version < 4.0.0
	async checkCaps(migrate) {
		try {
			if (migrate) this.log(`checking device migration for ${this.getName()}`);
			// console.log(this.getName(), this.settings, this.getStore());

			// check and repair incorrect capability(order)	// remove unselected optional capabilities
			const correctCaps = this.driver.capabilities.filter((cap) => {
				let include = true;
				if (!this.settings.use_traffic_info && cap.includes('speed')) include = false;
				if (!this.settings.use_system_info && cap.includes('utilization')) include = false;
				return include;
			});
			for (let index = 0; index < correctCaps.length; index += 1) {
				const caps = await this.getCapabilities();
				const newCap = correctCaps[index];
				if (caps[index] !== newCap) {
					// remove all caps from here
					for (let i = index; i < caps.length; i += 1) {
						this.log(`removing capability ${caps[i]} for ${this.getName()}`);
						await this.removeCapability(caps[i])
							.catch((error) => this.log(error));
						await setTimeoutPromise(3 * 1000); // wait a bit for Homey to settle
					}
					// add the new cap
					this.log(`adding capability ${newCap} for ${this.getName()}`);
					await this.addCapability(newCap);
					await setTimeoutPromise(3 * 1000); // wait a bit for Homey to settle
				}
			}
			// set new migrate level
			if (migrate && this.settings.level < '4.0.0') {
				const excerpt = `The Netgear app is migrated to version ${this.homey.app.manifest.version} **CHECK FOR BROKEN FLOWS!**`;
				await this.homey.notifications.createNotification({ excerpt });
				await this.setSettings({ level: this.homey.app.manifest.version });
				this.log(excerpt);
			}
			this.migrated = true;
			return Promise.resolve(this.migrated);
		} catch (error) {
			return Promise.reject(Error('Migration failed', error));
		}
	}

	async restartDevice(delay) {
		if (this.restarting) return;
		this.restarting = true;
		this.stopPolling();
		const dly = delay || 2000;
		this.log(`Device will restart in ${dly / 1000} seconds`);
		await setTimeoutPromise(dly).then(() => this.onInit());
		this.restarting = false;
	}

	// this method is called when the Device is added
	async onAdded() {
		const settings = this.getSettings();
		this.log(`router ${settings.model_name} added as device @ ${settings.host}:${settings.port}`);
	}

	// this method is called when the Device is deleted
	onDeleted() {
		this.stopPolling();
		this.log(`Router deleted as device: ${this.getName()}`);
	}

	stopPolling() {
		this.log(`Stop polling ${this.getName()}`);
		this.homey.clearInterval(this.intervalIdDevicePoll);
	}

	// register polling stuff
	startPolling(interval) {
		this.homey.clearInterval(this.intervalIdDevicePoll);
		this.log(`start polling ${this.getName()} @${interval} seconds interval`);
		this.intervalIdDevicePoll = this.homey.setInterval(async () => {
			try {
				if (this.watchDogCounter <= 0) throw Error('watchdog active');
				if (this.busy) {
					this.log('Still busy. Skipping a poll');
					return;
				}
				// get new routerdata and update the state
				await this.updateRouterDeviceState();
				this.watchDogCounter = 4;
			} catch (error) {
				this.error(error);
				this.watchDogCounter -= 1;
				if (this.watchDogCounter <= 0) {
					// restart the app here
					this.log('watchdog triggered, restarting Homey device now');
					this.setUnavailable(error.message).catch(this.error);
					await this.restartDevice(5 * 60 * 1000); // restart after 5 minutes
				}
			}
		}, 1000 * interval);
	}

	async onSettings({ newSettings }) { // , changedKeys }) { // , oldSettings, changedKeys) {
		this.log(`${this.getName()} device settings changed by user`, newSettings);
		this.stopPolling();

		if (newSettings.clear_known_devices) {
			this.knownDevices = {};
			await this.setStoreValue('knownDevicesString', JSON.stringify(this.knownDevices));
			this.log('known devices were deleted on request of user');
			return Promise.reject(Error('Known devices list deleted'));
		}
		if (newSettings.use_traffic_info) {
			await this.addCapability('meter_download_speed');
			await this.addCapability('meter_upload_speed');
		} else {
			await this.removeCapability('meter_download_speed');
			await this.removeCapability('meter_upload_speed');
		}
		if (newSettings.use_system_info) {
			await this.addCapability('meter_cpu_utilization');
			await this.addCapability('meter_mem_utilization');
		} else {
			await this.removeCapability('meter_cpu_utilization');
			await this.removeCapability('meter_mem_utilization');
		}
		await this.restartDevice(3000);
		return true;
	}

}

module.exports = NetgearDevice;
