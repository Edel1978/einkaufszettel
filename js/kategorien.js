// Kategorien in typischer Laufreihenfolge eines Supermarkts.
// Die Reihenfolge hier bestimmt die Sortierung der Liste.
//
// Änderungen sind jederzeit möglich: Für umbenannte oder zusammengelegte Kategorien
// einen Eintrag in UMZUG ergänzen – vorhandene Listen werden beim Start automatisch umgestellt.

// "symbol" erscheint in der Liste, "beispiele" helfen der KI bei der Zuordnung.
export const KATEGORIEN = [
  { id: 'obst-gemuese', symbol: '🥦', name: 'Obst & Gemüse', beispiele: 'frisches Obst, Gemüse, Salat, Kräuter' },
  { id: 'brot', symbol: '🥖', name: 'Brot & Backwaren', beispiele: 'Brot, Brötchen, Toast, Kuchen, Teilchen' },
  { id: 'fleisch-wurst', symbol: '🥩', name: 'Fleisch, Wurst & Aufschnitt', beispiele: 'Fleisch, Geflügel, Wurst, Schinken, Aufschnitt, Fisch' },
  { id: 'milch-kuehl', symbol: '🧀', name: 'Milch, Käse & Kühlregal', beispiele: 'Milch, Sahne, Joghurt, Pudding, Käse, Butter, Eier, Frischkäse' },
  { id: 'tiefkuehl', symbol: '🧊', name: 'Tiefkühl', beispiele: 'Tiefkühlkost, Eis, Pommes, TK-Pizza' },
  { id: 'vorrat', symbol: '🥫', name: 'Vorrat, Suppen & Kaffee', beispiele: 'Nudeln, Reis, Mehl, Zucker, Salz, Gewürze, Konserven, Fertigsuppen, Marmelade, Süßes, Kaffee, Tee' },
  { id: 'getraenke', symbol: '🥤', name: 'Getränke', beispiele: 'Wasser, Saft, Limonade, Bier, Wein' },
  { id: 'pflege', symbol: '🧴', name: 'Pflegeprodukte', beispiele: 'Zahnpasta, Duschgel, Shampoo, Deo, Kosmetik' },
  { id: 'haushalt', symbol: '🧻', name: 'Haushalt', beispiele: 'Toilettenpapier, Küchentücher, Müllbeutel, Putz- und Spülmittel' },
  { id: 'sonstiges', symbol: '🛒', name: 'Sonstiges', beispiele: 'alles andere' },
];

export const STANDARD_KATEGORIE = 'sonstiges';

/** Alte Kategorie-IDs → neue (Stand 12.10.2026: von 14 auf 10 Kategorien). */
const UMZUG = {
  milch: 'milch-kuehl',
  kuehlregal: 'milch-kuehl',
  'fleisch-fisch': 'fleisch-wurst',
  grundnahrung: 'vorrat',
  konserven: 'vorrat',
  'gewuerze-backen': 'vorrat',
  suesses: 'vorrat',
  drogerie: 'pflege',
};

/** Liefert eine gültige, aktuelle Kategorie-ID (alte IDs werden umgezogen). */
export function aktuelleKategorie(id) {
  if (KATEGORIEN.some((k) => k.id === id)) return id;
  return UMZUG[id] ?? STANDARD_KATEGORIE;
}

export function kategorieSymbol(id) {
  return KATEGORIEN.find((k) => k.id === id)?.symbol ?? '🛒';
}

export function kategorieName(id) {
  return KATEGORIEN.find((k) => k.id === id)?.name ?? 'Sonstiges';
}

export function kategorieRang(id) {
  const i = KATEGORIEN.findIndex((k) => k.id === id);
  return i < 0 ? KATEGORIEN.length : i;
}

/** Gängige Einheiten als Vorschläge für das Eingabefeld. */
export const EINHEITEN = ['Stk', 'g', 'kg', 'ml', 'l', 'Pck.', 'Dose', 'Flasche', 'Glas', 'Becher', 'Bund', 'Netz', 'Kiste'];

// ---------- Kategorie automatisch erraten (für manuell eingegebene Artikel) ----------
//
// Schlagworte je Warengruppe. Bei zusammengesetzten Wörtern zählt das Ende
// ("Apfelsaft" → Saft → Getränke), bei Gleichstand das längere Schlagwort
// ("Thunfisch" schlägt "Fisch"). Kurze Schlagworte (≤ 3 Zeichen) passen nur am Wortende.
// Die Gruppen sind feiner als die Kategorien und werden über aktuelleKategorie() zugeordnet –
// so bleiben die Listen auch bei einer späteren Neueinteilung brauchbar.

const SCHLAGWORTE = {
  'obst-gemuese': ['obst', 'gemüse', 'apfel', 'äpfel', 'banane', 'birne', 'orange', 'mandarine', 'clementine', 'zitrone', 'limette', 'traube', 'erdbeere', 'himbeere', 'heidelbeere', 'blaubeere', 'beeren', 'kiwi', 'mango', 'ananas', 'melone', 'pfirsich', 'nektarine', 'pflaume', 'kirsche', 'avocado', 'tomate', 'gurke', 'paprika', 'zucchini', 'aubergine', 'karotte', 'möhre', 'kartoffel', 'süßkartoffel', 'zwiebel', 'knoblauch', 'salat', 'rucola', 'spinat', 'brokkoli', 'blumenkohl', 'kohl', 'lauch', 'porree', 'sellerie', 'radieschen', 'pilze', 'champignon', 'ingwer', 'petersilie', 'schnittlauch', 'basilikum', 'kräuter', 'spargel', 'kürbis', 'fenchel', 'bete', 'frühlingszwiebel'],
  brot: ['brot', 'brötchen', 'semmel', 'toast', 'baguette', 'croissant', 'brezel', 'laugen', 'knäckebrot', 'zwieback', 'kuchen', 'wraps', 'tortilla', 'teilchen', 'kerni'],
  milch: ['milch', 'joghurt', 'jogurt', 'quark', 'sahne', 'butter', 'käse', 'frischkäse', 'mozzarella', 'feta', 'parmesan', 'gouda', 'schmand', 'creme fraiche', 'crème fraîche', 'ei', 'eier', 'kefir', 'skyr', 'margarine', 'pudding'],
  'fleisch-fisch': ['fleisch', 'hack', 'hackfleisch', 'schnitzel', 'steak', 'hähnchen', 'hühnchen', 'pute', 'wurst', 'würstchen', 'salami', 'schinken', 'speck', 'bacon', 'lachs', 'fisch', 'garnelen', 'shrimps', 'forelle', 'kassler', 'gulasch', 'aufschnitt', 'rind', 'schwein', 'lamm', 'filet', 'frikadellen', 'sülze', 'leberkäse'],
  kuehlregal: ['tofu', 'hummus', 'gnocchi', 'maultaschen', 'blätterteig', 'pizzateig', 'frischhefe', 'tortellini'],
  tiefkuehl: ['tk', 'tiefkühl', 'eis', 'speiseeis', 'pommes', 'fischstäbchen', 'pizza', 'eiswürfel'],
  grundnahrung: ['nudeln', 'spaghetti', 'penne', 'fusilli', 'pasta', 'reis', 'mehl', 'zucker', 'salz', 'öl', 'olivenöl', 'essig', 'haferflocken', 'müsli', 'cornflakes', 'linsen', 'couscous', 'bulgur', 'quinoa', 'honig', 'marmelade', 'nutella', 'erdnussbutter', 'senf', 'ketchup', 'mayo', 'mayonnaise', 'kaffee', 'tee', 'kakao'],
  konserven: ['dose', 'konserve', 'tomatenmark', 'passierte', 'thunfisch', 'kidneybohnen', 'kichererbsen', 'suppe', 'ravioli', 'fertiggericht', 'sauce', 'soße', 'pesto', 'oliven', 'gewürzgurken', 'essiggurken', 'sauerkraut'],
  'gewuerze-backen': ['pfeffer', 'paprikapulver', 'gewürz', 'curry', 'zimt', 'backpulver', 'vanille', 'vanillezucker', 'hefe', 'puderzucker', 'speisestärke', 'kakaopulver', 'oregano', 'muskat', 'chili', 'kurkuma', 'brühe', 'gelatine'],
  suesses: ['schokolade', 'schoko', 'chips', 'kekse', 'keks', 'gummibärchen', 'bonbons', 'süßigkeiten', 'nüsse', 'erdnüsse', 'popcorn', 'riegel', 'salzstangen', 'cracker'],
  getraenke: ['wasser', 'sprudel', 'saft', 'cola', 'limo', 'limonade', 'bier', 'wein', 'sekt', 'schorle', 'eistee', 'smoothie'],
  drogerie: ['zahnpasta', 'zahncreme', 'zahnbürste', 'zahnseide', 'shampoo', 'spülung', 'duschgel', 'seife', 'deo', 'creme', 'sonnencreme', 'windeln', 'rasierer', 'watte', 'wattestäbchen', 'pflaster', 'tampons', 'binden'],
  haushalt: ['toilettenpapier', 'klopapier', 'taschentücher', 'küchentücher', 'spülmittel', 'spüli', 'waschmittel', 'weichspüler', 'müllbeutel', 'müllsäcke', 'alufolie', 'frischhaltefolie', 'backpapier', 'küchenrolle', 'schwamm', 'schwämme', 'putzmittel', 'reiniger', 'kerzen', 'batterien', 'glühbirne', 'gefrierbeutel', 'tabs', 'spülmaschinentabs'],
};

const GELERNT_SCHLUESSEL = 'einkaufszettel.kategorien.v1';

function normalisiere(name) {
  return String(name).toLowerCase().trim().replace(/\s+/g, ' ');
}

function gelernt() {
  try {
    const daten = JSON.parse(localStorage.getItem(GELERNT_SCHLUESSEL)) ?? {};
    for (const name of Object.keys(daten)) daten[name] = aktuelleKategorie(daten[name]);
    return daten;
  } catch {
    return {};
  }
}

/** Merkt sich eine vom Nutzer gewählte Kategorie für diesen Artikel. */
export function merkeKategorie(name, kategorie) {
  const daten = gelernt();
  daten[normalisiere(name)] = kategorie;
  try {
    localStorage.setItem(GELERNT_SCHLUESSEL, JSON.stringify(daten));
  } catch { /* Speicher voll – nicht schlimm */ }
}

/** Vom Nutzer gelernte Kategorie für diesen Artikel oder null. */
export function gelernteKategorie(name) {
  return gelernt()[normalisiere(name)] ?? null;
}

/** Erste Wahl: vom Nutzer gelernt; sonst Schlagworte; sonst "Sonstiges". */
export function rateKategorie(name) {
  const text = normalisiere(name);
  const gemerkt = gelernt()[text];
  if (gemerkt) return gemerkt;

  const woerter = text.split(/[^a-zäöüß]+/).filter(Boolean);
  let beste = { punkte: 0, kategorie: STANDARD_KATEGORIE };

  for (const [kategorie, liste] of Object.entries(SCHLAGWORTE)) {
    for (const wort of liste) {
      let punkte = 0;
      if (wort.includes(' ')) {
        if (text.includes(wort)) punkte = 2000 + wort.length;
      } else {
        for (const w of woerter) {
          if (w.endsWith(wort)) punkte = Math.max(punkte, 1000 + wort.length);
          else if (wort.length > 3 && w.includes(wort)) punkte = Math.max(punkte, wort.length);
        }
      }
      if (punkte > beste.punkte) beste = { punkte, kategorie };
    }
  }
  return aktuelleKategorie(beste.kategorie);
}
