// player.js — the courier himself: a two-box figure with a swinging walk,
// moved on foot by the camera-relative WASD controls, with health and a slow
// recovery when nobody is hurting him.

import { PLAYER } from './config.js';
import { makePedMesh } from './pedestrians.js';
import { collideCircle } from './world.js';

export function createPlayer(scene) {
  const mesh = makePedMesh(0xff8c1a); // the orange shirt: that is our courier
  mesh.position.set(0, 0, 196);       // starts on the coast road, facing the city
  scene.add(mesh);
  const player = {
    mesh, health: PLAYER.maxHealth, heading: Math.PI, // facing north, into town
    speedNow: 0, hurtTimer: 0, walkPhase: 0, driving: null,
    get pos() { return mesh.position; },
  };

  // move: {x, z} normalised wish direction in world space; run: bool
  player.updateOnFoot = (dt, move, run, world) => {
    const speed = run ? PLAYER.runSpeed : PLAYER.walkSpeed;
    const moving = Math.hypot(move.x, move.z) > 0.05;
    player.speedNow = moving ? speed : 0;
    if (moving) {
      const len = Math.hypot(move.x, move.z);
      player.pos.x += (move.x / len) * speed * dt;
      player.pos.z += (move.z / len) * speed * dt;
      const target = Math.atan2(move.x, move.z);
      let dh = target - player.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      player.heading += dh * Math.min(1, dt * 12);
      player.walkPhase += dt * (run ? 11 : 8);
    }
    collideCircle(world, player.pos, PLAYER.radius);
    mesh.rotation.y = player.heading;
    const swing = moving ? Math.sin(player.walkPhase) * 0.3 : 0;
    mesh.userData.legs.rotation.x = swing;
    mesh.userData.torso.rotation.x = -swing * 0.45;
    mesh.position.y = moving ? Math.abs(Math.sin(player.walkPhase)) * 0.06 : 0;
    // slow recovery once the coast has been clear for a while
    player.hurtTimer -= dt;
    if (player.hurtTimer <= 0 && player.health > 0 && player.health < PLAYER.maxHealth) {
      player.health = Math.min(PLAYER.maxHealth, player.health + dt * 3.2);
    }
  };

  player.hurt = (amount) => {
    player.health -= amount;
    player.hurtTimer = 6;
    return player.health <= 0;
  };
  player.heal = () => { player.health = PLAYER.maxHealth; };
  return player;
}
