// Foto für die Erkennung vorbereiten: richtig drehen, verkleinern, als JPEG komprimieren.
// Kleinere Bilder = schnellere Übertragung und geringere Kosten, ohne dass die Erkennung leidet.

const MAX_KANTE = 1568; // größere Bilder würden von der KI ohnehin verkleinert
const QUALITAET = 0.85;

function ladeAlsBild(datei) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(datei);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Bild konnte nicht gelesen werden')); };
    img.src = url;
  });
}

// Vier überlappende Viertel in voller Auflösung. Im Test (05.11.2026) übersah die KI auf der
// ganzen Seite einer Ankreuzliste regelmäßig Kästchen; mit den Ausschnitten dazu las sie alles richtig.
const UEBERLAPPUNG = 0.06;

function zeichne(quelle, sx, sy, sw, sh) {
  const faktor = Math.min(1, MAX_KANTE / Math.max(sw, sh));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(sw * faktor);
  canvas.height = Math.round(sh * faktor);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff'; // transparente Bereiche (z. B. PNG) weiß statt schwarz
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(quelle, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  return canvas;
}

function base64(canvas) {
  return canvas.toDataURL('image/jpeg', QUALITAET).split(',')[1];
}

/**
 * Liefert { dataUrl, base64, mediaType, breite, hoehe, kacheln: [{ name, base64 }] }.
 * Wirft einen Fehler, wenn die Datei kein lesbares Bild ist.
 */
export async function bereiteBildVor(datei) {
  if (datei.type && !datei.type.startsWith('image/')) {
    throw new Error('Die gewählte Datei ist kein Bild.');
  }

  let quelle;
  try {
    // Berücksichtigt die Drehung aus den Kamera-Daten (EXIF).
    quelle = await createImageBitmap(datei, { imageOrientation: 'from-image' });
  } catch {
    quelle = await ladeAlsBild(datei);
  }

  const { width: w, height: h } = quelle;
  const canvas = zeichne(quelle, 0, 0, w, h);
  const kw = w * (0.5 + UEBERLAPPUNG);
  const kh = h * (0.5 + UEBERLAPPUNG);
  const kacheln = [
    ['oben links', 0, 0], ['oben rechts', w - kw, 0], ['unten links', 0, h - kh], ['unten rechts', w - kw, h - kh],
  ].map(([name, x, y]) => ({ name, base64: base64(zeichne(quelle, x, y, kw, kh)) }));
  quelle.close?.();

  const dataUrl = canvas.toDataURL('image/jpeg', QUALITAET);
  return { dataUrl, base64: dataUrl.split(',')[1], mediaType: 'image/jpeg', breite: canvas.width, hoehe: canvas.height, kacheln };
}
