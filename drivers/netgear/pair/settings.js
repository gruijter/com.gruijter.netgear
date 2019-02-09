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
	const username = 'admin'; // document.getElementById( 'username' ).value;
	const password = $('#password').val();
	const host = $('#host').val();
	const port = $('#soapPort').val();
	if (password !== '') {
		const settings = {
			username,
			password,
			host,
			port: Number(port) || 0,
		};
		// Continue to back-end, pass along data
		Homey.emit('save', settings, (error, result) => {
			if (error) {
				Homey.alert(error.message, 'error');
			} else {
				const info = JSON.parse(result);
				settings.model_name = info.ModelName || info.DeviceName || 'Netgear';
				settings.serial_number = info.SerialNumber;
				settings.firmware_version = info.Firmwareversion;
				settings.smart_agent_version = info.SmartAgentversion;
				settings.host = info.host;
				settings.port = info.port;
				Homey.alert(`${__('pair.start.success')}\r\nModel: ${settings.model_name}\r\nSN: ${settings.serial_number}`, 'info');
				const device = {
					name: settings.model_name,
					data: { id: settings.serial_number },
					settings,
				};
				Homey.addDevice(device, (err, res) => {
					if (err) {	Homey.alert(err, 'error'); return; }
					Homey.done();
				});
			}
		});
	} else {
		Homey.alert(__('pair.start.required'), 'error');
	}
}

function onHomeyReady(homeyReady) {
	Homey = homeyReady;
	Homey.setTitle(__('pair.start.title'));
	Homey.ready();
}
