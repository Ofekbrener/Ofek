import { LEAGUES, ordinal } from './leagues.js';
import { GALAXIES } from '../galaxies.js';

const $ = (id) => document.getElementById(id);
const hex = (n) => '#' + n.toString(16).padStart(6, '0');
const MEDAL = ['', '🥇', '🥈', '🥉'];

export function fmtTime(t) {
  const m = Math.floor(t / 60);
  const s = t - m * 60;
  return `${m}:${s.toFixed(2).padStart(5, '0')}`;
}

// League menu: 3 leagues × 3 tracks, with lock rules and best results.
export class RaceMenuUI {
  constructor(prog, { audio, onRace }) {
    this.prog = prog;
    this.audio = audio;
    this.onRace = onRace;
    this.list = $('league-list');
  }

  render() {
    const p = this.prog;
    $('race-trophies').textContent = p.trophies;
    this.list.textContent = '';
    for (const lg of LEAGUES) {
      const open = p.leagueUnlocked(lg);
      const card = document.createElement('div');
      card.className = 'league' + (open ? '' : ' locked');
      let lockTxt = '';
      if (!open) {
        const u = lg.unlock;
        const prev = LEAGUES.find((l) => l.id === u.league);
        lockTxt = `🔒 Clear Galaxy ${u.galaxies} in the Dodge journey + ${u.trophies} trophies in ${prev.name} (${p.leagueTrophies(u.league)}/${u.trophies})`;
      }
      card.innerHTML = `
        <div class="league-head"><span class="league-icon">${lg.icon}</span><div><div class="league-name">${lg.name}</div>
        <div class="league-sub">${open ? `1st prize: 🍗 ${lg.prize[0]} · Rival speed ${lg.baseSpeed * 6} km/h` : lockTxt}</div></div></div>`;
      for (const t of lg.tracks) {
        const best = p.bestPlace(t.id);
        const g = GALAXIES[t.theme];
        const row = document.createElement('button');
        row.className = 'track-row';
        row.disabled = !open;
        row.innerHTML = `
          <span class="track-dot" style="background:radial-gradient(circle at 35% 30%, ${hex(g.planet.a)}, ${hex(g.planet.b)})"></span>
          <span class="track-name">${t.name}<small>${t.laps} laps · ${g.name}</small></span>
          <span class="track-best">${best ? `${MEDAL[best] || ''} ${ordinal(best)}` : '—'}</span>`;
        row.addEventListener('click', () => {
          if (!open) { this.audio.denied(); return; }
          this.audio.click();
          this.onRace(lg, t);
        });
        card.appendChild(row);
      }
      this.list.appendChild(card);
    }
  }
}

// Results table after a race.
export function showResults({ results, place, prize, newTrophy, title, trackName, nextLabel }) {
  $('rr-title').textContent = title;
  $('rr-track').textContent = trackName.toUpperCase();
  $('rr-place').innerHTML = `${MEDAL[place] || ''} ${ordinal(place)}`;
  const tb = $('rr-table');
  tb.textContent = '';
  for (const r of results) {
    const row = document.createElement('div');
    row.className = 'rr-row' + (r.isPlayer ? ' me' : '');
    row.innerHTML = `<span>${ordinal(r.place)}</span><span><i style="background:${hex(r.color)}"></i>${r.name}</span><span>${fmtTime(r.time)}</span>`;
    tb.appendChild(row);
  }
  $('rr-prize').textContent = `+${prize}`;
  const note = $('rr-note');
  note.classList.toggle('hidden', !newTrophy);
  if (newTrophy) note.textContent = newTrophy;
  const nb = $('btn-rr-next');
  nb.classList.toggle('hidden', !nextLabel);
  if (nextLabel) nb.textContent = nextLabel;
}
