/*
Copyright 2017 - 2022, Robin de Gruijter (gruijter@hotmail.com)

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
const StdOutFixture = require('fixture-stdout');
const fs = require('fs');

class captureLogs {
	// Log object to keep logs in memory and in persistent storage
	// captures and reroutes Homey's this.log (stdout) and this.err (stderr)

	constructor(logName, logLength) {
		this.logName = logName || 'log';
		this.logLength = logLength || 50;
		this.logFile = `/userdata/${this.logName}.json`;
		this.logArray = [];
		this.getLogs();
		this.captureStdOut();
		this.captureStdErr();
	}

	getLogs() {
		try {
			const log = fs.readFileSync(this.logFile, 'utf8');
			this.logArray = JSON.parse(log);
			Homey.app.log('logfile retrieved');
			return this.logArray;
		} catch (error) {
			if (error.message.includes('ENOENT')) return [];
			Homey.app.error('error parsing logfile: ', error.message);
			return [];
		}
	}

	saveLogs() {
		try {
			fs.writeFileSync(this.logFile, JSON.stringify(this.logArray));
			Homey.app.log('logfile saved');
			return true;
		} catch (error) {
			Homey.app.error('error writing logfile: ', error.message);
			return false;
		}
	}

	deleteLogs() {
		try {
			fs.unlinkSync(this.logFile);
			this.logArray = [];
			Homey.app.log('logfile deleted');
			return true;
		} catch (error) {
			if (error.message.includes('ENOENT')) return false;
			Homey.app.error('error deleting logfile: ', error.message);
			return false;
		}
	}

	captureStdOut() {
		// Capture all writes to stdout (e.g. this.log)
		this.captureStdout = new StdOutFixture({ stream: process.stdout });
		this.captureStdout.capture((string) => {
			if (this.logArray.length >= this.logLength) {
				this.logArray.shift();
			}
			this.logArray.push(string);
			// return false;	// prevent the write to the original stream
		});
		Homey.app.log('capturing stdout');
		// captureStdout.release();
	}

	captureStdErr() {
		// Capture all writes to stderr (e.g. this.error)
		this.captureStderr = new StdOutFixture({ stream: process.stderr });
		this.captureStderr.capture((string) => {
			if (this.logArray.length >= this.logLength) {
				this.logArray.shift();
			}
			this.logArray.push(string);
			// return false;	// prevent the write to the original stream
		});
		Homey.app.log('capturing stderr');
		// captureStderr.release();
	}

	releaseStdOut() {
		this.captureStdout.release();
	}

	releaseStdErr() {
		this.captureStderr.release();
	}

}

module.exports = captureLogs;
