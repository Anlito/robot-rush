/* Affichage des 5 types de questions côté élève (maquettes B2 à B6).
 * Chaque type fournit : html(q), monter(conteneur), touche(ev) (raccourcis clavier), detruire().
 * La réponse part au serveur par ctx.repondre(reponse) ; ctx.message(texte) affiche un avertissement.
 */
'use strict';

RR.questions = (() => {
  const { esc, el } = RR;
  const REPONSES = [
    { fond: '#2563EB', texte: '#fff', forme: 'M0 -8L8.5 7H-8.5Z', lettre: 'A' },
    { fond: '#F97316', texte: '#16161D', forme: 'M0 -9L9 0L0 9L-9 0Z', lettre: 'B' },
    { fond: '#7C3AED', texte: '#fff', forme: 'M0 -8A8 8 0 1 1 0 8A8 8 0 1 1 0 -8Z', lettre: 'C' },
    { fond: '#15803D', texte: '#fff', forme: 'M-7.5 -7.5H7.5V7.5H-7.5Z', lettre: 'D' },
  ];
  const POIGNEE = '<svg width="24" height="32" viewBox="0 0 24 32" aria-hidden="true"><path d="M7 6H9M15 6H17M7 16H9M15 16H17M7 26H9M15 26H17" stroke="#4A4A57" stroke-width="4" stroke-linecap="round"/></svg>';
  const MOTS_CLES = /\b(si|alors|sinon|répéter|fois|tant que|faire|pour|void|if|else|for|while|return|int|loop|setup)\b/g;

  /** Énoncé : `texte entre accents graves` affiché comme du code. */
  function enonce(t) {
    return esc(t).replace(/`([^`]+)`/g, '<code class="code-enonce">$1</code>');
  }

  const boutonValider = (texte = 'Valider') => `<button class="bouton-noir bouton-valider" data-valider type="button">${texte}</button>`;

  // ---------- B2 · QCM ----------
  function qcm(q, ctx) {
    let envoye = false;
    async function choisir(i, bouton) {
      if (envoye) return;
      envoye = true;
      document.querySelectorAll('.rep').forEach((b) => { b.disabled = true; });
      bouton.classList.add('choisie');
      const r = await ctx.repondre(i);
      if (!r.ok) {
        envoye = false;
        document.querySelectorAll('.rep').forEach((b) => { b.disabled = false; b.classList.remove('choisie'); });
      }
    }
    return {
      html: `<div class="grille-qcm">${q.choix.map((c, i) => {
        const r = REPONSES[i % 4];
        return `<button class="rep" data-rep="${i}" type="button" style="background:${r.fond};color:${r.texte}" aria-label="Réponse ${r.lettre} : ${esc(c)}">
          <svg width="56" height="56" viewBox="-10 -10 20 20" aria-hidden="true"><path d="${r.forme}" fill="${r.texte}"/></svg><span>${esc(c)}</span></button>`;
      }).join('')}</div>`,
      monter(z) { z.addEventListener('click', (ev) => { const b = ev.target.closest('[data-rep]'); if (b && !b.disabled) choisir(Number(b.dataset.rep), b); }); },
      touche(ev) {
        const n = Number(ev.key);
        const b = Number.isInteger(n) && document.querySelectorAll('.rep')[n - 1];
        if (b && !b.disabled) { b.click(); return true; }
        return false;
      },
    };
  }

  // ---------- B3 · Remise en ordre ----------
  function ordre(q, ctx) {
    let rang = q.elements.map((_, i) => i); // rang[k] = index affiché de l'étiquette en position k
    let glisse = null;
    let liste = null;

    function rendre(focusFleche) {
      liste.innerHTML = rang.map((i, k) => `
        <div class="etiquette-ordre ${glisse === i ? 'deplacee' : ''}" data-i="${i}">
          <span class="poignee" data-poignee="${i}" title="Glisser">${POIGNEE}</span>
          <span class="numero">${k + 1}</span>
          <span class="texte">${esc(q.elements[i])}</span>
          <span class="fleches">
            <button type="button" class="fleche" data-haut="${k}" ${k === 0 ? 'disabled' : ''} aria-label="Monter « ${esc(q.elements[i])} »">↑</button>
            <button type="button" class="fleche" data-bas="${k}" ${k === rang.length - 1 ? 'disabled' : ''} aria-label="Descendre « ${esc(q.elements[i])} »">↓</button>
          </span></div>`).join('');
      if (focusFleche) {
        const b = liste.querySelector(focusFleche);
        if (b && !b.disabled) b.focus();
      }
    }
    function deplacer(de, vers) {
      if (vers < 0 || vers >= rang.length) return;
      const [x] = rang.splice(de, 1);
      rang.splice(vers, 0, x);
    }
    return {
      html: `<div class="ordre"><div class="liste-ordre" id="liste-ordre"></div>
        <div class="cote"><p class="aide-q">Glisse les étiquettes par la poignée, ou utilise les flèches.</p>${boutonValider()}</div></div>`,
      monter(z) {
        liste = el('#liste-ordre', z);
        rendre();
        z.addEventListener('click', (ev) => {
          const h = ev.target.closest('[data-haut]');
          const b = ev.target.closest('[data-bas]');
          if (h) { const k = Number(h.dataset.haut); deplacer(k, k - 1); rendre(`[data-haut="${k - 1}"]`); }
          if (b) { const k = Number(b.dataset.bas); deplacer(k, k + 1); rendre(`[data-bas="${k + 1}"]`); }
          if (ev.target.closest('[data-valider]')) ctx.repondre(rang.slice());
        });
        // Glisser par la poignée (souris, stylet ou doigt).
        liste.addEventListener('pointerdown', (ev) => {
          const p = ev.target.closest('[data-poignee]');
          if (!p) return;
          ev.preventDefault();
          glisse = Number(p.dataset.poignee);
          rendre();
          const suivre = (e) => {
            const sous = document.elementFromPoint(e.clientX, e.clientY);
            const cible = sous && sous.closest('.etiquette-ordre');
            if (!cible) return;
            const vers = rang.indexOf(Number(cible.dataset.i));
            const de = rang.indexOf(glisse);
            if (vers !== de) { deplacer(de, vers); rendre(); }
          };
          const finir = () => {
            glisse = null;
            rendre();
            window.removeEventListener('pointermove', suivre);
            window.removeEventListener('pointerup', finir);
          };
          window.addEventListener('pointermove', suivre);
          window.addEventListener('pointerup', finir);
        });
      },
      touche(ev) {
        if (ev.key === 'Enter' && !ev.target.closest('button')) { ctx.repondre(rang.slice()); return true; }
        return false;
      },
    };
  }

  // ---------- B4 · Calcul ----------
  function calcul(q, ctx) {
    let champ = null;
    function valider() {
      const v = champ.value.trim();
      if (!v) { ctx.message('Tape un nombre avant de valider.'); champ.focus(); return; }
      ctx.repondre(v);
    }
    return {
      html: `<div class="calcul">
        <div class="calcul-ligne"><input class="champ-calcul" id="champ-calcul" inputmode="decimal" autocomplete="off" maxlength="12" aria-label="Ta réponse">
        ${q.unite ? `<span class="unite">${esc(q.unite)}</span>` : ''}
        ${boutonValider('Valider ↵')}</div>
        <p class="aide-q">Chiffres uniquement. Touche Entrée pour valider.</p></div>`,
      monter(z) {
        champ = el('#champ-calcul', z);
        champ.addEventListener('input', () => { champ.value = champ.value.replace(/[^0-9,.-]/g, ''); });
        champ.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); valider(); } });
        z.addEventListener('click', (ev) => { if (ev.target.closest('[data-valider]')) valider(); });
        setTimeout(() => champ.focus(), 0);
      },
      touche: () => false,
    };
  }

  // ---------- B5 · Blocs à assembler (Blockly) ----------
  function blocs(q, ctx) {
    let editeur = null;
    let detruit = false;
    let avertiHors = false;
    function valider() {
      if (!editeur) return;
      const hors = editeur.horsProgramme();
      if (hors && !avertiHors) {
        avertiHors = true;
        ctx.message(`${hors} bloc${hors > 1 ? 's ne sont' : ' n\'est'} pas accroché${hors > 1 ? 's' : ''} à « Programme » : il${hors > 1 ? 's' : ''} ne compte${hors > 1 ? 'nt' : ''} pas. Clique encore sur Valider pour confirmer.`);
        return;
      }
      ctx.repondre(editeur.sauvegarder());
    }
    return {
      html: `<div class="blocs">
        <div class="zone-blocs" id="zone-blocs"><p class="chargement-blocs">Chargement des blocs…</p></div>
        <div class="cote"><p class="aide-q">Glisse les blocs de la palette sous « Programme ». Clique sur un nombre pour le modifier.</p>
          <button class="bouton-clair" data-effacer type="button">Tout effacer</button>${boutonValider()}</div></div>`,
      monter(z) {
        const zone = el('#zone-blocs', z);
        RR.blocs.charger().then(() => {
          if (detruit) return;
          zone.innerHTML = '';
          editeur = RR.blocs.creer(zone, q.blocs);
        }).catch(() => {
          zone.innerHTML = '<p class="chargement-blocs erreur">Les blocs n\'ont pas pu se charger. Actualise la page (F5).</p>';
        });
        z.addEventListener('click', (ev) => {
          if (ev.target.closest('[data-effacer]') && editeur) { editeur.effacer(); avertiHors = false; ctx.message(''); }
          if (ev.target.closest('[data-valider]')) valider();
        });
      },
      touche: () => false,
      detruire() { detruit = true; if (editeur) editeur.detruire(); },
    };
  }

  // ---------- B6 · Programme à compléter ----------
  function completer(q, ctx) {
    const n = q.segments.length - 1;
    const valeurs = Array(n).fill(null);
    let trouChoisi = null;
    let z = null;

    function code() {
      const morceau = (t) => esc(t).replace(MOTS_CLES, '<span class="mot-cle">$1</span>');
      return q.segments.map((s, i) => {
        if (i === 0) return morceau(s);
        const t = i - 1;
        let trou;
        if (q.mode === 'liste') {
          trou = `<select class="trou-liste" data-liste="${t}" aria-label="Trou ${t + 1}"><option value="">choisir…</option>
            ${q.options[t].map((o) => `<option value="${esc(o)}">${esc(o)}</option>`).join('')}</select>`;
        } else {
          trou = `<button type="button" class="trou ${valeurs[t] !== null ? 'rempli' : ''} ${trouChoisi === t ? 'choisi' : ''}" data-trou="${t}"
            aria-label="Trou ${t + 1}${valeurs[t] !== null ? ' : ' + esc(valeurs[t]) : ', vide'}">${valeurs[t] !== null ? esc(valeurs[t]) : 'dépose ici'}</button>`;
        }
        return trou + morceau(s);
      }).join('');
    }
    function etiquettes() {
      if (q.mode !== 'glisser') return '';
      return q.etiquettes.map((e, k) => {
        const utilisee = valeurs.includes(e);
        return `<button type="button" class="etiquette-trou" data-etiquette="${k}" ${utilisee ? 'disabled' : ''}>${esc(e)}</button>`;
      }).join('');
    }
    function rendre() {
      el('#code-trous', z).innerHTML = code();
      el('#etiquettes', z).innerHTML = etiquettes();
    }
    function poser(k, t) {
      const cible = t ?? (trouChoisi !== null && valeurs[trouChoisi] === null ? trouChoisi : valeurs.indexOf(null));
      if (cible < 0 || cible === null) { ctx.message('Tous les trous sont remplis : clique sur un trou pour le vider.'); return; }
      valeurs[cible] = q.etiquettes[k];
      trouChoisi = null;
      ctx.message('');
      rendre();
    }
    function valider() {
      const vides = valeurs.filter((v) => v === null || v === '').length;
      if (vides) { ctx.message(vides > 1 ? `Il reste ${vides} trous à remplir.` : 'Il reste un trou à remplir.'); return; }
      ctx.repondre(valeurs.slice());
    }
    return {
      html: `<pre class="code-trous" id="code-trous"></pre>
        <div class="ligne-etiquettes">${q.mode === 'glisser' ? '<span class="aide-q">Étiquettes :</span>' : '<span class="aide-q">Choisis la bonne valeur dans chaque liste.</span>'}
        <div class="etiquettes" id="etiquettes"></div>${boutonValider()}</div>`,
      monter(conteneur) {
        z = conteneur;
        rendre();
        z.addEventListener('click', (ev) => {
          const e = ev.target.closest('[data-etiquette]');
          const t = ev.target.closest('[data-trou]');
          if (e && !e.disabled) poser(Number(e.dataset.etiquette));
          if (t) {
            const i = Number(t.dataset.trou);
            if (valeurs[i] !== null) { valeurs[i] = null; trouChoisi = i; } else trouChoisi = trouChoisi === i ? null : i;
            rendre();
          }
          if (ev.target.closest('[data-valider]')) valider();
        });
        z.addEventListener('change', (ev) => {
          const s = ev.target.closest('[data-liste]');
          if (s) valeurs[Number(s.dataset.liste)] = s.value || null;
        });
        // Glisser-déposer au pointeur (souris, stylet ou doigt), en plus du simple clic.
        z.addEventListener('pointerdown', (ev) => {
          const e = ev.target.closest('[data-etiquette]');
          if (!e || e.disabled) return;
          const depart = { x: ev.clientX, y: ev.clientY };
          let fantome = null;
          let survol = null;
          const trouSous = (x, y) => {
            if (fantome) fantome.style.visibility = 'hidden';
            const sous = document.elementFromPoint(x, y);
            if (fantome) fantome.style.visibility = '';
            return sous && sous.closest('[data-trou]');
          };
          const suivre = (m) => {
            if (!fantome && Math.hypot(m.clientX - depart.x, m.clientY - depart.y) < 6) return;
            if (!fantome) {
              fantome = e.cloneNode(true);
              fantome.classList.add('fantome');
              document.body.appendChild(fantome);
            }
            fantome.style.left = `${m.clientX}px`;
            fantome.style.top = `${m.clientY}px`;
            const t = trouSous(m.clientX, m.clientY);
            if (survol && survol !== t) survol.classList.remove('survol');
            if (t) t.classList.add('survol');
            survol = t;
          };
          const finir = (f) => {
            window.removeEventListener('pointermove', suivre);
            window.removeEventListener('pointerup', finir);
            if (!fantome) return; // simple clic : géré par l'écouteur « click »
            const t = trouSous(f.clientX, f.clientY);
            fantome.remove();
            // Le « click » éventuel qui suit immédiatement un glisser ne doit pas reposer l'étiquette ailleurs.
            // Pas de minuteur ici : le navigateur les ralentit quand la fenêtre n'est pas au premier plan.
            const finGlisser = f.timeStamp;
            const ignorer = (c) => {
              z.removeEventListener('click', ignorer, true);
              if (c.timeStamp - finGlisser < 50 && c.target.closest('[data-etiquette], [data-trou]')) c.stopPropagation();
            };
            z.addEventListener('click', ignorer, true);
            if (t) poser(Number(e.dataset.etiquette), Number(t.dataset.trou));
            else rendre();
          };
          window.addEventListener('pointermove', suivre);
          window.addEventListener('pointerup', finir);
        });
      },
      touche(ev) {
        if (ev.key === 'Enter' && !ev.target.closest('button, select')) { valider(); return true; }
        return false;
      },
    };
  }

  const FABRIQUES = { qcm, ordre, calcul, blocs, completer };

  /** Composant d'affichage d'une question, ou null si le type est inconnu. */
  function creer(q, ctx) {
    const f = FABRIQUES[q.type];
    if (!f) return null;
    const c = f(q, ctx);
    return { detruire() {}, ...c };
  }

  return { creer, enonce };
})();
