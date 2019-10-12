/* eslint-disable no-undef */
/* eslint-disable no-unused-vars */
function discover() {
	Homey.emit('discover', {}, (error, result) => {
		if (error) {
			Homey.alert(error.message, 'error');
		} else {
			const info = JSON.parse(result);
			$('#host').val(info.host);
			$('#soapPort').val(info.port);
		}
	});
}

function save() {
	try {
		const username = 'admin'; // document.getElementById( 'username' ).value;
		const password = $('#password').val();
		const host = $('#host').val();
		const port = $('#soapPort').val();
		if (password === '') return Homey.alert(__('pair.start.required'), 'error');
		const settings = {
			username,
			password,
			host,
			port: Number(port) || 0,
		};
		// Continue to back-end, pass along data
		Homey.emit('save', settings, (error, device) => {
			if (error) return Homey.alert(error, 'error');
			Homey.alert(`${__('pair.start.success')}
				\r\nModel: ${device.settings.model_name}
				\r\nSN: ${device.settings.serial_number}
				\r\nMode: ${device.settings.device_mode}`, 'info');
			Homey.createDevice(device, (err) => {
				if (err) return Homey.alert(err, 'error');
				// Homey.emit('add_device', dev);
				return Homey.nextView();
			});
			return null;
		});
		return null;
	} catch (error) { return Homey.alert(error, 'error'); }
}

function onHomeyReady(homeyReady) {
	Homey = homeyReady;
	Homey.setTitle(__('pair.start.title'));
	Homey.ready();
}
