Control de red, Detección de presencia, Monitorización de energía

Aplicación para que Homey interactúe con routers Netgear.
- Monitoriza y controla tu red wifi y sus dispositivos conectados
- Bloquea el wifi de tus hijos después de cenar
- Detección de presencia basada en el wifi del smartphone
- Monitoriza el consumo de energía de tus dispositivos de red, p. ej. la televisión

Ver y registrar:
- estado de la conexión a internet
- velocidad de descarga y subida de internet
- estado de conexión de los dispositivos conectados
- calidad de wifi y ancho de banda por dispositivo
- consumo de energía por dispositivo

Reaccionar a:
- dispositivo que se conecta o desconecta (presencia)
- cambio de ancho de banda o enlace wifi de un dispositivo
- detección de un dispositivo desconocido conectándose a la red
- alarma cuando se cae la conexión a internet
- cambio de velocidad de subida/descarga de internet
- resultados de la prueba de velocidad de internet
- nuevo firmware de router disponible

Hacer:
- enviar WakeOnLan (WOL) a una dirección MAC
- bloquear y permitir un dispositivo conectado por dirección MAC
- activar y desactivar wifi de invitados
- realizar prueba de velocidad de internet
- realizar actualización de firmware
- reiniciar el router


Configuración del router en Homey:
La aplicación está pensada para dispositivos Netgear que funcionan en modo Router. En modo Punto de Acceso (AP), no tendrás todas las funciones. Tu Homey debe estar conectado dentro de la red LAN del router. Para configurar, ve a "Dispositivos" y añade el router Netgear introduciendo la contraseña de administrador.

Detección de presencia:
Tras añadir tu router a Homey, puedes añadir dispositivos móviles que quieras rastrear para presencia basándote en la conexión WiFi a tu red Netgear.

Monitorización de energía:
Tras añadir tu router a Homey, puedes añadir dispositivos adicionales cuyo consumo eléctrico quieras monitorizar (ej. TV o impresora).

Routers compatibles:
En general, si puedes usar la aplicación Nighthawk u Orbi para gestionar el router, esta aplicación de Homey funcionará muy probablemente.

Prueba de compatibilidad:
Si tu router no funciona correctamente con esta aplicación, puedes realizar una prueba de compatibilidad desde la pestaña de configuración de la app.
