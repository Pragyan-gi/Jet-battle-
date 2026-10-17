
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const scoreEl = document.getElementById("score");
const livesEl = document.getElementById("lives");
const overlay = document.getElementById("overlay");
const overlayTitle = document.getElementById("overlayTitle");
const overlayText = document.getElementById("overlayText");
const startBtn = document.getElementById("startBtn");
const fireBtn = document.getElementById("fireBtn");

const W = canvas.width;
const H = canvas.height;

let running = false;
let score = 0;
let lives = 3;
let lastTime = 0;
let enemyTimer = 0;
let shotTimer = 0;
let invincible = 0;
let enemies = [];
let bullets = [];
let enemyBullets = [];
let particles = [];
let stars = [];
let keys = {};

const player = {
  x: W / 2,
  y: H - 90,
  w: 28,
  h: 36,
  speed: 250
};

const rand = (min, max) => Math.random() * (max - min) + min;

function initStars() {
  stars = Array.from({ length: 85 }, () => ({
    x: rand(0, W),
    y: rand(0, H),
    size: Math.random() < 0.7 ? 2 : 3,
    speed: rand(30, 125)
  }));
}

function updateHUD() {
  scoreEl.textContent = String(score).padStart(5, "0");
  livesEl.textContent = "♥".repeat(lives) + "♡".repeat(3 - lives);
}

function startGame() {
  score = 0;
  lives = 3;
  enemies = [];
  bullets = [];
  enemyBullets = [];
  particles = [];
  player.x = W / 2;
  player.y = H - 90;
  enemyTimer = 0;
  shotTimer = 0;
  invincible = 1.5;
  keys = {};

  updateHUD();
  running = true;
  lastTime = performance.now();
  overlay.classList.add("hidden");
}

function endGame() {
  running = false;
  overlay.classList.remove("hidden");
  overlayTitle.innerHTML = "GAME<br>OVER";
  overlayText.innerHTML =
    `FINAL SCORE: ${String(score).padStart(5, "0")}<br>` +
    "THE SKY NEEDS YOU AGAIN!";
  startBtn.textContent = "↻ PLAY AGAIN";
}

function makeExplosion(x, y, color, count = 12) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = rand(35, 150);

    particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: rand(0.2, 0.65),
      maxLife: 0.65,
      size: rand(2, 5),
      color
    });
  }
}

function shoot() {
  if (!running || shotTimer > 0) return;

  bullets.push({
    x: player.x,
    y: player.y - 20,
    w: 4,
    h: 13,
    speed: 440
  });

  shotTimer = 0.16;
}

function spawnEnemy() {
  const x = rand(30, W - 30);
  const tough = Math.random() < 0.18;

  enemies.push({
    x,
    y: -30,
    w: tough ? 34 : 27,
    h: tough ? 34 : 28,
    speed: rand(65, 115) + Math.min(score / 250, 85),
    hp: tough ? 3 : 1,
    maxHp: tough ? 3 : 1,
    shootTimer: rand(1.3, 3.5),
    color: tough ? "#c16bff" : "#ff4d91"
  });
}

function hit(a, b) {
  return (
    Math.abs(a.x - b.x) < (a.w + b.w) / 2 &&
    Math.abs(a.y - b.y) < (a.h + b.h) / 2
  );
}

function damagePlayer() {
  if (invincible > 0 || !running) return;

  lives--;
  invincible = 1.5;
  makeExplosion(player.x, player.y, "#41f6ff", 22);
  updateHUD();

  if (lives <= 0) endGame();
}

function update(dt) {
  // Scrolling starfield
  for (const star of stars) {
    star.y += star.speed * dt;
    if (star.y > H) {
      star.y = 0;
      star.x = rand(0, W);
    }
  }

  if (!running) {
    updateParticles(dt);
    return;
  }

  invincible = Math.max(0, invincible - dt);
  shotTimer = Math.max(0, shotTimer - dt);

  // Player movement
  let dx = 0;
  let dy = 0;

  if (keys.left) dx--;
  if (keys.right) dx++;
  if (keys.up) dy--;
  if (keys.down) dy++;

  if (dx && dy) {
    dx *= Math.SQRT1_2;
    dy *= Math.SQRT1_2;
  }

  player.x += dx * player.speed * dt;
  player.y += dy * player.speed * dt;

  player.x = Math.max(18, Math.min(W - 18, player.x));
  player.y = Math.max(22, Math.min(H - 25, player.y));

  if (keys.fire) shoot();

  // Player bullets
  for (const b of bullets) b.y -= b.speed * dt;
  bullets = bullets.filter(b => b.y > -20);

  // Spawn enemies
  enemyTimer += dt;
  const spawnDelay = Math.max(0.35, 1.05 - score / 3500);

  if (enemyTimer >= spawnDelay) {
    enemyTimer = 0;
    spawnEnemy();
  }

  // Enemy movement and enemy fire
  for (const e of enemies) {
    e.y += e.speed * dt;
    e.shootTimer -= dt;

    if (e.shootTimer <= 0 && e.y < H - 100) {
      enemyBullets.push({
        x: e.x,
        y: e.y + 15,
        w: 6,
        h: 12,
        speed: 175 + Math.min(score / 100, 80)
      });

      e.shootTimer = rand(2, 3.7);
    }

    if (e.y > H + 20) {
      e.remove = true;
      damagePlayer();
    }

    if (hit(player, e)) {
      e.remove = true;
      makeExplosion(e.x, e.y, e.color);
      damagePlayer();
    }
  }

  // Enemy bullets
  for (const b of enemyBullets) {
    b.y += b.speed * dt;

    if (hit(player, b)) {
      b.remove = true;
      damagePlayer();
    }
  }

  // Bullet versus enemy collisions
  for (const b of bullets) {
    if (b.remove) continue;

    for (const e of enemies) {
      if (e.remove || b.remove || !hit(b, e)) continue;

      b.remove = true;
      e.hp--;

      makeExplosion(b.x, b.y, "#ffe66d", 4);

      if (e.hp <= 0) {
        e.remove = true;
        score += e.maxHp === 3 ? 30 : 10;
        makeExplosion(e.x, e.y, e.color, 18);
        updateHUD();
      }
    }
  }

  enemies = enemies.filter(e => !e.remove);
  bullets = bullets.filter(b => !b.remove);
  enemyBullets = enemyBullets.filter(b => !b.remove && b.y < H + 20);

  updateParticles(dt);
}

function updateParticles(dt) {
  for (const p of particles) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt;
    p.vx *= Math.pow(0.1, dt);
    p.vy *= Math.pow(0.1, dt);
  }

  particles = particles.filter(p => p.life > 0);
}

function drawPlane(x, y, color, enemy = false, size = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size, size);
  if (enemy) ctx.rotate(Math.PI);

  // Pixel-art plane
  ctx.fillStyle = "#11172b";
  ctx.fillRect(-4, -15, 8, 29);
  ctx.fillRect(-15, -3, 30, 8);
  ctx.fillRect(-21, 3, 11, 5);
  ctx.fillRect(10, 3, 11, 5);
  ctx.fillRect(-10, 8, 20, 5);
  ctx.fillRect(-7, 11, 14, 7);

  ctx.fillStyle = color;
  ctx.fillRect(-3, -17, 6, 31);
  ctx.fillRect(-13, -4, 26, 6);
  ctx.fillRect(-19, 3, 10, 4);
  ctx.fillRect(9, 3, 10, 4);
  ctx.fillRect(-8, 7, 16, 4);
  ctx.fillRect(-9, 11, 18, 3);

  ctx.fillStyle = enemy ? "#ffe66d" : "#41f6ff";
  ctx.fillRect(-3, -8, 6, 7);
  ctx.fillRect(-4, 5, 8, 3);

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(-1, -14, 2, 4);

  ctx.restore();
}

function draw() {
  ctx.fillStyle = "#080d20";
  ctx.fillRect(0, 0, W, H);

  // Stars
  for (const star of stars) {
    ctx.fillStyle = star.size === 2 ? "#6573a7" : "#c4d5ff";
    ctx.fillRect(Math.round(star.x), Math.round(star.y), star.size, star.size);
  }

  // Subtle arcade scanlines
  ctx.fillStyle = "#ffffff08";
  for (let y = 0; y < H; y += 5) {
    ctx.fillRect(0, y, W, 1);
  }

  // Bullets
  for (const b of bullets) {
    ctx.fillStyle = "#ffe66d";
    ctx.fillRect(b.x - 2, b.y - 7, 4, 14);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(b.x - 1, b.y - 5, 2, 6);
  }

  for (const b of enemyBullets) {
    ctx.fillStyle = "#ff4d91";
    ctx.fillRect(b.x - 3, b.y - 6, 6, 12);
  }

  // Enemies and health bars
  for (const e of enemies) {
    drawPlane(e.x, e.y, e.color, true, e.w / 27);

    if (e.maxHp > 1) {
      ctx.fillStyle = "#252b49";
      ctx.fillRect(e.x - 17, e.y - 24, 34, 4);
      ctx.fillStyle = "#ffe66d";
      ctx.fillRect(e.x - 17, e.y - 24, 34 * e.hp / e.maxHp, 4);
    }
  }

  // Player
  if (invincible <= 0 || Math.floor(performance.now() / 100) % 2 === 0) {
    drawPlane(player.x, player.y, "#41f6ff");
  }

  // Explosions
  for (const p of particles) {
    ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x, p.y, p.size, p.size);
  }
  ctx.globalAlpha = 1;

  // Small in-game label
  ctx.fillStyle = "#7883a8";
  ctx.font = "9px monospace";
  ctx.fillText("SECTOR 01", 10, 18);
}

function loop(timestamp) {
  const dt = Math.min((timestamp - lastTime) / 1000 || 0, 0.033);
  lastTime = timestamp;

  update(dt);
  draw();

  requestAnimationFrame(loop);
}

// Keyboard controls
const keyMap = {
  ArrowLeft: "left",
  a: "left",
  ArrowRight: "right",
  d: "right",
  ArrowUp: "up",
  w: "up",
  ArrowDown: "down",
  s: "down",
  " ": "fire"
};

window.addEventListener("keydown", event => {
  const action = keyMap[event.key];
  if (!action) return;

  event.preventDefault();
  keys[action] = true;
});

window.addEventListener("keyup", event => {
  const action = keyMap[event.key];
  if (action) keys[action] = false;
});

window.addEventListener("blur", () => {
  keys = {};
});

// Mobile movement buttons
document.querySelectorAll(".control-btn").forEach(button => {
  const action = button.dataset.key;

  button.addEventListener("pointerdown", event => {
    event.preventDefault();
    keys[action] = true;
    button.classList.add("pressed");
    button.setPointerCapture(event.pointerId);
  });

  const release = () => {
    keys[action] = false;
    button.classList.remove("pressed");
  };

  button.addEventListener("pointerup", release);
  button.addEventListener("pointercancel", release);
  button.addEventListener("lostpointercapture", release);
});

// Mobile fire button
fireBtn.addEventListener("pointerdown", event => {
  event.preventDefault();
  keys.fire = true;
  fireBtn.classList.add("pressed");
  fireBtn.setPointerCapture(event.pointerId);
});

function releaseFire() {
  keys.fire = false;
  fireBtn.classList.remove("pressed");
}

fireBtn.addEventListener("pointerup", releaseFire);
fireBtn.addEventListener("pointercancel", releaseFire);
fireBtn.addEventListener("lostpointercapture", releaseFire);

startBtn.addEventListener("click", startGame);

// Initialize
initStars();
updateHUD();
requestAnimationFrame(loop);
