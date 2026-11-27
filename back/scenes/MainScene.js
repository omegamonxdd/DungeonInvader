import Phaser from 'phaser';
import { COLORS } from '../config/palette.js';
import {
  CORE_HEIGHT, CORE_MIN, DIRT_HEIGHT,
  ENTRANCE_X, ENTRANCE_X_MAX, ENTRANCE_Y_MAX, ENTRANCE_Y_MIN,
} from '../config/world.js';
import { iso } from '../systems/iso.js';
import { CORE_DEPTH, ENTRANCE_DEPTH } from '../config/interaction.js';
import { createMap } from '../systems/map.js';
import { ensureTerrainTextures } from '../systems/textures.js';
import { CameraController } from '../systems/CameraController.js';
import { TerrainState } from '../systems/TerrainState.js';
import { MoveController } from '../systems/MoveController.js';
import { InteractionController } from '../systems/InteractionController.js';
import { Resources } from '../systems/Resources.js';
import { WorkController } from '../systems/WorkController.js';
import { StructureFactory } from '../systems/StructureFactory.js';
import { Army } from '../systems/Army.js';
import { ProductionController } from '../systems/ProductionController.js';
import { buildCost } from '../balance/index.js';
import { specFor } from '../systems/structureSpecs.js';
import { Defender } from '../enemies/Defender.js';
import { ShortcutController } from '../systems/ShortcutController.js';
import { EditorController } from '../systems/EditorController.js';
import { TerrainView } from '../entities/TerrainView.js';
import { CoreView } from '../entities/CoreView.js';
import { EntranceView } from '../entities/EntranceView.js';
import { InteractionView } from '../entities/InteractionView.js';
import { WorkView } from '../entities/WorkView.js';
import { TopoView } from '../entities/TopoView.js';
import { TopoController } from '../systems/TopoController.js';
import { InvasionController } from '../enemies/InvasionController.js';
import { InterfaceController } from '../ui/InterfaceController.js';
import { UpgradeMenu } from '../ui/UpgradeMenu.js';
import { ShortcutsUI } from '../ui/ShortcutsUI.js';
import { finishLoading } from '../../front/loading/splash.js';
import { getService } from '../database/index.js';

/* Escena principal.
 * Fase 3: mundo isométrico (terreno, núcleo, entrada) y cámara.
 * Fase 4: ballesta de nivel 1 con pedestal fijo y cabeza de 24 ángulos.
 * Fase 5: selección, herramientas de terreno, modo Mover y animaciones.
 * Fase 7: interfaz DOM/CSS (menú Construir, barra de acciones, HUD y
 * ventana de Información/Mejorar) conectada con la escena.
 * Fase 8: invasión simulada (tropas, pathfinding, proyectiles y oleadas).
 * Fase 9: obras reales (recursos, constructores, temporizadores y mejoras).
 * Fase 10: catálogo completo de estructuras, ejército y producción.
 * Fase 11: atajos configurables, editor de mazmorra y topos animados.
 */
export class MainScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MainScene' });
  }

  create() {
    this.cameras.main.setBackgroundColor(COLORS.void);

    // Capa de persistencia (la UI de acceso ya existe desde main.js).
    this.saveService = getService();
    this.stats = { invasions: 0, wins: 0, losses: 0, bestWave: 0 };

    this.map = createMap();
    this.terrain = new TerrainState(this.map);

    ensureTerrainTextures(this);

    this.terrainView = new TerrainView(this, this.map);
    this.terrainView.build();

    this.coreView = new CoreView(this);
    this.entranceView = new EntranceView(this);

    // Fase 10: una sola fábrica crea el registro lógico y la vista de cada
    // edificio. La ballesta conserva su clase con sprite real; núcleo y
    // entrada mantienen sus vistas dedicadas.
    this.structures = [];
    this.factory = new StructureFactory(this, this.structures);
    this.fusionPending = null;
    this.homeDefenders = [];

    const core = this.factory.create('core', CORE_MIN, CORE_MIN, {
      id: 'core', placed: true, movable: true,
    });
    core.depth = CORE_DEPTH;
    core.height = CORE_HEIGHT;
    // La vista dedicada del núcleo expone el mismo contrato que las demás.
    core.view = this.coreView;

    const entrance = this.factory.create('entrance', ENTRANCE_X, ENTRANCE_Y_MIN, {
      id: 'entrance', placed: true, movable: false,
    });
    entrance.w = ENTRANCE_X_MAX - ENTRANCE_X + 1; // 2 columnas: dentro + hueco exterior
    entrance.h = ENTRANCE_Y_MAX - ENTRANCE_Y_MIN + 1;
    entrance.depth = ENTRANCE_DEPTH;

    // El usuario empieza sin defensas: solo el núcleo (y la entrada fija).
    // Las defensas se colocan desde el editor de construcción.
    this.selection = null;

    // Fase 9: recursos vivos y obras en tiempo real.
    this.resources = new Resources({
      structures: this.structures,
      getCoreLevel: () => this.works?.coreLevel() || 1,
    });
    this.extra = { fusionReductions: {} };
    this.works = new WorkController({
      structures: this.structures,
      terrain: this.terrain,
      resources: this.resources,
      extra: this.extra,
      onToast: msg => this.ui?.showToast(msg),
      onLevel: def => {
        if (def.kind === 'core') this.ui?.refreshBuildItems();
        this.ui?.refreshTerrainUI();
        this.ui?.refreshSelection();
        this.ui?.syncResources();
        this.saveService?.markDirty();
      },
      onState: () => {
        this.ui?.refreshCostTags();
        this.saveService?.markDirty();
      },
    });
    this.workView = new WorkView(this);

    // Fase 10: ejército alimentado por grieta/incubadora y laboratorio.
    const levelOf = kind => this.structures.find(d => d.kind === kind)?.level || 0;
    this.army = new Army({
      entranceLevel: () => levelOf('entrance') || 1,
      riftLevel: () => levelOf('rift'),
      incubatorLevel: () => levelOf('incubator'),
      labLevel: () => levelOf('lab'),
      coreLevel: () => this.works?.coreLevel() || 1,
      resources: this.resources,
      onToast: msg => this.ui?.showToast(msg),
      onChange: () => {
        this.ui?.renderInvasionItems();
        this.saveService?.markDirty();
      },
    });

    this.production = new ProductionController({
      structures: this.structures,
      resources: this.resources,
      getCoreLevel: () => this.works.coreLevel(),
      onChange: () => this.ui?.syncResources(),
    });

    this.cameraController = new CameraController(this, {
      onPinchStart: () => this.interaction?.cancelPointer?.(),
    });
    this.cameraController.start();

    // Tras rotar, entrar en pantalla completa o hacer zoom con dos dedos,
    // Phaser debe recalcular el lienzo: si no, el mapa queda en un recuadro
    // y el HUD aparece fuera de él.
    const fitCanvas = () => {
      this.game.scale.resize(window.innerWidth, window.innerHeight);
      this.cameraController?.apply();
    };
    window.addEventListener('resize', fitCanvas);
    window.addEventListener('orientationchange', () => setTimeout(fitCanvas, 120));
    document.addEventListener?.('fullscreenchange', () => setTimeout(fitCanvas, 120));
    document.addEventListener?.('webkitfullscreenchange', () => setTimeout(fitCanvas, 120));
    setTimeout(fitCanvas, 120);

    this.interactionView = new InteractionView(this);
    this.moveController = new MoveController(
      this, this.structures, this.terrain, this.cameraController,
      finished => {
        const isFusion = Boolean(this.fusionPending && this.fusionPending.markedIds);
        if (finished.commit && isFusion) {
          const ok = this.commitFusion(finished.def);
          if (!ok) {
            // MoveController ya colocó la huella al confirmar; hay que limpiarla.
            const d = finished.def;
            this.terrain.setFootprint(d.x, d.y, d.w || d.size, d.h || d.size, false);
            this.cancelFusion();
            this.factory.destroy(d);
            this.ui?.refreshBuildItems();
            this.ui?.refreshTerrainUI();
            this.ui?.syncScene();
            return;
          }
          this.interactionView.setHoverStructure(null);
          this.ui?.refreshBuildItems();
          this.ui?.refreshTerrainUI();
          this.editor?.refresh();
          this.ui?.syncScene();
          return;
        }
        if (!finished.commit && isFusion) this.cancelFusion();
        // Guardar/colocar desde el editor no es una obra nueva: solo cuenta
        // la colocación definitiva de una estructura recién comprada.
        if (finished.commit && finished.isNew && !finished.fromStore) {
          this.works.startBuild(finished.id);
        }
        if (finished.commit) this.select(finished.def);
        if (finished.commit) this.saveService?.markDirty();
        this.interactionView.setHoverStructure(null);
        this.ui?.refreshBuildItems();
        this.ui?.refreshTerrainUI();
        this.editor?.refresh();
        this.ui?.syncScene();
      },
      // El coste de construcción se cobra al confirmar (cancelar es gratis).
      // Las recolocaciones del editor nunca cobran. Fusión valida al confirmar.
      def => {
        if (this.fusionPending) {
          const pending = this.fusionPending;
          if (this.works.coreLevel() < 4 || this.army?.hasRag?.()) return false;
          const marked = pending.markedIds
            .map(id => this.structures.find(d => d.id === id))
            .filter(d => d && d.kind === 'banner' && d.placed && !d.shelved && !d.moving && !d.work && (d.level || 1) >= 6);
          if (marked.length < 2) return false;
          return this.resources.canAfford(pending.cost);
        }
        return (!this.moveController?.isNew || this.moveController?.fromStore)
          || this.works.payBuild(def);
      },
    );

    // Fase 8: el combate ocurre en una capa de simulación; la base real no
    // se modifica (toda la vida copiada vive en invasion.siege).
    this.invasion = new InvasionController(this, {
      terrain: this.terrain,
      structures: this.structures,
      army: this.army,
      resources: this.resources,
      service: this.saveService,
      getContext: () => this.getSaveContext(),
      clearSelection: () => this.select(null),
      onToast: msg => this.ui?.showToast(msg),
      onState: inv => {
        if (inv.active) this.upgrades?.setOpen(false);
        this.ui?.syncInvasion(inv);
      },
      onEnd: result => {
        this.saveService?.recordInvasion(result);
        this.saveService?.flushPending();
        this.ui?.showEnd(result);
      },
    });

    this.interaction = new InteractionController(this, {
      terrain: this.terrain,
      structures: this.structures,
      camera: this.cameraController,
      move: this.moveController,
      view: this.interactionView,
      invasion: this.invasion,
      select: def => this.select(def),
      onCellChanged: cell => {
        this.terrainView.refresh(cell.x, cell.y);
        this.ui?.refreshTerrainUI();
        this.saveService?.markDirty();
      },
    });

    // Fase 7: el puente DOM/CSS se crea después de la escena para poder
    // consultar sus estructuras y pedirle que coloque una nueva estructura.
    this.ui = new InterfaceController({
      terrain: this.terrain,
      structures: this.structures,
      move: this.moveController,
      invasion: this.invasion,
      resources: this.resources,
      works: this.works,
      army: this.army,
      extra: this.extra,
      selectMode: () => this.interaction,
      select: def => this.select(def),
      build: slot => this.placeNew(slot),
      focus: id => this.focusStructure(id),
    });
    this.interaction.ui = this.ui;
    this.ui.cameraController = this.cameraController;

    // Fase 11: ventanas de atajos y confirmación reutilizable.
    this.shortcutsUI = new ShortcutsUI({
      showToast: msg => this.ui.showToast(msg),
    });

    this.editor = new EditorController({
      scene: this,
      structures: this.structures,
      terrain: this.terrain,
      move: this.moveController,
      ui: this.ui,
      invasion: this.invasion,
      confirm: this.shortcutsUI,
      camera: this.cameraController,
      select: def => this.select(def),
      getSelection: () => this.selection,
      showToast: msg => this.ui.showToast(msg),
      onChange: () => {
        if (this.editor?.active) this.upgrades?.setOpen(false);
        this.ui.refreshTerrainUI();
        this.ui.refreshBuildItems();
        this.ui.syncResources();
        this.ui.syncScene();
        this.saveService?.markDirty();
      },
    });
    this.ui.editor = this.editor;
    this.interaction.editor = this.editor;

    // Menú de mejoras pendientes del legacy (botón bajo los recursos).
    this.upgrades = new UpgradeMenu({
      ui: this.ui,
      structures: this.structures,
      works: this.works,
      resources: this.resources,
      army: this.army,
      invasion: this.invasion,
      editor: this.editor,
      move: this.moveController,
      extra: this.extra,
      select: def => this.select(def),
      focus: id => this.focusStructure(id),
    });
    this.interaction.upgrades = this.upgrades;

    // Topos decorativos y constructores: se pausan solos en editor/invasión.
    this.topoController = new TopoController({
      scene: this,
      terrain: this.terrain,
      structures: this.structures,
      works: this.works,
      invasion: this.invasion,
      editor: this.editor,
      onToast: msg => this.ui.showToast(msg),
    });
    this.topoView = new TopoView(this);

    const tool = name => () => {
      this.terrain.setTool(name);
      this.interactionView.setToolState(name, true);
      this.interactionView.setToolCell(null);
      this.ui.refreshTerrainUI();
    };
    this.shortcuts = new ShortcutController({
      ui: this.ui,
      editor: this.editor,
      invasion: this.invasion,
      move: this.moveController,
      terrain: this.terrain,
      shortcutsUI: this.shortcutsUI,
      showToast: msg => this.ui.showToast(msg),
      run: {
        info: () => this.ui.openPanel('info'),
        upgrade: () => this.ui.openPanel('upgrade'),
        move: () => {
          const sel = this.selection;
          if (sel?.movable && !this.moveController.active) {
            this.moveController.start(sel.id, false, Boolean(this.editor.active && sel.shelved));
          }
        },
        special: () => this.ui.triggerSpecial(),
        invasion: () => this.ui.toggleInvasion(),
        build: () => this.ui.setBuildOpen(!this.ui.buildUI.open),
        upgrades: () => this.upgrades?.setOpen(!this.upgrades.open),
        'tab-recursos': () => this.ui.setBuildCategory('recursos'),
        'tab-militar': () => this.ui.setBuildCategory('militar'),
        'tab-defensas': () => this.ui.setBuildCategory('defensas'),
        'tab-estandartes': () => this.ui.setBuildCategory('estandartes'),
        'tab-trampas': () => this.ui.setBuildCategory('trampas'),
        dig: tool('dig'),
        fill: tool('fill'),
        edig: () => this.editor.setTool('dig'),
        efill: () => this.editor.setTool('fill'),
        einfo: () => this.ui.openPanel('info'),
        emove: () => {
          const sel = this.selection;
          if (sel?.movable && !this.moveController.active) {
            this.moveController.start(sel.id, false, Boolean(sel.shelved));
          }
        },
        eretire: () => this.editor.retireSelected(),
      },
    });
    this.shortcutsUI.shortcuts = this.shortcuts;
    this.shortcuts.refreshHints();
    this.ui.shortcuts = this.shortcuts;
    this.ui.shortcutsUI = this.shortcutsUI;
    this.interaction.shortcuts = this.shortcuts;

    // Un único oyente de teclado para los atajos configurables (ShortcutsUI
    // gestiona aparte la captura y las ventanas modales).
    window.addEventListener('keydown', e => this.shortcuts.handleKeydown(e));

    // La escena ya está lista: conectamos la persistencia y retiramos la
    // pantalla de carga. `start()` es idempotente (main.js también la llama).
    this.saveService?.attach(this.getSaveContext());
    this.saveService?.start();

    finishLoading();
  }

  /** Contexto vivo que comparten guardados e invasiones. Se calcula en el
   *  momento de usarlo porque los controladores se crean por etapas. */
  getSaveContext() {
    return {
      scene: this,
      terrain: this.terrain,
      structures: this.structures,
      factory: this.factory,
      resources: this.resources,
      works: this.works,
      army: this.army,
      invasion: this.invasion,
      editor: this.editor,
      ui: this.ui,
      upgrades: this.upgrades,
      stats: this.stats,
      extra: this.extra,
    };
  }

  select(def) {
    if (this.invasion?.active) return;
    this.selection = def || null;
    this.interactionView.setSelection(def);
    this.ui?.setSelection(def);
    this.editor?.syncSelection();
    // Minas y talleres se recogen con un clic, como en el legacy.
    if (def?.producer) {
      const took = this.production?.collect(def);
      if (took) this.ui?.showToast(`${def.name || 'Producción'} recogida`);
    }
  }

  // Fila del recuadro de constructores: selecciona y centra la estructura.
  focusStructure(id) {
    const def = this.structures.find(d => d.id === id);
    if (!def) return;
    this.select(def);
    const p = iso(
      def.x + (def.w || def.size) / 2,
      def.y + (def.h || def.size) / 2,
      (def.kind === 'core' ? CORE_HEIGHT : (def.height || DIRT_HEIGHT)) / 2,
    );
    this.cameraController.x = p.x;
    this.cameraController.y = p.y;
    this.cameraController.clamp();
    this.cameraController.apply();
  }

  // El menú Construir crea la estructura con la fábrica y entra directamente
  // en modo Mover. Cancelar antes de colocarla no cobra ni la deja en el mapa.
  placeNew(slotOrId) {
    const slot = typeof slotOrId === 'string'
      ? this.ui?.slots?.find(s => s.id === slotOrId)
      : slotOrId;
    if (!slot) return false;
    if (this.moveController.active || this.invasion.active || this.editor?.active) return false;
    const spec = specFor(slot.kind);
    if (spec?.unique && this.structures.some(d => d.kind === slot.kind)) {
      this.ui?.showToast(`${slot.name} ya está construida`);
      return false;
    }
    if (slot.tag === 'fusion') return this.startFusion(slot);

    if (this.works.free() <= 0) {
      this.ui?.showToast(`Sin constructores libres (${this.works.limit}/${this.works.limit} ocupados)`);
      return false;
    }

    const def = this.factory.create(slot.kind, 0, 0, {
      resource: slot.resource,
      costKey: slot.costKey,
      limitKind: slot.limitKind,
      placed: false,
    });
    if (!def) return false;
    if (!this.moveController.start(def.id, true)) {
      this.factory.destroy(def);
      return false;
    }
    return true;
  }

  fusionCandidates() {
    return this.structures.filter(def => (
      def.kind === 'banner'
      && def.placed
      && !def.shelved
      && !def.moving
      && !def.work
      && (def.level || 1) >= 6
    ));
  }

  clearFusionMarks() {
    for (const def of this.structures) def.view?.setFusionMarked?.(false);
  }

  startFusion(slot) {
    if (this.works.coreLevel() < 4) {
      this.ui?.showToast('Necesitas núcleo nivel 4');
      return false;
    }
    if (this.army?.hasRag?.() || this.structures.some(d => d.kind === 'rag-altar')) {
      this.ui?.showToast('Rag ya ha sido invocado');
      return false;
    }
    const candidates = this.fusionCandidates();
    if (candidates.length < 2) {
      this.ui?.showToast('Necesitas 2 estandartes de esqueletos de nivel 6');
      return false;
    }
    const cost = buildCost(slot.costKey || 'rag-altar');
    if (!this.resources.canAfford(cost)) {
      this.ui?.showToast('No tienes suficientes rubíes');
      return false;
    }

    const marked = candidates.slice(0, 2);
    this.clearFusionMarks();
    marked.forEach(def => def.view?.setFusionMarked?.(true));
    this.fusionPending = { slot, markedIds: marked.map(d => d.id), cost };

    const def = this.factory.create(slot.kind, 0, 0, {
      resource: slot.resource,
      costKey: slot.costKey,
      limitKind: slot.limitKind,
      placed: false,
    });
    if (!def) {
      this.clearFusionMarks();
      this.fusionPending = null;
      return false;
    }
    if (!this.moveController.start(def.id, true)) {
      this.factory.destroy(def);
      this.clearFusionMarks();
      this.fusionPending = null;
      return false;
    }
    this.ui?.showToast('Coloca la Runa de Rag para completar la fusión');
    return true;
  }

  commitFusion(def) {
    const pending = this.fusionPending;
    if (!pending) return false;
    if (this.works.coreLevel() < 4) { this.ui?.showToast('Necesitas núcleo nivel 4'); return false; }
    if (this.army?.hasRag?.()) { this.ui?.showToast('Rag ya ha sido invocado'); return false; }

    const marked = pending.markedIds
      .map(id => this.structures.find(d => d.id === id))
      .filter(d => d && d.kind === 'banner' && d.placed && !d.shelved && !d.moving && !d.work && (d.level || 1) >= 6);
    if (marked.length < 2) {
      this.ui?.showToast('La fusión ya no es válida');
      return false;
    }
    if (!this.resources.pay(pending.cost)) {
      this.ui?.showToast('No tienes suficientes rubíes');
      return false;
    }

    // Consumir banners fusionados.
    for (const banner of marked.slice(0, 2)) {
      this.terrain.setFootprint(banner.x, banner.y, banner.w || banner.size, banner.h || banner.size, false);
      this.factory.destroy(banner);
    }

    // Crear Runa definitiva en la posición confirmada.
    def.placed = true;
    def.moving = false;
    def.shelved = false;
    this.terrain.setFootprint(def.x, def.y, def.w || def.size, def.h || def.size, true);
    def.view?.clearFloating?.();
    def.view?.placeAt?.(def.x, def.y, 0);

    this.extra.fusionReductions.banner = Math.max(0, (this.extra.fusionReductions.banner || 0) + 2);
    if (this.army) {
      this.army.counts.rag = Math.max(1, this.army.counts.rag || 0);
      this.army.onChange?.();
    }

    this.clearFusionMarks();
    this.fusionPending = null;
    this.select(def);
    this.ui?.refreshBuildItems();
    this.ui?.refreshTerrainUI();
    this.ui?.syncScene();
    this.saveService?.markDirty();
    this.ui?.showToast('Rag el conquistador ha sido invocado');
    return true;
  }

  cancelFusion() {
    if (!this.fusionPending) return;
    this.clearFusionMarks();
    this.fusionPending = null;
  }

  clearHomeDefenders() {
    for (const d of this.homeDefenders || []) d.destroy?.();
    this.homeDefenders = [];
  }

  syncHomeDefenders(time = this.time?.now || 0) {
    if (this.invasion?.active) {
      this.clearHomeDefenders();
      return;
    }
    const wanted = [];
    for (const def of this.structures) {
      const spec = specFor(def);
      const guard = spec?.guard;
      if (guard?.troop !== 'rag' || !def.placed || def.shelved || def.moving) continue;
      wanted.push(def);
    }

    const keep = new Set();
    for (const def of wanted) {
      const id = `home:${def.id}:rag`;
      keep.add(id);
      let d = (this.homeDefenders || []).find(x => x.homeId === id);
      const cx = def.x + (def.w || def.size) / 2;
      const cy = def.y + (def.h || def.size) / 2;
      const level = this.army?.levelOf?.('rag') || 1;
      const max = this.army?.ragMaxLevel?.() || 5;
      if (!d) {
        d = new Defender(this, this.invasion, 'rag', level, { x: cx, y: cy }, cx + 0.2, cy + 0.1, {
          home: true,
          label: String(level),
          maxLabel: level >= max,
        });
        d.homeId = id;
        this.homeDefenders.push(d);
      } else {
        d.post = { x: cx, y: cy };
        d.level = level;
        d.label = String(level);
        d.maxLabel = level >= max;
      }
      d.update(0, time); // solo render/posición suave, sin combate
    }
    for (const d of [...(this.homeDefenders || [])]) {
      if (keep.has(d.homeId)) continue;
      d.destroy?.();
      this.homeDefenders = this.homeDefenders.filter(x => x !== d);
    }
  }

  update(time) {
    const delta = this.game.loop.delta;
    this.coreView.update(time);
    this.works.step();
    this.army?.step();
    // Las minas/talleres de la base prestada no producen durante una invasión.
    if (!this.invasion?.active) this.production.step(delta / 1000);
    this.topoController.step(delta / 1000, time);

    // El paso de invasión va antes del dibujo de las defensas para que el
    // objetivo fijado por stepDefenses() se vea en el mismo frame.
    this.invasion.step(delta, time);
    this.syncHomeDefenders(time);
    for (const def of this.structures) {
      if (def.view) def.view.update(time);
    }
    this.workView.update(this.works.jobs());
    this.topoView.update(this.topoController.topos, this.topoController.puffs, time);
    this.moveController.update(time, delta);
    this.interactionView.update();
    this.cameraController.update(delta);
    this.ui?.syncScene();
  }
}
