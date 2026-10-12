# Einkaufszettel

Kleine Web-App für die Einkaufsliste. Man fotografiert den handgeschriebenen Zettel,
die App macht daraus eine Liste zum Abhaken. Läuft im Browser und lässt sich auf dem
Handy als App installieren, auch offline.

App: https://edel1978.github.io/einkaufszettel/

Für die Texterkennung braucht man einen eigenen API-Schlüssel (z. B. kostenlos von
Google Gemini). Er wird in den Einstellungen der App eingetragen und bleibt auf dem Gerät.

## Am PC ausprobieren

    node server/dev-server.mjs

Dann http://localhost:5173 im Browser öffnen.

## Hinweise

- Neue Dateien in `service-worker.js` unter `APP_DATEIEN` eintragen, sonst fehlen sie offline.
- Updates sind auf dem Handy nach dem zweiten Öffnen der App da.
