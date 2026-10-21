/* Questions de blocs : éditeur Blockly.
 *
 * Repris du projet « distributeur de céréales » (site/js/blocs.js et site/js/editeur.js) :
 * Blockly chargé depuis le module central de Labo Blocs en ligne, libellés français des blocs,
 * couleurs des familles, thème, rendu « zelos », repérage des blocs restés hors du programme.
 * Adaptations pour Robot Rush (version réduite, sans simulateur) :
 *  - un seul chapeau « Programme » ; nouveau bloc « répéter ( ) fois » ;
 *  - menus de broche seulement si la question le demande (sinon, la logique seule) ;
 *  - programme à compléter : bloc « ? bloc manquant », nombres et menus sur « ? » ;
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
    trou: '#FFE58A',
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
  // Broches (comme l'atelier céréales) : le bloc de la palette part de D2 (ou D5), il ne donne pas la réponse.
  const NUMERIQUES = ['D2', 'D3', 'D4', 'D5', 'D6', 'D7', 'D8', 'D9', 'D10', 'D11', 'D12', 'D13'];
  const BROCHES = { led_etat: NUMERIQUES, bouton_etat: NUMERIQUES, servo_angle: ['D5', 'D6'] };
  const TROU = '?';

  // Réglages de l'éditeur ouvert (un seul à la fois), lus à la création de chaque bloc.
  let reglages = { broches: false, trous: false };
  // En mode « à compléter », les menus proposent aussi « ? » (case laissée vide par le professeur).
  const menu = (options) => (reglages.trous ? [[TROU, TROU], ...options] : options);
  const menuBroche = (type) => ({ type: 'field_dropdown', name: 'BROCHE', options: menu(BROCHES[type].map((b) => [b, b])) });
  const broche = (type, message) => (reglages.broches ? { message: `${message} sur la broche %B`, args: [menuBroche(type)] } : { message, args: [] });

  // Définitions JSON de Blockly, construites à la création de chaque bloc (menus et broches selon les réglages).
  function definition(type) {
    switch (type) {
      case 'programme': return {
        message0: 'Programme %1 %2',
        args0: [{ type: 'input_dummy' }, { type: 'input_statement', name: 'DO' }],
        style: 'debut',
        tooltip: 'Accroche les blocs ici, dans l\'ordre où ils s\'exécutent.',
      };
      case 'led_etat': {
        const b = broche(type, '%1 contrôler la LED à l’état %2');
        return {
          message0: b.message.replace('%B', '%3'),
          args0: [image('lumiere', 'LED'), { type: 'field_dropdown', name: 'ETAT', options: menu(HAUT_BAS_LED) }, ...b.args],
          previousStatement: null, nextStatement: null, style: 'lumiere',
          tooltip: 'HAUT : la LED s’allume. BAS : elle s’éteint.',
        };
      }
      case 'attendre': return {
        message0: 'attendre %1 seconde(s)',
        args0: [{ type: 'input_value', name: 'DUREE', check: 'Number' }],
        inputsInline: true, previousStatement: null, nextStatement: null, style: 'bleu',
        tooltip: 'La carte attend avant de passer au bloc suivant. On peut écrire 0,5 pour une demi-seconde.',
      };
      case 'servo_angle': {
        const b = broche(type, '%1 contrôler l’angle à %2 °');
        return {
          message0: b.message.replace('%B', '%3'),
          args0: [image('moteur', 'Servomoteur'), { type: 'input_value', name: 'ANGLE', check: 'Number' }, ...b.args],
          inputsInline: true, previousStatement: null, nextStatement: null, style: 'servo',
          tooltip: 'Le servomoteur tourne jusqu’à l’angle choisi, entre 0° et 180°.',
        };
      }
      case 'repeter': return {
        message0: 'répéter %1 fois %2 %3',
        args0: [{ type: 'input_value', name: 'FOIS', check: 'Number' }, { type: 'input_dummy' }, { type: 'input_statement', name: 'FAIRE' }],
        inputsInline: true, previousStatement: null, nextStatement: null, style: 'debut',
        tooltip: 'Les blocs placés à l’intérieur sont exécutés le nombre de fois indiqué.',
      };
      case 'si_alors': return {
        message0: 'si %1 alors %2 %3',
        args0: [{ type: 'input_value', name: 'CONDITION', check: 'Boolean' }, { type: 'input_dummy' }, { type: 'input_statement', name: 'ALORS' }],
        previousStatement: null, nextStatement: null, style: 'decision',
        tooltip: 'Si la condition est vraie, alors les blocs à l’intérieur s’exécutent.',
      };
      case 'si_sinon': return {
        message0: 'si %1 alors %2 %3',
        args0: [{ type: 'input_value', name: 'CONDITION', check: 'Boolean' }, { type: 'input_dummy' }, { type: 'input_statement', name: 'ALORS' }],
        message1: 'sinon %1',
        args1: [{ type: 'input_statement', name: 'SINON' }],
        previousStatement: null, nextStatement: null, style: 'decision',
        tooltip: 'Si la condition est vraie, les blocs de « alors » s’exécutent. Sinon, ceux de « sinon ».',
      };
      case 'bouton_etat': {
        const b = reglages.broches ? { message: '%1 état sur la broche %2', args: [menuBroche(type)] } : { message: '%1 état du bouton', args: [] };
        return {
          message0: b.message,
          args0: [image('bouton', 'Module bouton'), ...b.args],
          output: 'Boolean', style: 'valeur',
          tooltip: 'Donne HAUT (1) si le bouton est appuyé, BAS (0) sinon.',
        };
      }
      case 'valeur_haut_bas': return {
        message0: '%1',
        args0: [{ type: 'field_dropdown', name: 'VALEUR', options: menu(HAUT_BAS) }],
        output: 'Boolean', style: 'valeur', tooltip: 'HAUT (1) ou BAS (0).',
      };
      case 'comparaison': return {
        message0: '%1 %2 %3',
        args0: [{ type: 'input_value', name: 'A' }, { type: 'field_dropdown', name: 'OP', options: menu([['=', 'EQ'], ['≠', 'NEQ']]) }, { type: 'input_value', name: 'B' }],
        inputsInline: true, output: 'Boolean', style: 'bleu',
        tooltip: '« = » : les deux valeurs sont égales. « ≠ » : elles sont différentes.',
      };
      case 'affecter': return {
        message0: 'affecter à %1 la valeur %2',
        args0: [{ type: 'field_dropdown', name: 'VAR', options: [['CHOIX', 'CHOIX']] }, { type: 'input_value', name: 'VALEUR', check: 'Number' }],
        inputsInline: true, previousStatement: null, nextStatement: null, style: 'variable',
        tooltip: 'Range une valeur dans la boîte CHOIX.',
      };
      case 'variable': return {
        message0: '%1',
        args0: [{ type: 'field_label_serializable', name: 'VAR', text: 'CHOIX' }],
        output: 'Number', style: 'variable', tooltip: 'La valeur rangée dans la boîte CHOIX.',
      };
      case 'nombre': return {
        message0: '%1',
        args0: [{ type: 'field_nombre_rr', name: 'NUM', value: 0 }],
        output: 'Number', style: 'bleu', tooltip: 'Un nombre. Pour une demi-seconde : 0,5',
      };
      case 'trou_instruction': return {
        message0: '? bloc manquant',
        previousStatement: null, nextStatement: null, style: 'trou',
        tooltip: 'Il manque un bloc ici : glisse le bon bloc de la palette juste au-dessus ou juste en dessous.',
      };
      default: return null;
    }
  }
  const TYPES_BLOCS = ['programme', 'led_etat', 'attendre', 'servo_angle', 'repeter', 'si_alors', 'si_sinon',
    'bouton_etat', 'valeur_haut_bas', 'comparaison', 'affecter', 'variable', 'nombre', 'trou_instruction'];

  // Ordre de la palette (comme les catégories de l'atelier céréales) et forme de départ de chaque bloc.
  const ORDRE = ['trou_instruction', 'led_etat', 'attendre', 'bouton_etat', 'valeur_haut_bas', 'servo_angle', 'repeter', 'si_alors', 'si_sinon', 'comparaison', 'affecter', 'variable', 'nombre'];
  const forme = (type) => {
    const nombre = (n) => ({ shadow: { type: 'nombre', fields: { NUM: n } } });
    const f = {
      attendre: { inputs: { DUREE: nombre(1) } },
      servo_angle: { inputs: { ANGLE: nombre(90) } },
      repeter: { inputs: { FOIS: nombre(2) } },
      affecter: { inputs: { VALEUR: nombre(0) } },
      // Menus : une vraie valeur au départ (le « ? » du mode à compléter n'est pas proposé d'office).
      led_etat: { fields: { ETAT: '1' } },
      valeur_haut_bas: { fields: { VALEUR: '1' } },
      comparaison: { fields: { OP: 'EQ' } },
    }[type] || {};
    if (reglages.broches && BROCHES[type]) f.fields = { ...f.fields, BROCHE: BROCHES[type][0] };
    return f;
  };

  let chargement = null;
  let theme = null;

  function script(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      const timer = setTimeout(() => { s.remove(); reject(new Error('La connexion à Labo Blocs est nécessaire pour les questions de blocs. Vérifie Internet puis réessaie.')); }, 15000);
      s.onload = () => { clearTimeout(timer); resolve(); };
      s.onerror = () => { clearTimeout(timer); reject(new Error('Impossible de joindre Labo Blocs. Vérifie Internet puis réessaie.')); };
      document.head.appendChild(s);
    });
  }

  /** Charge Blockly une seule fois (à l'avance si possible, pour ne pas faire attendre l'élève). */
  function charger() {
    if (!chargement) {
      chargement = script('https://anlito.github.io/labo-blocs/module/blockly/blockly_compressed.js?v=3')
        .then(() => script('https://anlito.github.io/labo-blocs/module/blockly/fr.js?v=3'))
        .then(() => {
          const B = window.Blockly;
          // Nombre : accepte la virgule (0,5) et, en mode « à compléter », la case vide « ? ».
          class ChampNombre extends B.FieldNumber {
            doClassValidation_(v) {
              if (v === TROU || (reglages.trous && v === '')) return reglages.trous ? TROU : null;
              return super.doClassValidation_(typeof v === 'string' ? v.replace(',', '.') : v);
            }
          }
          B.fieldRegistry.register('field_nombre_rr', ChampNombre);
          for (const type of TYPES_BLOCS) {
            B.Blocks[type] = { init() { this.jsonInit(definition(type)); } };
          }
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

  const ECHELLE_PALETTE = 0.75;
  const PROGRAMME_VIDE = { blocks: { languageVersion: 0, blocks: [{ type: 'programme', id: 'programme', x: 24, y: 20, deletable: false }] } };

  /**
   * Crée un éditeur dans `zone` avec les blocs autorisés.
   * options : broches (menus de broche), trous (« ? » permis), depart (sauvegarde Blockly de départ),
   *           blocManquant (le bloc « ? bloc manquant » dans la palette : préparation des trous par le professeur).
   * Renvoie { sauvegarder, effacer, charger, horsProgramme, detruire }.
   */
  function creer(zone, autorises, options = {}) {
    const B = window.Blockly;
    reglages = { broches: Boolean(options.broches), trous: Boolean(options.trous) };
    const types = ORDRE.filter((t) => autorises.includes(t) || (t === 'trou_instruction' && options.blocManquant));
    const contenu = types.map((type) => ({ kind: 'block', type, ...forme(type) }));
    const ws = B.inject(zone, {
      toolbox: contenu.length ? { kind: 'flyoutToolbox', contents: contenu } : undefined,
      renderer: 'zelos',
      media: 'https://anlito.github.io/labo-blocs/module/blockly/media/',
      theme,
      trashcan: true,
      sounds: false,
      move: { scrollbars: true, drag: true, wheel: true },
      zoom: { controls: true, wheel: false, pinch: true, startScale: 0.95, maxScale: 2, minScale: 0.5, scaleSpeed: 1.15 },
      grid: { spacing: 20, length: 2, colour: '#DDD6C8', snap: false },
      maxInstances: { programme: 1 },
    });
    // Palette plus petite que le programme : elle prenait la moitié de la largeur (blocs longs avec broche).
    const palette = ws.getFlyout();
    if (palette) {
      palette.getFlyoutScale = () => ws.scale * ECHELLE_PALETTE;
      palette.show(contenu);
    }
    function charger(sauvegarde) {
      B.Events.disable();
      try { ws.clear(); B.serialization.workspaces.load(sauvegarde, ws); } finally { B.Events.enable(); }
      for (const b of ws.getTopBlocks(false)) if (b.type === 'programme') b.setDeletable(false);
      ws.clearUndo();
      ws.scroll(0, 0);
    }
    const depart = () => charger(options.depart || PROGRAMME_VIDE);
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
    // « ? bloc manquant » (élève) : un bloc posé juste au-dessus ou juste en dessous prend sa place.
    // Sorti du programme, il disparaît : il ne sert qu'à montrer l'emplacement.
    function remplacerTrou(e) {
      if (options.blocManquant || e.type !== B.Events.BLOCK_MOVE) return;
      const b = ws.getBlockById(e.blockId);
      if (!b || b.isInsertionMarker()) return;
      const parent = e.newParentId ? ws.getBlockById(e.newParentId) : null;
      if (parent && parent.isInsertionMarker()) return;
      let trou = null;
      if (b.type === 'trou_instruction') {
        // Sorti du programme, ou poussé vers le bas par un bloc inséré juste au-dessus.
        if (!parent || e.newParentId !== e.oldParentId) trou = b;
      } else if (parent && parent.type === 'trou_instruction' && parent.getNextBlock() === b) trou = parent;
      if (!trou) return;
      // Recoller la suite à la main : Blockly ne recolle pas un bloc verrouillé (dispose(true) le supprimerait).
      B.Events.setGroup(e.group);
      const avant = trou.previousConnection.targetConnection;
      const apres = trou.getNextBlock();
      if (apres) trou.nextConnection.disconnect();
      trou.dispose(false);
      if (avant && apres) avant.connect(apres.previousConnection);
      B.Events.setGroup(false);
    }
    ws.addChangeListener((e) => {
      remplacerTrou(e);
      if (e.isUiEvent && e.type !== B.Events.BLOCK_DRAG) return;
      majHorsProgramme();
    });
    const observateur = new ResizeObserver(() => B.svgResize(ws));
    observateur.observe(zone);

    return {
      sauvegarder: () => B.serialization.workspaces.save(ws),
      /** Revient au départ : programme vide, ou programme à compléter de la question. */
      effacer: depart,
      /** Recharge un programme (sauvegarde Blockly), par exemple une séquence acceptée à modifier. */
      charger,
      // Recompté à la demande : les événements de Blockly arrivent en différé (et plus tard encore
      // quand la fenêtre n'est pas au premier plan).
      horsProgramme: () => { majHorsProgramme(); return hors; },
      detruire() { observateur.disconnect(); ws.dispose(); },
    };
  }

  return { charger, creer };
})();
