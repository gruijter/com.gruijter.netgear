/*
Copyright 2017 - 2021, Robin de Gruijter (gruijter@hotmail.com)

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
// const util = require('util');

const iconArray = ['access_point', 'camera', 'default', 'desktop', 'game_console', 'laptop', 'media_player', 'multifunctional', 'nas',
	'phone_man', 'phone_location', 'phone_person', 'phone_woman', 'router', 'smart_power', 'smart_tv', 'smartphone', 'switch', 'tablet', 'voip'];

const iconTable = {
	1: 'tablet', // Amazon Kindle
	2: 'smartphone', // Android Device
	3: 'smartphone', // Android Phone
	4: 'tablet', // Android Tablet
	5: 'access_point', // Apple Airport Express
	6: 'media_player', // Blu-ray Player
	7: 'router', // Bridge
	8: 'media_player', // Cable STB
	9: 'camera', // Camera
	10: 'router', // Router
	11: 'media_player', // DVR
	12: 'game_console', // Gaming Console
	13: 'desktop', // iMac
	14: 'tablet', // iPad
	15: 'tablet', // iPad Mini
	16: 'smartphone', // iPhone 5/5S/5C
	17: 'smartphone', // iPhone
	18: 'smartphone', // iPod Touch
	19: 'laptop', // Linux PC
	20: 'desktop', // Mac Mini
	21: 'desktop', // Mac Pro
	22: 'laptop', // MacBook
	23: 'media_player', // Media Device
	24: 'default', // Network Device
	25: 'media_player', // Other STB
	26: 'smart_power', // Powerline
	27: 'multifunctional', // Printer
	28: 'access_point', // Repeater
	29: 'media_player', // Satellite STB
	30: 'multifunctional', // Scanner
	31: 'media_player', // SlingBox
	32: 'smartphone', // Smart Phone
	33: 'nas', // Storage (NAS)
	34: 'switch', // Switch
	35: 'smart_tv', // TV
	36: 'tablet', // Tablet
	37: 'desktop', // UNIX PC
	38: 'laptop', // Windows PC
	39: 'laptop', // Surface
	40: 'access_point', // Wifi Extender
	41: 'media_player', // Apple TV
	42: 'media_player', // AV Receiver
	43: 'media_player', // Chromecast
	44: 'smartphone', // Google Nexus 5
	45: 'smartphone', // Google Nexus 7
	46: 'smartphone', // Google Nexus 10
	47: 'default', // Other (DEFAULT)
	48: 'default', // WN1000RP
	49: 'default', // WN2500RP
	50: 'voip', // VoIP
	51: 'smartphone', // iPhone 6/6S
};

class AttachedDeviceDriver extends Homey.Driver {

	async onInit() {
		return;
		this.log('AttachedDeviceDriver onInit');
		// Homey
		// 	.on('listUpdate', (info) => {
		// 		// console.log(util.inspect(knownDevices, true, 4, true));
		// 		this.updateDevices(JSON.parse(info));
		// 	});
	}

	updateDevices(info) {
		const { knownDevices } = info;
		const { routerID } = info;
		Object.keys(knownDevices).forEach((key) => {
			const device = this.getDevice({ id: key });
			if (device instanceof Homey.Device) {
				const attachedRouter = device.getSettings().router_id;
				if (attachedRouter === 'unknown' || attachedRouter === routerID) device.updateInfo(knownDevices[key]);
			}
		});
	}

	onPair(socket) {
		socket.on('list_devices', async (data, callback) => {
			// console.log('list devices');
			try {
				const netgearDriver = Homey.ManagerDrivers.getDriver('netgear');
				await netgearDriver.ready(() => null);
				const routers = await netgearDriver.getDevices();
				const router = routers ? routers[0] : null;
				if (!router || !router.knownDevices) { throw Error('Cannot find router device in Homey. Router needs to be added first!'); }
				const devices = [];
				const { knownDevices } = router;
				Object.keys(knownDevices).forEach((attachedDevice) => {
					const icon = iconTable[knownDevices[attachedDevice].DeviceType] || 'default';
					const device = {
						name: `${knownDevices[attachedDevice].Name} - ${knownDevices[attachedDevice].MAC}`,
						icon: `../assets/${icon}.svg`,	// change the icon?
						data: {
							id: knownDevices[attachedDevice].MAC,
							// icon_name: deviceType,
						},
						settings: {
							mac: knownDevices[attachedDevice].MAC,
							router_model: router.getSettings().model_name,
							router_id: router.getData().id,
							offline_after: 180,	// seconds
							use_link_info: true,	// wifi link speed and signal strength
							use_bandwidth_info: true,	// up/down speed
							report_power: true,	// linked to onoff capability
							// energy_value_on: 3,
							// energy_value_off: 0,
							// energy_value_constant: 1,
						},
						capabilities: ['onoff', 'device_connected', 'ssid', 'link_speed', 'signal_strength', 'download_speed', 'upload_speed'],
						// energy: {
						// 	approximation: {
						// 		usageOn: 3,
						// 		usageOff: 0,
						// 	},
						// },
						lastSeen: knownDevices[attachedDevice].lastSeen,
					};
					devices.push(device);
				});

				// present last seen first
				devices.sort((a, b) => Date.parse(b.lastSeen) - Date.parse(a.lastSeen));
				callback(null, devices);
			} catch (error) {
				this.error(error);
				callback(error, null);
			}
		});

		socket.on('get_icons', (data, callback) => {
			callback(null, JSON.stringify(iconArray));
		});

		// socket.on('showView', (viewId, callback) => {
		// 	console.log('View: ' + viewId);
		// 	callback();
		// });

		// socket.on('add_device', (data) => {
		// 	console.log(data);
		// });
	}

}

module.exports = AttachedDeviceDriver;

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

/*
device types:

<select id="icon_tag" onchange="select_icon(); //
	1 //Amazon Kindle
	2 //Android Device
	3 //Android Phone
	4 //Android Tablet
	5 //Apple Airport Express
	6 //Blu-ray Player
	7 //Bridge
	8 //Cable STB
	9 //Camera
	10 //Router
	11 //DVR
	12 //Gaming Console
	13 //iMac
	14 //iPad
	15 //iPad Mini
	16 //iPhone 5/5S/5C
	17 //iPhone
	18 //iPod Touch
	19 //Linux PC
	20 //Mac Mini
	21 //Mac Pro
	22 //MacBook
	23 //Media Device
	24 //Network Device
	25 //Other STB
	26 //Powerline
	27 //Printer
	28 //Repeater
	29 //Satellite STB
	30 //Scanner
	31 //SlingBox
	32 //Smart Phone
	33 //Storage (NAS)
	34 //Switch
	35 //TV
	36 //Tablet
	37 //UNIX PC
	38 //Windows PC
	39 //Surface
	40 //Wifi Extender
	41 //Apple TV
	42 //AV Receiver
	43 //Chromecast
	44 //Google Nexus 5
	45 //Google Nexus 7
	46 //Google Nexus 10
	47" selected=" //Other
	48 //WN1000RP
	49 //WN2500RP
	50 //VoIP
	51 //iPhone 6/6S
</select>
*/
