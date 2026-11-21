// GO RIO RIO · player.js — Rio on foot and in cars: movement, collision, driving, aim.
// The player: the main character in street-casual dress — orange jacket
// over a white tee, jeans, red sneakers (deliberately NOT a tactical
// soldier). On foot he walks/runs with building collision; near a car, E
// gets in — traffic cars can be stolen (a crime the police remember),
// parked cars are free. While driving the figure hides and the car takes
// over. TPS gunplay: hold right-mouse to aim over the shoulder (crosshair
// up, gun arm raised), left-click to fire — see combat.shoot.

import { WORLD, TUNING, groundHeight, heightAt, waterDepthAt } from './config.js';
import { makeFigure, poseFigure } from './characters.js';
import { driveStep } from './vehicles.js';
import { hitsCollider } from './world.js';
import { clamp, angDiff } from './random.js';

const THREE = window.THREE;

export function createPlayer(scene, G) {
  const fig = makeFigure({
    skin: 0xc68863, shirt: 0xfb8b24, apron: 0xf5f0e6, pants: 0x2b50c8,
    shoes: 0xd42427, hat: 'hair', hatColor: 0x3a2a1a, weapon: true,
  });
  if (fig.parts.weapon) fig.parts.weapon.visible = false;
  const spawn = { x: 2, z: 190 };
  fig.group.position.set(spawn.x, groundHeight(spawn.x, spawn.z), spawn.z);
  fig.baseY = groundHeight(spawn.x, spawn.z);
  scene.add(fig.group);

  const _aimDir = new THREE.Vector3();   // build 15: scratch for the aim pitch
  const player = {
    group: fig.group,
    fig,
    car: null,
    health: 100,
    armour: 0,          // build 12: HUD armour bar; Palmera Arms sells it in build 13
    facing: Math.PI,
    swing: 0,
    aiming: false,

    swingArm() { this.swing = 0.3; },

    pos() {
      return this.car ? this.car.group.position : this.group.position;
    },
    heading() {
      return this.car ? this.car.heading : this.facing;
    },

    resetToSpawn() {
      if (this.car) this.exitCar(true);
      this.group.position.set(spawn.x, groundHeight(spawn.x, spawn.z), spawn.z);
      this.fig.baseY = groundHeight(spawn.x, spawn.z);
      this.group.visible = true;
    },

    nearestCar() {
      const p = this.group.position;
      let best = null;
      let bestD = 5.0;
      for (const car of G.allCars()) {
        if (car.wrecked) continue;   // BUILD 15: a burned husk is not a ride
        const cp = car.group.position;
        const d = Math.hypot(cp.x - p.x, cp.z - p.z);
        if (d < bestD) { best = car; bestD = d; }
      }
      return best;
    },

    enterCar(car) {
      this.car = car;
      car.kind = 'player';
      this.group.visible = false;
      G.audio.door();
      if (car.cls === 'taxi' || car.wasTraffic) G.police.addHeat(80);
      // Build 12 career stats: every entry counts as driven; a traffic
      // car taken off the street counts as stolen.
      G.save.carsDriven = (G.save.carsDriven || 0) + 1;
      if (car.wasTraffic) G.save.carsStolen = (G.save.carsStolen || 0) + 1;
      G.persist();
      G.missions.onEnterCar(car);
    },

    exitCar(silent = false) {
      if (!this.car) return;
      const car = this.car;
      const p = car.group.position;
      const ex = p.x + Math.cos(car.heading) * 2.5, ez = p.z - Math.sin(car.heading) * 2.5;
      this.group.position.set(ex, groundHeight(ex, ez), ez);
      this.fig.baseY = groundHeight(ex, ez);
      this.group.visible = true;
      this.car = null;
      if (!silent) G.audio.door();
    },

    toggleCar() {
      if (this.car) { this.exitCar(); return; }
      const car = this.nearestCar();
      if (car) {
        if (car.kind === 'traffic') { car.wasTraffic = true; G.traffic.remove(car); }
        this.enterCar(car);
      }
    },

    update(dt, time) {
      const input = G.input;
      if (this.swing > 0) this.swing -= dt;
      if (this.car) {
        this.aiming = false;
        this.fig.aimPose = null;
        if (this.fig.parts.weapon) this.fig.parts.weapon.visible = false;
        let drive = (input.down('KeyW', 'ArrowUp') ? 1 : 0) - (input.down('KeyS', 'ArrowDown') ? 1 : 0);
        let steer = (input.down('KeyA', 'ArrowLeft') ? 1 : 0) - (input.down('KeyD', 'ArrowRight') ? 1 : 0);
        // BUILD 14: a race countdown holds the car on the grid.
        if (G.raceLock) { drive = 0; steer = 0; }
        driveStep(this.car, dt, drive, steer);
        collideCar(this.car);
        // DEFECT FIX (M-2): the driven car is held inside the bay too.
        clampToBay(this.car.group.position);
        this.car.group.position.y = groundHeight(this.car.group.position.x, this.car.group.position.z);
        const car = this.car;
        // BUILD 15: nitro — the Comet's kit. SHIFT with the throttle
        // down spends the gauge (3 s of boost, ~12 s to refill) on
        // extra pace past the car's own top speed; main.js kicks the
        // camera FOV while car.boosting holds, and the exhaust flame
        // + its light ride along here.
        car.boosting = false;
        if (car.isComet && (G.save.upgNitro || 0) > 0) {
          if (car.nitroGauge === undefined) car.nitroGauge = 1;
          if (input.down('ShiftLeft', 'ShiftRight') && drive > 0 && car.nitroGauge > 0.02 && !car.air) {
            car.boosting = true;
            car.nitroGauge = Math.max(0, car.nitroGauge - dt / 3);
            car.speed = Math.min((car.maxF || 24) + 12, car.speed + 15 * dt);
          } else {
            car.nitroGauge = Math.min(1, car.nitroGauge + dt / 12);
          }
          if (car.nitroFlame) car.nitroFlame.visible = car.boosting;
          if (car.nitroLight) car.nitroLight.intensity = car.boosting ? 1.7 + Math.random() * 0.9 : 0;
        }
        // BUILD 15: airborne — a stunt ramp has thrown the car
        // (stunts.js called the launch). driveStep keeps pushing it
        // forward along the ground plane; here the height is flown
        // ballistically until the wheels meet the ground again.
        if (car.air) {
          car.air.t += dt;
          car.air.vy -= 16 * dt;
          car.air.y += car.air.vy * dt;
          const gy = groundHeight(car.group.position.x, car.group.position.z);
          if (car.air.y <= gy) {
            car.group.position.y = gy;
            const airT = car.air.t, rampIdx = car.air.ramp;
            car.air = null;
            if (G.stunts) G.stunts.onLand(car, airT, rampIdx);
          } else {
            car.group.position.y = car.air.y;
          }
        }
        G.save.distance = (G.save.distance || 0) + Math.abs(this.car.speed) * dt;
        return;
      }
      // On foot: camera-relative WASD. While aiming, movement becomes a
      // slow strafe and the figure faces the camera's aim direction.
      const camYaw = G.camYaw;
      this.aiming = !!input.aiming;
      // BUILD 15 (HumanAnimator adoption): while aiming, hand
      // poseFigure the camera's real pitch so the gun arm, torso and
      // head track it; recoil (kicked in by combat.js per shot)
      // decays here — poseFigure receives no dt of its own.
      if (this.aiming) {
        G.camera.getWorldDirection(_aimDir);
        this.fig.aimPose = { pitch: Math.asin(clamp(_aimDir.y, -1, 1)) };
      } else {
        this.fig.aimPose = null;
      }
      if (this.fig.recoil) this.fig.recoil = Math.max(0, this.fig.recoil - dt * 5);
      if (this.fig.parts.weapon) this.fig.parts.weapon.visible = this.aiming;      let mx = 0, mz = 0;
      if (input.down('KeyW', 'ArrowUp')) { mx += Math.sin(camYaw); mz += Math.cos(camYaw); }
      if (input.down('KeyS', 'ArrowDown')) { mx -= Math.sin(camYaw); mz -= Math.cos(camYaw); }
      if (input.down('KeyA', 'ArrowLeft')) { mx += Math.cos(camYaw); mz -= Math.sin(camYaw); }
      if (input.down('KeyD', 'ArrowRight')) { mx -= Math.cos(camYaw); mz += Math.sin(camYaw); }
      const len = Math.hypot(mx, mz);
      const moving = len > 0.01;
      if (this.aiming) {
        this.facing = camYaw;
        this.group.rotation.y = this.facing;
      }
      if (moving) {
        mx /= len; mz /= len;
        const p = this.group.position;
        // DEFECT FIX (M-1): swimming. In water deeper than ~1.2 m Rio
        // swims at half speed, held at chest depth (surface − 0.35) —
        // no more walking the seabed fully submerged. In the shallows
        // he walks on the ground exactly as before.
        const swimming = waterDepthAt(p.x, p.z) > 1.2;
        const baseSpeed = this.aiming ? 2.6 : (input.down('ShiftLeft', 'ShiftRight') ? TUNING.runSpeed : TUNING.walkSpeed);
        const speed = swimming ? baseSpeed * 0.5 : baseSpeed;
        const nx = clamp(p.x + mx * speed * dt, -312, 312);
        const nz = clamp(p.z + mz * speed * dt, -312, 322);
        if (!hitsCollider(G.colliders, nx, p.z, 0.7)) p.x = nx;
        if (!hitsCollider(G.colliders, p.x, nz, 0.7)) p.z = nz;
        clampToBay(p);   // DEFECT FIX (M-2): on foot too, the bay turns you back
        const dw = waterDepthAt(p.x, p.z);
        p.y = dw > 1.2 ? (dw + heightAt(p.x, p.z)) - 0.35 : groundHeight(p.x, p.z);
        this.fig.baseY = p.y;
        if (!this.aiming) {
          const want = Math.atan2(mx, mz);
          this.facing += angDiff(this.facing, want) * Math.min(1, dt * 14);
          this.group.rotation.y = this.facing;
        }
        poseFigure(this.fig, time, speed);
      } else {
        // Standing still in deep water still floats at swim depth.
        const p = this.group.position;
        clampToBay(p);   // DEFECT FIX (M-2): the boundary holds even at a standstill
        const dw = waterDepthAt(p.x, p.z);
        if (dw > 1.2) { p.y = (dw + heightAt(p.x, p.z)) - 0.35; this.fig.baseY = p.y; }
        poseFigure(this.fig, time, 0);
      }
      if (this.swing > 0 && !this.aiming) {
        this.fig.parts.armR.rotation.x = -1.9 * Math.sin((0.3 - this.swing) / 0.3 * Math.PI);
      }
    },
  };

  // DEFECT FIX (M-2): the world edge. All gameplay — the race rings
  // included — lives inside ±260 m, so at 340 m from the centre the
  // bay turns you back: the position is pushed onto the boundary
  // circle along its own direction, on foot and in a car alike.
  let seaToastAt = -99;
  function clampToBay(pos) {
    const d = Math.hypot(pos.x, pos.z);
    if (d <= 340) return;
    const k = 340 / d;
    pos.x *= k;
    pos.z *= k;
    if (G.time - seaToastAt > 8) {
      seaToastAt = G.time;
      if (G.hud && G.hud.toast) G.hud.toast('Open sea — the bay turns you back');
    }
  }

  function collideCar(car) {
    const p = car.group.position;
    p.x = clamp(p.x, -312, 312);
    p.z = clamp(p.z, -312, 322);
    // DEFECT FIX (N-3): two collision circles — front and rear, ±1.2 m
    // along the heading, r 1.3 — instead of one centre point. A sedan
    // is 4.7 m long, so the centre-only test (r 1.8) let the nose sink
    // ~0.5 m into a wall before the hit registered. Each circle that
    // hits pushes the CAR out along that circle's smallest penetration
    // axis; the speed kill / heat penalty fires once per step, as before.
    const fx = Math.sin(car.heading), fz = Math.cos(car.heading);
    let resolved = false;
    for (const s of [1.2, -1.2]) {
      const cx = p.x + fx * s, cz = p.z + fz * s;
      const hit = hitsCollider(G.colliders, cx, cz, 1.3);
      if (!hit) continue;
      const dxl = Math.abs(cx - (hit.x0 - 1.3));
      const dxr = Math.abs(cx - (hit.x1 + 1.3));
      const dzl = Math.abs(cz - (hit.z0 - 1.3));
      const dzr = Math.abs(cz - (hit.z1 + 1.3));
      const m = Math.min(dxl, dxr, dzl, dzr);
      if (m === dxl) p.x += (hit.x0 - 1.3) - cx;
      else if (m === dxr) p.x += (hit.x1 + 1.3) - cx;
      else if (m === dzl) p.z += (hit.z0 - 1.3) - cz;
      else p.z += (hit.z1 + 1.3) - cz;
      resolved = true;
    }
    if (resolved) {
      car.speed *= -0.25;
      if (Math.abs(car.speed) > 6) G.police.addHeat(25);
    }
  }

  return player;
}
