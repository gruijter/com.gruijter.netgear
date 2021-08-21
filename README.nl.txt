Netwerk besturing, Aanwezigheidsdetectie, Energie monitoring

App om Netgear routers met Homey te laten werken.
- monitoren en besturen van WiFi en de aangesloten apparaten
- blokkeer internet van de kinderen na het avondeten
- aanwezigheidsdetectie op basis van smartphone WiFi
- monitor het energieverbruik van netwerk apparaten, zoals de TV

Monitor en log:
- internet verbindingsstatus
- internet upload en download snelheid
- verbindingsstatus van aangesloten apparaten
- WiFi kwaliteit en bandbreedte per apparaat
- energieverbruik per apparaat

Doe iets als:
- apparaat maakt of verbreekt verbinding (aanwezigheid)
- apparaat bandbreedte of WiFi link veranderd
- een onbekend apparaat verbinding maakt met het netwerk
- het internet niet werkt
- internet up/download snelheid veranderd
- internet speed test klaar is
- nieuwe router firmware beschikbaar is

Stuur commando:
- WakeOnLan (WOL) van een apparaat via MAC adres
- (de-)blokkeer een apparaat via MAC adres
- zet Gasten WiFi aan of uit
- voer een internet snelheidstest uit
- voer een firmware upgrade uit van de router
- herstart de router


Router koppelen in Homey:
De app is bedoeld voor Netgear apparaten die werken in Router modus. Als de router in Access Point (AP) modus werkt is niet alle functionaliteit beschikbaar zoals verkeersstatistieken (up/down bandbreedte)
Je Homey moet zich binnen het LAN van de router bevinden, niet daarbuiten (WAN). Om te koppelen ga naar "Apparaten" en voeg de router toe door het admin wachtwoord in te vullen. Na succesvol toevoegen kan de poll-interval worden aangepast in de apparaat instellingen (1 minuut is standaard). Bij het opstarten van de app zal Homey proberen om verkeersstatistieken en toegangscontrole aan te zetten. De beschikbaarheid van deze functies is afhankelijk van je router type en firmware. Homey begint alle MAC adressen van aangesloten apparaten permanent op te slaan. Als je deze lijst wilt wissen kan dat via de apparaat instellingen.

Aanwezigheidsdetectie:
Nadat de router is gekoppeld in Homey kun je mobiele telefoons toevoegen die je wilt volgen voor aanwezigheid op basis van WiFi verbinding.

Energie monitoring:
Nadat de router is gekoppeld in Homey kun je apparaten toevoegen waarvan je het energieverbruik wilt monitoren, zoals een TV of printer.

Ondersteunde routers:
Als je de Nighthawk of Orbi app kunt gebruiken om de router te beheren zal de Homey app waarschijnlijk werken. Sommige functionaliteit is afhankelijk van router type en/of firmware niveau.
Je kunt je router type en versie zien door deze pagina te opnenen: http://routerlogin.net/currentsetting.htm

Compatibiliteitstest:
Als je router niet goed werkt met de Homey app kun je een test uitvoeren vanuit de App instellingen.

