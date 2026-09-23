import { UPGRADES, SKINS, upgradeCost } from './progression.js';
import { RACE_UPGRADES } from './race/leagues.js';

const $ = (id) => document.getElementById(id);
const hex = (n) => '#' + n.toString(16).padStart(6, '0');

// DOM for the persistent Hangar (upgrades + skins).
export class HangarUI {
  constructor(progression, { audio, haptics, onChange }) {
    this.prog = progression;
    this.audio = audio;
    this.haptics = haptics;
    this.onChange = onChange;
    this.upgradeList = $('upgrade-list');
    this.raceList = $('race-upgrade-list');
    this.skinList = $('skin-list');
    this.balance = $('hangar-crystals');
  }

  render(flashId = null) {
    const p = this.prog;
    this.balance.textContent = p.crystals.toLocaleString();

    this._renderUpgrades(this.upgradeList, UPGRADES, flashId);
    this._renderUpgrades(this.raceList, RACE_UPGRADES, flashId);
    this._renderSkins(flashId);
  }

  _renderUpgrades(list, defs, flashId) {
    const p = this.prog;
    list.textContent = '';
    for (const u of defs) {
      const lvl = p.level(u.id);
      const maxed = lvl >= u.max;
      const cost = maxed ? 0 : upgradeCost(u, lvl);
      const row = document.createElement('div');
      row.className = 'upgrade' + (flashId === u.id ? ' bought' : '');
      row.innerHTML = `
        <div class="u-icon">${u.icon}</div>
        <div>
          <div class="u-name">${u.name}</div>
          <div class="u-desc">${!maxed && lvl ? 'Next: ' : ''}${u.desc(maxed ? lvl : lvl + 1)}</div>
          <div class="pips">${Array.from({ length: u.max }, (_, i) => `<i class="pip${i < lvl ? ' on' : ''}"></i>`).join('')}</div>
        </div>`;
      const btn = document.createElement('button');
      btn.className = 'buy-btn' + (maxed ? ' maxed' : '');
      btn.innerHTML = maxed ? 'MAX' : `🍗 ${cost}`;
      btn.disabled = maxed || p.crystals < cost;
      
      btn.addEventListener('click', () => {
        if (p.buy(u.id)) {
          this.audio.purchase();
          this.haptics.purchase();
          this.render(u.id);
          this.onChange();
        } else {
          this.audio.denied();
        }
      });
      row.appendChild(btn);
      list.appendChild(row);
    }
  }

  _renderSkins(flashId) {
    const p = this.prog;
    this.skinList.textContent = '';
    for (const s of SKINS) {
      const owned = p.ownsSkin(s.id);
      const equipped = p.skin.id === s.id;
      const card = document.createElement('div');
      card.className = 'skin' + (equipped ? ' equipped' : '') + (flashId === s.id ? ' bought' : '');
      const t = s.trail.map((c) => Math.round(c * 255));
      card.innerHTML = `
        <div class="swatch"><i style="background:${hex(s.hull)}"></i><i style="background:${hex(s.accent)}"></i><i style="background:rgb(${t.join(',')})"></i></div>
        <div class="s-name">${s.name}</div>`;
      const btn = document.createElement('button');
      btn.className = 'buy-btn' + (equipped ? ' maxed' : '');
      if (equipped) {
        btn.textContent = 'EQUIPPED';
        btn.disabled = true;
      } else if (owned) {
        btn.textContent = 'EQUIP';
      } else {
        btn.innerHTML = `🍗 ${s.cost}`;
        btn.disabled = p.crystals < s.cost;
      }
      btn.addEventListener('click', () => {
        const ok = owned ? p.equipSkin(s.id) : p.buySkin(s.id);
        if (ok) {
          if (owned) this.audio.click(); else { this.audio.purchase(); this.haptics.purchase(); }
          this.render(s.id);
          this.onChange();
        } else {
          this.audio.denied();
        }
      });
      card.appendChild(btn);
      this.skinList.appendChild(card);
    }
  }
}

// Renders the pick-1-of-3 power-up cards. Calls onPick(def) once.
export function showCards(title, cards, onPick) {
  $('cards-title').textContent = title;
  const list = $('card-list');
  list.textContent = '';
  let done = false;
  const pick = (def, el) => {
    if (done) return;
    done = true;
    el.classList.add('picked');
    setTimeout(() => onPick(def), 260);
  };
  const els = cards.map((def, i) => {
    const el = document.createElement('button');
    el.className = 'card';
    el.innerHTML = `
      <div class="c-icon">${def.icon}</div>
      <div><div class="c-name">${def.name}</div><div class="c-desc">${def.desc}</div></div>
      <div class="c-key">${i + 1}</div>`;
    el.addEventListener('click', () => pick(def, el));
    list.appendChild(el);
    return el;
  });
  // Keyboard shortcut helper for main.js
  return (index) => { if (cards[index]) pick(cards[index], els[index]); };
}
