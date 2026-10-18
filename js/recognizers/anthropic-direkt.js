// Erkennung direkt vom Handy aus mit der Anthropic-API (Betriebsart "direkt").
// Der API-Schlüssel kommt aus den Einstellungen und wird nur an api.anthropic.com gesendet.

import {
  anweisungMit, textNachricht, ANTWORT_SCHEMA, ErkennungsFehler, werteAntwortAus,
  fehlerAusAntwort, sicherFetch, fehlerNachricht,
} from './gemeinsam.js';

const API = 'https://api.anthropic.com/v1';

function kopfzeilen(schluessel, beta) {
  return {
    'x-api-key': schluessel,
    'anthropic-version': '2023-06-01',
    // Erlaubt Aufrufe direkt aus dem Browser (nötig für Betriebsart "direkt").
    'anthropic-dangerous-direct-browser-access': 'true',
    'content-type': 'application/json',
    ...(beta ? { 'anthropic-beta': beta } : {}),
  };
}

function pruefeSchluessel(einstellungen) {
  if (!einstellungen.apiSchluessel?.trim()) {
    throw new ErkennungsFehler('kein-schluessel', 'Es ist noch kein API-Schlüssel eingetragen. Bitte in den Einstellungen hinterlegen.');
  }
  return einstellungen.apiSchluessel.trim();
}

async function sendeAnfrage(schluessel, anfrage, mitAusweichModell, signal) {
  const body = { ...anfrage };
  // Lehnt das Modell ausnahmsweise ab, springt serverseitig ein anderes ein (nicht bei Haiku verfügbar).
  if (mitAusweichModell) body.fallbacks = 'default';
  return sicherFetch(`${API}/messages`, {
    method: 'POST',
    headers: kopfzeilen(schluessel, mitAusweichModell ? 'server-side-fallback-2026-07-01' : null),
    body: JSON.stringify(body),
    signal,
  });
}

export function erkenne(bild, einstellungen, signal, kontext = {}) {
  return frage(einstellungen, anweisungMit(kontext.bekannteArtikel), [
    { type: 'image', source: { type: 'base64', media_type: bild.mediaType, data: bild.base64 } },
    { type: 'text', text: 'Lies diesen Einkaufszettel.' },
  ], signal);
}

export function erkenneText(text, einstellungen, signal, kontext = {}) {
  return frage(einstellungen, anweisungMit(kontext.bekannteArtikel, 'text'), [
    { type: 'text', text: textNachricht(text) },
  ], signal);
}

async function frage(einstellungen, anweisung, inhalt, signal) {
  const schluessel = pruefeSchluessel(einstellungen);
  const anfrage = {
    model: einstellungen.modell,
    max_tokens: 16000,
    system: anweisung,
    messages: [{ role: 'user', content: inhalt }],
    output_config: {
      effort: 'low', // reines Ablesen braucht kein langes Nachdenken – schneller und günstiger
      format: { type: 'json_schema', schema: ANTWORT_SCHEMA },
    },
  };

  let mitAusweichModell = !einstellungen.modell.startsWith('claude-haiku');
  let antwort = await sendeAnfrage(schluessel, anfrage, mitAusweichModell, signal);
  let nachricht = antwort.ok ? '' : await fehlerNachricht(antwort);

  // Falls das Konto die Ausweich-Funktion nicht unterstützt: einmal ohne sie wiederholen.
  if (antwort.status === 400 && mitAusweichModell && /fallback/i.test(nachricht)) {
    mitAusweichModell = false;
    antwort = await sendeAnfrage(schluessel, anfrage, false, signal);
    nachricht = antwort.ok ? '' : await fehlerNachricht(antwort);
  }
  if (!antwort.ok) throw fehlerAusAntwort(antwort.status, nachricht);

  const daten = await antwort.json();
  if (daten.stop_reason === 'refusal') {
    throw new ErkennungsFehler('abgelehnt', 'Die KI hat die Anfrage abgelehnt. Bitte erneut versuchen.');
  }
  if (daten.stop_reason === 'max_tokens') {
    throw new ErkennungsFehler('zu-lang', 'Der Zettel ist zu lang für eine Anfrage. Bitte in mehreren Fotos einlesen.');
  }
  const text = daten.content?.find((b) => b.type === 'text')?.text;
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new ErkennungsFehler('antwort', 'Die Antwort der KI war unvollständig. Bitte erneut versuchen.');
  }
  return werteAntwortAus(json);
}

/** Prüft den Schlüssel mit einer kostenlosen Abfrage (Modellliste). */
export async function testeVerbindung(einstellungen) {
  const schluessel = pruefeSchluessel(einstellungen);
  const antwort = await sicherFetch(`${API}/models/${encodeURIComponent(einstellungen.modell)}`, {
    headers: kopfzeilen(schluessel),
  });
  if (!antwort.ok) throw fehlerAusAntwort(antwort.status, await fehlerNachricht(antwort));
  return 'Verbindung OK – der Schlüssel funktioniert und das Modell ist verfügbar.';
}
