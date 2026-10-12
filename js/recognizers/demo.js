// Testmodus: liefert ohne KI einen festen Beispiel-Zettel.
// Damit lässt sich der komplette Ablauf ohne API-Schlüssel und ohne Kosten ausprobieren.

import { werteAntwortAus, ErkennungsFehler } from './gemeinsam.js';

const BEISPIEL = {
  eintraege: [
    { name: 'Milch', menge: 2, einheit: 'l', kategorie: 'milch-kuehl', unsicher: false },
    { name: 'Hackfleisch', menge: 500, einheit: 'g', kategorie: 'fleisch-wurst', unsicher: false },
    { name: 'Tomaten', menge: 6, einheit: '', kategorie: 'obst-gemuese', unsicher: false },
    { name: 'Spaghetti', menge: 1, einheit: 'Pck.', kategorie: 'vorrat', unsicher: false },
    { name: 'Parmesan', menge: null, einheit: '', kategorie: 'milch-kuehl', unsicher: true },
    { name: 'Brötchen', menge: 4, einheit: '', kategorie: 'brot', unsicher: false },
    { name: 'Spülmittel', menge: null, einheit: '', kategorie: 'haushalt', unsicher: false },
  ],
  hinweis: '',
};

export async function erkenne(_bild, _einstellungen, signal) {
  await new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, 1500);
    signal?.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(new ErkennungsFehler('abgebrochen', 'Abgebrochen.'));
    });
  });
  return werteAntwortAus(structuredClone(BEISPIEL));
}

export async function testeVerbindung() {
  return 'Testmodus aktiv – es wird keine Verbindung benötigt.';
}
