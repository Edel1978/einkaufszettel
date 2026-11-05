// Excel-Export einer Liste im Format, das der Browser-Helfer „REWE Einkauf“ erwartet:
//   Blatt „Einkaufsliste“, Spalten Artikel | Menge | Einheit | Notiz | Original | Sicherheit,
//   ein Artikel pro Zeile (nur offene Artikel), Dateiname Einkaufsliste_JJJJ-MM-TT(_2).xlsx.
//
// Wege, die Datei loszuwerden:
//   - "ordner":        am PC (Chrome/Edge) direkt in einen einmal gewählten Ordner speichern
//   - "teilen":        Teilen-Menü des Handys (Mail, Drive, Tailscale/Taildrop …)
//   - "herunterladen": normaler Download

import { erzeugeXlsx } from './xlsx.js';
import { formatZahl } from './util.js';

export const SPALTEN = ['Artikel', 'Menge', 'Einheit', 'Notiz', 'Original', 'Sicherheit'];
const BREITEN = [24, 9, 10, 26, 32, 11];
const MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

// Schreibweise der Einheiten im Export (die App selbst bleibt bei ihren Kürzeln).
const EINHEIT_EXPORT = { stk: 'Stück', 'stk.': 'Stück', 'pck.': 'Pck', pck: 'Pck', flasche: 'Fl' };

export function exportEinheit(einheit) {
  const e = String(einheit ?? '').trim();
  return EINHEIT_EXPORT[e.toLowerCase()] ?? e;
}

/** Zeilen der Tabelle (ohne Kopfzeile) aus den offenen Artikeln einer Liste, in Zettel-Reihenfolge. */
export function exportZeilen(liste) {
  return liste.eintraege
    .filter((e) => !e.erledigt)
    .sort((a, b) => a.reihenfolge - b.reihenfolge)
    .map((e) => {
      const einheit = exportEinheit(e.einheit);
      // Von Hand eingetragene (oder ältere) Artikel haben keine Originalzeile: dann aus den Angaben bilden.
      const original = e.original?.trim()
        || [formatZahl(e.menge), e.einheit, e.name, e.notiz].filter(Boolean).join(' ');
      return [e.name, e.menge ?? 1, einheit, e.notiz ?? '', original, e.sicherheit ?? 'hoch'];
    });
}

export function erzeugeExportDatei(liste) {
  return erzeugeXlsx({ blattName: 'Einkaufsliste', zeilen: [SPALTEN, ...exportZeilen(liste)], breiten: BREITEN });
}

/** Einkaufsliste_2026-11-05.xlsx, ab der zweiten am selben Tag Einkaufsliste_2026-11-05_2.xlsx usw. */
export function dateiName(datum = new Date(), nummer = 1) {
  const tag = `${datum.getFullYear()}-${String(datum.getMonth() + 1).padStart(2, '0')}-${String(datum.getDate()).padStart(2, '0')}`;
  return `Einkaufsliste_${tag}${nummer > 1 ? `_${nummer}` : ''}.xlsx`;
}

// ---------- Nummer beim Teilen/Herunterladen (dort sieht die App die vorhandenen Dateien nicht) ----------

const ZAEHLER = 'einkaufszettel.export-zaehler';

function naechsterName() {
  const name1 = dateiName();
  let stand = {};
  try { stand = JSON.parse(localStorage.getItem(ZAEHLER) ?? '{}'); } catch { /* neu anfangen */ }
  const nummer = stand.name1 === name1 ? stand.nummer + 1 : 1;
  try { localStorage.setItem(ZAEHLER, JSON.stringify({ name1, nummer })); } catch { /* egal */ }
  return dateiName(new Date(), nummer);
}

// ---------- Ordner am PC (File System Access API) ----------

const DB_NAME = 'einkaufszettel-export';

function datenbank() {
  return new Promise((resolve, reject) => {
    const anfrage = indexedDB.open(DB_NAME, 1);
    anfrage.onupgradeneeded = () => anfrage.result.createObjectStore('ordner');
    anfrage.onsuccess = () => resolve(anfrage.result);
    anfrage.onerror = () => reject(anfrage.error);
  });
}

async function ordnerSpeicher(art, wert) {
  const db = await datenbank();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('ordner', art === 'lesen' ? 'readonly' : 'readwrite');
    const store = tx.objectStore('ordner');
    const anfrage = art === 'lesen' ? store.get('export') : store.put(wert, 'export');
    anfrage.onsuccess = () => resolve(anfrage.result);
    anfrage.onerror = () => reject(anfrage.error);
  });
}

export function ordnerMoeglich() {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
}

/** Name des gemerkten Export-Ordners oder null. */
export async function gemerkterOrdner() {
  if (!ordnerMoeglich()) return null;
  try { return (await ordnerSpeicher('lesen'))?.name ?? null; } catch { return null; }
}

async function holeOrdner(neuWaehlen) {
  let ordner = neuWaehlen ? null : await ordnerSpeicher('lesen').catch(() => null);
  if (ordner) {
    const recht = { mode: 'readwrite' };
    if ((await ordner.queryPermission(recht)) !== 'granted' && (await ordner.requestPermission(recht)) !== 'granted') ordner = null;
  }
  if (!ordner) {
    ordner = await window.showDirectoryPicker({ id: 'einkaufszettel-export', mode: 'readwrite', startIn: 'documents' });
    await ordnerSpeicher('schreiben', ordner);
  }
  return ordner;
}

async function freierName(ordner) {
  for (let nummer = 1; ; nummer++) {
    const name = dateiName(new Date(), nummer);
    try {
      await ordner.getFileHandle(name);
    } catch (fehler) {
      if (fehler.name === 'NotFoundError') return name;
      throw fehler;
    }
  }
}

// ---------- Export ----------

/** Welche Wege auf diesem Gerät gehen. */
export async function exportWege() {
  const wege = [];
  if (ordnerMoeglich()) {
    const ordner = await gemerkterOrdner();
    wege.push({ wert: 'ordner', text: ordner ? `In Ordner „${ordner}“ speichern` : 'In einen Ordner speichern …' });
    if (ordner) wege.push({ wert: 'ordner-neu', text: 'In anderen Ordner speichern …' });
  }
  const probe = new File([new Uint8Array(1)], 'probe.xlsx', { type: MIME });
  if (navigator.canShare?.({ files: [probe] })) wege.push({ wert: 'teilen', text: 'Teilen (Mail, Drive, Tailscale …)' });
  wege.push({ wert: 'herunterladen', text: 'Herunterladen' });
  return wege;
}

/**
 * Exportiert die offenen Artikel einer Liste.
 * Liefert { name, wo } für die Rückmeldung oder null, wenn der Nutzer abgebrochen hat.
 */
export async function exportiere(liste, weg) {
  const bytes = erzeugeExportDatei(liste);
  try {
    if (weg === 'ordner' || weg === 'ordner-neu') {
      const ordner = await holeOrdner(weg === 'ordner-neu');
      const name = await freierName(ordner);
      const datei = await ordner.getFileHandle(name, { create: true });
      const schreiber = await datei.createWritable();
      await schreiber.write(new Blob([bytes], { type: MIME }));
      await schreiber.close();
      return { name, wo: `Ordner „${ordner.name}“` };
    }

    const name = naechsterName();
    const datei = new File([bytes], name, { type: MIME });
    if (weg === 'teilen') {
      try {
        await navigator.share({ files: [datei], title: name });
        return { name, wo: 'geteilt' };
      } catch (fehler) {
        // Chrome auf Android lässt Web-Apps keine Excel-Dateien teilen ("Permission denied"),
        // obwohl canShare() vorher ja sagt. Dann stattdessen herunterladen.
        if (fehler.name !== 'NotAllowedError') throw fehler;
        herunterladen(datei);
        return {
          name,
          wo: 'Teilen von Excel-Dateien erlaubt Chrome nicht – die Datei liegt in „Downloads“. Von dort mit der Dateien-App teilen (z. B. an Tailscale).',
        };
      }
    }

    herunterladen(datei);
    return { name, wo: 'Downloads' };
  } catch (fehler) {
    if (fehler.name === 'AbortError') return null; // Auswahl oder Teilen abgebrochen
    throw fehler;
  }
}

function herunterladen(datei) {
  const url = URL.createObjectURL(datei);
  const link = Object.assign(document.createElement('a'), { href: url, download: datei.name });
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
