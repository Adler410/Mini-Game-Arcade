/* ============================================================
   MediaHub Arcade — Dodge Game
   Vanilla JavaScript, no dependencies.
   ============================================================ */

(() => {
  // --- DOM ---
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const scoreEl = document.getElementById('score');
  const bestEl = document.getElementById('best');
  const finalScoreEl = document.getElementById('finalScore');
  const finalBestEl = document.getElementById('finalBest');
  const startOverlay = document.getElementById('startOverlay');
  const gameOverOverlay = document.getElementById('gameOverOverlay');
  const startBtn = document.getElementById('startBtn');
  const restartBtn = document.getElementById('restartBtn');
  const diffHint = document.getElementById('diffHint');
  const diffButtons = document.querySelectorAll('.diff-btn');

  const W = canvas.width;
  const H = canvas.height;

  // --- Difficulty presets ---
  const DIFFICULTIES = {
    easy: {
      label: 'Einfach',
      hint: 'Blöcke fallen von oben. Bewege dich links/rechts.',
      vertical: true,
      horizontal: false,
      allowUpDown: false,
      baseSpeed: 3,
      spawnInterval: 38,
      rampInterval: 300,
      rampSpawn: 2,
      rampSpeed: 0.4,
      minSpawn: 10,
    },
    medium: {
      label: 'Mittel',
      hint: 'Blöcke kommen von oben UND von rechts. Bewege dich in alle 4 Richtungen.',
      vertical: true,
      horizontal: true,
      allowUpDown: true,
      baseSpeed: 3.6,
      spawnInterval: 34,
      rampInterval: 280,
      rampSpawn: 2,
      rampSpeed: 0.45,
      minSpawn: 9,
    },
    hard: {
      label: 'Schwer',
      hint: 'Blöcke aus allen Richtungen. Volle Bewegungsfreiheit — nur für Profis.',
      vertical: true,
      horizontal: true,
      allowUpDown: true,
      fromAllSides: true,
      baseSpeed: 4.4,
      spawnInterval: 26,
      rampInterval: 240,
      rampSpawn: 2,
      rampSpeed: 0.55,
      minSpawn: 7,
    },
    extreme: {
      label: 'Extrem',
      hint: 'Chaos-Modus: Blöcke aus allen Richtungen und prallen voneinander ab!',
      vertical: true,
      horizontal: true,
      allowUpDown: true,
      fromAllSides: true,
      bounce: true,
      baseSpeed: 5.2,
      spawnInterval: 20,
      rampInterval: 220,
      rampSpawn: 2,
      rampSpeed: 0.65,
      minSpawn: 5,
    },
    god: {
      label: 'Gott',
      hint: 'Gott-Modus: kleine Blöcke werden beim Aufprall schneller, große splitten sich in zwei!',
      vertical: true,
      horizontal: true,
      allowUpDown: true,
      fromAllSides: true,
      bounce: true,
      split: true,
      accelerate: true,
      baseSpeed: 5.6,
      spawnInterval: 22,
      rampInterval: 220,
      rampSpawn: 2,
      rampSpeed: 0.7,
      minSpawn: 6,
    },
    impossible: {
      label: 'Unmöglich',
      hint: 'Unmöglich: verfolgende Blöcke jagen dich 5 Sekunden lang, dann splitten sie sich in drei!',
      vertical: true,
      horizontal: true,
      allowUpDown: true,
      fromAllSides: true,
      bounce: true,
      split: true,
      accelerate: true,
      homing: 300,
      homingSplit: 3,
      baseSpeed: 5.6,
      spawnInterval: 26,
      rampInterval: 220,
      rampSpawn: 2,
      rampSpeed: 0.7,
      minSpawn: 6,
    },
    infinite: {
      label: 'Unendlich',
      hint: 'Unendlich: alles aus Gott + Blöcke prallen einmal von der Wand ab bevor sie verschwinden.',
      vertical: true,
      horizontal: true,
      allowUpDown: true,
      fromAllSides: true,
      bounce: true,
      split: true,
      accelerate: true,
      wallBounce: 1,
      baseSpeed: 5.8,
      spawnInterval: 24,
      rampInterval: 220,
      rampSpawn: 2,
      rampSpeed: 0.7,
      minSpawn: 6,
    },
  };

  let difficulty = localStorage.getItem('mediahub_diff') || 'easy';
  if (!DIFFICULTIES[difficulty]) difficulty = 'easy';

  // --- State ---
  let state = 'idle';
  let score = 0;
  let best = 0;
  const bestKey = (d) => `mediahub_best_${d}`;

  function loadBest() {
    // Migrate legacy
    const legacy = localStorage.getItem('mediahub_best');
    if (legacy && !localStorage.getItem(bestKey('easy'))) {
      localStorage.setItem(bestKey('easy'), legacy);
    }
    best = Number(localStorage.getItem(bestKey(difficulty)) || 0);
    bestEl.textContent = best;
  }

  const player = { x: W / 2, y: H - 70, r: 22, speed: 7 };
  const keys = { left: false, right: false, up: false, down: false };
  let pointerX = null, pointerY = null;
  let usePointer = false;

  let obstacles = [];
  let particles = [];
  let stars = [];

  let spawnTimer = 0;
  let cfg = DIFFICULTIES[difficulty];
  let spawnInterval = cfg.spawnInterval;
  let baseSpeed = cfg.baseSpeed;
  let elapsed = 0;

  function initStars() {
    stars = [];
    for (let i = 0; i < 80; i++) {
      stars.push({
        x: Math.random() * W,
        y: Math.random() * H,
        r: Math.random() * 1.6 + 0.3,
        s: Math.random() * 0.6 + 0.2,
      });
    }
  }
  initStars();

  // --- Difficulty UI ---
  function applyDifficultyUI() {
    diffButtons.forEach((b) => {
      b.classList.toggle('active', b.dataset.diff === difficulty);
    });
    if (diffHint) diffHint.textContent = DIFFICULTIES[difficulty].hint;
    loadBest();
  }
  diffButtons.forEach((b) => {
    b.addEventListener('click', () => {
      difficulty = b.dataset.diff;
      localStorage.setItem('mediahub_diff', difficulty);
      applyDifficultyUI();
    });
  });
  applyDifficultyUI();

  // --- Input ---
  window.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft'  || e.key === 'a' || e.key === 'A') { keys.left = true; usePointer = false; }
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') { keys.right = true; usePointer = false; }
    if (e.key === 'ArrowUp'    || e.key === 'w' || e.key === 'W') { keys.up = true; usePointer = false; }
    if (e.key === 'ArrowDown'  || e.key === 's' || e.key === 'S') { keys.down = true; usePointer = false; }
    if (e.key === ' ' && state !== 'playing') startGame();
  });
  window.addEventListener('keyup', (e) => {
    if (e.key === 'ArrowLeft'  || e.key === 'a' || e.key === 'A') keys.left = false;
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') keys.right = false;
    if (e.key === 'ArrowUp'    || e.key === 'w' || e.key === 'W') keys.up = false;
    if (e.key === 'ArrowDown'  || e.key === 's' || e.key === 'S') keys.down = false;
  });

  function setPointerFromEvent(e) {
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const scaleX = W / rect.width;
    const scaleY = H / rect.height;
    pointerX = (clientX - rect.left) * scaleX;
    pointerY = (clientY - rect.top) * scaleY;
    usePointer = true;
  }
  canvas.addEventListener('mousemove', setPointerFromEvent);
  canvas.addEventListener('mouseleave', () => { usePointer = false; });
  canvas.addEventListener('touchstart', (e) => { e.preventDefault(); setPointerFromEvent(e); }, { passive: false });
  canvas.addEventListener('touchmove',  (e) => { e.preventDefault(); setPointerFromEvent(e); }, { passive: false });

  startBtn.addEventListener('click', startGame);
  restartBtn.addEventListener('click', startGame);

  function startGame() {
    cfg = DIFFICULTIES[difficulty];
    state = 'playing';
    score = 0;
    elapsed = 0;
    spawnInterval = cfg.spawnInterval;
    baseSpeed = cfg.baseSpeed;
    obstacles = [];
    particles = [];
    player.x = W / 2;
    player.y = cfg.allowUpDown ? H / 2 : H - 70;
    scoreEl.textContent = '0';
    startOverlay.classList.add('hidden');
    gameOverOverlay.classList.add('hidden');
  }

  function endGame() {
    state = 'over';
    if (score > best) {
      best = score;
      localStorage.setItem(bestKey(difficulty), String(best));
    }
    bestEl.textContent = best;
    finalScoreEl.textContent = score;
    finalBestEl.textContent = best;
    gameOverOverlay.classList.remove('hidden');

    for (let i = 0; i < 40; i++) {
      particles.push({
        x: player.x, y: player.y,
        vx: (Math.random() - 0.5) * 8,
        vy: (Math.random() - 0.5) * 8,
        life: 60,
        color: Math.random() > 0.5 ? '#f47521' : '#ff8a3d',
      });
    }
  }

  // --- Spawning ---
  function spawnObstacle() {
    const size = 24 + Math.random() * 36;
    // Choose direction based on difficulty
    const dirs = [];
    if (cfg.vertical) dirs.push('down');
    if (cfg.horizontal) dirs.push('left'); // von rechts nach links
    if (cfg.fromAllSides) { dirs.push('up'); dirs.push('right'); }
    const dir = dirs[Math.floor(Math.random() * dirs.length)];

    const speed = baseSpeed + Math.random() * 2;
    let o = { w: size, h: size, rot: 0, vr: (Math.random() - 0.5) * 0.1, vx: 0, vy: 0, bounces: 0 };
    if (cfg.homing) o.homing = cfg.homing;

    if (dir === 'down') {
      o.x = Math.random() * (W - size);
      o.y = -size;
      o.vy = speed;
    } else if (dir === 'up') {
      o.x = Math.random() * (W - size);
      o.y = H;
      o.vy = -speed;
    } else if (dir === 'left') {
      o.x = W;
      o.y = Math.random() * (H - size);
      o.vx = -speed;
    } else {
      o.x = -size;
      o.y = Math.random() * (H - size);
      o.vx = speed;
    }
    obstacles.push(o);
  }

  // --- Update ---
  function update() {
    elapsed++;

    for (const s of stars) {
      s.y += s.s;
      if (s.y > H) { s.y = 0; s.x = Math.random() * W; }
    }

    if (state !== 'playing') { updateParticles(); return; }

    // Player movement
    if (usePointer && pointerX !== null) {
      const dx = pointerX - player.x;
      player.x += dx * 0.25;
      if (cfg.allowUpDown && pointerY !== null) {
        const dy = pointerY - player.y;
        player.y += dy * 0.25;
      }
    } else {
      if (keys.left)  player.x -= player.speed;
      if (keys.right) player.x += player.speed;
      if (cfg.allowUpDown) {
        if (keys.up)   player.y -= player.speed;
        if (keys.down) player.y += player.speed;
      }
    }
    player.x = Math.max(player.r, Math.min(W - player.r, player.x));
    const minY = cfg.allowUpDown ? player.r : H - 70;
    const maxY = cfg.allowUpDown ? H - player.r : H - 70;
    player.y = Math.max(minY, Math.min(maxY, player.y));

    if (elapsed % cfg.rampInterval === 0) {
      spawnInterval = Math.max(cfg.minSpawn, spawnInterval - cfg.rampSpawn);
      baseSpeed += cfg.rampSpeed;
    }

    spawnTimer++;
    if (spawnTimer >= spawnInterval) {
      spawnTimer = 0;
      spawnObstacle();
    }

    for (let i = obstacles.length - 1; i >= 0; i--) {
      const o = obstacles[i];
      // Homing steering (Unmöglich): tracks player until timer expires, then splits.
      if (o.homing && o.homing > 0) {
        const cx = o.x + o.w / 2, cy = o.y + o.h / 2;
        const dx = player.x - cx, dy = player.y - cy;
        const d = Math.hypot(dx, dy) || 1;
        const sp = Math.hypot(o.vx, o.vy) || cfg.baseSpeed;
        // Blend current velocity toward player direction
        const tvx = (dx / d) * sp;
        const tvy = (dy / d) * sp;
        const k = 0.08;
        o.vx = o.vx * (1 - k) + tvx * k;
        o.vy = o.vy * (1 - k) + tvy * k;
        o.rot += 0.08;
        o.homing--;
        if (o.homing === 0 && cfg.homingSplit && cfg.homingSplit > 1) {
          const parts = cfg.homingSplit;
          const ns = Math.max(16, o.w / 1.6);
          const speed = Math.max(3, Math.hypot(o.vx, o.vy));
          const baseAng = Math.atan2(o.vy, o.vx);
          const px = o.x + o.w / 2, py = o.y + o.h / 2;
          for (let k2 = 0; k2 < parts; k2++) {
            const ang = baseAng + ((k2 - (parts - 1) / 2) * (Math.PI * 2 / (parts + 1)));
            obstacles.push({
              x: px - ns / 2, y: py - ns / 2, w: ns, h: ns,
              vx: Math.cos(ang) * speed,
              vy: Math.sin(ang) * speed,
              rot: o.rot, vr: (Math.random() - 0.5) * 0.2,
              bounces: 0,
            });
          }
          obstacles.splice(i, 1);
          continue;
        }
      }
      o.x += o.vx;
      o.y += o.vy;
      o.rot += o.vr;

      if (circleRectCollide(player.x, player.y, player.r * 0.85, o.x, o.y, o.w, o.h)) {
        endGame();
        return;
      }

      // Wall bounce (Unendlich): reflect on edge until bounce budget spent.
      if (cfg.wallBounce && o.bounces < cfg.wallBounce) {
        let bounced = false;
        if (o.x < 0) { o.x = 0; o.vx = Math.abs(o.vx); bounced = true; }
        else if (o.x + o.w > W) { o.x = W - o.w; o.vx = -Math.abs(o.vx); bounced = true; }
        if (o.y < 0) { o.y = 0; o.vy = Math.abs(o.vy); bounced = true; }
        else if (o.y + o.h > H) { o.y = H - o.h; o.vy = -Math.abs(o.vy); bounced = true; }
        if (bounced) o.bounces++;
      }

      const off = o.y > H + o.h || o.y < -o.h * 2 || o.x > W + o.w || o.x < -o.w * 2;
      if (off) {
        obstacles.splice(i, 1);
        score++;
        scoreEl.textContent = score;
      }
    }

    // Obstacle-vs-obstacle bounce (Extrem-Modus)
    if (cfg.bounce) {
      const toRemove = new Set();
      const toAdd = [];
      for (let i = 0; i < obstacles.length; i++) {
        if (toRemove.has(i)) continue;
        const a = obstacles[i];
        for (let j = i + 1; j < obstacles.length; j++) {
          if (toRemove.has(j)) continue;
          const b = obstacles[j];
          if (a.x < b.x + b.w && a.x + a.w > b.x &&
              a.y < b.y + b.h && a.y + a.h > b.y) {
            // Swap velocities and nudge apart
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

            // Gott / Unendlich: smaller accelerates, larger splits in two.
            if (cfg.accelerate || cfg.split) {
              const smaller = a.w <= b.w ? a : b;
              const larger  = a.w >  b.w ? a : b;
              if (cfg.accelerate) {
                const boost = 1.25;
                const sp = Math.hypot(smaller.vx, smaller.vy);
                if (sp < 14) { smaller.vx *= boost; smaller.vy *= boost; }
              }
              if (cfg.split && larger.w > 28 && smaller !== larger) {
                const idx = larger === a ? i : j;
                toRemove.add(idx);
                const ns = larger.w / 2;
                const sp = Math.max(2.5, Math.hypot(larger.vx, larger.vy));
                const baseAng = Math.atan2(larger.vy, larger.vx);
                const spread = 0.9; // radians
                for (const sign of [-1, 1]) {
                  const ang = baseAng + spread * sign;
                  toAdd.push({
                    x: larger.x + larger.w / 2 - ns / 2,
                    y: larger.y + larger.h / 2 - ns / 2,
                    w: ns, h: ns,
                    vx: Math.cos(ang) * sp,
                    vy: Math.sin(ang) * sp,
                    rot: larger.rot,
                    vr: (Math.random() - 0.5) * 0.2,
                    bounces: larger.bounces || 0,
                  });
                }
              }
            }
          }
        }
      }
      if (toRemove.size) {
        const idxs = [...toRemove].sort((x, y) => y - x);
        for (const idx of idxs) obstacles.splice(idx, 1);
      }
      if (toAdd.length) obstacles.push(...toAdd);
    }

    updateParticles();
  }

  function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx; p.y += p.vy; p.vy += 0.15; p.life--;
      if (p.life <= 0) particles.splice(i, 1);
    }
  }

  function circleRectCollide(cx, cy, cr, rx, ry, rw, rh) {
    const nx = Math.max(rx, Math.min(cx, rx + rw));
    const ny = Math.max(ry, Math.min(cy, ry + rh));
    const dx = cx - nx, dy = cy - ny;
    return (dx * dx + dy * dy) < cr * cr;
  }

  // --- Render ---
  function draw() {
    ctx.fillStyle = '#0a0a12';
    ctx.fillRect(0, 0, W, H);

    for (const s of stars) {
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

    for (const o of obstacles) {
      ctx.save();
      ctx.translate(o.x + o.w / 2, o.y + o.h / 2);
      ctx.rotate(o.rot);
      ctx.shadowColor = '#ff8a3d';
      ctx.shadowBlur = 14;
      ctx.fillStyle = '#1c1c28';
      ctx.strokeStyle = '#ff8a3d';
      ctx.lineWidth = 2;
      roundRect(ctx, -o.w / 2, -o.h / 2, o.w, o.h, 6);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
    ctx.shadowBlur = 0;

    if (state !== 'over') {
      ctx.save();
      const glow = ctx.createRadialGradient(player.x, player.y, 0, player.x, player.y, player.r * 2.2);
      glow.addColorStop(0, 'rgba(255,138,61,0.55)');
      glow.addColorStop(1, 'rgba(255,138,61,0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(player.x, player.y, player.r * 2.2, 0, Math.PI * 2);
      ctx.fill();

      ctx.shadowColor = '#f47521';
      ctx.shadowBlur = 20;
      ctx.fillStyle = '#f47521';
      ctx.beginPath();
      ctx.arc(player.x, player.y, player.r, 0, Math.PI * 2);
      ctx.fill();

      ctx.shadowBlur = 0;
      ctx.fillStyle = '#ffffff';
      ctx.globalAlpha = 0.85;
      ctx.beginPath();
      ctx.arc(player.x - 6, player.y - 6, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.restore();
    }

    for (const p of particles) {
      ctx.globalAlpha = Math.max(0, p.life / 60);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
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

  function loop() {
    update();
    draw();
    requestAnimationFrame(loop);
  }
  loop();
})();
