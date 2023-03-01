/* eslint-disable prefer-destructuring */
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

const deviceModes = ['Router', 'Access Point', 'Bridge', '3: Unknown', '4: Unknown'];

const capabilities = ['alarm_generic', 'meter_attached_devices', 'meter_download_speed',
	'meter_upload_speed', 'meter_cpu_utilization', 'meter_mem_utilization'];

class NetgearDriver extends Homey.Driver {

	onInit() {
		this.log('NetgearDriver onInit');
		this.capabilities = capabilities;
		this.deviceModes = deviceModes;
	}

	async onPair(session) {
		const router = new NetgearRouter();
		session.setHandler('discover', async () => {
			try {
				this.log('discovery started from frontend');
				const discover = await router.discover();
				this.log(discover);
				return Promise.resolve(JSON.stringify(discover)); // report success to frontend
			}	catch (error) {
				this.log(error);
				return Promise.reject(Error('Autodiscovery failed. Manual entry required.'));
			}
		});
		session.setHandler('check', async (data) => {
			try {
				this.log('Checking router settings from frontend');
				const password = data.password;
				const username = data.username;
				let host = data.host;
				let port = data.port;
				let discover = {};
				if (!port || !host || host === '') {
					discover = await router.discover();
					port = port || discover.port;
					host = host || discover.host;
				}
				// try to login
				const options = {
					password,
					username,
					host,
					port,
					tls: port === 443 || port === 5555,
				};
				await router.login(options);
				const info = await router.getInfo();
				if (!Object.prototype.hasOwnProperty.call(info, 'SerialNumber')) throw Error('No SerialNumber found');
				const device = {
					name: info.ModelName || info.DeviceName || 'Netgear',
					data: { id: info.SerialNumber },
					settings: {
						username: router.username,
						password: router.password,
						host: router.host,
						port: router.port,
						model_name: info.ModelName || info.DeviceName || 'Netgear',
						serial_number: info.SerialNumber,
						firmware_version: info.Firmwareversion,
						device_mode: deviceModes[Number(info.DeviceMode)],
						internet_connection_check: 'homey',	// 'netgear'
						use_traffic_info: false,	// up/down speed
						use_system_info: false, // cpu/mem load
						use_firmware_check: false,
						polling_interval: 60,
						offline_after: 500,
						attached_devices_method: '0', // auto
						clear_known_devices: false,
					},
					class: 'sensor',
					capabilities,
					energy: {
						approximation: {
							usageConstant: 8,
						},
					},
				};
				return Promise.resolve(device);
			}	catch (error) {
				this.error('Pair error:', error.message);
				return Promise.reject(error);
			}
		});
	}

}

module.exports = NetgearDriver;
