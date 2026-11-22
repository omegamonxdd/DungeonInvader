/* ==========================================================
 * FASE 8 — ARTE DE LAS TROPAS (no es balance)
 * ----------------------------------------------------------
 * Los números de vida/daño/velocidad están en balance/08-tropas.js.
 * Aquí solo viven los nombres y la paleta de cada tipo, y se hornean
 * texturas pequeñas con Canvas (igual que se hornea el terreno).
 * ========================================================== */

export const TROOP_ART = Object.freeze({
  esqueleto: { name: 'Esqueleto', color: '#d9c7a0', hi: '#f4ead0', lo: '#7d7054', w: 22, h: 26 },
  slime: { name: 'Slime', color: '#6fd36a', hi: '#b6f5a4', lo: '#2e7e3a', w: 24, h: 20 },
  golem: { name: 'Golem de madera', color: '#8a5a2b', hi: '#b88147', lo: '#3a2312', w: 26, h: 30 },
  murcielago: { name: 'Murciélago', color: '#7a4fa3', hi: '#b58ad6', lo: '#3d2754', w: 28, h: 20 },
  armadura: { name: 'Armadura de ceniza', color: '#7a6a62', hi: '#b7a79c', lo: '#3e3632', w: 26, h: 30 },
  arana: { name: 'Araña madre', color: '#5a3d73', hi: '#8a66a3', lo: '#2f2140', w: 30, h: 24 },
  'arana-bebe': { name: 'Araña bebé', color: '#8a66a3', hi: '#c0a2d6', lo: '#3d2754', w: 18, h: 16 },
});

export const troopTextureKey = id => `inv-troop-${id}`;
export const BOLT_TEX = 'inv-bolt';
export const IMPACT_TEX = 'inv-impact';
// Proyectil de la catapulta: roca y nube de polvo al caer (mortero).
export const STONE_TEX = 'inv-stone';
export const DUST_TEX = 'inv-dust';

const px = (g, x, y, w, h, c) => {
  g.fillStyle = c;
  g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
};

function drawShadow(g, art) {
  g.fillStyle = 'rgba(0,0,0,0.28)';
  g.beginPath();
  g.ellipse(art.w / 2, art.h - 3, art.w * 0.34, 2.4, 0, 0, Math.PI * 2);
  g.fill();
}

function drawSkeleton(g, a) {
  px(g, 7, 2, 8, 7, a.hi);
  px(g, 7, 2, 8, 2, '#ffffff');
  px(g, 9, 5, 2, 2, a.lo); px(g, 12, 5, 2, 2, a.lo);
  px(g, 8, 9, 6, 7, a.color);
  for (let y = 10; y <= 14; y += 2) px(g, 7, y, 8, 1, a.hi);
  px(g, 3, 10, 4, 2, a.hi); px(g, 15, 10, 4, 2, a.hi);
  px(g, 3, 12, 2, 5, a.color); px(g, 17, 12, 2, 5, a.color);
  px(g, 8, 16, 2, 6, a.hi); px(g, 12, 16, 2, 6, a.hi);
  px(g, 7, 22, 4, 2, a.lo); px(g, 12, 22, 4, 2, a.lo);
}

function drawSlime(g, a) {
  for (let i = 0; i < 5; i++) {
    const w = 8 + i * 3;
    px(g, (a.w - w) / 2, 5 + i * 3, w, 4, i % 2 ? a.color : a.hi);
  }
  px(g, 3, 17, 18, 2, a.lo);
  px(g, 8, 9, 2, 3, '#1b2b1b'); px(g, 15, 9, 2, 3, '#1b2b1b');
  px(g, 11, 14, 3, 1, a.lo);
}

function drawGolem(g, a) {
  px(g, 8, 2, 10, 7, a.color);
  px(g, 8, 2, 10, 2, a.hi);
  px(g, 10, 5, 2, 2, a.lo); px(g, 15, 5, 2, 2, a.lo);
  px(g, 5, 10, 16, 11, a.color);
  px(g, 5, 10, 16, 2, a.hi);
  px(g, 7, 13, 12, 1, a.lo);
  px(g, 1, 11, 4, 8, a.lo); px(g, 21, 11, 4, 8, a.lo);
  px(g, 7, 21, 5, 6, a.lo); px(g, 15, 21, 5, 6, a.lo);
  px(g, 11, 12, 2, 6, a.hi);
}

function drawBat(g, a) {
  px(g, 10, 5, 8, 10, a.color);
  px(g, 10, 5, 3, 3, a.hi); px(g, 15, 5, 3, 3, a.hi);
  px(g, 11, 9, 2, 2, '#f5e6ff'); px(g, 15, 9, 2, 2, '#f5e6ff');
  g.fillStyle = a.lo;
  g.beginPath();
  g.moveTo(10, 8); g.lineTo(2, 4); g.lineTo(4, 13); g.lineTo(10, 14);
  g.moveTo(18, 8); g.lineTo(26, 4); g.lineTo(24, 13); g.lineTo(18, 14);
  g.fill();
  px(g, 12, 15, 2, 3, a.hi); px(g, 15, 15, 2, 3, a.hi);
}

function drawArmor(g, a) {
  px(g, 7, 2, 12, 6, a.hi);
  px(g, 9, 4, 8, 2, '#2b2622');
  px(g, 5, 8, 16, 12, a.color);
  px(g, 5, 8, 16, 2, a.hi);
  px(g, 7, 12, 12, 2, a.lo);
  px(g, 7, 16, 12, 2, a.hi);
  px(g, 2, 9, 4, 7, a.hi); px(g, 20, 9, 4, 7, a.hi);
  px(g, 7, 20, 5, 7, a.lo); px(g, 14, 20, 5, 7, a.lo);
}

function drawSpider(g, a, baby = false) {
  const cx = a.w / 2;
  const cy = baby ? 9 : 12;
  g.strokeStyle = a.lo;
  g.lineWidth = baby ? 1.5 : 2;
  for (let i = 0; i < 4; i++) {
    const dy = (i - 1.5) * (baby ? 2.5 : 4);
    g.beginPath(); g.moveTo(cx - 4, cy + dy); g.lineTo(1, cy + dy * 2.2); g.stroke();
    g.beginPath(); g.moveTo(cx + 4, cy + dy); g.lineTo(a.w - 1, cy + dy * 2.2); g.stroke();
  }
  px(g, cx - 5, cy - 4, 10, 9, a.color);
  px(g, cx - 6, cy - 1, 12, 3, a.hi);
  px(g, cx - 3, cy - 7, 6, 4, a.lo);
  px(g, cx - 3, cy - 6, 1.5, 1.5, '#ff8b6b');
  px(g, cx + 2, cy - 6, 1.5, 1.5, '#ff8b6b');
}

const DRAWERS = {
  esqueleto: drawSkeleton,
  slime: drawSlime,
  golem: drawGolem,
  murcielago: drawBat,
  armadura: drawArmor,
  arana: (g, a) => drawSpider(g, a),
  'arana-bebe': (g, a) => drawSpider(g, a, true),
};

function bake(scene, key, w, h, draw) {
  if (scene.textures.exists(key)) return key;
  const tex = scene.textures.createCanvas(key, w, h);
  const g = tex.context;
  g.imageSmoothingEnabled = false;
  draw(g);
  tex.refresh();
  return key;
}

export function ensureTroopTextures(scene) {
  for (const [id, art] of Object.entries(TROOP_ART)) {
    bake(scene, troopTextureKey(id), art.w, art.h, g => {
      drawShadow(g, art);
      DRAWERS[id](g, art);
    });
  }
  // Saeta y destello de impacto de los proyectiles de la ballesta.
  bake(scene, BOLT_TEX, 14, 6, g => {
    px(g, 1, 2, 9, 2, '#3a2312');
    px(g, 3, 2, 7, 2, '#d9c7a0');
    px(g, 9, 1, 4, 4, '#ffd27a');
    px(g, 0, 3, 3, 1, '#8a5a2b');
  });
  bake(scene, IMPACT_TEX, 10, 10, g => {
    g.fillStyle = 'rgba(255,210,122,0.85)';
    g.beginPath(); g.arc(5, 5, 4, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#fff3d0';
    g.beginPath(); g.arc(5, 5, 1.8, 0, Math.PI * 2); g.fill();
  });
  // Roca de la catapulta, con la misma paleta pétrea del modelo 3D.
  bake(scene, STONE_TEX, 14, 14, g => {
    g.fillStyle = '#74747f';
    g.beginPath();
    g.moveTo(3, 2); g.lineTo(9, 1); g.lineTo(13, 5);
    g.lineTo(11, 11); g.lineTo(5, 13); g.lineTo(1, 8);
    g.closePath(); g.fill();
    g.fillStyle = '#a0a0ac';
    g.beginPath();
    g.moveTo(3, 2); g.lineTo(9, 1); g.lineTo(11, 5); g.lineTo(5, 6);
    g.closePath(); g.fill();
    g.fillStyle = '#484853';
    g.beginPath();
    g.moveTo(11, 11); g.lineTo(5, 13); g.lineTo(7, 9);
    g.closePath(); g.fill();
  });
  bake(scene, DUST_TEX, 20, 20, g => {
    g.fillStyle = 'rgba(150,138,124,0.35)';
    g.beginPath(); g.arc(10, 10, 9, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(184,172,156,0.40)';
    g.beginPath(); g.arc(7, 9, 5, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.arc(13, 11, 4, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(214,203,186,0.55)';
    g.beginPath(); g.arc(10, 10, 2.5, 0, Math.PI * 2); g.fill();
  });
}
