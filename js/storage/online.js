// Platzhalter für eine spätere Online-Speicherung (z. B. Supabase oder Firebase).
//
// Muss dieselbe Schnittstelle wie lokalerSpeicher bieten:
//   ladeAlle() → Promise<Liste[]>
//   speichere(liste) → Promise<void>
//   loesche(id) → Promise<void>
//
// Hinweise für die Umsetzung:
// - Listen und Einträge haben eindeutige IDs und "geaendertAm"-Zeitstempel,
//   damit bei Konflikten der neueste Stand gewinnen kann.
// - Gelöschte Listen bräuchten dann eine Löschmarkierung, damit andere Geräte
//   das Löschen mitbekommen.
// - Sinnvoll ist eine Kombination: lokal speichern (offline) und im Hintergrund abgleichen.

function nichtVerfuegbar() {
  return Promise.reject(new Error('Online-Speicherung ist noch nicht eingerichtet.'));
}

export const onlineSpeicher = {
  name: 'online',
  ladeAlle: nichtVerfuegbar,
  speichere: nichtVerfuegbar,
  loesche: nichtVerfuegbar,
};
