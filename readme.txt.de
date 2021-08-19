Netzwerksteuerung, Anwesenheitserkennung, Energieüberwachung

App für die Interaktion von Homey mit Netgear-Routern.
- Überwachen und kontrollieren Sie Ihr WLAN-Netzwerk und die damit verbundenen Geräte
- Sperren Sie das WLAN Ihrer Kinder nach dem Abendessen
- Anwesenheitserkennung auf Basis des WLANs Ihres Smartphones
- Überwachen Sie den Stromverbrauch Ihrer Netzwerkgeräte, z. B. des Fernsehers

Überwachen und protokolliere:
- Status der Internetverbindung
- die Internet Upload- und Download-Geschwindigkeit
- Verbindungsstatus verbundener Geräte
- WLAN-Qualität und Bandbreite pro Gerät
- Energieverbrauch pro Gerät

Reagieren Sie auf:
- Gerät geht online oder offline (Anwesenheit)
- Änderung der Gerätebandbreite oder der WLAN-Verbindung
- Erkennung eines unbekannten Geräts, das sich mit dem Netzwerk verbindet
- Alarm, wenn die Internetverbindung unterbrochen wird
- Änderung der Internet Up-/Download-Geschwindigkeit
- Ergebnisse des Internet-Geschwindigkeitstests
- Neue Router-Firmware verfügbar

Führen Sie aus:
- WakeOnLan (WOL) an eine MAC-Adresse senden
- Ein angeschlossenes Gerät nach MAC-Adresse blockieren und zulassen
- Gast-WLAN aktivieren und deaktivieren
- Internet-Geschwindigkeitstest durchführen
- Firmware-Upgrade durchführen
- Router neu starten

Einrichtung des Routers in Homey:
Die App ist für Netgear-Geräte gedacht, die im Router-Modus arbeiten. Wenn Sie den Router im Access Point (AP)-Modus verwenden, stehen Ihnen nicht alle Funktionen zur Verfügung, z.B. Datenverkehrstatistiken (Up-/Download-Geschwindigkeit). Ihr Homey sollte innerhalb des LAN-Teils des Routers angeschlossen sein, nicht von außen (WAN). Zur Einrichtung gehen Sie zu "Geräte" und fügen Sie den Netgear-Router hinzu, indem Sie das Admin-Passwort eingeben. Nachdem der Router erfolgreich hinzugefügt wurde, können Sie das Abfrageintervall (Polling Intervall) ändern (ist standardmäßig auf 1 Minute eingestellt). Beim Start der App wird Homey versuchen automatisch Datenverkehrstatistiken (Up-/Download-Geschwindigkeit) und die Zugriffskontrolle (Internetzugang für ein angeschlossenes Gerät sperren/erlauben) zu aktivieren. Die Verfügbarkeit dieser Funktionen hängt vom Routertyp, dem Routermodus und dem Firmware-Stand ab. Die App beginnt mit dem Sammeln und Speichern der MAC-Adressen aller Geräte, die jemals mit dem Router verbunden waren. Wenn Sie diese Liste löschen möchten, können Sie dies tun, indem Sie in den Geräteeinstellungen das Kontrollkästchen "Geräteliste löschen" aktivieren.

Anwesenheitserkennung:
Nachdem Sie Ihren Router zu Homey hinzugefügt haben, können Sie die mobilen Geräte hinzufügen, die Sie auf Anwesenheit überwachen möchten. Sie werden basierend auf der WLAN-Verbindung zu Ihrem Netgear-Netzwerk als verbunden oder getrennt gemeldet.
In den Geräteeinstellungen können Sie die "Offline-Verzögerung" genauer abstimmen. Wenn Sie falsche Trennungsmeldungen erhalten, sollten Sie diese Verzögerung erhöhen. Wenn Sie eine schnellere Erkennung wünschen, können Sie versuchen diese Verzögerung zu verringern. Sie können auch versuchen, das Abfrageintervall des Routers zu reduzieren. Das Standardabfrageintervall beträgt 1 Minute. Ein zu kurzes Abfrageintervall kann Ihren Router allerdings belasten.

Energieüberwachung:
Nachdem Sie Ihren Router zu Homey hinzugefügt haben, können Sie weitere Geräte hinzufügen, deren Stromverbrauch Sie überwachen möchten, z. B. Ihren Fernseher oder Drucker. Wählen Sie ein Symbol und welche Informationen angezeigt werden sollen aus, inklusive dem Energieverbrauch. Geben Sie den geschätzten/durchschnittlichen Stromverbrauch des Geräts ein, wenn es aus- und eingeschaltet ist. Wenn Sie nun Ihren Fernseher einschalten, werden Sie feststellen, dass der geschätzte Stromverbrauch auf der Registerkarte Energie von Homey angezeigt wird.

Unterstützte Router:
Generell gilt: Wenn Sie den Router mit der Nighthawk- oder Orbi-App verwalten können, dann wird diese Homey-App höchstwahrscheinlich funktionieren. Einige Funktionen, wie das Blockieren/Entsperren eines angeschlossenen Geräts, funktionieren nur bei bestimmten Routertypen. STELLEN SIE SICHER, DASS SIE AUF DER NEUESTEN ROUTER-FIRMWARE SIND!
Sie können Ihre Router-Version überprüfen, indem Sie http://routerlogin.net/currentsetting.htm in Ihrem Browser eingeben.

Kompatibilitätstest:
Wenn Ihr Router mit dieser App nicht richtig funktioniert, können Sie auf der Registerkarte "Einstellungen" der App einen Kompatibilitätstest durchführen. Nachdem Sie den Test durchgeführt haben, werden Sie zur Entwicklerseite auf Github weitergeleitet. Hier können Sie einen "Issue" erstellen und das Testergebnis einfügen. Hinweis: Sie benötigen ein GitHub-Konto um einen Eintrag erstellen zu können.
