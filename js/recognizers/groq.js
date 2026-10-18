// Erkennung direkt vom Handy aus mit der Groq-API (Betriebsart "direkt", Anbieter "groq").
// Groq hat einen kostenlosen Tarif mit Tageslimit und ist sehr schnell.
// Neben Fotos und Text kann Groq auch Sprachaufnahmen abschreiben (Whisper).
// Der API-Schlüssel kommt aus den Einstellungen und wird nur an api.groq.com gesendet.

import {
  anweisungMit, textNachricht, ANTWORT_SCHEMA, ErkennungsFehler, werteAntwortAus,
  fehlerAusAntwort, sicherFetch, fehlerNachricht,
} from './gemeinsam.js';
import { anbieterInfo } from '../einstellungen.js';

const API = 'https://api.groq.com/openai/v1';
export const WHISPER_MODELL = 'whisper-large-v3-turbo';

function pruefeSchluessel(schluessel) {
  if (!schluessel?.trim()) {
    throw new ErkennungsFehler('kein-schluessel', 'Es ist noch kein Groq-API-Schlüssel eingetragen. Bitte in den Einstellungen hinterlegen.');
  }
  return schluessel.trim();
}

/** Groq meldet manche Fehler anders – hier passend übersetzen. */
function groqFehler(status, nachricht) {
  if (status === 401 || /invalid api key/i.test(nachricht)) {
    return new ErkennungsFehler('schluessel-ungueltig', 'Der Groq-API-Schlüssel ist ungültig. Bitte in den Einstellungen prüfen.');
  }
  if (status === 429) {
    return new ErkennungsFehler('zu-viele', 'Das kostenlose Kontingent von Groq ist gerade ausgeschöpft. Bitte etwas warten und erneut versuchen.');
  }
  if (status === 404 || /model.*(not found|decommissioned|does not exist)/i.test(nachricht)) {
    return new ErkennungsFehler('modell', 'Das gewählte Groq-Modell ist nicht (mehr) verfügbar. Bitte in den Einstellungen ein anderes wählen.');
  }
  return fehlerAusAntwort(status, nachricht);
}

async function frage(einstellungen, nachrichten, signal) {
  const schluessel = pruefeSchluessel(einstellungen.apiSchluessel);
  const modell = anbieterInfo('groq').modelle.find((m) => m.id === einstellungen.modell);
  const antwort = await sicherFetch(`${API}/chat/completions`, {
    method: 'POST',
    headers: { authorization: `Bearer ${schluessel}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      model: einstellungen.modell,
      messages: nachrichten,
      response_format: {
        type: 'json_schema',
        json_schema: { name: 'einkaufsliste', strict: true, schema: ANTWORT_SCHEMA },
      },
      // Ablesen braucht kein langes Nachdenken; Denktext nie in die Antwort mischen.
      ...(modell?.denken ? { reasoning_effort: modell.denken } : {}),
      reasoning_format: 'hidden',
      max_completion_tokens: 8000,
    }),
    signal,
  });
  if (!antwort.ok) throw groqFehler(antwort.status, await fehlerNachricht(antwort));

  const daten = await antwort.json();
  const wahl = daten.choices?.[0];
  if (wahl?.finish_reason === 'length') {
    throw new ErkennungsFehler('zu-lang', 'Die Liste ist zu lang für eine Anfrage. Bitte in mehreren Teilen einlesen.');
  }
  let json;
  try {
    json = JSON.parse(wahl?.message?.content);
  } catch {
    throw new ErkennungsFehler('antwort', 'Die Antwort von Groq war unvollständig. Bitte erneut versuchen.');
  }
  return werteAntwortAus(json);
}

export function erkenne(bild, einstellungen, signal, kontext = {}) {
  return frage(einstellungen, [
    { role: 'system', content: anweisungMit(kontext.bekannteArtikel) },
    {
      role: 'user',
      content: [
        { type: 'text', text: 'Lies diesen Einkaufszettel.' },
        { type: 'image_url', image_url: { url: `data:${bild.mediaType};base64,${bild.base64}` } },
      ],
    },
  ], signal);
}

export function erkenneText(text, einstellungen, signal, kontext = {}) {
  return frage(einstellungen, [
    { role: 'system', content: anweisungMit(kontext.bekannteArtikel, 'text') },
    { role: 'user', content: textNachricht(text) },
  ], signal);
}

/**
 * Sprachaufnahme in Text umwandeln (Whisper). Die bekannten Artikel gehen als Hinweis mit,
 * damit Produktnamen richtig geschrieben werden.
 */
export async function transkribiere(aufnahme, schluessel, signal, kontext = {}) {
  const formular = new FormData();
  const endung = aufnahme.type.includes('mp4') ? 'mp4' : aufnahme.type.includes('ogg') ? 'ogg' : 'webm';
  formular.append('file', aufnahme, `aufnahme.${endung}`);
  formular.append('model', WHISPER_MODELL);
  formular.append('language', 'de');
  formular.append('response_format', 'json');
  const bekannte = (kontext.bekannteArtikel ?? []).slice(0, 40);
  formular.append('prompt', `Einkaufsliste${bekannte.length ? `: ${bekannte.join(', ')}` : ''}.`);

  const antwort = await sicherFetch(`${API}/audio/transcriptions`, {
    method: 'POST',
    headers: { authorization: `Bearer ${pruefeSchluessel(schluessel)}` },
    body: formular,
    signal,
  });
  if (!antwort.ok) throw groqFehler(antwort.status, await fehlerNachricht(antwort));
  const daten = await antwort.json();
  return (daten.text ?? '').trim();
}

/** Prüft Schlüssel und Modell mit einer kostenlosen Abfrage (Modell-Info). */
export async function testeVerbindung(einstellungen) {
  const schluessel = pruefeSchluessel(einstellungen.apiSchluessel);
  // Groq-Modellnamen enthalten einen Schrägstrich ("qwen/…"), der hier nicht kodiert werden darf.
  const pfad = einstellungen.modell.split('/').map(encodeURIComponent).join('/');
  const antwort = await sicherFetch(`${API}/models/${pfad}`, {
    headers: { authorization: `Bearer ${schluessel}` },
  });
  if (!antwort.ok) throw groqFehler(antwort.status, await fehlerNachricht(antwort));
  return 'Verbindung OK – der Schlüssel funktioniert und das Modell ist verfügbar.';
}
