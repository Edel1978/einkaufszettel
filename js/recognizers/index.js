// Wählt den Erkennungsdienst passend zu den Einstellungen.
// Klappt der erste Dienst nicht, wird automatisch der zweite (Ausweich-)Dienst versucht.
// Neue Anbieter: Datei mit erkenne(), erkenneText() und testeVerbindung() anlegen und unten eintragen.

import { ladeEinstellungen, ausweichEinstellungen, anbieterInfo } from '../einstellungen.js';
import * as anthropicDirekt from './anthropic-direkt.js';
import * as gemini from './gemini.js';
import * as groq from './groq.js';
import * as proxy from './proxy.js';
import * as demo from './demo.js';
import { ErkennungsFehler } from './gemeinsam.js';

const DIREKT = {
  anthropic: anthropicDirekt,
  google: gemini,
  groq,
};

// Bei diesen Fehlern hilft auch ein anderer Dienst nicht weiter.
const KEIN_WECHSEL = new Set(['abgebrochen', 'offline']);

function dienst(einstellungen) {
  if (einstellungen.betriebsart === 'server') return proxy;
  if (einstellungen.betriebsart === 'demo') return demo;
  return DIREKT[einstellungen.anbieter] ?? gemini;
}

/** Kurzer Name für Meldungen, z. B. "Gemini" oder "Groq". */
export function dienstName(anbieterId) {
  return { google: 'Gemini', anthropic: 'Claude', groq: 'Groq' }[anbieterId] ?? anbieterInfo(anbieterId).name;
}

/**
 * Führt eine Erkennung mit dem ersten Dienst aus und weicht bei einem Fehler auf den zweiten aus.
 * Ergebnis zusätzlich mit { dienst, ausweichGrund } für die Anzeige.
 * kontext.beiWechsel(ersterName, zweiterName, fehler) wird vor dem zweiten Versuch aufgerufen.
 */
async function mitAusweich(aufruf, kontext) {
  const erste = ladeEinstellungen();
  const ersterName = erste.betriebsart === 'direkt' ? dienstName(erste.anbieter) : null;
  try {
    return { ...(await aufruf(dienst(erste), erste)), dienst: ersterName };
  } catch (fehler1) {
    const zweite = ausweichEinstellungen(erste);
    if (!zweite || KEIN_WECHSEL.has(fehler1.code)) throw fehler1;

    const zweiterName = dienstName(zweite.anbieter);
    kontext.beiWechsel?.(ersterName, zweiterName, fehler1);
    try {
      const ergebnis = await aufruf(DIREKT[zweite.anbieter], zweite);
      return { ...ergebnis, dienst: zweiterName, ausweichGrund: `${ersterName}: ${fehler1.message}` };
    } catch (fehler2) {
      if (fehler2.code === 'abgebrochen') throw fehler2;
      // Code des ersten Fehlers behalten (steuert z. B. den Knopf „Einstellungen“).
      throw new ErkennungsFehler(
        fehler1.code ?? fehler2.code,
        `Beide Dienste haben nicht geklappt. ${ersterName}: ${fehler1.message} – ${zweiterName}: ${fehler2.message}`,
      );
    }
  }
}

/**
 * Erkennt die Artikel auf einem vorbereiteten Bild (siehe bild.js).
 * kontext.bekannteArtikel: Artikelnamen von früheren Listen als Lesehilfe für die KI.
 */
export function erkenne(bild, signal, kontext = {}) {
  return mitAusweich((d, e) => d.erkenne(bild, e, signal, kontext), kontext);
}

/** Macht aus einem diktierten Text Einträge (gleiches Ergebnis wie erkenne()). */
export function erkenneText(text, signal, kontext = {}) {
  return mitAusweich((d, e) => d.erkenneText(text, e, signal, kontext), kontext);
}

/** Sprachaufnahme mit Groq Whisper in Text umwandeln. */
export function transkribiere(aufnahme, signal, kontext = {}) {
  return groq.transkribiere(aufnahme, ladeEinstellungen().groqSchluessel, signal, kontext);
}

/** Prüft die Verbindung zum ersten Dienst – oder mit "einstellungen" zu einem bestimmten. */
export function testeVerbindung(einstellungen = ladeEinstellungen()) {
  return dienst(einstellungen).testeVerbindung(einstellungen);
}

export { ErkennungsFehler };
