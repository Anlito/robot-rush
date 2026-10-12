/* Questions « blocs à assembler » : éditeur Blockly.
 *
 * Repris du projet « distributeur de céréales » (site/js/blocs.js et site/js/editeur.js) :
 * Blockly copié dans le dépôt (public/vendor/blockly, aucun CDN), libellés français des blocs,
 * couleurs des familles, thème, rendu « zelos », repérage des blocs restés hors du programme.
 * Adaptations pour Robot Rush (version réduite, sans simulateur) :
 *  - un seul chapeau « Programme » ; nouveau bloc « répéter ( ) fois » ;
 *  - pas de choix de broche (les questions portent sur la logique, pas sur le câblage) ;
 *  - palette à plat (les blocs autorisés par la question), sans catégories ;
 *  - Blockly n'est chargé qu'à la première question de blocs (il pèse environ 700 Ko).
 */
'use strict';

RR.blocs = (() => {
  // Familles de blocs : mêmes couleurs que l'atelier céréales.
  const COULEURS = {
    debut: '#86C595',
    lumiere: '#F7AE5E',
    decision: '#F7AE5E',
    bleu: '#78B5D6',
    valeur: '#BCDAEB',
    servo: '#E78AB3',
    variable: '#EC8780',
  };
  // Pictogrammes en trait (repris de site/js/icones.js).
  const CHEMINS = {
    lumiere: 'M8 15V10a4 4 0 0 1 8 0v5zM6 15h12M10 15v5M14 15v4',
    bouton: 'M4 14h16v6H4zM8 14v-3a4 4 0 0 1 8 0v3',
    moteur: 'M4 12h16v8H4zM8 12V8M5 8h14',
  };
  const imageIcone = (nom) => 'data:image/svg+xml,' + encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#1F2A30" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="${CHEMINS[nom]}"/></svg>`);
  const image = (nom, alt) => ({ type: 'field_image', src: imageIcone(nom), width: 22, height: 22, alt });
  const HAUT_BAS_LED = [['HAUT (1) : allumée', '1'], ['BAS (0) : éteinte', '0']];
  const HAUT_BAS = [['HAUT (1)', '1'], ['BAS (0)', '0']];

  const DEFINITIONS = [
    {
      type: 'programme',
      message0: 'Programme %1 %2',
      args0: [{ type: 'input_dummy' }, { type: 'input_statement', name: 'DO' }],
      style: 'debut',
      tooltip: 'Accroche les blocs ici, dans l\'ordre où ils s\'exécutent.',
    },
    {
      type: 'led_etat',
      message0: '%1 contrôler la LED à l’état %2',
      args0: [image('lumiere', 'LED'), { type: 'field_dropdown', name: 'ETAT', options: HAUT_BAS_LED }],
      previousStatement: null, nextStatement: null, style: 'lumiere',
      tooltip: 'HAUT : la LED s’allume. BAS : elle s’éteint.',
    },
    {
      type: 'attendre',
      message0: 'attendre %1 seconde(s)',
      args0: [{ type: 'input_value', name: 'DUREE', check: 'Number' }],
      inputsInline: true, previousStatement: null, nextStatement: null, style: 'bleu',
      tooltip: 'La carte attend avant de passer au bloc suivant. On peut écrire 0.5 pour une demi-seconde.',
    },
    {
      type: 'servo_angle',
      message0: '%1 contrôler l’angle à %2 °',
      args0: [image('moteur', 'Servomoteur'), { type: 'input_value', name: 'ANGLE', check: 'Number' }],
      inputsInline: true, previousStatement: null, nextStatement: null, style: 'servo',
      tooltip: 'Le servomoteur tourne jusqu’à l’angle choisi, entre 0° et 180°.',
    },
    {
      type: 'repeter',
      message0: 'répéter %1 fois %2 %3',
      args0: [{ type: 'input_value', name: 'FOIS', check: 'Number' }, { type: 'input_dummy' }, { type: 'input_statement', name: 'FAIRE' }],
      inputsInline: true, previousStatement: null, nextStatement: null, style: 'debut',
      tooltip: 'Les blocs placés à l’intérieur sont exécutés le nombre de fois indiqué.',
    },
    {
      type: 'si_alors',
      message0: 'si %1 alors %2 %3',
      args0: [{ type: 'input_value', name: 'CONDITION', check: 'Boolean' }, { type: 'input_dummy' }, { type: 'input_statement', name: 'ALORS' }],
      previousStatement: null, nextStatement: null, style: 'decision',
      tooltip: 'Si la condition est vraie, alors les blocs à l’intérieur s’exécutent.',
    },
    {
      type: 'si_sinon',
      message0: 'si %1 alors %2 %3',
      args0: [{ type: 'input_value', name: 'CONDITION', check: 'Boolean' }, { type: 'input_dummy' }, { type: 'input_statement', name: 'ALORS' }],
      message1: 'sinon %1',
      args1: [{ type: 'input_statement', name: 'SINON' }],
      previousStatement: null, nextStatement: null, style: 'decision',
      tooltip: 'Si la condition est vraie, les blocs de « alors » s’exécutent. Sinon, ceux de « sinon ».',
    },
    {
      type: 'bouton_etat',
      message0: '%1 état du bouton',
      args0: [image('bouton', 'Module bouton')],
      output: 'Boolean', style: 'valeur',
      tooltip: 'Donne HAUT (1) si le bouton est appuyé, BAS (0) sinon.',
    },
    {
      type: 'valeur_haut_bas',
      message0: '%1',
      args0: [{ type: 'field_dropdown', name: 'VALEUR', options: HAUT_BAS }],
      output: 'Boolean', style: 'valeur', tooltip: 'HAUT (1) ou BAS (0).',
    },
    {
      type: 'comparaison',
      message0: '%1 %2 %3',
      args0: [{ type: 'input_value', name: 'A' }, { type: 'field_dropdown', name: 'OP', options: [['=', 'EQ'], ['≠', 'NEQ']] }, { type: 'input_value', name: 'B' }],
      inputsInline: true, output: 'Boolean', style: 'bleu',
      tooltip: '« = » : les deux valeurs sont égales. « ≠ » : elles sont différentes.',
    },
    {
      type: 'affecter',
      message0: 'affecter à %1 la valeur %2',
      args0: [{ type: 'field_dropdown', name: 'VAR', options: [['CHOIX', 'CHOIX']] }, { type: 'input_value', name: 'VALEUR', check: 'Number' }],
      inputsInline: true, previousStatement: null, nextStatement: null, style: 'variable',
      tooltip: 'Range une valeur dans la boîte CHOIX.',
    },
    {
      type: 'variable',
      message0: '%1',
      args0: [{ type: 'field_label_serializable', name: 'VAR', text: 'CHOIX' }],
      output: 'Number', style: 'variable', tooltip: 'La valeur rangée dans la boîte CHOIX.',
    },
    {
      type: 'nombre',
      message0: '%1',
      args0: [{ type: 'field_number', name: 'NUM', value: 0 }],
      output: 'Number', style: 'bleu', tooltip: 'Un nombre. Les nombres à virgule s’écrivent avec un point : 0.5',
    },
  ];

  // Ordre de la palette (comme les catégories de l'atelier céréales) et forme de départ de chaque bloc.
  const ORDRE = ['led_etat', 'attendre', 'bouton_etat', 'valeur_haut_bas', 'servo_angle', 'repeter', 'si_alors', 'si_sinon', 'comparaison', 'affecter', 'variable', 'nombre'];
  const FORMES = {
    attendre: { inputs: { DUREE: { shadow: { type: 'nombre', fields: { NUM: 1 } } } } },
    servo_angle: { inputs: { ANGLE: { shadow: { type: 'nombre', fields: { NUM: 90 } } } } },
    repeter: { inputs: { FOIS: { shadow: { type: 'nombre', fields: { NUM: 2 } } } } },
    affecter: { inputs: { VALEUR: { shadow: { type: 'nombre', fields: { NUM: 0 } } } } },
    led_etat: { fields: { ETAT: '1' } },
  };

  let chargement = null;
  let theme = null;

  function script(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = () => reject(new Error(`Impossible de charger ${src}`));
      document.head.appendChild(s);
    });
  }

  /** Charge Blockly une seule fois (à l'avance si possible, pour ne pas faire attendre l'élève). */
  function charger() {
    if (!chargement) {
      chargement = script('/vendor/blockly/blockly_compressed.js?v=3')
        .then(() => script('/vendor/blockly/fr.js?v=3'))
        .then(() => {
          const B = window.Blockly;
          B.common.defineBlocksWithJsonArray(DEFINITIONS);
          const style = (c) => ({ colourPrimary: c, colourSecondary: c, colourTertiary: assombrir(c) });
          const blockStyles = {};
          for (const [cle, c] of Object.entries(COULEURS)) blockStyles[cle] = style(c);
          blockStyles.debut.hat = 'cap';
          theme = B.Theme.defineTheme('robotrush', {
            base: B.Themes.Classic,
            blockStyles,
            componentStyles: {
              workspaceBackgroundColour: '#FFFFFF', toolboxBackgroundColour: '#FFFFFF', toolboxForegroundColour: '#16161D',
              flyoutBackgroundColour: '#F5F2EA', flyoutForegroundColour: '#16161D', flyoutOpacity: 1,
              scrollbarColour: '#C9C2B3', insertionMarkerColour: '#16161D', insertionMarkerOpacity: 0.3,
            },
            fontStyle: { family: "'Atkinson Hyperlegible', system-ui, sans-serif", weight: '700', size: 13 },
            startHats: false,
          });
          return B;
        })
        .catch((e) => { chargement = null; throw e; });
    }
    return chargement;
  }

  function assombrir(hex) {
    const n = parseInt(hex.slice(1), 16);
    const f = (v) => Math.round(v * 0.72);
    return '#' + ((1 << 24) | (f(n >> 16) << 16) | (f((n >> 8) & 255) << 8) | f(n & 255)).toString(16).slice(1);
  }

  /** Crée un éditeur dans `zone` avec les blocs autorisés. Renvoie { sauvegarder, effacer, horsProgramme, detruire }. */
  function creer(zone, autorises) {
    const B = window.Blockly;
    const contenu = ORDRE.filter((t) => autorises.includes(t))
      .map((type) => ({ kind: 'block', type, ...JSON.parse(JSON.stringify(FORMES[type] || {})) }));
    const ws = B.inject(zone, {
      toolbox: { kind: 'flyoutToolbox', contents: contenu },
      renderer: 'zelos',
      media: '/vendor/blockly/media/',
      theme,
      trashcan: true,
      sounds: false,
      move: { scrollbars: true, drag: true, wheel: true },
      zoom: { controls: true, wheel: false, pinch: true, startScale: 0.95, maxScale: 2, minScale: 0.5, scaleSpeed: 1.15 },
      grid: { spacing: 20, length: 2, colour: '#DDD6C8', snap: false },
      maxInstances: { programme: 1 },
    });
    const depart = () => {
      B.Events.disable();
      try {
        ws.clear();
        B.serialization.workspaces.load({ blocks: { languageVersion: 0, blocks: [{ type: 'programme', id: 'programme', x: 24, y: 20, deletable: false }] } }, ws);
      } finally { B.Events.enable(); }
      ws.clearUndo();
    };
    depart();

    // Blocs restés seuls hors du programme : contour pointillé (comme dans l'atelier céréales).
    let hors = 0;
    function majHorsProgramme() {
      hors = 0;
      for (const b of ws.getAllBlocks(false)) if (b.getSvgRoot()) b.getSvgRoot().classList.remove('bloc-hors-programme');
      for (const b of ws.getTopBlocks(false)) {
        if (b.type === 'programme' || b.isInsertionMarker() || (b.isDragging && b.isDragging())) continue;
        hors++;
        b.getSvgRoot().classList.add('bloc-hors-programme');
      }
    }
    ws.addChangeListener((e) => {
      if (e.isUiEvent && e.type !== B.Events.BLOCK_DRAG) return;
      majHorsProgramme();
    });
    const observateur = new ResizeObserver(() => B.svgResize(ws));
    observateur.observe(zone);

    return {
      sauvegarder: () => B.serialization.workspaces.save(ws),
      effacer: depart,
      /** Recharge un programme (sauvegarde Blockly), par exemple une séquence acceptée à modifier. */
      charger(sauvegarde) {
        B.Events.disable();
        try { ws.clear(); B.serialization.workspaces.load(sauvegarde, ws); } finally { B.Events.enable(); }
        for (const b of ws.getTopBlocks(false)) if (b.type === 'programme') b.setDeletable(false);
        ws.clearUndo();
        ws.scroll(0, 0);
      },
      // Recompté à la demande : les événements de Blockly arrivent en différé (et plus tard encore
      // quand la fenêtre n'est pas au premier plan).
      horsProgramme: () => { majHorsProgramme(); return hors; },
      detruire() { observateur.disconnect(); ws.dispose(); },
    };
  }

  return { charger, creer };
})();
