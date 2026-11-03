/* TERRAVITA · Conoce más · "El sello": entrada del título y de la ventana con el video */
(() => {
  const sec = document.querySelector('.sello');
  if (!sec || !window.gsap) return;
  const v = sec.querySelector('.sello__video');
  // Si el teléfono bloquea la reproducción automática (modo ahorro), se intenta al primer toque
  const play = () => v.play().catch(() => {});
  play(); addEventListener('touchstart', play, { once: true, passive: true });
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  gsap.from(v, { clipPath: 'inset(14% 14% 14% 14% round 26px)', opacity: 0, duration: 1.6, ease: 'expo.out', clearProps: 'clipPath' });
  gsap.from(sec.querySelectorAll('.sello__ln > span'), { yPercent: 110, duration: 1.4, ease: 'expo.out', stagger: .08, delay: .15 });
  gsap.from(sec.querySelectorAll('.sello__half small'), { opacity: 0, y: 14, duration: 1.2, ease: 'expo.out', delay: .5 });
})();
