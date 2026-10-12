// Bildschirm anlassen, solange eine Einkaufsliste offen ist (Screen Wake Lock).
// Der Browser gibt die Sperre beim Wechsel in eine andere App frei – beim Zurückkehren
// wird sie automatisch erneuert.

let sperre = null;
let gewuenscht = false;

async function anfordern() {
  if (!('wakeLock' in navigator) || sperre || document.visibilityState !== 'visible') return;
  try {
    sperre = await navigator.wakeLock.request('screen');
    sperre.addEventListener('release', () => { sperre = null; });
  } catch {
    // z. B. Energiesparmodus – dann geht der Bildschirm eben normal aus.
  }
}

export async function halteBildschirmAn(an) {
  gewuenscht = an;
  if (an) {
    await anfordern();
  } else if (sperre) {
    const alt = sperre;
    sperre = null;
    await alt.release().catch(() => {});
  }
}

export function bildschirmWirdAngehalten() {
  return sperre !== null;
}

document.addEventListener('visibilitychange', () => {
  if (gewuenscht && document.visibilityState === 'visible') anfordern();
});
