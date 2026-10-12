/* Robot Rush : fonctions partagées par les trois pages. */
'use strict';

const RR = (() => {
  const SYMBOLES = {
    etoile: 'M0 -5L1.29 -1.78L4.76 -1.55L2.09 0.68L2.94 4.05L0 2.2L-2.94 4.05L-2.09 0.68L-4.76 -1.55L-1.29 -1.78Z',
    triangle: 'M0 -5L5 4.2L-5 4.2Z',
    cercle: 'M0 -4.6A4.6 4.6 0 1 1 0 4.6A4.6 4.6 0 1 1 0 -4.6Z',
    carre: 'M-4 -4H4V4H-4Z',
    losange: 'M0 -5.4L5 0L0 5.4L-5 0Z',
    eclair: 'M1.5 -5.5L-4 1H-0.5L-1.5 5.5L4 -1H0.5Z',
    coeur: 'M0 4.5C-6 0.5 -5.5 -4.5 -2.6 -4.5C-1.2 -4.5 -0.4 -3.6 0 -2.6C0.4 -3.6 1.2 -4.5 2.6 -4.5C5.5 -4.5 6 0.5 0 4.5Z',
    croix: 'M-1.6 -5H1.6V-1.6H5V1.6H1.6V5H-1.6V1.6H-5V-1.6H-1.6Z',
  };
  const ICONES = ['trou', 'mur', 'rocher', 'boue', 'pont', 'echelle', 'pelleteuse', 'chenilles'];
  const INK = '#16161D';

  /** Robot paramétrable (voir design/maquettes/Robot.dc.html) : etat = normal | bloque | succes. */
  function robot({ couleur = '#2563EB', symbole = 'triangle', etat = 'normal', taille = 64 } = {}) {
    const c = couleur;
    let yeux;
    if (etat === 'bloque') {
      yeux = `<circle cx="25" cy="21" r="5" fill="#fff" stroke="${INK}" stroke-width="2"/><circle cx="39" cy="21" r="5" fill="#fff" stroke="${INK}" stroke-width="2"/>
        <circle cx="25" cy="23" r="2.2" fill="${INK}"/><circle cx="39" cy="23" r="2.2" fill="${INK}"/>
        <path d="M19 15.5L28 13M36 13L45 15.5" stroke="${INK}" stroke-width="2.2" stroke-linecap="round" fill="none"/>
        <path d="M26 29Q29 27 32 29Q35 31 38 29" stroke="${INK}" stroke-width="2" stroke-linecap="round" fill="none"/>`;
    } else if (etat === 'succes') {
      yeux = `<path d="M20.5 22Q25 15 29.5 22M34.5 22Q39 15 43.5 22" stroke="${INK}" stroke-width="2.6" stroke-linecap="round" fill="none"/>
        <path d="M25 25.5Q32 32.5 39 25.5Z" fill="#fff" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>`;
    } else {
      yeux = `<circle cx="25" cy="20" r="5" fill="#fff" stroke="${INK}" stroke-width="2"/><circle cx="39" cy="20" r="5" fill="#fff" stroke="${INK}" stroke-width="2"/>
        <circle cx="27" cy="20.5" r="2.4" fill="${INK}"/><circle cx="41" cy="20.5" r="2.4" fill="${INK}"/>
        <path d="M28 27.5H36" stroke="${INK}" stroke-width="2.2" stroke-linecap="round"/>`;
    }
    return `<svg class="robot" width="${taille}" height="${taille}" viewBox="0 0 64 64" style="overflow:visible" aria-hidden="true">
      ${etat === 'succes' ? `<path d="M1 38H9M-2 45H7M2 52H10" stroke="${INK}" stroke-width="2.5" stroke-linecap="round" fill="none"/>` : ''}
      <line x1="32" y1="11" x2="32" y2="5" stroke="${INK}" stroke-width="2.5"/>
      <circle cx="32" cy="4.5" r="3.5" fill="${c}" stroke="${INK}" stroke-width="2"/>
      <rect x="14" y="10" width="36" height="22" rx="6" fill="${c}" stroke="${INK}" stroke-width="2.5"/>
      ${yeux}
      <rect x="16" y="34" width="32" height="18" rx="4" fill="${c}" stroke="${INK}" stroke-width="2.5"/>
      <circle cx="32" cy="43" r="7" fill="#fff" stroke="${INK}" stroke-width="2"/>
      <path d="${SYMBOLES[symbole] || SYMBOLES.triangle}" fill="${INK}" transform="translate(32 43) scale(0.95)"/>
      <circle cx="22" cy="56" r="5.5" fill="${INK}"/><circle cx="42" cy="56" r="5.5" fill="${INK}"/>
      <circle cx="22" cy="56" r="2" fill="#fff"/><circle cx="42" cy="56" r="2" fill="#fff"/>
      ${etat === 'bloque' ? `<circle cx="54" cy="8" r="8" fill="#E0362C" stroke="${INK}" stroke-width="2"/><path d="M54 3.5V9" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/><circle cx="54" cy="12.3" r="1.5" fill="#fff"/>` : ''}
    </svg>`;
  }

  /** Pastille : cercle blanc + symbole encre. */
  function pastille(symbole, taille = 32, fond = '#fff') {
    return `<svg width="${taille}" height="${taille}" viewBox="-7 -7 14 14" aria-hidden="true">
      <circle r="6.2" fill="${fond}" stroke="${INK}" stroke-width="0.9"/>
      <path d="${SYMBOLES[symbole] || ''}" fill="${INK}" transform="scale(0.8)"/></svg>`;
  }

  /** Icône d'obstacle ou de solution ; icône générique pour une paire ajoutée par le professeur. */
  function icone(id, taille = 32) {
    if (ICONES.includes(id)) return `<img class="icone" src="/assets/icones/${id}.svg" width="${taille}" height="${taille}" alt="">`;
    return `<svg class="icone" width="${taille}" height="${taille}" viewBox="0 0 32 32" aria-hidden="true">
      <rect x="3" y="3" width="26" height="26" rx="6" fill="#fff" stroke="${INK}" stroke-width="2"/>
      <text x="16" y="22" text-anchor="middle" font-size="16" font-weight="700" fill="${INK}">?</text></svg>`;
  }

  function esc(t) {
    return String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function el(selecteur, racine = document) { return racine.querySelector(selecteur); }

  // ---------- Comptes à rebours ----------
  // Le serveur envoie des durées restantes ; chaque élément [data-fin] affiche le temps restant.
  // En pause, on n'actualise plus : le chiffre reste figé.
  let enPause = false;
  function fin(restantMs) { return performance.now() + restantMs; }
  function secondes(finMs) { return Math.max(0, Math.ceil((finMs - performance.now()) / 1000)); }
  function format(ms) {
    const s = Math.max(0, Math.ceil(ms / 1000));
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  }
  function majDecomptes() {
    if (enPause) return;
    const maintenant = performance.now();
    document.querySelectorAll('[data-fin]').forEach((n) => {
      const restant = Number(n.dataset.fin) - maintenant;
      const texte = n.dataset.format === 'mmss' ? format(restant) : `${Math.max(0, Math.ceil(restant / 1000))}${n.dataset.suffixe ?? ''}`;
      if (n.textContent !== texte) n.textContent = texte;
      if (n.dataset.barre) {
        const total = Number(n.dataset.barre);
        const barre = document.getElementById(n.dataset.cible);
        if (barre) {
          barre.style.transform = `scaleX(${Math.max(0, restant / total)})`;
          barre.classList.toggle('urgent', restant < 5000);
        }
      }
    });
  }
  setInterval(majDecomptes, 200);

  function decompte(restantMs, { format: f, suffixe = '', classe = '' } = {}) {
    const texte = f === 'mmss' ? format(restantMs) : `${Math.ceil(restantMs / 1000)}${suffixe}`;
    return `<span class="${classe}" data-fin="${fin(restantMs)}" ${f ? `data-format="${f}"` : ''} data-suffixe="${esc(suffixe)}">${texte}</span>`;
  }

  function connecter(auth) {
    // eslint-disable-next-line no-undef
    return io({ auth, transports: ['websocket', 'polling'] });
  }

  return {
    robot, pastille, icone, esc, el, decompte, format, fin, secondes, connecter, majDecomptes,
    set pause(v) { enPause = v; }, get pause() { return enPause; },
  };
})();
