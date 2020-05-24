Network control, Presence detection, Energy monitoring

App to make Homey interact with Netgear routers.
- Monitor and control your wifi network and its connected devices
- Block the WiFi of your kids after dinner
- Presence detection based on smartphone WiFi
- Monitor the energy usage of your network devices, e.g. the T.V.

See and log:
- internet connection status
- the internet upload and download speed
- connection status of attached devices
- WiFi quality and bandwidth per device
- Energy use per device

Act on:
- device coming online or going offline (presence)
- device bandwidth or wifi link change
- detection of an unknown device connecting to the network
- alarm when internet connection goes down
- change of internet up/download speed
- results of internet speed test
- new router firmware available

Do:
- send WakeOnLan (WOL) to a MAC address
- block and allow an attached device by MAC address
- enable and disable Guest Wifi
- perform internet speed test
- perform firmware upgrade
- reboot the router


Router device setup in Homey:
The app is intended for netgear devices that work in Router mode. When using the router in Access Point (AP) mode, you will not have all functionality, e.g. traffic statistics (up/download speed). Your Homey should be connected inside the LAN part of the router, not from outside (WAN). To setup go to "Devices" and add the Netgear router by filling in the admin password. After the router device is added successfully you can change the polling interval (set to 1 minute as default). On app startup, Homey will try to automatically enable traffic statistics (up/download speed) and access control (block/allow internet access for an attached device). The availablity of these functions depend ond router type, router mode and firmware level. The app will start collecting and remember MAC addresses of all devices that ever connected to the router. If you need to clear this list you can do so by checking the box "delete devicelist" in the device settings.

Presence detection:
After adding your router to Homey, you can start adding the mobile devices that you want to track for presence. They will be reported as connected or disconnected based on the WiFi connection to your Netgear network.
You can finetune the 'offline after delay' in the device settings. If you get false disconnected messages, you should increase this delay. If you want faster detection, you can try decreasing this delay. You can also try reducing the polling interval of the router. The default polling interval is 1 minute, but if you make it too short your router can choke. 

Energy monitoring:
After adding your router to Homey, you can add additional devices that you want to monitor for power, e.g. your T.V. or printer. Select an icon and select which information you want to show in the device, and include Energy. Enter the estimated / average power usage of the device when it is OFF or ON. Now when you turn on your T.V. you will see that the estimated power is included in Homey Energy tab.

Supported routers:
In general: If you can use the Nighthawk or Orbi app to manage the router, then this Homey app will most likely work. Some functionality, like blocking/unblocking an attached device, only work on certain router types. MAKE SURE YOU ARE ON THE LATEST ROUTER FIRMWARE!
You can check your router version by browsing to http://routerlogin.net/currentsetting.htm.

Compatibility test:
If your router isn't working properly with this app, you can perform a compatibility test from the app settings tab. After performing the test you will be directed to the developer page on Github. Here you can create an issue, and paste the test result. Note: you need an account on Github to be able to create an issue.
