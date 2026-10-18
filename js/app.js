// Oberfläche und Navigation.
// Seiten: "#/" = Listenübersicht, "#/liste/<id>" = eine Liste,
//         "#/foto" = Zettel einlesen (foto.js), "#/einstellungen" (einstellungen-seite.js).

import { speicher } from './storage/index.js';
import {
  datumsName, eindeutigerName, neueListe, kopiereListe, benenneUm,
  fuegeEintragHinzu, entferneEintrag, stelleWiederHer, aendereEintrag, schalteErledigt,
  aendereMenge, mengenSchritt, entferneErledigte, setzeHaekchenZurueck, gruppiere, fortschritt,
  ziehKategorienUm,
} from './listen.js';
import { EINHEITEN, KATEGORIEN, kategorieName, rateKategorie, merkeKategorie } from './kategorien.js';
import { esc, formatZahl, leseZahl } from './util.js';
import { eingabe, bestaetige, menue, formular, meldung } from './dialoge.js';
import { initFoto, waehleFoto, starteDiktat, zeigeFoto, verlasseFoto, offenerVorgang } from './foto.js';
import { zeigeEinstellungen } from './einstellungen-seite.js';
import { ladeEinstellungen } from './einstellungen.js';
import { halteBildschirmAn } from './wachhalten.js';
import {
  registriereServiceWorker, kannInstallieren, installiere, beiInstallierbarkeit,
  installHinweisAusgeblendet, blendeInstallHinweisAus,
} from './installieren.js';

const KAMERA_ICON = '<svg class="btn-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>';
const MIKRO_ICON = '<svg class="btn-icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>';

const inhalt = document.getElementById('inhalt');
const titel = document.getElementById('titel');
const zurueckKnopf = document.getElementById('zurueck');
const menueKnopf = document.getElementById('kopf-menue');
const einstellungenKnopf = document.getElementById('kopf-einstellungen');

let listen = [];

/** Was die anderen Seiten (Foto, Einstellungen) von der App brauchen. */
const app = {
  inhalt,
  listen: () => listen,
  fuegeListeHinzu: (liste) => listen.push(liste),
  sichere,
  setzeKopf,
};

// ---------- Start & Navigation ----------

async function start() {
  listen = await speicher.ladeAlle();
  // Nach einer Änderung der Kategorien vorhandene Einträge umstellen.
  for (const liste of listen) {
    if (ziehKategorienUm(liste)) await sichere(liste);
  }
  initFoto(app);
  window.addEventListener('hashchange', zeige);
  zurueckKnopf.addEventListener('click', () => { location.hash = '#/'; });

  // Offline-Hinweis
  const offlineLeiste = document.getElementById('offline');
  const zeigeOnlineStatus = () => { offlineLeiste.hidden = navigator.onLine; };
  window.addEventListener('online', zeigeOnlineStatus);
  window.addEventListener('offline', zeigeOnlineStatus);
  zeigeOnlineStatus();

  // Installation: Hinweis in der Übersicht ein-/ausblenden, sobald Chrome Bescheid gibt.
  beiInstallierbarkeit(() => {
    if (location.hash === '' || location.hash === '#/') zeige();
  });
  registriereServiceWorker();

  zeige();
}

/** Kopfzeile einstellen und alte Ereignis-Handler des Inhalts entfernen. */
function setzeKopf({ titel: text, zurueck = false, listenMenue = null, einstellungen = false }) {
  document.title = text === 'Einkaufszettel' ? text : `${text} – Einkaufszettel`;
  titel.textContent = text;
  zurueckKnopf.hidden = !zurueck;
  menueKnopf.hidden = !listenMenue;
  menueKnopf.onclick = listenMenue;
  einstellungenKnopf.hidden = !einstellungen;
  inhalt.onclick = inhalt.oninput = inhalt.onchange = null;
}

function aktuelleListe() {
  const treffer = location.hash.match(/^#\/liste\/(.+)$/);
  if (!treffer) return null;
  const id = decodeURIComponent(treffer[1]);
  return listen.find((l) => l.id === id) ?? null;
}

function zeige() {
  // Bildschirm nur in einer geöffneten Einkaufsliste anlassen (falls in den Einstellungen gewünscht).
  halteBildschirmAn(location.hash.startsWith('#/liste/') && ladeEinstellungen().bildschirmAn);
  if (location.hash !== '#/foto') verlasseFoto();
  if (location.hash === '#/foto') return zeigeFoto();
  if (location.hash === '#/einstellungen') return zeigeEinstellungen(app);
  if (location.hash.startsWith('#/liste/')) {
    const liste = aktuelleListe();
    if (liste) return zeigeListe(liste);
    location.hash = '#/';
    return;
  }
  zeigeUebersicht();
}

async function sichere(liste) {
  try {
    await speicher.speichere(liste);
  } catch (fehler) {
    console.error(fehler);
    meldung('Speichern fehlgeschlagen');
  }
}

// ---------- Listenübersicht ----------

function installHinweisHtml() {
  if (!kannInstallieren() || installHinweisAusgeblendet()) return '';
  return `
    <div class="info-box install-hinweis">
      <span><strong>Als App installieren</strong><br>Dann liegt der Einkaufszettel auf dem Startbildschirm und funktioniert auch offline.</span>
      <span class="knopf-reihe">
        <button class="btn" type="button" data-install="spaeter">Später</button>
        <button class="btn btn-primaer" type="button" data-install="ja">Installieren</button>
      </span>
    </div>`;
}

function offenerVorgangHtml() {
  const v = offenerVorgang();
  return v ? `
    <a class="info-box hinweis-link" href="#/foto">
      <strong>${v.eintraege.length} erkannte Artikel noch nicht übernommen</strong>
      <span>Weiter prüfen →</span>
    </a>` : '';
}

function zeigeUebersicht() {
  setzeKopf({ titel: 'Einkaufszettel', einstellungen: true });

  const sortiert = [...listen].sort((a, b) => b.erstelltAm.localeCompare(a.erstelltAm));

  inhalt.innerHTML = `
    ${installHinweisHtml()}
    ${offenerVorgangHtml()}
    ${sortiert.length === 0 ? `
      <div class="leer">
        <p class="leer-titel">Noch keine Listen</p>
        <p>Fotografiere deinen Einkaufszettel, sprich deine Liste ein oder lege sie von Hand an.</p>
      </div>` : `
      <ul class="karten">
        ${sortiert.map((l) => {
          const { gesamt, erledigt } = fortschritt(l);
          const info = gesamt === 0 ? 'Leer' : `${erledigt} / ${gesamt} erledigt`;
          const fertig = gesamt > 0 && erledigt === gesamt;
          return `
            <li class="karte${fertig ? ' fertig' : ''}">
              <a class="karte-link" href="#/liste/${encodeURIComponent(l.id)}">
                <span class="karte-name">${esc(l.name)}</span>
                <span class="karte-info">${info}</span>
                ${gesamt > 0 ? `<span class="balken"><span style="width:${(erledigt / gesamt) * 100}%"></span></span>` : ''}
              </a>
              <button class="icon-btn" type="button" data-menue="${esc(l.id)}" aria-label="Menü für ${esc(l.name)}">
                <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="5" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="12" cy="19" r="1.6"/></svg>
              </button>
            </li>`;
        }).join('')}
      </ul>`}
    <div class="aktionsleiste">
      <button id="neue-liste" class="btn" type="button">+ Liste</button>
      <button id="diktieren" class="btn btn-primaer" type="button">
        ${MIKRO_ICON}
        Sprechen</button>
      <button id="foto-einlesen" class="btn btn-primaer" type="button">
        ${KAMERA_ICON}
        Foto</button>
    </div>
  `;

  inhalt.querySelector('[data-install="ja"]')?.addEventListener('click', async () => {
    if (await installiere()) meldung('App wird installiert');
    zeige();
  });
  inhalt.querySelector('[data-install="spaeter"]')?.addEventListener('click', () => {
    blendeInstallHinweisAus();
    meldung('Installieren geht jederzeit in den Einstellungen');
    zeige();
  });
  inhalt.querySelector('#neue-liste').addEventListener('click', legeListeAn);
  inhalt.querySelector('#foto-einlesen').addEventListener('click', () => waehleFoto(null));
  inhalt.querySelector('#diktieren').addEventListener('click', () => starteDiktat(null));
  inhalt.querySelectorAll('[data-menue]').forEach((knopf) => {
    knopf.addEventListener('click', () => {
      const liste = listen.find((l) => l.id === knopf.dataset.menue);
      if (liste) listenMenue(liste);
    });
  });
}

async function legeListeAn() {
  const liste = neueListe(eindeutigerName(datumsName(), listen));
  listen.push(liste);
  await sichere(liste);
  location.hash = `#/liste/${encodeURIComponent(liste.id)}`;
}

async function listenMenue(liste) {
  const { erledigt } = fortschritt(liste);
  const wahl = await menue({
    titel: liste.name,
    optionen: [
      ...(erledigt > 0 ? [
        { wert: 'erledigte-entfernen', text: `Erledigte entfernen (${erledigt})` },
        { wert: 'zuruecksetzen', text: 'Alle Häkchen zurücksetzen' },
      ] : []),
      { wert: 'umbenennen', text: 'Umbenennen' },
      { wert: 'duplizieren', text: 'Duplizieren' },
      { wert: 'loeschen', text: 'Löschen', gefaehrlich: true },
    ],
  });

  if (wahl === 'erledigte-entfernen') {
    const entfernt = entferneErledigte(liste);
    await sichere(liste);
    zeige();
    meldung(`${entfernt.length} erledigte entfernt`, {
      aktion: 'Rückgängig',
      beiAktion: async () => {
        stelleWiederHer(liste, entfernt);
        await sichere(liste);
        zeige();
      },
    });
  } else if (wahl === 'zuruecksetzen') {
    setzeHaekchenZurueck(liste);
    await sichere(liste);
    zeige();
  } else if (wahl === 'umbenennen') {
    const name = await eingabe({ titel: 'Liste umbenennen', wert: liste.name, okText: 'Speichern' });
    if (!name) return;
    benenneUm(liste, name);
    await sichere(liste);
    zeige();
  } else if (wahl === 'duplizieren') {
    const kopie = kopiereListe(liste, eindeutigerName(datumsName(), listen));
    listen.push(kopie);
    await sichere(kopie);
    meldung('Liste dupliziert');
    location.hash = `#/liste/${encodeURIComponent(kopie.id)}`;
  } else if (wahl === 'loeschen') {
    const ok = await bestaetige({
      titel: 'Liste löschen?',
      text: `„${liste.name}“ wird endgültig gelöscht.`,
      okText: 'Löschen',
      gefaehrlich: true,
    });
    if (!ok) return;
    listen = listen.filter((l) => l.id !== liste.id);
    await speicher.loesche(liste.id);
    meldung('Liste gelöscht');
    if (location.hash === '#/') zeige();
    else location.hash = '#/';
  }
}

// ---------- Einzelne Liste ----------

function zeigeListe(liste) {
  setzeKopf({ titel: liste.name, zurueck: true, listenMenue: () => listenMenue(liste) });

  const { gesamt, erledigt } = fortschritt(liste);

  inhalt.innerHTML = `
    <form id="eingabe" class="eingabe" autocomplete="off">
      <div class="eingabe-zeile">
        <input name="name" class="eingabe-name" type="text" placeholder="Artikel, z. B. Milch" aria-label="Artikel" required>
        <button class="btn foto-knopf" type="button" data-diktat aria-label="Artikel diktieren und hinzufügen">
          ${MIKRO_ICON}
        </button>
        <button class="btn foto-knopf" type="button" data-foto aria-label="Zettel fotografieren und hinzufügen">
          ${KAMERA_ICON}
        </button>
      </div>
      <div class="eingabe-zeile">
        <input name="menge" class="eingabe-menge" type="text" inputmode="decimal" placeholder="Menge" aria-label="Menge">
        <input name="einheit" class="eingabe-einheit" type="text" list="einheiten" placeholder="Einheit" aria-label="Einheit">
        <button class="btn btn-primaer" type="submit">Hinzufügen</button>
      </div>
      <datalist id="einheiten">${EINHEITEN.map((e) => `<option value="${esc(e)}">`).join('')}</datalist>
    </form>

    ${gesamt === 0 ? `
      <div class="leer">
        <p class="leer-titel">Die Liste ist leer</p>
        <p>Füge oben Artikel hinzu.</p>
      </div>` : `
      <div class="fortschritt">
        <span>${erledigt === gesamt ? 'Alles erledigt' : `${erledigt} von ${gesamt} erledigt`}</span>
        <span class="balken"><span style="width:${(erledigt / gesamt) * 100}%"></span></span>
      </div>
      ${gruppiere(liste).map((g) => `
        <section class="gruppe${g.fertig ? ' fertig' : ''}">
          <h2 class="gruppe-titel">${esc(kategorieName(g.kategorie))}</h2>
          <ul class="eintraege">${g.eintraege.map(eintragHtml).join('')}</ul>
        </section>`).join('')}
    `}
  `;

  const form = inhalt.querySelector('#eingabe');
  form.querySelector('[data-foto]').addEventListener('click', () => waehleFoto(liste.id));
  form.querySelector('[data-diktat]').addEventListener('click', () => starteDiktat(liste.id));
  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const daten = new FormData(form);
    const name = String(daten.get('name')).trim();
    if (!name) return;
    const kategorie = rateKategorie(name);
    fuegeEintragHinzu(liste, {
      name,
      menge: leseZahl(daten.get('menge')),
      einheit: String(daten.get('einheit')),
      kategorie,
    });
    await sichere(liste);
    zeigeListe(liste);
    inhalt.querySelector('.eingabe-name').focus();
    meldung(`${name} → ${kategorieName(kategorie)}`);
  });

  // Ein Klick-Handler für alle Einträge (wird bei jedem Neuzeichnen ersetzt, nicht gestapelt).
  inhalt.onclick = async (ev) => {
    const knopf = ev.target.closest('[data-aktion]');
    const id = knopf?.closest('[data-id]')?.dataset.id;
    if (!id) return;
    const aktion = knopf.dataset.aktion;

    if (aktion === 'umschalten') {
      const eintrag = schalteErledigt(liste, id);
      if (eintrag?.erledigt) navigator.vibrate?.(15);
    } else if (aktion === 'mehr' || aktion === 'weniger') {
      aendereMenge(liste, id, aktion === 'mehr' ? 1 : -1);
    } else if (aktion === 'bearbeiten') {
      await bearbeiteEintrag(liste, id);
      return;
    }
    await sichere(liste);
    zeigeListe(liste);
  };
}

function mengenText(e) {
  return [formatZahl(e.menge), e.einheit].filter(Boolean).join(' ');
}

function eintragHtml(e) {
  const menge = mengenText(e);
  const minusAus = e.menge == null || e.menge <= mengenSchritt(e.einheit);
  return `
    <li class="eintrag${e.erledigt ? ' erledigt' : ''}" data-id="${esc(e.id)}">
      <button class="eintrag-haupt" type="button" role="checkbox" aria-checked="${e.erledigt}" data-aktion="umschalten">
        <span class="haken" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></span>
        <span class="eintrag-name">${esc(e.name)}</span>
        ${e.erledigt && menge ? `<span class="eintrag-menge">${esc(menge)}</span>` : ''}
      </button>
      ${e.erledigt ? '' : `
        <span class="menge-steuerung">
          <button class="menge-btn" type="button" data-aktion="weniger" aria-label="${esc(e.name)}: weniger"${minusAus ? ' disabled' : ''}>−</button>
          <span class="eintrag-menge${menge ? '' : ' leise'}">${esc(menge || '1')}</span>
          <button class="menge-btn" type="button" data-aktion="mehr" aria-label="${esc(e.name)}: mehr">+</button>
        </span>`}
      <button class="icon-btn klein" type="button" data-aktion="bearbeiten" aria-label="${esc(e.name)} bearbeiten">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4"/></svg>
      </button>
    </li>`;
}

async function bearbeiteEintrag(liste, id) {
  const e = liste.eintraege.find((x) => x.id === id);
  if (!e) return;

  const { wert, daten } = await formular({
    titel: 'Artikel bearbeiten',
    inhaltHtml: `
      <label class="feld"><span>Artikel</span>
        <input name="name" type="text" value="${esc(e.name)}" required></label>
      <div class="feld-zeile">
        <label class="feld feld-menge"><span>Menge</span>
          <input name="menge" type="text" inputmode="decimal" value="${esc(formatZahl(e.menge))}"></label>
        <label class="feld"><span>Einheit</span>
          <input name="einheit" type="text" list="einheiten-dialog" value="${esc(e.einheit)}"></label>
      </div>
      <datalist id="einheiten-dialog">${EINHEITEN.map((x) => `<option value="${esc(x)}">`).join('')}</datalist>
      <label class="feld"><span>Kategorie</span>
        <select name="kategorie">
          ${KATEGORIEN.map((k) => `<option value="${k.id}"${k.id === e.kategorie ? ' selected' : ''}>${esc(k.name)}</option>`).join('')}
        </select></label>`,
    // Speichern steht im HTML zuerst, damit Enter speichert (Anzeige-Reihenfolge per CSS).
    knoepfeHtml: `
      <button value="speichern" class="btn btn-primaer">Speichern</button>
      <button type="button" data-abbrechen class="btn">Abbrechen</button>
      <button value="loeschen" formnovalidate class="btn btn-text-gefahr">Löschen</button>`,
  });

  if (wert === 'speichern') {
    const kategorie = String(daten.get('kategorie'));
    const name = String(daten.get('name')).trim();
    if (kategorie !== e.kategorie) merkeKategorie(name, kategorie);
    aendereEintrag(liste, id, {
      name,
      menge: leseZahl(daten.get('menge')),
      einheit: String(daten.get('einheit')).trim(),
      kategorie,
    });
  } else if (wert === 'loeschen') {
    const entfernt = entferneEintrag(liste, id);
    meldung(`„${entfernt.name}“ gelöscht`, {
      aktion: 'Rückgängig',
      beiAktion: async () => {
        stelleWiederHer(liste, [entfernt]);
        await sichere(liste);
        zeige();
      },
    });
  } else {
    return;
  }
  await sichere(liste);
  zeige();
}

start();
