// missions.js — Marina Sol's work: three story jobs, eight golden cases
// hidden around the bay, and the taxi dispatch that never sleeps. All state
// lives in the save object; this module owns the props, the beacon and the
// stage machine, and pays out through the hooks main.js gives it.

import { ECONOMY } from './config.js';
import { range, pick } from './random.js';

export const KIOSK = { x: -55, z: 208 };
export const GARAGE = { x: 128, z: 66 };
export const WAREHOUSE = { x: 150, z: 250 };
const DROP = { x: 10, z: -14 };

const CASE_SPOTS = [
  { x: -97, z: 12 }, { x: 24, z: -97 }, { x: 83, z: 143 }, { x: -157, z: -64 },
  { x: 143, z: -157 }, { x: -24, z: 83 }, { x: 66, z: -24 }, { x: -83, z: 238 },
];

function awningTexture() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 32;
  const g = c.getContext('2d');
  for (let i = 0; i < 8; i++) {
    g.fillStyle = i % 2 ? '#f3ead8' : '#e2543e';
    g.fillRect(i * 16, 0, 16, 32);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createMissions(scene, rng, world, save, hooks) {
  // --- props ---------------------------------------------------------------
  const kiosk = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: 0x8a6844, roughness: 0.9 });
  const counter = new THREE.Mesh(new THREE.BoxGeometry(3.6, 1.1, 1.7), wood);
  counter.position.y = 0.55;
  counter.castShadow = true;
  kiosk.add(counter);
  for (const [px, pz] of [[-1.9, -1.1], [1.9, -1.1], [-1.9, 1.1], [1.9, 1.1]]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 2.6, 6), wood);
    post.position.set(px, 1.3, pz);
    kiosk.add(post);
  }
  const awning = new THREE.Mesh(
    new THREE.BoxGeometry(4.4, 0.12, 2.9),
    new THREE.MeshStandardMaterial({ map: awningTexture(), roughness: 0.85 }),
  );
  awning.position.y = 2.65;
  awning.castShadow = true;
  kiosk.add(awning);
  kiosk.position.set(KIOSK.x, 0, KIOSK.z);
  scene.add(kiosk);
  world.colliders.push({ minX: KIOSK.x - 2.2, maxX: KIOSK.x + 2.2, minZ: KIOSK.z - 1.5, maxZ: KIOSK.z + 1.5 });

  const warehouse = new THREE.Mesh(
    new THREE.BoxGeometry(18, 7.5, 11),
    new THREE.MeshStandardMaterial({ color: 0x7a6a58, roughness: 0.95 }),
  );
  warehouse.position.set(WAREHOUSE.x, 3.75, WAREHOUSE.z);
  warehouse.castShadow = true;
  warehouse.receiveShadow = true;
  scene.add(warehouse);
  const door = new THREE.Mesh(
    new THREE.BoxGeometry(5, 4.4, 0.2),
    new THREE.MeshStandardMaterial({ color: 0x3c4652, roughness: 0.7, metalness: 0.4 }),
  );
  door.position.set(WAREHOUSE.x - 3, 2.2, WAREHOUSE.z - 5.6);
  scene.add(door);
  world.colliders.push({
    minX: WAREHOUSE.x - 9, maxX: WAREHOUSE.x + 9, minZ: WAREHOUSE.z - 5.5, maxZ: WAREHOUSE.z + 5.5,
  });

  const pad = new THREE.Mesh(
    new THREE.PlaneGeometry(11, 9),
    new THREE.MeshStandardMaterial({ color: 0x3a3f4a, roughness: 0.9 }),
  );
  pad.rotation.x = -Math.PI / 2;
  pad.position.set(GARAGE.x, 0.035, GARAGE.z);
  pad.receiveShadow = true;
  scene.add(pad);

  // --- the beacon ------------------------------------------------------------
  const beaconMat = new THREE.MeshBasicMaterial({
    color: 0xffd94a, transparent: true, opacity: 0.32, depthWrite: false, side: THREE.DoubleSide,
  });
  const beacon = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 55, 12, 1, true), beaconMat);
  beacon.position.y = 27.5;
  scene.add(beacon);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xffd94a, transparent: true, opacity: 0.85, side: THREE.DoubleSide });
  const ring = new THREE.Mesh(new THREE.RingGeometry(1.7, 2.4, 28), ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.07;
  scene.add(ring);

  let beaconTarget = null;
  function setBeacon(x, z, color) {
    beaconTarget = { x, z };
    beacon.position.x = x;
    beacon.position.z = z;
    ring.position.x = x;
    ring.position.z = z;
    beaconMat.color.setHex(color);
    ringMat.color.setHex(color);
    beacon.visible = true;
    ring.visible = true;
  }
  function hideBeacon() {
    beaconTarget = null;
    beacon.visible = false;
    ring.visible = false;
  }
  hideBeacon();

  // --- golden cases ------------------------------------------------------------
  const caseMat = new THREE.MeshStandardMaterial({
    color: 0xffc93c, metalness: 0.7, roughness: 0.3, emissive: 0x6a4a00,
  });
  const cases = CASE_SPOTS.map((spot, i) => {
    if (save.collectibles.includes(i)) return null;
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.38, 0.55), caseMat);
    mesh.position.set(spot.x, 0.7, spot.z);
    mesh.castShadow = true;
    scene.add(mesh);
    return { mesh, i, ...spot };
  });

  // --- the stage machine ---------------------------------------------------------
  let stage = null; // pickup | deliver | steal | grab | escape
  let taxi = { phase: 'idle', wait: 5, x: 0, z: 0, destX: 0, destZ: 0, dist: 0 };
  let t = 0;

  function bannerForStage() {
    const n = save.nextMission;
    if (n === 0 && stage === 'pickup') hooks.banner('<b>JOB 1 — FIRST RUN</b> — pick up the package at <b>Marina\'s kiosk</b> on the beach.');
    else if (n === 0 && stage === 'deliver') hooks.banner('<b>JOB 1 — FIRST RUN</b> — take the package to the <b>Sol Tower drop</b>, downtown.');
    else if (n === 1 && stage === 'steal') hooks.banner('<b>JOB 2 — HOT GOODS</b> — steal the <b>red sports car</b> parked by the avenue and deliver it to the <b>east lockup</b>.');
    else if (n === 1 && stage === 'deliver') hooks.banner('<b>JOB 2 — HOT GOODS</b> — deliver the car to the <b>east lockup</b>. Lose them or outrun them.');
    else if (n === 2 && stage === 'grab') hooks.banner('<b>JOB 3 — HARBOUR HEIST</b> — grab the payroll at the <b>lifeguard warehouse</b>, east beach.');
    else if (n === 2 && stage === 'escape') hooks.banner('<b>JOB 3 — HARBOUR HEIST</b> — get the money to <b>Marina\'s kiosk</b>. Half the bay will chase you.');
  }

  function startStory() {
    const n = save.nextMission;
    if (n === 0) { stage = 'pickup'; setBeacon(KIOSK.x, KIOSK.z, 0xffd94a); }
    else if (n === 1) { stage = 'steal'; hideBeacon(); }
    else if (n === 2) { stage = 'grab'; setBeacon(WAREHOUSE.x - 12, WAREHOUSE.z - 8, 0xffd94a); }
    else { stage = null; hideBeacon(); }
    if (stage) bannerForStage();
  }

  function completeStory() {
    const pay = ECONOMY.missionPay[save.nextMission];
    save.nextMission++;
    hooks.addMoney(pay);
    hooks.audio.cash();
    hooks.audio.sting();
    hooks.heal();
    hooks.toast('JOB DONE  +$' + pay);
    hooks.persist();
    startStory();
    if (save.nextMission >= 3) hooks.banner('<b>ALL JOBS DONE</b> — Marina has nothing left. The dispatch and the golden cases are yours.');
  }

  function taxiSpot() {
    const avenues = [-127, -67, -7, 53, 113, 173];
    const a = pick(rng, avenues);
    return { x: a + (rng() < 0.5 ? -8.6 : 8.6), z: range(rng, -160, 165) };
  }

  function update(dt, ctx) {
    t += dt;
    if (ctx.sportsPos) lastSportsPos = ctx.sportsPos;
    if (beaconTarget) {
      const s = 1 + 0.16 * Math.sin(t * 4);
      ring.scale.setScalar(s);
      beaconMat.opacity = 0.26 + 0.12 * Math.sin(t * 4);
    }
    for (const c of cases) {
      if (!c) continue;
      c.mesh.rotation.y += dt * 1.6;
      c.mesh.position.y = 0.7 + Math.sin(t * 2.4 + c.i) * 0.12;
      if (Math.hypot(ctx.x - c.x, ctx.z - c.z) < 1.9) {
        save.collectibles.push(c.i);
        hooks.addMoney(ECONOMY.collectible);
        hooks.audio.pickup();
        hooks.toast('GOLDEN CASE  +$' + ECONOMY.collectible + '  (' + save.collectibles.length + '/8)');
        hooks.persist();
        scene.remove(c.mesh);
        cases[c.i] = null;
      }
    }

    const dKiosk = Math.hypot(ctx.x - KIOSK.x, ctx.z - KIOSK.z);
    if (stage === 'pickup' && !ctx.inCar && dKiosk < 3.4) {
      stage = 'deliver';
      setBeacon(DROP.x, DROP.z, 0xffd94a);
      hooks.audio.pickup();
      bannerForStage();
    } else if (stage === 'deliver' && save.nextMission === 0) {
      if (Math.hypot(ctx.x - DROP.x, ctx.z - DROP.z) < 4.5) completeStory();
    } else if (stage === 'steal') {
      if (ctx.inSports) {
        hooks.setHeat(0.36);
        stage = 'deliver';
        setBeacon(GARAGE.x, GARAGE.z, 0xffd94a);
        bannerForStage();
      }
    } else if (stage === 'deliver' && save.nextMission === 1) {
      if (ctx.inSports && Math.hypot(ctx.x - GARAGE.x, ctx.z - GARAGE.z) < 6.5) completeStory();
    } else if (stage === 'grab') {
      if (!ctx.inCar && Math.hypot(ctx.x - (WAREHOUSE.x - 12), ctx.z - (WAREHOUSE.z - 8)) < 4) {
        hooks.setHeat(0.8);
        stage = 'escape';
        setBeacon(KIOSK.x, KIOSK.z, 0xffd94a);
        hooks.audio.pickup();
        bannerForStage();
      }
    } else if (stage === 'escape') {
      if (!ctx.inCar && dKiosk < 3.6) completeStory();
    }

    // taxi dispatch
    if (taxi.phase === 'idle') {
      taxi.wait -= dt;
      if (taxi.wait <= 0) {
        const s = taxiSpot();
        taxi = { ...taxi, phase: 'pickup', x: s.x, z: s.z };
        hooks.banner('<b>DISPATCH</b> — fare waiting across town. Pick them up in any car.');
      }
    } else if (taxi.phase === 'pickup') {
      if (ctx.inCar && Math.hypot(ctx.x - taxi.x, ctx.z - taxi.z) < 5.5) {
        const d = taxiSpot();
        taxi = { ...taxi, phase: 'dropoff', destX: d.x, destZ: d.z, dist: Math.hypot(d.x - taxi.x, d.z - taxi.z) };
        hooks.toast('Passenger in — drive!');
      }
    } else if (taxi.phase === 'dropoff') {
      if (ctx.inCar && Math.hypot(ctx.x - taxi.destX, ctx.z - taxi.destZ) < 5.5) {
        const pay = Math.max(15, Math.round(taxi.dist * ECONOMY.taxiPerMeter));
        save.taxiFares++;
        hooks.addMoney(pay);
        hooks.audio.cash();
        hooks.heal();
        hooks.toast('FARE PAID  +$' + pay);
        hooks.persist();
        taxi = { phase: 'idle', wait: range(rng, 7, 15), x: 0, z: 0, destX: 0, destZ: 0, dist: 0 };
      }
    }
  }

  let lastSportsPos = null;

  function markerFor() {
    if (stage === 'steal' && lastSportsPos) return { x: lastSportsPos.x, z: lastSportsPos.z, color: '#ffd94a' };
    if (beaconTarget && stage) return { x: beaconTarget.x, z: beaconTarget.z, color: '#ffd94a' };
    if (taxi.phase === 'pickup') return { x: taxi.x, z: taxi.z, color: '#54c8ff' };
    if (taxi.phase === 'dropoff') return { x: taxi.destX, z: taxi.destZ, color: '#54c8ff' };
    if (beaconTarget) return { x: beaconTarget.x, z: beaconTarget.z, color: '#ffd94a' };
    return null;
  }

  function promptFor(ctx) {
    if (stage === 'pickup' && !ctx.inCar && Math.hypot(ctx.x - KIOSK.x, ctx.z - KIOSK.z) < 7) return 'Marina hands you the package…';
    if (stage === 'steal' && ctx.nearSports) return 'Press F — steal the sports car';
    if (stage === 'grab' && !ctx.inCar) return 'Grab the payroll — then run';
    if (taxi.phase === 'pickup' && !ctx.inCar && Math.hypot(ctx.x - taxi.x, ctx.z - taxi.z) < 9) return 'Your fare is waiting — you need a car';
    return null;
  }

  startStory();

  return { update, markerFor, promptFor, KIOSK, GARAGE, WAREHOUSE };
}
