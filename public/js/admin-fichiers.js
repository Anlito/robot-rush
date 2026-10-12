/* Admin · export et import JSON de la banque (questions, parcours, images comprises). */
'use strict';

(() => {
  const { esc, el } = RR;
  const TAILLE_MAX = 9 * 1024 * 1024; // le serveur accepte 10 Mo par message

  const nomFichier = (suffixe) => `robot-rush-${suffixe}-${new Date().toISOString().slice(0, 10)}.json`
    .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w.-]+/g, '-').toLowerCase();

  /** Télécharge la banque (ou certains parcours seulement) dans un fichier .json. */
  Admin.exporter = async (parcoursIds = null, nom = 'banque') => {
    const rep = await Admin.action('exporter', { parcoursIds });
    if (!rep.ok) return;
    const blob = new Blob([JSON.stringify(rep.fichier, null, 2)], { type: 'application/json' });
    const lien = document.createElement('a');
    lien.href = URL.createObjectURL(blob);
    lien.download = nomFichier(nom);
    document.body.appendChild(lien);
    lien.click();
    lien.remove();
    setTimeout(() => URL.revokeObjectURL(lien.href), 2000);
    const f = rep.fichier;
    Admin.bandeau(`Fichier ${lien.download} téléchargé : ${f.questions.length} question(s) et ${f.parcours.length} parcours.`);
  };

  el('#btn-exporter').addEventListener('click', () => Admin.exporter());
  el('#btn-importer').addEventListener('click', () => el('#fichier-import').click());

  el('#fichier-import').addEventListener('change', async (ev) => {
    const fichier = ev.target.files[0];
    ev.target.value = ''; // pour pouvoir réimporter le même fichier
    if (!fichier) return;
    if (fichier.size > TAILLE_MAX) { Admin.bandeau('Fichier trop gros (9 Mo au plus). Exportez parcours par parcours.', true); return; }
    let donnees;
    try {
      donnees = JSON.parse(await fichier.text());
    } catch {
      Admin.bandeau('Ce fichier n\'est pas un fichier JSON lisible. Utilisez un fichier exporté depuis Robot Rush.', true);
      return;
    }
    const nbQ = Array.isArray(donnees) ? donnees.length : (donnees && Array.isArray(donnees.questions) ? donnees.questions.length : 0);
    const nbP = donnees && Array.isArray(donnees.parcours) ? donnees.parcours.length : 0;
    if (!nbQ && !nbP) { Admin.bandeau('Ce fichier ne contient ni question ni parcours Robot Rush.', true); return; }
    const b = Admin.banque;
    const m = Admin.modale({
      titre: 'Importer un fichier',
      contenu: `<p><b>${esc(fichier.name)}</b> contient ${nbQ} question(s) et ${nbP} parcours.</p>
        <div class="choix-import">
          <button class="carte-import" type="button" data-mode="ajouter"><b>Ajouter à ma banque</b>
            <span>Vos ${b.questions.length} questions et ${b.parcours.length} parcours sont gardés. Les questions importées reçoivent de nouveaux numéros si besoin.</span></button>
          <button class="carte-import danger" type="button" data-mode="remplacer"><b>Remplacer ma banque</b>
            <span>Vos questions et parcours actuels sont remplacés par ceux du fichier. Pensez à exporter d'abord votre banque (une copie de sécurité du jour reste aussi dans data/sauvegardes).</span></button>
        </div>
        <div class="actions-modale"><button class="btn" type="button" data-annuler>Annuler</button></div>`,
    });
    m.querySelector('[data-annuler]').addEventListener('click', () => Admin.fermerModale());
    m.querySelector('.choix-import').addEventListener('click', async (e) => {
      const choix = e.target.closest('[data-mode]');
      if (!choix) return;
      const mode = choix.dataset.mode;
      if (mode === 'remplacer' && !confirm('Remplacer toute la banque par le contenu du fichier ?')) return;
      m.querySelectorAll('button').forEach((x) => { x.disabled = true; });
      const rep = await Admin.envoyer('importer', { donnees, mode });
      Admin.fermerModale();
      if (!rep.ok) { Admin.bandeau(rep.erreur, true); return; }
      const r = rep.rapport;
      let texte = `Import réussi : ${r.questions} question(s) et ${r.parcours} parcours.`;
      if (r.incompletes) texte += ` ${r.incompletes} question(s) incomplète(s), marquées « ! », à compléter avant de jouer.`;
      if (r.ignorees.length) texte += ` Ignoré : ${r.ignorees.slice(0, 3).join(' ; ')}${r.ignorees.length > 3 ? '…' : ''}`;
      Admin.bandeau(texte, r.ignorees.length > 0);
    });
  });
})();
