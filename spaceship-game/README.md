# Void Runner

A mobile-first 3D endless runner built with [Three.js](https://threejs.org/). Fly a spaceship through an asteroid field, skim past rocks for near-miss bonuses, and see how long you last as the speed climbs.

It runs in any modern browser with nothing to install. You can also add it to your home screen, where it runs fullscreen and works offline.

## How to play

| Action | Touch | Keyboard |
| --- | --- | --- |
| Steer | Drag anywhere, or hold the ◀ ▶ buttons | `A` / `D` or `←` / `→` |
| Pause | ❚❚ button | `Esc` / `P` |
| Start / restart | Tap the button | `Space` / `Enter` |

- **Score** goes up with distance. You get a small tick every 100 points, and every 500 points plays a chime with a banner, a shockwave and a vibration.
- **Near misses** (passing close to a rock without touching it) give bonus points and build a combo multiplier. A **PERFECT** near miss (extremely close) also slows down time briefly and gives a light vibration, at most once every 4 seconds, so it stays special.
- **Drumsticks** (◆) are placed along the safe paths through each pattern. Collect them to spend in the **Hangar**.
- **Difficulty** goes up every 20 seconds: faster speed, denser patterns, rock walls with gaps, energy barriers and drifting asteroids. The music tempo and neon colors change with each level.

## The journey: Revenge of the Space Hens

Space hens have overrun five galaxies. Open the **Star Map**, pick a galaxy, and cross it:

| # | Galaxy | New hazards | Boss |
|---|---|---|---|
| 1 | Coop Nebula | chicken formations, egg bombers (eggs crack into fried-egg puddles) | Big Hen |
| 2 | Yolk Belt | giant rolling eggs, rock walls | The Eggsecutioner (UFO) |
| 3 | Frying-Pan Cluster | fire comets, sweeping grill-laser fences | Chef Cluckington |
| 4 | Frostfeather Expanse | ice-shard fields, egg blizzards | Rooster Frost |
| 5 | Omelette Core | everything + gravity wells | The Supreme Mother Hen |

- Art direction: hand-drawn SVG icons (`src/icons.js`), shared component styles in `skin.css` and five selectable styles in `themes.css` (Settings → Style: Midnight Coop, Sunny Arcade, Comic Book, Retro Space Age, Void). Coco the chicken (`src/coco.js`) pilots the pod and guides the player.
- Each galaxy has **4 waves** (the first galaxy has 3), with a power-up choice after each wave, and then a **boss**. In boss fights your pod **auto-fires**; your job is to dodge the eggs she lays. Crashing lets you retry from the wave (or boss) you reached.
- **Tutorial:** new players are guided through one full loop (Race 1 → Dodge → Garage upgrade → Race 2) before everything unlocks.
- Beating a boss rains drumsticks, earns **1–3 stars** (★ clear, ★★ no shield lost, ★★★ flawless and 70%+ of the drumsticks), unlocks the next galaxy, and lets you **warp through hyperspace** into it.
- **🎁 Gift boxes** give a random power-up: +1 shield, Mega Magnet, Double Drumsticks, or Feather Dash (invincible and smashes through hens).
- Beating the Supreme Mother Hen unlocks **∞ Endless mode**, which cycles every galaxy with a boss every 5th wave and gets faster each loop.
- **Vibration:** use the Off / Normal / Strong toggle on the start screen.

## Race League: two journeys, one ship

The start screen offers two journeys that feed each other:

- **🐔 Dodge journey** (the galaxy campaign above) earns 🍗 drumsticks.
- **🏁 Race League**: spend those drumsticks in the **Race Garage** on Hyper Engine, Afterburners, Gravity Grip, Boost Tank and Egg-Proof Armor. Then race four chicken rivals in rocket egg-pods (Nugget, Colonel Cluck, Big Bertha, The Kentucky Flash…) on procedurally generated neon tracks.
  - **Controls:** the ship accelerates on its own, you drag (or use ◀ ▶) to steer, and you tap **BOOST** (Space / ↑ on desktop).
  - **Boost** charges from boost pads and from drafting behind rivals.
  - **Corners** push you outward, so take the inside line; Gravity Grip reduces the drift. Rocks and giant eggs on the track spin you out.
  - **Leagues:** Rookie Roost Cup, Pro Poultry Series and Grand Hen Prix, with 3 tracks each. Podium finishes win drumstick prizes and 🏆 trophies.
- **How they unlock each other:** galaxies 2–5 need 1 / 2 / 4 / 6 race trophies. The Pro league needs Galaxy 2 cleared plus 2 Rookie trophies, and the Grand Hen Prix needs Galaxy 4 cleared plus 2 Pro trophies.

## Progression

- **Hangar** (from the start or game-over screen): spend drumsticks on permanent upgrades.
  - Shield Generator: start each run with shields that absorb one hit each
  - Crystal Magnet: pull nearby drumsticks toward the ship
  - Thrusters: faster steering
  - Score Booster: more points
  - Focus Core: a wider PERFECT window and longer slow-mo
  - Lucky Star: more shield orbs
- **Ship skins:** five color schemes (Classic, Crimson, Gold Rush, Stealth, Aurora). Each one changes the hull, accents and engine trail.
- **Pilot rank:** every run earns XP equal to its score. The rank and XP bar show on the start screen, and rank-ups are celebrated on the game-over screen.
- **Power-ups during a run:** each level-up freezes the action and offers 3 random power-ups (Extra Shield, Crystal Rush, Overdrive, Nimble, Magnet Pulse, Slow Field, Daredevil). Pick one, then a 3-2-1 countdown clears the lane and play resumes.
- End-of-run payout: drumsticks collected plus a bonus of score ÷ 50. Progress is saved in the browser's localStorage.

## Features

- Procedural low-poly ship with spring-based steering, banking and engine glow
- One pooled GPU particle system for engine trails, explosions, sparks and celebrations
- Dynamic lighting: hemisphere and key lights that shift hue by level, a flickering engine light, and impact flashes
- Game feel: trauma-based screen shake, slow motion on near misses and crashes, FOV kicks, color flashes and score pop animations
- **Sound, fully generated with the Web Audio API (no audio files):** a synthwave music sequencer that adds layers as you level up, an engine hum that follows speed and steering, crash impacts, a stereo near-miss whoosh, an FM-bell milestone chime and UI blips
- **Haptics** through the Vibration API for crashes, near misses, milestones and level-ups (supported on Android; iOS Safari doesn't support vibration, so it is skipped there)
- Mobile performance: capped pixel ratio, instanced asteroids, object pooling with no allocations per frame, star and grid motion done in shaders, and an automatic switch to lower quality if the frame rate drops
- Installable PWA with a manifest and a service worker for offline play

## Run locally

It's a static site with no build step. Serve the folder with any static server (ES modules don't load from `file://`):

```bash
cd spaceship-game
python3 -m http.server 8080
# or: npx serve .
```

Open `http://localhost:8080`. To test on a phone, open `http://<your-computer-ip>:8080` on the same Wi-Fi. Note that service workers and some APIs need HTTPS unless you're on localhost.

Useful URL flags:

- `?debug` shows an FPS / draw-call overlay
- `?quality=low` or `?quality=high` forces a quality tier
- `?nosw` turns off the service worker (handy while developing)

## Deploy

Upload the contents of `spaceship-game/` to any static host. All paths are relative, so it works at a domain root or in a subfolder.

- **GitHub Pages:** in the repo settings, go to *Pages* and set *Source* to **GitHub Actions**. Then run the **Deploy Void Runner to GitHub Pages** workflow from the *Actions* tab (`.github/workflows/deploy-game.yml`).
- **Netlify / Vercel / Cloudflare Pages:** set the publish directory to `spaceship-game` and leave the build command empty.

When you release an update, bump `VERSION` in `sw.js` so returning players get the new files.

## Project layout

```
spaceship-game/
  index.html             UI shell: canvas, HUD, start / pause / game-over screens
  style.css              Mobile-first styles (safe areas, no zoom or scroll)
  manifest.webmanifest   PWA metadata
  sw.js                  Offline cache
  icons/                 App icons (SVG + PNG)
  vendor/three.module.min.js   Three.js r186, bundled locally so there's no CDN dependency
  src/
    main.js         Game loop, state machine, scoring, event wiring
    galaxies.js     Galaxy definitions (look, hazards, music, boss, jokes)
    journey.js      Campaign / endless state machine + wave director
    chickens.js     Hen formations, egg bombers, eggs, fried-egg puddles
    boss.js         Boss hens, attack patterns, grill lasers, corn missiles
    starmap-ui.js   Star Map + briefings
    race/leagues.js Leagues, tracks, chicken rivals, garage upgrades, unlock rules
    race/track.js   Seeded procedural race tracks (spline, neon road, pads, obstacles)
    race/race.js    Race session: physics, drafting, boost, AI rivals, camera, minimap
    race/race-ui.js League menu + results screen
    geo.js          Procedural vertex-coloured models (hens, drumsticks, gifts, corn)
    progression.js  Save data, Hangar upgrades, skins, ranks, power-up pool
    pickups.js      Drumsticks and shield orbs (pooled, magnet pull)
    hangar-ui.js    Hangar screen and power-up card picker
    config.js       All tuning values (speed curve, spawn rates, scoring, feel)
    renderer.js     Renderer, camera framing for portrait and landscape
    ship.js         Procedural ship model and steering physics
    obstacles.js    Pooled asteroids and barriers, patterns, collisions, near misses
    environment.js  Shader starfield, neon grid floor, horizon glow
    lighting.js     Lights and impact flashes
    particles.js    Pooled additive point-sprite particle system
    fx.js           Screen shake, slow motion, FOV kick, screen flashes
    hud.js          Score counter, popups, banners
    input.js        Touch drag, on-screen buttons, keyboard
    audio.js        Procedural music and sound effects (Web Audio API)
    haptics.js      Vibration patterns
    storage.js      Safe localStorage wrapper (best score, settings)
```

Balancing is done in `src/config.js`.
