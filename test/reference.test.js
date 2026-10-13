'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { Banque } = require('../server/banque');
const { creerReference, empreinte } = require('../server/reference');
const seedQ = require('../seed/questions.json');
const seedP = require('../seed/parcours.json');

const copie = (x) => JSON.parse(JSON.stringify(x));
const nouvelleBanque = () => new Banque({ questions: copie(seedQ), parcours: copie(seedP), sauver: () => {} });

/** Stockage en mémoire : fichiers annexes, banque.json du dépôt, banque neuve ou non. */
function faux({ fichier = null, neuve = false, annexes = {} } = {}) {
  const a = copie(annexes);
  return {
    copies: 0,
    banqueNeuve: () => neuve,
    lireBanqueReference: () => (fichier ? copie(fichier) : null),
    lireAnnexe: (nom) => (a[nom] ? copie(a[nom]) : null),
    ecrireAnnexe: (nom, v) => { if (v === null) delete a[nom]; else a[nom] = copie(v); },
    copieAvantRemplacement() { this.copies++; },
    annexes: a,
  };
}

/** Faux GitHub : un dépôt avec (ou sans) banque.json ; garde les envois. */
function fauxGithub({ distante = null, jetonValide = true } = {}) {
  const g = { distante: distante ? copie(distante) : null, envois: [] };
  g.fetch = async (url, options = {}) => {
    const reponse = (status, corps) => ({ status, ok: status < 300, json: async () => corps, text: async () => JSON.stringify(corps) });
    if (options.headers && options.headers.Authorization && !jetonValide) return reponse(401, {});
    if (/\/contents\/banque\.json/.test(url) && options.method === 'PUT') {
      const corps = JSON.parse(options.body);
      g.envois.push(corps);
      g.distante = JSON.parse(Buffer.from(corps.content, 'base64').toString('utf8'));
      return reponse(200, {});
    }
    if (/\/contents\/banque\.json/.test(url)) {
      if (!g.distante) return reponse(404, {});
      if (options.headers.Accept.includes('raw')) return reponse(200, g.distante);
      return reponse(200, { sha: 'abc' });
    }
    if (/\/repos\/[^/]+\/[^/]+$/.test(url)) return reponse(200, { permissions: { push: true } });
    return reponse(404, {});
  };
  return g;
}

/** Une autre banque, publiée « ailleurs » : la banque de test avec une question en moins. */
function autreFichier() {
  const b = nouvelleBanque();
  b.supprimerQuestion('q-001');
  return b.exporter();
}

test('premier démarrage : banque.json chargée et notée', () => {
  const b = nouvelleBanque();
  const fichier = autreFichier();
  const s = faux({ fichier, neuve: true });
  const msg = creerReference({ banque: b, stockage: s, depot: 'x/y' }).auDemarrage();
  assert.match(msg, /chargée/);
  assert.equal(b.questions.length, fichier.questions.length);
  assert.equal(s.annexes['reference.json'].fichier, empreinte(fichier));
  assert.equal(s.copies, 1);
});

test('démarrage : nouvelle publication chargée si rien n\'a changé ici, sinon proposée', () => {
  const b = nouvelleBanque();
  const ancien = nouvelleBanque().exporter();
  const s = faux({ fichier: ancien, neuve: true });
  creerReference({ banque: b, stockage: s, depot: 'x/y' }).auDemarrage();

  // Même fichier au démarrage suivant : rien à faire.
  const s2 = faux({ fichier: ancien, annexes: s.annexes });
  assert.equal(creerReference({ banque: b, stockage: s2, depot: 'x/y' }).auDemarrage(), null);

  // Nouvelle publication, banque locale intacte : chargée.
  const nouveau = autreFichier();
  const s3 = faux({ fichier: nouveau, annexes: s.annexes });
  assert.match(creerReference({ banque: b, stockage: s3, depot: 'x/y' }).auDemarrage(), /chargée/);
  assert.equal(b.questions.length, nouveau.questions.length);

  // Modification locale puis nouvelle publication : rien n'est remplacé, la banque est proposée.
  b.enregistrerQuestion({ type: 'calcul', enonce: 'faite ici', donnees: { reponse: 1 } });
  const avant = b.questions.length;
  const s4 = faux({ fichier: ancien, annexes: s3.annexes });
  const ref = creerReference({ banque: b, stockage: s4, depot: 'x/y' });
  assert.match(ref.auDemarrage(), /rien n'est remplacé/);
  assert.equal(b.questions.length, avant);
  assert.equal(ref.vue().enAttente.questions, ancien.questions.length);
});

test('démarrage : banque existante jamais synchronisée, rien n\'est remplacé', () => {
  const b = nouvelleBanque();
  const ref = creerReference({ banque: b, stockage: faux({ fichier: autreFichier() }), depot: 'x/y' });
  assert.match(ref.auDemarrage(), /Récupérer/);
  assert.equal(b.questions.length, seedQ.length);
});

test('publier : jeton exigé, envoi du fichier, puis « déjà à jour »', async () => {
  const b = nouvelleBanque();
  const s = faux();
  const g = fauxGithub();
  const ref = creerReference({ banque: b, stockage: s, depot: 'x/y', fetch: g.fetch });
  await assert.rejects(ref.publier(), /Reliez/);
  await assert.rejects(ref.relier('mauvais'), /jeton GitHub/);
  await ref.relier(`github_pat_${'a'.repeat(30)}`);
  assert.equal(ref.vue().relie, true);
  assert.equal(JSON.stringify(ref.vue()).includes('github_pat_'), false, 'le jeton ne part jamais vers le navigateur');
  assert.equal(ref.vue().nonPubliee, true);

  const r = await ref.publier();
  assert.equal(r.questions, seedQ.length);
  assert.equal(g.envois.length, 1);
  assert.equal(g.envois[0].branch, 'main');
  assert.equal(g.distante.questions.length, seedQ.length);
  assert.equal(ref.vue().nonPubliee, false);
  assert.equal((await ref.publier()).dejaAJour, true);
  assert.equal(g.envois.length, 1);
});

test('publier : banque publiée depuis un autre ordinateur, confirmation demandée', async () => {
  const b = nouvelleBanque();
  const g = fauxGithub({ distante: autreFichier() });
  const ref = creerReference({ banque: b, stockage: faux({ annexes: { 'github.json': { jeton: 'github_pat_x' } } }), depot: 'x/y', fetch: g.fetch });
  const r = await ref.publier();
  assert.equal(r.conflit, true);
  assert.equal(g.envois.length, 0);
  await ref.publier({ forcer: true });
  assert.equal(g.envois.length, 1);
  assert.equal(g.envois[0].sha, 'abc');
});

test('récupérer : aperçu puis remplacement (nouvel ordinateur)', async () => {
  const b = nouvelleBanque();
  const publiee = autreFichier();
  const s = faux();
  const ref = creerReference({ banque: b, stockage: s, depot: 'x/y', fetch: fauxGithub({ distante: publiee }).fetch });
  const a = await ref.recuperer();
  assert.equal(a.apercu.questions, publiee.questions.length);
  assert.equal(b.questions.length, seedQ.length, 'l\'aperçu ne change rien');
  await ref.recuperer({ confirmer: true });
  assert.equal(b.questions.length, publiee.questions.length);
  assert.equal(s.copies, 1);
  assert.equal(ref.vue().nonPubliee, false);
  await assert.rejects(creerReference({ banque: b, stockage: faux(), depot: 'x/y', fetch: fauxGithub().fetch }).recuperer(), /Aucune banque publiée/);
});

test('version en ligne : pas de publication ni de jeton', async () => {
  const ref = creerReference({ banque: nouvelleBanque(), stockage: faux(), depot: 'x/y', publication: false, fetch: fauxGithub().fetch });
  await assert.rejects(ref.relier(`github_pat_${'a'.repeat(30)}`), /ordinateur du professeur/);
  await assert.rejects(ref.publier(), /ordinateur du professeur/);
  assert.equal(ref.vue().publication, false);
});
