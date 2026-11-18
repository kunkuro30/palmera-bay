// input.js — keyboard and mouse state: what is held, what was just pressed,
// and how far the mouse has travelled while the pointer is locked.

export function createInput(canvas) {
  const held = new Set();
  const pressed = new Set();
  let mouseDX = 0;
  let mouseDY = 0;
  let mouseDown = false;
  let mouseClicked = false;
  let locked = false;

  window.addEventListener('keydown', (e) => {
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    if (!e.repeat) pressed.add(e.code);
    held.add(e.code);
  });
  window.addEventListener('keyup', (e) => held.delete(e.code));
  window.addEventListener('blur', () => { held.clear(); mouseDown = false; });

  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) { mouseDown = true; mouseClicked = true; }
  });
  window.addEventListener('mouseup', (e) => { if (e.button === 0) mouseDown = false; });
  document.addEventListener('mousemove', (e) => {
    if (!locked) return;
    mouseDX += e.movementX || 0;
    mouseDY += e.movementY || 0;
  });
  document.addEventListener('pointerlockchange', () => {
    locked = document.pointerLockElement === canvas;
  });

  return {
    held,
    isLocked: () => locked,
    wasPressed: (code) => pressed.has(code),
    mouseDown: () => mouseDown,
    lockPointer() {
      if (!locked) canvas.requestPointerLock();
    },
    unlockPointer() {
      if (locked) document.exitPointerLock();
    },
    // call once per frame: hands over the accumulated mouse travel and the
    // one-frame click, and clears the per-frame sets
    consumeFrame() {
      const frame = { dx: mouseDX, dy: mouseDY, clicked: mouseClicked };
      mouseDX = 0;
      mouseDY = 0;
      mouseClicked = false;
      pressed.clear();
      return frame;
    },
  };
}
