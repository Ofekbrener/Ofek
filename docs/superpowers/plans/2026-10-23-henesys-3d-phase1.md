# Henesys 3D Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans (native, as chosen for the first plan). Steps use checkbox syntax.

**Goal:** KayKit skeletal characters, 5 jobs with 4 skills each, Classic camera, upgraded mobs and scenery.

**Architecture:** A Node build script turns the KayKit CC0 packs into small GLB files under `henesys-3d/assets/`. A loader module clones skinned characters and drives an AnimationMixer behind the same CharModel interface the game uses today. Skills move from hard-coded combat branches into data (`SKILLS`) plus a small effect registry.

**Tech Stack:** Three.js r186 plus `GLTFLoader` and `SkeletonUtils` from the same release (vendored), `@gltf-transform/core` and `@gltf-transform/functions` (tools only), `node:test`, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-23-henesys-3d-phase1-visuals-jobs.md`

## Global Constraints

- Assets total ≤ 6 MB. CC0 credits in `henesys-3d/assets/CREDITS.md`.
- The CharModel interface stays: `{ object3d, height, setWeapon(job), animate(state, dt, t, speed), attack(kind?), hit(), cast() }`. Every animation crossfades over 0.15 to 0.25 s.
- Skill unlock levels are 10, 13, 16 and 20. Main stats: Warrior STR, Magician INT, Bowman DEX, Thief LUK.
- Default camera distance is 1.5× today's (9 m). Pinch zoom ranges from 0.6× to 1.6×. Classic controls are the default.
- Old saves load: look numbers and look objects normalise, and missing `int`/`luk` default to 4.

## Review Focus

1. Assets fail to load (offline first visit, 404): show an error with a Retry button. A blank screen is not acceptable.
2. A skill used with too little MP, before its unlock level, or during its cooldown does nothing and shows a reason.
3. Buffs survive a map change and expire on time. Dark Sight ends early when the player attacks.
4. Pinch zoom and joystick at once: each pointer keeps its role.
5. A save from before this phase (job bowman, look 0..2 or an object) loads into a valid KayKit character.

---

### Task 1: Asset pipeline

- Create `henesys-3d/tools/build-assets.mjs`, `henesys-3d/tools/package.json`, `henesys-3d/assets/CREDITS.md`, and `henesys-3d/vendor/addons/` (GLTFLoader, SkeletonUtils, BufferGeometryUtils from three r186).
- Output: `assets/chars/{Knight,Barbarian,Mage,Rogue,Rogue_Hooded}.glb` with no animations, `assets/anims.glb` (animation clips only, about 30 chosen clips), and `assets/props/*.glb` (trees, rocks, crates, barrels, tent, target, flags, weapon rack, fences).
- Test: the script prints the total size and fails above 6 MB. A Node test parses each GLB header and checks the expected clip names in `anims.glb`.

### Task 2: Rules for jobs, skills, buffs and appearance

- `config.js`: JOBS for 5 jobs (stat, weapon, skills[4]). SKILLS for 16 skills, each `{ name, job, level, mp, cooldown, kind: 'melee'|'projectile'|'aoe'|'buff'|'heal'|'rain', hits, multiplier, range, duration?, effect? }`.
- `rules/stats.js`: add `int` and `luk`; `advance` for 4 jobs; `skillState(c, id, now) -> { ok, reason }`.
- `rules/buffs.js`: `applyBuff(c, id, now)`, `activeBuffs(c, now)`, `modifiers(c, now) -> { dmg, crit, speed, hidden }`.
- `rules/appearance.js`: `hairStyle` becomes one of `rogue|knight|mage|barbarian|hooded`, mapped from old values.
- `rules/controls.js`: `classicStep(input, facingYaw, dt) -> { yaw, dx, dz, back }`.
- Tests for each rule, written first.

### Task 3: KayKit character model

- `src/assets/kaykit.js`: `loadKayKit(onProgress)` and `buildHero(look, job)`; NPCs come from `buildNpc(id)` built on top of it. Texture recolour by hue, cached per look. Weapons and accessories visible per job. Animation state machine with crossfade.
- A loading screen with progress, and an error with Retry.
- `preview.html` lists the KayKit characters too. The screenshot soak passes.

### Task 4: Camera and Classic controls

- Player movement uses `classicStep` in Classic mode and the current code in Free mode. Camera distance 9 m. Pinch zoom in `input.js`. The setting lives in the settings panel and is saved with `saveSettings`.
- Tests: unit tests for `classicStep`; a smoke test that pushes back on the stick, moves backwards and keeps the facing.

### Task 5: Skills in combat and HUD

- `combat.js` dispatches on `skill.kind`. Effects in `fx.js` per skill: bolt, claw, thunder, heal, star throw, double stab, rain, spin, rage aura, focus aura, haste trail, dark sight fade.
- HUD shows 4 skill buttons with lock levels, cooldown sweep, and buff icons with timers.
- New NPCs Grendel and Dark Lord give the new jobs.
- E2E test `tests/jobs.mjs`: for each job, advance, set level 20, fire all 4 skills, and check that MP drops, buffs apply and there are no errors.

### Task 6: Mob upgrade

- Reworked mob models with more detail and shared materials per type where the death fade allows it. Add an attack lunge on contact and a better death (squash, then a puff).
- Preview soak passes.

### Task 7: Scenery

- KayKit trees, rocks and props in both maps. Mushroom houses get stone bases, window frames and lanterns. Ground texture with stones on the paths.
- The smoke test still passes. Screenshots reviewed.

### Task 8: Verify, review, deploy

- All unit tests and the smoke, save, juice, regression and jobs tests pass. Final fresh reviewer. Merge to main and deploy.
