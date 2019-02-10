const Homey = require('homey');

module.exports = [
	{
		description: 'Show loglines',
		method: 'GET',
		path: '/getlogs/',
		requires_authorization: true,
		role: 'owner',
		fn: function fn(args, callback) {
			const result = Homey.app.getLogs();
			callback(null, result);
		},
	},
	{
		description: 'Delete logs',
		method: 'GET',
		path: '/deletelogs/',
		requires_authorization: true,
		role: 'owner',
		fn: function fn(args, callback) {
			const result = Homey.app.deleteLogs();
			callback(null, result);
		},
	},
	{
		description: 'perform Test',
		method: 'POST',
		path: '/runtest/',
		requires_authorization: true,
		role: 'owner',
		fn: async function fn(args, callback) {
			const result = await Homey.app.runTest(args.body);
			callback(null, result);
		},
	},
	{
		description: 'Auto Discover Router',
		method: 'GET',
		path: '/discover/',
		requires_authorization: true,
		role: 'owner',
		fn: async function fn(args, callback) {
			const result = await Homey.app.discover();
			callback(null, result);
		},
	},
	{
		description: 'Get known devices',
		method: 'GET',
		path: '/getkd/',
		requires_authorization: true,
		role: 'owner',
		fn: async function fn(args, callback) {
			const result = await Homey.app.getKnownDevices();
			callback(null, result);
		},
	},
];
