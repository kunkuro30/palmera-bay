// The city of Palmera Bay: a 6x6 grid of blocks on a coast, built once from the seed.
// Roads, sidewalks and the beach are painted onto one big ground texture; buildings are
// boxes with canvas-generated lit-window facades; palms and lamps are instanced. The sea
// is a separate animated plane. Building footprints are kept as AABBs for collision.
import {
  AVENUES, BEACH_Z, BLOCK_CENTERS, COAST_Z, KEEP_CLEAR, MARINA,
  PALETTE, ROAD_HALF, SEA_Z,
} from './config.js';
import { pick, range } from './random.js';

const THREE = window.THREE;

/** Which road (if any) a point is on: 'avenue' (north-south), 'street', 'coast' or null. */
export function streetAt(x, z) {
  if (Math.abs(z - COAST_Z) <= ROAD_HALF) return 'coast';
  for (const a of AVENUES) if (Math.abs(x - a) <= ROAD_HALF) return 'avenue';
  for (const a of AVENUES) if (Math.abs(z - a) <= ROAD_HALF) return 'street';
  return null;
}

export function isRoad(x, z) {
  return streetAt(x, z) !== null;
}

/** Push a circle (pos.x/pos.z, radius) out of every building AABB. Mutates pos. */
export function pushOutOfBuildings(pos, radius, buildings) {
  for (const b of buildings) {
    const nx = Math.max(b.minX, Math.min(pos.x, b.maxX));
    const nz = Math.max(b.minZ, Math.min(pos.z, b.maxZ));
    const dx = pos.x - nx;
    const dz = pos.z - nz;
    const d2 = dx * dx + dz * dz;
    if (d2 > radius * radius) continue;
    if (d2 > 1e-8) {
      const d = Math.sqrt(d2);
      pos.x = nx + (dx / d) * radius;
      pos.z = nz + (dz / d) * radius;
    } else {
      const pl = pos.x - b.minX;
      const pr = b.maxX - pos.x;
      const pt = pos.z - b.minZ;
      const pb = b.maxZ - pos.z;
      const m = Math.min(pl, pr, pt, pb);
      if (m === pl) pos.x = b.minX - radius;
      else if (m === pr) pos.x = b.maxX + radius;
      else if (m === pt) pos.z = b.minZ - radius;
      else pos.z = b.maxZ + radius;
    }
  }
}

function canvasTexture(w, h, draw) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  draw(canvas.getContext('2d'), w, h);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** One facade variant: a wall colour with a grid of windows, some lit warm for the sunset. */
function facadeTexture(rng, base, litRatio) {
  return canvasTexture(128, 256, (g) => {
    g.fillStyle = base;
    g.fillRect(0, 0, 128, 256);
    const cols = 6;
    const rows = 11;
    for (let c = 0; c < cols; c += 1) {
      for (let r = 0; r < rows; r += 1) {
        const lit = rng() < litRatio;
        g.fillStyle = lit ? '#ffd98a' : '#3d4c5a';
        g.fillRect(8 + c * 20, 10 + r * 22, 12, 14);
        if (lit && rng() < 0.3) {
          g.fillStyle = 'rgba(255,240,200,0.5)';
          g.fillRect(8 + c * 20, 10 + r * 22, 12, 5);
        }
      }
    }
  });
}

function groundTexture(rng) {
  const S = 1024;
  const scale = S / 640;
  const cx = (x) => (x + 320) * scale;
  const cy = (z) => (340 - z) * scale;
  return canvasTexture(S, S, (g) => {
    g.fillStyle = '#6f7268';
    g.fillRect(0, 0, S, S);
    // Block aprons (sidewalk concrete) and plaza interiors.
    for (const bx of BLOCK_CENTERS) {
      for (const bz of BLOCK_CENTERS) {
        g.fillStyle = '#7b7f72';
        g.fillRect(cx(bx - 30), cy(bz + 30), 60 * scale, 60 * scale);
        const park = bx === 143 && bz === -157;
        g.fillStyle = park ? '#4e7d3a' : (rng() < 0.5 ? '#83817a' : '#7d7a70');
        g.fillRect(cx(bx - 23), cy(bz + 23), 46 * scale, 46 * scale);
      }
    }
    // Beach sand, then the sea line under the animated plane.
    g.fillStyle = '#e8cf9f';
    g.fillRect(cx(-320), cy(SEA_Z + 4), 640 * scale, (SEA_Z + 4 - BEACH_Z) * scale);
    g.fillStyle = 'rgba(160,120,70,0.35)';
    for (let i = 0; i < 900; i += 1) {
      g.fillRect(cx(range(rng, -320, 320)), cy(range(rng, BEACH_Z, SEA_Z)), 2, 2);
    }
    // Roads: dark asphalt strips with a dashed centre line.
    const road = (x0, z0, x1, z1) => {
      g.fillStyle = '#35322e';
      g.fillRect(cx(x0), cy(z1), (x1 - x0) * scale, (z1 - z0) * scale);
    };
    for (const a of AVENUES) {
      road(a - ROAD_HALF, -300, a + ROAD_HALF, 206);
      road(-215, a - ROAD_HALF, 215, a + ROAD_HALF);
    }
    road(-215, COAST_Z - ROAD_HALF, 215, COAST_Z + ROAD_HALF);
    g.fillStyle = '#d8b34a';
    for (const a of AVENUES) {
      for (let z = -296; z < 200; z += 9) g.fillRect(cx(a - 0.18), cy(z + 3.4), 0.36 * scale, 3.4 * scale);
      for (let x = -212; x < 212; x += 9) g.fillRect(cx(x), cy(a + 0.18), 3.4 * scale, 0.36 * scale);
    }
    for (let x = -212; x < 212; x += 9) g.fillRect(cx(x), cy(COAST_Z + 0.18), 3.4 * scale, 0.36 * scale);
  });
}

const PASTELS = [0xf7c8d8, 0xbfe8d0, 0xf5ead2, 0xf7e3a1, 0xc9d9f2];
const NEUTRALS = [0xd8cfc0, 0xb9c0c4, 0xe3d3b8, 0xc4b49a, 0xaebfc9, 0xd9b8a6];

export function buildWorld(scene, rng) {
  const buildings = [];
  const animated = { boats: [] };

  scene.background = new THREE.Color(PALETTE.horizon);
  scene.fog = new THREE.Fog(PALETTE.fog, 160, 1350);

  const skyTex = canvasTexture(16, 512, (g) => {
    // The sphere's equator sits at the canvas middle: the warm band belongs there.
    const grad = g.createLinearGradient(0, 0, 0, 512);
    grad.addColorStop(0, '#16224a');
    grad.addColorStop(0.3, '#3d3266');
    grad.addColorStop(0.44, '#a34d68');
    grad.addColorStop(0.5, '#ff9e5e');
    grad.addColorStop(0.56, '#e2703a');
    grad.addColorStop(0.75, '#7a3b4d');
    grad.addColorStop(1, '#2a1e33');
    g.fillStyle = grad;
    g.fillRect(0, 0, 16, 512);
  });
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(1500, 24, 12),
    new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, fog: false }),
  );
  scene.add(sky);

  scene.add(new THREE.HemisphereLight(0xffd9a8, 0x7a4a3a, 1.0));
  const sun = new THREE.DirectionalLight(PALETTE.sun, 1.6);
  sun.position.set(-180, 260, 300);
  scene.add(sun);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(640, 640),
    new THREE.MeshLambertMaterial({ map: groundTexture(rng) }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, 0, 20);
  scene.add(ground);

  // Distant water under everything, then the animated near sea.
  const deep = new THREE.Mesh(
    new THREE.PlaneGeometry(4000, 4000),
    new THREE.MeshLambertMaterial({ color: 0x14586b }),
  );
  deep.rotation.x = -Math.PI / 2;
  deep.position.y = -0.5;
  scene.add(deep);

  const seaGeo = new THREE.PlaneGeometry(1500, 460, 56, 10);
  seaGeo.rotateX(-Math.PI / 2);
  const sea = new THREE.Mesh(seaGeo, new THREE.MeshPhongMaterial({
    color: PALETTE.sea, shininess: 110, specular: 0xaaddff, transparent: true, opacity: 0.97,
  }));
  sea.position.set(0, 0.05, SEA_Z + 225);
  scene.add(sea);
  const seaBase = seaGeo.attributes.position.array.slice();

  // Facades: four shared variants, tinted per building.
  const facades = [
    facadeTexture(rng, '#c9bda6', 0.5), facadeTexture(rng, '#b3c3cd', 0.44),
    facadeTexture(rng, '#d2c2ab', 0.55), facadeTexture(rng, '#bcaca0', 0.4),
  ];
  const roofMat = new THREE.MeshLambertMaterial({ color: 0x3a3733 });
  const crossTex = canvasTexture(128, 128, (g) => {
    g.fillStyle = '#eef0ee';
    g.fillRect(0, 0, 128, 128);
    g.fillStyle = '#c9332c';
    g.fillRect(52, 22, 24, 84);
    g.fillRect(22, 52, 84, 24);
  });

  function addBuilding(x, z, w, d, h, tint, tex) {
    const mat = new THREE.MeshLambertMaterial({ map: tex || pick(rng, facades), color: tint });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [mat, mat, roofMat, roofMat, mat, mat]);
    mesh.position.set(x, h / 2, z);
    scene.add(mesh);
    const b = { minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2, h, mesh };
    buildings.push(b);
    return b;
  }

  function clearOfKeepClear(x, z, w, d) {
    for (const p of KEEP_CLEAR) {
      if (p.x > x - w / 2 - 3 && p.x < x + w / 2 + 3 && p.z > z - d / 2 - 3 && p.z < z + d / 2 + 3) return false;
    }
    return true;
  }

  const neonColors = [0xff4fd8, 0x37e0ff, 0xff7847, 0xffe14d];
  let neonIndex = 0;

  for (const bx of BLOCK_CENTERS) {
    for (const bz of BLOCK_CENTERS) {
      if (bx === 143 && bz === -157) continue; // the park
      if (bx === 83 && bz === 143) { // the marina: one low waterfront building
        addBuilding(88, 136, 30, 13, 8, 0xf5ead2);
        continue;
      }
      if (bx === 23 && bz === 143) { // the hospital
        addBuilding(25, 140, 26, 16, 15, 0xffffff, crossTex);
        continue;
      }
      if (bx === -37 && bz === 143) { // the lifeguard warehouse, low and wide
        addBuilding(-46, 154, 22, 12, 9, 0xd9c9a8);
        continue;
      }
      if (bx === -157 && bz === 83) { // the lockup yard building
        addBuilding(-172, 92, 14, 12, 7, 0xb9b0a0);
        continue;
      }
      const downtown = Math.abs(bx) <= 97 && Math.abs(bz) <= 97;
      const coastRow = bz === 143;
      if (rng() < 0.3) { // one tower per block, sometimes
        const w = range(rng, 24, 34);
        const d = range(rng, 24, 34);
        const h = downtown ? range(rng, 34, 68) : coastRow ? range(rng, 12, 24) : range(rng, 20, 44);
        if (clearOfKeepClear(bx, bz, w, d)) {
          const tint = coastRow ? pick(rng, PASTELS) : pick(rng, NEUTRALS);
          const b = addBuilding(bx, bz, w, d, h, tint);
          if (coastRow) addNeon(b);
        }
        continue;
      }
      for (const ox of [-11.5, 11.5]) {
        for (const oz of [-11.5, 11.5]) {
          if (rng() < 0.38) continue;
          const w = range(rng, 12, 20);
          const d = range(rng, 12, 20);
          const h = downtown ? range(rng, 24, 56) : coastRow ? range(rng, 9, 21) : range(rng, 11, 38);
          const x = bx + ox;
          const z = bz + oz;
          if (!clearOfKeepClear(x, z, w, d)) continue;
          const tint = coastRow ? pick(rng, PASTELS) : pick(rng, NEUTRALS);
          const b = addBuilding(x, z, w, d, h, tint);
          if (coastRow && rng() < 0.5) addNeon(b);
        }
      }
    }
  }

  function addNeon(b) {
    if (neonIndex >= 6) return;
    const w = b.maxX - b.minX;
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(Math.min(7, w * 0.6), 1.5),
      new THREE.MeshBasicMaterial({ color: neonColors[neonIndex % neonColors.length] }),
    );
    neonIndex += 1;
    sign.position.set((b.minX + b.maxX) / 2, b.h * 0.55, b.maxZ + 0.08);
    scene.add(sign);
  }

  // The lockup fence: four low walls with a gap at the street gate.
  const fenceMat = new THREE.MeshLambertMaterial({ color: 0x8f9296 });
  for (const [x, z, w, d] of [[-150, 64.5, 26, 0.4], [-163, 74, 0.4, 20], [-137, 74, 0.4, 20], [-150, 84, 26, 0.4]]) {
    const fence = new THREE.Mesh(new THREE.BoxGeometry(w, 1.7, d), fenceMat);
    fence.position.set(x, 0.85, z);
    scene.add(fence);
  }

  // The marina pier and two boats bobbing past the waterline.
  const pier = new THREE.Mesh(new THREE.BoxGeometry(5, 0.7, 52), new THREE.MeshLambertMaterial({ color: 0x8a6f4d }));
  pier.position.set(MARINA.x, 0.35, 226);
  scene.add(pier);
  for (const [x, z, color] of [[46, 272, 0xf2f2f2], [76, 280, 0x3f7fbf]]) {
    const boat = new THREE.Group();
    const hull = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.1, 6.4), new THREE.MeshLambertMaterial({ color }));
    hull.position.y = 0.4;
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.9, 2.2), new THREE.MeshLambertMaterial({ color: 0xe8e2d4 }));
    cabin.position.set(0, 1.2, -0.6);
    boat.add(hull, cabin);
    boat.position.set(x, 0, z);
    boat.rotation.y = range(rng, -0.4, 0.4);
    scene.add(boat);
    animated.boats.push(boat);
  }

  // Palms: instanced trunks and crowns.
  const palmSpots = [];
  for (let x = -204; x <= 204; x += 17) {
    palmSpots.push([x + range(rng, -3, 3), 182.6]);
    if (rng() < 0.7) palmSpots.push([x + range(rng, -3, 3), 204]);
  }
  for (let i = 0; i < 5; i += 1) palmSpots.push([143 + range(rng, -16, 16), -157 + range(rng, -16, 16)]);
  for (let i = 0; i < 10; i += 1) {
    const a = pick(rng, AVENUES);
    palmSpots.push([a + (rng() < 0.5 ? -9.6 : 9.6), range(rng, -190, 160)]);
  }
  const trunkGeo = new THREE.CylinderGeometry(0.16, 0.3, 4.6, 6);
  trunkGeo.translate(0, 2.3, 0);
  const crownGeo = new THREE.ConeGeometry(2.1, 1.7, 8);
  crownGeo.translate(0, 5.15, 0);
  const trunks = new THREE.InstancedMesh(trunkGeo, new THREE.MeshLambertMaterial({ color: 0x7a5c3d }), palmSpots.length);
  const crowns = new THREE.InstancedMesh(crownGeo, new THREE.MeshLambertMaterial({ color: 0x4c8a3d, side: THREE.DoubleSide }), palmSpots.length);
  const dummy = new THREE.Object3D();
  palmSpots.forEach(([x, z], i) => {
    dummy.position.set(x, 0, z);
    dummy.rotation.set(range(rng, -0.09, 0.09), rng() * Math.PI * 2, range(rng, -0.09, 0.09));
    const s = range(rng, 0.9, 1.3);
    dummy.scale.set(s, s, s);
    dummy.updateMatrix();
    trunks.setMatrixAt(i, dummy.matrix);
    crowns.setMatrixAt(i, dummy.matrix);
  });
  scene.add(trunks, crowns);

  // Park benches.
  const benchMat = new THREE.MeshLambertMaterial({ color: 0x6b4a2f });
  for (let i = 0; i < 3; i += 1) {
    const bench = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.5, 0.7), benchMat);
    bench.position.set(143 + range(rng, -14, 14), 0.45, -157 + range(rng, -14, 14));
    bench.rotation.y = rng() * Math.PI;
    scene.add(bench);
  }

  // Lamps: instanced poles and glowing heads along the avenues and the coast road.
  const lampSpots = [];
  for (const a of AVENUES) {
    let side = 1;
    for (let z = -190; z <= 190; z += 38) {
      lampSpots.push([a + side * 8.6, z]);
      side = -side;
    }
  }
  for (let x = -190; x <= 190; x += 38) lampSpots.push([x, COAST_Z - 8.6]);
  const poleGeo = new THREE.CylinderGeometry(0.09, 0.12, 5.2, 5);
  poleGeo.translate(0, 2.6, 0);
  const headGeo = new THREE.SphereGeometry(0.34, 8, 6);
  headGeo.translate(0, 5.3, 0);
  const poles = new THREE.InstancedMesh(poleGeo, new THREE.MeshLambertMaterial({ color: 0x3c4043 }), lampSpots.length);
  const heads = new THREE.InstancedMesh(headGeo, new THREE.MeshBasicMaterial({ color: 0xffdca8 }), lampSpots.length);
  lampSpots.forEach(([x, z], i) => {
    dummy.position.set(x, 0, z);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    poles.setMatrixAt(i, dummy.matrix);
    heads.setMatrixAt(i, dummy.matrix);
  });
  scene.add(poles, heads);

  return {
    buildings,
    update(t) {
      const pos = seaGeo.attributes.position;
      for (let i = 0; i < pos.count; i += 1) {
        const x = seaBase[i * 3];
        const z = seaBase[i * 3 + 2];
        pos.setY(i, Math.sin(x * 0.07 + t * 1.25) * 0.16 + Math.cos(z * 0.09 + t * 0.8) * 0.13);
      }
      pos.needsUpdate = true;
      seaGeo.computeVertexNormals();
      animated.boats.forEach((boat, i) => {
        boat.position.y = Math.sin(t * 0.9 + i * 2.1) * 0.14;
        boat.rotation.z = Math.sin(t * 0.7 + i) * 0.03;
      });
    },
  };
}
