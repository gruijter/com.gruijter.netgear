Nätverkskontroll, Närvarodetektering, Energiövervakning

App för att få Homey att interagera med Netgear-routrar.
- Övervaka och styr ditt wifi-nätverk och dess anslutna enheter
- Blockera barnens WiFi efter middagen
- Närvarodetektering baserad på smartphonens WiFi
- Övervaka energiförbrukningen för dina nätverksenheter, t.ex. TV:n

Se och logga:
- internetanslutningsstatus
- internet upp- och nedladdningshastighet
- anslutningsstatus för anslutna enheter
- WiFi-kvalitet och bandbredd per enhet
- energianvändning per enhet

Reagera på:
- enhet går online eller offline (närvaro)
- enhetsbandbredd eller wifi-länkändring
- detektering av en okänd enhet som ansluter till nätverket
- larm när internetanslutningen bryts
- ändring av internet upp/nedladdningshastighet
- resultat av internethastighetstest
- ny router-firmware tillgänglig

Gör:
- skicka WakeOnLan (WOL) till en MAC-adress
- blockera och tillåt en ansluten enhet via MAC-adress
- aktivera och inaktivera Gäst-WiFi
- utför internethastighetstest
- utför firmware-uppgradering
- starta om routern


Konfiguration av routerenhet i Homey:
Appen är avsedd för Netgear-enheter som fungerar i Router-läge. I Access Point (AP)-läge har du inte alla funktioner. Din Homey ska vara ansluten på LAN-sidan av routern. För att konfigurera, gå till "Enheter" och lägg till Netgear-routern genom att fylla i administratörslösenordet.

Närvarodetektering:
När du har lagt till din router i Homey kan du lägga till de mobila enheter som du vill spåra för närvaro baserat på WiFi-anslutningen till ditt Netgear-nätverk.

Energiövervakning:
När du har lagt till din router i Homey kan du lägga till ytterligare enheter som du vill övervaka för ström (t.ex. TV eller skrivare).

Stödda routrar:
Generellt: Om du kan använda Nighthawk- eller Orbi-appen för att hantera routern kommer denna Homey-app troligen att fungera.

Kompatibilitetstest:
Om din router inte fungerar korrekt med den här appen kan du utföra ett kompatibilitetstest från appens inställningsflik.
