# PALMERA BAY — Reborn

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/kunkuro30/palmera-bay/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/kunkuro30/palmera-bay/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

**Play / bounty page:** https://make.fun/bounty/gta6-01

A living low-poly open-world beach city for the make.fun **gta6-01** bounty ("Make GTA 6").

Palmera Bay is a sunny crime sandbox in a single static web page, set on a whole
**island**: sea on every side, an organic curved coastline, the city in the south —
a crowded beach strip (a giant lifeguard statue, a wooden pier, boats and jetskis,
sunbathers, swimmers and a volleyball rally), a boardwalk of named shops — FRESH FISH,
TACKLE & BAIT, DONUT BAY, KAVA COFFEE, SCOOPS, CANDY CLOUD, JUICE PALM, MINI MART 24,
BAY GIFTS — each with its own keeper, a spinning ferris wheel and carousel, a palm
park, New-York-density downtown blocks with textured asphalt, raised **sidewalks**,
crosswalks and traffic lights, a small **Bay Clinic**, and **Palmera Intl Airport** on
the south-west shore — runway, signed terminal, control tower, parked jets and service
vehicles, all visitable. A coastal highway loops the island and a freeway runs north
through hills to one big mountain, a dry desert in the north-east and a lake with its
own little beach and dock. The minimap draws the whole island — sea, lake, mountain,
airport, loop — at a glance.

Every citizen is a big-headed low-poly figure in the "Polygon War" style: a
low-segment **faceted sphere head** (never a plain box) with simple readable eyes,
angular flat-shaded body parts in clean solid colours, dressed by role so you can read
them at a glance: blue-uniform police with cap badges, red-helmet firefighters with
reflective stripes, a white-coated doctor with a stethoscope and a nurse in scrubs
outside the clinic, gangsters in black jackets with gold chains and shades guarding
the heist case, your hoodie-and-cap friend handing out jobs at the pier, casual men
and women, and kids. You — orange jacket, white tee, jeans, red sneakers — walk, run,
punch, steal detailed cars (sedans, yellow taxis, trucks, vans, sports cars and
convertibles you can actually see yourself driving), fight as a **third-person
shooter** (hold right mouse to aim over the shoulder with a centre crosshair, click
to fire), run from a 1–5 star wanted system with pursuing police, and work three
chained jobs — **Beach Run**, **Hot Goods** and **Bay Heist** — with a HUD, a live
minimap, WebAudio synth sound and localStorage saves.

## Play

```sh
node serve.ts          # then open the local address it prints
```

WASD move · SHIFT run · E enter/exit car · F punch · mouse drag looks around.

## Layout

- `game/` — the game itself (static, offline; three.js vendored under `game/vendor/`)
- `game/src/` — one module per job: `world`, `characters`, `vehicles`, `pedestrians`,
  `police`, `missions`, `combat`, `player`, `hud`, `audio`, `input`, `save`, `shots`
- `screenshots/` — the four judged scenes (chase cover, beach, city, mission)
- `main.ts` — hands the entry in: copies `game/` + `screenshots/` to the output and
  writes the dossier

## License

MIT — see `LICENSE`.
