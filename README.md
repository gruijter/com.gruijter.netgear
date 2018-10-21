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
* results of internet speed test
* new router firmware available

Do:
* block and allow an attached device by MAC address
* enable and disable Guest Wifi
* perform internet speed test
* perform firmware upgrade
* reboot the router

![image][mobile-card-image]

![image][flow-cards-image]

![image][insights-image]

### Device setup in Homey ###
Only netgear devices that work in router mode can be added. Your Homey should be connected inside the LAN part of the router, not from outside (WAN). To setup go to "Devices" and add the Netgear router by filling in the admin password. The other fields can be left on default, unless you know what you are doing :). After the router device is added successfully you can change the polling interval (set to 1 minute as default). The app will start collecting and remember MAC addresses of all devices that ever connected to the router. If you need to clear this list you can do so by checking the box "delete devicelist" in the device settings.

### One time setup of the router ###
For Homey to get all the functionality you need to do some one time settings in the router. Depending on the router type and firmware you might not have some of this functionality. Make sure you are on the latest router firmware.
- For up/download speed, enable the traffic statistics: routerlogin.net > advanced setup > traffic meter.
- To be able to block or allow a device, enable access control: routerlogin.net > advanced > security > access control.

### Supported routers ###
In general: If you can use the genie app to manage the router then my app will likely do something. The app has been confirmed to work with WNDR4500v2, R6250, R7000, R7800, R8000 and Orbi.
You can check your router version by browsing to http://routerlogin.net/currentsetting.htm . According to the NETGEAR Genie app description, the following routers might work:

Wi-Fi Routers: Orbi AC1450 Centria (WNDR4700, WND4720) JNR1010 JNR3210 JR6150 JWNR2010 R6050 R6100 R6200 R6220 R6250 R6300 R6400 R6700 R6900 R7000 R7500 R7500 R7800 R7900 R8000 R8300 R8500 R9000 WNDR3400v2 WNDR3700v3 WNDR3800 WNDR4000 WNDR4300 WNDR4500 WNDRMAC WNR1000v2 WNR1500 WNR2020 WNR2020v2 WNR2000v3 WNR2200 WNR2500 WNR3500Lv2 WNR612v2 WNR614

DSL Modem Gateways: DGN2200B DGND3700B D3600 D6000 D6100 D6200 D6000 D6200B D6300 D6300B D6400 D7000 D7800 DGN1000 DGN2200v3 DGN2200v4 DGND3700v2 DGND3800B DGND4000

Cable Gateway: C7000 C6300 C6250 C3700 C3000 N450

### Compatibility test ###
If your router isn't working properly with this app, you can perform a compatibility test from the app settings tab. After performing the test you will be directed to the developer page on Github. Here you can create an issue, and paste the test result. Note: you need an account on Github to be able to create an issue.

### Donate: ###
If you like the app you can show your appreciation by posting it in the [forum].
If you really like the app you can buy me a beer.

[![Paypal donate][pp-donate-image]][pp-donate-link]

===============================================================================

Version changelog

```
v2.0.8	2018.10.21 Netgear module updated to 3.0.3. More router types supported. New xml parser. Condition cards added. Router compatibility test added.
v2.0.7	2018.10.09 Netgear module updated to 2.2.0. Speedtest added. Fw update added. Guestwifi fix. Pairing fix.
v2.0.6	2018.09.29 GuestWifi2 support added.
v2.0.5	2018.08.19 Fix autoport detection. Netgear module update to 1.4.0
v2.0.4	2018.08.12 Reduce memory usage. Netgear module optimizations.
v2.0.3	2018.06.11 Fix autocomplete for corrupted devicelist. Small fixes.
v2.0.2	2018.03.24 Action card added for disable/enable guest wifi.
v2.0.1	2018.01.19 Hotfix. XML parser reverted.
v2.0.0	2018.01.15 Replaced the XML parser to a lightweight version
v1.3.1	2018.01.10 Minor fixes. Debug logger updated.
v1.3.0	2017.12.09 Fix option to empty the known devices list. Added automatic soap port detection during pairing.
v1.2.0	2017.11.29 Compatible routerlist greatly expanded. Bugfix up/down speed.
v1.0.0	2017.11.13 First stable release

```
[forum]: https://community.athom.com/t/https-apps-athom-com-app-com-gruijter-netgear/2259
[pp-donate-link]: https://www.paypal.com/cgi-bin/webscr?cmd=_s-xclick&hosted_button_id=VB7VKG5Y28M6N
[pp-donate-image]: https://www.paypalobjects.com/en_US/i/btn/btn_donate_SM.gif
[mobile-card-image]: https://discourse-cdn-sjc1.com/business4/uploads/athom/original/2X/f/f202c133b76496a5b7e9f0714a86e38bf139ff31.png
[flow-cards-image]: https://discourse-cdn-sjc1.com/business4/uploads/athom/original/2X/3/3b7c0f216becb52c0e5cb634601396f290159efb.png
[insights-image]: https://forum.athom.com/uploads/editor/qj/l7hpjcacn1qf.png
