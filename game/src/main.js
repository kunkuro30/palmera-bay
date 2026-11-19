// Palmera Bay Reborn — boot and the main loop. Builds the city, the crowd,
// traffic, police, missions and the player into one shared game object G,
// then either runs the live game (start screen, follow camera, fixed-step
// updates) or, with ?shot=<scene>&seed=N, stages a deterministic screenshot
// scene and raises window.__shotReady once the staged frame has settled.

import { WORLD, groundHeight } from './config.js';
import { makeRng, clamp } from './random.js';
import { buildWorld } from './world.js';
import { createTraffic, createHighwayTraffic, makeCar, lightPhase } from './vehicles.js';
import { createCrowd } from './pedestrians.js';
import { createPolice } from './police.js';
import { createMissions } from './missions.js';
import { createCombat } from './combat.js';
import { createPlayer } from './player.js';
import { createHud } from './hud.js';
import { createAudio } from './audio.js';
import { createInput } from './input.js';
import { loadSave, persistSave } from './save.js';
import { stageShot } from './shots.js';

const THREE = window.THREE;
const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : 20261119;
const rng = makeRng(seed);

const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.22;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(58, 16 / 9, 0.1, 900);

const world = buildWorld(scene, rng);

const G = {
  scene, camera, renderer, rng,
  time: 0,
  colliders: world.colliders,
  animated: world.animated,
  lightHeads: world.lightHeads,
  cars: [],               // parked + mission cars (traffic keeps its own list)
  save: loadSave(),
  started: !!shotName,
  forceCrosshair: false,
  camYaw: Math.PI,
  persist() { persistSave(this.save); },
  playerPos() { return this.player.pos(); },
  playerHeading() { return this.player.heading(); },
  allCars() { return this.traffic.cars.concat(this.cars); },
};
G.audio = createAudio();
G.input = createInput(canvas);
G.traffic = createTraffic(scene, rng, 26);
G.highway = createHighwayTraffic(scene, rng);
G.crowd = createCrowd(scene, rng);
G.police = createPolice(scene, rng);
G.player = createPlayer(scene, G);
G.missions = createMissions(scene, G);
G.combat = createCombat(G);
G.hud = createHud(G);
G.missions.spawnJobCar();

// A few parked cars dress the streets and give the player free wheels.
for (const [x, z, h, color, cls] of [
  [-44, 70, 0.4, 0x2b50c8, 'sedan'], [-104, 186, 1.2, 0x37b24d, 'sedan'],
  [46, 118, -0.3, 0xf2f2f2, 'van'], [-154, 70, 2.8, 0xf28c28, 'sedan'],
  [96, 44, 0.1, 0x845ef7, 'sedan'], [30, 186, 1.57, 0x12b5a5, 'sedan'],
  [56, 31, 0.3, 0xd42a2a, 'truck'],   // the fire truck by its crew's corner
]) {
  const car = makeCar(color, { cls, kind: 'parked' });
  car.group.position.set(x, groundHeight(x, z), z);
  car.heading = h;
  car.group.rotation.y = h;
  scene.add(car.group);
  G.cars.push(car);
}

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

// ---- camera ------------------------------------------------------------------
const camTarget = new THREE.Vector3();
let lastDrag = 0;
function updateCamera(dt) {
  const p = G.playerPos();
  const heading = G.playerHeading();
  if (G.player.car) {
    camTarget.set(p.x - Math.sin(heading) * 10.5, 4.2, p.z - Math.cos(heading) * 10.5);
    camera.position.lerp(camTarget, Math.min(1, dt * 5));
    camera.lookAt(p.x + Math.sin(heading) * 8, 1.2, p.z + Math.cos(heading) * 8);
    G.camYaw = heading;
    lastDrag = G.input.dragYaw;
  } else if (G.player.aiming) {
    // TPS aim: tight over-the-shoulder, crosshair at screen centre.
    G.camYaw += G.input.dragYaw - lastDrag;
    lastDrag = G.input.dragYaw;
    const yaw = G.camYaw;
    const fx = Math.sin(yaw), fz = Math.cos(yaw);
    camTarget.set(p.x - fx * 3.6 + fz * 1.15, 2.05, p.z - fz * 3.6 - fx * 1.15);
    camera.position.lerp(camTarget, Math.min(1, dt * 18));
    camera.lookAt(p.x + fx * 26, 1.5, p.z + fz * 26);
  } else {
    G.camYaw += G.input.dragYaw - lastDrag;
    lastDrag = G.input.dragYaw;
    const yaw = G.camYaw;
    camTarget.set(p.x - Math.sin(yaw) * 9, 4.6, p.z - Math.cos(yaw) * 9);
    camera.position.lerp(camTarget, Math.min(1, dt * 7));
    camera.lookAt(p.x, 1.6, p.z);
  }
}

// ---- start screen --------------------------------------------------------------
const startScreen = document.getElementById('startScreen');
function beginPlay() {
  if (G.started) return;
  G.started = true;
  startScreen.classList.add('hidden');
  G.audio.unlock();
  G.hud.toast('Welcome to Palmera Bay — Job 1 is on your map');
}
if (shotName) startScreen.classList.add('hidden');
startScreen.addEventListener('click', beginPlay);

// ---- simulation step -------------------------------------------------------------
const STEP = 1 / 60;

function stepWorld(dt) {
  G.time += dt;
  for (const a of G.animated) a.update(G.time, dt);
  const phase = lightPhase(G.time);
  for (const head of G.lightHeads) {
    head.lampR.visible = phase.ns !== 'green';
    head.lampG.visible = phase.ns === 'green';
  }
  if (!G.started) {
    // Attract mode behind the start screen: the city lives on without the player.
    G.traffic.update(dt, G.time);
    G.highway.update(dt);
    G.crowd.update(dt, G.time);
    return;
  }
  for (const action of G.input.takeActions()) {
    if (action === 'enter') G.player.toggleCar();
    if (action === 'punch') G.combat.punch();
    if (action === 'shoot') G.combat.shoot();
    if (action === 'start') beginPlay();
  }
  G.player.update(dt, G.time);
  G.traffic.update(dt, G.time);
  G.highway.update(dt);
  G.crowd.update(dt, G.time);
  G.police.update(dt, G.time, G.playerPos(), !!G.player.car);
  G.combat.update(dt);
  G.missions.update(dt, G.time);
  let nearest = Infinity;
  for (const u of G.police.units) {
    const up = u.car.group.position;
    const pp = G.playerPos();
    nearest = Math.min(nearest, Math.hypot(up.x - pp.x, up.z - pp.z));
  }
  G.audio.siren(G.police.stars > 0, clamp(1 - nearest / 70, 0, 1) * 0.07);
  G.hud.update();
}

// ---- frame loop --------------------------------------------------------------------
let shotCtl = null;
let shotFrames = 0;
const SHOT_FRAMES = 90;   // 1.5 s of staged motion before the frame settles
if (shotName) {
  shotCtl = stageShot(shotName, G);
  G.hud.update();
}

let last = performance.now();
let accumulator = 0;

function frame(now) {
  requestAnimationFrame(frame);
  if (shotCtl) {
    // Deterministic: one fixed step per painted frame, no live systems.
    if (shotFrames < SHOT_FRAMES) {
      G.time += STEP;
      for (const a of G.animated) a.update(G.time, STEP);
      shotCtl.frame(STEP);
      shotFrames += 1;
      G.hud.update();
    }
    renderer.render(scene, camera);
    if (shotFrames >= SHOT_FRAMES && !window.__shotReady) window.__shotReady = true;
    return;
  }
  accumulator += Math.min((now - last) / 1000, 0.25);
  last = now;
  while (accumulator >= STEP) {
    stepWorld(STEP);
    accumulator -= STEP;
  }
  updateCamera(1 / 60);
  renderer.render(scene, camera);
}

requestAnimationFrame(frame);
