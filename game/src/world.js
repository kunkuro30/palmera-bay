// world.js — builds Palmera Bay itself: the sunset sky, the road grid, the
// buildings with lit windows, the beach and the sea, palms and streetlights.
// Everything visual that never moves lives here; it also hands the other
// modules the road layout and the building colliders they collide with.

import { CITY } from './config.js';
import { makeRng, range } from './random.js';

// Road centre lines: one avenue runs along each gap between blocks, plus a
// coast road between the city grid and the beach.
export function avenuePositions() {
  const lines = [];
  for (let i = 0; i < CITY.blocksPerSide; i++) {
    lines.push(-CITY.half + i * CITY.pitch + CITY.blockSize + CITY.roadWidth / 2);
  }
  return lines; // length 6, ascending; the last one is the perimeter avenue
}

export const COAST_ROAD_Z = CITY.half + 12;

// A canvas texture of a building facade: rows of windows, some lit warm by the
// sunset, drawn once per colour family and reused by every building.
function facadeTexture(rng, base, litRatio) {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = base; g.fillRect(0, 0, 128, 256);
  for (let y = 10; y < 246; y += 16) {
    for (let x = 10; x < 118; x += 18) {
      const lit = rng() < litRatio;
      g.fillStyle = lit ? '#ffd98a' : 'rgba(20,26,44,0.85)';
      g.fillRect(x, y, 11, 9);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function skyTexture() {
  const c = document.createElement('canvas');
  c.width = 32; c.height = 512;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0.0, '#241447');
  grad.addColorStop(0.34, '#6a4a9e');
  grad.addColorStop(0.55, '#e2607a');
  grad.addColorStop(0.72, '#ff9a56');
  grad.addColorStop(0.82, '#ffd98a');
  grad.addColorStop(1.0, '#ffdf9e');
  g.fillStyle = grad; g.fillRect(0, 0, 32, 512);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createWorld(scene, seed) {
  const rng = makeRng(seed);
  const world = { colliders: [], update: null, sea: null };

  // --- sky, light, fog -------------------------------------------------
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(1400, 24, 16),
    new THREE.MeshBasicMaterial({ map: skyTexture(), side: THREE.BackSide, fog: false }),
  );
  scene.add(sky);
  scene.fog = new THREE.Fog(0xe88a6a, 260, 1150);

  const sun = new THREE.DirectionalLight(0xffb36b, 2.6);
  sun.position.set(-420, 210, 520);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -260; sun.shadow.camera.right = 260;
  sun.shadow.camera.top = 260; sun.shadow.camera.bottom = -260;
  sun.shadow.camera.far = 1600;
  scene.add(sun);
  scene.add(new THREE.HemisphereLight(0xffd9b0, 0x33415e, 1.05));
  scene.add(new THREE.AmbientLight(0x604a3a, 0.55));
  const fill = new THREE.DirectionalLight(0x7a86ff, 0.35);
  fill.position.set(300, 200, -300);
  scene.add(fill);

  // --- ground, roads, sidewalks ----------------------------------------
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(2400, 2400),
    new THREE.MeshLambertMaterial({ color: 0x3d4a3a }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.05;
  ground.receiveShadow = true;
  scene.add(ground);

  const roadMat = new THREE.MeshLambertMaterial({ color: 0x2e2e38 });
  const walkMat = new THREE.MeshLambertMaterial({ color: 0x9a8f7d });
  const avenues = avenuePositions();
  const span = CITY.half * 2 + CITY.roadWidth;
  for (const a of avenues) {
    for (const alongZ of [true, false]) {
      const walk = new THREE.Mesh(new THREE.PlaneGeometry(CITY.roadWidth + 5, span), walkMat);
      walk.rotation.x = -Math.PI / 2;
      if (!alongZ) walk.rotation.z = Math.PI / 2;
      walk.position.y = 0.0;
      const road = new THREE.Mesh(new THREE.PlaneGeometry(CITY.roadWidth, span), roadMat);
      road.rotation.x = -Math.PI / 2;
      if (!alongZ) road.rotation.z = Math.PI / 2;
      road.position.y = 0.02;
      road.receiveShadow = true;
      if (alongZ) { walk.position.x = a; road.position.x = a; }
      else { walk.position.z = a; road.position.z = a; }
      scene.add(walk); scene.add(road);
    }
  }
  // coast road along the beach
  const coast = new THREE.Mesh(new THREE.PlaneGeometry(span + 200, 12), roadMat);
  coast.rotation.x = -Math.PI / 2;
  coast.position.set(0, 0.02, COAST_ROAD_Z);
  coast.receiveShadow = true;
  scene.add(coast);

  // lane dashes down the middle of every avenue
  const dashGeo = new THREE.PlaneGeometry(0.35, 4.2);
  const dashMat = new THREE.MeshBasicMaterial({ color: 0xf5d76e });
  const dashCount = avenues.length * 2 * Math.floor(span / 9) + Math.floor((span + 200) / 9);
  const dashes = new THREE.InstancedMesh(dashGeo, dashMat, dashCount);
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
  const qz = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, Math.PI / 2));
  const one = new THREE.Vector3(1, 1, 1);
  let di = 0;
  for (const a of avenues) {
    for (let d = -span / 2 + 6; d < span / 2 - 4; d += 9) {
      dashes.setMatrixAt(di++, new THREE.Matrix4().compose(new THREE.Vector3(a, 0.04, d), q, one));
      dashes.setMatrixAt(di++, new THREE.Matrix4().compose(new THREE.Vector3(d, 0.04, a), qz, one));
    }
  }
  for (let d = -span / 2 - 90; d < span / 2 + 90; d += 9) {
    dashes.setMatrixAt(di++, new THREE.Matrix4().compose(new THREE.Vector3(d, 0.04, COAST_ROAD_Z), qz, one));
  }
  dashes.count = di;
  scene.add(dashes);

  // --- buildings ---------------------------------------------------------
  const facades = [
    facadeTexture(rng, '#8a5a68', 0.42), facadeTexture(rng, '#5d6a8a', 0.36),
    facadeTexture(rng, '#a87a52', 0.48), facadeTexture(rng, '#4e5e66', 0.3),
    facadeTexture(rng, '#7d5470', 0.4),
  ];
  const roofMat = new THREE.MeshLambertMaterial({ color: 0x3a3542 });
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  for (let bx = 0; bx < CITY.blocksPerSide; bx++) {
    for (let bz = 0; bz < CITY.blocksPerSide; bz++) {
      const x0 = -CITY.half + bx * CITY.pitch;
      const z0 = -CITY.half + bz * CITY.pitch;
      const downtown = Math.hypot(bx - 2.5, bz - 2.5); // 0 at the centre
      const plots = rng() < 0.4 ? 1 : 2;
      for (let p = 0; p < plots; p++) {
        const w = plots === 1 ? CITY.blockSize - 6 : (CITY.blockSize - 8) / 2;
        const d = CITY.blockSize - 6;
        const h = downtown < 1.6 ? range(rng, 34, 88) : downtown < 3 ? range(rng, 18, 46) : range(rng, 9, 24);
        const cx = plots === 1 ? x0 + CITY.blockSize / 2 : x0 + 4 + w / 2 + p * (w + 2);
        const cz = z0 + CITY.blockSize / 2;
        const mat = new THREE.MeshLambertMaterial({ map: facades[Math.floor(rng() * facades.length)] });
        const b = new THREE.Mesh(boxGeo, [mat, mat, roofMat, roofMat, mat, mat]);
        b.scale.set(w, h, d);
        b.position.set(cx, h / 2, cz);
        b.castShadow = true; b.receiveShadow = true;
        scene.add(b);
        world.colliders.push({ minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2 });
        if (rng() < 0.6) { // rooftop box so silhouettes are not all flat
          const cap = new THREE.Mesh(boxGeo, roofMat);
          const capH = range(rng, 1.5, 3.4);
          cap.scale.set(w * 0.4, capH, d * 0.4);
          cap.position.set(cx + range(rng, -w / 6, w / 6), h + capH / 2, cz);
          scene.add(cap);
        }
      }
    }
  }
  // the Sol Tower: one landmark needle on the central block
  const towerMat = new THREE.MeshLambertMaterial({ color: 0x2c3550, emissive: 0x1a2440 });
  const tower = new THREE.Mesh(boxGeo, towerMat);
  tower.scale.set(16, 128, 16);
  tower.position.set(-CITY.half + 2 * CITY.pitch + 23, 64, -CITY.half + 2 * CITY.pitch + 23);
  tower.castShadow = true;
  scene.add(tower);
  world.colliders.push({ minX: tower.position.x - 8, maxX: tower.position.x + 8, minZ: tower.position.z - 8, maxZ: tower.position.z + 8 });
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(1.6, 10, 8),
    new THREE.MeshBasicMaterial({ color: 0xff4444 }));
  beacon.position.set(tower.position.x, 130, tower.position.z);
  scene.add(beacon);

  // --- beach + sea -------------------------------------------------------
  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(2400, CITY.beachDepth),
    new THREE.MeshLambertMaterial({ color: 0xe8c98a }),
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(0, 0.01, CITY.half + CITY.beachDepth / 2 + 6);
  sand.receiveShadow = true;
  scene.add(sand);
  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(2400, CITY.waterDepth),
    new THREE.MeshPhongMaterial({ color: 0x2a7a9e, shininess: 140, specular: 0xffc98a }),
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(0, 0.12, CITY.half + CITY.beachDepth + 6 + CITY.waterDepth / 2);
  scene.add(sea);
  world.sea = sea;

  // --- palms + streetlights ----------------------------------------------
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x7a5c38 });
  const frondMat = new THREE.MeshLambertMaterial({ color: 0x3f8a4f, side: THREE.DoubleSide });
  const trunkGeo = new THREE.CylinderGeometry(0.22, 0.34, 7, 6);
  const frondGeo = new THREE.ConeGeometry(3.4, 1.1, 7);
  function palm(x, z, lean) {
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.y = 3.5; trunk.rotation.z = lean; trunk.castShadow = true;
    g.add(trunk);
    const crown = new THREE.Mesh(frondGeo, frondMat);
    crown.position.set(-Math.sin(lean) * 3.4, 7.1, 0);
    crown.rotation.x = Math.PI; crown.castShadow = true;
    g.add(crown);
    g.position.set(x, 0, z);
    g.rotation.y = rng() * Math.PI * 2;
    scene.add(g);
    world.colliders.push({ minX: x - 0.4, maxX: x + 0.4, minZ: z - 0.4, maxZ: z + 0.4 });
  }
  for (let x = -CITY.half - 30; x < CITY.half + 30; x += range(rng, 16, 30)) {
    palm(x, CITY.half + range(rng, 22, 34), range(rng, -0.14, 0.14));
  }
  for (const a of avenues) {
    for (let d = -CITY.half + 20; d < CITY.half; d += 60) {
      if (rng() < 0.7) palm(a + CITY.roadWidth / 2 + 2.4, d, range(rng, -0.08, 0.08));
    }
  }
  const poleGeo = new THREE.CylinderGeometry(0.12, 0.12, 6.4, 5);
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x22242c });
  const lampGeo = new THREE.SphereGeometry(0.3, 8, 6);
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xffdf9e });
  for (const a of avenues) {
    for (let d = -CITY.half + 12; d < CITY.half; d += 42) {
      for (const s of [-1, 1]) {
        const pole = new THREE.Mesh(poleGeo, poleMat);
        pole.position.set(a + s * (CITY.roadWidth / 2 + 1.2), 3.2, d);
        scene.add(pole);
        const lamp = new THREE.Mesh(lampGeo, lampMat);
        lamp.position.set(a + s * (CITY.roadWidth / 2 + 0.6), 6.5, d);
        scene.add(lamp);
      }
    }
  }

  let t = 0;
  world.update = (dt) => {
    t += dt;
    sea.position.y = 0.12 + Math.sin(t * 0.7) * 0.05;
    beacon.material.color.setHSL(0, 0.85, 0.45 + 0.25 * Math.sin(t * 3.2));
  };
  return world;
}

// Circle-vs-buildings collision: push the circle out of every AABB it enters.
export function collideCircle(world, pos, radius) {
  for (const c of world.colliders) {
    const nx = Math.max(c.minX, Math.min(pos.x, c.maxX));
    const nz = Math.max(c.minZ, Math.min(pos.z, c.maxZ));
    const dx = pos.x - nx, dz = pos.z - nz;
    const d2 = dx * dx + dz * dz;
    if (d2 < radius * radius) {
      if (d2 > 1e-6) {
        const d = Math.sqrt(d2);
        pos.x = nx + (dx / d) * radius;
        pos.z = nz + (dz / d) * radius;
      } else {
        pos.x = c.maxX + radius; // centre inside the box: exit east
      }
    }
  }
  const lim = CITY.half + CITY.beachDepth + CITY.waterDepth - 6;
  pos.x = Math.max(-lim, Math.min(pos.x, lim));
  pos.z = Math.max(-CITY.half - 20, Math.min(pos.z, lim));
}
