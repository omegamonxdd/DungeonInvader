/* ==========================================================
 * RANURAS DEL MENÚ CONSTRUIR — CATÁLOGO COMPARTIDO
 * ----------------------------------------------------------
 * Antes vivían en `back/ui/InterfaceController.js`. Se sacan a config para
 * que la lógica de obras (forzosamente ajena a la DOM) pueda consultar los
 * mismos datos al calcular qué edificios faltan o se desbloquean al subir el
 * núcleo. Espejo de los `buildables` del legacy (06-estructuras-ui.js).
 *
 * `resource` distingue las ranuras que comparten `kind`/`limitKind` pero se
 * cuentan por separado (almacenes de monedas/cristales).
 * ========================================================== */

export const SLOTS = [
  { id: 'ballista', name: 'Ballesta', cat: 'defensas', kind: 'ballista', costKey: 'ballista', limitKind: 'ballista', icon: 'bow' },
  { id: 'turret', name: 'Lanzadardos', cat: 'defensas', kind: 'turret', costKey: 'turret', limitKind: 'turret', icon: 'dart' },
  { id: 'catapult', name: 'Catapulta', cat: 'defensas', kind: 'catapult', costKey: 'catapult', limitKind: 'catapult', icon: 'catapult' },
  { id: 'rift', name: 'Grieta', cat: 'militar', kind: 'rift', costKey: 'rift', limitKind: 'rift', icon: 'target' },
  { id: 'lab', name: 'Laboratorio', cat: 'militar', kind: 'lab', costKey: 'lab', limitKind: 'lab', icon: 'flask' },
  { id: 'incubator', name: 'Incubadora', cat: 'militar', kind: 'incubator', costKey: 'incubator', limitKind: 'incubator', icon: 'egg' },
  { id: 'vault-coins', name: 'Alm. monedas', cat: 'recursos', kind: 'vault', costKey: 'vault-coins', limitKind: 'vault', resource: 'coins', icon: 'coin' },
  { id: 'vault-crystals', name: 'Alm. cristales', cat: 'recursos', kind: 'vault', costKey: 'vault-crystals', limitKind: 'vault', resource: 'crystals', icon: 'crystal' },
  { id: 'prod-crystals', name: 'Mina de cristal', cat: 'recursos', kind: 'mine', costKey: 'prod-crystals', limitKind: 'mine', icon: 'pick' },
  { id: 'prod-coins', name: 'Taller de monedas', cat: 'recursos', kind: 'workshop', costKey: 'prod-coins', limitKind: 'workshop', icon: 'coin' },
  { id: 'banner', name: 'Esqueletos', cat: 'estandartes', kind: 'banner', costKey: 'banner', limitKind: 'banner', icon: 'skull' },
  { id: 'bannerslime', name: 'Slimes', cat: 'estandartes', kind: 'bannerslime', costKey: 'bannerslime', limitKind: 'bannerslime', icon: 'slime' },
  { id: 'bomb', name: 'Bomba', cat: 'trampas', kind: 'bomb', costKey: 'bomb', limitKind: 'bomb', icon: 'bomb' },
  { id: 'rocktrap', name: 'T. de rocas', cat: 'trampas', kind: 'rocktrap', costKey: 'rocktrap', limitKind: 'rocktrap', icon: 'spikes' },
  { id: 'electro', name: 'Electrostal', cat: 'trampas', kind: 'electro', costKey: 'electro', limitKind: 'electro', icon: 'impact' },
];

export const CATS = ['recursos', 'militar', 'defensas', 'estandartes', 'trampas'];
