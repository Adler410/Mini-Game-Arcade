/* MediaHub Arcade — Entry (glue) */

import { Game } from './game.js';
import { Joystick } from './joystick.js';
import {
  bestFor, recordRun, avgLast10, allBests, resetAll,
  loadSettings, saveSettings, loadLast, saveLast,
} from './stats.js';
import {
  $, showOverlay, hideOverlay, hideAllOverlays,
  animateNumber, pulse, renderModes, renderDifficulties,
  renderHighscores, renderGameOverStats,
} from './ui.js';

/* ---------- Element refs ---------- */
const canvas = $('game');
const canvasWrap = $('canvasWrap');
const scoreEl = $('score');
const bestEl = $('best');

const hudTime = $('hudTime');
const hudSpeed = $('hudSpeed');
const hudDodged = $('hudDodged');
const ingameHud = $('ingameHud');

const mainMenu = $('mainMenu');
const playSetup = $('playSetup');
const highscoresEl = $('highscores');
const settingsEl = $('settings');
const helpEl = $('help');
const pauseOverlay = $('pauseOverlay');
const gameOverOverlay = $('gameOverOverlay');

const modeGrid = $('modeGrid');
const diffOptions = $('diffOptions');
const diffMeta = $('diffMeta');
const statsGrid = $('statsGrid');
const goTitle = $('goTitle');
const goSub = $('goSub');

const hsList = $('hsList');

/* ---------- State ---------- */
let settings = loadSettings();
let selection = loadLast();

applySettings();

/* ---------- Joystick ---------- */
const joystick = new Joystick($('joystick'), $('joystickStick'));
const isTouch = matchMedia('(hover: none) and (pointer: coarse)').matches;
joystick.setEnabled(isTouch && settings.joystick);

/* ---------- Game ---------- */
const game = new Game(canvas, {
  settings,
  joystick,
  onEnd: handleGameEnd,
  onScore: handleScore,
  onShake: shakeCanvas,
  onHudTick: updateInGameHud,
});

/* ---------- Wire menus ---------- */
function updateBestLabel() {
  const b = bestFor(selection.mode, selection.difficulty);
  bestEl.textContent = b;
}
updateBestLabel();

renderModes(modeGrid, selection.mode, (m) => {
  selection.mode = m; saveLast(selection); updateBestLabel();
});
renderDifficulties(diffOptions, diffMeta, selection.difficulty, (d) => {
  selection.difficulty = d; saveLast(selection); updateBestLabel();
});

/* Menu navigation */
document.querySelectorAll('[data-menu]').forEach(btn => {
  btn.addEventListener('click', () => openScreen(btn.dataset.menu));
});
document.querySelectorAll('[data-close]').forEach(btn => {
  btn.addEventListener('click', () => {
    hideOverlay($(btn.dataset.close));
    showOverlay(mainMenu);
  });
});

$('btnPlay').addEventListener('click', () => {
  hideOverlay(mainMenu);
  showOverlay(playSetup);
});

$('startBtn').addEventListener('click', startGame);
$('restartBtn').addEventListener('click', () => {
  hideOverlay(gameOverOverlay);
  startGame();
});
$('menuBtn').addEventListener('click', () => {
  hideOverlay(gameOverOverlay);
  showOverlay(mainMenu);
  ingameHud.classList.remove('visible');
});

$('btnResume').addEventListener('click', () => {
  hideOverlay(pauseOverlay);
  game.togglePause();
});
$('btnQuit').addEventListener('click', () => {
  hideOverlay(pauseOverlay);
  game.quit();
  showOverlay(mainMenu);
  ingameHud.classList.remove('visible');
});

$('hsReset').addEventListener('click', () => {
  if (confirm('Alle Bestwerte wirklich löschen?')) {
    resetAll();
    renderHighscores(hsList, allBests());
    updateBestLabel();
  }
});

/* Settings toggles */
function bindToggle(id, key, apply) {
  const el = $(id);
  el.checked = settings[key];
  el.addEventListener('change', () => {
    settings[key] = el.checked;
    saveSettings(settings);
    apply?.(el.checked);
  });
}
bindToggle('setSound', 'sound');
bindToggle('setShake', 'shake');
bindToggle('setJoystick', 'joystick', (on) => joystick.setEnabled(isTouch && on));
bindToggle('setReduced', 'reduced', () => applySettings());

function applySettings() {
  document.body.classList.toggle('reduced-motion', settings.reduced);
}

function openScreen(name) {
  hideOverlay(mainMenu);
  if (name === 'highscores') {
    renderHighscores(hsList, allBests());
    showOverlay(highscoresEl);
  } else if (name === 'settings') {
    showOverlay(settingsEl);
  } else if (name === 'help') {
    showOverlay(helpEl);
  }
}

/* Pause on P/Escape triggers via game; watch for state changes */
setInterval(() => {
  if (game.state === 'paused' && pauseOverlay.classList.contains('hidden')) {
    showOverlay(pauseOverlay);
  }
}, 100);

/* ---------- Game callbacks ---------- */
function startGame() {
  hideAllOverlays();
  ingameHud.classList.add('visible');
  scoreEl.textContent = '0';
  updateBestLabel();
  game.settings = settings;
  game.start(selection.mode, selection.difficulty);
}

let _lastScore = 0;
function handleScore(score) {
  if (score !== _lastScore) {
    _lastScore = score;
    scoreEl.textContent = score;
    pulse(scoreEl);
  }
}

function updateInGameHud(hud) {
  hudTime.textContent = hud.time.toFixed(1) + 's';
  hudSpeed.textContent = hud.speed.toFixed(1);
  hudDodged.textContent = hud.dodged;
}

function shakeCanvas() {
  if (!settings.shake) return;
  canvasWrap.classList.remove('shake');
  void canvasWrap.offsetWidth;
  canvasWrap.classList.add('shake');
}

function handleGameEnd(run) {
  ingameHud.classList.remove('visible');
  const results = recordRun(run.mode, run.difficulty, run);
  // Title based on end reason
  if (run.reason === 'time') { goTitle.textContent = 'Zeit abgelaufen'; goSub.textContent = 'Time Attack beendet'; }
  else if (run.reason === 'target') { goTitle.textContent = 'Ziel erreicht!'; goSub.textContent = `Speed Run in ${run.time.toFixed(1)}s`; }
  else { goTitle.textContent = 'Game Over'; goSub.textContent = results.isNewBest ? 'Neuer Bestwert!' : 'Runde beendet'; }

  renderGameOverStats(statsGrid, run, results);
  showOverlay(gameOverOverlay);
  updateBestLabel();
}

/* ---------- Initial: show main menu ---------- */
hideAllOverlays();
showOverlay(mainMenu);