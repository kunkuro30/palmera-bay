// config.js — every tuning number for Palmera Bay in one place.

// The city grid: 6x6 blocks. Avenues and cross streets share the same
// coordinates; the coast road runs along the south edge at z = 192,
// then sand, then the sea.
export const CITY = {
  blockSize: 46,
  roadWidth: 14,
  pitch: 60,
  half: 180,
  coastZ: 192,
  beachDepth: 90,
  sandFrom: 186,
};

export const AVENUES = [-127, -67, -7, 53, 113, 173];

export const PLAYER = {
  walkSpeed: 5.4,
  runSpeed: 8.8,
  radius: 0.55,
  maxHealth: 100,
  regenDelay: 6,
  regenRate: 5,
  start: { x: 0, z: 196 },
};

export const CAR = {
  accel: 15,
  maxSpeed: 34,
  maxReverse: 9,
  brakeDecel: 30,
  grip: 7.5,
  radius: 1.35,
};

export const WANTED = {
  // heat (0..1) at which each star lights up
  thresholds: [0.02, 0.2, 0.38, 0.56, 0.74, 0.9],
  policePerStar: [0, 1, 2, 3, 4, 6],
  // heat lost per second while no unit can see the player, by star count:
  // paced so a full clear takes roughly 30/45/60/75/90 s of hiding
  decayByStar: [0, 0.006, 0.008, 0.009, 0.0096, 0.0109],
  buildWhenSeen: 0.02,
  bustedRange: 7.5,
  bustedSeconds: 2.6,
  spawnDistance: 55,
  despawnDistance: 175,
};

export const ECONOMY = {
  missionPay: [250, 450, 900],
  taxiPerMeter: 0.55,
  collectible: 75,
  hospitalFee: 100,
  jailFee: 150,
};

export const DAY = {
  startHour: 17.4,
  minutesPerSecond: 0.5,
};
