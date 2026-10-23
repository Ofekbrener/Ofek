// Classic status bar (level, name, HP / MP / EXP), mesos, map banner,
// toasts, the settings panel and the death notice.
import { EXP_TABLE, JOBS, SKILLS, MAX_LEVEL } from './config.js';


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
      <div class="mapcol"><div class="mapname" id="h-map"></div><div class="buffs" id="h-buffs"></div><div class="quests" id="h-quests"></div></div>
      <div class="mesos"><span class="coin"></span><b id="h-mesos">0</b></div>
      <button class="ui gear" id="h-gear" aria-label="Settings">⚙</button>
    </div>
    <div class="toast" id="h-toast" hidden></div>
    <div class="ui panel" id="h-settings" hidden>
      <h2>Settings</h2>
      <label><input type="checkbox" id="h-sound"> Sound</label>
      <label><input type="checkbox" id="h-vib"> Vibration</label>
      <label>Controls <select id="h-ctl"><option value="classic">Classic: up walks, sideways turns</option><option value="free">Free: walk where you push</option></select></label>
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
  const skillBtns = [1, 2, 3, 4].map(i => document.getElementById('btn-skill' + i));
  const cntRed = document.getElementById('cnt-red'), cntBlue = document.getElementById('cnt-blue');

  const panel = $('h-settings');
  $('h-sound').checked = settings.sound; $('h-vib').checked = settings.vibration;
  $('h-gear').onclick = () => { panel.hidden = !panel.hidden; $('h-confirm').hidden = true; };
  $('h-close').onclick = () => { panel.hidden = true; };
  $('h-sound').onchange = e => onToggle('sound', e.target.checked);
  $('h-vib').onchange = e => onToggle('vibration', e.target.checked);
  $('h-ctl').value = settings.controls ?? 'classic';
  $('h-ctl').onchange = e => onToggle('controls', e.target.value);
  $('h-reset').onclick = () => { $('h-confirm').hidden = false; };
  $('h-no').onclick = () => { $('h-confirm').hidden = true; };
  $('h-yes').onclick = () => { panel.hidden = true; onReset(); };

  let toastTimer = 0, last = {};
  const set = (key, val, fn) => { if (last[key] !== val) { last[key] = val; fn(val); } };

  return {
    update(c, extra = {}) {
      set('lv', c.level, v => { $('h-lv').textContent = v; });
      set('name', c.name, v => { $('h-name').textContent = v; });
      set('job', c.job, v => { $('h-job').textContent = JOBS[v].name; });
      // skill buttons: name, lock level, cooldown sweep
      const sk = JOBS[c.job].skills;
      skillBtns.forEach((b, i) => {
        const id = sk[i], s = id && SKILLS[id];
        const locked = !s || c.level < s.level;
        set('sk' + i, `${id}|${locked}`, () => {
          b.disabled = !s;
          b.hidden = !s;
          b.classList.toggle('locked', !!s && locked);
          b.querySelector('span').textContent = !s ? '—' : locked ? `Lv ${s.level}` : s.short;
          b.title = s ? s.name : '';
        });
        if (s && !locked) {
          const left = extra.cooldown?.(id) ?? 0;
          b.style.setProperty('--cd', s.cooldown ? Math.min(1, left / s.cooldown) : 0);
          b.classList.toggle('nomp', c.mp < s.mp);
        }
      });
      // quest tracker
      const qs = extra.quests ?? [];
      set('quests', qs.map(q => q.id + q.count + q.status).join(), () => {
        $('h-quests').innerHTML = qs.map(q => `<div class="q${q.status === 'ready' ? ' ready' : ''}">${q.goal.label} <b>${Math.min(q.count, q.goal.count)}/${q.goal.count}</b>${q.status === 'ready' ? ' ✓' : ''}</div>`).join('');
      });
      // buff icons with seconds left
      const buffs = extra.buffs ?? [];
      set('buffs', buffs.map(x => x.id + Math.ceil(x.left)).join(), () => {
        $('h-buffs').innerHTML = buffs.map(x => `<span class="buff b-${x.id}">${SKILLS[x.id].short}<b>${Math.ceil(x.left)}</b></span>`).join('');
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
    /** Pop animation on a HUD number: 'mesos', 'red', 'blue' or 'lv'. */
    bump(what) {
      const el = { mesos: $('h-mesos'), lv: $('h-lv'), red: cntRed, blue: cntBlue }[what];
      if (!el) return;
      el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump');
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
