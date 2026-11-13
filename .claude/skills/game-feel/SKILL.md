---
name: game-feel
description: Use when building or polishing any game (canvas, HTML, Phaser, Three.js, Unity-style loops) and hits, jumps, shots, kills or pickups feel flat, weak, floaty or unsatisfying; also when asked to add "juice", game feel, impact, screen shake, hitstop, particles or animation polish.
---

# Game Feel (Juice)

## Overview

A hit feels strong when 5 to 8 small effects fire in the same frame.
Each effect alone is barely noticed. Together they tell the player "that landed".
Wire every effect to one event function (`onHit`, `onKill`), so adding a feature means adding one line there.

## Quick reference

| Effect | What it does | Starting numbers |
|---|---|---|
| Hitstop | Freeze the update loop, keep drawing | 50 to 70 ms per hit, 100 to 130 ms per kill, 130 ms when player is hurt |
| Screen shake | Offset + rotate camera by `trauma²` | add 0.2 per hit, 0.45 per kill, 0.7 when hurt; decay 1.6 per second; max 24 px, 0.05 rad |
| Squash and stretch | Scale x and y opposite ways, spring back | attacker 1.35 x 0.7 on swing; victim 0.6 x 1.45 on impact; return with exponential lerp |
| Hit flash | Draw the sprite pure white | 80 to 120 ms |
| Knockback | Set victim velocity away from attacker | 500 px/s on hit, 900 px/s on kill, then friction |
| Attacker lunge | Push attacker toward the target | 200 to 300 px/s |
| Camera kick | Nudge camera toward the attack, spring back | 8 to 12 px, lerp 0.2 per frame |
| Particles | Burst of dots with drag and fade | 8 to 12 on hit, 25 to 35 on kill; speed 250 to 600; life 0.25 to 0.9 s |
| Decals | Marks that stay on the floor | 4 to 6 per kill, cap the array at about 150 |
| Gibs | One big piece flies with gravity and spin | gravity 900 px/s², spin ±14 rad/s |
| Pop text | Score number scales in with overshoot, rises, fades | easeOutBack over 120 ms, total life 0.9 s |
| Combo counter | Count hits in a window; bigger text and higher pitch per hit | window 1.6 s; font +1.5 px and sound +12 Hz per combo step |
| Slow motion | Multiply dt by a time scale on big moments | 0.25 for 0.7 s on wave clear, plus zoom 1.15 |
| Screen flash | White full-screen overlay | alpha 0.3 to 0.5, fade in 0.3 s |
| Spawn pop-in | Warning ring first, then scale 0 to 1 with overshoot | 0.3 to 0.6 s telegraph |
| Invulnerability blink | Toggle visibility after damage | 1 s, 20 Hz |
| Low-HP vignette | Pulsing red edge | below 30% HP, sin pulse 6 rad/s |
| Sound | Short synth blip per event, pitch varies | 60 to 150 ms; noise burst for impact, falling pitch for hits |
| Motion trail / swing arc | Draw the attack's path, fade with the attack timer | 150 to 200 ms |
| Movement dust and bob | Small puffs and vertical bob while moving | spawn when speed over 200 px/s |

## The core loop pattern

```js
let hitstop = 0, trauma = 0, timeScale = 1, slowT = 0;

function update(dt) {
  if (hitstop > 0) { hitstop -= dt; return; }        // freeze game, keep rendering
  if (slowT > 0) { slowT -= dt; timeScale += (0.25 - timeScale) * 0.2; }
  else timeScale += (1 - timeScale) * 0.1;
  dt *= timeScale;
  // ... game logic with dt ...
  trauma = Math.max(0, trauma - dt * 1.6);
  // frame-rate independent spring back to 1
  e.sx += (1 - e.sx) * (1 - Math.pow(0.0001, dt));
}

function draw() {
  const s = trauma * trauma, t = performance.now() / 1000;
  const ox = s * 24 * Math.sin(t * 93), oy = s * 24 * Math.cos(t * 87);
  ctx.translate(W / 2 + ox, H / 2 + oy);
  ctx.rotate(s * 0.05 * Math.sin(t * 71));
  // ... camera, world, then HUD without shake ...
}

function onHit(attacker, victim, killed) {
  hitstop = killed ? 0.11 : 0.06;
  trauma = Math.min(1, trauma + (killed ? 0.45 : 0.22));
  victim.flash = 0.12;
  victim.sx = 0.6; victim.sy = 1.45;
  const d = Math.hypot(victim.x - attacker.x, victim.y - attacker.y) || 1;
  const kb = killed ? 900 : 520;
  victim.vx = (victim.x - attacker.x) / d * kb;
  victim.vy = (victim.y - attacker.y) / d * kb;
  burst(victim.x, victim.y, killed ? 30 : 10);
  popText(victim.x, victim.y - 30, '+10');
  playHitSound(combo);
}
```

```js
const easeOutBack = t => 1 + 2.7 * Math.pow(t - 1, 3) + 1.7 * Math.pow(t - 1, 2);
```

## Order of work in a new game

1. Get the mechanic working with plain rectangles.
2. Add `onHit` / `onKill` / `onHurt` / `onWaveClear` functions.
3. Add hitstop, shake, flash and knockback first. These four carry most of the impact.
4. Add squash/stretch and particles.
5. Add sound. Audio needs a user gesture, so create the AudioContext on the Start button.
6. Add text, combos, slow motion and vignette last.
7. Play 30 seconds. Remove any effect that hides what is happening on screen.

## Scaling by event size

Every effect takes a bigger value for a bigger event: hit < kill < player hurt < wave clear.
The player reads the size of the event from the size of the reaction.
The player getting hurt gets the strongest shake and a red flash so it never feels like a reward.

## Common mistakes

- Shaking the HUD. Apply shake to the world transform only.
- Hitstop that also freezes rendering. The frame must keep drawing so the flash and pose stay visible.
- Linear shake (`trauma`) in place of `trauma²`. Small hits then look as strong as big ones.
- Using `lerp(a, b, 0.1)` per frame for springs. Use `1 - Math.pow(k, dt)` so 30 fps and 144 fps look the same.
- Unbounded particle and decal arrays. Cap them or filter dead ones each frame.
- Same sound pitch every time. Vary pitch by ±10% or by combo count.
- No telegraph on enemy spawn. A 0.3 to 0.6 s warning ring makes spawns fair.
- Too much at once. If the screen is unreadable, lower shake first, then particle counts.
- Ignoring `prefers-reduced-motion`. Halve shake and disable flashes when it is set.

## Reference implementation

Single-file canvas example: see `example-arena.html` next to this file for a full canvas game that uses every effect in the table.

## Lessons from the 3D rebuild (zombie-game/)

- Use authored animation clips for attacks. Procedural arm posing on a rig without attack clips reads as the same move every time. Pick a kit that ships Slash, Stab, Punch, HitReact and Death clips.
- Vary a combo with what you have: different clips per step, a mirrored body (`scale.x = -1`) for a backhand, a full-body spin for the finisher, and running variants (Run_Slash) when the player moves.
- Land damage at a per-clip hit time (Slash 0.42, Stab 0.45 of the clip). Play the swing sound about 70 ms before it. The wind-up is the anticipation.
- Enemies get telegraphed attacks too: authored Punch clip, damage at 45% of it, only if the player is still in reach and in front. Bosses telegraph with ground decals (a charge lane, a slam circle) for about 1 s.
- Sound: one recorded sample family per event, 2 to 6 variations, ±6% pitch, max 3 voices per family, a limiter on the master bus, music ducked on kills. Mixing recorded and oscillator-made effects sounds wrong; use recordings only.
- Upgrade cards need art and numbers: render weapon meshes to images once at load, give perks drawn emblems colored by category, show the stat change (`5 → 6`) and compare weapons with bars against the current one.
- Software-rendered test browsers run at about 5 fps. Expose a `simulate(seconds)` hook so tests advance game time without rendering.
- A swing nobody can see is no swing. Draw a ribbon trail between the weapon's base and tip for the active frames, color it per weapon, and emit particles from the tip (embers, sparks, splinters, notes, frost).
- Clips that only move the arm read small from a top-down camera. Layer a torso twist on top: turn away during the wind-up, whip through on the strike. Play the wind-up at 0.6x and the strike at 1.7x.
- Each weapon needs its own verb, not only its own numbers: a status effect on hit (burn, bleed stacks, stun) and a 4th-hit finisher (flurry, thrown javelin, home run, spinning grind, fire line, cone shockwave).
- Upgrades should build on what the player already has. Swapping the main weapon every draft erases mastery; weapon levels, stacking elements and auto-attacking gear keep the run growing.
- Give enemies attack tokens: at most 2 or 3 swing at once while the rest crowd. A crowd stays scary without stacking unavoidable damage.
- Fill a meter from hits and kills and fire a short power-up when it is full. Sell each one with a slow-motion start, a banner, a screen-edge glow, an aura, a timer ring under the feet and its own sound.
- Balance with a bot: a scripted player run through `simulate()` across 5 seeds tells you which wave kills a simple player, before and after a change.
