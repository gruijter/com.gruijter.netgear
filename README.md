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
* send WakeOnLan (WOL) to a MAC address
* block and allow an attached device by MAC address
* enable and disable Guest Wifi
* perform internet speed test
* perform firmware upgrade
* reboot the router

![image][mobile-card-image]

![image][flow-cards-image]

![image][insights-image]

### Device setup in Homey ###
The app is intended for netgear devices that work in Router mode. When using the router in Access Point (AP) mode, you will not have all functionality, e.g. traffic statistics (up/download speed). Your Homey should be connected inside the LAN part of the router, not from outside (WAN). To setup go to "Devices" and add the Netgear router by filling in the admin password. After the router device is added successfully you can change the polling interval (set to 1 minute as default). The app will start collecting and remember MAC addresses of all devices that ever connected to the router. If you need to clear this list you can do so by checking the box "delete devicelist" in the device settings.

### Traffic meter and access control ###
On app startup, Homey will try to automatically enable traffic statistics (up/download speed) and access control (block/allow internet access for an attached device). The availablity of these functions depend ond router type, router mode and firmware level.

### Supported routers ###
In general: If you can use the Nighthawk or Genie app to manage the router, then this Homey app will most likely work. Some functionality, like blocking/unblocking an attached device, only work on certain router types. MAKE SURE YOU ARE ON THE LATEST ROUTER FIRMWARE!

You can check your router version by browsing to [routerlogin.net](http://routerlogin.net/currentsetting.htm). According to the Genie and NETGEAR Nighthawk app description, at least the following routers or extenders should work:

Nighthawk: AX8 AX12 Tri-Band AX12 XR300 XR450 XR500 XR700 AC2100 AC2400 AC2600 R9000 R8900 R8500 R8300 R8000 R8000P R7900P R7960P R7900 R7800 R7000P R7000 R6900P R6900v2 R6900 R6850 R6800 R7450 R6700v3 R6700v2 R6400v2 R6400 R6350 R6260 R6230 R6220 R6120 R6080 R6020

Nighthawk Extenders: EX7700

Other Wi-Fi Routers: Orbi AC1450 Centria (WNDR4700, WND4720) JNR1010 JNR3210 JR6150 JWNR2010 R6050 R6100 R6200  R6250 R6300 R7500 WNDR3400v2 WNDR3700v3 WNDR3800 WNDR4000 WNDR4300 WNDR4500 WNDRMAC WNR1000v2 WNR1500 WNR2020 WNR2020v2 WNR2000v3 WNR2200 WNR2500 WNR3500Lv2 WNR612v2 WNR614

DSL Modem Gateways: DGN2200B DGND3700B D3600 D6000 D6100 D6200 D6000 D6200B D6300 D6300B D6400 D7000 D7800 DGN1000 DGN2200v3 DGN2200v4 DGND3700v2 DGND3800B DGND4000

Cable Gateway: C7000 C6300 C6250 C3700 C3000 N450

### Compatibility test ###
If your router isn't working properly with this app, you can perform a compatibility test from the app settings tab. After performing the test you will be directed to the developer page on Github. Here you can create an issue, and paste the test result. Note: you need an account on Github to be able to create an issue.

![image][compatibility-test-image]

### Donate: ###
If you like the app you can show your appreciation by posting it in the [forum].
If you really like the app you can buy me a beer.

[![Paypal donate][pp-donate-image]][pp-donate-link]

===============================================================================

Version changelog: [changelog.txt]

[forum]: https://community.athom.com/t/2259
[pp-donate-link]: https://www.paypal.com/cgi-bin/webscr?cmd=_s-xclick&hosted_button_id=VB7VKG5Y28M6N
[pp-donate-image]: https://www.paypalobjects.com/en_US/i/btn/btn_donate_SM.gif
[mobile-card-image]: https://discourse-cdn-sjc1.com/business4/uploads/athom/original/2X/f/f202c133b76496a5b7e9f0714a86e38bf139ff31.png
[flow-cards-image]: https://discourse-cdn-sjc1.com/business4/uploads/athom/original/2X/6/602d209a4804d55ddcb1ac6f2ee925b2ca2e25dd.jpeg
[insights-image]: https://forum.athom.com/uploads/editor/qj/l7hpjcacn1qf.png
[compatibility-test-image]: https://discourse-cdn-sjc1.com/business4/uploads/athom/optimized/2X/6/68486f6ed7c8ec0acbdf4f5a9b360892b074f030_1_514x500.jpeg
[changelog.txt]: https://github.com/gruijter/com.gruijter.netgear/blob/master/changelog.txt
