// Einfache Dialoge (Eingabe, Bestätigung, Auswahlmenü) auf Basis von <dialog>.

import { esc } from './util.js';

const dialog = document.getElementById('dialog');

function oeffne(html, beiOeffnen) {
  return new Promise((resolve) => {
    dialog.innerHTML = html;
    // Ergebnis direkt beim Absenden liefern, nicht erst über das "close"-Ereignis:
    // Das kommt in Chrome verzögert und würde Folgedialoge ausbremsen.
    const fertig = (wert) => {
      dialog.onclick = dialog.oncancel = null;
      if (dialog.open) dialog.close();
      resolve(wert);
    };
    const form = dialog.querySelector('form');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      // Ohne auslösenden Knopf gilt – wie bei Enter – der erste Absende-Knopf.
      const standard = form.querySelector('button:not([type="button"])');
      fertig(e.submitter?.value ?? standard?.value ?? 'ok');
    });
    // Hintergrund, "Abbrechen" (type="button", damit Enter nicht abbricht) sowie Zurück-Taste/Esc.
    dialog.onclick = (e) => {
      if (e.target === dialog || e.target.closest('[data-abbrechen]')) fertig('');
    };
    dialog.oncancel = (e) => {
      e.preventDefault();
      fertig('');
    };
    dialog.showModal();
    beiOeffnen?.();
  });
}

/** Texteingabe. Liefert den Text oder null bei Abbruch. */
export async function eingabe({ titel, wert = '', okText = 'OK' }) {
  let feld;
  const ergebnis = await oeffne(
    `<form method="dialog" class="dialog-form">
      <h2>${esc(titel)}</h2>
      <input name="text" type="text" value="${esc(wert)}" autocomplete="off" required>
      <div class="dialog-knoepfe">
        <button type="button" data-abbrechen class="btn">Abbrechen</button>
        <button value="ok" class="btn btn-primaer">${esc(okText)}</button>
      </div>
    </form>`,
    () => {
      feld = dialog.querySelector('input');
      feld.focus();
      feld.select();
    },
  );
  const text = feld?.value.trim();
  return ergebnis === 'ok' && text ? text : null;
}

/** Ja/Nein-Abfrage. Liefert true bei Bestätigung. */
export async function bestaetige({ titel, text = '', okText = 'OK', gefaehrlich = false }) {
  const ergebnis = await oeffne(
    `<form method="dialog" class="dialog-form">
      <h2>${esc(titel)}</h2>
      ${text ? `<p>${esc(text)}</p>` : ''}
      <div class="dialog-knoepfe">
        <button type="button" data-abbrechen class="btn">Abbrechen</button>
        <button value="ok" class="btn ${gefaehrlich ? 'btn-gefahr' : 'btn-primaer'}">${esc(okText)}</button>
      </div>
    </form>`,
  );
  return ergebnis === 'ok';
}

/** Auswahlmenü. optionen: [{ wert, text, gefaehrlich? }]. Liefert den Wert oder ''. */
export function menue({ titel, optionen }) {
  return oeffne(
    `<form method="dialog" class="dialog-form dialog-menue">
      <h2>${esc(titel)}</h2>
      ${optionen.map((o) => `<button value="${esc(o.wert)}" class="menue-punkt${o.gefaehrlich ? ' gefahr' : ''}">${esc(o.text)}</button>`).join('')}
      <button value="" class="menue-punkt abbrechen">Abbrechen</button>
    </form>`,
  );
}

/**
 * Freies Formular. inhaltHtml enthält die Felder, knoepfeHtml die Knöpfe
 * (Abbrechen mit data-abbrechen, Absende-Knöpfe mit value).
 * Liefert { wert, daten } – daten ist FormData oder null bei Abbruch.
 */
export async function formular({ titel, inhaltHtml, knoepfeHtml }) {
  const wert = await oeffne(
    `<form method="dialog" class="dialog-form" autocomplete="off">
      <h2>${esc(titel)}</h2>
      ${inhaltHtml}
      <div class="dialog-knoepfe">${knoepfeHtml}</div>
    </form>`,
  );
  return { wert, daten: wert ? new FormData(dialog.querySelector('form')) : null };
}

/**
 * Kurze Meldung am unteren Rand, optional mit Aktionsknopf (z. B. "Rückgängig").
 */
let meldungTimer;
export function meldung(text, { aktion, beiAktion, dauer } = {}) {
  const el = document.getElementById('meldung');
  el.innerHTML = `<span>${esc(text)}</span>${aktion ? `<button type="button" class="meldung-aktion">${esc(aktion)}</button>` : ''}`;
  el.hidden = false;
  const schliessen = () => { el.hidden = true; };
  if (aktion) {
    el.querySelector('button').onclick = () => {
      schliessen();
      beiAktion?.();
    };
  }
  clearTimeout(meldungTimer);
  meldungTimer = setTimeout(schliessen, dauer ?? (aktion ? 5000 : 2500));
}
