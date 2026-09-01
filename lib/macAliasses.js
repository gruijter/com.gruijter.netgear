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

// Normalizes a list of MAC strings into the lookup keys used against a router's
// knownDevices. Drops anything that isn't a MAC, and carries BOTH casings: alias fields
// are hand-typed (and only validated for length/colons), while knownDevices is keyed by
// whatever casing the router itself reports - so an alias typed in lower case would
// otherwise silently never match.
module.exports = (macs) => {
  const keys = new Set();
  (macs || []).forEach((mac) => {
    if (!mac || mac.length !== 17) return;
    keys.add(mac.toUpperCase());
    keys.add(mac.toLowerCase());
  });
  return [...keys];
};
