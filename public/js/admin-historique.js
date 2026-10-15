/* Admin · onglet Historique : liste des parties jouées, bilan d'une partie (classement, bilan par question),
 * bilan cumulé d'une classe pour suivre les acquis, export CSV (Excel, LibreOffice).
 * Aucun pseudo d'élève n'est enregistré : seulement les équipes et les questions.
 */
'use strict';

(() => {
  const { esc, el } = RR;
  const TYPES = { qcm: 'QCM', ordre: 'Ordre', calcul: 'Calcul', blocs: 'Blocs', completer: 'À compléter', relier: 'Relier' };
  const RAISONS = { temps: 'temps écoulé', arrivee: 'arrivée d\'une équipe', arret: 'arrêtée par le professeur' };
  const SEUILS = [[80, 'acquis', 'Acquis'], [50, 'en-cours', 'En cours'], [0, 'a-revoir', 'À revoir']];

  let donnees = { parties: [], classes: [] };
  let filtreClasse = '';
  let choix = null; // { type: 'partie', id } ou { type: 'cumul', classe }
  let ouvert = null; // partie ou cumul affiché

  const date = (iso, court = false) => new Date(iso).toLocaleString('fr-FR', court
    ? { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' } : { dateStyle: 'full', timeStyle: 'short' });
  const minutes = (ms) => `${Math.round(ms / 60000)} min`;
  const repondues = (b) => b.justes + b.fausses + b.tempsEcoules;
  const taux = (b) => (repondues(b) ? Math.round((100 * b.justes) / repondues(b)) : null);
  const niveau = (t) => (t === null ? null : SEUILS.find(([min]) => t >= min));
  const libelleQ = (b) => b.titre || b.enonce || b.id;
  const typeQ = (b) => (b.type === 'completer' && b.version === 'blocs' ? 'Blocs à compléter' : TYPES[b.type] || b.type);

  // ----- Données -----
  async function charger() {
    const rep = await Admin.envoyer('historique:liste', {});
    if (rep.ok) recevoir(rep);
  }
  function recevoir(d) {
    donnees = d;
    el('#liste-classes-h').innerHTML = d.classes.map((c) => `<option value="${esc(c)}"></option>`).join('');
    if (filtreClasse && !d.classes.includes(filtreClasse)) filtreClasse = '';
    rendreListe();
    if (choix && choix.type === 'partie' && !d.parties.some((p) => p.id === choix.id)) { choix = null; ouvert = null; rendreDetail(); }
  }

  // ----- Liste -----
  function rendreListe() {
    const parties = donnees.parties.filter((p) => !filtreClasse || p.classe === filtreClasse);
    el('#filtre-classe-h').innerHTML = `<option value="">Toutes les classes</option>
      ${donnees.classes.map((c) => `<option ${c === filtreClasse ? 'selected' : ''}>${esc(c)}</option>`).join('')}`;
    const cumul = parties.length > 1
      ? `<button type="button" class="ligne-h cumul ${choix && choix.type === 'cumul' ? 'choisie' : ''}" data-cumul>
          <b>Bilan cumulé${filtreClasse ? ` · ${esc(filtreClasse)}` : ' · toutes les classes'}</b>
          <span class="gris">${parties.length} parties : acquis question par question</span></button>` : '';
    el('#lignes-h').innerHTML = cumul + (parties.map((p) => {
      const n = niveau(p.reussite);
      return `<button type="button" class="ligne-h ${choix && choix.id === p.id ? 'choisie' : ''}" data-partie="${esc(p.id)}">
        <span class="haut"><b>${esc(p.titre || p.parcours || 'Partie')}</b>${p.classe ? `<span class="puce-classe">${esc(p.classe)}</span>` : ''}</span>
        <span class="bas gris">${esc(date(p.date, true))} · ${p.nbEleves} élèves · ${p.titre && p.parcours ? `${esc(p.parcours)} · ` : ''}
          ${p.gagnants.map((g) => `<span class="pastille-e" style="background:${esc(g.couleur)}"></span>${esc(g.nom)}`).join(', ')}</span>
        ${p.reussite !== null ? `<span class="taux ${n[1]}">${p.reussite} %</span>` : ''}</button>`;
    }).join('') || '<p class="vide-liste">Aucune partie pour l\'instant. Le bilan de chaque partie terminée apparaît ici.</p>');
  }

  // ----- Bilan par question (commun à une partie et au cumul) -----
  function tableQuestions(questions, avecEquipes) {
    const tri = questions.slice().sort((a, b) => (taux(a) ?? 101) - (taux(b) ?? 101));
    return `<table class="table-h">
      <thead><tr><th>Question</th><th>Type</th><th class="nb">Posée</th><th>Réussite</th><th class="nb">Justes</th><th class="nb">Fausses</th><th class="nb">Temps<br>écoulé</th></tr></thead>
      <tbody>${tri.map((b) => {
        const t = taux(b);
        const n = niveau(t);
        const equipes = avecEquipes && b.parEquipe ? Object.entries(b.parEquipe).map(([nom, v]) => `${nom} : ${v.justes}/${repondues(v)}`).join(' · ') : '';
        return `<tr><td class="q" title="${esc(b.enonce || '')}">${esc(libelleQ(b))}${equipes ? `<span class="par-equipe">${esc(equipes)}</span>` : ''}</td>
          <td class="gris">${esc(typeQ(b))}</td><td class="nb">${b.posees}</td>
          <td>${t === null ? '<span class="gris">sans réponse</span>' : `<span class="barre-h ${n[1]}"><span style="width:${t}%"></span></span><b>${t} %</b>`}</td>
          <td class="nb">${b.justes}</td><td class="nb">${b.fausses}</td><td class="nb">${b.tempsEcoules}</td></tr>`;
      }).join('')}</tbody></table>`;
  }

  function resumeAcquis(questions) {
    const compte = { acquis: 0, 'en-cours': 0, 'a-revoir': 0 };
    for (const b of questions) { const n = niveau(taux(b)); if (n) compte[n[1]]++; }
    return `<div class="acquis">${SEUILS.map(([min, cle, nom]) => `<span class="puce-acquis ${cle}"><b>${compte[cle]}</b> ${nom}
      <span class="gris">(${cle === 'acquis' ? '80 % et plus' : cle === 'en-cours' ? '50 à 79 %' : 'moins de 50 %'})</span></span>`).join('')}</div>`;
  }

  // ----- Détail -----
  function rendreDetail() {
    const zone = el('#detail-h');
    if (!ouvert) {
      zone.innerHTML = '<div class="editeur-vide"><p>Choisissez une partie pour voir son bilan : classement des équipes et réussite question par question.</p></div>';
      return;
    }
    if (choix.type === 'cumul') {
      const c = ouvert;
      zone.innerHTML = `<div class="tete-h"><div><b class="titre-editeur">Bilan cumulé${c.classe ? ` · ${esc(c.classe)}` : ''}</b>
          <p class="gris">${c.nbParties} parties, du ${esc(date(c.premiere, true))} au ${esc(date(c.derniere, true))} · questions les moins réussies en premier</p></div>
          <div class="actions"><button class="btn" type="button" data-csv>Exporter (tableur)</button></div></div>
        ${resumeAcquis(c.questions)}
        ${tableQuestions(c.questions, false)}`;
      return;
    }
    const p = ouvert;
    zone.innerHTML = `<div class="tete-h"><div>
        <div class="titre-modifiable"><input id="titre-h" value="${esc(p.titre || '')}" maxlength="80" placeholder="${esc(p.parcours ? p.parcours.nom : 'Titre de la partie')}" aria-label="Titre de la partie">
          <input id="classe-h" value="${esc(p.classe || '')}" maxlength="30" placeholder="Classe" aria-label="Classe" list="liste-classes-h"></div>
        <p class="gris">${esc(date(p.date))} · ${minutes(p.dureeMs)} (${esc(RAISONS[p.raison] || p.raison)}) · parcours ${esc(p.parcours ? p.parcours.nom : '—')} · ${p.nbEleves} élèves</p></div>
        <div class="actions"><button class="btn" type="button" data-csv>Exporter (tableur)</button>
          <button class="lien-bouton danger" type="button" data-supprimer-h>Supprimer</button></div></div>
      <h3>Classement</h3>
      <table class="table-h classement-h"><thead><tr><th class="nb">Rang</th><th>Équipe</th><th class="nb">Cases</th><th class="nb">Justes</th><th class="nb">Fausses</th><th>Réussite</th><th class="nb">Attaques</th><th class="nb">Solutions</th><th class="nb">Élèves</th></tr></thead>
        <tbody>${p.equipes.map((e) => {
          const t = taux({ justes: e.justes, fausses: e.fausses || 0, tempsEcoules: 0 });
          return `<tr><td class="nb"><b>${e.rang}</b></td><td><span class="pastille-e" style="background:${esc(e.couleur)}"></span>${esc(e.nom)}</td>
            <td class="nb">${e.position}</td><td class="nb">${e.justes}</td><td class="nb">${e.fausses ?? '—'}</td><td>${t === null ? '—' : `${t} %`}</td>
            <td class="nb">${e.attaques ?? '—'}</td><td class="nb">${e.solutions ?? '—'}</td><td class="nb">${e.nbEleves ?? '—'}</td></tr>`;
        }).join('')}</tbody></table>
      <h3>Bilan par question <span class="gris">· les moins réussies en premier</span></h3>
      ${resumeAcquis(p.questions)}
      ${tableQuestions(p.questions, true)}`;
  }

  async function ouvrirPartie(id) {
    const rep = await Admin.envoyer('historique:detail', { id });
    if (!rep.ok) { Admin.bandeau(rep.erreur, true); return; }
    choix = { type: 'partie', id };
    ouvert = rep.partie;
    rendreListe();
    rendreDetail();
  }
  async function ouvrirCumul() {
    const rep = await Admin.envoyer('historique:cumul', { classe: filtreClasse || null });
    if (!rep.ok) { Admin.bandeau(rep.erreur, true); return; }
    choix = { type: 'cumul', classe: filtreClasse || null };
    ouvert = rep.cumul;
    rendreListe();
    rendreDetail();
  }

  // ----- Export CSV (point-virgule et BOM : s'ouvre directement dans Excel en français) -----
  function exporterCsv() {
    const cellule = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lignes = [];
    if (choix.type === 'partie') {
      const p = ouvert;
      lignes.push([`Partie : ${p.titre || (p.parcours && p.parcours.nom) || ''}`, p.classe || '', date(p.date)]);
      lignes.push([]);
      lignes.push(['Rang', 'Équipe', 'Cases', 'Justes', 'Fausses', 'Attaques', 'Solutions', 'Élèves']);
      for (const e of p.equipes) lignes.push([e.rang, e.nom, e.position, e.justes, e.fausses, e.attaques, e.solutions, e.nbEleves]);
      lignes.push([]);
    } else {
      lignes.push([`Bilan cumulé : ${ouvert.classe || 'toutes les classes'}`, `${ouvert.nbParties} parties`]);
      lignes.push([]);
    }
    lignes.push(['Question', 'Énoncé', 'Type', 'Posée', 'Justes', 'Fausses', 'Temps écoulé', 'Réussite (%)']);
    for (const b of ouvert.questions.slice().sort((a, c) => (taux(a) ?? 101) - (taux(c) ?? 101))) {
      lignes.push([b.titre || '', b.enonce || '', typeQ(b), b.posees, b.justes, b.fausses, b.tempsEcoules, taux(b) ?? '']);
    }
    const csv = `﻿${lignes.map((l) => l.map(cellule).join(';')).join('\r\n')}`;
    const nom = `robot-rush-bilan-${(choix.type === 'partie' ? (ouvert.titre || ouvert.classe || 'partie') : (ouvert.classe || 'cumul'))}-${new Date().toISOString().slice(0, 10)}.csv`
      .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w.-]+/g, '-').toLowerCase();
    const lien = document.createElement('a');
    lien.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    lien.download = nom;
    document.body.appendChild(lien);
    lien.click();
    lien.remove();
    setTimeout(() => URL.revokeObjectURL(lien.href), 2000);
  }

  // ----- Événements -----
  el('#lignes-h').addEventListener('click', (ev) => {
    const p = ev.target.closest('[data-partie]');
    if (p) ouvrirPartie(p.dataset.partie);
    if (ev.target.closest('[data-cumul]')) ouvrirCumul();
  });
  el('#filtre-classe-h').addEventListener('change', (ev) => {
    filtreClasse = ev.target.value;
    if (choix && choix.type === 'cumul') ouvrirCumul(); else rendreListe();
  });
  el('#detail-h').addEventListener('click', async (ev) => {
    if (ev.target.closest('[data-csv]')) exporterCsv();
    if (ev.target.closest('[data-supprimer-h]')) {
      if (!confirm('Supprimer le bilan de cette partie ? Il ne sera plus compté dans le bilan cumulé.')) return;
      const rep = await Admin.action('historique:supprimer', { id: ouvert.id }, 'Bilan supprimé.');
      if (rep.ok) { choix = null; ouvert = null; rendreDetail(); }
    }
  });
  // Titre et classe d'une partie jouée : enregistrés en quittant le champ.
  el('#detail-h').addEventListener('change', async (ev) => {
    if (!ouvert || choix.type !== 'partie') return;
    const champ = ev.target.id === 'titre-h' ? 'titre' : ev.target.id === 'classe-h' ? 'classe' : null;
    if (!champ) return;
    const rep = await Admin.envoyer('historique:modifier', { id: ouvert.id, [champ]: ev.target.value });
    if (rep.ok) { ouvert[champ] = ev.target.value.trim() || null; Admin.bandeau(champ === 'titre' ? 'Titre enregistré.' : 'Classe enregistrée.'); }
    else Admin.bandeau(rep.erreur, true);
  });

  Admin.ecouter('historique', recevoir);
  Admin.ecouter('admin:donnees', () => charger());
  window.addEventListener('onglet', (ev) => { if (ev.detail === 'historique') charger(); });
  rendreDetail();
})();
