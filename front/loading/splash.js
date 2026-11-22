/* Controlador de la pantalla de carga.
 *
 * El marcado y el CSS crítico viven en index.html (raíz) para que la pantalla
 * se pinte antes de descargar el bundle de Phaser. Este módulo solo la
 * actualiza: es interfaz, por eso reside en front/.
 *
 * API (la consumen back/scenes/BootScene.js y back/scenes/MainScene.js):
 *   beginLoading(label)             cambia a progreso real y reinicia la barra
 *   setLoadingProgress(ratio, txt)   ratio 0..1 + detalle opcional
 *   failLoading(detail)             deja el mensaje de error visible
 *   finishLoading()                 completa y retira la pantalla
 */

const IDS = {
  root: 'loading-screen',
  phase: 'loading-phase',
  bar: 'loading-bar',
  fill: 'loading-fill',
  percent: 'loading-percent',
  detail: 'loading-detail',
};

let cached = null;
let lastRatio = 0;
let finished = false;

function nodes() {
  if (cached) return cached;
  const root = document.getElementById(IDS.root);
  if (!root) return null;
  cached = Object.fromEntries(
    Object.entries(IDS).map(([key, id]) => [key, key === 'root' ? root : document.getElementById(id)]),
  );
  return cached;
}

function paint(ratio) {
  const el = nodes();
  if (!el) return;
  const pct = Math.round(ratio * 100);
  el.fill.style.width = `${pct}%`;
  el.bar.setAttribute('aria-valuenow', String(pct));
  el.percent.textContent = `${pct}%`;
}

export function beginLoading(label = 'Cargando recursos…') {
  const el = nodes();
  if (!el || finished) return;
  lastRatio = 0;
  el.root.classList.add('is-ready');
  el.root.classList.remove('is-error');
  el.phase.textContent = label;
  el.detail.textContent = '';
  paint(0);
}

export function setLoadingProgress(ratio, detail) {
  const el = nodes();
  if (!el || finished) return;
  // Phaser emite valores entre 0 y 1; nunca retrocedemos para no "recargar" la barra.
  const safe = Number.isFinite(ratio) ? Math.min(1, Math.max(0, ratio)) : lastRatio;
  lastRatio = Math.max(lastRatio, safe);
  paint(lastRatio);
  if (detail != null) el.detail.textContent = detail;
}

export function failLoading(detail = 'Revisa la consola y vuelve a intentarlo.') {
  const el = nodes();
  if (!el || finished) return;
  el.root.classList.remove('is-ready');
  el.root.classList.add('is-error');
  el.phase.textContent = 'No se pudo abrir la mazmorra';
  el.detail.textContent = detail;
  el.root.setAttribute('aria-label', 'Error al cargar Dungeon Build');
}

export function finishLoading() {
  const el = nodes();
  if (!el || finished) return;
  finished = true;
  paint(1);
  el.phase.textContent = 'Mazmorra lista';
  el.detail.textContent = '';
  el.root.classList.add('is-ready', 'is-done');
  el.root.removeAttribute('role');
  el.root.addEventListener('transitionend', () => el.root.remove(), { once: true });
  // Si el usuario prefiere menos movimiento no hay transición que dispare el evento.
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) el.root.remove();
}
