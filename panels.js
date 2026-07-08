/* MediaHub Arcade — UI-Renderer für Shop, Missionen, Inventar, Statistiken */

import { SKINS, ABILITIES } from './catalog.js';
import {
  getState, buySkin, selectSkin, buyAbility, toggleAbility,
  missionState, claimMission, levelInfo,
} from './progression.js';

/* ---------- Shop ---------- */
export function renderShop(container, onChange) {
  const s = getState();
  container.innerHTML = `
    <div class="shop-tabs">
      <button class="tab active" data-tab="skins">Skins</button>
      <button class="tab" data-tab="abilities">Fähigkeiten</button>
    </div>
    <div class="shop-body" id="shopBody"></div>
  `;
  const body = container.querySelector('#shopBody');
  const tabs = container.querySelectorAll('.tab');
  tabs.forEach(t => t.addEventListener('click', () => {
    tabs.forEach(x => x.classList.remove('active'));
    t.classList.add('active');
    render(t.dataset.tab);
  }));
  render('skins');

  function render(tab) {
    body.innerHTML = '';
    const items = tab === 'skins'
      ? Object.entries(SKINS).map(([id, v]) => ({ id, ...v, kind: 'skin' }))
      : Object.entries(ABILITIES).map(([id, v]) => ({ id, ...v, kind: 'ability' }));

    for (const it of items) {
      const st = getState();
      const owned = it.kind === 'skin'
        ? st.ownedSkins.includes(it.id)
        : st.ownedAbilities.includes(it.id);
      const active = it.kind === 'skin'
        ? st.activeSkin === it.id
        : st.activeAbilities.includes(it.id);
      const canAfford = st.coins >= it.price;

      const card = document.createElement('div');
      card.className = 'shop-card' + (active ? ' active' : '') + (owned ? ' owned' : '');
      card.innerHTML = `
        <div class="shop-preview" ${it.kind==='skin' ? `style="--sk:${it.color};--sg:${it.glow}"` : ''}>
          ${it.kind === 'skin' ? '<div class="skin-orb"></div>' : `<div class="ab-icon">${it.icon || '★'}</div>`}
        </div>
        <div class="shop-name">${it.name}</div>
        ${it.kind === 'ability' ? `<div class="shop-desc">${it.desc}</div>` : ''}
        <div class="shop-footer">
          ${owned
            ? (it.kind === 'skin'
                ? `<button class="btn-mini ${active?'is-active':''}" data-act="select">${active?'Aktiv':'Auswählen'}</button>`
                : `<button class="btn-mini ${active?'is-active':''}" data-act="toggle">${active?'Eingesetzt':'Einsetzen'}</button>`)
            : `<button class="btn-mini buy ${canAfford?'':'disabled'}" data-act="buy"><span class="coin">◉</span> ${it.price}</button>`
          }
        </div>
      `;
      card.addEventListener('click', (e) => {
        const act = (e.target.closest('[data-act]')?.dataset.act);
        if (!act) return;
        if (act === 'buy') {
          const res = it.kind === 'skin' ? buySkin(it.id) : buyAbility(it.id);
          if (res.ok) {
            card.classList.add('bought');
            setTimeout(() => render(tab), 220);
          } else if (res.reason === 'coins') {
            card.classList.add('shake-no');
            setTimeout(() => card.classList.remove('shake-no'), 400);
          }
        } else if (act === 'select') {
          selectSkin(it.id); render(tab);
        } else if (act === 'toggle') {
          toggleAbility(it.id); render(tab);
        }
        onChange?.();
      });
      body.appendChild(card);
    }
  }
}

/* ---------- Missionen ---------- */
export function renderMissions(container, onChange) {
  const s = missionState();
  container.innerHTML = `
    <div class="ms-section">
      <h3 class="ms-title">Tägliche Aufgaben</h3>
      <div class="ms-list" id="msDaily"></div>
    </div>
    <div class="ms-section">
      <h3 class="ms-title">Erfolge</h3>
      <div class="ms-list" id="msAch"></div>
    </div>
  `;
  fill(container.querySelector('#msDaily'), s.daily);
  fill(container.querySelector('#msAch'), s.achievements);

  function fill(el, arr) {
    if (!arr.length) { el.innerHTML = `<p class="muted small-note">Keine Aufgaben.</p>`; return; }
    for (const m of arr) {
      const p = Math.min(1, (m.progress || 0) / m.def.target);
      const row = document.createElement('div');
      row.className = 'ms-row' + (m.done ? ' done' : '') + (m.claimed ? ' claimed' : '');
      row.innerHTML = `
        <div class="ms-head">
          <div class="ms-info">
            <div class="ms-name">${m.def.name}</div>
            <div class="ms-desc">${m.def.desc}</div>
          </div>
          <div class="ms-reward"><span class="coin">◉</span> ${m.def.reward}</div>
        </div>
        <div class="ms-bar"><div class="ms-fill" style="width:${(p*100).toFixed(0)}%"></div></div>
        <div class="ms-foot">
          <span class="ms-count">${Math.floor(m.progress || 0)} / ${m.def.target}</span>
          ${m.done && !m.claimed
              ? `<button class="btn-mini claim">Abholen</button>`
              : m.claimed ? `<span class="ms-tag">✓ abgeholt</span>` : ''}
        </div>
      `;
      row.querySelector('.claim')?.addEventListener('click', () => {
        if (claimMission(m.def.id)) {
          row.classList.add('claim-anim');
          setTimeout(() => { renderMissions(container, onChange); onChange?.(); }, 380);
        }
      });
      el.appendChild(row);
    }
  }
}

/* ---------- Inventar ---------- */
export function renderInventory(container, onChange) {
  const s = getState();
  container.innerHTML = `
    <div class="inv-section">
      <h3 class="ms-title">Skins (${s.ownedSkins.length}/${Object.keys(SKINS).length})</h3>
      <div class="inv-grid" id="invSkins"></div>
    </div>
    <div class="inv-section">
      <h3 class="ms-title">Fähigkeiten (${s.ownedAbilities.length}/${Object.keys(ABILITIES).length})</h3>
      <p class="small-note">Aktive Fähigkeiten werden beim Rundenstart verbraucht.</p>
      <div class="inv-grid" id="invAbs"></div>
    </div>
  `;
  const sg = container.querySelector('#invSkins');
  for (const [id, v] of Object.entries(SKINS)) {
    const owned = s.ownedSkins.includes(id);
    const active = s.activeSkin === id;
    const el = document.createElement('div');
    el.className = 'inv-item' + (active ? ' active' : '') + (!owned ? ' locked' : '');
    el.style.setProperty('--sk', v.color); el.style.setProperty('--sg', v.glow);
    el.innerHTML = `<div class="skin-orb"></div><span>${v.name}</span>${!owned ? '<div class="lock">🔒</div>' : ''}`;
    if (owned) el.addEventListener('click', () => { selectSkin(id); renderInventory(container, onChange); onChange?.(); });
    sg.appendChild(el);
  }
  const ag = container.querySelector('#invAbs');
  for (const [id, v] of Object.entries(ABILITIES)) {
    const owned = s.ownedAbilities.includes(id);
    const active = s.activeAbilities.includes(id);
    const el = document.createElement('div');
    el.className = 'inv-item ability' + (active ? ' active' : '') + (!owned ? ' locked' : '');
    el.innerHTML = `<div class="ab-icon">${v.icon || '★'}</div><span>${v.name}</span>${!owned ? '<div class="lock">🔒</div>' : ''}`;
    if (owned) el.addEventListener('click', () => { toggleAbility(id); renderInventory(container, onChange); onChange?.(); });
    ag.appendChild(el);
  }
}

/* ---------- Statistiken ---------- */
export function renderStats(container) {
  const s = getState();
  const lv = levelInfo();
  const totalTime = Math.round((s.totals.timeMs || 0) / 1000);
  const mm = Math.floor(totalTime / 60), ss = totalTime % 60;
  container.innerHTML = `
    <div class="stat-block">
      <div class="stat-line"><span>Rang</span><b>${lv.rank}</b></div>
      <div class="stat-line"><span>Level</span><b>${lv.level}</b></div>
      <div class="xp-bar"><div class="xp-fill" style="width:${(lv.progress*100).toFixed(1)}%"></div></div>
      <div class="small-note">${lv.xp} / ${lv.need} XP</div>
    </div>
    <div class="stat-grid-lg">
      <div class="stat"><span class="stat-label">Runden</span><span class="stat-value">${s.totals.runs}</span></div>
      <div class="stat"><span class="stat-label">Gesamt-Score</span><span class="stat-value">${s.totals.score}</span></div>
      <div class="stat"><span class="stat-label">Spielzeit</span><span class="stat-value">${mm}m ${ss}s</span></div>
      <div class="stat"><span class="stat-label">Ausgewichen</span><span class="stat-value">${s.totals.dodged}</span></div>
      <div class="stat"><span class="stat-label">Coins</span><span class="stat-value">${s.coins}</span></div>
      <div class="stat"><span class="stat-label">Skins</span><span class="stat-value">${s.ownedSkins.length}</span></div>
    </div>
  `;
}

/* ---------- Level / Coin HUD im Menü ---------- */
export function renderTopBar(container) {
  const s = getState();
  const lv = levelInfo();
  container.innerHTML = `
    <div class="topbar-item coin-badge" title="Coins">
      <span class="coin big">◉</span>
      <span id="tbCoins">${s.coins}</span>
    </div>
    <div class="topbar-item level-badge" title="Level & Rang">
      <div class="level-num">LV ${lv.level}</div>
      <div class="level-rank">${lv.rank}</div>
      <div class="xp-bar tiny"><div class="xp-fill" style="width:${(lv.progress*100).toFixed(1)}%"></div></div>
    </div>
  `;
}
