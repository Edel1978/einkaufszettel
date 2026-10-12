// Datenmodell und Logik für Listen und Einträge (ohne Oberfläche).
//
// Liste:   { id, name, erstelltAm, geaendertAm, eintraege[] }
// Eintrag: { id, name, menge, einheit, kategorie, erledigt, reihenfolge, geaendertAm }

import { neueId, jetzt } from './util.js';
import { STANDARD_KATEGORIE, kategorieRang, aktuelleKategorie } from './kategorien.js';

const WOCHENTAGE = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

/** Standardname aus dem Datum, z. B. "Mo, 12.10.2026". */
export function datumsName(datum = new Date()) {
  const tag = String(datum.getDate()).padStart(2, '0');
  const monat = String(datum.getMonth() + 1).padStart(2, '0');
  return `${WOCHENTAGE[datum.getDay()]}, ${tag}.${monat}.${datum.getFullYear()}`;
}

/** Hängt " (2)", " (3)" … an, falls der Name schon vergeben ist. */
export function eindeutigerName(name, listen) {
  const vergeben = new Set(listen.map((l) => l.name));
  if (!vergeben.has(name)) return name;
  let n = 2;
  while (vergeben.has(`${name} (${n})`)) n++;
  return `${name} (${n})`;
}

export function neueListe(name) {
  const zeit = jetzt();
  return { id: neueId(), name, erstelltAm: zeit, geaendertAm: zeit, eintraege: [] };
}

export function neuerEintrag({ name, menge = null, einheit = '', kategorie = STANDARD_KATEGORIE }, reihenfolge = 0) {
  return {
    id: neueId(),
    name: name.trim(),
    menge,
    einheit: einheit.trim(),
    kategorie,
    erledigt: false,
    reihenfolge,
    geaendertAm: jetzt(),
  };
}

export function fuegeEintragHinzu(liste, daten) {
  const reihenfolge = liste.eintraege.reduce((max, e) => Math.max(max, e.reihenfolge), -1) + 1;
  const eintrag = neuerEintrag(daten, reihenfolge);
  liste.eintraege.push(eintrag);
  liste.geaendertAm = jetzt();
  return eintrag;
}

/** Entfernt einen Eintrag und liefert ihn zurück (für "Rückgängig"). */
export function entferneEintrag(liste, eintragId) {
  const eintrag = liste.eintraege.find((e) => e.id === eintragId);
  liste.eintraege = liste.eintraege.filter((e) => e.id !== eintragId);
  liste.geaendertAm = jetzt();
  return eintrag;
}

/** Fügt zuvor entfernte Einträge wieder ein (behalten ihre ID und Reihenfolge). */
export function stelleWiederHer(liste, eintraege) {
  const vorhanden = new Set(liste.eintraege.map((e) => e.id));
  liste.eintraege.push(...eintraege.filter((e) => !vorhanden.has(e.id)));
  liste.geaendertAm = jetzt();
}

export function aendereEintrag(liste, eintragId, aenderungen) {
  const eintrag = liste.eintraege.find((e) => e.id === eintragId);
  if (!eintrag) return null;
  Object.assign(eintrag, aenderungen, { geaendertAm: jetzt() });
  liste.geaendertAm = eintrag.geaendertAm;
  return eintrag;
}

export function schalteErledigt(liste, eintragId) {
  const eintrag = liste.eintraege.find((e) => e.id === eintragId);
  return eintrag ? aendereEintrag(liste, eintragId, { erledigt: !eintrag.erledigt }) : null;
}

/** Schrittweite für +/– passend zur Einheit. */
export function mengenSchritt(einheit) {
  const e = String(einheit).toLowerCase().trim();
  if (e === 'g' || e === 'ml') return 100;
  if (e === 'kg' || e === 'l') return 0.5;
  return 1;
}

/** Menge um einen Schritt erhöhen (richtung = 1) oder verringern (richtung = -1). Nie unter einen Schritt. */
export function aendereMenge(liste, eintragId, richtung) {
  const eintrag = liste.eintraege.find((e) => e.id === eintragId);
  if (!eintrag) return null;
  const schritt = mengenSchritt(eintrag.einheit);
  if (richtung < 0 && (eintrag.menge == null || eintrag.menge <= schritt)) return eintrag;
  // Ohne Menge gilt ein Artikel ohne Einheit als "1 Stück": + macht daraus 2.
  const alt = eintrag.menge ?? (eintrag.einheit ? 0 : 1);
  // Auf ganze Schritte runden, damit z. B. 250 g → 300 g → 400 g springt.
  const neu = richtung > 0
    ? Math.floor(alt / schritt + 1e-9) * schritt + schritt
    : Math.ceil(alt / schritt - 1e-9) * schritt - schritt;
  return aendereEintrag(liste, eintragId, { menge: Math.max(schritt, Math.round(neu * 100) / 100) });
}

/** Entfernt alle abgehakten Einträge und liefert sie zurück (für "Rückgängig"). */
export function entferneErledigte(liste) {
  const erledigt = liste.eintraege.filter((e) => e.erledigt);
  liste.eintraege = liste.eintraege.filter((e) => !e.erledigt);
  liste.geaendertAm = jetzt();
  return erledigt;
}

export function setzeHaekchenZurueck(liste) {
  const zeit = jetzt();
  for (const e of liste.eintraege) {
    if (e.erledigt) Object.assign(e, { erledigt: false, geaendertAm: zeit });
  }
  liste.geaendertAm = zeit;
}

/**
 * Einträge nach Kategorien gruppieren (Supermarkt-Reihenfolge).
 * Innerhalb einer Kategorie: offene zuerst, abgehakte unten.
 * Kategorien, in denen alles erledigt ist, rutschen ans Ende.
 */
export function gruppiere(liste) {
  const gruppen = new Map();
  for (const e of liste.eintraege) {
    const id = aktuelleKategorie(e.kategorie);
    if (!gruppen.has(id)) gruppen.set(id, []);
    gruppen.get(id).push(e);
  }
  return [...gruppen.entries()]
    .map(([kategorie, eintraege]) => ({
      kategorie,
      eintraege: eintraege.sort((a, b) => (a.erledigt - b.erledigt) || (a.reihenfolge - b.reihenfolge)),
      fertig: eintraege.every((e) => e.erledigt),
    }))
    .sort((a, b) => (a.fertig - b.fertig) || (kategorieRang(a.kategorie) - kategorieRang(b.kategorie)));
}

export function benenneUm(liste, name) {
  liste.name = name.trim();
  liste.geaendertAm = jetzt();
}

/** Kopie einer Liste mit neuen IDs; alle Häkchen werden zurückgesetzt. */
export function kopiereListe(liste, name) {
  const kopie = neueListe(name);
  kopie.eintraege = liste.eintraege.map((e) => ({
    ...e,
    id: neueId(),
    erledigt: false,
    geaendertAm: kopie.erstelltAm,
  }));
  return kopie;
}

// ---------- Doppelte Artikel (z. B. beim Übernehmen eines Fotos) ----------

function normalisiere(text) {
  return String(text ?? '').toLowerCase().trim().replace(/\s+/g, ' ');
}

/** Vorhandener Eintrag mit gleichem Namen oder null. */
export function findeDoppelt(liste, name) {
  const gesucht = normalisiere(name);
  return liste.eintraege.find((e) => normalisiere(e.name) === gesucht) ?? null;
}

/**
 * Ergebnis, wenn "neu" in "vorhanden" zusammengeführt wird:
 * gleiche Einheit und beide mit Menge → Mengen addieren, sonst vorhandene Angaben behalten
 * und fehlende ergänzen.
 */
export function zusammengefuehrt(vorhanden, neu) {
  const gleicheEinheit = normalisiere(vorhanden.einheit) === normalisiere(neu.einheit);
  if (gleicheEinheit && vorhanden.menge != null && neu.menge != null) {
    return { menge: Math.round((vorhanden.menge + neu.menge) * 100) / 100, einheit: vorhanden.einheit };
  }
  if (vorhanden.menge == null && neu.menge != null) {
    return { menge: neu.menge, einheit: neu.einheit };
  }
  return { menge: vorhanden.menge, einheit: vorhanden.einheit };
}

/**
 * Übernimmt erkannte Einträge in eine Liste.
 * eintraege: [{ name, menge, einheit, kategorie, zusammenfuehren }]
 * Doppelte werden (wenn gewünscht) mit dem vorhandenen Eintrag zusammengeführt
 * und wieder als offen markiert.
 */
export function uebernehmeEintraege(liste, eintraege) {
  for (const neu of eintraege) {
    const vorhanden = neu.zusammenfuehren ? findeDoppelt(liste, neu.name) : null;
    if (vorhanden) {
      aendereEintrag(liste, vorhanden.id, { ...zusammengefuehrt(vorhanden, neu), erledigt: false });
    } else {
      fuegeEintragHinzu(liste, neu);
    }
  }
}

/**
 * Artikelnamen aus allen Listen, häufigste zuerst (je Name die zuletzt verwendete Schreibweise).
 * Dient der KI als Lesehilfe für wiederkehrende Produkte.
 */
export function bekannteArtikel(listen, max = 200) {
  const zaehler = new Map();
  for (const liste of listen) {
    for (const e of liste.eintraege) {
      const schluessel = normalisiere(e.name);
      if (!schluessel) continue;
      const bisher = zaehler.get(schluessel);
      zaehler.set(schluessel, { name: e.name.trim(), anzahl: (bisher?.anzahl ?? 0) + 1 });
    }
  }
  return [...zaehler.values()]
    .sort((a, b) => b.anzahl - a.anzahl)
    .slice(0, max)
    .map((x) => x.name);
}

/**
 * Stellt Einträge mit alten Kategorie-IDs auf die aktuelle Einteilung um.
 * Liefert true, wenn sich etwas geändert hat (dann sollte die Liste gespeichert werden).
 */
export function ziehKategorienUm(liste) {
  let geaendert = false;
  for (const e of liste.eintraege) {
    const neu = aktuelleKategorie(e.kategorie);
    if (neu !== e.kategorie) {
      e.kategorie = neu;
      geaendert = true;
    }
  }
  return geaendert;
}

export function fortschritt(liste) {
  const gesamt = liste.eintraege.length;
  const erledigt = liste.eintraege.filter((e) => e.erledigt).length;
  return { gesamt, erledigt };
}
