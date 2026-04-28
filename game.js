const canvas = document.getElementById("runner-canvas");
const ctx = canvas.getContext("2d");
const startButton = document.getElementById("start-game-btn");
const gameStage = document.getElementById("game-stage");
const gamePage = document.querySelector(".game-page");
const onlineCheckUrl = document.body?.dataset.onlineCheckUrl?.trim() || "";
const onlineRedirectUrl = document.body?.dataset.onlineRedirectUrl?.trim() || "";
const sprite = new Image();
sprite.src = "./static/images/404/62082.webp";

const BEST_KEY = "mkpascal-runner-best";
const state = {
  mode: "ready",
  score: 0,
  best: readBest(),
  time: 0,
  speed: 340,
  groundY: 0,
  skyHue: 0,
  player: {
    x: 110,
    y: 0,
    w: 86,
    h: 86,
    vy: 0,
    onGround: true,
  },
  obstacles: [],
  clouds: [],
  spawnTimer: 1.1,
  flash: 0,
  justStarted: false,
};

const keys = new Set();
let rafId = 0;
let lastFrame = performance.now();
let resizeQueued = false;
let onlineCheckTimer = 0;
let onlineCheckInFlight = false;
let redirectTriggered = false;

function readBest() {
  try {
    return Number(localStorage.getItem(BEST_KEY)) || 0;
  } catch {
    return 0;
  }
}

function saveBest() {
  try {
    localStorage.setItem(BEST_KEY, String(state.best));
  } catch {
    // Ignore storage failures on private mode or blocked storage.
  }
}

async function probeOnline() {
  if (!onlineCheckUrl || onlineCheckInFlight || redirectTriggered) return;
  onlineCheckInFlight = true;
  try {
    const response = await fetch(onlineCheckUrl, {
      cache: "no-store",
      mode: "no-cors",
      redirect: "follow",
    });
    if (response) {
      redirectTriggered = true;
      window.location.assign(onlineRedirectUrl || onlineCheckUrl);
    }
  } catch {
    // No-op: the site stays on the offline fallback until the probe succeeds.
  } finally {
    onlineCheckInFlight = false;
  }
}

function startOnlinePolling() {
  if (!onlineCheckUrl) return;
  probeOnline();
  onlineCheckTimer = window.setInterval(probeOnline, 60000);
}

function resetGame() {
  state.mode = "ready";
  state.score = 0;
  state.time = 0;
  state.speed = 340;
  state.player.y = 0;
  state.player.vy = 0;
  state.player.onGround = true;
  state.obstacles = [];
  state.clouds = [
    { x: 0.12, y: 0.22, s: 0.8, v: 0.015 },
    { x: 0.48, y: 0.18, s: 0.6, v: 0.010 },
    { x: 0.82, y: 0.26, s: 0.7, v: 0.012 },
  ];
  state.spawnTimer = 1.1;
  state.flash = 0;
  state.justStarted = false;
  if (gamePage) {
    gamePage.classList.remove("game-page--open");
  }
  layout();
  render();
}

function layout() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(320, Math.floor(rect.width));
  const height = Math.max(240, Math.floor(rect.height));

  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  state.groundY = height - 86;
  state.player.y = state.groundY - state.player.h;
}

function queueLayout() {
  if (resizeQueued) return;
  resizeQueued = true;
  requestAnimationFrame(() => {
    resizeQueued = false;
    layout();
    render();
  });
}

function startRun() {
  if (state.mode === "ready" || state.mode === "gameover") {
    state.mode = "running";
    state.justStarted = true;
    state.flash = 0.2;
    state.score = 0;
    state.speed = 340;
    state.spawnTimer = 0.95;
    state.obstacles = [];
    state.player.vy = -660;
    state.player.onGround = false;
  }
}

function startGameFromButton() {
  if (state.mode === "gameover") {
    resetGame();
  }
  if (gamePage) {
    gamePage.classList.add("game-page--open");
  }
  startRun();
  if (gameStage) {
    gameStage.scrollIntoView({ behavior: "smooth", block: "center" });
  }
  requestAnimationFrame(() => {
    layout();
    render();
  });
}

function jump() {
  if (state.mode === "ready") {
    startRun();
    return;
  }

  if (state.mode === "running" && state.player.onGround) {
    state.player.vy = -660;
    state.player.onGround = false;
  }

  if (state.mode === "gameover") {
    resetGame();
    startRun();
  }
}

function spawnObstacle() {
  const roll = Math.random();
  const base = canvas.clientWidth || 960;
  let w = 18;
  let h = 36;
  let kind = "block";

  if (roll > 0.75) {
    w = 24;
    h = 56;
    kind = "tall";
  } else if (roll > 0.4) {
    w = 30;
    h = 44;
    kind = "mid";
  } else {
    w = 16;
    h = 30;
    kind = "small";
  }

  state.obstacles.push({
    x: base + 40,
    y: state.groundY - h,
    w,
    h,
    kind,
  });
}

function tick(dt) {
  state.time += dt;

  if (state.mode !== "running") {
    state.flash = Math.max(0, state.flash - dt);
    return;
  }

  state.speed = Math.min(660, state.speed + dt * 8);
  state.score += dt * 10;
  state.flash = Math.max(0, state.flash - dt);

  state.player.vy += 1900 * dt;
  state.player.y += state.player.vy * dt;

  const floor = state.groundY - state.player.h;
  if (state.player.y >= floor) {
    state.player.y = floor;
    state.player.vy = 0;
    state.player.onGround = true;
  }

  state.spawnTimer -= dt;
  const spawnBias = Math.max(0.45, 1.15 - state.score * 0.003);
  if (state.spawnTimer <= 0) {
    spawnObstacle();
    state.spawnTimer = spawnBias + Math.random() * 0.7;
  }

  for (const obstacle of state.obstacles) {
    obstacle.x -= state.speed * dt;
  }

  state.obstacles = state.obstacles.filter((obstacle) => obstacle.x + obstacle.w > -40);

  const playerBox = {
    x: state.player.x + 12,
    y: state.player.y + 8,
    w: state.player.w - 18,
    h: state.player.h - 12,
  };

  for (const obstacle of state.obstacles) {
    if (
      playerBox.x < obstacle.x + obstacle.w &&
      playerBox.x + playerBox.w > obstacle.x &&
      playerBox.y < obstacle.y + obstacle.h &&
      playerBox.y + playerBox.h > obstacle.y
    ) {
      state.mode = "gameover";
      state.best = Math.max(state.best, Math.floor(state.score));
      saveBest();
      state.flash = 0.35;
      return;
    }
  }

  for (const cloud of state.clouds) {
    cloud.x -= cloud.v * dt;
    if (cloud.x < -0.2) cloud.x = 1.15;
  }
}

function drawBackground(width, height) {
  ctx.fillStyle = "#0b0b0b";
  ctx.fillRect(0, 0, width, height);

  const grad = ctx.createLinearGradient(0, 0, 0, height);
  grad.addColorStop(0, "rgba(255,255,255,0.03)");
  grad.addColorStop(0.3, "rgba(255,255,255,0.01)");
  grad.addColorStop(1, "rgba(255,255,255,0.00)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = "rgba(255,255,255,0.09)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, state.groundY + 0.5);
  ctx.lineTo(width, state.groundY + 0.5);
  ctx.stroke();

  ctx.strokeStyle = "rgba(255,255,255,0.03)";
  ctx.beginPath();
  for (let i = 0; i < width; i += 18) {
    ctx.moveTo(i, state.groundY + 12);
    ctx.lineTo(i + 8, state.groundY + 12);
  }
  ctx.stroke();

  ctx.fillStyle = "rgba(255,255,255,0.04)";
  for (const cloud of state.clouds) {
    const x = cloud.x * width;
    const y = cloud.y * height;
    ctx.beginPath();
    ctx.arc(x, y, 18 * cloud.s, 0, Math.PI * 2);
    ctx.arc(x + 18 * cloud.s, y - 5 * cloud.s, 24 * cloud.s, 0, Math.PI * 2);
    ctx.arc(x + 42 * cloud.s, y, 18 * cloud.s, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = "rgba(255,255,255,0.04)";
  ctx.beginPath();
  ctx.arc(width * 0.52, height * 0.22, Math.min(width, height) * 0.13, Math.PI, 0);
  ctx.fill();
}

function drawPlayer() {
  const p = state.player;
  if (sprite.complete && sprite.naturalWidth > 0) {
    ctx.save();
    if (state.mode === "gameover") {
      ctx.globalAlpha = 0.85;
      ctx.rotate(-0.03);
    }
    const sway = state.mode === "running" ? Math.sin(state.time * 8) * 1.5 : 0;
    ctx.drawImage(sprite, p.x, p.y + sway, p.w, p.h);
    ctx.restore();
  } else {
    ctx.fillStyle = "rgba(255,255,255,0.88)";
    ctx.fillRect(p.x, p.y, p.w, p.h);
  }
}

function drawObstacles() {
  ctx.fillStyle = "rgba(255,255,255,0.82)";
  for (const obstacle of state.obstacles) {
    ctx.fillRect(obstacle.x, obstacle.y, obstacle.w, obstacle.h);
    ctx.fillRect(obstacle.x - 4, obstacle.y + obstacle.h - 12, obstacle.w + 8, 4);
  }
}

function drawHud(width) {
  ctx.fillStyle = "rgba(255,255,255,0.88)";
  ctx.font = "600 16px Inter, sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText(`Score ${Math.floor(state.score)}`, 18, 18);
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.fillText(`Best ${state.best}`, 18, 40);

  ctx.textAlign = "right";
  ctx.fillStyle = "rgba(255,255,255,0.72)";
  ctx.fillText("Space / Tap", width - 18, 18);
  ctx.fillText("F Vollbild", width - 18, 40);

  if (state.mode === "ready") {
    overlayMessage("Drücke Leertaste oder tippe zum Starten");
  } else if (state.mode === "gameover") {
    overlayMessage("Game Over - tippe oder drücke Leertaste zum Neustart");
  }
}

function overlayMessage(text) {
  const width = canvas.clientWidth || 0;
  ctx.save();
  ctx.fillStyle = "rgba(11, 11, 11, 0.6)";
  ctx.fillRect(0, state.groundY - 160, width, 84);
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "600 18px Inter, sans-serif";
  ctx.fillText(text, width / 2, state.groundY - 118);
  ctx.restore();
}

function render() {
  const width = canvas.clientWidth || 0;
  const height = canvas.clientHeight || 0;
  if (!width || !height) return;

  drawBackground(width, height);
  drawObstacles();
  drawPlayer();
  drawHud(width);

  if (state.flash > 0) {
    ctx.save();
    ctx.fillStyle = `rgba(255,255,255,${state.flash * 0.18})`;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  }
}

function loop(now) {
  const dt = Math.min(0.033, (now - lastFrame) / 1000);
  lastFrame = now;
  tick(dt);
  render();
  rafId = requestAnimationFrame(loop);
}

function fullScreenToggle() {
  const host = document.documentElement;
  if (document.fullscreenElement) {
    document.exitFullscreen().catch(() => {});
  } else if (host.requestFullscreen) {
    host.requestFullscreen().catch(() => {});
  }
}

function renderGameToText() {
  return JSON.stringify({
    coord: "origin top-left; x→right, y→down",
    mode: state.mode,
    score: Math.floor(state.score),
    best: state.best,
    speed: Math.round(state.speed),
    player: {
      x: Math.round(state.player.x),
      y: Math.round(state.player.y),
      vy: Math.round(state.player.vy),
      w: state.player.w,
      h: state.player.h,
      onGround: state.player.onGround,
    },
    obstacles: state.obstacles.map((obstacle) => ({
      x: Math.round(obstacle.x),
      y: Math.round(obstacle.y),
      w: obstacle.w,
      h: obstacle.h,
      kind: obstacle.kind,
    })),
  });
}

window.render_game_to_text = renderGameToText;
window.advanceTime = (ms) => {
  const steps = Math.max(1, Math.round(ms / (1000 / 60)));
  const step = ms / steps / 1000;
  for (let i = 0; i < steps; i += 1) {
    tick(step);
  }
  render();
  lastFrame = performance.now();
};
window.resetGame = resetGame;

window.addEventListener("keydown", (event) => {
  keys.add(event.code);
  if (event.code === "Space" || event.code === "ArrowUp" || event.code === "KeyW") {
    event.preventDefault();
    jump();
  }
  if (event.code === "KeyF") {
    event.preventDefault();
    fullScreenToggle();
  }
  if (event.code === "KeyR") {
    event.preventDefault();
    resetGame();
  }
});

window.addEventListener("keyup", (event) => {
  keys.delete(event.code);
});

window.addEventListener("resize", queueLayout);
window.addEventListener("orientationchange", queueLayout);
canvas.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  jump();
});

sprite.addEventListener("load", render);
if (startButton) {
  startButton.addEventListener("click", startGameFromButton);
}

resetGame();
function startLoop() {
  layout();
  render();
  lastFrame = performance.now();
  rafId = requestAnimationFrame(loop);
}

if (document.readyState === "complete") {
  startLoop();
} else {
  window.addEventListener("load", startLoop, { once: true });
}

startOnlinePolling();
