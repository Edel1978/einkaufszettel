// Einlesen per Foto oder Sprache:
//   Foto:    Bild wählen → vorbereiten → erkennen → prüfen → in eine Liste übernehmen.
//   Sprache: zuhören → (Aufnahme abschreiben) → Text auswerten → prüfen → übernehmen.
// Seite "#/foto". Der Vorgang lebt nur im Speicher (Foto und Ton werden nicht dauerhaft gespeichert).

import { bereiteBildVor } from './bild.js';
import { erkenne, erkenneText, transkribiere } from './recognizers/index.js';
import { starteBrowserErkennung, starteAufnahme } from './sprache.js';
import {
  datumsName, eindeutigerName, neueListe, findeDoppelt, zusammengefuehrt, uebernehmeEintraege, bekannteArtikel,
} from './listen.js';
import { KATEGORIEN, EINHEITEN, STANDARD_KATEGORIE, merkeKategorie } from './kategorien.js';
import { esc, formatZahl, leseZahl } from './util.js';
import { menue, meldung } from './dialoge.js';
import { ladeEinstellungen } from './einstellungen.js';

const kameraInput = document.getElementById('foto-kamera');
const galerieInput = document.getElementById('foto-galerie');

// Fehler, bei denen ein Blick in die Einstellungen hilft.
const EINSTELLUNGS_FEHLER = new Set([
  'kein-schluessel', 'schluessel-ungueltig', 'keine-berechtigung', 'modell', 'kein-server', 'server-passwort',
  'nicht-unterstuetzt',
]);

let app = null;
let vorgang = null;
let naechstesZiel = null;

export function initFoto(appKontext) {
  app = appKontext;
  for (const input of [kameraInput, galerieInput]) {
    input.addEventListener('change', () => {
      const datei = input.files?.[0];
      input.value = ''; // dieselbe Datei soll erneut gewählt werden können
      if (datei) starteVorgang(datei);
    });
  }
}

/** Fragt nach Kamera oder Galerie und öffnet die Auswahl. */
export async function waehleFoto(zielListeId = null) {
  if (!navigator.onLine && ladeEinstellungen().betriebsart !== 'demo') {
    meldung('Keine Internetverbindung – Fotos lassen sich erst wieder online einlesen.');
    return;
  }
  const wahl = await menue({
    titel: 'Einkaufszettel einlesen',
    optionen: [
      { wert: 'kamera', text: 'Foto aufnehmen' },
      { wert: 'galerie', text: 'Bild aus Galerie wählen' },
    ],
  });
  if (!wahl) return;
  naechstesZiel = zielListeId;
  (wahl === 'kamera' ? kameraInput : galerieInput).click();
}

/** Ein noch nicht übernommenes Ergebnis (für den Hinweis "Fortsetzen"). */
export function offenerVorgang() {
  return vorgang?.status === 'pruefen' ? vorgang : null;
}

/** Wird beim Verlassen der Seite aufgerufen: laufende Erkennung bzw. Mikrofon beenden. */
export function verlasseFoto() {
  if (['laedt', 'vorbereiten', 'zuhoeren', 'abschreiben'].includes(vorgang?.status)) {
    beendeMikrofon(vorgang);
    vorgang.abbruch?.abort();
    vorgang = null;
  }
}

async function starteVorgang(datei) {
  const v = {
    art: 'foto',
    status: 'vorbereiten',
    zielListeId: naechstesZiel,
    herkunft: location.hash || '#/',
    bild: null,
  };
  vorgang = v;
  zeigeSeite();

  try {
    v.bild = await bereiteBildVor(datei);
  } catch (fehler) {
    v.status = 'fehler';
    v.fehler = { code: 'bild', text: `Das Bild konnte nicht gelesen werden. ${fehler.message}` };
    if (vorgang === v) zeigeFoto();
    return;
  }
  if (vorgang === v) erkenneJetzt();
}

// ---------- Sprache ----------

/** Startet das Diktieren einer Einkaufsliste. */
export async function starteDiktat(zielListeId = null) {
  const einstellungen = ladeEinstellungen();
  if (!navigator.onLine && einstellungen.betriebsart !== 'demo') {
    meldung('Keine Internetverbindung – Diktieren geht erst wieder online.');
    return;
  }
  const v = {
    art: 'sprache',
    status: 'zuhoeren',
    zielListeId,
    herkunft: location.hash || '#/',
    text: '',
    whisper: einstellungen.spracheingabe === 'groq',
    beginn: Date.now(),
  };
  vorgang = v;
  zeigeSeite();

  try {
    if (v.whisper) {
      if (!einstellungen.groqSchluessel) {
        throw Object.assign(new Error('Für Groq Whisper fehlt noch der Groq-Schlüssel. Bitte in den Einstellungen eintragen oder dort die Spracherkennung des Handys wählen.'), { code: 'kein-schluessel' });
      }
      v.mikro = await starteAufnahme();
      v.uhr = setInterval(() => {
        const el = app.inhalt.querySelector('[data-uhr]');
        if (el) el.textContent = uhrzeit(Date.now() - v.beginn);
      }, 500);
    } else {
      v.mikro = starteBrowserErkennung({
        beiText: (text) => {
          v.text = text;
          const el = app.inhalt.querySelector('[data-live-text]');
          if (el) el.textContent = text || '…';
        },
        beiFehler: (fehler) => sprachFehler(v, fehler),
      });
    }
  } catch (fehler) {
    sprachFehler(v, fehler);
  }
}

function uhrzeit(ms) {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function beendeMikrofon(v) {
  clearInterval(v?.uhr);
  v?.mikro?.abbrechen();
  if (v) v.mikro = null;
}

function sprachFehler(v, fehler) {
  if (vorgang !== v) return;
  beendeMikrofon(v);
  v.status = 'fehler';
  v.fehler = { code: fehler.code ?? 'unbekannt', text: fehler.message };
  if (location.hash === '#/foto') zeigeFoto();
}

/** „Fertig“ beim Diktieren: Zuhören beenden, ggf. abschreiben lassen, dann auswerten. */
async function beendeDiktat(v) {
  clearInterval(v.uhr);
  const mikro = v.mikro;
  v.mikro = null;
  try {
    if (v.whisper) {
      v.status = 'abschreiben';
      v.abbruch = new AbortController();
      zeigeFoto();
      v.aufnahme = await mikro.stoppe();
      await schreibeAb(v);
    } else {
      v.text = (await mikro.stoppe()).trim();
    }
  } catch (fehler) {
    if (fehler.code !== 'abgebrochen') sprachFehler(v, fehler);
    return;
  }
  if (vorgang !== v) return;
  if (!v.text) {
    sprachFehler(v, { code: 'nichts-gehoert', message: 'Es wurde nichts verstanden. Bitte noch einmal deutlich sprechen.' });
    return;
  }
  erkenneJetzt();
}

async function schreibeAb(v) {
  v.text = await transkribiere(v.aufnahme, v.abbruch.signal, { bekannteArtikel: bekannteArtikel(app.listen()) });
}

/** „Erneut versuchen“: je nach Stand neu abschreiben oder neu auswerten. */
async function wiederhole(v) {
  if (v.art === 'sprache' && !v.text && v.aufnahme) {
    v.status = 'abschreiben';
    v.abbruch = new AbortController();
    zeigeFoto();
    try {
      await schreibeAb(v);
    } catch (fehler) {
      if (fehler.code !== 'abgebrochen') sprachFehler(v, fehler);
      return;
    }
  }
  erkenneJetzt();
}

function zeigeSeite() {
  if (location.hash === '#/foto') zeigeFoto();
  else location.hash = '#/foto';
}

async function erkenneJetzt() {
  const v = vorgang;
  v.status = 'laedt';
  v.abbruch = new AbortController();
  zeigeFoto();

  try {
    const kontext = { bekannteArtikel: bekannteArtikel(app.listen()) };
    const ergebnis = v.art === 'sprache'
      ? await erkenneText(v.text, v.abbruch.signal, kontext)
      : await erkenne(v.bild, v.abbruch.signal, kontext);
    if (vorgang !== v) return;
    const listen = app.listen();
    const ziel = listen.some((l) => l.id === v.zielListeId) ? v.zielListeId : 'neu';
    Object.assign(v, {
      status: 'pruefen',
      hinweis: ergebnis.hinweis,
      ziel,
      neuerName: eindeutigerName(datumsName(), listen),
      eintraege: ergebnis.eintraege.map((e) => ({
        ...e,
        mengeText: formatZahl(e.menge),
        erkannteKategorie: e.kategorie,
        uebernehmen: true,
        zusammenfuehren: true,
      })),
    });
  } catch (fehler) {
    if (vorgang !== v) return;
    if (fehler.code === 'abgebrochen') return;
    console.error(fehler);
    v.status = 'fehler';
    v.fehler = { code: fehler.code ?? 'unbekannt', text: fehler.code ? fehler.message : `Unerwarteter Fehler: ${fehler.message}` };
  }
  if (location.hash === '#/foto') zeigeFoto();
}

// ---------- Anzeige ----------

export function zeigeFoto() {
  const v = vorgang;
  app.setzeKopf({ titel: v?.art === 'sprache' ? 'Liste diktieren' : 'Zettel einlesen', zurueck: true });
  const { inhalt } = app;

  if (!v) {
    location.hash = '#/';
    return;
  }

  const sprache = v.art === 'sprache';
  const bildHtml = v.bild
    ? `<img class="foto-vorschau" src="${v.bild.dataUrl}" alt="Fotografierter Einkaufszettel" data-aktion="bild-gross">`
    : '';
  const textHtml = sprache && v.text ? `<blockquote class="diktat-text">„${esc(v.text)}“</blockquote>` : '';
  // Bei einem Fehler: neu versuchen lohnt, wenn schon Foto/Aufnahme/Text da ist (außer nichts erkannt).
  const wiederholbar = (v.bild || v.text || v.aufnahme)
    && !['nichts-erkannt', 'nichts-gehoert', 'not-allowed', 'nicht-unterstuetzt', 'kein-schluessel'].includes(v.fehler?.code);
  const neuStarten = sprache
    ? '<button class="btn" type="button" data-aktion="neu-sprechen">Neu sprechen</button>'
    : '<button class="btn" type="button" data-aktion="anderes-foto">Anderes Foto</button>';

  if (v.status === 'zuhoeren') {
    inhalt.innerHTML = `
      <div class="foto-status">
        <div class="mikro-kreis" aria-hidden="true">
          <svg viewBox="0 0 24 24"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>
        </div>
        <p class="leer-titel">${v.whisper ? 'Aufnahme läuft' : 'Ich höre zu …'}</p>
        <p class="leise-text">Sprich deine Einkaufsliste, z. B. „zwei Liter Milch, ein Brot und 500 Gramm Hackfleisch“. Pausen sind kein Problem.</p>
        ${v.whisper
          ? `<p class="aufnahme-uhr" data-uhr>${uhrzeit(Date.now() - v.beginn)}</p>`
          : `<blockquote class="diktat-text live" data-live-text>${esc(v.text) || '…'}</blockquote>`}
        <div class="knopf-reihe">
          <button class="btn" type="button" data-aktion="abbrechen">Abbrechen</button>
          <button class="btn btn-primaer" type="button" data-aktion="fertig">Fertig</button>
        </div>
      </div>`;
  } else if (['vorbereiten', 'abschreiben', 'laedt'].includes(v.status)) {
    const titel = {
      vorbereiten: 'Foto wird vorbereitet …',
      abschreiben: 'Aufnahme wird abgeschrieben …',
      laedt: sprache ? 'Liste wird erstellt …' : 'Zettel wird gelesen …',
    }[v.status];
    inhalt.innerHTML = `
      <div class="foto-status">
        ${bildHtml}${textHtml}
        <div class="lade-kreis" aria-hidden="true"></div>
        <p class="leer-titel">${titel}</p>
        <p class="leise-text">${sprache ? 'Das dauert meist nur ein paar Sekunden.' : 'Das dauert meist 10 bis 20 Sekunden.'}</p>
        <button class="btn" type="button" data-aktion="abbrechen">Abbrechen</button>
      </div>`;
  } else if (v.status === 'fehler') {
    inhalt.innerHTML = `
      <div class="foto-status">
        ${bildHtml}${textHtml}
        <div class="fehler-box" role="alert">
          <strong>Das hat nicht geklappt</strong>
          <p>${esc(v.fehler.text)}</p>
        </div>
        <div class="knopf-reihe">
          ${wiederholbar ? '<button class="btn btn-primaer" type="button" data-aktion="nochmal">Erneut versuchen</button>' : ''}
          ${neuStarten}
          ${EINSTELLUNGS_FEHLER.has(v.fehler.code) ? '<a class="btn" href="#/einstellungen">Einstellungen</a>' : ''}
        </div>
      </div>`;
  } else {
    inhalt.innerHTML = pruefHtml(v);
  }

  inhalt.onclick = beiKlick;
  inhalt.oninput = beiEingabe;
  inhalt.onchange = beiAenderung;
}

function zielListe(v) {
  return v.ziel === 'neu' ? null : app.listen().find((l) => l.id === v.ziel) ?? null;
}

function pruefHtml(v) {
  const anzahl = v.eintraege.filter((e) => e.uebernehmen).length;
  const listen = [...app.listen()].sort((a, b) => b.erstelltAm.localeCompare(a.erstelltAm));
  const kopf = v.art === 'sprache'
    ? `
    <div class="foto-kopf spalte">
      <p class="leer-titel">${v.eintraege.length} Artikel verstanden</p>
      <blockquote class="diktat-text">„${esc(v.text)}“</blockquote>
      <p class="leise-text">Bitte prüfen und bei Bedarf korrigieren.</p>
    </div>`
    : `
    <div class="foto-kopf">
      <img class="foto-vorschau klein" src="${v.bild.dataUrl}" alt="Fotografierter Einkaufszettel" data-aktion="bild-gross">
      <div>
        <p class="leer-titel">${v.eintraege.length} Artikel erkannt</p>
        <p class="leise-text">Bitte prüfen und bei Bedarf korrigieren. Tippe aufs Foto zum Vergrößern.</p>
      </div>
    </div>`;
  return `
    ${kopf}
    ${v.hinweis ? `<p class="info-box">${esc(v.hinweis)}</p>` : ''}

    <ul class="pruef-liste">
      ${v.eintraege.map((e, i) => pruefEintragHtml(v, e, i)).join('')}
    </ul>
    <button class="btn btn-breit" type="button" data-aktion="ergaenzen">+ Artikel ergänzen</button>
    <datalist id="einheiten-foto">${EINHEITEN.map((x) => `<option value="${esc(x)}">`).join('')}</datalist>

    <section class="ziel-block">
      <label class="feld"><span>Übernehmen in</span>
        <select data-ziel>
          <option value="neu"${v.ziel === 'neu' ? ' selected' : ''}>Neue Liste</option>
          ${listen.map((l) => `<option value="${esc(l.id)}"${v.ziel === l.id ? ' selected' : ''}>${esc(l.name)}</option>`).join('')}
        </select></label>
      ${v.ziel === 'neu' ? `
        <label class="feld"><span>Name der neuen Liste</span>
          <input type="text" data-neuer-name value="${esc(v.neuerName)}"></label>` : ''}
    </section>

    <div class="aktionsleiste">
      ${v.art === 'sprache'
        ? '<button class="btn" type="button" data-aktion="neu-sprechen">Neu sprechen</button>'
        : '<button class="btn" type="button" data-aktion="anderes-foto">Neues Foto</button>'}
      <button class="btn btn-primaer" type="button" data-aktion="uebernehmen"${anzahl === 0 ? ' disabled' : ''}>
        ${anzahl} Artikel übernehmen</button>
    </div>`;
}

function pruefEintragHtml(v, e, i) {
  return `
    <li class="pruef-eintrag${e.unsicher ? ' unsicher' : ''}${e.uebernehmen ? '' : ' aus'}" data-i="${i}">
      <div class="pruef-zeile">
        <input type="checkbox" class="pruef-check" data-feld="uebernehmen"${e.uebernehmen ? ' checked' : ''} aria-label="Übernehmen">
        <input type="text" class="pruef-name" data-feld="name" value="${esc(e.name)}" aria-label="Artikel" placeholder="Artikel">
        <button class="icon-btn klein" type="button" data-aktion="entfernen" aria-label="Entfernen">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>
        </button>
      </div>
      <div class="pruef-zeile pruef-details">
        <input type="text" inputmode="decimal" data-feld="mengeText" value="${esc(e.mengeText)}" aria-label="Menge" placeholder="Menge">
        <input type="text" list="einheiten-foto" data-feld="einheit" value="${esc(e.einheit)}" aria-label="Einheit" placeholder="Einheit">
        <select data-feld="kategorie" aria-label="Kategorie">
          ${KATEGORIEN.map((k) => `<option value="${k.id}"${k.id === e.kategorie ? ' selected' : ''}>${esc(k.name)}</option>`).join('')}
        </select>
      </div>
      <div class="pruef-hinweise">${hinweiseHtml(v, e)}</div>
    </li>`;
}

function hinweiseHtml(v, e) {
  const teile = [];
  if (e.unsicher) teile.push(`<p class="pruef-hinweis warnung">${v.art === 'sprache' ? 'Nicht sicher verstanden' : 'Schwer lesbar'} – bitte prüfen</p>`);
  const liste = zielListe(v);
  const vorhanden = liste && e.name.trim() ? findeDoppelt(liste, e.name) : null;
  if (vorhanden) {
    const vorherText = [formatZahl(vorhanden.menge), vorhanden.einheit].filter(Boolean).join(' ');
    const neu = zusammengefuehrt(vorhanden, { menge: leseZahl(e.mengeText), einheit: e.einheit });
    const nachherText = [formatZahl(neu.menge), neu.einheit].filter(Boolean).join(' ');
    teile.push(`
      <label class="pruef-hinweis">
        <input type="checkbox" data-feld="zusammenfuehren"${e.zusammenfuehren ? ' checked' : ''}>
        Schon auf der Liste${vorherText ? ` (${esc(vorherText)})` : ''} – zusammenführen${nachherText && nachherText !== vorherText ? ` → ${esc(nachherText)}` : ''}
      </label>`);
  }
  return teile.join('');
}

// ---------- Bedienung ----------

function eintragZu(element) {
  const li = element.closest('[data-i]');
  return li ? { li, e: vorgang.eintraege[Number(li.dataset.i)] } : {};
}

function beiEingabe(ev) {
  const feld = ev.target.dataset?.feld;
  if (ev.target.matches('[data-neuer-name]')) vorgang.neuerName = ev.target.value;
  if (!feld || feld === 'uebernehmen' || feld === 'zusammenfuehren') return;
  const { e } = eintragZu(ev.target);
  if (e) e[feld] = ev.target.value;
}

function beiAenderung(ev) {
  const t = ev.target;
  if (t.matches('[data-ziel]')) {
    vorgang.ziel = t.value;
    zeigeFoto();
    return;
  }
  const feld = t.dataset?.feld;
  const { li, e } = eintragZu(t);
  if (!e) return;
  if (feld === 'uebernehmen' || feld === 'zusammenfuehren') {
    e[feld] = t.checked;
    if (feld === 'uebernehmen') {
      li.classList.toggle('aus', !t.checked);
      aktualisiereUebernehmenKnopf();
    }
    return;
  }
  e[feld] = t.value;
  // Hinweise (z. B. "schon auf der Liste") passend zu Name/Menge aktualisieren, ohne neu zu zeichnen.
  li.querySelector('.pruef-hinweise').innerHTML = hinweiseHtml(vorgang, e);
}

function aktualisiereUebernehmenKnopf() {
  const knopf = app.inhalt.querySelector('[data-aktion="uebernehmen"]');
  const anzahl = vorgang.eintraege.filter((e) => e.uebernehmen).length;
  knopf.disabled = anzahl === 0;
  knopf.textContent = `${anzahl} Artikel übernehmen`;
}

async function beiKlick(ev) {
  const knopf = ev.target.closest('[data-aktion]');
  if (!knopf || !vorgang) return;
  const v = vorgang;

  switch (knopf.dataset.aktion) {
    case 'bild-gross':
      knopf.classList.toggle('gross');
      break;
    case 'abbrechen':
      beendeMikrofon(v);
      v.abbruch?.abort();
      vorgang = null;
      location.hash = v.herkunft;
      break;
    case 'fertig':
      await beendeDiktat(v);
      break;
    case 'nochmal':
      await wiederhole(v);
      break;
    case 'anderes-foto':
      waehleFoto(v.zielListeId);
      break;
    case 'neu-sprechen':
      vorgang = null;
      await starteDiktat(v.zielListeId);
      break;
    case 'entfernen': {
      const { e } = eintragZu(knopf);
      v.eintraege.splice(v.eintraege.indexOf(e), 1);
      zeigeFoto();
      break;
    }
    case 'ergaenzen':
      v.eintraege.push({
        name: '', menge: null, mengeText: '', einheit: '', kategorie: STANDARD_KATEGORIE,
        erkannteKategorie: STANDARD_KATEGORIE, unsicher: false, uebernehmen: true, zusammenfuehren: true,
      });
      zeigeFoto();
      app.inhalt.querySelector('.pruef-eintrag:last-child .pruef-name')?.focus();
      break;
    case 'uebernehmen':
      await uebernehmen(v);
      break;
  }
}

async function uebernehmen(v) {
  const auswahl = v.eintraege
    .filter((e) => e.uebernehmen && e.name.trim())
    .map((e) => ({
      name: e.name.trim(),
      menge: leseZahl(e.mengeText),
      einheit: e.einheit.trim(),
      kategorie: e.kategorie,
      zusammenfuehren: e.zusammenfuehren,
    }));
  if (auswahl.length === 0) {
    meldung('Keine Artikel ausgewählt');
    return;
  }

  // Korrigierte Kategorien merken, damit sie beim nächsten Mal stimmen.
  for (const e of v.eintraege) {
    if (e.uebernehmen && e.name.trim() && e.kategorie !== e.erkannteKategorie) merkeKategorie(e.name, e.kategorie);
  }

  let liste = zielListe(v);
  if (!liste) {
    liste = neueListe(v.neuerName.trim() || eindeutigerName(datumsName(), app.listen()));
    app.fuegeListeHinzu(liste);
  }
  uebernehmeEintraege(liste, auswahl);
  await app.sichere(liste);

  vorgang = null;
  location.hash = `#/liste/${encodeURIComponent(liste.id)}`;
  meldung(`${auswahl.length} Artikel übernommen`);
}
