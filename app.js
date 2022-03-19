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
const _test = require('netgear/test/_test');
const Logger = require('./captureLogs');
// require('inspector').open(9229, '0.0.0.0', false);

class MyApp extends Homey.App {

	onInit() {
		if (!this.logger) this.logger = new Logger({ name: 'netgearLog', length: 200, homey: this.homey });
		this.log('Netgear App is running!');

		// register some listeners
		process.on('unhandledRejection', (error) => {
			this.error('unhandledRejection! ', error);
		});
		process.on('uncaughtException', (error) => {
			this.error('uncaughtException! ', error);
		});
		this.homey
			.on('unload', () => {
				this.log('app unload called');
				// save logs to persistant storage
				this.logger.saveLogs();
			})
			.on('memwarn', () => {
				this.log('memwarn!');
			});
		this.registerFlowListeners();
		// do garbage collection every 10 minutes
		// this.intervalIdGc = setInterval(() => {
		// 	global.gc();
		// }, 1000 * 60 * 10);
	}

	//  stuff for frontend API
	deleteLogs() {
		return this.logger.deleteLogs();
	}

	getLogs() {
		return this.logger.logArray;
	}

	async emitTestResults(data) {
		try {
			const options = {
				password: data.password,
				host: data.host,
				port: Number(data.port),
				info: `Homey fw:${this.homey.version} app: ${this.homey.manifest.version}`,
				// shorttest: true,
			};
			const output = await _test.test(options);
			this.homey.api.realtime('test_results', output);
			this.log('test ready');
		} catch (error) {
			this.homey.api.realtime('test_results', error);
		}
	}

	runTest(data) {
		this.log('Router compatibility test started');
		this.emitTestResults(data);
		return true;
	}

	discover() {
		this.log('Router discovery started');
		const discover = _test.discover();
		return Promise.resolve(discover);
	}

	async getKnownDevices() {
		this.log('Retrieving known devices list');
		const driver = this.homey.drivers.getDriver('netgear');
		const routers = driver.getDevices();
		// const kdArray = [];
		// routers.forEach((router) => { kdArray[router.getName()] = router.knownDevices; });
		return Promise.resolve(routers[0].knownDevices);
	}

	registerFlowListeners() {

		// autocomplete function for Netgear driver
		const autoComplete = (query, args) => {
			try {
				const list = [];
				Object.keys(args.device.knownDevices).forEach((key) => {
					const device = args.device.knownDevices[key];
					if (!device.MAC) { return; }
					list.push({
						name: device.MAC,
						description: device.Name || 'unknown',
					});
				});
				const results = list.filter((result) => {		// filter for query on MAC and Name
					const macFound = result.name.toLowerCase().indexOf(query.toLowerCase()) > -1;
					const nameFound = result.description.toLowerCase().indexOf(query.toLowerCase()) > -1;
					return macFound || nameFound;
				});
				return Promise.resolve(results);
			} catch (error) {
				return Promise.reject(error);
			}
		};

		// trigger cards
		this._cameOnline = this.homey.flow.getDeviceTriggerCard('came_online');
		this.triggerCameOnline = (device, tokens, state) => {
			this._cameOnline
				.trigger(device, tokens, state)
				// .then(this.log(device.getName(), tokens))
				.catch(this.error);
		};

		this._wentOffline = this.homey.flow.getDeviceTriggerCard('went_offline');
		this.triggerWentOffline = (device, tokens, state) => {
			this._wentOffline
				.trigger(device, tokens, state)
				// .then(this.log(device.getName(), tokens))
				.catch(this.error);
		};

		this._nameChanged = this.homey.flow.getDeviceTriggerCard('name_changed');
		this.triggerNameChanged = (device, tokens, state) => {
			this._nameChanged
				.trigger(device, tokens, state)
				// .then(this.log(device.getName(), tokens))
				.catch(this.error);
		};

		this._IPChanged = this.homey.flow.getDeviceTriggerCard('ip_changed');
		this.triggerIPChanged = (device, tokens, state) => {
			this._IPChanged
				.trigger(device, tokens, state)
				// .then(this.log(device.getName(), tokens))
				.catch(this.error);
		};

		// trigger cards for attachedDevice
		this._metricsChanged = this.homey.flow.getDeviceTriggerCard('device_metrics_changed');
		this.triggerMetricsChanged = (device, tokens, state) => {
			this._metricsChanged
				.trigger(device, tokens, state)
				// .then(this.log(device.getName(), tokens))
				.catch(this.error);
		};

		// trigger cards for Netgear driver
		this._speedChanged = this.homey.flow.getDeviceTriggerCard('uldl_speed_changed');
		this.triggerSpeedChanged = (device, tokens, state) => {
			this._speedChanged
				.trigger(device, tokens, state)
				// .then(this.log(device.getName(), tokens))
				.catch(this.error);
		};

		this._newAttachedDevice = this.homey.flow.getDeviceTriggerCard('new_attached_device');
		this.triggerNewAttachedDevice = (device, tokens, state) => {
			this._newAttachedDevice
				.trigger(device, tokens, state)
				// .then(this.log(device.getName(), tokens))
				.catch(this.error);
		};

		// this._deviceOnline = this.homey.flow.getDeviceTriggerCard('device_online');
		// this.triggerDeviceOnline = (device, tokens, state) => {
		// 	this._deviceOnline
		// 		.trigger(device, tokens, state)
		// 		// .then(this.log(device.getName(), tokens))
		// 		.catch(this.error);
		// };

		// this._deviceOffline = this.homey.flow.getDeviceTriggerCard('device_offline');
		// this.triggerDeviceOffline = (device, tokens, state) => {
		// 	this._deviceOffline
		// 		.trigger(device, tokens, state)
		// 		// .then(this.log(device.getName(), tokens))
		// 		.catch(this.error);
		// };

		this._speedTestResult = this.homey.flow.getDeviceTriggerCard('speed_test_result');
		this.triggerSpeedTestResult = (device, tokens, state) => {
			this._speedTestResult
				.trigger(device, tokens, state)
				// .then(this.log(device.getName(), tokens))
				.catch(this.error);
		};

		this._newRouterFirmware = this.homey.flow.getDeviceTriggerCard('new_router_firmware');
		this.triggerNewRouterFirmware = (device, tokens, state) => {
			this._newRouterFirmware
				.trigger(device, tokens, state)
				// .then(this.log(device.getName(), tokens))
				.catch(this.error);
		};

		// condition cards for attachedDevice
		const deviceIsOnline = this.homey.flow.getConditionCard('device_is_online');
		deviceIsOnline.registerRunListener((args) => args.device.getCapabilityValue('device_connected'));

		// condition cards for Netgear driver
		const internetConnected = this.homey.flow.getConditionCard('alarm_generic');
		internetConnected.registerRunListener((args) => !args.device.getCapabilityValue('alarm_generic'));

		const newFirmware = this.homey.flow.getConditionCard('new_firmware_condition');
		newFirmware.registerRunListener((args) => (args.device.readings.newFirmware.newVersion
			&& args.device.readings.newFirmware.newVersion !== ''));

		const deviceIsOnlineAutocomplete = this.homey.flow.getConditionCard('device_is_online_autocomplete');
		deviceIsOnlineAutocomplete
			.registerRunListener((args) => {
				if (Object.prototype.hasOwnProperty.call(args, 'device')) {
					let isOnline = false;
					if (Object.prototype.hasOwnProperty.call(args.device.knownDevices, args.mac.name)) {
						isOnline = args.device.knownDevices[args.mac.name].online;	// true or false
					}
					return Promise.resolve(isOnline);
				}
				return Promise.reject(Error('The netgear device is unknown or not ready'));
			})
			.registerArgumentAutocompleteListener('mac', autoComplete);

		const deviceIsOnlineIpRange = this.homey.flow.getConditionCard('device_is_online_ip_range');
		deviceIsOnlineIpRange.registerRunListener((args) => {
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
		});

		// action cards for Netgear driver
		const blockDevice = this.homey.flow.getActionCard('block_device');
		blockDevice
			.registerRunListener((args) => args.device.blockOrAllow(args.mac.name, 'Block'))
			.registerArgumentAutocompleteListener('mac', autoComplete);

		const blockDeviceText = this.homey.flow.getActionCard('block_device_text');
		blockDeviceText
			.registerRunListener((args) => args.device.blockOrAllow(args.mac.replace(' ', ''), 'Block'));

		const allowDevice = this.homey.flow.getActionCard('allow_device');
		allowDevice
			.registerRunListener((args) => args.device.blockOrAllow(args.mac.name, 'Allow'))
			.registerArgumentAutocompleteListener('mac', autoComplete);

		const allowDeviceText = this.homey.flow.getActionCard('allow_device_text');
		allowDeviceText
			.registerRunListener((args) => args.blockOrAllow(args.mac.replace(' ', ''), 'Allow'));

		const wol = this.homey.flow.getActionCard('wol');
		wol
			.registerRunListener((args) => args.wol(args.mac.name, args.password))
			.registerArgumentAutocompleteListener('mac', autoComplete);

		const setGuestWifi = this.homey.flow.getActionCard('set_guest_wifi');
		setGuestWifi
			.registerRunListener((args) => {
				if (args.network === '5') {
					args.device.set5GGuestWifi(args.on_off);
				} else if (args.network === '5-2') {
					args.device.set5GGuestWifi2(args.on_off);
				} else if (args.network === '2.4') {
					args.device.setGuestwifi(args.on_off);
				} else {
					args.device.setGuestwifi2(args.on_off);
				}
			});

		const speedTestStart = this.homey.flow.getActionCard('speed_test_start');
		speedTestStart.registerRunListener(async (args) => {
			const speed = await args.device.speedTest();
			const tokens = {
				uplink_bandwidth: speed.uplinkBandwidth,
				downlink_bandwidth: speed.downlinkBandwidth,
				average_ping: speed.averagePing,
			};
			this.log(tokens);
			this.homey.app.triggerSpeedTestResult(args.device, tokens, {});
		});

		const updateFirmware = this.homey.flow.getActionCard('update_firmware');
		updateFirmware.registerRunListener(async (args) => args.device.updateNewFirmware());

		const reboot = this.homey.flow.getActionCard('reboot');
		reboot.registerRunListener(async (args) => args.device.reboot());

	}

}

module.exports = MyApp;
