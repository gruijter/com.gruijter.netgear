/* eslint-disable no-await-in-loop */
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
const util = require('util');
const dns = require('dns');
const attachRouterLogging = require('../../lib/attachRouterLogging');
const removeExtraCapabilities = require('../../lib/removeExtraCapabilities');
const settle = require('../../lib/settle');
const tlsForPort = require('../../lib/tlsForPort');

const dnsLookupPromise = util.promisify(dns.lookup);

const DEBUG_WINDOW = 5 * 60 * 1000; // max time the router session logs at 'debug' after a (re)start

class NetgearDevice extends Homey.Device {

  async login() {
    try {
      // login when loggedOut or session is almost 1hr old
      if (!this.routerSession.loggedIn || ((Date.now() - this.routerSession.lastLoginTm) > 59 * 60 * 1000)) {
        this.log('Logging in');
        const method = Number(this.settings.login_method);
        await this.routerSession.login({ method });
        this.routerSession.lastLoginTm = Date.now();
        this.log('Login successful');
      }
      this.setAvailable().catch(this.error);
      // only clear a warning we actually set - login() runs on every poll, so an
      // unconditional unsetWarning() is ~1440 no-op round-trips per router per day
      if (this.portWarningSet) {
        this.portWarningSet = false;
        this.unsetWarning().catch(() => null);
      }
      this.portChecked = false; // outage over - allow one probe again on the next failure
      return Promise.resolve(true);
    } catch (error) {
      // getCurrentSetting() probes the router and mutates the session's loginMethod/
      // soapVersion, so it must not overlap the next login() attempt: await it, and run
      // it only once per outage instead of on every failed poll
      if (!this.portChecked) {
        this.portChecked = true;
        await this.warnIfPortChanged().catch(() => null);
      }
      return Promise.reject(error);
    }
  }

  // drop the router session back to 'error' logging after the post-restart debug window
  endDebugWindow(reason) {
    this.homey.clearTimeout(this.debugTimer);
    if (!this.routerSession || this.routerSession.logLevel !== 'debug') return;
    this.routerSession.logLevel = 'error';
    this.log(`debug logging ended (${reason})`);
  }

  // on login failure, hint the user (device warning) if the router reports a different
  // SOAP port than the one stored in settings - detection stays a suggestion, never auto-applied
  async warnIfPortChanged() {
    const cs = await this.routerSession.getCurrentSetting().catch(() => null);
    if (cs && cs.port && Number(cs.port) !== Number(this.settings.port)) {
      this.portWarningSet = true;
      await this.setWarning(this.homey.__('warning.port', { port: cs.port })).catch(this.error);
    }
  }

  async wol(mac, password) {
    try {
      this.log(`WOL requested for device ${mac} ${this.knownDevices[mac].Name}`);
      if (!this.routerSession.loggedIn) {
        await this.routerSession.login();
      }
      await this.routerSession.wol(mac, password);
      return Promise.resolve(true);
    } catch (error) {
      return Promise.reject(error);
    }
  }

  async blockOrAllow(mac, action) {
    try {
      this.log(`${action} requested for device "${mac}"`);
      if (!this.routerSession.loggedIn) {
        await this.routerSession.login();
      }
      await this.routerSession.setBlockDevice(mac, action);
      return Promise.resolve(true);
    } catch (error) {
      return Promise.reject(error);
    }
  }

  async setGuestwifi(action) {
    try {
      this.log(`2.4GHz-1 guest wifi ${action} requested`);
      if (!this.routerSession.loggedIn) {
        await this.routerSession.login();
      }
      const onOff = (action === 'on');
      await this.routerSession.setGuestWifi(onOff);
      return Promise.resolve(true);
    } catch (error) {
      return Promise.reject(error);
    }
  }

  async setGuestwifi2(action) {
    try {
      this.log(`2.4GHz-2 guest wifi ${action} requested`);
      if (!this.routerSession.loggedIn) {
        await this.routerSession.login();
      }
      const onOff = (action === 'on');
      await this.routerSession.setGuestWifi(onOff); // there is actually no method yet to do 2.4Ghz-2
      return Promise.resolve(true);
    } catch (error) {
      return Promise.reject(error);
    }
  }

  async set5GGuestWifi(action) {
    try {
      this.log(`5GHz-1 guest wifi ${action} requested`);
      if (!this.routerSession.loggedIn) {
        await this.routerSession.login();
      }
      const onOff = (action === 'on');
      await this.routerSession.set5GGuestWifi(onOff);
      return Promise.resolve(true);
    } catch (error) {
      return Promise.reject(error);
    }
  }

  async set5GGuestWifi2(action) { // call with NetgearDevice as this
    try {
      this.log(`5GHz-2 guest wifi ${action} requested`);
      if (!this.routerSession.loggedIn) {
        await this.routerSession.login();
      }
      const onOff = (action === 'on');
      await this.routerSession.set5GGuestWifi2(onOff);
      return Promise.resolve(true);
    } catch (error) {
      return Promise.reject(error);
    }
  }

  async speedTest() { // call with NetgearDevice as this
    try {
      this.log('router speedtest requested');
      if (!this.routerSession.loggedIn) {
        await this.routerSession.login();
      }
      const speed = await this.routerSession.speedTest();
      return Promise.resolve(speed);
    } catch (error) {
      return Promise.reject(error);
    }
  }

  async updateNewFirmware() { // call with NetgearDevice as this
    try {
      this.log('router firmware update requested');
      if (!this.routerSession.loggedIn) {
        await this.routerSession.login();
      }
      await this.routerSession.updateNewFirmware();
      return Promise.resolve(true);
    } catch (error) {
      return Promise.reject(error);
    }
  }

  async reboot() { // call with NetgearDevice as this
    try {
      this.log('router reboot requested');
      if (!this.routerSession.loggedIn) {
        await this.routerSession.login();
      }
      await this.routerSession.reboot();
      return Promise.resolve(true);
    } catch (error) {
      return Promise.reject(error);
    }
  }

  async enableTrafficMeter(action) { // call with NetgearDevice as this
    const enableDisable = action ? 'enable' : 'disable';
    this.log(`Traffic meter ${enableDisable} requested`);
    if (!this.routerSession.loggedIn) {
      await this.routerSession.login();
    }
    await this.routerSession.enableTrafficMeter(action);
    return true;
  }

  async setBlockDeviceEnable(action) { // call with NetgearDevice as this
    try {
      const enableDisable = (action && 'enable') || 'disable';
      this.log(`Access control ${enableDisable} requested`);
      if (!this.routerSession.loggedIn) {
        await this.routerSession.login();
      }
      await this.routerSession.setBlockDeviceEnable(action);
      return Promise.resolve(true);
    } catch (error) {
      return Promise.reject(error);
    }
  }

  async setCapability(capability, value) {
    if (!this.hasCapability(capability) || value === undefined) return;
    // only update changed capabilities
    if (value === await this.getCapabilityValue(capability)) return;
    await this.setCapabilityValue(capability, value);
  }

  async updateSpeed() {
    try {
      if (!this.settings.use_traffic_info) return Promise.resolve(false);
      const lastTrafficMeter = this.readings.trafficMeter;
      this.readings.trafficMeter = await this.routerSession.getTrafficMeter()
        .catch((error) => {
          this.error('error getting traffic meter info:', error.message);
          return undefined;
        });
      if (!this.readings.trafficMeter) return Promise.resolve(false);
      this.readings.trafficMeter.pollTime = new Date();
      if (!lastTrafficMeter) return Promise.resolve(false); // there are no previous readings for trafficmeter
      // calculate speed
      const downloadSpeed = Math.round((100 * 1000 * 8
        * (this.readings.trafficMeter.newTodayDownload - lastTrafficMeter.newTodayDownload))
        / (this.readings.trafficMeter.pollTime - lastTrafficMeter.pollTime)) / 100;
      const uploadSpeed = Math.round((100 * 1000 * 8
        * (this.readings.trafficMeter.newTodayUpload - lastTrafficMeter.newTodayUpload))
        / (this.readings.trafficMeter.pollTime - lastTrafficMeter.pollTime)) / 100;
      // set capabilitie values and trigger flow card
      if (downloadSpeed >= 0 && uploadSpeed >= 0) { // disregard midnight measurements
        if ((this.getCapabilityValue('meter_download_speed') !== downloadSpeed)
          || (this.getCapabilityValue('meter_upload_speed') !== uploadSpeed)) {
          this.setCapability('meter_download_speed', downloadSpeed).catch(this.error);
          this.setCapability('meter_upload_speed', uploadSpeed).catch(this.error);
          const tokens = {
            upload_speed: uploadSpeed,
            download_speed: downloadSpeed,
          };
          this.homey.app.triggerSpeedChanged(this, tokens, {});
        }
      }
      return Promise.resolve(true);
    } catch (error) {
      return Promise.reject(error);
    }
  }

  async updateSystemInfo() {
    try {
      if (!this.settings.use_system_info) return Promise.resolve(false);
      this.readings.systemInfo = await this.routerSession.getSystemInfo()
        .catch((error) => {
          this.error('error getting system info:', error.message);
          return undefined;
        });
      if (!this.readings.systemInfo) return Promise.resolve(false);
      // set capabilitie values
      this.setCapability('meter_cpu_utilization', this.readings.systemInfo.NewCPUUtilization).catch(this.error);
      this.setCapability('meter_mem_utilization', this.readings.systemInfo.NewMemoryUtilization).catch(this.error);
      return Promise.resolve(true);
    } catch (error) {
      return Promise.reject(error);
    }
  }

  async updateFirmwareInfo() {
    if (!this.settings.use_firmware_check) return false;
    this.readings.info = await this.routerSession.getInfo()
      .catch((error) => {
        this.error('error getting router info:', error.message);
        return undefined;
      });
    this.readings.newFirmware = await this.routerSession.checkNewFirmware()
      .catch((error) => {
        this.error('error getting new firmware info:', error.message);
        return undefined;
      });
    this.readings.extraPollTime = Date.now();
    // check for new firmware_version and trigger flow
    const { newFirmware } = this.readings;
    if (newFirmware && newFirmware.newVersion && newFirmware.newVersion !== '') {
      if (this.lastNotifiedFirmwareVersion !== newFirmware.newVersion) {
        const tokens = {
          current_version: newFirmware.currentVersion,
          new_version: newFirmware.newVersion,
          release_note: newFirmware.releaseNote,
        };
        this.homey.app.triggerNewRouterFirmware(this, tokens, {});
        this.lastNotifiedFirmwareVersion = newFirmware.newVersion;
      }
    }
    // update settings info
    if (this.readings.info) {
      if (this.readings.info.Firmwareversion !== this.settings.firmware_version) {
        this.log('New router firmware installed: ', this.readings.info.Firmwareversion);
      }
      if (this.driver.deviceModes[Number(this.readings.info.DeviceMode)] !== this.settings.device_mode) {
        this.log('New device mode selected: ', this.driver.deviceModes[Number(this.readings.info.DeviceMode)]);
      }
      this.setSettings({
        model_name: this.readings.info.ModelName || this.readings.info.DeviceName || 'Netgear',
        serial_number: this.readings.info.SerialNumber,
        firmware_version: this.readings.info.Firmwareversion,
        device_mode: this.driver.deviceModes[Number(this.readings.info.DeviceMode)],
      }).catch(this.error);
    }
    return true;
  }

  async updateInternetConnectionState() {
    try {
      let internetConnectionStatus = true;
      if (this.settings.internet_connection_check === 'netgear') {
        this.readings.getEthernetLinkStatus = await this.routerSession.getEthernetLinkStatus()
          .catch((error) => {
            this.error('error getting new internet connection status:', error.message);
            return undefined;
          });
        if (!this.readings.getEthernetLinkStatus) return Promise.resolve(false);
        internetConnectionStatus = this.readings.getEthernetLinkStatus.toLowerCase() === 'up';
      } else {
        internetConnectionStatus = await dnsLookupPromise('www.google.com')
          .then(() => true)
          .catch(() => false);
      }
      // update capability values and flowcards
      if (internetConnectionStatus !== !this.getCapabilityValue('alarm_generic')) {
        if (internetConnectionStatus) {
          this.log('the internet connection came up');
        } else {
          this.log('the internet connection went down');
        }
      }
      this.setCapability('alarm_generic', !internetConnectionStatus).catch(this.error);
      return Promise.resolve(true);
    } catch (error) {
      return Promise.reject(error);
    }
  }

  // function to keep a list of known attached devices, and update the device state
  async updateKnownDeviceList() {
    try {
      const method = Number(this.settings.attached_devices_method);
      const attDevs = await this.routerSession.getAttachedDevices(method);
      if (attDevs.length === 0) throw Error('Attached devicelist came back empty');
      this.readings.pollTime = new Date();
      this.readings.attachedDevices = attDevs;

      const { readings } = this;
      const { knownDevices } = this;
      const { attachedDevices } = readings;
      const now = readings.pollTime.toISOString();
      // get the list of attached devices that are individually paired
      const pairedDeviceDriver = this.homey.drivers.getDriver('attached_device');
      await pairedDeviceDriver.ready(() => null);
      const attachedList = {};
      pairedDeviceDriver.getDevices().forEach((device) => {
        const settings = device.getSettings();
        // index every alias, not just settings.mac - updateDevices() matches on the whole
        // alias list, so all of them need the paired offlineDelay and stale-prune exemption
        const macs = (device.aliasses && device.aliasses.length) ? device.aliasses : [settings.mac];
        macs.forEach((mac) => {
          attachedList[mac] = { offlineDelay: settings.offline_after * 1000 };
        });
      });

      // detect online and new attached devices
      attachedDevices.forEach((attachedDevice) => {
        // filter corrupt stuff
        if (knownDevices[attachedDevice.MAC] && (knownDevices[attachedDevice.MAC].MAC.length !== 17)) { // knownDevice is corrupt
          this.log('deleting corrupt device', knownDevices[attachedDevice.MAC]);
          delete knownDevices[attachedDevice.MAC];
        }
        // detect new device
        if (!Object.prototype.hasOwnProperty.call(knownDevices, attachedDevice.MAC)) {
          this.log(`new device added: ${attachedDevice.MAC} ${attachedDevice.Name}`);
          const tokens = {
            mac: attachedDevice.MAC,
            name: attachedDevice.Name,
            ip: attachedDevice.IP,
          };
          this.homey.app.triggerNewAttachedDevice(this, tokens, {});
        }
        // detect device coming online, add online and lastSeen
        const previousDevice = knownDevices[attachedDevice.MAC];
        const lastOnline = previousDevice !== undefined ? previousDevice.online : false;
        // detect name/IP changes for a device we already knew about
        if (previousDevice) {
          const changeTokens = {
            mac: attachedDevice.MAC,
            name: attachedDevice.Name,
            ip: attachedDevice.IP,
          };
          if (previousDevice.Name !== attachedDevice.Name) {
            this.homey.app.triggerNameChanged(this, changeTokens, {});
          }
          if (previousDevice.IP !== attachedDevice.IP) {
            this.homey.app.triggerIPChanged(this, changeTokens, {});
          }
        }
        knownDevices[attachedDevice.MAC] = attachedDevice;
        knownDevices[attachedDevice.MAC].online = true;
        knownDevices[attachedDevice.MAC].lastSeen = now;
        if (!lastOnline) {
          if (!attachedList[attachedDevice.MAC]) {
            this.log(`Online: ${attachedDevice.MAC} ${attachedDevice.Name} ${attachedDevice.IP}`);
          }
          const tokens = {
            mac: attachedDevice.MAC,
            name: attachedDevice.Name,
            ip: attachedDevice.IP,
          };
          this.homey.app.triggerCameOnline(this, tokens, {});
        }
      });

      // calculate number online, detect devices going offline, add pollTime
      const offlineDelay = this.getSettings().offline_after * 1000; // default 5 minutes
      const staleDelay = 60 * 24 * 60 * 60 * 1000; // 60 days
      let onlineCount = 0;
      Object.keys(knownDevices).forEach((key) => {
        const device = knownDevices[key];
        // filter corrupt stuff
        if (!device || !device.MAC || (key.length !== 17)) {
          this.log(`deleting corrupt device@detachCheck: ${key}`);
          delete knownDevices[key];
          return;
        }
        // prune long-gone devices so knownDevices can't grow without bound (MAC-randomizing
        // phones/IoT churn through hundreds of one-off entries over months)
        // never prune a device that is paired as an attached_device: it is merely away
        // (long trip, seasonal home), and deleting it breaks its presence updates for good
        if (!attachedList[key] && device.lastSeen && (Date.parse(now) - Date.parse(device.lastSeen)) > staleDelay) {
          this.log(`pruning stale known device: ${device.MAC} ${device.Name}`);
          delete knownDevices[key];
          return;
        }
        const tokens = {
          mac: device.MAC,
          name: device.Name,
          ip: device.IP,
        };
        // add polltime
        device.pollTime = now;
        // check if gone offline
        // take offlineDelay from paired attached_devices
        const delay = attachedList[device.MAC] ? attachedList[device.MAC].offlineDelay : offlineDelay;
        if ((Date.parse(now) - Date.parse(device.lastSeen)) > delay) {
          if (device.online) {
            if (!attachedList[device.MAC]) {
              this.log(`Offline: ${device.MAC} ${device.Name}`);
            }
            this.homey.app.triggerWentOffline(this, tokens, {});
          }
          device.online = false;
        }

        // update knownDevices
        knownDevices[device.MAC] = device;
        // calculate online devices count
        if (device.online) {
          onlineCount += 1;
        }
      });
      // store online devices count and set capability
      this.knownDevices = knownDevices;
      this.onlineDeviceCount = onlineCount;
      this.setCapability('meter_attached_devices', onlineCount).catch(this.error);
      // send to attached_device driver
      this.homey.emit('listUpdate', JSON.stringify({ routerID: this.getData().id, knownDevices })); // send to attached_device driver
      // save devicelist to persistent storage
      const knownDevicesString = JSON.stringify(knownDevices).replace('&lt', '').replace('&gt', '').replace(';', '');
      await this.setStoreValue('knownDevicesString', knownDevicesString);
      return Promise.resolve(true);
    } catch (error) {
      return Promise.reject(error);
    }
  }

  async updateRouterDeviceState() {
    try {
      this.busy = true;
      await this.login();
      await this.updateKnownDeviceList(); // attached devices state
      await this.updateInternetConnectionState().catch(this.error); // disconnect alarm
      await this.updateSpeed().catch(this.error); // up/down internet bandwidth
      await this.updateSystemInfo().catch(this.error); // mem/cpu load
      // update exta info once an hour
      if ((Date.now() - this.readings.extraPollTime) > (60 * 60 * 1000)) {
        await this.updateFirmwareInfo().catch(this.error); // firmware and router mode
      }
      this.busy = false;
      this.endDebugWindow('poll ok'); // startup went fine - stop the verbose SOAP tracing
      return Promise.resolve(this.busy);
    } catch (error) {
      this.busy = false;
      return Promise.reject(error);
    }
  }

  // this method is called when the Device is inited
  async onInit() {
    try {
      this.log(`device init: ${this.getName()} id: ${this.getData().id}`);
      this.setAvailable().catch(this.error);
      this.settings = await this.getSettings();

      // migrate stuff
      if (!this.migrated) await this.checkCaps(true);

      // init some values
      if (!this.readings) {
        this.readings = {
          getEthernetLinkStatus: 'Up',
          info: {},
          newFirmware: {},
          trafficMeter: undefined,
          attachedDevices: [],
          pollTime: 0,
          extraPollTime: 0,
        };
      }
      this.busy = false;
      this.watchDogCounter = 4;

      // create router session. Starts at 'debug' so a diagnostics report taken shortly
      // after an app/device restart contains a full SOAP trace of the startup sequence
      // (see endDebugWindow: downgraded to 'error' on the first successful poll, or after
      // DEBUG_WINDOW at the latest). The deadline is kept on the instance and survives a
      // restart, so a router that never connects - restarting every 5 min - can't re-arm
      // debug logging forever and flood the 200-entry log ring with SOAP traces
      if (!this.debugUntil) this.debugUntil = Date.now() + DEBUG_WINDOW;
      const debugLeft = this.debugUntil - Date.now();
      const options = {
        password: this.settings.password,
        username: this.settings.username,
        host: this.settings.host,
        port: this.settings.port,
        // stored at pair/repair. Devices paired before `tls` was a setting have no value
        // yet, so fall back to deriving it from the port (checkCaps writes it back).
        tls: this.settings.tls === undefined ? tlsForPort(this.settings.port) : this.settings.tls,
        logLevel: debugLeft > 0 ? 'debug' : 'error',
      };
      // drop listeners from a previous session before replacing it (device restarts on watchdog/settings changes)
      if (this.routerSession) this.routerSession.removeAllListeners();
      this.routerSession = new NetgearRouter(options);
      attachRouterLogging(this.routerSession, this);
      this.homey.clearTimeout(this.debugTimer);
      if (debugLeft > 0) this.debugTimer = this.homey.setTimeout(() => this.endDebugWindow('timeout'), debugLeft);
      await this.login().catch((error) => this.error('failed to login during init:', error.message));

      // get known device from store
      this.log('retrieving knownDevices from persistent storage');
      const knownDevicesString = await this.getStoreValue('knownDevicesString');
      this.knownDevices = knownDevicesString ? JSON.parse(knownDevicesString) : {};
      // sanitize knownDevices
      Object.keys(this.knownDevices).forEach((key) => {
        if (key.length !== 17) { // this is not a mac address
          this.log(`Deleting corrupt known device: ${key}`);
          delete this.knownDevices[key];
        }
      });

      // activate traffic meter and access control
      if (this.settings.use_traffic_info) {
        await this.enableTrafficMeter(true)
          .catch((error) => this.error('Traffic meter could not be enabled:', error.message));
      }
      await this.setBlockDeviceEnable(true)
        .catch((error) => this.error('Device Access Control could not be enabled:', error.message));

      // start polling router for info
      await this.updateRouterDeviceState();
      this.startPolling(this.settings.polling_interval);

      this.log(`device ready: ${this.getName()} id: ${this.getData().id}`);
      this.restarting = false;
    } catch (error) {
      this.error(error);
      this.setUnavailable(error.message).catch(this.error);
      this.restarting = false;
      this.restartDevice(5 * 60 * 1000);
    }
  }

  // migrate stuff from old version < 4.0.0
  async checkCaps(migrate) {
    try {
      if (migrate) this.log(`checking device migration for ${this.getName()}`);

      // `tls` became a stored setting - backfill it from the port for devices paired before
      // that, so the value the user sees and edits matches what the session actually uses.
      // NB `settings.tls === undefined` is not a reliable "never set" signal: the manifest
      // declares a default of false, and whether Homey applies a newly declared default to
      // already-paired devices is undocumented. Key this one-off migration on a store value
      // instead - the store is app-owned, so an absent flag unambiguously means the device
      // predates the setting. Pair and repair seed the flag, so they are never re-derived.
      if (!(await this.getStoreValue('tlsMigrated'))) {
        const tls = tlsForPort(this.settings.port);
        if (tls !== this.settings.tls) {
          this.log(`migrating tls setting to ${tls} for ${this.getName()}`);
          await this.setSettings({ tls }).catch(this.error);
          this.settings = await this.getSettings();
        }
        await this.setStoreValue('tlsMigrated', true);
      }

      // check and repair incorrect capability(order) // remove unselected optional capabilities
      const correctCaps = this.driver.capabilities.filter((cap) => {
        let include = true;
        if (!this.settings.use_traffic_info && cap.includes('speed')) include = false;
        if (!this.settings.use_system_info && cap.includes('utilization')) include = false;
        return include;
      });
      for (let index = 0; index < correctCaps.length; index += 1) {
        const caps = await this.getCapabilities();
        const newCap = correctCaps[index];
        if (caps[index] !== newCap) {
          // remove all caps from here
          for (let i = index; i < caps.length; i += 1) {
            this.log(`removing capability ${caps[i]} for ${this.getName()}`);
            await this.removeCapability(caps[i])
              .catch((error) => this.log(error));
            await settle(this.homey); // wait a bit for Homey to settle
          }
          // add the new cap
          this.log(`adding capability ${newCap} for ${this.getName()}`);
          await this.addCapability(newCap);
          await settle(this.homey); // wait a bit for Homey to settle
        }
      }
      // remove any leftover capabilities beyond the correct list (e.g. correctCaps got shorter)
      await removeExtraCapabilities(this, correctCaps);
      // set new migrate level
      if (migrate && this.settings.level < '4.0.0') {
        const excerpt = `The Netgear app is migrated to version ${this.homey.app.manifest.version} **CHECK FOR BROKEN FLOWS!**`;
        await this.homey.notifications.createNotification({ excerpt });
        await this.setSettings({ level: this.homey.app.manifest.version }).catch(this.error);
        this.log(excerpt);
      }
      this.migrated = true;
      return this.migrated;
    } catch (error) {
      throw new Error(`Migration failed: ${error.message}`, { cause: error });
    }
  }

  restartDevice(delay) {
    if (this.restarting) return;
    // stopPolling() clears any pending restart state, so claim the flag after it
    this.stopPolling();
    this.restarting = true;
    const dly = delay || 2000;
    this.log(`Device will restart in ${dly / 1000} seconds`);
    // Homey-managed timer: disposed automatically on device destroy, so a pending
    // restart can't fire this.onInit() against an already-destroyed instance
    this.restartTimer = this.homey.setTimeout(() => this.onInit(), dly);
  }

  // this method is called when the Device is added
  async onAdded() {
    const settings = this.getSettings();
    this.log(`router ${settings.model_name} added as device @ ${settings.host}:${settings.port}`);
    this.setAvailable().catch(this.error);
  }

  // this method is called when the Device is deleted
  onDeleted() {
    this.stopPolling();
    this.log(`Router deleted as device: ${this.getName()}`);
  }

  // this method is called before the Device is unloaded (app stop/restart or deletion)
  onUninit() {
    this.stopPolling();
    if (this.routerSession) this.routerSession.removeAllListeners();
    this.log(`Device uninit: ${this.getName()}`);
  }

  stopPolling() {
    this.log(`Stop polling ${this.getName()}`);
    this.homey.clearInterval(this.intervalIdDevicePoll);
    // cancelling the pending restart must also drop the flag that guards it. Otherwise
    // a caller that stops and then restarts (onSettings) leaves `restarting` stuck true,
    // and every later restartDevice() no-ops - killing the device until the app restarts
    this.homey.clearTimeout(this.restartTimer);
    this.restarting = false;
    this.homey.clearTimeout(this.debugTimer);
  }

  // register polling stuff
  startPolling(interval) {
    this.homey.clearInterval(this.intervalIdDevicePoll);
    this.log(`start polling ${this.getName()} @${interval} seconds interval`);
    this.intervalIdDevicePoll = this.homey.setInterval(async () => {
      try {
        if (this.watchDogCounter <= 0) throw Error('watchdog active');
        if (this.busy) {
          this.log('Still busy. Skipping a poll');
          return;
        }
        // get new routerdata and update the state
        await this.updateRouterDeviceState();
        this.watchDogCounter = 4;
      } catch (error) {
        this.error(error);
        this.watchDogCounter -= 1;
        if (this.watchDogCounter <= 0) {
          // restart the app here
          this.log('watchdog triggered, restarting Homey device now');
          this.setUnavailable(error.message).catch(this.error);
          await this.restartDevice(5 * 60 * 1000); // restart after 5 minutes
        }
      }
    }, 1000 * interval);
  }

  async onSettings({ newSettings }) { // , changedKeys }) { // , oldSettings, changedKeys) {
    // newSettings holds the router admin password, and captureLogs mirrors this into the
    // diagnostics report users post publicly - so never log the object as a whole
    const { password, ...loggable } = newSettings;
    this.log(`${this.getName()} device settings changed by user`, loggable);
    this.stopPolling();
    if (newSettings.clear_known_devices) {
      this.knownDevices = {};
      await this.setStoreValue('knownDevicesString', JSON.stringify(this.knownDevices));
      this.log('known devices were deleted on request of user');
      throw Error('Known devices list deleted');
    }
    if (newSettings.use_traffic_info) {
      await this.addCapability('meter_download_speed');
      await this.addCapability('meter_upload_speed');
    } else {
      await this.removeCapability('meter_download_speed');
      await this.removeCapability('meter_upload_speed');
    }
    if (newSettings.use_system_info) {
      await this.addCapability('meter_cpu_utilization');
      await this.addCapability('meter_mem_utilization');
    } else {
      await this.removeCapability('meter_cpu_utilization');
      await this.removeCapability('meter_mem_utilization');
    }
    this.restartDevice(3000);
  }

}

module.exports = NetgearDevice;
