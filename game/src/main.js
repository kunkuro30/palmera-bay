// Boot and the one loop for Palmera Bay — Hot Pursuit. Builds the city and every
// system, wires them through one shared context object G, then runs: input, player,
// traffic, pedestrians, police, combat, missions, camera, HUD. ?seed=N fixes the city;
// ?shot=<name>&seed=N stages a deterministic screenshot scene instead of the game.
import { HOSPITAL } from './config.js';
import { clamp, createRandom, lerpAngle } from './random.js';
import { loadSave, storeSave } from './save.js';
import { createInput } from './input.js';
import { buildWorld, pushOutOfBuildings } from './world.js';
import { createVehicles } from './vehicles.js';
import { createPedestrians } from './pedestrians.js';
import { createPlayer } from './player.js';
import { createPolice } from './police.js';
import { createCombat } from './combat.js';
import { createMissions } from './missions.js';
import { createHud } from './hud.js';
import { createAudio } from './audio.js';
import { stageShot } from './shots.js';

const THREE = window.THREE;

const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 4000);
camera.position.set(0, 26, 90);

const G = {
  scene,
  camera,
  renderer,
  rng: createRandom(seed),
  time: 0,
  save: loadSave(),
  camYaw: Math.PI,
  camPitch: 0.34,
  camYawOffset: 0,
  shake: 0,
  promptText: '',
  started: false,
  paused: false,
  stunT: 0,
};
G.pushOut = (pos, r) => pushOutOfBuildings(pos, r, G.buildings);

const world = buildWorld(scene, G.rng);
G.buildings = world.buildings;
G.input = createInput(canvas);
const vehicles = createVehicles(scene, G.rng, G);
G.vehicles = vehicles;
G.pedsSys = createPedestrians(scene, G.rng, G);
G.player = createPlayer(scene, G);
G.police = createPolice(scene, G.rng, G);
G.combat = createCombat(scene, G.rng, G);
G.missions = createMissions(scene, G.rng, G);
G.hud = createHud(G);
G.audio = createAudio();

G.allCars = () => {
  const arr = [...G.cars];
  for (const unit of G.police.units) if (!unit.dead) arr.push(unit.car);
  for (const b of G.police.blockers) arr.push(b);
  return arr;
};

G.addCash = (n) => {
  G.save.cash = Math.max(0, G.save.cash + n);
  storeSave(G.save);
  if (n > 0) G.audio.cash();
};

function announce(text) {
  status.textContent = text;
}

function goDown(kind) {
  if (G.stunT > 0) return;
  G.stunT = 1.4;
  G.save.cash = Math.floor(G.save.cash * 0.9);
  storeSave(G.save);
  if (kind === 'busted') {
    G.hud.flash('BUSTED', '#5aa2ff');
    G.audio.busted();
    announce('Busted. You wake up outside the hospital, ten percent lighter.');
  } else {
    G.hud.flash('WASTED', '#e5534b');
    announce('Wasted. You wake up outside the hospital, ten percent lighter.');
  }
  G.police.reset();
  G.missions.onPlayerDown();
  G.player.respawnAt(HOSPITAL.x, HOSPITAL.z);
  G.camYaw = Math.PI;
  G.camPitch = 0.34;
}
G.onBusted = () => goDown('busted');
G.onWasted = () => goDown('wasted');

function setPaused(paused) {
  G.paused = paused;
  G.hud.setPaused(paused);
  if (paused) G.input.unlock();
  else G.input.lock();
}

function handleKeys(mouse) {
  const input = G.input;
  if (input.pressed('KeyP')) {
    setPaused(!G.paused);
    return;
  }
  if (G.paused) return;
  if (input.pressed('KeyM')) {
    const muted = G.audio.toggleMute();
    G.hud.toast(muted ? 'Sound off.' : 'Sound on.');
  }
  if (input.pressed('Digit1')) G.combat.switchWeapon('fists');
  if (input.pressed('Digit2')) G.combat.switchWeapon('pistol');
  if (mouse.clicked) {
    if (!input.isLocked()) input.lock();
    else G.combat.attack();
  }
}

const camTarget = new THREE.Vector3();
function updateCamera(dt, mouse) {
  const player = G.player;
  if (player.car) {
    const car = player.car;
    G.camYawOffset += mouse.dx * 0.0022;
    G.camYawOffset = clamp(G.camYawOffset - G.camYawOffset * 1.4 * dt, -0.9, 0.9);
    const desired = car.heading + G.camYawOffset;
    G.camYaw = lerpAngle(G.camYaw, desired, 1 - Math.exp(-3.4 * dt));
    const pitch = 0.3;
    const dist = 10.5;
    const fx = Math.sin(G.camYaw);
    const fz = Math.cos(G.camYaw);
    const cp = car.group.position;
    camera.position.set(
      cp.x - fx * dist * Math.cos(pitch),
      dist * Math.sin(pitch) + 1.1,
      cp.z - fz * dist * Math.cos(pitch),
    );
    const speed = Math.abs(car.speed);
    G.shake = Math.max(0, G.shake - dt * 1.4);
    const amp = Math.max(G.shake * 0.22, speed > 28 ? Math.min(0.1, (speed - 28) / 14 * 0.07) : 0);
    if (amp > 0) {
      camera.position.x += (G.rng() - 0.5) * amp;
      camera.position.y += (G.rng() - 0.5) * amp * 0.6;
    }
    camTarget.set(cp.x + fx * 3.5, 1.5, cp.z + fz * 3.5);
    camera.lookAt(camTarget);
    const targetFov = 62 + Math.min(1, speed / 42) * 10;
    if (Math.abs(camera.fov - targetFov) > 0.05) {
      camera.fov += (targetFov - camera.fov) * Math.min(1, dt * 5);
      camera.updateProjectionMatrix();
    }
  } else {
    G.camYaw -= mouse.dx * 0.0026;
    G.camPitch = clamp(G.camPitch + mouse.dy * 0.0022, 0.06, 1.15);
    const dist = 7.2;
    const fx = Math.sin(G.camYaw);
    const fz = Math.cos(G.camYaw);
    const pp = player.group.position;
    camera.position.set(
      pp.x - fx * dist * Math.cos(G.camPitch),
      pp.y + dist * Math.sin(G.camPitch) + 0.4,
      pp.z - fz * dist * Math.cos(G.camPitch),
    );
    G.pushOut(camera.position, 0.4);
    if (camera.position.y < 0.5) camera.position.y = 0.5;
    camTarget.set(pp.x + fx * 2.2, pp.y + 1.55, pp.z + fz * 2.2);
    camera.lookAt(camTarget);
    if (Math.abs(camera.fov - 62) > 0.05) {
      camera.fov += (62 - camera.fov) * Math.min(1, dt * 5);
      camera.updateProjectionMatrix();
    }
  }
}

function titleCamera() {
  const t = G.time * 0.045;
  camera.position.set(Math.sin(t) * 88, 27, 20 + Math.cos(t) * 88);
  camTarget.set(0, 5, 10);
  camera.lookAt(camTarget);
  if (Math.abs(camera.fov - 58) > 0.05) {
    camera.fov = 58;
    camera.updateProjectionMatrix();
  }
}

G.hud.bindStart(() => {
  if (G.started) return;
  G.started = true;
  G.hud.hideStart();
  G.audio.init();
  G.input.lock();
  announce('Palmera Bay. Meet Marina Sol at the marina, to the south-east.');
  G.hud.toast('Find Marina Sol at the marina — follow the gold marker.');
});

window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden && G.started && !G.paused) setPaused(true);
});

window.__game = { scene, camera, renderer, player: G.player, state: G };

// Screenshot scenes: stage once, then advance a fixed number of frames.
let shotCtl = null;
let shotFrames = 0;
if (shotName) {
  G.hud.hideStart();
  G.started = true;
  shotCtl = stageShot(shotName, G);
}

let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (shotCtl) {
    G.time += 1 / 30;
    shotCtl.frame(1 / 30);
    world.update(G.time);
    G.hud.update(1 / 30);
    renderer.render(scene, camera);
    shotFrames += 1;
    if (shotFrames >= 45) window.__shotReady = true;
    return;
  }
  const mouse = G.input.takeMouse();
  if (G.started && !G.paused) {
    if (G.stunT > 0) {
      G.stunT -= dt;
    } else {
      G.time += dt;
      handleKeys(mouse);
      if (!G.paused) {
        G.player.update(dt);
        vehicles.update(dt);
        G.pedsSys.update(dt);
        G.police.update(dt);
        G.combat.update(dt);
        G.missions.update(dt);
        G.audio.update(G);
      }
    }
    updateCamera(dt, mouse);
  } else if (!G.started) {
    G.time += dt;
    vehicles.update(dt);
    G.pedsSys.update(dt);
    titleCamera();
  }
  world.update(G.time);
  G.hud.update(dt);
  G.input.endFrame();
  renderer.render(scene, camera);
}
requestAnimationFrame(frame);
