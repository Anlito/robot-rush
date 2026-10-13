/* Écran élève /jouer (maquettes B1 à B11) */
'use strict';

(() => {
  const { robot, pastille, pion, coche, majuscule, icone, esc, el, decompte } = RR;
  const CLE_JETON = 'robotrush.jeton';
  const ALPHABET = /[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]/;
  const TYPES = { qcm: 'QCM', ordre: 'Remise en ordre', calcul: 'Calcul', blocs: 'Blocs à assembler', completer: 'Programme à compléter' };
  const DUREE_FLASH = 600;
  const DUREE_MESSAGE = 4000;

  const stockage = {
    lire() { try { return localStorage.getItem(CLE_JETON); } catch { return null; } },
    ecrire(v) { try { if (v) localStorage.setItem(CLE_JETON, v); else localStorage.removeItem(CLE_JETON); } catch { /* navigation privée */ } },
  };

  let etat = null;        // état public de la course
  let moi;                // état personnel (null = pas encore dans une équipe)
  let cleZone = null;     // évite de reconstruire la zone à chaque mise à jour
  let alerte = null;      // { type, texte, obstacle, solution, jusqua }
  let obstacleChoisi = null;
  let messageConnexion = '';

  const socket = RR.connecter({ role: 'eleve', jeton: stockage.lire() });

  // ---------- Utilitaires ----------
  const monEquipe = () => (etat && moi ? etat.equipes[moi.equipeId] : null);
  const paire = (id) => etat.paires.find((p) => p.obstacle.id === id || p.solution.id === id);
  const pluriel = (n, mot) => `${n} ${mot}${n > 1 ? 's' : ''}`;
  function envoyer(evenement, donnees) {
    return new Promise((resolve) => socket.emit(evenement, donnees, (r) => resolve(r || { ok: false, erreur: 'Pas de réponse du serveur.' })));
  }
  function messageZone(texte) { const m = el('#message-zone'); if (m) m.textContent = texte || ''; }
  function rang(e) { return etat.equipes.filter((x) => x.position > e.position).length + 1; }
  const ordinal = (n) => (n === 1 ? '1re' : `${n}e`);

  // ---------- B1 · Connexion ----------
  el('#robot-connexion').innerHTML = robot({ couleur: '#2563EB', symbole: 'triangle', etat: 'succes', taille: 64 });
  const cases = [...document.querySelectorAll('.case')];
  const codeSaisi = () => cases.map((c) => c.value).join('');
  async function verifierCode() {
    const conf = el('#confirmation');
    const code = codeSaisi();
    if (code.length < 4) { conf.hidden = true; return; }
    const r = await envoyer('verifierCode', { code });
    if (code !== codeSaisi()) return; // saisie modifiée entre-temps
    conf.hidden = false;
    if (r.equipe) {
      const e = r.equipe;
      conf.className = 'confirmation';
      conf.style.background = e.clair; conf.style.borderColor = e.couleur;
      conf.innerHTML = `${coche(22)}<span>Tu rejoins l'<b>équipe ${esc(e.nom)}</b></span>${pastille(e.symbole, 22)}<span>· ${pluriel(e.nbEleves, 'coéquipier')}</span>`;
    } else {
      conf.className = 'confirmation inconnu'; conf.style.background = ''; conf.style.borderColor = '';
      conf.textContent = 'Code inconnu : vérifie les 4 caractères au tableau.';
    }
  }
  cases.forEach((c, i) => {
    c.addEventListener('input', () => {
      const v = c.value.toUpperCase().split('').filter((x) => ALPHABET.test(x));
      c.value = v[0] || '';
      // Collage de plusieurs caractères : on remplit les cases suivantes.
      for (let k = 1; k < v.length && i + k < cases.length; k++) cases[i + k].value = v[k];
      const suivante = cases.find((x) => !x.value);
      if (c.value) (suivante || el('#pseudo')).focus();
      verifierCode();
    });
    c.addEventListener('keydown', (ev) => {
      if (ev.key === 'Backspace' && !c.value && i > 0) { cases[i - 1].value = ''; cases[i - 1].focus(); ev.preventDefault(); verifierCode(); }
      if (ev.key === 'ArrowLeft' && i > 0) cases[i - 1].focus();
      if (ev.key === 'ArrowRight' && i < 3) cases[i + 1].focus();
    });
    c.addEventListener('focus', () => c.select());
  });
  el('#form-connexion').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const bouton = el('.bouton-rejoindre');
    const erreur = el('#erreur-connexion');
    if (codeSaisi().length < 4) { erreur.hidden = false; erreur.textContent = 'Tape les 4 caractères du code de ton équipe.'; cases.find((x) => !x.value).focus(); return; }
    bouton.disabled = true;
    const r = await envoyer('rejoindre', { code: codeSaisi(), pseudo: el('#pseudo').value });
    bouton.disabled = false;
    if (!r.ok) { erreur.hidden = false; erreur.textContent = r.erreur; return; }
    erreur.hidden = true;
    stockage.ecrire(r.jeton);
    socket.auth.jeton = r.jeton;
  });

  // ---------- Bandeau d'état ----------
  function blocEtat(e) {
    const now = performance.now();
    const a = alerte && alerte.jusqua > now ? alerte : null;
    if (a && a.type === 'attaque') {
      return `<div class="etat etat-attaque"><span class="ico">${icone(a.obstacle, 32)}</span>
        <div class="lignes"><span class="grand">Attaque !</span><span class="petit">${esc(a.texte)}</span></div></div>`;
    }
    if (a && a.type === 'parade') {
      return `<div class="etat etat-parade"><span class="ico">${icone(a.solution, 32)}</span>
        <div class="lignes"><span class="grand">Paré !</span><span class="petit">${esc(a.texte)}</span></div></div>`;
    }
    if (a && a.type === 'debloque' && !e.blocage) {
      return `<div class="etat"><svg width="30" height="30" viewBox="0 0 30 30" style="flex:none"><path d="M5 15H23M16 8L23 15L16 22" stroke="#16161D" stroke-width="3.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>
        <div class="lignes"><span class="grand">C'est reparti !</span><span class="petit">${esc(a.texte)}</span></div></div>`;
    }
    if (e.blocage) {
      const p = paire(e.blocage.obstacle);
      const enMaj = (x) => x.un.replace(x.nom, x.nom.toUpperCase());
      return `<div class="etat etat-bloque"><div class="encart"><span class="ico">${icone(p.obstacle.id, 30)}</span>
        <div class="lignes"><span class="l1">Bloquée par ${esc(enMaj(p.obstacle))}</span><span class="l2">Prends ${esc(enMaj(p.solution))} !</span></div>
        ${e.blocage.restantMs === null ? '<span class="sans-fin">Seule la solution débloque</span>' : decompte(e.blocage.restantMs, { suffixe: ' s', classe: 'compte' })}</div></div>`;
    }
    if (a && a.type === 'info') {
      return `<div class="etat"><div class="lignes"><span class="petit">${esc(a.texte)}</span></div></div>`;
    }
    return `<div class="etat etat-libre">${coche(30)}<b>Libre</b>
      <span class="gris" style="font-size:15px">${e.position} / ${etat.reglages.longueur} · ${ordinal(rang(e))}</span></div>`;
  }

  // Dernières actions, racontées du point de vue de l'élève.
  function ligneFil(f, e) {
    const eq = (id) => etat.equipes[id];
    const qui = (pseudo) => (pseudo === moi.pseudo ? ['Toi', 'as'] : [pseudo, 'a']);
    const p = paire(f.obstacle || f.solution);
    let icon = f.type === 'attaque' || f.type === 'repart' ? f.obstacle : f.solution;
    let html;
    if (f.type === 'attaque' && f.cible === e.id) html = `<b>${esc(eq(f.equipe).nom)}</b> t'envoie ${esc(p.obstacle.un)}`;
    else if (f.type === 'attaque' && f.equipe === e.id && f.pseudo) {
      const [n, v] = qui(f.pseudo); html = `<b>${esc(n)}</b> ${v} envoyé ${esc(p.obstacle.un)} à ${esc(eq(f.cible).nom)}`;
    } else if (f.type === 'stock' && f.equipe === e.id && f.pseudo) {
      const [n, v] = qui(f.pseudo); html = `<b>${esc(n)}</b> ${v} pris ${esc(p.solution.un)}`;
    } else if (f.type === 'debloque' && f.equipe === e.id && f.pseudo) {
      const [n, v] = qui(f.pseudo); html = `<b>${esc(n)}</b> ${v} pris ${esc(p.solution.un)} : débloqués`;
    } else if (f.type === 'parade' && f.equipe === e.id) {
      html = `<b>${esc(majuscule(p.solution.nom))}</b> utilisé contre ${esc(eq(f.source).nom)}`;
    } else if (f.type === 'repart' && f.equipe === e.id) {
      html = '<b>Fin du blocage</b> : c\'est reparti';
    } else {
      html = esc(f.texte);
      for (const x of etat.equipes) html = html.replace(new RegExp(`\\b${x.nom}\\b`), `<b>${x.nom}</b>`);
    }
    if (!icon) icon = null;
    return `<div class="ligne-fil">${icon ? icone(icon, 22) : ''}<span>${html}</span></div>`;
  }

  function rendreBandeau() {
    const e = monEquipe();
    if (!e) return;
    document.body.style.setProperty('--equipe', e.couleur);
    const a = alerte && alerte.jusqua > performance.now() ? alerte : null;
    const robotEtat = e.blocage ? 'bloque' : a && ['parade', 'debloque'].includes(a.type) ? 'succes' : 'normal';
    const bloc = el('#bloc-equipe');
    bloc.style.background = a && a.type === 'debloque' && !e.blocage ? e.clair : '';
    bloc.innerHTML = `<div class="entete-equipe" style="background:${e.couleur};color:${e.texte}">
      ${robot({ couleur: e.couleur, symbole: e.symbole, etat: robotEtat, taille: 34 })}
      <b>Équipe ${esc(e.nom)}</b><span class="pseudo">${esc(moi.pseudo)}</span></div>${blocEtat(e)}`;

    // Mini-piste : toutes les équipes, triées par position.
    const L = etat.reglages.longueur;
    const piste = el('#mini-piste');
    piste.classList.toggle('serre', etat.equipes.length >= 7);
    piste.innerHTML = etat.equipes.slice().sort((x, y) => y.position - x.position).map((x) => {
      const soi = x.id === e.id;
      const pct = `${((x.position / L) * 100).toFixed(1)}%`;
      return `<div class="ligne-piste ${soi ? 'moi' : ''}" style="background:${soi ? x.clair : 'transparent'}">
        <span class="nom">${soi ? 'Toi' : esc(x.nom)}</span>
        <div class="mini-rail"><div class="trait"></div><div class="damier"></div>
          <span style="position:absolute;left:${pct};top:0">${pion(x, 20, soi)}</span>
          ${x.blocage ? `<span class="tag-bloquee" style="left:${pct}">bloquée</span>` : ''}</div></div>`;
    }).join('');

    el('#stock').innerHTML = etat.paires.map((p) => {
      const n = e.stock[p.solution.id] || 0;
      return `<div class="case-stock ${n ? '' : 'vide'}" title="${esc(majuscule(p.solution.nom))} : contre ${esc(p.obstacle.le)}">
        ${icone(p.solution.id, 32)}<b>${n}</b><span>/${etat.reglages.stockMax}</span></div>`;
    }).join('');

    el('#fil').innerHTML = etat.fil.filter((f) => !['depart', 'fin', 'arrivee'].includes(f.type)).slice(0, 3)
      .map((f) => ligneFil(f, e)).join('') || '<div class="ligne-fil gris">Rien pour l\'instant.</div>';
  }

  function flash(type) {
    const b = el('#bandeau');
    b.classList.remove('flash-attaque', 'flash-parade');
    b.style.background = '';
    void b.offsetWidth;
    if (type === 'attaque') b.classList.add('flash-attaque');
    else if (type === 'parade') b.classList.add('flash-parade');
    else if (type === 'debloque') b.style.background = monEquipe().couleur;
    setTimeout(() => { b.classList.remove('flash-attaque', 'flash-parade'); b.style.background = ''; }, DUREE_FLASH);
  }

  // ---------- Zone principale ----------
  function cleCourante() {
    const q = moi.question;
    // L'équipe et le pseudo en font partie : un élève déplacé par le professeur doit voir sa nouvelle équipe.
    return [moi.pseudo, moi.equipeId, moi.phase, etat.etat === 'lobby' ? 'lobby' : '', q ? `${q.id}#${q.numero}` : '', JSON.stringify(moi.tirage),
      moi.retour && moi.retour.correct, moi.phase === 'fin' && etat.resultat ? 'res' : ''].join('|');
  }

  function rendreZone() {
    const cle = cleCourante();
    if (cle !== cleZone) {
      cleZone = cle;
      obstacleChoisi = null;
      if (composant) { composant.detruire(); composant = null; }
      const rendus = { question: zoneQuestion, action: zoneAction, solution: zoneSolution, attaque: zoneAttaque, erreur: zoneErreur, fin: zoneFin };
      el('#zone').innerHTML = (rendus[moi.phase] || zoneAttente)();
      if (composant) composant.monter(el('#zone .corps-q'));
      RR.majDecomptes();
    }
    if (moi.phase === 'action') majOptions();
    if (moi.phase === 'attaque') majCibles();
  }

  function minuteur(restantMs, legende = '', petit = false) {
    return `<div class="minuteur ${petit ? 'petit' : ''}"><div class="cercle">${decompte(restantMs)}</div>${legende ? `<span class="legende" id="legende-minuteur">${legende}</span>` : ''}</div>`;
  }

  function zoneAttente() {
    const e = monEquipe();
    const lobby = etat.etat === 'lobby';
    return `<div class="centre"><div class="carte-info">${robot({ couleur: e.couleur, symbole: e.symbole, taille: 150 })}
      <div class="textes"><span class="grand-titre">${lobby ? 'Tu es dans l\'équipe ' + esc(e.nom) : 'Une question arrive…'}</span>
      <p>${lobby ? 'La course n\'a pas encore commencé. Regarde le tableau : le professeur va donner le départ.' : 'Un instant.'}</p>
      ${lobby ? `<p class="gris">Après chaque bonne réponse, tu choisiras : <b>avancer</b>, prendre une <b>solution</b> pour ton équipe, ou <b>attaquer</b> une autre équipe.</p>` : ''}
      </div></div></div>`;
  }

  function enteteQuestion(q) {
    const long = ['blocs', 'completer'].includes(q.type);
    return `<div class="entete-q"><span class="puce-type">${q.version === 'blocs' ? 'Blocs à compléter' : TYPES[q.type] || q.type}</span>
      <span class="numero-q">Question ${q.numero}${long ? ` · ${Math.round(q.dureeMs / 1000)} s` : ''}</span>
      <div class="barre-temps"><div id="barre-q" style="transform:scaleX(${q.restantMs / q.dureeMs})"></div></div>
      <b class="secondes" data-fin="${RR.fin(q.restantMs)}" data-suffixe=" s" data-barre="${q.dureeMs}" data-cible="barre-q">${Math.ceil(q.restantMs / 1000)} s</b></div>`;
  }

  // Composant de la question en cours (public/js/questions.js : un par type de question).
  let composant = null;

  function zoneQuestion() {
    const q = moi.question;
    composant = RR.questions.creer(q, {
      message: messageZone,
      async repondre(reponse) {
        const boutons = document.querySelectorAll('#zone [data-valider]');
        boutons.forEach((b) => { b.disabled = true; });
        const r = await envoyer('repondre', { questionId: q.id, reponse });
        if (!r.ok) { messageZone(r.erreur); boutons.forEach((b) => { b.disabled = false; }); }
        return r;
      },
    });
    const corps = composant ? composant.html : '<p>Type de question inconnu : préviens le professeur.</p>';
    return `${enteteQuestion(q)}<h2 class="enonce">${RR.questions.enonce(q.enonce)}</h2>
      ${q.image ? `<img class="image-q" src="${esc(q.image)}" alt="">` : ''}
      <div class="corps-q corps-${esc(q.type)}">${corps}</div><div class="message-zone" id="message-zone" role="alert"></div>`;
  }

  // Options calculées à partir de l'état public (le serveur revérifie tout).
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
    const [p1, p2] = etat.paires;
    return `<div class="tete">${robot({ couleur: e.couleur, symbole: e.symbole, etat: 'succes', taille: 96 })}
      <div class="textes"><span class="grand-titre">Bonne réponse !</span>${moi.retour && moi.retour.explication ? `<span class="sous">${esc(moi.retour.explication)}</span>` : ''}</div>
      ${minuteur(moi.restantMs, 'puis « Avancer »')}</div>
      <div class="cartes-action">
        <button class="carte-action carte-avancer" data-action="avancer">
          <svg width="88" height="88" viewBox="0 0 40 40"><path d="M6 20H32M22 9L33 20L22 31" stroke="#fff" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>
          <span class="titre-carte">Avancer</span><span class="desc">Le robot avance de ${pluriel(etat.reglages.gainAvancer, 'case')}.</span><span class="touche" data-touche="1"></span></button>
        <button class="carte-action carte-solution" data-action="solution">
          <div class="icones">${icone(p1.solution.id, 64)}${icone(p2.solution.id, 64)}</div>
          <span class="titre-carte">Solution</span><span class="desc">Ajoute une parade au stock de l'équipe.</span><span class="touche" data-touche="2"></span></button>
        <button class="carte-action carte-attaque" data-action="attaque">
          <div class="icones">${icone(p1.obstacle.id, 64)}${icone(p2.obstacle.id, 64)}</div>
          <span class="titre-carte">Attaquer</span><span class="desc">Envoie un obstacle à une autre équipe.</span><span class="touche" data-touche="3"></span></button>
      </div><div class="message-zone" id="message-zone"></div>`;
  }

  function majOptions() {
    const o = optionsLocales();
    const defaut = o.avancer ? 'avancer' : o.solution ? 'solution' : null;
    const motifs = { avancer: 'Robot bloqué : impossible d\'avancer', solution: 'Stock plein', attaque: 'Aucune équipe attaquable' };
    for (const [i, action] of ['avancer', 'solution', 'attaque'].entries()) {
      const b = el(`[data-action="${action}"]`);
      if (!b) continue;
      b.disabled = !o[action];
      b.classList.toggle('defaut', action === defaut);
      b.querySelector('.touche').textContent = !o[action] ? motifs[action] : action === defaut ? `Choix par défaut · touche ${i + 1}` : `Touche ${i + 1}`;
    }
    const l = el('#legende-minuteur');
    if (l) l.textContent = defaut === 'avancer' ? 'puis « Avancer »' : defaut === 'solution' ? 'puis une solution' : '';
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
    return `<div class="tete"><div class="textes"><span class="grand-titre" style="font-size:48px">Choisis une solution</span>
      <span class="sous">Elle rejoint le stock partagé de l'équipe ${esc(e.nom)} (${max} maximum par type).</span></div>${minuteur(moi.restantMs, '', true)}</div>
      <div class="cartes-solution">${moi.tirage.solutions.map((id, i) => {
        const p = paire(id);
        const n = e.stock[id] || 0;
        const debloque = e.blocage && e.blocage.obstacle === p.obstacle.id;
        return `<button class="carte-solution-choix" data-solution="${esc(id)}">${icone(id, 180)}
          <span class="nom">${esc(majuscule(p.solution.nom))}</span>
          <span class="info">${debloque ? '<span class="debloque">Débloque votre robot !</span>'
            : `contre ${esc(p.obstacle.le.replace(p.obstacle.nom, ''))}<b>${esc(p.obstacle.nom)}</b> · stock ${n} → ${Math.min(max, n + 1)}${n + 1 >= max ? ' (plein)' : ''}`}</span>
          <span class="touche">Touche ${i + 1}</span></button>`;
      }).join('')}</div><div class="message-zone" id="message-zone"></div>`;
  }

  async function choisirSolution(id) {
    const r = await envoyer('solution', { solution: id });
    if (!r.ok) messageZone(r.erreur);
  }

  function zoneAttaque() {
    const deux = etat.equipes.length === 2;
    return `<div class="tete"><div class="textes"><span class="grand-titre" style="font-size:48px">Attaquer</span>
      <span class="sous">${deux ? 'Choisis l\'obstacle : il part aussitôt chez l\'autre équipe.' : '1. Choisis l\'obstacle. 2. Clique sur l\'équipe visée.'}</span></div>
      ${minuteur(moi.restantMs, '', true)}</div>
      <div class="obstacles">${moi.tirage.obstacles.map((id, i) => {
        const p = paire(id);
        const pare = p.solution.un.replace(/^(un|une|des|de la) /, (m) => ({ 'un ': 'par un ', 'une ': 'par une ', 'des ': 'par des ', 'de la ': 'par de la ' }[m]));
        return `<button class="carte-obstacle" data-obstacle="${esc(id)}"><span class="ico">${icone(id, 100)}</span>
          <span><span class="nom">${esc(majuscule(p.obstacle.nom))}</span><span class="info">paré${p.obstacle.id === 'boue' ? 'e' : ''} ${esc(pare)} · touche ${i + 1}</span></span>
          <span class="coche">${coche(44, '#16161D')}</span></button>`;
      }).join('')}</div>
      ${deux ? '' : '<div class="titre-cibles" id="titre-cibles">Choisis d\'abord l\'obstacle.</div><div class="cibles" id="cibles"></div>'}
      <div class="message-zone" id="message-zone"></div>`;
  }

  function majCibles() {
    const zone = el('#cibles');
    if (!zone) return;
    const e = monEquipe();
    const adversaires = etat.equipes.filter((x) => x.id !== e.id);
    const tete = Math.max(...etat.equipes.map((x) => x.position));
    document.querySelectorAll('[data-obstacle]').forEach((b) => b.classList.toggle('choisi', b.dataset.obstacle === obstacleChoisi));
    el('#titre-cibles').textContent = obstacleChoisi ? `Envoyer ${paire(obstacleChoisi).obstacle.le} à…` : 'Choisis d\'abord l\'obstacle, puis l\'équipe visée.';
    zone.style.gridTemplateColumns = `repeat(${Math.min(adversaires.length, 7)}, 1fr)`;
    zone.innerHTML = adversaires.map((x, i) => {
      const note = x.blocage ? 'déjà bloquée' : x.protegeRestantMs > 0 ? `protégée ${Math.ceil(x.protegeRestantMs / 1000)} s`
        : `${x.position} / ${etat.reglages.longueur}${x.position === tete && x.position > 0 ? ' · en tête' : ''}`;
      const indispo = Boolean(x.blocage) || x.protegeRestantMs > 0;
      return `<button class="cible" data-cible="${x.id}" ${indispo || !obstacleChoisi ? 'disabled' : ''} style="background:${x.couleur};color:${x.texte}${!indispo && !obstacleChoisi ? ';opacity:.7' : ''}">
        ${robot({ couleur: x.couleur, symbole: x.symbole, etat: x.blocage ? 'bloque' : 'normal', taille: 80 })}
        <span class="nom">${esc(x.nom)}</span><span class="note">${note}</span></button>`;
    }).join('');
    // La protection expire sans nouvel état : on rafraîchit.
    const prochaine = Math.min(...adversaires.filter((x) => x.protegeRestantMs > 0).map((x) => x.protegeRestantMs));
    if (Number.isFinite(prochaine)) { clearTimeout(majCibles.t); majCibles.t = setTimeout(() => { if (moi && moi.phase === 'attaque') majCibles(); }, prochaine + 50); }
  }

  async function choisirObstacle(id) {
    obstacleChoisi = id;
    if (etat.equipes.length === 2) { await attaquer(null); return; }
    majCibles();
  }

  async function attaquer(cible) {
    const r = await envoyer('attaquer', { obstacle: obstacleChoisi, cible });
    if (!r.ok) messageZone(r.erreur);
  }

  function zoneErreur() {
    const e = monEquipe();
    const r = moi.retour || {};
    const donnee = r.tempsDepasse ? 'Temps écoulé.' : `Tu as répondu <b>${esc(r.donnee ?? '—')}</b>.`;
    return `<div class="centre"><div class="carte-erreur">${robot({ couleur: e.couleur, symbole: e.symbole, etat: 'bloque', taille: 150 })}
      <div class="textes"><span class="grand-titre">${r.tempsDepasse ? 'Trop tard !' : 'Pas cette fois.'}</span>
      <div class="reponses">${donnee} La bonne réponse : <b class="bonne">${esc(r.bonne)}</b></div>
      ${r.explication ? `<div class="explication">${esc(r.explication)}</div>` : ''}
      <div class="attente"><div class="barre"><div style="animation-duration:${moi.restantMs}ms"></div></div>
      <span>Nouvelle question dans ${decompte(moi.restantMs, { suffixe: ' s' })}</span></div></div></div></div>`;
  }

  function zoneFin() {
    const r = etat.resultat;
    if (!r) return zoneAttente();
    const e = monEquipe();
    const ligne = r.classement.find((c) => c.equipe === e.id);
    const premiers = r.classement.filter((c) => c.rang === 1);
    const titre = premiers.length === 1 ? `L'équipe ${etat.equipes[premiers[0].equipe].nom} gagne !` : 'Égalité en tête !';
    const s = moi.stats;
    return `<div class="centre"><div class="carte-info">${robot({ couleur: e.couleur, symbole: e.symbole, etat: ligne.rang === 1 ? 'succes' : 'normal', taille: 150 })}
      <div class="textes"><span class="grand-titre">${esc(titre)}</span>
      <p>Ton équipe termine <b>${ordinal(ligne.rang)}</b>${ligne.rang === 1 && premiers.length > 1 ? ' ex æquo' : ''} (${ligne.position} / ${etat.reglages.longueur}).</p>
      <div class="stats-perso"><div><b>${s.justes}</b>${s.justes > 1 ? 'réponses justes' : 'réponse juste'}</div>
      <div><b>${s.attaques}</b>${s.attaques > 1 ? 'attaques' : 'attaque'}</div><div><b>${s.solutions}</b>${s.solutions > 1 ? 'solutions' : 'solution'}</div></div>
      <p class="gris">Regarde le podium au tableau.</p></div></div></div>`;
  }

  // Clics (délégation) et clavier
  el('#zone').addEventListener('click', (ev) => {
    const b = ev.target.closest('button');
    if (!b || b.disabled) return;
    if (b.dataset.action) choisirAction(b.dataset.action);
    else if (b.dataset.solution) choisirSolution(b.dataset.solution);
    else if (b.dataset.obstacle) choisirObstacle(b.dataset.obstacle);
    else if (b.dataset.cible) attaquer(Number(b.dataset.cible));
  });
  document.addEventListener('keydown', (ev) => {
    if (!moi || ['INPUT', 'SELECT', 'TEXTAREA'].includes(ev.target.tagName) || ev.repeat || ev.ctrlKey || ev.altKey || ev.metaKey) return;
    if (ev.target.closest && ev.target.closest('.zone-blocs')) return; // Blockly gère son propre clavier
    // Pendant une question, chaque type gère ses touches (1 à 4 pour le QCM, Entrée pour valider…).
    if (moi.phase === 'question') { if (composant && composant.touche(ev)) ev.preventDefault(); return; }
    const n = Number(ev.key);
    if (!Number.isInteger(n) || n < 1) return;
    const selecteur = {
      action: '[data-action]', solution: '[data-solution]',
      attaque: obstacleChoisi ? '[data-cible]' : '[data-obstacle]',
    }[moi.phase];
    if (!selecteur) return;
    const b = document.querySelectorAll(selecteur)[n - 1];
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
    if (!connecte) {
      const erreur = el('#erreur-connexion');
      erreur.hidden = !messageConnexion;
      erreur.textContent = messageConnexion;
      return;
    }
    rendreBandeau();
    rendreZone();
  }

  // Les paires obstacle / solution ne sont renvoyées que lorsqu'elles changent : on garde les précédentes.
  socket.on('etat', (e) => { etat = { ...e, paires: e.paires || (etat && etat.paires) || [] }; afficher(); });
  socket.on('moi', (m) => {
    if (m === null && stockage.lire()) { stockage.ecrire(null); socket.auth.jeton = null; }
    moi = m;
    afficher();
    if (!m) setTimeout(() => { if (!codeSaisi()) cases[0].focus(); }, 0);
  });
  socket.on('alerte', (a) => {
    // L'attaque s'affiche le temps du flash, puis le bandeau passe à « Bloquée ».
    const duree = a.type === 'attaque' ? 1500 : DUREE_MESSAGE;
    alerte = { ...a, jusqua: performance.now() + duree };
    flash(a.type);
    afficher();
    setTimeout(afficher, duree + 50);
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
