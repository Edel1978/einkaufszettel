// Wählt den Erkennungsdienst passend zu den Einstellungen.
// Neue Anbieter: Datei mit erkenne() und testeVerbindung() anlegen und unten eintragen.

import { ladeEinstellungen } from '../einstellungen.js';
import * as anthropicDirekt from './anthropic-direkt.js';
import * as gemini from './gemini.js';
import * as proxy from './proxy.js';
import * as demo from './demo.js';

const DIREKT = {
  anthropic: anthropicDirekt,
  google: gemini,
};

function dienst(einstellungen) {
  if (einstellungen.betriebsart === 'server') return proxy;
  if (einstellungen.betriebsart === 'demo') return demo;
  return DIREKT[einstellungen.anbieter] ?? gemini;
}

/**
 * Erkennt die Artikel auf einem vorbereiteten Bild (siehe bild.js).
 * kontext.bekannteArtikel: Artikelnamen von früheren Listen als Lesehilfe für die KI.
 */
export function erkenne(bild, signal, kontext = {}) {
  const einstellungen = ladeEinstellungen();
  return dienst(einstellungen).erkenne(bild, einstellungen, signal, kontext);
}

export function testeVerbindung(einstellungen = ladeEinstellungen()) {
  return dienst(einstellungen).testeVerbindung(einstellungen);
}

export { ErkennungsFehler } from './gemeinsam.js';
