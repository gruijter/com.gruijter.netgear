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

const StdOutFixture = require('fixture-stdout');
const fs = require('fs');

// fixture-stdout monkey-patches process.stdout/stderr.write globally and has no guard
// against stacking: each new StdOutFixture().capture() nests another wrapper on the write
// fn. If the app is re-inited within one process (a fresh captureLogs instance), a second
// set of fixtures would mean every write runs every past interceptor, and the outermost
// wrapper - living on the global process.stdout - pins the previous logArray/logger/app/
// device instances so nothing gets garbage collected. So the fixtures are installed
// exactly once per process here at module scope, and just repointed at whichever
// captureLogs instance is currently active.
let activeInstance = null;
let stdoutFixture = null;
let stderrFixture = null;

function installFixturesOnce(homey) {
  if (!stdoutFixture) {
    stdoutFixture = new StdOutFixture({ stream: process.stdout });
    stdoutFixture.capture((string) => {
      if (activeInstance) activeInstance.append(string);
    });
  }
  if (!stderrFixture) {
    stderrFixture = new StdOutFixture({ stream: process.stderr });
    stderrFixture.capture((string) => {
      if (activeInstance) activeInstance.append(string);
    });
  }
  homey.log('capturing stdout & stderr');
}

class captureLogs {

  // Log object to keep logs in memory and in persistent storage
  // captures and reroutes Homey's this.log (stdout) and this.err (stderr)

  constructor(opts) {
    this.homey = opts.homey;
    this.logName = opts.name || 'log';
    this.logLength = opts.length || 50;
    this.logFile = `/userdata/${this.logName}.json`;
    this.logArray = [];
    this.getLogs();
    activeInstance = this;
    installFixturesOnce(this.homey);
  }

  // called by the shared stdout/stderr fixtures for every captured write
  append(string) {
    if (this.logArray.length >= this.logLength) {
      this.logArray.shift();
    }
    this.logArray.push(string);
  }

  getLogs() {
    try {
      const log = fs.readFileSync(this.logFile, 'utf8');
      this.logArray = JSON.parse(log);
      this.homey.log('logfile retrieved');
      return this.logArray;
    } catch (error) {
      if (error.message.includes('ENOENT')) return [];
      this.homey.error('error parsing logfile: ', error.message);
      return [];
    }
  }

  saveLogs() {
    try {
      fs.writeFileSync(this.logFile, JSON.stringify(this.logArray));
      this.homey.log('logfile saved');
      return true;
    } catch (error) {
      this.homey.error('error writing logfile: ', error.message);
      return false;
    }
  }

  deleteLogs() {
    try {
      fs.unlinkSync(this.logFile);
      this.logArray = [];
      this.homey.log('logfile deleted');
      return true;
    } catch (error) {
      if (error.message.includes('ENOENT')) return false;
      this.homey.error('error deleting logfile: ', error.message);
      return false;
    }
  }

  // Only the currently-active instance may tear the shared fixtures down - otherwise a
  // late onUninit() from a superseded instance would rip capture away from the live one.
  releaseStdOut() {
    if (activeInstance && activeInstance !== this) return;
    if (stdoutFixture) {
      stdoutFixture.release();
      stdoutFixture = null;
    }
  }

  releaseStdErr() {
    if (activeInstance && activeInstance !== this) return;
    if (stderrFixture) {
      stderrFixture.release();
      stderrFixture = null;
    }
  }

}

module.exports = captureLogs;
