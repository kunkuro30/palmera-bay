// main.js — boot and the one game loop for PALMERA BAY — Hot Pursuit.
// It wires the modules together: the world, the player, traffic, police,
// missions, combat, sound and the HUD, and it owns the screen state machine
// (title, playing, paused, busted, wasted) and every consequence that
// crosses a module boundary: crime heat, collisions, arrests, respawns.
//
// ?seed=N fixes the city's random layout. ?shot=<name>&seed=N stages a
// screenshot scene instead of starting at the title screen.

import { DAY, ECONOMY } from './config.js';
import { makeRng } from './random.js';
import { createWorld } from './world.js';
import { createHud } from './hud.js';
import { createInput } from './input.js';
import { createPlayer } from './player.js';
import { createTraffic, driveCar } from './vehicles.js';
import { createPeds } from './pedestrians.js';
import { createPolice } from './police.js';
import { createMissions } from './missions.js';
import { createCombat } from './combat.js';
import { createAudio } from './audio.js';
import { loadSave, storeSave } from './save.js';
import { stageCamera, stageActionShot } from './shots.js';

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : 20261118;
const rng = makeRng(seed ^ 0x5eed);

const canvas = document.getElementById('game-canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 3000);
const world = createWorld(scene, seed);
const hud = createHud();
const input = createInput(canvas);
const audio = createAudio();
const save = loadSave();
const player = createPlayer(scene);
const traffic = createTraffic(scene, seed, world);
const peds = createPeds(scene, seed);
const police = createPolice(scene, seed, world, { siren: (on) => audio.siren(on && mode === 'play') });

let money = save.money;
let saveTimer = 0;
function persist() {
  save.money = money;
  save.playSeconds = (save.playSeconds || 0) + 1;
  storeSave(save);
}
const missions = createMissions(scene, save, {
  addMoney: (n) => { money += n; persist(); },
  addHeat: (n) => police.addHeat(n),
  setHeat: (n) => { police.heat = n; },
  getHeat: () => police.heat,
  toast: (t) => hud.toast(t),
  banner: (h) => hud.showBanner(h),
  audio, persist,
});
const combat = createCombat(scene, audio);

let mode = shot ? 'shot' : 'title';
let currentCar = null;
let camYaw = Math.PI, camPitch = 0.32, camDist = 7;
let hour = DAY.startHour;
let tripMeters = 0, taxiCooldown = 0;
const endScreen = document.getElementById('end-screen');
const endTitle = document.getElementById('end-title');
const endText = document.getElementById('end-text');
const pauseScreen = document.getElementById('pause-screen');
const titleScreen = document.getElementById('title-screen');

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// --- crime + consequence helpers -------------------------------------------
function witnessed(x, z, radius) {
  for (const u of police.units) if (Math.hypot(u.pos.x - x, u.pos.z - z) < 70) return true;
  for (const p of peds.peds) if (p.down <= 0 && Math.hypot(p.pos.x - x, p.pos.z - z) < radius) return true;
  return false;
}
function reportCrime(amount, x, z) {
  police.addHeat(witnessed(x, z, 26) ? amount : amount * 0.4);
}

function endRun(kind) {
  mode = 'over';
  audio.engine(false); audio.siren(false);
  audio.sting();
  document.exitPointerLock?.();
  const fee = kind === 'busted' ? ECONOMY.jailFee : ECONOMY.hospitalFee;
  money = Math.max(0, money - fee);
  persist();
  endTitle.textContent = kind === 'busted' ? 'BUSTED' : 'WASTED';
  endTitle.style.color = kind === 'busted' ? '#6db3ff' : '#ff5f6d';
  endText.textContent = kind === 'busted'
    ? `The bay's finest boxed you in. Bail and fees: $${fee}. Your car is impounded, your pride dented.`
    : `You wake up at Palmera General. The bill: $${fee}. The city is still out there.`;
  endScreen.style.display = 'flex';
  hud.hide();
}

function respawn() {
  police.reset();
  player.heal();
  currentCar = null;
  player.mesh.visible = true;
  player.pos.set(-120, 0, -120); // outside the central police station
  player.heading = Math.PI * 0.75;
  endScreen.style.display = 'none';
  hud.show();
  mode = 'play';
}

document.getElementById('respawn-btn').addEventListener('click', respawn);
document.getElementById('start-btn').addEventListener('click', () => {
  titleScreen.style.display = 'none';
  hud.show();
  audio.start();
  mode = 'play';
  input.lockPointer();
});

// --- per-frame systems -------------------------------------------------------
function nearestCar(maxDist) {
  let best = null, bestD = maxDist;
  for (const c of [...traffic.cars, ...police.units]) {
    if (c.police) continue; // cruisers are locked, sadly
    const d = Math.hypot(c.pos.x - player.pos.x, c.pos.z - player.pos.z);
    if (d < bestD) { bestD = d; best = c; }
  }
  return best;
}

function enterCar(car) {
  currentCar = car;
  player.driving = car;
  player.mesh.visible = false;
  if (car.driver === 'traffic') {
    car.driver = 'player';
    peds.scare(car.pos.x, car.pos.z, 9);
    reportCrime(0.22, car.pos.x, car.pos.z);
    hud.toast('Car jacked — the owner is calling it in!');
  } else if (car.parked) {
    car.parked = false;
    car.driver = 'player';
    reportCrime(0.1, car.pos.x, car.pos.z);
  } else car.driver = 'player';
  audio.engine(true, 0);
  if (!missions.taxi && taxiCooldown <= 0 && car !== traffic.sports) missions.offerTaxi(rng);
}

function exitCar() {
  if (!currentCar) return;
  const car = currentCar;
  car.driver = null;
  player.driving = null;
  player.mesh.visible = true;
  player.pos.set(car.pos.x + Math.cos(car.heading) * 2.1, 0, car.pos.z - Math.sin(car.heading) * 2.1);
  player.heading = car.heading;
  currentCar = null;
  audio.engine(false);
  taxiCooldown = 25;
}

function updatePlay(dt) {
  hour += dt * DAY.hoursPerSecond;
  const pressed = input.takePressed();
  if (pressed.has('KeyP')) { mode = 'pause'; pauseScreen.style.display = 'flex'; document.exitPointerLock?.(); return; }
  if (pressed.has('KeyM')) hud.toast(audio.toggleMute() ? 'Sound off' : 'Sound on');
  if (pressed.has('Digit1')) combat.setWeapon('fists');
  if (pressed.has('Digit2')) combat.setWeapon('pistol');
  const mouse = input.takeMouseMove();
  camYaw -= mouse.x * 0.0026;
  camPitch = Math.max(0.05, Math.min(1.05, camPitch + mouse.y * 0.0022));
  taxiCooldown = Math.max(0, taxiCooldown - dt);

  const focus = currentCar ? currentCar.pos : player.pos;
  let speedKmh = null;

  if (currentCar) {
    const steer = (input.held.has('KeyA') || input.held.has('ArrowLeft') ? 1 : 0)
      + (input.held.has('KeyD') || input.held.has('ArrowRight') ? -1 : 0);
    const throttle = (input.held.has('KeyW') || input.held.has('ArrowUp') ? 1 : 0)
      + (input.held.has('KeyS') || input.held.has('ArrowDown') ? -1 : 0);
    speedKmh = driveCar(currentCar, {
      throttle, steer,
      brake: input.held.has('KeyS') || input.held.has('ArrowDown'),
      handbrake: input.held.has('Space'),
    }, dt, world);
    audio.engine(true, Math.abs(currentCar.speed) / 39);
    if (missions.taxi) tripMeters += Math.abs(currentCar.speed) * dt;
    if (pressed.has('KeyF')) exitCar();
    // running someone down is very much a crime
    for (const p of peds.peds) {
      if (p.down <= 0 && Math.abs(currentCar.speed) > 3 &&
          Math.hypot(p.pos.x - currentCar.pos.x, p.pos.z - currentCar.pos.z) < 1.9) {
        p.down = 6; p.mesh.rotation.x = Math.PI / 2;
        reportCrime(0.3, p.pos.x, p.pos.z);
        peds.scare(p.pos.x, p.pos.z, 16);
        audio.crash(0.4);
      }
    }
    // car-on-car bumps
    for (const other of [...traffic.cars, ...police.units]) {
      if (other === currentCar) continue;
      const d = Math.hypot(other.pos.x - currentCar.pos.x, other.pos.z - currentCar.pos.z);
      if (d < 3.3 && Math.abs(currentCar.speed) > 4) {
        audio.crash(Math.abs(currentCar.speed) / 30);
        currentCar.vx *= 0.5; currentCar.vz *= 0.5;
        other.vx += currentCar.vx * 0.4; other.vz += currentCar.vz * 0.4;
        if (other.police) reportCrime(0.12, other.pos.x, other.pos.z);
      }
    }
  } else {
    const fwd = { x: Math.sin(camYaw), z: Math.cos(camYaw) };
    const right = { x: fwd.z, z: -fwd.x };
    const move = { x: 0, z: 0 };
    if (input.held.has('KeyW') || input.held.has('ArrowUp')) { move.x += fwd.x; move.z += fwd.z; }
    if (input.held.has('KeyS') || input.held.has('ArrowDown')) { move.x -= fwd.x; move.z -= fwd.z; }
    if (input.held.has('KeyD') || input.held.has('ArrowRight')) { move.x += right.x; move.z += right.z; }
    if (input.held.has('KeyA') || input.held.has('ArrowLeft')) { move.x -= right.x; move.z -= right.z; }
    player.updateOnFoot(dt, move, input.held.has('ShiftLeft') || input.held.has('ShiftRight'), world);
    // traffic can hurt: a moving car clips the courier
    for (const c of traffic.cars) {
      if (Math.abs(c.speed) > 6 && Math.hypot(c.pos.x - player.pos.x, c.pos.z - player.pos.z) < 2.1) {
        if (player.hurt(Math.abs(c.speed) * 1.5)) return endRun('wasted');
        player.pos.x += (player.pos.x - c.pos.x) * 0.4;
        player.pos.z += (player.pos.z - c.pos.z) * 0.4;
        audio.crash(0.5);
      }
    }
    if (input.mouseClicked) {
      const ev = combat.attack({
        player, camera, peds: peds.peds, cars: [...traffic.cars, ...police.units],
        colliders: world.colliders,
      });
      if (ev && ev.type === 'punch' && ev.ped) { reportCrime(0.16, player.pos.x, player.pos.z); peds.scare(player.pos.x, player.pos.z, 9); }
      if (ev && ev.type === 'shot') {
        peds.scare(player.pos.x, player.pos.z, 26);
        if (ev.hit && ev.hit.what === 'ped') reportCrime(0.3, player.pos.x, player.pos.z);
        else if (ev.hit && ev.hit.what === 'policecar') reportCrime(0.35, player.pos.x, player.pos.z);
        else if (ev.hit && ev.hit.what === 'car') reportCrime(0.18, player.pos.x, player.pos.z);
        else reportCrime(0.08, player.pos.x, player.pos.z);
      }
    }
    const near = nearestCar(3.4);
    hud.showPrompt(near ? 'F — get in the car' : null);
    if (near && pressed.has('KeyF')) enterCar(near);
  }
  if (currentCar) hud.showPrompt(police.bustedTimer > 0.3 ? 'THE POLICE ARE BOXING YOU IN — MOVE!' : null);

  traffic.update(dt, focus);
  const fastCars = [...traffic.cars, ...police.units].filter((c) => Math.abs(c.speed) > 7);
  peds.update(dt, world, fastCars);
  world.update(dt);
  combat.update(dt);
  police.update(dt, focus, currentCar ? Math.abs(currentCar.speed) : player.speedNow, !!currentCar);
  missions.update(dt, {
    playerPos: focus, inCar: !!currentCar,
    inSportsCar: currentCar === traffic.sports, sportsCar: traffic.sports,
  });
  missions.updateTaxi({ playerPos: focus, tripMeters });
  if (missions.taxi) {
    hud.showBanner(`<b>DISPATCH</b> — fare waiting across town. Deliver and get paid.`);
  }
  if (police.busted) return endRun('busted');
  if (player.health <= 0) return endRun('wasted');

  // camera: third person, mouse-orbit with a driving ease-back
  const target = { x: focus.x, y: (currentCar ? 1.4 : 1.7), z: focus.z };
  if (currentCar && Math.abs(currentCar.speed) > 3) {
    let dh = currentCar.heading + Math.PI - camYaw;
    while (dh > Math.PI) dh -= Math.PI * 2;
    while (dh < -Math.PI) dh += Math.PI * 2;
    camYaw += dh * Math.min(1, dt * 1.7);
  }
  const dist = currentCar ? 10.5 : camDist;
  const back = { x: Math.sin(camYaw), z: Math.cos(camYaw) };
  camera.position.set(
    target.x - back.x * dist, target.y + 1.1 + camPitch * 4.6, target.z - back.z * dist);
  camera.lookAt(target.x, target.y + 0.6, target.z);
  combat.showCrosshair(true);

  saveTimer += dt;
  if (saveTimer > 5) { saveTimer = 0; persist(); }
  hud.update({
    money, health: player.health, stars: police.stars, hour,
    speedKmh, player: { x: focus.x, z: focus.z, heading: currentCar ? currentCar.heading : player.heading },
    markers: [missions.markerFor()],
    blips: [...police.units.map((u) => ({ x: u.pos.x, z: u.pos.z, police: true })),
            ...traffic.cars.map((c) => ({ x: c.pos.x, z: c.pos.z, police: false }))],
  });
}

// --- title + shot staging ----------------------------------------------------
let shotPlan = null;
if (shot) {
  titleScreen.style.display = 'none';
  hud.show();
  shotPlan = stageActionShot(shot, {
    scene, camera, world, player, traffic, peds, police, missions, hud, rng,
  });
  if (!shotPlan) stageCamera(shot, camera); // world-only scene (city/street/beach)
}

let frames = 0;
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  if (mode === 'play') updatePlay(dt);
  else if (mode === 'pause') { /* frozen; P resumes below */ 
    if (input.takePressed().has('KeyP')) { mode = 'play'; pauseScreen.style.display = 'none'; input.lockPointer(); }
  } else if (mode === 'shot') {
    // step the scene for a fixed 2.5 simulated seconds, then hold the frame:
    // the screenshot is the same whenever the shutter falls after that
    const stepDt = 1 / 60;
    if (frames < 150) {
      if (shotPlan) shotPlan.step(stepDt);
      else { world.update(stepDt); traffic.update(stepDt, player.pos); peds.update(stepDt, world, []); }
    }
    frames += 1;
    if (frames === 4) window.__shotReady = true;
  } else { // title / over: the city lives behind the panels
    world.update(dt);
    traffic.update(dt, player.pos);
    peds.update(dt, world, []);
    if (mode === 'title') {
      const t = now / 1000;
      camera.position.set(Math.sin(t * 0.05) * 150, 34, 320 - Math.cos(t * 0.05) * 30);
      camera.lookAt(-10, 22, -30);
    }
  }
  renderer.render(scene, camera);
}
requestAnimationFrame(frame);
