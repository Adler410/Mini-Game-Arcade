/* MediaHub Arcade — Missions-Definitionen (Achievements + tägliche Aufgaben) */

import { registerMissions } from './progression.js';

/* Achievement-Definitionen: einmalig. Progress-Funktion bekommt totals + state. */
export const ACHIEVEMENTS = [
  { id: 'score_100',   name: 'Erste Erfolge',   desc: 'Erreiche 100 Punkte in einer Runde.',
    target: 100, reward: 50,
    progress: (t, s) => s._lastScore || 0 },
  { id: 'score_500',   name: 'Punktesammler',   desc: 'Erreiche 500 Punkte in einer Runde.',
    target: 500, reward: 150,
    progress: (t, s) => s._lastScore || 0 },
  { id: 'score_1000',  name: 'Score-Meister',   desc: 'Erreiche 1000 Punkte in einer Runde.',
    target: 1000, reward: 400,
    progress: (t, s) => s._lastScore || 0 },
  { id: 'time_30',     name: 'Ausdauernd',      desc: 'Überlebe 30 Sekunden.',
    target: 30, reward: 40,
    progress: (t, s) => (s._lastTime || 0) },
  { id: 'time_60',     name: 'Marathonist',     desc: 'Überlebe 60 Sekunden.',
    target: 60, reward: 120,
    progress: (t, s) => (s._lastTime || 0) },
  { id: 'runs_10',     name: 'Warmgespielt',    desc: 'Spiele 10 Runden.',
    target: 10, reward: 60,
    progress: (t) => t.runs },
  { id: 'runs_50',     name: 'Arcade-Stammgast',desc: 'Spiele 50 Runden.',
    target: 50, reward: 250,
    progress: (t) => t.runs },
  { id: 'all_modes',   name: 'Modus-Kenner',    desc: 'Gewinne in jedem Spielmodus mindestens einmal.',
    target: 8, reward: 500,
    progress: (t) => Object.keys(t.modesWon || {}).length },
  { id: 'beat_impossible', name: 'Unmöglich?',  desc: 'Schaffe Schwierigkeit "Unmöglich".',
    target: 1, reward: 600,
    progress: (t) => t.diffsBeaten?.impossible ? 1 : 0 },
  { id: 'beat_infinite',   name: 'Grenzenlos',  desc: 'Schaffe Schwierigkeit "Unendlich".',
    target: 1, reward: 800,
    progress: (t) => t.diffsBeaten?.infinite ? 1 : 0 },
];

/* Tägliche Aufgaben — wiederholbar, resetten um Mitternacht */
export const DAILY = [
  { id: 'daily_runs',   name: 'Drei Runden',     desc: 'Spiele heute 3 Runden.',
    target: 3, reward: 30, scope: 'daily',
    progress: (s) => s.runs },
  { id: 'daily_score',  name: 'Punkte-Ziel',     desc: 'Erreiche heute insgesamt 500 Punkte.',
    target: 500, reward: 60, scope: 'daily',
    progress: (s) => s.score },
  { id: 'daily_time',   name: '5 Minuten Action',desc: 'Überlebe heute insgesamt 5 Minuten.',
    target: 300, reward: 80, scope: 'daily',
    progress: (s) => (s.timeMs || 0) / 1000 },
  { id: 'daily_dodge',  name: 'Ausweich-Profi',  desc: 'Weiche heute 200 Hindernissen aus.',
    target: 200, reward: 70, scope: 'daily',
    progress: (s) => s.dodged },
];

registerMissions({ achievements: ACHIEVEMENTS, daily: DAILY });
