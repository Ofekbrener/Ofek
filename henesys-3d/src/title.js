// Title screen: pick a name and one of three looks. Resolves { name, look }.
import { LOOKS } from './assets/characters.js';

/** New-character screen. Resolves { name, look }. */
export function showTitle(root) {
  const el = document.createElement('div');
  el.className = 'ui title';
  el.innerHTML = `
    <div class="logo"><span>Henesys</span><em>3D</em></div>
    <p class="tag">A MapleStory Classic tribute</p>
    <div class="card">
      <label for="t-name">Character name</label>
      <input id="t-name" maxlength="12" autocomplete="off" spellcheck="false" placeholder="Beginner">
      <div class="looks">${LOOKS.map((l, i) => `
        <button class="look${i ? '' : ' on'}" data-look="${i}" aria-label="${l.name}">
          <span style="background:#${l.hair.toString(16).padStart(6, '0')}"></span>
          <span style="background:#${l.shirt.toString(16).padStart(6, '0')}"></span>
          <span style="background:#${l.pants.toString(16).padStart(6, '0')}"></span>
          <small>${l.name}</small>
        </button>`).join('')}
      </div>
      <button class="start" id="t-start">Start</button>
    </div>
    <p class="fine">Fan project. MapleStory and its characters belong to Nexon.</p>`;
  root.appendChild(el);
  let look = 0;
  el.querySelectorAll('.look').forEach(b => b.onclick = () => {
    look = Number(b.dataset.look);
    el.querySelectorAll('.look').forEach(x => x.classList.toggle('on', x === b));
  });
  return new Promise(resolve => {
    el.querySelector('#t-start').onclick = () => {
      const name = el.querySelector('#t-name').value.trim().replace(/[^\w ]/g, '') || 'Beginner';
      el.remove();
      resolve({ name, look });
    };
  });
}
