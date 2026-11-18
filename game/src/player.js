// player.js — the courier: on-foot movement, health and recovery.
// Cars are handled by vehicles.js; when the player drives, main.js parks
// this figure in the driver's seat (mesh hidden) and moves the car instead.

import { PLAYER } from './config.js';
import { makeFigure, swingLimbs } from './pedestrians.js';

export function createPlayer(scene) {
  const fig = makeFigure(0xe86a1e, 0x24303c, 0xa06a42);
  scene.add(fig.group);

  const player = {
    fig,
    mesh: fig.group,
    pos: fig.group.position,
    heading: Math.PI,
    health: PLAYER.maxHealth,
    time: 0,
    lastHurtAt: -99,
    speedNow: 0,
    phase: 0,
    driving: null,

    hurt(amount) {
      this.health = Math.max(0, this.health - amount);
      this.lastHurtAt = this.time;
    },

    healFull() {
      this.health = PLAYER.maxHealth;
    },

    reset(x, z) {
      this.pos.set(x, 0, z);
      this.health = PLAYER.maxHealth;
      this.driving = null;
      this.mesh.visible = true;
    },

    // move is a world-space direction (already normalised by the caller, or zero)
    updateOnFoot(dt, move, sprint, world) {
      this.time += dt;
      const speed = sprint ? PLAYER.runSpeed : PLAYER.walkSpeed;
      const moving = move.x !== 0 || move.z !== 0;
      this.speedNow = moving ? speed : 0;
      if (moving) {
        this.pos.x += move.x * speed * dt;
        this.pos.z += move.z * speed * dt;
        this.pos.x = Math.max(-262, Math.min(262, this.pos.x));
        this.pos.z = Math.max(-190, Math.min(300, this.pos.z));
        world.collideCircle(this.pos, PLAYER.radius);
        const want = Math.atan2(move.x, move.z);
        let d = want - this.heading;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        this.heading += d * Math.min(1, dt * 11);
        this.phase += dt * speed * 1.9;
        swingLimbs(this.fig, this.phase, sprint ? 0.8 : 0.55);
      } else {
        swingLimbs(this.fig, 0, 0);
      }
      this.mesh.rotation.y = this.heading;
      // the bay only patches you up halfway: past 50% the damage stays
      // until a job well done (or a hospital) makes it right
      const regenCap = PLAYER.maxHealth * 0.5;
      if (this.time - this.lastHurtAt > PLAYER.regenDelay && this.health > 0 && this.health < regenCap) {
        this.health = Math.min(regenCap, this.health + PLAYER.regenRate * dt);
      }
    },
  };

  player.pos.set(PLAYER.start.x, 0, PLAYER.start.z);
  player.mesh.rotation.y = player.heading;
  return player;
}
