/* eslint-disable prefer-destructuring */
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

const Homey = require('homey');
const NetgearRouter = require('netgear');
const attachRouterLogging = require('../../lib/attachRouterLogging');
const tlsForPort = require('../../lib/tlsForPort');

const deviceModes = ['Router', 'Access Point', 'Bridge', '3: Unknown', '4: Unknown'];

const capabilities = ['alarm_generic', 'meter_attached_devices', 'meter_download_speed',
  'meter_upload_speed', 'meter_cpu_utilization', 'meter_mem_utilization'];

// device settings hold the router admin password, and captureLogs mirrors every log line
// into the diagnostics report users post publicly. Log only the connection fields a repair
// can actually change - never the whole settings object
const connectionFields = (settings) => ({
  host: settings.host,
  port: settings.port,
  username: settings.username,
  tls: settings.tls,
});

class NetgearDriver extends Homey.Driver {

  onInit() {
    this.log('NetgearDriver onInit');
    this.capabilities = capabilities;
    this.deviceModes = deviceModes;
  }

  onUninit() {
    this.log('NetgearDriver onUninit');
  }

  // shared by pair (check) and repair: connect to a router and read its identity.
  // autodiscovers host/port only when the frontend left them blank.
  async connectRouter(router, data) {
    let { host, port, tls } = data;
    if (!port || !host || host === '') {
      const discovered = await router.discover();
      host = host || discovered.host;
      port = port || discovered.port;
      tls = discovered.tls;
    }
    await router.login({
      password: data.password, username: data.username, host, port, tls,
    });
    const info = await router.getInfo();
    if (!Object.prototype.hasOwnProperty.call(info, 'SerialNumber')) throw Error(this.homey.__('errors.noSerial'));
    return info;
  }

  async onPair(session) {
    let device;
    const router = new NetgearRouter({ logLevel: 'error' });
    attachRouterLogging(router, this);
    session.setHandler('discover', async () => {
      try {
        this.log('discovery started from frontend');
        const discover = await router.discover({ family: 4 });
        this.log(discover);
        return JSON.stringify(discover); // report success to frontend
      } catch (error) {
        this.log(error);
        throw Error(this.homey.__('errors.discoveryFailed'));
      }
    });
    session.setHandler('check', async (data) => {
      try {
        this.log('Checking router settings from frontend');
        const info = await this.connectRouter(router, data);
        let knownRouter;
        try {
          knownRouter = this.getDevice({ id: info.SerialNumber });
        } catch (error) {
          knownRouter = false;
        }
        if (knownRouter) throw Error('This router is already paired in Homey');
        device = {
          name: info.ModelName || info.DeviceName || 'Netgear',
          data: { id: info.SerialNumber },
          settings: {
            username: router.username,
            password: router.password,
            host: router.host,
            port: Number(router.port),
            tls: !!router.tls,
            model_name: info.ModelName || info.DeviceName || 'Netgear',
            serial_number: info.SerialNumber,
            firmware_version: info.Firmwareversion,
            device_mode: deviceModes[Number(info.DeviceMode)],
            internet_connection_check: 'homey', // 'netgear'
            use_traffic_info: false, // up/down speed
            use_system_info: false, // cpu/mem load
            use_firmware_check: false,
            polling_interval: 60,
            offline_after: 500,
            attached_devices_method: '0', // auto
            clear_known_devices: false,
          },
          class: 'sensor',
          // `tls` is set explicitly here, so this device must never be re-derived from the port
          store: { tlsMigrated: true },
          capabilities,
          energy: {
            approximation: {
              usageConstant: 8,
            },
          },
        };
        await session.showView('select_options');
        return device;
      } catch (error) {
        this.error('Pair error:', error.message);
        throw error;
      }
    });
    session.setHandler('save_options', async (options) => {
      try {
        if (!device || !device.settings) throw Error('Device info went missing.');
        const dev = { ...device };
        dev.settings = { ...dev.settings, ...options };
        dev.capabilities = capabilities.filter((cap) => {
          let include = true;
          if (!options.use_traffic_info && cap.includes('speed')) include = false;
          if (!options.use_system_info && cap.includes('utilization')) include = false;
          return include;
        });
        this.log('saving new router from frontend');
        return dev;
      } catch (error) {
        this.log(error);
        throw Error(this.homey.__('errors.discoveryFailed'));
      }
    });
  }

  // repair lets the user fix connection settings (host/port/tls/credentials) of an
  // already paired router - e.g. after the router's IP or SOAP port changed - without
  // losing the device, its flows or its known-devices list.
  async onRepair(session, device) {
    this.log('Repairing of device started', device.getName());
    const router = new NetgearRouter({ logLevel: 'error' });
    attachRouterLogging(router, this);

    // prefill the form with the device's current settings
    session.setHandler('get_settings', async () => {
      const settings = device.getSettings();
      return {
        host: settings.host,
        port: settings.port,
        username: settings.username,
        // fall back to the port-derived guess for devices paired before `tls` was stored
        tls: settings.tls === undefined ? tlsForPort(settings.port) : settings.tls,
      };
    });

    session.setHandler('discover', async () => {
      try {
        this.log('discovery started from repair frontend');
        const discover = await router.discover({ family: 4 });
        this.log(discover);
        return JSON.stringify(discover);
      } catch (error) {
        this.log(error);
        throw Error(this.homey.__('errors.discoveryFailed'));
      }
    });

    session.setHandler('check', async (data) => {
      this.log('Checking new router settings from repair frontend');
      const info = await this.connectRouter(router, data);
      // guard against repairing a device onto a different physical router
      if (info.SerialNumber !== device.getData().id) throw Error(this.homey.__('errors.differentRouter'));
      const newSettings = {
        username: router.username,
        password: router.password,
        host: router.host,
        port: Number(router.port),
        tls: !!router.tls,
        model_name: info.ModelName || info.DeviceName || 'Netgear',
        serial_number: info.SerialNumber,
        firmware_version: info.Firmwareversion,
        device_mode: deviceModes[Number(info.DeviceMode)],
      };
      this.log('old settings:', connectionFields(device.getSettings()));
      await device.setSettings(newSettings);
      // the user just chose tls explicitly - don't let the port-derived migration override it
      await device.setStoreValue('tlsMigrated', true);
      this.log('new settings:', connectionFields(device.getSettings()));
      await device.unsetWarning().catch(() => null);
      device.restartDevice(2000);
      return true;
    });

    session.setHandler('disconnect', () => {
      router.removeAllListeners();
      this.log('Repairing of device ended', device.getName());
    });
  }

}

module.exports = NetgearDriver;
