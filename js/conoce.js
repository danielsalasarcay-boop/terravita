/* ==========================================================================
   TERRAVITA · Conoce más · "El sello"
   Video real del taller convertido en animación con el scroll (técnica de Apple / Lando Norris):
   el video se exporta como secuencia de cuadros (img/sello/d/000-129.webp) y el scroll elige el cuadro.
   1. Ventana con el video en bucle y el título a los lados
   2. La ventana se abre a pantalla completa y el scroll mueve el video cuadro a cuadro
   3. La mano estampa el sello (pequeño golpe de cámara)
   4. La cámara entra en la marca, el barro se desenfoca y la marca se convierte en el logo
   5. Cierre: "Nuestro sello. Tu pieza." con los botones
   ========================================================================== */
(() => {
  const sec = document.querySelector('.sello');
  if (!sec || !window.gsap) return;
  const $ = s => sec.querySelector(s), $$ = s => [...sec.querySelectorAll(s)];
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = t => t * t * (3 - 2 * t);
  const io = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; // ease in-out
  const out = t => 1 - Math.pow(1 - t, 3);
  const win = (p, a, b, f = .03) => Math.min(clamp((p - a) / f), clamp((b - p) / f)); // ventana de visibilidad

  // ---- datos del video ----
  const N = 130, IW = 886, IH = 1094, STAMP = 83;       // el sello toca el barro en el cuadro 83
  const MARK = { x: 654, y: 516, w: 74 };               // centro y ancho de la marca en el cuadro
  const conn = navigator.connection || {};
  const dir = (conn.saveData || /2g|3g/.test(conn.effectiveType || '')) ? 'img/sello/m/' : 'img/sello/d/';

  // ---- carga progresiva: primero 1 de cada 16 cuadros, luego se va rellenando ----
  const imgs = new Array(N), ok = new Uint8Array(N);
  const order = [], seen = new Set();
  [16, 8, 4, 2, 1].forEach(st => { for (let i = 0; i < N; i += st) if (!seen.has(i)) { seen.add(i); order.push(i); } });
  if (!seen.has(N - 1)) order.splice(1, 0, N - 1);
  let qi = 0;
  const pump = () => {
    if (qi >= order.length) return;
    const i = order[qi++], im = new Image();
    im.decoding = 'async';
    im.onload = () => { ok[i] = 1; imgs[i] = im; pump(); };
    im.onerror = pump;
    im.src = dir + String(i).padStart(3, '0') + '.webp';
  };
  for (let k = 0; k < 6; k++) pump();
  const near = i => { if (ok[i]) return imgs[i]; for (let d = 1; d < N; d++) { if (ok[i - d]) return imgs[i - d]; if (ok[i + d]) return imgs[i + d]; } return null; };

  // ---- elementos ----
  const stage = $('.sello__stage'), cv = $('.sello__cv'), ctx = cv.getContext('2d');
  const frameEl = $('.sello__frame'), shade = $('.sello__shade'), clay = $('.sello__clay');
  const halfL = $('.sello__half--l'), halfR = $('.sello__half--r'), cue = $('.sello__cue');
  const caps = $$('.sello__cap'), logo = $('.sello__logo'), logoIn = $('.sello__logo-in');
  const end = $('.sello__end'), endLines = $$('.sello__end-t .sello__ln > span'), endP = $('.sello__end-p'), endCta = $('.sello__end-cta');
  const bar = $('.sello__bar i');
  const phone = matchMedia('(max-width: 899px)');
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;

  let W = 0, H = 0, dpr = 1, R = { l: 0, t: 0, w: 1, h: 1 };
  const size = () => {
    const r = stage.getBoundingClientRect();
    W = r.width; H = r.height; dpr = Math.min(2, devicePixelRatio || 1);
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    const f = frameEl.getBoundingClientRect();
    R = { l: f.left - r.left, t: f.top - r.top, w: f.width, h: f.height };
  };
  size();
  addEventListener('resize', size);

  // ---- progreso del scroll ----
  let target = 0, p = 0, time = 0, live = false;
  ScrollTrigger.create({
    trigger: sec, start: 'top top', end: 'bottom bottom',
    onUpdate: s => { target = s.progress; }, onRefresh: s => { target = s.progress; size(); },
  });
  ScrollTrigger.create({ trigger: sec, start: 'top bottom', end: 'bottom top', onToggle: s => { live = s.isActive; } });

  // inclinación 3D del logo con el cursor
  let mx = 0, my = 0, tx = 0, ty = 0;
  if (fine) addEventListener('pointermove', e => { mx = (e.clientX / innerWidth) * 2 - 1; my = (e.clientY / innerHeight) * 2 - 1; });

  // entrada del título al cargar
  gsap.from($$('.sello__half .sello__ln > span'), { yPercent: 110, duration: 1.4, ease: 'expo.out', stagger: .08, delay: .15 });
  gsap.from($$('.sello__half small, .sello__cue'), { opacity: 0, y: 14, duration: 1.2, ease: 'expo.out', delay: .5 });

  let lastFilter = '', lastClip = '';
  function tick(dms) {
    if (!live || !W) return;
    const dt = Math.min(dms, 50) / 1000;
    time += dt;
    p = lerp(p, target, phone.matches ? .16 : .1);
    if (Math.abs(p - target) < 1e-5) p = target;

    // 1-2 · la ventana se abre
    const E = io(clamp((p - .02) / .16));
    // cuadro del video: en bucle mientras no hay scroll, luego lo controla el scroll
    const scrub = clamp((p - .06) / .52) * (N - 1);
    const auto = (time * 24) % (N - 1);
    const a = smooth(clamp((p - .004) / .05));
    const F = a >= 1 ? scrub : lerp(auto, scrub, a);
    const img = near(Math.round(F));

    // 4 · entrar en la marca
    const zt = clamp((p - .56) / .18), zE = io(zt);
    const bump = Math.exp(-Math.pow((F - STAMP - 1.5) / 3.2, 2)) * a;  // golpe del sello
    const Z = (1 + 2.4 * zE) * (1 + .022 * bump);
    const cover = Math.max(W / IW, H / IH), cardFit = R.w / IW;
    const c = lerp(cardFit, cover, E);
    const cx = lerp(R.l + R.w / 2, W / 2, E), cy = lerp(R.t + R.h / 2, H / 2, E);
    const m0x = cx + (MARK.x - IW / 2) * c, m0y = cy + (MARK.y - IH / 2) * c;   // la marca sin zoom
    const endY = H * (phone.matches ? .3 : .33);
    const mTx = lerp(m0x, W / 2, zE), mTy = lerp(m0y, endY, zE);              // la marca viaja al centro

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#2B1A11'; ctx.fillRect(0, 0, W, H);
    if (img) {
      ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, mTx - MARK.x * c * Z, mTy - MARK.y * c * Z, IW * c * Z, IH * c * Z);
    }
    // recorte de la ventana (redondeada) que se abre a pantalla completa
    const k = 1 - E;
    const clip = `inset(${(R.t * k).toFixed(1)}px ${((W - R.l - R.w) * k).toFixed(1)}px ${((H - R.t - R.h) * k).toFixed(1)}px ${(R.l * k).toFixed(1)}px round ${(26 * k).toFixed(1)}px)`;
    if (clip !== lastClip) { cv.style.clipPath = cv.style.webkitClipPath = clip; lastClip = clip; }
    const blur = 14 * smooth(clamp((zt - .45) / .55));
    const filt = blur > .05 ? `blur(${blur.toFixed(1)}px) brightness(${(1 - .2 * zE).toFixed(3)})` : 'none';
    if (filt !== lastFilter) { cv.style.filter = filt; lastFilter = filt; }

    // título a los lados: se abre como una cortina
    const tO = clamp(1 - E * 1.6);
    halfL.style.opacity = halfR.style.opacity = tO;
    if (phone.matches) {
      halfL.style.transform = `translate(-50%, ${-E * 40}vh)`; halfR.style.transform = `translate(-50%, ${E * 40}vh)`;
    } else {
      halfL.style.transform = `translate(${-E * 30}vw, -50%)`; halfR.style.transform = `translate(${E * 30}vw, -50%)`;
    }
    cue.style.opacity = clamp(1 - p * 25) * .8;
    shade.style.opacity = E * (1 - zE);

    // 3 · las frases
    const cw = [[.17, .29], [.3, .385], [.395, .56]];
    caps.forEach((el, i) => {
      const v = win(p, cw[i][0], cw[i][1], .025);
      el.style.opacity = v; el.style.transform = `translateY(${(1 - v) * 24}px)`;
    });

    // la marca se convierte en el logo
    const lt = io(clamp((p - .66) / .16));
    const lo = smooth(clamp((p - .635) / .06));
    const clayO = smooth(clamp((p - .68) / .12));
    clay.style.opacity = clayO;
    const sizeA = MARK.w * c * Z, sizeF = Math.min(W * (phone.matches ? .34 : .17), H * .25);
    const ls = lerp(sizeA, sizeF, lt);
    const lx = lerp(mTx, W / 2, lt), ly = lerp(mTy, endY, lt) + Math.sin(time * 1.3) * 4 * lt;
    const rot = lerp(-14, 0, lt);
    logo.style.opacity = lo;
    logo.style.width = ls.toFixed(1) + 'px';
    logo.style.transform = `translate(${(lx - ls / 2).toFixed(1)}px, ${(ly - ls * 1736 / 1464 / 2).toFixed(1)}px) rotate(${rot.toFixed(2)}deg)`;
    tx = lerp(tx, mx, .06); ty = lerp(ty, my, .06);
    logoIn.style.transform = `rotateY(${(tx * 16 * lt).toFixed(2)}deg) rotateX(${(-ty * 12 * lt).toFixed(2)}deg)`;

    // 5 · cierre
    const eT = clamp((p - .83) / .1);
    endLines.forEach((s, i) => { const v = out(clamp(eT * 1.5 - i * .25)); s.style.transform = `translateY(${(1 - v) * 110}%)`; });
    endP.style.opacity = out(clamp((p - .89) / .06));
    endCta.style.opacity = out(clamp((p - .91) / .06));
    end.classList.toggle('is-on', p > .9);
    // en el teléfono los botones flotantes se apartan para no tapar el cierre
    document.querySelector('.float')?.classList.toggle('is-away', phone.matches && p > .8);

    bar.style.transform = `scaleX(${p.toFixed(4)})`;
  }
  // estado inicial del cierre
  endLines.forEach(s => { s.style.transform = 'translateY(110%)'; });
  gsap.ticker.add((t, dms) => tick(dms));
})();
