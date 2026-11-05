# Excel-Empfänger auf dem NAS (UGREEN, UGOS-Docker-App)

Nimmt die Excel-Exporte der Einkaufszettel-App entgegen und legt sie in der Freigabe
`Netzlaufwerk_N`, Ordner `Einkaufslisten` ab (am PC `N:\Einkaufslisten`).
Erreichbar nur im eigenen Tailnet unter `https://einkauf.<tailnet>.ts.net`.

## Einmalig einrichten

1. **Auth-Key erzeugen:** Tailscale-Admin → *Settings* → *Keys* → *Generate auth key*
   (Standardeinstellungen: einmal verwendbar, nicht ephemeral, keine Tags) → Schlüssel kopieren.
2. **Ordner aufs NAS kopieren:** den Ordner `empfaenger` per Windows-Explorer in die Freigabe
   `docker` kopieren und in `einkauf` umbenennen → `/volume1/docker/einkauf`.
3. **Schlüsseldatei anlegen:** dort die Datei `einkauf.env.beispiel` kopieren, Kopie in
   `einkauf.env` umbenennen, mit dem Editor öffnen, hinter `TS_AUTHKEY=` den Schlüssel einfügen, speichern.
4. **Ordner anlegen:** in `einkauf` den Ordner `tailscale\state` anlegen
   (`tailscale\serve.json` ist schon da). In der Freigabe `Netzlaufwerk_N` den Ordner `Einkaufslisten`.
5. **Schreibrecht:** UGOS-Dateimanager → `Netzlaufwerk_N/Einkaufslisten` → Rechtsklick → Eigenschaften →
   Berechtigungen → Benutzer **Docker**: Lesen + Schreiben. Dort steht auch der genaue Pfad
   (muss zu `/volume1/Netzlaufwerk_N/Einkaufslisten` in `docker-compose.yml` passen).
6. **Projekt erstellen:** UGOS → App **Docker** → **Projekt** → **Erstellen** → Name `einkauf` →
   Pfad `docker/einkauf` → **Bereitstellen**. Erster Build dauert ein bis zwei Minuten.
7. **Kontrolle:** Docker → **Container** → `einkauf-tailscale` und `einkauf-app` grün.
   Im Protokoll von `einkauf-app` steht `Start (NAS): Port 8000, Ziel /listen`.
8. **Tailscale-Admin:** beim neuen Gerät `einkauf` → *…* → **Disable key expiry**.
9. **App:** Einstellungen → „Excel-Export an NAS oder PC“ → Adresse
   `https://einkauf.<tailnet>.ts.net` → „Verbindung zum Empfänger testen“ → „✓ Verbunden (NAS)“.

## Aktualisieren

`empfaenger.py` in `docker/einkauf` überschreiben → Projekt stoppen + löschen → unter **Abbilder**
`einkauf-empfaenger` löschen → Projekt neu erstellen. `Einkaufslisten` und `tailscale/state` bleiben erhalten.
Nur `docker-compose.yml` geändert: Projekt stoppen + löschen → neu erstellen (Abbild darf bleiben).

Nach der Einrichtung die Kopien der Installationsdateien vom PC/Netzlaufwerk löschen –
vor allem `einkauf.env` (enthält den Tailscale-Schlüssel).
