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
];

const STANDARD = {
  betriebsart: 'direkt',
  anbieter: 'google',
  schluessel: {}, // { anbieterId: 'Schlüssel' }
  modelle: {}, // { anbieterId: 'Modell-ID' }
  serverUrl: '',
  serverPasswort: '',
  bildschirmAn: true, // Bildschirm in der Einkaufsliste nicht ausgehen lassen
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

export function ladeEinstellungen() {
  const daten = liesGespeichert();
  const anbieter = anbieterInfo(daten.anbieter);
  const modell = anbieter.modelle.some((m) => m.id === daten.modelle[anbieter.id])
    ? daten.modelle[anbieter.id]
    : anbieter.modelle[0].id;
  return { ...daten, anbieter: anbieter.id, apiSchluessel: daten.schluessel[anbieter.id] ?? '', modell };
}

/**
 * Speichert Änderungen. "apiSchluessel" und "modell" gelten für den (ggf. neu gewählten) Anbieter.
 * Wechselt der Anbieter, bleiben Schlüssel und Modell des alten Anbieters erhalten.
 */
export function speichereEinstellungen(aenderungen) {
  const daten = liesGespeichert();
  const { apiSchluessel, modell, ...rest } = aenderungen;
  const anbieterWechsel = rest.anbieter && rest.anbieter !== daten.anbieter;
  Object.assign(daten, rest);
  if (!anbieterWechsel) {
    if (apiSchluessel !== undefined) daten.schluessel[daten.anbieter] = apiSchluessel.trim();
    if (modell !== undefined) daten.modelle[daten.anbieter] = modell;
  }
  localStorage.setItem(SCHLUESSEL, JSON.stringify(daten));
}
