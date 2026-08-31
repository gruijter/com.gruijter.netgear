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

// The SOAP ports Netgear serves over TLS. Mirrors the netgear package's own private
// `tlsSoapPorts` list (netgear.js) - it isn't exported, so it has to be duplicated here.
// Keep in sync when the package changes it.
const TLS_SOAP_PORTS = [443, 5043, 5555];

// Whether a stored SOAP port should be talked to over TLS. The app always passes both
// `port` and `tls` to NetgearRouter, which pins tls (see the package's `tlsPinned`) and
// disables its autodiscovery of the setting - so this guess has to be right on its own.
module.exports = (port) => TLS_SOAP_PORTS.includes(Number(port));
