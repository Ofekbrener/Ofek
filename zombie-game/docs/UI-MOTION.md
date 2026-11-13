# Zombie Raid: UI and Motion Guide

UI and motion rules for Zombie Raid, a 3D zombie brawler built with Three.js and plain HTML/CSS and shipped in an Android WebView.

## How to read this guide

- Tags in square brackets mark rules that come from the source sites. The tag names the site, the section and the pattern.
  - `[UMP § Button Part 1 › Press Down]` means UI Motion Prompts (https://ui-motion-prompts.pages.dev/), page "Button Part 1", pattern "Press Down".
  - `[UMP § Components › Shine Sweep]` means the site's components page (`/components.html`).
  - `[GFP § Health Bar Part 1 › Delayed Chip]` means Game Feel Prompts (https://game-feel-prompts.pages.dev/). That is a sister site that UMP links from its footer. It covers game effects, so it applies to the HUD.
- Rules with no tag are adaptations for Zombie Raid, such as WebView performance, touch input and game flow.
- What the sources contain: each UMP pattern page shows one free full prompt. The other five prompts on each page are locked behind a paid pack. GFP pages show short specs for every item and a fuller spec for one. This guide uses only the free parts. The prompts are restated here as specs with their exact numbers. They are not reproduced word for word.
- What the sources do not contain: the sites give no cubic-bezier values. They describe easing as formulas, for example ease-out = `1 − (1 − k)³`. The beziers below are the standard curve for each formula. Spring curves are sampled from the sites' own spring formula into CSS `linear()` strings.
- Every UMP demo runs on a 470×222 or 470×240 canvas and loops every 4 s. Translate pixel sizes to your layout. Keep the timings, ratios, springs and staggers as they are.

---

## 1. Principles

1. **Feedback starts the moment the finger lands.** The press-in takes 100 ms with ease-out cubic. *Reason:* in a brawler the player has to feel that the input registered before the action resolves. A late press reads as input lag. `[UMP § Button Part 1 › Press Down]`
2. **Release with a spring, not a tween.** Buttons come back on a damped spring with ω₀ 22 and ζ 0.45, which settles in about 540 ms with a small overshoot. Nearly every UMP pattern uses this spring for presses. *Reason:* the overshoot reads as a physical rebound, and one shared spring keeps every button feeling like the same material. `[UMP § Cart Part 1 › Fly to Cart]` `[UMP § Rating Part 1 › Star Cascade]` `[UMP § Accordion Part 1 › Chevron Rotate]` `[UMP § Progress Steps Part 1 › Numbered Steps]`
3. **Press depth matches the element's weight.** Use a 12% dip for hero CTAs, 8% for normal buttons and 3% for list rows. *Reason:* big targets can travel further without looking broken, and rows that dip deep make a list look like it is wobbling. `[UMP § Button Part 2 › Hold to Confirm]` (8%) `[UMP § Search Part 1 › Icon Expand]` (depth 0.12) `[UMP § Bottom Sheet Part 2 › Stacked Sheets]` (row 3%)
4. **One element, two springs.** When something travels, such as a tab pill or a selection highlight, drive its leading edge with a fast spring (19/0.55) and its trailing edge with a slower one (11/0.72). *Reason:* the shape stretches while it moves and catches up when it lands, which shows direction and speed with no extra effects. `[UMP § Tab Bar Part 1 › Sliding Pill]` `[UMP § Tab Bar Part 4 › Frosted Glide]`
5. **Stagger in order, reverse on exit.** Items enter one by one from the first, and leave in reverse with a slightly shorter stagger: 120 ms per item in and 100 ms out. *Reason:* the eye follows the order the content is read in, and a reverse exit feels like the screen rewinding rather than collapsing. `[UMP § Accordion Part 2 › Expand All]` `[UMP § Rating Part 1 › Star Cascade]` (fill 70 ms in, reset 60 ms reversed)
6. **Errors shake with a decaying sine, not a fixed wiggle.** Use x = A·sin(2π·9·t)·e^(−6t) for 800 ms with A = 13 to 14 px, together with a red border in 80 ms and a message that slides down 13 px. *Reason:* the decay makes it read as one bump that settles. A constant shake reads as a bug. `[UMP § Error Part 1 › Shake Input]` `[UMP § Error Part 2 › Offline]`
7. **Success has an order: wind-up, fill, mark, pop, echo.** First a 1 → 0.9 → 1 squeeze, then the fill, then the check draws in 250 ms, then a pop of 1 → 1.12 to 1.15 → 1, then rings at 150 ms intervals. *Reason:* each beat confirms the one before it, so a reward feels earned instead of just appearing. `[UMP § Done Part 1 › Check Draw]` `[UMP § Done Part 2 › Ripple Ring]`
8. **Overshoot about 12%, never more on UI.** The site's back ease peaks at about 112%. *Reason:* that is enough to feel alive without turning the HUD into a toy. Save bigger overshoots (140 to 150%) for one-off reward moments. `[UMP § Like Part 1 › Heart Burst]` (back ease) `[GFP § Combo Counter Part 1 › Number Punch]` (150%) `[GFP § Rare Pull Part 1 › Star Count]` (140%)
9. **Numbers move, they do not swap.** Digits roll or punch when they change, and the rightmost digit moves first. *Reason:* the change itself is the information. A silent swap of 1,240 to 1,190 hides the fact that the player just spent 50 coins. `[UMP § Number Counter Part 1 › Odometer Roll]` `[GFP § Combo Counter Part 1 › Rolling Digits]`
10. **Damage shows twice: the instant hit, then a lingering chip.** HP drops at once. A lighter chip stays for 250 ms, then drains over 300 ms. *Reason:* the player sees both the new value and how much was lost. `[GFP § Health Bar Part 1 › Delayed Chip]`
11. **Game feedback is short and hard.** Hit-stop is 120 ms, a white flash lasts 2 to 3 frames and screen shake is 10 px for about 260 ms. *Reason:* combat happens at frame scale. Anything longer blocks the next input. `[GFP § Hit Feedback Part 1 › Hit Stop / White Flash / Screen Shake]`
12. **Overlays open from where they are anchored.** Popups scale up from their trigger: 0.15 → 1 on spring 16/0.7 for anchored menus, and 0.72 → 1 with back ease for centered dialogs. *Reason:* the origin tells the player what caused the panel and where it will go back to. `[UMP § Menu Part 3 › Anchor Pop]` `[UMP § Dialog Part 1 › Scale Pop]`
13. **Exits are faster than entrances.** A dialog opens in 420 ms and closes in 240 ms after a 60 ms delay. *Reason:* the player has already decided to leave, so a slow exit is just waiting. `[UMP § Dialog Part 1 › Scale Pop]`
14. **Depth comes from dimming and scale, not blur.** The screen behind drops to 94% scale with a 0.45 to 0.55 dim. *Reason:* it reads clearly, and in a WebView `backdrop-filter` and animated blur cost far more than a dim layer. `[UMP § Bottom Sheet Part 2 › Stacked Sheets]` `[UMP § Bottom Sheet Part 1 › Snap Points]`
15. **Animate only `transform`, `translate`, `scale`, `rotate` and `opacity` in the DOM.** *Reason:* the Three.js canvas already uses the GPU. Animating `width`, `top`, `box-shadow` or `filter` forces layout or paint on every frame, which costs frame time in the 3D scene on mid-range Android phones.
16. **The HUD updates on events, not on every frame.** Write to the DOM only when HP, coins or combo actually change. *Reason:* writing every frame from the render loop causes style recalculation 60 times per second for nothing.
17. **Never block input with motion.** A tap during an animation cancels it or jumps it to the end, except where a misclick would waste a pick (see the card draft). *Reason:* players tap fast, and UI that ignores taps feels broken.
18. **Respect reduced motion.** Under `prefers-reduced-motion: reduce`, keep the press feedback and color changes. Drop shakes, travel over 12 px and looping idle effects.

---

## 2. Motion tokens

### 2.1 Easing

| Token | Formula from the site | cubic-bezier | Source |
|---|---|---|---|
| `--ease-out` | 1 − (1 − k)³ | `cubic-bezier(0.33, 1, 0.68, 1)` | `[UMP § Button Part 1 › Press Down]` and most pages |
| `--ease-in` | k³ | `cubic-bezier(0.32, 0, 0.67, 0)` | `[UMP § Like Part 1 › Heart Burst]` |
| `--ease-in-out` | 4k³ for k < 0.5, else 1 − (−2k + 2)³/2 | `cubic-bezier(0.65, 0, 0.35, 1)` | `[UMP § Carousel Part 1 › Pill Dots]` |
| `--ease-out-quad` | 1 − (1 − k)² | `cubic-bezier(0.5, 1, 0.89, 1)` | `[UMP § Pull to Refresh Part 1 › Spoke Reveal]` |
| `--ease-back` | 1 + 2.9(k − 1)³ + 1.9(k − 1)², peak 112% | approx. `cubic-bezier(0.34, 1.6, 0.64, 1)`; exact: `linear()` below | `[UMP § Like Part 1 › Heart Burst]` `[UMP § Notifications Part 1 › Island Expand]` |
| `--ease-back-punch` | easeOutBack with c = 1.70158 | `cubic-bezier(0.34, 1.56, 0.64, 1)` | `[GFP § Combo Counter Part 1 › Number Punch]` |

### 2.2 Springs

The site's spring formula, used everywhere: x(t) = 1 − e^(−ζω₀t)·(cos ω_d t + (ζω₀/ω_d)·sin ω_d t), with ω_d = ω₀·√(1 − ζ²). `[UMP § Notifications Part 1 › Island Expand]`

The "settle" column gives the time until the curve stays within 0.5% of 1. Use it as the CSS duration together with the `linear()` token.

| Token | ω₀ | ζ | Settle | Peak | Use | Source |
|---|---|---|---|---|---|---|
| `--spring-press` | 22 | 0.45 | 540 ms | 120.5% | Button release, row press | `[UMP § Cart Part 1 › Fly to Cart]` and about 20 other pages |
| `--spring-press-deep` | 20 | 0.42 | 590 ms | 123.4% | Big 3D CTA release (PLAY) | `[UMP § Button Part 1 › Press Down]` |
| `--spring-hold-release` | 18 | 0.55 | 520 ms | 112.6% | Release after hold to confirm | `[UMP § Button Part 2 › Hold to Confirm]` |
| `--spring-lead` | 19 | 0.55 | 490 ms | 112.6% | Leading edge of a moving pill | `[UMP § Tab Bar Part 1 › Sliding Pill]` |
| `--spring-trail` | 11 | 0.72 | 650 ms | 103.8% | Trailing edge of a moving pill | `[UMP § Tab Bar Part 1 › Sliding Pill]` |
| `--spring-sheet` | 15 | 0.6 | 610 ms | 109.5% | Panels, sheets, speed-dial open | `[UMP § Bottom Sheet Part 1 › Snap Points]` `[UMP § Floating Button Part 1 › Speed Dial]` |
| `--spring-island-open` | 13 | 0.6 | 700 ms | 109.5% | Radio box expand | `[UMP § Notifications Part 1 › Island Expand]` |
| `--spring-island-close` | 15 | 0.62 | 610 ms | 108.4% | Radio box collapse | `[UMP § Notifications Part 1 › Island Expand]` |
| `--spring-stack` | 14 | 0.72 | 510 ms | 103.8% | Second panel over the first | `[UMP § Bottom Sheet Part 2 › Stacked Sheets]` |
| `--spring-select` | 16 | 0.62 | 560 ms | 108.4% | Segment thumb, selection halo | `[UMP § Segmented Control Part 1 › Sliding Thumb]` `[UMP § Color Picker Part 1 › Halo Slide]` |
| `--spring-anchor` | 16 | 0.7 | 440 ms | 104.6% | Popover from its anchor | `[UMP § Menu Part 3 › Anchor Pop]` |

### 2.3 Durations (ms)

| Token | Value | Use | Source |
|---|---|---|---|
| `--d-press-in` | 100 | Press depth in | `[UMP § Button Part 1 › Press Down]` |
| `--d-press-in-hud` | 50 | HUD combat buttons | Adaptation, half of the above |
| `--d-ripple` | 400 | Touch ring 23 → 52 px, opacity 0.7 → 0 | `[UMP § Button Part 1 › Press Down]` |
| `--d-fade-quick` | 160 | Overlay opacity in | `[UMP § Dialog Part 1 › Scale Pop]` |
| `--d-dialog-in` | 420 | Dialog scale in | `[UMP § Dialog Part 1 › Scale Pop]` |
| `--d-dialog-out` | 240 (+60 delay) | Dialog out | `[UMP § Dialog Part 1 › Scale Pop]` |
| `--d-move` | 450 | Step or node move, in-out | `[UMP § Progress Steps Part 1 › Numbered Steps]` |
| `--d-row-open` | 300 | Expanding row | `[UMP § Accordion Part 2 › Expand All]` |
| `--d-check-draw` | 250 | Check mark draw, ease-out | `[UMP § Done Part 1 › Check Draw]` |
| `--d-pop` | 450 | Badge pop 1 → 1.12 → 1 (half sine) | `[UMP § Done Part 1 › Check Draw]` |
| `--d-pop-fast` | 350 | Pop 1 → 1.15 → 1 | `[UMP § Done Part 2 › Ripple Ring]` |
| `--d-echo` | 900 | Success ripple ring 1 → 3.7× radius | `[UMP § Done Part 2 › Ripple Ring]` |
| `--d-shake-ui` | 800 | Error shake | `[UMP § Error Part 1 › Shake Input]` |
| `--d-digit-roll` | 600 | Odometer digit roll, ease-out | `[UMP § Number Counter Part 1 › Odometer Roll]` |
| `--d-digit-roll-fast` | 160 | HUD digit roll | `[GFP § Combo Counter Part 1 › Rolling Digits]` |
| `--d-count-roll` | 220 | Count roll | `[GFP § 6 Ways to Say Success Part 1 › Count Roll]` |
| `--d-hitstop` | 120 | Freeze on contact | `[GFP § Hit Feedback Part 1 › Hit Stop]` |
| `--d-screenshake` | 260 | 10 px shake, (1 − t/0.26)² falloff | `[GFP § Hit Feedback Part 1 › Screen Shake]` |
| `--d-flash` | 33 to 50 (2 to 3 frames) | White hit flash | `[GFP § Hit Feedback Part 1 › White Flash]` `[GFP § Health Bar Part 1 › Flash White]` |
| `--d-chip-hold` | 250 | Delayed chip linger | `[GFP § Health Bar Part 1 › Delayed Chip]` |
| `--d-chip-drain` | 300 | Delayed chip drain, ease-out | `[GFP § Health Bar Part 1 › Delayed Chip]` |
| `--d-bar-shake` | 300 | 8 px bar shake fade | `[GFP § Health Bar Part 1 › Bar Shake]` |
| `--d-coin-fly` | 350 | Coin arc to HUD | `[GFP § Coin Pickup Part 1 › Fly to HUD]` |
| `--d-float` | 600 | "+1" rises 36 to 40 px and fades | `[GFP § Coin Pickup Part 1 › Floating +1]` `[GFP § 6 Ways to Say Success Part 1 › +1 Float]` |
| `--d-combo-punch` | 50 up + 250 back | Combo number 100 → 150% → 100% | `[GFP § Combo Counter Part 1 › Number Punch]` |
| `--d-combo-window` | 1000 | Combo timer drain | `[GFP § Combo Counter Part 1 › Combo Timer]` |
| `--d-vignette` | 500 | Red damage vignette fade | `[GFP § Taking Damage Part 1 › Red Vignette]` |
| `--d-iframes` | 600 | Blink every 2 frames | `[GFP § Taking Damage Part 1 › Blink I-Frames]` |
| `--d-card-flip` | 300 | Card flip reveal | `[GFP § Card Draw Part 1 › Flip Reveal]` |
| `--d-card-snap` | 150 | Card zip and squash 120% × 80% | `[GFP § Card Draw Part 1 › Snap Squash]` |
| `--d-shine` | 250 | Rarity shine sweep | `[GFP § Card Draw Part 1 › Rarity Shine]` |
| `--d-idle-shine` | 600 per 4000 loop | CTA idle shine | `[UMP § Cart Part 2 › Mini Cart Toast]` |
| `--d-halo` | 2000 period | Halo pulse, grows 3 to 7 px | `[UMP § Checkbox Part 1 › Circle to Check]` `[UMP § Search Part 1 › Icon Expand]` |
| `--d-caret` | 1000 period | Caret blink | `[UMP § Text Field Part 1 › Floating Label]` |
| `--d-type-char` | 40 (25 chars/s) | Typewriter text | `[UMP § Send Part 1 › Bubble Rise]` |
| `--d-gray-out` | 250 | Game over desaturate | `[GFP § Game Over Part 1 › Gray Out]` |
| `--d-iris` | 300 | Iris-out close | `[GFP § Game Over Part 1 › Iris Out]` |
| `--d-screen` | 360 | Screen push slide | Adaptation: the free Push Slide prompt gives no duration |

### 2.4 Scale and offset amounts

| Token | Value | Source |
|---|---|---|
| Press, hero CTA | 0.88 | `[UMP § Rating Part 2 › Star Bounce]` `[GFP § 6 Ways to Say Success Part 1 › Press Pop]` |
| Press, normal button | 0.92 | `[UMP § Cart Part 1 › Fly to Cart]` `[UMP § Floating Button Part 1 › Speed Dial]` |
| Press, row | 0.97 | `[UMP § Accordion Part 1 › Chevron Rotate]` |
| Press, 3D button face | moves down 15.3 px of an 84 px button (18% of height); base stays put | `[UMP § Button Part 1 › Press Down]` |
| Hold pop | +12% over 300 ms | `[UMP § Button Part 2 › Hold to Confirm]` |
| Success pop | 1.12 to 1.15 | `[UMP § Done Part 1 › Check Draw]` `[UMP § Done Part 2 › Ripple Ring]` |
| Wind-up squeeze | 1 → 0.9 → 1 over 350 ms | `[UMP § Done Part 2 › Ripple Ring]` |
| Dialog open from | 0.72 | `[UMP § Dialog Part 1 › Scale Pop]` |
| Dialog close to | 0.86 | `[UMP § Dialog Part 1 › Scale Pop]` |
| Background behind a stacked panel | 0.94 scale, rises 11 px | `[UMP § Bottom Sheet Part 2 › Stacked Sheets]` |
| Dim | 0.4 (push), 0.45 to 0.55 (modal) | `[UMP § Screen Transition Part 1 › Push Slide]` `[UMP § Bottom Sheet Part 1 › Snap Points]` |
| Push-slide parallax | outgoing −30% width, incoming from 100% | `[UMP § Screen Transition Part 1 › Push Slide]` |
| Error message slide | 13 px down, 230 ms ease-out | `[UMP § Error Part 1 › Shake Input]` |
| Error shake amplitude | 13 to 14 px (UI), 6 px (bar or small widget) | `[UMP § Error Part 1 › Shake Input]` `[GFP § Combo Counter Part 1 › Shake & Flash]` |
| Squash on landing | 28% wider, 22% shorter | `[UMP § Thinking Part 1 › Bouncing Dots]` |
| Hit squash | 138% wide, 62% tall | `[GFP § Hit Feedback Part 1 › Squash & Stretch]` |
| Combo punch | 150% | `[GFP § Combo Counter Part 1 › Number Punch]` |
| Card preview | 150%, 280 ms hold (scaled down to 115% for 3-across, see §3.3) | `[GFP § Card Draw Part 1 › Center Preview]` |
| Card hop | 12 px | `[GFP § Card Draw Part 1 › Hand Ripple]` |
| Digit roll travel | 84 px for a 100 px font (0.84 em) | `[UMP § Number Counter Part 1 › Odometer Roll]` |
| Float-up | 36 to 40 px | `[GFP § Coin Pickup Part 1 › Floating +1]` |
| Touch ripple | 23 → 52 px radius, 3 px ring | `[UMP § Button Part 1 › Press Down]` |

### 2.5 Stagger delays

| Token | Value | Use | Source |
|---|---|---|---|
| `--st-letters` | 30 ms | Title letters | `[GFP § Game Over Part 1 › GAME OVER Drop]` |
| `--st-digits` | 50 ms, right to left | Number columns | `[UMP § Number Counter Part 1 › Odometer Roll]` `[UMP § Verification Code Part 1 › Box Bounce]` |
| `--st-cards-hop` | 50 ms | Card hand ripple | `[GFP § Card Draw Part 1 › Hand Ripple]` |
| `--st-menu` | 60 ms | Menu rows, which fade in over 300 ms and shift 30 px | `[UMP § Menu Part 2 › Push Back]` |
| `--st-buttons` | 70 ms, bottom first | Button groups | `[UMP § Floating Button Part 1 › Speed Dial]` |
| `--st-stars` | 80 to 90 ms | Rewards, stars, cards | `[UMP § Rating Part 2 › Star Bounce]` `[GFP § Rare Pull Part 1 › Star Count]` |
| `--st-rows` | 120 ms in, 100 ms reversed out | List rows | `[UMP § Accordion Part 2 › Expand All]` |
| `--st-dots` | 140 ms | Loading dots | `[UMP § Thinking Part 1 › Bouncing Dots]` |
| `--st-ripples` | 150 ms | Success echo rings | `[UMP § Done Part 2 › Ripple Ring]` |

### 2.6 Paste-ready token file

```css
/* zombie-game/css/motion-tokens.css */
:root {
  /* easing */
  --ease-out: cubic-bezier(0.33, 1, 0.68, 1);
  --ease-in: cubic-bezier(0.32, 0, 0.67, 0);
  --ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);
  --ease-out-quad: cubic-bezier(0.5, 1, 0.89, 1);
  --ease-back-punch: cubic-bezier(0.34, 1.56, 0.64, 1);
  /* exact site back ease, 112% peak */
  --ease-back: linear(0, 0.280, 0.512, 0.699, 0.845, 0.956, 1.034, 1.085, 1.112, 1.121, 1.114, 1.097, 1.073, 1.048, 1.024, 1.007, 1);

  /* springs: use with the matching --d-spring-* duration */
  --spring-press: linear(0, 0.104, 0.344, 0.625, 0.878, 1.063, 1.170, 1.205, 1.188, 1.141, 1.083, 1.030, 0.990, 0.967, 0.958, 0.961, 0.970, 0.982, 0.993, 1.001, 1.006, 1.009, 1.008, 1.006, 1);
  --d-spring-press: 540ms;
  --spring-press-deep: linear(0, 0.104, 0.346, 0.634, 0.895, 1.088, 1.199, 1.234, 1.211, 1.155, 1.088, 1.027, 0.981, 0.954, 0.945, 0.950, 0.963, 0.979, 0.993, 1.004, 1.011, 1.013, 1.012, 1.009, 1);
  --d-spring-press-deep: 590ms;
  --spring-lead: linear(0, 0.065, 0.220, 0.416, 0.614, 0.791, 0.931, 1.031, 1.092, 1.121, 1.125, 1.113, 1.091, 1.066, 1.042, 1.021, 1.004, 0.993, 0.987, 0.984, 0.984, 0.986, 0.989, 0.993, 1);
  --d-spring-lead: 490ms;
  --spring-trail: linear(0, 0.038, 0.132, 0.256, 0.389, 0.520, 0.639, 0.743, 0.829, 0.897, 0.949, 0.986, 1.012, 1.027, 1.036, 1.038, 1.037, 1.034, 1.030, 1.024, 1.019, 1.015, 1.011, 1.007, 1);
  --d-spring-trail: 650ms;
  --spring-sheet: linear(0, 0.062, 0.209, 0.394, 0.580, 0.747, 0.881, 0.980, 1.045, 1.081, 1.094, 1.092, 1.080, 1.063, 1.045, 1.028, 1.015, 1.004, 0.997, 0.993, 0.991, 0.991, 0.992, 0.994, 1);
  --d-spring-sheet: 610ms;
  --spring-island-open: linear(0, 0.061, 0.207, 0.391, 0.576, 0.743, 0.877, 0.977, 1.043, 1.080, 1.094, 1.092, 1.081, 1.064, 1.046, 1.030, 1.016, 1.005, 0.998, 0.993, 0.991, 0.991, 0.992, 0.993, 1);
  --d-spring-island-open: 700ms;
  --spring-stack: linear(0, 0.038, 0.132, 0.255, 0.388, 0.519, 0.639, 0.742, 0.828, 0.896, 0.948, 0.986, 1.011, 1.027, 1.035, 1.038, 1.037, 1.034, 1.030, 1.025, 1.020, 1.015, 1.011, 1.007, 1);
  --d-spring-stack: 510ms;
  --spring-select: linear(0, 0.059, 0.201, 0.378, 0.558, 0.720, 0.853, 0.953, 1.021, 1.061, 1.080, 1.083, 1.076, 1.063, 1.048, 1.033, 1.020, 1.010, 1.002, 0.997, 0.994, 0.993, 0.993, 0.994, 1);
  --d-spring-select: 560ms;

  /* durations */
  --d-press-in: 100ms;
  --d-press-in-hud: 50ms;
  --d-ripple: 400ms;
  --d-fade-quick: 160ms;
  --d-dialog-in: 420ms;
  --d-dialog-out: 240ms;
  --d-row-open: 300ms;
  --d-check-draw: 250ms;
  --d-pop: 450ms;
  --d-shake-ui: 800ms;
  --d-digit-roll: 600ms;
  --d-digit-roll-fast: 160ms;
  --d-screen: 360ms;

  /* staggers */
  --st-letters: 30ms;
  --st-digits: 50ms;
  --st-menu: 60ms;
  --st-buttons: 70ms;
  --st-stars: 90ms;
  --st-rows: 120ms;

  /* press depths */
  --press-hero: 0.88;
  --press-btn: 0.92;
  --press-row: 0.97;
}

@media (prefers-reduced-motion: reduce) {
  :root {
    --d-shake-ui: 0ms;
    --d-screen: 1ms;
    --st-letters: 0ms;
    --st-rows: 0ms;
  }
}
```

`linear()` works in Chromium 113 and later, which covers any Android System WebView updated through the Play Store. If you must support older WebViews, put a fallback first: `transition-timing-function: var(--ease-back-punch); transition-timing-function: var(--spring-press);`.

### 2.7 Shared JS helpers

Every snippet in §3 and §4 imports from this file.

```js
// zombie-game/src/ui/motion.js
// Formulas copied from the site's prompt preambles:
// [UMP § Notifications Part 1 › Island Expand] (spring, seg)
// [UMP § Like Part 1 › Heart Burst] (ease, back)
export const easeOut   = k => 1 - (1 - k) ** 3;
export const easeIn    = k => k ** 3;
export const easeInOut = k => (k < 0.5 ? 4 * k ** 3 : 1 - (-2 * k + 2) ** 3 / 2);
export const easeBack  = k => 1 + 2.9 * (k - 1) ** 3 + 1.9 * (k - 1) ** 2;
export const clamp     = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const seg       = (t, a, b) => clamp((t - a) / (b - a));
export const bump      = (t, a, b) => { const k = seg(t, a, b); return k > 0 && k < 1 ? Math.sin(Math.PI * k) : 0; };
export const lerp      = (a, b, k) => a + (b - a) * k;

export const spring = (w0, z) => {
  const wd = w0 * Math.sqrt(1 - z * z);
  return t => (t <= 0 ? 0 : 1 - Math.exp(-z * w0 * t) * (Math.cos(wd * t) + (z * w0 / wd) * Math.sin(wd * t)));
};

const reduced = matchMedia('(prefers-reduced-motion: reduce)');
export const reducedMotion = () => reduced.matches;

/** Runs fn(k) with k from 0 to 1 over ms. Returns cancel(). */
export function tween(ms, fn, done) {
  const t0 = performance.now();
  let id = 0, live = true;
  const step = now => {
    if (!live) return;
    const k = Math.min(1, (now - t0) / ms);
    fn(k);
    if (k < 1) id = requestAnimationFrame(step); else done?.();
  };
  id = requestAnimationFrame(step);
  return () => { live = false; cancelAnimationFrame(id); };
}

/** Runs a site spring for settleMs. apply(x) gets the spring value; it ends at exactly 1. */
export function runSpring(w0, z, settleMs, apply, done) {
  const f = spring(w0, z);
  return tween(settleMs, k => apply(f((k * settleMs) / 1000)), () => { apply(1); done?.(); });
}

/** Decaying error shake. [UMP § Error Part 1 › Shake Input]: x = A·sin(2π·9·t)·e^(−6t), 0.8 s */
export function shake(el, amp = 14, ms = 800) {
  if (reducedMotion()) return () => {};
  return tween(ms, k => {
    const t = (k * ms) / 1000;
    el.style.translate = `${(amp * Math.sin(2 * Math.PI * 9 * t) * Math.exp(-6 * t)).toFixed(2)}px 0`;
  }, () => { el.style.translate = ''; });
}
```

The helpers write the separate `translate`, `scale` and `rotate` CSS properties (Chromium 104 and later). A shake and a press can then run on the same element without overwriting each other's `transform`.

---

## 3. Per screen

### 3.1 Home (character in the middle, SHOP on the left, PLAY on the right)

| Element | Motion | Values | Source |
|---|---|---|---|
| Entrance | SHOP slides in from the left and PLAY from the right, 24 px of travel, opacity 0 → 1 | 420 ms `--ease-back`, PLAY 70 ms after SHOP | Stagger `[UMP § Floating Button Part 1 › Speed Dial]`; travel is an adaptation |
| PLAY idle | Halo ring pulses outward 3 to 7 px on a 2 s period. A shine sweeps once every 4 s for 600 ms | ring, not `box-shadow` | `[UMP § Checkbox Part 1 › Circle to Check]` `[UMP § Cart Part 2 › Mini Cart Toast]` |
| PLAY press | 3D face moves down 18% of its height onto a fixed base. The floor shadow shrinks 6% and darkens 0.45 → 0.60 | in 100 ms ease-out, release `--spring-press-deep` (20/0.42, 590 ms) | `[UMP § Button Part 1 › Press Down]` |
| SHOP press | Flat press to 0.92 | 100 ms in, `--spring-press` out | `[UMP § Cart Part 1 › Fly to Cart]` |
| Character (Three.js) | Idle bob, plus a 1 → 0.9 → 1 squeeze on PLAY press as a wind-up | 350 ms | `[UMP § Done Part 2 › Ripple Ring]` (wind-up) |
| Home → Shop | Home moves right by 30% and dims 0.4. Shop comes in from the left edge (SHOP is on the left) | 360 ms `--ease-in-out` | `[UMP § Screen Transition Part 1 › Push Slide]` |
| Shop → Home (back) | Reverse; the swipe-back edge glows during the drag | glow 14 px wide, fades in 150 ms after release | `[UMP § Screen Transition Part 2 › Swipe Back]` |
| Background (optional) | 2 to 4 soft color blobs drift 18 px on a 6 s period and 12 px on a 4 s period; each tap adds a radius surge of +8% | use dark game colors, not the site's violet and cyan | `[UMP § Backgrounds Part 1 › Mesh Gradient]` |

```html
<div class="home">
  <button class="btn btn-shop" style="--i:0">SHOP</button>
  <canvas id="scene"></canvas>
  <div class="play-wrap" style="--i:1">
    <span class="play-halo" aria-hidden="true"></span>
    <button class="btn-play"><span class="play-base"></span><span class="play-face">PLAY</span></button>
  </div>
</div>
```

```css
/* Entrance: SHOP from the left, PLAY from the right */
@keyframes in-left  { from { translate: -24px 0; opacity: 0 } to { translate: 0 0; opacity: 1 } }
@keyframes in-right { from { translate:  24px 0; opacity: 0 } to { translate: 0 0; opacity: 1 } }
.btn-shop  { animation: in-left  420ms var(--ease-back) both; animation-delay: calc(var(--i) * var(--st-buttons)); }
.play-wrap { animation: in-right 420ms var(--ease-back) both; animation-delay: calc(var(--i) * var(--st-buttons)); position: relative; }

/* PLAY: 3D face on a fixed base  [UMP § Button Part 1 › Press Down] */
.btn-play   { position: relative; width: 300px; height: 102px; border: 0; background: none; padding: 0;
              --d: 0; touch-action: manipulation; }
.play-base  { position: absolute; inset: 18px 0 0 0; border-radius: 42px; background: linear-gradient(#3b2a10, #221606); }
.play-face  { position: absolute; left: 0; right: 0; top: 0; height: 84px; border-radius: 42px;
              display: grid; place-items: center; font: 700 34px/1 system-ui; color: #fff; overflow: hidden;
              background: linear-gradient(#ffb340, #e2711d);
              translate: 0 calc(var(--d) * 15.3px); }
/* Idle shine: 600 ms in every 4 s  [UMP § Cart Part 2 › Mini Cart Toast] */
.play-face::after { content: ""; position: absolute; inset: 0;
  background: linear-gradient(105deg, transparent 40%, rgb(255 255 255 / .35) 50%, transparent 60%);
  translate: -120% 0; animation: idle-shine 4s var(--ease-in-out) infinite; }
@keyframes idle-shine { 0%, 85% { translate: -120% 0 } 100% { translate: 120% 0 } }

/* Halo pulse, 2 s period, grows 3 to 7 px  [UMP § Checkbox Part 1 › Circle to Check] */
.play-halo { position: absolute; inset: -3px; border-radius: 48px; border: 2px solid rgb(255 179 64 / .5);
             animation: halo 2s var(--ease-in-out) infinite; pointer-events: none; }
@keyframes halo { 0%, 100% { scale: 1.01; opacity: .7 } 50% { scale: 1.025; opacity: .25 } }

@media (prefers-reduced-motion: reduce) { .play-face::after, .play-halo { animation: none; } }
```

```js
// PLAY press: d goes 0 → 1 in 100 ms ease-out, then 1 − spring(20, 0.42), clamped −0.3…1
// [UMP § Button Part 1 › Press Down]
import { tween, runSpring, easeOut, clamp } from './motion.js';
const play = document.querySelector('.btn-play');
let d = 0, stop = () => {};
const setD = v => { d = clamp(v, -0.3, 1); play.style.setProperty('--d', d.toFixed(3)); };
play.addEventListener('pointerdown', () => { stop(); const d0 = d; stop = tween(100, k => setD(d0 + (1 - d0) * easeOut(k))); });
const up = () => { stop(); const d0 = d; stop = runSpring(20, 0.42, 590, x => setD(d0 * (1 - x))); };
play.addEventListener('pointerup', up);
play.addEventListener('pointercancel', up);
```

```js
// Home ↔ Shop push slide  [UMP § Screen Transition Part 1 › Push Slide]
// Outgoing moves 30% and dims 0.4; incoming travels 100%.
export function pushSlide(fromEl, toEl, dir = 1 /* 1 = new screen enters from the left */) {
  const o = { duration: 360, easing: 'cubic-bezier(0.65, 0, 0.35, 1)', fill: 'both' };
  fromEl.animate([{ translate: '0 0', filter: 'brightness(1)' }, { translate: `${30 * dir}% 0`, filter: 'brightness(0.6)' }], o);
  return toEl.animate([{ translate: `${-100 * dir}% 0` }, { translate: '0 0' }], o).finished;
}
```

Note: `filter: brightness()` on a large layer is acceptable for a 360 ms transition. On low-end phones, use a black overlay at opacity 0 → 0.4 instead.

### 3.2 Shop

| Element | Motion | Values | Source |
|---|---|---|---|
| Category tabs | Selection pill with a two-edge spring. It stretches while it travels; the icon tint changes gray → white over the last 80 px | lead 19/0.55, trail 11/0.72 | `[UMP § Tab Bar Part 1 › Sliding Pill]` |
| Item grid in | Rows fade in and shift 30 px | 300 ms ease-out, 60 ms stagger | `[UMP § Menu Part 2 › Push Back]` |
| Item press | 0.92 | 100 ms in, `--spring-press` | `[UMP § Cart Part 1 › Fly to Cart]` |
| Buy (affordable) | Item icon flies to the owned slot, shrinking 1 → 0.14, with 3 ghosts at 40, 80 and 120 ms (opacity 0.28, 0.14, 0.09). Then a check draws in 250 ms and the slot pops 1.12 | flight 450 ms | `[UMP § Cart Part 1 › Fly to Cart]` `[UMP § Done Part 1 › Check Draw]` |
| Coin balance | Odometer roll; the count goes down so the color flashes pink, and up flashes mint | 600 ms ease-out, 50 ms stagger right to left | `[UMP § Number Counter Part 1 › Odometer Roll]` (+ Smooth Count colors) |
| Not enough coins | Button shakes 14 px with decay over 800 ms. The border turns red `#FF4D6A` in 80 ms. "Need 120 more" slides down 13 px over 230 ms | | `[UMP § Error Part 1 › Shake Input]` |
| Expensive items | Hold to buy: a ring fills linearly over 1.92 s while the button shakes sin(70e)·2.2 px. The button sits 8% smaller while held, then pops 12% over 300 ms and the icon turns into a check | release spring 18/0.55 | `[UMP § Button Part 2 › Hold to Confirm]` |
| Confirm dialog | Scale 0.72 → 1 with back ease over 420 ms, opacity over 160 ms; close 1 → 0.86 over 240 ms after a 60 ms delay | dim 0.25 | `[UMP § Dialog Part 1 › Scale Pop]` |

```css
/* Tabs: pill edges as two CSS variables, each with its own spring transition  [UMP § Tab Bar Part 1 › Sliding Pill] */
.tabs { position: relative; display: flex; }
.tab-pill { position: absolute; top: 0; bottom: 0; left: 0; right: 0; border-radius: 999px; background: #c23a1e; pointer-events: none;
  clip-path: inset(0 calc(100% - var(--r)) 0 var(--l) round 999px);
  transition: --l var(--d-spring-lead) var(--spring-lead), --r var(--d-spring-trail) var(--spring-trail); }
@property --l { syntax: '<length>'; inherits: false; initial-value: 0px; }
@property --r { syntax: '<length>'; inherits: false; initial-value: 0px; }
.tab-pill.to-left  { transition: --l var(--d-spring-lead) var(--spring-lead), --r var(--d-spring-trail) var(--spring-trail); }
.tab-pill.to-right { transition: --r var(--d-spring-lead) var(--spring-lead), --l var(--d-spring-trail) var(--spring-trail); }

/* Grid rows: 300 ms ease-out, 30 px shift, 60 ms stagger  [UMP § Menu Part 2 › Push Back] */
@keyframes row-in { from { translate: 0 30px; opacity: 0 } to { translate: 0 0; opacity: 1 } }
.shop-item { animation: row-in 300ms var(--ease-out) both; animation-delay: calc(120ms + var(--i) * var(--st-menu)); }
```

```js
// Move the tab pill. The edge facing the travel direction is the leading edge.
// clip-path repaints only the pill, which is small, so this is cheap.
export function moveTabPill(pill, tabEl) {
  const bar = pill.parentElement.getBoundingClientRect(), r = tabEl.getBoundingClientRect();
  const l = r.left - bar.left, rr = r.right - bar.left;
  const prevL = parseFloat(getComputedStyle(pill).getPropertyValue('--l')) || 0;
  pill.classList.toggle('to-right', l > prevL);
  pill.classList.toggle('to-left', l <= prevL);
  pill.style.setProperty('--l', `${l}px`);
  pill.style.setProperty('--r', `${rr}px`);
}
```

```js
// zombie-game/src/ui/odometer.js
// Odometer coin counter  [UMP § Number Counter Part 1 › Odometer Roll]
// 600 ms ease-out per column, columns start right to left 50 ms apart.
// Markup: <span class="odo" data-value="1240"></span>
export function setOdometer(el, value) {
  const s = String(value);
  while (el.children.length < s.length) {
    const col = document.createElement('span');
    col.className = 'odo-col';
    col.innerHTML = [...'0123456789'].map(n => `<span>${n}</span>`).join('');
    el.prepend(col);
  }
  while (el.children.length > s.length) el.firstElementChild.remove();
  const prev = Number(el.dataset.value ?? value);
  el.dataset.value = value;
  [...el.children].forEach((col, i) => {
    const fromRight = s.length - 1 - i;
    col.style.transitionDelay = `${fromRight * 50}ms`;
    col.style.translate = `0 ${-Number(s[i])}em`;
  });
  if (value !== prev) {
    el.classList.remove('up', 'down'); void el.offsetWidth;
    el.classList.add(value > prev ? 'up' : 'down');
  }
}
```

```css
.odo { display: inline-flex; height: 1em; line-height: 1em; overflow: hidden; font-variant-numeric: tabular-nums;
       mask-image: linear-gradient(transparent, #000 22%, #000 78%, transparent); }
.odo-col { display: flex; flex-direction: column; transition: translate var(--d-digit-roll) var(--ease-out); }
.odo-col > span { height: 1em; }
/* Smooth Count colors: mint up, pink down  [UMP § Number Counter Part 1 › Smooth Count] */
.odo.up   { animation: tint-up 600ms var(--ease-out); }
.odo.down { animation: tint-down 600ms var(--ease-out); }
@keyframes tint-up   { 0% { color: #3DDBB0 } 100% { color: inherit } }
@keyframes tint-down { 0% { color: #FF5CA8 } 100% { color: inherit } }
```

```js
// Not enough coins  [UMP § Error Part 1 › Shake Input]
import { shake } from './motion.js';
export function denyPurchase(btn, msgEl, text) {
  btn.classList.add('is-error');              // CSS: border-color #FF4D6A, transition 80ms
  shake(btn, 14, 800);
  msgEl.textContent = text;
  msgEl.animate([{ translate: '0 -13px', opacity: 0 }, { translate: '0 0', opacity: 1 }],
                { duration: 230, delay: 20, easing: 'cubic-bezier(0.33, 1, 0.68, 1)', fill: 'both' });
  setTimeout(() => btn.classList.remove('is-error'), 1300); // red state holds until 3.5 s in the 2.2 s-start demo
}
```

```js
// Hold to buy  [UMP § Button Part 2 › Hold to Confirm]
// Ring fill: linear over 1.92 s. Shake: sin(70e)·2.2 px tied to fill. Held: 8% smaller. Done: +12% pop over 300 ms.
import { tween, runSpring, bump } from './motion.js';
export function bindHoldToBuy(btn, ring /* SVG circle: pathLength="1", stroke-dasharray="1" */, onConfirm) {
  let stop = () => {}, t0 = 0, done = false;
  const FILL = 1920;
  btn.addEventListener('pointerdown', () => {
    done = false; t0 = performance.now(); stop();
    btn.style.scale = '0.92';
    stop = tween(FILL, e => {
      ring.style.strokeDashoffset = String(1 - e);
      btn.style.translate = `${(Math.sin(70 * e) * 2.2 * e).toFixed(2)}px 0`;
    }, () => {
      done = true; btn.style.translate = '';
      tween(300, k => { btn.style.scale = String(0.92 + 0.08 * k + 0.12 * bump(k, 0, 1)); });
      onConfirm();
    });
  });
  const release = () => {
    if (done) return;
    stop(); btn.style.translate = '';
    const from = Number(ring.style.strokeDashoffset || 1);
    tween(400, k => { ring.style.strokeDashoffset = String(from + (1 - from) * k); }); // retract, 2.9→3.3 s in demo
    runSpring(18, 0.55, 520, x => { btn.style.scale = String(0.92 + 0.08 * x); });
  };
  btn.addEventListener('pointerup', release);
  btn.addEventListener('pointercancel', release);
}
```

### 3.3 Upgrade card draft (3 cards side by side)

| Beat | Motion | Values | Source |
|---|---|---|---|
| 1. Backdrop | The game scene dims to 0.55 and scales to 0.94 | 300 ms ease-out | `[UMP § Bottom Sheet Part 2 › Stacked Sheets]` |
| 2. Deal | Cards rise 40 px from below, scale 0.72 → 1, face down | 420 ms `--ease-back`, 90 ms stagger left to right | `[UMP § Dialog Part 1 › Scale Pop]` `[UMP § Rating Part 2 › Star Bounce]` |
| 3. Land | Each card squashes 28% wider and 22% shorter on landing, then settles | half-sine over 120 ms | `[UMP § Thinking Part 1 › Bouncing Dots]` |
| 4. Rarity tease (rare and epic only) | The glow behind the card shifts blue → purple → gold before it flips | 2 glows, radius 120 px (opacity 0.8 + 0.2·sin(2π·6t)) and 60 px (0.6) | `[GFP § Rare Pull Part 1 › Color Tease]` |
| 5. Flip | Each card flips to face up, with an arc in the middle of the flip | 300 ms `--ease-in-out`, 50 ms stagger | `[GFP § Card Draw Part 1 › Flip Reveal]` `[GFP § Card Draw Part 1 › Hand Ripple]` |
| 6. Shine | Rare cards get a white shine sweep. Epic cards also get 12 light rays spinning at 90°/s, faded out by 500 ms | sweep 250 ms | `[GFP § Card Draw Part 1 › Rarity Shine]` `[GFP § Rare Pull Part 1 › Light Rays]` |
| 7. Idle | All three hop 12 px once in sequence, then hold still | 50 ms stagger | `[GFP § Card Draw Part 1 › Hand Ripple]` |
| 8. Press | 0.92 | 100 ms in, `--spring-press` | `[UMP § Cart Part 1 › Fly to Cart]` |
| 9. Pick | The picked card grows to 115% and holds 280 ms. The others shrink 1 → 0.86 and fade out over 240 ms after a 60 ms delay | | `[GFP § Card Draw Part 1 › Center Preview]` (150% scaled down for 3-across) `[UMP § Dialog Part 1 › Scale Pop]` |
| 10. Commit | The picked card squashes 120% × 80% over 150 ms, then a check draws in 250 ms and the card pops 1.12 | | `[GFP § Card Draw Part 1 › Snap Squash]` `[UMP § Done Part 1 › Check Draw]` |

Input rule: cards ignore taps until beat 5 finishes, about 1.0 s. This is the one exception to principle 17. A fast tapper who taps through the deal would otherwise pick a card they never saw.

```css
.draft { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; perspective: 900px; }
.card { position: relative; animation: card-deal 420ms var(--ease-back) both;
        animation-delay: calc(var(--i) * var(--st-stars)); }
.card-inner { transform-style: preserve-3d; rotate: y 180deg; }
.card.is-flipped .card-inner { animation: card-flip 300ms var(--ease-in-out) both; animation-delay: calc(var(--i) * 50ms); }
.card-face, .card-back { position: absolute; inset: 0; backface-visibility: hidden; border-radius: 14px; }
.card-face { rotate: y 0deg; } .card-back { rotate: y 180deg; }

/* Deal: rise 40 px, 0.72 → 1  [UMP § Dialog Part 1 › Scale Pop] */
@keyframes card-deal { from { translate: 0 40px; scale: 0.72; opacity: 0 } 40% { opacity: 1 } to { translate: 0 0; scale: 1; opacity: 1 } }
/* Flip with a lift in the middle  [GFP § Card Draw Part 1 › Flip Reveal] */
@keyframes card-flip { 0% { rotate: y 180deg; translate: 0 0 } 50% { translate: 0 -14px } 100% { rotate: y 0deg; translate: 0 0 } }
/* Idle hop 12 px  [GFP § Card Draw Part 1 › Hand Ripple] */
.card.hop { animation: card-hop 260ms var(--ease-out) both; animation-delay: calc(var(--i) * 50ms); }
@keyframes card-hop { 50% { translate: 0 -12px } }

/* Rarity shine: 250 ms sweep  [GFP § Card Draw Part 1 › Rarity Shine] */
.card-face { overflow: hidden; }
.card.rare .card-face::after, .card.epic .card-face::after { content: ""; position: absolute; inset: 0;
  background: linear-gradient(105deg, transparent 35%, rgb(255 255 255 / .55) 50%, transparent 65%);
  translate: -120% 0; animation: shine 250ms var(--ease-in-out) both; animation-delay: calc(400ms + var(--i) * 50ms); }
@keyframes shine { to { translate: 120% 0 } }

/* Epic light rays: 12 rays at 90°/s, faded by 500 ms  [GFP § Rare Pull Part 1 › Light Rays] */
.card.epic::before { content: ""; position: absolute; inset: -40%; z-index: -1; border-radius: 50%;
  background: repeating-conic-gradient(rgb(255 194 75 / .55) 0 6deg, transparent 6deg 30deg);
  mask-image: radial-gradient(closest-side, #000 30%, transparent);
  animation: rays 500ms linear both; }
@keyframes rays { from { rotate: 0deg; opacity: 1 } to { rotate: 45deg; opacity: 0 } }

/* Picked and dismissed  [UMP § Dialog Part 1 › Scale Pop] */
.card.is-out { animation: card-out 240ms var(--ease-out) 60ms both; }
@keyframes card-out { to { scale: 0.86; opacity: 0 } }
```

```js
// Draft sequence. Beats and times from the table above.
import { tween, runSpring } from './motion.js';
const wait = ms => new Promise(r => setTimeout(r, ms));

export async function runDraft(root, cards /* [{el, rarity}] */, onPick) {
  root.classList.add('is-locked');
  cards.forEach((c, i) => { c.el.style.setProperty('--i', i); c.el.classList.add(c.rarity); });
  await wait(420 + 2 * 90);                                     // deal done
  cards.forEach(c => c.el.classList.add('is-flipped'));
  await wait(300 + 2 * 50);                                     // flips done
  root.classList.remove('is-locked');                           // taps allowed now
  cards.forEach(c => c.el.classList.add('hop'));

  root.addEventListener('pointerup', async e => {
    const picked = cards.find(c => c.el.contains(e.target));
    if (!picked || root.classList.contains('is-locked')) return;
    root.classList.add('is-locked');
    cards.filter(c => c !== picked).forEach(c => c.el.classList.add('is-out'));
    picked.el.getAnimations().forEach(a => a.cancel());
    runSpring(16, 0.62, 560, x => { picked.el.style.scale = String(1 + 0.15 * x); });
    await wait(560 + 280);                                       // grow, then hold 280 ms
    picked.el.animate([{ scale: '1.15' }, { scale: '1.38 0.92' }, { scale: '1.15' }],
                      { duration: 150, easing: 'ease-out' });    // 120% × 80% squash relative to 1.15
    await wait(150);
    onPick(picked);
  }, { once: false });
}
```

### 3.4 HUD (health, coins, combo, boss bar, touch buttons)

| Element | Motion | Values | Source |
|---|---|---|---|
| Health, on damage | Fill drops at once and flashes white for 2 frames. The chip holds 250 ms, then drains over 300 ms ease-out. The bar shakes 8 px, fading over 300 ms | | `[GFP § Health Bar Part 1 › Delayed Chip / Flash White / Bar Shake]` |
| Health, on heal | Smooth fill over 450 ms ease-out with a mint glow | | `[GFP § Health Bar Part 1 › Smooth Drain]` `[GFP § Healing Part 1 › Mint Glow]` |
| Health, low | Below 30%: color shifts green → yellow → red and the bar pulses 3 times per second | | `[GFP § Health Bar Part 1 › Color Shift]` |
| Screen on hit | Red vignette in 4 bands, fading over 500 ms. The player blinks every 2 frames for 600 ms of i-frames | | `[GFP § Taking Damage Part 1 › Red Vignette / Blink I-Frames]` |
| Coins | The coin arcs from the zombie's screen position to the counter in 350 ms. The counter rolls in 160 ms and pops 1.15 over 350 ms. A "+N" floats up 36 px and fades over 600 ms | | `[GFP § Coin Pickup Part 1 › Fly to HUD / Floating +1]` `[GFP § Combo Counter Part 1 › Rolling Digits]` `[UMP § Done Part 2 › Ripple Ring]` |
| Combo | Each hit punches the number 100 → 150% in 50 ms, then back over 250 ms with back ease. Color tiers: cream `#fff6d8` → gold `#FFC24B` at 5 hits → orange at 9 hits, one size step larger per tier. A timer bar refills on hit, drains over 1 s and turns orange at 30% | | `[GFP § Combo Counter Part 1 › Number Punch / Color Tiers / Combo Timer]` |
| Combo break | Number shakes ±6 px over 250 ms with a 100 ms white flash, then fades | | `[GFP § Combo Counter Part 1 › Shake & Flash]` |
| Boss bar enter | Drops from the top with `--spring-sheet`; the boss name letters drop in at 30 ms each | | `[UMP § Bottom Sheet Part 1 › Snap Points]` `[GFP § Game Over Part 1 › GAME OVER Drop]` (letter stagger) |
| Boss bar damage | Same as the player's delayed chip, with a longer drain for weight: hold 250 ms, drain 450 ms | | `[GFP § Health Bar Part 1 › Delayed Chip / Smooth Drain]` |
| Boss phase change | Bar shakes 8 px, then segments light up left to right with a mint wave at a 50 ms stagger, 200 ms each | | `[GFP § Health Bar Part 1 › Bar Shake]` `[UMP § Text Field Part 2 › OTP Code]` (mint wave) |
| Touch buttons | Press 0.88 in 50 ms, release `--spring-press`. A touch ring grows 23 → 52 px over 400 ms with opacity 0.7 → 0 | | `[UMP § Rating Part 2 › Star Bounce]` `[UMP § Button Part 1 › Press Down]` |
| Ability cooldown | Ring track at white 8%, 8 px round-capped arc refilling linearly. When ready, the button pops 12% over 300 ms and a ring expands 67 → 93 px and fades | | `[UMP § Button Part 2 › Hold to Confirm]` (ring, done pulse) |
| Hit feedback (3D) | Hit-stop 120 ms. White flash 3 frames. Camera shake 10 px with (1 − t/0.26)² falloff. Zombie squash 138% × 62%, then spring back | | `[GFP § Hit Feedback Part 1]` |

```html
<div class="hp" aria-label="Health">
  <div class="hp-chip"></div>
  <div class="hp-fill"></div>
</div>
```

```css
.hp { position: relative; height: 22px; border: 6px solid #1A1014; background: #3A2629; contain: layout paint; }
.hp-chip, .hp-fill { position: absolute; inset: 0; transform-origin: left; scale: var(--hp, 1) 1; }
.hp-chip { background: #ffe1d6; scale: var(--chip, 1) 1; }
.hp-fill { background: #4fd26b; }
.hp.flash .hp-fill { background: #fff; }
.hp.low .hp-fill { background: #ff4d4d; animation: low-pulse 333ms ease-in-out infinite alternate; } /* 3×/s */
@keyframes low-pulse { to { opacity: .55 } }
@media (prefers-reduced-motion: reduce) { .hp.low .hp-fill { animation: none; } }
```

```js
// Delayed chip + flash + bar shake  [GFP § Health Bar Part 1]
import { tween, easeOut } from './motion.js';
export function setHP(bar, hp /* 0..1 */) {
  const fill = bar.querySelector('.hp-fill'), chip = bar.querySelector('.hp-chip');
  const prev = Number(bar.dataset.hp ?? 1);
  bar.dataset.hp = hp;
  fill.style.setProperty('--hp', hp);                         // instant drop
  bar.classList.toggle('low', hp < 0.3);
  if (hp < prev) {
    bar.classList.add('flash');
    requestAnimationFrame(() => requestAnimationFrame(() => bar.classList.remove('flash'))); // 2 frames
    bar.animate([{ translate: '8px 0' }, { translate: '-6px 0' }, { translate: '4px 0' }, { translate: '-2px 0' }, { translate: '0 0' }],
                { duration: 300, easing: 'linear' });         // 8 px, fading over 300 ms
    clearTimeout(bar._chipT);
    bar._chipT = setTimeout(() => {
      const from = Number(chip.style.getPropertyValue('--chip') || prev);
      tween(300, k => chip.style.setProperty('--chip', from + (hp - from) * easeOut(k)));
    }, 250);
  } else {
    chip.style.setProperty('--chip', hp);
    fill.animate([{ scale: `${prev} 1` }, { scale: `${hp} 1` }], { duration: 450, easing: 'cubic-bezier(0.33, 1, 0.68, 1)' });
  }
}
```

```js
// Combo number punch: 1 → 1.5 in 50 ms ease-out, back over 250 ms with easeOutBack (c = 1.70158)
// Tiers at 5 and 9 hits; timer drains over 1 s and turns orange at 30%.  [GFP § Combo Counter Part 1]
export function comboHit(el, timerEl, count) {
  el.textContent = count;
  el.dataset.tier = count >= 9 ? '2' : count >= 5 ? '1' : '0';   // CSS colors #fff6d8 / #FFC24B / #ff7a1a
  el.getAnimations().forEach(a => a.cancel());
  el.animate([
    { scale: 1, easing: 'cubic-bezier(0.33, 1, 0.68, 1)' },
    { scale: 1.5, offset: 50 / 300, easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)' },
    { scale: 1 }
  ], { duration: 300 });
  timerEl.getAnimations().forEach(a => a.cancel());           // timerEl needs transform-origin: left
  timerEl.animate([
    { scale: '1 1', background: '#FFC24B' },
    { scale: '0.3 1', background: '#FFC24B', offset: 0.7 },
    { scale: '0.3 1', background: '#ff7a1a', offset: 0.7001 },
    { scale: '0 1', background: '#ff7a1a' }
  ], { duration: 1000, easing: 'linear', fill: 'forwards' });
}
```

```js
// Coin fly to HUD: 350 ms arc, then counter roll + pop + "+N" float
// [GFP § Coin Pickup Part 1 › Fly to HUD / Floating +1]  [UMP § Done Part 2 › Ripple Ring] (pop 1.15)
import { tween, easeInOut, bump } from './motion.js';
export function coinToHud(worldPos, camera, renderer, counterEl, amount, onLand) {
  const v = worldPos.clone().project(camera);
  const rect = renderer.domElement.getBoundingClientRect();
  const x0 = rect.left + (v.x * 0.5 + 0.5) * rect.width, y0 = rect.top + (-v.y * 0.5 + 0.5) * rect.height;
  const t = counterEl.getBoundingClientRect(), x1 = t.left + t.width / 2, y1 = t.top + t.height / 2;
  const cx = (x0 + x1) / 2, cy = Math.min(y0, y1) - 80;                // arc control point
  const coin = Object.assign(document.createElement('div'), { className: 'fx-coin' });
  document.body.append(coin);
  tween(350, k => {
    const e = easeInOut(k), a = 1 - e;
    const x = a * a * x0 + 2 * a * e * cx + e * e * x1, y = a * a * y0 + 2 * a * e * cy + e * e * y1;
    coin.style.translate = `${x}px ${y}px`; coin.style.scale = String(1 - 0.4 * e);
  }, () => {
    coin.remove(); onLand?.();
    counterEl.animate([{ scale: 1 }, { scale: 1.15 }, { scale: 1 }], { duration: 350, easing: 'ease-out' });
    const f = Object.assign(document.createElement('div'), { className: 'fx-float', textContent: `+${amount}` });
    f.style.translate = `${x1}px ${y1}px`; document.body.append(f);
    f.animate([{ translate: `${x1}px ${y1}px`, opacity: 1 }, { translate: `${x1}px ${y1 - 36}px`, opacity: 0 }],
              { duration: 600, easing: 'cubic-bezier(0.33, 1, 0.68, 1)' }).finished.then(() => f.remove());
  });
}
```

Use a small pool of `.fx-coin` elements instead of creating one per coin when many zombies drop coins at once. Cap the number of live flying coins at about 8 and add the rest straight to the counter.

```css
.fx-coin, .fx-float { position: fixed; left: 0; top: 0; pointer-events: none; will-change: translate; }
.fx-coin { width: 22px; height: 22px; margin: -11px; border-radius: 50%; background: radial-gradient(#ffe27a, #e0a100); }
.fx-float { font: 800 20px/1 system-ui; color: #FFC24B; -webkit-text-stroke: 3px #1a1014; paint-order: stroke; }

/* Touch buttons: no click delay, no scroll, no text selection */
.hud-btn { touch-action: none; user-select: none; -webkit-tap-highlight-color: transparent; }
.hud-btn.is-down { scale: var(--press-hero); transition: scale var(--d-press-in-hud) var(--ease-out); }
.hud-btn:not(.is-down) { transition: scale var(--d-spring-press) var(--spring-press); }
```

```js
// Three.js hit feedback  [GFP § Hit Feedback Part 1]
// Hit-stop 120 ms, white flash 3 frames, camera shake 10 px·(1 − t/0.26)².
let hitStopUntil = 0, shakeStart = -1;
export function onHit(now, zombieMesh) {
  hitStopUntil = now + 120;
  shakeStart = now;
  zombieMesh.material.emissive.setRGB(1, 1, 1);
  zombieMesh.userData.flashFrames = 3;
  zombieMesh.userData.squashT = now;                      // 138% × 62%, then spring back
}
export function updateFeel(now, dt, camera, basePos, zombies) {
  const frozen = now < hitStopUntil;                       // skip gameplay update while frozen, keep rendering
  if (shakeStart >= 0) {
    const t = (now - shakeStart) / 1000;
    const a = t <= 0.26 ? 10 * (1 - t / 0.26) ** 2 : 0;    // pixels
    const px = a * 0.002;                                  // convert px to world units for your camera
    camera.position.set(basePos.x + (Math.random() * 2 - 1) * px, basePos.y + (Math.random() * 2 - 1) * px, basePos.z);
    if (a === 0) shakeStart = -1;
  }
  for (const z of zombies) {
    if (z.userData.flashFrames > 0 && --z.userData.flashFrames === 0) z.material.emissive.setRGB(0, 0, 0);
  }
  return frozen;
}
```

### 3.5 Radio dialogue box

The radio box uses the Island Expand pattern: a small pill that springs open into a card, with a live waveform. It fits a radio call well.

| Beat | Motion | Values | Source |
|---|---|---|---|
| Closed | A small pill with a pulsing dot; dot opacity 0.55 + 0.45·sin(2πa/2), a 2 s period | | `[UMP § Notifications Part 1 › Island Expand]` |
| Open | Width 128 → 410 and height 36 → 124 on spring 13/0.6. Corner radius goes 18 → 40, capped at half the height | ~700 ms | `[UMP § Notifications Part 1 › Island Expand]` |
| Content in | Avatar, name and text fade in from 160 to 360 ms after the open starts | linear | `[UMP § Notifications Part 1 › Island Expand]` |
| Waveform | 6 bars, 5 px wide, 11 px pitch; height = 8 + 24·(0.5 + 0.5·sin(2πa + 1.1j)) | 1 s cycle | `[UMP § Notifications Part 1 › Island Expand]` |
| Text | Typewriter at 25 characters per second with a caret blinking on a 1 s period. A tap shows the full line at once, and the next tap advances | | `[UMP § Send Part 1 › Bubble Rise]` `[UMP § Text Field Part 1 › Floating Label]` |
| Next line | The old line moves up 47 px and fades; the new one springs in on 14/0.62 | | `[UMP § Send Part 1 › Bubble Rise]` |
| Close | Content fades out over 120 ms, then the box shrinks on spring 15/0.62 | | `[UMP § Notifications Part 1 › Island Expand]` |

```html
<div class="radio" data-open="false">
  <span class="radio-dot"></span>
  <div class="radio-body">
    <img class="radio-avatar" src="img/sarge.png" alt="">
    <div><b class="radio-name">SARGE</b><p class="radio-text"></p></div>
    <div class="radio-wave"><i></i><i></i><i></i><i></i><i></i><i></i></div>
  </div>
</div>
```

```css
.radio { position: fixed; top: 16px; left: 50%; width: 410px; height: 124px; translate: -50% 0;
         background: #0b0b0d; border: 2px solid rgb(255 255 255 / .1); contain: layout paint;
         clip-path: inset(var(--ct, 44px) var(--cx, 141px) var(--cb, 44px) var(--cx, 141px) round var(--cr, 18px)); }
.radio-body { opacity: 0; display: grid; grid-template-columns: 62px 1fr auto; gap: 12px; align-items: center; height: 100%; padding: 0 20px; }
.radio-dot { position: absolute; right: 158px; top: 57px; width: 10px; height: 10px; border-radius: 50%; background: #7CFF6B;
             animation: dot 2s ease-in-out infinite; }
@keyframes dot { 0%, 100% { opacity: .1 } 50% { opacity: 1 } }
/* Waveform: period 1 s, phase step 1.1 rad per bar = 175 ms  [UMP § Notifications Part 1 › Island Expand] */
.radio-wave { display: flex; gap: 6px; height: 32px; align-items: center; }
.radio-wave i { width: 5px; height: 32px; border-radius: 2.5px; background: #7CFF6B; transform-origin: center;
                animation: wave 500ms ease-in-out infinite alternate; }
.radio-wave i:nth-child(1) { animation-delay: 0ms } .radio-wave i:nth-child(2) { animation-delay: -175ms }
.radio-wave i:nth-child(3) { animation-delay: -350ms } .radio-wave i:nth-child(4) { animation-delay: -525ms }
.radio-wave i:nth-child(5) { animation-delay: -700ms } .radio-wave i:nth-child(6) { animation-delay: -875ms }
@keyframes wave { from { scale: 1 0.25 } to { scale: 1 1 } }
.radio-text::after { content: "▍"; animation: caret 1s steps(1) infinite; }
@keyframes caret { 50% { opacity: 0 } }
```

```js
// Island Expand open/close + typewriter  [UMP § Notifications Part 1 › Island Expand] [UMP § Send Part 1 › Bubble Rise]
import { runSpring, clamp, tween } from './motion.js';
const W = 410, H = 124;
function setOpen(box, p) {                       // p = openness, can overshoot
  const w = 128 + 282 * p, h = 36 + 88 * p;
  const r = Math.min(18 + 22 * clamp(p), h / 2);
  box.style.setProperty('--cx', `${(W - w) / 2}px`);
  box.style.setProperty('--ct', `${Math.max(0, (H - h) / 2)}px`);
  box.style.setProperty('--cb', `${Math.max(0, (H - h) / 2)}px`);
  box.style.setProperty('--cr', `${r}px`);
  box.querySelector('.radio-dot').style.visibility = p > 0.3 ? 'hidden' : ''; // dot fades by p = 0.3
}
export function openRadio(box, line) {
  const body = box.querySelector('.radio-body');
  runSpring(13, 0.6, 700, p => setOpen(box, p));
  body.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200, delay: 160, fill: 'both' }); // 160 → 360 ms
  return typeLine(box.querySelector('.radio-text'), line);
}
export function closeRadio(box) {
  const body = box.querySelector('.radio-body');
  body.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 120, fill: 'both' });
  return new Promise(r => setTimeout(() => runSpring(15, 0.62, 610, x => setOpen(box, 1 - x), r), 120));
}
export function typeLine(el, text, cps = 25) {
  let i = 0, skip = false;
  el.textContent = '';
  const box = el.closest('.radio'), onTap = () => { skip = true; };
  box.addEventListener('pointerdown', onTap, { once: true });
  return new Promise(resolve => {
    const id = setInterval(() => {
      i = skip ? text.length : i + 1;
      el.textContent = text.slice(0, i);
      if (i >= text.length) { clearInterval(id); box.removeEventListener('pointerdown', onTap); resolve(); }
    }, 1000 / cps);
  });
}
```

### 3.6 Game over

| Beat (t from death) | Motion | Values | Source |
|---|---|---|---|
| 0 ms | Red flash and a dark red vignette close in over 500 ms | | `[GFP § Game Over Part 1 › Red Vignette]` |
| 0 ms | Character (3D): white flash 60 ms, falls over 160 ms with ease-in cubic, rotates −90°, bounces back 12% by 240 ms | | `[GFP § Game Over Part 1 › Fall & Blink Out]` |
| 240 ms | Character blinks out: visibility toggles every 25 ms for 200 ms | | `[GFP § Game Over Part 1 › Fall & Blink Out]` |
| 300 ms | Scene desaturates over 250 ms | | `[GFP § Game Over Part 1 › Gray Out]` |
| 600 ms | "GAME OVER" letters drop in from −60 px with back ease, 30 ms apart | 420 ms each | `[GFP § Game Over Part 1 › GAME OVER Drop]` |
| 1000 ms | Stats rows (kills, coins, best combo) come in 120 ms apart. Each number rolls up on the odometer: 600 ms, 50 ms right to left | | `[UMP § Accordion Part 2 › Expand All]` `[UMP § Number Counter Part 1 › Odometer Roll]` |
| New best | The "NEW BEST" badge pops with back ease, then 3 echo rings at 150 ms intervals, each 900 ms | | `[UMP § Done Part 2 › Ripple Ring]` |
| 1700 ms | RETRY and HOME buttons rise in 70 ms apart; RETRY gets the 2 s halo pulse | | `[UMP § Floating Button Part 1 › Speed Dial]` `[UMP § Checkbox Part 1 › Circle to Check]` |
| Tap RETRY | Iris-out: a black circle closes over 300 ms, then the next run loads | | `[GFP § Game Over Part 1 › Iris Out]` |

Input rule: a tap anywhere before 1700 ms jumps the sequence to the end. A tap does not trigger RETRY until the buttons have landed, so a stray tap at the moment of death does not restart the run.

```css
.go-vignette { position: fixed; inset: 0; pointer-events: none;
  background: radial-gradient(closest-side, transparent 55%, rgb(120 0 0 / .85));
  animation: vig 500ms var(--ease-out) both; }
@keyframes vig { from { opacity: 0; scale: 1.4 } to { opacity: 1; scale: 1 } }

#scene.gray { filter: grayscale(1) brightness(.7); transition: filter 250ms linear; }

.go-title span { display: inline-block; animation: letter-drop 420ms var(--ease-back) both;
                 animation-delay: calc(600ms + var(--i) * var(--st-letters)); }
@keyframes letter-drop { from { translate: 0 -60px; opacity: 0 } to { translate: 0 0; opacity: 1 } }

.go-row { animation: row-in 300ms var(--ease-out) both; animation-delay: calc(1000ms + var(--i) * var(--st-rows)); }
.go-actions .btn { animation: row-in 420ms var(--ease-back) both; animation-delay: calc(1700ms + var(--i) * var(--st-buttons)); }

.go-iris { position: fixed; inset: 0; background: #000; pointer-events: none;
           clip-path: circle(150% at 50% 50%); animation: iris 300ms var(--ease-in) both; }
@keyframes iris { to { clip-path: circle(0% at 50% 50%) } }

.go-skip * { animation-delay: 0ms !important; animation-duration: 1ms !important; }
```

```js
// Game over timeline. Times from the table above.
import { setOdometer } from './odometer.js';
export function runGameOver(root, sceneCanvas, stats) {
  const title = root.querySelector('.go-title');
  title.innerHTML = [...'GAME OVER'].map((c, i) => `<span style="--i:${i}">${c === ' ' ? '&nbsp;' : c}</span>`).join('');
  root.querySelectorAll('.go-row').forEach((r, i) => r.style.setProperty('--i', i));
  root.querySelectorAll('.go-actions .btn').forEach((b, i) => b.style.setProperty('--i', i));
  const timers = [
    setTimeout(() => sceneCanvas.classList.add('gray'), 300),
    ...stats.map((s, i) => setTimeout(() => setOdometer(s.el, s.value), 1000 + i * 120)),
  ];
  let ready = false;
  const readyT = setTimeout(() => { ready = true; }, 1700 + 420 + 70);
  root.addEventListener('pointerdown', () => {
    if (ready) return;
    root.classList.add('go-skip');                // jump everything to the end
    timers.forEach(clearTimeout);
    sceneCanvas.classList.add('gray');
    stats.forEach(s => setOdometer(s.el, s.value));
    clearTimeout(readyT); setTimeout(() => { ready = true; }, 50);
  }, { once: true });
  return () => ready;
}
```

---

## 4. Button and card feedback

### 4.1 Press

- Press depth eases in over 100 ms with ease-out cubic, or 50 ms on HUD combat buttons. `[UMP § Button Part 1 › Press Down]`
- Depth by element: hero 0.88, button 0.92, row 0.97. `[UMP § Rating Part 2 › Star Bounce]` `[UMP § Cart Part 1 › Fly to Cart]` `[UMP § Accordion Part 1 › Chevron Rotate]`
- 3D buttons: move the face down onto a fixed base instead of scaling. The face drops 18% of its height. The highlight stroke dims from 0.28 to 0.16, and the gradient shifts one shade darker. `[UMP § Button Part 1 › Press Down]`
- Touch ring: 3 px white ring growing 23 → 52 px over 400 ms with opacity 0.7 → 0, centered on the touch point. `[UMP § Button Part 1 › Press Down]`
- Use `pointerdown` to start the press. Do not wait for `click`, which fires on release.

### 4.2 Release

- Spring back with ω₀ 22 and ζ 0.45 over 540 ms. Depth goes to 1 − x(t), clamped to −0.3…1, which gives about a 20% rebound past rest. `[UMP § Button Part 1 › Press Down]` `[UMP § Cart Part 2 › Mini Cart Toast]`
- If the press is released early, before it reaches full depth, spring from the current depth. Never jump to full depth first.
- If the finger slides off the button (`pointerleave` while down), release without firing the action.

```js
// Generic press binding. [UMP § Button Part 1 › Press Down] in 100 ms; [UMP § Cart Part 1 › Fly to Cart] spring 22/0.45
import { tween, runSpring, easeOut, clamp } from './motion.js';
import { denyTap } from './deny.js'; // §4.4
export function bindPress(el, { depth = 0.08, inMs = 100, onTap } = {}) {
  let d = 0, stop = () => {}, down = false;
  const set = v => { d = clamp(v, -0.3, 1); el.style.scale = (1 - depth * d).toFixed(4); };
  el.addEventListener('pointerdown', e => {
    if (el.getAttribute('aria-disabled') === 'true') return denyTap(el);
    down = true; el.setPointerCapture(e.pointerId);
    stop(); const d0 = d; stop = tween(inMs, k => set(d0 + (1 - d0) * easeOut(k)));
  });
  const release = fire => () => {
    if (!down) return; down = false;
    stop(); const d0 = d; stop = runSpring(22, 0.45, 540, x => set(d0 * (1 - x)));
    if (fire) onTap?.();
  };
  el.addEventListener('pointerup', e => {
    const r = el.getBoundingClientRect();
    const inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
    release(inside)();
  });
  el.addEventListener('pointercancel', release(false));
}
```

### 4.3 Hover

- Android touch has no hover. Put hover styles behind `@media (hover: hover)` so they only show during desktop testing and never stick after a tap on the phone.
- Hover state: a soft shine across the button and a 2 px lift. `[UMP § Components › Shine Sweep]` (soft shine on hover, bright sweep and flash on press)

```css
@media (hover: hover) {
  .btn:hover { translate: 0 -2px; transition: translate 160ms var(--ease-out); }
  .btn:hover::after { translate: 120% 0; transition: translate 600ms var(--ease-in-out); }
}
```

### 4.4 Disabled

- Disabled buttons stay in the layout and stay tappable, with `aria-disabled="true"` instead of the `disabled` attribute. A tap then explains why, instead of doing nothing.
- Look: 45% opacity and a gray fill, no glow, no idle animations.
- Enable and disable fade over 200 to 230 ms. `[UMP § Stepper Part 1 › Soft Press]` (minus button fades out 3.12–3.35 s and eases back in over 0.2 s)
- Tap while disabled: a small decaying shake of 6 px over 800 ms, plus the reason ("Need 120 coins") sliding down 13 px over 230 ms. `[UMP § Error Part 1 › Shake Input]`

```css
.btn { transition: opacity 230ms var(--ease-out), filter 230ms var(--ease-out); }
.btn[aria-disabled="true"] { opacity: .45; filter: grayscale(1); }
.btn[aria-disabled="true"]::after, .btn[aria-disabled="true"] .play-halo { animation: none; }
```

```js
// zombie-game/src/ui/deny.js
import { shake } from './motion.js';
export function denyTap(el) { shake(el, 6, 800); el.dispatchEvent(new CustomEvent('denied', { bubbles: true })); }
```

### 4.5 Reward reveal

Use this order for any reward: a chest, a draft pick, a level-up or a new best.

1. **Wind-up:** squeeze 1 → 0.9 → 1 over 350 ms. `[UMP § Done Part 2 › Ripple Ring]`
2. **Tease (rare and above):** glow shifts blue → purple → gold before the open. `[GFP § Rare Pull Part 1 › Color Tease]`
3. **Fill:** the shape fills, with a gradient glow and a 39 to 47 px blur behind it. Prefer a pre-blurred PNG to CSS blur. `[UMP § Done Part 1 › Check Draw]` `[UMP § Done Part 2 › Ripple Ring]`
4. **Mark:** a check or icon draws in 250 ms with ease-out and round caps. `[UMP § Done Part 1 › Check Draw]`
5. **Pop:** 1 → 1.12 → 1 as a half sine over 450 ms. `[UMP § Done Part 1 › Check Draw]`
6. **Echo:** 3 rings start 150 ms apart; each runs 900 ms with ease-out, radius 1 → 3.7×, stroke 7.5 → 1 px, opacity 0.8 → 0. `[UMP § Done Part 2 › Ripple Ring]`
7. **Burst (big rewards only):** 8 particles 45° apart, travelling 58 → 101 px with ease-out and shrinking with ease-in. Alternate 4 colors. `[UMP § Like Part 1 › Heart Burst]`
8. **Count:** star or tier pips pop in 80 ms apart with a 140% overshoot. `[GFP § Rare Pull Part 1 › Star Count]`

```css
/* Reward badge  [UMP § Done Part 1 › Check Draw]  [UMP § Done Part 2 › Ripple Ring] */
/* 0–350 ms wind-up 1 → 0.9 → 1, 350–800 ms pop 1 → 1.12 → 1 */
.reward { animation: reward-in 800ms ease-in-out both; }
@keyframes reward-in { 0% { scale: 1 } 21.9% { scale: .9 } 43.75% { scale: 1 } 71.9% { scale: 1.12 } 100% { scale: 1 } }
.reward-check path { stroke-dasharray: 1; stroke-dashoffset: 1; stroke-linecap: round; stroke-linejoin: round;
                     animation: draw 250ms var(--ease-out) 350ms forwards; }
@keyframes draw { to { stroke-dashoffset: 0 } }
.reward-ring { position: absolute; inset: 0; border-radius: 50%; border: 7.5px solid currentColor; opacity: 0;
               animation: echo 900ms var(--ease-out) both; animation-delay: calc(350ms + var(--i) * 150ms); }
@keyframes echo { from { scale: 1; opacity: .8; border-width: 7.5px } to { scale: 3.7; opacity: 0; border-width: 1px } }
```

The check path needs `pathLength="1"` on the SVG `<path>` for the dash values to work.

---

## 5. What to avoid

Most of these are adaptations. Tags mark the ones the source sites back up.

1. **The same fade-up on everything.** Every element fading in while sliding up 20 px over 300 ms with `ease-in-out` is the most common sign of a generated UI. Pick the motion from what the element does: buttons spring, numbers roll, cards deal, errors shake.
2. **One easing for all motion.** Entrances use ease-out or back, exits use ease-in, moves use in-out, and anything the player touches uses a spring. `[UMP § Dialog Part 1 › Scale Pop]` (back in, ease out)
3. **Bounce on everything.** Overshoot stays at about 12% for UI. Larger values (140 to 150%) are for rare reward beats. When everything bounces, nothing reads as special. `[UMP § Like Part 1 › Heart Burst]` (back peak 112%)
4. **Linear tweens on things the player touches.** A linear or CSS `ease` release feels dead next to the 22/0.45 spring. `[UMP § Button Part 1 › Press Down]`
5. **Rigid sliding highlights.** A tab pill that slides as one block looks like a template. Give the two edges different springs. `[UMP § Tab Bar Part 1 › Sliding Pill]`
6. **Stagger with no direction.** Random or equal delays in both directions look busy. Enter in reading order, exit in reverse, and keep the step between 30 and 140 ms. `[UMP § Accordion Part 2 › Expand All]`
7. **Glow, gradients and glass on every surface.** The violet-to-cyan gradients, glow shadows and frosted panels in the site's demos are that brand's demo style. Copied wholesale into a zombie game they look generic and off-theme, and `backdrop-filter` is slow in WebView. Use the site's timings, not its look.
8. **Shipping demo artifacts.** The site's videos show a fake finger circle that grows from 125% to 100% before each tap. That circle exists to show the gesture in a video. Keep only the 23 → 52 px touch ring. `[UMP § Button Part 1 › Press Down]`
9. **Fixed-amplitude shakes.** A constant `@keyframes` wiggle reads as a glitch. Always decay it. `[UMP § Error Part 1 › Shake Input]`
10. **Numbers that snap.** A coin count or score that changes with no roll or punch looks unfinished in a game. `[UMP § Number Counter Part 1 › Odometer Roll]`
11. **Spinners where a skeleton fits.** For shop or stats loading, use a skeleton pulse on a 1.6 s loop or three bouncing dots with a 140 ms stagger, not a generic circle spinner. `[UMP § Thinking Part 4 › Skeleton Pulse]` `[UMP § Thinking Part 1 › Bouncing Dots]`
12. **Endless idle loops.** One idle effect per screen at most: the PLAY halo on home and the RETRY halo on game over. Many pulsing elements compete for attention and drain battery.
13. **Long UI motion during combat.** Nothing in the HUD runs longer than 600 ms except the combo timer and i-frames. Hit feedback stays at frame scale. `[GFP § Hit Feedback Part 1]`
14. **Animating layout properties.** No `width`, `height`, `top`, `left`, `margin` or `box-shadow` transitions. Use `scale`, `translate`, `clip-path` on small elements and `opacity`.
15. **Emoji and stock icons as the visual language.** Use a single icon style drawn for the game, such as thick outlined icons that match the zombie art.
16. **Blocking taps for decoration.** Only the card draft and the game-over buttons lock input, and only for the short window explained above. Everywhere else, a tap cancels or finishes the motion.
17. **Ignoring reduced motion.** Shakes, screen shake, big travel and idle loops must turn off under `prefers-reduced-motion: reduce`. Press feedback and color changes stay.

---

## Sources

- UI Motion Prompts: https://ui-motion-prompts.pages.dev/. All 75 pattern pages under `/p/` and `/components.html` were read. Only each page's free prompt and the short descriptions are public.
- Game Feel Prompts: https://game-feel-prompts.pages.dev/, linked from the UMP footer. Pages read: Hit Feedback 1, Coin Pickup 1, Combo Counter 1, Health Bar 1, Game Over 1, Card Draw 1, Rare Pull 1, Taking Damage 1, 6 Ways to Say Success 1.
- The spring `linear()` curves were sampled from the site's spring formula at 25 points over each spring's settle time.
