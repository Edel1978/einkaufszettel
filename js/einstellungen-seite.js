// Seite "#/einstellungen": Erkennungsdienst, API-Schlüssel, Modell, Server.
// Änderungen werden sofort gespeichert.

import { BETRIEBSARTEN, ANBIETER, anbieterInfo, ladeEinstellungen, speichereEinstellungen } from './einstellungen.js';
import { testeVerbindung } from './recognizers/index.js';
import { kannInstallieren, istInstalliert, installiere } from './installieren.js';
import { esc } from './util.js';

function installHtml() {
  if (istInstalliert()) return '<p class="leise-text">Die App ist installiert und läuft vom Startbildschirm.</p>';
  if (kannInstallieren()) return '<button class="btn btn-primaer btn-breit" type="button" data-installieren>Als App auf dem Startbildschirm installieren</button>';
  return `<p class="leise-text">Zum Installieren in Chrome oben rechts auf ⋮ tippen und
    „Zum Startbildschirm hinzufügen“ bzw. „App installieren“ wählen.</p>`;
}

export function zeigeEinstellungen(app) {
  app.setzeKopf({ titel: 'Einstellungen', zurueck: true });
  const e = ladeEinstellungen();
  const anbieter = anbieterInfo(e.anbieter);

  app.inhalt.innerHTML = `
    <form class="einstellungen" autocomplete="off">
      <section class="block">
        <h2>Texterkennung</h2>
        <div class="optionen">
          ${BETRIEBSARTEN.map((b) => `
            <label class="option">
              <input type="radio" name="betriebsart" value="${b.id}"${b.id === e.betriebsart ? ' checked' : ''}>
              <span><strong>${esc(b.name)}</strong><small>${esc(b.info)}</small></span>
            </label>`).join('')}
        </div>

        <div class="nur-direkt">
          <label class="feld"><span>Anbieter</span>
            <select name="anbieter">
              ${ANBIETER.map((a) => `<option value="${a.id}"${a.id === e.anbieter ? ' selected' : ''}>${esc(a.name)}</option>`).join('')}
            </select></label>
          <p class="leise-text">${esc(anbieter.info)}</p>
          <label class="feld"><span>API-Schlüssel (${esc(anbieter.schluesselHinweis)})</span>
            <span class="passwort-feld">
              <input name="apiSchluessel" type="password" value="${esc(e.apiSchluessel)}" spellcheck="false" autocapitalize="off" placeholder="Noch nicht eingetragen">
              <button class="btn" type="button" data-zeigen>Zeigen</button>
            </span></label>
          <p class="leise-text">Einen Schlüssel bekommst du unter
            <a href="${anbieter.schluesselLink}" target="_blank" rel="noopener">${esc(new URL(anbieter.schluesselLink).host)}</a>.
            Er wird nur auf diesem Gerät gespeichert und nur an den Anbieter gesendet.</p>
        </div>

        <div class="nur-server">
          <label class="feld"><span>Server-Adresse</span>
            <input name="serverUrl" type="url" value="${esc(e.serverUrl)}" placeholder="https://…" spellcheck="false" autocapitalize="off"></label>
          <label class="feld"><span>Server-Passwort</span>
            <input name="serverPasswort" type="password" value="${esc(e.serverPasswort)}" spellcheck="false" autocapitalize="off"></label>
        </div>

        <div class="nur-direkt nur-server">
          <label class="feld"><span>Modell</span>
            <select name="modell">
              ${anbieter.modelle.map((m) => `<option value="${m.id}"${m.id === e.modell ? ' selected' : ''}>${esc(m.name)}</option>`).join('')}
            </select></label>
        </div>

        <button class="btn btn-breit" type="button" data-testen>Verbindung testen</button>
        <p class="test-ergebnis" role="status" hidden></p>
      </section>

      <section class="block">
        <h2>App</h2>
        <label class="option">
          <input type="checkbox" name="bildschirmAn"${e.bildschirmAn ? ' checked' : ''}>
          <span><strong>Bildschirm beim Einkaufen anlassen</strong>
            <small>Solange eine Liste offen ist, schaltet sich der Bildschirm nicht ab.</small></span>
        </label>
        <div data-install-bereich>${installHtml()}</div>
      </section>
      <p class="leise-text zentriert">Änderungen werden automatisch gespeichert.</p>
    </form>`;

  const form = app.inhalt.querySelector('form');
  const ergebnis = form.querySelector('.test-ergebnis');

  const zeigeAbschnitte = () => {
    const art = form.betriebsart.value;
    form.querySelectorAll('.nur-direkt, .nur-server').forEach((el) => {
      el.hidden = !((art === 'direkt' && el.classList.contains('nur-direkt'))
        || (art === 'server' && el.classList.contains('nur-server')));
    });
  };

  const speichere = () => {
    // Nach einem Anbieterwechsel ist dieses Formular schon ersetzt – späte Ereignisse ignorieren.
    if (!form.isConnected) return;
    const daten = Object.fromEntries(new FormData(form));
    if (daten.anbieter !== ladeEinstellungen().anbieter) {
      // Anderer Anbieter: nur den Wechsel speichern und Schlüssel/Modelle des neuen Anbieters anzeigen.
      speichereEinstellungen({ betriebsart: daten.betriebsart, anbieter: daten.anbieter });
      zeigeEinstellungen(app);
      return;
    }
    speichereEinstellungen({ ...daten, bildschirmAn: form.bildschirmAn.checked });
    ergebnis.hidden = true;
    zeigeAbschnitte();
  };

  form.addEventListener('input', speichere);
  form.addEventListener('change', speichere);
  form.addEventListener('submit', (ev) => ev.preventDefault());
  zeigeAbschnitte();

  form.querySelector('[data-installieren]')?.addEventListener('click', async () => {
    await installiere();
    form.querySelector('[data-install-bereich]').innerHTML = installHtml();
  });

  form.querySelector('[data-zeigen]').addEventListener('click', (ev) => {
    const feld = form.apiSchluessel;
    feld.type = feld.type === 'password' ? 'text' : 'password';
    ev.target.textContent = feld.type === 'password' ? 'Zeigen' : 'Verbergen';
  });

  form.querySelector('[data-testen]').addEventListener('click', async (ev) => {
    speichere();
    const knopf = ev.target;
    knopf.disabled = true;
    ergebnis.hidden = false;
    ergebnis.className = 'test-ergebnis';
    ergebnis.textContent = 'Teste Verbindung …';
    try {
      ergebnis.textContent = await testeVerbindung();
      ergebnis.classList.add('ok');
    } catch (fehler) {
      ergebnis.textContent = fehler.message;
      ergebnis.classList.add('fehler');
    } finally {
      knopf.disabled = false;
    }
  });
}
