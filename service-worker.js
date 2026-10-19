// Service Worker: speichert die App auf dem Gerät, damit sie auch ohne Internet startet.
//
// Strategie für die eigenen Dateien:
// - Veröffentlicht: sofort aus dem Speicher antworten (schnell, auch im Funkloch) und im
//   Hintergrund die neue Version laden. Updates sind damit beim nächsten Öffnen aktiv.
// - Auf dem PC (localhost): immer zuerst aus dem Netz, damit Änderungen sofort sichtbar sind.
// Anfragen an andere Server (z. B. die KI-Dienste) werden nie zwischengespeichert.

const CACHE = 'einkaufszettel-v3';

const APP_DATEIEN = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/style.css',
  'icons/icon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'js/app.js',
  'js/bild.js',
  'js/dialoge.js',
  'js/einstellungen.js',
  'js/einstellungen-seite.js',
  'js/foto.js',
  'js/kategorien.js',
  'js/listen.js',
  'js/util.js',
  'js/wachhalten.js',
  'js/installieren.js',
  'js/sprache.js',
  'js/recognizers/index.js',
  'js/recognizers/gemeinsam.js',
  'js/recognizers/gemini.js',
  'js/recognizers/groq.js',
  'js/recognizers/anthropic-direkt.js',
  'js/recognizers/proxy.js',
  'js/recognizers/demo.js',
  'js/storage/index.js',
  'js/storage/lokal.js',
  'js/storage/online.js',
];

const ENTWICKLUNG = ['localhost', '127.0.0.1'].includes(self.location.hostname);

self.addEventListener('install', (ereignis) => {
  ereignis.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(APP_DATEIEN))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (ereignis) => {
  ereignis.waitUntil(
    caches.keys()
      .then((namen) => Promise.all(namen.filter((n) => n !== CACHE).map((n) => caches.delete(n))))
      .then(() => self.clients.claim()),
  );
});

async function ausNetz(anfrage) {
  const antwort = await fetch(anfrage);
  if (antwort.ok) {
    const cache = await caches.open(CACHE);
    await cache.put(anfrage, antwort.clone());
  }
  return antwort;
}

async function ausSpeicher(anfrage) {
  // Seitenaufrufe (z. B. "./#/liste/…") liefern immer die App-Hauptseite.
  const schluessel = anfrage.mode === 'navigate' ? 'index.html' : anfrage;
  return caches.match(schluessel, { ignoreSearch: true });
}

self.addEventListener('fetch', (ereignis) => {
  const anfrage = ereignis.request;
  if (anfrage.method !== 'GET' || new URL(anfrage.url).origin !== self.location.origin) return;

  if (ENTWICKLUNG) {
    ereignis.respondWith(
      ausNetz(anfrage).catch(async () => (await ausSpeicher(anfrage)) ?? Response.error()),
    );
    return;
  }

  ereignis.respondWith((async () => {
    const gespeichert = await ausSpeicher(anfrage);
    const neu = ausNetz(anfrage.mode === 'navigate' ? new Request('index.html') : anfrage).catch(() => null);
    if (gespeichert) {
      ereignis.waitUntil(neu);
      return gespeichert;
    }
    return (await neu) ?? Response.error();
  })());
});
