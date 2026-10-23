# Henesys 3D

A 3D tribute to MapleStory Classic for phone browsers. It has two maps: the town of Henesys and the Henesys Hunting Ground.

## Play

- Drag on the left half of the screen to walk. The joystick appears under your thumb.
- Drag on the right half to turn the camera.
- **Attack** hits the nearest monster in range. Hold it to keep attacking.
- **Jump**, the two skill buttons, and the Red and Blue Potion buttons sit next to it. A Red Potion heals 50 HP and a Blue Potion restores 100 MP.
- Tap an NPC to talk to them.
- Walk into the swirl at the east gate to reach the Hunting Ground.
- At level 10, talk to Athena Pierce (Bowman) or Dances with Balrog (Warrior) to pick a job.

On a computer: WASD moves, Space jumps, J attacks, K and L use skills, 1 and 2 drink potions.

Progress is saved on the phone (localStorage) after every kill and pickup, on every map change, when you leave the page, and every 15 seconds. A returning player goes straight back into the game. To start over, open Settings and tap New character. Add the page to the home screen and it runs full screen and offline.

## Monsters

Kills pay 4x the classic EXP, so level 10 takes about 10 minutes. Each zone holds up to 8 monsters (20 in total), and a monster respawns 4 seconds after it dies.

| Monster | Level | HP | EXP (classic ×4) | Zone |
|---|---|---|---|---|
| Snail | 1 | 8 | 12 | near the portal |
| Blue Snail | 2 | 15 | 16 | near the portal |
| Red Snail | 4 | 45 | 32 | middle |
| Slime | 6 | 50 | 40 | middle |
| Orange Mushroom | 8 | 80 | 60 | far east |

## Run locally

```bash
npx http-server henesys-3d -p 8080
# open http://localhost:8080
```

`preview.html` shows every model with its animations.

## Test

```bash
node --test 'henesys-3d/tests/*.test.js'   # rules: stats, drops, spawning, collision, saves
node henesys-3d/tests/smoke.mjs             # end-to-end in phone-sized Chromium (Playwright)
node henesys-3d/tests/regressions.mjs       # fixed bugs stay fixed
node henesys-3d/tests/save.mjs              # saving and returning players
node henesys-3d/tests/juice.mjs             # hit stop, combo, particles, level-up effects
node henesys-3d/tests/preview-shots.mjs out # screenshot every model
```

## How it is built

- Three.js r186 loads as a plain ES module. There is no build step.
- `src/rules/` holds the game logic (stats, drops, spawning, collision) as pure functions. Node tests them without a browser.
- Every model is built in code from primitives, lathe shapes and Canvas textures, in `src/assets/`. The project has no image or model files.
- Sound effects are synthesised with Web Audio.

## Credits

This is a fan project. MapleStory, Henesys and all characters belong to Nexon. The project is not affiliated with Nexon and is not for sale.
