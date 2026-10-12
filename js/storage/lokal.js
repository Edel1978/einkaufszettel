// Speicherung auf dem Gerät (Browser-Speicher).
// Alle Methoden sind asynchron, damit die Online-Variante dieselbe Schnittstelle hat.

const SCHLUESSEL = 'einkaufszettel.listen.v1';

function lies() {
  try {
    const roh = localStorage.getItem(SCHLUESSEL);
    const daten = roh ? JSON.parse(roh) : [];
    return Array.isArray(daten) ? daten : [];
  } catch {
    return [];
  }
}

function schreib(listen) {
  localStorage.setItem(SCHLUESSEL, JSON.stringify(listen));
}

export const lokalerSpeicher = {
  name: 'lokal',

  async ladeAlle() {
    return lies();
  },

  async speichere(liste) {
    const listen = lies();
    const i = listen.findIndex((l) => l.id === liste.id);
    if (i >= 0) listen[i] = liste;
    else listen.push(liste);
    schreib(listen);
  },

  async loesche(id) {
    schreib(lies().filter((l) => l.id !== id));
  },
};
