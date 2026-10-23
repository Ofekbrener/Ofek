// NPC dialog box in the classic style: name plate, text, Next / choices.
// showDialog resolves when the player closes it.
import { sfx } from './audio.js';

let box = null;

function ensure() {
  if (box) return box;
  box = document.createElement('div');
  box.className = 'ui dialog';
  box.hidden = true;
  box.innerHTML = '<div class="dlg-name"></div><p class="dlg-text"></p><div class="dlg-btns"></div>';
  document.getElementById('app').appendChild(box);
  return box;
}

export const dialogOpen = () => !!box && !box.hidden;

export function showDialog({ name, lines, choices }) {
  const el = ensure();
  el.querySelector('.dlg-name').textContent = name;
  const text = el.querySelector('.dlg-text'), btns = el.querySelector('.dlg-btns');
  el.hidden = false;
  sfx('ui_open');
  return new Promise(resolve => {
    let i = 0;
    const close = () => { el.hidden = true; btns.replaceChildren(); resolve(); };
    const button = (label, fn, cls = '') => {
      const b = document.createElement('button');
      b.textContent = label; b.className = cls;
      b.addEventListener('click', e => { e.stopPropagation(); sfx('ui_tap'); fn(); });
      btns.appendChild(b);
    };
    const render = () => {
      text.textContent = lines[i];
      btns.replaceChildren();
      const last = i === lines.length - 1;
      if (last && choices?.length) {
        for (const c of choices) button(c.label, () => { close(); c.onPick?.(); }, 'pick');
        button('Not now', close);
      } else if (last) button('OK', close, 'pick');
      else button('Next', () => { i++; render(); }, 'pick');
    };
    render();
  });
}
