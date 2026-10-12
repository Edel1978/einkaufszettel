// Erkennung direkt vom Handy aus mit der Google-Gemini-API (Betriebsart "direkt", Anbieter "google").
// Gemini-Flash-Modelle haben einen kostenlosen Tarif (mit Tageslimit).
// Der API-Schlüssel kommt aus den Einstellungen und wird nur an generativelanguage.googleapis.com gesendet.

import {
  anweisungMit, ErkennungsFehler, werteAntwortAus, fehlerAusAntwort, sicherFetch, fehlerNachricht,
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
          kategorie: { type: 'STRING', enum: KATEGORIEN.map((k) => k.id) },
          unsicher: { type: 'BOOLEAN' },
        },
        required: ['name', 'menge', 'einheit', 'kategorie', 'unsicher'],
        propertyOrdering: ['name', 'menge', 'einheit', 'kategorie', 'unsicher'],
      },
    },
    hinweis: { type: 'STRING' },
  },
  required: ['eintraege', 'hinweis'],
  propertyOrdering: ['eintraege', 'hinweis'],
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

export async function erkenne(bild, einstellungen, signal, kontext = {}) {
  const schluessel = pruefeSchluessel(einstellungen);
  const anfrage = {
    systemInstruction: { parts: [{ text: anweisungMit(kontext.bekannteArtikel) }] },
    contents: [{
      role: 'user',
      parts: [
        { inline_data: { mime_type: bild.mediaType, data: bild.base64 } },
        { text: 'Lies diesen Einkaufszettel.' },
      ],
    }],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: GEMINI_SCHEMA,
    },
  };
  // Kurz nachdenken reicht zum Ablesen und ist um ein Vielfaches schneller als der Standard.
  const denken = anbieterInfo('google').modelle.find((m) => m.id === einstellungen.modell)?.denken;
  if (denken) anfrage.generationConfig.thinkingConfig = { thinkingLevel: denken };

  const antwort = await sicherFetch(`${API}/models/${encodeURIComponent(einstellungen.modell)}:generateContent`, {
    method: 'POST',
    headers: { 'x-goog-api-key': schluessel, 'content-type': 'application/json' },
    body: JSON.stringify(anfrage),
    signal,
  });
  if (!antwort.ok) throw geminiFehler(antwort.status, await fehlerNachricht(antwort));

  const daten = await antwort.json();
  if (daten.promptFeedback?.blockReason) {
    throw new ErkennungsFehler('abgelehnt', 'Gemini hat das Foto abgelehnt. Bitte ein anderes Foto versuchen.');
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
