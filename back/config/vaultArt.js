/* Medidas del arte 2.5D de almacenes (estáticos, sin rotación).
 * Generado por tools/vault-art/generate.mjs. */
export const VAULT_ART = Object.freeze({
  cell: 256,
  artScale: 1.0947,
  anchor: Object.freeze({ x: 128, y: 182 }),
  coins: Object.freeze({ texture: 'vault-coins' }),
  crystals: Object.freeze({ texture: 'vault-crystals' }),
});

export function vaultArtFor(kind) {
  if (kind === 'vault-coins') return VAULT_ART.coins;
  if (kind === 'vault-crystals') return VAULT_ART.crystals;
  return null;
}