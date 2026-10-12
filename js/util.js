// Kleine Hilfsfunktionen, die überall gebraucht werden.

/** Text für die sichere Ausgabe in HTML maskieren. */
export function esc(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Eindeutige ID (für Listen und Einträge – wichtig für spätere Synchronisierung). */
export function neueId() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

/** Aktueller Zeitpunkt als ISO-Text. */
export function jetzt() {
  return new Date().toISOString();
}

/** Zahl deutsch formatieren: 1.5 → "1,5", 2 → "2". */
export function formatZahl(zahl) {
  if (zahl == null || Number.isNaN(zahl)) return '';
  return Number(zahl).toLocaleString('de-DE', { maximumFractionDigits: 2 });
}

/** Deutsche Zahleneingabe lesen: "1,5" → 1.5, "" → null. */
export function leseZahl(text) {
  const t = String(text ?? '').trim().replace(',', '.');
  if (t === '') return null;
  const zahl = Number(t);
  return Number.isFinite(zahl) && zahl > 0 ? zahl : null;
}
