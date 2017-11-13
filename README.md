# Netgear #

App to make Homey interact with Netgear routers.

See and log:
* internet connection status
* the internet upload and download speed
* the number of attached devices

Act on:
* detection of a new attached devices
* device coming online or going offline (presence)
* change of up/download speed
* change of internet connection status

Do:
* block and allow an attached device by MAC address
* reboot the router

![image][mobile-card-image]

![image][flow-cards-image]

![image][insights-image]

### Device setup in Homey ###
Only netgear devices that work in router mode can be added. Your Homey should be connected inside the LAN part of the router, not from outside (WAN). To setup go to "Devices" and add the Netgear router by filling in the admin password. The other fields can be left on default, unless you know what you are doing :). For some routertypes the SOAP port has to be changed to 80. After the router device is added successfully you can change the polling interval which is set to 1 minute as default.

### One time setup of the router ###
For Homey to get all the functionality you need to do some one time settings in the router. Depending on the router type and firmware you might not have some of this functionality. Make sure you are on the latest router firmware.
- For up/download speed, enable the traffic statistics: routerlogin.net > advanced setup > traffic meter.
- To be able to block or allow a device, enable access control: routerlogin.net > advanced > security > access control.

### Supported routers ###
In general: If you can use the genie app to manage the router then my app will likely do something. The app has been confirmed to work with WNDR4500v2, R6250, R7000 and R8000. Other types like Orbi and R7800 are still work in progress.
You can check your router version by browsing to http://routerlogin.net/currentsetting.htm . According to the NETGEAR Genie app description, the following routers might work:

Wi-Fi Routers: Orbi AC1450 Centria (WNDR4700, WND4720) JNR1010 JNR3210 JR6150 JWNR2010 R6050 R6100 R6200 R6220 R6250 R6300 R6400 R6700 R6900 R7000 R7500 R7500 R7800 R7900 R8000 R8300 R8500 R9000 WNDR3400v2 WNDR3700v3 WNDR3800 WNDR4000 WNDR4300 WNDR4500 WNDRMAC WNR1000v2 WNR1500 WNR2020 WNR2020v2 WNR2000v3 WNR2200 WNR2500 WNR3500Lv2 WNR612v2 WNR614

DSL Modem Gateways: DGN2200B DGND3700B D3600 D6000 D6100 D6200 D6000 D6200B D6300 D6300B D6400 D7000 D7800 DGN1000 DGN2200v3 DGN2200v4 DGND3700v2 DGND3800B DGND4000

Cable Gateway: C7000 C6300 C6250 C3700 C3000 N450

### Donate: ###
If you like the app you can show your appreciation by posting it in the [forum].
If you really like the app you can buy me a beer.

[![Paypal donate][pp-donate-image]][pp-donate-link]

<sup>btc: 14VR1QCpqWUWiSLa1sn3Dpzq3Wrp83zFfC</sup>

<sup>eth: 0xEcF4747203Eba214c071fDAa4825cD867B410d70</sup>

<sup>ltc: LfGJu1AdnPFMoBXwHvf2qG9sCV1onyXDvd</sup>

===============================================================================

Version changelog

```
v1.0.0	2017.11.13 First stable release

to do:
fix option to empty the known devices list (bugreport: https://github.com/athombv/homey-issues-dp/issues/126 ).
add support for r7800 and orbi (note: soap port is 80 for these devices)

```
[forum]: https://forum.athom.com/discussion/3532
[pp-donate-link]: https://www.paypal.com/cgi-bin/webscr?cmd=_s-xclick&hosted_button_id=VB7VKG5Y28M6N
[pp-donate-image]: https://www.paypalobjects.com/en_US/i/btn/btn_donate_SM.gif
[mobile-card-image]: https://forum.athom.com/uploads/editor/uy/8gbc8icfg8aj.png {:height="50%" width="50%"}
[flow-cards-image]: https://forum.athom.com/uploads/editor/bk/d0ckmek9ok0r.png | width=250
[insights-image]: https://forum.athom.com/uploads/editor/qj/l7hpjcacn1qf.png | width="50%"
