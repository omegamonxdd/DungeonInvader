/* ==========================================================================
 * GENERADOR DE ARTE DE ALMACENES (pipeline coc-25d-pipeline)
 * --------------------------------------------------------------------------
 * Modelos 3D estilizados -> cámara ortográfica isométrica real -> PNG RGBA.
 * Estructuras estáticas: 1 imagen por tipo (sin rotación).
 *
 * Uso: node tools/vault-art/generate.mjs
 * ========================================================================== */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const OUT_COINS = path.resolve('front/assets/estructuras/almacen-monedas');
const OUT_CRYS = path.resolve('front/assets/estructuras/almacen-cristales');
const PREVIEW_DIR = path.resolve('tools/vault-art');

const CELL = 256;
const SS = 4;
const PPU = 62 * SS;
const ART_SCALE = 1.0947;
const AZ = Math.PI / 4;
const EL = Math.PI / 6;
const VIEW = [Math.cos(EL) * Math.cos(AZ), Math.cos(EL) * Math.sin(AZ), Math.sin(EL)];
const RIGHT = [Math.sin(AZ), -Math.cos(AZ), 0];
const UP = [-Math.sin(EL) * Math.cos(AZ), -Math.sin(EL) * Math.sin(AZ), Math.cos(EL)];
const ANCHOR = [128, 182];

const C = {
  stone: [116,116,126], stoneLight:[151,151,161], stoneDark:[76,76,87], stoneDeep:[48,48,58],
  wood:[158,79,36], woodLight:[224,144,80], woodDark:[92,48,24], woodDeep:[60,32,16],
  rope:[232,223,207], ropeDark:[201,183,156], ropeShadow:[140,122,98],
  // Caja fuerte: cuerpo negro con herrajes grises (mismo set que las defensas).
  safe:[32,34,40], safeHi:[50,53,62], safeDeep:[18,19,24],
  steel:[104,110,124], steelHi:[176,182,198], steelDark:[62,66,78],
  gold:[246,202,72], goldDark:[184,132,28],
  cyan:[92,220,252], cyanLight:[186,246,255], cyanDeep:[30,132,190],
  outline:[30,22,26],
};

const KEY = norm([-0.78*RIGHT[0]+0.62*UP[0]+0.30*VIEW[0], -0.78*RIGHT[1]+0.62*UP[1]+0.30*VIEW[1], -0.78*RIGHT[2]+0.62*UP[2]+0.30*VIEW[2]]);
const FILL = norm([0.85*RIGHT[0]+0.16*UP[0]+0.22*VIEW[0], 0.85*RIGHT[1]+0.16*UP[1]+0.22*VIEW[1], 0.85*RIGHT[2]+0.16*UP[2]+0.22*VIEW[2]]);

function add(a,b){return [a[0]+b[0],a[1]+b[1],a[2]+b[2]];}
function sub(a,b){return [a[0]-b[0],a[1]-b[1],a[2]-b[2]];}
function mul(a,k){return [a[0]*k,a[1]*k,a[2]*k];}
function dot(a,b){return a[0]*b[0]+a[1]*b[1]+a[2]*b[2];}
function cross(a,b){return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];}
function len(a){return Math.hypot(a[0],a[1],a[2]);}
function norm(a){const l=len(a)||1; return [a[0]/l,a[1]/l,a[2]/l];}
function centroid(pts){const s=[0,0,0]; for(const p of pts){s[0]+=p[0];s[1]+=p[1];s[2]+=p[2];} return mul(s,1/pts.length);}
function clamp255(v){return v<0?0:v>255?255:Math.round(v);}
function shade(color,n,ao=1,tint=1){const k=Math.max(0,dot(n,KEY));const f=Math.max(0,dot(n,FILL));const up=Math.max(0,n[2]);const i=(0.48+0.68*k+0.26*f+0.10*up)*ao*tint;return [clamp255(color[0]*i+26*k+3*f),clamp255(color[1]*i+10*k+4*f),clamp255(color[2]*i+2*k+14*f+3*up)];}
function hash2(x,y){let h=Math.imul(x|0,374761393)^Math.imul(y|0,668265263);h=Math.imul(h^(h>>>13),1274126177);return ((h^(h>>>16))>>>0)/4294967296;}
function mmat(seed=0,kind='stone'){return {kind,seed};}
function materialFactor(m,p){if(!m) return 1; let f=1; if(m.kind==='stone'||m.kind==='metal'){const a=hash2(Math.floor(p[0]*27)+m.seed,Math.floor(p[1]*27)+Math.floor(p[2]*27)); f+=(a-0.5)*0.08;} else if(m.kind==='wood'){const grain=Math.sin(p[2]*16+p[0]*2.4+m.seed*0.2); const n=hash2(Math.floor(p[0]*12)+m.seed,Math.floor(p[2]*18)); f+=grain*0.05+(n-0.5)*0.05;} else if(m.kind==='rope'){const twist=Math.sin((p[0]+p[1]+p[2])*35+m.seed); f+=twist*0.06;} else if(m.kind==='crystal'){const band=Math.sin(p[2]*24+p[0]*7+m.seed*0.31); f+=band*0.07;} return f;}

function quad(mesh,pts,color,opts={}){let n=norm(cross(sub(pts[1],pts[0]),sub(pts[2],pts[0]))); if(!isFinite(n[0])) return; if(opts.outward){const c=centroid(pts); if(dot(n,sub(c,opts.outward))<0){pts=pts.slice().reverse(); n=mul(n,-1);}} for(let i=1;i<pts.length-1;i++) mesh.push({p:[pts[0],pts[i],pts[i+1]],color,ao:opts.ao??1,tint:opts.tint??1,mat:opts.mat??null,outline:opts.outline!==false});}
function bevelBox(mesh,p0,p1,w,d,bevel,color,opts={}){const zAxis=norm(sub(p1,p0)); const upHint=opts.up??[0,1,0]; let xAxis=cross(upHint,zAxis); if(len(xAxis)<1e-4) xAxis=cross([1,0,0],zAxis); xAxis=norm(xAxis); const yAxis=norm(cross(zAxis,xAxis)); const mid=mul(add(p0,p1),0.5); const half=len(sub(p1,p0))/2; const hw=w/2,hd=d/2; const b=Math.min(bevel,hw*0.34,hd*0.34,half*0.34); const ex=hw-b,ey=hd-b,ez=half-b; const T=(x,y,z)=>add(mid,add(add(mul(xAxis,x),mul(yAxis,y)),mul(zAxis,z))); const m=opts.mat??mmat(opts.seed??0,opts.matKind??'stone'); const oo={outward:mid,ao:opts.ao??1,mat:m,outline:opts.outline!==false}; const bt=opts.bevelTint??1.03;
  for(const sx of [-1,1]) quad(mesh,[T(sx*hw,-ey,-ez),T(sx*hw,ey,-ez),T(sx*hw,ey,ez),T(sx*hw,-ey,ez)],color,oo);
  for(const sy of [-1,1]) quad(mesh,[T(-ex,sy*hd,-ez),T(ex,sy*hd,-ez),T(ex,sy*hd,ez),T(-ex,sy*hd,ez)],color,oo);
  for(const sz of [-1,1]) quad(mesh,[T(-ex,-ey,sz*half),T(ex,-ey,sz*half),T(ex,ey,sz*half),T(-ex,ey,sz*half)],color,oo);
  for(const sx of [-1,1]) for(const sy of [-1,1]) quad(mesh,[T(sx*hw,sy*ey,-ez),T(sx*ex,sy*hd,-ez),T(sx*ex,sy*hd,ez),T(sx*hw,sy*ey,ez)],color,{...oo,tint:bt});
  for(const sx of [-1,1]) for(const sz of [-1,1]) quad(mesh,[T(sx*hw,-ey,sz*ez),T(sx*ex,-ey,sz*half),T(sx*ex,ey,sz*half),T(sx*hw,ey,sz*ez)],color,{...oo,tint:bt});
  for(const sy of [-1,1]) for(const sz of [-1,1]) quad(mesh,[T(-ex,sy*ey,sz*ez),T(ex,sy*ey,sz*ez),T(ex,sy*hd,sz*half),T(-ex,sy*hd,sz*half)],color,{...oo,tint:bt});
}
function cylinder(mesh,base,axisDir,radius,height,color,opts={}){const z=norm(axisDir); let u=cross([0,0,1],z); if(len(u)<1e-4) u=cross([1,0,0],z); u=norm(u); const v=cross(z,u); const seg=opts.seg??10; const top=add(base,mul(z,height)); const ringA=[],ringB=[]; for(let i=0;i<seg;i++){const a=(i/seg)*Math.PI*2; const off=add(mul(u,Math.cos(a)*radius),mul(v,Math.sin(a)*radius)); ringA.push(add(base,off)); ringB.push(add(top,off));} const m=opts.mat??mmat(opts.seed??0,opts.matKind??'rope'); for(let i=0;i<seg;i++){const j=(i+1)%seg; quad(mesh,[ringA[i],ringA[j],ringB[j],ringB[i]],color,{outward:mul(add(add(ringA[i],ringA[j]),add(ringB[i],ringB[j])),0.25),ao:opts.ao??1,mat:m,outline:opts.outline!==false});} for(let i=1;i<seg-1;i++){quad(mesh,[ringB[0],ringB[i],ringB[i+1]],color,{outward:top,ao:opts.ao??1,mat:m,outline:false}); quad(mesh,[ringA[0],ringA[i+1],ringA[i]],color,{outward:base,ao:opts.ao??1,mat:m,outline:false});}}
function cone(mesh, base, dir, radius, height, color, opts = {}) { const z = norm(dir); let u = cross([0,0,1], z); if (len(u) < 1e-4) u = cross([1,0,0], z); u = norm(u); const v = cross(z, u); const seg = opts.seg ?? 8; const ring = Array.from({length: seg}, (_, i) => { const a = (i/seg)*Math.PI*2; return add(base, add(mul(u, Math.cos(a)*radius), mul(v, Math.sin(a)*radius))); }); const apex = add(base, mul(z, height)); const m = opts.mat ?? mmat(opts.seed ?? 0, opts.matKind ?? 'stone'); for (let i = 0; i < seg; i++) quad(mesh, [ring[i], ring[(i+1)%seg], apex], color, { outward: base, ao: opts.ao ?? 1, mat: m, outline: opts.outline !== false }); }

function ropeBand(mesh, center, halfW, halfD, z, r, color, seed) {
  cylinder(mesh, [center[0]-halfW, center[1]-halfD, z], [1,0,0], r, halfW*2, color, {seg:8, seed, matKind:'rope'});
  cylinder(mesh, [center[0]-halfW, center[1]+halfD, z], [1,0,0], r, halfW*2, color, {seg:8, seed:seed+1, matKind:'rope'});
  cylinder(mesh, [center[0]-halfW, center[1]-halfD, z], [0,1,0], r, halfD*2, color, {seg:8, seed:seed+2, matKind:'rope'});
  cylinder(mesh, [center[0]+halfW, center[1]-halfD, z], [0,1,0], r, halfD*2, color, {seg:8, seed:seed+3, matKind:'rope'});
}
function ropeKnot(mesh, p, r, color, seed){ cone(mesh,p,[0,0,1],r*1.3,r*1.2,color,{seg:8,seed,matKind:'rope',outline:false}); cone(mesh,add(p,[0,0,r*1.2]),[0,0,1],r*1.0,r*0.9,color,{seg:8,seed:seed+1,matKind:'rope',outline:false}); }

/* Tubo con volumen real (transporte paralelo del marco). Igual técnica que
 * las defensas: la cuerda es geometría, nunca una línea pintada. */
function tube(mesh, points, radius, color, opts={}) {
  const seg = opts.seg ?? 6;
  if (points.length < 2) return;
  const rings = [];
  let u = null;
  for (let i = 0; i < points.length; i++) {
    const prev = points[Math.max(0, i - 1)];
    const next = points[Math.min(points.length - 1, i + 1)];
    const t = norm(sub(next, prev));
    if (!u) u = norm(cross(Math.abs(t[2]) < 0.9 ? [0,0,1] : [1,0,0], t));
    else u = norm(sub(u, mul(t, dot(u, t))));
    const v = cross(t, u);
    rings.push(Array.from({length: seg}, (_, j) => {
      const a = (j / seg) * Math.PI * 2;
      return add(points[i], add(mul(u, Math.cos(a) * radius), mul(v, Math.sin(a) * radius)));
    }));
  }
  const mat = opts.mat ?? mmat(opts.seed ?? 0, opts.matKind ?? 'rope');
  for (let i = 0; i < rings.length - 1; i++) for (let j = 0; j < seg; j++) {
    const k = (j + 1) % seg;
    quad(mesh, [rings[i][j], rings[i][k], rings[i+1][k], rings[i+1][j]], color,
      { outward: points[i], mat, outline: false });
  }
}
/* Amarre helicoidal en las uniones (esquinas de la caja). */
function ropeWrap(mesh, center, axis, radius, turns, length, thickness, color, seed) {
  const z = norm(axis);
  let u = cross([0,0,1], z); if (len(u) < 1e-4) u = cross([1,0,0], z); u = norm(u);
  const v = cross(z, u);
  const steps = Math.max(14, Math.round(turns * 11));
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps, a = t * turns * Math.PI * 2;
    pts.push(add(add(center, mul(z, (t - 0.5) * length)),
      add(mul(u, Math.cos(a) * radius), mul(v, Math.sin(a) * radius))));
  }
  tube(mesh, pts, thickness, color, { seg: 6, seed, matKind: 'rope' });
}

function buildCoinsVault() {
  const m = [];
  // El suelo de roca compartido lo dibuja Phaser; aquí solo una zapata mínima.
  bevelBox(m, [0,0,0.02],[0,0,0.10], 1.06,0.98,0.04, C.safeDeep, {seed:1, matKind:'metal', ao:0.94});
  const W = 0.96, D = 0.86, H = 0.72;
  // Cuerpo: caja fuerte pequeña, negra, con biseles gruesos tipo CoC.
  bevelBox(m, [0,0,0.10],[0,0,0.10+H], W,D,0.075, C.safe, {seed:10, matKind:'metal'});
  bevelBox(m, [0,0,0.10+H],[0,0,0.10+H+0.075], W*0.98,D*0.98,0.035, C.steelDark, {seed:11, matKind:'metal'});
  bevelBox(m, [0,0,0.10],[0,0,0.16], W*1.05,D*1.05,0.035, C.steelDark, {seed:12, matKind:'metal'});
  // Puerta con marco gris y panel central más claro.
  const FY = D/2;
  bevelBox(m, [0,FY+0.004,0.18],[0,FY+0.055,0.70], 0.68,0.05,0.02, C.steel, {seed:13, matKind:'metal', ao:1.04});
  bevelBox(m, [0,FY+0.056,0.23],[0,FY+0.072,0.65], 0.56,0.016,0.012, C.safeHi, {seed:14, matKind:'metal', ao:1.02});
  bevelBox(m, [0,FY+0.073,0.31],[0,FY+0.086,0.55], 0.10,0.012,0.01, C.steelHi, {seed:15, matKind:'metal'});
  // Cierre: dial gris con pequeño cubo de latón y tirador.
  cylinder(m, [0,FY+0.087,0.46],[0,1,0],0.095,0.035,C.steelHi,{seg:12,seed:20,matKind:'metal'});
  cylinder(m, [0,FY+0.122,0.46],[0,1,0],0.032,0.022,C.goldDark,{seg:8,seed:21,matKind:'metal',outline:false});
  bevelBox(m, [-0.11,FY+0.09,0.335],[0.11,FY+0.13,0.375],0.24,0.03,0.012,C.steel,{seed:22,matKind:'metal'});
  for (const sx of [-1,1]) for (const z of [0.21,0.66])
    cylinder(m,[sx*0.29,FY+0.085,z],[0,1,0],0.032,0.024,C.steelHi,{seg:8,seed:30+sx+Math.floor(z*10),matKind:'metal',outline:false});
  // Uniones de cuerda con volumen en las cuatro esquinas.
  for (const sx of [-1,1]) for (const sy of [-1,1]) {
    ropeWrap(m,[sx*W/2,sy*D/2,0.26],[0,0,1],0.085,2.2,0.17,0.028,C.rope,{seed:40+sx*3+sy});
    ropeWrap(m,[sx*W/2,sy*D/2,0.68],[0,0,1],0.085,2.2,0.17,0.028,C.ropeDark,{seed:50+sx*3+sy});
  }
  // Una cuerda amarra todo el alrededor a dos alturas + nudos frontales.
  ropeBand(m,[0,0], W/2+0.03, D/2+0.03, 0.30, 0.032, C.rope, 60);
  ropeBand(m,[0,0], W/2+0.03, D/2+0.03, 0.58, 0.032, C.ropeDark, 70);
  cylinder(m,[0,-D/2-0.03,0.87],[0,1,0],0.028,D+0.06,C.rope,{seg:8,seed:80,matKind:'rope'});
  cylinder(m,[-W/2-0.03,0,0.89],[1,0,0],0.028,W+0.06,C.ropeDark,{seg:8,seed:81,matKind:'rope'});
  ropeKnot(m,[0.12,FY+0.04,0.30],0.032,C.ropeDark,90);
  ropeKnot(m,[0.16,FY+0.04,0.58],0.026,C.rope,91);
  return m;
}

function crystalShard(m, cx, cy, zMid, radius, height, seed = 0, color=C.cyan, deep=C.cyanDeep) {
  const seg = 6;
  const ring = Array.from({ length: seg }, (_, i) => { const a = (i / seg) * Math.PI * 2 + Math.PI / 6; return [cx + Math.cos(a) * radius, cy + Math.sin(a) * radius, zMid]; });
  const top = [cx, cy, zMid + height * 0.66]; const bottom = [cx, cy, zMid - height * 0.55];
  for (let i = 0; i < seg; i++) { const a = ring[i], b = ring[(i + 1) % seg]; const facet = (i + seed) % seg; const tint = facet === 1 ? 1.2 : facet === 4 ? 0.78 : 1; quad(m, [a, b, top], color, { outward: [cx, cy, zMid], mat: mmat(seed + i, 'crystal'), outline: true, ao: 1.02, tint }); quad(m, [b, a, bottom], deep, { outward: [cx, cy, zMid], mat: mmat(seed + i + 30, 'crystal'), outline: true, ao: 0.94, tint }); }
}

function buildCrystalVault() {
  const m = [];
  bevelBox(m,[0,0,0.02],[0,0,0.10],1.12,1.06,0.04,C.stoneDark,{seed:100,matKind:'stone',ao:0.94});
  const W = 0.96, D = 0.92, H = 0.84, T = 0.10;
  // Cubeta de madera ABIERTA: fondo oscuro + cuatro paredes gruesas.
  bevelBox(m,[0,0,0.10],[0,0,0.20],W,D,0.035,C.woodDeep,{seed:110,matKind:'wood',ao:0.78});
  bevelBox(m,[0, D/2-T/2,0.20],[0, D/2-T/2,0.20+H],W,T,0.035,C.wood,{seed:111,matKind:'wood'});
  bevelBox(m,[0,-D/2+T/2,0.20],[0,-D/2+T/2,0.20+H],W,T,0.035,C.woodDark,{seed:112,matKind:'wood',ao:0.94});
  bevelBox(m,[-W/2+T/2,0,0.20],[-W/2+T/2,0,0.20+H],T,D-2*T,0.035,C.wood,{seed:113,matKind:'wood'});
  bevelBox(m,[ W/2-T/2,0,0.20],[ W/2-T/2,0,0.20+H],T,D-2*T,0.035,C.woodDark,{seed:114,matKind:'wood',ao:0.96});
  // Borde oscuro de la boca para que se lea como cubeta y no como caja cerrada.
  const RIM = 0.20 + H;
  bevelBox(m,[0, D/2-T/2,RIM],[0, D/2-T/2,RIM+0.05],W+0.04,T+0.04,0.02,C.woodDark,{seed:115,matKind:'wood'});
  bevelBox(m,[0,-D/2+T/2,RIM],[0,-D/2+T/2,RIM+0.05],W+0.04,T+0.04,0.02,C.woodDark,{seed:116,matKind:'wood'});
  bevelBox(m,[-W/2+T/2,0,RIM],[-W/2+T/2,0,RIM+0.05],T+0.04,D-2*T,0.02,C.woodDark,{seed:117,matKind:'wood'});
  bevelBox(m,[ W/2-T/2,0,RIM],[ W/2-T/2,0,RIM+0.05],T+0.04,D-2*T,0.02,C.woodDark,{seed:118,matKind:'wood'});
  // Juntas de tabla en la cara frontal.
  for (const sx of [-0.28,0,0.28]) bevelBox(m,[sx,D/2+0.004,0.24],[sx,D/2+0.02,0.98],0.06,0.018,0.008,C.woodLight,{seed:120+Math.round(sx*100),matKind:'wood',ao:1.02});
  // Uniones de cuerda en las cuatro esquinas + vuelta alrededor.
  for (const sx of [-1,1]) for (const sy of [-1,1]) {
    ropeWrap(m,[sx*(W/2-T/2),sy*(D/2-T/2),0.34],[0,0,1],0.10,2.2,0.16,0.03,C.rope,{seed:130+sx*3+sy});
    ropeWrap(m,[sx*(W/2-T/2),sy*(D/2-T/2),0.92],[0,0,1],0.10,2.2,0.16,0.03,C.ropeDark,{seed:140+sx*3+sy});
  }
  ropeBand(m,[0,0],W/2+0.025,D/2+0.025,0.34,0.03,C.rope,150);
  ropeBand(m,[0,0],W/2+0.025,D/2+0.025,0.94,0.03,C.ropeDark,160);
  ropeKnot(m,[W/2+0.03,0,0.34],0.028,C.ropeDark,170);
  ropeKnot(m,[-W/2-0.03,0.1,0.94],0.026,C.rope,171);
  // Minerales DENTRO de la cubeta: la base queda entre paredes y las puntas asoman.
  crystalShard(m,-0.17,-0.10,0.80,0.17, 0.72,200);
  crystalShard(m, 0.16, 0.03,0.78,0.15, 0.68,210);
  crystalShard(m,-0.02, 0.21,0.76,0.12, 0.62,220);
  crystalShard(m,-0.26, 0.17,0.75,0.10, 0.58,230);
  crystalShard(m, 0.27,-0.16,0.76,0.095,0.58,240);
  crystalShard(m, 0.06,-0.27,0.74,0.09, 0.55,250);
  return m;
}

// --- renderer (same as core-art, trimmed) ---
class Framebuffer { constructor(w,h){this.w=w;this.h=h;this.color=new Uint8Array(w*h*4);this.depth=new Float32Array(w*h).fill(Infinity);} blend(x,y,r,g,b,a){ if(x<0||y<0||x>=this.w||y>=this.h||a<=0) return; const i=(y*this.w+x)*4; const sa=a/255, da=this.color[i+3]/255; const oa=sa+da*(1-sa); if(oa<=0) return; this.color[i]=(r*sa+this.color[i]*da*(1-sa))/oa; this.color[i+1]=(g*sa+this.color[i+1]*da*(1-sa))/oa; this.color[i+2]=(b*sa+this.color[i+2]*da*(1-sa))/oa; this.color[i+3]=oa*255; } }
function edge(a,b,px,py){return (b.x-a.x)*(py-a.y)-(b.y-a.y)*(px-a.x);}
function project(p, target, cx, cy){ const x=p[0]-target[0], y=p[1]-target[1], z=p[2]-target[2]; return { x: cx + dot([x,y,z], RIGHT)*PPU, y: cy - dot([x,y,z], UP)*PPU, z: -dot([x,y,z], VIEW), wx:p[0], wy:p[1], wz:p[2] }; }
function drawTri(fb, A,B,Cc, col, mat){ const area=edge(A,B,Cc.x,Cc.y); if(Math.abs(area)<1e-9) return; const sign=area>0?1:-1; const inv=1/area; const x0=Math.max(0,Math.floor(Math.min(A.x,B.x,Cc.x))); const x1=Math.min(fb.w-1,Math.ceil(Math.max(A.x,B.x,Cc.x))); const y0=Math.max(0,Math.floor(Math.min(A.y,B.y,Cc.y))); const y1=Math.min(fb.h-1,Math.ceil(Math.max(A.y,B.y,Cc.y))); for(let y=y0;y<=y1;y++){ const py=y+0.5; for(let x=x0;x<=x1;x++){ const px=x+0.5; const w0=edge(B,Cc,px,py), w1=edge(Cc,A,px,py), w2=edge(A,B,px,py); if(w0*sign<0||w1*sign<0||w2*sign<0) continue; const z=(w0*A.z+w1*B.z+w2*Cc.z)*inv; const i=y*fb.w+x; if(z>=fb.depth[i]) continue; fb.depth[i]=z; let r=col[0],g=col[1],b=col[2]; if(mat){ const wx=(w0*A.wx+w1*B.wx+w2*Cc.wx)*inv; const wy=(w0*A.wy+w1*B.wy+w2*Cc.wy)*inv; const wz=(w0*A.wz+w1*B.wz+w2*Cc.wz)*inv; const f=materialFactor(mat,[wx,wy,wz]); r=clamp255(r*f); g=clamp255(g*f); b=clamp255(b*f);} fb.color[i*4]=r; fb.color[i*4+1]=g; fb.color[i*4+2]=b; fb.color[i*4+3]=255; } } }
function softEllipse(fb,cx,cy,rx,ry,alpha,color){ const x0=Math.max(0,Math.floor(cx-rx-2)), x1=Math.min(fb.w-1,Math.ceil(cx+rx+2)); const y0=Math.max(0,Math.floor(cy-ry-2)), y1=Math.min(fb.h-1,Math.ceil(cy+ry+2)); for(let y=y0;y<=y1;y++) for(let x=x0;x<=x1;x++){ const dx=(x+0.5-cx)/rx, dy=(y+0.5-cy)/ry; const d=dx*dx+dy*dy; if(d>1) continue; const a=alpha*Math.pow(1-d,1.55)*255; fb.blend(x,y,color[0],color[1],color[2],a); } }
function drawShadow(fb,cx,cy){
  // Sombra estilo ballesta/core: ancha, desplazada y con contacto.
  softEllipse(fb, cx - 20 * SS, cy + 7 * SS, 98 * SS, 42 * SS, 0.12, [38, 28, 48]);
  softEllipse(fb, cx - 4 * SS, cy + 4 * SS, 74 * SS, 31 * SS, 0.18, [30, 20, 36]);
  softEllipse(fb, cx + 2 * SS, cy + 2 * SS, 56 * SS, 23 * SS, 0.22, [22, 14, 28]);
}
function addOutline(img){ const w=img.w,h=img.h; const src=new Uint8Array(img.data); const out=img.data; const [or,og,ob]=C.outline; for(let y=1;y<h-1;y++){ for(let x=1;x<w-1;x++){ const i=(y*w+x)*4; if(src[i+3]>20) continue; let hit=false; for(let oy=-1;oy<=1&&!hit;oy++) for(let ox=-1;ox<=1;ox++){ if(!ox&&!oy) continue; if(src[((y+oy)*w+x+ox)*4+3]>30){hit=true;break;} } if(!hit) continue; out[i]=or; out[i+1]=og; out[i+2]=ob; out[i+3]=255; } } }
function render(mesh, anchor, shadow=true){ const fb=new Framebuffer(CELL*SS,CELL*SS); const cx=anchor[0]*SS, cy=anchor[1]*SS; if(shadow) drawShadow(fb,cx,cy); for(const t of mesh){ const n=norm(cross(sub(t.p[1],t.p[0]),sub(t.p[2],t.p[0]))); if(!isFinite(n[0])||len(n)<1e-7) continue; const col=shade(t.color,n,t.ao,t.tint); drawTri(fb, project(t.p[0],[0,0,0],cx,cy), project(t.p[1],[0,0,0],cx,cy), project(t.p[2],[0,0,0],cx,cy), col, t.mat); } const out=downsample(fb,CELL*SS,CELL*SS,SS); addOutline(out); return out; }
function downsample(fb,w,h,factor){ const ow=w/factor, oh=h/factor; const out=new Uint8Array(ow*oh*4); for(let y=0;y<oh;y++) for(let x=0;x<ow;x++){ let a=0,r=0,g=0,b=0; for(let sy=0;sy<factor;sy++) for(let sx=0;sx<factor;sx++){ const i=((y*factor+sy)*w+x*factor+sx)*4; const al=fb.color[i+3]/255; a+=al; r+=fb.color[i]*al; g+=fb.color[i+1]*al; b+=fb.color[i+2]*al; } const n=factor*factor; const o=(y*ow+x)*4; out[o+3]=Math.round((a/n)*255); if(a>0){ out[o]=Math.round(r/a); out[o+1]=Math.round(g/a); out[o+2]=Math.round(b/a); } } return {data:out,w:ow,h:oh}; }

const CRC_TABLE=(()=>{const t=new Uint32Array(256); for(let n=0;n<256;n++){let c=n; for(let k=0;k<8;k++) c=(c&1)?0xEDB88320^(c>>>1):c>>>1; t[n]=c>>>0;} return t;})();
function crc32(buf){let c=0xFFFFFFFF; for(let i=0;i<buf.length;i++) c=CRC_TABLE[(c^buf[i])&0xFF]^(c>>>8); return (c^0xFFFFFFFF)>>>0;}
function chunk(type,data){const len=Buffer.alloc(4); len.writeUInt32BE(data.length); const body=Buffer.concat([Buffer.from(type,'ascii'),data]); const crc=Buffer.alloc(4); crc.writeUInt32BE(crc32(body)); return Buffer.concat([len,body,crc]);}
function encodePNG(img){ const stride=img.w*4; const raw=Buffer.alloc((stride+1)*img.h); for(let y=0;y<img.h;y++){ raw[y*(stride+1)]=0; Buffer.from(img.data.buffer,img.data.byteOffset+y*stride,stride).copy(raw,y*(stride+1)+1);} const ihdr=Buffer.alloc(13); ihdr.writeUInt32BE(img.w,0); ihdr.writeUInt32BE(img.h,4); ihdr[8]=8; ihdr[9]=6; ihdr[10]=0; ihdr[11]=0; ihdr[12]=0; return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), chunk('IHDR',ihdr), chunk('IDAT',zlib.deflateSync(raw,{level:9})), chunk('IEND',Buffer.alloc(0))]); }
function boundingBox(img){ let x0=img.w,y0=img.h,x1=-1,y1=-1; for(let y=0;y<img.h;y++) for(let x=0;x<img.w;x++){ if(img.data[(y*img.w+x)*4+3]>8){ if(x<x0)x0=x; if(x>x1)x1=x; if(y<y0)y0=y; if(y>y1)y1=y; } } return [x0,y0,x1,y1]; }

function bake(name, mesh, outDir) {
  const img = render(mesh, ANCHOR, true);
  fs.mkdirSync(outDir, { recursive: true });
  const file = path.join(outDir, `${name}.png`);
  fs.writeFileSync(file, encodePNG(img));
  const meta = { generator:'tools/vault-art/generate.mjs', cell:CELL, artScale:ART_SCALE, anchor:{x:ANCHOR[0],y:ANCHOR[1]}, bbox: boundingBox(img) };
  fs.writeFileSync(path.join(outDir, 'vault-art.json'), JSON.stringify(meta, null, 2) + '\n');
  console.log(`${name}: bbox=${meta.bbox.join('..')}`);
}

fs.mkdirSync(PREVIEW_DIR, { recursive: true });
bake('vault-coins', buildCoinsVault(), OUT_COINS);
bake('vault-crystals', buildCrystalVault(), OUT_CRYS);
