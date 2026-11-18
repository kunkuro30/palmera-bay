# Palmera Bay — Hot Pursuit

![make.fun gta6-01](https://make.fun/badge/gta6-01.svg)
![rank](https://make.fun/badge/gta6-01/kunkuro30/palmera-bay/rank.svg)
![reward](https://make.fun/badge/gta6-01/kunkuro30/palmera-bay/reward.svg)

An original open-world crime game for the [make.fun "Make GTA 6" bounty](https://make.fun/bounty/gta6-01), built with three.js and plain static files — no build step, no network, just open `game/index.html` in a desktop browser.

Palmera Bay is a sun-soaked coastal city at sunset: six avenues each way, a beach strip with pastel deco facades and neon signs, a marina, a hospital, and a police force that does not give up easily. You arrive with $120 and a pair of fists. Marina Sol, working out of the marina, has three jobs that escalate from a simple delivery to a full bay heist — if you can lose the police with the case in hand.

## How to play

Click **CLICK TO PLAY**, then:

- **WASD / arrows** — walk and drive · **SHIFT** — sprint · **SPACE** — jump / handbrake
- **F** — enter / exit a car (any car — but stealing one in front of witnesses brings heat)
- **Mouse** — camera and aim · **LMB** — punch or shoot
- **1 / 2** — fists / pistol (the pistol is Marina's reward for the first job)
- **P** — pause · **M** — mute

Follow the gold marker. The minimap draws the GPS route, police blips, and — while the cops are searching — their vision cones; your arrow turns grey when you are hidden. Wanted stars blink while you are out of sight and burn solid while you are seen. Health regenerates only to 50%, GTA-style; missions and the hospital patch you up fully. Getting busted or wasted costs 10% of your cash and wakes you at the hospital. Progress (cash, story stage, cases, fares) is saved in your browser.

## What's in the game

- A complete story: three jobs for Marina Sol (an errand, a hot sports car, the bay heist), plus repeatable taxi fares and eight hidden golden briefcases worth $100 each
- A five-star wanted system with line-of-sight rules: heat holds while any unit sees you and drains per-star (30–90 s) while you hide; cruisers ram, officers get out and shoot, and roadblocks appear at three stars
- Traffic that drives the grid, stops for obstacles and turns at intersections; pedestrians who stroll, panic at gunfire and dive away from fast cars
- Four car classes with distinct acceleration, top speed and grip; a third-person camera that widens its FOV with speed and shakes at pace
- A full HUD: scrolling minimap with GPS route and live distance readout, wanted stars, health, cash, case counter, speedometer, objective banner and toasts
- Fully synthesised WebAudio sound — engine, sirens that swell as police close in, gunshots, punches, cash register, mission stings and an ambient pad. No audio files.

## Tech notes

- `game/` is the whole game: `index.html`, ES modules under `game/src/` (one job each — world, vehicles, pedestrians, player, police, combat, missions, hud, audio, input, save, shots), and three.js r160 vendored at `game/vendor/three.min.js`
- The city, traffic and screenshot scenes are seeded (`?seed=N`), and `?shot=chase|downtown|drive|heist&seed=N` stages the deterministic scenes the screenshots in `screenshots/` were taken from
- `main.ts` hands the entry in: it copies `game/` and `screenshots/` to `/output` and writes `dossier.json` with the vendored `vendor/makefun-game.ts`. Serve locally with `node serve.ts`
