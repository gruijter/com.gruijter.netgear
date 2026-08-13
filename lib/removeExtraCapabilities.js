'use strict';

const util = require('util');

const setTimeoutPromise = util.promisify(setTimeout);

// Removes any capabilities beyond `correctCaps` that are still installed on `device`
// (e.g. after a settings change makes the desired capability list shorter).
async function removeExtraCapabilities(device, correctCaps) {
  const currentCaps = await device.getCapabilities();
  for (let i = correctCaps.length; i < currentCaps.length; i += 1) {
    device.log(`removing capability ${currentCaps[i]} for ${device.getName()}`);
    // eslint-disable-next-line no-await-in-loop
    await device.removeCapability(currentCaps[i]).catch((error) => device.log(error));
    // eslint-disable-next-line no-await-in-loop
    await setTimeoutPromise(3 * 1000); // wait a bit for Homey to settle
  }
}

module.exports = removeExtraCapabilities;
