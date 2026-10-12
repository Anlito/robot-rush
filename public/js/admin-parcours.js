/* Admin · onglet Parcours (maquette C3) : liste des parcours, éditeur, banque de questions.
 * Sauvegarde automatique à chaque modification.
 */
'use strict';

(() => {
  const { esc, el } = RR;
  const COURT = { qcm: 'QCM', ordre: 'Ordre', calcul: 'Calcul', blocs: 'Blocs', completer: 'À compléter' };
  const POIGNEE = '<span class="poignee-p" aria-hidden="true">⠿</span>';

  let choisi = null;      // id du parcours affiché
  let brouillon = null;   // copie modifiable
  let recherche = '';
  let minuterie = null;
  let enCours = null;
  let modifie = false;

  const copie = (x) => JSON.parse(JSON.stringify(x));
  const question = (id) => Admin.banque.questions.find((q) => q.id === id);
  const numero = (id) => id.replace(/^q-0*/, '');
  const reglagesPartie = () => (Admin.etatPartie() && Admin.etatPartie().reglagesComplets) || { dureePartie: 12, longueur: 30, tempsQuestion: 30, tempsQuestionLong: 60 };

  function resume(p) {
    const r = reglagesPartie();
    const n = p.questions.length;
    return `${n} question${n > 1 ? 's' : ''} · ${p.reglages.dureePartie || r.dureePartie} min · ${p.reglages.longueur || r.longueur} cases`;
  }

  // ---------- Colonne des parcours ----------
  function rendreCartes() {
    const partie = Admin.etatPartie();
    el('#cartes-p').innerHTML = Admin.banque.parcours.map((p) => `
      <button type="button" class="carte-p ${p.id === choisi ? 'choisie' : ''}" data-p="${esc(p.id)}">
        <b>${esc(p.nom)}</b><span class="gris">${resume(p)}</span>
        ${partie && partie.parcoursId === p.id ? '<span class="etiquette-p">choisi pour la partie</span>' : ''}
        ${p.nbJouables < p.questions.length ? `<span class="etiquette-p attention">${p.questions.length - p.nbJouables} incomplète(s)</span>` : ''}
      </button>`).join('');
  }

  // ---------- Éditeur ----------
  function choisir(id) {
    const p = Admin.banque.parcours.find((x) => x.id === id) || Admin.banque.parcours[0];
    if (!p) return;
    choisi = p.id;
    brouillon = copie(p);
    delete brouillon.nbJouables;
    modifie = false;
    rendreTout();
  }

  function rendreEditeur() {
    const zone = el('#editeur-p');
    if (!brouillon) { zone.innerHTML = '<p class="editeur-vide">Aucun parcours.</p>'; return; }
    const p = brouillon;
    const r = reglagesPartie();
    const parType = {};
    for (const id of p.questions) { const q = question(id); if (q) parType[q.type] = (parType[q.type] || 0) + 1; }
    const detail = Object.entries(parType).map(([t, n]) => `${COURT[t]} ${n}`).join(', ');
    zone.innerHTML = `
      <div class="tete-editeur"><b class="titre-editeur">${esc(p.nom || 'Parcours sans nom')}</b>
        <span class="statut" id="statut-p" role="status"></span>
        <div class="actions">
          <button class="lien-bouton danger" type="button" data-supprimer-p>Supprimer</button>
          <button class="btn" type="button" data-exporter-p>Exporter ce parcours</button>
          <button class="btn" type="button" data-dupliquer-p>Dupliquer</button>
          <button class="btn btn-primaire" type="button" data-jouer-p>Choisir pour la partie</button></div></div>
      <div class="grille-champs-p">
        <div class="champ"><label for="p-nom">Nom</label><input id="p-nom" data-p-champ="nom" maxlength="80" value="${esc(p.nom)}"></div>
        <div class="champ"><label>Ordre</label><button type="button" class="interrupteur-p" data-ordre-p role="switch" aria-checked="${p.ordre_aleatoire}">
          <span class="curseur ${p.ordre_aleatoire ? 'actif' : ''}"></span>${p.ordre_aleatoire ? 'Aléatoire' : 'Dans l\'ordre de la liste'}</button></div>
        <div class="champ"><label for="p-duree">Durée</label><span class="saisie-unite large"><input id="p-duree" type="number" data-p-reglage="dureePartie" min="1" max="60"
          value="${p.reglages.dureePartie ?? ''}" placeholder="${r.dureePartie}"><span>min</span></span></div>
        <div class="champ"><label for="p-piste">Piste</label><span class="saisie-unite large"><input id="p-piste" type="number" data-p-reglage="longueur" min="5" max="100"
          value="${p.reglages.longueur ?? ''}" placeholder="${r.longueur}"><span>cases</span></span></div>
      </div>
      <p class="aide">Durée et piste vides : les réglages de la partie s'appliquent. Remplies : elles s'appliquent quand ce parcours est choisi.</p>
      <div class="titre-liste-p"><b>Questions du parcours</b><span class="gris">${p.questions.length} question${p.questions.length > 1 ? 's' : ''}${detail ? ` · ${detail}` : ''} · chaque élève les reçoit sans répétition tant que possible</span></div>
      <div class="liste-p" id="liste-p">
        ${p.questions.map((id, i) => {
          const q = question(id);
          if (!q) return '';
          return `<div class="ligne-p" data-i="${i}">
            <span class="poignee-zone" data-poignee-p="${i}" title="Glisser pour déplacer">${POIGNEE}</span>
            <span class="mono gris">${esc(numero(id))}</span><span class="badge-type">${COURT[q.type]}</span>
            <button type="button" class="texte-q lien-texte" data-ouvrir-q="${esc(id)}" title="Ouvrir dans l'éditeur de questions">
              ${q.probleme ? `<span class="pastille-pb" title="Incomplète : ${esc(q.probleme)} — ne sera pas posée">!</span>` : ''}${esc(q.enonce || '(sans énoncé)')}</button>
            <span class="mono gris">${q.duree_s || (['blocs', 'completer'].includes(q.type) ? r.tempsQuestionLong : r.tempsQuestion)} s</span>
            <button class="mini-bouton" type="button" data-monter-p="${i}" ${i === 0 ? 'disabled' : ''} aria-label="Monter">↑</button>
            <button class="mini-bouton" type="button" data-descendre-p="${i}" ${i === p.questions.length - 1 ? 'disabled' : ''} aria-label="Descendre">↓</button>
            <button class="mini-bouton retirer" type="button" data-retirer-p="${i}" aria-label="Retirer du parcours">×</button></div>`;
        }).join('') || '<p class="vide-liste">Ajoutez des questions depuis la banque, à droite (bouton +).</p>'}
      </div>`;
    rendreStatut();
  }

  function rendreBanque() {
    if (!brouillon) { el('#lignes-banque-p').innerHTML = ''; return; }
    const r = recherche.toLowerCase();
    const dans = new Set(brouillon.questions);
    const liste = Admin.banque.questions.filter((q) => !r || `${q.id} ${q.enonce}`.toLowerCase().includes(r));
    el('#lignes-banque-p').innerHTML = liste.map((q) => `
      <div class="ligne-banque ${dans.has(q.id) ? 'deja' : ''}">
        <span class="badge-type">${COURT[q.type]}</span>
        <span class="texte-q">${q.probleme ? '<span class="pastille-pb" title="Incomplète">!</span>' : ''}${esc(q.enonce || '(sans énoncé)')}</span>
        <button class="mini-bouton ajouter" type="button" data-ajouter-q="${esc(q.id)}" ${dans.has(q.id) ? 'disabled aria-label="Déjà dans le parcours"' : 'aria-label="Ajouter au parcours"'}>${dans.has(q.id) ? '✓' : '+'}</button>
      </div>`).join('') || '<p class="vide-liste">Aucune question.</p>';
  }

  let statut = { texte: '', type: '' };
  function rendreStatut() {
    const s = el('#statut-p');
    if (s) { s.textContent = statut.texte; s.className = `statut ${statut.type}`; }
  }

  function rendreTout() { rendreCartes(); rendreEditeur(); rendreBanque(); }

  // Après une création ou une duplication : la nouvelle banque peut arriver avant ou après la réponse du serveur.
  async function ouvrirQuandPret(id) {
    for (let k = 0; k < 40 && !Admin.banque.parcours.some((p) => p.id === id); k++) await new Promise((r) => setTimeout(r, 50));
    choisir(id);
  }

  // ---------- Sauvegarde automatique ----------
  function modification({ redessiner = true, delai = 600 } = {}) {
    modifie = true;
    statut = { texte: 'Modifications en cours…', type: '' };
    if (redessiner) { rendreEditeur(); rendreBanque(); } else rendreStatut();
    clearTimeout(minuterie);
    minuterie = setTimeout(enregistrer, delai);
  }

  async function enregistrer() {
    clearTimeout(minuterie);
    if (!brouillon || !modifie) return enCours;
    if (enCours) await enCours;
    modifie = false;
    enCours = Admin.envoyer('parcours:enregistrer', { parcours: copie(brouillon) }).then((r) => {
      enCours = null;
      if (!r.ok) { modifie = true; statut = { texte: r.erreur, type: 'erreur' }; } else statut = { texte: 'Enregistré', type: 'ok' };
      rendreStatut();
      return r;
    });
    return enCours;
  }

  // ---------- Événements ----------
  const zone = el('#editeur-p');
  zone.addEventListener('input', (ev) => {
    const t = ev.target;
    if (!brouillon) return;
    if (t.dataset.pChamp === 'nom') { brouillon.nom = t.value; el('.titre-editeur', zone).textContent = t.value || 'Parcours sans nom'; modification({ redessiner: false }); }
    if (t.dataset.pReglage) {
      if (t.value === '') delete brouillon.reglages[t.dataset.pReglage]; else brouillon.reglages[t.dataset.pReglage] = Number(t.value);
      modification({ redessiner: false, delai: 900 });
    }
  });
  zone.addEventListener('click', async (ev) => {
    const c = (s) => ev.target.closest(s);
    if (!brouillon) return;
    const p = brouillon;
    if (c('[data-ordre-p]')) { p.ordre_aleatoire = !p.ordre_aleatoire; modification({ delai: 200 }); }
    const m = c('[data-monter-p]') || c('[data-descendre-p]');
    if (m) {
      const i = Number(m.dataset.monterP ?? m.dataset.descendreP);
      const j = m.dataset.monterP !== undefined ? i - 1 : i + 1;
      [p.questions[i], p.questions[j]] = [p.questions[j], p.questions[i]];
      modification({ delai: 300 });
    }
    const r = c('[data-retirer-p]');
    if (r) { p.questions.splice(Number(r.dataset.retirerP), 1); modification({ delai: 300 }); }
    const o = c('[data-ouvrir-q]');
    if (o) { await enregistrer(); Admin.ouvrirQuestion(o.dataset.ouvrirQ); }
    if (c('[data-dupliquer-p]')) {
      await enregistrer();
      const rep = await Admin.action('parcours:dupliquer', { id: p.id }, 'Parcours dupliqué : vous modifiez maintenant la copie.');
      if (rep.ok) ouvrirQuandPret(rep.parcours.id);
    }
    if (c('[data-supprimer-p]')) {
      if (!confirm(`Supprimer le parcours « ${p.nom} » ? Les questions restent dans la banque.`)) return;
      clearTimeout(minuterie);
      modifie = false;
      const rep = await Admin.action('parcours:supprimer', { id: p.id }, 'Parcours supprimé.');
      if (rep.ok) choisir(null); // premier parcours de la liste
    }
    if (c('[data-jouer-p]')) {
      await enregistrer();
      const etat = Admin.etatPartie();
      if (etat && etat.etat !== 'lobby') { Admin.bandeau('Une course est en cours : choisissez le parcours après l\'avoir arrêtée.', true); return; }
      const rep = await Admin.action('configurer', { parcoursId: p.id }, `Parcours « ${p.nom} » choisi pour la prochaine course.`);
      if (rep.ok) location.hash = '#partie';
    }
    if (c('[data-exporter-p]')) { await enregistrer(); Admin.exporter([p.id], p.nom); }
  });

  // Glisser une question par sa poignée pour la déplacer dans la liste.
  zone.addEventListener('pointerdown', (ev) => {
    const poignee = ev.target.closest('[data-poignee-p]');
    if (!poignee || !brouillon) return;
    ev.preventDefault();
    let de = Number(poignee.dataset.poigneeP);
    const ligne = poignee.closest('.ligne-p');
    ligne.classList.add('deplacee');
    const suivre = (e) => {
      const sous = document.elementFromPoint(e.clientX, e.clientY);
      const cible = sous && sous.closest('.ligne-p');
      if (!cible || cible === ligne) return;
      const vers = Number(cible.dataset.i);
      const [x] = brouillon.questions.splice(de, 1);
      brouillon.questions.splice(vers, 0, x);
      // Déplacement visuel immédiat, sans tout redessiner pendant le geste.
      if (vers > de) cible.after(ligne); else cible.before(ligne);
      el('#liste-p').querySelectorAll('.ligne-p').forEach((l, k) => { l.dataset.i = k; });
      de = vers;
    };
    const finir = () => {
      window.removeEventListener('pointermove', suivre);
      window.removeEventListener('pointerup', finir);
      ligne.classList.remove('deplacee');
      modification({ delai: 200 });
    };
    window.addEventListener('pointermove', suivre);
    window.addEventListener('pointerup', finir);
  });

  el('#lignes-banque-p').addEventListener('click', (ev) => {
    const a = ev.target.closest('[data-ajouter-q]');
    if (!a || a.disabled || !brouillon) return;
    brouillon.questions.push(a.dataset.ajouterQ);
    modification({ delai: 300 });
  });
  el('#recherche-banque-p').addEventListener('input', (ev) => { recherche = ev.target.value.trim(); rendreBanque(); });
  el('#cartes-p').addEventListener('click', async (ev) => {
    const c = ev.target.closest('[data-p]');
    if (!c) return;
    await enregistrer();
    choisir(c.dataset.p);
  });
  el('#btn-nouveau-p').addEventListener('click', async () => {
    await enregistrer();
    const n = Admin.banque.parcours.length + 1;
    const rep = await Admin.action('parcours:enregistrer', { parcours: { nom: `Nouveau parcours ${n}`, ordre_aleatoire: true, questions: [], reglages: {} } }, 'Parcours créé : donnez-lui un nom et ajoutez des questions.');
    if (rep.ok) { await ouvrirQuandPret(rep.parcours.id); el('#p-nom').select(); }
  });

  window.addEventListener('onglet', () => { enregistrer(); });
  window.addEventListener('beforeunload', () => { if (modifie) enregistrer(); });

  Admin.surBanque((b) => {
    // Parcours choisi disparu, ou pas encore de choix : on prend le premier.
    if (!choisi || !b.parcours.some((p) => p.id === choisi)) { choisi = b.parcours[0] && b.parcours[0].id; brouillon = null; }
    if (!brouillon || (!modifie && !enCours && !zone.contains(document.activeElement))) {
      const p = b.parcours.find((x) => x.id === choisi);
      brouillon = p ? copie(p) : null;
      if (brouillon) delete brouillon.nbJouables;
      rendreTout();
    } else {
      rendreCartes();
      rendreBanque();
    }
  });
})();
