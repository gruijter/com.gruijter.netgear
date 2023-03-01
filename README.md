# Netgear - Network control, Presence detection, Energy monitoring #

App to make Homey interact with Netgear routers.
* Monitor and control your wifi network and its connected devices
* Block the WiFi of your kids after dinner
* Presence detection based on smartphone WiFi
* Monitor the energy usage of your network devices, e.g. the T.V.

See and log:
* internet connection status
* the internet upload and download speed
* connection status of attached devices
* WiFi quality and bandwidth per device
* Energy use per device

Act on:
* device coming online or going offline (presence)
* device bandwidth or wifi link change
* detection of an unknown device connecting to the network
* alarm when internet connection goes down
* change of internet up/download speed
* results of internet speed test
* new router firmware available

Do:
* send WakeOnLan (WOL) to a MAC address
* block and allow an attached device by MAC address
* enable and disable Guest Wifi
* perform internet speed test
* perform firmware upgrade
* reboot the router


![image][flow-cards-image] ![image][flow-cards2-image]

![image][insights2-image] ![image][insights-image]

### Router device setup in Homey ###
The app is intended for netgear devices that work in Router mode. When using the router in Access Point (AP) mode, you will not have all functionality, e.g. traffic statistics (up/download speed). Your Homey should be connected inside the LAN part of the router, not from outside (WAN). To setup go to "Devices" and add the Netgear router by filling in the admin password. After the router device is added successfully you can change the polling interval (set to 1 minute as default). On app startup, Homey will try to automatically enable traffic statistics (up/download speed) and access control (block/allow internet access for an attached device). The availablity of these functions depend ond router type, router mode and firmware level. The app will start collecting and remember MAC addresses of all devices that ever connected to the router. If you need to clear this list you can do so by checking the box "delete devicelist" in the device settings.

### Presence detection ###
After adding your router to Homey, you can start adding the mobile devices that you want to track for presence. They will be reported as connected or disconnected based on the WiFi connection to your Netgear network. If the device has multiple MAC adresses in your network (which can happen when you have multiple WiFi access points) you can add up to 4 additional alias MAC adresses in the device settings.

![image][presence-cards-image]

You can finetune the 'offline after delay' in the device settings. If you get false disconnected messages, you should increase this delay. If you want faster detection, you can try decreasing this delay. You can also try reducing the polling interval of the router. The default polling interval is 1 minute, but if you make it too short your router can choke. 

![image][mobile-card-image] 

### Energy monitoring ###
After adding your router to Homey, you can add additional devices that you want to monitor for power, e.g. your T.V. or printer. Select an icon and select which information you want to show in the device, and include Energy. Enter the estimated / average power usage of the device when it is OFF or ON. Now when you turn on your T.V. you will see that the estimated power is included in Homey Energy tab.

![image][power-image]


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

===============================================================================

Version changelog: [changelog.txt]

[forum]: https://community.athom.com/t/2259
[mobile-card-image]: https://aws1.discourse-cdn.com/business4/uploads/athom/original/3X/7/4/7421513afb9c12a925b9bd0c3f5ae8f9e88abfc0.png
[presence-cards-image]: https://aws1.discourse-cdn.com/business4/uploads/athom/original/3X/a/4/a47509de392a0404107bdfddb68d84f7cf3cac67.png
[flow-cards-image]: https://aws1.discourse-cdn.com/business4/uploads/athom/original/3X/3/6/367e484ec829eef084b3b03ee6bfae49c9d54ca6.png
[flow-cards2-image]: https://aws1.discourse-cdn.com/business4/uploads/athom/original/3X/7/9/79899f6ef1d10c56178971f62c0f0483920cdb8a.png
[insights-image]: https://aws1.discourse-cdn.com/business4/uploads/athom/original/3X/a/e/ae1e17b3e7964a3380619a4a469a0fbf0c0ba5de.png
[insights2-image]: https://aws1.discourse-cdn.com/business4/uploads/athom/original/3X/9/0/90b727eb76d7fec8e0a616cd12ad1abe68814730.png
[power-image]: https://aws1.discourse-cdn.com/business4/uploads/athom/original/3X/e/b/eb4e801249028c10b4b2dc1b0519b51db823d176.png
[compatibility-test-image]: https://aws1.discourse-cdn.com/business4/uploads/athom/original/2X/9/9cf56761e66e1af7b2a300cdbc919c042729857f.png
[changelog.txt]: https://github.com/gruijter/com.gruijter.netgear/blob/master/changelog.txt
