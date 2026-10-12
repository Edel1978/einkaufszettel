// Installation als App (PWA): Service Worker anmelden und den Installations-Dialog von
// Chrome anbieten. Chrome meldet über "beforeinstallprompt", dass die App installierbar ist.

const AUSGEBLENDET_SCHLUESSEL = 'einkaufszettel.installhinweis-aus';

let aufforderung = null;
let beiAenderung = null;

window.addEventListener('beforeinstallprompt', (ereignis) => {
  ereignis.preventDefault(); // eigenen Knopf zeigen statt der Chrome-Leiste
  aufforderung = ereignis;
  beiAenderung?.();
});

window.addEventListener('appinstalled', () => {
  aufforderung = null;
  beiAenderung?.();
});

export function registriereServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js').catch((fehler) => console.error('Service Worker:', fehler));
  }
}

/** Läuft die App gerade als installierte App (vom Startbildschirm)? */
export function istInstalliert() {
  return window.matchMedia('(display-mode: standalone)').matches;
}

export function kannInstallieren() {
  return aufforderung !== null && !istInstalliert();
}

/** Öffnet den Installations-Dialog. Liefert true, wenn installiert wurde. */
export async function installiere() {
  if (!aufforderung) return false;
  const a = aufforderung;
  aufforderung = null;
  await a.prompt();
  const { outcome } = await a.userChoice;
  beiAenderung?.();
  return outcome === 'accepted';
}

/** Wird aufgerufen, wenn sich die Installierbarkeit ändert (z. B. um den Hinweis einzublenden). */
export function beiInstallierbarkeit(funktion) {
  beiAenderung = funktion;
}

export function installHinweisAusgeblendet() {
  try { return localStorage.getItem(AUSGEBLENDET_SCHLUESSEL) === '1'; } catch { return false; }
}

export function blendeInstallHinweisAus() {
  try { localStorage.setItem(AUSGEBLENDET_SCHLUESSEL, '1'); } catch { /* egal */ }
}
