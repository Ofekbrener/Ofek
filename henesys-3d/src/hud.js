// Classic status bar (level, name, HP / MP / EXP), mesos, map banner,
// toasts, the settings panel and the death notice.
import { EXP_TABLE, JOBS, SKILLS, MAX_LEVEL } from './config.js';

const SHORT = { threeSnails: 'Snail', doubleShot: 'Double', arrowBlow: 'Blow', powerStrike: 'Power', slashBlast: 'Slash' };

export function createHud(root, { onReset, onToggle, settings }) {
  const el = document.createElement('div');
  el.id = 'hud';
  el.innerHTML = `
    <div class="status">
      <div class="lv"><small>LV.</small><b id="h-lv">1</b></div>
      <div class="who"><b id="h-name"></b><small id="h-job"></small></div>
      <div class="gauges">
        <div class="gauge hp"><i id="h-hp"></i><span id="h-hpt"></span></div>
        <div class="gauge mp"><i id="h-mp"></i><span id="h-mpt"></span></div>
      </div>
    </div>
    <div class="gauge exp"><i id="h-exp"></i><span id="h-expt"></span></div>
    <div class="topbar">
      <div class="mapname" id="h-map"></div>
      <div class="mesos"><span class="coin"></span><b id="h-mesos">0</b></div>
      <button class="ui gear" id="h-gear" aria-label="Settings">⚙</button>
    </div>
    <div class="toast" id="h-toast" hidden></div>
    <div class="ui panel" id="h-settings" hidden>
      <h2>Settings</h2>
      <label><input type="checkbox" id="h-sound"> Sound</label>
      <label><input type="checkbox" id="h-vib"> Vibration</label>
      <button id="h-reset" class="danger">New character (reset)</button>
      <div id="h-confirm" hidden><p>Delete this character and make a new one?</p><button id="h-yes" class="danger">Delete</button> <button id="h-no">Keep</button></div>
      <button id="h-close">Close</button>
    </div>
    <div class="ui panel death" id="h-death" hidden>
      <h2>You died</h2>
      <p>You lost <b id="h-lost">0</b> EXP. You will return to Henesys.</p>
      <button id="h-revive">OK</button>
    </div>`;
  root.appendChild(el);
  const $ = id => el.querySelector('#' + id);
  const s1 = document.getElementById('btn-skill1'), s2 = document.getElementById('btn-skill2');
  const cntRed = document.getElementById('cnt-red'), cntBlue = document.getElementById('cnt-blue');

  const panel = $('h-settings');
  $('h-sound').checked = settings.sound; $('h-vib').checked = settings.vibration;
  $('h-gear').onclick = () => { panel.hidden = !panel.hidden; $('h-confirm').hidden = true; };
  $('h-close').onclick = () => { panel.hidden = true; };
  $('h-sound').onchange = e => onToggle('sound', e.target.checked);
  $('h-vib').onchange = e => onToggle('vibration', e.target.checked);
  $('h-reset').onclick = () => { $('h-confirm').hidden = false; };
  $('h-no').onclick = () => { $('h-confirm').hidden = true; };
  $('h-yes').onclick = () => { panel.hidden = true; onReset(); };

  let toastTimer = 0, last = {};
  const set = (key, val, fn) => { if (last[key] !== val) { last[key] = val; fn(val); } };

  return {
    update(c) {
      set('lv', c.level, v => { $('h-lv').textContent = v; });
      set('name', c.name, v => { $('h-name').textContent = v; });
      set('job', c.job, v => {
        $('h-job').textContent = JOBS[v].name;
        const sk = JOBS[v].skills;
        [s1, s2].forEach((b, i) => { b.disabled = !sk[i]; b.textContent = sk[i] ? SHORT[sk[i]] : '—'; b.title = sk[i] ? SKILLS[sk[i]].name : ''; });
      });
      set('hp', c.hp + '/' + c.maxHp, v => { $('h-hp').style.width = (c.hp / c.maxHp * 100) + '%'; $('h-hpt').textContent = 'HP ' + v; });
      set('mp', c.mp + '/' + c.maxMp, v => { $('h-mp').style.width = (c.mp / c.maxMp * 100) + '%'; $('h-mpt').textContent = 'MP ' + v; });
      const need = c.level >= MAX_LEVEL ? 0 : EXP_TABLE[c.level];
      set('exp', c.exp + '/' + need, () => {
        const pct = need ? c.exp / need * 100 : 100;
        $('h-exp').style.width = pct + '%';
        $('h-expt').textContent = need ? `EXP ${c.exp} [${pct.toFixed(2)}%]` : 'MAX LEVEL';
      });
      set('mesos', c.mesos, v => { $('h-mesos').textContent = v.toLocaleString('en-US'); });
      set('red', c.potions.red, v => { cntRed.textContent = v; });
      set('blue', c.potions.blue, v => { cntBlue.textContent = v; });
    },
    mapName(name) {
      const m = $('h-map');
      m.textContent = name; m.classList.remove('show'); void m.offsetWidth; m.classList.add('show');
    },
    toast(text, ms = 3500) {
      const t = $('h-toast');
      t.textContent = text; t.hidden = false;
      clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, ms);
    },
    /** Shows the death notice; resolves when the player taps OK. */
    death(lost) {
      $('h-lost').textContent = lost;
      $('h-death').hidden = false;
      return new Promise(r => { $('h-revive').onclick = () => { $('h-death').hidden = true; r(); }; });
    },
  };
}
