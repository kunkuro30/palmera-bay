// Palmera Fleet — the user-supplied fleet module (13 vehicle types),
// converted to the game's module pattern (global THREE from the vendored
// three.min.js, Lambert-style helpers kept local) and integrated in
// build 6. Types: 3 aircraft (csa_prop, boeing_twinjet, private_jet),
// police_car, civil_sedan, 4 fire trucks (fire_pumper, fire_ladder,
// fire_rescue, fire_arff), ambulance, 3 motorcycles (moto_sport,
// moto_cruiser, moto_enduro).
//
// SCALE (build 8): the reference human is the real-proportioned 1.78
// figure, and the two car types are REBUILT in the house smooth design
// language (see vehicles.js) directly at real size — sedan standard
// 4.70 long / 1.85 wide / roof 1.48, figure/roof 1.20. No scaling pass.
// Fire trucks, the ambulance, aircraft and motorcycles keep the
// module's own proportions: their relative advantage over the cars
// (trucks taller, figure/roof < 1.0) is part of the design.
//
// METADATA: the drivable types (police_car, civil_sedan) return the same
// placement contract as vehicles.makeCar — seat socket, frame boxes and
// dims in WORLD units — plus wheels/lights/brakeMat so driveStep,
// spinWheels, the police light-bar flash and the traffic brake flare all
// work on them unchanged.
//
// BUILD 9: the design language now covers the WHOLE fleet — the
// ambulance, fire trucks, aircraft and motorcycles got the same glass
// (0x18242e, roughness 0.08, metalness 0.55) and smooth/rounded surface
// treatment as the cars. Surface pass only: no dims, seat/frame
// metadata, animation wiring, placements or colliders changed.

const THREE = window.THREE;

export const FLEET_TYPES = [
  'csa_prop', 'boeing_twinjet', 'private_jet',
  'police_car', 'civil_sedan',
  'fire_pumper', 'fire_ladder', 'fire_rescue', 'fire_arff',
  'ambulance',
  'moto_sport', 'moto_cruiser', 'moto_enduro',
];

function mat(color, opts = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: opts.roughness ?? 0.45,
    metalness: opts.metalness ?? 0.2,
    emissive: opts.emissive ?? 0x000000,
    emissiveIntensity: opts.emissiveIntensity ?? 0,
    // BUILD 16: lean on the PMREM sky environment — glass (the shared
    // dark blue-black) reflects hardest, everything else gets a mild lift.
    envMapIntensity: opts.envMapIntensity ?? (color === 0x18242e ? 1.6 : 1.1),
  });
}

function addPart(parent, geo, material, pos = [0, 0, 0], rot = [0, 0, 0], scale = [1, 1, 1], name = '') {
  const mesh = new THREE.Mesh(geo, material);
  mesh.position.set(pos[0], pos[1], pos[2]);
  mesh.rotation.set(rot[0], rot[1], rot[2]);
  mesh.scale.set(scale[0], scale[1], scale[2]);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  if (name) mesh.name = name;
  parent.add(mesh);
  return mesh;
}

function createWheel(radius = 0.42, width = 0.28, tireColor = 0x18181b, rimColor = 0xcbd5e1) {
  const wheelGroup = new THREE.Group();
  const tireGeo = new THREE.CylinderGeometry(radius, radius, width, 20);
  tireGeo.rotateZ(Math.PI / 2);
  addPart(wheelGroup, tireGeo, mat(tireColor, { roughness: 0.85, metalness: 0.05 }));

  const rimGeo = new THREE.CylinderGeometry(radius * 0.58, radius * 0.58, width * 1.04, 14);
  rimGeo.rotateZ(Math.PI / 2);
  addPart(wheelGroup, rimGeo, mat(rimColor, { roughness: 0.3, metalness: 0.8 }));
  return wheelGroup;
}

// BUILD 8: the house smooth sedan, shared by police_car and
// civil_sedan — one capsule body loaf, glass canopy, painted roof
// panel, arch discs and sphere lights, exactly the design language of
// vehicles.js (real size: 4.70 × 1.85, roof 1.48). `livery` adds the
// police kit: white roof, light bar (strobes registered in `anim`),
// bull bar. Returns the frame boxes for the metadata contract.
function smoothSedan(root, anim, bodyColor, livery) {
  const paint = mat(bodyColor, { roughness: 0.27, metalness: 0.25, envMapIntensity: 1.35 });
  const glass = mat(0x18242e, { roughness: 0.08, metalness: 0.55 });
  const dark = mat(0x23252b, { roughness: 0.75, metalness: 0.05 });
  const tail = mat(0xff2d2d, { emissive: 0x5c0606, emissiveIntensity: 1, roughness: 0.4 });
  const head = mat(0xfff6c9, { emissive: 0x776a20, roughness: 0.4 });

  const bodyGeo = new THREE.CapsuleGeometry(0.78, 3.14, 8, 20);
  bodyGeo.rotateX(Math.PI / 2);
  addPart(root, bodyGeo, paint, [0, 0.60, 0], [0, 0, 0], [1.186, 0.50, 1]);
  const valGeo = new THREE.CapsuleGeometry(0.78, 3.14, 8, 20);
  valGeo.rotateX(Math.PI / 2);
  addPart(root, valGeo, dark, [0, 0.452, 0], [0, 0, 0], [1.192, 0.31, 1.002]);
  addPart(root, new THREE.SphereGeometry(1, 20, 14), glass, [0, 1.06, -0.25], [0, 0, 0], [0.72, 0.40, 1.05]);
  const roofMat = livery ? mat(0xf8fafc, { roughness: 0.3, metalness: 0.3 }) : paint;
  addPart(root, new THREE.SphereGeometry(1, 20, 14), roofMat, [0, 1.26, -0.25], [0, 0, 0], [0.76, 0.22, 1.09]);
  addPart(root, new THREE.SphereGeometry(0.14, 14, 10), paint, [-0.94, 1.01, 0.55], [0, 0, 0], [0.55, 0.38, 0.85]);
  addPart(root, new THREE.SphereGeometry(0.14, 14, 10), paint, [0.94, 1.01, 0.55], [0, 0, 0], [0.55, 0.38, 0.85]);
  addPart(root, new THREE.SphereGeometry(0.07, 12, 10), head, [-0.55, 0.66, 2.02]);
  addPart(root, new THREE.SphereGeometry(0.07, 12, 10), head, [0.55, 0.66, 2.02]);
  addPart(root, new THREE.SphereGeometry(0.065, 12, 10), tail, [-0.55, 0.70, -2.02]);
  addPart(root, new THREE.SphereGeometry(0.065, 12, 10), tail, [0.55, 0.70, -2.02]);

  const archGeo = new THREE.CylinderGeometry(0.435, 0.435, 0.05, 18);
  archGeo.rotateZ(Math.PI / 2);
  [[-0.80, 1.45], [0.80, 1.45], [-0.80, -1.45], [0.80, -1.45]].forEach(([x, z]) => {
    addPart(root, archGeo, dark, [x * 0.94, 0.34, z]);
    const w = createWheel(0.34, 0.24);
    w.position.set(x, 0.34, z);
    root.add(w);
    anim.wheels.push(w);
  });

  const frames = [
    { name: 'cabin glass', x: [-0.74, 0.74], y: [0.92, 1.44], z: [-1.32, 0.82] },
    { name: 'roof', x: [-0.78, 0.78], y: [1.38, 1.50], z: [-1.36, 0.86] },
  ];
  let lights = null;
  if (livery) {
    const redStrobo = mat(0xef4444, { emissive: 0xef4444, emissiveIntensity: 1.4 });
    const blueStrobo = mat(0x3b82f6, { emissive: 0x3b82f6, emissiveIntensity: 1.4 });
    addPart(root, new THREE.BoxGeometry(0.95, 0.07, 0.32), dark, [0, 1.50, -0.20]);
    const rLight = addPart(root, new THREE.BoxGeometry(0.42, 0.13, 0.26), redStrobo, [-0.24, 1.60, -0.20]);
    const bLight = addPart(root, new THREE.BoxGeometry(0.42, 0.13, 0.26), blueStrobo, [0.24, 1.60, -0.20]);
    anim.strobos.push(rLight, bLight);
    lights = { red: rLight, blue: bLight };
    const barMat = mat(0x94a3b8, { metalness: 0.85, roughness: 0.3 });
    addPart(root, new THREE.BoxGeometry(1.30, 0.30, 0.10), barMat, [0, 0.52, 2.32]);
    addPart(root, new THREE.BoxGeometry(0.09, 0.42, 0.09), barMat, [-0.45, 0.45, 2.28]);
    addPart(root, new THREE.BoxGeometry(0.09, 0.42, 0.09), barMat, [0.45, 0.45, 2.28]);
    frames.push({ name: 'light bar', x: [-0.48, 0.48], y: [1.47, 1.67], z: [-0.36, -0.04] });
    frames.push({ name: 'bull bar', x: [-0.65, 0.65], y: [0.37, 0.67], z: [2.26, 2.38] });
  }
  return { frames, lights, brakeMat: tail };
}

export function buildFleetVehicle(type, opts = {}) {
  const root = new THREE.Group();
  root.userData.type = type;
  root.userData.animated = {
    propellers: [],
    turbines: [],
    wheels: [],
    strobos: [],
    ladderPivot: null,
    boomPivot: null,
    turretPivot: null,
  };
  const anim = root.userData.animated;
  let meta = null;   // drivable-car placement contract (police_car / civil_sedan)

  switch (type) {
    // 1A. CSA (Single-Engine High-Wing Propeller)
    case 'csa_prop': {
      const fuselageMat = mat(0xf8fafc, { roughness: 0.35, metalness: 0.35 });
      const stripeMat = mat(0x0284c7, { roughness: 0.4 });
      const glassMat = mat(0x18242e, { roughness: 0.08, metalness: 0.55 });

      const bodyGeo = new THREE.CylinderGeometry(0.72, 0.58, 6.8, 18);
      bodyGeo.rotateX(Math.PI / 2);
      addPart(root, bodyGeo, fuselageMat, [0, 1.35, 0]);
      addPart(root, new THREE.BoxGeometry(1.46, 0.22, 6.4), stripeMat, [0, 1.35, 0]);

      // BUILD 9: the glass cabin is a rounded canopy now — one squashed
      // sphere in the house glass, tucked just under the high wing,
      // replacing the old glass slab.
      addPart(root, new THREE.SphereGeometry(1, 20, 14), glassMat, [0, 1.76, 0.55], [0, 0, 0], [0.58, 0.22, 0.85]);
      addPart(root, new THREE.BoxGeometry(10.6, 0.16, 1.65), fuselageMat, [0, 2.08, 0.35]);
      addPart(root, new THREE.BoxGeometry(10.6, 0.06, 1.68), stripeMat, [0, 2.17, 0.35]);

      addPart(root, new THREE.BoxGeometry(0.14, 1.85, 1.25), stripeMat, [0, 2.15, -3.05], [-0.22, 0, 0]);
      addPart(root, new THREE.BoxGeometry(3.4, 0.12, 0.95), fuselageMat, [0, 1.45, -3.15]);

      const propHub = new THREE.Group();
      propHub.position.set(0, 1.35, 3.55);
      addPart(propHub, new THREE.ConeGeometry(0.26, 0.65, 14), mat(0x1e293b, { metalness: 0.7 }), [0, 0, 0.2], [Math.PI / 2, 0, 0]);
      addPart(propHub, new THREE.BoxGeometry(2.5, 0.22, 0.06), mat(0x0f172a, { roughness: 0.5 }), [0, 0, 0.05]);
      root.add(propHub);
      anim.propellers.push(propHub);

      const wFront = createWheel(0.32, 0.18);
      wFront.position.set(0, 0.32, 2.1);
      const wLeft = createWheel(0.38, 0.2);
      wLeft.position.set(-1.35, 0.38, 0.2);
      const wRight = createWheel(0.38, 0.2);
      wRight.position.set(1.35, 0.38, 0.2);
      root.add(wFront, wLeft, wRight);
      anim.wheels.push(wFront, wLeft, wRight);
      meta = { dims: { length: 7.7, width: 10.6, roofY: null, rimY: null, topY: 3.1 } };
      break;
    }

    // 1B. BOEING (Commercial Twinjet)
    case 'boeing_twinjet': {
      const hullMat = mat(0xf1f5f9, { roughness: 0.3, metalness: 0.4 });
      const liveryMat = mat(0x1d4ed8, { roughness: 0.35, metalness: 0.3 });
      const engineMat = mat(0x334155, { roughness: 0.35, metalness: 0.75 });

      const fuseGeo = new THREE.CylinderGeometry(1.65, 1.65, 15.5, 24);
      fuseGeo.rotateX(Math.PI / 2);
      addPart(root, fuseGeo, hullMat, [0, 2.6, 0]);
      addPart(root, new THREE.SphereGeometry(1.65, 24, 16), hullMat, [0, 2.6, 7.75], [0, 0, 0], [1, 1, 1.35]);
      addPart(root, new THREE.CylinderGeometry(1.65, 0.55, 4.2, 20).rotateX(-Math.PI / 2), hullMat, [0, 2.75, -9.8]);
      addPart(root, new THREE.BoxGeometry(3.34, 0.35, 14.5), liveryMat, [0, 2.35, 0.4]);

      // BUILD 9: glass — a passenger window strip hugging the tube
      // (panes at y 3.15, 0.55 above the centreline, tilted to the
      // tube's tangent) and cockpit panes wrapped on the nose sphere.
      const glassMat = mat(0x18242e, { roughness: 0.08, metalness: 0.55 });
      const winGeo = new THREE.BoxGeometry(0.05, 0.34, 0.52);
      for (let i = 0; i < 15; i++) {
        const wz = 5.6 - i * 0.85;
        addPart(root, winGeo, glassMat, [-1.545, 3.15, wz], [0, 0, -0.34]);
        addPart(root, winGeo, glassMat, [1.545, 3.15, wz], [0, 0, 0.34]);
      }
      addPart(root, new THREE.BoxGeometry(0.58, 0.40, 0.06), glassMat, [-0.45, 3.27, 9.58], [0.45, 0.30, 0]);
      addPart(root, new THREE.BoxGeometry(0.58, 0.40, 0.06), glassMat, [0.45, 3.27, 9.58], [0.45, -0.30, 0]);
      addPart(root, new THREE.BoxGeometry(0.52, 0.36, 0.06), glassMat, [-1.27, 3.18, 8.76], [0.35, -0.85, 0]);
      addPart(root, new THREE.BoxGeometry(0.52, 0.36, 0.06), glassMat, [1.27, 3.18, 8.76], [0.35, 0.85, 0]);

      addPart(root, new THREE.BoxGeometry(11.5, 0.28, 3.2), hullMat, [-6.2, 2.25, -0.4], [0, 0.32, -0.04]);
      addPart(root, new THREE.BoxGeometry(11.5, 0.28, 3.2), hullMat, [6.2, 2.25, -0.4], [0, -0.32, 0.04]);

      [-4.6, 4.6].forEach((xPos) => {
        const nac = new THREE.Group();
        nac.position.set(xPos, 1.55, 0.35);
        const podGeo = new THREE.CylinderGeometry(0.72, 0.68, 2.3, 18);
        podGeo.rotateX(Math.PI / 2);
        addPart(nac, podGeo, engineMat);
        const fan = addPart(nac, new THREE.BoxGeometry(1.15, 0.14, 0.12), mat(0xe2e8f0, { metalness: 0.9 }), [0, 0, 1.05]);
        root.add(nac);
        anim.turbines.push(fan);
      });

      addPart(root, new THREE.BoxGeometry(0.35, 4.4, 2.8), liveryMat, [0, 5.1, -9.4], [-0.42, 0, 0]);
      addPart(root, new THREE.BoxGeometry(7.6, 0.22, 1.8), hullMat, [0, 3.2, -10.2], [0, 0, 0]);

      const noseW = createWheel(0.55, 0.32);
      noseW.position.set(0, 0.55, 5.6);
      const mlW = createWheel(0.68, 0.38);
      mlW.position.set(-2.4, 0.68, -0.8);
      const mrW = createWheel(0.68, 0.38);
      mrW.position.set(2.4, 0.68, -0.8);
      root.add(noseW, mlW, mrW);
      anim.wheels.push(noseW, mlW, mrW);
      meta = { dims: { length: 21.9, width: 23.3, roofY: null, rimY: null, topY: 7.3 } };
      break;
    }

    // 1C. PRIVATE JET (Executive Jet)
    case 'private_jet': {
      const whiteMat = mat(0xffffff, { roughness: 0.2, metalness: 0.45 });
      const goldMat = mat(0xf59e0b, { roughness: 0.3, metalness: 0.7 });
      const darkMat = mat(0x1e293b, { roughness: 0.25, metalness: 0.7 });

      const bodyGeo = new THREE.CylinderGeometry(0.95, 0.9, 10.2, 20);
      bodyGeo.rotateX(Math.PI / 2);
      addPart(root, bodyGeo, whiteMat, [0, 1.65, 0]);
      addPart(root, new THREE.SphereGeometry(0.95, 20, 14), whiteMat, [0, 1.65, 5.1], [0, 0, 0], [1, 1, 1.45]);
      addPart(root, new THREE.CylinderGeometry(0.9, 0.35, 3.2, 16).rotateX(-Math.PI / 2), whiteMat, [0, 1.85, -6.6]);
      addPart(root, new THREE.BoxGeometry(1.94, 0.14, 9.6), goldMat, [0, 1.55, 0.2]);

      // BUILD 9: glass — a cabin window strip hugging the tube (panes
      // at y 1.95, tilted to the tangent) and cockpit panes wrapped on
      // the nose sphere.
      const glassMat = mat(0x18242e, { roughness: 0.08, metalness: 0.55 });
      const winGeo = new THREE.BoxGeometry(0.05, 0.26, 0.44);
      for (let i = 0; i < 9; i++) {
        const wz = 3.4 - i * 0.82;
        addPart(root, winGeo, glassMat, [-0.875, 1.95, wz], [0, 0, -0.32]);
        addPart(root, winGeo, glassMat, [0.875, 1.95, wz], [0, 0, 0.32]);
      }
      addPart(root, new THREE.BoxGeometry(0.44, 0.30, 0.05), glassMat, [-0.27, 1.95, 6.26], [0.48, 0.30, 0]);
      addPart(root, new THREE.BoxGeometry(0.44, 0.30, 0.05), glassMat, [0.27, 1.95, 6.26], [0.48, -0.30, 0]);

      addPart(root, new THREE.BoxGeometry(6.8, 0.18, 1.75), whiteMat, [-3.8, 1.45, 0.3], [0, 0.38, -0.05]);
      addPart(root, new THREE.BoxGeometry(6.8, 0.18, 1.75), whiteMat, [3.8, 1.45, 0.3], [0, -0.38, 0.05]);

      [-1.25, 1.25].forEach((xPos) => {
        const engGeo = new THREE.CylinderGeometry(0.42, 0.4, 1.85, 16);
        engGeo.rotateX(Math.PI / 2);
        addPart(root, engGeo, darkMat, [xPos, 2.25, -4.4]);
      });
      addPart(root, new THREE.BoxGeometry(0.24, 2.7, 1.75), goldMat, [0, 3.1, -6.3], [-0.35, 0, 0]);
      addPart(root, new THREE.BoxGeometry(4.2, 0.14, 1.1), whiteMat, [0, 4.35, -6.9]);

      const w1 = createWheel(0.36, 0.22);
      w1.position.set(0, 0.36, 3.5);
      const w2 = createWheel(0.42, 0.24);
      w2.position.set(-1.5, 0.42, -0.4);
      const w3 = createWheel(0.42, 0.24);
      w3.position.set(1.5, 0.42, -0.4);
      root.add(w1, w2, w3);
      anim.wheels.push(w1, w2, w3);
      meta = { dims: { length: 14.7, width: 13.9, roofY: null, rimY: null, topY: 4.5 } };
      break;
    }

    // 2A. POLICE CAR — drivable: build-8 smooth sedan in police livery
    // (dark body, white roof, light bar, bull bar), returning the
    // makeCar placement contract. The light bar keeps the module's
    // emissive strobes AND exposes lights {red, blue} meshes so
    // police.js / shots.js can flash them by visibility, as before.
    // The seat sits forward in the cabin (z 0.30), which puts the
    // seated head box clear of the light bar behind it.
    case 'police_car': {
      const s = smoothSedan(root, anim, 0x141c2e, true);
      meta = carMeta({ x: 0.42, y: -0.24, z: 0.30 }, s.frames, {
        length: 4.70, width: 1.85, roofY: 1.48, rimY: null, topY: 1.67,
      }, 0.34, root);
      meta.cls = 'police';
      meta.lights = s.lights;
      meta.brakeMat = s.brakeMat;
      break;
    }

    // 2B. CIVIL SEDAN — traffic variety: the same smooth sedan, body
    // colour a parameter so traffic can recolour it freely.
    case 'civil_sedan': {
      const s = smoothSedan(root, anim, opts.color ?? 0x10b981, false);
      meta = carMeta({ x: 0.42, y: -0.24, z: 0.15 }, s.frames, {
        length: 4.70, width: 1.85, roofY: 1.48, rimY: null, topY: 1.48,
      }, 0.34, root);
      meta.cls = 'sedan';
      meta.brakeMat = s.brakeMat;
      break;
    }

    // 3A-3D. 4 FIRE TRUCKS — module scale kept (relative advantage).
    case 'fire_pumper':
    case 'fire_ladder':
    case 'fire_rescue':
    case 'fire_arff': {
      const isArff = type === 'fire_arff';
      const bodyMat = mat(isArff ? 0xeab308 : 0xdc2626, { roughness: 0.32, metalness: 0.4 });
      const chromeMat = mat(0xe2e8f0, { roughness: 0.2, metalness: 0.9 });
      const strobeRed = mat(0xef4444, { emissive: 0xef4444, emissiveIntensity: 1.5 });
      const strobeWhite = mat(0xffffff, { emissive: 0xffffff, emissiveIntensity: 1.3 });

      const length = type === 'fire_ladder' ? 8.2 : isArff ? 7.6 : 6.4;
      const width = isArff ? 2.85 : 2.45;

      addPart(root, new THREE.BoxGeometry(width, 1.35, 2.2), bodyMat, [0, 1.25, length * 0.32]);
      addPart(root, new THREE.BoxGeometry(width - 0.04, 1.55, length * 0.62), bodyMat, [0, 1.35, -length * 0.12]);
      addPart(root, new THREE.BoxGeometry(width + 0.06, 0.12, length * 0.64), chromeMat, [0, 0.62, -length * 0.12]);

      // BUILD 9: cab design pass in the house language — an angled
      // windshield and side glass in the house tint, a sloped chin
      // panel under it, sphere headlights, mirrors and a rounded roof
      // cap strip softening the cab's top edge.
      const glassMat = mat(0x18242e, { roughness: 0.08, metalness: 0.55 });
      const headMat = mat(0xfff6c9, { emissive: 0x776a20, roughness: 0.4 });
      const cabFront = length * 0.32 + 1.1;
      addPart(root, new THREE.BoxGeometry(width - 0.55, 0.66, 0.05), glassMat, [0, 1.50, cabFront + 0.03], [-0.30, 0, 0]);
      addPart(root, new THREE.BoxGeometry(width - 0.25, 0.55, 0.06), bodyMat, [0, 0.80, cabFront + 0.01], [0.45, 0, 0]);
      addPart(root, new THREE.SphereGeometry(0.085, 12, 10), headMat, [-(width / 2 - 0.38), 0.70, cabFront + 0.05]);
      addPart(root, new THREE.SphereGeometry(0.085, 12, 10), headMat, [width / 2 - 0.38, 0.70, cabFront + 0.05]);
      addPart(root, new THREE.BoxGeometry(0.05, 0.50, 1.05), glassMat, [-(width / 2 + 0.01), 1.52, length * 0.32 + 0.22]);
      addPart(root, new THREE.BoxGeometry(0.05, 0.50, 1.05), glassMat, [width / 2 + 0.01, 1.52, length * 0.32 + 0.22]);
      addPart(root, new THREE.SphereGeometry(0.11, 12, 10), bodyMat, [-(width / 2 + 0.07), 1.56, cabFront - 0.28], [0, 0, 0], [0.5, 0.38, 0.85]);
      addPart(root, new THREE.SphereGeometry(0.11, 12, 10), bodyMat, [width / 2 + 0.07, 1.56, cabFront - 0.28], [0, 0, 0], [0.5, 0.38, 0.85]);
      addPart(root, new THREE.BoxGeometry(width + 0.04, 0.07, 2.26), bodyMat, [0, 1.955, length * 0.32]);

      const s1 = addPart(root, new THREE.BoxGeometry(0.45, 0.2, 0.3), strobeRed, [-0.55, 2.02, length * 0.32]);
      const s2 = addPart(root, new THREE.BoxGeometry(0.45, 0.2, 0.3), strobeWhite, [0.55, 2.02, length * 0.32]);
      anim.strobos.push(s1, s2);

      if (type === 'fire_ladder') {
        const turntable = new THREE.Group();
        turntable.position.set(0, 2.15, -0.5);
        const boomPivot = new THREE.Group();
        boomPivot.position.set(0, 0.15, 0);
        boomPivot.rotation.x = -0.35;
        addPart(boomPivot, new THREE.BoxGeometry(0.32, 0.28, 5.6), chromeMat, [0, 0.15, -2.2]);
        addPart(boomPivot, new THREE.BoxGeometry(0.24, 0.2, 4.8), bodyMat, [0, 0.35, -2.6]);
        turntable.add(boomPivot);
        root.add(turntable);
        anim.ladderPivot = turntable;
        anim.boomPivot = boomPivot;
      }

      if (type === 'fire_rescue') {
        addPart(root, new THREE.BoxGeometry(width + 0.14, 0.9, 2.4), chromeMat, [0, 1.3, -0.4]);
        addPart(root, new THREE.BoxGeometry(0.16, 1.2, 0.16), chromeMat, [0, 2.65, -1.8]);
      }

      if (isArff) {
        const turret = new THREE.Group();
        turret.position.set(0, 2.18, 1.6);
        addPart(turret, new THREE.BoxGeometry(0.42, 0.35, 1.1), chromeMat, [0, 0.1, 0.3]);
        root.add(turret);
        anim.turretPivot = turret;
      }

      const wheelRadius = isArff ? 0.62 : 0.5;
      const wheelZ = type === 'fire_ladder' ? [2.6, -1.2, -3.1] : [2.1, -2.0];
      wheelZ.forEach((z) => {
        [-width * 0.52, width * 0.52].forEach((x) => {
          const w = createWheel(wheelRadius, 0.38);
          w.position.set(x, wheelRadius, z);
          root.add(w);
          anim.wheels.push(w);
        });
      });
      meta = { dims: truckDims(type, length, width) };
      break;
    }

    // 4. AMBULANCE — module scale kept.
    case 'ambulance': {
      const whiteMat = mat(0xf8fafc, { roughness: 0.3, metalness: 0.25 });
      const medRed = mat(0xef4444, { roughness: 0.35 });
      const blueStrobo = mat(0x2563eb, { emissive: 0x2563eb, emissiveIntensity: 1.4 });
      const glassMat = mat(0x18242e, { roughness: 0.08, metalness: 0.55 });
      const headMat = mat(0xfff6c9, { emissive: 0x776a20, roughness: 0.4 });

      // BUILD 9: the cab is rebuilt in the house language — a rounded
      // sphere nose, an angled windshield and side glass in the house
      // tint (the old cab had NO windows at all), mirrors, sphere
      // headlights and a roof cap. The rear box keeps its livery and
      // gains side + rear windows in the same glass.
      addPart(root, new THREE.BoxGeometry(2.15, 0.66, 2.05), whiteMat, [0, 0.60, 1.62]);
      addPart(root, new THREE.SphereGeometry(1, 20, 14), whiteMat, [0, 0.62, 2.30], [0, 0, 0], [1.05, 0.36, 0.45]);
      addPart(root, new THREE.BoxGeometry(2.02, 0.62, 1.55), whiteMat, [0, 1.22, 1.28]);
      addPart(root, new THREE.BoxGeometry(2.06, 0.07, 1.60), whiteMat, [0, 1.555, 1.28]);
      addPart(root, new THREE.BoxGeometry(1.84, 0.58, 0.05), glassMat, [0, 1.24, 2.02], [-0.38, 0, 0]);
      addPart(root, new THREE.BoxGeometry(0.04, 0.42, 0.95), glassMat, [-1.02, 1.24, 1.35]);
      addPart(root, new THREE.BoxGeometry(0.04, 0.42, 0.95), glassMat, [1.02, 1.24, 1.35]);
      addPart(root, new THREE.SphereGeometry(0.075, 12, 10), headMat, [-0.68, 0.62, 2.62]);
      addPart(root, new THREE.SphereGeometry(0.075, 12, 10), headMat, [0.68, 0.62, 2.62]);
      addPart(root, new THREE.SphereGeometry(0.11, 12, 10), whiteMat, [-1.13, 1.18, 2.0], [0, 0, 0], [0.5, 0.38, 0.85]);
      addPart(root, new THREE.SphereGeometry(0.11, 12, 10), whiteMat, [1.13, 1.18, 2.0], [0, 0, 0], [0.5, 0.38, 0.85]);
      addPart(root, new THREE.BoxGeometry(2.22, 1.55, 3.65), whiteMat, [0, 1.32, -1.1]);
      addPart(root, new THREE.BoxGeometry(2.26, 0.24, 3.7), medRed, [0, 1.35, -1.1]);
      addPart(root, new THREE.BoxGeometry(2.28, 0.56, 0.18), medRed, [0, 1.55, -1.1]);
      addPart(root, new THREE.BoxGeometry(2.28, 0.18, 0.56), medRed, [0, 1.55, -1.1]);
      addPart(root, new THREE.BoxGeometry(0.03, 0.44, 0.80), glassMat, [-1.12, 1.70, 0.25]);
      addPart(root, new THREE.BoxGeometry(0.03, 0.44, 0.80), glassMat, [1.12, 1.70, 0.25]);
      addPart(root, new THREE.BoxGeometry(0.03, 0.44, 1.10), glassMat, [-1.12, 1.70, -1.95]);
      addPart(root, new THREE.BoxGeometry(0.03, 0.44, 1.10), glassMat, [1.12, 1.70, -1.95]);
      addPart(root, new THREE.BoxGeometry(0.62, 0.50, 0.03), glassMat, [-0.55, 1.72, -2.93]);
      addPart(root, new THREE.BoxGeometry(0.62, 0.50, 0.03), glassMat, [0.55, 1.72, -2.93]);

      const st = addPart(root, new THREE.BoxGeometry(0.9, 0.2, 0.28), blueStrobo, [0, 2.18, 1.85]);
      anim.strobos.push(st);

      [[-1.08, 0.44, 1.85], [1.08, 0.44, 1.85], [-1.08, 0.44, -1.75], [1.08, 0.44, -1.75]].forEach(([x, y, z]) => {
        const w = createWheel(0.44, 0.3);
        w.position.set(x, y, z);
        root.add(w);
        anim.wheels.push(w);
      });
      meta = { dims: { length: 5.65, width: 2.28, roofY: 2.1, rimY: null, topY: 2.28 } };
      break;
    }

    // 5A-5C. 3 MOTORCYCLES — parked props (no riders).
    case 'moto_sport':
    case 'moto_cruiser':
    case 'moto_enduro': {
      const colorMap = { moto_sport: 0xef4444, moto_cruiser: 0x1e293b, moto_enduro: 0xf97316 };
      const bikeMat = mat(colorMap[type], { roughness: 0.28, metalness: 0.6 });
      const chromeMat = mat(0xd4d4d8, { roughness: 0.2, metalness: 0.9 });
      const seatMat = mat(0x18181b, { roughness: 0.85 });

      const seatY = type === 'moto_enduro' ? 0.96 : type === 'moto_cruiser' ? 0.68 : 0.78;
      const wheelR = type === 'moto_enduro' ? 0.42 : 0.35;

      addPart(root, new THREE.BoxGeometry(0.42, 0.34, 1.15), bikeMat, [0, seatY + 0.14, 0.15]);
      addPart(root, new THREE.BoxGeometry(0.36, 0.14, 0.78), seatMat, [0, seatY + 0.06, -0.55]);
      addPart(root, new THREE.BoxGeometry(0.82, 0.07, 0.1), chromeMat, [0, seatY + 0.36, 0.55]);

      // BUILD 9: detail pass — a fork + emissive headlight on all
      // three, a small tinted windscreen on the sport, stalk mirrors
      // on the cruiser and enduro.
      const darkMat = mat(0x23252b, { roughness: 0.75, metalness: 0.05 });
      const headMat = mat(0xfff6c9, { emissive: 0x776a20, roughness: 0.4 });
      addPart(root, new THREE.CylinderGeometry(0.03, 0.03, 0.78, 8), darkMat, [0, seatY + 0.02, 0.80], [0.35, 0, 0]);
      addPart(root, new THREE.SphereGeometry(0.06, 12, 10), headMat, [0, seatY + 0.24, 0.99]);
      if (type === 'moto_sport') {
        const glassMat = mat(0x18242e, { roughness: 0.08, metalness: 0.55 });
        addPart(root, new THREE.BoxGeometry(0.36, 0.24, 0.03), glassMat, [0, seatY + 0.50, 0.60], [-0.55, 0, 0]);
      } else {
        addPart(root, new THREE.CylinderGeometry(0.015, 0.015, 0.26, 6), chromeMat, [-0.33, seatY + 0.46, 0.52], [0, 0, 0.6]);
        addPart(root, new THREE.CylinderGeometry(0.015, 0.015, 0.26, 6), chromeMat, [0.33, seatY + 0.46, 0.52], [0, 0, -0.6]);
        addPart(root, new THREE.BoxGeometry(0.12, 0.08, 0.02), darkMat, [-0.42, seatY + 0.57, 0.50]);
        addPart(root, new THREE.BoxGeometry(0.12, 0.08, 0.02), darkMat, [0.42, seatY + 0.57, 0.50]);
      }

      if (type === 'moto_sport') {
        addPart(root, new THREE.BoxGeometry(0.48, 0.42, 0.75), bikeMat, [0, seatY + 0.08, 0.72], [0.45, 0, 0]);
      } else if (type === 'moto_cruiser') {
        addPart(root, new THREE.BoxGeometry(0.12, 0.45, 0.12), chromeMat, [0, seatY + 0.52, 0.55]);
        addPart(root, new THREE.CylinderGeometry(0.12, 0.12, 1.25, 12).rotateX(Math.PI / 2), chromeMat, [0.28, 0.45, -0.35]);
      } else {
        addPart(root, new THREE.BoxGeometry(0.32, 0.1, 0.45), bikeMat, [0, wheelR * 2 + 0.12, 0.82], [0.25, 0, 0]);
      }

      const fw = createWheel(wheelR, 0.16);
      fw.position.set(0, wheelR, 0.95);
      const rw = createWheel(wheelR, 0.2);
      rw.position.set(0, wheelR, -0.92);
      root.add(fw, rw);
      anim.wheels.push(fw, rw);
      meta = { dims: { length: 1.87 + wheelR * 2, width: 0.82, roofY: seatY + 0.4, rimY: null, topY: seatY + 0.4 } };
      break;
    }
  }

  return { group: root, type, animated: anim, ...(meta || {}) };
}

// Build 8: the two drivable car types are modelled directly at real
// size, so the metadata contract needs no conversion — seat socket,
// frame boxes and dims are already world units, fitted to the new
// figure (1.78 tall, hip pivot 0.96: the seat origin sits at −0.24 so
// the pelvis lands on the cushion and the head box rides at
// [1.50, 1.80] over the socket).
function carMeta(seat, frameBoxes, dims, wheelR, root) {
  return {
    seat, frameBoxes, tub: null, dims,
    wheels: root.userData.animated.wheels,
    speed: 0, heading: 0, driver: null,
    radius: dims.length / 2,
    wheelR,
  };
}

function truckDims(type, length, width) {
  // Cab/body top from the module geometry: body box top 2.125; the
  // ladder truck's mast reaches 3.25 and the ARFF turret 2.36.
  const topY = type === 'fire_ladder' ? 3.25 : type === 'fire_rescue' ? 3.25 : type === 'fire_arff' ? 2.36 : 2.13;
  return { length, width, roofY: 2.13, rimY: null, topY };
}

// Fleet animation, from the source module, with one change of contract:
// wheels turn only when a speed is passed (parked vehicles keep still
// wheels), while strobes, the ladder, the turret and any RUNNING
// aircraft propellers/turbines animate whenever the vehicle is wired
// into the main loop. Parked aircraft are never wired, so their props
// stay still.
export function updateFleetAnimation(vehicle, dt, elapsed, speed = 0) {
  const anim = vehicle?.animated || vehicle?.userData?.animated;
  if (!anim) return;

  if (speed) anim.wheels.forEach((w) => { w.rotation.x += (dt * speed) / 0.4; });
  anim.propellers.forEach((p) => { p.rotation.z += dt * 36; });
  anim.turbines.forEach((t) => { t.rotation.z += dt * 28; });

  anim.strobos.forEach((s, idx) => {
    const pulse = Math.sin(elapsed * 14 + idx * Math.PI);
    if (s.material?.emissiveIntensity !== undefined) {
      s.material.emissiveIntensity = pulse > 0 ? 1.8 : 0.25;
    }
  });

  if (anim.ladderPivot) anim.ladderPivot.rotation.y = Math.sin(elapsed * 0.8) * 0.45;
  if (anim.boomPivot) anim.boomPivot.rotation.x = -0.35 + Math.sin(elapsed * 1.1) * 0.15;
  if (anim.turretPivot) anim.turretPivot.rotation.y = Math.sin(elapsed * 1.4) * 0.5;
}
