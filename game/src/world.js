// The world builder: one organic island, sea on every side. The terrain is
// a single vertex-coloured mesh shaped by config.heightAt — sand at the
// shore, grass inland, dry desert in the north-east, rock on the mountain.
// On it sit the south city (concrete pad, roads WITH RAISED SIDEWALKS,
// crosswalks, downtown blocks), the beach strip (statue, pier, wheel, shop
// row), Palmera Intl on its reclaimed plateau, the coastal highway loop,
// the north freeway, a lakeside hamlet and the wild north. Building
// footprints are exported as AABBs for collision.

import { WORLD, SHOPS, PALETTE, coastRadius, heightAt, groundHeight, highwayLoopPoints, FREEWAY_PTS } from './config.js';
import { pick, range } from './random.js';

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
  return canvasTexture(128, (g, s) => {
    g.fillStyle = '#3c4148'; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 380; i++) {
      g.fillStyle = Math.random() > 0.5 ? '#43484f' : '#353a41';
      g.fillRect(Math.random() * s, Math.random() * s, 2, 2);
    }
    g.fillStyle = '#f7d154';
    g.fillRect(s / 2 - 2, 8, 4, 34); g.fillRect(s / 2 - 2, 86, 4, 34); // centre dashes along V
  }, [1, 14]);
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

function windowTexture(rng) {
  return canvasTexture(128, (g, s) => {
    g.fillStyle = '#2c3540'; g.fillRect(0, 0, s, s);
    for (let y = 8; y < s - 8; y += 18) for (let x = 8; x < s - 8; x += 16) {
      g.fillStyle = rng() > 0.42 ? '#ffe9a8' : '#5a7186';
      g.fillRect(x, y, 10, 12);
    }
  }, [2, 6]);
}

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
  const m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
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

// ---- world ----------------------------------------------------------------
export function buildWorld(scene, rng) {
  const W = WORLD;
  const colliders = [];
  const animated = [];

  scene.background = new THREE.Color(PALETTE.sky);
  scene.fog = new THREE.Fog(PALETTE.fog, 230, 560);
  scene.add(new THREE.HemisphereLight(0xcfeeff, 0x8a7a5a, 0.95));
  const sun = new THREE.DirectionalLight(0xfff2d8, 1.55);
  sun.position.set(150, 220, 130);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -295; sun.shadow.camera.right = 295;
  sun.shadow.camera.top = 295; sun.shadow.camera.bottom = -295;
  sun.shadow.camera.far = 800;
  scene.add(sun);

  buildTerrain(scene);

  // The sea, all the way around, plus the lake in the north-centre.
  const waterTex = canvasTexture(128, (g, s) => {
    g.fillStyle = '#1f9bb8'; g.fillRect(0, 0, s, s);
    g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 3;
    for (let i = 0; i < 7; i++) {
      g.beginPath();
      const y = (i * 19) % s;
      g.moveTo(0, y); g.bezierCurveTo(s * 0.3, y + 5, s * 0.6, y - 5, s, y); g.stroke();
    }
  }, [42, 42]);
  const water = new THREE.Mesh(new THREE.PlaneGeometry(1500, 1500),
    new THREE.MeshLambertMaterial({ map: waterTex, transparent: true, opacity: 0.9 }));
  water.rotation.x = -Math.PI / 2;
  water.position.set(0, 0.1, 0);
  scene.add(water);
  const lake = new THREE.Mesh(new THREE.CircleGeometry(W.lake.waterR, 26),
    lam(0x2ea6c8, { transparent: true, opacity: 0.94 }));
  lake.rotation.x = -Math.PI / 2;
  lake.position.set(W.lake.x, W.lake.waterY, W.lake.z);
  scene.add(lake);
  animated.push({ update(t) { waterTex.offset.y = t * 0.02; waterTex.offset.x = t * 0.006; } });

  // City concrete pad under the grid.
  const pad = new THREE.Mesh(new THREE.PlaneGeometry(W.city.x1 - W.city.x0, W.city.z1 - W.city.z0), lam(PALETTE.sidewalk));
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
      scene.add(box(0.8, 0.04, 4.6, crossMat, x + i * 2.6, 0.66, z - W.roadHalf + 1.2));
      scene.add(box(0.8, 0.04, 4.6, crossMat, x + i * 2.6, 0.66, z + W.roadHalf - 1.2));
    }
  }

  // ---- SIDEWALKS: raised light-concrete strips along every city road ----
  const swMat = lam(PALETTE.sidewalk);
  function sidewalk(w, d, x, z) {
    const m = box(w, 0.14, d, swMat, x, 0.67, z);
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
  const winTex = windowTexture(rng);
  function building(x, z, w, d, h, tone) {
    const g = new THREE.Group();
    const wallMat = new THREE.MeshLambertMaterial({ map: winTex, color: tone });
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat);
    body.position.y = h / 2;
    body.castShadow = true; body.receiveShadow = true;
    g.add(body);
    g.add(box(w + 0.5, 0.5, d + 0.5, lam(0x8a8f96), 0, h + 0.2, 0));       // parapet
    g.add(box(w * 0.4, 1.1, d * 0.4, lam(0x9aa0a8), 0, h + 0.9, 0));      // roof block
    g.add(box(w + 0.2, 1.0, 0.4, lam(0xe4572e), 0, 0.5, d / 2 + 0.1));     // shopfront band
    g.position.set(x, 0.6, z);
    scene.add(g);
    colliders.push({ x0: x - w / 2 - 0.4, x1: x + w / 2 + 0.4, z0: z - d / 2 - 0.4, z1: z + d / 2 + 0.4 });
  }
  const xs = [-172].concat(W.avenues, [162]);
  const zs = [8, 35, 80, 125, 160];
  for (let i = 0; i < xs.length - 1; i++) for (let j = 0; j < zs.length - 1; j++) {
    const x0 = xs[i] + W.roadHalf + 2, x1 = xs[i + 1] - W.roadHalf - 2;
    const z0 = zs[j] + W.roadHalf + 2, z1 = zs[j + 1] - W.roadHalf - 2;
    if (x1 - x0 < 12 || z1 - z0 < 12) continue;
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    if (cx > W.park.x0 - 6 && cx < W.park.x1 + 6 && cz > W.park.z0 - 6 && cz < W.park.z1 + 6) continue; // park
    const downtown = cz < 85;
    const bw = Math.min(x1 - x0, range(rng, 16, 30));
    const bd = Math.min(z1 - z0, range(rng, 14, 26));
    const h = downtown ? range(rng, 26, 62) : range(rng, 9, 24);
    building(cx + range(rng, -3, 3), cz + range(rng, -3, 3), bw, bd, h, pick(rng, PALETTE.buildingTones));
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
  for (let i = 0; i < 10; i++) {
    const p = makePalm(rng, range(rng, 6, 10));
    const px = range(rng, W.park.x0 + 4, W.park.x1 - 4), pz = range(rng, W.park.z0 + 4, W.park.z1 - 4);
    p.position.set(px, 0.6, pz);
    scene.add(p);
    const bench = box(2.2, 0.5, 0.7, lam(0x7a4a21), px + 2.4, 0.85, pz + 1);
    bench.castShadow = true;
    scene.add(bench);
  }

  buildAirport(scene, rng, colliders, animated);
  buildClinic(scene, colliders);
  buildBeachStrip(scene, rng, animated);
  buildNorth(scene, rng, colliders);
  buildLockup(scene, colliders);
  return { colliders, animated, lightHeads };
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
  // Two parked low-poly jets.
  function makePlane(color, x, z, ry) {
    const g = new THREE.Group();
    const bodyMat = lam(0xf2f4f6);
    const fus = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.7, 17, 10), bodyMat);
    fus.rotation.x = Math.PI / 2;
    fus.position.y = 3;
    fus.castShadow = true;
    g.add(fus);
    const nose = new THREE.Mesh(new THREE.SphereGeometry(1.7, 10, 8), bodyMat);
    nose.position.set(0, 3, 8.5);
    g.add(nose);
    g.add(box(3.2, 0.7, 1.6, lam(0x9fd8e8), 0, 3.9, 7.6));
    g.add(box(0.5, 0.28, 15, lam(color), 0, 3.4, 0));
    g.add(box(12.5, 0.28, 2.4, lam(0xd8dde2), 0, 2.6, 0.5));
    for (const s of [-1, 1]) {
      const eng = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 2.4, 8), lam(0x8a8f96));
      eng.rotation.x = Math.PI / 2;
      eng.position.set(3.4 * s, 1.9, 0.6);
      g.add(eng);
      g.add(box(0.5, 1.1, 1.1, lam(0x33373d), 0.85 * s, 0.55, -2.5));
    }
    g.add(box(0.28, 3, 2, lam(color), 0, 5.4, -8));
    g.add(box(5.4, 0.24, 1.4, lam(0xd8dde2), 0, 4.2, -8.2));
    g.position.set(x, gy, z);
    g.rotation.y = ry;
    scene.add(g);
    colliders.push({ x0: x - 7, x1: x + 7, z0: z - 9, z1: z + 9 });
    return g;
  }
  makePlane(0x2e86c8, -216, 108, 0.45);
  makePlane(0xe4572e, -224, 168, -0.35);
  // Service vehicles: a fuel tanker and a baggage-cart train.
  const tanker = new THREE.Group();
  const tank = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.3, 6.4, 10), lam(0xf2b134));
  tank.rotation.z = Math.PI / 2;
  tank.position.y = 1.8;
  tanker.add(tank);
  tanker.add(box(1.9, 1.5, 2, lam(0xf2f4f6), 4.1, 1.15, 0));
  tanker.add(box(7.6, 0.5, 2.2, lam(0x33373d), 0, 0.45, 0));
  tanker.position.set(-206, gy, 128);
  tanker.rotation.y = 0.2;
  scene.add(tanker);
  for (let i = 0; i < 3; i++) {
    const cart = new THREE.Group();
    cart.add(box(2.2, 1, 1.3, lam(0x9fd8e8), 0, 0.85, 0));
    cart.add(box(2.4, 0.3, 1.5, lam(0x33373d), 0, 0.3, 0));
    cart.position.set(-208 - i * 3.1, gy, 92);
    scene.add(cart);
  }
  // Perimeter fence along the plateau's city edge.
  for (let z = 46; z <= 202; z += 9) scene.add(box(0.14, 1.6, 0.14, lam(0x8a8f96), -120, gy + 0.8, z));
  scene.add(box(0.08, 0.12, 160, lam(0x8a8f96), -120, gy + 1.55, 124));
}

// ---- Bay Clinic: a small hospital on the strip, west of the shop row ----
function buildClinic(scene, colliders) {
  const g = new THREE.Group();
  g.add(box(17, 7, 9, lam(0xf7f7f2), 0, 3.5, 0));
  g.add(box(18, 0.7, 10, lam(0xd42a2a), 0, 7.2, 0));
  g.add(box(3.4, 3, 0.5, lam(0x9fd8e8), -4, 1.5, 4.6));
  g.add(box(3.4, 3, 0.5, lam(0x9fd8e8), 4, 1.5, 4.6));
  g.add(box(0.7, 2, 0.2, lam(0xd42a2a), 0, 5.4, 4.6));
  g.add(box(2, 0.7, 0.2, lam(0xd42a2a), 0, 5.4, 4.6));
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(10, 1.9),
    new THREE.MeshBasicMaterial({ map: signTexture('BAY CLINIC', '#b02020') }));
  sign.position.set(0, 6.2, 4.72);
  g.add(sign);
  g.position.set(-128, 0.6, WORLD.shopsZ);
  scene.add(g);
  colliders.push({ x0: -136.9, x1: -119.1, z0: 175.1, z1: 184.9 });
  const amb = new THREE.Group();
  amb.add(box(4.6, 2.1, 2.1, lam(0xf7f7f2), 0, 1.35, 0));
  amb.add(box(1.6, 1.2, 2, lam(0x9fd8e8), 2.9, 1, 0));
  amb.add(box(4.7, 0.5, 2.15, lam(0xd42a2a), 0, 1.5, 0));
  amb.add(box(0.5, 1.3, 0.1, lam(0xd42a2a), -1, 1.6, 1.06));
  amb.add(box(1.3, 0.5, 0.1, lam(0xd42a2a), -1, 1.6, 1.06));
  amb.position.set(-120, 0.6, 191);
  amb.rotation.y = Math.PI / 2;
  scene.add(amb);
}

// Palms: a bent trunk of stacked segments and a star of long leaves.
export function makePalm(rng, h = 7) {
  const g = new THREE.Group();
  const trunkMat = lam(0x8a6844);
  let x = 0, y = 0;
  const lean = range(rng, -0.5, 0.5);
  for (let i = 0; i < 5; i++) {
    const seg = box(0.42 - i * 0.04, h / 5 + 0.1, 0.42 - i * 0.04, trunkMat, x, y + h / 10, 0);
    seg.rotation.z = lean * 0.14;
    g.add(seg);
    x += lean * 0.22; y += h / 5;
  }
  const leafMat = lam(0x2f9e44);
  for (let i = 0; i < 7; i++) {
    const leaf = box(0.28, 0.06, 3.4, leafMat, x, y + 0.25, 0);
    leaf.rotation.y = (i / 7) * Math.PI * 2;
    leaf.rotation.x = 0.5;
    leaf.translateZ(1.4);
    g.add(leaf);
  }
  g.traverse((n) => { if (n.isMesh) n.castShadow = true; });
  return g;
}

function buildBeachStrip(scene, rng, animated) {
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
  const boats = [];
  function boat(color, scale) {
    const b = new THREE.Group();
    b.add(box(2.2 * scale, 0.9 * scale, 6 * scale, lam(color), 0, 0.5 * scale, 0));
    b.add(box(1.8 * scale, 0.8 * scale, 1.6 * scale, lam(0xf2f2f2), 0, 1.3 * scale, -0.8 * scale));
    b.add(box(0.18 * scale, 3 * scale, 0.18 * scale, lam(0x6e4a2f), 0, 2.4 * scale, 0.8 * scale));
    b.add(box(0.06, 2.6 * scale, 1.9 * scale, lam(0xffffff), 0, 2.6 * scale, 0.75 * scale));
    return b;
  }
  const ship = boat(0xd42a2a, 2.6);
  ship.position.set(-140, 0.4, 292);
  scene.add(ship); boats.push({ g: ship, speed: 1.1, base: 0.4 });
  const b2 = boat(0xf2b134, 1);
  b2.position.set(60, 0.25, 264);
  scene.add(b2); boats.push({ g: b2, speed: -0.7, base: 0.25 });
  animated.push({ update(t) { for (const b of boats) { b.g.position.x += Math.sin(t * 0.05) * 0.002 + b.speed * 0.016; if (b.g.position.x > 260) b.g.position.x = -260; if (b.g.position.x < -260) b.g.position.x = 260; b.g.position.y = b.base + Math.sin(t * 1.3 + b.base * 9) * 0.12; b.g.rotation.z = Math.sin(t + b.base * 7) * 0.03; } } });

  // Jetskis zipping parallel to the shore.
  const skis = [];
  for (let i = 0; i < 2; i++) {
    const s = new THREE.Group();
    s.add(box(1.1, 0.5, 2.6, lam(i ? 0x06d6a0 : 0xef476f), 0, 0.35, 0));
    s.add(box(0.5, 0.5, 0.8, lam(0x22242a), 0, 0.8, 0.3));
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
  for (const shop of SHOPS) {
    const g = new THREE.Group();
    g.add(box(15, 6.4, 9, lam(0xf7f0dd), 0, 3.2, 0));
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
    if (shop.kind === 'donuts') {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(1.1, 0.45, 8, 16), lam(0xff6fa5));
      ring.position.set(5.6, 7.6, 0); ring.castShadow = true;
      g.add(ring);
    }
    if (shop.kind === 'fish') {
      const fin = box(3.4, 1.1, 0.3, lam(0x63c7e6), -5.4, 7.5, 0);
      fin.rotation.z = 0.2;
      g.add(fin);
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

// ---- The wild north: pines on the slopes, desert scatter, the lake hamlet --
function buildNorth(scene, rng, colliders) {
  const W = WORLD;
  const loopPts = highwayLoopPoints();

  function makeTree(scale) {
    const g = new THREE.Group();
    g.add(box(0.35 * scale, 1.6 * scale, 0.35 * scale, lam(0x6e4a2f), 0, 0.8 * scale, 0));
    const c1 = new THREE.Mesh(new THREE.ConeGeometry(1.7 * scale, 3.4 * scale, 7), lam(0x2e7d43));
    c1.position.y = 3 * scale; c1.castShadow = true;
    g.add(c1);
    const c2 = new THREE.Mesh(new THREE.ConeGeometry(1.2 * scale, 2.6 * scale, 7), lam(0x35984f));
    c2.position.y = 4.6 * scale; c2.castShadow = true;
    g.add(c2);
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
      const cactus = new THREE.Group();
      cactus.add(box(0.38, 2.1, 0.38, lam(0x3d9950), 0, 1.05, 0));
      cactus.add(box(0.28, 0.9, 0.28, lam(0x3d9950), 0.45, 1.35, 0));
      cactus.add(box(0.28, 0.7, 0.28, lam(0x3d9950), -0.45, 1.15, 0));
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
  lakeBoat.add(box(1.8, 0.7, 4.6, lam(0x2e86c8), 0, 0.35, 0));
  lakeBoat.add(box(1.5, 0.5, 1.2, lam(0xf2f2f2), 0, 0.9, -0.6));
  lakeBoat.position.set(68, 0.45, -126);
  lakeBoat.rotation.y = 0.7;
  scene.add(lakeBoat);
}

// ---- The Job 2 lockup: a small garage on the east coast road -------------
function buildLockup(scene, colliders) {
  const W = WORLD;
  const g = new THREE.Group();
  g.add(box(10, 4.5, 8, lam(0xcfd8dc), 0, 2.25, 0));
  g.add(box(11, 0.4, 9, lam(0x8a8f96), 0, 4.7, 0));
  g.add(box(6, 3.2, 0.3, lam(0x33373d), 0, 1.6, 4.1));
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
