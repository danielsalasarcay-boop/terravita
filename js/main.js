/* ==========================================================================
   TERRAVITA · main.js
   GSAP + ScrollTrigger + Lenis. Todo lo que se mueve en el sitio vive aquí.
   ========================================================================== */
(() => {
  'use strict';

  // ------------------------------------------------------------------
  // Datos de contacto (un solo lugar para cambiarlos)
  // ------------------------------------------------------------------
  const SITE = {
    whatsapp: '584128270907',            // WhatsApp principal
    phone: '+584241192157',              // Llamadas
    instagram: 'https://www.instagram.com/taller_terravita/',
    tiktok: 'https://www.tiktok.com/@terra_vita', // CONFIRMAR usuario de TikTok
  };

  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;

  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;

  // Enlaces de WhatsApp con mensaje prellenado
  $$('[data-wa]').forEach(a => {
    a.href = `https://wa.me/${SITE.whatsapp}?text=${encodeURIComponent(a.dataset.wa)}`;
  });
  $$('.js-tiktok').forEach(a => { a.href = SITE.tiktok; });

  // Productos de Terrashop: toda la tarjeta consulta por WhatsApp
  $$('.product').forEach(p => {
    const a = document.createElement('a');
    a.className = 'product__link';
    a.target = '_blank'; a.rel = 'noopener';
    a.href = `https://wa.me/${SITE.whatsapp}?text=${encodeURIComponent(`¡Hola Terravita! Me interesan las piezas de Terrashop: ${p.dataset.name}.`)}`;
    a.setAttribute('aria-label', `Consultar ${p.dataset.name} por WhatsApp`);
    p.appendChild(a);
  });

  const year = $('#year'); if (year) year.textContent = new Date().getFullYear();

  // Sin librerías (CDN caído): mostrar el sitio tal cual
  if (!window.gsap || !window.ScrollTrigger) {
    document.body.classList.remove('is-loading');
    $('#loader')?.remove();
    $('.fab')?.classList.add('is-in');
    return;
  }
  gsap.registerPlugin(ScrollTrigger);

  // ------------------------------------------------------------------
  // Scroll suave
  // ------------------------------------------------------------------
  let lenis = null;
  if (window.Lenis && !reduce) {
    lenis = new Lenis({ lerp: 0.1, wheelMultiplier: 1 });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(t => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
    lenis.stop();
  }
  const velocity = () => (lenis ? lenis.velocity : 0);

  // Anclas
  $$('a[href^="#"]').forEach(a => a.addEventListener('click', e => {
    const id = a.getAttribute('href');
    const target = id === '#inicio' ? 0 : $(id);
    if (target === null) return;
    e.preventDefault();
    closeMenu();
    if (lenis) lenis.scrollTo(target, { duration: 1.6, easing: t => 1 - Math.pow(1 - t, 4) });
    else if (target === 0) scrollTo({ top: 0, behavior: 'smooth' });
    else target.scrollIntoView({ behavior: 'smooth' });
  }));

  // ------------------------------------------------------------------
  // Partir textos en letras (arcilla) y palabras (manifiesto)
  // ------------------------------------------------------------------
  function splitChars(el) {
    const chars = [];
    const walk = node => {
      [...node.childNodes].forEach(n => {
        if (n.nodeType === 3) {
          const frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach(part => {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
            const w = document.createElement('span');
            w.className = 'wd-wrap';
            [...part].forEach(c => {
              const s = document.createElement('span');
              s.className = 'ch';
              if (n.parentElement.closest('em')) s.classList.add('is-em');
              s.textContent = c;
              w.appendChild(s); chars.push(s);
            });
            frag.appendChild(w);
          });
          n.replaceWith(frag);
        } else if (n.nodeType === 1) walk(n);
      });
    };
    walk(el);
    el.setAttribute('aria-label', el.getAttribute('aria-label') || el.textContent.replace(/\s+/g, ' ').trim());
    return chars;
  }
  function splitWords(el) {
    const words = el.textContent.trim().split(/\s+/);
    el.innerHTML = words.map(w => `<span class="wd">${w}</span>`).join(' ');
    return $$('.wd', el);
  }

  // ------------------------------------------------------------------
  // Letras de arcilla: se hinchan y se ablandan donde las "presionas"
  // (eje SOFT + peso de Fraunces). En pantallas táctiles, una ola lenta.
  // ------------------------------------------------------------------
  const clayGroups = $$('.clay').map(el => {
    const chars = splitChars(el);
    const st = chars.map(ch => ({ ch, em: ch.classList.contains('is-em'), t: 0, target: 0, cx: 0, cy: 0 }));
    return { el, st, visible: false, wave: -1 };
  });
  const io = new IntersectionObserver(es => es.forEach(e => {
    const g = clayGroups.find(g => g.el === e.target);
    if (g) g.visible = e.isIntersecting;
  }));
  clayGroups.forEach(g => io.observe(g.el));

  const pointer = { x: -9999, y: -9999, active: false };
  if (fine) {
    addEventListener('pointermove', e => { pointer.x = e.clientX; pointer.y = e.clientY; pointer.active = true; }, { passive: true });
    document.addEventListener('pointerleave', () => { pointer.active = false; });
  }

  let clock = 0;
  function clayTick(dt) {
    if (reduce) return;
    clock += dt;
    const R = Math.max(140, innerWidth * 0.11);
    for (const g of clayGroups) {
      if (!g.visible) continue;
      const n = g.st.length;
      for (let i = 0; i < n; i++) {
        const s = g.st[i];
        let target = 0;
        if (pointer.active) {
          const r = s.ch.getBoundingClientRect();
          const d = Math.hypot(pointer.x - (r.left + r.width / 2), pointer.y - (r.top + r.height / 2));
          target = Math.pow(clamp(1 - d / R), 2);
        } else if (!fine && g.el.classList.contains('hero__title')) {
          // Ola lenta en el teléfono: el barro "respira"
          const ph = (clock * 0.35) % 1.6 - 0.3;
          target = Math.pow(clamp(1 - Math.abs(ph - i / n) * 6), 2) * 0.8;
        }
        // Ola de entrada (cuando el título aparece)
        if (g.wave >= 0) target = Math.max(target, Math.pow(clamp(1 - Math.abs(g.wave - i / n) * 5), 2));
        s.t = lerp(s.t, target, 0.14);
        if (Math.abs(s.t - (s.last || 0)) < 0.004) continue;
        s.last = s.t;
        const base = s.em ? 100 : 30;
        s.ch.style.setProperty('--s', (base + (100 - base) * s.t).toFixed(1));
        s.ch.style.setProperty('--w', (400 + 230 * s.t).toFixed(0));
        s.ch.style.setProperty('--k', s.em || s.t > 0.45 ? 1 : 0);
      }
    }
  }

  // ------------------------------------------------------------------
  // Hero: geometría del torno y zoom al manifiesto
  // ------------------------------------------------------------------
  const hero = $('#hero');
  const stage = $('.hero__stage');
  const wheel = $('#wheel');
  const reveal = $('#reveal');
  const media = $('#revealMedia');
  const shade = $('.hero__shade');
  const copy = $('.hero__copy');
  const ring = $('.wheel__ring');
  const manifesto = $('.manifesto');
  const scrollCue = $('.hero__scroll');
  const words = splitWords($('.js-words'));
  const geo = { cx: 0, cy: 0, r0: 0, rMax: 0 };
  let intro = 0;      // 0→1 al terminar la carga: el círculo se abre
  let zoom = 0;       // progreso del zoom (para el header)

  function measureHero() {
    const s = stage.getBoundingClientRect();
    const w = wheel.getBoundingClientRect();
    geo.cx = w.left - s.left + w.width / 2;
    geo.cy = w.top - s.top + w.height / 2;
    geo.r0 = w.width / 2;
    geo.rMax = Math.max(
      Math.hypot(geo.cx, geo.cy), Math.hypot(s.width - geo.cx, geo.cy),
      Math.hypot(geo.cx, s.height - geo.cy), Math.hypot(s.width - geo.cx, s.height - geo.cy)
    ) + 2;
    reveal.style.setProperty('--cx', geo.cx + 'px');
    reveal.style.setProperty('--cy', geo.cy + 'px');
  }

  const heroST = ScrollTrigger.create({
    trigger: hero, start: 'top top', end: 'bottom bottom', scrub: true,
    onRefresh: self => { measureHero(); renderHero(self.progress); },
    onUpdate: self => renderHero(self.progress),
  });

  function renderHero(p) {
    const z = clamp(p / 0.36);
    const ez = z < .5 ? 4 * z * z * z : 1 - Math.pow(-2 * z + 2, 3) / 2; // easeInOutCubic
    zoom = ez;
    const r = lerp(geo.r0 * intro, geo.rMax, ez);
    reveal.style.setProperty('--r', r.toFixed(1) + 'px');
    gsap.set(media, { scale: 1.18 - 0.18 * ez });
    gsap.set(copy, { autoAlpha: clamp(1 - ez * 1.8), y: -ez * 90, x: -ez * 40 });
    gsap.set(ring, { autoAlpha: clamp(1 - ez * 2.5) * intro, scale: 1 + ez * 0.35 });
    shade.style.opacity = clamp((ez - 0.4) / 0.6);
    reveal.style.setProperty('--tag', clamp(1 - ez * 3));
    if (scrollCue) scrollCue.style.opacity = clamp(1 - p * 12) * intro;

    // Manifiesto: palabra por palabra
    const show = p > 0.34;
    manifesto.style.visibility = show ? 'visible' : 'hidden';
    if (show) {
      const wp = clamp((p - 0.38) / 0.5);
      const n = words.length;
      words.forEach((w, i) => { w.style.opacity = (0.14 + 0.86 * clamp(wp * n * 1.1 - i)).toFixed(3); });
      $('.eyebrow', manifesto).style.opacity = clamp((p - 0.34) / 0.06);
    }
  }

  // ------------------------------------------------------------------
  // Torno: el anillo gira y se acelera con la velocidad del scroll
  // ------------------------------------------------------------------
  let spin = 0, spinBoost = 0;
  // Ajusta el espaciado para que el texto cierre el círculo exacto
  const fitRing = () => [[ring, 92], [$('.encargos__badge > svg'), 74]].forEach(([svg, r]) => {
    const tp = $('textPath', svg);
    tp.setAttribute('textLength', (2 * Math.PI * r - 1).toFixed(1));
    tp.setAttribute('lengthAdjust', 'spacing');
  });
  (document.fonts ? document.fonts.ready : Promise.resolve()).then(fitRing);
  function wheelTick(dt) {
    if (reduce) return;
    spinBoost = lerp(spinBoost, Math.abs(velocity()) * 6, 0.08);
    spin += dt * (14 + spinBoost);
    ring.style.rotate = spin.toFixed(2) + 'deg';
  }

  // ------------------------------------------------------------------
  // Header: se esconde al bajar, aparece al subir, cambia de color
  // ------------------------------------------------------------------
  const header = $('#header');
  const lightZones = $$('.eventos, .footer');
  let lastY = 0;
  function headerTick() {
    const y = scrollY;
    header.classList.toggle('is-scrolled', y > 40);
    if (!document.documentElement.classList.contains('menu-open')) {
      header.classList.toggle('is-hidden', y > lastY + 2 && y > 240);
      if (y < lastY - 2) header.classList.remove('is-hidden');
    }
    lastY = y;
    const probe = 34;
    let light = zoom > 0.55 && hero.getBoundingClientRect().bottom > probe;
    for (const z of lightZones) {
      const r = z.getBoundingClientRect();
      if (r.top < probe && r.bottom > probe) light = true;
    }
    header.classList.toggle('is-light', light);
  }

  // Menú del teléfono
  const burger = $('#burger');
  const menu = $('#menu');
  function closeMenu() {
    document.documentElement.classList.remove('menu-open');
    burger.setAttribute('aria-expanded', 'false');
    menu.setAttribute('aria-hidden', 'true');
    lenis?.start();
  }
  burger.addEventListener('click', () => {
    const open = !document.documentElement.classList.contains('menu-open');
    if (!open) return closeMenu();
    document.documentElement.classList.add('menu-open');
    burger.setAttribute('aria-expanded', 'true');
    menu.setAttribute('aria-hidden', 'false');
    lenis?.stop();
    gsap.fromTo($$('.menu__nav a'), { yPercent: 60, opacity: 0 }, { yPercent: 0, opacity: 1, stagger: 0.06, duration: 0.9, ease: 'expo.out', delay: 0.15 });
  });
  addEventListener('keydown', e => { if (e.key === 'Escape') closeMenu(); });

  // ------------------------------------------------------------------
  // Talleres: carril horizontal en escritorio
  // ------------------------------------------------------------------
  const mm = gsap.matchMedia();
  mm.add('(min-width: 900px) and (hover: hover)', () => {
    const section = $('#talleres');
    const inner = $('#hscroll');
    const bar = $('#railBar');
    const track = $('#track');
    let dist = 0;
    const size = () => {
      dist = Math.max(0, inner.scrollWidth - innerWidth);
      section.style.setProperty('--hs-h', `${dist + innerHeight}px`);
    };
    size();
    const st = ScrollTrigger.create({
      trigger: section, start: 'top top', end: 'bottom bottom', scrub: true,
      onRefreshInit: size,
      onUpdate: self => {
        gsap.set(inner, { x: -dist * self.progress });
        gsap.set(bar, { scaleX: self.progress });
      },
    });
    // Las tarjetas se inclinan con la velocidad, como barro blando
    const skew = gsap.quickTo(track, 'skewX', { duration: 0.6, ease: 'power3.out' });
    const tick = () => skew(clamp(-velocity() * 0.12, -6, 6));
    gsap.ticker.add(tick);
    return () => { st.kill(); gsap.ticker.remove(tick); gsap.set([inner, bar, track], { clearProps: 'all' }); section.style.removeProperty('--hs-h'); };
  });

  // ------------------------------------------------------------------
  // Cinta del proceso: corre sola y responde al scroll
  // ------------------------------------------------------------------
  const marquee = $('.js-marquee');
  const mItem = $('.ribbon__item', marquee);
  for (let i = 0; i < 3; i++) marquee.appendChild(mItem.cloneNode(true)).setAttribute('aria-hidden', 'true');
  let mx = 0, mDir = 1;
  function marqueeTick(dt) {
    if (reduce) return;
    const v = velocity();
    if (v > 0.5) mDir = 1; else if (v < -0.5) mDir = -1;
    mx -= dt * (70 + Math.abs(v) * 40) * mDir;
    const w = mItem.offsetWidth;
    if (w) { mx %= w; if (mx > 0) mx -= w; }
    marquee.style.transform = `translate3d(${mx.toFixed(1)}px,0,0)`;
  }

  // ------------------------------------------------------------------
  // Eventos: foto flotante que sigue el cursor
  // ------------------------------------------------------------------
  if (fine) {
    const float = $('.eventos__float');
    const tag = $('#floatTag');
    const fx = gsap.quickTo(float, 'x', { duration: 0.6, ease: 'power3.out' });
    const fy = gsap.quickTo(float, 'y', { duration: 0.6, ease: 'power3.out' });
    const fr = gsap.quickTo(float, 'rotation', { duration: 0.8, ease: 'power3.out' });
    let px = 0;
    gsap.set(float, { xPercent: -50, yPercent: -50 });
    $$('.event').forEach(ev => {
      ev.addEventListener('mouseenter', () => {
        tag.textContent = `Foto · ${ev.dataset.img}`;
        gsap.to(float, { autoAlpha: 1, scale: 1, duration: 0.5, ease: 'expo.out' });
      });
      ev.addEventListener('mouseleave', () => gsap.to(float, { autoAlpha: 0, scale: 0.6, duration: 0.4, ease: 'power3.in' }));
    });
    $('.events').addEventListener('mousemove', e => {
      fx(e.clientX); fy(e.clientY); fr(clamp((e.clientX - px) * 0.6, -14, 14)); px = e.clientX;
    });
  }

  // ------------------------------------------------------------------
  // Apariciones al hacer scroll
  // ------------------------------------------------------------------
  function scrollReveals() {
    // Títulos: las letras suben y pasa una ola de "barro"
    clayGroups.filter(g => !g.el.classList.contains('hero__title')).forEach(g => {
      const chars = g.st.map(s => s.ch);
      gsap.set(chars, { yPercent: 70, opacity: 0 });
      ScrollTrigger.create({
        trigger: g.el, start: 'top 85%', once: true,
        onEnter: () => {
          gsap.to(chars, { yPercent: 0, opacity: 1, duration: 1.1, ease: 'expo.out', stagger: 0.018 });
          const o = { v: -0.3 };
          gsap.to(o, { v: 1.3, duration: 1.8, ease: 'power1.inOut', delay: 0.1, onUpdate: () => { g.wave = o.v; }, onComplete: () => { g.wave = -1; } });
        },
      });
    });

    const groups = ['.lead', '.tag', '.steps li', '.product', '.chan', '.footer__col', '.shop__cta', '.encargos__copy > .btn', '.event'];
    if (!matchMedia('(min-width: 900px) and (hover: hover)').matches) groups.push('.card');
    const els = $$(groups.join(',')).filter(el => !el.closest('.hero'));
    gsap.set(els, { y: 40, opacity: 0 });
    ScrollTrigger.batch(els, {
      start: 'top 90%', once: true,
      onEnter: b => gsap.to(b, { y: 0, opacity: 1, duration: 1.1, ease: 'expo.out', stagger: 0.08, overwrite: true }),
    });

    // Foto de encargos con parallax y entrada en arco
    const encPh = $('.encargos__media > .ph');
    gsap.fromTo(encPh, { clipPath: 'inset(100% 0 0 0 round 240px 240px 22px 22px)' }, {
      clipPath: 'inset(0% 0 0 0 round 240px 240px 22px 22px)', duration: 1.6, ease: 'expo.inOut',
      scrollTrigger: { trigger: encPh, start: 'top 80%', once: true },
    });
    gsap.fromTo(encPh, { y: 60 }, { y: -60, ease: 'none', scrollTrigger: { trigger: '.encargos', start: 'top bottom', end: 'bottom top', scrub: true } });

    // Terrashop: la hoja crema sube sobre la página
    gsap.from('.shop', { borderRadius: '120px 120px 0 0', ease: 'none', scrollTrigger: { trigger: '.shop', start: 'top bottom', end: 'top 30%', scrub: true } });

    // Footer: el logo emerge del barro
    gsap.fromTo('.footer__mark', { yPercent: 45, rotation: -14 }, { yPercent: 0, rotation: 0, ease: 'none', scrollTrigger: { trigger: '.footer', start: 'top bottom', end: 'bottom bottom', scrub: true } });
    gsap.fromTo('.footer__word', { yPercent: 60 }, { yPercent: 0, ease: 'none', scrollTrigger: { trigger: '.footer', start: 'top bottom', end: 'bottom bottom', scrub: true } });
  }

  // ------------------------------------------------------------------
  // Pantalla de carga
  // ------------------------------------------------------------------
  const loader = $('#loader');
  const fill = $('.loader__fill');
  const countEl = $('#loaderCount');
  const lword = $('.loader__word');
  const prog = { v: 0 };
  const drawLoader = () => {
    const v = prog.v;
    countEl.textContent = Math.round(v);
    // El barro sube con una superficie ondulada
    fill.style.clipPath = `inset(${(100 - v).toFixed(2)}% 0 0 0)`;
    if (v > 30 && !lword.dataset.in) { lword.dataset.in = 1; gsap.to(lword, { opacity: 1, y: 0, duration: 1, ease: 'expo.out' }); }
  };
  const ready = Promise.all([
    new Promise(r => (document.readyState === 'complete' ? r() : addEventListener('load', r, { once: true }))),
    document.fonts ? document.fonts.ready : Promise.resolve(),
  ]);
  const minTime = new Promise(r => setTimeout(r, reduce ? 200 : 1700));
  const fallback = new Promise(r => setTimeout(r, 6000));

  gsap.to(prog, { v: 86, duration: reduce ? 0.2 : 1.7, ease: 'power2.inOut', onUpdate: drawLoader });
  Promise.race([Promise.all([ready, minTime]), fallback]).then(() => {
    gsap.to(prog, { v: 100, duration: reduce ? 0.1 : 0.45, ease: 'power2.out', onUpdate: drawLoader, onComplete: exitLoader });
  });

  function exitLoader() {
    ScrollTrigger.refresh();
    measureHero();
    const W = innerWidth, H = innerHeight;
    const R = Math.max(Math.hypot(geo.cx, geo.cy), Math.hypot(W - geo.cx, geo.cy), Math.hypot(geo.cx, H - geo.cy), Math.hypot(W - geo.cx, H - geo.cy)) + 4;
    loader.style.clipPath = `circle(${R}px at ${geo.cx}px ${geo.cy}px)`;

    const lines = $$('.hero__title .line__in');
    gsap.set(lines, { yPercent: 110 });
    gsap.set(['.hero__eyebrow', '.hero__actions'], { opacity: 0, y: 24 });

    const tl = gsap.timeline({ defaults: { ease: 'expo.inOut' } });
    tl.to('.loader__inner, .loader__foot', { opacity: 0, scale: 0.92, duration: 0.6, ease: 'power2.in' })
      // El horno se cierra hasta volverse el torno
      .to(loader, { clipPath: `circle(${geo.r0}px at ${geo.cx}px ${geo.cy}px)`, duration: 1.3 }, 0.25)
      .add(() => { intro = 1; renderHero(heroST.progress); }, 1.5)
      .to(loader, { opacity: 0, duration: 0.5, ease: 'power1.out' }, 1.5)
      .to(lines, { yPercent: 0, duration: 1.3, ease: 'expo.out', stagger: 0.1 }, 1.0)
      .to(['.hero__eyebrow', '.hero__actions'], { opacity: 1, y: 0, duration: 1.1, ease: 'expo.out', stagger: 0.12 }, 1.35)
      .fromTo(ring, { scale: 0.85 }, { scale: 1, duration: 1.4, ease: 'expo.out' }, 1.4)
      .add(() => {
        loader.remove();
        document.body.classList.remove('is-loading');
        lenis?.start();
        $('.fab').classList.add('is-in');
        // La ola de bienvenida en el título
        const g = clayGroups.find(g => g.el.classList.contains('hero__title'));
        const o = { v: -0.3 };
        gsap.to(o, { v: 1.3, duration: 2, ease: 'power1.inOut', onUpdate: () => { g.wave = o.v; }, onComplete: () => { g.wave = -1; } });
      }, 2.0);
  }

  // ------------------------------------------------------------------
  // Un solo reloj para todo lo continuo
  // ------------------------------------------------------------------
  gsap.ticker.add((t, dms) => {
    const dt = Math.min(dms, 50) / 1000;
    wheelTick(dt);
    marqueeTick(dt);
    clayTick(dt);
    headerTick();
  });

  measureHero();
  renderHero(0);
  scrollReveals();
  addEventListener('resize', () => { measureHero(); renderHero(heroST.progress); });
})();
