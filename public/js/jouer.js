/* Écran élève /jouer */
'use strict';

(() => {
  const { robot, pastille, icone, esc, el, decompte } = RR;
  const CLE_JETON = 'robotrush.jeton';
  const ALPHABET = /[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]/;
  const FORMES = {
    A: '<path d="M28 6L52 48H4Z"/>',
    B: '<path d="M28 4L52 28L28 52L4 28Z"/>',
    C: '<circle cx="28" cy="28" r="23"/>',
    D: '<rect x="6" y="6" width="44" height="44" rx="3"/>',
  };
  const LETTRES = ['A', 'B', 'C', 'D'];
  const TYPES = { qcm: 'QCM', ordre: 'Remise en ordre', calcul: 'Calcul', blocs: 'Blocs', completer: 'À compléter' };

  const stockage = {
    lire() { try { return localStorage.getItem(CLE_JETON); } catch { return null; } },
    ecrire(v) { try { if (v) localStorage.setItem(CLE_JETON, v); else localStorage.removeItem(CLE_JETON); } catch { /* navigation privée */ } },
  };

  let etat = null;        // état public de la course
  let moi;                // état personnel (null = pas encore dans une équipe)
  let cleZone = null;     // évite de reconstruire la zone de question à chaque mise à jour
  let alerte = null;      // { type, texte, jusqua }
  let obstacleChoisi = null;
  let messageConnexion = '';

  const socket = RR.connecter({ role: 'eleve', jeton: stockage.lire() });

  // ---------- Utilitaires ----------
  const monEquipe = () => (etat && moi ? etat.equipes[moi.equipeId] : null);
  const paire = (id) => etat.paires.find((p) => p.obstacle.id === id || p.solution.id === id);
  function envoyer(evenement, donnees) {
    return new Promise((resolve) => socket.emit(evenement, donnees, (r) => resolve(r || { ok: false, erreur: 'Pas de réponse du serveur.' })));
  }
  function messageZone(texte) { const m = el('#message-zone'); if (m) m.textContent = texte || ''; }

  // ---------- B1 · Connexion ----------
  const cases = [...document.querySelectorAll('.case')];
  function codeSaisi() { return cases.map((c) => c.value).join(''); }
  async function verifierCode() {
    const conf = el('#confirmation');
    const code = codeSaisi();
    if (code.length < 4) { conf.hidden = true; return; }
    const r = await envoyer('verifierCode', { code });
    conf.hidden = false;
    if (r.equipe) {
      const e = r.equipe;
      conf.className = 'confirmation';
      conf.style.background = e.couleur; conf.style.color = e.texte;
      conf.innerHTML = `${pastille(e.symbole, 32)} Tu rejoins l'équipe ${esc(e.nom)} · ${e.nbEleves} coéquipier${e.nbEleves > 1 ? 's' : ''}`;
    } else {
      conf.className = 'confirmation inconnu'; conf.style.background = ''; conf.style.color = '';
      conf.textContent = 'Code inconnu : vérifie les 4 caractères au tableau.';
    }
  }
  cases.forEach((c, i) => {
    c.addEventListener('input', () => {
      const v = c.value.toUpperCase().split('').filter((x) => ALPHABET.test(x));
      c.value = v[0] || '';
      // Collage de plusieurs caractères : on répartit sur les cases suivantes.
      for (let k = 1; k < v.length && i + k < cases.length; k++) cases[i + k].value = v[k];
      const suivante = cases.find((x) => !x.value);
      if (c.value) (suivante || el('#pseudo')).focus();
      verifierCode();
    });
    c.addEventListener('keydown', (ev) => {
      if (ev.key === 'Backspace' && !c.value && i > 0) { cases[i - 1].value = ''; cases[i - 1].focus(); ev.preventDefault(); verifierCode(); }
    });
  });
  el('#form-connexion').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const bouton = ev.submitter || el('.bouton-rejoindre');
    bouton.disabled = true;
    const r = await envoyer('rejoindre', { code: codeSaisi(), pseudo: el('#pseudo').value });
    bouton.disabled = false;
    if (!r.ok) { el('#erreur-connexion').textContent = r.erreur; return; }
    stockage.ecrire(r.jeton);
    socket.auth.jeton = r.jeton;
  });

  // ---------- Bandeau d'état ----------
  function rendreBandeau() {
    const e = monEquipe();
    if (!e) return;
    document.body.style.setProperty('--equipe', e.couleur);
    const now = performance.now();
    const a = alerte && alerte.jusqua > now ? alerte : null;
    let corps;
    if (a && a.type === 'attaque') {
      corps = `<div class="etat-equipe etat-message">${icone(a.obstacle, 40)}<span><span class="grand">Attaque !</span>${esc(a.texte)}</span></div>`;
    } else if (a && a.type !== 'attaque' && !e.blocage) {
      const ic = a.solution ? icone(a.solution, 40) : '';
      const titre = a.type === 'parade' ? 'Paré !' : a.type === 'debloque' ? "C'est reparti !" : '';
      corps = `<div class="etat-equipe etat-message">${ic}<span>${titre ? `<span class="grand">${titre}</span>` : ''}${esc(a.texte.replace(/^(Paré ! |C'est reparti ! )/, ''))}</span></div>`;
    } else if (e.blocage) {
      const p = paire(e.blocage.obstacle);
      corps = `<div class="etat-equipe etat-bloque"><div class="encart-bloque">${icone(p.obstacle.id, 32)}
        <div><div class="l1">Bloquée par ${esc(p.obstacle.un.replace(p.obstacle.nom, p.obstacle.nom.toUpperCase()))}</div>
        <div class="l2">Prenez ${esc(p.solution.un.replace(p.solution.nom, p.solution.nom.toUpperCase()))} !</div></div>
        ${decompte(e.blocage.restantMs, { suffixe: ' s', classe: 'compte' })}</div></div>`;
    } else {
      corps = `<div class="etat-equipe etat-libre"><span class="coche">✓</span><span class="mot">Libre</span>
        <span class="pos">${e.position} / ${etat.reglages.longueur}</span></div>`;
    }
    el('#bloc-equipe').innerHTML = `<div class="entete-equipe" style="background:${e.couleur};color:${e.texte}">
      ${robot({ couleur: e.couleur, symbole: e.symbole, etat: e.blocage ? 'bloque' : 'normal', taille: 34 })}
      <span class="nom">Équipe ${esc(e.nom)}</span><span class="pseudo">${esc(moi.pseudo)}</span></div>${corps}`;

    // Mini-piste
    const L = etat.reglages.longueur;
    el('#mini-piste').innerHTML = etat.equipes.slice().sort((x, y) => y.position - x.position).map((x) => {
      const soi = x.id === e.id;
      const pct = (x.position / L) * 100;
      return `<li class="${soi ? 'moi' : ''}" style="${soi ? `background:${x.clair}` : ''}">
        <span>${soi ? 'Toi' : esc(x.nom)}</span>
        <span class="mini-rail"><span class="mini-pion" style="left:${pct}%;background:${x.couleur}">${pastille(x.symbole, 12, 'transparent')}</span>
        ${x.blocage ? `<span class="etiquette-bloquee" style="left:${pct}%">bloquée</span>` : ''}</span></li>`;
    }).join('');

    // Stock
    el('#stock').innerHTML = etat.paires.map((p) => {
      const n = e.stock[p.solution.id] || 0;
      return `<div class="case-stock ${n ? '' : 'vide'}" title="${esc(p.solution.nom)}">${icone(p.solution.id, 32)}<span class="n">${n}</span><span class="max">/${etat.reglages.stockMax}</span></div>`;
    }).join('');

    // Dernières actions (personnalisées quand elles concernent mon équipe)
    el('#fil').innerHTML = etat.fil.filter((f) => f.type !== 'depart').slice(0, 3).map((f) => {
      let texte = esc(f.texte);
      if (f.type === 'attaque' && f.cible === e.id) texte = `<b>${esc(etat.equipes[f.equipe].nom)}</b> vous envoie ${esc(paire(f.obstacle).obstacle.un)}`;
      const id = f.type === 'attaque' || f.type === 'repart' ? f.obstacle : f.solution;
      return `<li>${id ? icone(id, 22) : ''}<span>${texte}</span></li>`;
    }).join('') || '<li>—</li>';
  }

  function flash(type) {
    const b = el('#bandeau');
    b.classList.remove('flash-attaque', 'flash-parade');
    b.style.background = '';
    void b.offsetWidth;
    if (type === 'attaque') b.classList.add('flash-attaque');
    else if (type === 'parade') b.classList.add('flash-parade');
    else if (type === 'debloque') b.style.background = monEquipe().couleur;
    setTimeout(() => { b.classList.remove('flash-attaque', 'flash-parade'); b.style.background = ''; }, 600);
  }

  // ---------- Zone principale ----------
  function cleCourante() {
    if (!moi) return 'aucun';
    const q = moi.question;
    return [moi.phase, etat.etat === 'lobby' ? 'lobby' : '', q ? `${q.id}#${q.numero}` : '', JSON.stringify(moi.tirage), moi.retour && moi.retour.correct].join('|');
  }

  function rendreZone() {
    const cle = cleCourante();
    if (cle !== cleZone) {
      cleZone = cle;
      obstacleChoisi = null;
      const zone = el('#zone');
      const rendus = { question: zoneQuestion, action: zoneAction, solution: zoneSolution, attaque: zoneAttaque, erreur: zoneErreur, fin: zoneFin };
      zone.innerHTML = (rendus[moi.phase] || zoneAttente)();
      RR.majDecomptes();
    }
    if (moi.phase === 'action') majOptions();
    if (moi.phase === 'attaque' && obstacleChoisi) rendreCibles();
  }

  function zoneAttente() {
    const e = monEquipe();
    const texte = etat.etat === 'lobby' ? 'En attente du départ de la course…' : etat.etat === 'terminee' ? 'Course terminée.' : 'Une question arrive…';
    return `<div class="carte-centre">${robot({ couleur: e.couleur, symbole: e.symbole, taille: 120 })}
      <h2>Équipe ${esc(e.nom)}</h2><p style="font-size:24px;margin:0">${texte}</p>
      <p style="font-size:18px;color:var(--encre-2)">Regarde le tableau : le professeur va lancer la course.</p></div>`;
  }

  function zoneQuestion() {
    const q = moi.question;
    let corps = '';
    if (q.type === 'qcm') {
      corps = `<div class="grille-qcm">${q.choix.map((c, i) => `
        <button class="bouton-jeu rep rep-${LETTRES[i]}" data-rep="${i}" aria-label="Réponse ${LETTRES[i]} : ${esc(c)}">
          <svg class="forme" width="56" height="56" viewBox="0 0 56 56" fill="currentColor" stroke="#16161D" stroke-width="3">${FORMES[LETTRES[i]]}</svg>
          <span>${esc(c)}</span></button>`).join('')}</div>`;
    } else {
      corps = '<p>Ce type de question arrive à l\'étape 3.</p>';
    }
    return `<div class="entete-q"><span class="puce-type">${TYPES[q.type] || q.type}</span><span class="numero-q">Question ${q.numero}</span>
      <div class="barre-temps"><div id="barre-q" style="transform:scaleX(${q.restantMs / q.dureeMs})"></div></div>
      <span class="secondes" data-fin="${RR.fin(q.restantMs)}" data-suffixe=" s" data-barre="${q.dureeMs}" data-cible="barre-q">${Math.ceil(q.restantMs / 1000)} s</span></div>
      <div class="enonce">${esc(q.enonce)}</div>
      ${q.image ? `<img class="image-q" src="${esc(q.image)}" alt="">` : ''}
      ${corps}<div class="message-zone" id="message-zone"></div>`;
  }

  async function repondre(reponse) {
    document.querySelectorAll('.rep').forEach((b) => { b.disabled = true; });
    const r = await envoyer('repondre', { questionId: moi.question.id, reponse });
    if (!r.ok) { messageZone(r.erreur); document.querySelectorAll('.rep').forEach((b) => { b.disabled = false; }); }
  }

  function optionsLocales() {
    const e = monEquipe();
    return {
      avancer: !e.blocage,
      solution: etat.paires.some((p) => (e.stock[p.solution.id] || 0) < etat.reglages.stockMax),
      attaque: etat.equipes.some((x) => x.id !== e.id && !x.blocage && x.protegeRestantMs <= 0),
    };
  }

  function zoneAction() {
    const e = monEquipe();
    const solutions = etat.paires.slice(0, 2).map((p) => icone(p.solution.id, 64)).join('');
    const obstacles = etat.paires.slice(0, 2).map((p) => icone(p.obstacle.id, 64)).join('');
    return `<div class="tete-action">${robot({ couleur: e.couleur, symbole: e.symbole, etat: 'succes', taille: 96 })}
      <div><h2>Bonne réponse !</h2>${moi.retour && moi.retour.explication ? `<p class="explication">${esc(moi.retour.explication)}</p>` : ''}</div>
      <div class="cercle-decompte"><div class="cercle">${decompte(moi.restantMs)}</div><span id="defaut-texte">puis « Avancer »</span></div></div>
      <div class="cartes-action">
        <button class="bouton-jeu carte-action carte-avancer" data-action="avancer">
          <svg width="88" height="88" viewBox="0 0 88 88"><path d="M10 36H52V16L80 44L52 72V52H10Z" fill="#fff" stroke="#fff" stroke-width="2" stroke-linejoin="round"/></svg>
          <h3>Avancer</h3><p>+${etat.reglages.gainAvancer} cases</p><span class="motif"></span><span class="touche">Touche 1</span></button>
        <button class="bouton-jeu carte-action carte-solution" data-action="solution">
          <div class="icones">${solutions}</div><h3>Solution</h3><p>pour le stock de l'équipe</p><span class="motif"></span><span class="touche">Touche 2</span></button>
        <button class="bouton-jeu carte-action carte-attaque" data-action="attaque">
          <div class="icones">${obstacles}</div><h3>Attaquer</h3><p>une autre équipe</p><span class="motif"></span><span class="touche">Touche 3</span></button>
      </div><div class="message-zone" id="message-zone"></div>`;
  }

  function majOptions() {
    const o = optionsLocales();
    const motifs = { avancer: 'Robot bloqué', solution: 'Stock plein', attaque: 'Aucune cible possible' };
    for (const action of ['avancer', 'solution', 'attaque']) {
      const b = el(`[data-action="${action}"]`);
      if (!b) continue;
      b.disabled = !o[action];
      b.querySelector('.motif').textContent = o[action] ? '' : motifs[action];
    }
    const av = el('[data-action="avancer"]');
    if (av) av.classList.toggle('defaut', o.avancer);
    const d = el('#defaut-texte');
    if (d) d.textContent = o.avancer ? 'puis « Avancer »' : o.solution ? 'puis une solution' : '';
  }

  async function choisirAction(action) {
    const b = el(`[data-action="${action}"]`);
    if (!b || b.disabled) return;
    const r = await envoyer('action', { action });
    if (!r.ok) messageZone(r.erreur);
  }

  function zoneSolution() {
    const e = monEquipe();
    const max = etat.reglages.stockMax;
    return `<div class="tete-action"><div><h2>Choisis une solution</h2><p class="explication">Elle va dans le stock de l'équipe.</p></div>
      <div class="cercle-decompte"><div class="cercle">${decompte(moi.restantMs)}</div></div></div>
      <div class="cartes-tirage">${moi.tirage.solutions.map((id, i) => {
        const p = paire(id);
        const n = e.stock[id] || 0;
        const debloque = e.blocage && e.blocage.obstacle === p.obstacle.id;
        return `<button class="bouton-jeu carte-tirage" data-solution="${esc(id)}">${icone(id, 140)}
          <span class="nom">${esc(p.solution.nom[0].toUpperCase() + p.solution.nom.slice(1))}</span>
          <span class="info">${debloque ? '<b>Débloque votre robot !</b>' : `contre ${esc(p.obstacle.le)} · stock ${n} → ${Math.min(max, n + 1)}${n + 1 >= max ? ' (plein)' : ''}`}</span>
          <span class="touche">Touche ${i + 1}</span></button>`;
      }).join('')}</div><div class="message-zone" id="message-zone"></div>`;
  }

  async function choisirSolution(id) {
    const r = await envoyer('solution', { solution: id });
    if (!r.ok) messageZone(r.erreur);
  }

  function zoneAttaque() {
    return `<div class="tete-action"><div><h2>Attaquer</h2><p class="explication">Choisis un obstacle${etat.equipes.length > 2 ? ', puis l\'équipe visée' : ''}.</p></div>
      <div class="cercle-decompte"><div class="cercle">${decompte(moi.restantMs)}</div></div></div>
      <div class="cartes-tirage" style="max-height:240px">${moi.tirage.obstacles.map((id, i) => {
        const p = paire(id);
        return `<button class="bouton-jeu carte-tirage obstacle" data-obstacle="${esc(id)}">${icone(id, 110)}
          <span class="nom">${esc(p.obstacle.nom[0].toUpperCase() + p.obstacle.nom.slice(1))}</span><span class="touche">Touche ${i + 1}</span></button>`;
      }).join('')}</div>
      <div id="cibles-zone"></div><div class="message-zone" id="message-zone"></div>`;
  }

  function rendreCibles() {
    const e = monEquipe();
    const p = paire(obstacleChoisi);
    document.querySelectorAll('[data-obstacle]').forEach((b) => b.classList.toggle('choisi', b.dataset.obstacle === obstacleChoisi));
    el('#cibles-zone').innerHTML = `<div class="titre-cibles">Envoyer ${esc(p.obstacle.le)} à…</div><div class="cibles">${etat.equipes.filter((x) => x.id !== e.id).map((x) => {
      const indispo = x.blocage ? 'déjà bloquée' : x.protegeRestantMs > 0 ? 'protégée' : '';
      return `<button class="bouton-jeu cible" data-cible="${x.id}" ${indispo ? 'disabled' : ''} style="background:${x.couleur};color:${x.texte}">
        ${robot({ couleur: x.couleur, symbole: x.symbole, etat: x.blocage ? 'bloque' : 'normal', taille: 64 })}
        <span><span class="nom">${esc(x.nom)}</span><br><span class="info">${indispo || `case ${x.position}`}</span></span></button>`;
    }).join('')}</div>`;
  }

  async function choisirObstacle(id) {
    obstacleChoisi = id;
    if (etat.equipes.length === 2) { await attaquer(null); return; }
    rendreCibles();
  }

  async function attaquer(cible) {
    const r = await envoyer('attaquer', { obstacle: obstacleChoisi, cible });
    if (!r.ok) messageZone(r.erreur);
  }

  function zoneErreur() {
    const e = monEquipe();
    const r = moi.retour || {};
    return `<div class="carte-centre">${robot({ couleur: e.couleur, symbole: e.symbole, etat: 'bloque', taille: 150 })}
      <h2>${r.tempsDepasse ? 'Temps écoulé !' : 'Pas cette fois.'}</h2>
      <div class="reponses">
        ${r.tempsDepasse ? '' : `<div><span class="label">Ta réponse</span>${esc(r.donnee ?? '—')}</div>`}
        <div class="bonne"><span class="label">Bonne réponse</span>${esc(r.bonne)}</div></div>
      ${r.explication ? `<p style="font-size:20px;margin:0">${esc(r.explication)}</p>` : ''}
      <div class="barre-3s"><div style="animation-duration:${moi.restantMs}ms"></div></div>
      <p style="margin:0">Nouvelle question dans ${decompte(moi.restantMs, { suffixe: ' s' })}</p></div>`;
  }

  function zoneFin() {
    const r = etat.resultat;
    if (!r) return zoneAttente();
    const e = monEquipe();
    const ligne = r.classement.find((c) => c.equipe === e.id);
    const premiers = r.classement.filter((c) => c.rang === 1);
    const titre = premiers.length === 1 ? `L'équipe ${etat.equipes[premiers[0].equipe].nom} gagne !` : 'Égalité en tête !';
    return `<div class="carte-centre">${robot({ couleur: e.couleur, symbole: e.symbole, etat: ligne.rang === 1 ? 'succes' : 'normal', taille: 140 })}
      <h2>${esc(titre)}</h2>
      <p style="font-size:26px;margin:0">Ton équipe termine <b>${ligne.rang === 1 ? '1re' : `${ligne.rang}e`}</b> (${ligne.position} cases).</p>
      <p style="font-size:20px;margin:0">Toi : ${moi.stats.justes} réponse${moi.stats.justes > 1 ? 's' : ''} juste${moi.stats.justes > 1 ? 's' : ''} ·
        ${moi.stats.attaques} attaque${moi.stats.attaques > 1 ? 's' : ''} · ${moi.stats.solutions} solution${moi.stats.solutions > 1 ? 's' : ''}</p></div>`;
  }

  // Clics (délégation) et clavier
  el('#zone').addEventListener('click', (ev) => {
    const b = ev.target.closest('button');
    if (!b || b.disabled) return;
    if (b.dataset.rep !== undefined) repondre(Number(b.dataset.rep));
    else if (b.dataset.action) choisirAction(b.dataset.action);
    else if (b.dataset.solution) choisirSolution(b.dataset.solution);
    else if (b.dataset.obstacle) choisirObstacle(b.dataset.obstacle);
    else if (b.dataset.cible) attaquer(Number(b.dataset.cible));
  });
  document.addEventListener('keydown', (ev) => {
    if (!moi || ev.target.tagName === 'INPUT' || ev.repeat) return;
    const n = Number(ev.key);
    if (!Number.isInteger(n) || n < 1) return;
    const cibles = {
      question: '[data-rep]', action: '[data-action]', solution: '[data-solution]',
      attaque: obstacleChoisi ? '[data-cible]' : '[data-obstacle]',
    }[moi.phase];
    if (!cibles) return;
    const b = document.querySelectorAll(cibles)[n - 1];
    if (b && !b.disabled) b.click();
  });

  // ---------- Affichage général ----------
  function afficher() {
    if (moi === undefined || !etat) return;
    const connecte = Boolean(moi);
    el('#ecran-connexion').hidden = connecte;
    el('#ecran-jeu').hidden = !connecte;
    RR.pause = etat.etat === 'pause';
    el('#voile-pause').hidden = !(connecte && etat.etat === 'pause');
    if (!connecte) { el('#erreur-connexion').textContent = messageConnexion; return; }
    rendreBandeau();
    rendreZone();
  }

  socket.on('etat', (e) => { etat = e; afficher(); });
  socket.on('moi', (m) => {
    if (m === null && stockage.lire()) { stockage.ecrire(null); socket.auth.jeton = null; }
    moi = m;
    afficher();
    if (!m) setTimeout(() => cases[0].focus(), 0);
  });
  socket.on('alerte', (a) => {
    alerte = { ...a, jusqua: performance.now() + 4000 };
    flash(a.type);
    afficher();
    setTimeout(afficher, 4050);
  });
  socket.on('retire', ({ motif }) => {
    stockage.ecrire(null);
    socket.auth.jeton = null;
    messageConnexion = motif;
    moi = null; cleZone = null;
    afficher();
  });
  socket.on('connect', () => { el('#hors-ligne').hidden = true; });
  socket.on('disconnect', () => { el('#hors-ligne').hidden = false; });
})();
