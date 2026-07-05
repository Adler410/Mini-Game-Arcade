/* MediaHub Arcade — Difficulty & Mode Configuration */

export const DIFFICULTIES = {
  easy: {
    label: 'Einfach',
    hint: 'Blöcke fallen von oben. Bewege dich links/rechts.',
    multiplier: 1,
    vertical: true, horizontal: false, allowUpDown: false,
    baseSpeed: 3, spawnInterval: 38,
    rampInterval: 300, rampSpawn: 2, rampSpeed: 0.4, minSpawn: 10,
  },
  medium: {
    label: 'Mittel',
    hint: 'Blöcke von oben UND von rechts. Bewege dich in alle 4 Richtungen.',
    multiplier: 1.5,
    vertical: true, horizontal: true, allowUpDown: true,
    baseSpeed: 3.6, spawnInterval: 34,
    rampInterval: 280, rampSpawn: 2, rampSpeed: 0.45, minSpawn: 9,
  },
  hard: {
    label: 'Schwer',
    hint: 'Blöcke aus allen Richtungen. Volle Bewegungsfreiheit.',
    multiplier: 2,
    vertical: true, horizontal: true, allowUpDown: true, fromAllSides: true,
    baseSpeed: 4.4, spawnInterval: 26,
    rampInterval: 240, rampSpawn: 2, rampSpeed: 0.55, minSpawn: 7,
  },
  extreme: {
    label: 'Extrem',
    hint: 'Chaos: Blöcke prallen voneinander ab.',
    multiplier: 2.5,
    vertical: true, horizontal: true, allowUpDown: true, fromAllSides: true,
    bounce: true,
    baseSpeed: 5.2, spawnInterval: 20,
    rampInterval: 220, rampSpawn: 2, rampSpeed: 0.65, minSpawn: 5,
  },
  god: {
    label: 'Gott',
    hint: 'Kleine Blöcke werden schneller, große splitten in zwei.',
    multiplier: 3,
    vertical: true, horizontal: true, allowUpDown: true, fromAllSides: true,
    bounce: true, split: true, accelerate: true,
    baseSpeed: 5.6, spawnInterval: 22,
    rampInterval: 220, rampSpawn: 2, rampSpeed: 0.7, minSpawn: 6,
  },
  impossible: {
    label: 'Unmöglich',
    hint: 'Verfolger jagen dich 5 s lang, dann splitten sie in drei.',
    multiplier: 4,
    vertical: true, horizontal: true, allowUpDown: true, fromAllSides: true,
    bounce: true, split: true, accelerate: true,
    homing: 300, homingSplit: 3,
    baseSpeed: 5.6, spawnInterval: 26,
    rampInterval: 220, rampSpawn: 2, rampSpeed: 0.7, minSpawn: 6,
  },
  infinite: {
    label: 'Unendlich',
    hint: 'Alles aus Gott + Blöcke prallen einmal von der Wand ab.',
    multiplier: 5,
    vertical: true, horizontal: true, allowUpDown: true, fromAllSides: true,
    bounce: true, split: true, accelerate: true, wallBounce: 1,
    baseSpeed: 5.8, spawnInterval: 24,
    rampInterval: 220, rampSpawn: 2, rampSpeed: 0.7, minSpawn: 6,
  },
};

/* Game modes — layered flags applied on top of the base difficulty. */
export const MODES = {
  classic: {
    label: 'Classic',
    desc: 'Der Standard-Modus. Ausweichen, Punkte sammeln, überleben.',
  },
  survival: {
    label: 'Survival',
    desc: 'Die Zeit steigert Spawnrate & Speed aggressiv. Wie lange hältst du durch?',
    survivalRamp: true,
  },
  timeattack: {
    label: 'Time Attack',
    desc: 'Nur 60 Sekunden. Score so viel wie möglich.',
    timeLimit: 60,
  },
  zen: {
    label: 'Zen',
    desc: 'Kein Game Over. Chill spielen und Muster lernen.',
    invincible: true,
  },
  hardcore: {
    label: 'Hardcore',
    desc: 'Größere Hitbox, ein Treffer beendet das Spiel sofort. Nichts verzeiht.',
    hitboxBoost: 1.15,
  },
  speedrun: {
    label: 'Speed Run',
    desc: 'Erreiche 100 Punkte so schnell wie möglich — Zeit ist alles.',
    scoreTarget: 100,
  },
  reverse: {
    label: 'Reverse',
    desc: 'Steuerung ist invertiert. Links = rechts, oben = unten.',
    reverseControls: true,
  },
  chaos: {
    label: 'Chaos',
    desc: 'Alle 10 s ändert sich ein Modifikator zufällig. Immer Überraschung.',
    chaos: true,
  },
};

export function speedTier(baseSpeed) {
  if (baseSpeed < 3.5) return 'Langsam';
  if (baseSpeed < 4.5) return 'Zügig';
  if (baseSpeed < 5.3) return 'Schnell';
  return 'Extrem schnell';
}

export function spawnTier(interval) {
  if (interval > 34) return 'Wenige';
  if (interval > 26) return 'Moderat';
  if (interval > 20) return 'Viele';
  return 'Massiv';
}
