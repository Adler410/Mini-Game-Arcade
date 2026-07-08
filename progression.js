/* MediaHub Arcade — Coins, XP, Level, Besitz, Missionen
 *
 * Zentraler Store für alles rund um Fortschritt.
 * Alle Daten liegen im LocalStorage unter mediahub_progress_v1.
 */

import { SKINS, ABILITIES, xpForNextLevel, rankFor } from './catalog.js';

const KEY = 'mediahub_progress_v1';

const DEFAULT = {
  coins: 0,
  xp: 0,
  level: 1,
  ownedSkins: ['default'],
  ownedAbilities: [],
  activeSkin: 'default',
  activeAbilities: [],           // Fähigkeiten, die in der nächsten Runde eingesetzt werden
  achievements: {},              // id -> { done, claimed, progress }
  daily: { date: '', missions: {} }, // { date: 'YYYY-MM-DD', missions: id -> { done, claimed, progress } }
  totals: {                      // wachsen über alle Runden
    runs: 0, score: 0, timeMs: 0, dodged: 0,
    modesWon: {},                // mode -> true
    diffsBeaten: {},             // difficulty -> true
  },
};

let state = load();
const listeners = new Set();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return deepMerge(clone(DEFAULT), JSON.parse(raw));
  } catch {}
  return clone(DEFAULT);
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {}
  for (const cb of listeners) cb(state);
}
function clone(o) { return JSON.parse(JSON.stringify(o)); }
function deepMerge(base, over) {
  for (const k of Object.keys(over)) {
    if (over[k] && typeof over[k] === 'object' && !Array.isArray(over[k])) {
      base[k] = deepMerge(base[k] || {}, over[k]);
    } else {
      base[k] = over[k];
    }
  }
  return base;
}

export function onChange(cb) { listeners.add(cb); return () => listeners.delete(cb); }
export function getState() { return state; }

/* ---------- Coins & XP ---------- */
export function addCoins(n, reason = '') {
  if (!n) return;
  state.coins = Math.max(0, state.coins + n);
  save();
  emitToast(n > 0 ? `+${n} Coins` : `${n} Coins`, 'coin', reason);
}
export function spendCoins(n) {
  if (state.coins < n) return false;
  state.coins -= n;
  save();
  return true;
}

export function addXp(n) {
  if (!n) return { leveledUp: false };
  state.xp += n;
  let leveledUp = false;
  while (state.xp >= xpForNextLevel(state.level)) {
    state.xp -= xpForNextLevel(state.level);
    state.level += 1;
    leveledUp = true;
  }
  save();
  if (leveledUp) {
    emitLevelUp(state.level);
    // Level-Belohnung
    addCoins(state.level * 25, 'Level-Belohnung');
  }
  return { leveledUp, level: state.level, xp: state.xp, need: xpForNextLevel(state.level), rank: rankFor(state.level) };
}

export function levelInfo() {
  return {
    level: state.level,
    xp: state.xp,
    need: xpForNextLevel(state.level),
    rank: rankFor(state.level),
    progress: state.xp / xpForNextLevel(state.level),
  };
}

/* ---------- Skins ---------- */
export function buySkin(id) {
  const s = SKINS[id]; if (!s) return { ok: false, reason: 'unknown' };
  if (state.ownedSkins.includes(id)) return { ok: false, reason: 'owned' };
  if (!spendCoins(s.price)) return { ok: false, reason: 'coins' };
  state.ownedSkins.push(id);
  save();
  return { ok: true };
}
export function selectSkin(id) {
  if (!state.ownedSkins.includes(id)) return false;
  state.activeSkin = id; save(); return true;
}
export function activeSkinData() {
  return SKINS[state.activeSkin] || SKINS.default;
}

/* ---------- Fähigkeiten ---------- */
export function buyAbility(id) {
  const a = ABILITIES[id]; if (!a) return { ok: false, reason: 'unknown' };
  if (state.ownedAbilities.includes(id)) return { ok: false, reason: 'owned' };
  if (!spendCoins(a.price)) return { ok: false, reason: 'coins' };
  state.ownedAbilities.push(id);
  save();
  return { ok: true };
}
export function toggleAbility(id) {
  if (!state.ownedAbilities.includes(id)) return false;
  const i = state.activeAbilities.indexOf(id);
  if (i >= 0) state.activeAbilities.splice(i, 1);
  else state.activeAbilities.push(id);
  save();
  return true;
}
export function activeAbilities() { return [...state.activeAbilities]; }

/* ---------- Runden-Ergebnisse verwerten ---------- */
export function processRun(run) {
  // run: { score, time, dodged, maxSpeed, mode, difficulty, reason, diffMultiplier }
  const diffMul = run.diffMultiplier || 1;
  const abilities = state.activeAbilities;

  // Coins: 0.1 pro Punkt + 0.4 pro Sekunde, gewichtet mit Schwierigkeit
  let coins = Math.round((run.score * 0.1 + run.time * 0.4) * diffMul);
  if (abilities.includes('magnet')) coins = Math.round(coins * 1.5);
  // Glück — 30% Bonuschance
  let bonus = 0;
  if (abilities.includes('luck') && Math.random() < 0.3) {
    bonus = 20 + Math.floor(Math.random() * 40);
    coins += bonus;
  }
  if (coins > 0) addCoins(coins, 'Runden-Belohnung');

  // XP: 1 pro Punkt + Bonus für Zeit
  const xp = Math.round(run.score + run.time * 2);
  const lv = addXp(xp);

  // Totals
  state.totals.runs += 1;
  state.totals.score += run.score;
  state.totals.timeMs += run.time * 1000;
  state.totals.dodged += run.dodged || 0;
  if (run.reason !== 'crash') state.totals.modesWon[run.mode] = true;
  if (run.score >= 50 || run.reason === 'target' || run.reason === 'time') {
    state.totals.diffsBeaten[run.difficulty] = true;
  }
  // Abgeschlossene Runden verbrauchen einmalige Fähigkeiten
  state.activeAbilities = [];
  save();

  return { coins, xp, bonus, level: lv };
}

/* ---------- Missionen ---------- */
// Wird von missions.js gesetzt, damit progression den Katalog nicht direkt kennt.
let missionCatalog = { achievements: [], daily: [] };
export function registerMissions(cat) { missionCatalog = cat; ensureDaily(); }

function today() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
}
function ensureDaily() {
  const t = today();
  if (state.daily.date !== t) {
    state.daily = { date: t, missions: {} };
    save();
  }
}

function progressOf(def) {
  const t = state.totals;
  const dailyStart = state.daily.startTotals || null;
  const scope = def.scope === 'daily' && dailyStart ? {
    runs: t.runs - dailyStart.runs,
    score: t.score - dailyStart.score,
    timeMs: t.timeMs - dailyStart.timeMs,
    dodged: t.dodged - dailyStart.dodged,
  } : t;
  return def.progress(scope, state);
}

export function evaluateMissions() {
  ensureDaily();
  // Beim ersten Aufruf am neuen Tag Snapshot merken
  if (!state.daily.startTotals) {
    state.daily.startTotals = clone(state.totals);
  }

  const completed = [];
  const check = (def, bucket) => {
    const rec = bucket[def.id] || { done: false, claimed: false, progress: 0 };
    const p = progressOf(def);
    rec.progress = Math.min(def.target, p);
    if (!rec.done && p >= def.target) {
      rec.done = true;
      completed.push(def);
    }
    bucket[def.id] = rec;
  };
  state.achievements = state.achievements || {};
  state.daily.missions = state.daily.missions || {};
  for (const d of missionCatalog.achievements) check(d, state.achievements);
  for (const d of missionCatalog.daily) check(d, state.daily.missions);
  save();
  return completed;
}

export function claimMission(id) {
  const all = [...missionCatalog.achievements, ...missionCatalog.daily];
  const def = all.find(d => d.id === id);
  if (!def) return false;
  const bucket = def.scope === 'daily' ? state.daily.missions : state.achievements;
  const rec = bucket[id];
  if (!rec || !rec.done || rec.claimed) return false;
  rec.claimed = true;
  addCoins(def.reward, `Mission: ${def.name}`);
  save();
  return true;
}

export function missionState() {
  ensureDaily();
  const build = (defs, bucket) => defs.map(def => ({
    def,
    ...bucket[def.id] || { done: false, claimed: false, progress: 0 },
  }));
  return {
    achievements: build(missionCatalog.achievements, state.achievements || {}),
    daily: build(missionCatalog.daily, state.daily.missions || {}),
    resetsIn: msUntilTomorrow(),
  };
}

function msUntilTomorrow() {
  const now = new Date();
  const t = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return t - now;
}

/* ---------- Reset (nur für Debug/Settings) ---------- */
export function resetProgress() {
  state = clone(DEFAULT);
  save();
}

/* ---------- Events (Toasts / Level-Up / Mission-Complete) ---------- */
const bus = new EventTarget();
export function on(type, cb) {
  const h = (e) => cb(e.detail);
  bus.addEventListener(type, h);
  return () => bus.removeEventListener(type, h);
}
function emitToast(text, kind, reason) {
  bus.dispatchEvent(new CustomEvent('toast', { detail: { text, kind, reason } }));
}
function emitLevelUp(level) {
  bus.dispatchEvent(new CustomEvent('levelup', { detail: { level, rank: rankFor(level) } }));
}
export function emitMissionComplete(def) {
  bus.dispatchEvent(new CustomEvent('mission', { detail: def }));
}
