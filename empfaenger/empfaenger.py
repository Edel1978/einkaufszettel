"""Empfänger für Excel-Exporte der Einkaufszettel-App.

Nimmt die Datei entgegen, die die App mit „Senden“ schickt, und legt sie als
Einkaufsliste_JJJJ-MM-TT(_2).xlsx im Zielordner ab.

Erreichbar ist er nur über Tailscale: Das Programm hört ausschließlich auf 127.0.0.1,
„tailscale serve“ reicht Anfragen aus dem eigenen Tailnet per HTTPS hierher weiter.
Angenommen werden nur Anfragen von der App selbst (Herkunft + eigene Kopfzeile).

Auf dem NAS (Docker): siehe docker-compose.yml und ANLEITUNG_NAS.md.
Auf dem PC:  pythonw empfaenger.py "C:/Pfad/zum/Zielordner" [port]
             tailscale serve --bg --set-path /einkaufszettel http://127.0.0.1:8765

Umgebungsvariable EMPFAENGER_ORT (z. B. „NAS“) steht in der Rückmeldung an die App.
"""

import datetime
import json
import logging
import os
import sys
import tempfile
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ERLAUBTE_HERKUNFT = {'https://edel1978.github.io'}
MAX_GROESSE = 5 * 1024 * 1024
KOPFZEILE = 'X-Einkaufszettel'

ZIEL = Path(sys.argv[1] if len(sys.argv) > 1 else Path(__file__).with_name('Listen'))
PORT = int(sys.argv[2]) if len(sys.argv) > 2 else 8765

ORT = os.environ.get('EMPFAENGER_ORT', 'PC')

# Protokoll neben das Programm schreiben; geht das nicht (Container: Programmordner nur lesbar),
# auf die Konsole – dort zeigt es die Docker-App unter „Protokoll“.
try:
    logging.basicConfig(filename=Path(__file__).with_name('empfaenger.log'), level=logging.INFO,
                        format='%(asctime)s %(message)s', encoding='utf-8')
except OSError:
    logging.basicConfig(stream=sys.stdout, level=logging.INFO, format='%(asctime)s %(message)s')


def herkunft_erlaubt(herkunft):
    if not herkunft:
        return False
    if herkunft in ERLAUBTE_HERKUNFT:
        return True
    # Zum Ausprobieren am PC: die App vom eigenen Rechner
    return herkunft.startswith(('http://localhost:', 'http://127.0.0.1:'))


def freier_name():
    tag = datetime.date.today().isoformat()
    for nummer in range(1, 1000):
        name = f'Einkaufsliste_{tag}{"" if nummer == 1 else f"_{nummer}"}.xlsx'
        if not (ZIEL / name).exists():
            return name
    raise RuntimeError('Kein freier Dateiname')


class Empfaenger(BaseHTTPRequestHandler):
    server_version = 'Einkaufszettel-Empfaenger/1'

    def log_message(self, format, *args):
        logging.info('%s %s', self.address_string(), format % args)

    def cors(self):
        herkunft = self.headers.get('Origin', '')
        if herkunft_erlaubt(herkunft):
            self.send_header('Access-Control-Allow-Origin', herkunft)
            self.send_header('Vary', 'Origin')

    def antworte(self, status, daten):
        inhalt = json.dumps(daten, ensure_ascii=False).encode('utf-8')
        self.send_response(status)
        self.cors()
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(inhalt)))
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        self.wfile.write(inhalt)

    def pfad(self):
        # „tailscale serve --set-path“ kann das Präfix mitschicken oder nicht – beides zulassen.
        return self.path.split('?')[0].rstrip('/').rsplit('/', 1)[-1]

    def do_OPTIONS(self):
        if not herkunft_erlaubt(self.headers.get('Origin', '')):
            self.antworte(403, {'fehler': 'Nicht erlaubt'})
            return
        self.send_response(204)
        self.cors()
        self.send_header('Access-Control-Allow-Methods', 'GET, POST')
        self.send_header('Access-Control-Allow-Headers', f'Content-Type, {KOPFZEILE}')
        self.send_header('Access-Control-Allow-Private-Network', 'true')
        self.send_header('Access-Control-Max-Age', '600')
        self.end_headers()

    def pruefe_anfrage(self):
        if not herkunft_erlaubt(self.headers.get('Origin', '')) or self.headers.get(KOPFZEILE) != '1':
            self.antworte(403, {'fehler': 'Nicht erlaubt'})
            return False
        return True

    def do_GET(self):
        if self.pfad() != 'status':
            self.antworte(404, {'fehler': 'Unbekannt'})
            return
        if not self.pruefe_anfrage():
            return
        self.antworte(200, {'ok': True, 'ort': ORT, 'ordner': ZIEL.name})

    def do_POST(self):
        if self.pfad() != 'liste':
            self.antworte(404, {'fehler': 'Unbekannt'})
            return
        if not self.pruefe_anfrage():
            return
        try:
            laenge = int(self.headers.get('Content-Length', '0'))
        except ValueError:
            laenge = 0
        if laenge <= 0 or laenge > MAX_GROESSE:
            self.antworte(413, {'fehler': 'Datei fehlt oder ist zu groß'})
            return
        daten = self.rfile.read(laenge)
        if not daten.startswith(b'PK'):
            self.antworte(400, {'fehler': 'Keine Excel-Datei'})
            return

        ZIEL.mkdir(parents=True, exist_ok=True)
        name = freier_name()
        # Erst in eine Hilfsdatei schreiben, dann umbenennen: nie eine halbe Datei im Ordner.
        fd, hilfe = tempfile.mkstemp(dir=ZIEL, suffix='.tmp')
        with os.fdopen(fd, 'wb') as datei:
            datei.write(daten)
        os.replace(hilfe, ZIEL / name)
        logging.info('Gespeichert: %s (%d Bytes)', name, len(daten))
        self.antworte(200, {'ok': True, 'ort': ORT, 'name': name, 'ordner': ZIEL.name})


if __name__ == '__main__':
    logging.info('Start (%s): Port %d, Ziel %s', ORT, PORT, ZIEL)
    ThreadingHTTPServer(('127.0.0.1', PORT), Empfaenger).serve_forever()
