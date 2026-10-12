/* Écran projecteur /course */
'use strict';

(() => {
  const { robot, pastille, icone, esc, el, decompte } = RR;
  const scene = el('#scene');
  let etat = null;
  let precedent = {}; // id d'équipe → { blocage, position } (pour déclencher les animations)
  let dernierFil = 0;
  let nbCouloirs = 0;

  // Mise à l'échelle de la scène 1920×1080 dans la fenêtre.
  function ajuster() {
    const k = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
    scene.style.transform = `translate(${(window.innerWidth - 1920 * k) / 2}px, ${(window.innerHeight - 1080 * k) / 2}px) scale(${k})`;
  }
  window.addEventListener('resize', ajuster);
  ajuster();
  el('#logo').innerHTML = robot({ couleur: '#16161D', symbole: 'etoile', taille: 60 });

  function texteFil(entree) {
    let t = esc(entree.texte);
    for (const e of etat.equipes) t = t.replace(new RegExp(`\\b${e.nom}\\b`, 'g'), `<b>${e.nom}</b>`);
    return t;
  }
  function iconeFil(f) {
    const id = f.type === 'attaque' || f.type === 'repart' ? f.obstacle : f.solution;
    return id ? icone(id, 40) : '<span style="width:40px"></span>';
  }

  // ---------- Avant la partie ----------
  function afficherLobby() {
    el('#nb-connectes').textContent = etat.nbEleves;
    el('#adresse-lobby').textContent = etat.adresse.replace(/^https?:\/\//, '');
    el('#cartes-codes').style.gridTemplateColumns = `repeat(${Math.min(4, etat.equipes.length)}, 1fr)`;
    el('#cartes-codes').innerHTML = etat.equipes.map((e) => `
      <div class="carte-code">
        <div class="bandeau" style="background:${e.couleur};color:${e.texte}">${robot({ couleur: e.couleur, symbole: e.symbole, taille: 64 })}<span class="titre">${esc(e.nom)}</span></div>
        <div class="code">${esc(e.code)}</div>
        <div class="eleves">${e.nbEleves} élève${e.nbEleves > 1 ? 's' : ''}${e.eleves.length ? ' · ' + e.eleves.map(esc).join(', ') : ''}</div>
      </div>`).join('');
  }

  // ---------- Course ----------
  function construireCouloirs() {
    const conteneur = el('#couloirs');
    conteneur.classList.toggle('grand', etat.equipes.length <= 3);
    conteneur.innerHTML = etat.equipes.map((e) => `
      <div class="couloir" id="couloir-${e.id}">
        <div class="etiquette" style="background:${e.couleur};color:${e.texte}">
          ${pastille(e.symbole, etat.equipes.length <= 3 ? 64 : 48)}
          <span class="textes"><span class="nom">${etat.equipes.length <= 3 ? 'Équipe ' : ''}${esc(e.nom)}</span>
          <span class="pos"></span></span>
        </div>
        <div class="piste">
          <div class="depart"></div><div class="arrivee"></div>
          <div class="rail"><div class="coureur"></div><div class="blocage" hidden></div></div>
        </div>
      </div>`).join('');
    nbCouloirs = etat.equipes.length;
    precedent = {};
  }

  function majCouloirs() {
    if (nbCouloirs !== etat.equipes.length || !el('#couloir-0')) construireCouloirs();
    const grand = etat.equipes.length <= 3;
    const L = etat.reglages.longueur;
    // 2 équipes : tailles de la maquette A2 ; 3 équipes : réduites pour tenir dans le couloir.
    const deux = etat.equipes.length === 2;
    const tRobot = grand ? (deux ? 180 : 120) : 64;
    const tIcone = grand ? (deux ? 52 : 36) : 24;
    const tTuile = grand ? (deux ? 120 : 88) : 56;
    for (const e of etat.equipes) {
      const c = el(`#couloir-${e.id}`);
      c.querySelector('.rail').style.backgroundSize = `calc(100% / ${L}) 100%`;
      c.querySelector('.pos').textContent = `${e.position} / ${L}`;
      const pourcent = (e.position / L) * 100;
      const coureur = c.querySelector('.coureur');
      coureur.style.left = `${pourcent}%`;
      const etatRobot = e.blocage ? 'bloque' : e.succesRestantMs > 0 ? 'succes' : 'normal';
      const stock = Object.entries(e.stock).filter(([, n]) => n > 0)
        .map(([id, n]) => `<span class="puce">${icone(id, tIcone)}${n}</span>`).join('');
      const cle = `${etatRobot}|${stock}`;
      if (coureur.dataset.cle !== cle) {
        coureur.innerHTML = robot({ couleur: e.couleur, symbole: e.symbole, etat: etatRobot, taille: tRobot }) + `<div class="stock">${stock}</div>`;
        coureur.dataset.cle = cle;
      }
      coureur.classList.toggle('protege', e.protegeRestantMs > 0);
      c.classList.toggle('bloque', Boolean(e.blocage));
      const b = c.querySelector('.blocage');
      if (e.blocage) {
        b.hidden = false;
        b.style.left = `calc(${pourcent}% + ${tRobot / 2 + 8}px)`;
        b.innerHTML = `<div class="tuile-obstacle">${icone(e.blocage.obstacle, tTuile)}</div>${decompte(e.blocage.restantMs, { suffixe: ' s', classe: 'pastille-decompte' })}`;
        if (!precedent[e.id] || !precedent[e.id].blocage) {
          c.classList.remove('secousse'); void c.offsetWidth; c.classList.add('secousse');
        }
      } else {
        b.hidden = true;
        b.innerHTML = '';
      }
      // Retirer le halo de protection quand elle expire, sans attendre un nouvel état.
      if (e.protegeRestantMs > 0) setTimeout(() => coureur.classList.remove('protege'), e.protegeRestantMs);
      if (e.succesRestantMs > 0) setTimeout(() => { if (etat) majCouloirs(); }, e.succesRestantMs + 50);
      precedent[e.id] = { blocage: e.blocage, position: e.position };
    }
  }

  function majClassement() {
    const tri = etat.equipes.slice().sort((a, b) => b.position - a.position);
    el('#classement').innerHTML = tri.map((e, i) => `
      <li><span class="rang">${i + 1}</span>
      <span class="carre" style="background:${e.couleur}">${pastille(e.symbole, 26, 'transparent')}</span>
      <span class="nom">${esc(e.nom)}</span><span class="pos">${e.position}</span></li>`).join('');
  }

  function majFil() {
    const n = etat.equipes.length <= 3 ? 8 : 6;
    el('#fil').innerHTML = etat.fil.slice(0, n).map((f) =>
      `<li class="${f.id > dernierFil ? 'nouveau' : ''}">${iconeFil(f)}<span>${texteFil(f)}</span></li>`).join('');
    if (etat.fil[0]) dernierFil = etat.fil[0].id;
  }

  // ---------- Fin ----------
  function afficherFin() {
    const r = etat.resultat;
    const eq = (id) => etat.equipes[id];
    const premiers = r.classement.filter((c) => c.rang === 1);
    el('#fin-sous').textContent = r.raison === 'arrivee' ? `Arrivée en ${RR.format(r.dureeMs)}` : r.raison === 'temps' ? 'Fin du temps' : 'Partie arrêtée';
    el('#fin-titre').textContent = premiers.length === 1 ? `L'équipe ${eq(premiers[0].equipe).nom} gagne !` : 'Égalité en tête !';
    const hauteurs = { 1: 360, 2: 260, 3: 190 };
    const tailles = { 1: 180, 2: 140, 3: 120 };
    const top3 = r.classement.slice(0, 3);
    const ordre = [top3[1], top3[0], top3[2]].filter(Boolean);
    el('#podium').innerHTML = ordre.map((c, i) => {
      const e = eq(c.equipe);
      const h = hauteurs[Math.min(3, c.rang)];
      return `<div class="marche-bloc">${robot({ couleur: e.couleur, symbole: e.symbole, etat: 'succes', taille: tailles[Math.min(3, c.rang)] })}
        <div class="marche" style="height:${h}px;background:${e.couleur};color:${e.texte};animation-delay:${[300, 600, 0][i]}ms">
        <span class="rang">${c.rang}</span><span class="pos">${c.position} cases</span></div></div>`;
    }).join('');
    el('#suivants').innerHTML = r.classement.slice(3).map((c) => `<span><b>${c.rang}.</b> ${esc(eq(c.equipe).nom)} · ${c.position}</span>`).join('');
    const libelles = { justes: 'Réponses justes', attaques: 'Attaques envoyées', solutions: 'Solutions fournies' };
    el('#meilleurs').innerHTML = Object.entries(libelles).map(([cle, libelle]) => {
      const m = r.meilleurs[cle];
      if (!m) return `<div class="meilleur"><div><div class="quoi">${libelle}</div><div class="pseudo">—</div></div></div>`;
      const e = eq(m.equipe);
      return `<div class="meilleur">${robot({ couleur: e.couleur, symbole: e.symbole, etat: 'succes', taille: 80 })}
        <div><div class="quoi">${libelle}</div><div class="pseudo">${esc(m.pseudo)}</div><div class="equipe">${esc(e.nom)}</div></div>
        <div class="score">${m.score}</div></div>`;
    }).join('');
  }

  function afficher() {
    el('#nom-parcours').textContent = etat.parcours || '';
    el('#adresse').textContent = etat.adresse.replace(/^https?:\/\//, '');
    const vue = etat.etat === 'lobby' ? 'lobby' : etat.etat === 'terminee' ? 'fin' : 'course';
    for (const v of ['lobby', 'course', 'fin']) el(`#vue-${v}`).hidden = v !== vue;
    RR.pause = etat.etat === 'pause';
    el('#voile-pause').hidden = etat.etat !== 'pause';
    const chrono = el('#chrono');
    chrono.classList.toggle('vide', vue !== 'course');
    if (vue === 'course') chrono.innerHTML = decompte(etat.tempsRestantMs, { format: 'mmss' });
    if (vue === 'lobby') afficherLobby();
    if (vue === 'course') { majCouloirs(); majClassement(); majFil(); }
    if (vue === 'fin') afficherFin();
  }

  const socket = RR.connecter({ role: 'course' });
  socket.on('etat', (e) => { etat = e; afficher(); });
  socket.on('connect', () => { el('#hors-ligne').hidden = true; });
  socket.on('disconnect', () => { el('#hors-ligne').hidden = false; });
})();
