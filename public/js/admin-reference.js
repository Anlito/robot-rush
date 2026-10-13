/* Admin · banque de référence sur GitHub : « Publier mes questions » (ordinateur du professeur)
 * et « Récupérer les questions publiées » (Raspberry Pi, version en ligne, autre ordinateur).
 * Le jeton GitHub est collé ici par le professeur, envoyé une fois au serveur, et jamais renvoyé au navigateur.
 */
'use strict';

(() => {
  const { esc, el } = RR;
  const date = (iso) => (iso ? new Date(iso).toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' }) : '');
  const compte = (r) => `${r.questions} question${r.questions > 1 ? 's' : ''} et ${r.parcours} parcours`;
  const ref = () => (Admin.banque && Admin.banque.reference) || {};

  // ----- Bouton de l'en-tête et bandeau « nouvelle banque disponible » -----
  function majEntete() {
    const r = ref();
    const b = el('#btn-publier');
    b.textContent = r.publication ? 'Publier mes questions' : 'Récupérer les questions publiées';
    b.classList.toggle('a-publier', Boolean(r.publication && r.relie && r.nonPubliee));
    b.title = r.publication && r.nonPubliee ? 'Des modifications ne sont pas encore publiées' : '';
    const bandeau = el('#bandeau-reference');
    bandeau.hidden = !r.enAttente;
    if (r.enAttente) {
      bandeau.innerHTML = `<b>Banque publiée disponible</b> (${compte(r.enAttente)}${r.enAttente.publieLe ? `, publiée le ${esc(date(r.enAttente.publieLe))}` : ''}) :
        elle n'a pas remplacé les questions de cet ordinateur. <button class="lien-bouton" type="button" data-ouvrir-reference>Voir</button>`;
    }
  }
  Admin.surBanque(majEntete);
  el('#btn-publier').addEventListener('click', () => ouvrir());
  el('#bandeau-reference').addEventListener('click', (ev) => { if (ev.target.closest('[data-ouvrir-reference]')) ouvrir(); });

  // ----- Fenêtre -----
  function ouvrir() {
    const r = ref();
    const etat = r.derniere
      ? `Dernière synchronisation : <b>${esc(r.derniere.origine)}</b> le ${esc(date(r.derniere.date))}.${r.publication && r.nonPubliee ? ' <b>Des modifications ne sont pas encore publiées.</b>' : ''}`
      : 'Cet ordinateur n\'a encore ni publié ni récupéré de banque.';
    const blocPublier = !r.publication ? '' : r.relie
      ? `<div class="carte-ref"><b>Publier mes questions</b>
          <span>Envoie les questions, parcours et images de cet ordinateur sur GitHub (dépôt <code>${esc(r.depot)}</code>).
          La Raspberry Pi les récupère à son prochain démarrage avec internet, la version en ligne à son redémarrage (2 à 3 minutes).</span>
          <div class="actions-ref"><button class="btn btn-primaire" type="button" data-publier>Publier maintenant</button>
          <button class="lien-bouton" type="button" data-delier>Délier GitHub</button></div></div>`
      : `<div class="carte-ref"><b>Relier cet ordinateur à GitHub (une seule fois)</b>
          <ol class="etapes-ref">
            <li>Ouvrir <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener">github.com → nouveau jeton</a> (connecté à votre compte).</li>
            <li><b>Token name</b> : Robot Rush · <b>Expiration</b> : 1 an (ou plus).</li>
            <li><b>Repository access</b> : <i>Only select repositories</i> → <code>${esc(r.depot)}</code>.</li>
            <li><b>Permissions</b> → <b>Contents</b> : <i>Read and write</i>.</li>
            <li><b>Generate token</b>, copier le jeton (il commence par <code>github_pat_</code>) et le coller ici :</li>
          </ol>
          <div class="actions-ref"><input type="password" id="champ-jeton" class="mono" autocomplete="off" placeholder="github_pat_…" aria-label="Jeton GitHub">
            <button class="btn btn-primaire" type="button" data-relier>Relier</button></div>
          <span class="aide">Le jeton reste sur cet ordinateur (dossier des données) : il n'est jamais publié ni affiché.</span></div>`;
    const m = Admin.modale({
      titre: r.publication ? 'Publier mes questions' : 'Questions publiées',
      large: true,
      contenu: `<div class="fenetre-ref"><p class="aide">${etat}</p>
        ${blocPublier}
        <div class="carte-ref"><b>Récupérer les questions publiées</b>
          <span>Remplace les questions et parcours de ${r.publication ? 'cet ordinateur' : 'cette installation'} par la dernière banque publiée sur GitHub
          (pour repartir de l'existant sur un nouvel ordinateur, par exemple). Une copie de la banque actuelle est gardée dans <code>sauvegardes</code>.</span>
          <div class="actions-ref"><button class="btn" type="button" data-recuperer>Récupérer…</button></div></div>
        <p class="erreur" id="erreur-ref" hidden></p>
        <div class="actions-modale"><button class="btn" type="button" data-fermer-ref>Fermer</button></div></div>`,
    });
    const montrerErreur = (t) => { const e = m.querySelector('#erreur-ref'); e.hidden = !t; e.textContent = t || ''; };
    const occupe = (oui) => m.querySelectorAll('button').forEach((x) => { x.disabled = oui; });

    // La fenêtre (#modale) resservira : l'écouteur va sur son contenu, recréé à chaque ouverture.
    m.querySelector('.fenetre-ref').addEventListener('click', async (ev) => {
      const c = (s) => ev.target.closest(s);
      if (c('[data-fermer-ref]')) { Admin.fermerModale(); return; }
      if (c('[data-relier]')) {
        occupe(true);
        const rep = await Admin.envoyer('reference:relier', { jeton: m.querySelector('#champ-jeton').value });
        occupe(false);
        if (!rep.ok) { montrerErreur(rep.erreur); return; }
        Admin.bandeau(`Cet ordinateur est relié au dépôt ${rep.depot}.`);
        attendreBanque().then(ouvrir);
      }
      if (c('[data-delier]')) {
        if (!confirm('Délier GitHub ? Il faudra un nouveau jeton pour publier de nouveau.')) return;
        await Admin.envoyer('reference:delier', {});
        attendreBanque().then(ouvrir);
      }
      if (c('[data-publier]')) await publier(false);
      if (c('[data-recuperer]')) await recuperer();
    });

    async function publier(forcer) {
      occupe(true);
      montrerErreur('');
      const rep = await Admin.envoyer('reference:publier', { forcer });
      occupe(false);
      if (!rep.ok) { montrerErreur(rep.erreur); return; }
      if (rep.conflit) {
        const d = rep.distante;
        if (confirm(`La banque publiée sur GitHub a été modifiée depuis un autre ordinateur${d.publieLe ? ` (le ${date(d.publieLe)})` : ''} : ${compte(d)}.\n\nLa remplacer par celle de cet ordinateur ?\n(Annuler, puis « Récupérer… » pour repartir de celle de GitHub.)`)) await publier(true);
        return;
      }
      Admin.fermerModale();
      Admin.bandeau(rep.dejaAJour ? 'Rien de nouveau : la banque publiée est déjà celle de cet ordinateur.'
        : `Questions publiées : ${compte(rep)}. La version en ligne se met à jour dans 2 à 3 minutes ; la Raspberry Pi à son prochain démarrage avec internet.`);
    }

    async function recuperer() {
      occupe(true);
      montrerErreur('');
      const rep = await Admin.envoyer('reference:recuperer', { confirmer: false });
      occupe(false);
      if (!rep.ok) { montrerErreur(rep.erreur); return; }
      const a = rep.apercu;
      const b = Admin.banque;
      const texte = `Banque publiée${a.publieLe ? ` le ${date(a.publieLe)}` : ''} : ${compte(a)}.\n\n`
        + `Elle va remplacer les ${b.questions.length} questions et ${b.parcours.length} parcours d'ici.`
        + `${rep.nonPubliee && ref().publication ? '\nAttention : des modifications de cet ordinateur ne sont pas publiées, elles seront remplacées (une copie reste dans sauvegardes).' : ''}\n\nContinuer ?`;
      if (!confirm(texte)) return;
      occupe(true);
      const fin = await Admin.envoyer('reference:recuperer', { confirmer: true });
      occupe(false);
      if (!fin.ok) { montrerErreur(fin.erreur); return; }
      Admin.fermerModale();
      Admin.bandeau(`Questions récupérées : ${compte(fin.rapport)}.`);
    }
  }

  // La banque à jour arrive juste après la réponse du serveur (surBanque appelle d'abord avec l'ancienne : ignorée).
  function attendreBanque() {
    return new Promise((resolve) => {
      let appels = 0;
      Admin.surBanque(() => { appels++; if (appels === 2) setTimeout(resolve, 0); });
    });
  }
})();
