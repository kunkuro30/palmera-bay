// The Palmera Bay police: a heat meter (0-500, five stars) fed by witnessed crimes, and
// cruiser units that hunt the player. A unit only holds the heat while it can see the
// player (55 m, a 120-degree cone, buildings ignored); unseen, heat drains at a per-star
// rate. Officers leave their cruisers near a slow player, chase on foot and shoot; at
// three stars and up, roadblocks appear across the player's road.
import { AVENUES, CAR_CLASSES, CLEAR_SECONDS, COAST_Z, CRIME_HEAT, HEAT_MAX } from './config.js';
import { clamp, range, wrapAngle } from './random.js';
import { makeCar } from './vehicles.js';
import { makePerson } from './pedestrians.js';

export function createPolice(scene, rng, G) {
  const police = {
    heat: 0,
    stars: 0,
    seen: false,
    stageSeen: null,
    units: [],
    blockers: [],
    rbTimer: 10,
    bustTimer: 0,
    spawnTimer: 0,
    hitCopCool: 0,
    roadblock: null,

    addHeat(n) {
      this.heat = Math.max(0, Math.min(HEAT_MAX, this.heat + n));
    },

    onPlayerHitCop() {
      if (this.hitCopCool <= 0) {
        this.addHeat(CRIME_HEAT.hitCop);
        this.hitCopCool = 2.5;
        G.hud.toast('You hit a police car!');
      }
    },

    reset() {
      this.heat = 0;
      this.stars = 0;
      this.seen = false;
      this.bustTimer = 0;
      for (const unit of this.units) {
        scene.remove(unit.car.group);
        if (unit.officer) scene.remove(unit.officer.group);
      }
      this.units = [];
      this.clearRoadblock();
    },

    clearRoadblock() {
      if (!this.roadblock) return;
      for (const car of this.roadblock.cars) scene.remove(car.group);
      this.blockers = [];
      this.roadblock = null;
    },

    spawnUnitAt(x, z, heading) {
      const car = makeCar(0xffffff, { police: true, cls: 'police', kind: 'police' });
      car.police = true;
      car.group.position.set(x, 0, z);
      car.heading = heading;
      car.group.rotation.y = heading;
      scene.add(car.group);
      const unit = {
        car, officer: null, dead: false, removeT: 0, leaveT: 0,
        stuckT: 0, reverseT: 0, contactCool: 0, phase: rng() * 6,
      };
      this.units.push(unit);
      return unit;
    },

    setOfficerOut(unit, x, z) {
      if (unit.officer) return unit.officer;
      const { group, mats } = makePerson(rng, 0x27356e, 0x1d2430);
      group.position.set(x, 0, z);
      scene.add(group);
      unit.officer = { group, mats, hp: 100, state: 'out', shootCool: range(rng, 0.4, 1.2), dead: false };
      return unit.officer;
    },

    spawnUnit() {
      const p = G.player.pos();
      const angle = rng() * Math.PI * 2;
      let x = p.x + Math.sin(angle) * 82;
      let z = p.z + Math.cos(angle) * 82;
      // Snap to the nearest road so cruisers arrive on tarmac.
      let nearestA = AVENUES[0];
      for (const a of AVENUES) if (Math.abs(a - x) < Math.abs(nearestA - x)) nearestA = a;
      let nearestS = AVENUES[0];
      for (const a of AVENUES) if (Math.abs(a - z) < Math.abs(nearestS - z)) nearestS = a;
      if (Math.abs(nearestA - x) < Math.abs(nearestS - z)) x = nearestA;
      else z = nearestS;
      x = clamp(x, -200, 200);
      z = clamp(z, -200, 200);
      const heading = Math.atan2(p.x - x, p.z - z);
      return this.spawnUnitAt(x, z, heading);
    },

    update(dt) {
      this.hitCopCool = Math.max(0, this.hitCopCool - dt);
      this.stars = this.heat > 0 ? Math.ceil(this.heat / 100) : 0;
      const player = G.player;
      const pp = player.pos();

      // Sight: any live unit close enough and facing the player.
      let seen = false;
      if (this.stars > 0) {
        for (const unit of this.units) {
          if (unit.dead) continue;
          const spots = [{ p: unit.car.group.position, h: unit.car.heading, r: 55 }];
          if (unit.officer) {
            spots.push({ p: unit.officer.group.position, h: unit.officer.group.rotation.y, r: 42 });
          }
          for (const s of spots) {
            const dx = pp.x - s.p.x;
            const dz = pp.z - s.p.z;
            const d = Math.hypot(dx, dz);
            if (d > s.r) continue;
            const ang = Math.abs(wrapAngle(Math.atan2(dx, dz) - s.h));
            if (ang < Math.PI / 3 || d < 6) seen = true;
          }
        }
      }
      this.seen = this.stageSeen !== null ? this.stageSeen : seen;
      if (!this.seen && this.heat > 0 && this.stars > 0) {
        const rate = (100 * this.stars) / CLEAR_SECONDS[this.stars];
        this.heat = Math.max(0, this.heat - rate * dt);
        this.stars = this.heat > 0 ? Math.ceil(this.heat / 100) : 0;
      }

      // Unit count follows the stars.
      const desired = this.stars === 0 ? 0 : Math.min(1 + this.stars, 6);
      this.spawnTimer -= dt;
      if (this.units.filter((u) => !u.dead).length < desired && this.spawnTimer <= 0) {
        this.spawnUnit();
        this.spawnTimer = 1.4;
      }
      for (let i = this.units.length - 1; i >= 0; i -= 1) {
        const unit = this.units[i];
        const d = Math.hypot(unit.car.group.position.x - pp.x, unit.car.group.position.z - pp.z);
        if (unit.dead) {
          unit.removeT += dt;
          if (unit.removeT > 6) {
            scene.remove(unit.car.group);
            if (unit.officer) scene.remove(unit.officer.group);
            this.units.splice(i, 1);
          }
          continue;
        }
        if (this.stars === 0) {
          unit.leaveT += dt;
          if (unit.leaveT > 2.5 || d > 60) {
            scene.remove(unit.car.group);
            if (unit.officer) scene.remove(unit.officer.group);
            this.units.splice(i, 1);
          }
          continue;
        }
        if (this.units.length > desired && d > 110) {
          scene.remove(unit.car.group);
          if (unit.officer) scene.remove(unit.officer.group);
          this.units.splice(i, 1);
          continue;
        }
        this.updateUnit(dt, unit);
      }
      this.updateRoadblock(dt);
      this.updateBust(dt);
    },

    updateUnit(dt, unit) {
      const car = unit.car;
      const player = G.player;
      const pp = player.pos();
      const cp = car.group.position;
      unit.contactCool = Math.max(0, unit.contactCool - dt);
      // Lightbar strobe.
      if (car.lights) {
        const on = Math.sin(G.time * 9 + unit.phase) > 0;
        car.lights.red.visible = on;
        car.lights.blue.visible = !on;
      }
      const officer = unit.officer;
      const playerSlow = player.car ? Math.abs(player.car.speed) < 2 : player.speedNow < 1;
      const distToPlayer = Math.hypot(pp.x - cp.x, pp.z - cp.z);

      if (officer) {
        this.updateOfficer(dt, unit);
        car.speed = 0;
        return;
      }
      if (!officer && distToPlayer < 24 && Math.abs(car.speed) < 2 && (playerSlow || !player.car)) {
        this.setOfficerOut(unit, cp.x + 2, cp.z + 1);
        car.speed = 0;
        return;
      }
      // Drive at the player.
      const spec = CAR_CLASSES.police;
      const dx = pp.x - cp.x;
      const dz = pp.z - cp.z;
      const dist = Math.hypot(dx, dz);
      const desired = Math.atan2(dx, dz);
      const diff = wrapAngle(desired - car.heading);
      unit.reverseT = Math.max(0, unit.reverseT - dt);
      let want;
      if (unit.reverseT > 0) want = -9;
      else if (Math.abs(diff) > 2.3 && dist < 10) want = -8;
      else if (dist > 26) want = spec.max;
      else if (dist > 12) want = spec.max * 0.72;
      else if (dist > 5) want = spec.max * 0.42;
      else want = 1.5;
      const turn = unit.reverseT > 0 ? -diff : diff;
      car.heading += clamp(turn, -2.1 * dt, 2.1 * dt);
      car.speed += clamp(want - car.speed, -26 * dt, 15 * dt);
      cp.x += Math.sin(car.heading) * car.speed * dt;
      cp.z += Math.cos(car.heading) * car.speed * dt;
      for (const off of [1.3, -1.3]) {
        const cx = cp.x + Math.sin(car.heading) * off;
        const cz = cp.z + Math.cos(car.heading) * off;
        const before = { x: cx, z: cz };
        G.pushOut(before, 1.3);
        if (before.x !== cx || before.z !== cz) {
          cp.x += before.x - cx;
          cp.z += before.z - cz;
          car.speed *= 0.5;
        }
      }
      cp.x = clamp(cp.x, -210, 210);
      cp.z = clamp(cp.z, -210, 254);
      car.group.rotation.y = car.heading;
      const spin = (car.speed * dt) / 0.37;
      for (const w of car.wheels) w.rotation.x += spin;
      // Stuck? Reverse for a moment.
      if (Math.abs(car.speed) < 1 && want > 4) {
        unit.stuckT += dt;
        if (unit.stuckT > 1) {
          unit.reverseT = 0.8;
          unit.stuckT = 0;
        }
      } else unit.stuckT = 0;
      // Ramming the player's car.
      if (player.car && dist < 4.5 && unit.contactCool <= 0 && Math.abs(car.speed) > 4) {
        player.car.speed *= 0.5;
        car.speed *= 0.45;
        G.shake = Math.min(0.5, G.shake + 0.3);
        unit.contactCool = 0.9;
      }
      // Separation from other cruisers.
      for (const other of this.units) {
        if (other === unit || other.dead) continue;
        const op = other.car.group.position;
        const sx = cp.x - op.x;
        const sz = cp.z - op.z;
        const sd = Math.hypot(sx, sz);
        if (sd > 0.01 && sd < 4.4) {
          cp.x = op.x + (sx / sd) * 4.4;
          cp.z = op.z + (sz / sd) * 4.4;
        }
      }
    },

    updateOfficer(dt, unit) {
      const officer = unit.officer;
      const op = officer.group.position;
      const player = G.player;
      const pp = player.pos();
      const cp = unit.car.group.position;
      const distPlayer = Math.hypot(pp.x - op.x, pp.z - op.z);
      const distCar = Math.hypot(cp.x - op.x, cp.z - op.z);
      const shouldReturn = (player.car && Math.abs(player.car.speed) > 7) || distPlayer > 42;
      let tx;
      let tz;
      let speed = 6.3;
      if (shouldReturn || officer.state === 'return') {
        officer.state = 'return';
        tx = cp.x;
        tz = cp.z;
        speed = 6.8;
        if (distCar < 2.4) {
          officer.state = 'in';
          scene.remove(officer.group);
          unit.officer = null;
          return;
        }
      } else {
        tx = pp.x;
        tz = pp.z;
      }
      const dx = tx - op.x;
      const dz = tz - op.z;
      const d = Math.hypot(dx, dz) || 1;
      if (d > 0.4) {
        op.x += (dx / d) * speed * dt;
        op.z += (dz / d) * speed * dt;
        officer.group.rotation.y = Math.atan2(dx, dz);
      }
      G.pushOut(op, 0.5);
      op.y = Math.abs(Math.sin(G.time * 10)) * 0.05;
      // Shooting.
      if (officer.state === 'out' && distPlayer < 31) {
        officer.shootCool -= dt;
        if (officer.shootCool <= 0) {
          officer.shootCool = range(rng, 0.9, 1.5);
          G.combat.officerShoot(officer);
        }
      }
    },

    updateRoadblock(dt) {
      const player = G.player;
      if (this.roadblock) {
        const rb = this.roadblock;
        for (const car of rb.cars) {
          if (car.lights) {
            const on = Math.sin(G.time * 9 + car.phase) > 0;
            car.lights.red.visible = on;
            car.lights.blue.visible = !on;
          }
        }
        const d = Math.hypot(player.pos().x - rb.x, player.pos().z - rb.z);
        if (d > 95 || this.stars < 3) this.clearRoadblock();
        return;
      }
      if (this.stars < 3 || !player.car) return;
      this.rbTimer -= dt;
      if (this.rbTimer > 0) return;
      this.rbTimer = 14;
      const car = player.car;
      const f = { x: Math.sin(car.heading), z: Math.cos(car.heading) };
      const ax = car.group.position.x + f.x * 52;
      const az = car.group.position.z + f.z * 52;
      const cars = [];
      // Lay the pair across whichever road the player is on: an avenue (north-south)
      // if the ahead point is closer to one than to any east-west street.
      let nearestA = AVENUES[0];
      for (const a of AVENUES) if (Math.abs(a - ax) < Math.abs(nearestA - ax)) nearestA = a;
      let nearestStreet = AVENUES[0];
      for (const a of AVENUES) if (Math.abs(a - az) < Math.abs(nearestStreet - az)) nearestStreet = a;
      const streetDist = Math.min(Math.abs(nearestStreet - az), Math.abs(COAST_Z - az));
      if (Math.abs(nearestA - ax) <= streetDist) {
        for (const [off, tilt] of [[-2.4, 0.61], [2.4, -0.61]]) {
          const c = makeCar(0xffffff, { police: true, cls: 'police', kind: 'police' });
          c.police = true;
          c.group.position.set(nearestA + off, 0, az);
          c.heading = Math.PI / 2 + tilt;
          c.group.rotation.y = c.heading;
          scene.add(c.group);
          cars.push(c);
        }
        this.roadblock = { cars, x: nearestA, z: az };
      } else {
        let nearestS = nearestStreet;
        if (Math.abs(COAST_Z - az) < Math.abs(nearestS - az)) nearestS = COAST_Z;
        for (const [off, tilt] of [[-2.4, 0.61], [2.4, -0.61]]) {
          const c = makeCar(0xffffff, { police: true, cls: 'police', kind: 'police' });
          c.police = true;
          c.group.position.set(ax, 0, nearestS + off);
          c.heading = tilt;
          c.group.rotation.y = c.heading;
          scene.add(c.group);
          cars.push(c);
        }
        this.roadblock = { cars, x: ax, z: nearestS };
      }
      this.blockers = cars;
    },

    updateBust(dt) {
      if (this.stars === 0) {
        this.bustTimer = 0;
        return;
      }
      const player = G.player;
      const pp = player.pos();
      const playerSpeed = player.car ? Math.abs(player.car.speed) : player.speedNow;
      let near = false;
      if (playerSpeed < 1) {
        for (const unit of this.units) {
          if (unit.dead || !unit.officer || unit.officer.state !== 'out') continue;
          const op = unit.officer.group.position;
          const limit = player.car ? 3.4 : 2.3;
          if (Math.hypot(op.x - pp.x, op.z - pp.z) < limit) near = true;
        }
      }
      if (near) this.bustTimer += dt;
      else this.bustTimer = Math.max(0, this.bustTimer - 2 * dt);
      if (this.bustTimer > 1.2) {
        this.bustTimer = 0;
        G.onBusted();
      }
    },
  };

  return police;
}
