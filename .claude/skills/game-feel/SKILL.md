---
name: game-feel
description: Use when adding or changing sound effects, music, hit reactions, animation timing, screen shake, hitstop, particles, UI button feedback or "juice" in a browser game, or when a game, attack, pickup or menu feels flat, floaty, weak, robotic, repetitive or too loud.
---

# Game feel: sound and animation

Every player action gets 3 answers at once: a sound, a motion on the thing that acted, and a reaction on the thing that was hit. A missing answer is what makes an action feel flat.

Sources: Krit's free Game Feel SFX Pack (itch.io `motionwithkrit`, Instagram `@motionbykrit`, 556 sounds synthesized in Python) and the code in `henesys-3d/src/audio.js`, `henesys-3d/tools/make-sfx.py` and `spaceship-game/src/audio.js`.

## Sound rules

1. Make 3 to 5 versions of every frequent sound (`hit_01` to `hit_05`). Pick one at random per play, never the one played last.
2. Add a random pitch of plus or minus 5% (`playbackRate` 0.95 to 1.05) on top. Variants change the timbre, pitch only changes the height.
3. Chain repeats into a rising ladder. Coin 1 to 5 in a short window climb in pitch (about 1 semitone each, `rate = 2 ** (n / 12)`). Reset the ladder after 0.6 to 1 s without a pickup.
4. Export every file at the same peak (-1 dBTP), then mix with a per-category gain table in code. Peak-equal files mean a UI tick is as loud as an explosion until the table turns it down.
5. Keep one export format for the whole set: WAV 48 kHz 24-bit during design, trimmed, with a short fade at the end. Ship as MP3 or OGG for the web.
6. Render a `PREVIEW-all-sounds` file that plays one of every sound. One listen exposes level jumps and gaps.
7. Synthesizing from code works: filtered noise, pitch sweeps, plucked strings, bell partials and a small reverb. `henesys-3d/tools/make-sfx.py` has these helpers. Code-made sounds are free to license and easy to make variants of (change the seed).
8. Sound the surface. Hail, steps and impacts need versions for grass, jelly, leaves, water, wood, stone and metal.
9. Loop ambience seamlessly (rain, wind, snow, insects, lava). Cross-fade loops, never cut them.

### Starting gain table (relative to master)

| Category | Gain | Examples |
|---|---|---|
| Boss, explosion, big impact | 1.0 | slam, golem roar, thunder |
| Hits, damage, metal | 0.7 to 0.8 | sword ting, splat, crunch |
| Magic, pickups, rewards | 0.5 to 0.6 | coin chime, sparkle, charge-up |
| Whoosh, movement | 0.3 to 0.5 | swing, dash, hop, step |
| UI | 0.25 to 0.4 | click, tick, pop, blip |
| Ambience loop | 0.1 to 0.2 | rain, wind, cicadas |

### Sound checklist for a new game

The pack's 14 categories cover what most action games need: whooshes, movement, UI, impacts, magic, weather, metal, pickups, damage, foley (wood, hinges, dust), stone, creature, fire, ambience. Also add a low-health heartbeat loop and a slow-motion sound (pitch everything down 20 to 40% while it lasts).

### Variant picker (Web Audio)

```js
// One AudioBuffer list per sound name, e.g. buffers.hit = [b1, b2, b3, b4, b5].
const last = {}, ladder = { n: 0, t: 0 };
const GAIN = { ui: 0.3, step: 0.35, whoosh: 0.4, coin: 0.55, hit: 0.75, boom: 1 };

export function play(name, { semitones = 0, category = name } = {}) {
  const list = buffers[name]; if (!list?.length) return;
  let i = Math.floor(Math.random() * list.length);
  if (list.length > 1 && i === last[name]) i = (i + 1) % list.length; // no instant repeat
  last[name] = i;
  const src = ctx.createBufferSource(), g = ctx.createGain();
  src.buffer = list[i];
  src.playbackRate.value = 2 ** (semitones / 12) * (0.95 + Math.random() * 0.1);
  g.gain.value = GAIN[category] ?? 0.6;
  src.connect(g).connect(master); src.start();
}

export function coin(now) {          // rising combo
  ladder.n = now - ladder.t < 0.8 ? Math.min(ladder.n + 1, 7) : 0;
  ladder.t = now;
  play('coin', { semitones: ladder.n });
}
```

## Animation rules

1. Anticipation, action, follow-through. A swing winds up for 60 to 120 ms, strikes in 1 to 3 frames, then settles over 150 to 300 ms.
2. Squash and stretch, volume kept: scale `y` by `s` and `x, z` by `1 / sqrt(s)`. Stretch on jump take-off (s 1.2), squash on landing (s 0.75), spring back in 120 to 200 ms.
3. Hitstop: freeze attacker and target for 40 to 80 ms on a normal hit, 100 to 150 ms on a crit or parry. Sound plays at the start of the freeze.
4. Target reaction: white flash for 1 to 2 frames, knockback away from the hit, a small squash, a damage number that pops up then falls.
5. Screen shake: decay with trauma (`offset = max * trauma ** 2`, trauma drops about 1.5 per second). Small hits 2 to 4 px, boss slams 10 to 16 px. Always offer an option to turn it off.
6. Ease every motion. Use `ease()` from `henesys-3d/src/ease.js` (frame-rate independent) for follow and camera. Use ease-out back (overshoot) for UI pop-ins and pickups.
7. UI buttons: scale to 0.92 on press within 50 ms, overshoot to 1.05 on release, back to 1 by 150 ms. Pair with a click sound and a 10 ms vibration.
8. Pickups and chests: a glow and a charge-up before the reveal, a burst of particles, the item flies to its HUD counter, and the counter bumps on arrival with the coin sound.
9. Dash: stretch along the direction, a whoosh, 3 to 5 fading after-images and dust at the start.
10. Weather and ambience: particles react to surfaces (splash on water, bounce on jelly) and share the surface sound from sound rule 8.

## Timing table

| Event | Sound | Motion | Duration |
|---|---|---|---|
| Light hit | hit variant, plus or minus 5% pitch | hitstop, flash, 3 px shake | 50 ms stop |
| Crit or parry | metal ting plus low boom | hitstop, 8 px shake, slow motion 0.3x | 120 ms stop, 300 ms slow |
| Jump | hop | stretch 1.2 | 120 ms |
| Land | soft thud, by surface | squash 0.75, dust | 150 ms |
| Coin | rising chime ladder | fly to HUD, counter bump | 400 ms |
| Button | click | 0.92 press, 1.05 release | 150 ms |
| Low health | heartbeat loop | red vignette pulse, synced to beat | while HP under 25% |

## Common mistakes

- One file per sound, so repeats sound like a machine gun. Fix with rule 1 and 2.
- All files at full peak with no gain table, so menus are painful. Fix with rule 4.
- The sound starts after the hitstop ends, so the hit feels late. Start the sound on the impact frame.
- Shake on every small event, so big events stop reading. Keep shake for hits that matter.
- Linear motion with no easing, so things feel robotic.
- An AudioContext created before a tap. Mobile browsers need it created or resumed on the first `pointerdown` (see `henesys-3d/src/audio.js`).
