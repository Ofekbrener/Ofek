// Haptics: phone vibration on impacts.
// Android browsers: navigator.vibrate with timed patterns (strength comes from pulse length).
// iPhone (iOS 18+): Safari has no vibrate API; toggling a native <input type=checkbox switch> plays the system tap,
// so each pulse becomes one tap. Gamepads with rumble motors get a dual-rumble effect when one is connected.
'use strict';
const HAPTIC = {on: true, last: 0, lastS: 0, ios: null, pad: null};
try { HAPTIC.on = localStorage.getItem('ozHaptics') !== 'off'; } catch (e) {}
HAPTIC.supported = () => !!navigator.vibrate || HAPTIC.isIOS();
HAPTIC.isIOS = () => /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
(function iosSwitch() {
  const label = document.createElement('label'), input = document.createElement('input');
  input.type = 'checkbox'; input.setAttribute('switch', ''); input.tabIndex = -1; input.setAttribute('aria-hidden', 'true');
  label.appendChild(input); label.style.cssText = 'position:fixed;left:-9999px;top:0;width:1px;height:1px;opacity:0;pointer-events:none';
  document.body.appendChild(label); HAPTIC.ios = label;
})();
addEventListener('gamepadconnected', e => { HAPTIC.pad = e.gamepad.index; });
addEventListener('gamepaddisconnected', () => { HAPTIC.pad = null; });

// pattern: [on, off, on, ...] in ms. strength 0..1 scales gamepad rumble.
HAPTIC.pulse = function (pattern, strength = .6, minGap = 45) {
  if (!HAPTIC.on) return;
  // rate limit weak pulses; a stronger event always cuts through (getting hurt right after a hit still buzzes)
  const now = performance.now(); if (now - HAPTIC.last < minGap && strength <= HAPTIC.lastS) return; HAPTIC.last = now; HAPTIC.lastS = strength;
  const p = Array.isArray(pattern) ? pattern : [pattern];
  try { if (navigator.vibrate) navigator.vibrate(p); } catch (e) {}
  if (!navigator.vibrate && HAPTIC.isIOS() && HAPTIC.ios) { // one system tap per pulse
    let t = 0; for (let i = 0; i < p.length; i += 2) { setTimeout(() => HAPTIC.ios.click(), t); t += p[i] + (p[i + 1] || 0); }
  }
  if (HAPTIC.pad !== null) {
    const gp = navigator.getGamepads && navigator.getGamepads()[HAPTIC.pad], act = gp && gp.vibrationActuator;
    const dur = p.reduce((s, v) => s + v, 0);
    if (act && act.playEffect) act.playEffect('dual-rumble', {duration: dur, strongMagnitude: strength, weakMagnitude: Math.min(1, strength + .2)}).catch(() => {});
  }
};
// named events, weakest to strongest
const HAPTIC_FX = {
  hit: [[14], .3], crit: [[24], .5], kill: [[28], .55], multiKill: [[30, 40, 45], .8],
  land: [[12], .25], slam: [[70], .9], explosion: [[80, 30, 120], 1], bossSlam: [[110], 1],
  hurt: [[60, 40, 90], .9], death: [[200, 80, 320], 1], waveClear: [[30, 60, 30, 60, 90], .6],
  card: [[16], .3], boss: [[40, 60, 40, 60, 140], .8], heart: [[20, 50, 20], .4],
};
HAPTIC.fx = function (name, scale = 1) {
  const f = HAPTIC_FX[name]; if (!f) return;
  HAPTIC.pulse(scale === 1 ? f[0] : f[0].map((v, i) => i % 2 ? v : Math.max(8, Math.round(v * scale))), f[1] * scale, name === 'hit' ? 45 : 20);
};
HAPTIC.toggle = function () {
  HAPTIC.on = !HAPTIC.on; try { localStorage.setItem('ozHaptics', HAPTIC.on ? 'on' : 'off'); } catch (e) {}
  if (HAPTIC.on) HAPTIC.fx('kill');
  return HAPTIC.on;
};
