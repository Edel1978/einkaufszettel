// Gemeinsame Teile aller Erkennungsdienste: Anweisung an die KI, Antwortformat,
// Prüfung der Antwort und verständliche Fehlermeldungen.
//
// Jeder Dienst liefert dasselbe Ergebnis:
//   { eintraege: [{ name, menge, einheit, kategorie, unsicher }], hinweis }

import { KATEGORIEN, STANDARD_KATEGORIE, EINHEITEN, rateKategorie, gelernteKategorie } from '../kategorien.js';

export const ANWEISUNG = `Du liest Fotos von handgeschriebenen Einkaufszetteln (meist auf Deutsch) und wandelst sie in eine saubere Einkaufsliste um.

Regeln:
- Jeder Artikel wird ein eigener Eintrag. Stehen mehrere Artikel in einer Zeile (z. B. durch Komma getrennt), trenne sie.
- Ein Artikel kann über ein Zeilenende weiterlaufen (z. B. „1 frische“ / „Sahne“). Eine Zahl oder Mengenangabe am Zeilenanfang beginnt aber fast immer einen neuen Artikel – hänge sie nicht an den vorherigen an.
- Durchgestrichene oder ausgestrichene Artikel lässt du weg. Ebenso Überschriften, Datumsangaben, Notizen ohne Artikel und Kritzeleien.
- Lies jedes Wort Buchstabe für Buchstabe. Ersetze es nicht durch ein ähnliches, gebräuchlicheres Wort, wenn die geschriebenen Buchstaben nicht dazu passen. Zettel enthalten oft Marken- und Produktnamen (Brotsorten, Fertigsuppen, Kaffeesorten usw.) – erkennst du einen solchen Namen, verwende ihn.
- Schreibe Artikelnamen in üblicher deutscher Schreibweise mit großem Anfangsbuchstaben und korrigiere Rechtschreibfehler. Schreibe Abkürzungen aus, wenn sie eindeutig sind (z. B. „Toi.-Papier“ → „Toilettenpapier“). Behalte Marken und genaue Angaben bei (z. B. „Milch 3,5 %“).
- Ist eine Zahl überschrieben oder korrigiert, gilt die zuletzt geschriebene Zahl; setze dann "unsicher" auf true.
- Menge und Einheit trennst du vom Namen:
  - „2x Milch“, „2 Milch“ → menge 2, einheit "" (reine Stückzahl ohne Einheit)
  - „500g Hack“ → name "Hackfleisch", menge 500, einheit "g"
  - „1/2 kg Äpfel“ → menge 0.5, einheit "kg"
  - „1 Pck. Butter“ → menge 1, einheit "Pck."
  - ohne Mengenangabe → menge null, einheit ""
- Verwende für die Einheit möglichst eine dieser Schreibweisen: ${EINHEITEN.join(', ')}.
- Ordne jeden Artikel einer Kategorie zu (Feld "kategorie", nur die ID):
${KATEGORIEN.map((k) => `  - ${k.id}: ${k.name} (z. B. ${k.beispiele})`).join('\n')}
- Kommt derselbe Artikel mehrfach vor, fasse ihn zu einem Eintrag zusammen.
- Ist ein Wort schwer lesbar, gib deine beste Vermutung an und setze "unsicher" auf true. Sonst false.
- Ist auf dem Foto kein Einkaufszettel oder nichts lesbar, gib eine leere Liste zurück und erkläre kurz in "hinweis", woran es liegt (z. B. „Bild zu unscharf“). Sonst ist "hinweis" leer.`;

/**
 * Anweisung plus die Artikel, die der Nutzer schon auf seinen Listen hatte.
 * So erkennt die KI wiederkehrende Produkte (z. B. Markennamen) bei schwer lesbarer Schrift sicherer.
 */
export function anweisungMit(bekannteArtikel = []) {
  if (bekannteArtikel.length === 0) return ANWEISUNG;
  return `${ANWEISUNG}

Diese Artikel hat der Nutzer schon früher eingekauft (häufigste zuerst). Sieht ein Wort auf dem Zettel einem davon ähnlich, ist vermutlich dieser Artikel gemeint – übernimm dann diese Schreibweise. Andere Artikel sind natürlich trotzdem möglich:
${bekannteArtikel.join(', ')}`;
}

export const ANTWORT_SCHEMA = {
  type: 'object',
  properties: {
    eintraege: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          menge: { anyOf: [{ type: 'number' }, { type: 'null' }] },
          einheit: { type: 'string' },
          kategorie: { type: 'string', enum: KATEGORIEN.map((k) => k.id) },
          unsicher: { type: 'boolean' },
        },
        required: ['name', 'menge', 'einheit', 'kategorie', 'unsicher'],
        additionalProperties: false,
      },
    },
    hinweis: { type: 'string' },
  },
  required: ['eintraege', 'hinweis'],
  additionalProperties: false,
};

/** Fehler mit Code (für die Programmlogik) und verständlichem Text (für die Anzeige). */
export class ErkennungsFehler extends Error {
  constructor(code, text) {
    super(text);
    this.code = code;
  }
}

/** Prüft und bereinigt die Antwort der KI. Wirft "nichts-erkannt", wenn keine Artikel dabei sind. */
export function werteAntwortAus(daten) {
  const roh = Array.isArray(daten?.eintraege) ? daten.eintraege : [];
  const gueltigeKategorien = new Set(KATEGORIEN.map((k) => k.id));

  const eintraege = roh
    .filter((e) => typeof e?.name === 'string' && e.name.trim())
    .map((e) => {
      const name = e.name.trim();
      const menge = typeof e.menge === 'number' && Number.isFinite(e.menge) && e.menge > 0 ? e.menge : null;
      let kategorie = gueltigeKategorien.has(e.kategorie) ? e.kategorie : rateKategorie(name);
      // Was du selbst schon einmal korrigiert hast, hat Vorrang vor der KI.
      kategorie = gelernteKategorie(name) ?? kategorie ?? STANDARD_KATEGORIE;
      return {
        name,
        menge,
        einheit: typeof e.einheit === 'string' ? e.einheit.trim() : '',
        kategorie,
        unsicher: e.unsicher === true,
      };
    });

  const hinweis = typeof daten?.hinweis === 'string' ? daten.hinweis.trim() : '';
  if (eintraege.length === 0) {
    throw new ErkennungsFehler('nichts-erkannt', hinweis
      ? `Es wurden keine Artikel erkannt: ${hinweis}`
      : 'Auf dem Foto wurden keine Artikel erkannt. Versuche es mit einem schärferen, gut beleuchteten Foto.');
  }
  return { eintraege, hinweis };
}

/** Übersetzt HTTP-Fehler in verständliche Meldungen. */
export function fehlerAusAntwort(status, nachricht = '') {
  const n = nachricht.toLowerCase();
  if (status === 401) return new ErkennungsFehler('schluessel-ungueltig', 'Der API-Schlüssel ist ungültig. Bitte in den Einstellungen prüfen.');
  if (status === 403) return new ErkennungsFehler('keine-berechtigung', 'Der API-Schlüssel hat keine Berechtigung für diese Anfrage.');
  if (n.includes('credit') || n.includes('balance') || n.includes('billing')) {
    return new ErkennungsFehler('kein-guthaben', 'Das Guthaben beim KI-Anbieter ist aufgebraucht. Bitte dort Guthaben aufladen.');
  }
  if (status === 404) return new ErkennungsFehler('modell', 'Das gewählte Modell ist nicht verfügbar. Bitte in den Einstellungen ein anderes wählen.');
  if (status === 413) return new ErkennungsFehler('zu-gross', 'Das Foto ist zu groß.');
  if (status === 429) return new ErkennungsFehler('zu-viele', 'Zu viele Anfragen – bitte einen Moment warten und erneut versuchen.');
  if (status >= 500) return new ErkennungsFehler('ueberlastet', 'Der KI-Dienst ist gerade überlastet oder gestört. Bitte gleich noch einmal versuchen.');
  return new ErkennungsFehler('anfrage', `Die Anfrage wurde abgelehnt (${status})${nachricht ? `: ${nachricht}` : ''}`);
}

/** fetch mit verständlichen Fehlern bei fehlendem Netz oder Abbruch. */
export async function sicherFetch(url, optionen) {
  try {
    return await fetch(url, optionen);
  } catch (fehler) {
    if (fehler.name === 'AbortError') throw new ErkennungsFehler('abgebrochen', 'Abgebrochen.');
    if (!navigator.onLine) throw new ErkennungsFehler('offline', 'Keine Internetverbindung. Die Erkennung braucht Internet – bitte später erneut versuchen.');
    throw new ErkennungsFehler('netz', 'Der KI-Dienst ist nicht erreichbar. Bitte Internetverbindung prüfen und erneut versuchen.');
  }
}

/** Liest die Fehlermeldung aus einer API-Antwort (falls vorhanden). */
export async function fehlerNachricht(antwort) {
  try {
    const daten = await antwort.json();
    return daten?.error?.message ?? daten?.nachricht ?? '';
  } catch {
    return '';
  }
}
