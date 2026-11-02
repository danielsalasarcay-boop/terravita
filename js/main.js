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

  // Botones (como Caraqueña): el texto rueda hacia arriba y aparece una flecha
  $$('.btn > span:only-child').forEach(label => {
    const t = label.textContent;
    label.outerHTML = `<span class="btn__roll"><span>${t}</span><span aria-hidden="true">${t}</span></span><span class="btn__arrow" aria-hidden="true">→</span>`;
  });

  const year = $('#year'); if (year) year.textContent = new Date().getFullYear();

  // Sin librerías (CDN caído): mostrar el sitio tal cual
  if (!window.gsap || !window.ScrollTrigger) {
    document.body.classList.remove('is-loading');
    $('#loader')?.remove();
    $('.float')?.classList.add('is-in');
    return;
  }
  gsap.registerPlugin(ScrollTrigger);
  ScrollTrigger.config({ ignoreMobileResize: true }); // la barra de Safari al aparecer no reacomoda todo

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
  const HOME = !!hero; // la portada solo existe en index.html
  const words = HOME ? splitWords($('.js-words')) : [];
  const geo = { cx: 0, cy: 0, r0: 0, rMax: 0 };
  let intro = 0;      // 0→1 al terminar la carga: el círculo se abre
  let zoom = 0;       // progreso del zoom (para el header)

  function measureHero() {
    if (!HOME) return;
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

  const heroST = !HOME ? { progress: 0 } : ScrollTrigger.create({
    trigger: hero, start: 'top top', end: 'bottom bottom', scrub: true,
    onRefresh: self => { measureHero(); renderHero(self.progress); },
    onUpdate: self => renderHero(self.progress),
  });

  function renderHero(p) {
    if (!HOME) return;
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
  const fitRing = () => [[ring, 92]].forEach(([svg, r]) => {
    const tp = $('textPath', svg);
    tp.setAttribute('textLength', (2 * Math.PI * r - 1).toFixed(1));
    tp.setAttribute('lengthAdjust', 'spacing');
  });
  if (HOME) (document.fonts ? document.fonts.ready : Promise.resolve()).then(fitRing);
  function wheelTick(dt) {
    if (reduce || !HOME) return;
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
    lastY = y;
    const probe = 34;
    let light = HOME && zoom > 0.55 && hero.getBoundingClientRect().bottom > probe;
    for (const z of lightZones) {
      const r = z.getBoundingClientRect();
      if (r.top < probe && r.bottom > probe) light = true;
    }
    header.classList.toggle('is-light', light);
  }

  // Píldora del menú (como Casa Verde Jesko): sigue al cursor; sin cursor, marca la sección visible
  {
    const groups = $$('.header__nav');
    let active = $('.header__nav a[aria-current]'), hover = null;
    groups.forEach(g => { const p = document.createElement('span'); p.className = 'nav-pill'; p.setAttribute('aria-hidden', 'true'); g.prepend(p); });
    const place = () => {
      const a = hover || active;
      groups.forEach(g => {
        const p = $('.nav-pill', g);
        if (a && g.contains(a)) {
          const b = g.getBoundingClientRect(), r = a.getBoundingClientRect();
          p.style.transform = `translateX(${r.left - b.left}px)`; p.style.width = r.width + 'px'; p.style.opacity = 1;
        } else p.style.opacity = 0;
        $$('a', g).forEach(x => x.classList.toggle('bajo', x === a));
      });
    };
    groups.forEach(g => {
      $$('a', g).forEach(a => {
        a.addEventListener('mouseenter', () => { hover = a; place(); });
        a.addEventListener('mousemove', () => { if (hover !== a) { hover = a; place(); } });
        a.addEventListener('focus', () => { hover = a; place(); });
        a.addEventListener('blur', () => { hover = null; place(); });
      });
      g.addEventListener('mouseleave', () => { hover = null; place(); });
    });
    // Sección activa: la que cruza la franja central de la pantalla
    const links = $$('.header__nav a[href^="#"]');
    const secs = links.map(a => $(a.getAttribute('href')));
    if (secs.some(Boolean)) {
      const sio = new IntersectionObserver(es => {
        es.forEach(e => {
          const i = secs.indexOf(e.target);
          if (e.isIntersecting) active = links[i]; else if (active === links[i]) active = null;
        });
        links.forEach(a => a === active ? a.setAttribute('aria-current', 'true') : a.removeAttribute('aria-current'));
        place();
      }, { rootMargin: '-45% 0px -50% 0px' });
      secs.forEach(s => s && sio.observe(s));
    }
    addEventListener('scroll', () => { if (hover && !hover.matches(':hover')) { hover = null; place(); } }, { passive: true });
    addEventListener('resize', place);
    (document.fonts ? document.fonts.ready : Promise.resolve()).then(place);
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
    const section = $('#clases');
    if (!section) return;
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
  // Eventos: la foto de al lado cambia con cada fila (cursor o toque)
  // ------------------------------------------------------------------
  {
    const frame = $('.eventos__photo .ph');
    if (frame) {
    const base = $('img', frame);
    const next = $('.eventos__next', frame);
    let current = base.currentSrc || base.src;
    $$('.event').forEach(ev => { const i = new Image(); i.src = ev.dataset.src; }); // precarga
    const show = src => {
      if (!src || current.endsWith(src)) return;
      current = src;
      gsap.killTweensOf(next);
      next.src = src;
      gsap.fromTo(next, { opacity: 0, scale: 1.08 }, { opacity: 1, scale: 1, duration: 0.7, ease: 'expo.out', onComplete: () => {
        base.removeAttribute('srcset'); base.src = src; gsap.set(next, { opacity: 0 });
      } });
    };
    $$('.event').forEach(ev => {
      ev.addEventListener('mouseenter', () => show(ev.dataset.src));
      ev.addEventListener('focusin', () => show(ev.dataset.src));
    });
    // En el teléfono: cambia según la fila que está en el centro de la pantalla
    if (!fine) {
      const rowIO = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) show(e.target.dataset.src); }), { rootMargin: '-45% 0px -45% 0px' });
      $$('.event').forEach(ev => rowIO.observe(ev));
    }
    }
  }

  // ------------------------------------------------------------------
  // Apariciones al hacer scroll
  // ------------------------------------------------------------------
  // Páginas internas (Nosotros): el título sube, la foto se abre y las socias se encienden en el teléfono
  function pageIntro() {
    const lines = $$('.page-hero__title .line__in');
    if (!lines.length) return;
    gsap.from(lines, { yPercent: 110, duration: 1.3, ease: 'expo.out', stagger: 0.1, delay: 0.1 });
    gsap.from('.kicker', { yPercent: 30, opacity: 0, duration: 1.4, ease: 'expo.out' });
    gsap.from('.page-hero__side > *', { y: 30, opacity: 0, duration: 1.1, ease: 'expo.out', stagger: 0.1, delay: 0.35 });
    gsap.fromTo('.page-hero__frame', { clipPath: 'inset(18% 8% 0% 8% round 24px)' }, { clipPath: 'inset(0% 0% 0% 0% round 24px)', ease: 'none',
      scrollTrigger: { trigger: '.page-hero__photo', start: 'top 95%', end: 'top 25%', scrub: true } });
    gsap.fromTo('.page-hero__frame img', { scale: 1.15 }, { scale: 1, ease: 'none',
      scrollTrigger: { trigger: '.page-hero__photo', start: 'top bottom', end: 'bottom top', scrub: true } });
    const grid = $('.team__grid');
    if (grid && !fine) {
      const people = $$('.person', grid), dots = $$('.team__dots i');
      const hot = () => {
        const c = grid.getBoundingClientRect().left + grid.clientWidth / 2;
        let best = 0, bd = 1e9;
        people.forEach((p, i) => { const r = p.getBoundingClientRect(); const d = Math.abs(r.left + r.width / 2 - c); if (d < bd) { bd = d; best = i; } });
        people.forEach((p, i) => p.classList.toggle('is-hot', i === best));
        dots.forEach((d, i) => d.classList.toggle('is-on', i === best));
      };
      grid.addEventListener('scroll', hot, { passive: true }); hot();
    }
  }

  function onVisible(el, fn) {
    const o = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { o.disconnect(); fn(); } }, { rootMargin: '0px 0px -12% 0px' });
    o.observe(el);
  }

  function scrollReveals() {
    // Títulos: las letras suben y pasa una ola de "barro"
    clayGroups.filter(g => !g.el.classList.contains('hero__title')).forEach(g => {
      const chars = g.st.map(s => s.ch);
      gsap.set(chars, { yPercent: 70, opacity: 0 });
      onVisible(g.el, () => {
        gsap.to(chars, { yPercent: 0, opacity: 1, duration: 1.1, ease: 'expo.out', stagger: 0.018 });
        const o = { v: -0.3 };
        gsap.to(o, { v: 1.3, duration: 1.8, ease: 'power1.inOut', delay: 0.1, onUpdate: () => { g.wave = o.v; }, onComplete: () => { g.wave = -1; } });
      });
    });

    const groups = ['.lead', '.tag', '.product', '.contact__row', '.person', '.closing__photo', '.closing .lead', '.closing__actions', '.footer__contact', '.footer__nav', '.shop__cta', '.eventos__photo', '.eventos__cta', '.event'];
    if (!matchMedia('(min-width: 900px) and (hover: hover)').matches) groups.push('.card');
    const els = $$(groups.join(',')).filter(el => !el.closest('.hero'));
    gsap.set(els, { y: 40, opacity: 0 });
    // Aparecen en grupos cuando entran de verdad en pantalla (IntersectionObserver: no depende de posiciones calculadas)
    let queue = [], qTimer = 0;
    const revealIO = new IntersectionObserver(es => {
      es.forEach(e => { if (e.isIntersecting) { queue.push(e.target); revealIO.unobserve(e.target); } });
      clearTimeout(qTimer);
      qTimer = setTimeout(() => { if (!queue.length) return; gsap.to(queue, { y: 0, opacity: 1, duration: 1.1, ease: 'expo.out', stagger: 0.08, overwrite: true }); queue = []; }, 30);
    }, { rootMargin: '0px 0px -8% 0px' });
    els.forEach(el => revealIO.observe(el));

    // Catálogo: la hoja crema sube sobre la página
    if ($('.shop')) gsap.from('.shop', { borderRadius: '120px 120px 0 0', ease: 'none', scrollTrigger: { trigger: '.shop', start: 'top bottom', end: 'top 30%', scrub: true } });

    // Footer: la vasija gira hasta su sitio y la marca sube
    gsap.fromTo('.footer__mark', { rotation: -24, yPercent: 30 }, { rotation: 0, yPercent: 0, ease: 'none', scrollTrigger: { trigger: '.footer', start: 'top bottom', end: 'bottom bottom', scrub: true } });
    gsap.fromTo('.footer__lock, .footer__slogan', { yPercent: 30, opacity: 0 }, { yPercent: 0, opacity: 1, ease: 'none', stagger: 0.1, scrollTrigger: { trigger: '.footer', start: 'top bottom', end: 'bottom bottom', scrub: true } });
  }

  // ------------------------------------------------------------------
  // Pantalla de carga
  // ------------------------------------------------------------------
  const loader = $('#loader');
  // Páginas internas: sin pantalla de carga
  if (!loader) {
    document.body.classList.remove('is-loading');
    lenis?.start();
    $('.float')?.classList.add('is-in');
    pageIntro();
  }
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

  if (loader) gsap.to(prog, { v: 86, duration: reduce ? 0.2 : 1.7, ease: 'power2.inOut', onUpdate: drawLoader });
  if (loader) Promise.race([Promise.all([ready, minTime]), fallback]).then(() => {
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
        $('.float').classList.add('is-in');
        // La ola de bienvenida en el título
        const g = clayGroups.find(g => g.el.classList.contains('hero__title'));
        const o = { v: -0.3 };
        gsap.to(o, { v: 1.3, duration: 2, ease: 'power1.inOut', onUpdate: () => { g.wave = o.v; }, onComplete: () => { g.wave = -1; } });
      }, 2.0);
  }


  // ------------------------------------------------------------------
  // CONTACTO · Del barro a tu pieza
  // Una pieza dibujada en 3D (torno = sólido de revolución) que se transforma con el scroll:
  // puñado de barro → centrado → bowl → taza → jarrón → horno, esmalte "sumergido" y el sello de Terravita.
  // La luz sigue al cursor; al pasar por un botón de contacto, el torno se acelera.
  // ------------------------------------------------------------------
  const pieceEl = $('.piece');
  let pieceTick = () => {};
  if (pieceEl) {
    const cv = $('.piece__canvas', pieceEl), ctx = cv.getContext('2d');
    const caps = $$('.piece__cap', pieceEl), steps = $$('.piece__steps i', pieceEl);
    const K = 64;
    // Perfiles: [u (0 = base, 1 = boca), radio] — h = alto, o = qué tan abierta está la boca
    const P = [
      { h: .30, o: 0, pts: [[0, .20], [.15, .27], [.38, .30], [.62, .26], [.82, .17], [.94, .08], [1, 0]] },     // puñado de barro
      { h: .21, o: 0, pts: [[0, .35], [.5, .355], [.78, .345], [.92, .31], [1, .26]] },                         // centrado
      { h: .25, o: 1, pts: [[0, .15], [.1, .19], [.35, .27], [.65, .33], [.88, .365], [1, .375]] },               // bowl
      { h: .40, o: 1, pts: [[0, .17], [.06, .2], [.25, .215], [.55, .225], [.85, .22], [1, .225]] },              // taza
      { h: .62, o: 1, pts: [[0, .16], [.12, .23], [.32, .275], [.55, .21], [.75, .11], [.86, .085], [.95, .1], [1, .12]] }, // jarrón
    ];
    const sample = s => { const out = new Float32Array(K + 1);
      for (let k = 0; k <= K; k++) { const u = k / K; let i = 0; while (i < s.pts.length - 2 && u > s.pts[i + 1][0]) i++;
        const [u0, r0] = s.pts[i], [u1, r1] = s.pts[i + 1]; const t = clamp((u - u0) / (u1 - u0)); const e = (1 - Math.cos(t * Math.PI)) / 2;
        out[k] = r0 + (r1 - r0) * e; }
      return out; };
    P.forEach(s => { s.r = sample(s); });
    // Marcas del barro y motas del esmalte (ángulo, altura)
    const rnd = (a => () => (a = (a * 16807) % 2147483647) / 2147483647)(7);
    const marks = Array.from({ length: 60 }, () => ({ a: rnd() * Math.PI * 2, u: .05 + rnd() * .9, s: .6 + rnd() * 1.4, d: rnd() > .5 }));
    const specks = Array.from({ length: 230 }, () => ({ a: rnd() * Math.PI * 2, u: .3 + rnd() * .7, s: .35 + rnd() * .9 }));
    const markPaths = $$('#mark path').map(p => new Path2D(p.getAttribute('d')));
    const markT = $('#mark g')?.getAttribute('transform') || '';
    const RAW = [201, 144, 104], CLAY = [170, 82, 44], GLAZE = [244, 232, 208];
    const mix = (a, b, t) => [0, 1, 2].map(i => a[i] + (b[i] - a[i]) * t);
    const rgb = (c, k = 1, al = 1) => `rgba(${c[0] * k | 0},${c[1] * k | 0},${c[2] * k | 0},${al})`;
    let W = 0, dpr = 1, target = reduce ? 1 : 0, ps = target, spin = 0, boost = 0, lx = .3, lxT = .3, time = 0, lastCap = -1;
    const size = () => { dpr = Math.min(2, devicePixelRatio || 1); const r = cv.getBoundingClientRect(); W = Math.round(r.width * dpr); cv.width = cv.height = W; };
    size(); addEventListener('resize', size);
    const desk = matchMedia('(min-width: 900px)');
    const mk = () => desk.matches
      ? ScrollTrigger.create({ trigger: '#contacto', start: 'top top', end: 'bottom bottom', onUpdate: s => { target = s.progress; }, onRefresh: s => { target = s.progress; } })
      : ScrollTrigger.create({ trigger: pieceEl, start: 'top 90%', end: 'bottom 15%', onUpdate: s => { target = s.progress; }, onRefresh: s => { target = s.progress; } });
    let st = reduce ? null : mk();
    desk.addEventListener?.('change', () => { st?.kill(); st = reduce ? null : mk(); ScrollTrigger.refresh(); });
    if (fine) pieceEl.addEventListener('pointermove', e => { const r = cv.getBoundingClientRect(); lxT = clamp(((e.clientX - r.left) / r.width) * 2 - 1, -1, 1); });
    $$('.contact__row').forEach(row => { row.addEventListener('mouseenter', () => { boost = 1; }); row.addEventListener('mouseleave', () => { boost = 0; }); });

    pieceTick = dt => {
      const r0 = cv.getBoundingClientRect();
      if (r0.bottom < -100 || r0.top > innerHeight + 100 || !W) return;
      time += dt;
      ps = lerp(ps, target, .08);
      lx = lerp(lx, lxT, .06);
      // etapa: 0..5 (la 5 es horno/esmalte/sello sobre el jarrón)
      const s = clamp(ps * 1.06, 0, 1) * 5;
      const i0 = Math.min(4, Math.floor(s)), i1 = Math.min(4, i0 + 1);
      const f0 = s - Math.floor(s);
      const f = i0 === i1 ? 0 : (t => t * t * (3 - 2 * t))(clamp((f0 - .12) / .76));
      const A = P[i0], B = P[i1];
      const g = clamp(s - 4.05);            // horno + esmalte
      const stamp = clamp((s - 4.55) / .3); // sello
      const wheelA = 1 - clamp((s - 4) / .6);
      const speed = (2.6 + boost * 6) * (1 - g * .985);
      spin += dt * speed;
      const cap = Math.min(5, Math.round(s - .2));
      if (cap !== lastCap) { lastCap = cap; caps.forEach((c, k) => c.classList.toggle('is-on', k === cap)); steps.forEach((d, k) => d.classList.toggle('is-on', k <= cap)); }

      const w = W, cx = w / 2, base = w * .74, h = lerp(A.h, B.h, f) * w * .95, o = lerp(A.o, B.o, f);
      const R = k => lerp(A.r[k], B.r[k], f) * w * .92;
      const rAt = u => { const x = clamp(u) * K, k = Math.floor(x), t = x - k; return k >= K ? R(K) : R(k) * (1 - t) + R(k + 1) * t; };
      ctx.clearRect(0, 0, w, w);
      ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      const bodyCol = mix(RAW, CLAY, g * 0), top = mix(RAW, GLAZE, g);
      // --- torno ilustrado (base, bandeja y plato) ---
      const wa = wheelA;
      if (wa > 0) {
        ctx.save(); ctx.globalAlpha = wa; ctx.translate(0, (1 - wa) * w * .08);
        // cuerpo del torno
        ctx.fillStyle = '#C9A57A'; ctx.beginPath();
        ctx.moveTo(cx - w * .36, base + w * .05); ctx.lineTo(cx + w * .36, base + w * .05);
        ctx.quadraticCurveTo(cx + w * .38, base + w * .24, cx + w * .3, base + w * .25); ctx.lineTo(cx - w * .3, base + w * .25);
        ctx.quadraticCurveTo(cx - w * .38, base + w * .24, cx - w * .36, base + w * .05); ctx.fill();
        ctx.fillStyle = '#B48D62'; ctx.fillRect(cx - w * .36, base + w * .05, w * .72, w * .03);
        ctx.fillStyle = 'rgba(255,240,215,.25)'; ctx.fillRect(cx - w * .3, base + w * .1, w * .04, w * .12);
        ctx.fillStyle = '#C47A4E'; ctx.beginPath(); ctx.arc(cx + w * .22, base + w * .16, w * .026, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#9E5530'; ctx.beginPath(); ctx.arc(cx + w * .22, base + w * .16, w * .012, 0, Math.PI * 2); ctx.fill();
        // bandeja terracota
        ctx.fillStyle = '#A9502A'; ctx.beginPath(); ctx.ellipse(cx, base + w * .035, w * .41, w * .085, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#C4673B'; ctx.beginPath(); ctx.ellipse(cx, base + w * .02, w * .41, w * .08, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#8F4421'; ctx.beginPath(); ctx.ellipse(cx, base + w * .024, w * .36, w * .062, 0, 0, Math.PI * 2); ctx.fill();
        // plato del torno (gira: marcas)
        ctx.fillStyle = '#8D8A86'; ctx.beginPath(); ctx.ellipse(cx, base + w * .012, w * .3, w * .05, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#B5B1AB'; ctx.beginPath(); ctx.ellipse(cx, base, w * .3, w * .05, 0, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = w * .004;
        for (let k = 0; k < 3; k++) { const a = spin * 1.6 + k * 2.1; if (Math.cos(a) > 0) { ctx.beginPath(); ctx.ellipse(cx, base, w * .3, w * .05, 0, a - .35 - Math.PI / 2, a + .35 - Math.PI / 2); ctx.stroke(); } }
        ctx.restore();
      }
      // sombra al final (la pieza ya en la mesa)
      if (g > 0) { ctx.fillStyle = `rgba(80,45,25,${.16 * g})`; ctx.beginPath(); ctx.ellipse(cx, base + w * .006, R(0) * 1.25, R(0) * .2, 0, 0, Math.PI * 2); ctx.fill(); }
      // --- cuerpo de la pieza: silueta limpia con sombreado plano ---
      const N = 48, side = (sx, k0 = 1) => { const pts = []; for (let k = 0; k <= N; k++) { const u = k / N; pts.push([cx + sx * rAt(u) * k0, base - u * h]); } return pts; };
      const shape = (left, right) => { ctx.beginPath(); ctx.moveTo(left[0][0], left[0][1]); left.forEach(p => ctx.lineTo(p[0], p[1])); for (let k = right.length - 1; k >= 0; k--) ctx.lineTo(right[k][0], right[k][1]); ctx.closePath(); };
      const L = side(-1), Rr = side(1);
      // base color (con el baño de esmalte al final)
      ctx.save(); shape(L, Rr); ctx.clip();
      ctx.fillStyle = rgb(mix(RAW, CLAY, g)); ctx.fillRect(0, 0, w, w);
      if (g > 0) { // esmalte crema "sumergido": arriba de una línea ondulada
        ctx.fillStyle = rgb(GLAZE, 1, g); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(w, 0);
        for (let x = w; x >= 0; x -= w / 40) ctx.lineTo(x, base - h * .3 + Math.sin(x / w * 14 + 1) * w * .008 + Math.sin(x / w * 5) * w * .006);
        ctx.closePath(); ctx.fill();
      }
      // sombra plana izquierda y luz derecha (siguen al cursor)
      const shW = .3 - lx * .12, liP = .35 + lx * .25;
      ctx.fillStyle = 'rgba(60,30,15,.2)'; shape(L, side(-1, 1 - shW * 2)); ctx.fill();
      ctx.fillStyle = 'rgba(255,248,235,.28)'; shape(side(1, liP), side(1, liP + .14)); ctx.fill();
      // anillos del torneado (arcos al frente)
      if (g < 1) {
        ctx.strokeStyle = `rgba(90,50,28,${.18 * (1 - g)})`; ctx.lineWidth = w * .0025;
        const ring = (u) => { const r = rAt(u), y = base - u * h; ctx.beginPath(); ctx.ellipse(cx, y, r, r * .12, 0, .1, Math.PI - .1); ctx.stroke(); };
        const off = (time * .35) % (1 / 7);
        for (let u = off + .06; u < .97; u += 1 / 7) ring(u);
      }
      // marcas de dedos que giran (se ve la rotación)
      if (g < .9) marks.forEach(m => { const a = m.a + spin, z = Math.cos(a); if (z < .2) return; const r = rAt(m.u);
        ctx.fillStyle = m.d ? `rgba(90,50,28,${.25 * z * (1 - g)})` : `rgba(255,245,230,${.3 * z * (1 - g)})`;
        ctx.beginPath(); ctx.ellipse(cx + Math.sin(a) * r * .97, base - m.u * h, w * .006 * m.s * z, w * .0018 * m.s, 0, 0, Math.PI * 2); ctx.fill(); });
      // motas del esmalte
      if (g > 0) specks.forEach(m => { const a = m.a + spin, z = Math.cos(a); if (z < .05) return; const r = rAt(m.u);
        ctx.fillStyle = `rgba(74,40,22,${.8 * z * g})`; ctx.beginPath(); ctx.arc(cx + Math.sin(a) * r, base - m.u * h, w * .0028 * m.s * (.5 + z * .5), 0, Math.PI * 2); ctx.fill(); });
      ctx.restore();
      // contorno suave inferior (apoyo)
      // --- boca ---
      const rt = R(K), ty = base - h;
      if (rt > 1) {
        ctx.fillStyle = rgb(top, 1.06); ctx.beginPath(); ctx.ellipse(cx, ty, rt, rt * .24, 0, 0, Math.PI * 2); ctx.fill();
        if (o > .02) { ctx.fillStyle = rgb(mix(RAW, CLAY, g), .62, o); ctx.beginPath(); ctx.ellipse(cx, ty + rt * .01, rt * .84 * o, rt * .19 * o + .5, 0, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = rgb(mix(RAW, CLAY, g), .48, o); ctx.beginPath(); ctx.ellipse(cx, ty + rt * .05, rt * .7 * o, rt * .12 * o + .5, 0, Math.PI, Math.PI * 2); ctx.fill(); }
      }
      // --- el sello de Terravita, estampado al final ---
      if (stamp > 0 && markPaths.length) {
        const sc = w * .085 / 1464 * (1 + (1 - stamp) * .9), u0 = .5;
        const sx = cx - 732 * sc, sy = base - u0 * h - 868 * sc;
        const m = markT.match(/translate\(([-\d.]+)[ ,]+([-\d.]+)\)\s*scale\(([-\d.]+)[ ,]+([-\d.]+)\)/);
        const draw = (dx, dy, color) => { ctx.save(); ctx.translate(sx + dx, sy + dy); ctx.scale(sc, sc);
          if (m) { ctx.translate(+m[1], +m[2]); ctx.scale(+m[3], +m[4]); }
          ctx.fillStyle = color; markPaths.forEach(pp => ctx.fill(pp)); ctx.restore(); };
        ctx.globalAlpha = stamp; draw(dpr * 1.5, dpr * 1.5, 'rgba(255,248,235,.8)'); draw(0, 0, rgb(CLAY, .92)); ctx.globalAlpha = 1;
      }
    };
  }

  // ------------------------------------------------------------------
  // Un solo reloj para todo lo continuo
  // ------------------------------------------------------------------
  gsap.ticker.add((t, dms) => {
    const dt = Math.min(dms, 50) / 1000;
    wheelTick(dt);
    clayTick(dt);
    pieceTick(dt);
    headerTick();
  });

  measureHero();
  renderHero(0);
  scrollReveals();
  addEventListener('resize', () => { measureHero(); renderHero(heroST.progress); });
  // Si el alto de la página cambia (fuentes, giro del teléfono, fotos que cargan), se recalculan las posiciones
  let lastH = 0, rT = 0;
  new ResizeObserver(() => {
    const h = document.body.scrollHeight;
    if (Math.abs(h - lastH) < 2) return;
    lastH = h; clearTimeout(rT); rT = setTimeout(() => ScrollTrigger.refresh(), 150);
  }).observe(document.body);
  addEventListener('orientationchange', () => setTimeout(() => ScrollTrigger.refresh(), 350));
})();
