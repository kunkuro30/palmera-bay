// config.js — every shared tuning constant for Palmera Bay lives here, so the
// other modules never hard-code a number another module also needs.

export const CITY = {
  blocksPerSide: 6,        // 6 x 6 city blocks
  blockSize: 46,           // metres of building frontage per block
  roadWidth: 14,           // metres of asphalt between blocks
  get pitch() { return this.blockSize + this.roadWidth; },
  get half() { return (this.blocksPerSide * this.pitch) / 2; }, // city spans -half..+half
  beachDepth: 90,          // sand strip south of the grid (z > half)
  waterDepth: 260,         // sea beyond the sand
};

export const PLAYER = {
  walkSpeed: 5.2,
  runSpeed: 9.0,
  radius: 0.55,
  maxHealth: 100,
  punchDamage: 16,
  punchRange: 1.9,
};

export const CAR = {
  accel: 26,
  brake: 42,
  reverseAccel: 14,
  maxSpeed: 39,            // m/s, ~140 km/h
  maxReverse: 11,
  turnRate: 1.55,          // rad/s at full lock, scaled by speed
  grip: 6.5,               // lateral velocity damping
  radius: 1.35,
};

export const WANTED = {
  decayPerSecond: 0.011,   // heat cools slowly when unseen
  seenBuildPerSecond: 0.05,
  stars: [0, 0.14, 0.32, 0.52, 0.74, 0.97], // heat thresholds for 0..5 stars
  policePerStar: [0, 1, 2, 3, 4, 6],
  bustedSeconds: 2.6,      // time boxed in at low speed before BUSTED
};

export const ECONOMY = {
  missionPay: [250, 450, 900],
  taxiPayPerMeter: 0.55,
  collectiblePay: 75,
  hospitalFee: 100,
  jailFee: 150,
};

export const DAY = {
  startHour: 17.6,         // golden hour: the whole game lives at sunset
  hoursPerSecond: 0.004,   // a full day in ~100 minutes of play
};
