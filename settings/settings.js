/* eslint-disable no-unused-vars */
/* eslint-disable no-undef */

/*
Copyright 2017 - 2026, Robin de Gruijter (gruijter@hotmail.com)

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

function errMsg(err) {
  return (err && err.message) || String(err);
}

function copyToClipboard(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).catch(() => {});
  }
}

// tab 2: logs

function displayLogs(lines) {
  document.getElementById('loglines').textContent = lines;
}

function updateLogs() {
  displayLogs('');
  const showLogs = document.getElementById('show_logs').checked;
  const showErrors = document.getElementById('show_errors').checked;
  Homey.api('GET', 'getlogs/', null, (err, result) => {
    if (err) {
      displayLogs(errMsg(err));
      return;
    }
    const lines = result
      .slice()
      .reverse()
      .filter((line) => (showLogs || !line.includes('[log]')) && (showErrors || !line.includes('[err]')))
      .map((line) => line
        .replace(' [ManagerDrivers]', '')
        .replace(/\[Device:(.*?)\]/, '[dev]')
        .replace(/\[Driver:(.*?)\]/, '[$1]')
        .replace(' [log] ', '')
        .replace(' [App] ', '')
        .replace(' [attached_device]', ''));
    displayLogs(lines.join('\n'));
  });
}

function deleteLogs() {
  Homey.confirm(Homey.__('settings.tab2.deleteWarning'), (err, result) => {
    if (err || !result) return;
    Homey.api('GET', 'deletelogs/', null, (deleteErr) => {
      if (deleteErr) {
        Homey.alert(errMsg(deleteErr));
        return;
      }
      Homey.alert(Homey.__('settings.tab2.deleted'));
      updateLogs();
    });
  });
}

// tab 3: compatibility test

function discover() {
  document.getElementById('host').disabled = true;
  document.getElementById('soapPort').disabled = true;
  document.getElementById('discover').disabled = true;
  Homey.api('GET', 'discover/', (err, result) => {
    document.getElementById('host').disabled = false;
    document.getElementById('soapPort').disabled = false;
    document.getElementById('discover').disabled = false;
    if (err) {
      Homey.alert(errMsg(err));
      return;
    }
    document.getElementById('host').value = result.host;
    document.getElementById('soapPort').value = result.port;
  });
}

function runTest() {
  document.getElementById('copyResult').disabled = true;
  document.getElementById('runTest').disabled = true;
  document.getElementById('discover').disabled = true;
  const password = document.getElementById('password').value;
  const host = document.getElementById('host').value;
  const port = document.getElementById('soapPort').value;
  document.getElementById('testResult').value = Homey.__('settings.tab3.testingNow');
  Homey.api('GET', `runtest/?password=${encodeURIComponent(password)}&host=${encodeURIComponent(host)}&port=${encodeURIComponent(port)}`, (err) => {
    if (err) {
      document.getElementById('copyResult').disabled = false;
      document.getElementById('runTest').disabled = false;
      document.getElementById('discover').disabled = false;
      Homey.alert(errMsg(err));
    }
  });
}

function copyResult() {
  copyToClipboard(document.getElementById('testResult').value);
  Homey.openURL('https://github.com/gruijter/com.gruijter.netgear/issues/new');
}

function displayTestResult(lines) {
  document.getElementById('testResult').value = lines;
}

// tab 4: known devices list

function getList() {
  Homey.api('GET', 'getkd/', (err, result) => {
    if (err) {
      Homey.alert(errMsg(err));
      return;
    }
    document.getElementById('resultList').value = JSON.stringify(result);
  });
}

function copyList() {
  copyToClipboard(document.getElementById('resultList').value);
}

// generic tab handling

function showTab(tab) {
  if (tab === 2) updateLogs();
  if (tab === 4) getList();
  for (let i = 1; i <= 4; i += 1) {
    document.getElementById(`tabb${i}`).className = tab === i ? 'homey-button-primary' : 'homey-button-secondary';
    document.getElementById(`tab${i}`).style.display = tab === i ? '' : 'none';
  }
}

function addListeners() {
  Homey.on('test_results', (result) => {
    const lines = Array.isArray(result)
      ? result.map((line) => JSON.stringify(line)).join('\n')
      : errMsg(result);
    displayTestResult(lines);
    document.getElementById('copyResult').disabled = false;
    document.getElementById('runTest').disabled = false;
    document.getElementById('discover').disabled = false;
  });
}

function onHomeyReady(homeyReady) {
  Homey = homeyReady;
  addListeners();
  document.getElementById('password').addEventListener('input', (event) => {
    document.getElementById('runTest').disabled = event.target.value === '';
  });
  showTab(1);
  Homey.ready();
}
