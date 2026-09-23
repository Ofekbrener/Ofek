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
- **Near misses** (passing close to a rock without touching it) give bonus points, briefly slow down time, and build a combo multiplier.
- **Difficulty** goes up every 20 seconds: faster speed, denser patterns, rock walls with gaps, energy barriers and drifting asteroids. The music tempo and neon colors change with each level.

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
