/* MediaHub Arcade — Core game engine (Canvas 2D)
   - rAF loop, fixed logical resolution (800x600), variable dt clamp
   - Object pooling for obstacles/particles
   - Preserves original mechanics (bounce, split, homing, wall bounce)
   - Adds mode layer (time limit, invincible, reverse, chaos, target, hitbox)
*/

import { DIFFICULTIES, MODES } from './config.js';

const W = 800, H = 600;

function circleRectCollide(cx, cy, cr, rx, ry, rw, rh) {
  const nx = Math.max(rx, Math.min(cx, rx + rw));
  const ny = Math.max(ry, Math.min(cy, ry + rh));
  const dx = cx - nx, dy = cy - ny;
  return (dx * dx + dy * dy) < cr * cr;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

export class Game {
  constructor(canvas, opts = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.W = W; this.H = H;

    this.state = 'idle'; // idle | playing | paused | over
    this.score = 0;
    this.dodged = 0;
    this.maxSpeed = 0;
    this.elapsedMs = 0;
    this.paused = false;

    this.mode = 'classic';
    this.difficulty = 'easy';
    this.cfg = DIFFICULTIES.easy;
    this.modeCfg = MODES.classic;

    this.settings = opts.settings || { shake: true, reduced: false };
    this.joystick = opts.joystick || null;
    this.onEnd = opts.onEnd || (() => {});
    this.onScore = opts.onScore || (() => {});
    this.onShake = opts.onShake || (() => {});
    this.onHudTick = opts.onHudTick || (() => {});

    // Skin + Fähigkeiten je Runde (werden von script.js gesetzt)
    this.skin = opts.skin || { color: '#f47521', glow: '#ff8a3d' };
    this.abilities = [];             // aktive Abilities dieser Runde
    this._extraHits = 0;             // Schild + Extra Leben
    this._slowmoMs = 0;
    this._scoreMul = 1;
    this._modeMul = 1;               // wird aus MODE unabhängig, hier nicht genutzt
    this._runCoins = 0;              // Anzeige-Info am Ende

    this.player = { x: W / 2, y: H - 70, r: 22, speed: 7 };
    this.keys = { left: false, right: false, up: false, down: false };
    this.pointer = { x: null, y: null, use: false };

    this.obstacles = [];
    this.particles = [];
    this.pool = [];        // obstacle pool
    this.partPool = [];    // particle pool

    this.stars = [];
    for (let i = 0; i < 80; i++) {
      this.stars.push({
        x: Math.random() * W, y: Math.random() * H,
        r: Math.random() * 1.6 + 0.3,
        s: Math.random() * 0.6 + 0.2,
      });
    }

    this.spawnTimer = 0;
    this.spawnInterval = 38;
    this.baseSpeed = 3;

    this._chaosTimer = 0;
    this._chaosLabel = '';

    this._lastT = 0;
    this._acc = 0;
    this._running = false;

    this._bindInput();
  }

  _bindInput() {
    const kd = (e) => {
      const k = e.key.toLowerCase();
      if (k === 'arrowleft' || k === 'a') { this.keys.left = true; this.pointer.use = false; }
      if (k === 'arrowright' || k === 'd') { this.keys.right = true; this.pointer.use = false; }
      if (k === 'arrowup' || k === 'w') { this.keys.up = true; this.pointer.use = false; }
      if (k === 'arrowdown' || k === 's') { this.keys.down = true; this.pointer.use = false; }
      if (k === 'p' || k === 'escape') { if (this.state === 'playing') this.togglePause(); }
      if (k === ' ') { if (this.state === 'paused') this.togglePause(); }
    };
    const ku = (e) => {
      const k = e.key.toLowerCase();
      if (k === 'arrowleft' || k === 'a') this.keys.left = false;
      if (k === 'arrowright' || k === 'd') this.keys.right = false;
      if (k === 'arrowup' || k === 'w') this.keys.up = false;
      if (k === 'arrowdown' || k === 's') this.keys.down = false;
    };
    window.addEventListener('keydown', kd);
    window.addEventListener('keyup', ku);

    const setPointer = (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const cx = e.touches ? e.touches[0].clientX : e.clientX;
      const cy = e.touches ? e.touches[0].clientY : e.clientY;
      this.pointer.x = (cx - rect.left) * (W / rect.width);
      this.pointer.y = (cy - rect.top) * (H / rect.height);
      this.pointer.use = true;
    };
    this.canvas.addEventListener('mousemove', setPointer);
    this.canvas.addEventListener('mouseleave', () => { this.pointer.use = false; });
    // Touch on canvas (fallback when joystick disabled)
    this.canvas.addEventListener('touchstart', (e) => { e.preventDefault(); setPointer(e); }, { passive: false });
    this.canvas.addEventListener('touchmove', (e) => { e.preventDefault(); setPointer(e); }, { passive: false });
  }

  /* ---------- Pool ---------- */
  _acquireObstacle() {
    const o = this.pool.pop() || {};
    o.x = 0; o.y = 0; o.w = 24; o.h = 24;
    o.vx = 0; o.vy = 0; o.rot = 0; o.vr = 0;
    o.bounces = 0; o.homing = 0;
    return o;
  }
  _releaseObstacle(o) {
    if (this.pool.length < 200) this.pool.push(o);
  }
  _acquireParticle() { return this.partPool.pop() || {}; }
  _releaseParticle(p) { if (this.partPool.length < 200) this.partPool.push(p); }

  /* ---------- Lifecycle ---------- */
  start(mode, difficulty) {
    this.mode = mode;
    this.difficulty = difficulty;
    this.cfg = DIFFICULTIES[difficulty] || DIFFICULTIES.easy;
    this.modeCfg = MODES[mode] || MODES.classic;

    this.state = 'playing';
    this.score = 0;
    this.dodged = 0;
    this.maxSpeed = 0;
    this.elapsedMs = 0;
    this.spawnTimer = 0;
    this.spawnInterval = this.cfg.spawnInterval;
    this.baseSpeed = this.cfg.baseSpeed;

    // Fähigkeiten anwenden
    this._extraHits = 0;
    this._slowmoMs = 0;
    this._scoreMul = 1;
    if (this.abilities.includes('shield'))    this._extraHits += 1;
    if (this.abilities.includes('extralife')) this._extraHits += 1;
    if (this.abilities.includes('slowmo'))    this._slowmoMs = 6000;
    if (this.abilities.includes('double'))    this._scoreMul = 2;

    // Recycle obstacles
    for (const o of this.obstacles) this._releaseObstacle(o);
    for (const p of this.particles) this._releaseParticle(p);
    this.obstacles.length = 0;
    this.particles.length = 0;

    this.player.x = W / 2;
    this.player.y = this.cfg.allowUpDown ? H / 2 : H - 70;

    this._chaosTimer = 0;
    this._chaosLabel = '';

    if (!this._running) {
      this._running = true;
      this._lastT = performance.now();
      requestAnimationFrame(this._loop.bind(this));
    }
  }

  end(reason = 'crash') {
    if (this.state === 'over') return;
    this.state = 'over';
    // Death particles (only on crash)
    if (reason === 'crash') {
      for (let i = 0; i < 40; i++) {
        const p = this._acquireParticle();
        p.x = this.player.x; p.y = this.player.y;
        p.vx = (Math.random() - 0.5) * 8;
        p.vy = (Math.random() - 0.5) * 8;
        p.life = 60; p.max = 60;
        p.color = Math.random() > 0.5 ? '#f47521' : '#ff8a3d';
        this.particles.push(p);
      }
      if (this.settings.shake) this.onShake();
    }
    this.onEnd({
      reason,
      score: this.score,
      time: this.elapsedMs / 1000,
      dodged: this.dodged,
      maxSpeed: this.maxSpeed,
      mode: this.mode,
      difficulty: this.difficulty,
    });
  }

  togglePause() {
    if (this.state === 'playing') { this.state = 'paused'; }
    else if (this.state === 'paused') { this.state = 'playing'; this._lastT = performance.now(); }
  }

  quit() {
    this.state = 'idle';
  }

  /* ---------- Spawning ---------- */
  _spawn() {
    const size = 24 + Math.random() * 36;
    const cfg = this.cfg;
    const dirs = [];
    if (cfg.vertical) dirs.push('down');
    if (cfg.horizontal) dirs.push('left');
    if (cfg.fromAllSides) { dirs.push('up'); dirs.push('right'); }
    const dir = dirs[Math.floor(Math.random() * dirs.length)];
    const speed = this.baseSpeed + Math.random() * 2;

    const o = this._acquireObstacle();
    o.w = size; o.h = size;
    o.vr = (Math.random() - 0.5) * 0.1;
    if (cfg.homing) o.homing = cfg.homing;

    if (dir === 'down') { o.x = Math.random() * (W - size); o.y = -size; o.vy = speed; }
    else if (dir === 'up') { o.x = Math.random() * (W - size); o.y = H; o.vy = -speed; }
    else if (dir === 'left') { o.x = W; o.y = Math.random() * (H - size); o.vx = -speed; }
    else { o.x = -size; o.y = Math.random() * (H - size); o.vx = speed; }

    if (speed > this.maxSpeed) this.maxSpeed = speed;
    this.obstacles.push(o);
  }

  /* ---------- Loop ---------- */
  _loop(t) {
    if (!this._running) return;
    const dt = Math.min(48, t - this._lastT); // clamp to avoid huge jumps
    this._lastT = t;
    // Convert to logical "frames" (60fps target) — physics uses `step` = dt/16.666
    const step = dt / (1000 / 60);

    if (this.state === 'playing') this._update(step, dt);
    else this._updateParticles(step);

    this._draw();
    requestAnimationFrame(this._loop.bind(this));
  }

  _update(step, dt) {
    this.elapsedMs += dt;
    const cfg = this.cfg;
    const mode = this.modeCfg;

    // Zeitlupe: reduziert step effektiv (Hindernisse langsamer, Spieler normal)
    let obstacleStep = step;
    if (this._slowmoMs > 0) {
      obstacleStep = step * 0.5;
      this._slowmoMs -= dt;
    }

    // Time attack
    if (mode.timeLimit && this.elapsedMs >= mode.timeLimit * 1000) {
      return this.end('time');
    }
    // Speed run target
    if (mode.scoreTarget && this.score >= mode.scoreTarget) {
      return this.end('target');
    }

    // Survival: aggressive ramp
    if (mode.survivalRamp && this.elapsedMs > 0 && Math.floor(this.elapsedMs / 5000) > Math.floor((this.elapsedMs - dt) / 5000)) {
      this.spawnInterval = Math.max(cfg.minSpawn - 2, this.spawnInterval - 3);
      this.baseSpeed += 0.4;
    }

    // Chaos: swap modifier every 10s
    if (mode.chaos) {
      this._chaosTimer += dt;
      if (this._chaosTimer > 10000) {
        this._chaosTimer = 0;
        const choice = Math.floor(Math.random() * 4);
        this._chaosLabel = ['SPEED+', 'SPAWN+', 'REVERSE', 'BIG'][choice];
        if (choice === 0) this.baseSpeed += 0.6;
        else if (choice === 1) this.spawnInterval = Math.max(cfg.minSpawn, this.spawnInterval - 4);
        else if (choice === 2) this._chaosReverse = !this._chaosReverse;
        else if (choice === 3) this.player.r = this.player.r === 22 ? 28 : 22;
      }
    }

    // Stars drift
    for (const s of this.stars) {
      s.y += s.s * step;
      if (s.y > H) { s.y = 0; s.x = Math.random() * W; }
    }

    // Reverse controls
    const rev = (mode.reverseControls || this._chaosReverse) ? -1 : 1;

    // Player movement — joystick > pointer > keys
    const jx = this.joystick && this.joystick.enabled && this.joystick.active ? this.joystick.dx : 0;
    const jy = this.joystick && this.joystick.enabled && this.joystick.active ? this.joystick.dy : 0;
    if (jx !== 0 || jy !== 0) {
      this.player.x += rev * jx * this.player.speed * 1.1 * step;
      if (cfg.allowUpDown) this.player.y += rev * jy * this.player.speed * 1.1 * step;
    } else if (this.pointer.use && this.pointer.x !== null) {
      const dx = this.pointer.x - this.player.x;
      this.player.x += rev * dx * 0.25 * step;
      if (cfg.allowUpDown && this.pointer.y !== null) {
        const dy = this.pointer.y - this.player.y;
        this.player.y += rev * dy * 0.25 * step;
      }
    } else {
      if (this.keys.left)  this.player.x -= rev * this.player.speed * step;
      if (this.keys.right) this.player.x += rev * this.player.speed * step;
      if (cfg.allowUpDown) {
        if (this.keys.up)   this.player.y -= rev * this.player.speed * step;
        if (this.keys.down) this.player.y += rev * this.player.speed * step;
      }
    }
    this.player.x = Math.max(this.player.r, Math.min(W - this.player.r, this.player.x));
    const minY = cfg.allowUpDown ? this.player.r : H - 70;
    const maxY = cfg.allowUpDown ? H - this.player.r : H - 70;
    this.player.y = Math.max(minY, Math.min(maxY, this.player.y));

    // Ramp
    if (cfg.rampInterval && Math.floor(this.elapsedMs / (cfg.rampInterval * 16.666)) >
        Math.floor((this.elapsedMs - dt) / (cfg.rampInterval * 16.666))) {
      this.spawnInterval = Math.max(cfg.minSpawn, this.spawnInterval - cfg.rampSpawn);
      this.baseSpeed += cfg.rampSpeed;
    }

    // Spawn
    this.spawnTimer += step;
    if (this.spawnTimer >= this.spawnInterval) {
      this.spawnTimer = 0;
      this._spawn();
    }

    // Hit radius (hardcore boosts hitbox)
    const hitR = this.player.r * 0.85 * (mode.hitboxBoost || 1);

    for (let i = this.obstacles.length - 1; i >= 0; i--) {
      const o = this.obstacles[i];

      // Homing
      if (o.homing && o.homing > 0) {
        const cx = o.x + o.w / 2, cy = o.y + o.h / 2;
        const dx = this.player.x - cx, dy = this.player.y - cy;
        const d = Math.hypot(dx, dy) || 1;
        const sp = Math.hypot(o.vx, o.vy) || cfg.baseSpeed;
        const tvx = (dx / d) * sp;
        const tvy = (dy / d) * sp;
        const k = 0.08;
        o.vx = o.vx * (1 - k) + tvx * k;
        o.vy = o.vy * (1 - k) + tvy * k;
        o.rot += 0.08 * step;
        o.homing -= step;
        if (o.homing <= 0 && cfg.homingSplit && cfg.homingSplit > 1) {
          const parts = cfg.homingSplit;
          const ns = Math.max(16, o.w / 1.6);
          const speed = Math.max(3, Math.hypot(o.vx, o.vy));
          const baseAng = Math.atan2(o.vy, o.vx);
          const px = o.x + o.w / 2, py = o.y + o.h / 2;
          for (let k2 = 0; k2 < parts; k2++) {
            const ang = baseAng + ((k2 - (parts - 1) / 2) * (Math.PI * 2 / (parts + 1)));
            const np = this._acquireObstacle();
            np.x = px - ns / 2; np.y = py - ns / 2; np.w = ns; np.h = ns;
            np.vx = Math.cos(ang) * speed; np.vy = Math.sin(ang) * speed;
            np.rot = o.rot; np.vr = (Math.random() - 0.5) * 0.2;
            this.obstacles.push(np);
          }
          this._releaseObstacle(this.obstacles.splice(i, 1)[0]);
          continue;
        }
      }

      o.x += o.vx * obstacleStep;
      o.y += o.vy * obstacleStep;
      o.rot += o.vr * obstacleStep;

      // Collision
      if (!mode.invincible &&
          circleRectCollide(this.player.x, this.player.y, hitR, o.x, o.y, o.w, o.h)) {
        if (this._extraHits > 0) {
          this._extraHits -= 1;
          // Block entfernen, Partikel-Effekt, kein Game Over
          this._releaseObstacle(this.obstacles.splice(i, 1)[0]);
          if (this.settings.shake) this.onShake();
          for (let k3 = 0; k3 < 18; k3++) {
            const p = this._acquireParticle();
            p.x = this.player.x; p.y = this.player.y;
            p.vx = (Math.random() - 0.5) * 6;
            p.vy = (Math.random() - 0.5) * 6;
            p.life = 40; p.max = 40;
            p.color = '#ffd76b';
            this.particles.push(p);
          }
          continue;
        }
        this.end('crash');
        return;
      }

      // Wall bounce
      if (cfg.wallBounce && o.bounces < cfg.wallBounce) {
        let b = false;
        if (o.x < 0) { o.x = 0; o.vx = Math.abs(o.vx); b = true; }
        else if (o.x + o.w > W) { o.x = W - o.w; o.vx = -Math.abs(o.vx); b = true; }
        if (o.y < 0) { o.y = 0; o.vy = Math.abs(o.vy); b = true; }
        else if (o.y + o.h > H) { o.y = H - o.h; o.vy = -Math.abs(o.vy); b = true; }
        if (b) o.bounces++;
      }

      const off = o.y > H + o.h || o.y < -o.h * 2 || o.x > W + o.w || o.x < -o.w * 2;
      if (off) {
        this._releaseObstacle(this.obstacles.splice(i, 1)[0]);
        this.dodged++;
        this.score += Math.max(1, Math.round((cfg.multiplier || 1) * this._scoreMul));
        this.onScore(this.score);
      }
    }

    // Obstacle-vs-obstacle (Extrem+)
    if (cfg.bounce) this._obstacleCollisions();

    // Track max speed for stats
    if (this.baseSpeed > this.maxSpeed) this.maxSpeed = this.baseSpeed;

    this._updateParticles(step);

    // HUD tick
    this.onHudTick({
      time: this.elapsedMs / 1000,
      speed: this.baseSpeed,
      dodged: this.dodged,
      chaos: this._chaosLabel,
      shield: this._extraHits,
      slowmo: Math.max(0, this._slowmoMs / 1000),
    });
  }

  _obstacleCollisions() {
    const cfg = this.cfg;
    const toRemove = new Set();
    const toAdd = [];
    const obs = this.obstacles;
    for (let i = 0; i < obs.length; i++) {
      if (toRemove.has(i)) continue;
      const a = obs[i];
      for (let j = i + 1; j < obs.length; j++) {
        if (toRemove.has(j)) continue;
        const b = obs[j];
        if (a.x < b.x + b.w && a.x + a.w > b.x &&
            a.y < b.y + b.h && a.y + a.h > b.y) {
          const tvx = a.vx, tvy = a.vy;
          a.vx = b.vx; a.vy = b.vy;
          b.vx = tvx; b.vy = tvy;
          a.vr = -a.vr; b.vr = -b.vr;
          const acx = a.x + a.w / 2, acy = a.y + a.h / 2;
          const bcx = b.x + b.w / 2, bcy = b.y + b.h / 2;
          let dx = acx - bcx, dy = acy - bcy;
          const dist = Math.hypot(dx, dy) || 1;
          dx /= dist; dy /= dist;
          a.x += dx * 2; a.y += dy * 2;
          b.x -= dx * 2; b.y -= dy * 2;

          if (cfg.accelerate || cfg.split) {
            const smaller = a.w <= b.w ? a : b;
            const larger  = a.w >  b.w ? a : b;
            if (cfg.accelerate) {
              const sp = Math.hypot(smaller.vx, smaller.vy);
              if (sp < 14) { smaller.vx *= 1.25; smaller.vy *= 1.25; }
            }
            if (cfg.split && larger.w > 28 && smaller !== larger) {
              const idx = larger === a ? i : j;
              toRemove.add(idx);
              const ns = larger.w / 2;
              const sp = Math.max(2.5, Math.hypot(larger.vx, larger.vy));
              const baseAng = Math.atan2(larger.vy, larger.vx);
              for (const sign of [-1, 1]) {
                const ang = baseAng + 0.9 * sign;
                const np = this._acquireObstacle();
                np.x = larger.x + larger.w / 2 - ns / 2;
                np.y = larger.y + larger.h / 2 - ns / 2;
                np.w = ns; np.h = ns;
                np.vx = Math.cos(ang) * sp; np.vy = Math.sin(ang) * sp;
                np.rot = larger.rot; np.vr = (Math.random() - 0.5) * 0.2;
                np.bounces = larger.bounces || 0;
                toAdd.push(np);
              }
            }
          }
        }
      }
    }
    if (toRemove.size) {
      const idxs = [...toRemove].sort((x, y) => y - x);
      for (const idx of idxs) this._releaseObstacle(obs.splice(idx, 1)[0]);
    }
    if (toAdd.length) obs.push(...toAdd);
  }

  _updateParticles(step) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * step; p.y += p.vy * step;
      p.vy += 0.15 * step;
      p.life -= step;
      if (p.life <= 0) this._releaseParticle(this.particles.splice(i, 1)[0]);
    }
  }

  /* ---------- Draw ---------- */
  _draw() {
    const ctx = this.ctx;
    ctx.fillStyle = '#0a0a12';
    ctx.fillRect(0, 0, W, H);

    for (const s of this.stars) {
      ctx.globalAlpha = 0.4 + s.s;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    const grd = ctx.createLinearGradient(0, H * 0.6, 0, H);
    grd.addColorStop(0, 'rgba(244,117,33,0)');
    grd.addColorStop(1, 'rgba(244,117,33,0.18)');
    ctx.fillStyle = grd;
    ctx.fillRect(0, H * 0.6, W, H * 0.4);

    // Obstacles
    for (const o of this.obstacles) {
      ctx.save();
      ctx.translate(o.x + o.w / 2, o.y + o.h / 2);
      ctx.rotate(o.rot);
      ctx.shadowColor = o.homing > 0 ? '#ff3d3d' : '#ff8a3d';
      ctx.shadowBlur = 14;
      ctx.fillStyle = '#1c1c28';
      ctx.strokeStyle = o.homing > 0 ? '#ff5a5a' : '#ff8a3d';
      ctx.lineWidth = 2;
      roundRect(ctx, -o.w / 2, -o.h / 2, o.w, o.h, 6);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
    ctx.shadowBlur = 0;

    // Player
    if (this.state !== 'over') {
      ctx.save();
      const skinCol = this.modeCfg.invincible ? '#5ac8ff' : (this.skin.color || '#f47521');
      const skinGlow = this.modeCfg.invincible ? '#8fdfff' : (this.skin.glow || '#ff8a3d');
      const glow = ctx.createRadialGradient(this.player.x, this.player.y, 0, this.player.x, this.player.y, this.player.r * 2.2);
      glow.addColorStop(0, hexAlpha(skinGlow, 0.55));
      glow.addColorStop(1, hexAlpha(skinGlow, 0));
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(this.player.x, this.player.y, this.player.r * 2.2, 0, Math.PI * 2);
      ctx.fill();

      ctx.shadowColor = skinCol;
      ctx.shadowBlur = 20;
      ctx.fillStyle = skinCol;
      ctx.beginPath();
      ctx.arc(this.player.x, this.player.y, this.player.r, 0, Math.PI * 2);
      ctx.fill();

      ctx.shadowBlur = 0;
      ctx.fillStyle = '#ffffff';
      ctx.globalAlpha = 0.85;
      ctx.beginPath();
      ctx.arc(this.player.x - 6, this.player.y - 6, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;

      // Schild-Ring wenn extra Leben aktiv
      if (this._extraHits > 0) {
        ctx.strokeStyle = '#ffd76b';
        ctx.lineWidth = 3;
        ctx.globalAlpha = 0.75;
        ctx.shadowColor = '#ffd76b';
        ctx.shadowBlur = 16;
        ctx.beginPath();
        ctx.arc(this.player.x, this.player.y, this.player.r + 6, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;
      }
      ctx.restore();
    }

    // Particles
    for (const p of this.particles) {
      ctx.globalAlpha = Math.max(0, p.life / (p.max || 60));
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Chaos label
    if (this.modeCfg.chaos && this._chaosLabel) {
      ctx.save();
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = '#ffd76b';
      ctx.font = 'bold 22px Orbitron, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('CHAOS: ' + this._chaosLabel, W / 2, 40);
      ctx.restore();
    }
  }
}

/* Hex → rgba mit Alpha */
function hexAlpha(hex, a) {
  const h = hex.replace('#','');
  const n = h.length === 3
    ? h.split('').map(c => parseInt(c + c, 16))
    : [parseInt(h.slice(0,2),16), parseInt(h.slice(2,4),16), parseInt(h.slice(4,6),16)];
  return `rgba(${n[0]},${n[1]},${n[2]},${a})`;
}