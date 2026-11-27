/* ==========================================================================
 * GENERADOR DE ARTE DEL TALLER DE MONEDAS (pipeline coc-25d-pipeline)
 * --------------------------------------------------------------------------
 * Modelo 3D estilizado -> cámara ortográfica isométrica real -> PNG RGBA.
 * Estructura estática (sin rotación): 1 imagen, dentro de la huella 2×2.
 *
 * Uso: npm run art:workshop
 * Salida: front/assets/estructuras/taller-monetas/workshop.png
 * ========================================================================== */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const OUT = path.resolve('front/assets/estructuras/taller-monetas');
const PREVIEW_DIR = path.resolve('tools/workshop-art');

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
  steel:[104,110,124], steelHi:[176,182,198], steelDark:[62,66,78],
  gold:[246,202,72], goldDark:[184,132,28],
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
function mmat(seed=0,kind='wood'){return {kind,seed};}
function materialFactor(m,p){if(!m) return 1; let f=1; if(m.kind==='stone'||m.kind==='metal'){const a=hash2(Math.floor(p[0]*27)+m.seed,Math.floor(p[1]*27)+Math.floor(p[2]*27)); f+=(a-0.5)*0.08;} else if(m.kind==='wood'){const grain=Math.sin(p[2]*16+p[0]*2.4+m.seed*0.2); const n=hash2(Math.floor(p[0]*12)+m.seed,Math.floor(p[2]*18)); f+=grain*0.05+(n-0.5)*0.05;} else if(m.kind==='rope'){const twist=Math.sin((p[0]+p[1]+p[2])*35+m.seed); f+=twist*0.06;} return f;}

function quad(mesh,pts,color,opts={}){let n=norm(cross(sub(pts[1],pts[0]),sub(pts[2],pts[0]))); if(!isFinite(n[0])) return; if(opts.outward){const c=centroid(pts); if(dot(n,sub(c,opts.outward))<0){pts=pts.slice().reverse(); n=mul(n,-1);}} for(let i=1;i<pts.length-1;i++) mesh.push({p:[pts[0],pts[i],pts[i+1]],color,ao:opts.ao??1,tint:opts.tint??1,mat:opts.mat??null,outline:opts.outline!==false});}
function bevelBox(mesh,p0,p1,w,d,bevel,color,opts={}){const zAxis=norm(sub(p1,p0)); const upHint=opts.up??[0,1,0]; let xAxis=cross(upHint,zAxis); if(len(xAxis)<1e-4) xAxis=cross([1,0,0],zAxis); xAxis=norm(xAxis); const yAxis=norm(cross(zAxis,xAxis)); const mid=mul(add(p0,p1),0.5); const half=len(sub(p1,p0))/2; const hw=w/2,hd=d/2; const b=Math.min(bevel,hw*0.34,hd*0.34,half*0.34); const ex=hw-b,ey=hd-b,ez=half-b; const T=(x,y,z)=>add(mid,add(add(mul(xAxis,x),mul(yAxis,y)),mul(zAxis,z))); const m=opts.mat??mmat(opts.seed??0,opts.matKind??'wood'); const oo={outward:mid,ao:opts.ao??1,mat:m,outline:opts.outline!==false}; const bt=opts.bevelTint??1.03;
  for(const sx of [-1,1]) quad(mesh,[T(sx*hw,-ey,-ez),T(sx*hw,ey,-ez),T(sx*hw,ey,ez),T(sx*hw,-ey,ez)],color,oo);
  for(const sy of [-1,1]) quad(mesh,[T(-ex,sy*hd,-ez),T(ex,sy*hd,-ez),T(ex,sy*hd,ez),T(-ex,sy*hd,ez)],color,oo);
  for(const sz of [-1,1]) quad(mesh,[T(-ex,-ey,sz*half),T(ex,-ey,sz*half),T(ex,ey,sz*half),T(-ex,ey,sz*half)],color,oo);
  for(const sx of [-1,1]) for(const sy of [-1,1]) quad(mesh,[T(sx*hw,sy*ey,-ez),T(sx*ex,sy*hd,-ez),T(sx*ex,sy*hd,ez),T(sx*hw,sy*ey,ez)],color,{...oo,tint:bt});
  for(const sx of [-1,1]) for(const sz of [-1,1]) quad(mesh,[T(sx*hw,-ey,sz*ez),T(sx*ex,-ey,sz*half),T(sx*ex,ey,sz*half),T(sx*hw,ey,sz*ez)],color,{...oo,tint:bt});
  for(const sy of [-1,1]) for(const sz of [-1,1]) quad(mesh,[T(-ex,sy*ey,sz*ez),T(ex,sy*ey,sz*ez),T(ex,sy*hd,sz*half),T(-ex,sy*hd,sz*half)],color,{...oo,tint:bt});
}
function cylinder(mesh,base,axisDir,radius,height,color,opts={}){const z=norm(axisDir); let u=cross([0,0,1],z); if(len(u)<1e-4) u=cross([1,0,0],z); u=norm(u); const v=cross(z,u); const seg=opts.seg??10; const top=add(base,mul(z,height)); const ringA=[],ringB=[]; for(let i=0;i<seg;i++){const a=(i/seg)*Math.PI*2; const off=add(mul(u,Math.cos(a)*radius),mul(v,Math.sin(a)*radius)); ringA.push(add(base,off)); ringB.push(add(top,off));} const m=opts.mat??mmat(opts.seed??0,opts.matKind??'rope'); for(let i=0;i<seg;i++){const j=(i+1)%seg; quad(mesh,[ringA[i],ringA[j],ringB[j],ringB[i]],color,{outward:mul(add(add(ringA[i],ringA[j]),add(ringB[i],ringB[j])),0.25),ao:opts.ao??1,mat:m,outline:opts.outline!==false});} for(let i=1;i<seg-1;i++){quad(mesh,[ringB[0],ringB[i],ringB[i+1]],color,{outward:top,ao:opts.ao??1,mat:m,outline:false}); quad(mesh,[ringA[0],ringA[i+1],ringA[i]],color,{outward:base,ao:opts.ao??1,mat:m,outline:false});}}
function cone(mesh, base, dir, radius, height, color, opts = {}) { const z = norm(dir); let u = cross([0,0,1], z); if (len(u) < 1e-4) u = cross([1,0,0], z); u = norm(u); const v = cross(z, u); const seg = opts.seg ?? 8; const ring = Array.from({length: seg}, (_, i) => { const a = (i/seg)*Math.PI*2; return add(base, add(mul(u, Math.cos(a)*radius), mul(v, Math.sin(a)*radius))); }); const apex = add(base, mul(z, height)); const m = opts.mat ?? mmat(opts.seed ?? 0, opts.matKind ?? 'wood'); for (let i = 0; i < seg; i++) quad(mesh, [ring[i], ring[(i+1)%seg], apex], color, { outward: base, ao: opts.ao ?? 1, mat: m, outline: opts.outline !== false }); }

function ropeBand(mesh, center, halfW, halfD, z, r, color, seed) {
  cylinder(mesh, [center[0]-halfW, center[1]-halfD, z], [1,0,0], r, halfW*2, color, {seg:8, seed, matKind:'rope'});
  cylinder(mesh, [center[0]-halfW, center[1]+halfD, z], [1,0,0], r, halfW*2, color, {seg:8, seed:seed+1, matKind:'rope'});
  cylinder(mesh, [center[0]-halfW, center[1]-halfD, z], [0,1,0], r, halfD*2, color, {seg:8, seed:seed+2, matKind:'rope'});
  cylinder(mesh, [center[0]+halfW, center[1]-halfD, z], [0,1,0], r, halfD*2, color, {seg:8, seed:seed+3, matKind:'rope'});
}
function ropeKnot(mesh, p, r, color, seed){ cone(mesh,p,[0,0,1],r*1.3,r*1.2,color,{seg:8,seed,matKind:'rope',outline:false}); cone(mesh,add(p,[0,0,r*1.2]),[0,0,1],r*1.0,r*0.9,color,{seg:8,seed:seed+1,matKind:'rope',outline:false}); }
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
    quad(mesh, [rings[i][j], rings[i][k], rings[i+1][k], rings[i+1][j]], color, { outward: points[i], mat, outline: false });
  }
}
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

/* --------------------------------------------------------------------------
 * Modelo: taller de madera con techo a dos aguas, tocón y letrero de moneda.
 * -------------------------------------------------------------------------- */
function buildWorkshop() {
  const m = [];
  // Zapata mínima: el suelo de roca compartido lo dibuja Phaser.
  bevelBox(m, [0,0,0.02],[0,0,0.10], 1.48,1.32,0.04, C.stoneDark, {seed:1,matKind:'stone',ao:0.94});

  const W = 1.10, D = 1.00, Z0 = 0.10, H = 0.62;
  // Cuerpo de madera, con rodapié y viga alta bien gruesos (lectura chunky).
  bevelBox(m, [0,0,Z0],[0,0,Z0+H], W,D,0.06, C.wood, {seed:10,matKind:'wood'});
  bevelBox(m, [0,0,Z0],[0,0,Z0+0.09], W*1.04,D*1.04,0.03, C.woodDark, {seed:11,matKind:'wood'});
  bevelBox(m, [0,0,Z0+H-0.06],[0,0,Z0+H+0.04], W*1.05,D*1.05,0.03, C.woodDark, {seed:12,matKind:'wood'});

  // Tablas vistas en las dos caras que mira la cámara (+X y +Y).
  for (const x of [-0.34,0,0.34]) bevelBox(m,[x,D/2+0.004,Z0+0.10],[x,D/2+0.02,Z0+H-0.06],0.055,0.016,0.007,C.woodLight,{seed:20+Math.round(x*100),matKind:'wood',ao:1.03});
  for (const y of [-0.30,0,0.30]) bevelBox(m,[W/2+0.004,y,Z0+0.10],[W/2+0.02,y,Z0+H-0.06],0.016,0.055,0.007,C.woodDark,{seed:30+Math.round(y*100),matKind:'wood',ao:0.97});

  // Puerta en la cara +Y (se lee en el lado izquierdo del rombo isométrico).
  bevelBox(m, [0,D/2+0.006,Z0+0.01],[0,D/2+0.040,Z0+0.50], 0.40,0.035,0.012, C.woodDeep, {seed:40,matKind:'wood',ao:0.90});
  bevelBox(m, [0,D/2+0.041,Z0+0.04],[0,D/2+0.052,Z0+0.47], 0.32,0.012,0.006, C.woodDark, {seed:41,matKind:'wood'});
  for (const sx of [-1,1]) bevelBox(m,[sx*0.215,D/2+0.006,Z0],[sx*0.215,D/2+0.045,Z0+0.54],0.045,0.04,0.01,C.woodLight,{seed:42+sx,matKind:'wood'});
  bevelBox(m, [0,D/2+0.006,Z0+0.52],[0,D/2+0.045,Z0+0.57], 0.48,0.04,0.01, C.woodLight, {seed:44,matKind:'wood'});
  cylinder(m, [0.13,D/2+0.057,Z0+0.30],[0,1,0],0.022,0.020,C.steelHi,{seg:8,seed:45,matKind:'metal',outline:false});

  // Techo a dos aguas: caballete sobre el eje Y, frontón sobre la puerta.
  const ex = 0.68, ey = 0.70, ez = 0.76, rz = 1.22;
  for (const sx of [-1,1]) {
    // Pendiente (cara superior) y cara inferior oscura para dar grosor.
    quad(m, [[sx*ex,-ey,ez],[sx*ex,ey,ez],[0,ey,rz],[0,-ey,rz]], C.wood,
      {outward:[0,0,0],mat:mmat(50+sx,'wood'),outline:true});
    const t = 0.05;
    quad(m, [[sx*ex,-ey,ez-t],[0,-ey,rz-t],[0,ey,rz-t],[sx*ex,ey,ez-t]], C.woodDeep,
      {outward:[0,0,2],mat:mmat(51+sx,'wood'),outline:false,ao:0.86});
    // Fascia del alero y listón de tabla sobre la pendiente.
    bevelBox(m,[sx*ex,-ey,ez-0.06],[sx*ex,ey,ez-0.01],0.055,0.10,0.012,C.woodDark,{seed:52+sx,matKind:'wood'});
    bevelBox(m,[sx*0.34,-ey+0.02,ez+0.10],[sx*0.34,ey-0.02,ez+0.10],0.030,0.035,0.008,C.woodDark,{seed:53+sx,matKind:'wood',ao:0.92});
  }
  bevelBox(m, [0,-ey,rz-0.03],[0,ey,rz+0.03], 0.14,0.15,0.03, C.woodDark, {seed:60,matKind:'wood'});
  // Frontones triangulares en ±Y (el de +Y queda sobre la puerta).
  for (const sy of [-1,1]) {
    quad(m, [[-W/2,sy*D/2,ez],[W/2,sy*D/2,ez],[0,sy*D/2,rz-0.05]], C.woodDark,
      {outward:[0,0,0],mat:mmat(61+sy,'wood'),outline:true,ao:0.94});
  }

  // Letrero colgado con una moneda, justo encima de la puerta.
  const SY = D/2 + 0.06;
  bevelBox(m, [0,SY,0.86],[0,SY+0.035,1.04], 0.34,0.035,0.012, C.woodDark, {seed:70,matKind:'wood'});
  cylinder(m, [0,SY+0.036,0.95],[0,1,0],0.075,0.022,C.gold,{seg:12,seed:71,matKind:'metal'});
  cylinder(m, [0,SY+0.058,0.95],[0,1,0],0.042,0.014,C.goldDark,{seg:10,seed:72,matKind:'metal',outline:false});
  for (const sx of [-1,1]) {
    tube(m, [[sx*0.13,SY+0.01,1.04],[sx*0.13,SY+0.01,1.16]], 0.012, C.rope, {seg:6,seed:73+sx,matKind:'rope'});
    ropeKnot(m,[sx*0.13,SY+0.01,1.045],0.016,C.ropeDark,75+sx);
  }

  // Armazón de carpintería en las esquinas: postes, zócalo y cartabones.
  // No se usan amarres helicoidales para no parecerse a las bases de las defensas.
  for (const sx of [-1,1]) for (const sy of [-1,1]) {
    bevelBox(m,[sx*W/2,sy*D/2,Z0+0.02],[sx*W/2,sy*D/2,Z0+H-0.02],0.095,0.095,0.02,C.woodDark,{seed:80+sx*3+sy,matKind:'wood'});
  }
  for (const sy of [-1,1]) bevelBox(m,[-W/2,sy*(D/2+0.01),Z0+0.05],[W/2,sy*(D/2+0.01),Z0+0.05],0.07,0.07,0.015,C.woodDark,{seed:90+sy,matKind:'wood',up:[0,1,0]});
  for (const sx of [-1,1]) bevelBox(m,[sx*(W/2+0.01),-D/2,Z0+0.05],[sx*(W/2+0.01),D/2,Z0+0.05],0.07,0.07,0.015,C.woodDark,{seed:94+sx,matKind:'wood',up:[1,0,0]});
  // Cartabones diagonales en las dos caras que mira la cámara.
  for (const sx of [-1,1]) {
    bevelBox(m,[sx*W/2,D/2+0.03,Z0+0.12],[sx*(W/2-0.26),D/2+0.03,Z0+0.46],0.05,0.03,0.01,C.woodLight,{seed:100+sx,matKind:'wood',up:[0,1,0],ao:1.02});
  }
  for (const sy of [-1,1]) {
    bevelBox(m,[W/2+0.03,sy*D/2,Z0+0.12],[W/2+0.03,sy*(D/2-0.24),Z0+0.46],0.05,0.03,0.01,C.woodLight,{seed:104+sy,matKind:'wood',up:[1,0,0],ao:1.02});
  }

  // Tocón para cortar leña, fuera del edificio (lado +X/+Y).
  const TX = 0.84, TY = 0.66;
  cylinder(m,[TX,TY,0.10],[0,0,1],0.17,0.24,C.woodDark,{seg:12,seed:120,matKind:'wood',ao:0.96});
  cylinder(m,[TX,TY,0.34],[0,0,1],0.17,0.025,C.woodLight,{seg:12,seed:121,matKind:'wood',outline:false,ao:1.02});
  // Hachuela clavada en el tocón: asta de madera + hoja gris.
  bevelBox(m,[TX-0.01,TY,0.34],[TX+0.16,TY,0.64],0.045,0.045,0.012,C.woodLight,{seed:122,matKind:'wood'});
  bevelBox(m,[TX-0.07,TY,0.34],[TX-0.01,TY,0.46],0.16,0.055,0.014,C.steel,{seed:123,matKind:'metal'});
  // Leña cortada al lado del tocón.
  for (const [x,y] of [[0.58,0.82],[0.72,0.88]]) {
    cylinder(m,[x,y,0.13],[1,0,0],0.075,0.24,C.wood,{seg:10,seed:130+Math.round(x*100),matKind:'wood'});
    cylinder(m,[x+0.24,y,0.13],[1,0,0],0.076,0.012,C.woodDark,{seg:10,seed:131+Math.round(x*100),matKind:'wood',outline:false});
  }
  return m;
}

// --- renderer (mismo pipeline que las defensas y los almacenes) ---
class Framebuffer { constructor(w,h){this.w=w;this.h=h;this.color=new Uint8Array(w*h*4);this.depth=new Float32Array(w*h).fill(Infinity);} blend(x,y,r,g,b,a){ if(x<0||y<0||x>=this.w||y>=this.h||a<=0) return; const i=(y*this.w+x)*4; const sa=a/255, da=this.color[i+3]/255; const oa=sa+da*(1-sa); if(oa<=0) return; this.color[i]=(r*sa+this.color[i]*da*(1-sa))/oa; this.color[i+1]=(g*sa+this.color[i+1]*da*(1-sa))/oa; this.color[i+2]=(b*sa+this.color[i+2]*da*(1-sa))/oa; this.color[i+3]=oa*255; } }
function edge(a,b,px,py){return (b.x-a.x)*(py-a.y)-(b.y-a.y)*(px-a.x);}
function project(p, target, cx, cy){ const x=p[0]-target[0], y=p[1]-target[1], z=p[2]-target[2]; return { x: cx + dot([x,y,z], RIGHT)*PPU, y: cy - dot([x,y,z], UP)*PPU, z: -dot([x,y,z], VIEW), wx:p[0], wy:p[1], wz:p[2] }; }
function drawTri(fb, A,B,Cc, col, mat){ const area=edge(A,B,Cc.x,Cc.y); if(Math.abs(area)<1e-9) return; const sign=area>0?1:-1; const inv=1/area; const x0=Math.max(0,Math.floor(Math.min(A.x,B.x,Cc.x))); const x1=Math.min(fb.w-1,Math.ceil(Math.max(A.x,B.x,Cc.x))); const y0=Math.max(0,Math.floor(Math.min(A.y,B.y,Cc.y))); const y1=Math.min(fb.h-1,Math.ceil(Math.max(A.y,B.y,Cc.y))); for(let y=y0;y<=y1;y++){ const py=y+0.5; for(let x=x0;x<=x1;x++){ const px=x+0.5; const w0=edge(B,Cc,px,py), w1=edge(Cc,A,px,py), w2=edge(A,B,px,py); if(w0*sign<0||w1*sign<0||w2*sign<0) continue; const z=(w0*A.z+w1*B.z+w2*Cc.z)*inv; const i=y*fb.w+x; if(z>=fb.depth[i]) continue; fb.depth[i]=z; let r=col[0],g=col[1],b=col[2]; if(mat){ const wx=(w0*A.wx+w1*B.wx+w2*Cc.wx)*inv; const wy=(w0*A.wy+w1*B.wy+w2*Cc.wy)*inv; const wz=(w0*A.wz+w1*B.wz+w2*Cc.wz)*inv; const f=materialFactor(mat,[wx,wy,wz]); r=clamp255(r*f); g=clamp255(g*f); b=clamp255(b*f);} fb.color[i*4]=r; fb.color[i*4+1]=g; fb.color[i*4+2]=b; fb.color[i*4+3]=255; } } }
function softEllipse(fb,cx,cy,rx,ry,alpha,color){ const x0=Math.max(0,Math.floor(cx-rx-2)), x1=Math.min(fb.w-1,Math.ceil(cx+rx+2)); const y0=Math.max(0,Math.floor(cy-ry-2)), y1=Math.min(fb.h-1,Math.ceil(cy+ry+2)); for(let y=y0;y<=y1;y++) for(let x=x0;x<=x1;x++){ const dx=(x+0.5-cx)/rx, dy=(y+0.5-cy)/ry; const d=dx*dx+dy*dy; if(d>1) continue; const a=alpha*Math.pow(1-d,1.55)*255; fb.blend(x,y,color[0],color[1],color[2],a); } }
function drawShadow(fb,cx,cy){
  softEllipse(fb, cx - 18 * SS, cy + 7 * SS, 90 * SS, 38 * SS, 0.12, [38, 28, 48]);
  softEllipse(fb, cx - 4 * SS, cy + 4 * SS, 68 * SS, 29 * SS, 0.18, [30, 20, 36]);
  softEllipse(fb, cx + 2 * SS, cy + 2 * SS, 52 * SS, 22 * SS, 0.22, [22, 14, 28]);
}
function addOutline(img){ const w=img.w,h=img.h; const src=new Uint8Array(img.data); const out=img.data; const [or,og,ob]=C.outline; for(let y=1;y<h-1;y++){ for(let x=1;x<w-1;x++){ const i=(y*w+x)*4; if(src[i+3]>20) continue; let hit=false; for(let oy=-1;oy<=1&&!hit;oy++) for(let ox=-1;ox<=1;ox++){ if(!ox&&!oy) continue; if(src[((y+oy)*w+x+ox)*4+3]>30){hit=true;break;} } if(!hit) continue; out[i]=or; out[i+1]=og; out[i+2]=ob; out[i+3]=255; } } }
function render(mesh, anchor, shadow=true){ const fb=new Framebuffer(CELL*SS,CELL*SS); const cx=anchor[0]*SS, cy=anchor[1]*SS; if(shadow) drawShadow(fb,cx,cy); for(const t of mesh){ const n=norm(cross(sub(t.p[1],t.p[0]),sub(t.p[2],t.p[0]))); if(!isFinite(n[0])||len(n)<1e-7) continue; const col=shade(t.color,n,t.ao,t.tint); drawTri(fb, project(t.p[0],[0,0,0],cx,cy), project(t.p[1],[0,0,0],cx,cy), project(t.p[2],[0,0,0],cx,cy), col, t.mat); } const out=downsample(fb,CELL*SS,CELL*SS,SS); addOutline(out); return out; }
function downsample(fb,w,h,factor){ const ow=w/factor, oh=h/factor; const out=new Uint8Array(ow*oh*4); for(let y=0;y<oh;y++) for(let x=0;x<ow;x++){ let a=0,r=0,g=0,b=0; for(let sy=0;sy<factor;sy++) for(let sx=0;sx<factor;sx++){ const i=((y*factor+sy)*w+x*factor+sx)*4; const al=fb.color[i+3]/255; a+=al; r+=fb.color[i]*al; g+=fb.color[i+1]*al; b+=fb.color[i+2]*al; } const n=factor*factor; const o=(y*ow+x)*4; out[o+3]=Math.round((a/n)*255); if(a>0){ out[o]=Math.round(r/a); out[o+1]=Math.round(g/a); out[o+2]=Math.round(b/a); } } return {data:out,w:ow,h:oh}; }

const CRC_TABLE=(()=>{const t=new Uint32Array(256); for(let n=0;n<256;n++){let c=n; for(let k=0;k<8;k++) c=(c&1)?0xEDB88320^(c>>>1):c>>>1; t[n]=c>>>0;} return t;})();
function crc32(buf){let c=0xFFFFFFFF; for(let i=0;i<buf.length;i++) c=CRC_TABLE[(c^buf[i])&0xFF]^(c>>>8); return (c^0xFFFFFFFF)>>>0;}
function chunk(type,data){const len=Buffer.alloc(4); len.writeUInt32BE(data.length); const body=Buffer.concat([Buffer.from(type,'ascii'),data]); const crc=Buffer.alloc(4); crc.writeUInt32BE(crc32(body)); return Buffer.concat([len,body,crc]);}
function encodePNG(img){ const stride=img.w*4; const raw=Buffer.alloc((stride+1)*img.h); for(let y=0;y<img.h;y++){ raw[y*(stride+1)]=0; Buffer.from(img.data.buffer,img.data.byteOffset+y*stride,stride).copy(raw,y*(stride+1)+1);} const ihdr=Buffer.alloc(13); ihdr.writeUInt32BE(img.w,0); ihdr.writeUInt32BE(img.h,4); ihdr[8]=8; ihdr[9]=6; ihdr[10]=0; ihdr[11]=0; ihdr[12]=0; return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), chunk('IHDR',ihdr), chunk('IDAT',zlib.deflateSync(raw,{level:9})), chunk('IEND',Buffer.alloc(0))]); }
function boundingBox(img){ let x0=img.w,y0=img.h,x1=-1,y1=-1; for(let y=0;y<img.h;y++) for(let x=0;x<img.w;x++){ if(img.data[(y*img.w+x)*4+3]>8){ if(x<x0)x0=x; if(x>x1)x1=x; if(y<y0)y0=y; if(y>y1)y1=y; } } return [x0,y0,x1,y1]; }

fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(PREVIEW_DIR, { recursive: true });
const img = render(buildWorkshop(), ANCHOR, true);
fs.writeFileSync(path.join(OUT, 'workshop.png'), encodePNG(img));
const meta = { generator:'tools/workshop-art/generate.mjs', cell:CELL, artScale:ART_SCALE, anchor:{x:ANCHOR[0],y:ANCHOR[1]}, bbox: boundingBox(img) };
fs.writeFileSync(path.join(OUT, 'workshop-art.json'), JSON.stringify(meta, null, 2) + '\n');
console.log(`workshop: bbox=${meta.bbox.join('..')}`);
