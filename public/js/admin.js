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
    return new Promise((resolve) => socket.emit(evenement, d, (r) => resolve(r || { ok: false, erreur: 'Pas de réponse du serveur.' })));
  }
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
    socket.on('admin:donnees', (d) => { donnees = d; session.ecrire(mdp); el('#avert-mdp').hidden = !d.motDePasseParDefaut; remplirParcours(); });
    socket.on('etat', (e) => { etat = e; afficher(); });
    socket.on('disconnect', () => message('Connexion au serveur perdue… reconnexion en cours. Vérifiez que la fenêtre Robot Rush est toujours ouverte sur ce PC.', true));
    socket.on('connect', () => message(''));
    socket.on('connect_error', () => message('Le serveur Robot Rush ne répond pas. Vérifiez que la fenêtre noire du programme est ouverte.', true));
  }
  el('#form-acces').addEventListener('submit', (ev) => {
    ev.preventDefault();
    el('#erreur-acces').hidden = true;
    ouvrir(el('#mdp').value);
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

  function afficherReglages() {
    const lobby = etat.etat === 'lobby';
    for (const [cle] of REGLAGES) {
      const input = el(`#r-${cle}`);
      if (document.activeElement !== input) input.value = etat.reglagesComplets[cle];
      input.disabled = !lobby;
    }
    el('#solutionGarantie').checked = etat.reglagesComplets.solutionGarantie;
    el('#solutionGarantie').disabled = !lobby;
    el('#parcours').disabled = !lobby;
    if (etat.parcoursId && el('#parcours').value !== etat.parcoursId) el('#parcours').value = etat.parcoursId;
    const p = donnees.parcours.find((x) => x.id === etat.parcoursId);
    el('#info-parcours').textContent = p
      ? `${p.nb} questions · ${p.nbTypes} type${p.nbTypes > 1 ? 's' : ''} · ${etat.nbQuestionsJouables} jouable${etat.nbQuestionsJouables > 1 ? 's' : ''} pour l'instant (QCM)`
      : '';
    el('#nb-equipes').querySelectorAll('button').forEach((b) => {
      b.classList.toggle('actif', Number(b.dataset.n) === etat.equipes.length);
      b.disabled = !lobby;
    });
    el('#paires').innerHTML = etat.paires.map((x) =>
      `<div class="paire">${icone(x.obstacle.id, 22)}→${icone(x.solution.id, 22)}<span>${esc(majuscule(x.obstacle.nom))}</span></div>`).join('');
  }

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
