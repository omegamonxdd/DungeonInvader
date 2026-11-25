/* Assets del juego.
 * El arte 2.5D de la ballesta, del lanzadardos, de la catapulta y del núcleo
 * se genera con los pipelines tools/ballista-art/, tools/turret-art/,
 * tools/catapult-art/ y tools/core-art/ y vive en front/assets/estructuras/.
 * Vite resuelve las URLs tanto en desarrollo como en el build. El resto de
 * texturas se hornean en memoria en back/.
 */
import ballistaBase from '../../front/assets/estructuras/ballesta/ballista-base.png';
import ballistaHead0 from '../../front/assets/estructuras/ballesta/ballista-head-g0.png';
import ballistaHead1 from '../../front/assets/estructuras/ballesta/ballista-head-g1.png';
import ballistaHead2 from '../../front/assets/estructuras/ballesta/ballista-head-g2.png';
import ballistaHead3 from '../../front/assets/estructuras/ballesta/ballista-head-g3.png';
import turretBase from '../../front/assets/estructuras/lanzadardos/turret-base.png';
import turretHead0 from '../../front/assets/estructuras/lanzadardos/turret-head-g0.png';
import turretHead1 from '../../front/assets/estructuras/lanzadardos/turret-head-g1.png';
import turretHead2 from '../../front/assets/estructuras/lanzadardos/turret-head-g2.png';
import turretHead3 from '../../front/assets/estructuras/lanzadardos/turret-head-g3.png';
import catapultBase from '../../front/assets/estructuras/catapulta/catapult-base.png';
import catapultHead0 from '../../front/assets/estructuras/catapulta/catapult-head-g0.png';
import catapultHead1 from '../../front/assets/estructuras/catapulta/catapult-head-g1.png';
import catapultHead2 from '../../front/assets/estructuras/catapulta/catapult-head-g2.png';
import catapultHead3 from '../../front/assets/estructuras/catapulta/catapult-head-g3.png';
import coreImage from '../../front/assets/estructuras/nucleo/core.png';
import coreGlow from '../../front/assets/estructuras/nucleo/core-glow.png';
import vaultCoinsImage from '../../front/assets/estructuras/almacen-monedas/vault-coins.png';
import vaultCrystalsImage from '../../front/assets/estructuras/almacen-cristales/vault-crystals.png';

export const ASSETS = Object.freeze({
  ballista: Object.freeze({
    base: ballistaBase,
    heads: Object.freeze([ballistaHead0, ballistaHead1, ballistaHead2, ballistaHead3]),
  }),
  turret: Object.freeze({
    base: turretBase,
    heads: Object.freeze([turretHead0, turretHead1, turretHead2, turretHead3]),
  }),
  catapult: Object.freeze({
    base: catapultBase,
    heads: Object.freeze([catapultHead0, catapultHead1, catapultHead2, catapultHead3]),
  }),
  core: Object.freeze({
    image: coreImage,
    glow: coreGlow,
  }),
  vaultCoins: Object.freeze({ image: vaultCoinsImage }),
  vaultCrystals: Object.freeze({ image: vaultCrystalsImage }),
});
