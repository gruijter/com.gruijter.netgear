Netværksstyring, Tilstedeværelsesdetektion, Energiovervågning

App til at få Homey til at interagere med Netgear-routere.
- Overvåg og styr dit wifi-netværk og dets tilsluttede enheder
- Bloker børnenes WiFi efter aftensmaden
- Tilstedeværelsesdetektion baseret på smartphone WiFi
- Overvåg energiforbruget for dine netværksenheder, f.eks. TV'et

Se og log:
- internetforbindelsesstatus
- internet upload- og downloadhastighed
- forbindelsesstatus for tilsluttede enheder
- WiFi-kvalitet og båndbredde pr. enhed
- energiforbrug pr. enhed

Reager på:
- enhed går online eller offline (tilstedeværelse)
- enhedsbåndbredde eller wifi-link ændring
- detektion af en ukendt enhed der forbinder til netværket
- alarm når internetforbindelsen afbrydes
- ændring af internet up/downloadhastighed
- resultater af internethastighedstest
- ny router-firmware tilgængelig

Gør:
- send WakeOnLan (WOL) til en MAC-adresse
- bloker og tillad en tilsluttet enhed via MAC-adresse
- aktiver og deaktiver Gæste-WiFi
- udfør internethastighedstest
- udfør opgradering af firmware
- genstart routeren


Opsætning af routerenhed i Homey:
Appen er beregnet til Netgear-enheder, der fungerer i Router-tilstand. I Access Point (AP)-tilstand vil du ikke have alle funktioner. Din Homey skal være tilsluttet på LAN-siden af routeren. Gå til "Enheder" for at opsætte og tilføj Netgear-routeren ved at indtaste administratoradgangskoden.

Tilstedeværelsesdetektion:
Når du har tilføjet din router til Homey, kan du tilføje de mobile enheder, du vil spore for tilstedeværelse baseret på WiFi-forbindelsen til dit Netgear-netværk.

Energiovervågning:
Når du har tilføjet din router til Homey, kan du tilføje yderligere enheder, som du vil overvåge for strøm (f.eks. TV eller printer).

Understøttede routere:
Generelt: Hvis du kan bruge Nighthawk- eller Orbi-appen til at administrere routeren, vil denne Homey-app sandsynligvis fungere.

Kompatibilitetstest:
Hvis din router ikke fungerer korrekt med denne app, kan du udføre en kompatibilitetstest fra appens indstillingsfane.
