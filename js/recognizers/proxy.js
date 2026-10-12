// Erkennung über den eigenen Server (Betriebsart "server", Variante A).
// Der Server hält den API-Schlüssel geheim und leitet das Bild an die KI weiter.
// Die Server-Seite wird in Phase 6 gebaut; die Schnittstelle ist hier schon festgelegt:
//
//   POST {serverUrl}/api/erkennen
//     Header: Authorization: Bearer <serverPasswort>
//     Body:   { bild: { base64, mediaType }, modell, bekannteArtikel: [...] }
//     Antwort 200: { eintraege: [...], hinweis }   (Format wie bei der KI)
//     Antwort Fehler: { nachricht }
//
//   GET {serverUrl}/api/status  → 200, wenn Server und Passwort stimmen

import { ErkennungsFehler, werteAntwortAus, fehlerAusAntwort, sicherFetch, fehlerNachricht } from './gemeinsam.js';

function basisUrl(einstellungen) {
  const url = einstellungen.serverUrl?.trim().replace(/\/+$/, '');
  if (!url) {
    throw new ErkennungsFehler('kein-server', 'Es ist noch keine Server-Adresse eingetragen. Bitte in den Einstellungen hinterlegen.');
  }
  return url;
}

function kopfzeilen(einstellungen) {
  return {
    'content-type': 'application/json',
    ...(einstellungen.serverPasswort ? { authorization: `Bearer ${einstellungen.serverPasswort}` } : {}),
  };
}

export async function erkenne(bild, einstellungen, signal, kontext = {}) {
  const antwort = await sicherFetch(`${basisUrl(einstellungen)}/api/erkennen`, {
    method: 'POST',
    headers: kopfzeilen(einstellungen),
    body: JSON.stringify({
      bild: { base64: bild.base64, mediaType: bild.mediaType },
      modell: einstellungen.modell,
      bekannteArtikel: kontext.bekannteArtikel ?? [],
    }),
    signal,
  });
  if (antwort.status === 401) throw new ErkennungsFehler('server-passwort', 'Das Server-Passwort ist falsch.');
  if (!antwort.ok) throw fehlerAusAntwort(antwort.status, await fehlerNachricht(antwort));
  return werteAntwortAus(await antwort.json());
}

export async function testeVerbindung(einstellungen) {
  const antwort = await sicherFetch(`${basisUrl(einstellungen)}/api/status`, { headers: kopfzeilen(einstellungen) });
  if (antwort.status === 401) throw new ErkennungsFehler('server-passwort', 'Das Server-Passwort ist falsch.');
  if (!antwort.ok) throw fehlerAusAntwort(antwort.status, await fehlerNachricht(antwort));
  return 'Verbindung zum Server OK.';
}
