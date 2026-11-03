// ==========================================================================
// TERRAVITA · Del barro a tu pieza, en 3D real (WebGL / three.js)
// Misma secuencia, tamaño y encuadre que la ilustración, pero con materiales físicos:
// barro húmedo con brillo y marcas del torneado, torno de aluminio, bandeja salpicada de barbotina,
// horno (la pieza se enciende y se enfría), esmalte crema moteado "sumergido" y el sello estampado.
// main.js calcula el progreso y llama a window.__piece3d.render(estado) en cada cuadro.
// Si WebGL no está disponible, se queda la versión 2D.
// ==========================================================================
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.min.js';

const stage = document.querySelector('.piece__stage');
if (stage) init();

function init() {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch (e) { return; }
  if (!renderer.getContext()) return;

  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = t => t * t * (3 - 2 * t);
  const TAU = Math.PI * 2;
  const rnd = (a => () => (a = (a * 16807) % 2147483647) / 2147483647)(11);

  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.VSMShadowMap;
  renderer.setClearColor(0x000000, 0);
  const cv = renderer.domElement;
  cv.className = 'piece__gl';
  stage.appendChild(cv);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(22, 1, .1, 20);
  // 1 unidad = el ancho del cuadro; la cámara mira un poco desde arriba (como la ilustración)
  const EL = 13 * Math.PI / 180, DIST = 2.62;
  camera.position.set(0, Math.sin(EL) * DIST, Math.cos(EL) * DIST);
  camera.lookAt(0, 0, 0);
  const Y0 = -0.205; // altura del plato del torno (la base de la pieza)

  // ---------- estudio de fotografía: luz ambiental reflejada (softbox arriba, ventana a la izquierda) ----------
  {
    const env = new THREE.Scene();
    env.add(new THREE.Mesh(new THREE.BoxGeometry(10, 10, 10), new THREE.MeshBasicMaterial({ color: new THREE.Color(0x6e5c4a), side: THREE.BackSide })));
    const panel = (w, h, x, y, z, k, col) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(col).multiplyScalar(k), side: THREE.DoubleSide }));
      m.position.set(x, y, z); m.lookAt(0, 0, 0); env.add(m);
    };
    panel(5, 2.4, 0, 4.6, .5, 3.2, 0xfff2de);   // softbox arriba
    panel(2.2, 3.4, -4.6, 1.2, 1.4, 2.6, 0xfff6ea); // ventana izquierda
    panel(1.6, 3, 4.6, 1, -1.2, 1.1, 0xffdcb8);  // rebote cálido derecha
    panel(6, 1.6, 0, .2, 4.8, .9, 0xfff0e0);     // relleno frontal
    const pm = new THREE.PMREMGenerator(renderer);
    scene.environment = pm.fromScene(env, .04).texture;
    pm.dispose();
  }
  const key = new THREE.DirectionalLight(0xfff0de, 2.1);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  Object.assign(key.shadow.camera, { left: -.6, right: .6, top: .6, bottom: -.6, near: .1, far: 6 });
  key.shadow.bias = -.0002; key.shadow.normalBias = .004; key.shadow.radius = 14; key.shadow.blurSamples = 20;
  scene.add(key, key.target);
  key.target.position.set(0, Y0 + .1, 0);
  scene.add(new THREE.HemisphereLight(0xfff4e4, 0x7a5236, .35));
  const rim = new THREE.DirectionalLight(0xfff3e6, .9); rim.position.set(-.9, .8, -1.3); scene.add(rim); // contraluz que despega la pieza del fondo

  // ---------- texturas hechas por código ----------
  const canvasTex = (w, h, draw, srgb = true) => {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 4;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  // Variación del barro: barbotina corrida en franjas horizontales (se nota cómo gira)
  const clayMap = canvasTex(1024, 512, (x, w, h) => {
    x.fillStyle = '#dcdcdc'; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 900; i++) {
      const y = rnd() * h, len = 40 + rnd() * 380, l = rnd() > .5;
      x.strokeStyle = l ? `rgba(255,250,244,${.03 + rnd() * .07})` : `rgba(90,70,60,${.015 + rnd() * .04})`;
      x.lineWidth = .6 + rnd() * 3.4;
      const x0 = rnd() * w;
      x.beginPath(); x.moveTo(x0, y); x.bezierCurveTo(x0 + len * .3, y + (rnd() - .5) * 3, x0 + len * .7, y + (rnd() - .5) * 3, x0 + len, y + (rnd() - .5) * 2); x.stroke();
      if (x0 + len > w) { x.beginPath(); x.moveTo(x0 - w, y); x.lineTo(x0 + len - w, y); x.stroke(); }
    }
    for (let i = 0; i < 70; i++) { // manchas suaves (más húmedo / más seco)
      const cx = rnd() * w, cy = rnd() * h, r = 20 + rnd() * 90;
      const g = x.createRadialGradient(cx, cy, 0, cx, cy, r);
      const d = rnd() > .5;
      g.addColorStop(0, d ? 'rgba(80,60,50,.10)' : 'rgba(255,255,255,.10)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = g; x.fillRect(cx - r, cy - r, r * 2, r * 2);
    }
  });
  // Grano fino para el relieve
  const grain = canvasTex(256, 256, (x, w, h) => {
    const d = x.createImageData(w, h);
    for (let i = 0; i < w * h; i++) { const v = 110 + rnd() * 70 + (rnd() > .985 ? 60 : 0); d.data[i * 4] = d.data[i * 4 + 1] = d.data[i * 4 + 2] = v; d.data[i * 4 + 3] = 255; }
    x.putImageData(d, 0, 0);
    x.filter = 'blur(.6px)'; x.drawImage(x.canvas, 0, 0);
  }, false);
  grain.repeat.set(10, 5);
  // Nubes de baja frecuencia: zonas más húmedas / más secas, grosor del esmalte
  const cloud = canvasTex(512, 512, (x, w, h) => {
    x.fillStyle = '#c8c8c8'; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 420; i++) {
      const cx = rnd() * w, cy = rnd() * h, r = 12 + rnd() * 70, v = rnd() > .5 ? 255 : 0;
      for (const ox of [-w, 0, w]) for (const oy of [-h, 0, h]) {
        const g = x.createRadialGradient(cx + ox, cy + oy, 0, cx + ox, cy + oy, r);
        g.addColorStop(0, `rgba(${v},${v},${v},.09)`); g.addColorStop(1, `rgba(${v},${v},${v},0)`);
        x.fillStyle = g; x.fillRect(cx + ox - r, cy + oy - r, r * 2, r * 2);
      }
    }
  }, false);
  cloud.repeat.set(3, 2);
  // Cuerpo del torno: pintura con manchas de barbotina seca y huellas
  const bodyMap = canvasTex(512, 512, (x, w, h) => {
    x.fillStyle = '#ffffff'; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 120; i++) { const cx = rnd() * w, cy = rnd() * h, r = 2 + Math.pow(rnd(), 2) * 22;
      const g = x.createRadialGradient(cx, cy, 0, cx, cy, r); g.addColorStop(0, `rgba(150,128,108,${.15 + rnd() * .25})`); g.addColorStop(1, 'rgba(150,128,108,0)');
      x.fillStyle = g; x.fillRect(cx - r, cy - r, r * 2, r * 2); }
    for (let i = 0; i < 25; i++) { x.strokeStyle = `rgba(140,120,100,${.04 + rnd() * .07})`; x.lineWidth = 2 + rnd() * 6; const x0 = rnd() * w, y0 = rnd() * h * .4;
      x.beginPath(); x.moveTo(x0, y0); x.lineTo(x0 + (rnd() - .5) * 8, y0 + 20 + rnd() * 120); x.stroke(); } // chorreados
  });
  // Motas del esmalte (óxido de hierro que sale a través del esmalte crema)
  const speck = canvasTex(512, 512, (x, w, h) => {
    x.fillStyle = '#000'; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 520; i++) {
      const cx = rnd() * w, cy = rnd() * h, r = .6 + Math.pow(rnd(), 3) * 3.6;
      const g = x.createRadialGradient(cx, cy, 0, cx, cy, r * 1.8);
      g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.5, 'rgba(255,255,255,.75)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = g;
      for (const ox of [-w, 0, w]) for (const oy of [-h, 0, h]) { x.save(); x.translate(ox, oy); x.fillRect(cx - r * 2, cy - r * 2, r * 4, r * 4); x.restore(); }
    }
  }, false);
  // Sello de Terravita (la vasija del logo)
  const stampTex = (() => {
    const c = document.createElement('canvas'); c.width = 512; c.height = 608;
    const x = c.getContext('2d');
    const paths = [...document.querySelectorAll('#mark path')].map(p => new Path2D(p.getAttribute('d')));
    const tr = (document.querySelector('#mark g')?.getAttribute('transform') || '').match(/translate\(([-\d.]+)[ ,]+([-\d.]+)\)\s*scale\(([-\d.]+)[ ,]+([-\d.]+)\)/);
    const sc = 512 / 1464;
    x.save(); x.scale(sc, 608 / 1736);
    if (tr) { x.translate(+tr[1], +tr[2]); x.scale(+tr[3], +tr[4]); }
    x.fillStyle = '#fff'; paths.forEach(p => x.fill(p)); x.restore();
    const t = new THREE.CanvasTexture(c); t.anisotropy = 4; return t;
  })();
  // Plato del torno: aluminio con surcos concéntricos y restos de barbotina
  const headMap = canvasTex(1024, 1024, (x, w) => {
    const c = w / 2;
    x.fillStyle = '#c9c9c7'; x.fillRect(0, 0, w, w);
    for (let r = 4; r < c; r += 2 + rnd() * 3) { x.strokeStyle = `rgba(${rnd() > .5 ? '255,255,255' : '60,60,60'},${.05 + rnd() * .12})`; x.lineWidth = 1 + rnd(); x.beginPath(); x.arc(c, c, r, 0, TAU); x.stroke(); }
    for (let i = 0; i < 16; i++) { // barbotina seca en arcos
      const r = c * (.35 + rnd() * .62), a = rnd() * TAU, len = .3 + rnd() * 1.6;
      x.strokeStyle = `rgba(150,126,104,${.25 + rnd() * .4})`; x.lineWidth = 3 + rnd() * 16; x.lineCap = 'round';
      x.beginPath(); x.arc(c, c, r, a, a + len); x.stroke();
    }
    x.fillStyle = 'rgba(120,120,118,.9)'; [0, 1, 2].forEach(k => { const a = k * TAU / 3 + .3; x.beginPath(); x.arc(c + Math.cos(a) * c * .55, c + Math.sin(a) * c * .55, 9, 0, TAU); x.fill(); });
  });
  // Bandeja: fibra terracota con salpicaduras de barbotina
  const panMap = canvasTex(1024, 256, (x, w, h) => {
    x.fillStyle = '#ffffff'; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 140; i++) {
      const cx = rnd() * w, cy = rnd() * h, r = .8 + Math.pow(rnd(), 3) * 6;
      x.fillStyle = `rgba(${rnd() > .5 ? '150,128,108' : '182,164,146'},${.12 + rnd() * .3})`;
      x.beginPath(); x.ellipse(cx, cy, r * (1 + rnd() * 3), r, 0, 0, TAU); x.fill();
    }
    for (let i = 0; i < 30; i++) { x.fillStyle = `rgba(160,140,120,${.12 + rnd() * .18})`; x.fillRect(rnd() * w, h * (.55 + rnd() * .45), 20 + rnd() * 120, 3 + rnd() * 10); }
  });
  // Madera de la repisa
  const woodMap = canvasTex(1024, 256, (x, w, h) => {
    x.fillStyle = '#c9a479'; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 160; i++) {
      const y0 = rnd() * h, a = 2 + rnd() * 6, f = .004 + rnd() * .01, ph = rnd() * TAU;
      x.strokeStyle = `rgba(${rnd() > .5 ? '120,78,44' : '214,170,120'},${.08 + rnd() * .22})`; x.lineWidth = .6 + rnd() * 2.6;
      x.beginPath(); for (let px = 0; px <= w; px += 8) { const y = y0 + Math.sin(px * f + ph) * a + Math.sin(px * f * 3.1 + ph) * a * .3; px ? x.lineTo(px, y) : x.moveTo(px, y); } x.stroke();
    }
    for (let i = 0; i < 3; i++) { // nudos
      const cx = rnd() * w, cy = rnd() * h;
      for (let r = 2; r < 18; r += 3) { x.strokeStyle = `rgba(110,70,40,${.35 - r / 60})`; x.lineWidth = 1.2; x.beginPath(); x.ellipse(cx, cy, r * 2.6, r, 0, 0, TAU); x.stroke(); }
    }
  });

  // ---------- la pieza: sólido de revolución que se rehace con el scroll ----------
  // Perfiles: [u (0 = base, 1 = boca), radio] — h = alto, o = qué tan abierta está la boca (iguales a la 2D)
  const P = [
    { h: .30, o: 0, pts: [[0, .20], [.15, .27], [.38, .30], [.62, .27], [.8, .21], [.92, .13], [.98, .06], [1, 0]] },
    { h: .21, o: 0, pts: [[0, .35], [.5, .355], [.78, .345], [.92, .31], [1, .26]] },
    { h: .25, o: 1, pts: [[0, .15], [.1, .19], [.35, .27], [.65, .33], [.88, .365], [1, .375]] },
    { h: .40, o: 1, pts: [[0, .17], [.06, .2], [.25, .215], [.55, .225], [.85, .22], [1, .225]] },
    { h: .62, o: 1, pts: [[0, .16], [.12, .23], [.32, .275], [.55, .21], [.75, .11], [.86, .085], [.95, .1], [1, .12]] },
  ];
  const K = 64;
  P.forEach(s => {
    s.r = new Float32Array(K + 1);
    for (let k = 0; k <= K; k++) {
      const u = k / K; let i = 0; while (i < s.pts.length - 2 && u > s.pts[i + 1][0]) i++;
      const [u0, r0] = s.pts[i], [u1, r1] = s.pts[i + 1]; const t = clamp((u - u0) / (u1 - u0));
      s.r[k] = r0 + (r1 - r0) * (1 - Math.cos(t * Math.PI)) / 2;
    }
  });

  const NB = 6, NO = 72, NL = 10, NI = 56, M = NB + NO + NL + NI, S = 112;
  const px = new Float32Array(M), py = new Float32Array(M), pin = new Float32Array(M);
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array((S + 1) * M * 3), uvs = new Float32Array((S + 1) * M * 2), inn = new Float32Array((S + 1) * M);
  const idx = [];
  for (let j = 0; j <= S; j++) for (let k = 0; k < M; k++) { const i = j * M + k; uvs[i * 2] = j / S; uvs[i * 2 + 1] = k / (M - 1); }
  for (let j = 0; j < S; j++) for (let k = 0; k < M - 1; k++) {
    const a = j * M + k, b = a + M, c = b + 1, d = a + 1;
    idx.push(a, b, d, c, d, b);
  }
  geo.setIndex(idx);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.setAttribute('aInner', new THREE.BufferAttribute(inn, 1));
  const sinT = new Float32Array(S + 1), cosT = new Float32Array(S + 1);
  for (let j = 0; j <= S; j++) { sinT[j] = Math.sin(j / S * TAU); cosT[j] = Math.cos(j / S * TAU); }
  if (S) { sinT[S] = sinT[0]; cosT[S] = cosT[0]; }

  let H = .5, ym = .25, rMax = .3, rMaxBase = .2;
  function build(s) {
    const i0 = Math.min(4, Math.floor(s)), i1 = Math.min(4, i0 + 1), f0 = s - Math.floor(s);
    const f = i0 === i1 ? 0 : smooth(clamp((f0 - .12) / .76));
    const A = P[i0], B = P[i1];
    const h = lerp(A.h, B.h, f) * .95, o = lerp(A.o, B.o, f);
    const R = k => lerp(A.r[k], B.r[k], f) * .92;
    const rAt = u => { const x = clamp(u) * K, k = Math.floor(x), t = x - k; return k >= K ? R(K) : R(k) * (1 - t) + R(k + 1) * t; };
    const irr = 1 - smooth(clamp(s / 1.05));       // el puñado es irregular; al centrarlo se vuelve redondo
    const ringA = .0006 * smooth(clamp(s - 1.25));  // marcas del torneado (los anillos de los dedos)
    const ring = (y, u) => ringA * (Math.sin(y / .02 * TAU + .8) + .5 * Math.sin(y / .0137 * TAU + 2.1) + .4 * Math.sin(y / .051 * TAU)) * smooth(clamp(u / .08)) * smooth(clamp((1 - u) / .05));
    const t = .026, tt = t * o, rt = rAt(1);
    let n = 0;
    for (let k = 0; k < NB; k++) { px[n] = rAt(0) * .965 * (k / (NB - 1)); py[n] = 0; pin[n] = 0; n++; }
    for (let k = 0; k < NO; k++) {
      const u = k / (NO - 1), y = u * h;
      px[n] = Math.max(0, rAt(u) * (k === 0 ? .975 : 1) + ring(y, u)); py[n] = y; pin[n] = 0; n++;
    }
    for (let k = 0; k < NL; k++) { // borde redondeado del labio
      const a = (k + 1) / (NL + 1) * Math.PI;
      px[n] = rt - tt / 2 + tt / 2 * Math.cos(a); py[n] = h + tt / 2 * Math.sin(a) * .85; pin[n] = o; n++;
    }
    const yf = Math.max(.034, h * .1), uf = Math.min(.5, yf / h), dome = rt * .16;
    for (let k = 0; k < NI; k++) {
      const q = k / (NI - 1);
      const xc = (rt - tt) * Math.cos(q * Math.PI / 2), yc = h + dome * Math.sin(q * Math.PI / 2); // cerrado: domo
      let xo, yo;                                                                           // abierto: pared interior y fondo
      if (q < .8) { const u = 1 - (q / .8) * (1 - uf); xo = Math.max(.004, rAt(u) - t + ring(u * h, u) * .6); yo = u * h; }
      else { const w = (q - .8) / .2, xw = Math.max(.004, rAt(uf) - t); xo = xw * (1 - smooth(w)); yo = yf - Math.sin(w * Math.PI) * .004; }
      px[n] = lerp(xc, xo, o); py[n] = lerp(yc, yo, o); pin[n] = o; n++;
    }
    H = h; ym = h * .5; rMax = 0; for (let k = 0; k < M; k++) rMax = Math.max(rMax, px[k]); rMaxBase = rAt(0);
    for (let j = 0; j <= S; j++) {
      const sn = sinT[j], cs = cosT[j], ph = j / S * TAU;
      for (let k = 0; k < M; k++) {
        let r = px[k], y = py[k];
        if (irr > .001) {
          const yy = y / Math.max(h, .01);
          r *= 1 + irr * (.075 * Math.sin(2 * ph + 1.3 + yy * 2.2) + .05 * Math.sin(3 * ph + .4 - yy * 3.1) + .025 * Math.sin(5 * ph + yy * 6.3) + .012 * Math.sin(9 * ph + 2 + yy * 8));
          y *= 1 + irr * .06 * Math.sin(2 * ph + 2.1) * yy;
        }
        const i = (j * M + k) * 3;
        pos[i] = r * sn; pos[i + 1] = y; pos[i + 2] = r * cs;
        inn[j * M + k] = pin[k];
      }
    }
    geo.attributes.position.needsUpdate = true;
    geo.attributes.aInner.needsUpdate = true;
    geo.computeVertexNormals();
    const nr = geo.attributes.normal.array;
    for (let k = 0; k < M; k++) { // costura y polos
      const a = k * 3, b = (S * M + k) * 3;
      let nx = nr[a] + nr[b], ny = nr[a + 1] + nr[b + 1], nz = nr[a + 2] + nr[b + 2];
      const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
      nr[a] = nr[b] = nx; nr[a + 1] = nr[b + 1] = ny; nr[a + 2] = nr[b + 2] = nz;
      if (px[k] < 1e-4) for (let j = 0; j <= S; j++) { const c = (j * M + k) * 3; nr[c] = 0; nr[c + 1] = k < NB ? -1 : 1; nr[c + 2] = 0; }
    }
    geo.attributes.normal.needsUpdate = true;
    return h;
  }

  const U = {
    uGlaze: { value: 0 }, uDip: { value: .2 }, uGlow: { value: 0 }, uStamp: { value: 0 }, uStampS: { value: 1 },
    uStampY: { value: .2 }, uStampW: { value: .085 }, uSpeck: { value: speck }, uCloud: { value: cloud }, uStampT: { value: stampTex },
    uGlazeCol: { value: new THREE.Color(0xf1e7d4) }, uSpeckCol: { value: new THREE.Color(0x4a2a17) }, uSealCol: { value: new THREE.Color(0x8a5a36) }, uBreakCol: { value: new THREE.Color(0xb88452) }, uTop: { value: .5 },
  };
  const WET = new THREE.Color(0x7f6b5c), BISQUE = new THREE.Color(0xd9c4a4);
  const clayMat = new THREE.MeshStandardMaterial({ color: WET.clone(), map: clayMap, bumpMap: grain, bumpScale: .9, roughnessMap: cloud, roughness: .34, metalness: 0, envMapIntensity: 1.05 });
  clayMat.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aInner;\nvarying vec3 vObj;\nvarying float vInner;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvObj = position; vInner = aInner;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vObj; varying float vInner;
        uniform float uGlaze, uDip, uGlow, uStamp, uStampS, uStampY, uStampW;
        uniform sampler2D uSpeck, uStampT, uCloud; uniform vec3 uGlazeCol, uSpeckCol, uSealCol, uBreakCol; uniform float uTop;
        float gMask; float sealA;
        // relieve del sello (0..1), hundido en la pared exterior
        float stampH() {
          if (uStamp <= 0.0 || vInner > 0.5) return 0.0;
          float ang = atan(vObj.x, vObj.z), rr = length(vObj.xz);
          vec2 st = vec2(ang * rr, vObj.y - uStampY) / (uStampW * uStampS) * vec2(1.0, 1464.0 / 1736.0) + 0.5;
          if (st.x < 0.0 || st.x > 1.0 || st.y < 0.0 || st.y > 1.0 || cos(ang) < 0.0) return 0.0;
          return texture2D(uStampT, st).a * uStamp;
        }`)
      .replace('#include <map_fragment>', `#include <map_fragment>
        {
          float ang = atan(vObj.x, vObj.z);
          float rr = length(vObj.xz);
          // esmalte: la pieza se "sumerge" boca abajo; el borde del baño ondula y el interior queda esmaltado
          float dip = uDip + 0.0065 * sin(ang * 5.0 + 1.0) + 0.004 * sin(ang * 11.0 + 2.3) + 0.0025 * sin(ang * 23.0);
          // chorreados del esmalte por debajo del borde del baño
          for (int i = 0; i < 9; i++) {
            float fi = float(i);
            float a0 = fract(sin(fi * 12.9898) * 43758.5453) * 6.2832 - 3.1416;
            float wd = 0.035 + 0.03 * fract(sin(fi * 78.233) * 9631.7);
            float ln = 0.012 + 0.03 * fract(sin(fi * 39.425) * 2715.3);
            float d = mod(ang - a0 + 3.1416, 6.2832) - 3.1416;
            dip -= ln * exp(-d * d / (wd * wd)) * smoothstep(0.0, 0.5, uGlaze);
          }
          float outer = smoothstep(dip - 0.0025, dip + 0.0025, vObj.y);
          gMask = uGlaze * max(outer, step(0.5, vInner));
          float edge = (1.0 - smoothstep(dip, dip + 0.014, vObj.y)) * outer;
          vec2 sUv = vec2(ang * 0.32 * (0.6 + rr * 1.4), vObj.y * 1.15) * 2.2;
          float sp = texture2D(uSpeck, sUv).r;
          float sp2 = texture2D(uSpeck, sUv * 2.7 + 0.31).r;
          float thick = clamp((texture2D(uCloud, vec2(ang * 0.5, vObj.y * 1.6)).r - 0.6) * 2.5 + 0.5, 0.0, 1.0);
          vec3 glaze = uGlazeCol * (1.0 - edge * 0.07) * (0.96 + thick * 0.08);
          glaze = mix(glaze, glaze * vec3(1.0, 0.95, 0.86), smoothstep(0.55, 0.75, thick) * 0.6);
          glaze = mix(glaze, uSpeckCol, clamp(sp * 0.9 + sp2 * 0.35, 0.0, 1.0));
          // el esmalte se adelgaza y "quiebra" a ámbar en las crestas del torneado y en el labio
          float y = vObj.y;
          float ridge = sin(y / 0.02 * 6.2832 + 0.8) + 0.5 * sin(y / 0.0137 * 6.2832 + 2.1) + 0.4 * sin(y / 0.051 * 6.2832);
          float brk = smoothstep(0.6, 1.7, ridge) * 0.28 * (1.0 - vInner) + smoothstep(uTop - 0.016, uTop + 0.004, y) * 0.55;
          brk += edge * 0.35;
          glaze = mix(glaze, uBreakCol, clamp(brk, 0.0, 0.8) * (1.0 - clamp(sp * 1.2, 0.0, 1.0)));
          diffuseColor.rgb = mix(diffuseColor.rgb, glaze, gMask);
          // sello estampado: hundido en el barro, se ve el terracota a través del esmalte
          sealA = 0.0;
          if (uStamp > 0.0 && vInner < 0.5) {
            vec2 st = vec2(ang * rr, vObj.y - uStampY) / (uStampW * uStampS) * vec2(1.0, 1464.0 / 1736.0) + 0.5;
            if (st.x > 0.0 && st.x < 1.0 && st.y > 0.0 && st.y < 1.0 && cos(ang) > 0.0) {
              float a = texture2D(uStampT, st).a;
              float a2 = texture2D(uStampT, st + vec2(-0.012, -0.012)).a;
              sealA = a * uStamp;
              vec3 seal = uSealCol;
              diffuseColor.rgb = mix(diffuseColor.rgb, seal, sealA * 0.7);
            }
          }
        }`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        { float hS = stampH(); if (uStamp > 0.0) normal = perturbNormalArb(-vViewPosition, normal, vec2(dFdx(hS), dFdy(hS)) * -2.2, faceDirection); }`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = mix(roughnessFactor, 0.1 + 0.25 * (texelRoughness.g - 0.6), gMask);`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        totalEmissiveRadiance += uGlow * vec3(1.0, 0.36, 0.09) * (0.75 + 0.25 * sin(vObj.y * 40.0 + atan(vObj.x, vObj.z) * 3.0));`);
  };
  const clay = new THREE.Mesh(geo, clayMat);
  clay.castShadow = clay.receiveShadow = true;
  clay.frustumCulled = false;
  const pieceG = new THREE.Group(); pieceG.add(clay); pieceG.position.y = Y0; scene.add(pieceG);
  // sombra de contacto (oclusión) justo debajo de la pieza
  const aoTex = canvasTex(256, 256, (x, w) => { const g = x.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    g.addColorStop(0, 'rgba(0,0,0,.9)'); g.addColorStop(.42, 'rgba(0,0,0,.75)'); g.addColorStop(.62, 'rgba(0,0,0,.25)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g; x.fillRect(0, 0, w, w); }, false);
  const ao = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0x2a1a10, alphaMap: aoTex, transparent: true, opacity: .55, depthWrite: false }));
  ao.rotation.x = -Math.PI / 2; ao.position.y = .0012; ao.renderOrder = 1; pieceG.add(ao);

  // ---------- el torno ----------
  const wheel = new THREE.Group(); scene.add(wheel);
  const fade = [];
  const mat = (o) => { const m = new THREE.MeshStandardMaterial(o); fade.push(m); return m; };
  const headMat = mat({ map: headMap, metalness: .55, roughness: .22, roughnessMap: cloud, envMapIntensity: 1.6 });
  const head = new THREE.Mesh(new THREE.CylinderGeometry(.3, .298, .03, 128, 1), [mat({ color: 0xd0cfcb, metalness: .8, roughness: .25, envMapIntensity: 1.6 }), headMat, headMat]);
  head.position.y = Y0 - .015; head.receiveShadow = head.castShadow = true;
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(.05, .05, .06, 32), mat({ color: 0x55524e, metalness: .8, roughness: .45 }));
  shaft.position.y = Y0 - .06;
  const panPts = [[.1, -.068], [.36, -.07], [.385, -.066], [.398, -.045], [.405, -.018], [.412, -.006], [.42, -.004], [.426, -.01], [.424, -.024], [.415, -.06], [.4, -.09]].map(p => new THREE.Vector2(p[0], p[1]));
  const pan = new THREE.Mesh(new THREE.LatheGeometry(panPts, 128), mat({ color: 0xf2efe8, map: panMap, roughness: .38, metalness: 0, side: THREE.DoubleSide }));
  pan.position.y = Y0; pan.receiveShadow = true;
  // cuerpo del torno: caja de bordes redondeados
  const bodyShape = (() => { const w = .72, d = .6, r = .07, s = new THREE.Shape();
    s.moveTo(-w / 2 + r, -d / 2); s.lineTo(w / 2 - r, -d / 2); s.quadraticCurveTo(w / 2, -d / 2, w / 2, -d / 2 + r); s.lineTo(w / 2, d / 2 - r); s.quadraticCurveTo(w / 2, d / 2, w / 2 - r, d / 2);
    s.lineTo(-w / 2 + r, d / 2); s.quadraticCurveTo(-w / 2, d / 2, -w / 2, d / 2 - r); s.lineTo(-w / 2, -d / 2 + r); s.quadraticCurveTo(-w / 2, -d / 2, -w / 2 + r, -d / 2); return s; })();
  const bodyGeo = new THREE.ExtrudeGeometry(bodyShape, { depth: .2, bevelEnabled: true, bevelThickness: .018, bevelSize: .018, bevelSegments: 4, curveSegments: 10 });
  bodyGeo.rotateX(Math.PI / 2);
  const body = new THREE.Mesh(bodyGeo, mat({ color: 0xc9c4bb, map: bodyMap, roughness: .48, metalness: .15 }));
  body.position.y = Y0 - .07; body.receiveShadow = true;
  const knob = new THREE.Mesh(new THREE.CylinderGeometry(.026, .028, .02, 40), mat({ color: 0x2b2826, roughness: .5, metalness: .3 }));
  knob.rotation.x = Math.PI / 2; knob.position.set(.22, Y0 - .17, .32);
  const knobDot = new THREE.Mesh(new THREE.CylinderGeometry(.006, .006, .022, 12), mat({ color: 0xd8d4cc, roughness: .5 }));
  knobDot.rotation.x = Math.PI / 2; knobDot.position.set(.22, Y0 - .155, .322);
  // barbotina húmeda acumulada alrededor de la base de la pieza (como en un torno de verdad)
  const slipPts = []; for (let i = 0; i <= 16; i++) { const t = i / 16; slipPts.push(new THREE.Vector2(.94 + t * .2, Math.pow(Math.sin((1 - t) * Math.PI / 2), 1.6) * .011 + .0004)); }
  const slip = new THREE.Mesh(new THREE.LatheGeometry(slipPts, 96), mat({ color: 0x8a7767, roughness: .12, roughnessMap: cloud, bumpMap: grain, bumpScale: .5, envMapIntensity: 1.3 }));
  slip.position.y = Y0; slip.receiveShadow = true;
  wheel.add(head, shaft, pan, body, knob, knobDot, slip);

  // ---------- la repisa de madera ----------
  const shelf = new THREE.Group(); scene.add(shelf);
  const woodMat = new THREE.MeshStandardMaterial({ map: woodMap, roughness: .62, metalness: 0, transparent: true });
  const boardGeo = (() => { const s = new THREE.Shape(); s.moveTo(-.45, -.15); s.lineTo(.45, -.15); s.lineTo(.45, .15); s.lineTo(-.45, .15); s.lineTo(-.45, -.15);
    const g = new THREE.ExtrudeGeometry(s, { depth: .026, bevelEnabled: true, bevelThickness: .004, bevelSize: .004, bevelSegments: 3 });
    g.rotateX(-Math.PI / 2); g.translate(0, -.03, 0);
    const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / .9 + .5, uv.getY(i) / .3 + .5);
    return g; })();
  const board = new THREE.Mesh(boardGeo, woodMat);
  board.position.y = Y0; board.receiveShadow = true;
  const brMat = new THREE.MeshStandardMaterial({ color: 0x3b2a20, roughness: .4, metalness: .6, transparent: true });
  const bracket = () => { const g = new THREE.Group();
    const v = new THREE.Mesh(new THREE.BoxGeometry(.012, .12, .03), brMat); v.position.set(0, -.094, -.13);
    const hz = new THREE.Mesh(new THREE.BoxGeometry(.012, .006, .2), brMat); hz.position.set(0, -.037, -.05);
    const d = new THREE.Mesh(new THREE.BoxGeometry(.01, .17, .006), brMat); d.position.set(0, -.09, -.085); d.rotation.x = .78;
    g.add(v, hz, d); g.position.y = Y0; return g; };
  const br1 = bracket(); br1.position.x = -.3; const br2 = bracket(); br2.position.x = .3;
  shelf.add(board, br1, br2);

  // ---------- tamaño ----------
  const size = () => {
    const w = stage.clientWidth, h = stage.clientHeight; if (!w) return;
    renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1));
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
  };
  size();
  new ResizeObserver(size).observe(stage);

  let lastS = -1, lock = null;
  const setFade = (list, a) => list.forEach(m => { const t = a < .999; if (m.transparent !== t) { m.transparent = t; m.needsUpdate = true; } m.opacity = a; m.depthWrite = a > .5; });

  function render({ s, spin, lx }) {
    if (Math.abs(s - lastS) > 1e-4) { build(Math.min(s, 5)); lastS = s; }
    const g = clamp(s - 4.05);                 // horno + esmalte (0..1)
    const fire = smooth(clamp(g / .32));       // de húmedo a bizcocho
    const glow = Math.sin(clamp(g / .34) * Math.PI) * .6;
    const glaze = smooth(clamp((g - .3) / .34));
    const stamp = smooth(clamp((g - .66) / .22));
    const wa = 1 - smooth(clamp((s - 4) / .6));

    // barro: húmedo y brillante → bizcocho mate → esmaltado
    clayMat.color.copy(WET).lerp(BISQUE, fire);
    clayMat.roughness = lerp(.5, 1.0, fire);
    clayMat.bumpScale = lerp(.9, 1.6, fire);
    U.uGlow.value = glow;
    U.uGlaze.value = glaze;
    U.uDip.value = lerp(H * 1.05, H * .3, glaze);  // el esmalte baja desde la boca (pieza sumergida boca abajo)
    U.uStamp.value = stamp;
    U.uStampS.value = 1;
    U.uTop.value = H;
    U.uStampY.value = H * .5;

    // giro del torno; al final la pieza se detiene con el sello de frente
    let rot = spin;
    if (g > 0) { if (lock === null) lock = Math.ceil(spin / TAU + .2) * TAU; rot = lerp(spin, lock, smooth(clamp(g / .62))); }
    else lock = null;
    clay.rotation.y = rot;
    { const r0 = rMaxBase * 2 * 1.25; ao.scale.set(r0, r0, 1); }
    head.rotation.y = spin; slip.rotation.y = spin;
    { const b = Math.max(.02, rMaxBase * .99); slip.scale.set(b, 1 + smooth(clamp(s - .6)) * .3, b); }

    wheel.visible = wa > .001;
    wheel.position.y = -(1 - wa) * .08;
    setFade(fade, wa);
    shelf.visible = g > .001;
    shelf.position.y = -(1 - g) * .04;
    woodMat.opacity = brMat.opacity = g; woodMat.depthWrite = brMat.depthWrite = g > .5;

    // la luz sigue al cursor
    key.position.set(lx * 1.5 + .2, 1.55, 1.25);
    renderer.render(scene, camera);
  }

  window.__piece3d = { render };
  stage.classList.add('is-3d');
}
