// Hell / Dunkel / Automatisch (wie das Handy).
// Das Stylesheet wählt die Farben über das Attribut data-darstellung am <html>-Element.
// Damit beim Start nichts aufblitzt, setzt ein kleines Skript in index.html das Attribut schon
// vor dem ersten Anzeigen; hier wird es bei Änderungen nachgezogen.

const STATUSLEISTE = { hell: '#f3f6f2', dunkel: '#0f1411' };

export function wendeDarstellungAn(modus) {
  const html = document.documentElement;
  if (modus === 'hell' || modus === 'dunkel') html.dataset.darstellung = modus;
  else delete html.dataset.darstellung;

  // Farbe der Statusleiste des Handys passend setzen (bei "auto" die ursprünglichen Werte).
  document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => {
    if (!meta.dataset.original) meta.dataset.original = meta.content;
    meta.content = STATUSLEISTE[modus] ?? meta.dataset.original;
  });
}
