/* Écran projecteur /course (maquettes A1 à A4) */
'use strict';

(() => {
  const { robot, pastille, carre, icone, esc, el, decompte } = RR;
  const scene = el('#scene');
  const OPACITES = [1, 1, 0.85, 0.7, 0.55, 0.4];
  let etat = null;
  let precedent = {};   // id d'équipe → { blocage, position } : sert à déclencher les animations
  let dernierFil = null;
  let gabarit = '';

  // Mise à l'échelle de la scène (1920 de large) dans la fenêtre. Écran plus haut que le 16:9
  // (projecteur ou écran 4:3, 5:4…) : la scène s'allonge au lieu de laisser des bandes noires.
  function ajuster() {
    const hauteur = Math.min(1600, Math.max(1080, Math.round(1920 * window.innerHeight / window.innerWidth)));
    scene.style.height = `${hauteur}px`;
    const k = Math.min(window.innerWidth / 1920, window.innerHeight / hauteur);
    scene.style.transform = `translate(${(window.innerWidth - 1920 * k) / 2}px, ${(window.innerHeight - hauteur * k) / 2}px) scale(${k})`;
  }
  window.addEventListener('resize', ajuster);
  ajuster();
  el('#logo').innerHTML = robot({ couleur: '#16161D', symbole: 'etoile', taille: 60 });

  // Noms d'équipe en gras dans les messages du fil.
  function texteFil(f) {
    let t = esc(f.texte);
    for (const e of etat.equipes) t = t.replace(new RegExp(`\\b${e.nom}\\b( !)?`, 'g'), (m) => `<b>${m}</b>`);
    return t;
  }
  function iconeFil(f, taille) {
    const id = f.type === 'attaque' || f.type === 'repart' ? f.obstacle : f.solution;
    return id ? icone(id, taille) : `<span style="width:${taille}px"></span>`;
  }

  // ---------- A3 · Avant la partie ----------
  function afficherLobby() {
    const a = etat.adresse;
    el('#nb-connectes').textContent = etat.nbConnectes;
    el('#adresse-lobby').textContent = a.courte;
    el('#adresse-autres').textContent = a.sansReseau
      ? 'Aucun réseau détecté sur ce PC : branchez-le au réseau du collège.'
      : `${etat.afficherQr ? 'Ou scanne le QR code · a' : 'A'}dresse complète : ${a.complete}`;
    const n = etat.equipes.length;
    const colonnes = n <= 4 ? n : 4;
    const grille = el('#cartes-codes');
    grille.style.gridTemplateColumns = `repeat(${colonnes}, 1fr)`;
    grille.style.gridTemplateRows = `repeat(${Math.ceil(n / colonnes)}, 1fr)`;
    grille.innerHTML = etat.equipes.map((e) => `
      <div class="carte-code">
        <div class="bandeau" style="background:${e.couleur};color:${e.texte}">${robot({ couleur: e.couleur, symbole: e.symbole, taille: 64 })}<span>${esc(e.nom)}</span></div>
        <div class="corps"><div class="code">${esc(e.code)}</div>
        <div class="eleves"><b>${e.nbConnectes} élève${e.nbConnectes > 1 ? 's' : ''}${e.eleves.length ? ' ·' : ''}</b> ${e.eleves.map(esc).join(', ')}
          ${e.partis.length ? `<span class="partis">· parti${e.partis.length > 1 ? 's' : ''} : ${e.partis.map(esc).join(', ')}</span>` : ''}</div></div>
      </div>`).join('');
  }

  // ---------- A1 / A2 · Course ----------
  function tailles() {
    const n = etat.equipes.length;
    if (n === 2) return { robot: 180, icone: 52, tuile: 92, decal: 90 };
    if (n === 3) return { robot: 120, icone: 36, tuile: 66, decal: 60 };
    return { robot: 64, icone: 24, tuile: 42, decal: 36 };
  }

  function construireCouloirs() {
    const n = etat.equipes.length;
    const grand = n <= 3;
    const conteneur = el('#couloirs');
    conteneur.className = `couloirs ${grand ? 'grand' : ''} ${n === 3 ? 'trois' : ''}`;
    conteneur.innerHTML = etat.equipes.map((e) => `
      <div class="couloir" id="couloir-${e.id}">
        <div class="etiquette" style="background:${e.couleur};color:${e.texte}">
          ${pastille(e.symbole, grand ? 64 : 48)}
          <div class="textes"><span class="nom ${e.nom.length > 8 ? 'long' : ''}">${grand ? 'Équipe ' : ''}${esc(e.nom)}</span><span class="pos"></span></div>
        </div>
        <div class="piste"><div class="rail"><div class="depart"></div><div class="arrivee"></div>
          <div class="coureur"><div class="col"><div class="halo"></div><div class="stock"></div></div><div class="blocage" hidden></div></div>
        </div></div>
        <div class="chantier-bas bandes" hidden></div>
      </div>`).join('');
    gabarit = `${n}`;
    precedent = {};
  }

  // Rejoue une animation CSS puis retire la classe (pour qu'un nouvel élément ne la relance pas).
  function rejouer(noeud, classe) {
    noeud.classList.remove(classe);
    void noeud.offsetWidth;
    noeud.classList.add(classe);
    clearTimeout(noeud[`fin-${classe}`]);
    noeud[`fin-${classe}`] = setTimeout(() => noeud.classList.remove(classe), 700);
  }

  function majCouloirs() {
    if (gabarit !== `${etat.equipes.length}` || !el('#couloir-0')) construireCouloirs();
    const t = tailles();
    const L = etat.reglages.longueur;
    for (const e of etat.equipes) {
      const c = el(`#couloir-${e.id}`);
      const avant = precedent[e.id];
      c.querySelector('.rail').style.backgroundSize = `calc(100% / ${L}) 100%`;
      c.querySelector('.pos').textContent = `${e.position} / ${L}`;
      const coureur = c.querySelector('.coureur');
      coureur.style.left = `${(e.position / L) * 100}%`;
      coureur.style.transform = `translate(-${t.decal}px, -50%)`;

      const etatRobot = e.blocage ? 'bloque' : e.succesRestantMs > 0 ? 'succes' : 'normal';
      const halo = c.querySelector('.halo');
      if (halo.dataset.etat !== etatRobot) {
        halo.innerHTML = robot({ couleur: e.couleur, symbole: e.symbole, etat: etatRobot, taille: t.robot });
        halo.dataset.etat = etatRobot;
      }
      halo.classList.toggle('protege', e.protegeRestantMs > 0);
      if (e.protegeRestantMs > 0) setTimeout(() => halo.classList.remove('protege'), e.protegeRestantMs);
      if (e.succesRestantMs > 0) setTimeout(() => { if (etat && etat.etat !== 'lobby') majCouloirs(); }, e.succesRestantMs + 50);

      // Stock sous le robot : seulement les solutions présentes.
      const stock = Object.entries(e.stock).filter(([, q]) => q > 0)
        .map(([id, q]) => `<div class="puce">${icone(id, t.icone)}<span>${q}</span></div>`).join('');
      const s = c.querySelector('.stock');
      if (s.innerHTML !== stock) s.innerHTML = stock;

      // Blocage : tuile obstacle devant le robot + compte à rebours.
      const b = c.querySelector('.blocage');
      c.querySelector('.chantier-bas').hidden = !e.blocage;
      if (e.blocage) {
        b.hidden = false;
        // On ne reconstruit la tuile que si l'obstacle change (sinon l'animation de chute recommencerait).
        if (b.dataset.obstacle !== e.blocage.obstacle) {
          b.dataset.obstacle = e.blocage.obstacle;
          b.innerHTML = `<div class="tuile">${icone(e.blocage.obstacle, t.tuile)}</div>${e.blocage.restantMs === null
            ? `<span class="attend-solution" title="Bloquée jusqu'à la solution">${icone(e.blocage.solution, t.icone)}</span>`
            : decompte(e.blocage.restantMs, { suffixe: ' s', classe: 'compte' })}`;
        } else if (e.blocage.restantMs !== null) {
          b.querySelector('.compte').dataset.fin = RR.fin(e.blocage.restantMs);
        }
        if (!avant || !avant.blocage) { rejouer(coureur, 'tombe'); rejouer(coureur, 'secousse'); }
      } else if (!b.hidden) {
        b.hidden = true;
        b.innerHTML = '';
        delete b.dataset.obstacle;
        if (avant && avant.blocage) rejouer(coureur, 'saute');
      }
      if (avant && e.position > avant.position) setTimeout(() => rejouer(coureur, 'rebond'), 450);
      precedent[e.id] = { blocage: e.blocage, position: e.position };
    }
  }

  // Solution qui sort du stock et se pose sur l'obstacle (parade ou déblocage).
  function animerSolutions(nouvelles) {
    const t = tailles();
    for (const f of nouvelles) {
      if (!['parade', 'debloque'].includes(f.type) || !f.solution) continue;
      const c = el(`#couloir-${f.equipe}`);
      if (!c) continue;
      const pop = document.createElement('div');
      pop.className = 'pop';
      pop.innerHTML = icone(f.solution, Math.round(t.robot * 0.6));
      c.querySelector('.col').appendChild(pop);
      setTimeout(() => pop.remove(), 600);
    }
  }

  function majClassement() {
    el('#carte-classement').hidden = etat.equipes.length <= 3;
    const tri = etat.equipes.slice().sort((a, b) => b.position - a.position);
    el('#classement').innerHTML = tri.map((e, i) => `
      <div class="ligne-classement"><span class="rang">${i + 1}</span>${carre(e, 32)}<b>${esc(e.nom)}</b><span class="pos">${e.position}</span></div>`).join('');
  }

  function majFil() {
    const grand = etat.equipes.length <= 3;
    const fil = etat.fil.filter((f) => f.type !== 'depart').slice(0, grand ? 5 : 6);
    const haut = etat.fil.length ? etat.fil[0].id : 0;
    if (haut === dernierFil && el('#fil').childElementCount) return; // rien de nouveau
    const nouvelles = dernierFil === null ? [] : fil.filter((f) => f.id > dernierFil);
    el('#fil').innerHTML = fil.map((f, i) => `<div class="ligne-fil ${f.id > (dernierFil ?? Infinity) ? 'nouveau' : ''}" style="opacity:${OPACITES[i]}">
      ${iconeFil(f, grand ? 52 : 40)}<span>${texteFil(f)}</span></div>`).join('');
    animerSolutions(nouvelles);
    dernierFil = etat.fil.length ? etat.fil[0].id : 0;
  }

  // ---------- A4 · Fin ----------
  // Bouton du son (coin de l'écran) : activer ou couper la fanfare ; le clic autorise aussi le son.
  const boutonSon = el('#bouton-son');
  function majBoutonSon() {
    const actif = RR.son.actif();
    boutonSon.textContent = actif ? (RR.son.pret() ? 'Son activé' : 'Cliquer pour activer le son') : 'Son coupé';
    boutonSon.classList.toggle('coupe', !actif);
    boutonSon.classList.toggle('a-activer', actif && !RR.son.pret());
  }
  boutonSon.addEventListener('click', () => {
    // Premier clic : il active le son (le navigateur l'autorise grâce à ce clic), sans le couper aussitôt.
    if (!boutonSon.classList.contains('a-activer')) RR.son.basculer();
    setTimeout(majBoutonSon, 100);
  });
  window.addEventListener('pointerdown', () => setTimeout(majBoutonSon, 100));
  majBoutonSon();

  function afficherFin() {
    const r = etat.resultat;
    const L = etat.reglages.longueur;
    const eq = (id) => etat.equipes[id];
    const premiers = r.classement.filter((c) => c.rang === 1);
    el('#fin-sous').textContent = r.raison === 'arrivee' ? `Arrivée en ${RR.format(r.dureeMs)}` : r.raison === 'temps' ? 'Fin du temps' : `Course arrêtée après ${RR.format(r.dureeMs)}`;
    el('#fin-titre').textContent = premiers.length === 1 ? `L'équipe ${eq(premiers[0].equipe).nom} gagne !` : 'Égalité en tête !';
    const top3 = r.classement.slice(0, 3);
    const ordre = [[top3[1], 1], [top3[0], 0], [top3[2], 2]];
    const robots = [180, 140, 120];
    const hauteurs = [360, 260, 190];
    const delais = [900, 450, 0]; // les marches montent dans l'ordre 3e, 2e, 1re
    el('#podium').innerHTML = ordre.map(([c, place]) => {
      if (!c) return '<div></div>';
      const e = eq(c.equipe);
      const pos = c.position >= L ? 'arrivée' : `${c.position} / ${L}`;
      return `<div class="marche-bloc">${robot({ couleur: e.couleur, symbole: e.symbole, etat: 'succes', taille: robots[place] })}
        <span class="nom">${esc(e.nom)}</span>
        <div class="marche" style="height:${hauteurs[place]}px;background:${e.couleur};color:${e.texte};animation-delay:${delais[place]}ms">
        <span class="rang">${c.rang}</span><span class="pos">${pos}</span></div></div>`;
    }).join('');
    const suite = r.classement.slice(3);
    el('#suivants').hidden = suite.length === 0;
    el('#suivants').innerHTML = suite.map((c) => {
      const e = eq(c.equipe);
      return `<div><b>${c.rang}</b>${carre(e, 28)}<span>${esc(e.nom)} · ${c.position} / ${L}</span></div>`;
    }).join('');
    const libelles = { justes: 'Réponses justes', attaques: 'Attaques envoyées', solutions: 'Solutions fournies' };
    el('#meilleurs').innerHTML = Object.entries(libelles).map(([cle, libelle]) => {
      const m = r.meilleurs[cle];
      if (!m) {
        return `<div class="meilleur">${robot({ couleur: '#DDD6C8', symbole: 'etoile', taille: 80 })}
          <div class="infos"><span class="quoi">${libelle}</span><span class="pseudo">—</span></div><span class="score">0</span></div>`;
      }
      const e = eq(m.equipe);
      return `<div class="meilleur">${robot({ couleur: e.couleur, symbole: e.symbole, etat: 'succes', taille: 80 })}
        <div class="infos"><span class="quoi">${libelle}</span><span class="pseudo">${esc(m.pseudo)}</span><span class="equipe">équipe ${esc(e.nom)}</span></div>
        <span class="score">${m.score}</span></div>`;
    }).join('');
  }

  let derniereVue = '';
  function afficher() {
    const a = etat.adresse;
    el('#nom-parcours').textContent = etat.parcours || '';
    el('#adresse').textContent = a.complete.replace(/^https?:\/\//, '');
    const vue = etat.etat === 'lobby' ? 'lobby' : etat.etat === 'terminee' ? 'fin' : 'course';
    for (const v of ['lobby', 'course', 'fin']) el(`#vue-${v}`).hidden = v !== vue;
    el('#barre').className = `barre ${vue}`;
    RR.pause = etat.etat === 'pause';
    el('#voile-pause').hidden = etat.etat !== 'pause';
    const chrono = el('#chrono');
    chrono.classList.toggle('vide', vue !== 'course');
    if (vue === 'course') chrono.innerHTML = decompte(etat.tempsRestantMs, { format: 'mmss' });
    document.body.classList.toggle('sans-qr', !etat.afficherQr);
    // Le QR code suit l'adresse (changement de réseau) : on le recharge si elle change.
    if (afficher.adresseQr !== a.complete) {
      afficher.adresseQr = a.complete;
      for (const img of document.querySelectorAll('.qr-petit, .qr-grand')) img.src = `/qr.svg?${encodeURIComponent(a.complete)}`;
    }
    if (vue === 'lobby') afficherLobby();
    if (vue === 'course') { majCouloirs(); majClassement(); majFil(); }
    if (vue === 'fin' && derniereVue !== 'fin') {
      afficherFin();
      // Fanfare seulement si on a vu la course finir (pas en rouvrant la page sur un podium).
      if (derniereVue === 'course') RR.son.victoire();
    }
    if (vue !== 'course') dernierFil = null;
    derniereVue = vue;
  }

  const socket = RR.connecter({ role: 'course' });
  socket.on('etat', (e) => { etat = e; afficher(); });
  socket.on('connect', () => { el('#hors-ligne').hidden = true; });
  socket.on('disconnect', () => { el('#hors-ligne').hidden = false; });
})();
