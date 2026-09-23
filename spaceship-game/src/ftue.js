import { RACE_UPGRADES, CAREER, careerIndex } from './race/leagues.js';
import { upgradeCost } from './progression.js';
import { GALAXIES } from './galaxies.js';

// First-time user experience: welcome screen, guided hand-off modals and the
// "next step" card that always names the single next action of the core loop:
//   Race → 🏆 Trophy → 🐔 Dodge galaxy → 🍗 Drumsticks → 🛠 Garage → harder race.
// Seen-flags live in the save (prog.data.ftue) so guidance shows once.

const $ = (id) => document.getElementById(id);

export const raceLabel = (trackId) => {
  const i = careerIndex(trackId);
  return `Race ${i + 1}: ${CAREER[i].track.name}`;
};

// Race Garage helpers.
function raceUpgradeOptions(prog) {
  return RACE_UPGRADES
    .filter((u) => prog.level(u.id) < u.max)
    .map((u) => ({ u, cost: upgradeCost(u, prog.level(u.id)) }))
    .sort((a, b) => a.cost - b.cost);
}
export function cheapestRaceUpgrade(prog) { return raceUpgradeOptions(prog)[0] || null; }
export function cheapestAffordableRaceUpgrade(prog) {
  return raceUpgradeOptions(prog).find((o) => o.cost <= prog.crystals) || null;
}

// Highest galaxy whose boss isn't beaten yet and that is launchable now.
function frontierGalaxy(prog) {
  const i = prog.unlocked - 1;
  return i < GALAXIES.length && prog.galaxyOpen(i) ? i : -1;
}
// Best galaxy to replay for drumsticks (latest open one).
export function farmGalaxy(prog) {
  for (let i = Math.min(GALAXIES.length - 1, prog.unlocked - 1); i >= 0; i--) if (prog.galaxyOpen(i)) return i;
  return -1;
}

// The single next action, by priority:
// 1. first race  2. next race if the ship is powerful enough  3. first ever Dodge run
// 4. affordable Garage upgrade  5. newly opened galaxy  6. farm drumsticks for the
// next upgrade  7. endgame.
// Returns {icon, title, text, label, action} where action is one of
// {type:'race', league, track} | {type:'garage', upgrade} | {type:'galaxy', index}
// | {type:'endless'} | {type:'raceMenu'}.
export function nextStep(prog) {
  const r = prog.nextCareerRace;
  const power = prog.shipPower;
  const g = frontierGalaxy(prog);
  const buy = cheapestAffordableRaceUpgrade(prog);
  const raceStep = (c) => ({
    icon: '🏁',
    title: `Win a podium in ${raceLabel(c.track.id)}`,
    text: `⚡ Ship Power ${power}/${c.track.power} · top 3 wins a 🏆`,
    label: 'RACE ➜',
    action: { type: 'race', league: c.league, track: c.track },
    ok: power >= c.track.power,
  });

  if (r && careerIndex(r.track.id) === 0) return raceStep(r);
  if (r && power >= r.track.power) return raceStep(r);
  const galaxyStep = {
    icon: '🐔',
    title: `Galaxy ${g + 1} unlocked — fly it!`,
    text: `${g >= 0 ? GALAXIES[g].name : ''} · dodge hens, grab 🍗 drumsticks`,
    label: 'FLY ➜',
    action: { type: 'galaxy', index: g },
  };
  if (g >= 0 && !prog.ftueSeen('dodged')) return galaxyStep;
  if (buy && (r || g < 0)) {
    return {
      icon: '🛠',
      title: `Upgrade ${buy.u.name} in the Garage`,
      text: `🍗 ${prog.crystals}/${buy.cost} · +1 ⚡ Ship Power${r ? ` (need ${r.track.power} for ${r.track.name})` : ''}`,
      label: 'GARAGE ➜',
      action: { type: 'garage', upgrade: buy.u.id },
    };
  }
  if (g >= 0) return galaxyStep;
  if (r) {
    const want = cheapestRaceUpgrade(prog);
    const fg = farmGalaxy(prog);
    if (want && fg >= 0) {
      return {
        icon: '🍗',
        title: `Earn 🍗 to afford ${want.u.name}`,
        text: `🍗 ${prog.crystals}/${want.cost} · fly ${GALAXIES[fg].name} in the Dodge journey`,
        label: 'DODGE ➜',
        action: { type: 'galaxy', index: fg },
      };
    }
    return raceStep(r);   // maxed out or nothing to fly: just race
  }
  if (prog.endlessUnlocked) {
    return { icon: '∞', title: 'Chase a record in Endless', text: 'Every race podiumed, every hen defeated. Legend!', label: 'ENDLESS ➜', action: { type: 'endless' } };
  }
  return { icon: '🥇', title: 'Go for gold medals', text: 'Beat your best places in the Race League', label: 'RACES ➜', action: { type: 'raceMenu' } };
}

// Reusable guided hand-off modal (one at a time). Buttons: [{label, primary, onClick}].
// Tapping a button closes the modal first, then runs its handler.
export class Handoff {
  constructor(audio) {
    this.audio = audio;
    this.el = $('handoff');
    this.btns = $('ho-btns');
    this.pending = null;
  }

  get open() { return !this.el.classList.contains('hidden'); }

  show({ icon, title, text, buttons = [], celebrate = false }) {
    clearTimeout(this.pending);
    $('ho-icon').textContent = icon;
    $('ho-title').textContent = title;
    $('ho-text').innerHTML = text;
    this.el.classList.toggle('celebrate', celebrate);
    this.btns.textContent = '';
    for (const b of buttons) {
      const btn = document.createElement('button');
      btn.className = b.primary ? 'primary-btn' : 'secondary-btn';
      btn.textContent = b.label;
      btn.addEventListener('click', () => {
        this.hide();
        if (b.onClick) b.onClick(); else this.audio.click();
      });
      this.btns.appendChild(btn);
    }
    this.el.classList.remove('hidden');
    // Replay the pop-in animation.
    const panel = this.el.firstElementChild;
    panel.style.animation = 'none';
    void panel.offsetWidth;
    panel.style.animation = '';
  }

  // Show after `ms` if `stillValid()` is true then (the player may have moved on).
  showLater(ms, opts, stillValid = () => true) {
    clearTimeout(this.pending);
    this.pending = setTimeout(() => { if (stillValid()) this.show(opts); }, ms);
  }

  // Press the primary button (keyboard Enter).
  confirm() {
    const b = this.btns.querySelector('.primary-btn') || this.btns.firstElementChild;
    if (b) b.click();
  }

  hide() {
    clearTimeout(this.pending);
    this.el.classList.add('hidden');
  }
}
