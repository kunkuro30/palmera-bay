// missions.js — Marina Sol's three jobs, the repeatable dispatch fares and
// the eight golden cases hidden around the bay. One gold beacon marks the
// current objective; the banner always says what it is and what it pays.
// Story: a courier (you) owes Marina a favour. Job 1 is a simple delivery,
// job 2 takes back her stolen sports car, job 3 lifts the harbour payroll.

import { ECONOMY } from './config.js';
import { COAST_ROAD_Z } from './world.js';

export const KIOSK = { x: -55, z: COAST_ROAD_Z + 16 };
const DELIVERY = { x: 10, z: -14 };            // downtown, by the Sol Tower
const GARAGE = { x: 128, z: 66 };              // east-side lockup
const LOOT = { x: 150, z: COAST_ROAD_Z + 58 }; // the lifeguard warehouse, east beach

const CASE_SPOTS = [
  { x: -140, z: COAST_ROAD_Z + 48 }, { x: 150, z: COAST_ROAD_Z + 34 },
  { x: -20, z: -20 }, { x: -150, z: -150 }, { x: 150, z: -160 },
  { x: 60, z: 120 }, { x: -160, z: COAST_ROAD_Z }, { x: 30, z: 30 },
];

const boxGeo = new THREE.BoxGeometry(1, 1, 1);

export function createMissions(scene, save, hooks) {
  // Marina's kiosk: a striped stall on the sand.
  const kiosk = new THREE.Group();
  const stall = new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({ color: 0xf2e3c8 }));
  stall.scale.set(5, 2.6, 3); stall.position.y = 1.3; stall.castShadow = true;
  const awning = new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({ color: 0xe84a6f }));
  awning.scale.set(5.8, 0.24, 3.8); awning.position.y = 2.85; awning.rotation.x = 0.16;
  kiosk.add(stall); kiosk.add(awning);
  kiosk.position.set(KIOSK.x, 0, KIOSK.z);
  scene.add(kiosk);
  // the lifeguard warehouse at the east end of the beach
  const shed = new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({ color: 0x707a72 }));
  shed.scale.set(12, 5, 8); shed.position.set(LOOT.x, 2.5, LOOT.z + 6); shed.castShadow = true;
  scene.add(shed);

  // the objective beacon: a column of gold light you can see across town
  const beacon = new THREE.Mesh(
    new THREE.CylinderGeometry(1.7, 1.7, 34, 14, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffd94a, transparent: true, opacity: 0.33, side: THREE.DoubleSide, depthWrite: false }),
  );
  beacon.position.set(KIOSK.x, 17, KIOSK.z);
  scene.add(beacon);
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(2.1, 2.9, 24),
    new THREE.MeshBasicMaterial({ color: 0xffd94a, transparent: true, opacity: 0.8, side: THREE.DoubleSide }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(KIOSK.x, 0.06, KIOSK.z);
  scene.add(ring);

  // collectible cases
  const caseMat = new THREE.MeshBasicMaterial({ color: 0xffc21f });
  const cases = CASE_SPOTS.map((s, i) => {
    const m = new THREE.Mesh(boxGeo, caseMat);
    m.scale.set(0.85, 0.55, 0.85);
    m.position.set(s.x, 0.6, s.z);
    m.visible = !save.collectibles.includes(i);
    scene.add(m);
    return { mesh: m, id: i, taken: !m.visible };
  });

  const missions = {
    stage: 'offer',       // offer → active stages per mission → done
    missionIndex: save.nextMission,
    taxi: null,           // { phase: 'pickup'|'dropoff', at: {x,z}, pay }
    marker: { x: KIOSK.x, z: KIOSK.z, color: '#ffd94a' },
  };

  const NAMES = ['JOB 1 — FIRST RUN', 'JOB 2 — HOT GOODS', 'JOB 3 — HARBOUR HEIST'];
  function bannerFor() {
    const i = missions.missionIndex;
    if (missions.stage === 'offer') {
      if (i >= 3) return 'All jobs done. <b>Dispatch fares</b> and <b>golden cases</b> still pay.';
      return `<b>${NAMES[i]}</b> — see <b>Marina</b> at the beach kiosk. Pays <b>$${ECONOMY.missionPay[i]}</b>.`;
    }
    if (i === 0) return missions.stage === 'pickup'
      ? '<b>JOB 1</b> — Marina hands you the package. Stand in the light.'
      : '<b>JOB 1</b> — take the package to the <b>Sol Tower drop</b>, downtown.';
    if (i === 1) return missions.stage === 'steal'
      ? '<b>JOB 2</b> — take back Marina\'s <b>red sports car</b> (gold marker). The theft will be seen.'
      : '<b>JOB 2</b> — deliver the car to the <b>east lockup</b>. Lose the cops or outrun them.';
    if (i === 2) return missions.stage === 'grab'
      ? '<b>JOB 3</b> — lift the payroll from the <b>lifeguard warehouse</b>, east beach.'
      : '<b>JOB 3</b> — get the money to <b>Marina\'s kiosk</b>. Half the bay will chase you.';
    return '';
  }

  function setMarker(x, z) {
    missions.marker = { x, z, color: '#ffd94a' };
    beacon.position.set(x, 17, z);
    ring.position.set(x, 0.06, z);
  }

  function completeMission() {
    const i = missions.missionIndex;
    hooks.addMoney(ECONOMY.missionPay[i]);
    hooks.audio.mission();
    hooks.toast(`${NAMES[i]} complete — $${ECONOMY.missionPay[i]}`);
    missions.missionIndex += 1;
    save.nextMission = missions.missionIndex;
    missions.stage = 'offer';
    setMarker(KIOSK.x, KIOSK.z);
    hooks.persist();
  }

  let pulse = 0;
  missions.update = (dt, ctx) => {
    pulse += dt * 3;
    beacon.material.opacity = 0.26 + 0.12 * Math.sin(pulse);
    ring.scale.setScalar(1 + 0.1 * Math.sin(pulse));
    for (const c of cases) if (!c.taken) c.mesh.rotation.y += dt * 1.8;
    hooks.banner(bannerFor());

    const p = ctx.playerPos;
    const distTo = (t) => Math.hypot(p.x - t.x, p.z - t.z);
    const reach = ctx.inCar ? 6.5 : 3.4;
    const i = missions.missionIndex;

    if (missions.stage === 'offer' && i < 3 && distTo(KIOSK) < reach) {
      missions.stage = i === 0 ? 'pickup' : i === 1 ? 'steal' : 'grab';
      if (i === 1) setMarker(ctx.sportsCar.pos.x, ctx.sportsCar.pos.z);
      else if (i === 2) setMarker(LOOT.x, LOOT.z);
      hooks.audio.pickup();
      hooks.toast(NAMES[i] + ' — let\'s go');
    } else if (i === 0 && missions.stage === 'pickup' && distTo(KIOSK) < reach) {
      missions.stage = 'deliver'; setMarker(DELIVERY.x, DELIVERY.z);
      hooks.audio.pickup(); hooks.toast('Package on board');
    } else if (i === 0 && missions.stage === 'deliver' && distTo(DELIVERY) < reach) {
      completeMission();
      hooks.addHeat(0.2); // a camera caught the drop
    } else if (i === 1 && missions.stage === 'steal') {
      setMarker(ctx.sportsCar.pos.x, ctx.sportsCar.pos.z); // the car can be moved
      if (ctx.inSportsCar) {
        missions.stage = 'deliver'; setMarker(GARAGE.x, GARAGE.z);
        hooks.setHeat(Math.max(hooks.getHeat(), 0.36));
        hooks.toast('That\'s the car — now run!');
      }
    } else if (i === 1 && missions.stage === 'deliver' && ctx.inSportsCar && distTo(GARAGE) < 7) {
      completeMission();
    } else if (i === 2 && missions.stage === 'grab' && distTo(LOOT) < reach) {
      missions.stage = 'escape'; setMarker(KIOSK.x, KIOSK.z);
      hooks.setHeat(Math.max(hooks.getHeat(), 0.8));
      hooks.audio.pickup(); hooks.toast('Payroll lifted — RUN');
    } else if (i === 2 && missions.stage === 'escape' && distTo(KIOSK) < reach) {
      completeMission();
    }

    // golden cases
    for (const c of cases) {
      if (c.taken) continue;
      if (Math.hypot(p.x - c.mesh.position.x, p.z - c.mesh.position.z) < 2.4) {
        c.taken = true; c.mesh.visible = false;
        save.collectibles.push(c.id);
        hooks.addMoney(ECONOMY.collectiblePay);
        hooks.audio.cash();
        hooks.toast(`Golden case — $${ECONOMY.collectiblePay} (${save.collectibles.length}/8)`);
        hooks.persist();
      }
    }
    return missions;
  };

  missions.offerTaxi = (rng) => {
    if (missions.taxi) return;
    const spots = [DELIVERY, GARAGE, { x: -120, z: -90 }, { x: 90, z: -140 }, { x: -30, z: 90 }, { x: 140, z: 150 }];
    const dest = spots[Math.floor(rng() * spots.length)];
    missions.taxi = { dest, pay: 0 };
    hooks.toast('Dispatch: a fare across town — follow the blue marker');
  };
  missions.markerFor = () => missions.taxi
    ? { x: missions.taxi.dest.x, z: missions.taxi.dest.z, color: '#54c8ff' }
    : missions.marker;
  missions.updateTaxi = (ctx) => {
    if (!missions.taxi) return;
    const p = ctx.playerPos;
    if (Math.hypot(p.x - missions.taxi.dest.x, p.z - missions.taxi.dest.z) < 7) {
      const pay = 60 + Math.floor(ctx.tripMeters * ECONOMY.taxiPayPerMeter);
      hooks.addMoney(pay);
      hooks.audio.cash();
      hooks.toast(`Fare paid — $${pay}`);
      save.taxiFares += 1;
      missions.taxi = null;
      hooks.persist();
    }
  };
  return missions;
}
