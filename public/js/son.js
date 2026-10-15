/* Projecteur · son : fanfare de victoire jouée à la fin de la course.
 * Synthétisée dans le navigateur (Web Audio) : aucun fichier audio, rien à télécharger.
 * Les navigateurs n'autorisent le son qu'après un clic sur la page : le bouton « Son » sert aussi à l'activer.
 * (Sur la Raspberry Pi, le navigateur plein écran est lancé avec le son autorisé d'office.)
 */
'use strict';

RR.son = (() => {
  const CLE = 'robotrush-son';
  let actif = true;
  try { actif = localStorage.getItem(CLE) !== 'coupe'; } catch { /* navigation privée */ }
  let ctx = null;

  function contexte() {
    if (!ctx) {
      const C = window.AudioContext || window.webkitAudioContext;
      if (!C) return null;
      ctx = new C();
    }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  }

  /** Une note : fréquence (Hz), début et durée (s), timbre, volume. */
  function note(c, freq, debut, duree, { type = 'square', volume = 0.12 } = {}) {
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.value = freq;
    const t = c.currentTime + debut;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(volume, t + 0.02);
    g.gain.setValueAtTime(volume, t + duree * 0.7);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duree);
    o.connect(g).connect(c.destination);
    o.start(t);
    o.stop(t + duree + 0.05);
  }

  // Fanfare (environ 4 s) : appel de trompettes, montée, accord final tenu.
  const DO = 523.25; const MI = 659.25; const SOL = 783.99; const DO2 = 1046.5; const LA = 880; const SI = 987.77;
  function victoire() {
    if (!actif) return false;
    const c = contexte();
    if (!c || c.state !== 'running') return false;
    const croche = 0.16;
    const melodie = [[SOL, 0, 1], [SOL, 1, 1], [SOL, 2, 1], [DO2, 3, 3], [SOL, 6, 1], [LA, 7, 1], [SI, 8, 1], [DO2, 9, 6]];
    for (const [f, debut, longueur] of melodie) note(c, f, debut * croche, longueur * croche + 0.05);
    // Basse et accord final.
    const fin = 9 * croche;
    for (const f of [DO / 2, MI / 2, SOL / 2]) note(c, f, fin, 1.6, { type: 'triangle', volume: 0.18 });
    for (const f of [DO, MI, SOL]) note(c, f, fin, 1.6, { type: 'sawtooth', volume: 0.04 });
    for (const [f, debut] of [[DO / 2, 0], [SOL / 2, 3], [DO / 2, 6]]) note(c, f, debut * croche, croche * 2, { type: 'triangle', volume: 0.16 });
    return true;
  }

  function basculer() {
    actif = !actif;
    try { localStorage.setItem(CLE, actif ? 'actif' : 'coupe'); } catch { /* ignoré */ }
    if (actif) contexte();
    return actif;
  }

  // Le premier clic ou la première touche sur la page autorise le son.
  const debloquer = () => { if (actif) contexte(); };
  window.addEventListener('pointerdown', debloquer);
  window.addEventListener('keydown', debloquer);

  return { victoire, basculer, actif: () => actif, pret: () => Boolean(ctx && ctx.state === 'running') };
})();
