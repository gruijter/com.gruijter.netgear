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

// Waits `ms` using Homey's managed timer, so the wait is disposed of when the
// device/driver/app is destroyed instead of a raw setTimeout that keeps the
// event loop busy (and its .then() firing) after teardown. Pass a Homey
// instance, e.g. `settle(this.homey)` or `settle(device.homey)`.
module.exports = (homey, ms = 2000) => new Promise((resolve) => {
  homey.setTimeout(resolve, ms);
});
