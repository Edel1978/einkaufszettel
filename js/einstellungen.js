// Einstellungen der App (nur auf diesem Gerät gespeichert).
//
// Gespeichert wird je Anbieter ein eigener Schlüssel und ein eigenes Modell, damit beim
// Wechsel zwischen Anbietern nichts verloren geht. ladeEinstellungen() liefert zusätzlich
// "apiSchluessel" und "modell" für den aktuell gewählten Anbieter.

const SCHLUESSEL = 'einkaufszettel.einstellungen.v1';

/** Betriebsarten der Texterkennung. */
export const BETRIEBSARTEN = [
  { id: 'direkt', name: 'Direkt mit eigenem API-Schlüssel', info: 'Der Schlüssel wird nur auf diesem Gerät gespeichert.' },
  { id: 'server', name: 'Über eigenen Server', info: 'Der Schlüssel liegt geschützt auf dem Server (wird in Phase 6 eingerichtet).' },
  { id: 'demo', name: 'Testmodus (Beispieldaten)', info: 'Ohne KI und ohne Kosten – liefert immer denselben Beispiel-Zettel.' },
];

/** Anbieter für die direkte Erkennung. Neue Anbieter hier und in recognizers/index.js eintragen. */
export const ANBIETER = [
  {
    id: 'google',
    name: 'Google Gemini (kostenloser Tarif)',
    schluesselHinweis: 'aus Google AI Studio',
    schluesselLink: 'https://aistudio.google.com/apikey',
    info: 'Kostenlos mit Tageslimit. Im kostenlosen Tarif darf Google die gesendeten Fotos zur Verbesserung seiner Dienste verwenden.',
    // "denken": wie lange das Modell nachdenkt. Ablesen braucht wenig – im Test (12.10.2026)
    // war 3.8 Flash mit "low" 12 s statt 95 s schnell, bei gleich gutem Ergebnis.
    // (gemini-2.5-flash ist für neue Konten nicht mehr verfügbar.)
    modelle: [
      { id: 'gemini-3.8-flash', name: 'Gemini 3.8 Flash – kostenlos, genau (ca. 10 s)', denken: 'low' },
      { id: 'gemini-3.5-flash-lite', name: 'Gemini 3.5 Flash-Lite – kostenlos, etwas schneller', denken: 'minimal' },
    ],
  },
  {
    id: 'anthropic',
    name: 'Anthropic Claude (kostenpflichtig)',
    schluesselHinweis: 'beginnt mit „sk-ant-“',
    schluesselLink: 'https://console.anthropic.com/settings/keys',
    info: 'Bezahlung pro Foto über ein aufgeladenes Guthaben.',
    modelle: [
      { id: 'claude-opus-5-5', name: 'Claude Opus 5.5 – am genauesten (ca. 4 Cent/Foto)' },
      { id: 'claude-sonnet-5-5', name: 'Claude Sonnet 5.5 – ausgewogen (ca. 2 Cent/Foto)' },
      { id: 'claude-haiku-5-5', name: 'Claude Haiku 5.5 – am günstigsten (unter 0,2 Cent/Foto)' },
    ],
  },
  {
    id: 'groq',
    name: 'Groq (kostenloser Tarif)',
    schluesselHinweis: 'beginnt mit „gsk_“',
    schluesselLink: 'https://console.groq.com/keys',
    info: 'Kostenlos mit Tageslimit und sehr schnell. Das Foto-Modell ist bei Groq noch eine Vorschau-Version und kann sich ändern.',
    // Stand 18.10.2026: Bilder liest bei Groq nur dieses Modell (Vorschau).
    modelle: [
      { id: 'qwen/qwen3.8-27b', name: 'Qwen 3.8 27B – liest Fotos (Vorschau)', denken: 'none' },
    ],
  },
];

/** Womit gesprochene Sprache in Text umgewandelt wird. */
export const SPRACHEINGABEN = [
  { id: 'browser', name: 'Spracherkennung des Handys', info: 'Kostenlos, ohne Schlüssel; der Text erscheint schon beim Sprechen.' },
  { id: 'groq', name: 'Groq Whisper', info: 'Sehr genau, auch bei Produktnamen. Braucht einen kostenlosen Groq-Schlüssel.' },
];

/** Hell/Dunkel-Auswahl. */
export const DARSTELLUNGEN = [
  { id: 'auto', name: 'Automatisch', info: 'Wie am Handy eingestellt' },
  { id: 'hell', name: 'Hell', info: 'Immer helle Farben' },
  { id: 'dunkel', name: 'Dunkel', info: 'Immer dunkle Farben' },
];

const STANDARD = {
  betriebsart: 'direkt',
  anbieter: 'google', // erster Dienst
  ausweichAnbieter: '', // zweiter Dienst, falls der erste nicht klappt ('' = keiner)
  schluessel: {}, // { anbieterId: 'Schlüssel' }
  modelle: {}, // { anbieterId: 'Modell-ID' }
  serverUrl: '',
  serverPasswort: '',
  bildschirmAn: true, // Bildschirm in der Einkaufsliste nicht ausgehen lassen
  spracheingabe: 'browser',
  darstellung: 'auto', // 'auto' (wie das Handy), 'hell' oder 'dunkel'
};

export function anbieterInfo(id) {
  return ANBIETER.find((a) => a.id === id) ?? ANBIETER[0];
}

function liesGespeichert() {
  try {
    const roh = JSON.parse(localStorage.getItem(SCHLUESSEL) ?? '{}');
    const daten = { ...STANDARD, ...roh, schluessel: { ...roh.schluessel }, modelle: { ...roh.modelle } };
    // Älteres Format (ein Schlüssel für Anthropic) übernehmen.
    if (roh.apiSchluessel && !daten.schluessel.anthropic) daten.schluessel.anthropic = roh.apiSchluessel;
    if (roh.modell?.startsWith('claude') && !daten.modelle.anthropic) daten.modelle.anthropic = roh.modell;
    delete daten.apiSchluessel;
    delete daten.modell;
    return daten;
  } catch {
    return { ...STANDARD, schluessel: {}, modelle: {} };
  }
}

/** Gültiges Modell eines Anbieters (gespeicherte Wahl oder das erste in der Liste). */
export function modellFuer(daten, anbieterId) {
  const anbieter = anbieterInfo(anbieterId);
  return anbieter.modelle.some((m) => m.id === daten.modelle?.[anbieter.id])
    ? daten.modelle[anbieter.id]
    : anbieter.modelle[0].id;
}

/** Einstellungen so, als wäre der angegebene Anbieter gewählt (mit dessen Schlüssel und Modell). */
function fuerAnbieter(daten, anbieterId) {
  const id = anbieterInfo(anbieterId).id;
  return { ...daten, anbieter: id, apiSchluessel: daten.schluessel[id] ?? '', modell: modellFuer(daten, id) };
}

/**
 * Aktuelle Einstellungen. "apiSchluessel" und "modell" gehören zum ersten Dienst ("anbieter").
 */
export function ladeEinstellungen() {
  const daten = liesGespeichert();
  const erster = anbieterInfo(daten.anbieter).id;
  const ausweich = ANBIETER.some((a) => a.id === daten.ausweichAnbieter) && daten.ausweichAnbieter !== erster
    ? daten.ausweichAnbieter
    : '';
  return {
    ...fuerAnbieter(daten, erster),
    ausweichAnbieter: ausweich,
    groqSchluessel: daten.schluessel.groq ?? '', // auch für Whisper, wenn Groq nicht gewählt ist
  };
}

/** Einstellungen für einen bestimmten Anbieter (z. B. für den Verbindungstest). */
export function einstellungenFuer(anbieterId) {
  return fuerAnbieter(ladeEinstellungen(), anbieterId);
}

/**
 * Einstellungen für den zweiten Dienst – oder null, wenn keiner gewählt ist,
 * er keinen Schlüssel hat oder nicht im Direkt-Betrieb gearbeitet wird.
 */
export function ausweichEinstellungen(einstellungen = ladeEinstellungen()) {
  const id = einstellungen.ausweichAnbieter;
  if (einstellungen.betriebsart !== 'direkt' || !id) return null;
  const zweiter = fuerAnbieter(einstellungen, id);
  return zweiter.apiSchluessel ? zweiter : null;
}

/**
 * Speichert Änderungen.
 * - "schluessel" / "modelle": Teil-Objekte je Anbieter, werden ergänzt ({ groq: 'gsk_…' }).
 * - "apiSchluessel" / "modell": kurz für den ersten Dienst.
 * - "groqSchluessel": kurz für den Groq-Schlüssel (z. B. für Whisper).
 */
export function speichereEinstellungen(aenderungen) {
  const daten = liesGespeichert();
  const { apiSchluessel, modell, groqSchluessel, schluessel, modelle, ...rest } = aenderungen;
  Object.assign(daten, rest);
  for (const [id, wert] of Object.entries(schluessel ?? {})) daten.schluessel[id] = String(wert).trim();
  Object.assign(daten.modelle, modelle);
  if (groqSchluessel !== undefined) daten.schluessel.groq = groqSchluessel.trim();
  if (apiSchluessel !== undefined) daten.schluessel[daten.anbieter] = apiSchluessel.trim();
  if (modell !== undefined) daten.modelle[daten.anbieter] = modell;
  if (daten.ausweichAnbieter === daten.anbieter) daten.ausweichAnbieter = '';
  localStorage.setItem(SCHLUESSEL, JSON.stringify(daten));
}
