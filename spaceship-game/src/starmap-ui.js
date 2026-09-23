import { GALAXIES } from './galaxies.js';

const $ = (id) => document.getElementById(id);
const hex = (n) => '#' + n.toString(16).padStart(6, '0');

export function starsHTML(n, total = 3, animate = false) {
  let h = '';
  for (let i = 0; i < total; i++) {
    const on = i < n;
    const style = animate && on ? ` style="animation-delay:${0.25 + i * 0.35}s"` : '';
    h += `<span class="${on ? '' : 'off'}${animate && on ? ' star-pop' : ''}"${style}>★</span>`;
  }
  return h;
}

// Star Map: galaxy nodes (bottom → top), plus Endless once the campaign is done.
export class StarMapUI {
  constructor(progression, { audio, onLaunch, onEndless }) {
    this.prog = progression;
    this.audio = audio;
    this.onLaunch = onLaunch;
    this.onEndless = onEndless;
    this.list = $('galaxy-list');
    this.brief = $('briefing');
    this.selected = 0;
    $('btn-brief-back').addEventListener('click', () => { this.audio.click(); this.brief.classList.add('hidden'); });
    $('btn-brief-go').addEventListener('click', () => {
      this.brief.classList.add('hidden');
      if (this.selected === 'endless') this.onEndless();
      else this.onLaunch(this.selected);
    });
  }

  get briefingOpen() { return !this.brief.classList.contains('hidden'); }

  // Galaxy the player would most likely want next.
  get suggested() { return Math.min(GALAXIES.length - 1, this.prog.unlocked - 1); }

  render() {
    const p = this.prog;
    $('map-stars').textContent = p.totalStars;
    this.list.textContent = '';
    GALAXIES.forEach((g, i) => {
      const unlocked = i < p.unlocked;
      const el = document.createElement('button');
      el.className = 'gnode' + (unlocked ? '' : ' locked') + (i === this.suggested && unlocked ? ' current' : '');
      el.innerHTML = `
        <div class="orb" style="background: radial-gradient(circle at 35% 30%, ${hex(g.planet.a)}, ${hex(g.planet.b)} 70%)"></div>
        <div>
          <div class="g-num">GALAXY ${i + 1}</div>
          <div class="g-name">${g.name}</div>
          <div class="g-boss">${unlocked ? `Boss: ${g.boss.name}` : '🔒 Beat the previous boss'}</div>
        </div>
        <div class="g-right stars-row">${unlocked ? starsHTML(p.starsFor(i)) : '🔒'}</div>`;
      el.addEventListener('click', () => {
        if (!unlocked) { this.audio.denied(); return; }
        this.audio.click();
        this.openBriefing(i);
      });
      this.list.appendChild(el);
    });

    // Endless node on top
    const e = document.createElement('button');
    const eu = p.endlessUnlocked;
    e.className = 'gnode' + (eu ? '' : ' locked');
    const best = p.data.endlessBest;
    e.innerHTML = `
      <div class="orb" style="background: conic-gradient(#3cf2ff, #ff3ca8, #ffd35c, #b04bff, #3cf2ff)"></div>
      <div>
        <div class="g-num">∞ ENDLESS</div>
        <div class="g-name">The Infinite Coop</div>
        <div class="g-boss">${eu ? `Best: wave ${best.wave} · ${best.score.toLocaleString()} pts` : '🔒 Defeat the Supreme Mother Hen'}</div>
      </div>
      <div class="g-right">${eu ? '▶' : '🔒'}</div>`;
    e.addEventListener('click', () => {
      if (!eu) { this.audio.denied(); return; }
      this.audio.click();
      this.openBriefing('endless');
    });
    this.list.appendChild(e);
    // Show the latest unlocked galaxy.
    requestAnimationFrame(() => {
      const cur = this.list.querySelector('.current');
      if (cur) cur.scrollIntoView({ block: 'center' });
    });
  }

  openBriefing(i) {
    this.selected = i;
    if (i === 'endless') {
      $('brief-num').textContent = '∞ ENDLESS';
      $('brief-name').textContent = 'The Infinite Coop';
      $('brief-stars').innerHTML = '';
      $('brief-text').textContent = 'The hens keep coming. Every galaxy, every boss, faster each loop. How far can you fly before you get fried?';
      $('brief-boss').textContent = 'ALL OF THEM';
    } else {
      const g = GALAXIES[i];
      $('brief-num').textContent = `GALAXY ${i + 1}`;
      $('brief-name').textContent = g.name.toUpperCase();
      $('brief-stars').innerHTML = starsHTML(this.prog.starsFor(i));
      $('brief-text').textContent = g.briefing;
      $('brief-boss').textContent = g.boss.name;
    }
    this.brief.classList.remove('hidden');
  }

  closeBriefing() { this.brief.classList.add('hidden'); }
}
