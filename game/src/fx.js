// GO RIO RIO · fx.js — the shared procedural sprite behind every glow and puff.
// BUILD 15 — shared effect textures. Every glow, flame, smoke puff and
// explosion flash in the game samples ONE procedural radial-gradient
// sprite: soft white at the core falling to fully transparent at the
// rim. Because the texture itself fades to alpha 0, additive sprites
// and particle points can never show the hard square edge (the classic
// "black box" artifact) — there is no edge to show. Generated once on
// a canvas, no image files, no network.

const THREE = window.THREE;

let dotTex = null;
let puffTex = null;

// Tight radial falloff for flashes, flames and tracers' glow.
export function softDotTexture() {
  if (dotTex) return dotTex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.35, 'rgba(255,255,255,0.55)');
  grad.addColorStop(0.7, 'rgba(255,255,255,0.16)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  dotTex = new THREE.CanvasTexture(c);
  return dotTex;
}

// A blotchier puff for smoke: a few overlapping soft blobs, so a smoke
// particle reads as a cloud wisp instead of a perfect circle.
export function smokeTexture() {
  if (puffTex) return puffTex;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const blobs = [[64, 64, 46], [42, 52, 30], [86, 54, 32], [52, 84, 30], [80, 82, 28], [64, 40, 26]];
  for (const [x, y, r] of blobs) {
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, 'rgba(255,255,255,0.55)');
    grad.addColorStop(0.6, 'rgba(255,255,255,0.22)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }
  puffTex = new THREE.CanvasTexture(c);
  return puffTex;
}

// One additive flash sprite at a point: bright core, fast fade. The
// caller scales/fades it in its own update (see wrecks.js).
export function makeFlashSprite(scale = 3, color = 0xffe9a8) {
  const m = new THREE.SpriteMaterial({
    map: softDotTexture(), color, transparent: true, opacity: 0.95,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const s = new THREE.Sprite(m);
  s.scale.set(scale, scale, 1);
  return s;
}

// BUILD 15 — adopted technique (CleanVfxSystem, from the user's
// Palmera Core Engine v2.0 reference): a tiny pooled burst system for
// gunfire — a warm muzzle flash sprite that dies in 70 ms and a fan of
// impact sparks that arc under gravity and fade with their life. Every
// sprite samples the radial-gradient texture above with additive
// blending and depthWrite off, so a flash can never render as a hard
// square or a black box. combat.js owns one instance and ticks it.
export function createVfxBursts(scene) {
  const items = [];   // { s, life, maxLife, vel, grav }
  let spawned = 0;    // monotonic total — a flash lives 70 ms, far
                      // under a slow renderer's frame, so tests (and
                      // any future tuning) read this instead of
                      // trying to catch a live sprite mid-frame.
  function spawn(pos, scale, color, life, vel, grav) {
    spawned++;
    const s = new THREE.Sprite(new THREE.SpriteMaterial({
      map: softDotTexture(), color, transparent: true, opacity: 0.95,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    s.position.copy(pos);
    s.scale.set(scale, scale, 1);
    scene.add(s);
    items.push({ s, life, maxLife: life, vel, grav });
  }
  function flash(pos, scale = 0.65) {
    spawn(pos, scale, 0xffd166, 0.07, new THREE.Vector3(), 0);
  }
  function sparks(pos, n = 5, color = 0xfbbf24) {
    for (let i = 0; i < n; i++) {
      spawn(pos, 0.24, color, 0.22, new THREE.Vector3(
        (Math.random() - 0.5) * 6, Math.random() * 4 + 1, (Math.random() - 0.5) * 6), 9);
    }
  }
  function update(dt) {
    for (let i = items.length - 1; i >= 0; i--) {
      const it = items[i];
      it.life -= dt;
      if (it.life <= 0) {
        scene.remove(it.s);
        it.s.material.dispose();
        items.splice(i, 1);
        continue;
      }
      it.vel.y -= it.grav * dt;
      it.s.position.addScaledVector(it.vel, dt);
      it.s.material.opacity = Math.max(0, (it.life / it.maxLife) * 0.95);
    }
  }
  return { flash, sparks, update, get count() { return items.length; }, get spawned() { return spawned; } };
}
