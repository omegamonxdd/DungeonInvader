/* Medidas del arte 2.5D estático (sin rotación): almacenes y taller de monedas.
 * Generado por tools/vault-art/ y tools/workshop-art/. Comparten celda, ancla y
 * escala para que todas las estructuras estáticas se lean como un mismo set.
 */
export const VAULT_ART = Object.freeze({
  cell: 256,
  artScale: 1.0947,
  anchor: Object.freeze({ x: 128, y: 182 }),
  coins: Object.freeze({ texture: 'vault-coins' }),
  crystals: Object.freeze({ texture: 'vault-crystals' }),
  workshop: Object.freeze({ texture: 'workshop' }),
});

export function vaultArtFor(kind) {
  if (kind === 'vault-coins') return VAULT_ART.coins;
  if (kind === 'vault-crystals') return VAULT_ART.crystals;
  if (kind === 'workshop') return VAULT_ART.workshop;
  return null;
}

// Alias más descriptivo: aplica a cualquier estructura estática horneada.
export const staticArtFor = vaultArtFor;
