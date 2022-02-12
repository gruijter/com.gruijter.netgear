/* eslint-disable no-unused-vars */
/* eslint-disable no-undef */
function displayLogs(lines) {
	$('#loglines').html(lines);
}

function displayTestResult(lines) {
	$('#testResult').text(lines);
}

function getList() {
	Homey.api('GET', 'getkd/', (err, result) => {
		if (err) {
			return Homey.alert(err.message, 'error'); // [, String icon], Function callback )
		}
		$('#resultList').html(JSON.stringify(result)); // .replace(/"/g, ''));
		return true;
	});
}

function updateLogs() {
	try {
		displayLogs('');
		const showLogs = $('#show_logs').prop('checked');
		const showErrors = $('#show_errors').prop('checked');
		Homey.api('GET', 'getlogs/', null, (err, result) => {
			if (!err) {
				let lines = '';
				result
					.reverse()
					.forEach((line) => {
						if (!showLogs) {
							if (line.includes('[log]')) return;
						}
						if (!showErrors) {
							if (line.includes('[err]')) return;
						}
						const logLine = line
							.replace(' [ManagerDrivers]', '')
							.replace(/\[Device:(.*?)\]/, '[dev]')
							.replace(/\[Driver:(.*?)\]/, '[$1]')
							.replace(' [log] ', '')
							.replace(' [App] ', '')
							.replace(' [attached_device]', '');
						lines += `${logLine}<br />`;
					});
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
	if (tab === 2) { updateLogs(); }
	if (tab === 4) { getList(); }
	$('#copyResult').prop('disabled', true);
	$('#testResult').prop('disabled', true);
	$('#runTest').prop('disabled', $('#password').val() === '');
	$('#password').keyup(() => {
		$('#runTest').prop('disabled', this.value === '');
	});
	$('#resultList').prop('disabled', true);
	$('.tab').removeClass('tab-active');
	$('.tab').addClass('tab-inactive');
	$(`#tabb${tab}`).removeClass('tab-inactive');
	$(`#tabb${tab}`).addClass('active');
	$('.panel').hide();
	$(`#tab${tab}`).show();
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
	$('#testResult').html('Testing now. Hang on for three minutes........');
	Homey.api('POST', 'runtest/', { password, host, port }, (err, result) => {
		if (err) {
			$('#copyResult').prop('disabled', false);
			$('#runTest').prop('disabled', false);
			$('#discover').prop('disabled', false);
			return Homey.alert(err.message, 'error'); // [, String icon], Function callback )
		}
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

function copyList() {
	$('#resultList').prop('disabled', false);
	const copyText = document.querySelector('#resultList');
	copyText.select();
	document.execCommand('copy');
	$('#resultList').prop('disabled', true);
}

function addListeners() {
	Homey.on('test_results', (result) => {
		let lines = '';
		for (let i = 0; i < (result.length); i += 1) {
			lines += `${JSON.stringify(result[i]).replace(/"/g, '')}\n`;
		}
		displayTestResult(lines);
		$('#copyResult').prop('disabled', false);
		$('#runTest').prop('disabled', false);
		$('#discover').prop('disabled', false);
	});
}

function onHomeyReady(homeyReady) {
	Homey = homeyReady;
	addListeners();
	showTab(1);
	Homey.ready();
}
