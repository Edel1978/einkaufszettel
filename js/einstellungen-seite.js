// Seite "#/einstellungen": Erkennungsdienste (erster und zweiter), Schlüssel, Modelle, Server,
// Spracheingabe und App-Optionen. Änderungen werden sofort gespeichert.

import {
  BETRIEBSARTEN, ANBIETER, SPRACHEINGABEN, anbieterInfo, ladeEinstellungen, speichereEinstellungen,
  einstellungenFuer,
} from './einstellungen.js';
import { browserErkennungVerfuegbar, aufnahmeVerfuegbar } from './sprache.js';
import { testeVerbindung, dienstName } from './recognizers/index.js';
import { kannInstallieren, istInstalliert, installiere } from './installieren.js';
import { esc } from './util.js';

function installHtml() {
  if (istInstalliert()) return '<p class="leise-text">Die App ist installiert und läuft vom Startbildschirm.</p>';
  if (kannInstallieren()) return '<button class="btn btn-primaer btn-breit" type="button" data-installieren>Als App auf dem Startbildschirm installieren</button>';
  return `<p class="leise-text">Zum Installieren in Chrome oben rechts auf ⋮ tippen und
    „Zum Startbildschirm hinzufügen“ bzw. „App installieren“ wählen.</p>`;
}

/** Eigenes Feld für den Groq-Schlüssel, wenn Whisper genutzt wird, Groq aber keiner der beiden Dienste ist. */
function groqFeldNoetig(e) {
  const groqGewaehlt = e.betriebsart === 'direkt' && (e.anbieter === 'groq' || e.ausweichAnbieter === 'groq');
  return e.spracheingabe === 'groq' && !groqGewaehlt;
}

/** Auswahl, Schlüssel und Modell für den ersten bzw. zweiten Dienst. */
function dienstHtml(e, rolle) {
  const erster = rolle === 'erster';
  const id = erster ? e.anbieter : e.ausweichAnbieter;
  const auswahl = erster ? ANBIETER : ANBIETER.filter((a) => a.id !== e.anbieter);
  const a = id ? anbieterInfo(id) : null;
  const modell = a ? einstellungenFuer(id).modell : '';

  return `
    <div class="dienst-block">
      <label class="feld"><span>${erster ? 'Erster Dienst' : 'Zweiter Dienst – springt ein, wenn der erste nicht klappt'}</span>
        <select name="${erster ? 'anbieter' : 'ausweichAnbieter'}">
          ${erster ? '' : `<option value=""${id ? '' : ' selected'}>Keiner</option>`}
          ${auswahl.map((x) => `<option value="${x.id}"${x.id === id ? ' selected' : ''}>${esc(x.name)}</option>`).join('')}
        </select></label>
      ${a ? `
        <p class="leise-text">${esc(a.info)}</p>
        <label class="feld"><span>API-Schlüssel für ${esc(dienstName(a.id))} (${esc(a.schluesselHinweis)})</span>
          <span class="passwort-feld">
            <input name="schluessel.${a.id}" type="password" value="${esc(e.schluessel[a.id] ?? '')}" spellcheck="false" autocapitalize="off" placeholder="Noch nicht eingetragen">
            <button class="btn" type="button" data-zeigen>Zeigen</button>
          </span></label>
        <p class="leise-text">Schlüssel gibt es unter
          <a href="${a.schluesselLink}" target="_blank" rel="noopener">${esc(new URL(a.schluesselLink).host)}</a>.
          Er wird nur auf diesem Gerät gespeichert und nur an ${esc(dienstName(a.id))} gesendet.</p>
        ${a.modelle.length > 1 ? `
          <label class="feld"><span>Modell</span>
            <select name="modell.${a.id}">
              ${a.modelle.map((m) => `<option value="${m.id}"${m.id === modell ? ' selected' : ''}>${esc(m.name)}</option>`).join('')}
            </select></label>` : `<p class="leise-text">Modell: ${esc(a.modelle[0].name)}</p>`}` : ''}
    </div>`;
}

export function zeigeEinstellungen(app) {
  app.setzeKopf({ titel: 'Einstellungen', zurueck: true });
  const e = ladeEinstellungen();

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
          ${dienstHtml(e, 'erster')}
          ${dienstHtml(e, 'zweiter')}
        </div>

        <div class="nur-server">
          <label class="feld"><span>Server-Adresse</span>
            <input name="serverUrl" type="url" value="${esc(e.serverUrl)}" placeholder="https://…" spellcheck="false" autocapitalize="off"></label>
          <label class="feld"><span>Server-Passwort</span>
            <input name="serverPasswort" type="password" value="${esc(e.serverPasswort)}" spellcheck="false" autocapitalize="off"></label>
        </div>

        <button class="btn btn-breit" type="button" data-testen>Verbindung testen</button>
        <div class="test-ergebnis" role="status" hidden></div>
      </section>

      <section class="block">
        <h2>Spracheingabe</h2>
        <div class="optionen">
          ${SPRACHEINGABEN.map((s) => {
            const fehlt = s.id === 'browser' ? !browserErkennungVerfuegbar() : !aufnahmeVerfuegbar();
            return `
            <label class="option">
              <input type="radio" name="spracheingabe" value="${s.id}"${s.id === e.spracheingabe ? ' checked' : ''}>
              <span><strong>${esc(s.name)}</strong><small>${esc(s.info)}${fehlt ? ' – <em>auf diesem Gerät nicht verfügbar</em>' : ''}</small></span>
            </label>`;
          }).join('')}
        </div>
        ${groqFeldNoetig(e) ? `
          <label class="feld"><span>Groq-API-Schlüssel (beginnt mit „gsk_“)</span>
            <input name="schluessel.groq" type="password" value="${esc(e.groqSchluessel)}" spellcheck="false" autocapitalize="off" placeholder="Noch nicht eingetragen"></label>
          <p class="leise-text">Kostenlos unter <a href="https://console.groq.com/keys" target="_blank" rel="noopener">console.groq.com</a>.</p>` : ''}
        <p class="leise-text">Aus dem gesprochenen Text machen anschließend die oben gewählten Dienste die einzelnen Einträge.</p>
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
    form.querySelector('.nur-direkt').hidden = art !== 'direkt';
    form.querySelector('.nur-server').hidden = art !== 'server';
  };

  // Formularfelder → Einstellungen ("schluessel.groq" und "modell.google" gehören je zu einem Anbieter).
  const liesFormular = () => {
    const daten = { schluessel: {}, modelle: {}, bildschirmAn: form.bildschirmAn.checked };
    for (const [name, wert] of new FormData(form)) {
      if (name.startsWith('schluessel.')) daten.schluessel[name.slice(11)] = wert;
      else if (name.startsWith('modell.')) daten.modelle[name.slice(7)] = wert;
      else if (name !== 'bildschirmAn') daten[name] = wert;
    }
    return daten;
  };

  const speichere = () => {
    // Nach einem Neuaufbau ist dieses Formular schon ersetzt – späte Ereignisse ignorieren.
    if (!form.isConnected) return;
    const vorher = ladeEinstellungen();
    speichereEinstellungen(liesFormular());
    const jetzt = ladeEinstellungen();
    // Andere Dienste oder Spracheingabe gewählt: Seite mit den passenden Feldern neu aufbauen.
    if (['anbieter', 'ausweichAnbieter', 'betriebsart', 'spracheingabe'].some((k) => vorher[k] !== jetzt[k])) {
      zeigeEinstellungen(app);
      return;
    }
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

  form.querySelectorAll('[data-zeigen]').forEach((knopf) => {
    knopf.addEventListener('click', () => {
      const feld = knopf.previousElementSibling;
      feld.type = feld.type === 'password' ? 'text' : 'password';
      knopf.textContent = feld.type === 'password' ? 'Zeigen' : 'Verbergen';
    });
  });

  // Testet beide gewählten Dienste und zeigt je eine Zeile.
  form.querySelector('[data-testen]').addEventListener('click', async (ev) => {
    speichere();
    const e2 = ladeEinstellungen();
    const knopf = ev.target;
    knopf.disabled = true;
    ergebnis.hidden = false;
    ergebnis.className = 'test-ergebnis';
    ergebnis.textContent = 'Teste Verbindung …';

    const pruefungen = e2.betriebsart === 'direkt'
      ? [e2.anbieter, e2.ausweichAnbieter].filter(Boolean).map((id) => ({ name: dienstName(id), einstellungen: einstellungenFuer(id) }))
      : [{ name: e2.betriebsart === 'server' ? 'Server' : 'Testmodus', einstellungen: e2 }];
    const zeilen = await Promise.all(pruefungen.map(async (p) => {
      try {
        return { ok: true, text: `${p.name}: ${await testeVerbindung(p.einstellungen)}` };
      } catch (fehler) {
        return { ok: false, text: `${p.name}: ${fehler.message}` };
      }
    }));
    ergebnis.innerHTML = zeilen.map((z) => `<p class="${z.ok ? 'ok' : 'fehler'}">${z.ok ? '✓' : '✗'} ${esc(z.text)}</p>`).join('');
    knopf.disabled = false;
  });
}
