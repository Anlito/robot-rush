/* Espace professeur /admin : lancement et pilotage de la partie */
'use strict';

(() => {
  const { robot, pastille, icone, esc, el } = RR;
  const CLE_MDP = 'robotrush.admin';
  const REGLAGES = [
    ['longueur', 'Longueur de la piste (cases)'],
    ['gainAvancer', 'Gain d\'un « Avancer » (cases)'],
    ['dureePartie', 'Durée de la partie (min)'],
    ['tempsQuestion', 'Temps par question (s)'],
    ['tempsQuestionLong', 'Temps blocs / à compléter (s)'],
    ['delaiAction', 'Délai pour choisir l\'action (s)'],
    ['attenteErreur', 'Attente après erreur (s)'],
    ['dureeBlocage', 'Durée de blocage (s)'],
    ['protection', 'Protection après blocage (s)'],
    ['stockMax', 'Stock maximum par solution'],
  ];
  const LIBELLES_ETAT = { lobby: 'Salle d\'attente', en_cours: 'Course en cours', pause: 'Course en pause', terminee: 'Course terminée' };

  let socket = null;
  let etat = null;
  let donnees = { parcours: [] };

  const session = {
    lire() { try { return sessionStorage.getItem(CLE_MDP); } catch { return null; } },
    ecrire(v) { try { if (v) sessionStorage.setItem(CLE_MDP, v); else sessionStorage.removeItem(CLE_MDP); } catch { /* ignoré */ } },
  };

  function envoyer(evenement, d = {}) {
    return new Promise((resolve) => socket.emit(evenement, d, (r) => resolve(r || { ok: false, erreur: 'Pas de réponse du serveur.' })));
  }
  function message(texte, erreur = false) {
    const m = el('#message');
    m.textContent = texte || '';
    m.classList.toggle('erreur', erreur);
  }
  async function action(evenement, d) {
    const r = await envoyer(evenement, d);
    if (!r.ok) message(r.erreur, true); else message('');
    return r;
  }

  // ---------- Accès ----------
  function ouvrir(mdp) {
    if (socket) socket.disconnect();
    socket = RR.connecter({ role: 'admin', motDePasse: mdp });
    socket.on('admin:refuse', ({ erreur }) => {
      session.ecrire(null);
      el('#ecran-acces').hidden = false; el('#ecran-admin').hidden = true;
      el('#erreur-acces').textContent = erreur;
    });
    socket.on('admin:donnees', (d) => { donnees = d; session.ecrire(mdp); remplirParcours(); });
    socket.on('etat', (e) => { etat = e; afficher(); });
    socket.on('disconnect', () => message('Connexion au serveur perdue… reconnexion en cours', true));
    socket.on('connect', () => message(''));
  }
  el('#form-acces').addEventListener('submit', (ev) => {
    ev.preventDefault();
    el('#erreur-acces').textContent = '';
    ouvrir(el('#mdp').value);
  });

  // ---------- Réglages ----------
  el('#reglages').innerHTML = REGLAGES.map(([cle, libelle]) =>
    `<label for="r-${cle}">${libelle}</label><input id="r-${cle}" data-reglage="${cle}" type="number" inputmode="numeric">`).join('');
  el('#nb-equipes').innerHTML = [2, 3, 4, 5, 6, 7, 8].map((n) => `<button type="button" data-n="${n}">${n}</button>`).join('');

  function remplirParcours() {
    el('#parcours').innerHTML = donnees.parcours.map((p) => `<option value="${esc(p.id)}">${esc(p.nom)} (${p.nb} questions)</option>`).join('');
    if (etat) el('#parcours').value = etat.parcoursId;
  }

  async function configurer(d) {
    el('#erreur-config').textContent = '';
    const r = await envoyer('configurer', d);
    if (!r.ok) { el('#erreur-config').textContent = r.erreur; afficherReglages(); }
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
    if (el('#parcours').value !== etat.parcoursId && etat.parcoursId) el('#parcours').value = etat.parcoursId;
    el('#info-parcours').textContent = `${etat.nbQuestionsJouables} question(s) jouable(s) à cette étape (QCM).`;
    el('#nb-equipes').querySelectorAll('button').forEach((b) => {
      b.classList.toggle('actif', Number(b.dataset.n) === etat.equipes.length);
      b.disabled = !lobby;
    });
    el('#paires').innerHTML = etat.paires.map((p) =>
      `<li>${icone(p.obstacle.id, 24)} ${esc(p.obstacle.nom)} → ${icone(p.solution.id, 24)} ${esc(p.solution.nom)}</li>`).join('');
  }

  // ---------- Pilotage ----------
  el('#btn-demarrer').addEventListener('click', async () => {
    if (etat.etat === 'pause') { action('reprendre'); return; }
    const r = await action('demarrer');
    if (r.ok && r.avertissement && confirm(r.avertissement)) action('demarrer', { forcer: true });
  });
  el('#btn-pause').addEventListener('click', () => action('pause'));
  el('#btn-arreter').addEventListener('click', () => { if (confirm('Arrêter la course maintenant ? Le classement actuel sera affiché.')) action('arreter'); });
  el('#btn-codes').addEventListener('click', () => action('regenererCodes'));
  el('#btn-rejouer').addEventListener('click', () => action('nouvellePartie', { garderEquipes: true }));
  el('#btn-nouvelle').addEventListener('click', () => {
    if (confirm('Tous les élèves devront se reconnecter avec les nouveaux codes. Continuer ?')) action('nouvellePartie', { garderEquipes: false });
  });

  el('#equipes').addEventListener('change', (ev) => {
    const s = ev.target.closest('select[data-deplacer]');
    if (s && s.value !== '') action('deplacerEleve', { jeton: s.dataset.deplacer, equipeId: Number(s.value) });
  });
  el('#equipes').addEventListener('click', (ev) => {
    const b = ev.target.closest('button[data-retirer]');
    if (b && confirm(`Retirer « ${b.dataset.pseudo} » de la partie ?`)) action('retirerEleve', { jeton: b.dataset.retirer });
  });

  function afficherEquipes() {
    el('#equipes').innerHTML = etat.equipes.map((e) => `
      <div class="carte-equipe">
        <div class="tete" style="background:${e.couleur};color:${e.texte}">${robot({ couleur: e.couleur, symbole: e.symbole, etat: e.blocage ? 'bloque' : 'normal', taille: 30 })}
          <span class="nom">${esc(e.nom)}</span><span class="code">${esc(e.code)}</span></div>
        ${etat.etat !== 'lobby' ? `<div class="infos">Case ${e.position} / ${etat.reglages.longueur} · ${e.blocage ? `<b>bloquée (${esc(e.blocage.obstacle)})</b>` : 'libre'}
          · stock ${Object.values(e.stock).reduce((a, b) => a + b, 0)}</div>` : ''}
        ${e.eleves.length ? `<ul>${e.eleves.map((j) => `
          <li><span class="point ${j.connecte ? '' : 'absent'}" title="${j.connecte ? 'connecté' : 'en reconnexion'}"></span>
          <span class="pseudo">${esc(j.pseudo)}</span>
          ${etat.etat !== 'lobby' ? `<span class="stats" title="réponses justes · attaques · solutions">${j.stats.justes}·${j.stats.attaques}·${j.stats.solutions}</span>` : ''}
          <select data-deplacer="${esc(j.jeton)}" title="Déplacer vers une autre équipe" aria-label="Déplacer ${esc(j.pseudo)}">
            <option value="">⇄</option>${etat.equipes.filter((x) => x.id !== e.id).map((x) => `<option value="${x.id}">${esc(x.nom)}</option>`).join('')}</select>
          <button class="retirer" data-retirer="${esc(j.jeton)}" data-pseudo="${esc(j.pseudo)}" title="Retirer" aria-label="Retirer ${esc(j.pseudo)}">×</button></li>`).join('')}</ul>`
          : '<p class="vide">Aucun élève</p>'}
      </div>`).join('');
  }

  function afficher() {
    el('#ecran-acces').hidden = true;
    el('#ecran-admin').hidden = false;
    const s = etat.etat;
    const connectes = etat.equipes.reduce((n, e) => n + e.eleves.filter((j) => j.connecte).length, 0);
    el('#titre-etat').textContent = LIBELLES_ETAT[s];
    el('#sous-etat').innerHTML = `${connectes} élève(s) connecté(s) sur ${etat.nbEleves} · adresse élèves : <span class="mono">${esc(etat.adresse)}</span>`
      + (s === 'en_cours' || s === 'pause' ? ` · temps restant ${RR.format(etat.tempsRestantMs)}` : '');
    el('#btn-demarrer').textContent = s === 'pause' ? '▶ Reprendre' : '▶ Démarrer la course';
    el('#btn-demarrer').disabled = !(s === 'lobby' || s === 'pause');
    el('#btn-pause').disabled = s !== 'en_cours';
    el('#btn-arreter').disabled = !(s === 'en_cours' || s === 'pause');
    el('#btn-codes').disabled = s !== 'lobby';
    el('#fin-actions').hidden = s !== 'terminee';
    afficherReglages();
    if (!document.activeElement || !document.activeElement.closest('#equipes')) afficherEquipes();
  }

  // Mise à jour du temps restant affiché, une fois par seconde.
  setInterval(() => { if (etat && etat.etat === 'en_cours') { etat.tempsRestantMs -= 1000; afficher(); } }, 1000);

  const mdp = session.lire();
  if (mdp) ouvrir(mdp); else el('#ecran-acces').hidden = false;
})();
