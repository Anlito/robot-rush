/* Admin · onglet Questions (maquette C2) : liste, filtres, éditeur des 5 types, aperçu élève.
 * Sauvegarde automatique : chaque modification part au serveur après une courte pause de saisie.
 */
'use strict';

(() => {
  const { esc, el } = RR;
  const TYPES = [['qcm', 'QCM'], ['ordre', 'Remise en ordre'], ['calcul', 'Calcul'], ['blocs', 'Blocs'], ['completer', 'À compléter'], ['relier', 'Relier']];
  const NOM_TYPE = Object.fromEntries(TYPES);
  const COURT = { qcm: 'QCM', ordre: 'Ordre', calcul: 'Calcul', blocs: 'Blocs', completer: 'À compléter', relier: 'Relier' };
  const LONGS = ['blocs', 'completer'];
  const FORMES_QCM = [
    { fond: '#2563EB', texte: '#fff', forme: 'M0 -8L8.5 7H-8.5Z' },
    { fond: '#F97316', texte: '#16161D', forme: 'M0 -9L9 0L0 9L-9 0Z' },
    { fond: '#7C3AED', texte: '#fff', forme: 'M0 -8A8 8 0 1 1 0 8A8 8 0 1 1 0 -8Z' },
    { fond: '#15803D', texte: '#fff', forme: 'M-7.5 -7.5H7.5V7.5H-7.5Z' },
  ];
  // Blocs proposables, avec la couleur de leur famille dans l'atelier céréales.
  const BLOCS = {
    led_etat: ['contrôler la LED', '#F7AE5E'], attendre: ['attendre ( ) s', '#78B5D6'], servo_angle: ['servo à ( )°', '#E78AB3'],
    repeter: ['répéter ( ) fois', '#86C595'], si_alors: ['si … alors', '#F7AE5E'], si_sinon: ['si … sinon', '#F7AE5E'],
    bouton_etat: ['état du bouton', '#BCDAEB'], valeur_haut_bas: ['HAUT / BAS', '#BCDAEB'], comparaison: ['( ) = ( )', '#78B5D6'],
    affecter: ['affecter CHOIX', '#EC8780'], variable: ['CHOIX', '#EC8780'], nombre: ['nombre', '#78B5D6'],
  };
  const DEFAUTS = {
    qcm: () => ({ choix: ['', '', '', ''], bonne: 0 }),
    ordre: () => ({ elements: ['', '', ''] }),
    calcul: () => ({ reponse: '', unite: '' }),
    blocs: () => ({ blocs: ['led_etat', 'attendre', 'si_alors', 'si_sinon', 'bouton_etat'], sequences: [] }),
    completer: () => ({ version: 'texte', texte: '', mode: 'liste', trous: [] }),
    relier: () => ({ paires: [{ gauche: '', droite: '' }, { gauche: '', droite: '' }, { gauche: '', droite: '' }] }),
  };
  const COMPLETER_BLOCS = () => ({ version: 'blocs', blocs: ['led_etat', 'attendre'], broches: false, sequences: [], depart: null });
  const estCompleterBlocs = (q) => q.type === 'completer' && q.donnees.version === 'blocs';

  let filtreType = 'tous';
  let filtreNiveau = '';
  let recherche = '';
  let brouillon = null;        // question en cours d'édition
  let textesSequences = [];    // séquences de blocs en clair (affichage)
  let texteDepart = '';        // programme de départ à compléter, en clair
  let modifie = false;
  let minuterie = null;
  let enregistrement = null;   // promesse de l'enregistrement en cours
  let statut = { texte: '', type: '' };

  const copie = (x) => JSON.parse(JSON.stringify(x));
  const numero = (id) => (id ? id.replace(/^q-0*/, '') : 'nouvelle');
  const dureeDefaut = (type) => {
    const r = Admin.etatPartie() && Admin.etatPartie().reglagesComplets;
    return LONGS.includes(type) ? (r ? r.tempsQuestionLong : 60) : (r ? r.tempsQuestion : 30);
  };

  // ---------- Liste ----------
  function questionsFiltrees() {
    const b = Admin.banque;
    const r = recherche.toLowerCase();
    return b.questions.filter((q) => (filtreType === 'tous' || q.type === filtreType)
      && (!filtreNiveau || q.niveau === filtreNiveau)
      && (!r || Admin.texteRecherche(q).includes(r)));
  }

  function rendreFiltres() {
    const b = Admin.banque;
    const compte = (t) => b.questions.filter((q) => q.type === t).length;
    el('#filtres-q').innerHTML = `
      <button type="button" class="puce-filtre ${filtreType === 'tous' ? 'actif' : ''}" data-filtre="tous">Tous · ${b.questions.length}</button>
      ${TYPES.map(([t]) => `<button type="button" class="puce-filtre ${filtreType === t ? 'actif' : ''}" data-filtre="${t}">${COURT[t]} ${compte(t)}</button>`).join('')}
      <select class="puce-filtre" id="filtre-niveau" aria-label="Filtrer par niveau"><option value="">Niveau ▾</option>
        ${b.niveaux.map((n) => `<option value="${n}" ${filtreNiveau === n ? 'selected' : ''}>${n}</option>`).join('')}</select>`;
  }

  function rendreListe() {
    const liste = questionsFiltrees();
    el('#lignes-q').innerHTML = liste.map((q) => `
      <button type="button" class="ligne-q ${brouillon && brouillon.id === q.id ? 'choisie' : ''}" data-q="${esc(q.id)}" role="option" aria-selected="${brouillon && brouillon.id === q.id}">
        <span class="num mono">${esc(numero(q.id))}</span>
        <span class="badge-type">${COURT[q.type] || '?'}</span>
        <span class="texte-q">${q.probleme ? `<span class="pastille-pb" title="Incomplète : ${esc(q.probleme)}">!</span>` : ''}${q.bonus ? `<span class="etoile-bonus" title="Question bonus : +${q.bonus} case(s)">★${q.bonus}</span>` : ''}${Admin.libelleQuestion(q)}</span>
        <span class="gris">${esc(q.niveau || '')}</span>
        <span class="mono gris duree">${q.duree_s || dureeDefaut(q.type)} s</span>
      </button>`).join('') || '<p class="vide-liste">Aucune question ne correspond.</p>';
  }

  // ---------- Éditeur ----------
  function choisir(id) {
    const q = Admin.banque.questions.find((x) => x.id === id);
    if (!q) return;
    brouillon = copie(q);
    for (const k of ['probleme', 'utilisations', 'apercuSequences', 'apercuDepart']) delete brouillon[k];
    textesSequences = (q.apercuSequences || []).slice();
    texteDepart = q.apercuDepart || '';
    modifie = false;
    statut = q.probleme ? { texte: `Incomplète : ${q.probleme}. Elle ne sera pas posée.`, type: 'attention' } : { texte: 'Enregistrée', type: 'ok' };
    rendreListe();
    rendreEditeur();
  }

  function nouvelle() {
    brouillon = { id: null, type: filtreType !== 'tous' ? filtreType : 'qcm', niveau: filtreNiveau || '5e', titre: '', enonce: '', image: null, duree_s: null, explication: '', donnees: null };
    brouillon.donnees = DEFAUTS[brouillon.type]();
    textesSequences = [];
    texteDepart = '';
    modifie = false;
    statut = { texte: 'Nouvelle question : elle sera enregistrée dès que vous écrivez.', type: '' };
    rendreListe();
    rendreEditeur();
    el('#champ-titre').focus();
  }

  function rendreStatut() {
    const s = el('#statut-q');
    if (!s) return;
    s.textContent = statut.texte;
    s.className = `statut ${statut.type}`;
  }

  function rendreEditeur() {
    const zone = el('#editeur-q');
    if (!brouillon) {
      zone.innerHTML = `<div class="editeur-vide"><p>Choisissez une question dans la liste, ou créez-en une.</p>
        <button class="btn btn-primaire" type="button" data-nouvelle>+ Nouvelle question</button></div>`;
      return;
    }
    const q = brouillon;
    const utilisations = (Admin.banque.questions.find((x) => x.id === q.id) || {}).utilisations || 0;
    zone.innerHTML = `
      <div class="tete-editeur"><b class="titre-editeur">${q.id ? `Question ${esc(numero(q.id))}` : 'Nouvelle question'}</b>
        <span class="statut" id="statut-q" role="status"></span>
        <div class="actions">
          ${q.id ? `<button class="lien-bouton danger" type="button" data-supprimer>Supprimer</button>
          <button class="btn" type="button" data-dupliquer>Dupliquer</button>` : ''}
          <button class="btn" type="button" data-apercu>Aperçu élève</button>
          <button class="btn btn-primaire" type="button" data-enregistrer>Enregistrer</button></div></div>
      ${utilisations ? `<p class="aide">Utilisée dans ${utilisations} parcours.</p>` : ''}
      <div class="segmente types-q" role="tablist" aria-label="Type de question">
        ${TYPES.map(([t, n]) => `<button type="button" role="tab" aria-selected="${q.type === t}" class="${q.type === t ? 'actif' : ''}" data-type="${t}">${n}</button>`).join('')}</div>
      <div class="champ champ-titre"><label for="champ-titre">Titre <span class="gris">(option · visible seulement dans l'espace professeur, pour retrouver la question)</span></label>
        <input id="champ-titre" data-champ="titre" maxlength="80" value="${esc(q.titre || '')}" placeholder="ex. LED D9 et bouton D6 : si / sinon"></div>
      <div class="ligne-enonce">
        <div class="champ"><label for="champ-enonce">Énoncé</label>
          <textarea id="champ-enonce" data-champ="enonce" rows="3" maxlength="600" placeholder="La consigne lue par l'élève">${esc(q.enonce)}</textarea>
          <span class="aide">Astuce : un mot entre accents graves, comme \`score\`, s'affiche comme du code.</span></div>
        <div class="champ"><label>Image (option)</label>
          <div class="depot-image ${q.image ? 'avec-image' : ''}" id="depot-image" tabindex="0" role="button" aria-label="Ajouter une image">
            ${q.image ? `<img src="${esc(q.image)}" alt="Image de la question"><button type="button" class="lien-bouton danger" data-retirer-image>Retirer</button>`
              : '<span>Glisser une image<br>ou cliquer<br><small>PNG, JPG, SVG · 800 Ko max</small></span>'}
          </div><input type="file" id="fichier-image" accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml" hidden></div>
      </div>
      <div class="bloc-type" id="bloc-type">${blocType(q)}</div>
      <div class="ligne-bas">
        <div class="champ"><label for="champ-niveau">Niveau</label><select id="champ-niveau" data-champ="niveau">
          ${Admin.banque.niveaux.map((n) => `<option ${q.niveau === n ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
        <div class="champ"><label for="champ-bonus">Bonus</label><select id="champ-bonus" data-champ="bonus" title="Question plus difficile : cases gagnées tout de suite, en plus de l'action">
          ${[0, 1, 2, 3, 4, 5].map((n) => `<option value="${n}" ${(q.bonus || 0) === n ? 'selected' : ''}>${n ? `★ +${n} case${n > 1 ? 's' : ''}` : 'Aucun'}</option>`).join('')}</select></div>
        <div class="champ"><label for="champ-duree">Durée</label><span class="saisie-unite large"><input id="champ-duree" data-champ="duree_s" type="number" min="5" max="300"
          value="${q.duree_s ?? ''}" placeholder="${dureeDefaut(q.type)}"><span>s</span></span></div>
        <div class="champ"><label for="champ-explication">Explication après réponse (option)</label>
          <input id="champ-explication" data-champ="explication" maxlength="400" value="${esc(q.explication || '')}" placeholder="Affichée à l'élève après sa réponse"></div>
      </div>`;
    rendreStatut();
  }

  function blocType(q) {
    const d = q.donnees;
    switch (q.type) {
      case 'qcm':
        return `<b>Réponses (une seule bonne)</b>
          ${d.choix.map((c, i) => `<div class="ligne-qcm">
            <svg width="22" height="22" viewBox="-10 -10 20 20" aria-hidden="true"><rect x="-10" y="-10" width="20" height="20" rx="4" fill="${FORMES_QCM[i].fond}"/><path d="${FORMES_QCM[i].forme}" fill="${FORMES_QCM[i].texte}" transform="scale(.6)"/></svg>
            <input type="radio" name="bonne-qcm" value="${i}" ${d.bonne === i ? 'checked' : ''} aria-label="Bonne réponse : ${['A', 'B', 'C', 'D'][i]}">
            <input class="mono" data-qcm="${i}" value="${esc(c)}" maxlength="150" placeholder="Réponse ${['A', 'B', 'C', 'D'][i]}${i >= 2 ? ' (facultative)' : ''}">
            <span class="ok-qcm">${d.bonne === i ? 'Bonne réponse' : ''}</span></div>`).join('')}
          <span class="aide">Les réponses sont mélangées à l'affichage. Le serveur garde la bonne réponse. Laisser C ou D vide pour 2 ou 3 réponses.</span>`;
      case 'ordre':
        return `<b>Étapes dans le bon ordre</b>
          ${d.elements.map((e, i) => `<div class="ligne-ordre"><b class="mono">${i + 1}</b>
            <input data-ordre="${i}" value="${esc(e)}" maxlength="150" placeholder="Étape ${i + 1}">
            <button class="mini-bouton" type="button" data-monter="${i}" ${i === 0 ? 'disabled' : ''} aria-label="Monter l'étape ${i + 1}">↑</button>
            <button class="mini-bouton" type="button" data-descendre="${i}" ${i === d.elements.length - 1 ? 'disabled' : ''} aria-label="Descendre l'étape ${i + 1}">↓</button>
            <button class="mini-bouton retirer" type="button" data-retirer-etape="${i}" ${d.elements.length <= 2 ? 'disabled' : ''} aria-label="Retirer l'étape ${i + 1}">×</button></div>`).join('')}
          ${d.elements.length < 8 ? '<button class="lien-bouton" type="button" data-ajouter-etape>+ Ajouter une étape</button>' : ''}
          <span class="aide">Saisir dans le bon ordre : les élèves les reçoivent mélangées.</span>`;
      case 'calcul':
        return `<b>Réponse numérique</b><div class="ligne-calcul">
          <div class="champ"><label for="champ-reponse">Réponse exacte</label><input id="champ-reponse" class="mono grand-nombre" data-calcul="reponse" inputmode="decimal" value="${esc(d.reponse ?? '')}"></div>
          <div class="champ"><label for="champ-unite">Unité affichée (option)</label><input id="champ-unite" data-calcul="unite" maxlength="12" value="${esc(d.unite || '')}" placeholder="ex. cm, °"></div>
          <p class="aide">Formats acceptés de l'élève : entiers et décimaux, avec une virgule ou un point.</p></div>`;
      case 'blocs':
        return `<b>Blocs et solutions</b>${htmlBlocs(d, false)}`;
      case 'relier':
        return `<b>Paires à relier</b>
          ${d.paires.map((p, i) => `<div class="ligne-paire"><b class="mono">${i + 1}</b>
            <input data-paire="${i}" data-cote="gauche" value="${esc(p.gauche)}" maxlength="150" placeholder="Élément de gauche">
            <span aria-hidden="true">↔</span>
            <input data-paire="${i}" data-cote="droite" value="${esc(p.droite)}" maxlength="150" placeholder="Son partenaire à droite">
            <button class="mini-bouton retirer" type="button" data-retirer-paire="${i}" ${d.paires.length <= 2 ? 'disabled' : ''} aria-label="Retirer la paire ${i + 1}">×</button></div>`).join('')}
          ${d.paires.length < 6 ? '<button class="lien-bouton" type="button" data-ajouter-paire>+ Ajouter une paire</button>' : ''}
          <span class="aide">Saisir chaque paire sur une ligne : l'élève voit la colonne de gauche dans cet ordre et celle de droite mélangée. 2 à 6 paires.</span>`;
      case 'completer': {
        const versions = `<div class="ligne-mode">Version :
            <button type="button" class="puce-filtre ${d.version !== 'blocs' ? 'actif' : ''}" data-version="texte">Texte (trous dans le code)</button>
            <button type="button" class="puce-filtre ${d.version === 'blocs' ? 'actif' : ''}" data-version="blocs">Blocs (programme Blockly à compléter)</button></div>`;
        if (d.version === 'blocs') return `<b>Programme de blocs à compléter</b>${versions}${htmlBlocs(d, true)}`;
        const n = (d.texte.match(/___/g) || []).length;
        return `<b>Programme à trous</b>${versions}
          <label class="petit-label" for="champ-programme">Programme · écrire ___ (trois tirets bas) pour chaque trou</label>
          <textarea id="champ-programme" class="code-admin" data-completer="texte" rows="5" spellcheck="false" placeholder="si ___ alors&#10;    allumer la LED">${esc(d.texte)}</textarea>
          <span class="aide">${n ? `${n} trou${n > 1 ? 's' : ''} détecté${n > 1 ? 's' : ''}.` : 'Aucun trou pour l\'instant.'}</span>
          ${d.trous.map((t, i) => `<div class="ligne-trou"><b>Trou ${i + 1}</b>
            <div class="champ"><label class="petit-label" for="bonne-${i}">Bonne réponse</label><input id="bonne-${i}" class="mono bonne-trou" data-trou="${i}" data-champ-trou="bonne" maxlength="80" value="${esc(t.bonne)}"></div>
            <div class="champ"><label class="petit-label" for="distr-${i}">Autres choix (un par ligne)</label><textarea id="distr-${i}" class="mono" rows="3" data-trou="${i}" data-champ-trou="distracteurs">${esc(t.distracteurs.join('\n'))}</textarea></div></div>`).join('')}
          <div class="ligne-mode">Saisie élève :
            <button type="button" class="puce-filtre ${d.mode === 'glisser' ? 'actif' : ''}" data-mode="glisser">Glisser-déposer</button>
            <button type="button" class="puce-filtre ${d.mode === 'liste' ? 'actif' : ''}" data-mode="liste">Liste déroulante</button></div>`;
      }
      default:
        return '<p>Type inconnu.</p>';
    }
  }

  // Blocs : palette, broches, séquences acceptées et, pour « à compléter », programme de départ avec ses trous.
  function htmlBlocs(d, aCompleter) {
    const sequences = d.sequences.map((s, i) => `<div class="ligne-sequence"><span class="mono">${aCompleter && i === 0 ? 'Solution' : i + 1} · ${esc(textesSequences[i] || '…')}</span>
      <button class="lien-bouton" type="button" data-modifier-seq="${i}">Modifier</button>
      <button class="mini-bouton retirer" type="button" data-retirer-seq="${i}" aria-label="Retirer la séquence ${i + 1}">×</button></div>`).join('');
    const depart = !aCompleter ? '' : `<label class="petit-label">Programme de départ : la solution avec des trous</label>
      ${d.depart ? `<div class="ligne-sequence"><span class="mono">${esc(texteDepart || '…')}</span>
        <button class="lien-bouton" type="button" data-preparer-trous>Modifier les trous</button></div>`
        : `<p class="aide">${d.sequences.length ? 'Pas encore de trous.' : 'Assemblez d\'abord la solution complète.'}</p>`}
      ${!d.depart && d.sequences.length ? '<button class="lien-bouton" type="button" data-preparer-trous>+ Préparer les trous (dans Blockly)</button>' : ''}
      <span class="aide">Trous possibles : bloc manquant, nombre à écrire (temps, angle, nombre de fois, valeur de CHOIX), menu à choisir (broche, HAUT / BAS, = / ≠), condition à placer. Le reste du programme est verrouillé pour l'élève.</span>`;
    return `<label class="petit-label">${aCompleter ? 'Blocs de la palette, pour remplir les trous (ajoutez des blocs pièges ; aucun si seules des valeurs sont à compléter)' : 'Blocs proposés à l\'élève (module du distributeur de céréales)'}</label>
      <div class="puces-blocs">${Admin.banque.blocsDisponibles.map((b) => `<button type="button" class="puce-bloc ${d.blocs.includes(b) ? 'actif' : ''}" data-bloc="${b}"
        style="background:${BLOCS[b][1]}" aria-pressed="${d.blocs.includes(b)}">${BLOCS[b][0]}</button>`).join('')}</div>
      <div class="ligne-mode">Broches :
        <button type="button" class="puce-filtre ${!d.broches ? 'actif' : ''}" data-broches="0">Sans (logique seule)</button>
        <button type="button" class="puce-filtre ${d.broches ? 'actif' : ''}" data-broches="1">Avec choix de la broche (LED, bouton, servo)</button></div>
      ${d.broches ? '<span class="aide">L\'élève choisit la broche dans un menu (D2 à D13 ; servo D5 ou D6) : indiquez le branchement dans l\'énoncé, et choisissez la bonne broche dans chaque séquence.</span>' : ''}
      <label class="petit-label">${aCompleter ? 'Solution : le programme complet (et ses variantes acceptées)' : 'Séquences acceptées'}</label>
      ${sequences || `<p class="aide">Aucune séquence pour l'instant : assemblez la bonne réponse.</p>`}
      <button class="lien-bouton" type="button" data-ajouter-seq>+ Ajouter ${d.sequences.length ? 'une variante' : aCompleter ? 'la solution' : 'la bonne réponse'} (assembler dans Blockly)</button>
      ${depart}
      <span class="aide">Écritures équivalentes déjà acceptées : « si bouton », « si bouton = HAUT », « si bouton ≠ BAS ».</span>`;
  }

  // Le nombre de trous suit le programme : on garde les réponses déjà saisies.
  function synchroniserTrous() {
    const d = brouillon.donnees;
    const n = (d.texte.match(/___/g) || []).length;
    while (d.trous.length < n) d.trous.push({ bonne: '', distracteurs: [] });
    d.trous.length = Math.min(d.trous.length, n);
  }

  // ---------- Sauvegarde automatique ----------
  function modification({ redessiner = false, delai = 900 } = {}) {
    modifie = true;
    statut = { texte: 'Modifications en cours…', type: '' };
    if (redessiner) { el('#bloc-type').innerHTML = blocType(brouillon); }
    rendreStatut();
    clearTimeout(minuterie);
    minuterie = setTimeout(enregistrer, delai);
  }

  async function enregistrer() {
    clearTimeout(minuterie);
    if (!brouillon || !modifie) return enregistrement;
    if (enregistrement) await enregistrement;
    modifie = false;
    const envoi = copie(brouillon);
    enregistrement = Admin.envoyer('question:enregistrer', { question: envoi }).then((r) => {
      enregistrement = null;
      if (!r.ok) { modifie = true; statut = { texte: r.erreur, type: 'erreur' }; rendreStatut(); return r; }
      const nouvelle = !brouillon.id;
      if (brouillon && (brouillon.id === r.question.id || nouvelle)) {
        brouillon.id = r.question.id;
        statut = r.probleme ? { texte: `Enregistrée, mais incomplète : ${r.probleme}. Elle ne sera pas posée.`, type: 'attention' } : { texte: 'Enregistrée', type: 'ok' };
        if (nouvelle) rendreEditeur(); else rendreStatut();
      }
      return r;
    });
    return enregistrement;
  }

  // ---------- Événements de l'éditeur ----------
  const zone = el('#editeur-q');
  zone.addEventListener('input', (ev) => {
    const t = ev.target;
    if (!brouillon) return;
    const d = brouillon.donnees;
    if (['titre', 'enonce', 'explication'].includes(t.dataset.champ)) brouillon[t.dataset.champ] = t.value;
    else if (t.dataset.champ === 'duree_s') brouillon.duree_s = t.value === '' ? null : Number(t.value);
    else if (t.dataset.qcm !== undefined) d.choix[Number(t.dataset.qcm)] = t.value;
    else if (t.dataset.ordre !== undefined) d.elements[Number(t.dataset.ordre)] = t.value;
    else if (t.dataset.paire !== undefined) d.paires[Number(t.dataset.paire)][t.dataset.cote] = t.value;
    else if (t.dataset.calcul) d[t.dataset.calcul] = t.value;
    else if (t.dataset.completer === 'texte') {
      d.texte = t.value;
      const avant = d.trous.length;
      synchroniserTrous();
      if (d.trous.length !== avant) {
        // Nouveau trou : on redessine sans perdre le curseur dans le programme.
        const pos = t.selectionStart;
        modification({ redessiner: true });
        const prog = el('#champ-programme');
        prog.focus();
        prog.setSelectionRange(pos, pos);
        return;
      }
    } else if (t.dataset.champTrou) {
      const trou = d.trous[Number(t.dataset.trou)];
      if (t.dataset.champTrou === 'bonne') trou.bonne = t.value;
      else trou.distracteurs = t.value.split('\n').map((x) => x.trim()).filter(Boolean);
    } else return;
    modification();
  });
  zone.addEventListener('change', (ev) => {
    const t = ev.target;
    if (!brouillon) return;
    if (t.name === 'bonne-qcm') { brouillon.donnees.bonne = Number(t.value); modification({ redessiner: true, delai: 200 }); }
    if (t.dataset.champ === 'niveau') { brouillon.niveau = t.value; modification({ delai: 200 }); }
    if (t.dataset.champ === 'bonus') { brouillon.bonus = Number(t.value); modification({ delai: 200 }); }
  });

  zone.addEventListener('click', async (ev) => {
    const c = (sel) => ev.target.closest(sel);
    if (c('[data-nouvelle]')) { nouvelle(); return; }
    if (!brouillon) return;
    const d = brouillon.donnees;
    const b = c('[data-type]');
    if (b && b.dataset.type !== brouillon.type) {
      const rempli = JSON.stringify(d) !== JSON.stringify(DEFAUTS[brouillon.type]());
      if (rempli && !confirm('Changer de type efface les réponses de cette question (l\'énoncé est gardé). Continuer ?')) return;
      brouillon.type = b.dataset.type;
      brouillon.donnees = DEFAUTS[brouillon.type]();
      textesSequences = [];
      rendreEditeur();
      modification({ delai: 200 });
      return;
    }
    if (c('[data-ajouter-paire]')) { d.paires.push({ gauche: '', droite: '' }); modification({ redessiner: true }); el(`[data-paire="${d.paires.length - 1}"]`).focus(); }
    const rp = c('[data-retirer-paire]');
    if (rp) { d.paires.splice(Number(rp.dataset.retirerPaire), 1); modification({ redessiner: true, delai: 300 }); }
    if (c('[data-ajouter-etape]')) { d.elements.push(''); modification({ redessiner: true }); el(`[data-ordre="${d.elements.length - 1}"]`).focus(); }
    const r = c('[data-retirer-etape]');
    if (r) { d.elements.splice(Number(r.dataset.retirerEtape), 1); modification({ redessiner: true, delai: 300 }); }
    const m = c('[data-monter]') || c('[data-descendre]');
    if (m) {
      const i = Number(m.dataset.monter ?? m.dataset.descendre);
      const j = m.dataset.monter !== undefined ? i - 1 : i + 1;
      [d.elements[i], d.elements[j]] = [d.elements[j], d.elements[i]];
      modification({ redessiner: true, delai: 300 });
    }
    const bloc = c('[data-bloc]');
    if (bloc) {
      const k = bloc.dataset.bloc;
      d.blocs = d.blocs.includes(k) ? d.blocs.filter((x) => x !== k) : [...d.blocs, k];
      modification({ redessiner: true, delai: 300 });
    }
    const v = c('[data-version]');
    if (v && v.dataset.version !== (d.version || 'texte')) {
      const rempli = JSON.stringify(d) !== JSON.stringify(d.version === 'blocs' ? COMPLETER_BLOCS() : DEFAUTS.completer());
      if (rempli && !confirm('Changer de version efface le programme et les réponses de cette question (l\'énoncé est gardé). Continuer ?')) return;
      brouillon.donnees = v.dataset.version === 'blocs' ? COMPLETER_BLOCS() : DEFAUTS.completer();
      textesSequences = [];
      texteDepart = '';
      modification({ redessiner: true, delai: 200 });
      return;
    }
    const br = c('[data-broches]');
    if (br) { d.broches = br.dataset.broches === '1'; modification({ redessiner: true, delai: 300 }); }
    if (c('[data-preparer-trous]')) editerDepart();
    const mode = c('[data-mode]');
    if (mode) { d.mode = mode.dataset.mode; modification({ redessiner: true, delai: 300 }); }
    if (c('[data-ajouter-seq]')) editerSequence(null);
    const ms = c('[data-modifier-seq]');
    if (ms) editerSequence(Number(ms.dataset.modifierSeq));
    const rs = c('[data-retirer-seq]');
    if (rs) { const i = Number(rs.dataset.retirerSeq); d.sequences.splice(i, 1); textesSequences.splice(i, 1); modification({ redessiner: true, delai: 300 }); }

    if (c('[data-retirer-image]')) { ev.stopPropagation(); brouillon.image = null; rendreEditeur(); modification({ delai: 200 }); return; }
    if (c('#depot-image') && !brouillon.image) el('#fichier-image').click();
    if (c('[data-enregistrer]')) {
      modifie = true;
      const rep = await enregistrer();
      if (rep && rep.ok) Admin.bandeau(rep.probleme ? `Question enregistrée, mais incomplète : ${rep.probleme}.` : 'Question enregistrée.', Boolean(rep.probleme));
    }
    if (c('[data-dupliquer]')) {
      await enregistrer();
      const rep = await Admin.action('question:dupliquer', { id: brouillon.id }, 'Question dupliquée : vous modifiez maintenant la copie.');
      if (rep.ok) attendreEtChoisir(rep.question.id);
    }
    if (c('[data-supprimer]')) {
      const u = (Admin.banque.questions.find((x) => x.id === brouillon.id) || {}).utilisations || 0;
      if (!confirm(`Supprimer cette question${u ? ` ? Elle sera aussi retirée de ${u} parcours` : ''} ? Cette action est définitive (une copie de sécurité du jour reste dans data/sauvegardes).`)) return;
      clearTimeout(minuterie);
      modifie = false;
      const rep = await Admin.action('question:supprimer', { id: brouillon.id }, 'Question supprimée.');
      if (rep.ok) { brouillon = null; rendreEditeur(); }
    }
    if (c('[data-apercu]')) apercu();
  });
  zone.addEventListener('keydown', (ev) => {
    if (ev.target.id === 'depot-image' && (ev.key === 'Enter' || ev.key === ' ')) { ev.preventDefault(); if (!brouillon.image) el('#fichier-image').click(); }
  });

  // ---------- Image ----------
  async function envoyerImage(fichier) {
    if (!fichier) return;
    if (fichier.size > 800 * 1024) { Admin.bandeau(`Image trop lourde (${Math.round(fichier.size / 1024)} Ko) : 800 Ko au plus.`, true); return; }
    const rep = await Admin.action('image:envoyer', { donnees: await fichier.arrayBuffer() });
    if (rep.ok && brouillon) { brouillon.image = rep.chemin; rendreEditeur(); modification({ delai: 200 }); }
  }
  zone.addEventListener('change', (ev) => { if (ev.target.id === 'fichier-image') envoyerImage(ev.target.files[0]); });
  zone.addEventListener('dragover', (ev) => { const z = ev.target.closest('#depot-image'); if (z) { ev.preventDefault(); z.classList.add('survol'); } });
  zone.addEventListener('dragleave', (ev) => { const z = ev.target.closest('#depot-image'); if (z) z.classList.remove('survol'); });
  zone.addEventListener('drop', (ev) => {
    const z = ev.target.closest('#depot-image');
    if (!z) return;
    ev.preventDefault();
    z.classList.remove('survol');
    envoyerImage(ev.dataTransfer.files[0]);
  });

  // ---------- Séquences de blocs : assemblées dans Blockly ----------
  async function editerSequence(i) {
    const d = brouillon.donnees;
    const aCompleter = estCompleterBlocs(brouillon);
    if (!aCompleter && !d.blocs.length) { Admin.bandeau('Choisissez d\'abord les blocs proposés à l\'élève.', true); return; }
    const m = Admin.modale({
      titre: i === null ? 'Assembler une séquence acceptée' : `Modifier la séquence ${i + 1}`,
      plein: true,
      contenu: `<p class="aide">${aCompleter ? 'Assemblez le programme complet, sans trou' : 'Assemblez la réponse attendue sous « Programme », avec les blocs proposés à l\'élève'}${d.broches ? ', en choisissant la bonne broche de chaque bloc' : ''}.</p>
        <div class="zone-blocs zone-blocs-admin" id="zone-blocs-admin"><p class="chargement-blocs">Chargement des blocs…</p></div>
        <p class="erreur" id="erreur-seq" hidden></p>
        <div class="actions-modale"><button class="btn" type="button" data-fermer-seq>Annuler</button>
          <button class="btn btn-primaire" type="button" data-valider-seq>${i === null ? 'Ajouter cette séquence' : 'Enregistrer la séquence'}</button></div>`,
    });
    let editeur = null;
    Admin.surFermeture = () => { if (editeur) editeur.detruire(); };
    try {
      await RR.blocs.charger();
      const zoneB = m.querySelector('#zone-blocs-admin');
      zoneB.innerHTML = '';
      editeur = RR.blocs.creer(zoneB, aCompleter ? Admin.banque.blocsDisponibles : d.blocs, { broches: d.broches });
      if (i !== null) {
        const rep = await Admin.envoyer('blocs:versBlockly', { sequence: d.sequences[i] });
        if (rep.ok) editeur.charger(rep.sauvegarde);
      }
    } catch {
      m.querySelector('#zone-blocs-admin').innerHTML = '<p class="erreur">Les blocs n\'ont pas pu se charger. Actualisez la page.</p>';
    }
    m.querySelector('[data-fermer-seq]').addEventListener('click', () => Admin.fermerModale());
    m.querySelector('[data-valider-seq]').addEventListener('click', async () => {
      if (!editeur) return;
      const rep = await Admin.envoyer('blocs:lire', { sauvegarde: editeur.sauvegarder() });
      const err = m.querySelector('#erreur-seq');
      const montrer = (t) => { err.hidden = false; err.textContent = t; };
      if (!rep.ok) { montrer(rep.erreur); return; }
      if (!rep.sequence.length) { montrer('Le programme est vide : accrochez des blocs sous « Programme ».'); return; }
      if (rep.incomplets) { montrer('Un bloc a une case vide (condition ou nombre) : complétez-la.'); return; }
      if (d.broches && rep.brochesManquantes) { montrer('Choisissez la broche de chaque bloc LED, bouton et servo.'); return; }
      if (i === null) { d.sequences.push(rep.sequence); textesSequences.push(rep.texte); } else { d.sequences[i] = rep.sequence; textesSequences[i] = rep.texte; }
      Admin.fermerModale();
      modification({ redessiner: true, delai: 200 });
      if (rep.horsProgramme) Admin.bandeau(`${rep.horsProgramme} bloc(s) hors du programme n'ont pas été pris en compte.`);
    });
  }

  // ---------- Programme de départ (à compléter) : la solution, avec des trous ----------
  async function editerDepart() {
    const d = brouillon.donnees;
    if (!d.sequences.length) { Admin.bandeau('Assemblez d\'abord la solution complète.', true); return; }
    const m = Admin.modale({
      titre: 'Préparer les trous',
      plein: true,
      contenu: `<p class="aide">Transformez la solution en programme à compléter :
        <b>bloc manquant</b> : supprimez le bloc et glissez « ? bloc manquant » à sa place ·
        <b>nombre</b> : cliquez dessus et écrivez <b>?</b> ·
        <b>menu</b> (broche, HAUT / BAS, = / ≠) : choisissez <b>?</b> ·
        <b>condition</b> : retirez-la, la case reste vide.
        Le reste sera verrouillé pour l'élève.</p>
        <div class="zone-blocs zone-blocs-admin" id="zone-blocs-admin"><p class="chargement-blocs">Chargement des blocs…</p></div>
        <p class="erreur" id="erreur-seq" hidden></p>
        <div class="actions-modale"><button class="btn" type="button" data-fermer-seq>Annuler</button>
          <button class="btn" type="button" data-repartir>Repartir de la solution</button>
          <button class="btn btn-primaire" type="button" data-valider-seq>Enregistrer les trous</button></div>`,
    });
    let editeur = null;
    Admin.surFermeture = () => { if (editeur) editeur.detruire(); };
    const chargerProgramme = async (sequence) => {
      const rep = await Admin.envoyer('blocs:versBlockly', { sequence });
      if (rep.ok && editeur) editeur.charger(rep.sauvegarde);
    };
    try {
      await RR.blocs.charger();
      const zoneB = m.querySelector('#zone-blocs-admin');
      zoneB.innerHTML = '';
      editeur = RR.blocs.creer(zoneB, Admin.banque.blocsDisponibles, { broches: d.broches, trous: true, blocManquant: true });
      await chargerProgramme(d.depart || d.sequences[0]);
    } catch {
      m.querySelector('#zone-blocs-admin').innerHTML = '<p class="erreur">Les blocs n\'ont pas pu se charger. Actualisez la page.</p>';
    }
    m.querySelector('[data-fermer-seq]').addEventListener('click', () => Admin.fermerModale());
    m.querySelector('[data-repartir]').addEventListener('click', () => chargerProgramme(d.sequences[0]));
    m.querySelector('[data-valider-seq]').addEventListener('click', async () => {
      if (!editeur) return;
      const rep = await Admin.envoyer('blocs:lire', { sauvegarde: editeur.sauvegarder() });
      const err = m.querySelector('#erreur-seq');
      const montrer = (t) => { err.hidden = false; err.textContent = t; };
      if (!rep.ok) { montrer(rep.erreur); return; }
      if (!rep.sequence.length) { montrer('Le programme est vide.'); return; }
      if (!rep.incomplets) { montrer('Aucun trou pour l\'instant : créez au moins un trou (voir ci-dessus).'); return; }
      d.depart = rep.sequence;
      texteDepart = rep.texte;
      Admin.fermerModale();
      modification({ redessiner: true, delai: 200 });
      Admin.bandeau(`Programme à compléter enregistré : ${rep.incomplets} trou${rep.incomplets > 1 ? 's' : ''}.`);
    });
  }

  // ---------- Aperçu élève ----------
  async function apercu() {
    const rep = await Admin.envoyer('apercu:preparer', { question: brouillon });
    if (!rep.ok) { Admin.bandeau(rep.erreur, true); return; }
    const m = Admin.modale({
      titre: 'Aperçu élève',
      large: true,
      plein: brouillon.type === 'blocs' || estCompleterBlocs(brouillon),
      contenu: `<iframe class="cadre-apercu" id="cadre-apercu" src="/apercu.html?v=8" title="Aperçu de la question telle que l'élève la voit"></iframe>
        <div class="actions-modale"><span class="aide">L'aperçu valide la réponse comme en partie, sans rien enregistrer.</span>
          <button class="btn" type="button" data-recommencer>Recommencer</button></div>`,
    });
    const cadre = m.querySelector('#cadre-apercu');
    const lancer = (question) => cadre.contentWindow.demarrerApercu(question, (reponse) => Admin.envoyer('apercu:repondre', { reponse }));
    cadre.addEventListener('load', () => lancer(rep.question));
    m.querySelector('[data-recommencer]').addEventListener('click', async () => {
      const r2 = await Admin.envoyer('apercu:preparer', { question: brouillon });
      if (r2.ok) lancer(r2.question); else Admin.bandeau(r2.erreur, true);
    });
  }

  // ---------- Liste : clics, recherche, filtres ----------
  async function attendreEtChoisir(id) {
    // La nouvelle banque arrive juste après la réponse du serveur.
    for (let k = 0; k < 20 && !Admin.banque.questions.some((q) => q.id === id); k++) await new Promise((r) => setTimeout(r, 50));
    choisir(id);
  }

  el('#lignes-q').addEventListener('click', async (ev) => {
    const l = ev.target.closest('[data-q]');
    if (!l) return;
    await enregistrer();
    choisir(l.dataset.q);
  });
  el('#btn-nouvelle-q').addEventListener('click', async () => { await enregistrer(); nouvelle(); });
  el('#recherche-q').addEventListener('input', (ev) => { recherche = ev.target.value.trim(); rendreListe(); });
  el('#filtres-q').addEventListener('click', (ev) => {
    const f = ev.target.closest('[data-filtre]');
    if (f) { filtreType = f.dataset.filtre; rendreFiltres(); rendreListe(); }
  });
  el('#filtres-q').addEventListener('change', (ev) => {
    if (ev.target.id === 'filtre-niveau') { filtreNiveau = ev.target.value; rendreListe(); }
  });

  // Une modification non enregistrée part avant de quitter l'onglet ou la page.
  window.addEventListener('onglet', () => { enregistrer(); });
  window.addEventListener('beforeunload', (ev) => { if (modifie) { enregistrer(); ev.preventDefault(); } });

  Admin.surBanque((b) => {
    rendreFiltres();
    rendreListe();
    if (!brouillon) { rendreEditeur(); return; }
    if (brouillon.id && !b.questions.some((q) => q.id === brouillon.id)) {
      // Supprimée (par exemple depuis une autre fenêtre).
      brouillon = null;
      rendreEditeur();
      return;
    }
    // Rien en cours ici : on reprend la version du serveur (modifiée ailleurs, ou complétée par l'import).
    const q = b.questions.find((x) => x.id === brouillon.id);
    if (q && !modifie && !enregistrement && !zone.contains(document.activeElement)) {
      textesSequences = (q.apercuSequences || []).slice();
      texteDepart = q.apercuDepart || '';
      if (q.probleme) statut = { texte: `Incomplète : ${q.probleme}. Elle ne sera pas posée.`, type: 'attention' };
    }
  });

  /** Ouvre une question dans l'éditeur (depuis l'onglet Parcours). */
  Admin.ouvrirQuestion = async (id) => { await enregistrer(); location.hash = '#questions'; choisir(id); };
})();
