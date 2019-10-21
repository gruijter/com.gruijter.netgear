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
const GetIPIntel = require('getipintel');
// const util = require('util');

// const setTimeoutPromise = util.promisify(setTimeout);

const regexIP = /\b(?:\d{1,3}\.){3}\d{1,3}\b/;
const regexMAC = /(([A-Fa-f0-9]{2}[:]){5}[A-Fa-f0-9]{2}[,]?)+/g;

class LogAnalyzerDevice extends Homey.Device {

	// this method is called when the Device is inited
	async onInit() {
		this.log(`device init ${this.getName()}`);
		this.settings = await this.getSettings();
		// this.lastLog = {};
		this.ipIntel = new GetIPIntel({ contact: Homey.env.CONTACT });
		this.detections = [];
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
		this.log(newSettingsObj);
		this.settings = newSettingsObj;
		return Promise.resolve(true);
	}

	setCapability(capability, value) {
		if (this.hasCapability(capability)) {
			this.setCapabilityValue(capability, value)
				.catch((error) => {
					this.log(error, capability, value);
				});
		}
	}

	// remove detections older than 60 minutes.
	purgeDetections() {
		if (!this.detections[0]) return;
		const now = Date.now();
		this.detections = this.detections
			.filter((detection) => detection)
			.filter((detection) => (now - detection.homeyTs) < (1000 * 60 * 60));
	}

	async detect(log) {
		try {
			// detect incoming bad IP
			let badIP = false;
			const ipIntel = new Promise((resolve, reject) => {
				if (log.info && log.info.toLowerCase().includes('from')) {
					const IPs = regexIP.exec(log.info);
					if (IPs) {
						this.ipIntel.getIntel(IPs[0], 'f')
							.then((intel) => {
								if (intel.BadIP || (Number(intel.result) > (this.getSettings().bad_ip_threshold / 100))) {
									// this.log(`Bad IP address accessing the network: ${intel.queryIP} score:${intel.result} Country:${intel.Country}`);
									badIP = true;
								}
								return resolve(intel);
							})
							.catch((error) => {
								this.log(error.message);
								return resolve(null);
							});
					}
				} else return resolve(null);
			});

			const intel = await Promise.resolve(ipIntel);
			// detect DoS Attacks
			let DoSattack = false;
			if (log.event && log.event.toLowerCase().includes('attack')) {
				// this.log(`DoS attack: ${log.string}`);
				DoSattack = true;
			}
			// combine result
			let result = null;
			if (badIP || DoSattack) {
				result = { log, intel };
			}
			if (result) {
				result.homeyTs = Date.now();
				const score = intel ? (Number(intel.result) * 100) : 0;
				const tokens = {
					log: log.string, // '[LAN access from remote] from 171.67.70.80:41512 to 192.168.1.7:443, Tuesday, October 15, 2019 08:37:29'
					event: log.event,	// 'LAN access from remote'
					info: log.info,	// 'from 171.67.70.80:41512 to 192.168.1.7:443'
					bad_ip: intel.queryIP,	// '171.67.70.80'
					ip_country: intel.Country, // 'RU'
					ip_score: score,	// 99.325001239777
				};
				this.log(tokens);
				this.setCapability('alarm_cyber', true);
				this.attackTrigger
					.trigger(this, tokens)
					// .then(this.log(tokens))
					.catch((error) => {
						this.error('trigger error', error);
					});
			}
			return Promise.resolve(result);
		} catch (error) {
			return Promise.reject(error);
		}
	}

	async updateInfo(logs) {
		try {
			this.purgeDetections(); // remove detections older than 60 minutes.
			if (!(logs.length > 0)) return;
			if (!this.lastLog) {
				[this.lastLog] = logs;
			}
			const newLogs = [];
			let index = 0;
			while ((index < logs.length) && (logs[index].string !== this.lastLog.string)) {
				newLogs.unshift(logs[index]);
				index += 1;
			}
			// const newLogs = logs.filter((log) => Date.parse(log.ts) > Date.parse(this.lastLog.ts));
			[this.lastLog] = logs;	// save the last log for next time :)

			const newDetectionsPromise = [];
			newLogs.forEach((log) => {
				newDetectionsPromise.push(this.detect(log));
			});
			const newDetectionsRaw = await Promise.all(newDetectionsPromise);
			const newDetections = newDetectionsRaw.filter((detection) => detection);
			newDetections.forEach((detection) => this.detections.push(detection));

			let lastAttack;
			if (newDetections[0]) {
				lastAttack = newDetections[0].log.event.replace(/attack: /gi, '').replace(/ from remote/gi, '');
				if (newDetections[0].intel) {
					lastAttack = `${newDetections[0].intel.Country}.${lastAttack}`;
				}
			}

			// update the capabilities
			this.setCapability('alarm_cyber', (newDetections.length > 0));
			this.setCapability('attack_rate', this.detections.length);
			if (lastAttack) this.setCapability('last_attack', lastAttack);
			if (logs[0]) this.setCapability('last_log', logs[0].event);

		} catch (error) { this.error(error); }
	}

	registerFlowCards() {
		this.attackTrigger = new Homey.FlowCardTriggerDevice('attack')
			.register();
	}

}

module.exports = LogAnalyzerDevice;

/*

{
	log: {
		string: '[DoS Attack: Ascend Kill] from source: 213.75.63.78, port 53, Friday, October 18, 2019 09:28:31',
		event: 'DoS Attack: Ascend Kill',
		info: 'from source: 213.75.63.78',
		ts: 1571383711000 },
	intel: {
		status: 'success',
		result: '0.97993123531342',
		queryIP: '213.75.63.78',
		queryFlags: 'f',
		queryOFlags: 'bc',
		queryFormat: 'json',
		contact: 'real@email.com',
		BadIP: 0,
		Country: 'NL',
		ts: 1571387332652},
	homeyTs: 1571387332789
}

[
	{ string: '[DHCP IP: 10.0.0.70] to MAC address b0:f1:ec:4c:b6:09, Wednesday, October 09, 2019 11:00:59',
	event: 'DHCP IP: 10.0.0.70',
	info: 'to MAC address b0:f1:ec:4c:b6:09',
	ts: '2019-01-01T10:00:59.000Z' },

]

*/
