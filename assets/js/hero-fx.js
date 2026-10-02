/* Marigold petals drifting down and golden sparks rising over the dusk hero. */
(() => {
  'use strict';
  const canvas = document.getElementById('hero-petals');
  const hero = document.querySelector('.hero');
  const toggle = document.getElementById('motion-toggle');
  if (!canvas || !hero || !canvas.getContext) return;
  const ctx = canvas.getContext('2d');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const colors = ['#f59e0b', '#ea580c', '#fbbf24', '#f97316', '#e11d48'];
  let width = 0, height = 0, ratio = 1, frame = 0, last = 0, inView = true;
  let petals = [], sparks = [];
  const rand = (a, b) => a + Math.random() * (b - a);

  function petal(initial) {
    return { x: rand(0, width), y: initial ? rand(-height, height) : rand(-60, -10), r: rand(5, 10), rot: rand(0, Math.PI * 2), spin: rand(-1.4, 1.4), vy: rand(22, 48), sway: rand(14, 34), phase: rand(0, Math.PI * 2), color: colors[Math.floor(Math.random() * colors.length)], flip: rand(0, Math.PI * 2) };
  }
  function spark(initial) {
    return { x: rand(width * .15, width * .85), y: initial ? rand(height * .3, height) : height + 10, r: rand(.8, 2.2), vy: rand(10, 26), phase: rand(0, Math.PI * 2), life: rand(.5, 1) };
  }
  function resize() {
    const rect = hero.getBoundingClientRect();
    ratio = Math.min(window.devicePixelRatio || 1, 1.5);
    width = rect.width; height = rect.height;
    canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    const small = width < 700;
    petals = Array.from({ length: small ? 16 : 34 }, () => petal(true));
    sparks = Array.from({ length: small ? 22 : 46 }, () => spark(true));
    if (!running()) drawStill();
  }
  function running() { return !reduced.matches && toggle?.getAttribute('aria-pressed') !== 'true' && inView && !document.hidden; }
  function drawPetal(p) {
    ctx.save();
    ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.scale(1, Math.abs(Math.cos(p.flip)) * .7 + .3);
    ctx.fillStyle = p.color; ctx.globalAlpha = .9;
    ctx.beginPath(); ctx.moveTo(0, -p.r);
    ctx.bezierCurveTo(p.r * .9, -p.r * .5, p.r * .7, p.r * .7, 0, p.r);
    ctx.bezierCurveTo(-p.r * .7, p.r * .7, -p.r * .9, -p.r * .5, 0, -p.r);
    ctx.fill();
    ctx.globalAlpha = .35; ctx.fillStyle = '#7c2d12';
    ctx.fillRect(-.4, -p.r * .6, .8, p.r * 1.2);
    ctx.restore();
  }
  function drawSpark(s, t) {
    const a = Math.max(0, Math.sin(t * 2 + s.phase)) * s.life;
    const g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r * 5);
    g.addColorStop(0, `rgba(255, 236, 170, ${a})`); g.addColorStop(1, 'rgba(255, 190, 90, 0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(s.x, s.y, s.r * 5, 0, Math.PI * 2); ctx.fill();
  }
  function drawStill() { ctx.clearRect(0, 0, width, height); }
  function tick(now) {
    frame = 0;
    if (!running()) return;
    const dt = Math.min((now - (last || now)) / 1000, .05); last = now;
    const t = now / 1000;
    ctx.clearRect(0, 0, width, height);
    ctx.globalCompositeOperation = 'lighter';
    sparks.forEach((s, i) => { s.y -= s.vy * dt; s.x += Math.sin(t + s.phase) * 8 * dt; if (s.y < height * .15) sparks[i] = spark(false); drawSpark(s, t); });
    ctx.globalCompositeOperation = 'source-over';
    petals.forEach((p, i) => { p.y += p.vy * dt; p.x += Math.sin(t * .8 + p.phase) * p.sway * dt; p.rot += p.spin * dt; p.flip += dt * 1.6; if (p.y > height + 20) petals[i] = petal(false); drawPetal(p); });
    frame = requestAnimationFrame(tick);
  }
  function start() { if (!frame && running()) { last = 0; frame = requestAnimationFrame(tick); } else if (!running()) { cancelAnimationFrame(frame); frame = 0; if (reduced.matches) drawStill(); } }
  new ResizeObserver(resize).observe(hero);
  new IntersectionObserver(entries => { inView = entries[0].isIntersecting; start(); }).observe(hero);
  document.addEventListener('visibilitychange', start);
  reduced.addEventListener('change', start);
  function syncToggle() {
    if (!toggle) return;
    const paused = toggle.getAttribute('aria-pressed') === 'true';
    toggle.disabled = reduced.matches;
    toggle.innerHTML = reduced.matches ? 'Animation réduite' : paused ? 'Reprendre l’animation <span aria-hidden="true">▷</span>' : 'Pause de l’animation <span aria-hidden="true">Ⅱ</span>';
  }
  if (toggle) {
    toggle.hidden = false;
    toggle.addEventListener('click', () => { toggle.setAttribute('aria-pressed', String(toggle.getAttribute('aria-pressed') !== 'true')); syncToggle(); start(); });
    reduced.addEventListener('change', syncToggle);
    syncToggle();
  }
  resize(); start();
})();
