// Keyboard and mouse input. Held keys are read as a state snapshot each
// frame; one-shot actions (enter car, punch, start, shoot) are queued so a
// press between frames is never lost. Mouse drag orbits the follow camera.
// TPS aim: holding the RIGHT mouse button sets `aiming` (over-the-shoulder
// camera + crosshair); a LEFT click while aiming queues 'shoot' instead of
// starting a camera drag.

export function createInput(canvas) {
  const keys = new Set();
  const actions = [];
  let dragYaw = 0;
  let dragging = false;
  let lastX = 0;
  let aiming = false;

  window.addEventListener('keydown', (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    if (!e.repeat) {
      if (e.code === 'KeyE') actions.push('enter');
      if (e.code === 'KeyF' || e.code === 'Space') actions.push('punch');
      if (e.code === 'Enter') actions.push('start');
    }
    keys.add(e.code);
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  window.addEventListener('blur', () => keys.clear());

  canvas.addEventListener('pointerdown', (e) => {
    if (e.button === 2) { aiming = true; return; }
    if (e.button === 0 && aiming) { actions.push('shoot'); return; }
    dragging = true;
    lastX = e.clientX;
    actions.push('start');
  });
  window.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    dragYaw -= (e.clientX - lastX) * 0.005;
    lastX = e.clientX;
  });
  window.addEventListener('pointerup', (e) => {
    if (e.button === 2) aiming = false;
    if (e.button === 0) dragging = false;
  });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  return {
    keys,
    takeActions() {
      const out = actions.slice();
      actions.length = 0;
      return out;
    },
    get dragYaw() { return dragYaw; },
    set dragYaw(v) { dragYaw = v; },
    get aiming() { return aiming; },
    down(...codes) { return codes.some((c) => keys.has(c)); },
  };
}
