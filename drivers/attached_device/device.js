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

const { Device } = require('homey');
const util = require('util');

const setTimeoutPromise = util.promisify(setTimeout);

class attachedNetgearDevice extends Device {

	// this method is called when the Device is inited
	async onInit() {
		this.restarting = false;
		this.settings = await this.getSettings();
		const aliasses = [this.settings.mac, this.settings.alias1, this.settings.alias2, this.settings.alias3, this.settings.alias4];
		this.aliasses = aliasses.filter((mac) => mac && mac.length === 17);

		if (!this.lastInfo) {
			this.lastInfo = {
				MAC: this.getData().id,
				Name: this.getCapabilityValue('name_in_router') || 'unknown',
				IP: this.getCapabilityValue('ip_address') || 'unknown',
			};
		}

		// migrate stuff
		if (!this.migrated) await this.checkCaps(true).catch(this.error);

		// add router available check here?
		this.log(`device ready: ${this.getName()}`);
	}

	restartDevice(delay) {
		if (this.restarting) return;
		this.restarting = true;
		// await this.destroyListeners();
		const dly = delay || 2000;
		this.log(`Device will restart in ${dly / 1000} seconds`);
		// this.setUnavailable('Device is restarting. Wait a few minutes!');
		setTimeoutPromise(dly).then(() => this.onInit());
	}

	// migrate stuff from old version < 4.0.0 and reset capabilities after settings change
	async checkCaps(migrate) {
		try {
			if (migrate) this.log(`checking device migration for ${this.getName()}`);
			// console.log(this.getName(), this.settings, this.getStore());

			// check and repair incorrect capability(order)	// remove unselected optional capabilities
			const correctCaps = this.driver.capabilities.filter((cap) => {
				let include = true;
				if (!this.settings.use_link_info && (cap === 'meter_link_speed' || cap === 'meter_signal_strength')) include = false;
				if (!this.settings.use_bandwidth_info && cap.includes('load_speed')) include = false;
				if (!this.settings.report_power && cap === 'onoff') include = false;
				return include;
			});
			for (let index = 0; index < correctCaps.length; index += 1) {
				const caps = this.getCapabilities();
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
			if (migrate) this.setSettings({ level: this.homey.app.manifest.version }).catch(this.error);
			this.migrated = true;
			Promise.resolve(this.migrated);
		} catch (error) {
			Promise.reject(Error('Migration failed', error));
		}
	}

	// this method is called when the Device is added
	onAdded() {
		this.log(`${this.getData().id} added: ${this.getName()}`);
	}

	// this method is called when the Device is deleted
	onDeleted() {
		this.log(`${this.getData().id} deleted: ${this.getName()}`);
	}

	onSettings({ newSettings, changedKeys }) { // , oldSettings, ) {
		this.log(`${this.getData().id} ${this.getName()} device settings changed by user`, newSettings);
		changedKeys.forEach((key) => {
			if (key.includes('alias') && newSettings[key] !== '') {
				if (newSettings[key].length !== 17 || newSettings[key].split(':').length !== 6) throw Error('Invalid MAC alias');
			}
		});
		this.migrated = false;
		this.restartDevice(1000);
	}

	// Update device capabilities and trigger flowcards
	async checkMetricsChanged(metrics, info) {
		if (!this.migrated) return Promise.resolve(true);
		const tokens = {
			mac: info.MAC,
			name: metrics.name_in_router,
			ip: metrics.ip_address,
			device_connected: metrics.device_connected,
			ssid: metrics.ssid,
			link_speed: metrics.meter_link_speed,
			signal_strength: metrics.meter_signal_strength,
			download_speed: metrics.meter_download_speed,
			upload_speed: metrics.meter_upload_speed,
		};
		// check for (dis)connected
		let connectionChanged = false;
		if (this.getCapabilityValue('device_connected') !== metrics.device_connected) {
			connectionChanged = true;
		}
		// check metrics changed and update capability
		let metricsChanged = false;
		Object.keys(metrics).forEach((capability) => {
			if (this.hasCapability(capability)) {
				if (this.getCapabilityValue(capability) !== metrics[capability]) {
					metricsChanged = true;
				}
				this.setCapabilityValue(capability, metrics[capability])
					.catch((error) => {
						this.log(error, capability, metrics[capability]);
					});
			}
		});

		// trigger flow when (dis)connected
		if (connectionChanged) {
			if (metrics.device_connected) {
				this.log(`Connected: ${this.getName()} ${info.MAC} ${info.IP}`);
				this.homey.app.triggerCameOnline(this, tokens, {});
			} else {
				this.log(`Disconnected: ${this.getName()} ${info.MAC}`);
				this.homey.app.triggerWentOffline(this, tokens, {});
			}
		}
		// trigger flow when metrics changed
		if (metricsChanged) {
			this.homey.app.triggerMetricsChanged(this, tokens, {});
		}
		// trigger flow when Name changed
		if (info.Name !== this.lastInfo.Name) {
			this.homey.app.triggerNameChanged(this, tokens, {});
		}
		// trigger flow when IP changed
		if ((info.IP !== this.lastInfo.IP) && !connectionChanged) {
			this.homey.app.triggerIPChanged(this, tokens, {});
		}
		return Promise.resolve(true);
	}

	async updateInfo(info) {
		try {
			const hasInfo = info !== undefined;	// this device is gone from router list
			const metrics = {	// defaults when gone from router list
				onoff: false,
				device_connected: false,
				ssid: 'offline',
				ip_address: 'offline',
				name_in_router: this.lastInfo.Name,
				meter_link_speed: 0,
				meter_signal_strength: 0,
				meter_download_speed: 0,
				meter_upload_speed: 0,
			};
			if (hasInfo) {
				let connected = true;
				if ((Date.parse(info.pollTime) - Date.parse(info.lastSeen)) > (this.settings.offline_after * 1000)) {
					connected = false;
				}
				metrics.onoff = connected;
				metrics.device_connected = connected;
				if (connected) {
					metrics.ssid = info.SSID ? info.SSID : info.ConnectionType;
					metrics.ip_address = info.IP ? info.IP : 'unknown';
					metrics.name_in_router = info.Name ? info.Name : 'unknown';
					metrics.meter_link_speed = info.Linkspeed ? info.Linkspeed : 100;
					metrics.meter_signal_strength = info.SignalStrength ? info.SignalStrength : 0;
					metrics.meter_download_speed = info.Download ? info.Download : 0;
					metrics.meter_upload_speed = info.Upload ? info.Upload : 0;
				}
			}
			await this.checkMetricsChanged(metrics, info || this.lastInfo);
			if (hasInfo) this.lastInfo = info;
		} catch (error) { this.error(error); }
	}

}

module.exports = attachedNetgearDevice;

/*
{
	'58:A2:B5:F8:D3:48': {
		IP: '-',
		Name: 'LgD605',
		NameUserSet: true,
		MAC: '58:A2:B5:F8:D3:48',
		ConnectionType: '2.4GHz',
		SSID: 'TT11g',
		Linkspeed: 38,
		SignalStrength: 74,
		AllowOrBlock: 'Allow',
		Schedule: false,
		DeviceType: 3,
		DeviceTypeUserSet: true,
		Upload: 0,
		Download: 0,
		QosPriority: 3,
		DeviceModelUserSet: false,
		Grouping: 0,
		SchedulePeriod: 0,
		ConnAPMAC: 'b0:7f:b9:f8:1d:ea',
		online: false,
		lastSeen: '2019-08-02T09:53:20.576Z',
		timeStamp: '2019-08-02T09:53:20.576Z'
	}
}
*/
