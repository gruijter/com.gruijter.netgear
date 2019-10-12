/* eslint-disable no-unused-vars */
/* eslint-disable no-undef */

Homey.setTitle(__('pair.select_options.title'));

let icons = [];
let device = {};

// get device to be paired
async function getDevice() {
	return new Promise((resolve, reject) => {
		try {
			Homey.getViewStoreValue('devices', (err, array) => {
				if (err) throw err;
				resolve(array[0]);
			});
		} catch (error) {
			reject(error);
		}
	});
}

// get icon list
async function getIcons() {
	return new Promise((resolve, reject) => {
		try {
			Homey.emit('get_icons', null, (err, result) => {
				if (err) throw err;
				resolve(JSON.parse(result));
			});
		} catch (error) {
			reject(error);
		}
	});
}

// function to populate the icon dropdown list
function fillDropdown(iconArray) {
	try {
		// first empty the dropdownlist
		const dropDown = document.getElementById('iconSelection');
		while (dropDown.length > 0) {
			dropDown.remove(dropDown.length - 1);
		}
		// now fill the dropdown list and add an empty item in the dropdown list
		iconArray.forEach((icon) => {
			const iconOption = document.createElement('option');
			iconOption.text = icon;
			iconOption.value = icon;
			dropDown.add(iconOption);
		});
		return Promise.resolve(true);
	} catch (error) {
		return Promise.reject(error);
	}
}

$(document).ready(async () => {
	try {
		// console.log('doc is ready');
		icons = await getIcons();
		device = await getDevice();
		fillDropdown(icons);
		$('#name').val(device.name);
		$('#iconSelection').val(device.icon.replace('../assets/', '').replace('.svg', ''));
		$('img[id=icon]').attr('src', device.icon);
		// $('#report_power').prop('checked', false);
		// change icon on select
		$('#iconSelection').change(() => {
			$('img[id=icon]').attr('src', `../assets/${$('#iconSelection').val()}.svg`);
		});

	} catch (error) {
		Homey.alert(err.message, 'error');
	}
});


async function save() {
	if (!device.data) {
		Homey.alert('No device loaded', 'error');
		return;
	}
	const dev = device;
	dev.name = $('#name').val();
	dev.icon = `../assets/${$('#iconSelection').val()}.svg`;
	dev.settings.use_link_info = $('#use_link_info').prop('checked');
	dev.settings.use_bandwidth_info = $('#use_bandwidth_info').prop('checked');
	dev.settings.report_power = $('#report_power').prop('checked');
	dev.capabilities = ['device_connected', 'SSID'];
	if (dev.settings.use_link_info) {
		dev.capabilities.push('link_speed', 'signal_strength');
	}
	if (dev.settings.use_bandwidth_info) {
		dev.capabilities.push('download_speed', 'upload_speed');
	}
	if (dev.settings.report_power) {
		dev.capabilities.push('onoff');
	}
	Homey.createDevice(dev, (err) => {
		if (err) Homey.alert(err, 'error');
		// Homey.emit('add_device', dev);
		return Homey.nextView();
	});

}
