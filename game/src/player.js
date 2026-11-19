// The player: the main character in street-casual dress — orange jacket
// over a white tee, jeans, red sneakers (deliberately NOT a tactical
// soldier). On foot he walks/runs with building collision; near a car, E
// gets in — traffic cars can be stolen (a crime the police remember),
// parked cars are free. While driving the figure hides and the car takes
// over. TPS gunplay: hold right-mouse to aim over the shoulder (crosshair
// up, gun arm raised), left-click to fire — see combat.shoot.

import { WORLD, TUNING, groundHeight } from './config.js';
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

  const player = {
    group: fig.group,
    fig,
    car: null,
    health: 100,
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
      let bestD = 4.4;
      for (const car of G.allCars()) {
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
      G.missions.onEnterCar(car);
    },

    exitCar(silent = false) {
      if (!this.car) return;
      const car = this.car;
      const p = car.group.position;
      const ex = p.x + Math.cos(car.heading) * 2.4, ez = p.z - Math.sin(car.heading) * 2.4;
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
        if (this.fig.parts.weapon) this.fig.parts.weapon.visible = false;
        const drive = (input.down('KeyW', 'ArrowUp') ? 1 : 0) - (input.down('KeyS', 'ArrowDown') ? 1 : 0);
        const steer = (input.down('KeyA', 'ArrowLeft') ? 1 : 0) - (input.down('KeyD', 'ArrowRight') ? 1 : 0);
        driveStep(this.car, dt, drive, steer);
        collideCar(this.car);
        return;
      }
      // On foot: camera-relative WASD. While aiming, movement becomes a
      // slow strafe and the figure faces the camera's aim direction.
      const camYaw = G.camYaw;
      this.aiming = !!input.aiming;
      if (this.fig.parts.weapon) this.fig.parts.weapon.visible = this.aiming;
      let mx = 0, mz = 0;
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
        const speed = this.aiming ? 2.6 : (input.down('ShiftLeft', 'ShiftRight') ? TUNING.runSpeed : TUNING.walkSpeed);
        const p = this.group.position;
        const nx = clamp(p.x + mx * speed * dt, -312, 312);
        const nz = clamp(p.z + mz * speed * dt, -312, 322);
        if (!hitsCollider(G.colliders, nx, p.z, 0.7)) p.x = nx;
        if (!hitsCollider(G.colliders, p.x, nz, 0.7)) p.z = nz;
        p.y = groundHeight(p.x, p.z);
        this.fig.baseY = p.y;
        if (!this.aiming) {
          const want = Math.atan2(mx, mz);
          this.facing += angDiff(this.facing, want) * Math.min(1, dt * 14);
          this.group.rotation.y = this.facing;
        }
        poseFigure(this.fig, time, speed);
      } else {
        poseFigure(this.fig, time, 0);
      }
      if (this.swing > 0 && !this.aiming) {
        this.fig.parts.armR.rotation.x = -1.9 * Math.sin((0.3 - this.swing) / 0.3 * Math.PI);
      }
    },
  };

  function collideCar(car) {
    const p = car.group.position;
    p.x = clamp(p.x, -312, 312);
    p.z = clamp(p.z, -312, 322);
    const hit = hitsCollider(G.colliders, p.x, p.z, 1.6);
    if (hit) {
      // Push out along the smaller penetration axis and kill the speed.
      const dxl = Math.abs(p.x - (hit.x0 - 1.6));
      const dxr = Math.abs(p.x - (hit.x1 + 1.6));
      const dzl = Math.abs(p.z - (hit.z0 - 1.6));
      const dzr = Math.abs(p.z - (hit.z1 + 1.6));
      const m = Math.min(dxl, dxr, dzl, dzr);
      if (m === dxl) p.x = hit.x0 - 1.6;
      else if (m === dxr) p.x = hit.x1 + 1.6;
      else if (m === dzl) p.z = hit.z0 - 1.6;
      else p.z = hit.z1 + 1.6;
      car.speed *= -0.25;
      if (Math.abs(car.speed) > 6) G.police.addHeat(25);
    }
  }

  return player;
}
