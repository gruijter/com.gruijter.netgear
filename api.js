module.exports = {
	// retrieve logs
	async getLogs({ homey }) {
		const result = await homey.app.getLogs();
		return result;
	},
	// delete logs
	async deleteLogs({ homey }) {
		const result = await homey.app.deleteLogs();
		return result;
	},
	// discover Router
	async discover({ homey }) {
		const result = await homey.app.discover();
		return result;
	},
	// Get known devices logs
	async getkd({ homey }) {
		const result = await homey.app.getKnownDevices();
		return result;
	},
	// run router test
	async runTest({ homey, query }) {
		const result = await homey.app.runTest(query);
		// const result = await Homey.app.runTest(args.body);
		return result;
	},
};
