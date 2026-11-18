// main.js — wires Palmera Bay together: the renderer, the states (title,
// play, pause, busted/wasted, and the deterministic screenshot mode), the
// camera, car entry, crime reporting, collisions and the save heartbeat.

import { CITY, PLAYER, DAY } from './config.js';
import { makeRng } from './random.js';
import { loadSave, storeSave } from './save.js';
import { createInput } from './input.js';
import { createWorld } from './world.js';
import { createTraffic, driveCar, forwardOf } from './vehicles.js';
import { createPeds } from './pedestrians.js';
import { createPlayer } from './player.js';
import { createPolice } from './police.js';
import { createCombat, FIST_DAMAGE, SHOT_PED_DAMAGE } from './combat.js';
import { createMissions } from './missions.js';
import { createHud } from './hud.js';
import { createAudio } from './audio.js';
import { stageActionShot, stageCamera } from './shots.js';

const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
const seed = Number(params.get('seed') || 1);
const rng = makeRng(seed * 7919 + 13);

const canvas = document.getElementById('game-canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 2400);
camera.position.set(0, 40, 320);

const save = loadSave();
const input = createInput(canvas);
const world = createWorld(scene, rng);
const traffic = createTraffic(scene, rng, world);
const peds = createPeds(scene, rng, world);
const player = createPlayer(scene);
const audio = createAudio();
const hud = createHud();
const combat = createCombat(scene);

let state = 'title';
let endKind = null;

const police = createPolice(scene, rng, world, {
  onBusted: () => endGame('busted'),
  siren: (on) => audio.setSiren(on),
});
const missions = createMissions(scene, rng, world, save, {
  addMoney: (n) => { save.money += n; },
  addHeat: (n) => police.addHeat(n),
  setHeat: (n) => police.setHeat(n),
  toast: (t) => hud.toast(t),
  banner: (h) => hud.showBanner(h),
  audio,
  persist: () => storeSave(save),
  heal: () => player.healFull(),
});

// ---------------------------------------------------------------------------
let camYaw = Math.PI;
let camPitch = 0.32;
let camForward = { x: 0, z: -1 };
let crimeThisFrame = false;
let lastCarHitAt = -9;
let saveTimer = 0;
let elapsed = 0;
let weapon = 'fists';

function reportCrime(amount, x, z) {
  const witnessed = police.nearestDistance(x, z) < 70 || peds.standingNear(x, z, 26);
  police.addHeat(witnessed ? amount : amount * 0.4);
  crimeThisFrame = true;
}

function activePos() {
  return player.driving ? player.driving.pos : player.pos;
}
function activeHeading() {
  return player.driving ? player.driving.heading : player.heading;
}
function activeSpeed() {
  return player.driving ? Math.abs(player.driving.speed) : player.speedNow;
}

function endGame(kind) {
  if (state !== 'play') return;
  state = 'over';
  endKind = kind;
  input.unlockPointer();
  const fee = kind === 'busted' ? 150 : 100;
  const paid = Math.min(save.money, fee);
  save.money -= paid;
  storeSave(save);
  if (player.driving) {
    const car = player.driving;
    car.driver = car.wasTraffic ? 'traffic' : null;
    player.driving = null;
  }
  player.mesh.visible = true;
  audio.setEngine(0, false);
  audio.setSiren(false);
  const screen = document.getElementById('end-screen');
  screen.classList.remove('hidden');
  screen.classList.toggle('wasted', kind === 'wasted');
  document.getElementById('end-title').textContent = kind === 'busted' ? 'BUSTED' : 'WASTED';
  document.getElementById('end-detail').textContent = kind === 'busted'
    ? 'The bay\'s finest boxed you in. Bail and fees: $' + paid + '.'
    : 'You woke up at Palmera General. Hospital bill: $' + paid + '.';
}

document.getElementById('respawn-btn').addEventListener('click', () => {
  document.getElementById('end-screen').classList.add('hidden');
  police.clearHeat();
  player.reset(-120, -120);
  camYaw = Math.PI;
  state = 'play';
  input.lockPointer();
});
document.getElementById('start-btn').addEventListener('click', () => {
  audio.start();
  document.getElementById('title-screen').classList.add('hidden');
  hud.setVisible(true);
  state = 'play';
  input.lockPointer();
});
document.getElementById('resume-btn').addEventListener('click', () => {
  document.getElementById('pause-screen').classList.add('hidden');
  state = 'play';
  input.lockPointer();
});
document.addEventListener('pointerlockchange', () => {
  if (!input.isLocked() && state === 'play' && !shotName) {
    state = 'pause';
    document.getElementById('pause-screen').classList.remove('hidden');
  }
});
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---------------------------------------------------------------------------
function enterCar(car) {
  player.driving = car;
  player.mesh.visible = false;
  audio.door();
  if (car.driver === 'traffic') {
    car.wasTraffic = true;
    car.driver = 'player';
    peds.scare(car.pos.x, car.pos.z, 14);
    reportCrime(0.22, car.pos.x, car.pos.z);
    hud.toast('JACKED — that driver will call it in');
  } else {
    car.parked = false;
    car.driver = 'player';
    reportCrime(car.isSports ? 0.12 : 0.1, car.pos.x, car.pos.z);
  }
  const f = forwardOf(car.heading);
  camForward = { x: f.x, z: f.z };
}

function exitCar() {
  const car = player.driving;
  const right = { x: -Math.cos(car.heading), z: Math.sin(car.heading) };
  player.pos.set(car.pos.x + right.x * 2.6, 0, car.pos.z + right.z * 2.6);
  world.collideCircle(player.pos, PLAYER.radius);
  player.heading = car.heading;
  player.mesh.visible = true;
  player.driving = null;
  car.driver = car.wasTraffic ? 'traffic' : null;
  audio.door();
}

function tryEnterExit() {
  if (player.driving) {
    exitCar();
    return;
  }
  let best = null;
  let bestD = 3.6;
  for (const car of traffic.cars) {
    if (car.police) continue;
    const d = Math.hypot(car.pos.x - player.pos.x, car.pos.z - player.pos.z);
    if (d < bestD) { bestD = d; best = car; }
  }
  if (best) enterCar(best);
}

function handleCombat(frame) {
  if (input.wasPressed('Digit1')) { weapon = 'fists'; hud.setWeapon('FISTS'); }
  if (input.wasPressed('Digit2')) { weapon = 'pistol'; hud.setWeapon('PISTOL'); }
  hud.setCrosshair(input.isLocked() && !player.driving);
  if (!frame.clicked || !input.isLocked() || player.driving) return;
  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  const ev = combat.attack({
    weapon,
    origin: weapon === 'pistol'
      ? { x: camera.position.x, y: camera.position.y, z: camera.position.z }
      : { x: player.pos.x, y: 1.35, z: player.pos.z },
    aim: weapon === 'pistol'
      ? { x: dir.x, y: dir.y, z: dir.z }
      : (() => { const l = Math.hypot(dir.x, dir.z) || 1; return { x: dir.x / l, y: 0, z: dir.z / l }; })(),
    peds: peds.peds,
    cars: [...traffic.cars, ...police.units, ...police.roadblockCars()],
    world,
  });
  if (ev.type === 'punch') {
    audio.punch();
    const killed = peds.damagePed(ev.ped, FIST_DAMAGE, player.pos.x, player.pos.z);
    reportCrime(killed ? 0.3 : 0.16, player.pos.x, player.pos.z);
  } else if (ev.type === 'punchCar') {
    audio.punch();
    reportCrime(0.12, player.pos.x, player.pos.z);
  } else if (ev.type === 'swing') {
    audio.swing();
  } else if (ev.type === 'shot') {
    audio.shot();
    peds.scare(player.pos.x, player.pos.z, 30);
    if (ev.hit === 'ped') {
      const killed = peds.damagePed(ev.ped, SHOT_PED_DAMAGE, player.pos.x, player.pos.z);
      reportCrime(killed ? 0.34 : 0.22, player.pos.x, player.pos.z);
    } else if (ev.hit === 'car') {
      reportCrime(ev.car.police ? 0.3 : 0.18, player.pos.x, player.pos.z);
    } else {
      reportCrime(0.14, player.pos.x, player.pos.z);
    }
  }
}

function handleCollisions(dt) {
  const p = activePos();
  // cars running people down
  const runners = player.driving ? [player.driving] : [];
  for (const car of traffic.cars) if (car.driver === 'traffic') runners.push(car);
  for (const car of runners) {
    if (Math.abs(car.speed) < 3.5) continue;
    for (const ped of peds.peds) {
      if (ped.state === 'down') continue;
      if (Math.hypot(ped.pos.x - car.pos.x, ped.pos.z - car.pos.z) < 1.8) {
        peds.knockDown(ped);
        car.vel.x *= 0.62;
        car.vel.z *= 0.62;
        audio.crash();
        if (car === player.driving) reportCrime(0.28, car.pos.x, car.pos.z);
      }
    }
  }
  // cars hitting the player on foot
  if (!player.driving && state === 'play') {
    const all = [...traffic.cars, ...police.units];
    for (const car of all) {
      if (Math.abs(car.speed) < 4.5) continue;
      const d = Math.hypot(car.pos.x - player.pos.x, car.pos.z - player.pos.z);
      if (d < 2.0 && player.time - lastCarHitAt > 0.9) {
        lastCarHitAt = player.time;
        player.hurt(16);
        const push = 2.4 / (d || 1);
        player.pos.x += (player.pos.x - car.pos.x) * push * 0.4;
        player.pos.z += (player.pos.z - car.pos.z) * push * 0.4;
        audio.crash();
        if (player.health <= 0) endGame('wasted');
      }
    }
  }
  // the player's car bumping others
  if (player.driving) {
    const mine = player.driving;
    const others = [...traffic.cars, ...police.units, ...police.roadblockCars()];
    for (const other of others) {
      if (other === mine) continue;
      const dx = mine.pos.x - other.pos.x;
      const dz = mine.pos.z - other.pos.z;
      const d = Math.hypot(dx, dz);
      if (d > 0.01 && d < 3.4) {
        const overlap = (3.4 - d) / d;
        mine.pos.x += dx * overlap * 0.7;
        mine.pos.z += dz * overlap * 0.7;
        if (!other.parked && other.driver !== 'police' && !other.isBlock) {
          other.pos.x -= dx * overlap * 0.3;
          other.pos.z -= dz * overlap * 0.3;
        }
        const impact = Math.abs(mine.speed);
        mine.vel.x *= 0.55;
        mine.vel.z *= 0.55;
        if (impact > 5) {
          audio.crash();
          if (other.police) reportCrime(0.1, mine.pos.x, mine.pos.z);
        }
      }
    }
  }
  return p;
}

function updatePlay(dt, frame) {
  elapsed += dt;
  crimeThisFrame = false;

  if (input.wasPressed('KeyM')) {
    hud.toast(audio.toggleMute() ? 'SOUND OFF' : 'SOUND ON', 1.6);
  }
  if (input.wasPressed('KeyP')) {
    state = 'pause';
    document.getElementById('pause-screen').classList.remove('hidden');
    input.unlockPointer();
    return;
  }
  if (input.wasPressed('KeyF')) tryEnterExit();

  // mouse look
  camYaw -= frame.dx * 0.0026;
  camPitch = Math.max(-0.12, Math.min(0.95, camPitch - frame.dy * 0.0026));

  if (player.driving) {
    const car = player.driving;
    const throttle = (input.held.has('KeyW') || input.held.has('ArrowUp') ? 1 : 0)
      + (input.held.has('KeyS') || input.held.has('ArrowDown') ? -1 : 0);
    const steer = (input.held.has('KeyD') || input.held.has('ArrowRight') ? 1 : 0)
      + (input.held.has('KeyA') || input.held.has('ArrowLeft') ? -1 : 0);
    const hitWall = driveCar(car, {
      throttle, steer, brake: false,
      handbrake: input.held.has('Space'),
    }, dt, world);
    if (hitWall && Math.abs(car.speed) > 8) audio.crash();
    player.pos.copy(car.pos);
    player.heading = car.heading;

    // chase camera: eases behind a *smoothed* forward, so quick direction
    // changes swing it a little; FOV stretches and a shake creeps in at speed
    const f = forwardOf(car.heading);
    const k = 1 - Math.exp(-3.4 * dt);
    camForward.x += (f.x - camForward.x) * k;
    camForward.z += (f.z - camForward.z) * k;
    const fl = Math.hypot(camForward.x, camForward.z) || 1;
    camForward.x /= fl;
    camForward.z /= fl;
    const speed = Math.abs(car.speed);
    camera.position.set(
      car.pos.x - camForward.x * 9.6,
      3.5,
      car.pos.z - camForward.z * 9.6,
    );
    if (speed > 28) {
      const amp = (speed - 28) * 0.006;
      camera.position.x += (Math.random() - 0.5) * amp;
      camera.position.y += (Math.random() - 0.5) * amp * 0.6;
    }
    camera.lookAt(car.pos.x + camForward.x * 7, 1.25, car.pos.z + camForward.z * 7);
    const targetFov = 62 + Math.min(1, speed / 34) * 10;
    const newFov = camera.fov + (targetFov - camera.fov) * Math.min(1, dt * 3.2);
    if (Math.abs(newFov - camera.fov) > 0.1) {
      camera.fov = newFov;
      camera.updateProjectionMatrix();
    }
    audio.setEngine(Math.min(1, speed / 34), true);
  } else {
    const f = { x: Math.sin(camYaw), z: Math.cos(camYaw) };
    const r = { x: -Math.cos(camYaw), z: Math.sin(camYaw) };
    const move = { x: 0, z: 0 };
    if (input.held.has('KeyW') || input.held.has('ArrowUp')) { move.x += f.x; move.z += f.z; }
    if (input.held.has('KeyS') || input.held.has('ArrowDown')) { move.x -= f.x; move.z -= f.z; }
    if (input.held.has('KeyD') || input.held.has('ArrowRight')) { move.x += r.x; move.z += r.z; }
    if (input.held.has('KeyA') || input.held.has('ArrowLeft')) { move.x -= r.x; move.z -= r.z; }
    const len = Math.hypot(move.x, move.z);
    if (len > 0) { move.x /= len; move.z /= len; }
    player.updateOnFoot(dt, move, input.held.has('ShiftLeft') || input.held.has('ShiftRight'), world);
    if (player.health <= 0) { endGame('wasted'); return; }

    const pitchCos = Math.cos(camPitch);
    const dir = { x: f.x * pitchCos, y: Math.sin(camPitch), z: f.z * pitchCos };
    camera.position.set(
      player.pos.x - dir.x * 7,
      player.pos.y + 1.7 - dir.y * 7 + 0.4,
      player.pos.z - dir.z * 7,
    );
    camera.lookAt(
      player.pos.x + dir.x * 3,
      player.pos.y + 1.7 + dir.y * 3,
      player.pos.z + dir.z * 3,
    );
    if (Math.abs(camera.fov - 62) > 0.1) {
      camera.fov += (62 - camera.fov) * Math.min(1, dt * 3.2);
      camera.updateProjectionMatrix();
    }
    audio.setEngine(0, false);
  }

  handleCombat(frame);
  traffic.update(dt);
  peds.update(dt);
  handleCollisions(dt);
  combat.update(dt);

  const p = activePos();
  police.update(dt, {
    x: p.x, z: p.z, pos: p, speed: activeSpeed(), heading: activeHeading(),
    inCar: !!player.driving, car: player.driving, crime: crimeThisFrame,
  });

  missions.update(dt, {
    x: p.x, z: p.z,
    inCar: !!player.driving,
    inSports: !!(player.driving && player.driving.isSports),
    nearSports: Math.hypot(traffic.sports.pos.x - player.pos.x, traffic.sports.pos.z - player.pos.z) < 6,
    sportsPos: { x: traffic.sports.pos.x, z: traffic.sports.pos.z },
  });
  hud.showPrompt(player.driving ? null : missions.promptFor({
    x: player.pos.x, z: player.pos.z, inCar: false,
    nearSports: Math.hypot(traffic.sports.pos.x - player.pos.x, traffic.sports.pos.z - player.pos.z) < 6,
  }) || (!player.driving && nearestEnterable() ? 'Press F — take this car' : null));

  const marker = missions.markerFor();
  const blips = traffic.cars.map((c) => ({ x: c.pos.x, z: c.pos.z, police: false }));
  for (const u of [...police.units, ...police.roadblockCars()]) {
    blips.push({ x: u.pos.x, z: u.pos.z, police: true, heading: u.heading });
  }
  hud.update({
    money: save.money,
    health: player.health,
    stars: police.stars,
    hour: (DAY.startHour + elapsed * DAY.minutesPerSecond / 60) % 24,
    speedKmh: player.driving ? player.driving.speed * 3.6 : null,
    player: { x: p.x, z: p.z, heading: activeHeading() },
    markers: marker ? [marker] : [],
    blips,
    seenByPolice: police.seen,
    searching: police.stars > 0 && !police.seen,
  }, dt);

  saveTimer += dt;
  save.playSeconds += dt;
  if (saveTimer > 5) {
    saveTimer = 0;
    storeSave(save);
  }
}

function nearestEnterable() {
  for (const car of traffic.cars) {
    if (car.police) continue;
    if (Math.hypot(car.pos.x - player.pos.x, car.pos.z - player.pos.z) < 3.6) return car;
  }
  return null;
}

// ---------------------------------------------------------------------------
let shotPlan = null;
let shotFrame = 0;
if (shotName) {
  document.getElementById('title-screen').classList.add('hidden');
  hud.setVisible(true);
  shotPlan = stageActionShot(shotName, { scene, camera, world, traffic, peds, player, hud, rng });
  if (!shotPlan) stageCamera(shotName, camera);
}

const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  const frame = input.consumeFrame();

  if (shotName) {
    if (shotPlan) {
      if (shotFrame < 150) shotPlan.step(1 / 60);
    } else {
      world.update(dt);
      traffic.update(dt);
      peds.update(dt);
    }
    shotFrame++;
    if (shotFrame === 4) window.__shotReady = true;
  } else if (state === 'title') {
    elapsed += dt;
    const t = elapsed * 0.045;
    camera.position.set(Math.sin(t) * 150, 54, 30 + Math.cos(t) * 150);
    camera.lookAt(0, 10, 0);
    world.update(dt);
    traffic.update(dt);
    peds.update(dt);
  } else if (state === 'play') {
    updatePlay(dt, frame);
    world.update(dt);
  } else {
    world.update(dt);
  }
  renderer.render(scene, camera);
}
animate();
