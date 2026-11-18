// The player: a third-person character on foot (walk, sprint, jump, building and car
// collision, GTA-style health regen up to half) and the driving model used when they take
// a car — per-class acceleration and steering, building and traffic collisions, and the
// heat that comes from hitting pedestrians or police cars.
import { CAR_CLASSES, CRIME_HEAT, PLAYER, REVERSE_MAX } from './config.js';
import { clamp, lerpAngle } from './random.js';
import { carForward } from './vehicles.js';
import { makePerson } from './pedestrians.js';

const THREE = window.THREE;

export function createPlayer(scene, G) {
  const { group } = makePerson(G.rng, 0xe8641e, 0x27313d);
  group.position.set(2.8, 0, 118);
  scene.add(group);

  const player = {
    group,
    hp: PLAYER.maxHp,
    vy: 0,
    alt: 0,
    grounded: true,
    car: null,
    facing: Math.PI,
    speedNow: 0,
    lastDamageT: -99,
    protectT: 0,

    pos() {
      return this.car ? this.car.group.position : group.position;
    },

    damage(n) {
      if (this.protectT > 0 || G.time - this.lastDamageT < 0.05) return;
      this.hp -= n;
      this.lastDamageT = G.time;
      G.hud.damageFlash();
      if (this.hp <= 0) G.onWasted();
    },

    healFull() {
      this.hp = PLAYER.maxHp;
    },

    respawnAt(x, z) {
      if (this.car) {
        this.car.kind = 'parked';
        this.car.speed = 0;
        this.car = null;
      }
      group.visible = true;
      group.position.set(x, 0, z);
      this.vy = 0;
      this.alt = 0;
      this.hp = PLAYER.maxHp;
      this.protectT = 2;
    },

    update(dt) {
      this.protectT = Math.max(0, this.protectT - dt);
      if (this.hp < PLAYER.regenCap && G.time - this.lastDamageT > 4) {
        this.hp = Math.min(PLAYER.regenCap, this.hp + 6 * dt);
      }
      if (this.car) this.driveUpdate(dt);
      else this.footUpdate(dt);
      if (G.input.pressed('KeyF')) {
        if (this.car) this.exitCar();
        else this.tryEnterCar();
      }
    },

    footUpdate(dt) {
      const input = G.input;
      const yaw = G.camYaw;
      const iz = (input.down('KeyW') || input.down('ArrowUp') ? 1 : 0) - (input.down('KeyS') || input.down('ArrowDown') ? 1 : 0);
      const ix = (input.down('KeyD') || input.down('ArrowRight') ? 1 : 0) - (input.down('KeyA') || input.down('ArrowLeft') ? 1 : 0);
      const fx = Math.sin(yaw);
      const fz = Math.cos(yaw);
      const rx = -Math.cos(yaw);
      const rz = Math.sin(yaw);
      let mx = fx * iz + rx * ix;
      let mz = fz * iz + rz * ix;
      const len = Math.hypot(mx, mz);
      const sprint = input.down('ShiftLeft') || input.down('ShiftRight');
      const speed = sprint ? PLAYER.sprint : PLAYER.walk;
      const p = group.position;
      if (len > 0.01) {
        mx /= len;
        mz /= len;
        p.x += mx * speed * dt;
        p.z += mz * speed * dt;
        const target = Math.atan2(mx, mz);
        this.facing = lerpAngle(this.facing, target, Math.min(1, dt * 12));
        this.speedNow = speed;
      } else {
        this.speedNow = 0;
      }
      if (input.pressed('Space') && this.grounded) {
        this.vy = 8.2;
        this.grounded = false;
      }
      this.vy -= 22 * dt;
      this.alt += this.vy * dt;
      if (this.alt <= 0) {
        this.alt = 0;
        this.vy = 0;
        this.grounded = true;
      }
      p.x = clamp(p.x, -212, 212);
      p.z = clamp(p.z, -212, 256);
      G.pushOut(p, PLAYER.radius);
      // Cars are solid to walk into.
      for (const car of G.allCars()) {
        const cp = car.group.position;
        const dx = p.x - cp.x;
        const dz = p.z - cp.z;
        const d = Math.hypot(dx, dz);
        const min = car.radius + PLAYER.radius;
        if (d > 0.01 && d < min) {
          p.x = cp.x + (dx / d) * min;
          p.z = cp.z + (dz / d) * min;
        }
      }
      group.rotation.y = this.facing;
      group.position.y = this.alt + (this.speedNow > 0 && this.grounded ? Math.abs(Math.sin(G.time * (sprint ? 11 : 8))) * 0.05 : 0);
      // Context prompt.
      const near = this.nearestCar();
      G.promptText = near ? `F — take the ${near.cls}` : '';
    },

    nearestCar() {
      const p = group.position;
      let best = null;
      let bd = 4.2;
      for (const car of G.cars) {
        const d = Math.hypot(car.group.position.x - p.x, car.group.position.z - p.z);
        if (d < bd) {
          bd = d;
          best = car;
        }
      }
      return best;
    },

    tryEnterCar() {
      const car = this.nearestCar();
      if (!car) return;
      const wasKind = car.kind;
      car.kind = 'driven';
      this.car = car;
      group.visible = false;
      if (!car.everStolen) {
        car.everStolen = true;
        let witnessed = false;
        for (const unit of G.police.units) {
          if (!unit.dead && car.group.position.distanceTo(unit.car.group.position) < 45) witnessed = true;
        }
        for (const ped of G.peds) {
          if (ped.alive && car.group.position.distanceTo(ped.group.position) < 18) witnessed = true;
        }
        if (witnessed) {
          G.police.addHeat(CRIME_HEAT.theft);
          G.hud.toast('Witnessed! The police are on their way.');
        }
      }
      if (car.mission) G.missions.onEnterCar(car);
      if (wasKind === 'traffic') car.cruise = 0;
    },

    exitCar() {
      const car = this.car;
      if (!car) return;
      const h = car.heading;
      const rx = -Math.cos(h);
      const rz = Math.sin(h);
      group.position.set(car.group.position.x + rx * 2.6, 0, car.group.position.z + rz * 2.6);
      G.pushOut(group.position, PLAYER.radius);
      car.speed = 0;
      car.kind = 'parked';
      this.car = null;
      group.visible = true;
      this.facing = h;
    },

    driveUpdate(dt) {
      const car = this.car;
      const spec = CAR_CLASSES[car.cls];
      const input = G.input;
      const f = carForward(car);
      const throttle = (input.down('KeyW') || input.down('ArrowUp')) ? 1 : 0;
      const brake = (input.down('KeyS') || input.down('ArrowDown')) ? 1 : 0;
      if (throttle) {
        car.speed += spec.accel * dt * (1 - Math.max(0, car.speed) / spec.max);
        if (car.speed > spec.max) car.speed = spec.max;
      } else if (brake) {
        if (car.speed > 0.5) car.speed -= 26 * dt;
        else {
          car.speed -= spec.accel * 0.6 * dt;
          if (car.speed < -REVERSE_MAX) car.speed = -REVERSE_MAX;
        }
      } else {
        car.speed -= car.speed * 0.4 * dt;
        if (Math.abs(car.speed) < 0.25) car.speed = 0;
      }
      if (input.down('Space')) {
        car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 30 * dt);
      }
      const steer = (input.down('KeyD') || input.down('ArrowRight') ? 1 : 0) - (input.down('KeyA') || input.down('ArrowLeft') ? 1 : 0);
      const sf = clamp(car.speed / 9, -1, 1);
      car.heading -= steer * spec.grip * 0.55 * sf * dt;
      const p = car.group.position;
      p.x += Math.sin(car.heading) * car.speed * dt;
      p.z += Math.cos(car.heading) * car.speed * dt;
      // Building collision: two circles, front and back.
      let hitWall = false;
      for (const off of [1.3, -1.3]) {
        const cx = p.x + Math.sin(car.heading) * off;
        const cz = p.z + Math.cos(car.heading) * off;
        const before = { x: cx, z: cz };
        G.pushOut(before, 1.3);
        if (before.x !== cx || before.z !== cz) {
          p.x += before.x - cx;
          p.z += before.z - cz;
          hitWall = true;
        }
      }
      if (hitWall) {
        if (Math.abs(car.speed) > 6) G.shake = Math.min(0.5, G.shake + 0.3);
        car.speed *= 0.45;
      }
      // Other cars.
      for (const other of G.allCars()) {
        if (other === car) continue;
        const op = other.group.position;
        const dx = p.x - op.x;
        const dz = p.z - op.z;
        const d = Math.hypot(dx, dz);
        const min = car.radius + other.radius - 0.35;
        if (d > 0.01 && d < min) {
          p.x = op.x + (dx / d) * min;
          p.z = op.z + (dz / d) * min;
          if (Math.abs(car.speed) > 5) G.shake = Math.min(0.5, G.shake + 0.2);
          car.speed *= 0.55;
          if (other.police) G.police.onPlayerHitCop();
        }
      }
      // Pedestrians: those who fail to dodge get hit.
      if (Math.abs(car.speed) > 7) {
        for (const ped of G.peds) {
          if (!ped.alive) continue;
          const pp = ped.group.position;
          if (Math.hypot(pp.x - p.x, pp.z - p.z) < 2.1) {
            if (G.combat.hitPed(ped, 999, 'car')) {
              G.police.addHeat(CRIME_HEAT.hitRun);
              G.hud.toast('Hit and run!');
              car.speed *= 0.8;
            }
          }
        }
      }
      if (p.x < -210 || p.x > 210 || p.z < -210 || p.z > 254) {
        p.x = clamp(p.x, -210, 210);
        p.z = clamp(p.z, -210, 254);
        car.speed *= 0.5;
      }
      car.group.rotation.y = car.heading;
      const spin = (car.speed * dt) / 0.37;
      for (const w of car.wheels) w.rotation.x += spin;
      this.speedNow = Math.abs(car.speed);
      G.promptText = 'F — get out';
    },
  };

  return player;
}
