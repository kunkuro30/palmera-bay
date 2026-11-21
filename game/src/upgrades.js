// GO RIO RIO · upgrades.js — the Palmera Motors garage upgrades for Rio's Comet.
// BUILD 15 — the Palmera Motors garage, for Rio's Comet only: three
// engine levels (top speed + acceleration), three armour levels
// (wrecks.js shaves the damage the Comet takes), and a one-time nitro
// kit — SHIFT while driving spends the gauge on boost, an exhaust
// flame and an FOV kick (player.js drives it; the flame and its light
// are built here). Everything persists in the save and is re-applied
// to the car at boot by applyUpgrades. The offers themselves ride the
// sidejobs prompt pill at the Motors forecourt.

import { groundHeight } from './config.js';

const THREE = window.THREE;

export const ENGINE_PRICES = [600, 1200, 2400];
export const ARMOR_PRICES = [500, 1000, 2000];
export const NITRO_PRICE = 1500;

function buildNitroFx(car) {
  const rear = (car.dims ? car.dims.length : 4.7) / 2;
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.17, 1.0, 10),
    new THREE.MeshBasicMaterial({ color: 0xff9a3c, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
  flame.rotation.x = -Math.PI / 2;   // tip points backwards, out of the exhaust
  flame.position.set(0.45, 0.42, -rear - 0.35);
  flame.visible = false;
  car.group.add(flame);
  const light = new THREE.PointLight(0xff8a3c, 0, 10);
  light.position.set(0.45, 0.5, -rear - 0.6);
  car.group.add(light);
  car.nitroFlame = flame;
  car.nitroLight = light;
}

// (Re)apply the saved upgrade levels to the Comet: engine → top speed
// and acceleration (driveStep reads maxF / accelMul), nitro → the
// flame kit exists. Armour needs no car fields — wrecks.js reads the
// save level at damage time.
export function applyUpgrades(G) {
  const comet = G.comet;
  if (!comet) return;
  const e = G.save.upgEngine || 0;
  comet.maxF = 24 + e * 4;
  comet.accelMul = 1 + e * 0.18;
  if ((G.save.upgNitro || 0) > 0 && !comet.nitroFlame) buildNitroFx(comet);
  if (comet.nitroGauge === undefined) comet.nitroGauge = 1;
}

// The garage sells one thing at a time, Arms-rack style: the next
// engine level, then the next armour level, then the nitro kit.
export function nextUpgrade(G) {
  const e = G.save.upgEngine || 0;
  if (e < 3) return { kind: 'engine', level: e + 1, price: ENGINE_PRICES[e] };
  const a = G.save.upgArmor || 0;
  if (a < 3) return { kind: 'armor', level: a + 1, price: ARMOR_PRICES[a] };
  if (!(G.save.upgNitro || 0)) return { kind: 'nitro', level: 1, price: NITRO_PRICE };
  return null;
}

export function buyUpgrade(G, kind) {
  const up = nextUpgrade(G);
  if (!up || up.kind !== kind) return 'none';
  if (G.save.cash < up.price) return 'cash';
  G.save.cash -= up.price;
  if (kind === 'engine') G.save.upgEngine = up.level;
  else if (kind === 'armor') G.save.upgArmor = up.level;
  else G.save.upgNitro = 1;
  G.persist();
  applyUpgrades(G);
  return 'ok';
}

// The Comet's marked pad at Palmera Heights: an orange ring on the
// driveway and a little post sign, so the car Rio owns reads as HIS
// from down the street.
export function buildCometPad(scene, x, z) {
  const g = new THREE.Group();
  const gy = groundHeight(x, z);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(3.1, 0.22, 8, 28),
    new THREE.MeshLambertMaterial({ color: 0xfb8b24, emissive: 0x5a2c00, flatShading: true }));
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.16;
  g.add(ring);
  const post = new THREE.Mesh(new THREE.BoxGeometry(0.09, 1.1, 0.09),
    new THREE.MeshLambertMaterial({ color: 0x33373d, flatShading: true }));
  post.position.set(2.9, 0.55, -2.6);
  post.castShadow = true;
  g.add(post);
  const c = document.createElement('canvas');
  c.width = 256; c.height = 64;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#123a5c';
  ctx.fillRect(0, 0, 256, 64);
  ctx.fillStyle = '#ffd23e';
  ctx.font = '900 38px Trebuchet MS, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('★ COMET', 128, 34);
  const tex = new THREE.CanvasTexture(c);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 0.48),
    new THREE.MeshBasicMaterial({ map: tex, transparent: false }));
  sign.position.set(2.9, 1.25, -2.6);
  sign.rotation.y = Math.PI / 2;
  g.add(sign);
  g.position.set(x, gy, z);
  scene.add(g);
  return g;
}
