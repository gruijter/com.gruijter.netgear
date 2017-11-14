'use strict';

const fs = require('fs');
// const util = require('util');

class logs {
	// Log object to keep logs in memory and in persistent storage
	constructor(logName, logLength) {
		logName = logName || 'log';
		this.logLength = logLength || 50;
		this.logFile = `/userdata/${logName}.json`;
		this.logArray = [];
		this.getLogFile();
	}

	log(description, message) {
		if (message === undefined) {
			message = '';
		}
		message = message.stack || message;
		const logEntry = new Date().toISOString() + '  ' + description + ' ' + message;
		// console.log(`new logger entry`);
		if (this.logArray.length >= this.logLength) {
			this.logArray.shift();
		}
		this.logArray.push(logEntry);
	}

	getLogs() {
		return this.logArray;
	}

	getLogFile() {
		fs.readFile(this.logFile, 'utf8', (err, data) => {
			if (err) {
				console.log('error reading logfile: ', err);
			} else {
				try {
					this.logArray = JSON.parse(data);
					// console.log(this.logArray);
				} catch (err) {
					console.log('error parsing logfile: ', err);
				}
			}
		});
	}

	setLogFile() {
		fs.writeFile(this.logFile,  JSON.stringify(this.logArray), (err) => {
			if (err) {
				console.log('error writing logfile: ', err);
			} else {
				console.log('logfile saved');
			}
		});
	}

	unsetLogFile() {
		fs.unlink(this.logfile, (err) => {
			if (err) {
				console.log('error deleting logfile: ', err);
			}
		});
	}

}

module.exports = logs;
