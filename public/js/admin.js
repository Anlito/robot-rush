/* Espace professeur /admin (maquettes C0, C1) : lancement et pilotage de la partie */
'use strict';

(() => {
  const { robot, pastille, icone, esc, el, majuscule } = RR;
  const CLE_MDP = 'robotrush.admin';
  // [clé, libellé, unité]
  const REGLAGES = [
    ['longueur', 'Longueur de la piste', 'cases'],
    ['gainAvancer', 'Gain « Avancer »', 'cases'],
    ['attenteErreur', 'Attente mauvaise rép.', 's'],
    ['dureeBlocage', 'Durée de blocage', 's'],
    ['protection', 'Protection après blocage', 's'],
    ['stockMax', 'Stock max par solution', ''],
    ['dureePartie', 'Durée de la partie', 'min'],
    ['tempsQuestion', 'Temps / question', 's'],
    ['tempsQuestionLong', 'Temps blocs, à compléter', 's'],
    ['delaiAction', 'Délai choix d\'action', 's'],
  ];
  const LIBELLES_ETAT = { lobby: 'Salle d\'attente', en_cours: 'Course en cours', pause: 'Course en pause', terminee: 'Course terminée' };

  let socket = null;
  let etat = null;
  let donnees = { parcours: [] };

  const session = {
    lire() { try { return sessionStorage.getItem(CLE_MDP); } catch { return null; } },
    ecrire(v) { try { if (v) sessionStorage.setItem(CLE_MDP, v); else sessionStorage.removeItem(CLE_MDP); } catch { /* ignoré */ } },
  };

  el('#robot-acces').innerHTML = robot({ couleur: '#16161D', symbole: 'etoile', taille: 40 });
  el('#robot-logo').innerHTML = robot({ couleur: '#16161D', symbole: 'etoile', taille: 32 });

  function envoyer(evenement, d = {}) {
    if (!socket || !socket.connected) return Promise.resolve({ ok: false, erreur: 'Pas de connexion au serveur Robot Rush.' });
    return new Promise((resolve) => socket.emit(evenement, d, (r) => resolve(r || { ok: false, erreur: 'Pas de réponse du serveur.' })));
  }

  // ---------- Noyau partagé avec les onglets Questions et Parcours (admin-*.js) ----------
  const ecouteursBanque = [];
  const Admin = window.Admin = {
    envoyer,
    banque: null,
    /** Appelé à chaque nouvelle version de la banque (après une modification, ici ou dans un autre onglet). */
    surBanque(fn) { ecouteursBanque.push(fn); if (Admin.banque) fn(Admin.banque); },
    etatPartie: () => etat,
    /** Message en haut de l'écran (succès ou erreur), effacé au bout de quelques secondes. */
    bandeau(texte, erreur = false) {
      const b = el('#bandeau-message');
      b.hidden = !texte;
      b.textContent = texte || '';
      b.classList.toggle('erreur', erreur);
      clearTimeout(Admin.bandeau.t);
      if (texte) Admin.bandeau.t = setTimeout(() => { b.hidden = true; }, erreur ? 9000 : 4000);
    },
    /** Libellé d'une question dans les listes : son titre (s'il y en a un), puis l'énoncé. */
    libelleQuestion(q) {
      const enonce = RR.esc(q.enonce || '(sans énoncé)');
      return `<span class="libelle-q">${q.titre ? `<b>${RR.esc(q.titre)}</b> <span class="gris">· ${enonce}</span>` : enonce}</span>`;
    },
    /** Texte cherché par la recherche des listes. */
    texteRecherche: (q) => `${q.id} ${q.titre || ''} ${q.enonce} ${JSON.stringify(q.donnees)}`.toLowerCase(),

    /** Fenêtre modale. contenu : HTML ; renvoie l'élément (fermer avec Admin.fermerModale()). */
    modale({ titre, contenu, large = false, plein = false, fermer }) {
      const fond = el('#fond-modale');
      const m = el('#modale');
      m.className = `modale ${large ? 'large' : ''} ${plein ? 'plein' : ''}`;
      m.innerHTML = `<div class="tete-modale"><b>${esc(titre)}</b><button class="mini-bouton" data-fermer type="button" aria-label="Fermer">×</button></div>
        <div class="corps-modale">${contenu}</div>`;
      fond.hidden = false;
      Admin.surFermeture = fermer || null;
      m.querySelector('[data-fermer]').addEventListener('click', () => Admin.fermerModale());
      setTimeout(() => { const f = m.querySelector('input, textarea, select, button:not([data-fermer])'); if (f) f.focus(); }, 0);
      return m;
    },
    fermerModale() {
      el('#fond-modale').hidden = true;
      el('#modale').innerHTML = '';
      if (Admin.surFermeture) { const f = Admin.surFermeture; Admin.surFermeture = null; f(); }
    },
    /** Exécute une action et affiche son erreur éventuelle dans le bandeau. Renvoie la réponse du serveur. */
    async action(evenement, d, succes) {
      const r = await envoyer(evenement, d);
      if (!r.ok) Admin.bandeau(r.erreur, true);
      else if (succes) Admin.bandeau(typeof succes === 'function' ? succes(r) : succes);
      return r;
    },
  };
  document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && !el('#fond-modale').hidden) Admin.fermerModale(); });

  // ---------- Onglets Partie / Questions / Parcours ----------
  function onglet() {
    const nom = ['questions', 'parcours'].includes(location.hash.slice(1)) ? location.hash.slice(1) : 'partie';
    for (const v of ['partie', 'questions', 'parcours']) el(`#vue-${v}`).hidden = v !== nom;
    document.querySelectorAll('.onglet').forEach((o) => {
      o.classList.toggle('actif', o.dataset.onglet === nom);
      if (o.dataset.onglet === nom) o.setAttribute('aria-current', 'page'); else o.removeAttribute('aria-current');
    });
    document.body.dataset.onglet = nom;
    window.dispatchEvent(new CustomEvent('onglet', { detail: nom }));
  }
  window.addEventListener('hashchange', onglet);
  onglet();
  function message(texte, erreur = false) {
    const m = el('#message');
    m.hidden = !texte;
    m.textContent = texte || '';
    m.classList.toggle('erreur', erreur);
  }
  async function action(evenement, d) {
    const r = await envoyer(evenement, d);
    if (!r.ok) message(r.erreur, true); else message('');
    return r;
  }

  // ---------- C0 · Accès ----------
  function montrerAcces(erreur) {
    const bouton = el('#form-acces button[type="submit"]');
    bouton.disabled = false;
    bouton.textContent = 'Entrer';
    el('#ecran-acces').hidden = false;
    el('#ecran-admin').hidden = true;
    const e = el('#erreur-acces');
    e.hidden = !erreur;
    e.textContent = erreur || '';
    el('#mdp').focus();
  }
  function ouvrir(mdp) {
    if (socket) socket.disconnect();
    socket = RR.connecter({ role: 'admin', motDePasse: mdp });
    socket.on('admin:refuse', ({ erreur }) => { session.ecrire(null); montrerAcces(erreur); });
    socket.on('admin:donnees', (d) => {
      donnees = d;
      session.ecrire(mdp);
      el('#avert-mdp').hidden = !d.motDePasseParDefaut || Boolean(d.hebergement);
      el('#avert-stockage').hidden = !d.stockageEphemere;
      // En ligne, l'aide « réseau du collège, pare-feu » du mode local ne sert à rien.
      el('.aide-connexion').hidden = Boolean(d.hebergement);
      remplirParcours();
    });
    socket.on('etat', (e) => { etat = e; afficher(); });
    socket.on('banque', (b) => { Admin.banque = b; for (const f of ecouteursBanque) f(b); });
    socket.on('disconnect', () => message('Connexion au serveur perdue… reconnexion en cours. Vérifiez que la fenêtre Robot Rush est toujours ouverte sur ce PC.', true));
    socket.on('connect', () => message(''));
    socket.on('connect_error', () => {
      const texte = 'Le serveur Robot Rush ne répond pas. Vérifiez que la fenêtre noire du programme est ouverte sur ce PC.';
      if (!el('#ecran-acces').hidden) montrerAcces(texte); else message(texte, true);
    });
  }
  el('#form-acces').addEventListener('submit', (ev) => {
    ev.preventDefault();
    const bouton = el('#form-acces button[type="submit"]');
    bouton.disabled = true;
    bouton.textContent = 'Connexion…';
    el('#erreur-acces').hidden = true;
    ouvrir(el('#mdp').value.trim());
    // Sans réponse du serveur au bout de 5 s, on le dit.
    setTimeout(() => {
      bouton.disabled = false;
      bouton.textContent = 'Entrer';
      if (!el('#ecran-acces').hidden && el('#erreur-acces').hidden) {
        montrerAcces('Pas de réponse du serveur. Vérifiez que Robot Rush est lancé (fenêtre noire ouverte), puis réessayez.');
      }
    }, 5000);
  });
  el('#btn-deconnexion').addEventListener('click', () => {
    session.ecrire(null);
    if (socket) socket.disconnect();
    el('#mdp').value = '';
    montrerAcces('');
  });

  // ---------- Colonne de lancement ----------
  el('#reglages').innerHTML = REGLAGES.map(([cle, libelle, unite]) => `
    <div class="ligne-reglage"><label for="r-${cle}">${libelle}</label>
    <span class="saisie-unite"><input id="r-${cle}" data-reglage="${cle}" type="number" inputmode="numeric">${unite ? `<span>${unite}</span>` : ''}</span></div>`).join('');
  el('#nb-equipes').innerHTML = [2, 3, 4, 5, 6, 7, 8].map((n) => `<button type="button" data-n="${n}">${n}</button>`).join('');

  function remplirParcours() {
    el('#parcours').innerHTML = donnees.parcours.map((p) => `<option value="${esc(p.id)}">${esc(p.nom)}</option>`).join('');
    if (etat) afficherReglages();
  }

  async function configurer(d) {
    const e = el('#erreur-config');
    e.hidden = true;
    const r = await envoyer('configurer', d);
    if (!r.ok) { e.hidden = false; e.textContent = r.erreur; afficherReglages(); }
  }
  el('#parcours').addEventListener('change', () => configurer({ parcoursId: el('#parcours').value }));
  el('#nb-equipes').addEventListener('click', (ev) => {
    const b = ev.target.closest('button[data-n]');
    if (!b || b.disabled) return;
    const n = Number(b.dataset.n);
    const aRetirer = etat.equipes.slice(n).reduce((s, e) => s + e.eleves.length, 0);
    if (aRetirer && !confirm(`${aRetirer} élève(s) des équipes supprimées devront se reconnecter avec un nouveau code. Continuer ?`)) return;
    configurer({ nbEquipes: n });
  });
  el('#reglages').addEventListener('change', (ev) => {
    const cle = ev.target.dataset.reglage;
    if (cle) configurer({ reglages: { [cle]: ev.target.value } });
  });
  el('#solutionGarantie').addEventListener('change', (ev) => configurer({ reglages: { solutionGarantie: ev.target.checked } }));
  document.querySelectorAll('[name="finBlocage"]').forEach((r) => r.addEventListener('change', (ev) => configurer({ reglages: { finBlocage: ev.target.value } })));

  function afficherReglages() {
    const lobby = etat.etat === 'lobby';
    for (const [cle] of REGLAGES) {
      const input = el(`#r-${cle}`);
      if (document.activeElement !== input) input.value = etat.reglagesComplets[cle];
      input.disabled = !lobby;
    }
    el('#solutionGarantie').checked = etat.reglagesComplets.solutionGarantie;
    el('#solutionGarantie').disabled = !lobby;
    document.querySelectorAll('[name="finBlocage"]').forEach((r) => {
      r.checked = r.value === etat.reglagesComplets.finBlocage;
      r.disabled = !lobby;
    });
    // Sans fin automatique, la durée de blocage ne sert pas.
    if (etat.reglagesComplets.finBlocage === 'solution') el('#r-dureeBlocage').disabled = true;
    el('#parcours').disabled = !lobby;
    if (etat.parcoursId && el('#parcours').value !== etat.parcoursId) el('#parcours').value = etat.parcoursId;
    const p = donnees.parcours.find((x) => x.id === etat.parcoursId);
    el('#info-parcours').textContent = p
      ? `${p.nb} questions · ${p.nbTypes} type${p.nbTypes > 1 ? 's' : ''}`
        + (etat.nbQuestionsJouables < p.nb ? ` · attention : ${p.nb - etat.nbQuestionsJouables} incomplète(s), elles ne seront pas posées` : '')
      : '';
    el('#nb-equipes').querySelectorAll('button').forEach((b) => {
      b.classList.toggle('actif', Number(b.dataset.n) === etat.equipes.length);
      b.disabled = !lobby;
    });
    el('#btn-paires').disabled = !lobby;
    el('#btn-paires').title = lobby ? '' : 'Modifiable avant le départ de la course';
    el('#paires').innerHTML = etat.paires.map((x) =>
      `<div class="paire">${icone(x.obstacle.id, 22)}→${icone(x.solution.id, 22)}<span>${esc(majuscule(x.obstacle.nom))}</span></div>`).join('');
  }

  // ---------- Paires obstacle / solution (« Modifier ») ----------
  const GENRES = [['m', 'masculin (un)'], ['f', 'féminin (une)'], ['pl', 'pluriel (des)'], ['part-f', 'de la'], ['part-m', 'du']];
  const ARTICLES = { m: ['un', 'le', 'son'], f: ['une', 'la', 'sa'], pl: ['des', 'les', 'ses'], 'part-f': ['de la', 'la', 'sa'], 'part-m': ['du', 'le', 'son'] };
  // Même règle que le serveur (server/paires.js), pour l'exemple affiché en direct.
  function formes(nom, genre) {
    const [un, le, sa] = ARTICLES[genre] || ARTICLES.m;
    const voyelle = /^[aeiouyhàâéèêëîïôöûü]/i.test(nom) && genre !== 'pl';
    return {
      un: voyelle && genre.startsWith('part') ? `de l'${nom}` : `${un} ${nom}`,
      le: voyelle ? `l'${nom}` : `${le} ${nom}`,
      sa: voyelle && sa === 'sa' ? `son ${nom}` : `${sa} ${nom}`,
    };
  }

  function editerPaires() {
    if (etat.etat !== 'lobby') { Admin.bandeau('Les obstacles se modifient avant le départ de la course.', true); return; }
    let paires = (Admin.banque ? Admin.banque.paires : []).map((p) => JSON.parse(JSON.stringify(p)));
    const choix = (sel) => GENRES.map(([v, t]) => `<option value="${v}" ${v === sel ? 'selected' : ''}>${t}</option>`).join('');
    const m = Admin.modale({ titre: 'Obstacles et solutions', contenu: '<div id="liste-paires"></div>' });
    function rendre() {
      const ex = paires[0] ? formes(paires[0].obstacle.nom || 'obstacle', paires[0].obstacle.genre) : null;
      const exS = paires[0] ? formes(paires[0].solution.nom || 'solution', paires[0].solution.genre) : null;
      m.querySelector('#liste-paires').innerHTML = `
        <p class="aide">Chaque obstacle est annulé par sa solution. Les icônes existent pour les 4 paires d'origine ; une nouvelle paire a une icône générique.</p>
        <div class="grille-paires">
          <span class="entete-col">Obstacle</span><span></span><span class="entete-col">Solution</span><span></span>
          ${paires.map((p, i) => `
            <span class="cellule-paire">${icone(p.obstacle.id || '?', 26)}<input data-i="${i}" data-cote="obstacle" data-champ="nom" value="${esc(p.obstacle.nom)}" maxlength="24" aria-label="Obstacle ${i + 1}">
              <select data-i="${i}" data-cote="obstacle" data-champ="genre" aria-label="Genre de l'obstacle ${i + 1}">${choix(p.obstacle.genre)}</select></span>
            <span class="fleche-paire">→</span>
            <span class="cellule-paire">${icone(p.solution.id || '?', 26)}<input data-i="${i}" data-cote="solution" data-champ="nom" value="${esc(p.solution.nom)}" maxlength="24" aria-label="Solution ${i + 1}">
              <select data-i="${i}" data-cote="solution" data-champ="genre" aria-label="Genre de la solution ${i + 1}">${choix(p.solution.genre)}</select></span>
            <button class="mini-bouton retirer" data-retirer-paire="${i}" type="button" ${paires.length <= 2 ? 'disabled' : ''} aria-label="Retirer la paire ${i + 1}">×</button>`).join('')}
        </div>
        ${paires.length < 8 ? '<button class="lien-bouton" data-ajouter-paire type="button">+ Ajouter une paire</button>' : ''}
        ${ex ? `<p class="exemple-paires">Exemple au projecteur : « <b>Bleue</b> envoie ${esc(ex.un)} à <b>Rouge</b> ! » · « <b>Rouge</b> franchit ${esc(ex.le)} avec ${esc(exS.sa)} »</p>` : ''}
        <div class="actions-modale"><button class="btn" data-fermer type="button">Annuler</button>
          <button class="btn btn-primaire" data-enregistrer-paires type="button">Enregistrer</button></div>`;
      m.querySelectorAll('[data-fermer]').forEach((b) => b.addEventListener('click', () => Admin.fermerModale()));
    }
    m.addEventListener('input', (ev) => {
      const c = ev.target.dataset;
      if (c.champ) { paires[c.i][c.cote][c.champ] = ev.target.value; if (c.champ === 'genre') rendre(); }
    });
    m.addEventListener('change', (ev) => { if (ev.target.dataset.champ === 'genre') rendre(); });
    m.addEventListener('click', async (ev) => {
      if (ev.target.closest('[data-ajouter-paire]')) { paires.push({ obstacle: { nom: '', genre: 'm' }, solution: { nom: '', genre: 'm' } }); rendre(); }
      const r = ev.target.closest('[data-retirer-paire]');
      if (r) { paires.splice(Number(r.dataset.retirerPaire), 1); rendre(); }
      if (ev.target.closest('[data-enregistrer-paires]')) {
        const rep = await Admin.action('paires', { paires }, 'Obstacles et solutions enregistrés.');
        if (rep.ok) Admin.fermerModale();
      }
    });
    rendre();
  }
  el('#btn-paires').addEventListener('click', editerPaires);

  // ---------- Pilotage ----------
  el('#btn-demarrer').addEventListener('click', async () => {
    if (etat.etat === 'pause') { action('reprendre'); return; }
    const r = await action('demarrer');
    if (r.ok && r.avertissement && confirm(r.avertissement)) action('demarrer', { forcer: true });
  });
  el('#btn-pause').addEventListener('click', () => action('pause'));
  el('#btn-arreter').addEventListener('click', () => { if (confirm('Arrêter la course maintenant ? Le classement actuel sera affiché.')) action('arreter'); });
  el('#btn-codes').addEventListener('click', () => {
    const n = etat.equipes.reduce((s, e) => s + e.eleves.length, 0);
    if (!n || confirm(`De nouveaux codes vont s'afficher. Les ${n} élève(s) déjà connectés restent dans leur équipe. Continuer ?`)) action('regenererCodes');
  });
  el('#btn-rejouer').addEventListener('click', () => action('nouvellePartie', { garderEquipes: true }));
  el('#btn-nouvelle').addEventListener('click', () => {
    if (confirm('Tous les élèves devront se reconnecter avec les nouveaux codes. Continuer ?')) action('nouvellePartie', { garderEquipes: false });
  });

  el('#equipes').addEventListener('change', (ev) => {
    const s = ev.target.closest('select[data-deplacer]');
    if (s && s.value !== '') action('deplacerEleve', { jeton: s.dataset.deplacer, equipeId: Number(s.value) });
  });
  el('#equipes').addEventListener('click', (ev) => {
    const r = ev.target.closest('button[data-retirer]');
    if (r && confirm(`Retirer « ${r.dataset.pseudo} » de la partie ? L'élève devra revenir avec un autre pseudo.`)) action('retirerEleve', { jeton: r.dataset.retirer });
    const s = ev.target.closest('button[data-signaler]');
    if (s) action('signalerEleve', { jeton: s.dataset.signaler, signale: s.dataset.actif !== '1' });
  });

  function ligneEleve(j, e) {
    const note = j.signale ? 'à retirer ?' : !j.connecte ? 'reconnexion…' : '';
    const autres = etat.equipes.filter((x) => x.id !== e.id);
    return `<div class="eleve ${j.signale ? 'signale' : ''}">
      <span class="point ${j.connecte ? '' : 'absent'}" title="${j.connecte ? 'Connecté' : 'Déconnecté, peut revenir'}"></span>
      <span class="pseudo">${esc(j.pseudo)}</span>
      ${note ? `<span class="note">${note}</span>` : ''}
      ${etat.etat !== 'lobby' ? `<span class="stats" title="Réponses justes · attaques · solutions">${j.stats.justes}·${j.stats.attaques}·${j.stats.solutions}</span>` : ''}
      <button class="mini-bouton drapeau ${j.signale ? 'actif' : ''}" data-signaler="${esc(j.jeton)}" data-actif="${j.signale ? '1' : '0'}"
        title="${j.signale ? 'Retirer le signalement' : 'Signaler ce pseudo'}" aria-label="Signaler ${esc(j.pseudo)}">⚑</button>
      <select class="mini-bouton" data-deplacer="${esc(j.jeton)}" title="Déplacer vers une autre équipe" aria-label="Déplacer ${esc(j.pseudo)}">
        <option value="">⇄</option>${autres.map((x) => `<option value="${x.id}">${esc(x.nom)}</option>`).join('')}</select>
      <button class="mini-bouton retirer" data-retirer="${esc(j.jeton)}" data-pseudo="${esc(j.pseudo)}" title="Retirer" aria-label="Retirer ${esc(j.pseudo)}">×</button>
    </div>`;
  }

  function afficherEquipes() {
    const L = etat.reglages.longueur;
    el('#equipes').innerHTML = etat.equipes.map((e) => {
      const stock = Object.entries(e.stock).filter(([, n]) => n > 0).map(([id, n]) => `${icone(id, 18)}${n}`).join(' ');
      return `<div class="carte-equipe">
        <div class="entete" style="background:${e.couleur};color:${e.texte}">${pastille(e.symbole, 26)}<b>${esc(e.nom)}</b><span class="code">${esc(e.code)}</span></div>
        ${etat.etat !== 'lobby' ? `<div class="infos"><span>${e.position} / ${L}</span>
          ${e.blocage ? `<span class="bloquee">bloquée · ${esc(e.blocage.obstacle)}</span>` : '<span>libre</span>'}
          ${stock ? `<span style="display:flex;align-items:center;gap:2px">${stock}</span>` : ''}</div>` : ''}
        ${e.eleves.length ? `<div class="eleves">${e.eleves.map((j) => ligneEleve(j, e)).join('')}</div>` : '<p class="vide">Aucun élève pour l\'instant</p>'}
      </div>`;
    }).join('');
  }

  function afficherAdresse() {
    const a = etat.adresse;
    el('#adresse-courte').textContent = a.courte;
    el('#adresse-complete').textContent = a.complete;
    el('#adresse-test').textContent = `${a.base}/test`;
    el('#adresse-autres').textContent = a.autres.length ? `Si ça ne marche pas, autre adresse possible : ${a.autres.join(' ou ')}` : '';
    el('#alerte-reseau').hidden = !a.sansReseau;
    const qr = el('#qr');
    if (qr.dataset.adresse !== a.complete) { qr.dataset.adresse = a.complete; qr.src = `/qr.svg?${encodeURIComponent(a.complete)}`; }
  }

  function afficher() {
    el('#ecran-acces').hidden = true;
    el('#ecran-admin').hidden = false;
    const s = etat.etat;
    const connectes = etat.equipes.reduce((n, e) => n + e.eleves.filter((j) => j.connecte).length, 0);
    el('#titre-etat').textContent = LIBELLES_ETAT[s];
    let sous = `${connectes} élève${connectes > 1 ? 's' : ''} connecté${connectes > 1 ? 's' : ''}`;
    if (connectes !== etat.nbEleves) sous += ` sur ${etat.nbEleves}`;
    if (s === 'lobby') sous += ' · les codes sont affichés au projecteur';
    if (s === 'en_cours' || s === 'pause') sous += ` · temps restant ${RR.format(etat.tempsRestantMs)}`;
    el('#sous-etat').textContent = sous;
    el('#btn-demarrer').textContent = s === 'pause' ? '▶ Reprendre' : '▶ Démarrer la course';
    el('#btn-demarrer').disabled = !(s === 'lobby' || s === 'pause');
    el('#btn-pause').disabled = s !== 'en_cours';
    el('#btn-arreter').disabled = !(s === 'en_cours' || s === 'pause');
    el('#btn-codes').disabled = s !== 'lobby';
    el('#fin-actions').hidden = s !== 'terminee';
    afficherAdresse();
    afficherReglages();
    // On ne reconstruit pas les cartes pendant que le professeur manipule un menu.
    if (!document.activeElement || !document.activeElement.closest('#equipes')) afficherEquipes();
  }

  // Temps restant affiché, une fois par seconde.
  setInterval(() => { if (etat && etat.etat === 'en_cours') { etat.tempsRestantMs = Math.max(0, etat.tempsRestantMs - 1000); afficher(); } }, 1000);

  const mdp = session.lire();
  if (mdp) ouvrir(mdp); else montrerAcces('');
})();
