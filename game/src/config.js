// Every tuning number for Palmera Bay in one place: the street grid, the car classes,
// the places the story visits. Nothing below depends on the screen size.

// The city grid: six avenues each way, 60 m apart, roads 14 m wide. Buildings sit in the
// blocks between roads; the coast road runs along the south edge above the beach.
export const AVENUES = [-127, -67, -7, 53, 113, 173];
export const BLOCK_CENTERS = [-157, -97, -37, 23, 83, 143];
export const ROAD_HALF = 7;
export const WORLD_EXTENT = 210;
export const COAST_Z = 192;
export const BEACH_Z = 200;
export const SEA_Z = 258;

export const CAR_CLASSES = {
  sedan: { accel: 14, max: 26, grip: 2.6 },
  coupe: { accel: 18, max: 33, grip: 2.9 },
  sport: { accel: 24, max: 42, grip: 3.2 },
  police: { accel: 20, max: 36, grip: 3.1 },
};
export const REVERSE_MAX = 8;
export const STEER_MAX = 0.55;

export const PLAYER = { walk: 5, sprint: 8.5, radius: 0.7, maxHp: 100, regenCap: 50 };

export const TRAFFIC_COUNT = 14;
export const PARKED_COUNT = 22;
export const PED_COUNT = 26;

// Heat is 0..500; stars = ceil(heat / 100). Seconds of staying unseen that clear each star.
export const HEAT_MAX = 500;
export const CLEAR_SECONDS = [0, 30, 45, 60, 75, 90];
export const CRIME_HEAT = { theft: 60, hitRun: 80, shot: 50, hitCop: 120 };

export const SAVE_KEY = 'palmera-bay-save-v1';
export const START_CASH = 120;

export const HOSPITAL = { x: 0, z: 120 };
export const MARINA = { x: 60, z: 150 };
export const LOCKUP = { x: -150, z: 60 };
export const WAREHOUSE = { x: -60, z: 176 };
export const HEIST_CASE = { x: -60, z: 186 };
export const MISSION2_CAR = { x: 1.5, z: -24 };

// Eight golden briefcases hidden at scenic spots: beaches, the park, overlooks, alleys.
export const CASE_SPOTS = [
  { x: 150, z: 225 }, { x: -170, z: 230 }, { x: 60, z: 205 }, { x: 30, z: 30 },
  { x: -100, z: 186 }, { x: 143, z: -157 }, { x: 186, z: 186 }, { x: -170, z: -170 },
];

// Points that must stay clear of randomly placed buildings (spawns, lots, landmarks).
export const KEEP_CLEAR = [
  HOSPITAL, MARINA, LOCKUP, WAREHOUSE, HEIST_CASE, MISSION2_CAR,
  { x: 52, z: 158 }, { x: 2.8, z: 30 }, { x: -10, z: 30 },
  ...CASE_SPOTS,
];

export const PALETTE = {
  sky: 0x2e3d66, horizon: 0xff9e5e, fog: 0xf2a56e,
  sun: 0xffb36b, sea: 0x1e7f86, sand: 0xe8cf9f,
};
