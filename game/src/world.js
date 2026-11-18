// world.js — Palmera Bay itself: sunset sky, the 6x6 street grid, canvas-faced
// buildings, the Sol Tower, palms, streetlights, beach and sea, plus the
// building colliders everything else bumps into.

import { CITY, AVENUES } from './config.js';
import { range, pick } from './random.js';

const BLOCK_CENTERS = [-150, -90, -30, 30, 90, 150];

function facadeTexture(rng, base, litRatio) {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = base;
  g.fillRect(0, 0, 128, 256);
  g.fillStyle = 'rgba(0,0,0,0.18)';
  g.fillRect(0, 238, 128, 18);
  const cols = 6;
  const rows = 13;
  const ww = 128 / cols;
  const wh = 256 / rows;
  for (let x = 0; x < cols; x++) {
    for (let y = 0; y < rows; y++) {
      const lit = rng() < litRatio;
      g.fillStyle = lit ? (rng() < 0.25 ? '#ffe9a8' : '#ffc46b') : '#1d222e';
      g.fillRect(x * ww + 3, y * wh + 4, ww - 6, wh - 8);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

export function createWorld(scene, rng) {
  const colliders = [];

  // --- sky, sun and air -------------------------------------------------
  scene.fog = new THREE.Fog(0xf0a56e, 150, 820);
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(900, 24, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        top: { value: new THREE.Color(0x35457e) },
        mid: { value: new THREE.Color(0xe2603f) },
        low: { value: new THREE.Color(0xffc98a) },
      },
      vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: [
        'varying vec3 vP; uniform vec3 top; uniform vec3 mid; uniform vec3 low;',
        'void main(){ float h = normalize(vP).y;',
        ' vec3 c = h > 0.10 ? mix(mid, top, smoothstep(0.10, 0.62, h)) : mix(low, mid, smoothstep(-0.06, 0.10, h));',
        ' gl_FragColor = vec4(c, 1.0); }',
      ].join('\n'),
    }),
  );
  scene.add(sky);

  const sunDir = new THREE.Vector3(-420, 210, 520);
  const sunDisc = new THREE.Mesh(
    new THREE.CircleGeometry(46, 24),
    new THREE.MeshBasicMaterial({ color: 0xffd9a0, fog: false }),
  );
  sunDisc.position.copy(sunDir).normalize().multiplyScalar(860);
  sunDisc.lookAt(0, 0, 0);
  scene.add(sunDisc);

  const sun = new THREE.DirectionalLight(0xffbe78, 2.6);
  sun.position.copy(sunDir);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -250;
  sun.shadow.camera.right = 250;
  sun.shadow.camera.top = 250;
  sun.shadow.camera.bottom = -250;
  sun.shadow.camera.near = 50;
  sun.shadow.camera.far = 1400;
  sun.shadow.bias = -0.0006;
  scene.add(sun);
  scene.add(new THREE.HemisphereLight(0xffd9b0, 0x44557a, 1.05));
  scene.add(new THREE.AmbientLight(0xffb27a, 0.55));

  // --- ground, sand, sea --------------------------------------------------
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(560, 470),
    new THREE.MeshStandardMaterial({ color: 0x55534b, roughness: 1 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, -0.02, -25);
  ground.receiveShadow = true;
  scene.add(ground);

  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(960, CITY.beachDepth + 36),
    new THREE.MeshStandardMaterial({ color: 0xe6c07c, roughness: 1 }),
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(0, 0.004, CITY.sandFrom + (CITY.beachDepth + 36) / 2);
  sand.receiveShadow = true;
  scene.add(sand);

  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(1100, 380),
    new THREE.MeshStandardMaterial({ color: 0x17607e, roughness: 0.32, metalness: 0.15 }),
  );
  sea.rotation.x = -Math.PI / 2;
  const seaZ = CITY.sandFrom + CITY.beachDepth + 186;
  sea.position.set(0, -0.15, seaZ);
  scene.add(sea);
  const foam = new THREE.Mesh(
    new THREE.PlaneGeometry(1100, 3.2),
    new THREE.MeshBasicMaterial({ color: 0xfdf6e3, transparent: true, opacity: 0.5 }),
  );
  foam.rotation.x = -Math.PI / 2;
  foam.position.set(0, 0.03, CITY.sandFrom + CITY.beachDepth + 1.5);
  scene.add(foam);

  // --- roads, sidewalks, dashes -------------------------------------------
  const roadMat = new THREE.MeshStandardMaterial({ color: 0x2b2c33, roughness: 0.95 });
  const walkMat = new THREE.MeshStandardMaterial({ color: 0x7e7f88, roughness: 1 });
  const roadGeoV = new THREE.PlaneGeometry(CITY.roadWidth, CITY.half * 2 + 14);
  const roadGeoH = new THREE.PlaneGeometry(CITY.half * 2 + 14, CITY.roadWidth);
  const walkGeoV = new THREE.BoxGeometry(3, 0.09, CITY.half * 2 + 14);
  const walkGeoH = new THREE.BoxGeometry(CITY.half * 2 + 14, 0.09, 3);
  const addStrip = (geo, mat, x, y, z) => {
    const m = new THREE.Mesh(geo, mat);
    if (geo === roadGeoV || geo === roadGeoH) m.rotation.x = -Math.PI / 2;
    m.position.set(x, y, z);
    m.receiveShadow = true;
    scene.add(m);
    return m;
  };
  for (const a of AVENUES) {
    addStrip(roadGeoV, roadMat, a, 0.02, 0);
    addStrip(roadGeoH, roadMat, 0, 0.02, a);
    addStrip(walkGeoV, walkMat, a - CITY.roadWidth / 2 - 1.6, 0.045, 0);
    addStrip(walkGeoV, walkMat, a + CITY.roadWidth / 2 + 1.6, 0.045, 0);
    addStrip(walkGeoH, walkMat, 0, 0.045, a - CITY.roadWidth / 2 - 1.6);
    addStrip(walkGeoH, walkMat, 0, 0.045, a + CITY.roadWidth / 2 + 1.6);
  }
  const coast = new THREE.Mesh(new THREE.PlaneGeometry(560, CITY.roadWidth), roadMat);
  coast.rotation.x = -Math.PI / 2;
  coast.position.set(0, 0.02, CITY.coastZ);
  coast.receiveShadow = true;
  scene.add(coast);
  addStrip(new THREE.BoxGeometry(560, 0.09, 3), walkMat, 0, 0.045, CITY.coastZ - CITY.roadWidth / 2 - 1.6);
  addStrip(new THREE.BoxGeometry(560, 0.09, 3), walkMat, 0, 0.045, CITY.coastZ + CITY.roadWidth / 2 + 1.6);

  const dashGeo = new THREE.BoxGeometry(0.28, 0.02, 3.2);
  const dashMat = new THREE.MeshBasicMaterial({ color: 0xf5d76e });
  const dashSpots = [];
  for (const a of AVENUES) {
    for (let z = -CITY.half + 5; z < CITY.half; z += 9) {
      if (!AVENUES.some((c) => Math.abs(z - c) < 9)) dashSpots.push([a, z, 0]);
    }
    for (let x = -CITY.half + 5; x < CITY.half; x += 9) {
      if (!AVENUES.some((c) => Math.abs(x - c) < 9)) dashSpots.push([x, a, 1]);
    }
  }
  for (let x = -260; x < 260; x += 9) dashSpots.push([x, CITY.coastZ, 1]);
  const dashes = new THREE.InstancedMesh(dashGeo, dashMat, dashSpots.length);
  const mtx = new THREE.Matrix4();
  const quat = new THREE.Quaternion();
  const eul = new THREE.Euler();
  dashSpots.forEach(([x, z, horiz], i) => {
    eul.set(0, horiz ? Math.PI / 2 : 0, 0);
    quat.setFromEuler(eul);
    mtx.compose(new THREE.Vector3(x, 0.035, z), quat, new THREE.Vector3(1, 1, 1));
    dashes.setMatrixAt(i, mtx);
  });
  scene.add(dashes);

  // --- buildings ------------------------------------------------------------
  const bases = ['#8a5a44', '#a06a4a', '#7a6a72', '#96755a', '#6e5a6e', '#b08059', '#5f6a7a', '#8f4f3d'];
  const facadeMats = bases.map((b) => new THREE.MeshStandardMaterial({
    map: facadeTexture(rng, b, range(rng, 0.35, 0.6)), roughness: 0.9,
  }));
  // the beachfront row wears pastel art-deco: soft pink, mint, cream, pale gold
  const decoBases = ['#f2b8c6', '#b8e3c9', '#f7ead2', '#f9e08a', '#f5c9a8', '#c9d8f2'];
  const decoMats = decoBases.map((b) => new THREE.MeshStandardMaterial({
    map: facadeTexture(rng, b, range(rng, 0.3, 0.45)), roughness: 0.85,
  }));
  const neonMats = [0xff5fa2, 0x39d5e8, 0xff5fa2, 0xffe95e].map((c) => new THREE.MeshBasicMaterial({ color: c }));
  let neonIdx = 0;
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x3a3a42, roughness: 1 });
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);

  function addBuilding(cx, cz, w, d, h, mat) {
    const mesh = new THREE.Mesh(boxGeo, [mat, mat, roofMat, roofMat, mat, mat]);
    mesh.scale.set(w, h, d);
    mesh.position.set(cx, h / 2, cz);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    colliders.push({ minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2 });
    // rooftop cap: a smaller slab and a couple of boxes for silhouette
    const cap = new THREE.Mesh(boxGeo, roofMat);
    cap.scale.set(w * 0.4, 1.6, d * 0.4);
    cap.position.set(cx + range(rng, -w / 6, w / 6), h + 0.8, cz + range(rng, -d / 6, d / 6));
    cap.castShadow = true;
    scene.add(cap);
    return mesh;
  }

  for (const bx of BLOCK_CENTERS) {
    for (const bz of BLOCK_CENTERS) {
      if (bx === -30 && bz === -30) continue; // the Sol Tower's block
      const distC = Math.hypot(bx, bz);
      const beachfront = bz === 150;
      const h = beachfront ? range(rng, 16, 30) : distC < 90 ? range(rng, 38, 82) : range(rng, 14, 42);
      const w = range(rng, 30, 40);
      const d = range(rng, 30, 40);
      const cx = bx + range(rng, -3, 3);
      const cz = bz + range(rng, -3, 3);
      addBuilding(cx, cz, w, d, h, beachfront ? pick(rng, decoMats) : pick(rng, facadeMats));
      if (beachfront && neonIdx < neonMats.length && bx % 60 === 30) {
        // a neon sign on the coast-facing wall, glowing against the sunset
        const sign = new THREE.Mesh(new THREE.PlaneGeometry(7.5, 1.6), neonMats[neonIdx++]);
        sign.position.set(cx, range(rng, 6, 10), cz + d / 2 + 0.08);
        scene.add(sign);
      }
    }
  }

  // the Sol Tower: the bay's landmark, with a beacon that never sleeps
  const towerMat = new THREE.MeshStandardMaterial({
    map: facadeTexture(rng, '#4a5a78', 0.72), roughness: 0.7, metalness: 0.2,
  });
  addBuilding(-37, -37, 21, 21, 128, towerMat);
  const beaconMat = new THREE.MeshBasicMaterial({ color: 0xff4444 });
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(1.5, 10, 8), beaconMat);
  beacon.position.set(-37, 131, -37);
  scene.add(beacon);
  const beaconLight = new THREE.PointLight(0xff5545, 60, 90, 1.6);
  beaconLight.position.copy(beacon.position);
  scene.add(beaconLight);

  // --- palms and streetlights ----------------------------------------------
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x7a5b3a, roughness: 1 });
  const frondMat = new THREE.MeshStandardMaterial({ color: 0x2e7d46, roughness: 1, side: THREE.DoubleSide });
  const trunkGeo = new THREE.CylinderGeometry(0.14, 0.24, 5.6, 6);
  const frondGeo = new THREE.PlaneGeometry(3.1, 0.75);
  frondGeo.translate(1.35, 0, 0);
  function addPalm(x, z) {
    const palm = new THREE.Group();
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.y = 2.8;
    trunk.rotation.z = range(rng, -0.09, 0.09);
    trunk.castShadow = true;
    palm.add(trunk);
    for (let i = 0; i < 6; i++) {
      const frond = new THREE.Mesh(frondGeo, frondMat);
      frond.position.y = 5.6;
      frond.rotation.y = (i / 6) * Math.PI * 2 + range(rng, -0.3, 0.3);
      frond.rotation.z = range(rng, -0.55, -0.25);
      palm.add(frond);
    }
    palm.position.set(x, 0, z);
    scene.add(palm);
  }
  for (let x = -250; x < 260; x += 21) addPalm(x + range(rng, -4, 4), CITY.coastZ + 13 + range(rng, 0, 5));
  for (let i = 0; i < 16; i++) addPalm(range(rng, -250, 250), range(rng, 215, 262));
  for (const a of AVENUES) {
    addPalm(a + 10.5, a - 30);
    addPalm(a - 10.5, a + 42);
  }

  const poleMat = new THREE.MeshStandardMaterial({ color: 0x2c2e35, roughness: 0.8 });
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xffca7a });
  const poleGeo = new THREE.CylinderGeometry(0.09, 0.12, 5.6, 6);
  const lampGeo = new THREE.SphereGeometry(0.3, 8, 6);
  function addLamp(x, z) {
    const pole = new THREE.Mesh(poleGeo, poleMat);
    pole.position.set(x, 2.8, z);
    pole.castShadow = true;
    scene.add(pole);
    const lamp = new THREE.Mesh(lampGeo, lampMat);
    lamp.position.set(x, 5.7, z);
    scene.add(lamp);
  }
  for (const a of AVENUES) {
    for (let z = -160; z < 175; z += 44) {
      addLamp(a - 8.3, z);
      addLamp(a + 8.3, z + 22);
    }
  }

  // --- collisions and life ---------------------------------------------------
  function collideCircle(pos, radius) {
    let hit = false;
    for (const c of colliders) {
      const minX = c.minX - radius;
      const maxX = c.maxX + radius;
      const minZ = c.minZ - radius;
      const maxZ = c.maxZ + radius;
      if (pos.x > minX && pos.x < maxX && pos.z > minZ && pos.z < maxZ) {
        const pushL = pos.x - minX;
        const pushR = maxX - pos.x;
        const pushB = pos.z - minZ;
        const pushF = maxZ - pos.z;
        const m = Math.min(pushL, pushR, pushB, pushF);
        if (m === pushL) pos.x = minX;
        else if (m === pushR) pos.x = maxX;
        else if (m === pushB) pos.z = minZ;
        else pos.z = maxZ;
        hit = true;
      }
    }
    return hit;
  }

  let t = 0;
  function update(dt) {
    t += dt;
    sea.position.y = -0.15 + Math.sin(t * 0.7) * 0.13;
    foam.material.opacity = 0.35 + 0.25 * (0.5 + 0.5 * Math.sin(t * 0.7 + 1.2));
    foam.position.z = CITY.sandFrom + CITY.beachDepth + 1.5 + Math.sin(t * 0.7) * 1.6;
    const pulse = 0.6 + 0.4 * Math.sin(t * 3.2);
    beacon.scale.setScalar(0.8 + 0.45 * pulse);
    beaconLight.intensity = 30 + 55 * pulse;
  }

  return { colliders, collideCircle, update };
}
