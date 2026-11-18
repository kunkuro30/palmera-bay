// Keyboard and mouse input. Held keys live in a set the game polls each frame; one-shot
// presses are remembered as edges so pressed(code) fires exactly once per tap, and mouse
// movement accumulates for the camera while the pointer is locked.

export function createInput(canvas) {
  const held = new Set();
  const edges = new Set();
  const mouse = { dx: 0, dy: 0, down: false, clicked: false };
  let locked = false;

  window.addEventListener('keydown', (event) => {
    if (!event.repeat) edges.add(event.code);
    held.add(event.code);
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) event.preventDefault();
  });
  window.addEventListener('keyup', (event) => held.delete(event.code));
  window.addEventListener('blur', () => {
    held.clear();
    mouse.down = false;
  });

  canvas.addEventListener('mousedown', (event) => {
    if (event.button === 0) {
      mouse.down = true;
      mouse.clicked = true;
    }
  });
  window.addEventListener('mouseup', (event) => {
    if (event.button === 0) mouse.down = false;
  });
  document.addEventListener('mousemove', (event) => {
    if (!locked) return;
    mouse.dx += event.movementX || 0;
    mouse.dy += event.movementY || 0;
  });
  document.addEventListener('pointerlockchange', () => {
    locked = document.pointerLockElement === canvas;
  });

  return {
    mouse,
    down: (code) => held.has(code),
    /** True only on the frame a key was first pressed. Call once per frame, before endFrame. */
    pressed: (code) => edges.has(code),
    isLocked: () => locked,
    lock() {
      if (!locked) canvas.requestPointerLock();
    },
    unlock() {
      if (locked) document.exitPointerLock();
    },
    /** Consume the accumulated mouse motion and the frame's click edge. */
    takeMouse() {
      const taken = { dx: mouse.dx, dy: mouse.dy, clicked: mouse.clicked };
      mouse.dx = 0;
      mouse.dy = 0;
      mouse.clicked = false;
      return taken;
    },
    endFrame() {
      edges.clear();
    },
  };
}
