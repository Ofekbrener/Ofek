import { LEAGUES, CAREER, careerIndex, ordinal } from './leagues.js';
import { GALAXIES } from '../galaxies.js';

const $ = (id) => document.getElementById(id);
const hex = (n) => '#' + n.toString(16).padStart(6, '0');
const MEDAL = ['', '🥇', '🥈', '🥉'];

export function fmtTime(t) {
  const m = Math.floor(t / 60);
  const s = t - m * 60;
  return `${m}:${s.toFixed(2).padStart(5, '0')}`;
}

// Power chip: "⚡ Ship Power X · Recommended Y", red-ish if under-powered.
export function powerHTML(have, need, short = false) {
  const ok = have >= need;
  return `<span class="power-chip-rr ${ok ? 'ok' : 'low'}">⚡ ${short ? `Power ${have}/${need}` : `Ship Power ${have} · Recommended ${need}`}</span>`;
}

// Career menu: the 9 races in order, grouped by league. Race N+1 unlocks with a
// podium in race N; each row shows what the race introduces and Ship Power.
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
    const power = p.shipPower;
    $('race-power').innerHTML = `⚡ Ship Power <b>${power}</b> · 🏆 ${p.trophies} ${p.trophies === 1 ? 'trophy' : 'trophies'} · trophies unlock Dodge galaxies`;
    const next = p.nextCareerRace;
    this.list.textContent = '';
    let n = 0;
    let current = null;
    for (const lg of LEAGUES) {
      const open = p.leagueUnlocked(lg);
      const card = document.createElement('div');
      card.className = 'league' + (open ? '' : ' locked');
      card.innerHTML = `
        <div class="league-head"><span class="league-icon">${lg.icon}</span><div><div class="league-name">${lg.name}</div>
        <div class="league-sub">${open ? `1st prize: 🍗 ${lg.prize[0]} · podium = 🏆` : `🔒 Podium every race before it to unlock`}</div></div></div>`;
      for (const t of lg.tracks) {
        n++;
        const ci = careerIndex(t.id);
        const unlocked = p.raceUnlocked(t.id);
        const best = p.bestPlace(t.id);
        const g = GALAXIES[t.theme];
        const isNext = next && next.track === t;
        const row = document.createElement('button');
        row.className = 'track-row' + (unlocked ? '' : ' locked') + (isNext ? ' current' : '');
        row.disabled = !unlocked;
        const tag = t.intro ? `<span class="track-tag">${t.intro.title.startsWith('NEW') || t.intro.title.startsWith('FINAL') ? t.intro.title : `NEW: ${t.intro.title}`}</span>` : '';
        const status = unlocked
          ? powerHTML(power, t.power, true)
          : `<span class="track-lock">🔒 Podium in ${CAREER[ci - 1].track.name} to unlock</span>`;
        row.innerHTML = `
          <span class="track-dot" style="background:radial-gradient(circle at 35% 30%, ${hex(g.planet.a)}, ${hex(g.planet.b)})"><b>${n}</b></span>
          <span class="track-name">${t.name}<small>Race ${n} · ${t.laps} lap${t.laps === 1 ? "" : "s"} · ${g.name}</small>${tag}${status}</span>
          <span class="track-best">${best ? `${MEDAL[best] || ''} ${ordinal(best)}` : unlocked ? '▶' : '🔒'}</span>`;
        row.addEventListener('click', () => {
          if (!unlocked) { this.audio.denied(); return; }
          this.audio.click();
          this.onRace(lg, t);
        });
        if (isNext) current = row;
        card.appendChild(row);
      }
      this.list.appendChild(card);
    }
    // Scroll the next race into view.
    if (current) requestAnimationFrame(() => current.scrollIntoView({ block: 'center' }));
  }
}

// Results table after a race.
export function showResults({ results, place, prize, newTrophy, title, trackName, nextLabel, power }) {
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
  const pw = $('rr-power');
  pw.classList.toggle('hidden', !power);
  if (power) pw.innerHTML = powerHTML(power.have, power.need);
  const note = $('rr-note');
  note.classList.toggle('hidden', !newTrophy);
  if (newTrophy) note.innerHTML = newTrophy;   // internal strings; may contain <br>
  const nb = $('btn-rr-next');
  nb.classList.toggle('hidden', !nextLabel);
  if (nextLabel) nb.textContent = nextLabel;
}
