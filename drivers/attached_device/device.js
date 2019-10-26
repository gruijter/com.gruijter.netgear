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

class attachedNetgearDevice extends Homey.Device {

	// this method is called when the Device is inited
	async onInit() {
		this.log(`device init ${this.getName()}`);
		this.settings = await this.getSettings();
		// add router available check here?
		this.registerFlowCards();
	}

	// this method is called when the Device is added
	onAdded() {
		this.log(`${this.getData().id} added: ${this.getName()}`);
	}

	// this method is called when the Device is deleted
	onDeleted() {
		this.log(`${this.getData().id} deleted: ${this.getName()}`);
	}

	// this method is called when the user has changed the device's settings in Homey.
	async onSettings(oldSettingsObj, newSettingsObj, changedKeysArr) {
		this.log(`${this.getData().id} ${this.getName()} device settings changed`);
		await changedKeysArr.forEach(async (key) => {
			switch (key) {
				case 'icon':
					this.setIcon('../assets/smartphone.svg');
					break;
				case 'use_link_info':
					if (newSettingsObj.use_link_info) {
						await this.addCapability('link_speed');
						await this.addCapability('signal_strength');
					} else {
						await this.removeCapability('link_speed');
						await this.removeCapability('signal_strength');
					}
					break;
				case 'use_bandwidth_info':
					if (newSettingsObj.use_bandwidth_info) {
						await this.addCapability('download_speed');
						await this.addCapability('upload_speed');
					} else {
						await this.removeCapability('download_speed');
						await this.removeCapability('upload_speed');
					}
					break;
				case 'report_power':
					if (newSettingsObj.report_power) {
						await this.addCapability('onoff');
					} else {
						await this.removeCapability('onoff');
					}
					break;
				default:
					break;
			}
		});
		this.log(newSettingsObj);
		this.settings = newSettingsObj;
		return Promise.resolve(true);
	}

	// Update device capabilities and trigger flowcards
	checkMetricsChanged(metrics, info) {
		// check coming online or going offline
		const wasConnected = this.getCapabilityValue('device_connected');
		if (wasConnected !== metrics.device_connected) {
			const tokens = {
				mac: info.MAC,
				name: info.Name,
				ip: info.IP,
			};
			if (metrics.device_connected) {
				this.log(`Connected: ${this.getName()} ${info.IP}`);
				this.deviceOnlineTrigger
					.trigger(this, tokens)
					// .then(this.log(tokens))
					.catch((error) => {
						this.error('trigger error', error);
					});
			} else {
				this.log(`Disconnected: ${this.getName()}`);
				this.deviceOfflineTrigger
					.trigger(this, tokens)
					// .then(this.log(tokens))
					.catch((error) => {
						this.error('trigger error', error);
					});
			}
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
		// metrics have changed trigger flow
		if (metricsChanged) {
			const tokens = {
				mac: info.MAC,
				name: info.Name,
				ip: info.IP,
				device_connected: metrics.device_connected,
				SSID: metrics.SSID,
				link_speed: metrics.link_speed,
				signal_strength: metrics.signal_strength,
				download_speed: metrics.download_speed,
				upload_speed: metrics.upload_speed,
			};
			this.metricsChangedTrigger
				.trigger(this, tokens)
				// .then(this.log(tokens))
				.catch((error) => {
					this.error('trigger error', error);
				});
		}
	}

	updateInfo(info) {
		try {
			let connected = true;
			if ((Date.parse(info.pollTime) - Date.parse(info.lastSeen)) > (this.settings.offline_after * 1000)) {
				connected = false;
			}
			let SSID = 'offline';
			let linkSpeed = 0;
			let signalStrength = 0;
			let download = 0;
			let upload = 0;
			if (connected) {
				SSID = info.SSID ? info.SSID : info.ConnectionType;
				linkSpeed = info.Linkspeed ? info.Linkspeed : 100;
				signalStrength = info.SignalStrength ? info.SignalStrength : signalStrength;
				download = info.Download ? info.Download : download;
				upload = info.Upload ? info.Upload : upload;
			}
			const metrics = {
				onoff: connected,
				device_connected: connected,
				SSID,
				link_speed: linkSpeed,
				signal_strength: signalStrength,
				download_speed: download,
				upload_speed: upload,
			};
			this.checkMetricsChanged(metrics, info);
		} catch (error) { this.error(error); }
	}

	registerFlowCards() {
		this.deviceOnlineTrigger = new Homey.FlowCardTriggerDevice('device_online')
			.register();
		this.deviceOfflineTrigger = new Homey.FlowCardTriggerDevice('device_offline')
			.register();
		this.metricsChangedTrigger = new Homey.FlowCardTriggerDevice('device_metrics_changed')
			.register();
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
