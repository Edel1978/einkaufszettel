// Erkennung direkt vom Handy aus mit der Google-Gemini-API (Betriebsart "direkt", Anbieter "google").
// Gemini-Flash-Modelle haben einen kostenlosen Tarif (mit Tageslimit).
// Der API-Schlüssel kommt aus den Einstellungen und wird nur an generativelanguage.googleapis.com gesendet.

import {
  anweisungMit, textNachricht, fotoTeile, SICHERHEITEN, QUELLEN, ZUSTAENDE, ErkennungsFehler, werteAntwortAus, fehlerAusAntwort, sicherFetch, fehlerNachricht,
} from './gemeinsam.js';
import { KATEGORIEN } from '../kategorien.js';
import { anbieterInfo } from '../einstellungen.js';

const API = 'https://generativelanguage.googleapis.com/v1beta';

// Antwortformat im Schema-Dialekt von Gemini (wie ANTWORT_SCHEMA, aber mit "nullable").
const GEMINI_SCHEMA = {
  type: 'OBJECT',
  properties: {
    eintraege: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          name: { type: 'STRING' },
          menge: { type: 'NUMBER', nullable: true },
          einheit: { type: 'STRING' },
          notiz: { type: 'STRING' },
          original: { type: 'STRING' },
          code: { type: 'STRING' },
          quelle: { type: 'STRING', enum: QUELLEN },
          kategorie: { type: 'STRING', enum: KATEGORIEN.map((k) => k.id) },
          sicherheit: { type: 'STRING', enum: SICHERHEITEN },
        },
        required: ['name', 'menge', 'einheit', 'notiz', 'original', 'code', 'quelle', 'kategorie', 'sicherheit'],
        propertyOrdering: ['quelle', 'code', 'original', 'name', 'menge', 'einheit', 'notiz', 'kategorie', 'sicherheit'],
      },
    },
    hinweis: { type: 'STRING' },
    kennung: { type: 'STRING' },
    markierungen: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          code: { type: 'STRING' },
          zustand: { type: 'STRING', enum: ZUSTAENDE },
        },
        required: ['code', 'zustand'],
        propertyOrdering: ['code', 'zustand'],
      },
    },
  },
  required: ['kennung', 'markierungen', 'eintraege', 'hinweis'],
  propertyOrdering: ['kennung', 'markierungen', 'eintraege', 'hinweis'],
};

function pruefeSchluessel(einstellungen) {
  if (!einstellungen.apiSchluessel?.trim()) {
    throw new ErkennungsFehler('kein-schluessel', 'Es ist noch kein Gemini-API-Schlüssel eingetragen. Bitte in den Einstellungen hinterlegen.');
  }
  return einstellungen.apiSchluessel.trim();
}

/** Gemini meldet manche Fehler anders als Anthropic – hier passend übersetzen. */
function geminiFehler(status, nachricht) {
  if (/api key not valid|api_key_invalid|api key expired/i.test(nachricht)) {
    return new ErkennungsFehler('schluessel-ungueltig', 'Der Gemini-API-Schlüssel ist ungültig. Bitte in den Einstellungen prüfen.');
  }
  if (status === 429) {
    return new ErkennungsFehler('zu-viele', 'Das kostenlose Kontingent von Gemini ist gerade ausgeschöpft. Bitte etwas warten (das Tageslimit setzt sich über Nacht zurück).');
  }
  if (status === 404) {
    return new ErkennungsFehler('modell', 'Das gewählte Gemini-Modell ist nicht verfügbar. Bitte in den Einstellungen ein anderes wählen.');
  }
  return fehlerAusAntwort(status, nachricht);
}

export function erkenne(bild, einstellungen, signal, kontext = {}) {
  const teile = fotoTeile(bild).map((t) => (t.text ? { text: t.text } : { inline_data: { mime_type: t.mediaType, data: t.base64 } }));
  return frage(einstellungen, anweisungMit(kontext.bekannteArtikel), teile, signal);
}

export function erkenneText(text, einstellungen, signal, kontext = {}) {
  return frage(einstellungen, anweisungMit(kontext.bekannteArtikel, 'text'), [{ text: textNachricht(text) }], signal);
}

async function frage(einstellungen, anweisung, teile, signal, ersatzVersucht = false) {
  const schluessel = pruefeSchluessel(einstellungen);
  const anfrage = {
    systemInstruction: { parts: [{ text: anweisung }] },
    contents: [{ role: 'user', parts: teile }],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: GEMINI_SCHEMA,
    },
  };
  // Kurz nachdenken reicht zum Ablesen und ist um ein Vielfaches schneller als der Standard.
  const modell = anbieterInfo('google').modelle.find((m) => m.id === einstellungen.modell);
  if (modell?.denken) anfrage.generationConfig.thinkingConfig = { thinkingLevel: modell.denken };

  const antwort = await sicherFetch(`${API}/models/${encodeURIComponent(einstellungen.modell)}:generateContent`, {
    method: 'POST',
    headers: { 'x-goog-api-key': schluessel, 'content-type': 'application/json' },
    body: JSON.stringify(anfrage),
    signal,
  });
  // Überlastet (503): einmal mit dem anderen Flash-Modell versuchen, bevor der zweite Dienst einspringt.
  if (antwort.status === 503 && modell?.ersatz && !ersatzVersucht) {
    return frage({ ...einstellungen, modell: modell.ersatz }, anweisung, teile, signal, true);
  }
  if (!antwort.ok) throw geminiFehler(antwort.status, await fehlerNachricht(antwort));

  const daten = await antwort.json();
  if (daten.promptFeedback?.blockReason) {
    throw new ErkennungsFehler('abgelehnt', 'Gemini hat die Anfrage abgelehnt. Bitte erneut versuchen.');
  }
  const kandidat = daten.candidates?.[0];
  if (kandidat?.finishReason === 'MAX_TOKENS') {
    throw new ErkennungsFehler('zu-lang', 'Der Zettel ist zu lang für eine Anfrage. Bitte in mehreren Fotos einlesen.');
  }
  const text = kandidat?.content?.parts?.filter((p) => typeof p.text === 'string' && !p.thought).map((p) => p.text).join('');
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new ErkennungsFehler('antwort', 'Die Antwort von Gemini war unvollständig. Bitte erneut versuchen.');
  }
  return werteAntwortAus(json);
}

/** Prüft Schlüssel und Modell mit einer kostenlosen Abfrage (Modell-Info). */
export async function testeVerbindung(einstellungen) {
  const schluessel = pruefeSchluessel(einstellungen);
  const antwort = await sicherFetch(`${API}/models/${encodeURIComponent(einstellungen.modell)}`, {
    headers: { 'x-goog-api-key': schluessel },
  });
  if (!antwort.ok) throw geminiFehler(antwort.status, await fehlerNachricht(antwort));
  return 'Verbindung OK – der Schlüssel funktioniert und das Modell ist verfügbar.';
}
