/* CSS 3D parallax, composed of original SVG planes. */
(() => {
  'use strict';
  const scene = document.querySelector('#tifa-diorama');
  if (!scene) return;
  const viewport = scene.querySelector('.diorama-viewport');
  const toggle = scene.querySelector('#motion-toggle');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const fine = window.matchMedia('(hover: hover) and (pointer: fine)');
  const t = window.TIFA_I18N.t;
  let paused = false, visible = true, raf = 0, last = 0;
  let rx = 0, ry = 0, aimX = 0, aimY = 0;
  const canMove = () => visible && !paused && !reduced.matches && !document.hidden;
  const clamp = n => Math.min(1, Math.max(-1, n));

  function paint() {
    scene.style.setProperty('--scene-rx', `${rx.toFixed(3)}deg`);
    scene.style.setProperty('--scene-ry', `${ry.toFixed(3)}deg`);
  }
  function settle(time) {
    raf = 0;
    if (!canMove()) return;
    const ease = 1 - Math.exp(-Math.min(last ? time - last : 16, 50) / 100);
    last = time;
    rx += (aimX - rx) * ease; ry += (aimY - ry) * ease;
    if (Math.abs(rx - aimX) + Math.abs(ry - aimY) < .02) { rx = aimX; ry = aimY; last = 0; }
    paint();
    if (last) raf = requestAnimationFrame(settle);
  }
  function request() { if (!raf && canMove()) raf = requestAnimationFrame(settle); }
  function neutral() { aimX = aimY = 0; request(); }
  function syncLabel() {
    toggle.disabled = reduced.matches;
    toggle.setAttribute('aria-pressed', String(paused));
    toggle.textContent = t(reduced.matches ? 'Animation réduite' : paused ? 'Reprendre l’animation' : 'Pause de l’animation');
    if (!reduced.matches) {
      const icon = document.createElement('span'); icon.setAttribute('aria-hidden', 'true');
      icon.textContent = paused ? '▷' : 'Ⅱ'; toggle.append(' ', icon);
    }
  }
  function syncMotion() {
    cancelAnimationFrame(raf); raf = last = 0;
    scene.dataset.motion = reduced.matches ? 'reduced' : canMove() ? 'running' : 'paused';
    if (reduced.matches) { rx = ry = aimX = aimY = 0; paint(); }
    if (canMove()) neutral();
    syncLabel();
  }
  viewport.addEventListener('pointermove', event => {
    if (!canMove() || !fine.matches || event.pointerType === 'touch') return;
    const rect = viewport.getBoundingClientRect();
    aimX = -clamp(2 * (event.clientY - rect.top) / rect.height - 1) * 5;
    aimY = clamp(2 * (event.clientX - rect.left) / rect.width - 1) * 9;
    request();
  }, { passive: true });
  viewport.addEventListener('pointerleave', neutral);
  viewport.addEventListener('pointercancel', neutral);
  toggle.hidden = false;
  toggle.addEventListener('click', () => { paused = !paused; syncMotion(); });
  reduced.addEventListener('change', syncMotion);
  fine.addEventListener('change', neutral);
  document.addEventListener('visibilitychange', syncMotion);
  window.addEventListener('tifa:languagechange', syncLabel);
  if ('IntersectionObserver' in window) new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting; syncMotion();
  }, { threshold: 0 }).observe(viewport);
  syncMotion();
})();
