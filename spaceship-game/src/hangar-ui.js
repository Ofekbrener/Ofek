import { UPGRADES, SKINS, COSMETICS, COSMETIC_SLOTS, upgradeCost, upgradeLevels } from './progression.js';
import { ShipPreview } from './ship-preview.js';
import { RACE_UPGRADES } from './race/leagues.js';

const $ = (id) => document.getElementById(id);
const hex = (n) => '#' + n.toString(16).padStart(6, '0');

// DOM for the persistent Hangar (upgrades + skins).
export class HangarUI {
  constructor(progression, { audio, haptics, onChange, onBuy }) {
    this.prog = progression;
    this.audio = audio;
    this.haptics = haptics;
    this.onChange = onChange;
    this.onBuy = onBuy || (() => {});
    this.highlightId = null;   // FTUE: upgrade to point at with a pulsing glow
    this.lockTo = null;        // tutorial: only this upgrade can be bought (tabs locked)
    this.upgradeList = $('upgrade-list');
    this.raceList = $('race-upgrade-list');
    this.skinList = $('skin-list');
    this.addonSlots = $('addon-slots');
    this.addonList = $('addon-list');
    this.addonSlot = 'hat';
    this.balance = $('hangar-crystals');
    // Live 3D turntable of the pod with every purchased upgrade on it.
    this.preview = new ShipPreview($('hangar-preview'));
    // Tabs keep each list short enough to fit on one screen.
    this.tabs = [...document.querySelectorAll('#screen-hangar .tab')];
    for (const t of this.tabs) t.addEventListener('click', () => {
      if (this.lockTo) { this.audio.denied(); return; }
      this.audio.click(); this.setTab(t.dataset.tab);
    });
    this.setTab('dodge');
  }

  setTab(name) {
    this.tab = name;
    for (const t of this.tabs) t.classList.toggle('active', t.dataset.tab === name);
    for (const pane of document.querySelectorAll('#screen-hangar [data-pane]')) pane.classList.toggle('pane-off', pane.dataset.pane !== name);
  }

  render(flashId = null) {
    const p = this.prog;
    this.balance.textContent = p.crystals.toLocaleString();

    this._renderUpgrades(this.upgradeList, UPGRADES, flashId);
    this._renderUpgrades(this.raceList, RACE_UPGRADES, flashId);
    this._renderSkins(flashId);
    this._renderAddons(flashId);

    this.preview.setSkin(p.skin);
    this.preview.setUpgrades(upgradeLevels(p));
    if (flashId) this.preview.pop();
  }

  _renderUpgrades(list, defs, flashId) {
    const p = this.prog;
    list.textContent = '';
    for (const u of defs) {
      const lvl = p.level(u.id);
      const maxed = lvl >= u.max;
      const cost = maxed ? 0 : upgradeCost(u, lvl);
      const row = document.createElement('div');
      row.className = 'upgrade' + (flashId === u.id ? ' bought' : '') + (this.highlightId === u.id && !maxed ? ' ftue-glow' : '');
      row.dataset.id = u.id;
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
      btn.disabled = maxed || p.crystals < cost || (this.lockTo && this.lockTo !== u.id);
      btn.addEventListener('click', () => {
        if (p.buy(u.id)) {
          this.audio.purchase();
          this.haptics.purchase();
          if (this.highlightId === u.id) this.highlightId = null;
          this.render(u.id);
          this.onChange();
          this.onBuy(u.id);
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

// Add-ons: slot chips (hats / wings / trails / pets) over a grid of that slot's items.
HangarUI.prototype._renderAddons = function (flashId) {
  const p = this.prog;
  this.addonSlots.textContent = '';
  for (const sl of COSMETIC_SLOTS) {
    const b = document.createElement('button');
    const worn = p.data.wear[sl.id];
    b.className = 'addon-slot' + (sl.id === this.addonSlot ? ' active' : '');
    b.innerHTML = `<span>${sl.icon}</span>${sl.name}${worn ? '<i></i>' : ''}`;
    b.addEventListener('click', () => { this.audio.click(); this.addonSlot = sl.id; this._renderAddons(); });
    this.addonSlots.appendChild(b);
  }
  this.addonList.textContent = '';
  for (const c of COSMETICS.filter((x) => x.slot === this.addonSlot)) {
    const owned = p.ownsAddon(c.id);
    const worn = p.wearing(c.id);
    const card = document.createElement('div');
    card.className = 'skin addon' + (worn ? ' equipped' : '') + (flashId === c.id ? ' bought' : '');
    card.innerHTML = `<div class="a-icon">${c.icon}</div><div class="s-name">${c.name}</div>`;
    const btn = document.createElement('button');
    btn.className = 'buy-btn' + (worn ? ' maxed' : '');
    if (worn) btn.textContent = 'WEARING';
    else if (owned) btn.textContent = 'WEAR';
    else { btn.innerHTML = `🍗 ${c.cost}`; btn.disabled = p.crystals < c.cost; }
    btn.addEventListener('click', () => {
      const ok = owned ? p.toggleAddon(c.id) : p.buyAddon(c.id);
      if (!ok) { this.audio.denied(); return; }
      if (owned) this.audio.click(); else { this.audio.purchase(); this.haptics.purchase(); }
      this.render(c.id);
      this.onChange();
    });
    card.appendChild(btn);
    this.addonList.appendChild(card);
  }
};

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
