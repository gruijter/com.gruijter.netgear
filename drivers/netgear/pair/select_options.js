/* eslint-disable no-undef */
/* eslint-disable no-unused-vars */

let device = {};

// get device to be paired
async function getSettings() {
	return new Promise((resolve, reject) => {
		try {
			Homey.getViewStoreValue('settings', (err, settings) => {
				if (err) throw err;
				resolve(settings);
			});
		} catch (error) {
			reject(error);
		}
	});
}

$(document).ready(async () => {
	// console.log('doc is ready');
	Homey.showLoadingOverlay();
	const settings = await getSettings();
	// Check settings at back-end, pass along data
	Homey.emit('check', settings, (error, dev) => {
		if (error) {
			Homey.alert(error, 'error');
			Homey.done();
			return;
		}
		Homey.hideLoadingOverlay();
		device = dev;
		$('#name').val(dev.name);
	});
});

async function save() {
	if (!device.data) {
		Homey.alert('No device loaded', 'error');
		return;
	}
	Homey.showLoadingOverlay();
	const dev = device;
	dev.name = $('#name').val();
	dev.settings.use_traffic_info = $('#use_traffic_info').prop('checked');
	dev.settings.use_system_info = $('#use_system_info').prop('checked');
	dev.settings.use_firmware_check = $('#use_firmware_check').prop('checked');
	dev.capabilities = ['alarm_generic', 'attached_devices'];
	if (dev.settings.use_traffic_info) {
		dev.capabilities.push('download_speed', 'upload_speed');
	}
	if (dev.settings.use_system_info) {
		dev.capabilities.push('cpu_utilization', 'mem_utilization');
	}
	Homey.createDevice(dev, (err) => {
		Homey.hideLoadingOverlay();
		if (err) return Homey.alert(err, 'error');
		// Homey.emit('add_device', dev);
		Homey.alert(`${__('pair.start.success')}\r\n
			Model: ${dev.settings.model_name}\r
			SN: ${dev.settings.serial_number}\r
			Mode: ${dev.settings.device_mode}\r\n
		${__('pair.select_options_router.ready')}`, 'info');
		return Homey.nextView();
	});
}
