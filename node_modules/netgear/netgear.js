/* This Source Code Form is subject to the terms of the Mozilla Public
	License, v. 2.0. If a copy of the MPL was not distributed with this
	file, You can obtain one at http://mozilla.org/MPL/2.0/.

	Copyright 2017 - 2026, Robin de Gruijter <gruijter@hotmail.com> */

/* eslint-disable no-await-in-loop */
/* eslint-disable prefer-destructuring */
/* eslint-disable max-classes-per-file */

'use strict';

const dns = require('node:dns/promises');
const dgram = require('node:dgram');
const os = require('node:os');
const timersPromises = require('node:timers/promises');
const { EventEmitter } = require('node:events');

const soap = require('./lib/soapcalls');
const xml = require('./lib/xml');
const errors = require('./lib/errors');
const http = require('./lib/http');
const RequestQueue = require('./lib/requestQueue');
const { tryInOrder } = require('./lib/fallback');
const { mapWithConcurrency } = require('./lib/concurrency');

const defaultHost = 'routerlogin.net';
const defaultUser = 'admin';
const defaultPassword = 'password';
const defaultSessionId = 'A7D88AE69687E58D9A00';	// '10588AE69687E58D9A00'

// Increasing verbosity; a message is only emitted when its rank is <= the configured
// logLevel's rank. 'silent' (-1) emits nothing at all.
const logLevelRanks = {
	silent: -1, error: 0, warn: 1, info: 2, debug: 3,
};

const maxLoggedBodyLength = 500;

// Strips any secret-bearing tag before a raw SOAP body is ever logged - even at the most
// verbose 'debug' level, credentials must never leak into whatever log sink a consumer wires
// up (e.g. a Homey diagnostics report). Covers both request-side password tags - <Password>
// (soap.login) and <NewPassword ...> (soap.loginOld, which uses a differently-named tag with
// attributes on its opening tag - see lib/soapcalls.js) - and the response-side WPA passphrase
// (<NewWPAPassphrase>, returned by getWPASecurityKeys()/get5GWPASecurityKeys()/
// get5G1WPASecurityKeys()). Also truncates long bodies so a single verbose call can't flood a
// size-limited log buffer.
const secretTagPattern = /<(Password|NewPassword|NewWPAPassphrase)\b[^>]*>.*?<\/\1>/gis;

const redactBody = (body) => {
	if (typeof body !== 'string') return body;
	const redacted = body.replace(secretTagPattern, (match, tagName) => `<${tagName}>[redacted]</${tagName}>`);
	return redacted.length > maxLoggedBodyLength
		? `${redacted.slice(0, maxLoggedBodyLength)}...[truncated]`
		: redacted;
};

class AttachedDevice {
	constructor() {
		this.IP = undefined;					// e.g. '10.0.0.10'
		this.Name = undefined;				// '--' for unknown
		this.NameUserSet = undefined;	// e.g. 'false'
		this.MAC = undefined;					// e.g. '61:56:FA:1B:E1:21'
		this.ConnectionType = undefined;	// e.g. 'wired', '2.4GHz', 'Guest Wireless 2.4G'
		this.SSID = undefined;				// e.g. 'MyWiFi'
		this.Linkspeed = undefined;
		this.SignalStrength = undefined;	// number <= 100
		this.AllowOrBlock = undefined;		// 'Allow' or 'Block'
		this.Schedule = undefined;				// e.g. 'false'
		this.DeviceType = undefined;	// a number
		this.DeviceTypeV2 = undefined;	// e.g. 1, found in R7000 response
		this.DeviceTypeUserSet = undefined;	// e.g. 'false',
		this.DeviceTypeName = undefined;	// unknown, found in orbi response
		this.DeviceTypeNameV2 = undefined;	// 'Computer (Generic)', found in R7000 response
		this.DeviceModel = undefined; // unknown, found in R7800 and orbi response
		this.DeviceModelUserSet = undefined; // boolean , found in orbi response
		this.Upload = undefined;	// e.g. 0
		this.Download = undefined;	// e.g. 0
		this.QosPriority = undefined;	// 1, 2, 3, 4
		this.Grouping = undefined; // e.g. 0
		this.SchedulePeriod = undefined;
		this.ConnAPMAC = undefined; // unknown, found in orbi response
	}
}

class NetgearRouter extends EventEmitter {
	// password, username, host and port are deprecated. Now use { password: '', username: '', host:'routerlogin.net', port: 80, timeout: 19000, tls: false}
	constructor(opts, username, host, port) {
		super();
		const options = opts || {};
		this.host = options.host || host || defaultHost;
		this.port = options.port || port;	// defaults with tls: 443, 5555. no tls: 5000, 80
		this.tls = options.tls === undefined ? (this.port !== 80) : options.tls; // set tls true as default, except when using port 80
		this.username = options.username || username || defaultUser;
		this.password = options.password || opts || defaultPassword;
		this.timeout = options.timeout || 18000;
		this.sessionId = defaultSessionId;
		this.cookie = undefined;
		this.loggedIn = false;
		this.configStarted = false;
		this.soapVersion = undefined;	// 2 or 3
		this.loginMethod = undefined;	// 2 for newer models, 1 for old models
		this.getAttachedDevicesMethod = undefined;	// 2 or 1
		this.checkNewFirmwareMethod = undefined;	// 2 or 1
		this.guestWifiMethod = {
			set24_1: undefined,
			get50_1: undefined,
			set50_1: undefined,
		};
		this.lastResponse = undefined;
		this.queue = new RequestQueue({ ratePerSecond: 3 });
		// controls which _log() calls actually emit a 'log' event - see _log() below.
		// Mutable at any time (e.g. `router.logLevel = 'debug'` while troubleshooting).
		this.logLevel = options.logLevel || 'warn';
	}

	// Emits a 'log' event ({ level, message, timestamp, ...context }) when `level` is at or
	// below the current this.logLevel verbosity. Deliberately not named 'error' - EventEmitter
	// throws if an 'error' event has no listener, which would crash a consumer that never
	// subscribed. Consumers (e.g. the Homey app) wire this into their own logger:
	// `router.on('log', ({ level, message, ...context }) => this.log(level, message, context))`.
	_log(level, message, context = {}) {
		const rank = logLevelRanks[level];
		const threshold = logLevelRanks[this.logLevel] ?? logLevelRanks.warn;
		if (rank === undefined || rank > threshold) return;
		this.emit('log', {
			level, message, timestamp: new Date().toISOString(), ...context,
		});
	}

	/**
	* Discovers a netgear router in the network. Also sets the discovered ip address and soap port for this session.
	* @param {dnsLookupOptions} [options] - dnsLookup options, e.g. { family: 4 }
	* @returns {Promise.<currentSetting>} The discovered router info, including host ip address and soap port.
	*/
	async discover(dnsLookupOptions) {
		const discoveredInfo = await this._discoverHostInfo(dnsLookupOptions);
		this.host = discoveredInfo.host;
		this.port = discoveredInfo.port;
		this.tls = discoveredInfo.tls;
		return discoveredInfo;
	}

	/**
	* Login to the router. Passing options will override any existing session settings.
	* If host or port are not set, login will try to auto discover these.
	* @param {sessionOptions} [options] - configurable session options
	* @returns {Promise.<loggedIn>} The loggedIn state.
	*/
	async login(opts, username, host, port) {
		const options = opts || {};
		if (typeof opts === 'string') {
			this.password = opts;
		} else {
			this.password = options.password || this.password;
		}
		this.host = options.host || host || this.host;
		this.port = options.port || port || this.port;
		this.tls = options.tls === undefined ? this.tls : options.tls;
		this.username = options.username || username || this.username;
		this.timeout = options.timeout || this.timeout;
		if (!this.host || this.host === '') {
			await this.discover()
				.catch(() => {
					throw new Error('Cannot login: host IP and/or SOAP port not set');
				});
		}
		// discover soap port, tls and login method supported by router
		if (!this.loginMethod || !this.port) {
			const currentSetting = await this.getCurrentSetting(); // will set this.loginMethod
			if (!this.port) this.port = currentSetting.port; // keep manually set port
			if (this.tls === undefined) this.tls = currentSetting.tls; // keep manual set tls
		}
		let loggedIn = false;
		const messageNew = soap.login(this.sessionId, this.username, this.password);
		const messageOld = soap.loginOld(this.sessionId, this.username, this.password);
		// The 4 branches below are deliberately left explicit rather than routed through the
		// shared tryInOrder fallback helper used elsewhere: they have asymmetric cookie-reset
		// side effects (old-method branch resets the cookie before attempting; new-method branch
		// resets it only on failure) that don't map cleanly onto a generic ordered-strategy shape
		// without risking a silent reordering bug.
		const triedOldAsPrimary = options.method === 1 || (!options.method && this.loginMethod < 2);
		const triedNewAsPrimary = options.method === 2 || (!options.method && this.loginMethod >= 2);
		// use old method if opts method 1 selected, or auto method selected and loginMethod < 2
		if (triedOldAsPrimary) {
			this.cookie = undefined; // reset the cookie
			loggedIn = await this._queueMessage(soap.action.loginOld, messageOld)
				.then(() => true)
				.catch(() => false);
		}
		// use new method if opts method 2 selected, or auto method selected and loginMethod = 2
		if (triedNewAsPrimary) {
			loggedIn = await this._queueMessage(soap.action.login, messageNew)
				.then(() => true)
				.catch(() => {
					this.cookie = undefined; // reset the cookie
					return false;
				});
		}
		// use old login method as fallback, only if auto method selected and old wasn't already
		// just tried as the primary attempt above (that would waste a round-trip retrying the
		// exact same failed call instead of trying the untried alternative)
		if (!options.method && !loggedIn && !triedOldAsPrimary) {
			loggedIn = await this._queueMessage(soap.action.loginOld, messageOld)
				.then(() => true)
				.catch(() => false);
		}
		// use new login method as fallback, same reasoning
		if (!options.method && !loggedIn && !triedNewAsPrimary) {
			loggedIn = await this._queueMessage(soap.action.login, messageNew)
				.then(() => true)
				.catch(() => {
					this.cookie = undefined; // reset the cookie
					return false;
				});
		}
		if (!loggedIn) {
			this._log('warn', 'Login failed', { host: this.host, port: this.port });
			throw new Error('Failed to login');
		}
		this.loggedIn = true;
		this._log('info', 'Login succeeded', {
			host: this.host, port: this.port, loginMethod: this.loginMethod,
		});
		return this.loggedIn;
	}

	/**
	* Logout from the router.
	* @returns {Promise.<loggedIn>} The loggedIn state.
	*/
	async logout() {
		const message = soap.logout(this.sessionId);
		await this._queueMessage(soap.action.logout, message);
		this.loggedIn = false;
		return this.loggedIn;
	}

	/**
	* Get router information without need for credentials. Autodiscovers the SOAP port and TLS
	* @param {string} [host] - The url or ip address of the router.
	* @returns {Promise.<currentSetting>}
	*/
	async getCurrentSetting(host, timeout) {
		const host1 = host || this.host;
		const url = `http://${host1}:80/currentsetting.htm`;
		const result = await http.request(url, { method: 'GET', timeout: timeout || this.timeout });
		this.lastResponse = result.body;
		// request failed. Logged at 'debug', not 'warn': this method is also used to probe up
		// to 254 hosts during network-scan discovery, where most hosts are expected to fail.
		if (result.statusCode !== 200) {
			this._log('debug', 'getCurrentSetting: non-200 response', { host: host1, statusCode: result.statusCode });
			throw errors.httpRequestFailed(result.statusCode);
		}
		if (!result.body.includes('Model=')) {
			this._log('debug', 'getCurrentSetting: not a Netgear router', { host: host1 });
			throw errors.notNetgearRouter();
		}
		// request successfull
		const currentSetting = {};
		result.body.split(/[\r\n\t\s]+/gm).forEach((entry) => {
			const info = entry.split('=');
			if (info.length === 2) currentSetting[info[0]] = info[1];
		});
		currentSetting.host = host1; // add the host address to the information
		currentSetting.port = currentSetting.SOAP_HTTPs_Port || await this._getSoapPort(host1); // add port address to the information
		currentSetting.tls = !!currentSetting.SOAP_HTTPs_Port;
		if (currentSetting.port === 443 || currentSetting.port === 5555
			|| currentSetting.port === 5043) currentSetting.tls = true; // add tls to the information
		this.loginMethod = Number(currentSetting.LoginMethod) || 1;
		this.soapVersion = parseInt(currentSetting.SOAPVersion, 10) || 2;
		this._log('debug', 'getCurrentSetting discovered', {
			host: host1, port: currentSetting.port, tls: currentSetting.tls,
		});
		return currentSetting;
	}

	/**
	* Get system Info.
	* @returns {Promise.<systemInfo>}
	*/
	async getSystemInfo() {
		const message = soap.getSystemInfo(this.sessionId);
		const result = await this._queueMessage(soap.action.getSystemInfo, message);
		return xml.parseSoapObject(result.body, 'GetSystemInfoResponse', { nativeType: true });
	}

	/**
	* Get router logs.
	* @param {boolean} [parse = false] - will parse the results to json if true
	* @returns {Promise.<logs>}
	*/
	async getSystemLogs(parse) {
		const message = soap.getSystemLogs(this.sessionId);
		const result = await this._queueMessage(soap.action.getSystemLogs, message);
		// extractXmlTag deliberately: the tag's own content is newline-delimited log lines, not
		// further XML - there's nothing for parseSoapObject to descend into.
		const raw = xml.extractXmlTag(result.body, 'NewLogDetails', { multiline: true });
		const entries = raw
			.split(/[\r\n]+/gm)
			.filter((entry) => entry.length > 0);
		if (entries.length < 1) throw new Error('No log entries found');
		if (!parse) return entries;
		// start parsing stuff
		return entries.map((entry) => {
			const items = entry.split(',');
			return {
				string: entry,
				event: `${entry.split(']')[0]}`.replace(/[[\]]/g, ''),
				info: items[0].split(']')[1] ? items[0].split(']')[1].trim() : undefined,
				ts: Date.parse(`${items[items.length - 2]}, ${items[items.length - 1]}`),
			};
		});
	}

	/**
	* Get router uptime since last boot.
	* @returns {Promise.<hh:mm:ss>}
	*/
	async getSysUpTime() {
		const message = soap.getSysUpTime(this.sessionId);
		const result = await this._queueMessage(soap.action.getSysUpTime, message);
		return xml.parseSoapObject(result.body, 'GetSysUpTimeResponse').SysUpTime;
	}

	/**
	* @typedef NTPservers
	* @description TimeZoneInfo is an object with these properties.
	* @property {string} NTPServer1 e.g. 'time-g.netgear.com'
	* @property {string} NTPServer2 e.g. 'time-g.netgear.com'
	* @property {string} NTPServer3 e.g. 'time-g.netgear.com'
	* @property {string} NTPServer4 e.g. 'time-g.netgear.com'
	* @example // NTPservers
{
	NTPServer1: 'time-g.netgear.com',
	NTPServer2: 'time-g.netgear.com',
	NTPServer3: 'time-g.netgear.com',
	NTPServer4: 'time-g.netgear.com'
}
	*/

	/**
	* Get NTP servers.
	* @returns {Promise.<NTPservers>}
	*/
	async getNTPServers() {
		const message = soap.getNTPServers(this.sessionId);
		const result = await this._queueMessage(soap.action.getNTPServers, message);
		return xml.parseSoapObject(result.body, 'GetInfoResponse', { stripNewPrefix: true });
	}

	/**
	* @typedef timeZoneInfo
	* @description TimeZoneInfo is an object with these properties.
	* @property {string} TimeZone e.g. '+1'
	* @property {string} DaylightSaving e.g. '0'
	* @property {string} IndexValue e.g. '19'
	* @example // timeZoneInfo
{ TimeZone: '+1', DaylightSaving: '0', IndexValue: '19' }
	*/

	/**
	* Get TimeZone.
	* @returns {Promise.<timeZoneInfo>}
	*/
	async getTimeZoneInfo() {
		const message = soap.getTimeZoneInfo(this.sessionId);
		const result = await this._queueMessage(soap.action.getTimeZoneInfo, message);
		return xml.parseSoapObject(result.body, 'GetTimeZoneInfoResponse', { stripNewPrefix: true });
	}

	/**
	* Get router information.
	* @returns {Promise.<info>}
	*/
	async getInfo() {
		const message = soap.getInfo(this.sessionId);
		const result = await this._queueMessage(soap.action.getInfo, message);
		return xml.parseSoapObject(result.body, 'GetInfoResponse', { stripNewPrefix: true });
	}

	/**
	* Get router SupportFeatureList.
	* @returns {Promise.<supportFeatureList>}
	*/
	async getSupportFeatureListXML() {
		const message = soap.getSupportFeatureListXML(this.sessionId);
		const result = await this._queueMessage(soap.action.getSupportFeatureListXML, message);
		return xml.parseSoapObject(result.body, ['GetSupportFeatureListXMLResponse', 'newFeatureList', 'features']);
	}

	/**
	* Get Device Config.
	* @returns {Promise.<deviceConfig>}
	*/
	async getDeviceConfig() {
		const message = soap.getDeviceConfig(this.sessionId);
		const result = await this._queueMessage(soap.action.getDeviceConfig, message);
		return xml.parseSoapObject(result.body, 'GetInfoResponse');
	}

	/**
	* Get Allowed Device list.
	* @returns {Promise.<allowedDevice[]>}
	*/
	async getDeviceListAll() {
		const message = soap.getDeviceListAll(this.sessionId);
		const result = await this._queueMessage(soap.action.getDeviceListAll, message);
		const body = xml.unescapeXmlEntities(result.body);
		// extractXmlTag deliberately: content is a custom '@'/';'-delimited list, not further XML.
		const raw = xml.extractXmlTag(body, 'NewAllowDeviceList', { multiline: true });
		const entries = raw.split('@');
		const devices = [];
		entries.forEach((entry, index) => {
			const info = entry.split(';');
			// info must be larger then 0 chars
			if (info.length === 0) throw new Error('Error parsing device-list');
			// check if first entry is number of entries
			if (index === 0 && info.length === 1) {
				if (Number(entry) !== entries.length - 1) throw new Error('Error parsing device-list - number mismatch');
				return;
			}
			// error when not enough info elements
			if (info.length < 4) throw new Error('Error parsing device-list - not enough elements');
			// throw error on invalid mac format
			if (info[1].length !== 17) throw new Error('Error parsing device-list - invalid mac format');
			devices.push({
				MAC: info[1],		// e.g. '61:56:FA:1B:E1:21'
				Name: info[2],	// '--' for unknown
				ConnectionType: info[3],	// 'wired' or 'wireless'
			});
		});
		return devices;
	}

	/**
	* Get LAN config
	* @returns {Promise.<LANConfig>}
	*/
	async getLANConfig() {
		const message = soap.getLANConfig(this.sessionId);
		const result = await this._queueMessage(soap.action.getLANConfig, message);
		return xml.parseSoapObject(result.body, 'GetInfoResponse');
	}

	/**
	* Get Internet connection status, e.g. 'Up'
	* @returns {Promise.<ethernetLinkStatus>}
	*/
	async getEthernetLinkStatus() {
		const message = soap.getEthernetLinkStatus(this.sessionId);
		const result = await this._queueMessage(soap.action.getEthernetLinkStatus, message);
		return xml.parseSoapObject(result.body, 'GetEthernetLinkStatusResponse').NewEthernetLinkStatus;
	}

	/**
	* Get WAN config
	* @returns {Promise.<WANConfig>}
	*/
	async getWANConfig() {
		const message = soap.getWANIPConnection(this.sessionId);
		const result = await this._queueMessage(soap.action.getWANIPConnection, message);
		return xml.parseSoapObject(result.body, 'GetInfoResponse');
	}

	/**
	* @typedef WANConnectionType
	* @description WANConnectionType is an object with these properties.
	* @property {string} ConnectionType e.g. 'DHCP'
	* @example // WANConnectionType
{ ConnectionType: 'DHCP' }
	*/

	/**
	* Get WAN Connection Type
	* @returns {Promise.<WANConnectionType>}
	*/
	async getWANConnectionType() {
		const message = soap.getWANConnectionTypeInfo(this.sessionId);
		const result = await this._queueMessage(soap.action.getWANConnectionTypeInfo, message);
		return xml.parseSoapObject(result.body, 'GetConnectionTypeInfoResponse', { stripNewPrefix: true });
	}

	/**
	* @typedef WANInternetPort
	* @description WANInternetPort is an object with these properties.
	* @property {string} InternetPortInfo e.g. '1@1;Ethernet'
	* @example // WANInternetPort
{ InternetPortInfo: '1@1;Ethernet' }
	*/

	/**
	* Get WAN Internet Port Info
	* @returns {Promise.<WANInternetPort>}
	*/
	async getWANInternetPort() {
		const message = soap.getWANInternetPortInfo(this.sessionId);
		const result = await this._queueMessage(soap.action.getWANInternetPortInfo, message);
		return xml.parseSoapObject(result.body, 'GetInternetPortInfoResponse', { stripNewPrefix: true });
	}

	/**
	* Get WAN DNS LookUpStatus
	* @returns {Promise.<WANDNSLookUpStatus>}
	*/
	async getWANDNSLookUpStatus() {
		const message = soap.getWANDNSLookUpStatus(this.sessionId);
		const result = await this._queueMessage(soap.action.getWANDNSLookUpStatus, message);
		// NOTE: the original code read the wrong response key ('GetInternetPortInfoResponse', a
		// copy-paste leftover from getWANInternetPort above it), so it always failed. A real
		// captured SOAP log against a Netgear R8000 (github.com/MatMaul/pynetgear#20) then
		// confirmed an actual router firmware bug, independent of this package: calling
		// WANIPConnection#GetDNSLookUpStatus on that router returns a <GetConnectionTypeInfoResponse>
		// wrapper (borrowed from the unrelated GetConnectionTypeInfo method) instead of
		// <GetDNSLookUpStatusResponse>. That's confirmed on exactly one router/firmware though, so
		// try the confirmed-buggy wrapper first, falling back to the conventionally-correct one in
		// case a given router/firmware doesn't have this specific bug. Parsed once (rather than
		// two separate parseSoapObject calls) so trying both candidate keys doesn't re-run
		// patchBody/re-parse the whole XML tree from scratch a second time.
		const rawJson = xml.parseSoapTree(result.body);
		const entries = xml.resolveSoapPath(rawJson, 'GetConnectionTypeInfoResponse')
			|| xml.resolveSoapPath(rawJson, 'GetDNSLookUpStatusResponse');
		if (!entries || typeof entries !== 'object') throw errors.incompleteResponse();
		return xml.flattenEntries(entries, true);
	}

	/**
	* Get Port Mapping Info
	* @returns {Promise.<portMapping>}
	*/
	async getPortMappingInfo() {
		const message = soap.getPortMappingInfo(this.sessionId);
		const result = await this._queueMessage(soap.action.getPortMappingInfo, message);
		return xml.parseSoapObject(result.body, 'GetPortMappingInfoResponse');
	}

	/**
	* Get array of attached devices.
	* @param {number} [method = 0] - 0: auto, 1: v1 (old), 2: v2 (new)
	* @returns {Promise.<AttachedDevice[]>}
	*/
	async getAttachedDevices(method) {
		if (method === 1) {
			this.getAttachedDevicesMethod = 1;
			return this._getAttachedDevices();
		}
		if (method === 2) {
			this.getAttachedDevicesMethod = 2;
			return this._getAttachedDevices2();
		}
		this.getAttachedDevicesMethod = 0;
		return tryInOrder([
			{ fn: () => this._getAttachedDevices() },
			{ fn: () => this._getAttachedDevices2() },
		]);
	}

	/**
	* Get traffic meter statistics.
	* @returns {Promise.<trafficStatistics>}
	*/
	async getTrafficMeter() {
		const message = soap.trafficMeter(this.sessionId);
		const result = await this._queueMessage(soap.action.getTrafficMeter, message);
		const info = xml.parseSoapObject(result.body, 'GetTrafficMeterStatisticsResponse');
		// parseSoapObject normalizes an empty tag to undefined (see checkNewFirmware for the same
		// note); the original regex-based extraction returned '' for the same case, which
		// Number('') coerces to 0 rather than throwing - `|| ''` restores that exact fallback.
		const newTodayUpload = Number((info.NewTodayUpload || '').replace(',', ''));
		const newTodayDownload = Number((info.NewTodayDownload || '').replace(',', ''));
		const newMonthUpload = Number((info.NewMonthUpload || '').split('/')[0].replace(',', ''));
		const newMonthDownload = Number((info.NewMonthDownload || '').split('/')[0].replace(',', ''));
		return {
			newTodayUpload, newTodayDownload, newMonthUpload, newMonthDownload,
		};
	}

	/**
	* Get Parental Control Enable Status (true / false).
	* @returns {Promise.<parentalControlEnabled>}
	*/
	async getParentalControlEnableStatus() {
		return this._withConfigSession(async () => {
			const message = soap.getParentalControlEnableStatus(this.sessionId);
			const result = await this._queueMessage(soap.action.getParentalControlEnableStatus, message);
			return xml.parseSoapObject(result.body, 'GetEnableStatusResponse').ParentalControl === '1';
		});
	}

	/**
	* Set the device name
	* @param {string} name - e.g. 'MyNetgearRouter'
	* @returns {Promise<finished>}
	*/
	async setNetgearDeviceName(name) {
		const lanConfig = await this.getLANConfig();
		const MAC = lanConfig.NewLANMACAddress;
		const message = soap.setNetgearDeviceName(this.sessionId, MAC, name);
		await this._queueMessage(soap.action.setNetgearDeviceName, message);
		return true;
	}

	/**
	* Enable or Disable Parental Controls
	* @param {boolean} enable - true to enable, false to disable.
	* @returns {Promise<finished>}
	*/
	enableParentalControl(enable) {
		return this._setViaConfigSession(soap.enableParentalControl, soap.action.enableParentalControl, enable);
	}

	/**
	* Get QoS Enable Status (true / false).
	* @returns {Promise.<qosEnabled>}
	*/
	async getQoSEnableStatus() {
		const message = soap.getQoSEnableStatus(this.sessionId);
		const result = await this._queueMessage(soap.action.getQoSEnableStatus, message);
		return xml.parseSoapObject(result.body, 'GetQoSEnableStatusResponse').NewQoSEnableStatus === '1';
	}

	/**
	* Get QOS Device bandwith. Only works on R7000 - a real captured SOAP log
	* (https://github.com/MatMaul/pynetgear/issues/20) confirms this action crashes the SOAP
	* server on an R8000 (requiring a router restart to recover), so avoid calling this on
	* anything other than a confirmed-working model.
	* @returns {Promise.<currentDeviceBandwidth>}
	*/
	async getCurrentDeviceBandwidth() {
		const message = soap.getCurrentDeviceBandwidth(this.sessionId);
		const result = await this._queueMessage(soap.action.getCurrentDeviceBandwidth, message);
		return xml.parseSoapObject(result.body, 'GetCurrentDeviceBandwidthResponse').NewCurrentDeviceBandwidth;
	}

	/**
	* Get QOS getCurrentAppBandwidthByMAC. Only works on R7000
	* @returns {Promise.<{ currentDeviceUpBandwidth, currentDeviceDownBandwidth }>}
	*/
	async getCurrentBandwidthByMAC(mac) {
		const message = soap.getCurrentBandwidthByMAC(this.sessionId, mac);
		const result = await this._queueMessage(soap.action.getCurrentBandwidthByMAC, message);
		const info = xml.parseSoapObject(result.body, 'GetCurrentBandwidthByMACResponse');
		return { currentDeviceUpBandwidth: info.NewCurrentDeviceUpBandwidth, currentDeviceDownBandwidth: info.NewCurrentDeviceDownBandwidth };
	}

	/**
	* Enable or Disable QoS
	* @param {boolean} enable - true to enable, false to disable.
	* @returns {Promise<finished>}
	*/
	setQoSEnableStatus(enable) {
		return this._setViaConfigSession(soap.setQoSEnableStatus, soap.action.setQoSEnableStatus, enable);
	}

	/**
	* Get Traffic Meter Enable Status (true / false).
	* @returns {Promise.<trafficMeterEnabled>}
	*/
	async getTrafficMeterEnabled() {
		const message = soap.getTrafficMeterEnabled(this.sessionId);
		const result = await this._queueMessage(soap.action.getTrafficMeterEnabled, message);
		return xml.parseSoapObject(result.body, 'GetTrafficMeterEnabledResponse').NewTrafficMeterEnable === '1';
	}

	/**
	* Get Traffic Meter options
	* @returns {Promise.<{newControlOption, newNewMonthlyLimit, restartHour, restartMinute, restartDay}>}
	*/
	async getTrafficMeterOptions() {
		const message = soap.getTrafficMeterOptions(this.sessionId);
		const result = await this._queueMessage(soap.action.getTrafficMeterOptions, message);
		const info = xml.parseSoapObject(result.body, 'GetTrafficMeterOptionsResponse');
		// see getTrafficMeter for why these guard against an empty-tag-normalized undefined
		const newControlOption = info.NewControlOption;
		const newNewMonthlyLimit = Number((info.NewMonthlyLimit || '').replace(',', ''));
		const restartHour = Number(info.RestartHour || '');
		const restartMinute = Number(info.RestartMinute || '');
		const restartDay = Number(info.RestartDay || '');
		return {
			newControlOption, newNewMonthlyLimit, restartHour, restartMinute, restartDay,
		};
	}

	/**
	* Enable or Disable Traffic Meter statistics
	* @param {boolean} enable - true to enable, false to disable.
	* @returns {Promise<finished>}
	*/
	enableTrafficMeter(enabled) { // true or false
		return this._setViaConfigSession(soap.enableTrafficMeter, soap.action.enableTrafficMeter, enabled);
	}

	/**
	* Get Bandwidt Control options
	* @returns {Promise.<{newUplinkBandwidth, newDownlinkBandwidth, enabled}>}
	*/
	async getBandwidthControlOptions() {
		const message = soap.getBandwidthControlOptions(this.sessionId);
		const result = await this._queueMessage(soap.action.getBandwidthControlOptions, message);
		const info = xml.parseSoapObject(result.body, 'GetBandwidthControlOptionsResponse');
		// see getTrafficMeter for why these guard against an empty-tag-normalized undefined
		const newUplinkBandwidth = Number((info.NewUplinkBandwidth || '').replace(',', ''));
		const newDownlinkBandwidth = Number((info.NewDownlinkBandwidth || '').replace(',', ''));
		const enabled = Number(info.NewSettingMethod || '');
		return {
			newUplinkBandwidth, newDownlinkBandwidth, enabled,
		};
	}

	/**
	* sets Qos bandwidth options
	* @param {number} newUplinkBandwidth - maximum uplink bandwidth (Mb/s).
	* @param {number} newDownlinkBandwidth - maximum downlink bandwidth (Mb/s).
	* @returns {Promise<finished>}
	*/
	setBandwidthControlOptions(newUplinkBandwidth, newDownlinkBandwidth) {
		return this._setViaConfigSession(
			soap.setBandwidthControlOptions,
			soap.action.setBandwidthControlOptions,
			newUplinkBandwidth,
			newDownlinkBandwidth,
		);
	}

	/**
	* Get BlockDeviceEnabled status (= device access control)
	* @returns {Promise<blockDeviceEnabled>}
	*/
	async getBlockDeviceEnableStatus() {
		const message = soap.getBlockDeviceEnableStatus(this.sessionId);
		const result = await this._queueMessage(soap.action.getBlockDeviceEnableStatus, message);
		return xml.parseSoapObject(result.body, 'GetBlockDeviceEnableStatusResponse').NewBlockDeviceEnable === '1';
	}

	/**
	* Enable or Disable BlockDevice (= device access control)
	* @param {boolean} enable - true to enable, false to disable.
	* @returns {Promise<finished>}
	*/
	setBlockDeviceEnable(enable) {
		return this._setViaConfigSession(soap.setBlockDeviceEnable, soap.action.setBlockDeviceEnable, enable);
	}

	enableBlockDeviceForAll() {	// deprecated? see setBlockDeviceEnable
		return this._setViaConfigSession(soap.enableBlockDeviceForAll, soap.action.enableBlockDeviceForAll);
	}

	/**
	* Enable or Disable BlockDevice (= device access control)
	* @param {string} MAC - MAC address of the device to block or allow.
	* @param {string} AllowOrBlock - either 'Allow' or 'Block'.
	* @returns {Promise<MAC>}
	*/
	async setBlockDevice(MAC, AllowOrBlock) {
		return this._withConfigSession(async () => {
			const message = soap.setBlockDevice(this.sessionId, MAC, AllowOrBlock);
			await this._queueMessage(soap.action.setBlockDevice, message); // response code 1 = unknown MAC?, 2= device not connected?
			return MAC;
		});
	}

	/**
	* Get 2.4GHz-1 guest Wifi status
	* @returns {Promise<enabled>}
	*/
	async getGuestWifiEnabled() {
		const message = soap.getGuestAccessEnabled(this.sessionId);
		const result = await this._queueMessage(soap.action.getGuestAccessEnabled, message);
		// extractXmlTag rather than parseSoapObject: unlike most other simple flag getters in this
		// file, the response wrapper name for GetGuestAccessEnabled hasn't been cross-checked
		// against a real router capture, so this keeps the wrapper-name-agnostic extraction as the
		// conservative default rather than guessing a specific wrapper.
		return xml.extractXmlTag(result.body, 'NewGuestAccessEnabled') === '1';
	}

	/**
	* Enable or Disable 2.4GHz-1 guest Wifi
	* @param {boolean} enable - true to enable, false to disable.
	* @returns {Promise<wifiSetMethod>}
	*/
	async setGuestWifi(enable) { // true or false
		return tryInOrder([
			{ label: 1, fn: () => this._setGuestAccessEnabled(enable) },
			{ label: 2, fn: () => this._setGuestAccessEnabled2(enable) },
		], (label) => { this.guestWifiMethod.set24_1 = label; });
	}

	/**
	* Get 5GHz-1 guest Wifi status
	* @returns {Promise<enabled>}
	*/
	async get5GGuestWifiEnabled() {
		// method 2 (R8000) tried first, falls back to method 1 (R7800) - same request body, different SOAPAction
		const message = soap.get5G1GuestAccessEnabled(this.sessionId);
		const result = await tryInOrder([
			{ label: 2, fn: () => this._queueMessage(soap.action.get5G1GuestAccessEnabled2, message) },
			{ label: 1, fn: () => this._queueMessage(soap.action.get5G1GuestAccessEnabled, message) },
		], (label) => { this.guestWifiMethod.get50_1 = label; });
		// extractXmlTag rather than parseSoapObject, similar in spirit to checkNewFirmware (two
		// methods, two different response wrappers) - but unlike checkNewFirmware, neither
		// wrapper name here has been cross-checked against a real router capture, so there's no
		// confirmed pair of names to map this.guestWifiMethod.get50_1 onto.
		return xml.extractXmlTag(result.body, 'NewGuestAccessEnabled') === '1';
	}

	/**
	* Enable or Disable 5GHz-1 guest Wifi
	* @param {boolean} enable - true to enable, false to disable.
	* @returns {Promise<wifiSetMethod>}
	*/
	async set5GGuestWifi(enable) { // true or false
		return tryInOrder([
			{ label: 2, fn: () => this._set5G1GuestAccessEnabled2(enable) },
			{ label: 1, fn: () => this._set5G1GuestAccessEnabled(enable) },
		], (label) => { this.guestWifiMethod.set50_1 = label; });
	}

	/**
	* Get 5GHz-2 guest Wifi status
	* @returns {Promise<enabled>}
	*/
	async get5GGuestWifi2Enabled() {
		const message = soap.get5GGuestAccessEnabled2(this.sessionId);
		const result = await this._queueMessage(soap.action.get5GGuestAccessEnabled2, message);
		// extractXmlTag deliberately: see getGuestWifiEnabled - wrapper name unconfirmed against a real capture.
		return xml.extractXmlTag(result.body, 'NewGuestAccessEnabled') === '1';
	}

	/**
	* Enable or Disable 5GHz-2 guest Wifi
	* @param {boolean} enable - true to enable, false to disable.
	* @returns {Promise<wifiSetMethod>}
	*/
	async set5GGuestWifi2(enable) { // true or false
		return this._set5GGuestAccessEnabled2(enable);
	}

	/**
	* Get available Wifi channels
	* @param {string} [band = '2.4G'] - '2.4G', '5G' or '5G1'
	* @returns {Promise.<channels[]>}
	*/
	async getWifiChannels(band) {
		const message = soap.getAvailableChannel(this.sessionId, band || '2.4G');
		const result = await this._queueMessage(soap.action.getAvailableChannel, message);
		// see getTrafficMeter for why this guards against an empty-tag-normalized undefined
		const availableChannels = xml.parseSoapObject(result.body, 'GetAvailableChannelResponse').NewAvailableChannel || '';
		return availableChannels.split(',');
	}

	/**
	* Set the wifi channel
	* @param {string} [channel = 'Auto'] - e.g. '6'
	* @param {string} [band = '2.4G'] - '2.4G', '5G' or '5G1'
	* @returns {Promise<finished>}
	*/
	async setWifiChannel(channel, band) {
		const chnl = channel || 'Auto';
		const availableChannels = await this.getWifiChannels(band);
		if (!availableChannels.includes(chnl)) throw new Error('Channel is not supported on this band');
		return this._withConfigSession(async () => {
			if (band === '5G') {
				const message = soap.set5GChannel(this.sessionId, chnl);
				await this._queueMessage(soap.action.set5GChannel, message);
			} else if (band === '5G1') {
				const message = soap.set5G1Channel(this.sessionId, chnl);
				await this._queueMessage(soap.action.set5G1Channel, message);
			} else {
				const message = soap.setChannel(this.sessionId, chnl);
				await this._queueMessage(soap.action.setChannel, message);
			}
			return true;
		});
	}

	/**
	* Get 2.4G Wifi channel info
	* @returns {Promise.<channel>}
	*/
	async getChannelInfo() {
		const message = soap.getChannelInfo(this.sessionId);
		const result = await this._queueMessage(soap.action.getChannelInfo, message);
		return xml.parseSoapObject(result.body, 'GetChannelInfoResponse').NewChannel;
	}

	/**
	* Get 5G-1 Wifi channel info
	* @returns {Promise.<channel>}
	*/
	async get5GChannelInfo() {
		const message = soap.get5GChannelInfo(this.sessionId);
		const result = await this._queueMessage(soap.action.get5GChannelInfo, message);
		return xml.parseSoapObject(result.body, 'Get5GChannelInfoResponse').New5GChannel;
	}

	/**
	* Get 5G-2 Wifi channel info
	* @returns {Promise.<channel>}
	*/
	async get5G1ChannelInfo() {
		const message = soap.get5G1ChannelInfo(this.sessionId);
		const result = await this._queueMessage(soap.action.get5G1ChannelInfo, message);
		return xml.parseSoapObject(result.body, 'Get5G1ChannelInfoResponse').New5G1Channel;
	}

	/**
	* Get smartConnect Enable Status (true / false).
	* @returns {Promise.<smartConnectEnabled>}
	*/
	async getSmartConnectEnabled() {
		return this._withConfigSession(async () => {
			const message = soap.getSmartConnectEnabled(this.sessionId);
			const result = await this._queueMessage(soap.action.getSmartConnectEnabled, message);
			// note: the underlying SOAP action is named IsSmartConnectEnabled, not GetSmartConnectEnabled
			return xml.parseSoapObject(result.body, 'IsSmartConnectEnabledResponse').NewSmartConnectEnable === '1';
		});
	}

	/**
	* Enable or Disable smartConnect
	* @param {boolean} enable - true to enable, false to disable.
	* @returns {Promise<finished>}
	*/
	setSmartConnectEnabled(enable) {
		return this._setViaConfigSession(soap.setSmartConnectEnabled, soap.action.setSmartConnectEnabled, enable);
	}

	/**
	* Reboot the router
	* @returns {Promise<finished>}
	*/
	async reboot() {
		return this._withConfigSession(async () => {
			const message = soap.reboot(this.sessionId);
			// some routers reboot immediately without ever responding to this request, so this
			// call may time out rather than resolve - _withConfigSession's finally still runs either way
			await this._queueMessage(soap.action.reboot, message);
			return true; // reboot initiated
		}, (err) => new Error(`Reboot request failed. (config started failure: ${err})`));
	}

	/**
	* Check present firmware level, and new firmware level if available
	* @returns {Promise<newFirmwareInfo>}
	*/
	async checkNewFirmware() {
		const result = await tryInOrder([
			{ label: 2, fn: () => this._queueMessage(soap.action.checkAppNewFirmware, soap.checkAppNewFirmware(this.sessionId)) },
			{ label: 1, fn: () => this._queueMessage(soap.action.checkNewFirmware, soap.checkNewFirmware(this.sessionId)) },
		], (label) => { this.checkNewFirmwareMethod = label; });
		// methods 1 and 2 wrap these same three fields in differently-named response elements
		// (CheckNewFirmwareResponse vs CheckAppNewFirmwareResponse) - but tryInOrder's onAttempt
		// already told us which one just succeeded (this.checkNewFirmwareMethod), so scope
		// parseSoapObject to the matching wrapper instead of an unscoped whole-envelope regex
		// search (which could in principle pick up a same-named tag anywhere else in the body).
		const responseKey = this.checkNewFirmwareMethod === 2 ? 'CheckAppNewFirmwareResponse' : 'CheckNewFirmwareResponse';
		const info = xml.parseSoapObject(result.body, responseKey);
		// parseSoapObject normalizes an empty tag (e.g. <NewVersion></NewVersion>, real and
		// common when no update is available) to undefined; the original regex-based extraction
		// returned '' for the same case, matching the documented newFirmwareInfo typedef - restore
		// that exact shape rather than letting it silently change to undefined.
		return {
			currentVersion: info.CurrentVersion ?? '',
			newVersion: info.NewVersion ?? '',
			releaseNote: info.ReleaseNote ?? '',
		};
	}

	/**
	* Update the firmware of the router
	* @returns {Promise<finished>}
	*/
	async updateNewFirmware() {
		const message = soap.updateNewFirmware(this.sessionId);
		await this._queueMessage(soap.action.updateNewFirmware, message).catch(() => false);
		return true; // firmware update request successfull
	}

	/**
	* Perform Internet bandwidth speedtest (Note: takes a minute to respond)
	* @returns {Promise<speed>}
	*/
	async speedTest() {
		await this._speedTestStart();
		await timersPromises.setTimeout(55 * 1000);
		return this._getSpeedTestResult();
	}

	/**
	* Send Wake On Lan command to a mac address
	* @param {string} MAC - MAC address of the device to wake.
	* @param {string} [secureOnPassword = '00:00:00:00:00:00'] - optional WOL Password.
	* @returns {Promise<finished>}
	*/
	async wol(MAC, secureOnPassword) {
		const options = {
			port: 9,
			address: '255.255.255.255',
		};
		return this._sendWol(MAC, secureOnPassword, options);
	}

	/**
	* Get the list of Orbi mesh satellites.
	* EXPERIMENTAL: this response shape is inferred from the pynetgear Python library
	* (https://github.com/MatMaul/pynetgear), used by Home Assistant, and has not been
	* verified against real Orbi hardware by this package - please report results via a
	* GitHub issue.
	* @returns {Promise.<object[]>}
	*/
	async getAllSatellites() {
		const message = soap.getAllSatellites(this.sessionId);
		const result = await this._queueMessage(soap.action.getAllSatellites, message);
		const rawJson = xml.parseSoapTree(result.body, { nativeType: true });
		const currentSatellites = xml.resolveSoapPath(rawJson, ['GetAllSatellitesResponse', 'CurrentSatellites']);
		if (!currentSatellites || typeof currentSatellites !== 'object') return [];
		const entries = Object.values(currentSatellites)[0];
		const satellites = Array.isArray(entries) ? entries : [entries].filter(Boolean);
		return satellites.map((satellite) => xml.flattenEntries(satellite));
	}

	/**
	* Get the WPA passphrase for the 2.4GHz network.
	* Confirmed against a real captured SOAP log from a Netgear R8000
	* (https://github.com/MatMaul/pynetgear/issues/20), though not tested by this package
	* against live hardware.
	* @returns {Promise.<object>}
	*/
	async getWPASecurityKeys() {
		const message = soap.getWPASecurityKeys(this.sessionId);
		const result = await this._queueMessage(soap.action.getWPASecurityKeys, message);
		return xml.parseSoapObject(result.body, 'GetWPASecurityKeysResponse', { stripNewPrefix: true });
	}

	/**
	* Get the WPA passphrase for the 5GHz-2 network. See getWPASecurityKeys.
	* @returns {Promise.<object>}
	*/
	async get5GWPASecurityKeys() {
		const message = soap.get5GWPASecurityKeys(this.sessionId);
		const result = await this._queueMessage(soap.action.get5GWPASecurityKeys, message);
		return xml.parseSoapObject(result.body, 'Get5GWPASecurityKeysResponse', { stripNewPrefix: true });
	}

	/**
	* Get the WPA passphrase for the 5GHz-1 network (tri-band routers only). See getWPASecurityKeys.
	* @returns {Promise.<object>}
	*/
	async get5G1WPASecurityKeys() {
		const message = soap.get5G1WPASecurityKeys(this.sessionId);
		const result = await this._queueMessage(soap.action.get5G1WPASecurityKeys, message);
		return xml.parseSoapObject(result.body, 'Get5G1WPASecurityKeysResponse', { stripNewPrefix: true });
	}

	/**
	* Get all known parental-control MAC addresses.
	* Confirmed against a real captured SOAP log from a Netgear R8000
	* (https://github.com/MatMaul/pynetgear/issues/20), though not tested by this package
	* against live hardware, and the captured example response was empty (no devices), so the
	* exact list format when populated is unconfirmed.
	* @returns {Promise.<object>}
	*/
	async getAllMACAddresses() {
		const message = soap.getAllMACAddresses(this.sessionId);
		const result = await this._queueMessage(soap.action.getAllMACAddresses, message);
		return xml.parseSoapObject(result.body, 'GetAllMACAddressesResponse', { stripNewPrefix: true });
	}

	_speedTestStart() { // resolves true once the speedtest is initiated
		return this._setViaConfigSession(soap.speedTestStart, soap.action.speedTestStart);
	}

	async _getSpeedTestResult() {
		// resultcode 001 or 002 = no results yet?
		const message = soap.speedTestResult(this.sessionId);
		const result = await this._queueMessage(soap.action.speedTestResult, message);
		const info = xml.parseSoapObject(result.body, 'GetOOKLASpeedTestResultResponse');
		const uplinkBandwidth = Number(info.NewOOKLAUplinkBandwidth);
		const downlinkBandwidth = Number(info.NewOOKLADownlinkBandwidth);
		const averagePing = Number(info.AveragePing);
		return { uplinkBandwidth, downlinkBandwidth, averagePing };
	}

	async _getAttachedDevices() {
		// Resolves array of connected devices to the router (v1, pipe/semicolon-delimited). Rejects if error occurred.
		const message = soap.attachedDevices(this.sessionId);
		const result = await this._queueMessage(soap.action.getAttachedDevices, message);
		const body = xml.unescapeXmlEntities(result.body);
		// extractXmlTag deliberately: content is a custom '@'/';'-delimited list, not further XML.
		const raw = xml.extractXmlTag(body, 'NewAttachDevice', { multiline: true });
		const entries = raw.split('@');
		const devices = [];
		entries.forEach((entry, index) => {
			const info = entry.split(';');
			// info must be larger then 0 chars
			if (info.length === 0) throw new Error('Error parsing device-list (method 1)');
			// check if first entry is number of entries
			if (index === 0 && info.length === 1) {
				if (Number(entry) !== entries.length - 1) throw new Error('Error parsing device-list - number mismatch (method 1)');
				return;
			}
			// error when not enough info elements
			if (info.length < 5) throw new Error('Error parsing device-list - not enough elements (method 1)');
			// throw error on invalid mac format
			if (info[3].length !== 17) throw new Error('Error parsing device-list - invalid mac format (method 1)');
			const device = new AttachedDevice();
			device.IP = info[1];		// e.g. '10.0.0.10'
			device.Name = info[2];	// '--' for unknown
			device.MAC = info[3];		// e.g. '61:56:FA:1B:E1:21'
			device.ConnectionType = 'unknown';	// 'wired' or 'wireless'
			device.Linkspeed = 0;		// number >= 0, or NaN for wired linktype
			device.SignalStrength = 0;	// number <= 100
			device.AllowOrBlock = 'unknown';		// 'Allow' or 'Block'
			// Not all routers will report link type and rate
			if (info.length >= 7) {
				device.ConnectionType = info[4];
				device.Linkspeed = parseInt(info[5], 10);
				device.SignalStrength = parseInt(info[6], 10);
			}
			if (info.length >= 8) {
				device.AllowOrBlock = info[7];
			}
			devices.push(device);
		});
		return devices;
	}

	async _getAttachedDevices2() {
		// Resolves array of connected devices to the router (v2, full XML). Rejects if error occurred.
		const message = soap.attachedDevices2(this.sessionId);
		const result = await this._queueMessage(soap.action.getAttachedDevices2, message);
		const rawJson = xml.parseSoapTree(result.body, { nativeType: true });
		const rawEntries = xml.resolveSoapPath(rawJson, ['GetAttachDevice2Response', 'NewAttachDevice', 'Device']);
		// a single repeated <Device> element parses as one object rather than a 1-item array
		// (there's no schema telling the parser it can repeat) - normalize, the same way
		// getAllSatellites already does for the identical shape.
		if (!rawEntries || (!Array.isArray(rawEntries) && typeof rawEntries !== 'object')) throw new Error('Error parsing device-list');
		const entries = Array.isArray(rawEntries) ? rawEntries : [rawEntries];
		return entries.map((entry) => {
			const device = xml.flattenEntries(entry);
			if (device.MAC.length !== 17) throw new Error('Error parsing device-list');
			return device;
		});
	}

	// true or false; enable or disable 2.4Ghz-1 Guest Wifi
	_setGuestAccessEnabled(enabled) {
		return this._setViaConfigSession(soap.setGuestAccessEnabled, soap.action.setGuestAccessEnabled, enabled);
	}

	// true or false; enable or disable 2.4Ghz-1 Guest Wifi on certain routers like R8000
	_setGuestAccessEnabled2(enabled) {
		return this._setViaConfigSession(soap.setGuestAccessEnabled2, soap.action.setGuestAccessEnabled2, enabled);
	}

	// true or false; enable or disable 5Ghz-1 Guest Wifi
	_set5G1GuestAccessEnabled(enabled) {
		return this._setViaConfigSession(soap.set5G1GuestAccessEnabled, soap.action.set5G1GuestAccessEnabled, enabled);
	}

	// true or false; enable or disable 5Ghz-1 Guest Wifi on certain routers like R8000
	_set5G1GuestAccessEnabled2(enabled) {
		return this._setViaConfigSession(soap.set5G1GuestAccessEnabled2, soap.action.set5G1GuestAccessEnabled2, enabled);
	}

	// true or false; enable or disable 5Ghz-2 Guest Wifi on certain routers like R8000
	_set5GGuestAccessEnabled2(enabled) {
		return this._setViaConfigSession(soap.set5GGuestAccessEnabled2, soap.action.set5GGuestAccessEnabled2, enabled);
	}

	// Runs fn() bracketed by ConfigurationStarted/ConfigurationFinished SOAP calls, matching
	// the ~12 setters/getters that need this, plus reboot() (via the optional onStartError
	// callback below). The original only sent ConfigurationFinished after fn() resolved - if
	// fn() threw, configStarted stayed stuck true, and since this.configStarted and
	// _configurationFinished() were already shared/centralized in the original (not per-method
	// state), that stuck flag could affect every subsequent config-session call, not just the
	// one that failed. Fixed here with try/finally so ConfigurationFinished always runs. Its own
	// failure is still not fatal to the caller (config-session setters keep resolving true even
	// if the router-side close fails) but is no longer silently discarded either - it's recorded
	// on this.lastResponse, the same diagnostic surface _discoverHostInfo etc. already use.
	// @param {function} [onStartError] - maps a ConfigurationStarted failure to a different
	//   error before it's thrown (reboot() uses this for a more specific message); omit to
	//   throw the ConfigurationStarted failure unmodified.
	async _withConfigSession(fn, onStartError) {
		await this._configurationStarted().catch((err) => {
			throw onStartError ? onStartError(err) : err;
		});
		try {
			return await fn();
		} finally {
			await this._configurationFinished().catch((error) => {
				this.lastResponse = error;
				this._log('warn', 'ConfigurationFinished failed', { error: error.message });
			});
		}
	}

	// Shared by the ~12 setters below that all reduce to the same shape: build a SOAP
	// message, send it inside a config session, resolve true. `setBlockDevice` (resolves the
	// MAC, not true) and `setWifiChannel` (branches over 3 possible actions) don't fit this
	// shape and stay hand-written. `setNetgearDeviceName` and `updateNewFirmware` also don't use
	// this helper, but for a different reason: neither wrapped its SOAP call in a config session
	// in the original v4.4.3 either, so they stay as plain queueMessage calls to match.
	_setViaConfigSession(soapBuilder, action, ...args) {
		return this._withConfigSession(async () => {
			const message = soapBuilder(this.sessionId, ...args);
			await this._queueMessage(action, message);
			return true;
		});
	}

	async _configurationStarted() {
		try {
			const message = soap.configurationStarted(this.sessionId);
			await this._queueMessage(soap.action.configurationStarted, message);
			this.configStarted = true;
			return true;
		} catch (error) {
			throw new Error(`Config started error: ${error}`);
		}
	}

	async _configurationFinished() {
		try {
			if (this.configStarted === false) return true; // already finished
			this.configStarted = false;
			const message = soap.configurationFinished(this.sessionId);
			await this._queueMessage(soap.action.configurationFinished, message)
				.catch((err) => {	// config finished failed...
					this.configStarted = true;
					throw err;
				});
			return true;
		} catch (error) {
			throw new Error(`Config finished error: ${error}`);
		}
	}

	async _discoverHostInfo(options) { // e.g. { family: 4, 6, or 0 }
		// returns the netgear router info including host IP address, or throws an error
		try {
			let info;
			// first try routerlogin.net
			const host = await dns.lookup('routerlogin.net', options).catch(() => undefined); // orbilogin.com/net has redirects?
			if (host) info = await this.getCurrentSetting(host.address || host).catch(() => undefined); // weird, sometimes it doesn't have .address
			// else try ip scanning
			if (!info) [info] = await this._discoverAllHostsInfo();
			this._log('info', 'Router discovered', { host: info && info.host });
			return info; // info.host has the ipAddress
		} catch (error) {
			this.lastResponse = error;
			this._log('warn', 'Router discovery failed', { error: error.message });
			throw error;
		}
	}

	async _discoverAllHostsInfo() {
		// returns an array of info on all discovered netgears, assuming class C network, or throws an error
		try {
			const hostsToTest = [];	// array of all host IP's in the LAN
			const networks = [];
			const ifaces = os.networkInterfaces();	// get ip address info from all network interfaces
			Object.keys(ifaces).forEach((ifName) => {
				ifaces[ifName].forEach((iface) => {
					if (iface.family === 'IPv4' && !iface.internal) {
						networks.push(iface);
					}
				});
			});
			networks.forEach((network) => {
				for (let host = 1; host <= 254; host += 1) {
					hostsToTest.push(network.address.replace(/\.\d+$/, `.${host}`));
				}
			});
			// temporarily set http timeout to 4 seconds; cap concurrent probes rather than firing
			// all (up to 254) at once - this doesn't go through the request queue (that paces
			// authenticated calls to one router, not a scan of many different hosts)
			const allHosts = await mapWithConcurrency(
				hostsToTest,
				32,
				(hostToTest) => this.getCurrentSetting(hostToTest, 4000).catch(() => undefined),
			);
			const discoveredHosts = allHosts.filter((host) => host);
			if (!discoveredHosts[0]) throw new Error('No Netgear router could be discovered');
			return discoveredHosts;
		} catch (error) {
			this.lastResponse = error;
			this._log('warn', 'Network scan discovery failed', { error: error.message });
			throw error;
		}
	}

	// Shared by _makeRequest (the authenticated, response-code-interpreting path) and
	// _probeSoapEndpoint (a bare "does anything answer" check): both send a SOAP POST with
	// the same headers shape, differing only in which action/host/port/tls/timeout to use.
	async _soapRequest(action, message, opts = {}) {
		const {
			host = this.host, port = this.port, tls = this.tls, timeout = this.timeout,
		} = opts;
		const headers = {
			soapaction: action,
			'cache-control': 'no-cache',
			'user-agent': 'node-netgearjs',
			'content-type': 'multipart/form-data',
		};
		if (this.cookie) headers.cookie = Array.isArray(this.cookie) ? this.cookie.join('; ') : this.cookie;
		const url = `${tls ? 'https' : 'http'}://${host}:${port}/soap/server_sa/`;
		this._log('debug', 'SOAP request', {
			action, host, port, tls, body: redactBody(message),
		});
		const startedAt = Date.now();
		const result = await http.request(url, {
			method: 'POST', headers, body: message, timeout, insecure: tls,
		});
		this._log('debug', 'SOAP response', {
			action, host, port, statusCode: result.statusCode, durationMs: Date.now() - startedAt, body: redactBody(result.body),
		});
		return result;
	}

	async _probeSoapEndpoint(host, port, tls) {
		// probes whether a SOAP endpoint responds at all (used by _getSoapPort); never throws
		const message = soap.getInfo(this.sessionId);
		const result = await this._soapRequest(soap.action.getInfo, message, {
			host, port, tls, timeout: 3000,
		}).catch(() => null);
		return !!(result && typeof result.body === 'string' && result.body.includes('<ResponseCode>'));
	}

	async _getSoapPort(host1) {
		// returns the soap port (80, 443, 5000, 5043 or 5555), or undefined if none respond
		if (!host1 || host1 === '') throw new Error('getSoapPort failed: Host ip is not provided');
		const candidates = [
			{ port: 443, tls: true },
			{ port: 5043, tls: true },
			{ port: 5555, tls: true },
			{ port: 5000, tls: false },
			{ port: 80, tls: false },
		];
		// probe all candidates concurrently (rather than one at a time), through the same
		// rate-limited queue every other SOAP call goes through - so a port scan can't burst the
		// router with 5 simultaneous unthrottled requests - and pick the earliest-listed responder,
		// preserving the original priority order
		const results = await Promise.all(
			candidates.map(({ port, tls }) => this.queue.enqueue(() => this._probeSoapEndpoint(host1, port, tls))),
		);
		const index = results.findIndex(Boolean);
		return index === -1 ? undefined : candidates[index].port;
	}

	async _sendWol(mac, secureOnPassword, options) {
		// check if mac is valid
		const macPatched = mac.replace(/:/g, '');
		if (macPatched.length !== 12 || macPatched.match(/[^a-fA-F0-9]/)) {
			throw new Error(`Invalid MAC address: ${mac}`);
		}
		// check if password is valid
		const password = secureOnPassword || '00'.repeat(6);
		const passwordPatched = password.replace(/:/g, '');
		if (passwordPatched.length !== 12 || passwordPatched.match(/[^a-fA-F0-9]/)) {
			throw new Error(`Invalid secureOn password: ${secureOnPassword}`);
		}
		// create magic packet
		const magicPacket = Buffer.from('ff'.repeat(6) + macPatched.repeat(16) + passwordPatched, 'hex');
		// set the options to broadcast on port 9
		await this._makeUdpRequest(options, magicPacket);
		return mac;
	}

	async _makeRequest(action, message) {
		try {
			if (!this.loggedIn && action !== soap.action.login && action !== soap.action.loginOld) {
				throw new Error('Not logged in');
			}
			const result = await this._soapRequest(action, message);
			this.lastResponse = result.body;
			if (result.headers['set-cookie']) this.cookie = result.headers['set-cookie'];
			if (result.statusCode !== 200) {
				this.lastResponse = result.statusCode;
				throw errors.httpRequestFailed(result.statusCode);
			}
			// extractXmlTag deliberately: <ResponseCode> is a sibling of the action's own response
			// element, not nested inside it, and this runs before any action-specific parsing knows
			// (or cares) what that element is named - parseSoapObject has nothing to descend into here.
			const responseCode = xml.extractXmlTag(result.body, 'ResponseCode', { optional: true });
			if (responseCode === undefined) throw errors.noResponseCode();
			const code = Number(responseCode);
			if (code === 0) {
				const patchedBody = xml.patchBody(result.body);
				if (!patchedBody.includes('</v:Envelope>')) throw errors.incompleteSoapEnvelope();
				return { ...result, body: patchedBody };
			}
			// request failed
			if (code === 401) this.loggedIn = false;
			throw errors.soapResponseCode(code);
		} catch (error) {
			// logged at 'debug', not 'warn': many call sites (login()'s fallback ladder,
			// checkNewFirmware, guest-wifi tryInOrder, getAttachedDevices auto mode) intentionally
			// try a method that's expected to sometimes fail before falling back to another one -
			// those top-level methods log their own 'warn'/'info' once the overall outcome is known.
			this._log('debug', 'SOAP request failed', { action, error: error.message });
			throw error;
		}
	}

	// queue stuff
	_queueMessage(action, msg) {
		return this.queue.enqueue(() => this._makeRequest(action, msg));
	}

	_makeUdpRequest(options, msg) {
		return new Promise((resolve, reject) => {
			const broadcast = '255.255.255.255';
			const client = dgram.createSocket('udp4');
			client.once('listening', () => {
				client.setBroadcast(options.address === broadcast);
			});
			client.on('error', (e) => {
				client.close();
				this.lastResponse = e;
				reject(e);
			});
			client.send(msg, options.port, options.address, (e) => {
				client.close();
				if (e) {
					this.lastResponse = e;
					return reject(e);
				}
				return resolve(true);
			});
		});
	}

}

module.exports = NetgearRouter;

// definitions for JSDoc

/**
* @class NetgearRouter
* @classdesc Class representing a session with a Netgear router. Every method still
	rejects/throws exactly as documented below on failure - that error handling is
	unchanged. On top of that, this class extends Node's EventEmitter and emits a 'log'
	event ({@link logEvent}) as a separate, supplementary diagnostic channel for detail
	that doesn't fit in a thrown Error's message (request/response tracing, notable
	outcomes like login success/failure, discovery, etc) - it never replaces or changes
	what gets thrown. Nothing is written to the console directly - subscribe to 'log' to
	route it into your own logger (e.g. a Homey app's `this.log()`/`this.error()`, so the
	detail ends up in a diagnostics report). The `logLevel` session option (default 'warn')
	controls verbosity; set it to 'debug' for full SOAP request/response tracing
	(credentials are always redacted before logging).
* @param {sessionOptions} [options] - configurable session options
* @property {boolean} loggedIn - login state.
* @property {string} logLevel - current log verbosity ('silent'|'error'|'warn'|'info'|'debug'),
	mutable at any time.
* @example // create a router session, login to router, fetch attached devices
	const Netgear = require('netgear');

	const router = new Netgear();
	router.on('log', ({ level, message, ...context }) => console.log(level, message, context));

	async function getDevices() {
		try {
			const options = { password: 'myPassword' };
			await router.login(options);
			const deviceArray = await router.getAttachedDevices();
			console.log(deviceArray);
		} catch (error) {
			console.log(error);
		}
	}

	getDevices();
*/

/**
* @typedef sessionOptions
* @description Set of configurable options to set on the router class
* @property {string} [password = 'password'] - The login password. Defaults to 'password'.
* @property {string} [username = 'admin'] - The login username. Defaults to 'admin'.
* @property {string} [host = 'routerlogin.net'] - The url or ip address of the router. Leave undefined to try autodiscovery.
* @property {number} [port = 80] - The SOAP port of the router. Leave undefined to try autodiscovery.
* @property {number} [method = 0] - 0: auto, 1: v1 (old), 2: v2 (new)
* @property {number} [timeout = 18000] - http(s) timeout in milliseconds. Defaults to 18000ms.
* @property {boolean} [tls = false] - Use TLS/SSL (HTTPS) for SOAP calls. Defaults to false.
* @property {string} [logLevel = 'warn'] - One of 'silent', 'error', 'warn', 'info', 'debug'.
	Controls which 'log' events (see NetgearRouter's class description) get emitted. Also settable
	at any time via `router.logLevel = 'debug'`.
* @example // router options
{ password: 'mySecretPassword',
  host:'routerlogin.net',
  port: 5000,
  timeout: 19000,
  tls: false,
  logLevel: 'warn' }
*/

/**
* @typedef logEvent
* @description Payload of the 'log' event emitted by a NetgearRouter instance. This is a
	supplementary diagnostic channel only - it runs alongside, not instead of, each method's
	normal rejected/thrown Error, which is unaffected by whether anything subscribes to 'log'.
	Extra context fields vary by call site - common ones include `action` (the SOAP action
	name), `host`/`port`/`tls`, `statusCode`, `durationMs`, and `error` (a message string,
	not an Error instance). At logLevel 'debug', SOAP request/response events also include a
	`body` field (truncated, with `<Password>` redacted).
* @property {string} level - 'error', 'warn', 'info' or 'debug'.
* @property {string} message - short human-readable summary, e.g. 'SOAP request failed'.
* @property {string} timestamp - ISO 8601 timestamp of when the event was emitted.
*/

/**
* @typedef AttachedDevice
* @description Object representing the state of a device attached to the Netgear router, with properties similar to this.
* @property {string} ip - e.g. '10.0.0.10'
* @property {string} Name - '--' for unknown.
* @property {boolean} NameUserSet - e.g. false
* @property {string} MAC - e.g. '61:56:FA:1B:E1:21'
* @property {string} ConnectionType - e.g. 'wired', '2.4GHz', 'Guest Wireless 2.4G'
* @property {string} SSID - e.g. 'MyWiFi'
* @property {number} LinkSpeed - e.g. 38
* @property {number} SignalStrength - number <= 100
* @property {string} AllowOrBlock - e.g. 'Allow'
* @property {boolean} Schedule - e.g. false
* @property {number} DeviceType - e.g. 20
* @property {boolean} DeviceTypeUserSet - e.g. true
* @property {string} DeviceTypeName - e.g. ''
* @property {string} DeviceModel - e.g. ''
* @property {boolean} DeviceModelUserSet - e.g. false
* @property {number} Upload - e.g. 0
* @property {number} Download - e.g. 0
* @property {number} QosPriority - e.g. 2
* @property {number} Grouping - e.g. 0
* @property {number} SchedulePeriod - e.g. 0
* @property {string} ConnAPMAC - e.g. ''
* @example // AttachedDevice
{ IP: 192.168.1.24,
  Name: 'MyIPHONE',
  NameUserSet: true,
  MAC: 'E1:4F:25:68:34:BA',
  ConnectionType: '2.4GHz',
  SSID: 'MyNetworkID',
  Linkspeed: 70
  SignalStrength: 64,
  AllowOrBlock: 'Allow',
  Schedule: 'false',
  DeviceType: 17,
  DeviceTypeUserSet: true,
  DeviceTypeName: '',
  DeviceModelUserSet: false,
  Upload: 0,
  Download: 0,
  QosPriority: 3,
  Grouping: 0,
  SchedulePeriod: 0,
  ConnAPMAC: '' }
*/

/**
* @typedef allowedDevice
* @description allowedDevice is an object with these properties.
* @property {string} MAC - e.g. '61:56:FA:1B:E1:21'
* @property {string} Name - '--' for unknown
* @property {string} ConnectionType - e.g. 'wired', '2.4GHz', 'Guest Wireless 2.4G'
* @example // allowedDevice
{ MAC: '6F:A1:F8:04:9F:E2',
  Name: 'OPENELEC',
  ConnectionType: 'wireless' }
*/

/**
* @typedef currentSetting
* @description currentSetting is an object with properties similar to this.
* @property {string} Firmware: e.g. 'V1.0.2.60WW'
* @property {string} RegionTag e.g. 'R7800_WW'
* @property {string} Region e.g. 'ww'
* @property {string} Model  e.g. 'R7800'
* @property {string} InternetConnectionStatus e.g. 'Up'
* @property {string} ParentalControlSupported e.g. '1'
* @property {string} SOAPVersion e.g. '3.43'
* @property {string} ReadyShareSupportedLevel e.g. '29'
* @property {string} XCloudSupported e.g. '1'
* @property {string} LoginMethod e.g. '2.0'
* @property {string} host e.g. '192.168.1.1'
* @property {number} port e.g. 80
* @property {boolean} TLS e.g. true
* @example // currentSetting (depending on router type)
{ Firmware: 'V1.0.2.60WW',
  RegionTag: 'R7800_WW',
  Region: 'ww',
  Model: 'R7800',
  InternetConnectionStatus: 'Up',
  ParentalControlSupported: '1',
  SOAPVersion: '3.43',
  ReadyShareSupportedLevel: '29',
  XCloudSupported: '1',
  LoginMethod: '2.0',
  host: '192.168.1.1',
  port: 80
  TLS: false }
*/

/**
* @typedef info
* @description info is an object with properties similar to this.
* @property {string} ModelName e.g. 'R7800'
* @property {string} Description e.g. 'Netgear Smart Wizard 3.0, specification 1.6 version'
* @property {string} SerialNumber e.g. '1LG23B71067B2'
* @property {string} Firmwareversion  e.g. 'V1.0.2.60'
* @property {string} SmartAgentversion e.g. '3.0'
* @property {string} FirewallVersion e.g. 'net-wall 2.0'
* @property {string} VPNVersion e.g. undefined
* @property {string} OthersoftwareVersion e.g. 'N/A'
* @property {string} Hardwareversion e.g. 'R7800'
* @property {string} Otherhardwareversion e.g. 'N/A'
* @property {string} FirstUseDate e.g. 'Saturday, 20 Feb 2016 23:40:20'
* @property {string} DeviceName e.g. 'R7800'
* @property {string} FirmwareDLmethod e.g. 'HTTPS'
* @property {string} FirmwareLastUpdate e.g. '2018_10.23_11:47:18'
* @property {string} FirmwareLastChecked e.g. '2018_11.14_15:5:37'
* @property {string} DeviceMode e.g. '0' 0=router, 1=AP mode
* @property {string} DeviceModeCapability e.g. '0;1;2'
* @property {string} DeviceNameUserSet e.g. 'false'
* @example // info (depending on router type)
{ ModelName: 'R7800',
  Description: 'Netgear Smart Wizard 3.0, specification 1.6 version',
  SerialNumber: '**********',
  Firmwareversion: 'V1.0.2.60',
  SmartAgentversion: '3.0',
  FirewallVersion: 'net-wall 2.0',
  VPNVersion: undefined,
  OthersoftwareVersion: 'N/A',
  Hardwareversion: 'R7800',
  Otherhardwareversion: 'N/A',
  FirstUseDate: 'Sunday, 30 Sep 2007 01:10:03',
  DeviceName: 'R7800',
  FirmwareDLmethod: 'HTTPS',
  FirmwareLastUpdate: '2018_10.23_11:47:18',
  FirmwareLastChecked: '2018_11.25_20:29:3',
  DeviceMode: '0',
  DeviceModeCapability: '0;1;2',
  DeviceNameUserSet: 'false' }
*/

/**
* @typedef supportFeatureList
* @description supportFeatureList is an object with properties similar to this.
* @property {string} DynamicQoS e.g. '1.0'
* @property {string} OpenDNSParentalControl e.g. '1.0'
* @property {string} AccessControl e.g. '1.0'
* @property {string} SpeedTest  e.g. '2.0'
* @property {string} GuestNetworkSchedule e.g. '1.0'
* @property {string} TCAcceptance e.g. '1.0'
* @property {string} DeviceTypeIdentification e.g. '1.0'
* @property {string} AttachedDevice e.g. '2.0'
* @property {string} NameNTGRDevice e.g. '1.0'
* @property {string} SmartConnect e.g. '2.0'
* @property {string} MaxMonthlyTrafficLimitation e.g. '4095000000'
* @example // supportFeatureList (depending on router type)
{ DynamicQoS: '1.0',
  OpenDNSParentalControl: '1.0',
  AccessControl: '1.0',
  SpeedTest: '2.0',
  GuestNetworkSchedule: '1.0',
  TCAcceptance: '1.0',
  DeviceTypeIdentification: '1.0',
  AttachedDevice: '2.0',
  NameNTGRDevice: '1.0',
  SmartConnect: '2.0',
  MaxMonthlyTrafficLimitation: '4095000000' }
*/

/**
* @typedef trafficStatistics
* @description trafficStatistics is an object with these properties (in Mbytes).
* @property {number} newTodayUpload e.g. 561.29
* @property {number} newTodayDownload e.g. 5436
* @property {number} newMonthUpload e.g. 26909
* @property {number} newMonthDownload  e.g. 151850
* @example // trafficStatitics
{ newTodayUpload: 92.15,
  newTodayDownload: 743.3,
  newMonthUpload: 92.15,
  newMonthDownload: 743.3 }
*/

/**
* @typedef newFirmwareInfo
* @description newFirmwareInfo is an object with these properties.
* @property {string} currentVersion e.g. 'V1.0.2.60'
* @property {string} newVersion e.g. ''
* @property {string} releaseNote e.g. ''
* @example // newFirmwareInfo
{ currentVersion: 'V1.0.2.60', newVersion: '', releaseNote: '' }
*/

/**
* @typedef systemInfo
* @description systemInfo is an object with these properties.
* @property {number} NewCPUUtilization e.g. 21
* @property {number} NewPhysicalMemory e.g. 256
* @property {number} NewMemoryUtilization e.g. 72
* @property {number} NewPhysicalFlash e.g. 128
* @property {number} NewAvailableFlash e.g. 128
* @example // systemInfo
{ NewCPUUtilization: 21,
  NewPhysicalMemory: 256,
  NewMemoryUtilization: 72,
  NewPhysicalFlash: 128,
  NewAvailableFlash: 128 }
*/

/**
* @typedef LANConfig
* @description LANConfig is an object with properties similar to this.
* @property {string} NewLANSubnet e.g. '255.255.255.0'
* @property {string} NewWANLAN_Subnet_Match e.g. '1'
* @property {string} NewLANMACAddress e.g. 'B07AB9A81D1A'
* @property {string} NewLANIP e.g. '192.168.0.1'
* @property {string} NewDHCPEnabled e.g. 'true'
* @example // LANConfig
{ NewLANSubnet: '255.255.255.0',
  NewWANLAN_Subnet_Match: '1',
  NewLANMACAddress: 'B07FB9F81DEA',
  NewLANIP: '10.0.0.1',
  NewDHCPEnabled: 'true' }
*/

/**
* @typedef WANConfig
* @description WANConfig is an object with properties similar to this.
* @property {string} NewEnable e.g. '1'
* @property {string} NewConnectionType e.g. 'DHCP'
* @property {string} NewExternalIPAddress e.g. '66.220.144.18'
* @property {string} NewSubnetMask e.g. '255.255.255.0'
* @property {string} NewAddressingType e.g. 'DHCP'
* @property {string} NewDefaultGateway e.g. '66.220.144.254'
* @property {string} NewMACAddress e.g. 'B07AB9A81D1B',
* @property {string} NewMACAddressOverride e.g. '0',
* @property {string} NewMaxMTUSize e.g. '1500',
* @property {string} NewDNSEnabled e.g. '1',
* @property {string} NewDNSServers e.g. '66.220.144.254'
* @example // WANConfig
{ NewEnable: '1',
  NewConnectionType: 'DHCP',
  NewExternalIPAddress: '66.220.144.18',
  NewSubnetMask: '255.255.255.0',
  NewAddressingType: 'DHCP',
  NewDefaultGateway: '66.220.144.254',
  NewMACAddress: 'B07FB9F81DEB',
  NewMACAddressOverride: '0',
  NewMaxMTUSize: '1500',
  NewDNSEnabled: '1',
  NewDNSServers: '66.220.144.254' }
*/

/**
* @typedef portMapping
* @description portMapping is an object with properties similar to this.
* @property {number} NewPortMappingNumberOfEntries e.g. 0
* @property {object} NewPortMappingInfo e.g. undefined
* @example // portMapping
{ NewPortMappingNumberOfEntries: '0',
  NewPortMappingInfo: undefined }
*/

/**
* @typedef deviceConfig
* @description deviceConfig is an object with properties similar to this.
* @property {string} BlankState e.g. '0'
* @property {string} NewBlockSiteEnable e.g. '0'
* @property {string} NewBlockSiteName e.g. '0'
* @property {string} NewTimeZone e.g. '+2'
* @property {string} NewDaylightSaving e.g. '1'
* @example // deviceConfig
{ BlankState: '0',
  NewBlockSiteEnable: '0',
  NewBlockSiteName: '0',
  NewTimeZone: '+2',
  NewDaylightSaving: '1' }
*/

/**
* @typedef channels
* @description channels is an array with the available wifi channels.
* @example // channels
[ 'Auto', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13' ]
*/

/**
* @typedef logs
* @description logs is an array with the log events.
* @property {string} string the logentry as string
* @property {string} event the event type
* @property {string} info event information
* @property {object} ts timestamp of the event
* @example // parsed logs
[	{	string: '[admin login] from source 10.0.0.2, Wednesday, October 02, 2019 20:00:41',
		event: 'admin login',
		info: 'from source 10.0.0.2',
		ts: 1570039241000 },
	{	string: '[DHCP IP: 10.0.0.3] to MAC address e1:4f:25:68:34:ba, Wednesday, October 02, 2019 20:00:39',
		event: 'DHCP IP: 10.0.0.3',
		info: 'to MAC address e1:4f:25:68:34:ba',
		ts: 1570039239000 },
	{	string: '[LAN access from remote] from 77.247.108.110:55413 to 10.0.0.5:443, Wednesday, October 02, 2019 19:59:39',
		event: 'LAN access from remote',
		info: 'from 77.247.108.110:55413 to 10.0.0.5:443',
		ts: 1570039179000 } ]
 */
