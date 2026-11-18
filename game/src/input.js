// input.js — keyboard and mouse state for the game. Held keys live in a Set
// the loop reads every frame; one-shot presses are queued and taken once, so
// a press between frames is never lost or counted twice. Mouse movement is
// accumulated for the camera while the pointer is locked to the canvas.

const GAME_KEYS = new Set([
  'KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
  'Space', 'ShiftLeft', 'ShiftRight', 'KeyF', 'KeyP', 'KeyM', 'Digit1', 'Digit2', 'Enter',
]);

export function createInput(canvas) {
  const held = new Set();
  const pressed = new Set();
  let mouseDX = 0, mouseDY = 0, mouseDown = false, mouseClicked = false;

  window.addEventListener('keydown', (e) => {
    if (GAME_KEYS.has(e.code)) e.preventDefault();
    if (!e.repeat) pressed.add(e.code);
    held.add(e.code);
  });
  window.addEventListener('keyup', (e) => held.delete(e.code));
  window.addEventListener('blur', () => { held.clear(); mouseDown = false; });
  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) { mouseDown = true; mouseClicked = true; }
  });
  window.addEventListener('mouseup', (e) => { if (e.button === 0) mouseDown = false; });
  window.addEventListener('mousemove', (e) => {
    if (document.pointerLockElement === canvas) {
      mouseDX += e.movementX || 0;
      mouseDY += e.movementY || 0;
    }
  });

  return {
    held,
    /** True once per physical press; the set is cleared by takePressed(). */
    pressed,
    takePressed() { const p = new Set(pressed); pressed.clear(); return p; },
    get mouseDown() { return mouseDown; },
    get mouseClicked() { const c = mouseClicked; mouseClicked = false; return c; },
    takeMouseMove() { const d = { x: mouseDX, y: mouseDY }; mouseDX = 0; mouseDY = 0; return d; },
    lockPointer() { canvas.requestPointerLock?.(); },
  };
}
