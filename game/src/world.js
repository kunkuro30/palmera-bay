// The world builder: one organic island, sea on every side. The terrain is
// a single vertex-coloured mesh shaped by config.heightAt — sand at the
// shore, grass inland, dry desert in the north-east, rock on the mountain.
// On it sit the south city (concrete pad, roads WITH RAISED SIDEWALKS,
// crosswalks, downtown blocks), the beach strip (statue, pier, wheel, shop
// row), Palmera Intl on its reclaimed plateau, the coastal highway loop,
// the north freeway, a lakeside hamlet and the wild north. Building
// footprints are exported as AABBs for collision.

import { WORLD, SHOPS, PALETTE, coastRadius, heightAt, groundHeight, highwayLoopPoints, FREEWAY_PTS } from './config.js';
import { pick, range, makeRng } from './random.js';
import { buildFleetVehicle } from './fleet.js';
import { makeWeapon, makeRifle, makeSmg } from './characters.js';

const THREE = window.THREE;

function lam(color, opts = {}) {
  return new THREE.MeshLambertMaterial(Object.assign({ color, flatShading: true }, opts));
}
function box(w, h, d, material, x, y, z, ry = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  m.position.set(x, y, z);
  if (ry) m.rotation.y = ry;
  return m;
}

// ---- procedural canvas textures -------------------------------------------
function canvasTexture(size, draw, repeat) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c);
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
}

function asphaltTexture() {
  // BUILD 16 realism: 256px tile — dense aggregate grain, soft worn
  // patches, hairline cracks, tyre-polish darkening in the wheel tracks,
  // and lane paint that is itself worn (speckle-erased after drawing).
  return canvasTexture(256, (g, s) => {
    g.fillStyle = '#3a3f46'; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 2600; i++) {
      const v = Math.random();
      g.fillStyle = v > 0.66 ? '#454a51' : (v > 0.33 ? '#33373d' : '#3e434a');
      g.fillRect(Math.random() * s, Math.random() * s, 2, 2);
    }
    // Worn patches: broad soft ellipses a shade lighter / darker.
    for (let i = 0; i < 7; i++) {
      const x = Math.random() * s, y = Math.random() * s, r = 22 + Math.random() * 46;
      const gr = g.createRadialGradient(x, y, 2, x, y, r);
      const tone = Math.random() > 0.5 ? '70,76,84' : '44,48,54';
      gr.addColorStop(0, `rgba(${tone},0.20)`); gr.addColorStop(1, `rgba(${tone},0)`);
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
    }
    // Tyre polish: two soft dark bands where wheels actually run.
    for (const bx of [s * 0.16, s * 0.40, s * 0.60, s * 0.84]) {
      const gr = g.createLinearGradient(bx - 16, 0, bx + 16, 0);
      gr.addColorStop(0, 'rgba(20,22,26,0)');
      gr.addColorStop(0.5, 'rgba(20,22,26,0.16)');
      gr.addColorStop(1, 'rgba(20,22,26,0)');
      g.fillStyle = gr; g.fillRect(bx - 16, 0, 32, s);
    }
    // Hairline cracks: short dark random walks.
    g.strokeStyle = 'rgba(18,20,24,0.5)'; g.lineWidth = 1.2;
    for (let i = 0; i < 6; i++) {
      let x = Math.random() * s, y = Math.random() * s;
      g.beginPath(); g.moveTo(x, y);
      for (let k = 0; k < 6; k++) { x += (Math.random() - 0.5) * 22; y += Math.random() * 14; g.lineTo(x, y); }
      g.stroke();
    }
    // Lane paint, then wear it away with asphalt-coloured speckle.
    const dash = (x, col) => {
      g.fillStyle = col;
      g.fillRect(x - 2.5, 14, 5, 62); g.fillRect(x - 2.5, s - 76, 5, 62);
      g.fillStyle = '#3a3f46';
      for (let i = 0; i < 46; i++) g.fillRect(x - 3 + Math.random() * 6, 10 + Math.random() * (s - 20), 2.4, 2.4);
      g.fillStyle = 'rgba(240,240,240,0.10)';
      for (let i = 0; i < 12; i++) g.fillRect(x - 2 + Math.random() * 4, 10 + Math.random() * (s - 20), 1.6, 1.6);
    };
    dash(s / 2, 'rgba(247,209,84,0.88)');                    // centre dashes along V
    dash(s * 0.25, 'rgba(245,245,245,0.82)');                // white lane dashes
    dash(s * 0.75, 'rgba(245,245,245,0.82)');
  }, [1, 14]);
}

// BUILD 16: poured-concrete texture for the city pad (slab grid) and the
// sidewalk boxes (grain only — a grid would stretch on the long segments).
function concreteTexture(grid) {
  return canvasTexture(256, (g, s) => {
    g.fillStyle = '#dde0e4'; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 2000; i++) {
      const v = Math.random();
      g.fillStyle = v > 0.6 ? '#e6e9ec' : (v > 0.3 ? '#cfd3d9' : '#d8dce1');
      g.fillRect(Math.random() * s, Math.random() * s, 2, 2);
    }
    for (let i = 0; i < 6; i++) {   // weather stains
      const x = Math.random() * s, y = Math.random() * s, r = 18 + Math.random() * 40;
      const gr = g.createRadialGradient(x, y, 2, x, y, r);
      gr.addColorStop(0, 'rgba(105,110,118,0.13)'); gr.addColorStop(1, 'rgba(105,110,118,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
    }
    if (grid) {
      g.strokeStyle = 'rgba(90,96,104,0.55)'; g.lineWidth = 2;
      for (const p of [0, s / 2]) {
        g.beginPath(); g.moveTo(p, 0); g.lineTo(p, s); g.stroke();
        g.beginPath(); g.moveTo(0, p); g.lineTo(s, p); g.stroke();
      }
      g.strokeStyle = 'rgba(255,255,255,0.20)'; g.lineWidth = 1;
      for (const p of [2, s / 2 + 2]) {
        g.beginPath(); g.moveTo(p, 0); g.lineTo(p, s); g.stroke();
        g.beginPath(); g.moveTo(0, p); g.lineTo(s, p); g.stroke();
      }
    }
  }, grid ? [46, 26] : null);
}

// BUILD 16: near-neutral detail grain multiplied over the terrain's
// vertex colours — sand grain, grass mottle, desert and rock all pick up
// the same fine tooth so no biome reads as flat vector fill any more.
function detailTexture() {
  return canvasTexture(256, (g, s) => {
    g.fillStyle = '#f4f4f4'; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 5200; i++) {
      const v = 205 + Math.floor(Math.random() * 50);
      g.fillStyle = `rgb(${v},${v},${v})`;
      g.fillRect(Math.random() * s, Math.random() * s, 2, 2);
    }
    for (let i = 0; i < 26; i++) {   // low-frequency mottle
      const x = Math.random() * s, y = Math.random() * s, r = 14 + Math.random() * 34;
      const gr = g.createRadialGradient(x, y, 1, x, y, r);
      const tone = Math.random() > 0.5 ? '255,255,255' : '196,196,196';
      gr.addColorStop(0, `rgba(${tone},0.20)`); gr.addColorStop(1, `rgba(${tone},0)`);
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
    }
    // Short streaks (sand ripple / worn grass direction).
    g.strokeStyle = 'rgba(210,210,210,0.35)'; g.lineWidth = 1;
    for (let i = 0; i < 130; i++) {
      const x = Math.random() * s, y = Math.random() * s;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + 3 + Math.random() * 5, y); g.stroke();
    }
  }, [120, 120]);
}

function signTexture(text, bg) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, 512, 128);
  g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = 8; g.strokeRect(8, 8, 496, 112);
  g.fillStyle = '#ffffff';
  g.font = '900 56px Trebuchet MS, sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, 256, 68);
  return new THREE.CanvasTexture(c);
}

function windowTexture(rng, litChance) {
  // BUILD 16 realism: 256px facade — every window varies (glass tone and
  // brightness jitter, warm-lit units, a few half-blinded), thin mullion
  // cross in each pane, a sky sheen on the top half, faint weather streaks
  // running down the wall and a grime band along the tile's base.
  return canvasTexture(256, (g, s) => {
    g.fillStyle = '#333c46'; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 500; i++) {   // wall tooth behind the glass grid
      g.fillStyle = Math.random() > 0.5 ? '#39424d' : '#2e353f';
      g.fillRect(Math.random() * s, Math.random() * s, 2, 2);
    }
    const cols = 8, rows = 11, cw = s / cols, ch = s / rows;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const x = c * cw + 3.5, y = r * ch + 3.5, w = cw - 7, h = ch - 7;
      const lit = rng() < litChance;
      let base;
      if (lit) {
        const j = 0.82 + rng() * 0.30;
        base = `rgb(${Math.round(255 * j)},${Math.round(226 * j)},${Math.round(158 * j)})`;
      } else {
        const t = rng();
        const rC = Math.round(74 + t * 34), gC = Math.round(96 + t * 30), bC = Math.round(116 + t * 30);
        base = `rgb(${rC},${gC},${bC})`;
      }
      g.fillStyle = base; g.fillRect(x, y, w, h);
      // Sky sheen: top half a touch lighter, like reflected sky.
      g.fillStyle = 'rgba(225,240,250,0.16)'; g.fillRect(x, y, w, h * 0.45);
      // Mullion cross.
      g.fillStyle = 'rgba(24,30,38,0.55)';
      g.fillRect(x + w / 2 - 0.75, y, 1.5, h);
      g.fillRect(x, y + h / 2 - 0.75, w, 1.5);
      // A few windows sit half-blinded (darker lower half).
      if (rng() < 0.14) { g.fillStyle = 'rgba(30,36,44,0.45)'; g.fillRect(x, y + h * 0.55, w, h * 0.45); }
    }
    // Weather streaks bleeding down from random panes.
    g.fillStyle = 'rgba(22,27,33,0.10)';
    for (let i = 0; i < 9; i++) {
      const x = Math.random() * s, y = Math.random() * s * 0.7;
      g.fillRect(x, y, 2.5, 22 + Math.random() * 40);
    }
    // Grime settling at the base of the tile.
    const gr = g.createLinearGradient(0, s - 26, 0, s);
    gr.addColorStop(0, 'rgba(20,24,29,0)'); gr.addColorStop(1, 'rgba(20,24,29,0.28)');
    g.fillStyle = gr; g.fillRect(0, s - 26, s, 26);
  }, [2, 6]);
}

// BUILD 16: fake contact AO — one shared radial-gradient texture on a
// flat skirt plane under each tower, darkest at the walls, gone 2 m out.
// Module scope: several builders (downtown, hotels) share it.
const aoTex = canvasTexture(128, (g, s) => {
  const gr = g.createRadialGradient(s / 2, s / 2, s * 0.18, s / 2, s / 2, s * 0.52);
  gr.addColorStop(0, 'rgba(12,15,19,0.52)');
  gr.addColorStop(0.62, 'rgba(12,15,19,0.30)');
  gr.addColorStop(1, 'rgba(12,15,19,0)');
  g.fillStyle = gr; g.fillRect(0, 0, s, s);
});
const aoMat = new THREE.MeshBasicMaterial({ map: aoTex, transparent: true, depthWrite: false });

// ---- terrain ---------------------------------------------------------------
function hash2(x, z) {
  const s = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453;
  return s - Math.floor(s);
}

const BIOME = {
  sand: new THREE.Color(0xf2d492), sandDry: new THREE.Color(0xdcc084),
  grassA: new THREE.Color(0x6fbf5a), grassB: new THREE.Color(0x63b34f), grassC: new THREE.Color(0x7cc464),
  desertA: new THREE.Color(0xd9b380), desertB: new THREE.Color(0xc9a86a),
  rock: new THREE.Color(0x8d8578), rockHi: new THREE.Color(0xb0a696),
  cityBase: new THREE.Color(0xb9bdc2), apronBase: new THREE.Color(0x9aa0a8),
};
const tmpC = new THREE.Color();

function biomeColor(x, z, h) {
  const c = WORLD.city, a = WORLD.airport;
  if (x > c.x0 - 2 && x < c.x1 + 2 && z > c.z0 - 2 && z < c.z1 + 2) return BIOME.cityBase;
  if (x > a.x0 - 2 && x < a.x1 + 2 && z > a.z0 - 2 && z < a.z1 + 2) return BIOME.apronBase;
  const dl = Math.hypot(x - WORLD.lake.x, z - WORLD.lake.z);
  const n = hash2(Math.round(x / 6), Math.round(z / 6));
  if (h < 0.15) return BIOME.sandDry;
  // The southern tourist shore gets a WIDE sand band — 30 m inland from the
  // waterline — so the sunbather strip reads as beach, not lawn.
  const th = Math.atan2(z - WORLD.centre.z, x - WORLD.centre.x);
  const inland = coastRadius(th) - Math.hypot(x - WORLD.centre.x, z - WORLD.centre.z);
  if (h < 0.8 || (dl < 47 && h < 1.25) || (inland < 30 && z > 60 && h < 1.6)) return BIOME.sand;
  if (x > 45 && z < -55 && dl > 47) return tmpC.copy(BIOME.desertA).lerp(BIOME.desertB, n).clone();
  if (h > 34) return BIOME.rockHi;
  if (h > 15) return BIOME.rock;
  const g = n < 0.4 ? BIOME.grassA : (n < 0.75 ? BIOME.grassB : BIOME.grassC);
  return g;
}

function buildTerrain(scene) {
  const geo = new THREE.PlaneGeometry(720, 720, 150, 150);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const h = heightAt(x, z);
    pos.setY(i, h);
    const col = biomeColor(x, z, h);
    colors[i * 3] = col.r; colors[i * 3 + 1] = col.g; colors[i * 3 + 2] = col.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, map: detailTexture() }));
  m.receiveShadow = true;
  scene.add(m);
}

// A flat asphalt ribbon following a polyline over the terrain.
function ribbon(scene, pts, width, lift, closed) {
  const mat = lam(PALETTE.asphalt);
  const list = closed ? pts.concat([pts[0]]) : pts.slice();
  for (let i = 0; i < list.length - 1; i++) {
    const a = list[i], b = list[i + 1];
    for (let k = 0; k < 2; k++) {
      const p0 = { x: a.x + (b.x - a.x) * k / 2, z: a.z + (b.z - a.z) * k / 2 };
      const p1 = { x: a.x + (b.x - a.x) * (k + 1) / 2, z: a.z + (b.z - a.z) * (k + 1) / 2 };
      const len = Math.hypot(p1.x - p0.x, p1.z - p0.z);
      if (len < 1) continue;
      const mx = (p0.x + p1.x) / 2, mz = (p0.z + p1.z) / 2;
      const c = WORLD.city;
      if (mx > c.x0 && mx < c.x1 && mz > c.z0 && mz < c.z1) continue;   // city roads already drawn
      const m = new THREE.Mesh(new THREE.PlaneGeometry(width, len + width * 0.5), mat);
      m.rotation.order = 'YXZ';
      m.rotation.y = Math.atan2(p1.x - p0.x, p1.z - p0.z);
      m.rotation.x = -Math.PI / 2;
      m.position.set(mx, (heightAt(p0.x, p0.z) + heightAt(p1.x, p1.z)) / 2 + lift, mz);
      m.receiveShadow = true;
      scene.add(m);
    }
  }
}

// Distance from a point to a polyline (for keeping scatter off the roads).
function distToPath(x, z, pts) {
  let best = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    const abx = b.x - a.x, abz = b.z - a.z;
    const t = Math.max(0, Math.min(1, ((x - a.x) * abx + (z - a.z) * abz) / (abx * abx + abz * abz || 1)));
    best = Math.min(best, Math.hypot(x - (a.x + abx * t), z - (a.z + abz * t)));
  }
  return best;
}

// A gentle breeze for palms and flags: a slow sin sway around the base.
function addSway(animated, obj, rng, amp = 0.022) {
  const ph = rng() * 6.28;
  animated.push({ update(t) { obj.rotation.z = Math.sin(t * 0.9 + ph) * amp; obj.rotation.x = Math.cos(t * 0.7 + ph) * amp * 0.7; } });
}

// ---- world ----------------------------------------------------------------
// BUILD 7 reserved fill lots (sub-lot centres are seed-independent —
// they come from the block fractions, not from rng): the fire station
// takes the whole block south of the fire crew's corner, the police HQ,
// the car dealership and the moto/gun shops take theirs. The fill loop
// still BUILDS these lots (identical rng draws) and then removes them,
// so every layout downstream of the shared rng is untouched.
const RESERVED_LOTS = [
  [67.5, 20.5], [82.5, 20.5],       // fire station block (avenue 50 × street 35)
  [120, 96.25],                     // police station
  [120, 142.5],                     // car dealership
  [-132.5, 142.5], [-117.5, 142.5], // motorcycle shop + gun shop
  [155, 63.75], [155, 96.25], [155, 142.5], // BUILD 12: the east-edge hotel strip
];

export function buildWorld(scene, rng) {
  const W = WORLD;
  const colliders = [];
  const animated = [];
  // BUILD 7: all new content draws from its OWN rng stream and registers
  // static grounding samples for tools/physics_check.py (rule 6).
  const r7 = makeRng(20261120);
  const samples7 = [];
  scene.userData.groundingSamples = samples7;
  const sample7 = (label, x, z, y, q) => samples7.push({ label, x, z, y, q: q || 'heightAt' });

  scene.background = new THREE.Color(PALETTE.sky);
  scene.fog = new THREE.Fog(0xdcebef, 260, 680);   // build 16: fog tint matched to the dome's horizon
  scene.add(new THREE.HemisphereLight(0xcfeeff, 0x8a7a5a, 0.88));
  const sun = new THREE.DirectionalLight(0xffe7bd, 1.72);
  sun.position.set(150, 220, 130);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  // Build 8: tightened shadow frustum (crisper shadows in the 2K
  // pipeline) + bias tuning against acne/peter-panning.
  // Build 16: normalBias eased up a touch — the richer facade textures
  // shimmer-acne sooner than the flat ones did.
  sun.shadow.camera.left = -250; sun.shadow.camera.right = 250;
  sun.shadow.camera.top = 250; sun.shadow.camera.bottom = -250;
  sun.shadow.camera.far = 800;
  sun.shadow.bias = -0.00015;
  sun.shadow.normalBias = 0.18;
  scene.add(sun);

  // ---- BUILD 16: gradient sky dome, sun disc, drifting clouds ----------
  // A BackSide sphere with a painted vertical gradient (deep zenith ->
  // pale blue -> warm horizon -> haze below), a soft additive sun disc
  // sitting exactly on the light's axis, and a ring of billboard cloud
  // puffs on a very slow drift. All canvas-painted, zero file assets.
  {
    const skyTex = canvasTexture(512, (g, s) => {
      const gr = g.createLinearGradient(0, 0, 0, s);
      // Canvas mid-height == eye-level horizon on the sphere, so the
      // warm band sits just above it and the fog tint lands exactly on
      // it. The blues are compressed into f 0.30–0.45: that is the band
      // a street-level camera actually sees (elevations ~10–35°), so
      // the upper sky reads blue instead of washing out to horizon-pale.
      gr.addColorStop(0.00, '#2e6ab0');
      gr.addColorStop(0.22, '#4b9ad8');
      gr.addColorStop(0.34, '#7fb9e6');
      gr.addColorStop(0.43, '#b9dcee');
      gr.addColorStop(0.475, '#f2e3c2');   // warm band just above the horizon
      gr.addColorStop(0.50, '#dcebef');   // == fog colour, at eye level
      gr.addColorStop(0.56, '#d8cdb2');   // below-horizon warm haze
      gr.addColorStop(1.00, '#8a7a5f');
      g.fillStyle = gr; g.fillRect(0, 0, s, s);
    });
    // The renderer outputs sRGB; without this the dome's blues render
    // gamma-lifted to a grey wash (the game's older canvas textures keep
    // the legacy path — their look was tuned under it over 15 builds).
    skyTex.colorSpace = THREE.SRGBColorSpace;
    // The whole sky rig lives in one group that follows the camera
    // (see the animated push below): a fixed 860 dome around the ORIGIN
    // would poke past the camera's 900 far plane from island-edge
    // cameras and render as a clipped cap.
    const skyGroup = new THREE.Group();
    scene.add(skyGroup);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(700, 32, 16),
      new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, fog: false, depthWrite: false }));
    dome.renderOrder = -10;
    dome.frustumCulled = false;
    skyGroup.add(dome);

    const glowTex = canvasTexture(128, (g, s) => {
      const gr = g.createRadialGradient(s / 2, s / 2, 2, s / 2, s / 2, s / 2);
      gr.addColorStop(0, 'rgba(255,252,238,1)');
      gr.addColorStop(0.25, 'rgba(255,240,200,0.85)');
      gr.addColorStop(0.6, 'rgba(255,220,150,0.25)');
      gr.addColorStop(1, 'rgba(255,210,130,0)');
      g.fillStyle = gr; g.fillRect(0, 0, s, s);
    });
    const sunDir = new THREE.Vector3(150, 220, 130).normalize();
    const sunDisc = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTex, color: 0xfff3cf, blending: THREE.AdditiveBlending,
      transparent: true, depthWrite: false, fog: false, opacity: 0.95,
    }));
    sunDisc.position.copy(sunDir).multiplyScalar(640);
    sunDisc.scale.set(170, 170, 1);
    skyGroup.add(sunDisc);

    const cloudTex = canvasTexture(256, (g, s) => {
      g.clearRect(0, 0, s, s);
      const puff = (x, y, r, a) => {
        const gr = g.createRadialGradient(x, y, 1, x, y, r);
        gr.addColorStop(0, `rgba(255,255,255,${a})`);
        gr.addColorStop(0.7, `rgba(250,252,255,${a * 0.45})`);
        gr.addColorStop(1, 'rgba(250,252,255,0)');
        g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
      };
      puff(128, 140, 74, 0.75); puff(84, 148, 50, 0.6); puff(176, 148, 54, 0.62);
      puff(112, 122, 46, 0.55); puff(150, 126, 42, 0.5); puff(128, 158, 66, 0.4);
    });
    const cloudGroup = new THREE.Group();
    const crng = makeRng(160016);
    for (let i = 0; i < 16; i++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({
        map: cloudTex, transparent: true, depthWrite: false, fog: false,
        opacity: 0.30 + crng() * 0.26,
      }));
      const th = crng() * Math.PI * 2, rad = 240 + crng() * 300;
      sp.position.set(Math.cos(th) * rad, 110 + crng() * 80, Math.sin(th) * rad);
      const w = 150 + crng() * 170;
      sp.scale.set(w, w * (0.30 + crng() * 0.10), 1);
      cloudGroup.add(sp);
    }
    skyGroup.add(cloudGroup);
    animated.push({
      update(t) {
        const cam = window.__game && window.__game.camera;
        if (cam) skyGroup.position.copy(cam.position);
        cloudGroup.rotation.y = t * 0.0035;
      },
    });
  }

  buildTerrain(scene);

  // The sea, all the way around, plus the lake in the north-centre.
  // BUILD 16: finer 256px wave field (two tones of stroke so the scroll
  // reads as moving water, not a sliding print) and a Phong sea — the
  // sun's specular streak is what sells open water at street distance.
  const waterTex = canvasTexture(256, (g, s) => {
    const gr = g.createLinearGradient(0, 0, s, s);
    gr.addColorStop(0, '#1d94b4'); gr.addColorStop(0.5, '#1f9bb8'); gr.addColorStop(1, '#1b8ca9');
    g.fillStyle = gr; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 2600; i++) {
      g.fillStyle = Math.random() > 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(8,60,80,0.06)';
      g.fillRect(Math.random() * s, Math.random() * s, 2, 2);
    }
    for (let i = 0; i < 16; i++) {
      g.strokeStyle = i % 2 ? 'rgba(255,255,255,.20)' : 'rgba(160,225,245,.26)';
      g.lineWidth = i % 2 ? 1.6 : 2.6;
      g.beginPath();
      const y = (i * 17) % s;
      g.moveTo(0, y); g.bezierCurveTo(s * 0.3, y + 6, s * 0.6, y - 6, s, y); g.stroke();
    }
  }, [42, 42]);
  const water = new THREE.Mesh(new THREE.PlaneGeometry(1500, 1500),
    new THREE.MeshPhongMaterial({
      map: waterTex, transparent: true, opacity: 0.93,
      specular: 0xd6efff, shininess: 120,
    }));
  water.rotation.x = -Math.PI / 2;
  water.position.set(0, 0.1, 0);
  scene.add(water);
  const lake = new THREE.Mesh(new THREE.CircleGeometry(W.lake.waterR, 26),
    new THREE.MeshPhongMaterial({
      color: 0x2ea6c8, transparent: true, opacity: 0.94,
      specular: 0xd6efff, shininess: 90,
    }));
  lake.rotation.x = -Math.PI / 2;
  lake.position.set(W.lake.x, W.lake.waterY, W.lake.z);
  scene.add(lake);
  // The scroll freezes on the adaptive ladder's lowest rung (build 13/16).
  const qFrozen = () => ((window.__game && window.__game.qualityStep) || 0) >= 5;
  animated.push({
    update(t) {
      if (qFrozen()) return;
      waterTex.offset.y = t * 0.02; waterTex.offset.x = t * 0.006;
    },
  });

  // Sun glitter: a second, sparser streak layer drifting the other way
  // just above the sea, so the water shimmers instead of sitting flat.
  const sparkTex = canvasTexture(256, (g, s) => {
    g.clearRect(0, 0, s, s);
    g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = 2.5;
    for (let i = 0; i < 130; i++) {
      const x = Math.random() * s, y = Math.random() * s, w = 5 + Math.random() * 13;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + w, y); g.stroke();
    }
  }, [30, 30]);
  const sparkle = new THREE.Mesh(new THREE.PlaneGeometry(1500, 1500),
    new THREE.MeshLambertMaterial({ map: sparkTex, transparent: true, opacity: 0.30, depthWrite: false }));
  sparkle.rotation.x = -Math.PI / 2;
  sparkle.position.set(0, 0.17, 0);
  sparkle.renderOrder = 2;
  scene.add(sparkle);
  animated.push({
    update(t) {
      if (qFrozen()) return;
      sparkTex.offset.x = -t * 0.011; sparkTex.offset.y = t * 0.004;
    },
  });

  // BUILD 16: foam collar along the shoreline. A triangle strip follows
  // coastRadius() — the same function that shapes the terrain — from 4 m
  // offshore to 7 m up the sand, each vertex lifted just over the real
  // ground height, textured with soft broken streaks whose alpha dies at
  // both edges. The shoreline itself does not move a centimetre.
  {
    const foamTex = canvasTexture(256, (g, s) => {
      g.clearRect(0, 0, s, s);
      for (let i = 0; i < 210; i++) {
        const y = s * 0.5 + (Math.random() - 0.5) * s * 0.72;
        const edge = 1 - Math.abs(y - s * 0.5) / (s * 0.5);
        const x = Math.random() * s, w = 8 + Math.random() * 30;
        g.fillStyle = `rgba(255,255,255,${(0.10 + Math.random() * 0.30) * edge})`;
        g.fillRect(x, y, w, 1.6 + Math.random() * 2.2);
      }
      for (let i = 0; i < 46; i++) {   // bubble speckle near the waterline
        const y = s * 0.5 + (Math.random() - 0.5) * s * 0.4;
        g.fillStyle = `rgba(255,255,255,${0.25 + Math.random() * 0.4})`;
        g.beginPath(); g.arc(Math.random() * s, y, 1 + Math.random() * 2.4, 0, 7); g.fill();
      }
    }, [1, 1]);
    foamTex.wrapS = foamTex.wrapT = THREE.RepeatWrapping;
    const foamMat = new THREE.MeshBasicMaterial({
      map: foamTex, transparent: true, opacity: 0.55, depthWrite: false,
    });
    const STEPS = 256, positions = [], uvs = [], indices = [];
    for (let i = 0; i <= STEPS; i++) {
      const th = (i / STEPS) * Math.PI * 2;
      const cr = coastRadius(th);
      for (const [rr, vv] of [[cr - 4, 0], [cr + 7, 1]]) {
        const x = WORLD.centre.x + Math.cos(th) * rr;
        const z = WORLD.centre.z + Math.sin(th) * rr;
        positions.push(x, Math.max(heightAt(x, z) + 0.05, 0.16), z);
        uvs.push(i * 0.75, vv);
      }
      if (i < STEPS) {
        const a = i * 2;
        indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
    const foamGeo = new THREE.BufferGeometry();
    foamGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    foamGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    foamGeo.setIndex(indices);
    const foam = new THREE.Mesh(foamGeo, foamMat);
    foam.renderOrder = 3;
    foam.frustumCulled = false;
    scene.add(foam);
    // A matching soft ring where the lake meets its shore.
    const lakeFoam = new THREE.Mesh(new THREE.RingGeometry(W.lake.waterR - 1.2, W.lake.waterR + 2.6, 44), foamMat);
    lakeFoam.rotation.x = -Math.PI / 2;
    lakeFoam.position.set(W.lake.x, W.lake.waterY + 0.05, W.lake.z);
    lakeFoam.renderOrder = 3;
    scene.add(lakeFoam);
    animated.push({
      update(t) {
        if (qFrozen()) return;
        foamTex.offset.x = t * 0.008;
      },
    });
  }

  // City concrete pad under the grid. BUILD 16: slab-grid concrete
  // texture (repeat sized for ~7 m slabs) instead of flat colour.
  const pad = new THREE.Mesh(new THREE.PlaneGeometry(W.city.x1 - W.city.x0, W.city.z1 - W.city.z0),
    lam(PALETTE.sidewalk, { map: concreteTexture(true) }));
  pad.rotation.x = -Math.PI / 2;
  pad.position.set((W.city.x0 + W.city.x1) / 2, 0.605, (W.city.z0 + W.city.z1) / 2);
  pad.receiveShadow = true;
  scene.add(pad);

  // Boardwalk promenade between the shops and the sand.
  const walkTex = canvasTexture(128, (g, s) => {
    g.fillStyle = '#b0814d'; g.fillRect(0, 0, s, s);
    g.fillStyle = '#9a6f3f';
    for (let x = 0; x < s; x += 16) g.fillRect(x, 0, 2, s);
  }, [30, 1]);
  const walk = new THREE.Mesh(new THREE.PlaneGeometry(348, 9), new THREE.MeshLambertMaterial({ map: walkTex }));
  walk.rotation.x = -Math.PI / 2;
  walk.position.set(-5, 0.63, W.promenadeZ);
  walk.receiveShadow = true;
  scene.add(walk);

  // Roads: asphalt planes with centre dashes; crosswalk stripes at crossings.
  const asph = asphaltTexture();
  const roadMat = new THREE.MeshLambertMaterial({ map: asph });
  const crossMat = lam(0xe8e8e8);
  function road(x, z, w, l, vertical) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, l), roadMat);
    m.rotation.x = -Math.PI / 2;
    if (!vertical) m.rotation.z = Math.PI / 2;
    m.position.set(x, 0.64, z);
    m.receiveShadow = true;
    scene.add(m);
  }
  for (const x of W.avenues) road(x, 106, W.roadHalf * 2, 180, true);
  for (const z of W.streets) road(-5, z, W.roadHalf * 2, 326, false);
  road(-5, W.oceanDrive, W.roadHalf * 2, 326, false);
  road(-145, W.oceanDrive, 54, 16, false);   // airport access road
  const streetLines = W.streets.concat([W.oceanDrive]);
  for (const x of W.avenues) for (const z of streetLines) {
    for (let i = -2; i <= 2; i++) {
      if (i === 0) continue;
      // Zebra across the avenue (stripes elongated along z)…
      scene.add(box(0.8, 0.04, 4.6, crossMat, x + i * 2.6, 0.66, z - W.roadHalf + 1.2));
      scene.add(box(0.8, 0.04, 4.6, crossMat, x + i * 2.6, 0.66, z + W.roadHalf - 1.2));
      // …and across the street, so all four corners of the crossing read.
      scene.add(box(4.6, 0.04, 0.8, crossMat, x - W.roadHalf + 1.2, 0.66, z + i * 2.6));
      scene.add(box(4.6, 0.04, 0.8, crossMat, x + W.roadHalf - 1.2, 0.66, z + i * 2.6));
    }
    // Stop lines just outside the zebras at the signalled crossings.
    if (z === 80 || z === 125 || z === W.oceanDrive) {
      scene.add(box(7.2, 0.04, 0.6, crossMat, x, 0.66, z - W.roadHalf - 2.3));
      scene.add(box(7.2, 0.04, 0.6, crossMat, x, 0.66, z + W.roadHalf + 2.3));
      scene.add(box(0.6, 0.04, 7.2, crossMat, x - W.roadHalf - 2.3, 0.66, z));
      scene.add(box(0.6, 0.04, 7.2, crossMat, x + W.roadHalf + 2.3, 0.66, z));
    }
  }

  // ---- SIDEWALKS: raised light-concrete strips along every city road ----
  // A shade lighter than the pad beneath, so the curb line reads at a glance.
  // BUILD 7: two alternating concrete tints, segment by segment, so the
  // pavement reads as poured slabs instead of one flat strip (a plain
  // counter — no rng draws, the seeded layout is untouched).
  const swTex = concreteTexture(false);   // BUILD 16: grain + stains (no grid — it would stretch)
  const swMats = [lam(0xcdd2da, { map: swTex }), lam(0xc0c6cf, { map: swTex })];
  let swFlip = 0;
  function sidewalk(w, d, x, z) {
    const m = box(w, 0.14, d, swMats[swFlip++ % 2], x, 0.67, z);
    m.receiveShadow = true;
    scene.add(m);
  }
  const swOff = W.roadHalf + 1.3;
  // Along the avenues (north-south), in segments between the cross streets.
  const zBands = [[18, 35], [35, 80], [80, 125], [125, 168], [168, 194]];
  for (const a of W.avenues) for (const s of [-1, 1]) {
    for (const [zA, zB] of zBands) {
      const from = zA === 18 ? 18 : zA + W.roadHalf + 1.6;
      const to = zB === 194 ? 194 : zB - W.roadHalf - 1.6;
      if (to - from < 2) continue;
      sidewalk(2.4, to - from, a + s * swOff, (from + to) / 2);
    }
  }
  // Along the streets (east-west), in segments between the avenues.
  const xBands = [[-166, -150], [-150, -100], [-100, -50], [-50, 0], [0, 50], [50, 100], [100, 140], [140, 156]];
  for (const st of streetLines) for (const s of [-1, 1]) {
    if (st === W.oceanDrive && s === 1) continue;   // the promenade fronts the shops instead
    for (const [xA, xB] of xBands) {
      const from = xA === -166 ? -166 : xA + W.roadHalf + 1.6;
      const to = xB === 156 ? 156 : xB - W.roadHalf - 1.6;
      if (to - from < 2) continue;
      const mx = (from + to) / 2, mz = st + s * swOff;
      if (mx > W.park.x0 && mx < W.park.x1 && mz > W.park.z0 && mz < W.park.z1) continue;   // not through the park
      sidewalk(to - from, 2.4, mx, mz);
    }
  }

  // BUILD 7 — Ocean Drive boulevard dressing: a double yellow centre
  // line (broken at every avenue crossing and at the welcome arch),
  // drainage grates along the north kerb, and street-name signs.
  {
    const dblMat = lam(0xf7d154);
    const grateMat = lam(0x2c2f36);
    const avenueBands = W.avenues.map((a) => [a - 9.5, a + 9.5]);
    for (let x = -160; x + 9 <= 160; x += 10) {
      const hit = avenueBands.some(([a, b]) => x < b && x + 9 > a) || (x < 5 && x + 9 > -25);
      if (hit) continue;
      scene.add(box(9, 0.03, 0.35, dblMat, x + 4.5, 0.665, W.oceanDrive - 0.85));
      scene.add(box(9, 0.03, 0.35, dblMat, x + 4.5, 0.665, W.oceanDrive + 0.85));
    }
    for (let x = -150; x <= 150; x += 25) scene.add(box(1.3, 0.03, 0.55, grateMat, x, 0.66, W.oceanDrive - W.roadHalf + 0.5));
    function streetSign(text, x, z, ry) {
      const p = new THREE.Group();
      p.add(box(0.12, 3.1, 0.12, lam(0x33373d), 0, 1.55, 0));
      const s = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.65),
        new THREE.MeshBasicMaterial({ map: signTexture(text, '#1d6fb8'), side: THREE.DoubleSide }));
      s.position.y = 2.8;
      p.add(s);
      p.position.set(x, 0.6, z);
      p.rotation.y = ry;
      scene.add(p);
    }
    streetSign('OCEAN DR', 10.2, 158.2, 0);
    streetSign('PALM AVE', -39.2, 89.6, Math.PI / 2);
  }

  // The coastal highway loop and the north freeway, draped over the terrain.
  ribbon(scene, highwayLoopPoints(), 12, 0.22, true);
  ribbon(scene, FREEWAY_PTS, 15, 0.22, false);
  // Freeway centre dashes.
  {
    const dashMat = lam(0xf7d154);
    let acc = 0;
    for (let i = 0; i < FREEWAY_PTS.length - 1; i++) {
      const a = FREEWAY_PTS[i], b = FREEWAY_PTS[i + 1];
      const len = Math.hypot(b.x - a.x, b.z - a.z);
      const head = Math.atan2(b.x - a.x, b.z - a.z);
      for (let s = acc; s < len; s += 9) {
        const x = a.x + (b.x - a.x) * s / len, z = a.z + (b.z - a.z) * s / len;
        scene.add(box(0.35, 0.05, 3, dashMat, x, heightAt(x, z) + 0.26, z, head));
      }
      acc = (acc + len) % 9;
    }
  }

  // Traffic-light poles at the busiest crossings.
  const lightHeads = [];
  for (const x of [-50, 0, 50]) for (const z of [80, 125, W.oceanDrive]) {
    const pole = new THREE.Group();
    pole.add(box(0.22, 5.4, 0.22, lam(0x33373d), 0, 2.7, 0));
    pole.add(box(0.5, 1.3, 0.4, lam(0x1c1e24), 0, 5.2, 0));
    const lampR = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6), lam(0xff3333, { emissive: 0x550000 }));
    lampR.position.set(0, 5.55, 0.24); pole.add(lampR);
    const lampG = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6), lam(0x33ff66, { emissive: 0x005511 }));
    lampG.position.set(0, 4.85, 0.24); pole.add(lampG);
    pole.position.set(x + swOff, 0.6, z + swOff);
    scene.add(pole);
    lightHeads.push({ lampR, lampG });
  }

  // ---- Buildings: fill each block between roads, downtown tallest --------
  // Three window grids — day glass, warm-lit, mixed — so no two towers read
  // the same; ground floors get varied bands, awnings and named signs.
  const winTexes = [windowTexture(rng, 0.25), windowTexture(rng, 0.58), windowTexture(rng, 0.42)];
  const signCache = new Map();
  function buildingSign(label, bg) {
    const key = label + bg;
    if (!signCache.has(key)) signCache.set(key, signTexture(label, bg));
    return signCache.get(key);
  }
  const SIGN_LABELS = ['HOTEL', 'CAFE', 'GYM', 'DELI', 'MART', 'BOOKS', 'PIZZA', 'SUSHI', 'BAR', 'SALON'];
  const BAND_COLS = [0xe4572e, 0x2e86c8, 0x7ac74f, 0xf2b134, 0xef476f, 0x118ab2];
  function building(x, z, w, d, h, tone) {
    const g = new THREE.Group();
    // Build 8 de-stiffen: a deterministic per-lot facade lightness
    // (hash2 of the position — NO rng draw, so the seeded city layout
    // of builds 3-7 stays bit-identical).
    const toneC = new THREE.Color(tone).multiplyScalar(0.92 + hash2(x, z) * 0.16);
    const wallMat = new THREE.MeshLambertMaterial({ map: pick(rng, winTexes), color: toneC });
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat);
    body.position.y = h / 2;
    body.castShadow = true; body.receiveShadow = true;
    g.add(body);
    const skirt = new THREE.Mesh(new THREE.PlaneGeometry(w + 4.5, d + 4.5), aoMat);
    skirt.rotation.x = -Math.PI / 2;
    skirt.position.y = 0.05;
    skirt.renderOrder = 1;
    g.add(skirt);
    g.add(box(w + 0.5, 0.5, d + 0.5, lam(0x8a8f96), 0, h + 0.2, 0));       // parapet
    g.add(box(w * 0.4, 1.1, d * 0.4, lam(0x9aa0a8), 0, h + 0.9, 0));      // roof block
    // Rooftop clutter: AC units on most roofs, a water tower on tall ones.
    if (rng() > 0.35) g.add(box(range(rng, 1.6, 2.6), 0.9, range(rng, 1.4, 2.2), lam(0xb9bec6), range(rng, -w / 4, w / 4), h + 0.7, range(rng, -d / 4, d / 4)));
    if (rng() > 0.55) g.add(box(1.3, 0.7, 1.3, lam(0xa8adb5), range(rng, -w / 4, w / 4), h + 0.6, range(rng, -d / 4, d / 4)));
    if (h > 38 && rng() > 0.45) {
      const tx = w / 4, tz = -d / 4;
      for (const [lx, lz] of [[-0.8, -0.8], [0.8, -0.8], [-0.8, 0.8], [0.8, 0.8]]) {
        g.add(box(0.16, 1.6, 0.16, lam(0x6e4a2f), tx + lx, h + 0.8, tz + lz));
      }
      const tank = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.25, 2.3, 9), lam(0x9a6f3f));
      tank.position.set(tx, h + 2.7, tz);
      tank.castShadow = true;
      g.add(tank);
      const cone = new THREE.Mesh(new THREE.ConeGeometry(1.5, 0.9, 9), lam(0x8a5a33));
      cone.position.set(tx, h + 4.3, tz);
      g.add(cone);
    }
    const bandCol = pick(rng, BAND_COLS);
    g.add(box(w + 0.2, 1.0, 0.4, lam(bandCol), 0, 0.5, d / 2 + 0.1));     // shopfront band
    if (rng() > 0.45) {                                                  // awning over the band
      const awn = box(w * 0.72, 0.14, 1.7, lam(bandCol), 0, 2.6, d / 2 + 0.85);
      awn.rotation.x = 0.32;
      g.add(awn);
    }
    if (rng() > 0.5) {                                                   // a named sign
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(Math.min(w * 0.8, 10), 1.9),
        new THREE.MeshBasicMaterial({ map: buildingSign(pick(rng, SIGN_LABELS), '#123a5c') }));
      sign.position.set(0, 4.1, d / 2 + 0.16);
      g.add(sign);
    }
    // BUILD 7 realism (deterministic — no rng draws): a dark glass
    // storefront and an entrance step on the street face of every block,
    // and pilaster ribs up the corners of the tall towers.
    g.add(box(w * 0.86, 2.1, 0.22, lam(0x2c3540), 0, 1.55, d / 2 + 0.08));
    g.add(box(2.4, 0.16, 1.2, lam(0x8a8f96), 0, 0.08, d / 2 + 0.6));
    // BUILD 11: ornamental bushes flanking every entrance step — two
    // overlapping blobs in two greens (deterministic — no rng draws, so
    // the seeded city layout stays bit-identical).
    for (const bx of [-1.85, 1.85]) {
      const b1 = new THREE.Mesh(new THREE.SphereGeometry(0.46, 7, 6), lam(0x3f9433));
      b1.position.set(bx, 0.34, d / 2 + 0.6);
      b1.scale.y = 0.78;
      b1.castShadow = true;
      g.add(b1);
      const b2 = new THREE.Mesh(new THREE.SphereGeometry(0.3, 7, 6), lam(0x35702c));
      b2.position.set(bx + (bx < 0 ? -0.26 : 0.26), 0.52, d / 2 + 0.6);
      b2.castShadow = true;
      g.add(b2);
    }
    if (h > 30) for (const fx of [-w / 2 + 0.35, w / 2 - 0.35]) {
      g.add(box(0.55, h, 0.3, lam(0x8a8f96), fx, h / 2, d / 2 + 0.06));
    }
    g.position.set(x, 0.6, z);
    scene.add(g);
    colliders.push({ x0: x - w / 2 - 0.4, x1: x + w / 2 + 0.4, z0: z - d / 2 - 0.4, z1: z + d / 2 + 0.4 });
  }
  // Build 4 — density: every block is subdivided into sub-lots and nearly
  // every sub-lot gets a building (the old one-building-per-block left
  // most of each block an empty concrete lot — "gedungnya masih kurang").
  // Boundary strips (west edge, north frontage row) use the city edge
  // instead of a road margin so they can hold slim buildings too. The
  // tallest cluster stays downtown around avenues -50/0.
  const xs = [-172].concat(W.avenues, [162]);
  const zs = [14, 35, 80, 125, 160];
  for (let i = 0; i < xs.length - 1; i++) for (let j = 0; j < zs.length - 1; j++) {
    const x0 = i === 0 ? xs[i] + 2 : xs[i] + W.roadHalf + 2;
    const x1 = i === xs.length - 2 ? xs[i + 1] - 2 : xs[i + 1] - W.roadHalf - 2;
    const z0 = j === 0 ? zs[j] + 2 : zs[j] + W.roadHalf + 2;
    const z1 = zs[j + 1] - W.roadHalf - 2;
    const bw0 = x1 - x0, bd0 = z1 - z0;
    if (bw0 < 9 || bd0 < 9) continue;
    const nx = bw0 >= 27 ? 2 : 1;
    const nz = bd0 >= 21 ? 2 : 1;
    for (let a = 0; a < nx; a++) for (let b = 0; b < nz; b++) {
      if (rng() < 0.08) continue;   // the odd gap reads as a car park
      const lx0 = x0 + (bw0 / nx) * a, lx1 = x0 + (bw0 / nx) * (a + 1);
      const lz0 = z0 + (bd0 / nz) * b, lz1 = z0 + (bd0 / nz) * (b + 1);
      const cx = (lx0 + lx1) / 2, cz = (lz0 + lz1) / 2;
      if (cx > W.park.x0 - 4 && cx < W.park.x1 + 4 && cz > W.park.z0 - 4 && cz < W.park.z1 + 4) continue; // park
      const bw = (lx1 - lx0) - range(rng, 1.5, 3.5);
      const bd = (lz1 - lz0) - range(rng, 1.5, 3.5);
      if (bw < 7 || bd < 7) continue;
      const core = cx > -70 && cx < 20 && cz > 40 && cz < 120;
      let h = core ? range(rng, 26, 60) : (cz < 120 ? range(rng, 14, 34) : range(rng, 8, 20));
      if (j === 0) h = range(rng, 7, 13);        // low frontage on the north row
      if (i === 0) h = Math.min(h, 22);          // slim towers on the west edge
      // BUILD 7: reserved lots are built as usual (the rng draws above
      // and inside building() all happen, bit-identical to builds 3–6)
      // and then lifted straight back out — buildCity7 puts the fire
      // station, police HQ, dealership and the moto/gun shops there.
      const childBefore = scene.children.length;
      building(cx, cz, bw, bd, h, pick(rng, PALETTE.buildingTones));
      if (RESERVED_LOTS.some(([rx, rz]) => Math.abs(cx - rx) < 0.01 && Math.abs(cz - rz) < 0.01)) {
        scene.remove(scene.children[childBefore]);
        colliders.pop();
      }
    }
  }

  // Street dressing: lamps on the sidewalks, hydrants, post boxes.
  const lampMat = lam(0x2f3338);
  for (const x of W.avenues) for (let z = 26; z <= 186; z += 27) {
    const lamp = new THREE.Group();
    lamp.add(box(0.18, 5.6, 0.18, lampMat, 0, 2.8, 0));
    lamp.add(box(1.6, 0.16, 0.16, lampMat, 0.7, 5.5, 0));
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), lam(0xfff3b0, { emissive: 0x665511 }));
    bulb.position.set(1.4, 5.4, 0);
    lamp.add(bulb);
    lamp.position.set(x + swOff, 0.6, z);
    scene.add(lamp);
  }
  for (let i = 0; i < 12; i++) {
    const hx = pick(rng, W.avenues) + swOff;
    const hz = range(rng, 24, 160);
    const hyd = new THREE.Group();
    hyd.add(box(0.34, 0.7, 0.34, lam(0xd42a2a), 0, 0.35, 0));
    hyd.add(box(0.2, 0.2, 0.2, lam(0xf2f2f2), 0, 0.78, 0));
    hyd.position.set(hx, 0.6, hz);
    scene.add(hyd);
    scene.add(box(0.7, 1.1, 0.45, lam(0x1d6fb8), hx + 1.6, 1.15, hz + 2));
  }

  // ---- Street furniture: promenade benches, litter bins, a bus stop -----
  // Bench spots are shared with pedestrians.js, whose sitters use the same
  // coordinates (z 196.8, seat top = ground + 0.49, facing the sea).
  const benchMat = lam(0x7a4a21);
  const ironMat = lam(0x33373d);
  function makeBench() {
    const b = new THREE.Group();
    b.add(box(0.18, 0.44, 0.5, ironMat, -0.9, 0.22, 0));
    b.add(box(0.18, 0.44, 0.5, ironMat, 0.9, 0.22, 0));
    b.add(box(2.2, 0.1, 0.6, benchMat, 0, 0.44, 0));
    const back = box(2.2, 0.55, 0.09, benchMat, 0, 0.82, -0.28);
    back.rotation.x = -0.12;
    b.add(back);
    b.traverse((n) => { if (n.isMesh) n.castShadow = true; });
    return b;
  }
  for (const bx of [-150, -105, -60, -15, 30, 75, 120, 165]) {
    const bench = makeBench();
    bench.position.set(bx, groundHeight(bx, 196.8), 196.8);
    scene.add(bench);
  }
  const binMat = lam(0x2e5d43);
  for (const [bx, bz] of [[-140, 189.5], [-96, 189.5], [-52, 189.5], [44, 189.5], [88, 189.5], [132, 189.5], [88, 62], [34.6, 158.7]]) {
    const bin = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.3, 0.8, 8), binMat);
    bin.position.set(bx, groundHeight(bx, bz) + 0.4, bz);
    bin.castShadow = true;
    scene.add(bin);
  }
  // One bus stop on Ocean Drive's north sidewalk, shelter + bench + sign.
  {
    const stop = new THREE.Group();
    stop.add(box(0.14, 2.6, 0.14, ironMat, -2.2, 1.3, -0.7));
    stop.add(box(0.14, 2.6, 0.14, ironMat, 2.2, 1.3, -0.7));
    stop.add(box(5.2, 0.14, 1.9, lam(0x495057), 0, 2.62, 0));
    stop.add(box(5.0, 1.5, 0.06, lam(0x9fd8e8, { transparent: true, opacity: 0.45 }), 0, 1.35, -0.75));
    stop.add(box(4.2, 0.09, 0.45, benchMat, 0, 0.62, -0.45));
    stop.add(box(0.12, 2.9, 0.12, ironMat, 3.1, 1.45, 0.4));
    const bSign = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.7),
      new THREE.MeshBasicMaterial({ map: signTexture('BUS STOP', '#1d6fb8') }));
    bSign.position.set(3.1, 2.5, 0.42);
    stop.add(bSign);
    stop.position.set(30, groundHeight(30, 158.7), 158.7);
    stop.traverse((n) => { if (n.isMesh) n.castShadow = true; });
    scene.add(stop);
  }

  // The park: grass, a jogging path, palms and benches (all on the city pad).
  const grass = new THREE.Mesh(new THREE.PlaneGeometry(W.park.x1 - W.park.x0, W.park.z1 - W.park.z0), lam(PALETTE.grass));
  grass.rotation.x = -Math.PI / 2;
  grass.position.set((W.park.x0 + W.park.x1) / 2, 0.63, (W.park.z0 + W.park.z1) / 2);
  grass.receiveShadow = true;
  scene.add(grass);
  const path = new THREE.Mesh(new THREE.PlaneGeometry(W.park.x1 - W.park.x0 - 6, 3.4), lam(0xd9b380));
  path.rotation.x = -Math.PI / 2;
  path.position.set((W.park.x0 + W.park.x1) / 2, 0.65, 66);
  path.receiveShadow = true;
  scene.add(path);
  for (let i = 0; i < 12; i++) {
    // Alternate palms and leafy canopy trees so the park reads as a park.
    const p = i % 2 ? makeLeafyTree(rng, range(rng, 0.9, 1.2)) : makePalm(rng, range(rng, 6, 10));
    const px = range(rng, W.park.x0 + 4, W.park.x1 - 4), pz = range(rng, W.park.z0 + 4, W.park.z1 - 4);
    p.position.set(px, 0.6, pz);
    scene.add(p);
    addSway(animated, p, rng, i % 2 ? 0.012 : 0.022);
    const bench = box(2.2, 0.5, 0.7, lam(0x7a4a21), px + 2.4, 0.85, pz + 1);
    bench.castShadow = true;
    scene.add(bench);
  }

  buildAirport(scene, rng, colliders, animated);
  buildClinic(scene, colliders, sample7);
  buildBeachStrip(scene, rng, animated, r7);
  buildNorth(scene, rng, colliders, animated);
  buildLockup(scene, colliders);
  buildGulls(scene, rng, animated);
  buildCity7(scene, r7, colliders, animated, sample7);
  buildVegetation11(scene, animated);
  return { colliders, animated, lightHeads, sun };
}

// ---- Palmera Intl Airport: a reclaimed plateau at the south-west edge ---
// Runway, terminal with a readable sign, control tower, two parked jets,
// service vehicles and a fence line. Ocean Drive runs to its front door.
function buildAirport(scene, rng, colliders, animated) {
  const W = WORLD;
  const gy = 0.6;
  // The concrete slab reaching into the sea.
  const slab = box(W.airport.x1 - W.airport.x0 + 4, 3.4, W.airport.z1 - W.airport.z0 + 4, lam(0x9aa0a8),
    (W.airport.x0 + W.airport.x1) / 2, gy - 1.71, (W.airport.z0 + W.airport.z1) / 2);
  slab.receiveShadow = true;
  scene.add(slab);
  const apron = new THREE.Mesh(new THREE.PlaneGeometry(140, 160), lam(0x4a4e55));
  apron.rotation.x = -Math.PI / 2;
  apron.position.set(-190, gy + 0.04, 124);
  apron.receiveShadow = true;
  scene.add(apron);
  // Runway with dashes and threshold bars.
  const runway = new THREE.Mesh(new THREE.PlaneGeometry(17, 136), lam(0x2c2f36));
  runway.rotation.x = -Math.PI / 2;
  runway.position.set(-238, gy + 0.06, 128);
  runway.receiveShadow = true;
  scene.add(runway);
  for (let z = 70; z <= 186; z += 13) scene.add(box(0.7, 0.05, 6, lam(0xffffff), -238, gy + 0.09, z));
  for (let i = -3; i <= 3; i++) scene.add(box(1.1, 0.05, 7, lam(0xffffff), -238 + i * 2.2, gy + 0.09, 64));
  for (let z = 64; z <= 192; z += 16) {
    for (const x of [-247, -229]) {
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6), lam(0xfff3b0, { emissive: 0x665511 }));
      bulb.position.set(x, gy + 0.35, z);
      scene.add(bulb);
    }
  }
  // Terminal: main hall + glass front + the big readable sign.
  const term = new THREE.Group();
  term.add(box(20, 11, 36, lam(0xd9e4ec), 0, 5.5, 0));
  term.add(box(1.2, 6, 30, lam(0x9fd8e8), 10.2, 3.4, 0));
  term.add(box(22, 1, 38, lam(0x8a8f96), 0, 11.4, 0));
  const tSign = new THREE.Mesh(new THREE.PlaneGeometry(19, 3.2),
    new THREE.MeshBasicMaterial({ map: signTexture('PALMERA INTL', '#123a5c') }));
  tSign.position.set(10.9, 8.6, 0);
  tSign.rotation.y = Math.PI / 2;
  term.add(tSign);
  term.position.set(-196, gy, 70);
  scene.add(term);
  colliders.push({ x0: -206.4, x1: -185.6, z0: 51.6, z1: 88.4 });
  // Control tower + windsock.
  const tower = new THREE.Group();
  tower.add(box(4.5, 23, 4.5, lam(0xcfd8dc), 0, 11.5, 0));
  tower.add(box(7, 3.4, 7, lam(0x9fd8e8), 0, 24.4, 0));
  tower.add(box(7.6, 0.5, 7.6, lam(0x8a8f96), 0, 26.3, 0));
  tower.position.set(-188, gy, 152);
  scene.add(tower);
  colliders.push({ x0: -190.6, x1: -185.4, z0: 149.4, z1: 154.6 });
  const sock = new THREE.Group();
  sock.add(box(0.16, 5, 0.16, lam(0x33373d), 0, 2.5, 0));
  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.55, 2.4, 8), lam(0xe4572e));
  cone.rotation.z = Math.PI / 2 - 0.25;
  cone.position.set(1.3, 4.7, 0);
  sock.add(cone);
  sock.position.set(-206, gy, 140);
  scene.add(sock);
  animated.push({ update(t) { sock.rotation.y = Math.sin(t * 0.7) * 0.5 + 0.4; } });
  // Two parked jets, plus a third that works the route. BUILD 13: all
  // three rebuilt in the fleet Boeing's design language (build 9) —
  // smooth tapered fuselage, a dark cockpit-glass band wrapped over
  // the nose, a passenger window band with lighter panes down both
  // flanks, an accent cheatline and faired engine nacelles. Same
  // overall size and the same route, so the loop still clips nothing.
  function makePlane(color, x, z, ry, withCollider = true) {
    const g = new THREE.Group();
    const bodyMat = lam(0xf2f4f6);
    const glassMat = lam(0x18242e);
    const fus = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.7, 17, 12), bodyMat);
    fus.rotation.x = Math.PI / 2;
    fus.position.y = 3;
    fus.castShadow = true;
    g.add(fus);
    const nose = new THREE.Mesh(new THREE.SphereGeometry(1.7, 12, 9), bodyMat);
    nose.position.set(0, 3, 8.5);
    nose.scale.set(1, 0.92, 1.25);
    g.add(nose);
    const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 1.7, 2.6, 12), bodyMat);
    tail.rotation.x = Math.PI / 2;
    tail.position.set(0, 3.3, -9.6);
    g.add(tail);
    const apu = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.4, 0.5, 10), lam(0x2c2f36));
    apu.rotation.x = Math.PI / 2;
    apu.position.set(0, 3.38, -11);
    g.add(apu);
    // Cockpit glass: a dark band sloped over the nose, Boeing-style.
    const cockpit = box(2.5, 0.62, 1.5, glassMat, 0, 3.95, 7.9);
    cockpit.rotation.x = 0.38;
    g.add(cockpit);
    // Passenger windows: a row of dark panes down each flank on the
    // fuselage's widest line, over the accent cheatline — the fleet
    // Boeing's treatment (build 9), scaled to this smaller airframe.
    for (const s of [-1, 1]) {
      for (let i = 0; i < 10; i++) {
        g.add(box(0.06, 0.34, 0.6, glassMat, 1.66 * s, 3.38, -4.6 + i * 1.15));
      }
    }
    g.add(box(0.5, 0.28, 15, lam(color), 0, 2.95, 0));
    const wing = box(12.5, 0.24, 2.4, lam(0xd8dde2), 0, 2.6, 0.5);
    g.add(wing);
    for (const s of [-1, 1]) {
      const eng = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.55, 2.6, 10), lam(0xb9bec6));
      eng.rotation.x = Math.PI / 2;
      eng.position.set(3.4 * s, 1.9, 0.6);
      eng.castShadow = true;
      g.add(eng);
      const intake = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.1, 10), lam(0x14161a));
      intake.rotation.x = Math.PI / 2;
      intake.position.set(3.4 * s, 1.9, 1.92);
      g.add(intake);
      g.add(box(0.5, 1.1, 1.1, lam(0x33373d), 0.85 * s, 0.55, -2.5));
    }
    g.add(box(0.28, 3, 2, lam(color), 0, 5.4, -8));
    g.add(box(5.4, 0.24, 1.4, lam(0xd8dde2), 0, 4.2, -8.2));
    g.position.set(x, gy, z);
    g.rotation.y = ry;
    scene.add(g);
    if (withCollider) colliders.push({ x0: x - 7, x1: x + 7, z0: z - 9, z1: z + 9 });
    return g;
  }
  makePlane(0x2e86c8, -216, 108, 0.45);
  makePlane(0xe4572e, -224, 168, -0.35);

  // The working jet: a 90-second loop — takeoff roll down the runway,
  // a climbing tour right around the island, a long final over the sea,
  // touchdown, taxi to a stand, a pause, then back to the threshold.
  const flyer = makePlane(0x37b24d, -238, 196, Math.PI, false);
  flyer.rotation.order = 'YXZ';
  const ROUTE = [
    [0, -238, 0.6, 196], [3, -238, 0.6, 148], [6, -238, 0.6, 82],
    [8, -238, 7, 26], [12, -236, 27, -62], [18, -185, 47, -148],
    [28, 60, 60, -185], [40, 208, 55, 30], [50, 130, 38, 235],
    [56, -55, 20, 298], [60, -238, 7, 282], [63, -238, 0.6, 208],
    [67, -238, 0.6, 128], [71, -228, 0.6, 102], [76, -222, 0.6, 88],
    [82, -222, 0.6, 88], [86, -231, 0.6, 150], [90, -238, 0.6, 196],
  ];
  const flyerState = { heading: Math.PI };
  animated.push({
    update(t) {
      const tt = t % 90;
      let i = 0;
      while (i < ROUTE.length - 2 && ROUTE[i + 1][0] <= tt) i++;
      const a = ROUTE[i], b = ROUTE[i + 1];
      const u = Math.min(1, Math.max(0, (tt - a[0]) / (b[0] - a[0] || 1)));
      const x = a[1] + (b[1] - a[1]) * u;
      const y = a[2] + (b[2] - a[2]) * u;
      const z = a[3] + (b[3] - a[3]) * u;
      flyer.position.set(x, y, z);
      const dx = b[1] - a[1], dy = b[2] - a[2], dz = b[3] - a[3];
      const dh = Math.hypot(dx, dz);
      if (dh > 0.5) flyerState.heading = Math.atan2(dx, dz);
      flyer.rotation.y = flyerState.heading;
      flyer.rotation.x = dh > 0.5 ? -Math.atan2(dy, dh) * 0.8 : 0;
    },
  });
  // Service vehicles: a fuel tanker and a baggage-cart train.
  const tanker = new THREE.Group();
  const tank = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.3, 6.4, 10), lam(0xf2b134));
  tank.rotation.z = Math.PI / 2;
  tank.position.y = 1.8;
  tanker.add(tank);
  tanker.add(box(1.9, 1.5, 2, lam(0xf2f4f6), 4.1, 1.15, 0));
  tanker.add(box(0.08, 0.62, 1.5, lam(0x18242e), 5.06, 1.45, 0));   // BUILD 13: cab glass
  tanker.add(box(7.6, 0.5, 2.2, lam(0x33373d), 0, 0.45, 0));
  tanker.position.set(-206, gy, 128);
  tanker.rotation.y = 0.2;
  scene.add(tanker);
  for (let i = 0; i < 3; i++) {
    const cart = new THREE.Group();
    cart.add(box(2.2, 1, 1.3, lam(0x9fd8e8), 0, 0.85, 0));
    cart.add(box(2.4, 0.3, 1.5, lam(0x33373d), 0, 0.3, 0));
    // BUILD 13: wheels, a tow bar and a canvas hoop so the carts read
    // as baggage carts, not crates.
    for (const [wx, wz] of [[-0.85, 0.62], [0.85, 0.62], [-0.85, -0.62], [0.85, -0.62]]) {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.21, 0.09, 8), lam(0x1c1e24));
      wheel.rotation.x = Math.PI / 2;
      wheel.position.set(wx, 0.21, wz);
      cart.add(wheel);
    }
    cart.add(box(1.1, 0.09, 0.09, lam(0x33373d), 1.65, 0.32, 0));
    cart.position.set(-208 - i * 3.1, gy, 92);
    scene.add(cart);
  }
  // BUILD 7 — terminal and apron realism: DEPARTURES / ARRIVALS signs
  // under the main board, a blinking tower beacon + antenna, apron
  // lead-in lines, stop bars and stand boards (all deterministic).
  for (const [label, lz] of [['DEPARTURES', -10], ['ARRIVALS', 10]]) {
    const s = new THREE.Mesh(new THREE.PlaneGeometry(11, 2),
      new THREE.MeshBasicMaterial({ map: signTexture(label, '#1d6fb8') }));
    s.position.set(-185.7, gy + 4.4, 70 + lz);
    s.rotation.y = Math.PI / 2;
    scene.add(s);
  }
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.32, 8, 6),
    lam(0xff3333, { emissive: 0xaa0000 }));
  beacon.position.set(-188, gy + 28.6, 152);
  scene.add(beacon);
  scene.add(box(0.12, 2.6, 0.12, lam(0x33373d), -188, gy + 27.4, 152));
  animated.push({ update(t) { beacon.visible = Math.sin(t * 2.4) > -0.2; } });
  const lineMat = lam(0xf7d154);
  for (let z = 62; z <= 190; z += 8) scene.add(box(0.35, 0.04, 4.5, lineMat, -222, gy + 0.08, z));
  for (const [sx, sz] of [[-192, 181], [-160, 141], [-155, 91]]) {
    scene.add(box(4.6, 0.04, 0.4, lineMat, sx, gy + 0.08, sz));
  }
  for (const [label, sx, sz] of [['A1', -185, 181], ['A2', -153, 141], ['A3', -148, 91]]) {
    const p = new THREE.Group();
    p.add(box(0.1, 1.3, 0.1, lam(0x33373d), 0, 0.65, 0));
    const s = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.75),
      new THREE.MeshBasicMaterial({ map: signTexture(label, '#33373d'), side: THREE.DoubleSide }));
    s.position.y = 1.55;
    p.add(s);
    p.position.set(sx, gy, sz);
    scene.add(p);
  }
  // Perimeter fence along the plateau's city edge.
  for (let z = 46; z <= 202; z += 9) scene.add(box(0.14, 1.6, 0.14, lam(0x8a8f96), -120, gy + 0.8, z));
  scene.add(box(0.08, 0.12, 160, lam(0x8a8f96), -120, gy + 1.55, 124));
}

// ---- Palmera General Hospital (BUILD 7): the old Bay Clinic grew into
// a full hospital on the same site — a four-storey window-grid block,
// red-cross emblem, a big readable HOSPITAL sign, a columned entrance
// canopy, a helipad on the roof and a marked ambulance bay at the front
// (the fleet ambulance from build 6 parks in it, placed by main.js).
function buildClinic(scene, colliders, sample7) {
  const g = new THREE.Group();
  const wallMat = new THREE.MeshLambertMaterial({ map: windowTexture(makeRng(777003), 0.3), color: 0xf7f7f2 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(24, 15, 11), wallMat);
  body.position.y = 7.5;
  body.castShadow = true; body.receiveShadow = true;
  g.add(body);
  g.add(box(24.6, 0.8, 11.6, lam(0xd42a2a), 0, 15.3, 0));            // red roof band
  g.add(box(24.4, 1.0, 0.4, lam(0xffffff), 0, 3.6, 5.55));           // entrance band
  // Red-cross emblem + the HOSPITAL sign across the front.
  g.add(box(0.8, 2.4, 0.25, lam(0xd42a2a), -8.6, 12.4, 5.6));
  g.add(box(2.4, 0.8, 0.25, lam(0xd42a2a), -8.6, 12.4, 5.6));
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(13.5, 2.7),
    new THREE.MeshBasicMaterial({ map: signTexture('HOSPITAL', '#b02020') }));
  sign.position.set(2.6, 12.4, 5.66);
  g.add(sign);
  // Glass entrance doors under a red canopy on two columns.
  g.add(box(4.6, 3.2, 0.3, lam(0x9fd8e8), 0, 1.6, 5.6));
  g.add(box(10.5, 0.35, 3.8, lam(0xd42a2a), 0, 3.75, 7.3));
  for (const cx of [-4.8, 4.8]) g.add(box(0.35, 3.6, 0.35, lam(0x8a8f96), cx, 1.8, 9.0));
  // Helipad on the roof: dark disc, white ring, and an H of white bars.
  const disc = new THREE.Mesh(new THREE.CircleGeometry(4.4, 24), lam(0x3c4148));
  disc.rotation.x = -Math.PI / 2;
  disc.position.set(5.5, 15.72, 0);
  g.add(disc);
  const ring = new THREE.Mesh(new THREE.RingGeometry(3.85, 4.3, 24),
    new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(5.5, 15.74, 0);
  g.add(ring);
  g.add(box(0.55, 0.04, 2.7, lam(0xffffff), 4.7, 15.74, 0));
  g.add(box(0.55, 0.04, 2.7, lam(0xffffff), 6.3, 15.74, 0));
  g.add(box(1.1, 0.04, 0.55, lam(0xffffff), 5.5, 15.74, 0));
  g.position.set(-128, 0.6, WORLD.shopsZ);
  g.traverse((n) => { if (n.isMesh) n.castShadow = true; });
  scene.add(g);
  colliders.push({ x0: -140.4, x1: -115.6, z0: 174.1, z1: 185.9 });
  if (sample7) sample7('hospital', -128, WORLD.shopsZ, 0.6, 'heightAt');
  // The ambulance bay: painted lines on the boards in front of the
  // entrance + a standing bay sign. The fleet ambulance (build 6,
  // main.js) parks at (-120, 191), right in this bay.
  const bayMat = lam(0xffffff);
  scene.add(box(8.6, 0.03, 0.32, bayMat, -120, 0.665, 188.9));
  scene.add(box(8.6, 0.03, 0.32, bayMat, -120, 0.665, 193.3));
  const bay = new THREE.Group();
  bay.add(box(0.1, 1.5, 0.1, lam(0x33373d), 0, 0.75, 0));
  const bs = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.6),
    new THREE.MeshBasicMaterial({ map: signTexture('AMBULANCE', '#b02020'), side: THREE.DoubleSide }));
  bs.position.y = 1.7;
  bay.add(bs);
  bay.position.set(-115.2, 0.6, 193.2);
  scene.add(bay);
}

// Palms: a CURVED, tapered trunk of stacked ring segments leaning a
// little further with every segment, and a proper frond crown — nine
// fronds, each three chained segments arcing up then drooping, two dead
// fronds hanging below, and a coconut cluster under the crown. (Build 4:
// the old flat box-star crown read as a green asterisk, not a tree.)
export function makePalm(rng, h = 7) {
  const g = new THREE.Group();
  const trunkMats = [lam(0x8a6844), lam(0x77572f)];   // alternating = ringed trunk
  const segs = 6;
  const segLen = h / segs;
  const leanDir = rng() * Math.PI * 2;
  const leanMax = range(rng, 0.10, 0.30);             // total bend at the top
  const up = new THREE.Vector3(0, 1, 0);
  let base = new THREE.Vector3(0, 0, 0);
  let top = base.clone();
  for (let i = 0; i < segs; i++) {
    const tilt = leanMax * (i + 0.5) / segs;
    const dir = new THREE.Vector3(Math.cos(leanDir) * Math.sin(tilt), Math.cos(tilt), Math.sin(leanDir) * Math.sin(tilt));
    const r0 = 0.30 * (1 - (i / segs) * 0.42);
    const r1 = 0.30 * (1 - ((i + 1) / segs) * 0.42);
    const seg = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, segLen + 0.05, 6), trunkMats[i % 2]);
    seg.quaternion.setFromUnitVectors(up, dir);
    seg.position.copy(base).addScaledVector(dir, segLen / 2);
    seg.castShadow = true;
    g.add(seg);
    top = base.clone().addScaledVector(dir, segLen);
    base = top;
  }
  // Frond crown: chained segments — rise, flatten, droop.
  const greens = [0x2f9e44, 0x37b24d, 0x2a8f3e];
  const nF = 9;
  for (let k = 0; k < nF; k++) {
    const frond = new THREE.Group();
    frond.position.copy(top);
    frond.rotation.y = (k / nF) * Math.PI * 2 + range(rng, -0.2, 0.2);
    let joint = frond;
    const angles = [-0.62 + range(rng, -0.08, 0.08), 0.48, 0.85];
    const lens = [1.05, 1.0, 0.85];
    for (let s = 0; s < 3; s++) {
      const j = new THREE.Group();
      if (s > 0) j.position.z = lens[s - 1];
      j.rotation.x = angles[s];
      j.add(box(0.15 - s * 0.03, 0.045, lens[s] + 0.06, lam(greens[(k + s) % 3]), 0, 0, lens[s] / 2));
      joint.add(j);
      joint = j;
    }
    g.add(frond);
  }
  // Two dead fronds hanging straight down from the crown.
  for (let k = 0; k < 2; k++) {
    const frond = new THREE.Group();
    frond.position.copy(top);
    frond.rotation.y = rng() * Math.PI * 2;
    const j = new THREE.Group();
    j.rotation.x = 1.15;
    j.add(box(0.11, 0.04, 1.15, lam(0xa98a54), 0, 0, 0.55));
    frond.add(j);
    g.add(frond);
  }
  // Coconut cluster tucked under the crown.
  const nutMat = lam(0x6a8f3f);
  for (const [nx, nz] of [[0.14, 0.05], [-0.13, 0.1], [0.02, -0.15]]) {
    const nut = new THREE.Mesh(new THREE.SphereGeometry(0.17, 6, 5), nutMat);
    nut.position.set(top.x + nx, top.y - 0.16, top.z + nz);
    nut.castShadow = true;
    g.add(nut);
  }
  g.traverse((n) => { if (n.isMesh) n.castShadow = true; });
  return g;
}

// A leafy park tree: tapered trunk, a branch split, and a canopy of three
// overlapping faceted blobs at varied offsets — no two trees alike
// (per-tree rotation, scale and green). Used in the park and the hamlet.
export function makeLeafyTree(rng, s = 1) {
  const g = new THREE.Group();
  const trunkMat = lam(0x6e4a2f);
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.14 * s, 0.24 * s, 1.7 * s, 6), trunkMat);
  trunk.position.y = 0.85 * s;
  trunk.castShadow = true;
  g.add(trunk);
  for (const sd of [-1, 1]) {
    const br = new THREE.Mesh(new THREE.CylinderGeometry(0.07 * s, 0.11 * s, 1.15 * s, 5), trunkMat);
    br.position.set(0.28 * sd * s, 1.95 * s, 0);
    br.rotation.z = -0.55 * sd;
    br.castShadow = true;
    g.add(br);
  }
  const greens = [0x4da33f, 0x5cb84d, 0x3f9433, 0x69b34c];
  const blobs = [[0, 3.05, 0, 1.5], [0.85, 2.55, 0.3, 1.12], [-0.78, 2.62, -0.32, 0.98]];
  blobs.forEach(([bx, by, bz, br], i) => {
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(br * s, 0), lam(greens[(Math.floor(rng() * 4) + i) % 4]));
    m.position.set(bx * s, by * s, bz * s);
    m.rotation.set(rng() * 3, rng() * 3, rng() * 3);
    m.castShadow = true;
    g.add(m);
  });
  g.rotation.y = rng() * Math.PI * 2;
  g.scale.setScalar(s * range(rng, 0.85, 1.25));
  return g;
}

// ---- BUILD 11 tree species ------------------------------------------------
// A fan palm: shorter and stouter than the coconut palm, its crown a wide
// flat FAN of broad fronds — the ornamental palm for medians and shop
// fronts, where the tall coconut would overwhelm the street.
export function makeFanPalm(rng, h = 4) {
  const g = new THREE.Group();
  const trunkMats = [lam(0x8a6844), lam(0x77572f)];
  const segs = 4;
  const segLen = h / segs;
  const leanDir = rng() * Math.PI * 2;
  const leanMax = range(rng, 0.04, 0.12);
  const up = new THREE.Vector3(0, 1, 0);
  let base = new THREE.Vector3(0, 0, 0);
  let top = base.clone();
  for (let i = 0; i < segs; i++) {
    const tilt = leanMax * (i + 0.5) / segs;
    const dir = new THREE.Vector3(Math.cos(leanDir) * Math.sin(tilt), Math.cos(tilt), Math.sin(leanDir) * Math.sin(tilt));
    const r0 = 0.26 * (1 - (i / segs) * 0.35);
    const r1 = 0.26 * (1 - ((i + 1) / segs) * 0.35);
    const seg = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, segLen + 0.05, 6), trunkMats[i % 2]);
    seg.quaternion.setFromUnitVectors(up, dir);
    seg.position.copy(base).addScaledVector(dir, segLen / 2);
    g.add(seg);
    top = base.clone().addScaledVector(dir, segLen);
    base = top;
  }
  // The fan: eleven broad fronds in a near-flat ring, tips drooping, plus
  // three younger fronds standing up out of the centre.
  const greens = [0x2f9e44, 0x37b24d, 0x2a8f3e];
  const nF = 11;
  for (let k = 0; k < nF; k++) {
    const frond = new THREE.Group();
    frond.position.copy(top);
    frond.rotation.y = (k / nF) * Math.PI * 2 + range(rng, -0.15, 0.15);
    const j = new THREE.Group();
    j.rotation.x = range(rng, 0.18, 0.5);           // rise a touch, then flatten
    j.add(box(0.52, 0.04, 1.95, lam(greens[k % 3]), 0, 0, 0.98));
    const tip = new THREE.Group();
    tip.position.z = 1.95;
    tip.rotation.x = 0.55;                          // the drooping tip
    tip.add(box(0.4, 0.04, 0.8, lam(greens[(k + 1) % 3]), 0, 0, 0.4));
    j.add(tip);
    frond.add(j);
    g.add(frond);
  }
  for (let k = 0; k < 3; k++) {
    const frond = new THREE.Group();
    frond.position.copy(top);
    frond.rotation.y = rng() * Math.PI * 2;
    const j = new THREE.Group();
    j.rotation.x = -0.55;
    j.add(box(0.3, 0.04, 1.3, lam(0x37b24d), 0, 0, 0.65));
    frond.add(j);
    g.add(frond);
  }
  g.traverse((n) => { if (n.isMesh) n.castShadow = true; });
  return g;
}

// A shade tree: taller trunk, three limbs and a FULL five-blob canopy —
// the dense round crown that actually throws shade on a downtown
// sidewalk (the leafy park tree's three blobs read thin at street scale).
export function makeShadeTree(rng, s = 1) {
  const g = new THREE.Group();
  const trunkMat = lam(0x6e4a2f);
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.19 * s, 0.32 * s, 2.6 * s, 7), trunkMat);
  trunk.position.y = 1.3 * s;
  trunk.castShadow = true;
  g.add(trunk);
  for (const [sd, sz] of [[-1, 0.2], [1, -0.3], [0, 1]]) {
    const br = new THREE.Mesh(new THREE.CylinderGeometry(0.08 * s, 0.13 * s, 1.5 * s, 5), trunkMat);
    br.position.set(0.42 * sd * s, 2.95 * s, 0.3 * sz * s);
    br.rotation.z = -0.6 * sd;
    br.rotation.x = 0.35 * sz;
    br.castShadow = true;
    g.add(br);
  }
  const greens = [0x4da33f, 0x5cb84d, 0x3f9433, 0x69b34c];
  const blobs = [[0, 4.35, 0, 2.05], [1.5, 3.75, 0.5, 1.5], [-1.45, 3.85, -0.4, 1.45], [0.5, 3.65, -1.2, 1.3], [-0.4, 4.95, 0.7, 1.35]];
  blobs.forEach(([bx, by, bz, br], i) => {
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(br * s, 1), lam(greens[(Math.floor(rng() * 4) + i) % 4]));
    m.position.set(bx * s, by * s, bz * s);
    m.rotation.set(rng() * 3, rng() * 3, rng() * 3);
    m.castShadow = true;
    g.add(m);
  });
  g.rotation.y = rng() * Math.PI * 2;
  g.scale.setScalar(s * range(rng, 0.9, 1.2));
  return g;
}

// A flowering accent tree: the leafy tree's frame, but half the canopy is
// blossom — warm pink or orange blobs dusted with tiny flower spheres.
// Planted SPARSELY as accents (park, hospital front, housing street).
export function makeFloweringTree(rng, s = 1, blossom = 0xff8fb8) {
  const g = new THREE.Group();
  const trunkMat = lam(0x6e4a2f);
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.13 * s, 0.22 * s, 1.9 * s, 6), trunkMat);
  trunk.position.y = 0.95 * s;
  trunk.castShadow = true;
  g.add(trunk);
  for (const sd of [-1, 1]) {
    const br = new THREE.Mesh(new THREE.CylinderGeometry(0.06 * s, 0.1 * s, 1.2 * s, 5), trunkMat);
    br.position.set(0.3 * sd * s, 2.15 * s, 0);
    br.rotation.z = -0.55 * sd;
    br.castShadow = true;
    g.add(br);
  }
  const greens = [0x4da33f, 0x5cb84d];
  const blobs = [[0, 3.25, 0, 1.35, 0], [0.9, 2.8, 0.3, 1.05, 1], [-0.85, 2.9, -0.3, 0.95, 0], [0.15, 3.7, -0.5, 0.9, 1]];
  const blossomMat = lam(blossom);
  blobs.forEach(([bx, by, bz, br, isBlossom], i) => {
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(br * s, 0),
      isBlossom ? blossomMat : lam(greens[i % 2]));
    m.position.set(bx * s, by * s, bz * s);
    m.rotation.set(rng() * 3, rng() * 3, rng() * 3);
    m.castShadow = true;
    g.add(m);
    if (isBlossom) {
      for (let d = 0; d < 4; d++) {
        const dot = new THREE.Mesh(new THREE.SphereGeometry(0.1 * s, 5, 4), blossomMat);
        const th = rng() * Math.PI * 2, ph = range(rng, -0.4, 1.1);
        dot.position.set((bx + Math.cos(th) * Math.cos(ph) * br * 0.95) * s,
          (by + Math.sin(ph) * br * 0.95) * s, (bz + Math.sin(th) * Math.cos(ph) * br * 0.95) * s);
        g.add(dot);
      }
    }
  });
  g.rotation.y = rng() * Math.PI * 2;
  g.scale.setScalar(s * range(rng, 0.9, 1.15));
  return g;
}

function buildBeachStrip(scene, rng, animated, r7) {
  const W = WORLD;

  // The giant lifeguard statue — Palmera Bay's original landmark.
  const statue = new THREE.Group();
  const stone = lam(0xd8cfc0);
  statue.add(box(6, 1.6, 6, lam(0x9aa0a8), 0, 0.8, 0));
  statue.add(box(1.6, 4.6, 1.1, stone, -1.1, 3.9, 0));
  statue.add(box(1.6, 4.6, 1.1, stone, 1.1, 3.9, 0));
  statue.add(box(4.4, 4.4, 2.2, stone, 0, 8.4, 0));
  statue.add(box(4.9, 1.5, 2.4, lam(0xd42a2a), 0, 10.2, 0));        // rescue-can red band
  statue.add(box(1.2, 3.6, 1.2, stone, -2.6, 8.2, 0));              // arms
  statue.add(box(1.2, 3.6, 1.2, stone, 2.6, 8.2, 0));
  statue.add(box(2.6, 2.6, 2.6, stone, 0, 12.6, 0));               // big head, on theme
  statue.add(box(2.8, 0.7, 2.8, lam(0xf2b134), 0, 14.2, 0));        // cap
  statue.position.set(W.statue.x, heightAt(W.statue.x, W.statue.z), W.statue.z);
  statue.traverse((n) => { if (n.isMesh) n.castShadow = true; });
  scene.add(statue);

  // Wooden pier reaching into the water, deck at y 1.05 (groundHeight agrees).
  const pierMat = lam(0x9a6f3f);
  const pier = new THREE.Group();
  pier.add(box(7, 0.35, W.pier.z1 - W.pier.z0, pierMat, 0, 0.875, (W.pier.z0 + W.pier.z1) / 2));
  pier.add(box(7.6, 0.18, 1.4, pierMat, 0, 0.70, W.pier.z0 - 1.2));   // entrance steps
  pier.add(box(7.6, 0.18, 1.4, pierMat, 0, 0.88, W.pier.z0 - 0.3));
  for (let z = W.pier.z0 + 3; z < W.pier.z1; z += 7) {
    pier.add(box(0.35, 2.4, 0.35, pierMat, -3.1, 0, z));
    pier.add(box(0.35, 2.4, 0.35, pierMat, 3.1, 0, z));
    pier.add(box(0.14, 2.4, 0.14, lam(0x33373d), -3.3, 2.0, z));
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), lam(0xfff3b0, { emissive: 0x665511 }));
    bulb.position.set(-3.3, 3.3, z); pier.add(bulb);
  }
  pier.add(box(6.4, 3, 6, lam(0xe4572e), 0, 2.55, W.pier.z1 - 3));
  pier.add(box(7.2, 0.3, 6.8, lam(0x8a4a2a), 0, 4.2, W.pier.z1 - 3));
  pier.position.x = W.pier.x;
  pier.traverse((n) => { if (n.isMesh) n.castShadow = true; });
  scene.add(pier);

  // Boats: a slow ship on the horizon and a small boat near the shore.
  // BUILD 13: smooth two-tone hulls (rounded bilge, raked bow wedge,
  // gunwale stripe) and a glassed cabin — the boxy hull + slab cabin +
  // sail board of the old builder are retired. Drift/bob animation
  // below is untouched; the bow is local +z, yawed to lead the drift.
  const boats = [];
  function boat(color, scale) {
    const b = new THREE.Group();
    const s = scale;
    const bilge = new THREE.Mesh(new THREE.SphereGeometry(1.12 * s, 10, 8), lam(color));
    bilge.scale.set(1, 0.5, 2.55);
    bilge.position.y = 0.42 * s;
    bilge.castShadow = true;
    b.add(bilge);
    b.add(box(2.2 * s, 0.55 * s, 5.3 * s, lam(0xf2f4f6), 0, 0.82 * s, -0.3 * s));   // topsides
    b.add(box(2.26 * s, 0.15 * s, 5.36 * s, lam(color), 0, 1.12 * s, -0.3 * s));    // gunwale stripe
    const bow = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 1.08 * s, 1.7 * s, 4), lam(color));
    bow.rotation.x = Math.PI / 2;
    bow.rotation.y = Math.PI / 4;
    bow.scale.set(1.45, 1, 0.62);
    bow.position.set(0, 0.72 * s, 3.05 * s);
    bow.castShadow = true;
    b.add(bow);
    // Cabin with a dark glass band and a roof overhang.
    b.add(box(1.8 * s, 0.85 * s, 1.7 * s, lam(0xf2f2f2), 0, 1.45 * s, -0.9 * s));
    b.add(box(1.86 * s, 0.36 * s, 1.76 * s, lam(0x18242e), 0, 1.62 * s, -0.9 * s));
    b.add(box(2.0 * s, 0.12 * s, 1.95 * s, lam(color), 0, 1.94 * s, -0.9 * s));
    // Mast with a crossbar light, and a stern rail.
    b.add(box(0.14 * s, 2.6 * s, 0.14 * s, lam(0x8a8f96), 0, 2.6 * s, 0.9 * s));
    b.add(box(1.1 * s, 0.09 * s, 0.09 * s, lam(0x8a8f96), 0, 3.6 * s, 0.9 * s));
    b.add(box(1.9 * s, 0.07 * s, 0.07 * s, lam(0x8a8f96), 0, 1.25 * s, -2.9 * s));
    return b;
  }
  const ship = boat(0xd42a2a, 2.6);
  ship.position.set(-140, 0.4, 292);
  ship.rotation.y = Math.PI / 2;   // bow along its eastward drift
  scene.add(ship); boats.push({ g: ship, speed: 1.1, base: 0.4 });
  const b2 = boat(0xf2b134, 1);
  b2.position.set(60, 0.25, 264);
  b2.rotation.y = -Math.PI / 2;    // bow along its westward drift
  scene.add(b2); boats.push({ g: b2, speed: -0.7, base: 0.25 });
  animated.push({ update(t) { for (const b of boats) { b.g.position.x += Math.sin(t * 0.05) * 0.002 + b.speed * 0.016; if (b.g.position.x > 260) b.g.position.x = -260; if (b.g.position.x < -260) b.g.position.x = 260; b.g.position.y = b.base + Math.sin(t * 1.3 + b.base * 9) * 0.12; b.g.rotation.z = Math.sin(t + b.base * 7) * 0.03; } } });

  // Jetskis zipping parallel to the shore. BUILD 13: rounded hull,
  // stepped seat, front cowl and a real handlebar — the two stacked
  // boxes are retired. Route, speed and bob below are untouched.
  const skis = [];
  for (let i = 0; i < 2; i++) {
    const s = new THREE.Group();
    const col = i ? 0x06d6a0 : 0xef476f;
    const hull = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), lam(col));
    hull.scale.set(0.55, 0.30, 1.35);
    hull.position.y = 0.30;
    hull.castShadow = true;
    s.add(hull);
    s.add(box(0.8, 0.16, 1.7, lam(0xf2f4f6), 0, 0.52, -0.15));            // deck
    s.add(box(0.52, 0.20, 1.05, lam(0x22242a), 0, 0.66, -0.5));           // seat
    const cowl = new THREE.Mesh(new THREE.SphereGeometry(0.42, 9, 7), lam(col));
    cowl.scale.set(0.95, 0.75, 1.15);
    cowl.position.set(0, 0.55, 0.72);
    cowl.castShadow = true;
    s.add(cowl);
    s.add(box(0.10, 0.30, 0.10, lam(0x22242a), 0, 0.78, 0.55));           // steering stem
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.56, 7), lam(0x22242a));
    bar.rotation.z = Math.PI / 2;
    bar.position.set(0, 0.94, 0.55);
    s.add(bar);
    s.position.set(-60 + i * 90, 0.3, 246 + i * 8);
    scene.add(s);
    skis.push({ g: s, dir: i ? -1 : 1, speed: 13 + i * 4, z: 246 + i * 8 });
  }
  animated.push({ update(t, dt) { for (const s of skis) { s.g.position.x += s.dir * s.speed * dt; if (s.g.position.x > 210) s.dir = -1; if (s.g.position.x < -210) s.dir = 1; s.g.rotation.y = s.dir > 0 ? Math.PI / 2 : -Math.PI / 2; s.g.position.y = 0.3 + Math.abs(Math.sin(t * 5 + s.z)) * 0.16; } } });

  // Palms along the promenade.
  for (let x = -168; x <= 178; x += 17) {
    const px = x + range(rng, -2, 2), pz = 190 + range(rng, -1, 1);
    const p = makePalm(rng, range(rng, 6, 9));
    p.position.set(px, groundHeight(px, pz), pz);
    scene.add(p);
    addSway(animated, p, rng);
  }

  // Flags that flap: at the pier entrance, the statue plaza and the park.
  for (const [fx, fz, fcol] of [[3.5, 196.5, 0x12b5a5], [-104, 199, 0xe4572e], [88, 90, 0xf2b134]]) {
    const pole = new THREE.Group();
    const fy = groundHeight(fx, fz);
    pole.add(box(0.12, 7, 0.12, lam(0x8a8f96), 0, 3.5, 0));
    const flagPivot = new THREE.Group();
    flagPivot.position.set(0, 6.5, 0);
    const flag = box(1.7, 0.95, 0.05, lam(fcol), 0.9, 0, 0);
    flagPivot.add(flag);
    pole.add(flagPivot);
    pole.position.set(fx, fy, fz);
    scene.add(pole);
    const fph = fx * 0.7;
    animated.push({ update(t) { flagPivot.rotation.y = Math.sin(t * 2.2 + fph) * 0.4; flag.rotation.y = Math.sin(t * 4.6 + fph) * 0.28; } });
  }

  // ---- Ferris wheel: two rims, spokes, cabins, a slow stately spin -------
  const ferris = new THREE.Group();
  const rimMat = lam(0xe4572e);
  const wheel = new THREE.Group();
  const rim1 = new THREE.Mesh(new THREE.TorusGeometry(11, 0.35, 6, 24), rimMat);
  const rim2 = rim1.clone(); rim2.position.z = 1.6;
  wheel.add(rim1); wheel.add(rim2);
  const cabinCols = [0xef476f, 0xffd23e, 0x06d6a0, 0x118ab2, 0x9b5de5, 0xf15bb5];
  const cabins = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const spoke = box(0.22, 22, 0.22, rimMat, 0, 0, 0.8);
    spoke.rotation.z = a;
    wheel.add(spoke);
    const cab = box(2.2, 1.9, 2.2, lam(cabinCols[i % cabinCols.length]), Math.cos(a) * 11, Math.sin(a) * 11, 0.8);
    cab.castShadow = true;
    wheel.add(cab);
    cabins.push({ mesh: cab, angle: a });
  }
  wheel.position.set(0, 13.5, 0.8);
  ferris.add(wheel);
  ferris.add(box(1, 14, 1, lam(0x495057), -4.5, 7, 0.8));
  ferris.add(box(1, 14, 1, lam(0x495057), 4.5, 7, 0.8));
  ferris.add(box(15, 1.2, 5, lam(0xf2b134), 0, 0.6, 0.8));
  const fSign = new THREE.Mesh(new THREE.PlaneGeometry(13, 2.6),
    new THREE.MeshBasicMaterial({ map: signTexture('PALMERA WHEEL', '#e4572e') }));
  fSign.position.set(0, 16.8, 2.2);
  ferris.add(fSign);
  ferris.position.set(W.ferris.x, heightAt(W.ferris.x, W.ferris.z), W.ferris.z);
  ferris.rotation.y = Math.PI / 2;   // wheel plane faces the beach
  scene.add(ferris);
  animated.push({ update(t) { wheel.rotation.z = t * 0.12; for (const c of cabins) { const a = c.angle + t * 0.12; c.mesh.position.set(Math.cos(a) * 11, Math.sin(a) * 11, 0.8); c.mesh.rotation.z = -t * 0.12; } } });

  // ---- Carousel: canopy, pole ring and horses that bob -------------------
  const car = new THREE.Group();
  car.add(new THREE.Mesh(new THREE.CylinderGeometry(6.4, 6.4, 0.5, 18), lam(0xf2f2f2)));
  car.children[0].position.y = 0.25;
  const roof = new THREE.Mesh(new THREE.ConeGeometry(7.6, 3, 18), lam(0xef476f));
  roof.position.y = 5.6; roof.castShadow = true;
  car.add(roof);
  car.add(box(0.5, 4.6, 0.5, lam(0xffd23e), 0, 2.6, 0));
  const horses = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const hx = Math.cos(a) * 4.6, hz = Math.sin(a) * 4.6;
    car.add(box(0.14, 4.4, 0.14, lam(0xd8dde2), hx, 2.4, hz));
    const horse = new THREE.Group();
    horse.add(box(0.55, 0.6, 1.4, lam(cabinCols[i % cabinCols.length]), 0, 0, 0));
    horse.add(box(0.4, 0.55, 0.45, lam(cabinCols[i % cabinCols.length]), 0, 0.42, 0.75));
    horse.add(box(0.5, 0.3, 0.5, lam(0x7a4a21), 0, 0.35, -0.1));
    horse.position.set(hx, 1.7, hz);
    horse.rotation.y = -a;
    car.add(horse);
    horses.push({ mesh: horse, off: i * 1.1 });
  }
  car.position.set(W.carousel.x, heightAt(W.carousel.x, W.carousel.z), W.carousel.z);
  scene.add(car);
  animated.push({ update(t) { car.rotation.y = t * 0.35; for (const h of horses) h.mesh.position.y = 1.7 + Math.sin(t * 2.4 + h.off) * 0.35; } });

  // ---- The shop row: named fronts, striped awnings, one keeper each -----
  // BUILD 7: each shop wears its OWN facade tint and an iconic roof prop
  // for its food type (donut ring, fish fin, burger stack, pizza disc,
  // coffee cup, ice-cream cone, noodle bowl, taco shell), plus a menu
  // board out front. All deterministic — no rng draws here.
  for (const shop of SHOPS) {
    const g = new THREE.Group();
    g.add(box(15, 6.4, 9, lam(shop.facade || 0xf7f0dd), 0, 3.2, 0));
    g.add(box(15.6, 0.6, 9.6, lam(shop.color), 0, 6.6, 0));
    const awn = box(15.4, 0.18, 3.4, lam(shop.color), 0, 4.6, 5.6);
    awn.rotation.x = 0.35;
    g.add(awn);
    g.add(box(4.6, 3.6, 0.3, lam(0x9fd8e8), -3.4, 1.9, 4.6));   // window
    g.add(box(2.2, 3.8, 0.3, lam(0x5a4632), 2.8, 1.9, 4.6));    // door
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(12.6, 3.1),
      new THREE.MeshBasicMaterial({ map: signTexture(shop.label, '#123a5c') }));
    sign.position.set(0, 5.4, 4.75);
    g.add(sign);
    const board = box(0.95, 1.25, 0.08, lam(0x33373d), -5.9, 0.62, 5.9);
    board.rotation.x = -0.14;
    g.add(board);
    if (shop.kind === 'donuts') {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(1.1, 0.45, 8, 16), lam(0xff6fa5));
      ring.position.set(5.6, 7.6, 0); ring.castShadow = true;
      g.add(ring);
    }
    if (shop.kind === 'sushi') {
      const fin = box(3.4, 1.1, 0.3, lam(0x63c7e6), -5.4, 7.5, 0);
      fin.rotation.z = 0.2;
      g.add(fin);
    }
    if (shop.kind === 'burger') {
      const bun = lam(0xe8a54b), patty = lam(0x6e4a2f);
      const b1 = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.05, 0.34, 12), bun);
      b1.position.set(5.6, 7.15, 0); g.add(b1);
      const b2 = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 0.3, 12), patty);
      b2.position.set(5.6, 7.45, 0); g.add(b2);
      const b3 = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 0.85, 0.4, 12), bun);
      b3.position.set(5.6, 7.8, 0); g.add(b3);
    }
    if (shop.kind === 'pizza') {
      const pz = new THREE.Group();
      const disc = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 0.16, 14), lam(0xf2c14e));
      pz.add(disc);
      for (const [px, pz2] of [[0.4, 0.3], [-0.5, -0.2], [0.1, -0.55]]) {
        const pep = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.2, 8), lam(0xd42a2a));
        pep.position.set(px, 0.03, pz2);
        pz.add(pep);
      }
      pz.position.set(5.6, 7.6, 0);
      pz.rotation.x = 0.5;
      g.add(pz);
    }
    if (shop.kind === 'coffee') {
      const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.44, 1.15, 12), lam(0xffffff));
      cup.position.set(5.6, 7.5, 0); cup.castShadow = true;
      g.add(cup);
      const handle = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.09, 6, 12), lam(0xffffff));
      handle.position.set(6.25, 7.5, 0);
      g.add(handle);
    }
    if (shop.kind === 'icecream') {
      const cone = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.5, 10), lam(0xe8a54b));
      cone.rotation.x = Math.PI;
      cone.position.set(5.6, 7.35, 0);
      g.add(cone);
      const scoop = new THREE.Mesh(new THREE.SphereGeometry(0.78, 10, 8), lam(0xff8fb8));
      scoop.position.set(5.6, 8.35, 0); scoop.castShadow = true;
      g.add(scoop);
    }
    if (shop.kind === 'noodle') {
      const bowl = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 0.55, 0.62, 12), lam(0xd42a2a));
      bowl.position.set(5.6, 7.25, 0); bowl.castShadow = true;
      g.add(bowl);
      const st1 = box(0.09, 1.15, 0.09, lam(0xe8dcc0), 5.35, 7.95, 0.1);
      st1.rotation.z = 0.35;
      const st2 = box(0.09, 1.15, 0.09, lam(0xe8dcc0), 5.85, 7.95, -0.1);
      st2.rotation.z = 0.5;
      g.add(st1); g.add(st2);
    }
    if (shop.kind === 'taco') {
      const shell = new THREE.Mesh(new THREE.SphereGeometry(1.05, 10, 6), lam(0xf2a541));
      shell.scale.set(1, 0.55, 0.42);
      shell.position.set(5.6, 7.45, 0); shell.castShadow = true;
      g.add(shell);
      g.add(box(1.7, 0.3, 0.5, lam(0x7ac74f), 5.6, 7.95, 0));
    }
    g.position.set(shop.x, 0.6, W.shopsZ);
    g.traverse((n) => { if (n.isMesh) n.castShadow = true; });
    scene.add(g);
  }

  // Big welcome arch over Ocean Drive — the game's name in the world itself.
  const arch = new THREE.Group();
  arch.add(box(1.2, 11, 1.2, lam(0xf2b134), -13, 5.5, 0));
  arch.add(box(1.2, 11, 1.2, lam(0xf2b134), 13, 5.5, 0));
  const banner = new THREE.Mesh(new THREE.PlaneGeometry(27, 4.4),
    new THREE.MeshBasicMaterial({ map: signTexture('PALMERA BAY', '#e4572e'), side: THREE.DoubleSide }));
  banner.position.set(0, 10.6, 0);
  arch.add(banner);
  arch.position.set(-10, 0.6, W.oceanDrive);
  scene.add(arch);
}

// ---- Seagulls: three loose flocks circling the beach, the pier, the lake --
function buildGulls(scene, rng, animated) {
  const gullMat = lam(0xf7f7f2);
  const tipMat = lam(0x9aa0a8);
  function makeGull() {
    const g = new THREE.Group();
    g.add(box(0.34, 0.14, 0.85, gullMat, 0, 0, 0));
    g.add(box(0.2, 0.18, 0.3, gullMat, 0, 0.06, 0.5));
    const wings = [];
    for (const s of [-1, 1]) {
      const pivot = new THREE.Group();
      pivot.position.set(0.16 * s, 0.06, 0);
      const wing = box(1.15, 0.045, 0.34, gullMat, 0.58 * s, 0, 0);
      const tip = box(0.3, 0.045, 0.3, tipMat, 1.22 * s, 0, 0);
      pivot.add(wing); pivot.add(tip);
      g.add(pivot);
      wings.push({ pivot, side: s });
    }
    return { g, wings };
  }
  const flocks = [
    { c: [10, 25, 232], r: 30, n: 5, speed: 0.055 },
    { c: [8, 18, 246], r: 15, n: 3, speed: 0.08 },
    { c: [58, 16, -125], r: 22, n: 3, speed: 0.065 },
  ];
  for (const f of flocks) {
    for (let i = 0; i < f.n; i++) {
      const { g, wings } = makeGull();
      scene.add(g);
      const ph = rng() * 6.28;
      const rr = f.r * (0.75 + rng() * 0.45);
      const hh = f.c[1] + range(rng, -3, 3);
      animated.push({
        update(t) {
          const a = ph + t * f.speed * (rr / f.r);
          g.position.set(f.c[0] + Math.cos(a) * rr, hh + Math.sin(t * 0.6 + ph) * 1.6, f.c[2] + Math.sin(a) * rr);
          g.rotation.y = -a;
          g.rotation.z = 0.28;
          const flap = Math.sin(t * 8 + ph * 3) * 0.55;
          for (const w of wings) w.pivot.rotation.z = -w.side * flap;
        },
      });
    }
  }
}

// ---- The wild north: pines on the slopes, desert scatter, the lake hamlet --
function buildNorth(scene, rng, colliders, animated) {
  const W = WORLD;
  const loopPts = highwayLoopPoints();

  function makeTree(scale) {
    // Pine: three stacked cone tiers in varied greens (build 4 — the old
    // two-cone lollipop read as a toy; a third tier + shade jitter helps).
    const greens = [0x2e7d43, 0x2a7040, 0x35984f, 0x2f8a4a];
    const g = new THREE.Group();
    g.add(box(0.35 * scale, 1.6 * scale, 0.35 * scale, lam(0x6e4a2f), 0, 0.8 * scale, 0));
    const tiers = [[1.7, 3.4, 3.0], [1.25, 2.8, 4.5], [0.8, 2.2, 5.9]];
    tiers.forEach(([r, h, y], i) => {
      const c = new THREE.Mesh(new THREE.ConeGeometry(r * scale, h * scale, 7), lam(greens[(Math.floor(rng() * 4) + i) % 4]));
      c.position.y = y * scale; c.castShadow = true;
      g.add(c);
    });
    return g;
  }
  // Pines on the mountain and hill slopes.
  let planted = 0, guard = 0;
  while (planted < 34 && guard++ < 300) {
    const a = rng() * Math.PI * 2;
    const rr = 26 + rng() * 78;
    const x = W.mountain.x + Math.cos(a) * rr;
    const z = W.mountain.z + Math.sin(a) * rr;
    const h = heightAt(x, z);
    if (h < 5 || h > 34) continue;
    if (distToPath(x, z, FREEWAY_PTS) < 13) continue;
    const t = makeTree(range(rng, 0.9, 1.5));
    t.position.set(x, h - 0.2, z);
    t.rotation.y = rng() * 3;
    scene.add(t);
    planted++;
  }
  // BUILD 13: a summit cairn + flag on the big mountain's top, so the
  // climb has a landmark (and the golden shell up there has company).
  {
    const sx = W.mountain.x, sz = W.mountain.z, sy = heightAt(sx, sz);
    const cairn = new THREE.Group();
    const rockM = lam(0x8d8578);
    cairn.add(box(1.5, 0.5, 1.5, rockM, 0, 0.25, 0));
    cairn.add(box(1.1, 0.45, 1.1, rockM, 0.1, 0.72, -0.05));
    cairn.add(box(0.7, 0.4, 0.7, rockM, -0.05, 1.14, 0.08));
    cairn.add(box(0.09, 2.6, 0.09, lam(0x33373d), 0, 2.4, 0));
    cairn.add(box(1.05, 0.6, 0.05, lam(0xe4572e), 0.56, 3.35, 0));
    cairn.position.set(sx, sy - 0.15, sz);
    cairn.traverse((n) => { if (n.isMesh) n.castShadow = true; });
    scene.add(cairn);
  }
  // Desert scatter in the north-east: shrubs, rocks, cacti.
  const shrubMats = [lam(0x6b7c3f), lam(0x7a8a4a), lam(0x5d7038)];
  let scattered = 0; guard = 0;
  while (scattered < 46 && guard++ < 500) {
    const x = range(rng, 48, 205), z = range(rng, -215, -58);
    const dl = Math.hypot(x - W.lake.x, z - W.lake.z);
    if (dl < 48) continue;
    const h = heightAt(x, z);
    if (h > 12 || h < 0.7) continue;
    if (distToPath(x, z, FREEWAY_PTS) < 12) continue;
    const dc = Math.hypot(x - W.centre.x, z - W.centre.z);
    const th = Math.atan2(z - W.centre.z, x - W.centre.x);
    if (Math.abs(dc - (coastRadius(th) - 17)) < 11) continue;   // keep off the loop road
    const kind = rng();
    if (kind < 0.55) {
      const s = new THREE.Mesh(new THREE.IcosahedronGeometry(range(rng, 0.5, 1.0), 0), pick(rng, shrubMats));
      s.scale.y = 0.65;
      s.position.set(x, h + 0.2, z);
      s.castShadow = true;
      scene.add(s);
    } else if (kind < 0.82) {
      const r = new THREE.Mesh(new THREE.DodecahedronGeometry(range(rng, 0.6, 1.5), 0), lam(0x8d8578));
      r.position.set(x, h + 0.3, z);
      r.rotation.set(rng() * 3, rng() * 3, 0);
      r.castShadow = true;
      scene.add(r);
    } else {
      // BUILD 13: rounded saguaro — cylinder trunk and arms with
      // sphere caps, not stacked boxes.
      const cactus = new THREE.Group();
      const cMat = lam(0x3d9950);
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.20, 2.1, 8), cMat);
      trunk.position.y = 1.05;
      cactus.add(trunk);
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.17, 8, 6), cMat);
      cap.position.y = 2.1;
      cactus.add(cap);
      for (const [ax, ay, ah] of [[0.42, 1.30, 0.85], [-0.42, 1.10, 0.65]]) {
        const armH = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.35, 7), cMat);
        armH.rotation.z = Math.PI / 2;
        armH.position.set(ax * 0.55, ay - 0.28, 0);
        cactus.add(armH);
        const armV = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.12, ah, 7), cMat);
        armV.position.set(ax, ay + ah / 2 - 0.28, 0);
        cactus.add(armV);
        const armCap = new THREE.Mesh(new THREE.SphereGeometry(0.11, 7, 6), cMat);
        armCap.position.set(ax, ay + ah - 0.28, 0);
        cactus.add(armCap);
      }
      cactus.position.set(x, h, z);
      cactus.traverse((n) => { if (n.isMesh) n.castShadow = true; });
      scene.add(cactus);
    }
    scattered++;
  }

  // A small lakeside hamlet on the lake's south shore + a fishing dock.
  function house(x, z, ry, tone) {
    const g = new THREE.Group();
    g.add(box(6, 3, 5, lam(tone), 0, 1.5, 0));
    const roof = new THREE.Mesh(new THREE.ConeGeometry(4.6, 2.1, 4), lam(0xb0563a));
    roof.position.y = 4.05;
    roof.rotation.y = Math.PI / 4;
    roof.castShadow = true;
    g.add(roof);
    g.add(box(1.1, 2, 0.2, lam(0x5a4632), 0, 1, 2.55));
    g.add(box(1.2, 1, 0.2, lam(0x9fd8e8), -1.8, 1.8, 2.55));
    // BUILD 13: a second window, a side window and a door step — the
    // hamlet cottages get the same trim language as the city houses.
    g.add(box(1.2, 1, 0.2, lam(0x9fd8e8), 1.8, 1.8, 2.55));
    g.add(box(0.2, 1, 1.2, lam(0x9fd8e8), 3.05, 1.8, 0));
    g.add(box(1.7, 0.18, 0.9, lam(0x8a8f96), 0, 0.09, 2.95));
    g.position.set(x, heightAt(x, z), z);
    g.rotation.y = ry;
    g.traverse((n) => { if (n.isMesh) n.castShadow = true; });
    scene.add(g);
    colliders.push({ x0: x - 3.4, x1: x + 3.4, z0: z - 2.9, z1: z + 2.9 });
  }
  house(18, -92, 0.2, 0xf5e6c8);
  house(38, -87, -0.15, 0xe8d8b0);
  house(64, -90, 0.1, 0xd9e4ec);
  house(88, -94, -0.2, 0xf2c9a0);
  house(30, -100, 0.5, 0xf7f0dd);
  // Leafy trees shade the hamlet's inland side.
  for (const [tx, tz] of [[26, -80], [52, -81], [76, -83]]) {
    const t = makeLeafyTree(rng, range(rng, 1.0, 1.3));
    t.position.set(tx, heightAt(tx, tz), tz);
    scene.add(t);
  }
  // The dock reaching into the lake (deck height matches groundHeight).
  const dock = new THREE.Group();
  dock.add(box(6, 0.25, 15, lam(0x9a6f3f), 0, 0.72, 0));
  for (const [px, pz] of [[-2.6, -6.5], [2.6, -6.5], [-2.6, 6.5], [2.6, 6.5]]) {
    dock.add(box(0.3, 1.6, 0.3, lam(0x8a5f33), px, 0, pz));
  }
  dock.position.set(50, 0, -111);
  dock.traverse((n) => { if (n.isMesh) n.castShadow = true; });
  scene.add(dock);
  const lakeBoat = new THREE.Group();
  // BUILD 13: same smooth-hull language as the sea boats — rounded
  // bilge, white topsides, a little windshield for the helmsman.
  const lbBilge = new THREE.Mesh(new THREE.SphereGeometry(0.95, 9, 7), lam(0x2e86c8));
  lbBilge.scale.set(1, 0.45, 2.3);
  lbBilge.position.y = 0.30;
  lbBilge.castShadow = true;
  lakeBoat.add(lbBilge);
  lakeBoat.add(box(1.85, 0.4, 4.3, lam(0xf2f4f6), 0, 0.55, -0.15));
  lakeBoat.add(box(1.5, 0.5, 1.2, lam(0xf2f2f2), 0, 0.9, -0.6));
  const lbGlass = box(1.3, 0.34, 0.06, lam(0x18242e), 0, 1.02, 0.28);
  lbGlass.rotation.x = -0.25;
  lakeBoat.add(lbGlass);
  lakeBoat.position.set(50.9, 0.45, -126.2);
  lakeBoat.rotation.y = 0.7;
  scene.add(lakeBoat);
  // It putters in a slow ellipse around the lake, bow into its travel.
  animated.push({
    update(t) {
      const a = t * 0.07 + 2;
      const x = WORLD.lake.x + Math.cos(a) * 17, z = WORLD.lake.z + Math.sin(a) * 13;
      lakeBoat.position.set(x, 0.45 + Math.sin(t * 1.4) * 0.05, z);
      lakeBoat.rotation.y = Math.atan2(-Math.sin(a) * 17, Math.cos(a) * 13);
    },
  });
}

// ---- BUILD 7: the realistic city expansion -------------------------------
// Fire & police stations, the hospital's civic neighbours, a car
// dealership, a motorcycle shop, a gun shop, promenade kiosks, vending
// machines, a residential district + roadside houses, and the Palmera
// Garrison. Everything is placed with the build-7 rng stream (r7) or
// deterministically, grounded on heightAt/groundHeight at its own spot,
// and registered in the grounding samples for the physics self-check.
function spanBox(a, b, thick, material) {
  const len = a.distanceTo(b);
  const m = new THREE.Mesh(new THREE.BoxGeometry(thick, thick, len), material);
  m.position.copy(a).add(b).multiplyScalar(0.5);
  m.lookAt(b);
  m.castShadow = true;
  return m;
}

function buildCity7(scene, r7, colliders, animated, sample7) {
  const W = WORLD;
  const GY = 0.6;   // the city pad height
  const glassMat = lam(0x9fd8e8, { transparent: true, opacity: 0.45 });

  function fleetProp(type, x, z, ry, y, opts = {}) {
    const v = buildFleetVehicle(type, opts);
    v.group.position.set(x, y !== undefined ? y : groundHeight(x, z), z);
    v.group.rotation.y = ry;
    scene.add(v.group);
    const c = Math.cos(ry), s = Math.sin(ry);
    const hx = (Math.abs(v.dims.length * s) + Math.abs(v.dims.width * c)) / 2 + 0.4;
    const hz = (Math.abs(v.dims.length * c) + Math.abs(v.dims.width * s)) / 2 + 0.4;
    colliders.push({ x0: x - hx, x1: x + hx, z0: z - hz, z1: z + hz });
    return v;
  }
  function signPlane(text, bg, w, h) {
    return new THREE.Mesh(new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ map: signTexture(text, bg), side: THREE.DoubleSide }));
  }
  function makeVending(x, z, ry, kind, label) {
    const g = new THREE.Group();
    if (kind === 'cola') {
      g.add(box(0.95, 1.95, 0.75, lam(0xd42a2a), 0, 0.98, 0));
      g.add(box(0.7, 1.45, 0.06, lam(0x7a1616), 0, 1.05, 0.39));
      g.add(box(0.42, 0.5, 0.05, lam(0x1c1e24), 0, 0.5, 0.4));
      const s = signPlane('COLA', '#d42a2a', 0.8, 0.4);
      s.position.set(0, 1.62, 0.42);
      g.add(s);
    } else {
      g.add(box(0.95, 1.95, 0.75, lam(0x1f4d4a), 0, 0.98, 0));
      const win = box(0.7, 1.25, 0.05, glassMat, 0, 1.12, 0.39);
      g.add(win);
      const cols = [0xf2b134, 0xef476f, 0x06d6a0, 0xffd23e, 0xf15bb5, 0x00bbf9, 0xfb8b24, 0x8ac926, 0xff5964];
      let ci = 0;
      for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
        g.add(box(0.16, 0.24, 0.1, lam(cols[ci++ % cols.length]), -0.22 + c * 0.22, 0.68 + r * 0.42, 0.34));
      }
      const s = signPlane('SNACKS', '#1f4d4a', 0.8, 0.35);
      s.position.set(0, 1.8, 0.42);
      g.add(s);
    }
    g.position.set(x, GY, z);
    g.rotation.y = ry;
    g.traverse((n) => { if (n.isMesh) n.castShadow = true; });
    scene.add(g);
    sample7(label, x, z, GY, 'heightAt');
  }

  // ---- Fire station: the whole block south of the fire crew's corner --
  {
    const g = new THREE.Group();
    g.add(box(27, 6.5, 8.5, lam(0xe8dcc8), 1.5, 3.25, 0));
    g.add(box(27.4, 1.1, 8.9, lam(0xb02020), 1.5, 5.7, 0));
    g.add(box(27.4, 0.4, 8.9, lam(0x8a8f96), 1.5, 6.7, 0));
    for (const dx of [-6.5, 9.5]) {   // two closed bay doors
      g.add(box(5.6, 4.4, 0.22, lam(0x9aa0a8), dx, 2.2, 4.28));
      g.add(box(5.0, 0.55, 0.26, lam(0x2c3540), dx, 3.45, 4.28));
      g.add(box(5.0, 0.08, 0.26, lam(0x6a7076), dx, 1.1, 4.28));
    }
    // The centre bay stands OPEN: dark hall, door panel rolled up.
    g.add(box(5.6, 4.4, 0.2, lam(0x14161a), 1.5, 2.2, 4.05));
    g.add(box(5.6, 1.0, 0.24, lam(0x9aa0a8), 1.5, 4.95, 4.28));
    const sign = signPlane('FIRE STATION', '#b02020', 13, 2.3);
    sign.position.set(1.5, 5.55, 4.56);
    g.add(sign);
    // Hose-drying tower at the west end.
    g.add(box(3.6, 11, 3.6, lam(0xdccdb4), -13.5, 5.5, 0));
    const cap = new THREE.Mesh(new THREE.ConeGeometry(2.9, 1.7, 4), lam(0xb02020));
    cap.position.set(-13.5, 11.85, 0);
    cap.rotation.y = Math.PI / 4;
    cap.castShadow = true;
    g.add(cap);
    g.add(box(0.9, 1.6, 0.2, lam(0x2c3540), -13.5, 8.4, 1.82));
    const tSign = signPlane('PALMERA FD', '#b02020', 3.1, 0.85);
    tSign.position.set(-13.5, 5.9, 1.86);
    g.add(tSign);
    g.position.set(75, GY, 20.5);
    g.traverse((n) => { if (n.isMesh) n.castShadow = true; });
    scene.add(g);
    colliders.push({ x0: 59.5, x1: 90.4, z0: 15.9, z1: 25.1 });
    sample7('fire station', 75, 20.5, GY, 'heightAt');
  }

  // ---- Police station HQ, facing street 80 ----------------------------
  {
    const g = new THREE.Group();
    const wallMat = new THREE.MeshLambertMaterial({ map: windowTexture(makeRng(777004), 0.18), color: 0xd9e4ec });
    const body = new THREE.Mesh(new THREE.BoxGeometry(18, 9, 10), wallMat);
    body.position.y = 4.5;
    body.castShadow = true; body.receiveShadow = true;
    g.add(body);
    g.add(box(18.4, 1.2, 10.4, lam(0x3a506b), 0, 0.6, 0));
    g.add(box(18.5, 0.5, 10.5, lam(0x8a8f96), 0, 9.2, 0));
    g.add(box(2.6, 3.4, 0.25, lam(0x2c3540), 0, 1.7, -5.06));
    g.add(box(6.5, 0.45, 1.9, lam(0x9aa0a8), 0, 0.22, -5.95));
    g.add(box(7, 0.3, 2.3, lam(0x3a506b), 0, 3.95, -5.95));
    for (const cx of [-3.2, 3.2]) g.add(box(0.3, 3.9, 0.3, lam(0x8a8f96), cx, 1.95, -6.9));
    const sign = signPlane('POLICE', '#123a5c', 9.5, 2.1);
    sign.position.set(0, 7.5, -5.3);
    sign.rotation.y = Math.PI;   // front face is -z: flip or the text mirrors
    g.add(sign);
    const sub = signPlane('PALMERA PD', '#3a506b', 6, 1.05);
    sub.position.set(0, 6.0, -5.28);
    sub.rotation.y = Math.PI;
    g.add(sub);
    g.position.set(120, GY, 96.25);
    scene.add(g);
    colliders.push({ x0: 110.6, x1: 129.4, z0: 90.9, z1: 101.6 });
    sample7('police station', 120, 96.25, GY, 'heightAt');
    // Flag pole on the front sidewalk, flag swaying like the beach ones.
    const fx = 112.5, fz = 89.9, fy = groundHeight(fx, fz);
    const pole = new THREE.Group();
    pole.add(box(0.13, 7.5, 0.13, lam(0x8a8f96), 0, 3.75, 0));
    const pivot = new THREE.Group();
    pivot.position.set(0, 7.1, 0);
    pivot.add(box(1.8, 1.0, 0.05, lam(0x2e86c8), 0.95, 0, 0));
    pole.add(pivot);
    pole.position.set(fx, fy, fz);
    scene.add(pole);
    animated.push({ update(t) { pivot.rotation.y = Math.sin(t * 2.0 + 1.3) * 0.38; } });
    sample7('police flag', fx, fz, fy, 'groundHeight');
    // Two fleet cruisers parked at the kerb in front.
    fleetProp('police_car', 114, 86.8, Math.PI / 2);
    fleetProp('police_car', 123.5, 86.8, Math.PI / 2);
  }

  // ---- Car dealership on Ocean Drive's east row -----------------------
  {
    const g = new THREE.Group();
    g.add(box(18.4, 0.3, 8.4, lam(0x9aa0a8), 0, 0.15, 0));                    // floor
    g.add(box(18, 5.5, 0.4, lam(0xf7f0dd), 0, 2.75, -3.8));                   // back wall
    g.add(box(0.4, 5.5, 8, lam(0xf7f0dd), -8.8, 2.75, 0));
    g.add(box(0.4, 5.5, 8, lam(0xf7f0dd), 8.8, 2.75, 0));
    g.add(box(19, 0.5, 9.6, lam(0x8a8f96), 0, 5.75, 0));                       // roof slab
    const glass = box(17.2, 4.4, 0.22, glassMat, 0, 2.2, 4.0);
    g.add(glass);
    for (const cx of [-8.6, 8.6]) g.add(box(0.5, 5.5, 0.5, lam(0x495057), cx, 2.75, 4.0));
    g.add(box(19, 1.8, 0.5, lam(0x123a5c), 0, 6.6, 4.3));                      // fascia
    const sign = signPlane('PALMERA MOTORS', '#123a5c', 15, 2.5);
    sign.position.set(0, 6.6, 4.62);
    g.add(sign);
    g.position.set(120, GY, 141);
    g.traverse((n) => { if (n.isMesh) n.castShadow = true; });
    scene.add(g);
    colliders.push({ x0: 110.6, x1: 129.4, z0: 136.6, z1: 145.4 });
    sample7('dealership', 120, 141, GY, 'heightAt');
    // Two cars inside the glass, three on the forecourt with price boards.
    fleetProp('civil_sedan', 115.5, 141, 0.5, GY, { color: 0xf2f2f2 });
    fleetProp('civil_sedan', 124.5, 141, -0.5, GY, { color: 0x37b24d });
    scene.add(box(23, 0.1, 9.5, lam(0xa8adb5), 120, GY + 0.03, 153.7));
    const prices = [['SALE $8,999', 0xd42427], ['SALE $11,499', 0x2b50c8], ['SALE $9,750', 0xf2b134]];
    prices.forEach(([label, color], i) => {
      const cx = 113.5 + i * 6.5, cz = 153.8 + (i === 1 ? 0.8 : 0), cry = [0.45, 0.1, -0.45][i];
      fleetProp('civil_sedan', cx, cz, cry, GY + 0.08, { color });
      const post = new THREE.Group();
      post.add(box(0.08, 0.95, 0.08, lam(0x33373d), 0, 0.47, 0));
      const b = signPlane(label, '#b02020', 1.6, 0.8);
      b.position.y = 1.25;
      post.add(b);
      post.position.set(cx + 1.7, GY + 0.08, cz + 2.7);
      scene.add(post);
    });
  }

  // ---- Motorcycle shop + gun shop, Ocean Drive's west row -------------
  {
    const g = new THREE.Group();
    g.add(box(13.4, 0.25, 9.4, lam(0x9aa0a8), 0, 0.12, 0));
    g.add(box(13, 5, 0.4, lam(0xe8d8b0), 0, 2.5, -4.3));
    g.add(box(0.4, 5, 9, lam(0xe8d8b0), -6.3, 2.5, 0));
    g.add(box(0.4, 5, 9, lam(0xe8d8b0), 6.3, 2.5, 0));
    g.add(box(13.6, 0.45, 9.6, lam(0x8a8f96), 0, 5.2, 0));
    g.add(box(11.5, 0.18, 5.5, lam(0x495057), 0, 0.34, 1.2));                 // display platform
    const glass = box(12.2, 3.8, 0.22, glassMat, 0, 2.1, 4.4);
    g.add(glass);
    g.add(box(13.6, 1.3, 0.4, lam(0xe4572e), 0, 4.9, 4.4));
    const sign = signPlane('PALMERA MOTO', '#e4572e', 11, 1.9);
    sign.position.set(0, 4.9, 4.66);
    g.add(sign);
    g.position.set(-132.5, GY, 141.5);
    g.traverse((n) => { if (n.isMesh) n.castShadow = true; });
    scene.add(g);
    colliders.push({ x0: -139.4, x1: -125.6, z0: 136.6, z1: 146.4 });
    sample7('moto shop', -132.5, 141.5, GY, 'heightAt');
    // The fleet motorcycles on the platform, behind the glass.
    fleetProp('moto_sport', -136.3, 142.7, 0.15, GY + 0.43);
    fleetProp('moto_cruiser', -132.5, 142.7, 0.15, GY + 0.43);
    fleetProp('moto_enduro', -128.7, 142.7, 0.15, GY + 0.43);
    fleetProp('moto_sport', -125.6, 148.2, 0.7, GY);
  }
  {
    const g = new THREE.Group();
    g.add(box(13, 5.5, 9, lam(0x4c4c44), 0, 2.75, 0));
    g.add(box(13.5, 0.5, 9.5, lam(0x33373d), 0, 5.7, 0));
    g.add(box(1.7, 3.3, 0.25, lam(0x2c2f36), 0, 1.65, 4.55));
    g.add(box(2.4, 0.16, 1.0, lam(0x8a8f96), 0, 0.08, 5.0));
    for (const wx of [3.9]) {
      g.add(box(3.2, 1.7, 0.2, lam(0x2c3540), wx, 2.7, 4.55));
      for (let b = -1; b <= 1; b++) g.add(box(0.09, 1.9, 0.1, lam(0x1c1e24), wx + b * 0.6, 2.7, 4.68));
    }
    // BUILD 13: the left window is now the DISPLAY window — a shallow
    // storefront case with two rifles standing on the case floor and a
    // shelf of three pistols (the build-13 models from characters.js),
    // behind glass in a dark metal frame.
    {
      const dx = -3.9;
      g.add(box(3.3, 1.9, 0.08, lam(0x55483a), dx, 2.55, 4.54));          // case back (warm, lit)
      g.add(box(3.0, 0.06, 0.06, lam(0xffe9a8, { emissive: 0xaa8833 }), dx, 3.42, 4.68));   // display light strip
      g.add(box(3.3, 0.08, 0.34, lam(0x17191e), dx, 1.62, 4.66));         // case floor
      for (const rx of [dx - 0.85, dx + 0.85]) {
        const rifle = makeRifle();
        rifle.position.set(rx, 2.0, 4.66);
        rifle.rotation.set(-Math.PI / 2, 0, 0.06);
        g.add(rifle);
      }
      g.add(box(1.5, 0.05, 0.26, lam(0x17191e), dx, 2.35, 4.66));         // pistol shelf
      for (const px of [dx - 0.42, dx, dx + 0.42]) {
        const pistol = makeWeapon();
        pistol.position.set(px, 2.47, 4.66);
        pistol.rotation.x = -0.9;
        g.add(pistol);
      }
      // BUILD 14: the SMG stands between the rifles — the rack the
      // player can now actually buy from (sidejobs.js runs the till).
      const smg = makeSmg();
      smg.position.set(dx, 2.0, 4.66);
      smg.rotation.set(-Math.PI / 2, 0, 0.06);
      smg.userData.weaponKind = 'smg';
      g.add(smg);
      scene.userData.armsCase = { rifles: 2, pistols: 3, smgs: 1 };
      g.add(box(3.3, 2.3, 0.04, glassMat, dx, 2.55, 4.86));               // glass
      g.add(box(3.5, 0.12, 0.1, lam(0x17191e), dx, 3.56, 4.84));
      g.add(box(3.5, 0.12, 0.1, lam(0x17191e), dx, 1.54, 4.84));
      g.add(box(0.12, 2.14, 0.1, lam(0x17191e), dx - 1.72, 2.55, 4.84));
      g.add(box(0.12, 2.14, 0.1, lam(0x17191e), dx + 1.72, 2.55, 4.84));
    }
    const awn = box(13.2, 0.15, 1.6, lam(0x33373d), 0, 3.62, 5.2);
    awn.rotation.x = 0.3;
    g.add(awn);
    const sign = signPlane('PALMERA ARMS', '#2e2e28', 11.5, 2.0);
    sign.position.set(0, 4.55, 4.66);
    g.add(sign);
    g.position.set(-117.5, GY, 141.5);
    g.traverse((n) => { if (n.isMesh) n.castShadow = true; });
    scene.add(g);
    colliders.push({ x0: -124.4, x1: -110.6, z0: 136.6, z1: 146.4 });
    sample7('gun shop', -117.5, 141.5, GY, 'heightAt');
  }

  // ---- Promenade kiosks (vendors stand behind them, pedestrians.js) ---
  function makeKiosk(x, label, bg, accent, kind) {
    const g = new THREE.Group();
    g.add(box(3.4, 1.05, 1.5, lam(0x9a6f3f), 0, 0.53, 0.45));
    g.add(box(3.6, 0.08, 1.7, lam(0x7a4a21), 0, 1.09, 0.45));
    g.add(box(3.4, 2.1, 0.5, lam(accent), 0, 1.05, -0.95));
    for (const px of [-1.6, 1.6]) g.add(box(0.12, 2.5, 0.12, lam(0x33373d), px, 1.25, 1.05));
    const canopy = box(4.0, 0.12, 3.0, lam(accent), 0, 2.55, 0);
    canopy.rotation.x = 0.06;
    g.add(canopy);
    const sign = signPlane(label, bg, 3.2, 0.75);
    sign.position.set(0, 2.02, 1.14);
    g.add(sign);
    if (kind === 'hotdog') {
      g.add(box(1.6, 0.12, 0.7, lam(0x33373d), -0.6, 1.19, 0.45));
      for (let i = 0; i < 3; i++) {
        const s = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.55, 7), lam(0xb0563a));
        s.rotation.z = Math.PI / 2;
        s.position.set(-0.6, 1.32, 0.25 + i * 0.2);
        s.castShadow = true;
        g.add(s);
      }
      g.add(box(0.16, 0.4, 0.16, lam(0xf7d154), 0.55, 1.33, 0.5));
    } else if (kind === 'donut') {
      const glassCase = box(1.25, 0.5, 0.62, glassMat, 0.65, 1.38, 0.45);
      g.add(glassCase);
      for (const [dx, col] of [[-0.75, 0xff6fa5], [-0.35, 0xe8a54b]]) {
        const t = new THREE.Mesh(new THREE.TorusGeometry(0.21, 0.1, 6, 12), lam(col));
        t.position.set(dx, 1.3, 0.45);
        t.castShadow = true;
        g.add(t);
      }
    } else {
      g.add(box(1.1, 1.3, 0.7, lam(0x2e86c8), 1.95, 0.65, -0.3));
      for (let i = 0; i < 4; i++) {
        const can = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.3, 8),
          lam([0xd42a2a, 0xf2b134, 0x06d6a0, 0x2e86c8][i]));
        can.position.set(-1.1 + i * 0.35, 1.28, 0.5);
        can.castShadow = true;
        g.add(can);
      }
    }
    g.position.set(x, GY, 190.2);
    g.traverse((n) => { if (n.isMesh) n.castShadow = true; });
    scene.add(g);
    colliders.push({ x0: x - 1.9, x1: x + 1.9, z0: 188.9, z1: 191.6 });
    sample7('kiosk ' + kind, x, 190.2, GY, 'heightAt');
  }
  makeKiosk(-56, 'HOTDOGS', '#b02020', 0xd42a2a, 'hotdog');
  makeKiosk(48, 'DONUTS', '#c2437e', 0xff6fa5, 'donut');
  makeKiosk(113, 'COLD DRINKS', '#1d6fb8', 0x2e86c8, 'drinks');

  // ---- Vending machines at the civic spots ----------------------------
  makeVending(-114.6, 187.5, 0, 'cola', 'vending hospital');
  makeVending(115.2, 90.6, Math.PI, 'snack', 'vending police');
  makeVending(107.8, 151.5, 0.5, 'snack', 'vending dealership');
  makeVending(34.6, 158.4, 0, 'cola', 'vending bus stop');
  makeVending(91.2, 21.5, -Math.PI / 2, 'snack', 'vending fire station');

  // ---- Residential district: Palmera Heights, east coast --------------
  function makeHouse(x, z, ry, style, tone, label) {
    const g = new THREE.Group();
    const w = 7, d = 6, h = 3.1;
    g.add(box(11.5, 0.1, 10.5, lam(0x7cc464), 0, 0.0, 0));                    // lawn
    g.add(box(w, h, d, lam(tone), 0, h / 2, 0));
    g.add(box(1.15, 2.1, 0.16, lam(0x5a4632), 0, 1.05, d / 2 + 0.04));        // door
    g.add(box(1.7, 0.14, 0.9, lam(0x9aa0a8), 0, 0.07, d / 2 + 0.5));          // step
    for (const wx of [-w / 4 - 0.6, w / 4 + 0.6]) g.add(box(1.15, 1.05, 0.14, lam(0x9fd8e8), wx, 1.75, d / 2 + 0.04));
    if (style === 'gable') {
      // Build 8 de-stiffen: roof pitch jitters per lot (hash2, no rng).
      const ang = 0.45 + (hash2(x, z) - 0.5) * 0.10, rh = (w / 2) * Math.tan(ang), sl = Math.hypot(w / 2, rh) + 0.5;
      for (const sd of [-1, 1]) {
        const slab = box(sl, 0.16, d + 0.7, lam(0xb0563a), sd * w / 4, h + rh / 2, 0);
        slab.rotation.z = -sd * ang;
        g.add(slab);
      }
      g.add(box(0.3, 0.5, 0.9, lam(0x9aa0a8), w / 4, h + rh - 0.4, -d / 4));  // chimney
    } else if (style === 'hip') {
      const roof = new THREE.Mesh(new THREE.ConeGeometry(5.6, 2.0, 4), lam(0xa85a40));
      roof.position.y = h + 1.0;
      roof.rotation.y = Math.PI / 4;
      roof.castShadow = true;
      g.add(roof);
    } else {
      g.add(box(w + 0.45, 0.5, d + 0.45, lam(0x8a8f96), 0, h + 0.25, 0));
      g.add(box(1.6, 0.7, 1.6, lam(0xb9bec6), -w / 4, h + 0.6, -d / 4));
    }
    const fenceMat = lam(0xf2f2f2);
    for (const fx of [-5.4, 5.4]) g.add(box(0.09, 0.85, 10.2, fenceMat, fx, 0.43, 0));
    g.add(box(10.8, 0.85, 0.09, fenceMat, 0, 0.43, -5.1));
    g.add(box(0.09, 0.95, 0.09, lam(0x33373d), 3.6, 0.47, 5.7));              // mailbox
    g.add(box(0.58, 0.34, 0.36, lam(0x1d6fb8), 3.6, 1.08, 5.7));
    const y = heightAt(x, z);
    g.position.set(x, y, z);
    g.rotation.y = ry;
    g.traverse((n) => { if (n.isMesh) n.castShadow = true; });
    scene.add(g);
    const swap = Math.abs(Math.abs(ry) - Math.PI / 2) < 0.1;
    const hx = (swap ? d : w) / 2 + 0.4, hz = (swap ? w : d) / 2 + 0.4;
    colliders.push({ x0: x - hx, x1: x + hx, z0: z - hz, z1: z + hz });
    sample7(label, x, z, y, 'heightAt');
    return y;
  }
  function driveway(cx, cz, len, ry) {
    const y = heightAt(cx, cz);
    const m = box(Math.abs(Math.cos(ry)) > 0.5 ? len : 3.0, 0.07, Math.abs(Math.cos(ry)) > 0.5 ? 3.0 : len, lam(0x9aa0a8), cx, y + 0.01, cz);
    m.receiveShadow = true;
    scene.add(m);
  }
  ribbon(scene, [{ x: 186, z: 22 }, { x: 186, z: 84 }], 7, 0.18, false);
  ribbon(scene, [{ x: 188, z: 56 }, { x: 214, z: 59 }], 6, 0.18, false);
  const styles = ['gable', 'hip', 'flat', 'gable'];
  [32, 45, 58, 71].forEach((z, i) => {
    makeHouse(175, z, Math.PI / 2, styles[i], pick(r7, PALETTE.buildingTones), 'house W' + (i + 1));
    driveway(180.2, z, 4.6, 0);
    if (i % 2 === 0) fleetProp('civil_sedan', 179.8, z, Math.PI / 2, heightAt(179.8, z) + 0.05, { color: pick(r7, [0xd42427, 0xf2f2f2, 0x2b50c8]) });
  });
  [38, 51, 64, 77].forEach((z, i) => {
    makeHouse(197, z, -Math.PI / 2, styles[(i + 1) % 4], pick(r7, PALETTE.buildingTones), 'house E' + (i + 1));
    driveway(191.3, z, 4.6, 0);
    if (i % 2 === 1) fleetProp('civil_sedan', 192.2, z, -Math.PI / 2, heightAt(192.2, z) + 0.05, { color: pick(r7, [0x37b24d, 0xf2b134, 0x845ef7]) });
  });
  for (const [tx, tz] of [[180.8, 27], [191.2, 71], [180.8, 79.5]]) {
    const t = makeLeafyTree(r7, range(r7, 1.0, 1.3));
    t.position.set(tx, heightAt(tx, tz), tz);
    scene.add(t);
  }
  // Roadside houses: by the freeway, its entrance, and the coast loop.
  makeHouse(88, -55, -Math.PI / 2, 'hip', 0xf5e6c8, 'roadside freeway E');
  ribbon(scene, [{ x: 74, z: -55 }, { x: 84, z: -55 }], 3.2, 0.15, false);
  makeHouse(30, -48, Math.PI / 2, 'gable', 0xd9e4ec, 'roadside freeway W');
  ribbon(scene, [{ x: 56, z: -48 }, { x: 34, z: -48 }], 3.2, 0.15, false);
  makeHouse(72, 2, -Math.PI / 2, 'flat', 0xf2c9a0, 'roadside freeway S');
  driveway(66, 2, 7, 0);
  makeHouse(196, -58, Math.PI / 2, 'gable', 0xe8d8b0, 'roadside coast');
  driveway(201.7, -58, 5.5, 0);

  // ---- BUILD 12: the hotel strip, downtown's east edge ----------------
  // Three named hotels on the reserved east-column lots, fronts facing
  // the shore: window-grid towers in the fill loop's own language, a
  // rooftop name board, a glass entrance and fan palms at the door.
  function makeHotel(x, z, name, bg, tone, h, seed) {
    const g = new THREE.Group();
    const w = 13, d = 9.5;
    const wallMat = new THREE.MeshLambertMaterial({ map: windowTexture(makeRng(seed), 0.3), color: tone });
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat);
    body.position.y = h / 2;
    body.castShadow = true; body.receiveShadow = true;
    g.add(body);
    const skirt = new THREE.Mesh(new THREE.PlaneGeometry(w + 4.5, d + 4.5), aoMat);
    skirt.rotation.x = -Math.PI / 2;
    skirt.position.y = 0.05;
    skirt.renderOrder = 1;
    g.add(skirt);
    g.add(box(w + 0.5, 0.5, d + 0.5, lam(0x8a8f96), 0, h + 0.2, 0));          // parapet
    g.add(box(w * 0.36, 1.1, d * 0.4, lam(0x9aa0a8), 0, h + 0.9, 0));        // roof block
    g.add(box(w + 0.2, 1.0, 0.4, lam(0x123a5c), 0, 0.5, d / 2 + 0.1));        // ground band
    g.add(box(w * 0.5, 2.3, 0.22, lam(0x2c3540), 0, 1.5, d / 2 + 0.08));      // glass entrance
    g.add(box(4.6, 0.18, 2.0, lam(0x495057), 0, 3.1, d / 2 + 1.0));           // canopy
    g.add(box(2.6, 0.16, 1.3, lam(0x8a8f96), 0, 0.08, d / 2 + 0.65));         // step
    const board = signPlane(name, bg, Math.min(w * 0.94, 12.4), 2.3);
    board.position.set(0, h - 1.7, d / 2 + 0.16);
    g.add(board);
    g.position.set(x, GY, z);
    g.rotation.y = Math.PI / 2;   // front (+z local) faces east, to the shore
    g.traverse((n) => { if (n.isMesh) n.castShadow = true; });
    scene.add(g);
    for (const s of [-1, 1]) {
      const palm = makeFanPalm(makeRng(seed + 7 + s), 4.4);   // own stream: r7 stays untouched
      palm.position.set(x + d / 2 + 2.2, GY, z + s * (w / 2 - 0.6));
      scene.add(palm);
    }
    colliders.push({ x0: x - d / 2 - 0.4, x1: x + d / 2 + 0.4, z0: z - w / 2 - 0.4, z1: z + w / 2 + 0.4 });
    sample7('hotel ' + name, x, z, GY, 'heightAt');
  }
  makeHotel(155, 63.75, 'HOTEL CORAL', '#e4572e', 0xf7dcc0, 20, 12001);
  makeHotel(155, 96.25, 'PALMERA GRAND', '#123a5c', 0xd9e4ec, 30, 12002);
  makeHotel(155, 142.5, 'SUNSET SUITES', '#a03a5c', 0xf2c9a0, 24, 12003);

  // ---- Palmera Garrison: the military base north of the city ----------
  {
    ribbon(scene, [{ x: 58, z: -28 }, { x: 106, z: -30 }], 5, 0.15, false);
    const postMat = lam(0x4a4a42), railMat = lam(0x6a7076);
    // BUILD 10: the fence line is pushed north (Z0 -54 -> -68) and east
    // (X1 166 -> 182) to make room for the HQ + parade ground, the
    // helipad and the support structures of the living garrison.
    const X0 = 108, X1 = 182, Z0 = -68, Z1 = -14;
    const sides = [
      { from: [X0, Z0], to: [X1, Z0] }, { from: [X1, Z0], to: [X1, Z1] },
      { from: [X1, Z1], to: [X0, Z1] }, { from: [X0, Z1], to: [X0, -33.5] },
      { from: [X0, -26.5], to: [X0, Z0] },
    ];
    for (const side of sides) {
      const [ax, az] = side.from, [bx, bz] = side.to;
      const len = Math.hypot(bx - ax, bz - az);
      const n = Math.max(1, Math.round(len / 6.5));
      let prev = null;
      for (let i = 0; i <= n; i++) {
        const x = ax + (bx - ax) * i / n, z = az + (bz - az) * i / n;
        const y = heightAt(x, z);
        scene.add(box(0.16, 2.3, 0.16, postMat, x, y + 1.15, z));
        const cur = new THREE.Vector3(x, y, z);
        if (prev) {
          for (const hh of [0.8, 1.95]) {
            scene.add(spanBox(
              new THREE.Vector3(prev.x, prev.y + hh, prev.z),
              new THREE.Vector3(cur.x, cur.y + hh, cur.z), 0.07, railMat));
          }
        }
        prev = cur;
      }
    }
    // Gate: two guard huts, a barrier arm, the garrison sign overhead.
    for (const gz of [-24.6, -35.4]) {
      const gy = heightAt(110.5, gz);
      const hut = new THREE.Group();
      hut.add(box(1.7, 2.5, 1.7, lam(0x77754f), 0, 1.25, 0));
      hut.add(box(2.1, 0.25, 2.1, lam(0x4a4a42), 0, 2.6, 0));
      hut.add(box(0.9, 1.1, 0.12, lam(0x2c3540), 0, 1.45, gz < -30 ? -0.86 : 0.86));
      hut.position.set(110.5, gy, gz);
      hut.traverse((m) => { if (m.isMesh) m.castShadow = true; });
      scene.add(hut);
    }
    sample7('gate hut', 110.5, -24.6, heightAt(110.5, -24.6), 'heightAt');
    {
      const gy = heightAt(108, -30);
      scene.add(box(0.35, 3.1, 0.35, postMat, 108, gy + 1.55, -26.3));
      scene.add(box(0.35, 3.1, 0.35, postMat, 108, gy + 1.55, -33.7));
      scene.add(box(0.22, 0.22, 8.6, postMat, 108, gy + 3.15, -30));
      const s = signPlane('PALMERA GARRISON', '#3a4030', 6.4, 1.05);
      s.position.set(107.7, gy + 2.35, -30);
      s.rotation.y = -Math.PI / 2;
      scene.add(s);
      scene.add(box(0.42, 1.1, 0.42, lam(0x33373d), 109.5, heightAt(109.5, -27.2) + 0.55, -27.2));
      for (let i = 0; i < 5; i++) {
        scene.add(box(0.14, 0.2, 0.98, lam(i % 2 ? 0xf2f2f2 : 0xd42a2a), 109.5, heightAt(109.5, -27.2) + 1.12, -27.7 - i * 0.99));
      }
    }
    // Barracks, hangar, watchtower, HQ flag, crates, barriers, trucks.
    function barracks(x, z, tone, label) {
      const g = new THREE.Group();
      g.add(box(14, 3.8, 6.5, lam(tone), 0, 1.9, 0));
      g.add(box(14.6, 0.35, 7.1, lam(0x4a4a42), 0, 3.95, 0));
      g.add(box(1.2, 2.2, 0.16, lam(0x33373d), 0, 1.1, 3.28));
      for (const wx of [-5, -2.5, 2.5, 5]) g.add(box(1.1, 1.0, 0.14, lam(0x9fd8e8), wx, 2.2, 3.28));
      const y = heightAt(x, z);
      g.position.set(x, y, z);
      g.traverse((m) => { if (m.isMesh) m.castShadow = true; });
      scene.add(g);
      colliders.push({ x0: x - 7.4, x1: x + 7.4, z0: z - 3.65, z1: z + 3.65 });
      sample7(label, x, z, y, 'heightAt');
    }
    barracks(124, -44, 0x77754f, 'barracks A');
    barracks(124, -22, 0x6b6f4e, 'barracks B');
    {
      const g = new THREE.Group();
      g.add(box(16, 5, 12, lam(0x707a5e), 0, 2.5, 0));
      const roof = new THREE.Mesh(new THREE.CylinderGeometry(6.2, 6.2, 16.4, 14), lam(0x5d6850));
      roof.rotation.z = Math.PI / 2;
      roof.scale.set(0.55, 1, 1);   // squash the tube's vertical radius (local X -> world Y after the rotation)
      roof.position.y = 4.4;
      roof.castShadow = true;
      g.add(roof);
      g.add(box(9.5, 4.3, 0.3, lam(0x3a4030), 0, 2.15, 6.05));
      g.add(box(9.9, 0.35, 0.34, lam(0xf7d154), 0, 4.5, 6.05));
      const y = heightAt(152, -42);
      g.position.set(152, y, -42);
      g.rotation.y = -Math.PI / 2;
      g.traverse((m) => { if (m.isMesh) m.castShadow = true; });
      scene.add(g);
      colliders.push({ x0: 145.6, x1: 158.4, z0: -50.4, z1: -33.6 });
      sample7('hangar', 152, -42, y, 'heightAt');
    }
    {
      const g = new THREE.Group();
      for (const [lx, lz] of [[-0.95, -0.95], [0.95, -0.95], [-0.95, 0.95], [0.95, 0.95]]) {
        g.add(box(0.22, 7, 0.22, lam(0x6e4a2f), lx, 3.5, lz));
      }
      g.add(box(3.0, 0.25, 3.0, lam(0x6e4a2f), 0, 7.0, 0));
      g.add(box(2.8, 2.3, 2.8, lam(0x77754f), 0, 8.25, 0));
      g.add(box(2.0, 1.1, 0.14, lam(0x2c3540), 0, 8.5, 1.42));
      const cap = new THREE.Mesh(new THREE.ConeGeometry(2.6, 1.3, 4), lam(0x4a4a42));
      cap.position.y = 10.05;
      cap.rotation.y = Math.PI / 4;
      cap.castShadow = true;
      g.add(cap);
      const y = heightAt(161, -17);
      g.position.set(161, y, -17);
      scene.add(g);
      colliders.push({ x0: 159.4, x1: 162.6, z0: -18.6, z1: -15.4 });
      sample7('watchtower', 161, -17, y, 'heightAt');
    }
    {
      // BUILD 10: the flag moves to the parade ground's NE corner, in
      // front of the new HQ (was mid-compound at (137, -31) in build 7).
      const fx = 141.5, fz = -54.5, fy = heightAt(fx, fz);
      const pole = new THREE.Group();
      pole.add(box(0.14, 8.5, 0.14, lam(0x8a8f96), 0, 4.25, 0));
      const pivot = new THREE.Group();
      pivot.position.set(0, 8.1, 0);
      pivot.add(box(1.9, 1.05, 0.05, lam(0x556b2f), 1.0, 0, 0));
      pole.add(pivot);
      pole.position.set(fx, fy, fz);
      scene.add(pole);
      animated.push({ update(t) { pivot.rotation.y = Math.sin(t * 2.1 + 4.0) * 0.4; } });
      sample7('garrison flag', fx, fz, fy, 'heightAt');
    }
    for (const [cx, cz] of [[146, -19], [147.4, -19], [146.7, -17.7], [130, -49]]) {
      const c = box(1.4, 1.4, 1.4, lam(0x8a7a4a), cx, heightAt(cx, cz) + 0.7, cz);
      c.castShadow = true;
      scene.add(c);
    }
    for (const [bx, bz] of [[112.5, -26.6], [112.5, -33.4]]) {
      scene.add(box(2.2, 0.85, 0.55, lam(0x9aa0a8), bx, heightAt(bx, bz) + 0.43, bz));
    }
    function truck(x, z, ry, label) {
      const g = new THREE.Group();
      g.add(box(6.8, 0.5, 2.3, lam(0x3f4a2a), 0, 0.78, 0));
      g.add(box(1.9, 1.65, 2.2, lam(0x556b2f), 2.55, 1.8, 0));
      g.add(box(0.9, 0.8, 0.14, lam(0x2c3540), 3.42, 2.05, 0));
      g.add(box(4.4, 2.15, 2.35, lam(0x5d6850), -0.95, 2.05, 0));
      const wg = new THREE.CylinderGeometry(0.55, 0.55, 0.4, 10);
      for (const [wx, wz] of [[2.5, 1.05], [2.5, -1.05], [-1.9, 1.05], [-1.9, -1.05]]) {
        const w = new THREE.Mesh(wg, lam(0x1c1e24));
        w.rotation.x = Math.PI / 2;
        w.position.set(wx, 0.55, wz);
        w.castShadow = true;
        g.add(w);
      }
      const y = heightAt(x, z);
      g.position.set(x, y, z);
      g.rotation.y = ry;
      scene.add(g);
      colliders.push({ x0: x - 3.8, x1: x + 3.8, z0: z - 1.6, z1: z + 1.6 });
      sample7(label, x, z, y, 'heightAt');
    }
    truck(146, -20.5, 0.35, 'garrison truck 1');
    truck(133, -49.5, -0.15, 'garrison truck 2');

    // ---- BUILD 10: the garrison comes alive ---------------------------
    // The build-7 compound read empty and flat, so it gains: an HQ with
    // a parade ground (drill formation + sentries live in
    // pedestrians.js, same coordinates by convention), a helicopter on
    // a marked pad with its rotor spinning, a depot row, fuel and
    // maintenance support, a blinking antenna mast, a second
    // watchtower, a camo shelter, an obstacle course, a target range,
    // sandbags, scatter — and the dirt roads tying it together. Own rng
    // stream (r10); every structure registers a grounding sample.
    const r10 = makeRng(20261121);
    void r10;   // placements below are hand-laid; the stream is reserved

    // A terrain-hugging paved patch: a subdivided plane whose vertices
    // sit on heightAt + lift, so the slab follows the slope instead of
    // floating off one edge of it.
    function groundPatch(cx, cz, w, d, material, lift = 0.06, seg = 8) {
      const geo = new THREE.PlaneGeometry(w, d, seg, seg);
      geo.rotateX(-Math.PI / 2);
      const pos = geo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        pos.setY(i, heightAt(cx + pos.getX(i), cz + pos.getZ(i)) + lift);
      }
      geo.computeVertexNormals();
      const m = new THREE.Mesh(geo, material);
      m.position.set(cx, 0, cz);
      m.receiveShadow = true;
      scene.add(m);
      return m;
    }
    // Dirt roads: the ribbon pattern in packed-earth colours.
    function dirtRoad(pts, width = 4) {
      const mat = lam(0x8f7f57);
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i], b = pts[i + 1];
        const len = Math.hypot(b.x - a.x, b.z - a.z);
        const m = new THREE.Mesh(new THREE.PlaneGeometry(width, len + width * 0.5), mat);
        m.rotation.order = 'YXZ';
        m.rotation.y = Math.atan2(b.x - a.x, b.z - a.z);
        m.rotation.x = -Math.PI / 2;
        m.position.set((a.x + b.x) / 2, (heightAt(a.x, a.z) + heightAt(b.x, b.z)) / 2 + 0.1, (a.z + b.z) / 2);
        m.receiveShadow = true;
        scene.add(m);
      }
    }
    dirtRoad([{ x: 107, z: -30 }, { x: 168, z: -30 }], 5);          // gate -> depot/helipad
    dirtRoad([{ x: 137, z: -30 }, { x: 137, z: -47 }], 4);          // main road -> parade ground
    dirtRoad([{ x: 160, z: -30 }, { x: 168, z: -38 }], 4);          // main road -> helipad
    dirtRoad([{ x: 113.5, z: -31 }, { x: 113.5, z: -52 }], 3.5);    // west lane
    dirtRoad([{ x: 113.5, z: -52 }, { x: 124, z: -55 }], 3.5);      // west lane -> HQ corner

    // HQ building on the north side, facing the parade ground.
    {
      const g = new THREE.Group();
      g.add(box(18, 5.2, 8, lam(0x77754f), 0, 2.6, 0));
      g.add(box(18.6, 0.4, 8.6, lam(0x4a4a42), 0, 5.4, 0));
      g.add(box(2.2, 3.0, 0.3, lam(0x33373d), 0, 1.5, 4.05));
      g.add(box(4.6, 0.25, 1.6, lam(0x4a4a42), 0, 3.25, 4.4));
      for (const wx of [-7, -4.5, 4.5, 7]) g.add(box(1.3, 1.1, 0.14, lam(0x9fd8e8), wx, 3.1, 4.03));
      for (const wx of [-6, 6]) g.add(box(1.3, 1.1, 0.14, lam(0x9fd8e8), wx, 1.4, 4.03));
      const s = signPlane('PALMERA GARRISON HQ', '#3a4030', 9.5, 1.5);
      s.position.set(0, 4.35, 4.08);
      g.add(s);
      const y = heightAt(131, -61);
      g.position.set(131, y, -61);
      g.traverse((m) => { if (m.isMesh) m.castShadow = true; });
      scene.add(g);
      colliders.push({ x0: 121.6, x1: 140.4, z0: -65.4, z1: -56.6 });
      sample7('garrison HQ', 131, -61, y, 'heightAt');
    }
    // The parade ground: paved square with painted markings in front
    // of the HQ. The drill formation stands on it (pedestrians.js).
    {
      const paradeTex = canvasTexture(256, (g, s) => {
        g.fillStyle = '#5c6066'; g.fillRect(0, 0, s, s);
        for (let i = 0; i < 500; i++) {
          g.fillStyle = Math.random() > 0.5 ? '#64686e' : '#54585e';
          g.fillRect(Math.random() * s, Math.random() * s, 2, 2);
        }
        g.strokeStyle = 'rgba(245,245,245,.9)'; g.lineWidth = 5;
        g.strokeRect(10, 10, s - 20, s - 20);
        g.fillStyle = 'rgba(245,245,245,.85)';
        g.fillRect(s / 2 - 2, 14, 4, s - 28);
        for (let i = 0; i < 6; i++) g.fillRect(28 + i * 40, s - 34, 22, 5);
      });
      groundPatch(131, -51.75, 24, 8.5, new THREE.MeshLambertMaterial({ map: paradeTex }), 0.06, 10);
      sample7('parade ground', 131, -51.75, heightAt(131, -51.75), 'heightAt');
    }
    // Floodlight poles at the parade ground's west and east edges.
    function floodlight(x, z, label) {
      const g = new THREE.Group();
      g.add(box(0.18, 6.4, 0.18, lam(0x3c4148), 0, 3.2, 0));
      g.add(box(1.5, 0.5, 0.3, lam(0x2c3540), 0, 6.5, 0));
      for (const lx of [-0.45, 0, 0.45]) {
        g.add(box(0.34, 0.3, 0.1, lam(0xf7e8b0, { emissive: 0x554411 }), lx, 6.5, 0.18));
      }
      const y = heightAt(x, z);
      g.position.set(x, y, z);
      g.traverse((m) => { if (m.isMesh) m.castShadow = true; });
      scene.add(g);
      sample7(label, x, z, y, 'heightAt');
    }
    floodlight(120, -55, 'floodlight W');
    floodlight(142, -48.5, 'floodlight E');

    // Helipad + helicopter: capsule body, glass cockpit, tail boom,
    // skids — and a main rotor that spins on the animated list.
    {
      const padTex = canvasTexture(256, (g, s) => {
        g.fillStyle = '#4c5157'; g.fillRect(0, 0, s, s);
        for (let i = 0; i < 500; i++) {
          g.fillStyle = Math.random() > 0.5 ? '#555a60' : '#43474c';
          g.fillRect(Math.random() * s, Math.random() * s, 2, 2);
        }
        g.strokeStyle = '#f5f5f5'; g.lineWidth = 7;
        g.beginPath(); g.arc(s / 2, s / 2, s * 0.40, 0, Math.PI * 2); g.stroke();
        g.fillStyle = '#f5f5f5';
        g.font = '900 110px Trebuchet MS, sans-serif';
        g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText('H', s / 2, s / 2 + 4);
      });
      groundPatch(171, -45, 15, 15, new THREE.MeshLambertMaterial({ map: padTex }), 0.06, 10);
      sample7('helipad', 171, -45, heightAt(171, -45), 'heightAt');

      const heli = new THREE.Group();
      const olive = lam(0x556b2f), oliveDark = lam(0x3f4a2a), glass = lam(0x22303c);
      const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.85, 2.1, 6, 12), olive);
      body.rotation.x = Math.PI / 2;
      body.scale.set(0.92, 1, 0.95);
      body.position.y = 1.55;
      heli.add(body);
      const cockpit = new THREE.Mesh(new THREE.SphereGeometry(0.8, 14, 10), glass);
      cockpit.scale.set(0.88, 0.78, 0.95);
      cockpit.position.set(0, 1.66, 1.05);
      heli.add(cockpit);
      heli.add(box(1.05, 0.45, 1.7, oliveDark, 0, 2.32, -0.3));
      const boom = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.30, 3.8, 10), olive);
      boom.rotation.x = -Math.PI / 2;
      boom.position.set(0, 1.8, -2.85);
      heli.add(boom);
      heli.add(box(0.12, 0.95, 0.65, olive, 0, 2.3, -4.6));
      heli.add(box(1.3, 0.08, 0.4, olive, 0, 1.95, -4.4));
      const tailRotor = new THREE.Group();
      tailRotor.position.set(0.14, 2.3, -4.6);
      tailRotor.add(box(0.05, 0.9, 0.14, oliveDark, 0, 0, 0));
      tailRotor.add(box(0.05, 0.14, 0.9, oliveDark, 0, 0, 0));
      heli.add(tailRotor);
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.4, 8), oliveDark);
      mast.position.set(0, 2.58, 0.1);
      heli.add(mast);
      const rotor = new THREE.Group();
      rotor.position.set(0, 2.82, 0.1);
      rotor.add(box(7.4, 0.05, 0.4, lam(0x2c2f26), 0, 0, 0));
      rotor.add(box(0.4, 0.05, 7.4, lam(0x2c2f26), 0, 0, 0));
      heli.add(rotor);
      const skidGeo = new THREE.CylinderGeometry(0.055, 0.055, 3.1, 8);
      for (const sx of [-0.82, 0.82]) {
        const skid = new THREE.Mesh(skidGeo, oliveDark);
        skid.rotation.x = Math.PI / 2;
        skid.position.set(sx, 0.22, 0);
        heli.add(skid);
        for (const sz of [-0.75, 0.75]) {
          const strut = box(0.09, 0.5, 0.09, oliveDark, sx, 0.5, sz);
          strut.rotation.z = sx > 0 ? -0.3 : 0.3;
          heli.add(strut);
        }
      }
      const hy = heightAt(171, -45);
      heli.position.set(171, hy + 0.06, -45);
      heli.rotation.y = 0.6;
      heli.traverse((m) => { if (m.isMesh) m.castShadow = true; });
      scene.add(heli);
      animated.push({ update(t) { rotor.rotation.y = t * 9; tailRotor.rotation.x = t * 14; } });
      colliders.push({ x0: 168.6, x1: 173.4, z0: -47.4, z1: -42.6 });
      sample7('helicopter', 171, -45, hy, 'heightAt');
    }

    // Vehicle depot row by the hangar: three more olive trucks (the
    // garrison's own hand-built style) plus a hand-built olive van.
    truck(149, -26.5, 0.04, 'depot truck 1');
    truck(156.5, -26.5, -0.05, 'depot truck 2');
    truck(164, -26.5, 0.03, 'depot truck 3');
    {
      const g = new THREE.Group();
      g.add(box(4.9, 0.45, 2.0, lam(0x3f4a2a), 0, 0.72, 0));
      g.add(box(3.1, 1.9, 2.05, lam(0x556b2f), -0.75, 1.85, 0));
      g.add(box(1.5, 1.15, 1.95, lam(0x556b2f), 1.85, 1.5, 0));
      g.add(box(0.12, 0.6, 1.5, lam(0x2c3540), 2.58, 1.75, 0));
      const wg = new THREE.CylinderGeometry(0.48, 0.48, 0.35, 10);
      for (const [wx, wz] of [[1.7, 0.95], [1.7, -0.95], [-1.6, 0.95], [-1.6, -0.95]]) {
        const w = new THREE.Mesh(wg, lam(0x1c1e24));
        w.rotation.x = Math.PI / 2;
        w.position.set(wx, 0.48, wz);
        g.add(w);
      }
      const y = heightAt(171.5, -26.5);
      g.position.set(171.5, y, -26.5);
      g.rotation.y = -0.04;
      g.traverse((m) => { if (m.isMesh) m.castShadow = true; });
      scene.add(g);
      colliders.push({ x0: 168.6, x1: 174.4, z0: -27.9, z1: -25.1 });
      sample7('depot van', 171.5, -26.5, y, 'heightAt');
    }

    // Fuel depot: two horizontal tanks on saddles + a drum cluster.
    {
      const g = new THREE.Group();
      for (const dz of [-1.3, 1.3]) {
        const tank = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.05, 4.4, 14), lam(0x8a8f96));
        tank.rotation.z = Math.PI / 2;
        tank.position.set(0, 1.25, dz);
        g.add(tank);
        g.add(box(0.5, 0.5, 0.9, lam(0x4a4a42), -1.4, 0.25, dz));
        g.add(box(0.5, 0.5, 0.9, lam(0x4a4a42), 1.4, 0.25, dz));
      }
      const drumCols = [0x556b2f, 0x8a8f96, 0x7a4b2a, 0x556b2f, 0x8a8f96, 0x556b2f];
      drumCols.forEach((c, i) => {
        const d = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.95, 10), lam(c));
        d.position.set(3.1 + (i % 3) * 0.75, 0.48, -1 + Math.floor(i / 3) * 0.8);
        g.add(d);
      });
      const y = heightAt(114.5, -57.5);
      g.position.set(114.5, y, -57.5);
      g.traverse((m) => { if (m.isMesh) m.castShadow = true; });
      scene.add(g);
      colliders.push({ x0: 111.8, x1: 118.6, z0: -59.6, z1: -55.4 });
      sample7('fuel depot', 114.5, -57.5, y, 'heightAt');
    }
    // Maintenance shed in the NE: back + side walls, open front south.
    {
      const g = new THREE.Group();
      g.add(box(9, 3.4, 0.3, lam(0x707a5e), 0, 1.7, -3));
      g.add(box(0.3, 3.4, 6, lam(0x707a5e), -4.5, 1.7, 0));
      g.add(box(0.3, 3.4, 6, lam(0x707a5e), 4.5, 1.7, 0));
      g.add(box(10, 0.3, 7.4, lam(0x4a4a42), 0, 3.6, 0));
      g.add(box(3.2, 0.9, 1.0, lam(0x6e4a2f), -1.5, 0.45, -1));
      g.add(box(1.3, 1.3, 1.3, lam(0x8a7a4a), 2.6, 0.65, -1.6));
      g.add(box(1.1, 1.1, 1.1, lam(0x8a7a4a), 2.7, 0.55, 0.4));
      const y = heightAt(168, -60.5);
      g.position.set(168, y, -60.5);
      g.traverse((m) => { if (m.isMesh) m.castShadow = true; });
      scene.add(g);
      colliders.push({ x0: 163.2, x1: 172.8, z0: -64, z1: -57 });
      sample7('maintenance shed', 168, -60.5, y, 'heightAt');
    }
    // Antenna mast with a blinking red lamp (animated list).
    {
      const g = new THREE.Group();
      g.add(box(0.22, 13, 0.22, lam(0x6a7076), 0, 6.5, 0));
      for (const hy of [4.5, 8, 11.5]) g.add(box(2.2 - hy * 0.08, 0.12, 0.12, lam(0x6a7076), 0, hy, 0));
      const lampMat = new THREE.MeshBasicMaterial({ color: 0xff2a2a });
      const lampMesh = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), lampMat);
      lampMesh.position.y = 13.2;
      g.add(lampMesh);
      const y = heightAt(117, -64.5);
      g.position.set(117, y, -64.5);
      scene.add(g);
      animated.push({
        update(t) {
          const b = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * 2.6));
          lampMat.color.setRGB(b, b * 0.08, b * 0.08);
        },
      });
      sample7('antenna mast', 117, -64.5, y, 'heightAt');
    }
    // Second watchtower at the far NE corner.
    {
      const g = new THREE.Group();
      for (const [lx, lz] of [[-0.95, -0.95], [0.95, -0.95], [-0.95, 0.95], [0.95, 0.95]]) {
        g.add(box(0.22, 7, 0.22, lam(0x6e4a2f), lx, 3.5, lz));
      }
      g.add(box(3.0, 0.25, 3.0, lam(0x6e4a2f), 0, 7.0, 0));
      g.add(box(2.8, 2.3, 2.8, lam(0x77754f), 0, 8.25, 0));
      g.add(box(2.0, 1.1, 0.14, lam(0x2c3540), 0, 8.5, 1.42));
      const cap = new THREE.Mesh(new THREE.ConeGeometry(2.6, 1.3, 4), lam(0x4a4a42));
      cap.position.y = 10.05;
      cap.rotation.y = Math.PI / 4;
      cap.castShadow = true;
      g.add(cap);
      const y = heightAt(178, -63.5);
      g.position.set(178, y, -63.5);
      g.traverse((m) => { if (m.isMesh) m.castShadow = true; });
      scene.add(g);
      colliders.push({ x0: 176.4, x1: 179.6, z0: -65.1, z1: -61.9 });
      sample7('watchtower 2', 178, -63.5, y, 'heightAt');
    }
    // Camo-net shelter over the crate stack by the first watchtower.
    {
      const g = new THREE.Group();
      for (const [px, pz] of [[-2.1, -1.5], [2.1, -1.5], [-2.1, 1.5], [2.1, 1.5]]) {
        g.add(box(0.12, 2.7, 0.12, lam(0x4a4a42), px, 1.35, pz));
      }
      const netGeo = new THREE.PlaneGeometry(5, 3.8, 6, 4);
      netGeo.rotateX(-Math.PI / 2);
      const np = netGeo.attributes.position;
      for (let i = 0; i < np.count; i++) {
        const nx = np.getX(i), nz = np.getZ(i);
        np.setY(i, -0.35 * (1 - (nx / 2.5) ** 2) * (1 - (nz / 1.9) ** 2));
      }
      netGeo.computeVertexNormals();
      const net = new THREE.Mesh(netGeo, new THREE.MeshLambertMaterial({ color: 0x44542a, side: THREE.DoubleSide }));
      net.position.y = 2.7;
      g.add(net);
      g.add(box(1.3, 1.3, 1.3, lam(0x8a7a4a), -0.9, 0.65, 0.2));
      g.add(box(1.1, 1.1, 1.1, lam(0x8a7a4a), 0.9, 0.55, -0.3));
      const y = heightAt(147.2, -17.2);
      g.position.set(147.2, y, -17.2);
      g.traverse((m) => { if (m.isMesh) m.castShadow = true; });
      scene.add(g);
      sample7('camo shelter', 147.2, -17.2, y, 'heightAt');
    }
    // Obstacle-course corner along the south fence: low walls + tires.
    {
      for (const wx of [113.5, 117]) {
        const wall = box(2.4, 0.75, 0.35, lam(0x9aa0a8), wx, heightAt(wx, -16.8) + 0.38, -16.8);
        wall.castShadow = true;
        scene.add(wall);
      }
      const tireGeo = new THREE.TorusGeometry(0.34, 0.12, 8, 14);
      for (let i = 0; i < 6; i++) {
        const tx = 120.5 + i * 1.05, tz = -16.8;
        const tire = new THREE.Mesh(tireGeo, lam(0x1c1e24));
        tire.rotation.x = Math.PI / 2;
        tire.position.set(tx, heightAt(tx, tz) + 0.13, tz);
        tire.castShadow = true;
        scene.add(tire);
      }
      sample7('obstacle course', 117, -16.8, heightAt(117, -16.8), 'heightAt');
    }
    // Target range against the north back wall: berm + three boards.
    {
      const berm = box(15, 1.6, 1.2, lam(0x8a7a52), 151, heightAt(151, -65) + 0.7, -65);
      berm.castShadow = true;
      scene.add(berm);
      for (const tx of [145.5, 151, 156.5]) {
        const ty = heightAt(tx, -63.2);
        const post = box(0.14, 1.5, 0.14, lam(0x6e4a2f), tx, ty + 0.75, -63.2);
        post.castShadow = true;
        scene.add(post);
        scene.add(box(1.1, 1.1, 0.08, lam(0xf2f2f2), tx, ty + 1.75, -63.2));
        const bull = new THREE.Mesh(new THREE.CircleGeometry(0.3, 12), lam(0xd42a2a));
        bull.position.set(tx, ty + 1.75, -63.14);
        scene.add(bull);
      }
      sample7('target range', 151, -63.2, heightAt(151, -63.2), 'heightAt');
    }
    // Sandbag walls flanking the gate road, just inside the barriers.
    {
      const bagM = lam(0xa08c5a);
      function sandbagWall(cx, cz) {
        for (let row = 0; row < 3; row++) {
          for (let i = 0; i < 4; i++) {
            const b = box(0.62, 0.26, 0.4, bagM, cx + (row % 2) * 0.3, heightAt(cx, cz) + 0.14 + row * 0.25, cz - 0.9 + i * 0.6);
            b.castShadow = true;
            scene.add(b);
          }
        }
      }
      sandbagWall(114.5, -25.4);
      sandbagWall(114.5, -34.6);
      sample7('sandbags', 114.5, -25.4, heightAt(114.5, -25.4), 'heightAt');
    }
    // Bushes and rocks scattered inside the perimeter (hand-laid).
    {
      const bushCols = [0x4a6b35, 0x55793d, 0x3f6030];
      const scatter = [
        ['bush', 111, -47], ['bush', 111.5, -21], ['bush', 144, -64.5],
        ['bush', 160, -56.5], ['bush', 176.5, -33], ['bush', 128, -15.6],
        ['bush', 158, -15.8], ['bush', 166, -15.8], ['rock', 112.5, -61],
        ['rock', 174, -57], ['rock', 137, -16.8], ['rock', 120, -36],
      ];
      scatter.forEach(([kind, sx, sz], i) => {
        const sy = heightAt(sx, sz);
        if (kind === 'bush') {
          const b = new THREE.Mesh(new THREE.SphereGeometry(0.75 + (i % 3) * 0.18, 10, 8), lam(bushCols[i % 3]));
          b.position.set(sx, sy + 0.45, sz);
          b.scale.y = 0.75;
          b.castShadow = true;
          scene.add(b);
        } else {
          const r = box(0.9 + (i % 2) * 0.4, 0.55, 0.7, lam(0x8a8f96), sx, sy + 0.24, sz, (i * 0.7) % 1.2);
          r.castShadow = true;
          scene.add(r);
        }
        sample7('garrison ' + kind + ' ' + (i + 1), sx, sz, sy, 'heightAt');
      });
    }
  }
}

// ---- The Job 2 lockup: a small garage on the east coast road -------------
// ---- BUILD 11: the city vegetation pass -----------------------------------
// Trees as SPECIES (tall coconut palms on the shore, fan palms on the
// Ocean Drive median and shop gaps, five-blob shade trees downtown,
// flowering accents), GRASS as a designed material (mowing-stripe lawns,
// tufts along the hard edges, a verge where promenade meets sand) and
// ORNAMENTAL planting (flower beds, rounded hedges, planters). All of it
// draws from its OWN rng stream (r11) so no existing seeded layout moves;
// the repeated small stuff (tufts, flower dots) is instanced, not meshed.
function buildVegetation11(scene, animated) {
  const W = WORLD;
  const r11 = makeRng(20261121);
  const GY = 0.6;   // the city pad height
  const tuftPts = [];    // {x, z, y, s, rot} — flushed into 2 InstancedMeshes
  const flowerPts = [];  // {x, y, z, c}     — flushed into 1 InstancedMesh
  const FLOWER_COLS = [0xef476f, 0xff8fb8, 0xffd23e, 0xffffff, 0xf15bb5];
  const tuftsAround = (x, z, y, n, spread) => {
    for (let i = 0; i < n; i++) {
      tuftPts.push({ x: x + range(r11, -spread, spread), z: z + range(r11, -spread, spread), y, s: range(r11, 0.8, 1.3), rot: r11() * Math.PI });
    }
  };
  const flowerDots = (cx, cz, y, n, sx, sz) => {
    for (let i = 0; i < n; i++) {
      flowerPts.push({ x: cx + range(r11, -sx, sx), y: y + range(r11, 0, 0.05), z: cz + range(r11, -sz, sz), c: pick(r11, FLOWER_COLS) });
    }
  };
  // A flower bed: concrete lip, green body, a soil top and flower dots.
  function flowerBed(cx, cz, len, y = GY) {
    const g = new THREE.Group();
    g.add(box(len, 0.3, 1.05, lam(0xb9bec6), 0, 0.15, 0));
    g.add(box(len - 0.3, 0.36, 0.78, lam(0x3a7d2c), 0, 0.18, 0));
    g.add(box(len - 0.44, 0.06, 0.6, lam(0x4a3826), 0, 0.37, 0));
    g.position.set(cx, y, cz);
    g.traverse((n) => { if (n.isMesh) n.castShadow = true; });
    scene.add(g);
    flowerDots(cx, cz, y + 0.44, Math.round(len * 2.6), len / 2 - 0.35, 0.2);
  }
  // A planter: terracotta box, soil, one round bush and flower dots.
  function planter(cx, cz, y = GY) {
    const g = new THREE.Group();
    g.add(box(1.15, 0.52, 0.6, lam(0xb0563a), 0, 0.26, 0));
    g.add(box(1.0, 0.08, 0.45, lam(0x4a3826), 0, 0.54, 0));
    const bush = new THREE.Mesh(new THREE.SphereGeometry(0.34, 7, 6), lam(0x3f9433));
    bush.position.y = 0.8;
    bush.scale.y = 0.8;
    bush.castShadow = true;
    g.add(bush);
    g.position.set(cx, y, cz);
    scene.add(g);
    flowerDots(cx, cz, y + 0.6, 6, 0.42, 0.16);
  }
  // A trimmed hedge: green box with a rounded (half-cylinder) top. The
  // long axis is x unless axisZ, in which case the segment runs along z.
  function hedge(cx, cz, len, y = GY, axisZ = false) {
    const g = new THREE.Group();
    const base = box(axisZ ? 0.55 : len, 0.5, axisZ ? len : 0.55, lam(0x2f7d32), 0, 0.25, 0);
    base.castShadow = true;
    g.add(base);
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, len, 7), lam(0x37913c));
    // Cylinder axis -> the hedge's long axis; squash the cross-section
    // axis that ends up vertical, so the top reads rounded, not round.
    if (axisZ) { top.rotation.x = Math.PI / 2; top.scale.z = 0.72; }
    else { top.rotation.z = Math.PI / 2; top.scale.x = 0.72; }
    top.position.y = 0.5;
    top.castShadow = true;
    g.add(top);
    g.position.set(cx, y, cz);
    scene.add(g);
  }
  // Mowing-stripe lawn: alternating green bands in a rotated group.
  function lawnStripes(x, z, ry, y, w, d, phase = 0) {
    const g = new THREE.Group();
    const cols = [0x66b853, 0x5cab47];
    const n = Math.max(4, Math.round(w / 4)), sw = w / n;   // ~4 m bands at any size
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(sw, d), lam(cols[(i + phase) % 2]));
      m.rotation.x = -Math.PI / 2;
      m.position.set(-w / 2 + sw * (i + 0.5), 0, 0);
      m.receiveShadow = true;
      g.add(m);
    }
    g.position.set(x, y, z);
    g.rotation.y = ry;
    scene.add(g);
  }

  // -- 1. Tall coconut palms: a second, taller row on the sand behind the
  // promenade palms (which stay as they are).
  for (let x = -160; x <= 165; x += 26) {
    const px = x + range(r11, -3, 3), pz = 199 + range(r11, -1, 1);
    if (Math.abs(px - W.pier.x) < 13) continue;              // the pier mouth
    if (Math.abs(px - W.ferris.x) < 11) continue;            // the wheel
    if (Math.abs(px - W.carousel.x) < 10) continue;          // the carousel
    if (Math.abs(px - W.statue.x) < 10) continue;            // the statue plaza
    const p = makePalm(r11, range(r11, 10.5, 13));
    const py = groundHeight(px, pz);
    p.position.set(px, py, pz);
    scene.add(p);
    addSway(animated, p, r11, 0.02);
    tuftsAround(px, pz, py, 3, 0.8);
  }

  // -- 2. Fan palms on the Ocean Drive median: a grass-topped strip in
  // the centre of the boulevard (lanes run at ±4, the strip is 1.7 wide),
  // segmented so the avenue crossings stay clear.
  for (let i = 0; i < W.avenues.length - 1; i++) {
    const a = W.avenues[i] + 11, b = W.avenues[i + 1] - 11;
    if (b - a < 12) continue;
    const mid = (a + b) / 2, len = b - a;
    const kerb = box(len, 0.22, 1.7, lam(0x9aa0a8), mid, GY + 0.11, W.oceanDrive);
    kerb.receiveShadow = true;
    scene.add(kerb);
    const top = box(len, 0.07, 1.45, lam(0x5cab47), mid, GY + 0.25, W.oceanDrive);
    top.receiveShadow = true;
    scene.add(top);
    for (let x = a + 4.5; x <= b - 4; x += 9.5) {
      const p = makeFanPalm(r11, range(r11, 3.6, 4.4));
      p.position.set(x, GY + 0.28, W.oceanDrive);
      scene.add(p);
      addSway(animated, p, r11, 0.016);
      tuftPts.push({ x: x + 1.8, z: W.oceanDrive - 0.55, y: GY + 0.28, s: range(r11, 0.8, 1.2), rot: r11() * Math.PI });
      tuftPts.push({ x: x - 2.2, z: W.oceanDrive + 0.55, y: GY + 0.28, s: range(r11, 0.8, 1.2), rot: r11() * Math.PI });
    }
  }
  // -- 3. Fan palms in the gaps between the Ocean Drive shops.
  for (const gx of [-98, -78, -58, 38, 58, 78, 98]) {
    const p = makeFanPalm(r11, range(r11, 3.8, 4.6));
    p.position.set(gx, GY, 186.3);
    scene.add(p);
    addSway(animated, p, r11, 0.016);
    tuftsAround(gx, 186.3, GY, 3, 0.7);
  }

  // -- 4. Shade trees on the downtown sidewalks: both sides of every
  // avenue, at z bands clear of the street crossings and the lamp row.
  for (const a of [-100, -50, 0, 50, 100, 140]) {
    for (const sd of [-1, 1]) {
      for (const tz of [52, 98, 144, 185]) {
        const tx = a + sd * (W.roadHalf + 1.3);
        if (tx > W.park.x0 - 3 && tx < W.park.x1 + 3 && tz > W.park.z0 - 3 && tz < W.park.z1 + 3) continue;  // the park plants its own
        const t = makeShadeTree(r11, range(r11, 0.95, 1.25));
        t.position.set(tx, GY, tz + range(r11, -1.5, 1.5));
        scene.add(t);
        addSway(animated, t, r11, 0.008);
        tuftsAround(tx, tz, GY, 2, 0.75);
      }
    }
  }

  // -- 5. The park: mowing stripes over the lawn, hedges along the
  // jogging path (with a gap at the Job 3 hideout), flower beds at the
  // south entrance, shade trees in the corners, two flowering accents.
  lawnStripes((W.park.x0 + W.park.x1) / 2, (W.park.z0 + W.park.z1) / 2, 0, GY + 0.045, W.park.x1 - W.park.x0, W.park.z1 - W.park.z0, 0);
  for (const hz of [63.7, 68.3]) {
    hedge(70.25, hz, 23.5, GY);
    hedge(105.75, hz, 23.5, GY);
  }
  flowerBed(61, 84.5, 6);
  flowerBed(115, 84.5, 6);
  flowerBed(88, 85.5, 5);
  for (const [tx, tz] of [[63, 51], [113, 51], [63, 81], [113, 81]]) {
    const t = makeShadeTree(r11, range(r11, 1.15, 1.35));
    t.position.set(tx, GY, tz);
    scene.add(t);
    addSway(animated, t, r11, 0.008);
    tuftsAround(tx, tz, GY, 3, 0.85);
  }
  for (const [tx, tz, blossom] of [[74, 71.5, 0xff8fb8], [102, 60.5, 0xffb35c]]) {
    const t = makeFloweringTree(r11, range(r11, 1.05, 1.2), blossom);
    t.position.set(tx, GY, tz);
    scene.add(t);
    addSway(animated, t, r11, 0.01);
    tuftsAround(tx, tz, GY, 3, 0.8);
  }
  for (let z = 47; z <= 85; z += 6.3) {
    tuftPts.push({ x: W.park.x0 + 1.6, z, y: GY, s: range(r11, 0.8, 1.25), rot: r11() * Math.PI });
    tuftPts.push({ x: W.park.x1 - 1.6, z: z + 3, y: GY, s: range(r11, 0.8, 1.25), rot: r11() * Math.PI });
  }

  // -- 6. The hospital front: a striped lawn patch west of the entrance
  // canopy, flower beds flanking the doors, flowering trees at the
  // corners of the frontage.
  lawnStripes(-137.75, 190.5, 0, GY + 0.045, 6.5, 9, 1);
  flowerBed(-137.5, 187, 5);
  flowerBed(-118.5, 187, 5);
  for (const [tx, tz, blossom] of [[-143, 190, 0xff8fb8], [-110, 190, 0xffb35c]]) {
    const t = makeFloweringTree(r11, range(r11, 1.0, 1.15), blossom);
    t.position.set(tx, GY, tz);
    scene.add(t);
    addSway(animated, t, r11, 0.01);
    tuftsAround(tx, tz, GY, 3, 0.8);
  }

  // -- 7. Shop fronts: a flower bed under every shop window and planters
  // flanking every door (the keeper stands between them); planters at
  // the dealership's glass front too.
  for (const shop of SHOPS) {
    flowerBed(shop.x - 3.4, 186.6, 5.4);
    planter(shop.x + 1.35, 186.3);
    planter(shop.x + 4.25, 186.3);
  }
  planter(110.5, 147.8);
  planter(129.5, 147.8);

  // -- 8. Palmera Heights + the roadside houses: striped front lawns and
  // hedge rows flanking the driveways (kept clear of the mailboxes).
  const HOUSES11 = [
    [175, 32, Math.PI / 2], [175, 45, Math.PI / 2], [175, 58, Math.PI / 2], [175, 71, Math.PI / 2],
    [197, 38, -Math.PI / 2], [197, 51, -Math.PI / 2], [197, 64, -Math.PI / 2], [197, 77, -Math.PI / 2],
    [88, -55, -Math.PI / 2], [30, -48, Math.PI / 2], [72, 2, -Math.PI / 2], [196, -58, Math.PI / 2],
  ];
  HOUSES11.forEach(([hx, hz, ry], i) => {
    lawnStripes(hx, hz, ry, heightAt(hx, hz) + 0.068, 11.5, 10.5, i % 2);
  });
  for (const hz of [32, 45, 58, 71]) {           // west row, fronts face +x
    hedge(180.55, hz + 3.3, 2.2, heightAt(180.55, hz), true);
    hedge(180.55, hz - 4.75, 1.3, heightAt(180.55, hz), true);
    tuftsAround(180.2, hz + 5.2, heightAt(180.2, hz), 2, 0.5);
  }
  for (const hz of [38, 51, 64, 77]) {           // east row, fronts face −x
    hedge(191.45, hz - 3.3, 2.2, heightAt(191.45, hz), true);
    hedge(191.45, hz + 4.75, 1.3, heightAt(191.45, hz), true);
    tuftsAround(191.8, hz - 5.2, heightAt(191.8, hz), 2, 0.5);
  }

  // -- 9. A grass verge where the promenade meets the sand (the pier
  // mouth stays clear), and tufts along the downtown sidewalk edges.
  for (let x = -166; x <= 150; x += 16.4) {
    const cx = x + 8;
    if (Math.abs(cx - W.pier.x) < 11) continue;
    const vy = groundHeight(cx, 195.4);
    const v = box(15.8, 0.07, 1.7, lam(0x63b34f), cx, vy + 0.045, 195.4);
    v.receiveShadow = true;
    scene.add(v);
  }
  const roadSpans = [[27, 43], [72, 88], [117, 133], [160, 176]];
  for (const a of [-100, -50, 0, 50, 100, 140]) {
    for (const sd of [-1, 1]) {
      for (let z = 21; z <= 189; z += 7.5) {
        const zz = z + range(r11, -1.6, 1.6);
        if (roadSpans.some(([s0, s1]) => zz > s0 - 1 && zz < s1 + 1)) continue;
        tuftPts.push({ x: a + sd * (W.roadHalf + 0.35), z: zz, y: GY, s: range(r11, 0.75, 1.2), rot: r11() * Math.PI });
      }
    }
  }
  for (const st of W.streets) {
    for (const sd of [-1, 1]) {
      for (let x = -160; x <= 152; x += 9.5) {
        const xx = x + range(r11, -2, 2);
        if (W.avenues.some((a) => Math.abs(xx - a) < 10.5)) continue;
        if (xx > W.park.x0 - 2 && xx < W.park.x1 + 2 && st === 80) continue;   // park frontage
        tuftPts.push({ x: xx, z: st + sd * (W.roadHalf + 0.35), y: GY, s: range(r11, 0.75, 1.2), rot: r11() * Math.PI });
      }
    }
  }

  // -- Flush the tufts: two crossed-blade geometries as InstancedMeshes
  // (two greens), one draw call each for the whole city.
  const bladeGeo = (() => {
    const pos = [], nor = [], idx = [];
    const quad = (cx, cz, ry) => {
      const c = Math.cos(ry), s = Math.sin(ry), hw = 0.21, hh = 0.34;
      const base = pos.length / 3;
      for (const [lx, ly] of [[-hw, 0], [hw, 0], [hw * 0.55, hh], [-hw * 0.55, hh]]) {
        pos.push(cx + lx * c, ly, cz - lx * s);
        nor.push(s, 0.25, c);
      }
      idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    };
    quad(0, 0, 0);
    quad(0, 0, Math.PI / 2);
    quad(0, 0, Math.PI / 4);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(nor), 3));
    geo.setIndex(idx);
    return geo;
  })();
  const dummy = new THREE.Object3D();
  [0x5cab47, 0x6fbf5a].forEach((col, half) => {
    const pts = tuftPts.filter((_, i) => i % 2 === half);
    if (!pts.length) return;
    const im = new THREE.InstancedMesh(bladeGeo, new THREE.MeshLambertMaterial({ color: col, side: THREE.DoubleSide }), pts.length);
    pts.forEach((p, i) => {
      dummy.position.set(p.x, p.y, p.z);
      dummy.rotation.set(0, p.rot, 0);
      dummy.scale.setScalar(p.s);
      dummy.updateMatrix();
      im.setMatrixAt(i, dummy.matrix);
    });
    im.instanceMatrix.needsUpdate = true;
    scene.add(im);
  });
  // -- Flush the flower dots: one InstancedMesh, per-instance colour.
  if (flowerPts.length) {
    const im = new THREE.InstancedMesh(
      new THREE.SphereGeometry(0.078, 6, 5),
      new THREE.MeshLambertMaterial({ color: 0xffffff }), flowerPts.length);
    const col = new THREE.Color();
    flowerPts.forEach((p, i) => {
      dummy.position.set(p.x, p.y, p.z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.setScalar(range(r11, 0.85, 1.25));
      dummy.updateMatrix();
      im.setMatrixAt(i, dummy.matrix);
      im.setColorAt(i, col.setHex(p.c));
    });
    im.instanceMatrix.needsUpdate = true;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
    scene.add(im);
  }
}

function buildLockup(scene, colliders) {
  const W = WORLD;
  const g = new THREE.Group();
  g.add(box(10, 4.5, 8, lam(0xcfd8dc), 0, 2.25, 0));
  g.add(box(11, 0.4, 9, lam(0x8a8f96), 0, 4.7, 0));
  g.add(box(6, 3.2, 0.3, lam(0x33373d), 0, 1.6, 4.1));
  // BUILD 13: roller-door slats + a roof vent, so the lockup door
  // reads as a shutter, not a slab.
  for (const sy of [0.75, 1.45, 2.15, 2.85]) g.add(box(6.05, 0.07, 0.33, lam(0x495057), 0, sy, 4.1));
  g.add(box(1.4, 0.7, 1.4, lam(0x9aa0a8), -3.2, 5.15, -2));
  g.add(box(6.4, 0.5, 0.34, lam(0xf2b134), 0, 3.4, 4.1));
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(8.6, 1.7),
    new THREE.MeshBasicMaterial({ map: signTexture('PALMERA LOCKUP', '#33373d') }));
  sign.position.set(0, 4.0, 4.28);
  g.add(sign);
  const gy = heightAt(W.lockup.x + 6, W.lockup.z);
  g.position.set(W.lockup.x + 6, gy, W.lockup.z);
  g.rotation.y = -Math.PI / 2;   // the door faces the coast road, west
  g.traverse((n) => { if (n.isMesh) n.castShadow = true; });
  scene.add(g);
  colliders.push({ x0: 197.5, x1: 206.5, z0: 90.5, z1: 101.5 });
}

// Point-in-collider test used by movement code (circle radius r).
export function hitsCollider(colliders, x, z, r) {
  for (const c of colliders) {
    if (x > c.x0 - r && x < c.x1 + r && z > c.z0 - r && z < c.z1 + r) return c;
  }
  return null;
}
