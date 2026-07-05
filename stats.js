/* MediaHub Arcade — Persistent stats & highscores */

const STORAGE_KEY = 'mediahub_stats_v2';

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { best: {}, history: {} };
}

function save(data) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch {}
}

/** Return the best score across all difficulties for a given mode. */
export function bestFor(mode, difficulty) {
  const data = load();
  return Number(data.best?.[`${mode}:${difficulty}`] || 0);
}

/** Return average of last 10 runs for this mode+difficulty. */
export function avgLast10(mode, difficulty) {
  const data = load();
  const arr = data.history?.[`${mode}:${difficulty}`] || [];
  if (!arr.length) return 0;
  const sum = arr.reduce((a, b) => a + b.score, 0);
  return Math.round(sum / arr.length);
}

/** Record a completed run. Returns { isNewBest, best, avg }. */
export function recordRun(mode, difficulty, run) {
  const data = load();
  const key = `${mode}:${difficulty}`;
  data.best = data.best || {};
  data.history = data.history || {};
  const prevBest = Number(data.best[key] || 0);
  const isNewBest = run.score > prevBest;
  if (isNewBest) data.best[key] = run.score;

  const arr = data.history[key] || [];
  arr.unshift({ score: run.score, time: run.time, date: Date.now() });
  data.history[key] = arr.slice(0, 10);
  save(data);
  return {
    isNewBest,
    best: data.best[key],
    avg: avgLast10(mode, difficulty),
  };
}

/** All bests grouped for highscore screen. */
export function allBests() {
  const data = load();
  return data.best || {};
}

export function resetAll() {
  save({ best: {}, history: {} });
}

/* ---------- Settings (separate key) ---------- */
const SETTINGS_KEY = 'mediahub_settings_v2';
const DEFAULT_SETTINGS = { sound: false, shake: true, joystick: true, reduced: false };

export function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {}
  return { ...DEFAULT_SETTINGS };
}
export function saveSettings(s) {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch {}
}

/* ---------- Last selection ---------- */
const LAST_KEY = 'mediahub_last_v2';
export function loadLast() {
  try {
    const raw = localStorage.getItem(LAST_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { mode: 'classic', difficulty: 'easy' };
}
export function saveLast(sel) {
  try { localStorage.setItem(LAST_KEY, JSON.stringify(sel)); } catch {}
}
