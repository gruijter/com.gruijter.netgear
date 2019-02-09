/* eslint-disable no-unused-vars */
/* eslint-disable no-undef */
function displayLogs(lines) {
	$('#loglines').html(lines);
}

function displayTestResult(lines) {
	$('#testResult').html(lines);
}

function updateLogs() {
	try {
		Homey.api('GET', 'getlogs/', null, (err, result) => {
			if (!err) {
				let lines = '';
				for (let i = (result.length - 1); i >= 0; i -= 1) {
					lines += `${result[i]}<br />`;
				}
				displayLogs(lines);
			} else {
				displayLogs(err);
			}
		});
	} catch (e) {
		displayLogs(e);
	}
}

function deleteLogs() {
	Homey.confirm(Homey.__('settings.tab2.deleteWarning'), 'warning', (error, result) => {
		if (result) {
			Homey.api('GET', 'deletelogs/', null, (err) => {
				if (err) {
					Homey.alert(err.message, 'error'); // [, String icon], Function callback )
				} else {
					Homey.alert(Homey.__('settings.tab2.deleted'), 'info');
					updateLogs();
				}
			});
		}
	});
}

function showTab(tab) {
	$('#copyResult').prop('disabled', true);
	$('#testResult').prop('disabled', true);
	$('#runTest').prop('disabled', $('#password').val() === '' ? true : false);
	$('#password').keyup(() => {
		$('#runTest').prop('disabled', this.value === '' ? true : false);
	});
	$('.tab').removeClass('tab-active');
	$('.tab').addClass('tab-inactive');
	$(`#tabb${tab}`).removeClass('tab-inactive');
	$(`#tabb${tab}`).addClass('active');
	$('.panel').hide();
	$(`#tab${tab}`).show();
	updateLogs();
}

function discover() {
	$('#host').prop('disabled', true);
	$('#soapPort').prop('disabled', true);
	$('#discover').prop('disabled', true);
	$('#testResult').html('Trying to discover the router now. Hang on........');
	Homey.api('GET', 'discover/', (err, result) => {
		$('#host').prop('disabled', false);
		$('#soapPort').prop('disabled', false);
		$('#discover').prop('disabled', false);
		$('#testResult').html(JSON.stringify(result).replace(/"/g, ''));
		if (err) {
			$('#host').prop('disabled', false);
			$('#soapPort').prop('disabled', false);
			$('#discover').prop('disabled', false);
			$('#testResult').html('');
			return Homey.alert(JSON.stringify(err), 'error'); // [, String icon], Function callback )
		}
		$('#host').val(result.host);
		$('#soapPort').val(result.port);
		return true;
	});
}

function runTest() {
	$('#copyResult').prop('disabled', true);
	$('#runTest').prop('disabled', true);
	$('#discover').prop('disabled', true);
	const password = $('#password').val();
	const host = $('#host').val();
	const port = $('#soapPort').val();
	$('#testResult').html('Testing now. Hang on........');
	Homey.api('POST', 'runtest/', { password, host, port }, (err, result) => {
		if (err) {
			$('#copyResult').prop('disabled', false);
			$('#runTest').prop('disabled', false);
			$('#discover').prop('disabled', false);
			return Homey.alert(err.message, 'error'); // [, String icon], Function callback )
		}
		let lines = '';
		for (let i = 0; i < (result.length); i += 1) {
			lines += `${JSON.stringify(result[i]).replace(/"/g, '')}\n`;
		}
		displayTestResult(lines);
		$('#copyResult').prop('disabled', false);
		$('#runTest').prop('disabled', false);
		$('#discover').prop('disabled', false);
		return true;
	});
}

function copyResult() {
	$('#testResult').prop('disabled', false);
	const copyText = document.querySelector('#testResult');
	copyText.select();
	document.execCommand('copy');
	Homey.openURL('https://github.com/gruijter/com.gruijter.netgear/issues/new');
	$('#testResult').prop('disabled', true);
}

function onHomeyReady(homeyReady) {
	Homey = homeyReady;
	showTab(1);
	Homey.ready();
}
