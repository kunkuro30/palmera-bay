// GO RIO RIO · missions.js — the eight story jobs, expressed as staged data.
// Eight story jobs in three chapters (build 12) — Rio's fight to keep
// his family's beach kiosk row out of SunCoast Leisure's buyout. The
// first three jobs are the original chain (pier run, hot car, heist
// case); the engine below generalises them into data: every job is a
// list of stages — go / steal / deliver / grab / drop — with a named
// giver whose portrait dialogue opens and closes the job, escalating
// payouts ($150 → $7,500), stage pips and a NEXT line on the HUD card.
// A glowing beacon marks the current objective.

import { WORLD, groundHeight } from './config.js';
import { makeCar } from './vehicles.js';
import { makeFigure } from './characters.js';
import { earnRespect } from './save.js';

const THREE = window.THREE;

function lam(color, opts = {}) {
  return new THREE.MeshLambertMaterial(Object.assign({ color, flatShading: true }, opts));
}

export const CHAPTERS = [
  'Chapter 1 — The Kiosk Row',
  'Chapter 2 — Paper & Concrete',
  'Chapter 3 — Take Back the Bay',
];

export const JOBS = [
  {
    name: 'BEACH RUN', chapter: 0, giver: 'marco', payout: 150,
    brief: 'SunCoast Leisure bought the pier end for a private marina. Run it while it is still ours.',
    car: null, caseAt: null,
    stages: [
      { kind: 'go', x: WORLD.pier.x, z: WORLD.pier.z1 - 4, r: 5, label: 'Reach the end of the pier' },
    ],
    startTalk: [
      ['marco', "Rio! SunCoast Leisure just bought the pier end — private marina, fence, the lot. Run it one more time while it's still ours."],
      ['rio', 'And the kiosk row?'],
      ['marco', "That's tomorrow's fight. Today we run. End of the pier — go!"],
    ],
    doneTalk: [['marco', 'Still ours for one more sunset. Now we work.']],
  },
  {
    name: 'HOT GOODS', chapter: 0, giver: 'marco', payout: 400,
    brief: "The Palmera Comet is in the shop. Borrow the red sports car off Palm Ave and park it in the east lockup.",
    car: { cls: 'sport', color: 0xd42427, x: WORLD.missionCar.x, z: WORLD.missionCar.z, heading: Math.PI },
    caseAt: null,
    stages: [
      { kind: 'steal', label: 'Steal the red sports car off Palm Ave', toast: 'HOT GOODS — the police noticed!', heat: 130 },
      { kind: 'deliver', x: WORLD.lockup.x, z: WORLD.lockup.z, r: 7, label: 'Deliver the car to the east lockup' },
    ],
    startTalk: [
      ['marco', "Your Palmera Comet wouldn't survive this run, so we're borrowing the red sports car off Palm Ave. SunCoast's money man left it unlocked."],
    ],
    doneTalk: [['marco', "Clean. The lockup crew owes us now — and SunCoast's man is short one sports car."]],
  },
  {
    name: 'BAY HEIST', chapter: 0, giver: 'marco', payout: 800,
    brief: "SunCoast muscle is holding the row's takings at SUSHI BAY. Lift the case, drop it at the park hideout.",
    car: null,
    caseAt: { x: -108, z: WORLD.shopsZ + 7, guards: true },
    stages: [
      { kind: 'grab', x: -108, z: WORLD.shopsZ + 7, r: 3.4, label: 'Lift the case at SUSHI BAY', toast: 'CASE LIFTED — get to the park!', heat: 190 },
      { kind: 'drop', x: WORLD.hideout.x, z: WORLD.hideout.z, r: 6, label: 'Drop the case at the park hideout' },
    ],
    startTalk: [
      ['marco', "SunCoast's muscle lifted the row's takings — they're holding the case at SUSHI BAY. Two of them. Take it back, drop it at the park hideout."],
    ],
    doneTalk: [['marco', "The row eats this month. But SunCoast isn't done — they fight with paper next. Permits. Concrete."]],
  },
  {
    name: 'CLINIC RUN', chapter: 1, giver: 'ana', payout: 1200,
    brief: "The clinic's medicine case has to reach a patient up in Palmera Heights before her next dose.",
    car: null,
    caseAt: { x: -124, z: 188, guards: false },
    stages: [
      { kind: 'grab', x: -124, z: 188, r: 3.4, label: 'Pick up the medicine case at Bay Clinic', toast: 'MEDICINE CASE — get it to the Heights!' },
      { kind: 'drop', x: 182, z: 45, r: 6, label: 'Deliver it to the house in Palmera Heights' },
    ],
    startTalk: [
      ['ana', "Rio? Ana, Bay Clinic. I have a medicine case that has to reach Mrs. Herrera in Palmera Heights — the SunCoast roadworks cut our ambulance route. Please."],
    ],
    doneTalk: [['ana', 'You made it. She gets her dose tonight because of you. Anything the clinic can do — ask.']],
  },
  {
    name: 'PAPER TRAIL', chapter: 1, giver: 'reyes', payout: 1800,
    brief: "Officer Reyes wants the SunCoast permit file walked from the PD front desk to Palmera Motors and back — every step on the record.",
    car: null, caseAt: null,
    stages: [
      { kind: 'go', x: 120, z: 87, r: 6, label: 'Front desk — Palmera PD' },
      { kind: 'go', x: 120, z: 152, r: 6, label: 'Palmera Motors — the permit office' },
      { kind: 'go', x: 120, z: 87, r: 6, label: 'Back to Reyes — Palmera PD' },
    ],
    startTalk: [
      ['reyes', "Rio. Off the record: SunCoast's permit file is dirty, but it has to move through the system clean. Front desk here, then Palmera Motors, then back to me."],
    ],
    doneTalk: [['reyes', "Filed, stamped, and very hard to bury now. You didn't hear it from me."]],
  },
  {
    name: 'CONCRETE PROOF', chapter: 1, giver: 'lita', payout: 2600,
    brief: 'Tia Lita heard SunCoast is landing unpermitted concrete at the airport. Get eyes on the crates, then report back to her kiosk.',
    car: null, caseAt: null,
    stages: [
      { kind: 'go', x: -186, z: 150, r: 9, label: 'Bay Airport apron — the SunCoast crates' },
      { kind: 'go', x: 113, z: 190, r: 5, label: "Tia Lita's kiosk — report back" },
    ],
    startTalk: [
      ['lita', 'Mijo, they land concrete at the airport at noon — no permit, my cousin on the apron crew swears it. Go see the crates with your own eyes, then come tell me.'],
    ],
    doneTalk: [['lita', "Seen with your own eyes — that's enough. Reyes gets an anonymous tip tonight."]],
  },
  {
    name: 'SURVEY SINS', chapter: 2, giver: 'duarte', payout: 4200,
    brief: 'A SunCoast survey drone went down at the lake dock. Sgt. Duarte wants its case — before SunCoast does.',
    car: null,
    caseAt: { x: 50, z: -114, guards: false },
    stages: [
      { kind: 'grab', x: 50, z: -114, r: 3.4, label: 'Recover the survey case at the lake dock', toast: 'SURVEY CASE — the garrison gate, fast!', heat: 40 },
      { kind: 'drop', x: 104, z: -30, r: 6, label: 'Deliver it to the garrison gate' },
    ],
    startTalk: [
      ['duarte', 'Civilian. A SunCoast survey drone ditched at the lake dock — its case maps every buyout on the bay, including your row. Bring it to my gate. Discretion.'],
    ],
    doneTalk: [['duarte', 'This map is evidence now. Whatever SunCoast planned for your row — it stops at my fence.']],
  },
  {
    name: 'BAY DAY', chapter: 2, giver: 'marco', payout: 7500,
    brief: "Finale: take SunCoast's own van from downtown and park it across the promenade on Bay Day — the whole row turns out.",
    car: { cls: 'van', color: 0xf2f2f2, x: 104, z: 74, heading: Math.PI / 2 },
    caseAt: null,
    stages: [
      { kind: 'steal', label: "Take SunCoast's van downtown", toast: 'BAY DAY — the whole row is watching!', heat: 150 },
      { kind: 'deliver', x: 30, z: 190, r: 7, label: 'Park it across the promenade — Bay Day' },
    ],
    startTalk: [
      ['marco', "Bay Day, Rio. Last play: SunCoast's van, parked downtown with the keys in. Take it, park it across the promenade, and the whole row turns out behind it."],
      ['rio', 'We keep the bay.'],
    ],
    doneTalk: [['marco', "Look at them, Rio. Every kiosk, every keeper, standing behind that van. SunCoast can buy paper — they can't buy this. The bay stays ours."]],
  },
];

const LETTERS = 'ABCDEFGH';

export function createMissions(scene, G) {
  let beacon = null;
  // DEFECT FIX (B-1): restore story progression from the save — a
  // reload resumes at the first unfinished job instead of restarting
  // at Job 1 (which also let finished jobs be re-farmed for payouts).
  // jobsDone is clamped 0..8 on load (save.js); clamp again here so
  // jobIdx can never point past the finale. activateJob() below then
  // runs for the restored job, re-spawning its grab-case; the job cars
  // already exist from boot (spawnJobCar). At 8 the story is complete
  // and currentObjective() reports free roam — no job becomes current
  // again.
  let jobIdx = Math.max(0, Math.min(JOBS.length, Math.floor((G.save && G.save.jobsDone) || 0)));   // 0..7 active job, 8 = all done
  let stageIdx = 0;
  let override = null;      // screenshot scenes replace the objective
  let caseMesh = null;
  let announced = -1;       // last job whose opening dialogue was shown
  const jobCars = new Map();   // jobIdx -> car (spawned at boot)

  function makeBeacon() {
    const g = new THREE.Group();
    // DEFECT FIX (N-5): a slim, additive beam (r 0.85) instead of the
    // opaque 2.2 m monolith slab; update() fades it with distance.
    const cyl = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.85, 26, 14, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xffd23e, transparent: true, opacity: 0.2, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
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

  function job() { return JOBS[jobIdx] || null; }
  function stage() { const j = job(); return j ? j.stages[stageIdx] : null; }

  function stagePoint(st) {
    if (!st) return { x: null, z: null };
    if (st.kind === 'steal') {
      const car = jobCars.get(jobIdx);
      if (car) return { x: car.group.position.x, z: car.group.position.z };
      const c = job().car;
      return { x: c.x, z: c.z };
    }
    return { x: st.x, z: st.z };
  }

  function currentObjective() {
    if (override) return override;
    const j = job();
    if (!j) {
      return {
        x: null, z: null, letter: '', label: 'All jobs done — Palmera Bay is yours. Cause some sunshine.',
        chapterName: 'Palmera Bay', jobName: 'THE BAY IS YOURS', stageLabel: 'Free roam — the kiosk row stands.',
        stageIdx: 0, stageCount: 0, nextLabel: '',
      };
    }
    const st = stage();
    const pt = stagePoint(st);
    const next = j.stages[stageIdx + 1];
    return {
      x: pt.x, z: pt.z, letter: LETTERS[jobIdx],
      label: `JOB ${jobIdx + 1} — ${j.name} · ${st.label}`,
      chapterName: CHAPTERS[j.chapter], jobName: j.name, stageLabel: st.label,
      stageIdx, stageCount: j.stages.length,
      nextLabel: next ? next.label : 'Final stage',
    };
  }

  // The job cars exist from boot (they read as parked cars until their
  // job comes up). main.js calls this once.
  function spawnJobCar() {
    JOBS.forEach((j, i) => {
      if (!j.car || jobCars.has(i)) return;
      const car = makeCar(j.car.color, { cls: j.car.cls, kind: 'mission' });
      car.isJobCar = true;   // DEFECT FIX (B-2): story cars are indestructible — wrecks.js skips their damage
      car.group.position.set(j.car.x, groundHeight(j.car.x, j.car.z), j.car.z);
      car.heading = j.car.heading;
      car.group.rotation.y = j.car.heading;
      scene.add(car.group);
      G.cars.push(car);
      jobCars.set(i, car);
    });
  }

  function spawnCase(j) {
    if (!j.caseAt || caseMesh) return;
    const { x, z } = j.caseAt;
    caseMesh = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.36, 0.44), lam(0xd8a920, { emissive: 0x4a3600 }));
    caseMesh.position.set(x, groundHeight(x, z) + 0.75, z);
    caseMesh.castShadow = true;
    scene.add(caseMesh);
    if (j.caseAt.guards) {
      // Two gangsters mind the case: black jackets, gold chains, shades.
      // They live in the crowd's figure list, so fists and bullets find them.
      for (const [gx, gz, gry, armed] of [[x + 3.4, z + 2.6, Math.PI * 0.9, true], [x - 3.4, z - 2.4, Math.PI * 1.1, false]]) {
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
    }
  }

  function activateJob() {
    const j = job();
    if (j) spawnCase(j);
  }

  function announce() {
    const j = job();
    if (!j) return;
    if (jobIdx === 0 || (jobIdx > 0 && JOBS[jobIdx - 1].chapter !== j.chapter)) {
      if (G.hud.bigCard) G.hud.bigCard(CHAPTERS[j.chapter].toUpperCase(), j.name, 2500);
    }
    if (G.dialogue) for (const [who, line] of j.startTalk) G.dialogue.show(who, line);
    announced = jobIdx;
  }

  function completeJob() {
    const j = job();
    G.save.cash += j.payout;
    G.save.cashEarned = (G.save.cashEarned || 0) + j.payout;
    G.save.jobsDone = Math.max(G.save.jobsDone, jobIdx + 1);
    G.persist();
    // BUILD 14: a finished job pays RESPECT too — 25 × the chapter
    // number, so the finale is worth three times the opener.
    earnRespect(G, 25 * (j.chapter + 1));
    // BUILD 15: and standing in whichever district the job closed in.
    if (G.standing) { const pp = G.playerPos(); G.standing.award(pp.x, pp.z, 10); }
    if (G.hud.bigCard) G.hud.bigCard('JOB COMPLETE', `${j.name} · +$${j.payout.toLocaleString('en-US')}`, 2500);
    else G.hud.toast(`JOB ${jobIdx + 1} DONE · +$${j.payout}`);
    G.audio.jingle();
    if (G.dialogue) for (const [who, line] of j.doneTalk) G.dialogue.show(who, line);
    jobIdx += 1;
    stageIdx = 0;
    activateJob();
  }

  function advanceStage() {
    stageIdx += 1;
    if (stageIdx >= job().stages.length) completeJob();
  }

  // Called by player.js when the player gets into a car.
  function onEnterCar(car) {
    const st = stage();
    if (st && st.kind === 'steal' && car === jobCars.get(jobIdx)) {
      if (st.heat) G.police.addHeat(st.heat);
      if (st.toast) G.hud.toast(st.toast);
      advanceStage();
    }
  }

  function update(dt, time) {
    if (G.started && announced !== jobIdx && jobIdx < JOBS.length && !override) announce();
    const obj = currentObjective();
    if (!override) showMarker(obj.x, obj.z);
    if (beacon.visible) {
      beacon.rotation.y = time * 0.8;
      beacon.position.y = (beacon.userData.baseY || 0) + Math.sin(time * 2) * 0.3;
      // DEFECT FIX (N-5): distance fade — the beam guides up close and
      // melts into the sky from across the map instead of dominating it.
      const bp = G.playerPos();
      const bd = Math.hypot(bp.x - beacon.position.x, bp.z - beacon.position.z);
      beacon.children[0].material.opacity = Math.max(0.05, Math.min(0.22, 1.15 - bd / 260));
    }
    if (override) return obj;

    const st = stage();
    if (!st) return currentObjective();
    const p = G.playerPos();
    const near = (x, z, r) => Math.hypot(p.x - x, p.z - z) < r;

    if (st.kind === 'go' || st.kind === 'drop') {
      if (near(st.x, st.z, st.r)) advanceStage();
    } else if (st.kind === 'grab') {
      if (near(st.x, st.z, st.r)) {
        if (caseMesh) { scene.remove(caseMesh); caseMesh = null; }
        if (st.heat) G.police.addHeat(st.heat);
        if (st.toast) G.hud.toast(st.toast);
        advanceStage();
      }
    } else if (st.kind === 'deliver') {
      const car = jobCars.get(jobIdx);
      if (car && G.player.car === car && near(st.x, st.z, st.r)) {
        G.player.exitCar(true);
        scene.remove(car.group);
        G.cars.splice(G.cars.indexOf(car), 1);
        jobCars.delete(jobIdx);
        advanceStage();
      }
    }
    return currentObjective();
  }

  activateJob();

  return {
    update, onEnterCar, spawnJobCar, showMarker,
    // BUILD 13: sidejobs' car-delivery pad must never buy a story car.
    isJobCar(car) { for (const c of jobCars.values()) if (c === car) return true; return false; },
    setObjectiveOverride(o) { override = o; if (o) showMarker(o.x, o.z); },
    get stage() { return jobIdx; },
    get objective() { return currentObjective(); },
    jobsState() {
      return JOBS.map((j, i) => ({
        name: j.name, chapter: CHAPTERS[j.chapter], giver: j.giver,
        brief: j.brief, payout: j.payout,
        state: i < jobIdx ? 'done' : (i === jobIdx ? 'current' : 'locked'),
      }));
    },
  };
}
