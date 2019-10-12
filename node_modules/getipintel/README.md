## Nodejs wrapper to communicate with getipintel.net API.

IP Intelligence is a service that determines how likely an IP address is a proxy / VPN / bad IP using advanced mathematical and modern computing techniques. This package allows you to test in near real time if an IP adress is 'bad' (e.g. known or suspected to be used by hackers).

### IMPORTANT: Read the terms of service here: [TOS](https://getipintel.net/free-proxy-vpn-tor-detection-api/#TOS "Terms of Service getipintel.net")

### Install:
If you don't have Node installed yet, get it from: [Nodejs.org](https://nodejs.org "Nodejs website").

To install the package:
```
> npm i getipintel
```

### Test:
From the folder in which you installed the  package, just run below command. To meet the terms of use
a valid contact email address must be provided.
```
> npm test contact=real@email.address ip=xx.xx.xx.xx
```


### Quickstart:

```
// create a session, do a quick test on an IP address
const GetIPIntel = require('getipintel');

const intel = new GetIPIntel({ contact: 'youremail@real.address' });

async function getIntel(IP, flags) {
	try {
		const result = await intel.getIntel(IP, flags);
		console.log(result);
	} catch (error) {
		console.log(error);
	}
}

getIntel('185.94.111.1');
```

## Detailed documentation:
[Detailed documentation](https://gruijter.github.io/getipintel.js/ "getipintel.js documentation")

