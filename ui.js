/* MediaHub Arcade — UI helpers: overlays, animated counters, stats render */

import { DIFFICULTIES, MODES, speedTier, spawnTier } from './config.js';

export function $(id) { return document.getElementById(id); }

/** Fade an overlay in/out. */
export function showOverlay(el) {
  el.classList.remove('hidden');
  el.classList.remove('fade-out');
}
export function hideOverlay(el) {
  if (el.classList.contains('hidden')) return;
  el.classList.add('fade-out');
  setTimeout(() => {
    el.classList.add('hidden');
    el.classList.remove('fade-out');
  }, 200);
}
export function hideAllOverlays() {
  document.querySelectorAll('.overlay').forEach(el => {
    el.classList.add('hidden');
    el.classList.remove('fade-out');
  });
}

/** Animate a number counter from current → target over `ms`. */
export function animateNumber(el, target, ms = 800, formatter = (v) => Math.round(v)) {
  const start = performance.now();
  const from = Number((el.textContent || '0').replace(/[^\d.-]/g, '')) || 0;
  function frame(t) {
    const p = Math.min(1, (t - start) / ms);
    const eased = 1 - Math.pow(1 - p, 3);
    const v = from + (target - from) * eased;
    el.textContent = formatter(v);
    if (p < 1) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

/** Pulse an element (score bump). */
export function pulse(el) {
  el.classList.remove('pulse');
  // force reflow to restart animation
  void el.offsetWidth;
  el.classList.add('pulse');
  setTimeout(() => el.classList.remove('pulse'), 200);
}

/** Render the mode selection grid. */
export function renderModes(container, selected, onSelect) {
  container.innerHTML = '';
  for (const [key, m] of Object.entries(MODES)) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'mode-card' + (key === selected ? ' active' : '');
    btn.dataset.mode = key;
    btn.innerHTML = `<span class="mode-name">${m.label}</span><span class="mode-desc">${m.desc}</span>`;
    btn.addEventListener('click', () => {
      container.querySelectorAll('.mode-card').forEach(x => x.classList.remove('active'));
      btn.classList.add('active');
      onSelect(key);
    });
    container.appendChild(btn);
  }
}

/** Render the difficulty pill row + meta box. */
export function renderDifficulties(container, metaEl, selected, onSelect) {
  container.innerHTML = '';
  for (const [key, d] of Object.entries(DIFFICULTIES)) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'diff-btn' + (key === selected ? ' active' : '');
    btn.dataset.diff = key;
    btn.textContent = d.label;
    btn.addEventListener('click', () => {
      container.querySelectorAll('.diff-btn').forEach(x => x.classList.remove('active'));
      btn.classList.add('active');
      renderDiffMeta(metaEl, key);
      onSelect(key);
    });
    container.appendChild(btn);
  }
  renderDiffMeta(metaEl, selected);
}

export function renderDiffMeta(el, key) {
  const d = DIFFICULTIES[key];
  if (!d) return;
  const special = [];
  if (d.fromAllSides) special.push('Alle Seiten');
  if (d.bounce) special.push('Blockkollision');
  if (d.split) special.push('Splitten');
  if (d.accelerate) special.push('Beschleunigung');
  if (d.homing) special.push('Verfolger');
  if (d.wallBounce) special.push('Wandreflexion');
  el.innerHTML = `
    <strong>${d.label}</strong>
    <div class="stats-row">
      <span>Speed: <b>${speedTier(d.baseSpeed)}</b></span>
      <span>Spawnrate: <b>${spawnTier(d.spawnInterval)}</b></span>
      <span>Multiplikator: <b>×${d.multiplier}</b></span>
    </div>
    ${special.length ? `<div class="stats-row"><span>Spezial: <b>${special.join(' · ')}</b></span></div>` : ''}
    <div class="stats-row"><span style="color:var(--muted)">${d.hint}</span></div>
  `;
  // restart entry animation
  el.style.animation = 'none';
  void el.offsetWidth;
  el.style.animation = '';
}

/** Render the highscore list. */
export function renderHighscores(container, bests) {
  container.innerHTML = '';
  const rows = Object.entries(bests)
    .map(([k, v]) => {
      const [mode, diff] = k.split(':');
      return { mode, diff, score: v };
    })
    .sort((a, b) => b.score - a.score);
  if (!rows.length) {
    container.innerHTML = `<p class="muted" style="text-align:center;padding:14px">Noch keine Highscores. Spiel eine Runde!</p>`;
    return;
  }
  for (const r of rows) {
    const modeLabel = MODES[r.mode]?.label || r.mode;
    const diffLabel = DIFFICULTIES[r.diff]?.label || r.diff;
    const row = document.createElement('div');
    row.className = 'hs-row';
    row.innerHTML = `
      <div>
        <div class="name">${modeLabel}</div>
        <div class="sub">${diffLabel}</div>
      </div>
      <div class="val">${r.score}</div>`;
    container.appendChild(row);
  }
}

/** Populate the game-over stats grid with animated counters. */
export function renderGameOverStats(gridEl, run, results) {
  const set = (name, target, formatter) => {
    const el = gridEl.querySelector(`[data-stat="${name}"]`);
    if (!el) return;
    el.parentElement.classList.remove('record');
    animateNumber(el, target, 900, formatter);
  };
  set('score', run.score);
  set('time', run.time, v => v.toFixed(1) + 's');
  set('speed', run.maxSpeed, v => v.toFixed(1));
  set('dodged', run.dodged);
  set('best', results.best);
  set('avg', results.avg);
  if (results.isNewBest) {
    const bestEl = gridEl.querySelector('[data-stat="best"]');
    bestEl?.parentElement?.classList.add('record');
  }
}
