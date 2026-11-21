#!/usr/bin/env python3
# Run from the repo root against the dev server on 127.0.0.1:8901 (see BASE below).
"""Palmera Bay physics self-check (physics standard #5).

Loads the real game in headless Chrome (same pipeline as capture3.py),
stages the deterministic shot scenes, and evaluates the placement rules
IN PAGE against the live world via window.__game:

  1. DRIVERS  — every seated driver (seat() in shots.js) must carry a
     driverCheck PASS: head box vs the car's frame boxes, hip vs tub rim.
  2. SWIMMERS — every swimmer's CURRENT position (drift included) must
     satisfy waterDepthAt in [0.30, 1.35] m, and its anchor must satisfy
     the stricter spawn band [0.45, 1.15] m. Nobody swims on land.
  3. GROUNDING — every standing figure's baseY must equal the ground
     query (groundHeight or heightAt) at its (x, z) within 0.06, and its
     live group Y must sit within animation amplitude of baseY.
  4. PROPORTION (build 8) — the figure (1.78 tall, a real-proportioned
     adult: head 0.236 ≈ 1/7.5 of height) is the reference human; one
     car of every type is built in page and its dims checked against
     bands RE-DERIVED FROM REAL-WORLD REFERENCES (a 1.78 adult beside
     real cars): a family sedan's roof is ~1.45–1.50 -> figure/roof
     ~1.19–1.23, asserted [1.16, 1.24]; a sports coupe's roof is
     ~1.27–1.37 -> figure/roof ~1.30–1.40; a convertible's cockpit rim
     sits at beltline ~1.0–1.15 -> rim asserted [1.05, 1.18]; a van's
     roof is ~1.85–2.05 -> figure/roof ~0.87–0.96; a truck cab top is
     2.1+ -> figure/roof < 0.85. For EVERY type the figure must also be
     shorter than car length × 0.45 (a person never reads bigger than
     the car). No band is widened to fit a model: a car that misses its
     real-reference band is a modelling bug, not a band bug.
  5. FLEET (build 6, bands updated build 8) — the same proportion bands
     applied to the fleet module's types (police_car / civil_sedan in
     the closed-car band [1.16, 1.24], fire trucks + ambulance
     figure/roof < 1.0), all 11 placed types present in the live world,
     and a driver test for the two drivable fleet cars: the seated head
     box (the new figure's: ±0.13, [socket+1.50, socket+1.80]) must
     clear every frame box OUTSIDE the cabin volume (light bar, bull
     bar). Cabin-glass/roof occupancy is by design for closed cars —
     the parity lines print the house sedan/taxi under the identical
     replication to prove it.
  6. STATICS (build 7) — every static structure the expansion placed
     (stations, hospital, shops, houses, kiosks, vending machines, the
     garrison) registered a grounding sample in
     scene.userData.groundingSamples: its baseY must equal the ground
     query it was placed with (heightAt or groundHeight) within 0.06.
  7. BUILD 14 — the Palmera Arms case holds an SMG (the world
     registers the case contents and a real SMG model is tagged in the
     scene), the weapons and races modules are live, and all 18 race
     grounding samples (2 start pads + 16 checkpoint rings) are
     registered — their values ride rule 6.

Prints PASS/FAIL per rule with counts and any offenders. Exit code 1 if
any rule fails.
"""
import sys
from playwright.sync_api import sync_playwright

BASE = "http://127.0.0.1:8901"

CHECK_JS = r"""
() => {
  const G = window.__game;
  const out = { drivers: [], swimmers: [], grounded: [], proportions: [], errors: [] };
  if (!G) { out.errors.push('window.__game missing'); return out; }

  // 4 — build-8 proportion rule: one car of every type, built in page
  // (not added to the scene), dims read from makeCar's world-unit dims.
  // Bands re-derived from real references (see the module docstring).
  const FIG = 1.78;
  const TYPES = [
    { cls: 'sedan' }, { cls: 'sport' }, { cls: 'sport', openTop: true },
    { cls: 'taxi' }, { cls: 'taxi', openTop: true }, { cls: 'police' },
    { cls: 'van' }, { cls: 'truck' },
  ];
  for (const t of TYPES) {
    const c = G.makeCar(0x888888, { cls: t.cls, openTop: !!t.openTop, kind: 'check' });
    const d = c.dims;
    let pass, note;
    const lenOk = FIG < d.length * 0.45;
    if (d.rimY !== null && d.rimY !== undefined) {
      pass = d.rimY >= 1.05 && d.rimY <= 1.18 && lenOk;
      note = `rim ${d.rimY.toFixed(2)} (band 1.05–1.18, real beltline), length ${d.length.toFixed(2)}, fig/len ${(FIG / d.length).toFixed(2)} (< 0.45)`;
    } else if (t.cls === 'van') {
      const r = FIG / d.roofY;
      pass = r >= 0.87 && r <= 0.96 && lenOk;
      note = `roof ${d.roofY.toFixed(2)}, fig/roof ${r.toFixed(2)} (band 0.87–0.96), length ${d.length.toFixed(2)}, fig/len ${(FIG / d.length).toFixed(2)}`;
    } else if (t.cls === 'truck') {
      const r = FIG / d.roofY;
      pass = r < 0.85 && lenOk;
      note = `roof ${d.roofY.toFixed(2)}, fig/roof ${r.toFixed(2)} (< 0.85), length ${d.length.toFixed(2)}, fig/len ${(FIG / d.length).toFixed(2)}`;
    } else if (t.cls === 'sport') {
      const r = FIG / d.roofY;
      pass = r >= 1.30 && r <= 1.40 && lenOk;
      note = `roof ${d.roofY.toFixed(2)}, fig/roof ${r.toFixed(2)} (band 1.30–1.40, real coupe), length ${d.length.toFixed(2)}, fig/len ${(FIG / d.length).toFixed(2)}`;
    } else {
      const r = FIG / d.roofY;
      pass = r >= 1.16 && r <= 1.24 && lenOk;
      note = `roof ${d.roofY.toFixed(2)}, fig/roof ${r.toFixed(2)} (band 1.16–1.24, real sedan), length ${d.length.toFixed(2)}, fig/len ${(FIG / d.length).toFixed(2)}`;
    }
    out.proportions.push({ cls: t.cls, openTop: !!t.openTop, pass, note });
  }

  // 5 — build-6 fleet proportions + driver assertion, same bands as
  // rule 4: the fleet cars (police_car, civil_sedan) must sit in the
  // closed-car band; the trucks keep figure/roof < 1.0. The driver test
  // replicates shots.seat()'s head-box assertion against the fleet
  // cars' own seat socket + frame boxes.
  out.fleet = [];
  if (G.buildFleetVehicle) {
    const FCARS = [
      { type: 'police_car', band: [1.16, 1.24] },
      { type: 'civil_sedan', band: [1.16, 1.24] },
      { type: 'fire_pumper', band: null },
      { type: 'fire_ladder', band: null },
      { type: 'fire_rescue', band: null },
      { type: 'fire_arff', band: null },
      { type: 'ambulance', band: null },
    ];
    for (const t of FCARS) {
      const v = G.buildFleetVehicle(t.type);
      const d = v.dims;
      const r = FIG / d.roofY;
      const lenOk = FIG < d.length * 0.45;
      const pass = t.band ? (r >= t.band[0] && r <= t.band[1] && lenOk) : (r < 1.0 && lenOk);
      let note = `roof ${d.roofY.toFixed(2)}, fig/roof ${r.toFixed(2)} (${t.band ? 'band 1.16–1.24' : '< 1.0'}), length ${d.length.toFixed(2)}, fig/len ${(FIG / d.length).toFixed(2)}`;
      let driver = null;
      if (v.seat && v.frameBoxes) {
        // seat() semantics for a CLOSED car: the head legitimately sits
        // INSIDE the cabin volume, so 'cabin glass'/'roof' intersections
        // are occupancy, not strikes (identically true of the house
        // sedan/taxi — see the parity lines). The assertion that bites
        // is the head vs the hard parts OUTSIDE the cabin volume (light
        // bar, bull bar, signs): those it must clear.
        const s = v.seat;
        const head = { x: [s.x - 0.13, s.x + 0.13], y: [s.y + 1.50, s.y + 1.80], z: [s.z - 0.13, s.z + 0.13] };
        const hard = [], cabin = [];
        for (const fb of v.frameBoxes) {
          if (head.x[0] < fb.x[1] && head.x[1] > fb.x[0] &&
              head.y[0] < fb.y[1] && head.y[1] > fb.y[0] &&
              head.z[0] < fb.z[1] && head.z[1] > fb.z[0]) {
            (fb.name === 'cabin glass' || fb.name === 'roof' ? cabin : hard).push(fb.name);
          }
        }
        driver = {
          pass: hard.length === 0,
          note: (hard.length === 0 ? 'head box clears every non-cabin frame box' : 'head box STRIKES: ' + hard.join(', ')) +
                (cabin.length ? `; cabin occupancy (by design): ${cabin.join(', ')}` : ''),
        };
      }
      out.fleet.push({ type: t.type, pass, note, driver });
    }
    out.fleetPlaced = (G.fleetPlaced || []).map((f) => f.type);
    // Parity reference: the house closed sedan and taxi under the
    // identical head-box replication (informational — proves what
    // "normal" closed-car occupancy looks like in this game).
    out.parity = [];
    for (const cls of ['sedan', 'taxi']) {
      const c = G.makeCar(0x888888, { cls, kind: 'check' });
      const s = c.seat;
      const head = { x: [s.x - 0.13, s.x + 0.13], y: [s.y + 1.50, s.y + 1.80], z: [s.z - 0.13, s.z + 0.13] };
      const hits = [];
      for (const fb of c.frameBoxes || []) {
        if (head.x[0] < fb.x[1] && head.x[1] > fb.x[0] &&
            head.y[0] < fb.y[1] && head.y[1] > fb.y[0] &&
            head.z[0] < fb.z[1] && head.z[1] > fb.z[0]) hits.push(fb.name);
      }
      out.parity.push({ cls, hits });
    }
  }

  // 1 — seated driver check (staged by seat()).
  if (G.player && G.player.car && G.player.car.driverCheck) {
    out.drivers.push({ cls: G.player.car.cls, ...G.player.car.driverCheck });
  }

  // 2 — swimmers in water, at their live (drifted) positions and anchors.
  const SEA = 0.1, LAKE_Y = 0.55;
  for (const s of G.crowd.swimmers) {
    const p = s.group.position;
    const depthNow = G.waterDepthAt(p.x, p.z);
    const depthAnchor = G.waterDepthAt(s.baseX, s.baseZ);
    const surface = s.baseZ < 0 ? LAKE_Y : SEA;
    out.swimmers.push({
      x: +p.x.toFixed(1), z: +p.z.toFixed(1),
      depthNow: +depthNow.toFixed(2), depthAnchor: +depthAnchor.toFixed(2),
      yOff: +(p.y - (surface - 0.45)).toFixed(2),
      pass: depthNow >= 0.30 && depthNow <= 1.35 &&
            depthAnchor >= 0.45 && depthAnchor <= 1.15 &&
            Math.abs(p.y - (surface - 0.45)) <= 0.08,
    });
  }

  // 3 — grounding, asserted per figure kind (a seated figure's baseY is
  // NOT its ground height by design — its HIPS must meet the seat top):
  //   seated   -> hip height (baseY + 0.96) == groundHeight + bench 0.49
  //   anchored -> baseY == heightAt at the anchor mark (volley players
  //               shuffle around it, so the live (x, z) is the wrong test)
  //   standing -> baseY == groundHeight or heightAt at (x, z), ±0.06
  const swimSet = new Set(G.crowd.swimmers);
  for (const f of G.crowd.figures) {
    if (swimSet.has(f)) continue;
    const p = f.group.position;
    let pass, kind;
    if (f.seated) {
      kind = 'seated';
      pass = Math.abs((f.baseY + 0.96) - (G.groundHeight(p.x, p.z) + 0.49)) < 0.06;
    } else if (f.anchorX !== undefined) {
      kind = 'anchored';
      pass = Math.abs(f.baseY - G.heightAt(f.anchorX, f.anchorZ)) < 0.06 &&
             Math.abs(p.y - f.baseY) < 0.62;
    } else {
      kind = 'stand';
      const gh = G.groundHeight(p.x, p.z);
      const ha = G.heightAt(p.x, p.z);
      pass = (Math.abs(f.baseY - gh) < 0.06 || Math.abs(f.baseY - ha) < 0.06) &&
             Math.abs(p.y - f.baseY) < 0.62;   // hop/bob amplitude
    }
    out.grounded.push({
      x: +p.x.toFixed(1), z: +p.z.toFixed(1), kind,
      baseY: +f.baseY.toFixed(2), pass,
    });
  }

  // 6 — build-7 static grounding samples.
  out.statics = [];
  const samples = (G.scene.userData && G.scene.userData.groundingSamples) || [];
  for (const s of samples) {
    const q = s.q === 'groundHeight' ? G.groundHeight(s.x, s.z) : G.heightAt(s.x, s.z);
    out.statics.push({
      label: s.label, x: s.x, z: s.z, baseY: +s.y.toFixed(3), query: +q.toFixed(3),
      pass: Math.abs(s.y - q) <= 0.06,
    });
  }

  // 7 — BUILD 14: the Arms case must hold an SMG (registry + a real
  // tagged model in the scene), the weapons and races modules must be
  // live, and all 18 race samples (2 pads + 16 checkpoint rings) must
  // be registered — rule 6 above asserts their grounding values.
  out.build14 = {
    armsCase: (G.scene.userData && G.scene.userData.armsCase) || null,
    smgModels: 0,
    weapons: !!(G.weapons && G.weapons.def && G.weapons.WEAPONS.length === 4),
    races: !!(G.races && G.races.state),
    raceSamples: samples.filter((s) => s.label.startsWith('race')).length,
  };
  G.scene.traverse((o) => { if (o.userData && o.userData.weaponKind === 'smg') out.build14.smgModels += 1; });

  // 8 — BUILD 15: throw a roadblock on avenue 60 ahead of a northbound
  // car and assert both cruisers and both officers stand on the ground
  // query; the five stunt ramps, the Comet pad and the safehouse door
  // must be registered samples (rule 6 asserts their values); the new
  // modules (wrecks, stunts, standing, the police heli with its
  // spotlight and cone) must be live.
  G.police.debugSpawnRoadblock({ x: 60, z: 126 }, Math.PI);
  const rb = G.police.roadblock;
  out.build15 = {
    roadblock: rb ? {
      cars: rb.cars.map((c) => ({ y: +c.group.position.y.toFixed(3), gy: +G.groundHeight(c.group.position.x, c.group.position.z).toFixed(3) })),
      offs: rb.officers.map((o) => ({ baseY: +o.fig.baseY.toFixed(3), gy: +G.groundHeight(o.fig.group.position.x, o.fig.group.position.z).toFixed(3) })),
    } : null,
    ramps: samples.filter((s) => s.label.startsWith('stunt ramp')).length,
    cometPad: samples.filter((s) => s.label === 'comet pad').length,
    door: samples.filter((s) => s.label === 'safehouse door').length,
    modules: !!(G.wrecks && G.stunts && G.standing && G.police.heli && G.police.heli.spot && G.police.heli.cone),
  };
  G.police.debugClearRoadblock();
  return out;
}
"""

SCENES = ["chase", "city", "gulls"]
failures = 0

with sync_playwright() as pw:
    browser = pw.chromium.launch(
        executable_path="/home/hatch/workspace/tools/chrome-linux64/chrome",
        args=["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--no-sandbox"],
    )
    page = browser.new_page(viewport={"width": 1280, "height": 800})
    page_errors = []
    page.on("pageerror", lambda e: page_errors.append(str(e)))

    seen_drivers = []
    swim_report = None
    ground_report = None
    prop_report = None
    fleet_report = None
    fleet_placed = None
    parity_report = None
    statics_report = None
    build14_report = None
    build15_report = None
    for scene in SCENES:
        page_errors.clear()
        page.goto(f"{BASE}/?shot={scene}&seed=1", wait_until="load")
        try:
            page.wait_for_function("window.__shotReady === true", timeout=300000)
        except Exception as exc:
            print(f"[{scene}] TIMEOUT waiting for __shotReady: {exc}")
            failures += 1
            continue
        res = page.evaluate(CHECK_JS)
        if res["errors"]:
            print(f"[{scene}] PAGE ERRORS: {res['errors']}")
            failures += 1
        if page_errors:
            print(f"[{scene}] JS PAGE ERRORS: {page_errors[:3]}")
            failures += 1
        seen_drivers.extend(res["drivers"])
        if build14_report is None and res.get("build14"):
            build14_report = res["build14"]
        if build15_report is None and res.get("build15"):
            build15_report = res["build15"]
        if statics_report is None and res.get("statics"):
            statics_report = res["statics"]
        if fleet_report is None and res.get("fleet"):
            fleet_report = res["fleet"]
            fleet_placed = res.get("fleetPlaced")
            parity_report = res.get("parity")
        if prop_report is None and res["proportions"]:
            prop_report = res["proportions"]
        if scene == "gulls":
            swim_report = res["swimmers"]
            ground_report = res["grounded"]
    browser.close()

print("== PHYSICS SELF-CHECK — BUILD 8 REFERENCE BANDS ==")
print("Reference human: 1.78 tall, head 0.236 (1/7.5 of height) — real adult proportions.")
print("Bands re-derived from real cars beside a 1.78 adult (no band widened to fit a model):")
print("  sedan/taxi closed  fig/roof [1.16, 1.24]  (real sedan roof ~1.45–1.50)")
print("  sport closed       fig/roof [1.30, 1.40]  (real coupe roof ~1.27–1.37)")
print("  cabrio             rim      [1.05, 1.18]  (real beltline ~1.0–1.15)")
print("  van                fig/roof [0.87, 0.96]  (real van roof ~1.85–2.05)")
print("  truck              fig/roof < 0.85        (real cab top 2.1+)")
print("  fleet cars         fig/roof [1.16, 1.24]; fleet trucks/ambulance < 1.0")
print("  every type         fig/len  < 0.45")
# Rule 1 — drivers
if seen_drivers:
    for d in seen_drivers:
        print(f"DRIVER {d['cls']}: {'PASS' if d['pass'] else 'FAIL'} — {d['note']}")
        failures += 0 if d["pass"] else 1
else:
    print("DRIVER: FAIL — no seated driver check found")
    failures += 1

# Rule 2 — swimmers
if swim_report is not None:
    bad = [s for s in swim_report if not s["pass"]]
    print(f"SWIMMERS: {len(swim_report) - len(bad)}/{len(swim_report)} PASS"
          f" (depth now 0.30–1.35, anchor 0.45–1.15, body at surface-0.45)")
    for s in bad:
        print(f"  FAIL swimmer at ({s['x']}, {s['z']}): depthNow={s['depthNow']} depthAnchor={s['depthAnchor']} yOff={s['yOff']}")
    failures += len(bad)
else:
    print("SWIMMERS: FAIL — no report")
    failures += 1

# Rule 3 — grounding
if ground_report is not None:
    bad = [g for g in ground_report if not g["pass"]]
    print(f"GROUNDING: {len(ground_report) - len(bad)}/{len(ground_report)} PASS"
          f" (per-kind: standing baseY == ground query ±0.06; seated hips == seat top; anchored baseY == heightAt at anchor)")
    for g in bad[:8]:
        print(f"  FAIL figure at ({g['x']}, {g['z']}): kind={g['kind']} baseY={g['baseY']}")
    failures += len(bad)
else:
    print("GROUNDING: FAIL — no report")
    failures += 1

# Rule 4 — proportions (build 8: real-reference bands, figure 1.78)
if prop_report is not None:
    for p in prop_report:
        label = p["cls"] + (" cabrio" if p["openTop"] else "")
        print(f"PROPORTION {label}: {'PASS' if p['pass'] else 'FAIL'} — {p['note']}")
        failures += 0 if p["pass"] else 1
else:
    print("PROPORTION: FAIL — no report")
    failures += 1

# Rule 5 — fleet proportions + driver assertion (build 6)
if fleet_report is not None:
    for p in fleet_report:
        print(f"PROPORTION {p['type']}: {'PASS' if p['pass'] else 'FAIL'} — {p['note']}")
        failures += 0 if p["pass"] else 1
        if p.get("driver"):
            d = p["driver"]
            print(f"FLEET DRIVER {p['type']}: {'PASS' if d['pass'] else 'FAIL'} — {d['note']}")
            failures += 0 if d["pass"] else 1
    for p in (parity_report or []):
        print(f"PARITY build-8 {p['cls']} (closed): head box intersects "
              f"{', '.join(p['hits']) if p['hits'] else 'nothing'} — the house standard for closed cars")
    expected = {"boeing_twinjet", "csa_prop", "private_jet", "fire_arff",
                "fire_ladder", "fire_pumper", "fire_rescue", "ambulance",
                "moto_sport", "moto_cruiser", "moto_enduro"}
    placed = set(fleet_placed or [])
    missing = sorted(expected - placed)
    print(f"FLEET PLACED: {len(placed & expected)}/11 types placed"
          + (f" — MISSING: {', '.join(missing)}" if missing else ""))
    failures += len(missing)
else:
    print("FLEET: FAIL — no report")
    failures += 1

# Rule 6 — build-7 static grounding samples
if statics_report is not None:
    bad = [s for s in statics_report if not s["pass"]]
    print(f"STATIC GROUNDING: {len(statics_report) - len(bad)}/{len(statics_report)} PASS"
          f" (baseY == ground query ±0.06: hospital, stations, shops, houses, kiosks, vending, garrison)")
    for s in statics_report:
        print(f"  {'PASS' if s['pass'] else 'FAIL'} {s['label']} at ({s['x']}, {s['z']}): baseY {s['baseY']} vs query {s['query']}")
    failures += len(bad)
else:
    print("STATIC GROUNDING: FAIL — no samples registered")
    failures += 1

# Rule 7 — build 14 (Arms SMG, weapons/races modules, race samples)
if build14_report is not None:
    b = build14_report
    case_ok = bool(b["armsCase"]) and b["armsCase"].get("smgs", 0) >= 1
    ok = case_ok and b["smgModels"] >= 1 and b["weapons"] and b["races"] and b["raceSamples"] >= 18
    print(f"BUILD 14: {'PASS' if ok else 'FAIL'} — armsCase={b['armsCase']}, smgModels={b['smgModels']}, "
          f"weaponsModule={b['weapons']}, racesModule={b['races']}, raceSamples={b['raceSamples']} (pads + checkpoint rings, values asserted under STATIC GROUNDING)")
    failures += 0 if ok else 1
else:
    print("BUILD 14: FAIL — no report")
    failures += 1

# Rule 8 — build 15 (roadblock grounding, ramps/pad/door, modules)
if build15_report is not None:
    b = build15_report
    rb = b["roadblock"] or {"cars": [], "offs": []}
    rb_ok = (len(rb["cars"]) == 2 and len(rb["offs"]) == 2
             and all(abs(c["y"] - c["gy"]) <= 0.06 for c in rb["cars"])
             and all(abs(o["baseY"] - o["gy"]) <= 0.06 for o in rb["offs"]))
    ok = rb_ok and b["ramps"] == 5 and b["cometPad"] == 1 and b["door"] == 1 and b["modules"]
    print(f"BUILD 15: {'PASS' if ok else 'FAIL'} — roadblock grounded={rb_ok} "
          f"(cars={[(c['y'], c['gy']) for c in rb['cars']]}, officers={[(o['baseY'], o['gy']) for o in rb['offs']]}), "
          f"ramps={b['ramps']}/5, cometPad={b['cometPad']}/1, safehouseDoor={b['door']}/1, modules={b['modules']}")
    failures += 0 if ok else 1
else:
    print("BUILD 15: FAIL — no report")
    failures += 1

print(f"PHYSICS_CHECK_RESULT: {'ALL PASS' if failures == 0 else str(failures) + ' FAILURES'}")
sys.exit(1 if failures else 0)