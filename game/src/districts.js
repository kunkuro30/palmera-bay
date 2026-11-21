// GO RIO RIO · districts.js — named districts and street-name lookup by position.
// Districts of Palmera Bay (build 12): the named areas the pause map
// labels, the HUD caption reads and the location title cards announce.
// Tests run in order — first match wins. Street names reuse the roads
// the world already signs (Ocean Drive, Palm Ave) plus the coast loop
// and the north freeway the minimap already draws.

import { WORLD, highwayLoopPoints, FREEWAY_PTS } from './config.js';

export const DISTRICTS = [
  {
    id: 'airport', name: 'BAY AIRPORT',
    test: (x, z) => x >= WORLD.airport.x0 - 6 && x <= WORLD.airport.x1 + 6 && z >= WORLD.airport.z0 - 6 && z <= WORLD.airport.z1 + 6,
    label: { x: -190, z: 118 },
  },
  {
    id: 'garrison', name: 'PALMERA GARRISON',
    test: (x, z) => x >= 98 && x <= 190 && z >= -74 && z <= -2,
    label: { x: 143, z: -38 },
  },
  {
    id: 'heights', name: 'PALMERA HEIGHTS',
    test: (x, z) => x >= 163 && x <= 214 && z >= 12 && z <= 94,
    label: { x: 187, z: 50 },
  },
  {
    id: 'ocean', name: 'OCEAN DRIVE',
    test: (x, z) => z >= 146 && x >= -178 && x <= 168,
    label: { x: -8, z: 176 },
  },
  {
    id: 'downtown', name: 'DOWNTOWN',
    test: (x, z) => x >= WORLD.city.x0 && x <= WORLD.city.x1 && z >= WORLD.city.z0 && z <= 146,
    label: { x: -26, z: 72 },
  },
  {
    id: 'north', name: 'THE NORTH HILLS',
    test: (x, z) => z < -2,
    label: { x: -56, z: -126 },
  },
];

export function districtAt(x, z) {
  for (const d of DISTRICTS) if (d.test(x, z)) return d;
  return null;
}

function segDist(px, pz, a, b) {
  const vx = b.x - a.x, vz = b.z - a.z;
  const len2 = vx * vx + vz * vz || 1;
  const t = Math.max(0, Math.min(1, ((px - a.x) * vx + (pz - a.z) * vz) / len2));
  return Math.hypot(px - (a.x + vx * t), pz - (a.z + vz * t));
}

function pathDist(x, z, pts, closed) {
  let m = Infinity;
  const n = closed ? pts.length : pts.length - 1;
  for (let i = 0; i < n; i++) {
    const d = segDist(x, z, pts[i], pts[(i + 1) % pts.length]);
    if (d < m) m = d;
  }
  return m;
}

let loopPts = null;

// The street or road the player is on / beside, for the HUD caption.
export function streetAt(x, z) {
  const d = districtAt(x, z);
  if (d && d.id === 'ocean') return 'Ocean Drive';
  if (Math.abs(z - WORLD.oceanDrive) <= 10 && x >= -176 && x <= 166) return 'Ocean Drive';
  if (Math.abs(x + 50) <= 9 && z >= 16 && z <= 196) return 'Palm Ave';
  if (d && d.id === 'heights') return 'Heights Row';
  if (d && d.id === 'airport') return 'Airport Apron';
  if (d && d.id === 'garrison') return 'Garrison Grounds';
  if (x > WORLD.park.x0 - 4 && x < WORLD.park.x1 + 4 && z > WORLD.park.z0 - 4 && z < WORLD.park.z1 + 4) return 'Park Path';
  if (pathDist(x, z, FREEWAY_PTS, false) < 13) return 'North Freeway';
  if (!loopPts) loopPts = highwayLoopPoints();
  if (pathDist(x, z, loopPts, true) < 13) return 'Coast Road';
  return '';
}
