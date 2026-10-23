# Henesys 3D

A 3D tribute to MapleStory Classic for phone browsers. It has two maps: the town of Henesys and the Henesys Hunting Ground.

## Play

The first screen is the character creator. You pick a name, one of 5 hair styles, hair, skin, eye, shirt and pants colours, and pants or a skirt. A 3D preview shows each change.


- Drag on the left half of the screen to move. The joystick appears under your thumb. With the default Classic controls, up walks forward, down walks backward, and left or right turns on the spot. Settings has a Free mode where you walk wherever you push.
- Drag on the right half to look around. The camera settles back behind your character. Pinch with two fingers to zoom.
- **Attack** hits the nearest monster in range. Hold it to keep attacking.
- **Jump**, the two skill buttons, and the Red and Blue Potion buttons sit next to it. A Red Potion heals 50 HP and a Blue Potion restores 100 MP.
- Tap an NPC to talk to them.
- Walk into the swirl at the east gate to reach the Hunting Ground.
- At level 10, pick a job from Athena Pierce (Bowman), Dances with Balrog (Warrior), Grendel the Really Old (Magician) or Dark Lord (Thief). Each job has 4 skills, which unlock at levels 10, 13, 16 and 20.

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
- Characters, animations, trees and props come from the KayKit packs by Kay Lousberg (CC0). `tools/build-assets.mjs` downloads them and makes them smaller; see `assets/CREDITS.md`. The monsters and mushroom houses are built in code in `src/assets/`.
- Sound effects are synthesised with Web Audio.

## Credits

This is a fan project. MapleStory, Henesys and all characters belong to Nexon. The project is not affiliated with Nexon and is not for sale.
