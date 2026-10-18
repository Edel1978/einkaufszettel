// Testmodus: liefert ohne KI einen festen Beispiel-Zettel bzw. zerlegt Diktate mit einfachen Regeln.
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

function warte(ms, signal) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(new ErkennungsFehler('abgebrochen', 'Abgebrochen.'));
    });
  });
}

export async function erkenne(_bild, _einstellungen, signal) {
  await warte(1500, signal);
  return werteAntwortAus(structuredClone(BEISPIEL));
}

// ---------- Diktat ohne KI zerlegen ----------

const ZAHLWOERTER = {
  ein: 1, eine: 1, einen: 1, einem: 1, zwei: 2, drei: 3, vier: 4, 'fünf': 5, sechs: 6, sieben: 7,
  acht: 8, neun: 9, zehn: 10, elf: 11, 'zwölf': 12, zwanzig: 20, dutzend: 12, anderthalb: 1.5,
  halb: 0.5, halbe: 0.5, halbes: 0.5, halben: 0.5,
};

const EINHEITEN_WORTE = {
  liter: 'l', l: 'l', milliliter: 'ml', ml: 'ml', kilo: 'kg', kilogramm: 'kg', kg: 'kg', gramm: 'g', g: 'g',
  packung: 'Pck.', packungen: 'Pck.', 'päckchen': 'Pck.', pack: 'Pck.', dose: 'Dose', dosen: 'Dose',
  flasche: 'Flasche', flaschen: 'Flasche', glas: 'Glas', 'gläser': 'Glas', becher: 'Becher', bund: 'Bund',
  'stück': '',
};

// Wortgrenzen über Unicode-Buchstaben, damit auch Umlaute richtig zählen.
const FUELLWOERTER = /(?<!\p{L})(ich brauche|wir brauchen|brauche|bitte|noch|außerdem|dann|ähm|äh|das war's|das wars)(?!\p{L})/giu;
const TRENNER = /,|;|\n|\.(?:\s|$)|(?<!\p{L})und(?!\p{L})/iu;

/** Zerlegt z. B. „zwei Liter Milch, ein Pfund Kaffee und Brot“ in Einträge. */
export function zerlegeDiktat(text) {
  return text
    .replace(FUELLWOERTER, ' ')
    .split(TRENNER)
    .map((teil) => teil.trim().split(/\s+/).filter(Boolean))
    .filter((woerter) => woerter.length > 0)
    .map((woerter) => {
      let menge = null;
      let einheit = '';
      const erstes = woerter[0].toLowerCase().replace(',', '.');
      if (/^\d+(\.\d+)?$/.test(erstes)) {
        menge = Number(erstes);
        woerter.shift();
      } else if (erstes in ZAHLWOERTER && woerter.length > 1) {
        menge = ZAHLWOERTER[erstes];
        woerter.shift();
      }
      // „ein halbes Kilo …“
      if (woerter.length > 1 && woerter[0].toLowerCase() in ZAHLWOERTER) {
        menge = (menge ?? 1) * ZAHLWOERTER[woerter[0].toLowerCase()];
        woerter.shift();
      }
      const kandidat = woerter[0]?.toLowerCase();
      if (woerter.length > 1 && kandidat === 'pfund') {
        menge = (menge ?? 1) * 500;
        einheit = 'g';
        woerter.shift();
      } else if (woerter.length > 1 && kandidat in EINHEITEN_WORTE) {
        einheit = EINHEITEN_WORTE[kandidat];
        woerter.shift();
      }
      const name = woerter.join(' ');
      return { name: name.charAt(0).toUpperCase() + name.slice(1), menge, einheit, kategorie: '', unsicher: false };
    })
    .filter((e) => e.name);
}

export async function erkenneText(text, _einstellungen, signal) {
  await warte(600, signal);
  return werteAntwortAus({ eintraege: zerlegeDiktat(text), hinweis: 'Testmodus: Diktat ohne KI zerlegt.' });
}

export async function testeVerbindung() {
  return 'Testmodus aktiv – es wird keine Verbindung benötigt.';
}
