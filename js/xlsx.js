// Erzeugt eine einfache Excel-Datei (.xlsx) ohne fremde Bibliothek.
//
// Eine .xlsx ist ein ZIP-Archiv mit einigen XML-Dateien. Hier entsteht genau ein Tabellenblatt
// mit Text- und Zahlzellen; die erste Zeile (Kopfzeile) ist fett. Keine Formeln, keine
// verbundenen Zellen. Läuft im Browser und in Node (nur TextEncoder/Uint8Array nötig).

const TEXT = new TextEncoder();

// ---------- ZIP (unkomprimiert, "stored") ----------

const CRC_TABELLE = (() => {
  const tabelle = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    tabelle[n] = c >>> 0;
  }
  return tabelle;
})();

function crc32(bytes) {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) crc = CRC_TABELLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function dosZeit(datum) {
  const zeit = (datum.getHours() << 11) | (datum.getMinutes() << 5) | Math.floor(datum.getSeconds() / 2);
  const tag = ((datum.getFullYear() - 1980) << 9) | ((datum.getMonth() + 1) << 5) | datum.getDate();
  return { zeit, tag };
}

/** dateien: [{ name, inhalt (String) }] → ZIP als Uint8Array */
function zip(dateien, datum = new Date()) {
  const { zeit, tag } = dosZeit(datum);
  const teile = [];
  const verzeichnis = [];
  let versatz = 0;

  for (const datei of dateien) {
    const name = TEXT.encode(datei.name);
    const daten = TEXT.encode(datei.inhalt);
    const crc = crc32(daten);

    const kopf = new DataView(new ArrayBuffer(30));
    kopf.setUint32(0, 0x04034b50, true); // lokale Datei
    kopf.setUint16(4, 20, true); // Version
    kopf.setUint16(6, 0x0800, true); // Dateinamen in UTF-8
    kopf.setUint16(8, 0, true); // unkomprimiert
    kopf.setUint16(10, zeit, true);
    kopf.setUint16(12, tag, true);
    kopf.setUint32(14, crc, true);
    kopf.setUint32(18, daten.length, true);
    kopf.setUint32(22, daten.length, true);
    kopf.setUint16(26, name.length, true);
    kopf.setUint16(28, 0, true);
    teile.push(new Uint8Array(kopf.buffer), name, daten);

    const eintrag = new DataView(new ArrayBuffer(46));
    eintrag.setUint32(0, 0x02014b50, true); // Eintrag im Inhaltsverzeichnis
    eintrag.setUint16(4, 20, true);
    eintrag.setUint16(6, 20, true);
    eintrag.setUint16(8, 0x0800, true);
    eintrag.setUint16(10, 0, true);
    eintrag.setUint16(12, zeit, true);
    eintrag.setUint16(14, tag, true);
    eintrag.setUint32(16, crc, true);
    eintrag.setUint32(20, daten.length, true);
    eintrag.setUint32(24, daten.length, true);
    eintrag.setUint16(28, name.length, true);
    eintrag.setUint32(42, versatz, true);
    verzeichnis.push(new Uint8Array(eintrag.buffer), name);

    versatz += 30 + name.length + daten.length;
  }

  const verzeichnisLaenge = verzeichnis.reduce((summe, t) => summe + t.length, 0);
  const ende = new DataView(new ArrayBuffer(22));
  ende.setUint32(0, 0x06054b50, true); // Ende des Inhaltsverzeichnisses
  ende.setUint16(8, dateien.length, true);
  ende.setUint16(10, dateien.length, true);
  ende.setUint32(12, verzeichnisLaenge, true);
  ende.setUint32(16, versatz, true);

  const alle = [...teile, ...verzeichnis, new Uint8Array(ende.buffer)];
  const ergebnis = new Uint8Array(alle.reduce((summe, t) => summe + t.length, 0));
  let pos = 0;
  for (const t of alle) {
    ergebnis.set(t, pos);
    pos += t.length;
  }
  return ergebnis;
}

// ---------- Tabelle ----------

/** Text für XML maskieren; in XML verbotene Steuerzeichen entfernen. */
function xml(text) {
  return String(text)
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function spalte(index) {
  let name = '';
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) name = String.fromCharCode(65 + ((n - 1) % 26)) + name;
  return name;
}

function zelle(wert, zeile, index, fett) {
  if (wert === null || wert === undefined || wert === '') return '';
  const ref = `${spalte(index)}${zeile}`;
  const stil = fett ? ' s="1"' : '';
  if (typeof wert === 'number' && Number.isFinite(wert)) return `<c r="${ref}"${stil}><v>${wert}</v></c>`;
  return `<c r="${ref}"${stil} t="inlineStr"><is><t xml:space="preserve">${xml(wert)}</t></is></c>`;
}

const NS = 'http://schemas.openxmlformats.org';

function blattXml({ zeilen, breiten = [] }) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="${NS}/spreadsheetml/2006/main">${breiten.length ? `<cols>${breiten.map((b, i) => `<col min="${i + 1}" max="${i + 1}" width="${b}" customWidth="1"/>`).join('')}</cols>` : ''}<sheetData>${zeilen.map((z, i) => `<row r="${i + 1}">${z.map((wert, s) => zelle(wert, i + 1, s, i === 0)).join('')}</row>`).join('')}</sheetData></worksheet>`;
}

/**
 * Erzeugt eine .xlsx mit einem oder mehreren Tabellenblättern.
 * blaetter: [{ name, zeilen, breiten }] – zeilen: Array von Zeilen, jede ein Array aus Text, Zahl oder leer;
 * Zeile 0 = Kopfzeile (fett). breiten: optionale Spaltenbreiten in Zeichen.
 * Kurzform für ein Blatt: { blattName, zeilen, breiten }.
 */
export function erzeugeXlsx({ blaetter, blattName, zeilen, breiten }) {
  const liste = blaetter ?? [{ name: blattName, zeilen, breiten }];
  const nummern = liste.map((_, i) => i + 1);

  return zip([
    {
      name: '[Content_Types].xml',
      inhalt: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="${NS}/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${nummern.map((n) => `<Override PartName="/xl/worksheets/sheet${n}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`,
    },
    {
      name: '_rels/.rels',
      inhalt: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="${NS}/package/2006/relationships"><Relationship Id="rId1" Type="${NS}/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    },
    {
      name: 'xl/workbook.xml',
      inhalt: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="${NS}/spreadsheetml/2006/main" xmlns:r="${NS}/officeDocument/2006/relationships"><sheets>${liste.map((b, i) => `<sheet name="${xml(b.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>`,
    },
    {
      name: 'xl/_rels/workbook.xml.rels',
      inhalt: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="${NS}/package/2006/relationships">${nummern.map((n) => `<Relationship Id="rId${n}" Type="${NS}/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${n}.xml"/>`).join('')}<Relationship Id="rId${liste.length + 1}" Type="${NS}/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
    },
    {
      name: 'xl/styles.xml',
      inhalt: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="${NS}/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`,
    },
    ...liste.map((b, i) => ({ name: `xl/worksheets/sheet${i + 1}.xml`, inhalt: blattXml(b) })),
  ]);
}
