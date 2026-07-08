/* MediaHub Arcade — Katalog aller Skins & Fähigkeiten
 *
 * Jeder Skin hat eine Farbe (oder Sonder-Renderer), ein Icon-Preview
 * und einen Coin-Preis. Der Default-Skin ist gratis und immer aktiv.
 * Fähigkeiten sind kaufbar und pro Runde einmalig aktivierbar.
 */

export const SKINS = {
  default:  { name: 'Klassik',      price: 0,    color: '#f47521', glow: '#ff8a3d' },
  neonBlue: { name: 'Neon Blau',    price: 250,  color: '#3ab5ff', glow: '#7cd7ff' },
  neonGreen:{ name: 'Neon Grün',    price: 250,  color: '#3aff8f', glow: '#8effc4' },
  red:      { name: 'Rot',          price: 200,  color: '#ff3d5a', glow: '#ff7a90' },
  purple:   { name: 'Lila',         price: 350,  color: '#b56bff', glow: '#d7a6ff' },
  gold:     { name: 'Gold',         price: 800,  color: '#ffd76b', glow: '#fff2b0' },
  cyber:    { name: 'Cyber',        price: 900,  color: '#00ffd1', glow: '#7effe6' },
  pixel:    { name: 'Pixel',        price: 400,  color: '#a5ff00', glow: '#d6ff7a', pattern: 'pixel' },
  galaxy:   { name: 'Galaxy',       price: 1200, color: '#7a5cff', glow: '#c8a0ff', pattern: 'galaxy' },
  rainbow:  { name: 'Regenbogen',   price: 1800, color: '#ff8a3d', glow: '#ffffff', pattern: 'rainbow' },
};

export const ABILITIES = {
  shield: {
    name: 'Schutzschild', price: 500,
    desc: 'Der erste Treffer der Runde wird ignoriert.',
    icon: '🛡',
  },
  extralife: {
    name: 'Extra Leben', price: 900,
    desc: 'Ein zusätzlicher Treffer ist erlaubt.',
    icon: '❤',
  },
  slowmo: {
    name: 'Zeitlupe', price: 700,
    desc: 'Rundenstart mit 6 Sekunden Zeitlupe.',
    icon: '⏳',
  },
  magnet: {
    name: 'Coin-Magnet', price: 600,
    desc: '+50 % Coin-Gewinn in dieser Runde.',
    icon: '🧲',
  },
  double: {
    name: 'Doppelter Score', price: 1000,
    desc: 'Verdoppelt die Punkte in dieser Runde.',
    icon: '×2',
  },
  luck: {
    name: 'Glück', price: 400,
    desc: '+30 % Chance auf Bonus-Coins am Rundenende.',
    icon: '🍀',
  },
};

/* Ränge, basierend auf Level */
export const RANKS = [
  { min: 1,  name: 'Anfänger' },
  { min: 3,  name: 'Spieler' },
  { min: 6,  name: 'Profi' },
  { min: 10, name: 'Veteran' },
  { min: 15, name: 'Elite' },
  { min: 22, name: 'Meister' },
  { min: 30, name: 'Legende' },
];

export function rankFor(level) {
  let r = RANKS[0];
  for (const t of RANKS) if (level >= t.min) r = t;
  return r.name;
}

/* XP-Kurve — Level n benötigt insgesamt n * 150 XP zum Aufstieg */
export function xpForNextLevel(level) {
  return level * 150;
}
