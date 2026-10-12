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

/**
 * Liefert { dataUrl, base64, mediaType, breite, hoehe }.
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

  const faktor = Math.min(1, MAX_KANTE / Math.max(quelle.width, quelle.height));
  const breite = Math.round(quelle.width * faktor);
  const hoehe = Math.round(quelle.height * faktor);

  const canvas = document.createElement('canvas');
  canvas.width = breite;
  canvas.height = hoehe;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff'; // transparente Bereiche (z. B. PNG) weiß statt schwarz
  ctx.fillRect(0, 0, breite, hoehe);
  ctx.drawImage(quelle, 0, 0, breite, hoehe);
  quelle.close?.();

  const dataUrl = canvas.toDataURL('image/jpeg', QUALITAET);
  return { dataUrl, base64: dataUrl.split(',')[1], mediaType: 'image/jpeg', breite, hoehe };
}
