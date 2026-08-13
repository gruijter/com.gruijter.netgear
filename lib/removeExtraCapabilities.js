'use strict';

const util = require('util');

const setTimeoutPromise = util.promisify(setTimeout);

// Removes any capabilities beyond `correctCaps` that are still installed on `device`
// (e.g. after a settings change makes the desired capability list shorter).
async function removeExtraCapabilities(device, correctCaps) {
  const currentCaps = await device.getCapabilities();
  const extraCaps = currentCaps.filter((cap) => !correctCaps.includes(cap));
  for (const cap of extraCaps) {
    device.log(`removing capability ${cap} for ${device.getName()}`);
    // eslint-disable-next-line no-await-in-loop
    await device.removeCapability(cap).catch((error) => device.log(error));
    // eslint-disable-next-line no-await-in-loop
    await setTimeoutPromise(2 * 1000); // wait a bit for Homey to settle
  }
}

module.exports = removeExtraCapabilities;
