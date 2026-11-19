// Three chained jobs that teach the whole map:
//  1. BEACH RUN — reach the end of the pier (the city on foot).
//  2. HOT GOODS — steal the marked sports car downtown, deliver it to the
//     east lockup (driving, and the police notice).
//  3. BAY HEIST — lift the case at the fish shop, drop it at the park
//     hideout while the heat is on.
// A glowing beacon marks the current objective; the HUD banner narrates it.
// Completing a job pays cash and saves progress.

import { WORLD, groundHeight } from './config.js';
import { makeCar } from './vehicles.js';
import { makeFigure } from './characters.js';

const THREE = window.THREE;

function lam(color, opts = {}) {
  return new THREE.MeshLambertMaterial(Object.assign({ color, flatShading: true }, opts));
}

export function createMissions(scene, G) {
  let beacon = null;
  let beaconLetter = null;
  let stage = 0;            // 0..2 active job index, 3 = all done
  let phase = 'go';         // per-job phase
  let override = null;      // screenshot scenes replace the objective
  let caseMesh = null;
  let jobCar = null;

  function makeBeacon() {
    const g = new THREE.Group();
    const cyl = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 26, 14, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xffd23e, transparent: true, opacity: 0.3, side: THREE.DoubleSide, depthWrite: false }));
    cyl.position.y = 13;
    g.add(cyl);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(2.4, 0.22, 8, 22), lam(0xffd23e, { emissive: 0x554400 }));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.3;
    g.add(ring);
    g.visible = false;
    scene.add(g);
    return g;
  }
  beacon = makeBeacon();

  function showMarker(x, z) {
    if (x === null || x === undefined) { beacon.visible = false; return; }
    beacon.visible = true;
    beacon.position.set(x, groundHeight(x, z), z);
    beacon.userData.baseY = groundHeight(x, z);
  }

  function currentObjective() {
    if (override) return override;
    if (stage === 0) return { x: WORLD.pier.x, z: WORLD.pier.z1 - 4, letter: 'A', label: 'JOB 1 — BEACH RUN · Reach the end of the pier' };
    if (stage === 1) {
      if (phase === 'steal') return { x: WORLD.missionCar.x, z: WORLD.missionCar.z, letter: 'B', label: 'JOB 2 — HOT GOODS · Steal the marked sports car' };
      return { x: WORLD.lockup.x, z: WORLD.lockup.z, letter: 'B', label: 'JOB 2 — HOT GOODS · Deliver the car to the east lockup' };
    }
    if (stage === 2) {
      if (phase === 'grab') return { x: -108, z: WORLD.shopsZ + 7, letter: 'C', label: 'JOB 3 — BAY HEIST · Lift the case at FRESH FISH' };
      return { x: WORLD.hideout.x, z: WORLD.hideout.z, letter: 'C', label: 'JOB 3 — BAY HEIST · Drop the case at the park hideout' };
    }
    return { x: null, z: null, letter: '', label: 'All jobs done — Palmera Bay is yours. Cause some sunshine.' };
  }

  function spawnJobCar() {
    jobCar = makeCar(0xd42427, { cls: 'sport', kind: 'mission' });
    jobCar.group.position.set(WORLD.missionCar.x, groundHeight(WORLD.missionCar.x, WORLD.missionCar.z), WORLD.missionCar.z);
    jobCar.heading = Math.PI;
    jobCar.group.rotation.y = Math.PI;
    scene.add(jobCar.group);
    G.cars.push(jobCar);
    return jobCar;
  }

  function spawnCase() {
    caseMesh = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.36, 0.44), lam(0xd8a920, { emissive: 0x4a3600 }));
    caseMesh.position.set(-108, groundHeight(-108, WORLD.shopsZ + 7) + 0.75, WORLD.shopsZ + 7);
    caseMesh.castShadow = true;
    scene.add(caseMesh);
    // Two gangsters mind the case: black jackets, gold chains, shades.
    // They live in the crowd's figure list, so fists and bullets find them.
    for (const [gx, gz, gry, armed] of [[-104.6, WORLD.shopsZ + 9.6, Math.PI * 0.9, true], [-111.4, WORLD.shopsZ + 4.6, Math.PI * 1.1, false]]) {
      const fig = makeFigure({
        skin: 0x9c6644, shirt: 0x17181c, pants: 0x1c1e24, shoes: 0x111111,
        chain: true, shades: true, weapon: armed, hat: 'hair', hatColor: 0x14100c,
      });
      fig.group.position.set(gx, groundHeight(gx, gz), gz);
      fig.baseY = groundHeight(gx, gz);
      fig.group.rotation.y = gry;
      scene.add(fig.group);
      fig.still = true;
      G.crowd.figures.push(fig);
    }
    return caseMesh;
  }

  function completeJob(reward, message) {
    G.save.cash += reward;
    G.save.jobsDone = Math.max(G.save.jobsDone, stage + 1);
    G.persist();
    G.hud.toast(message);
    G.audio.jingle();
    stage += 1;
    phase = 'go';
    if (stage === 1) phase = 'steal';
    if (stage === 2) { phase = 'grab'; spawnCase(); }
  }

  // Called by player.js when the player gets into a car.
  function onEnterCar(car) {
    if (stage === 1 && phase === 'steal' && car === jobCar) {
      phase = 'deliver';
      G.police.addHeat(130);
      G.hud.toast('HOT GOODS — the police noticed!');
    }
  }

  function update(dt, time) {
    const obj = currentObjective();
    if (!override) showMarker(obj.x, obj.z);
    if (beacon.visible) {
      beacon.rotation.y = time * 0.8;
      beacon.position.y = (beacon.userData.baseY || 0) + Math.sin(time * 2) * 0.3;
    }
    if (caseMesh && !(stage === 2 && phase === 'grab')) { /* case stays until grabbed */ }
    if (override) return obj;

    const p = G.playerPos();
    const near = (x, z, r) => Math.hypot(p.x - x, p.z - z) < r;

    if (stage === 0 && near(WORLD.pier.x, WORLD.pier.z1 - 4, 5)) {
      completeJob(150, 'JOB 1 DONE · +$150');
    } else if (stage === 1 && phase === 'deliver' && G.player.car === jobCar && near(WORLD.lockup.x, WORLD.lockup.z, 7)) {
      G.player.exitCar(true);
      scene.remove(jobCar.group);
      G.cars.splice(G.cars.indexOf(jobCar), 1);
      jobCar = null;
      completeJob(400, 'JOB 2 DONE · +$400');
    } else if (stage === 2 && phase === 'grab' && near(-108, WORLD.shopsZ + 7, 3.4)) {
      if (caseMesh) { scene.remove(caseMesh); caseMesh = null; }
      phase = 'drop';
      G.police.addHeat(190);
      G.hud.toast('CASE LIFTED — get to the park!');
    } else if (stage === 2 && phase === 'drop' && near(WORLD.hideout.x, WORLD.hideout.z, 6)) {
      completeJob(800, 'JOB 3 DONE · +$800 — BAY LEGEND');
    }
    return currentObjective();
  }

  return {
    update, onEnterCar, spawnJobCar, showMarker,
    setObjectiveOverride(o) { override = o; if (o) showMarker(o.x, o.z); },
    get stage() { return stage; },
    get objective() { return currentObjective(); },
  };
}
