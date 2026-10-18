// Spracheingabe: gesprochene Einkaufsliste in Text umwandeln.
//
// Zwei Wege:
// - Browser: eingebaute Spracherkennung (bei Chrome über Google). Kostenlos, Text erscheint live.
// - Aufnahme: Ton aufnehmen und danach von Groq Whisper abschreiben lassen (siehe recognizers/groq.js).

export class SprachFehler extends Error {
  constructor(code, text) {
    super(text);
    this.code = code;
  }
}

const MIKROFON_GESPERRT = 'Das Mikrofon ist für die App gesperrt. Bitte in den Einstellungen des Handys (bzw. im Browser über das Schloss neben der Adresse) den Mikrofon-Zugriff erlauben.';

function SpracherkennungKlasse() {
  return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null;
}

export function browserErkennungVerfuegbar() {
  return SpracherkennungKlasse() !== null;
}

export function aufnahmeVerfuegbar() {
  return Boolean(navigator.mediaDevices?.getUserMedia && window.MediaRecorder);
}

/**
 * Startet die Spracherkennung des Browsers.
 * beiText(text) wird bei jeder Änderung mit dem bisher erkannten Text aufgerufen (inkl. Zwischenstand).
 * beiFehler(fehler) bei einem Fehler, der das Zuhören beendet.
 * Liefert { stoppe() → Promise<endgültiger Text>, abbrechen() }.
 */
export function starteBrowserErkennung({ beiText, beiFehler }) {
  const Klasse = SpracherkennungKlasse();
  if (!Klasse) {
    throw new SprachFehler('nicht-unterstuetzt', 'Dieser Browser hat keine eingebaute Spracherkennung. Bitte in den Einstellungen „Groq Whisper“ wählen.');
  }

  let fertigerText = '';
  let zwischenText = '';
  let aktiv = true;
  let erkennung = null;
  let beimEnde = null;

  const gesamt = () => [fertigerText, zwischenText].filter(Boolean).join(' ').trim();

  // Eine Sitzung pro Satz und danach neu starten: "continuous" verdoppelt auf Android
  // manchmal Wörter, so bleiben Pausen beim Sprechen trotzdem möglich.
  const starte = () => {
    erkennung = new Klasse();
    erkennung.lang = 'de-DE';
    erkennung.interimResults = true;
    erkennung.continuous = false;
    erkennung.maxAlternatives = 1;

    erkennung.onresult = (ereignis) => {
      zwischenText = '';
      for (let i = ereignis.resultIndex; i < ereignis.results.length; i++) {
        const stueck = ereignis.results[i][0].transcript.trim();
        if (ereignis.results[i].isFinal) fertigerText = `${fertigerText} ${stueck}`.trim();
        else zwischenText = `${zwischenText} ${stueck}`.trim();
      }
      beiText(gesamt());
    };

    erkennung.onerror = (ereignis) => {
      if (ereignis.error === 'no-speech' || ereignis.error === 'aborted') return; // einfach weiter zuhören
      aktiv = false;
      const meldungen = {
        'not-allowed': MIKROFON_GESPERRT,
        'service-not-allowed': MIKROFON_GESPERRT,
        'audio-capture': 'Es wurde kein Mikrofon gefunden.',
        network: 'Die Spracherkennung braucht eine Internetverbindung.',
        'language-not-supported': 'Die Spracherkennung unterstützt Deutsch auf diesem Gerät nicht.',
      };
      beiFehler(new SprachFehler(ereignis.error, meldungen[ereignis.error] ?? `Die Spracherkennung ist fehlgeschlagen (${ereignis.error}).`));
    };

    erkennung.onend = () => {
      // Zwischenstand, der nicht mehr endgültig wurde, trotzdem behalten.
      if (zwischenText) {
        fertigerText = gesamt();
        zwischenText = '';
      }
      if (aktiv) {
        try { starte(); } catch { /* Neustart nicht möglich – dann endet das Zuhören */ }
      } else {
        beimEnde?.(fertigerText);
      }
    };

    erkennung.start();
  };

  starte();

  return {
    stoppe() {
      aktiv = false;
      return new Promise((resolve) => {
        beimEnde = resolve;
        try { erkennung.stop(); } catch { resolve(gesamt()); }
        // Falls der Browser kein "end" mehr meldet.
        setTimeout(() => resolve(gesamt()), 2500);
      });
    },
    abbrechen() {
      aktiv = false;
      beimEnde = null;
      try { erkennung.abort(); } catch { /* egal */ }
    },
  };
}

/**
 * Nimmt Ton vom Mikrofon auf (für Groq Whisper).
 * Liefert { stoppe() → Promise<Blob>, abbrechen() }.
 */
export async function starteAufnahme() {
  if (!aufnahmeVerfuegbar()) {
    throw new SprachFehler('nicht-unterstuetzt', 'Dieser Browser kann keinen Ton aufnehmen.');
  }
  let strom;
  try {
    strom = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
  } catch (fehler) {
    if (fehler.name === 'NotAllowedError' || fehler.name === 'SecurityError') throw new SprachFehler('not-allowed', MIKROFON_GESPERRT);
    throw new SprachFehler('audio-capture', 'Das Mikrofon konnte nicht gestartet werden.');
  }

  const typ = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'].find((t) => MediaRecorder.isTypeSupported(t));
  const rekorder = new MediaRecorder(strom, typ ? { mimeType: typ } : undefined);
  const stuecke = [];
  rekorder.ondataavailable = (e) => { if (e.data.size > 0) stuecke.push(e.data); };
  const beendeStrom = () => strom.getTracks().forEach((spur) => spur.stop());
  rekorder.start();

  return {
    stoppe() {
      return new Promise((resolve) => {
        rekorder.onstop = () => {
          beendeStrom();
          resolve(new Blob(stuecke, { type: rekorder.mimeType || typ || 'audio/webm' }));
        };
        rekorder.stop();
      });
    },
    abbrechen() {
      rekorder.onstop = beendeStrom;
      if (rekorder.state !== 'inactive') rekorder.stop();
      else beendeStrom();
    },
  };
}
