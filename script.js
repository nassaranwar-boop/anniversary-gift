
/* =========================================================
   ✏️  CUSTOMIZE ME
   ========================================================= */
const CONFIG = {
  babyName: "My Baby!",
  reward: "A sweet kiss 😘",
  mazeSize: 8,
  heartCount: 6,
  sender: { name: "Anwar 💗" },
  messages: [
    "Muaaahhh! I love youuuu soooooooo muchhhhhhh!!!!! 💕",
    "Thank you for finding your way to me. 🥹",
    "You're my favorite person in this whole world. 🌙✨",
  ],
  messagesFinal: [
    "You made it through everything... for me. 🥹",
    "Every monster, every close call — you still found me. 💗",
    "That's exactly how I feel loving you: worth every obstacle. 🌙💕",
  ],
};

/* =========================================================
   ✏️  ANCIENT BOOK — CUSTOMIZE ME
   ========================================================= */
const GATE_CODE = "2207";

// Your letter. Replace this placeholder with your own words —
// it will reveal itself gently, word by word.
const LETTER_TEXT = "[This is where your letter to her will appear. Write whatever you want her to read first — it will reveal itself gently, word by word, just like this placeholder is doing right now. Replace this whole paragraph with your own words when you're ready, then sign it below.]";

// Add one object per memory. photo/video are optional — leave null
// to show the icon instead until you add real files to /assets.
const MEMORIES = [
  {
    id: 1,
    title: "[Memory title here]",
    date: "[date]",
    icon: "📷",
    photo: null, // e.g. "assets/memory-1.jpg"
    text: "[This is where your words about this memory will appear — replace this placeholder with what you want to say about it.]",
  },
];
/* ========================================================= */

const ASSETS = {
  catGif:"assets/cat-hello.gif", bearGif:"assets/bear-hug.gif", girl:"assets/girl.png", guy:"assets/guy.png",
  moon:"assets/moon2.png", cloud:"assets/cloud1.png",
  blackBody:"assets/black_body.png", blackTail:"assets/black_tail.png",
  whiteBody:"assets/white_body.png", whiteTail:"assets/white_tail.png",
  monster:"assets/monster.png", shooter:"assets/shooter.png", tree:"assets/tree.png", med:"assets/med.png",
  heartFull:"assets/heart_full.png", heartHalf:"assets/heart_half.png", heartEmpty:"assets/heart_empty.png",
  key:"assets/key.png",
};
const PLAYER_ASPECT = 395/220;

document.getElementById("baby-name").textContent = CONFIG.babyName;
document.getElementById("reward-text").textContent = CONFIG.reward;
document.getElementById("target-token").src = ASSETS.guy;
document.getElementById("player-token").src = ASSETS.girl;
document.getElementById("dialogue-avatar-img").src = ASSETS.guy;
document.getElementById("px-moon").src = ASSETS.moon;
["cl-a","cl-b","cl-c"].forEach(id => document.getElementById(id).src = ASSETS.cloud);
document.getElementById("cat-black-body").src = ASSETS.blackBody;
document.getElementById("cat-black-tail").src = ASSETS.blackTail;
document.getElementById("cat-white-body").src = ASSETS.whiteBody;
document.getElementById("cat-white-tail").src = ASSETS.whiteTail;
document.getElementById("key-badge-img").src = ASSETS.key;

/* ---------- best time (localStorage) ---------- */
try {
  const best = localStorage.getItem("fal_best_time");
  if (best) document.getElementById("best-time-line").textContent = "🏆 Best time: " + best;
} catch (e) {}

/* ---------- screen manager ---------- */
function showScreen(name) {
  document.querySelectorAll(".screen").forEach((s) => { s.classList.remove("active","anim-in","page-turning","opening","zoom-out","zoom-in-enter"); });
  const el = document.getElementById("screen-" + name);
  el.classList.add("active");
  void el.offsetWidth;
  el.classList.add("anim-in");
}
/* premium dissolve transition used for all screen navigation */
function pageTurn(name, callback) {
  const current = document.querySelector(".screen.active");
  if (!current) { showScreen(name); if (callback) callback(); return; }
  current.classList.add("page-turning");
  setTimeout(() => { showScreen(name); if (callback) callback(); }, 420);
}
function openCover(name) { pageTurn(name); }

/* ---------- ambient particles ---------- */
function startParticles(containerId, opts) {
  const el = document.getElementById(containerId);
  if (!el || el.dataset.running) return;
  el.dataset.running = "1";
  const { emojis, max = 10, interval = 700 } = opts;
  let alive = 0;
  setInterval(() => {
    if (el.offsetParent === null) return;
    if (alive >= max) return;
    const span = document.createElement("span");
    span.className = "particle";
    span.textContent = emojis[Math.floor(Math.random() * emojis.length)];
    span.style.left = Math.random() * 100 + "%";
    span.style.fontSize = (12 + Math.random() * 12) + "px";
    span.style.animationDuration = (6 + Math.random() * 5) + "s";
    alive++;
    span.addEventListener("animationend", () => { span.remove(); alive--; });
    el.appendChild(span);
  }, interval);
}
startParticles("pf-hello", { emojis:["💗","💕","✨"], max:9, interval:750 });
startParticles("pf-details", { emojis:["💗","💫"], max:6, interval:900 });
startParticles("pf-l2intro", { emojis:["💗","✨","😤"], max:5, interval:1000 });

/* ---------- maze ambient stars ---------- */
(function scatterMazeStars(){
  const field = document.getElementById("maze-stars");
  for (let i=0;i<40;i++){
    const s = document.createElement("span");
    s.style.left = Math.random()*100+"%"; s.style.top = Math.random()*100+"%";
    s.style.animationDelay = (Math.random()*3)+"s";
    field.appendChild(s);
  }
})();

/* ---------- toast ---------- */
function showToast(text) {
  const wrap = document.getElementById("toast-wrap");
  const t = document.createElement("div");
  t.className = "toast";
  t.textContent = text;
  wrap.appendChild(t);
  t.addEventListener("animationend", () => t.remove());
}

/* ---------- Screen 1: the "No" button runs away ---------- */
const btnNo = document.getElementById("btn-no");
let dodgeActive = false;
function dodge() {
  if (!dodgeActive) {
    const rect = btnNo.getBoundingClientRect();
    btnNo.style.position = "fixed";
    btnNo.style.margin = "0";
    btnNo.style.left = rect.left + "px";
    btnNo.style.top = rect.top + "px";
    dodgeActive = true;
    void btnNo.offsetWidth;
  }
  requestAnimationFrame(() => {
    const margin = 60;
    const x = margin + Math.random() * (window.innerWidth - margin*2 - 160);
    const y = margin + Math.random() * (window.innerHeight - margin*2 - 40);
    btnNo.style.left = x + "px";
    btnNo.style.top = y + "px";
  });
}
btnNo.addEventListener("mouseenter", dodge);
btnNo.addEventListener("touchstart", (e) => { e.preventDefault(); dodge(); }, { passive:false });

document.getElementById("btn-yes").addEventListener("click", () => openCover("details"));
document.getElementById("btn-start").addEventListener("click", () => { pageTurn("maze", () => initMaze(1)); });
document.getElementById("btn-start2").addEventListener("click", () => { pageTurn("maze", () => initMaze(2)); });

document.getElementById("btn-replay").addEventListener("click", () => {
  level = 1; pageTurn("hello");
});

/* =========================================================
   MAZE CORE (shared grid/fog/movement for both levels)
   ========================================================= */
let level = 1;
let mazeData, playerPos, targetPos, gridSize, dim, CS;
let stepCount = 0, heartsTotal = 0, heartsCollected = 0;
let timerInterval = null, elapsedSec = 0;
let lastFacing = "right";
let heartCells = [];
let gameWon = false;
let isHidden = false;

function generateMaze(size) {
  const H = size, W = size;
  const maze = Array.from({ length: 2*H+1 }, () => Array(2*W+1).fill(0));
  const visited = Array.from({ length: H }, () => Array(W).fill(false));
  function shuffle(arr){ for(let i=arr.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [arr[i],arr[j]]=[arr[j],arr[i]]; } return arr; }
  function carve(r,c){
    visited[r][c]=true; maze[2*r+1][2*c+1]=1;
    const dirs = shuffle([[0,1],[0,-1],[1,0],[-1,0]]);
    for (const [dr,dc] of dirs){
      const nr=r+dr, nc=c+dc;
      if (nr>=0 && nr<H && nc>=0 && nc<W && !visited[nr][nc]){
        maze[2*r+1+dr][2*c+1+dc]=1;
        carve(nr,nc);
      }
    }
  }
  carve(0,0);
  return maze;
}

function cellOpen(r,c){ return mazeData[r] && mazeData[r][c] === 1; }
function canStep(r,c,dr,dc){ return cellOpen(r+dr, c+dc) && cellOpen(r+2*dr, c+2*dc); }
function shuffleArr(arr){ for(let i=arr.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [arr[i],arr[j]]=[arr[j],arr[i]]; } return arr; }

function initMaze(lvl) {
  level = lvl;
  gridSize = lvl === 2 ? 8 : CONFIG.mazeSize;
  dim = gridSize*2+1;
  mazeData = generateMaze(gridSize);
  playerPos = { r:1, c:1 };
  targetPos = { r: dim-2, c: dim-2 };
  stepCount = 0; elapsedSec = 0; gameWon = false; lastFacing = "right"; isHidden = false;

  document.getElementById("hud-bar").classList.toggle("lvl2", lvl===2);
  document.querySelector(".hud-hearts-l1").style.display = lvl===2 ? "none" : "flex";
  document.querySelector(".hud-hearts-l2").style.display = lvl===2 ? "flex" : "none";
  document.getElementById("hidden-badge").classList.remove("show");
  document.getElementById("key-badge").classList.remove("show");
  document.getElementById("player-token").classList.remove("hidden-state");
  document.getElementById("hearts-layer").innerHTML = "";
  document.getElementById("target-token").classList.remove("locked");
  document.getElementById("beacon-glow").classList.remove("locked");

  buildStaticGrid();

  const pathCells = [];
  for (let r=1;r<dim;r+=2) for (let c=1;c<dim;c+=2) {
    if ((r===1&&c===1) || (r===targetPos.r&&c===targetPos.c)) continue;
    pathCells.push({r,c});
  }
  shuffleArr(pathCells);

  if (lvl === 1) {
    heartsCollected = 0;
    heartCells = pathCells.slice(0, Math.min(CONFIG.heartCount, pathCells.length));
    heartsTotal = heartCells.length;
    buildHearts();
    updateHud();
    stopLevel2Systems();
  } else {
    setupLevel2(pathCells);
  }

  layoutMaze();

  if (timerInterval) clearInterval(timerInterval);
  timerInterval = setInterval(() => { if (!gameWon) { elapsedSec++; updateHud(); } }, 1000);
}

function buildStaticGrid() {
  const grid = document.getElementById("maze-grid");
  grid.innerHTML = "";
  grid.style.gridTemplateColumns = `repeat(${dim}, 1fr)`;
  grid.style.gridTemplateRows = `repeat(${dim}, 1fr)`;
  for (let r=0;r<dim;r++) for (let c=0;c<dim;c++) {
    const cell = document.createElement("div");
    cell.className = "cell " + (mazeData[r][c] ? "path" : "wall");
    grid.appendChild(cell);
  }
}

function buildHearts() {
  const layer = document.getElementById("hearts-layer");
  layer.innerHTML = "";
  heartCells.forEach((hc) => {
    const el = document.createElement("div");
    el.className = "heart-collect";
    el.textContent = "💗";
    el.dataset.r = hc.r; el.dataset.c = hc.c;
    layer.appendChild(el);
  });
}

function layoutMaze() {
  const stage = document.getElementById("maze-stage");
  const rect = stage.getBoundingClientRect();
  CS = rect.width / dim;

  document.querySelectorAll(".heart-collect").forEach((el) => {
    const r = +el.dataset.r, c = +el.dataset.c;
    const size = CS*0.62;
    el.style.width = size+"px"; el.style.height = size+"px"; el.style.fontSize = (size*0.8)+"px";
    el.style.left = (c*CS + CS/2 - size/2) + "px";
    el.style.top = (r*CS + CS/2 - size/2) + "px";
  });

  if (level === 2) layoutLevel2Entities();

  placeToken(document.getElementById("player-token"), playerPos, false);
  placeToken(document.getElementById("target-token"), targetPos, true);
  positionBeacon();
  updateFog();
}

function placeToken(el, pos, isTarget) {
  const w = CS * (isTarget ? 1.9 : 1.85);
  const h = w * PLAYER_ASPECT;
  el.style.width = w+"px";
  el.style.left = (pos.c*CS + CS/2 - w/2) + "px";
  el.style.top = (pos.r*CS + CS - h*0.94) + "px";
}

function positionBeacon() {
  const beacon = document.getElementById("beacon-glow");
  const size = CS*2.4;
  beacon.style.width = size+"px"; beacon.style.height = size+"px";
  beacon.style.left = (targetPos.c*CS + CS/2 - size/2) + "px";
  beacon.style.top = (targetPos.r*CS + CS/2 - size/2) + "px";
}

/* Soft, warm, multi-stop torch light instead of a hard circle. Constant
   radius - fair and consistent, not an escalating timer squeeze. */
function updateFog() {
  const fog = document.getElementById("fog-layer");
  const cx = playerPos.c*CS + CS/2, cy = playerPos.r*CS + CS/2;
  const r1 = CS*1.05, r2 = CS*1.95, r3 = CS*2.95, r4 = CS*4.2;
  fog.style.background = `radial-gradient(circle at ${cx}px ${cy}px,
    rgba(255,241,209,.22) 0px,
    rgba(255,225,180,.1) ${r1}px,
    rgba(70,30,90,.42) ${r2}px,
    rgba(35,14,55,.78) ${r3}px,
    rgba(16,7,28,.96) ${r4}px)`;
}

function updateHud() {
  document.getElementById("hud-hearts").textContent = `${heartsCollected}/${heartsTotal}`;
  document.getElementById("hud-steps").textContent = stepCount;
  const m = String(Math.floor(elapsedSec/60)).padStart(2,"0");
  const s = String(elapsedSec%60).padStart(2,"0");
  document.getElementById("hud-time").textContent = `${m}:${s}`;
}

function move(dir) {
  if (gameWon) return;
  if (!document.getElementById("dialogue-overlay").classList.contains("hidden")) return;
  const deltas = { up:[-2,0], down:[2,0], left:[0,-2], right:[0,2] };
  const midDeltas = { up:[-1,0], down:[1,0], left:[0,-1], right:[0,1] };
  const [dr,dc] = deltas[dir];
  const [mdr,mdc] = midDeltas[dir];
  const midR = playerPos.r+mdr, midC = playerPos.c+mdc;
  if (dir==="left") lastFacing="left";
  if (dir==="right") lastFacing="right";
  if (mazeData[midR] && mazeData[midR][midC] === 1) {
    playerPos = { r: playerPos.r+dr, c: playerPos.c+dc };
    stepCount++;
    const tok = document.getElementById("player-token");
    tok.classList.toggle("face-left", lastFacing==="left");
    placeToken(tok, playerPos, false);
    updateFog();
    updateHud();
    if (level === 1) { checkHeart(); }
    else { onPlayerMovedLevel2(); }
    checkWin();
  }
}

function checkHeart() {
  const el = document.querySelector(`.heart-collect[data-r="${playerPos.r}"][data-c="${playerPos.c}"]`);
  if (el) {
    heartsCollected++;
    popText(el.style.left, el.style.top, "+1 💗", "#ff5b98");
    el.remove();
    updateHud();
  }
}

function popText(left, top, text, color) {
  const pop = document.createElement("div");
  pop.className = "heart-pop";
  pop.textContent = text;
  pop.style.left = left; pop.style.top = top; pop.style.color = color || "#ff5b98";
  document.getElementById("hearts-layer").appendChild(pop);
  pop.addEventListener("animationend", () => pop.remove());
}

function checkWin() {
  if (playerPos.r === targetPos.r && playerPos.c === targetPos.c) {
    if (level === 2 && !hasKey) {
      showToast("Find the key first! 🔑");
      const stage = document.getElementById("maze-stage");
      stage.classList.remove("locked-shake"); void stage.offsetWidth; stage.classList.add("locked-shake");
      return;
    }
    gameWon = true;
    stopLevel2Systems();
    if (level === 1) saveBestTime();
    startDialogue();
  }
}

function saveBestTime() {
  try {
    const key = "fal_best_time";
    const m = String(Math.floor(elapsedSec/60)).padStart(2,"0");
    const s = String(elapsedSec%60).padStart(2,"0");
    const cur = `${m}:${s}`;
    const prev = localStorage.getItem(key);
    if (!prev || elapsedSec < (parseInt(prev.split(":")[0])*60 + parseInt(prev.split(":")[1]))) {
      localStorage.setItem(key, cur);
    }
  } catch (e) {}
}

/* ---------- controls ---------- */
document.addEventListener("keydown", (e) => {
  if (!document.getElementById("screen-maze").classList.contains("active")) return;
  const map = { ArrowUp:"up", ArrowDown:"down", ArrowLeft:"left", ArrowRight:"right", w:"up", s:"down", a:"left", d:"right" };
  if (map[e.key]) { e.preventDefault(); move(map[e.key]); }
});
document.querySelectorAll(".dpad3-btn").forEach((btn) => btn.addEventListener("click", () => move(btn.dataset.dir)));

const mazeStageEl = document.getElementById("maze-stage");
let touchStartX=0, touchStartY=0;
mazeStageEl.addEventListener("touchstart", (e) => { touchStartX=e.touches[0].clientX; touchStartY=e.touches[0].clientY; }, { passive:true });
mazeStageEl.addEventListener("touchend", (e) => {
  const dx = e.changedTouches[0].clientX-touchStartX, dy = e.changedTouches[0].clientY-touchStartY;
  if (Math.abs(dx)<20 && Math.abs(dy)<20) return;
  if (Math.abs(dx)>Math.abs(dy)) move(dx>0?"right":"left"); else move(dy>0?"down":"up");
}, { passive:true });

let resizeTimer;
window.addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => { if (dim) layoutMaze(); }, 120);
});

/* =========================================================
   LEVEL 2 — monsters, shooters, trees, meds, key, hearts
   ========================================================= */
const HP_START = 6, HP_MAX = 10;
let hp = HP_START;
let treeSet = new Set();
let monsters = [], shooters = [], meds = [];
let hasKey = false, keyPos = null;
let level2Tick = null;
let invulnUntil = 0;

function setupLevel2(pathCells) {
  hp = HP_START;
  treeSet = new Set();
  monsters = []; shooters = []; meds = [];
  hasKey = false; keyPos = null;
  isHidden = false;

  let idx = 0;
  const take = (n) => { const out = pathCells.slice(idx, idx+n); idx += n; return out; };

  take(8).forEach(p => treeSet.add(p.r+","+p.c));
  const monsterCells = take(2);
  const shooterCells = take(2);
  const medCells = take(5);
  const keyCells = take(1);

  monsters = monsterCells.map(p => ({ r:p.r, c:p.c, homeR:p.r, homeC:p.c }));
  shooters = shooterCells.map(p => ({ r:p.r, c:p.c, alertUntil:0, alerting:false }));
  meds = medCells.map(p => ({ r:p.r, c:p.c, taken:false }));
  keyPos = keyCells[0] || null;

  document.getElementById("target-token").classList.add("locked");
  document.getElementById("beacon-glow").classList.add("locked");

  buildLevel2Layers();
  renderHeartsHud();

  if (level2Tick) clearInterval(level2Tick);
  level2Tick = setInterval(level2TickFn, 800);
}

function stopLevel2Systems() {
  if (level2Tick) { clearInterval(level2Tick); level2Tick = null; }
}

function buildLevel2Layers() {
  const treesLayer = document.getElementById("trees-layer");
  treesLayer.innerHTML = "";
  treeSet.forEach((key) => {
    const [r,c] = key.split(",").map(Number);
    const img = document.createElement("img");
    img.src = ASSETS.tree; img.className = "entity tree-entity"; img.dataset.r=r; img.dataset.c=c;
    treesLayer.appendChild(img);
  });

  const medsLayer = document.getElementById("meds-layer");
  medsLayer.innerHTML = "";
  meds.forEach((m,i) => {
    const img = document.createElement("img");
    img.src = ASSETS.med; img.className = "entity med"; img.dataset.i = i;
    medsLayer.appendChild(img);
  });

  const keyLayer = document.getElementById("key-layer");
  keyLayer.innerHTML = "";
  if (keyPos) {
    const img = document.createElement("img");
    img.src = ASSETS.key; img.className = "entity key-entity"; img.id = "the-key";
    keyLayer.appendChild(img);
  }

  const monstersLayer = document.getElementById("monsters-layer");
  monstersLayer.innerHTML = "";
  monsters.forEach((m,i) => {
    const img = document.createElement("img");
    img.src = ASSETS.monster; img.className = "entity monster-entity"; img.dataset.i = i;
    monstersLayer.appendChild(img);
  });

  const shootersLayer = document.getElementById("shooters-layer");
  shootersLayer.innerHTML = "";
  shooters.forEach((s,i) => {
    const img = document.createElement("img");
    img.src = ASSETS.shooter; img.className = "entity shooter-entity"; img.dataset.i = i;
    shootersLayer.appendChild(img);
    const alert = document.createElement("div");
    alert.className = "shooter-alert"; alert.textContent = "❗"; alert.dataset.i = i;
    shootersLayer.appendChild(alert);
  });
}

function layoutLevel2Entities() {
  document.querySelectorAll(".tree-entity").forEach((el) => {
    const r = +el.dataset.r, c = +el.dataset.c;
    const size = CS*0.95;
    el.style.width = size+"px";
    el.style.left = (c*CS + CS/2 - size/2) + "px";
    el.style.top = (r*CS + CS - size*0.92) + "px";
  });
  document.querySelectorAll(".med").forEach((el) => {
    const i = +el.dataset.i, m = meds[i];
    if (!m || m.taken) { el.style.display="none"; return; }
    el.style.display="";
    const size = CS*0.6;
    el.style.width = size+"px";
    el.style.left = (m.c*CS + CS/2 - size/2) + "px";
    el.style.top = (m.r*CS + CS/2 - size/2) + "px";
  });
  const keyEl = document.getElementById("the-key");
  if (keyEl) {
    if (hasKey || !keyPos) { keyEl.style.display = "none"; }
    else {
      keyEl.style.display = "";
      const size = CS*0.72;
      keyEl.style.width = size+"px";
      keyEl.style.left = (keyPos.c*CS + CS/2 - size/2) + "px";
      keyEl.style.top = (keyPos.r*CS + CS/2 - size/2) + "px";
    }
  }
  document.querySelectorAll(".monster-entity").forEach((el) => {
    const i = +el.dataset.i, m = monsters[i];
    const size = CS*1.15;
    el.style.width = size+"px";
    el.style.left = (m.c*CS + CS/2 - size/2) + "px";
    el.style.top = (m.r*CS + CS - size*0.85) + "px";
  });
  document.querySelectorAll(".shooter-entity").forEach((el) => {
    const i = +el.dataset.i, s = shooters[i];
    const size = CS*1.0;
    el.style.width = size+"px";
    el.style.left = (s.c*CS + CS/2 - size/2) + "px";
    el.style.top = (s.r*CS + CS - size*0.95) + "px";
  });
  document.querySelectorAll(".shooter-alert").forEach((el) => {
    const i = +el.dataset.i, s = shooters[i];
    el.style.left = (s.c*CS + CS/2 - 7) + "px";
    el.style.top = (s.r*CS - CS*0.35) + "px";
  });
}

function renderHeartsHud() {
  const wrap = document.getElementById("hp-pips");
  wrap.innerHTML = "";
  for (let i=0;i<5;i++) {
    const threshold = hp - i*2;
    const img = document.createElement("img");
    img.src = threshold >= 2 ? ASSETS.heartFull : threshold === 1 ? ASSETS.heartHalf : ASSETS.heartEmpty;
    wrap.appendChild(img);
  }
}

function onPlayerMovedLevel2() {
  isHidden = treeSet.has(playerPos.r+","+playerPos.c);
  document.getElementById("hidden-badge").classList.toggle("show", isHidden);
  document.getElementById("player-token").classList.toggle("hidden-state", isHidden);

  const med = meds.find(m => !m.taken && m.r===playerPos.r && m.c===playerPos.c);
  if (med) {
    med.taken = true;
    hp = Math.min(HP_MAX, hp+1);
    renderHeartsHud();
    layoutLevel2Entities();
    showToast("Found a med! +½ 💗");
  }

  if (keyPos && !hasKey && playerPos.r===keyPos.r && playerPos.c===keyPos.c) {
    hasKey = true;
    layoutLevel2Entities();
    document.getElementById("key-badge").classList.add("show");
    document.getElementById("target-token").classList.remove("locked");
    document.getElementById("beacon-glow").classList.remove("locked");
    showToast("Got the key! 🔑💗");
  }

  checkMonsterContact();
}

function checkMonsterContact() {
  if (isHidden) return;
  if (Date.now() < invulnUntil) return;
  const hit = monsters.some(m => m.r===playerPos.r && m.c===playerPos.c);
  if (hit) applyDamage("A monster got you! 😱");
}

function applyDamage(msg) {
  hp = Math.max(0, hp-2);
  invulnUntil = Date.now() + 1800;
  renderHeartsHud();
  if (hp > 0) showToast(msg);
  const flash = document.getElementById("damage-flash");
  flash.classList.remove("hit"); void flash.offsetWidth; flash.classList.add("hit");
  const stage = document.getElementById("maze-stage");
  stage.classList.remove("shake"); void stage.offsetWidth; stage.classList.add("shake");
  if (hp <= 0) respawnLevel2();
}

function respawnLevel2() {
  showToast("Sneaky sneaky... try again 😅💕");
  playerPos = { r:1, c:1 };
  hp = HP_START;
  renderHeartsHud();
  monsters.forEach(m => { m.r = m.homeR; m.c = m.homeC; });
  layoutLevel2Entities();
  placeToken(document.getElementById("player-token"), playerPos, false);
  updateFog();
  isHidden = false;
  document.getElementById("hidden-badge").classList.remove("show");
  document.getElementById("player-token").classList.remove("hidden-state");
}

function level2TickFn() {
  if (level !== 2 || gameWon) return;
  moveMonsters();
  checkShooters();
  checkMonsterContact();
}

function moveMonsters() {
  const dirs = [[-1,0],[1,0],[0,-1],[0,1]];
  monsters.forEach((m) => {
    const distToPlayer = Math.abs(m.r-playerPos.r) + Math.abs(m.c-playerPos.c);
    let candidates = [];
    if (distToPlayer <= 5 && !isHidden && Math.random() < 0.7) {
      const dr = Math.sign(playerPos.r-m.r), dc = Math.sign(playerPos.c-m.c);
      if (dr !== 0 && canStep(m.r, m.c, dr, 0)) candidates.push([dr,0]);
      if (dc !== 0 && canStep(m.r, m.c, 0, dc)) candidates.push([0,dc]);
    }
    if (!candidates.length) {
      if (Math.random() > 0.5) return;
      for (const [dr,dc] of dirs) if (canStep(m.r,m.c,dr,dc)) candidates.push([dr,dc]);
    }
    if (!candidates.length) return;
    const [dr,dc] = candidates[Math.floor(Math.random()*candidates.length)];
    m.r += dr*2; m.c += dc*2;
  });
  layoutLevel2Entities();
}

function hasClearLine(r1,c1,r2,c2) {
  if (r1 === r2) {
    const lo = Math.min(c1,c2), hi = Math.max(c1,c2);
    for (let c=lo; c<=hi; c++) {
      if (!cellOpen(r1,c)) return false;
      if (c%2===1 && treeSet.has(r1+","+c) && !(c===c2)) return false;
    }
    return true;
  }
  if (c1 === c2) {
    const lo = Math.min(r1,r2), hi = Math.max(r1,r2);
    for (let r=lo; r<=hi; r++) {
      if (!cellOpen(r,c1)) return false;
      if (r%2===1 && treeSet.has(r+","+c1) && !(r===r2)) return false;
    }
    return true;
  }
  return false;
}

function checkShooters() {
  shooters.forEach((s, i) => {
    const alertEl = document.querySelector(`.shooter-alert[data-i="${i}"]`);
    const sees = !isHidden && (s.r===playerPos.r || s.c===playerPos.c) &&
                 hasClearLine(s.r, s.c, playerPos.r, playerPos.c) &&
                 (Math.abs(s.r-playerPos.r)+Math.abs(s.c-playerPos.c)) <= 11;
    if (sees) {
      if (!s.alerting) { s.alerting = true; s.alertUntil = Date.now()+1000; if (alertEl) alertEl.classList.add("show"); }
      else if (Date.now() >= s.alertUntil) {
        s.alerting = false; if (alertEl) alertEl.classList.remove("show");
        applyDamage("Spotted! 💥");
      }
    } else {
      if (s.alerting) { s.alerting = false; if (alertEl) alertEl.classList.remove("show"); }
    }
  });
}

/* =========================================================
   DIALOGUE (typewriter, cute love-note)
   ========================================================= */
let msgIndex = 0, typing = false, typeTimer = null;
function startDialogue() {
  msgIndex = 0;
  document.getElementById("dialogue-name").textContent = CONFIG.sender.name;
  showMessage();
  const overlay = document.getElementById("dialogue-overlay");
  overlay.classList.remove("hidden");
  startParticles("pf-dialogue", { emojis:["💕","💗","✨"], max:7, interval:600 });
}
function currentMessages() { return level === 2 ? CONFIG.messagesFinal : CONFIG.messages; }
function buildDots() {
  const dots = document.getElementById("dialogue-dots");
  dots.innerHTML = "";
  currentMessages().forEach((_, i) => {
    const d = document.createElement("span");
    if (i===msgIndex) d.classList.add("on");
    dots.appendChild(d);
  });
}
function showMessage() {
  buildDots();
  const textEl = document.getElementById("dialogue-text");
  const full = currentMessages()[msgIndex];
  textEl.textContent = "";
  typing = true;
  let i = 0;
  clearInterval(typeTimer);
  typeTimer = setInterval(() => {
    i++;
    textEl.textContent = full.slice(0, i);
    if (i >= full.length) { clearInterval(typeTimer); typing = false; }
  }, 26);
  document.getElementById("btn-next").textContent = msgIndex === currentMessages().length-1 ? "Finish 💞" : "Next 💌";
}
function advanceDialogue() {
  if (typing) {
    clearInterval(typeTimer);
    document.getElementById("dialogue-text").textContent = currentMessages()[msgIndex];
    typing = false;
    return;
  }
  msgIndex++;
  if (msgIndex >= currentMessages().length) {
    document.getElementById("dialogue-overlay").classList.add("hidden");
    if (level === 1) {
      pageTurn("level2intro");
    } else {
      pageTurn("divider", () => { setTimeout(goToEnding, 2600); });
    }
  } else {
    showMessage();
  }
}
document.getElementById("btn-next").addEventListener("click", advanceDialogue);
document.querySelector(".note-text").addEventListener("click", advanceDialogue);

/* =========================================================
   ENDING SCENE — cinematic cuts between shots (no zoom)
   ========================================================= */
let endTimer1 = null, endTimer2 = null;

function goToEnding() {
  const heading = document.querySelector("#end-heading span");
  heading.textContent = "🏆 You made it through everything for me 🏆";
  document.getElementById("btn-replay").textContent = "Play Again 💕";
  pageTurn("end", () => activateEndingScene());
}

function setScene(n) {
  const sky = document.getElementById("night-sky");
  sky.classList.remove("scene-1","scene-2","scene-3");
  sky.classList.add("scene-"+n);
}
function cutToScene(n) {
  const flash = document.getElementById("scene-cut-flash");
  flash.classList.add("active");
  setTimeout(() => {
    setScene(n);
    if (n >= 2) document.querySelectorAll(".cat-slot").forEach(s => s.classList.add("lean"));
    requestAnimationFrame(() => flash.classList.remove("active"));
  }, 380);
}

function activateEndingScene() {
  spawnNightStars(); buildSkyline(); buildEndHearts();
  setScene(1);
  document.querySelectorAll(".cat-slot").forEach(s => s.classList.remove("lean"));
  clearTimeout(endTimer1); clearTimeout(endTimer2);
  endTimer1 = setTimeout(() => cutToScene(2), 5500);
  endTimer2 = setTimeout(() => cutToScene(3), 11500);
}

function spawnNightStars() {
  const field = document.getElementById("night-stars");
  if (field.childElementCount) return;
  for (let i=0;i<64;i++){
    const s = document.createElement("div");
    s.className = "star";
    const sz = Math.random()<0.15 ? 3 : 2;
    s.style.width = sz+"px"; s.style.height = sz+"px";
    s.style.left = Math.random()*100+"%"; s.style.top = Math.random()*72+"%";
    s.style.animationDelay = (Math.random()*3)+"s";
    field.appendChild(s);
  }
  for (let i=0;i<5;i++){
    const s = document.createElement("div");
    s.className = "sparkle";
    s.style.left = Math.random()*100+"%"; s.style.top = Math.random()*55+"%";
    s.style.animationDelay = (Math.random()*3)+"s";
    field.appendChild(s);
  }
}
function buildSkyline() {
  const sky = document.getElementById("skyline");
  if (sky.childElementCount) return;
  let x = 0;
  while (x < 100) {
    const w = 4 + Math.random()*5;
    const h = 40 + Math.random()*60;
    const b = document.createElement("div");
    b.className = "bld";
    b.style.left = x+"%"; b.style.width = w+"%"; b.style.height = h+"%";
    sky.appendChild(b);
    if (Math.random() < 0.5) {
      const win = document.createElement("div");
      win.className = "win";
      win.style.left = (x+w*0.35)+"%"; win.style.bottom = (h*0.4)+"%";
      sky.appendChild(win);
    }
    x += w;
  }
}
function buildEndHearts() {
  const field = document.getElementById("end-hearts");
  if (field.childElementCount) return;
  const icons = ["💗","💕","✨"];
  for (let i=0;i<7;i++){
    const s = document.createElement("span");
    s.textContent = icons[i % icons.length];
    s.style.left = (35 + Math.random()*30) + "%";
    s.style.top = (55 + Math.random()*20) + "%";
    s.style.animationDelay = (Math.random()*3)+"s";
    field.appendChild(s);
  }
}

/* =========================================================
   ANCIENT BOOK — gate, intro, letter, memories
   ========================================================= */

/* ---------- book intro integration ----------
   The actual 3D scene (Three.js) lives in book-scene.js and runs
   independently. It calls window.finishBookIntro() when the climax
   flash completes, or immediately if the user hits Skip. This keeps
   the 3D rendering code decoupled from the rest of the site's logic. */
const videoSkipBtn = document.getElementById("video-skip");
let introFinished = false;

window.finishBookIntro = function finishBookIntro() {
  if (introFinished) return;
  introFinished = true;
  const cut = document.getElementById("white-cut");
  cut.classList.add("active");
  setTimeout(() => {
    showScreen("gate");
    setTimeout(() => cut.classList.remove("active"), 200);
  }, 480);
};

videoSkipBtn.addEventListener("click", () => {
  if (window.skipBookIntro) window.skipBookIntro();
  window.finishBookIntro();
});

/* ---------- passcode gate ---------- */
function checkGateCode() {
  const input = document.getElementById("gate-input");
  const val = input.value.trim();
  if (val === GATE_CODE) {
    bloomSeal();
    setTimeout(() => { pageTurn("letter", startLetter); }, 900);
  } else {
    document.getElementById("gate-error").textContent = "That's not quite right... try again 💭";
    input.classList.remove("shake"); void input.offsetWidth; input.classList.add("shake");
    input.value = "";
  }
}
/* Unlock flourish: the wax seal used to crack. Now it blooms — petals
   unfurl outward and a warm glow swells through as the seal dissolves. */
function bloomSeal() {
  const seal = document.getElementById("gate-seal");
  const wrap = seal ? seal.parentElement : null;
  if (seal) seal.classList.add("crack");
  if (!wrap || wrap.querySelector(".bloom-burst")) return;

  const burst = document.createElement("div");
  burst.className = "bloom-burst";
  const core = document.createElement("div");
  core.className = "bloom-core";
  burst.appendChild(core);

  const PETALS = 10;
  for (let i = 0; i < PETALS; i++) {
    const p = document.createElement("div");
    p.className = "bloom-petal";
    p.style.setProperty("--a", (i * (360 / PETALS)) + "deg");
    p.style.setProperty("--d", (i * 28) + "ms");
    burst.appendChild(p);
  }
  wrap.appendChild(burst);
  void burst.offsetWidth;
  burst.classList.add("go");
  setTimeout(() => burst.remove(), 1400);
}

document.getElementById("gate-submit").addEventListener("click", checkGateCode);
document.getElementById("gate-input").addEventListener("keydown", (e) => { if (e.key === "Enter") checkGateCode(); });

/* ---------- letter reveal ---------- */
function startLetter() {
  const body = document.getElementById("letter-body");
  const words = LETTER_TEXT.split(" ");
  body.innerHTML = words.map((w, i) => `<span class="word" style="animation-delay:${(i*0.055).toFixed(2)}s">${w}&nbsp;</span>`).join("");
  const totalMs = words.length * 55 + 500;
  const sign = document.getElementById("letter-sign");
  const cont = document.getElementById("letter-continue");
  sign.style.animation = "none"; void sign.offsetWidth;
  sign.style.animation = "";
  sign.style.animationDelay = (totalMs/1000).toFixed(2) + "s";
  cont.style.animation = "none"; void cont.offsetWidth;
  cont.style.animation = "";
  cont.style.animationDelay = (totalMs/1000 + 0.6).toFixed(2) + "s";
}
/* =========================================================
   POP-UP STORYBOOK DIORAMAS

   Replaces the old flat memory menu + detail page. Each entry in
   MEMORIES becomes a page of a pop-up book: layered paper cut-outs
   hinge upright out of the gutter, sit at different depths, and drift
   apart as the page is tilted.

   The scene art is generated as inline SVG so it stays procedural and
   scales to any number of memories — themes cycle, and each memory gets
   a stable variation seeded from its own id, so the same memory always
   looks the same.
   ========================================================= */

/* ---- a small warm palette shared by every scene ---- */
const DIO_PAL = {
  skyTop: "#ffd9a0", skyMid: "#ffc98f", skyLow: "#ffe9c4",
  sun: "#fff3cf",
  far1: "#c39a68", far2: "#ab8354",
  mid1: "#8a6b3e", mid2: "#6f5430",
  near1: "#5c4526", near2: "#463318",
  pop: "#f7a8c4", pop2: "#ffd166", leaf: "#7c9a45",
};

function dioRand(seed) {
  /* deterministic per-memory jitter so a scene never reshuffles */
  let x = Math.sin(seed * 9301 + 49297) * 233280;
  return () => { x = Math.sin(x * 9301 + 49297) * 233280; return x - Math.floor(x); };
}

function svgWrap(inner, h) {
  return `<svg viewBox="0 0 600 ${h}" preserveAspectRatio="xMidYMax meet" aria-hidden="true">${inner}</svg>`;
}

/* ---------- shared cut-out pieces ---------- */
function dioSky(rnd) {
  const cloud = (cx, cy, s, o) =>
    `<g opacity="${o}" transform="translate(${cx} ${cy}) scale(${s})">
       <ellipse cx="0" cy="0" rx="46" ry="17" fill="#fffaf0"/>
       <ellipse cx="-28" cy="6" rx="28" ry="13" fill="#fffaf0"/>
       <ellipse cx="30" cy="5" rx="32" ry="14" fill="#fffaf0"/>
     </g>`;
  return svgWrap(`
    <defs>
      <linearGradient id="dsky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${DIO_PAL.skyTop}"/>
        <stop offset="58%" stop-color="${DIO_PAL.skyMid}"/>
        <stop offset="100%" stop-color="${DIO_PAL.skyLow}"/>
      </linearGradient>
      <radialGradient id="dsun" cx="50%" cy="50%">
        <stop offset="0%" stop-color="#fffdf4"/><stop offset="60%" stop-color="${DIO_PAL.sun}"/>
        <stop offset="100%" stop-color="rgba(255,220,150,0)"/>
      </radialGradient>
    </defs>
    <path d="M14 200 L14 74 Q14 30 60 24 Q300 -6 540 24 Q586 30 586 74 L586 200 Z" fill="url(#dsky)"/>
    <circle cx="${140 + rnd() * 320}" cy="${52 + rnd() * 26}" r="70" fill="url(#dsun)"/>
    ${cloud(90 + rnd() * 60, 46, 0.85, 0.8)}
    ${cloud(430 + rnd() * 70, 66, 0.7, 0.65)}
  `, 200);
}

function dioHills(rnd) {
  const y = 120;
  return svgWrap(`
    <path d="M0 ${y + 40} Q90 ${y - 26} 190 ${y + 8} T400 ${y - 4} T600 ${y + 26} L600 200 L0 200 Z" fill="${DIO_PAL.far1}"/>
    <path d="M0 ${y + 62} Q140 ${y + 14} 280 ${y + 46} T600 ${y + 52} L600 200 L0 200 Z" fill="${DIO_PAL.far2}"/>
    ${Array.from({ length: 7 }, (_, i) => {
      const x = 40 + i * 82 + rnd() * 22, s = 0.6 + rnd() * 0.45;
      return `<g transform="translate(${x} ${y + 44}) scale(${s})" fill="${DIO_PAL.far2}">
        <rect x="-3" y="-6" width="6" height="22" rx="2"/>
        <ellipse cx="0" cy="-16" rx="19" ry="17"/></g>`;
    }).join("")}
  `, 200);
}

/* ---------- theme-specific midgrounds ---------- */
const DIO_THEMES = [
  {
    /* a little cottage under a big tree */
    name: "cottage",
    mid(rnd) {
      return svgWrap(`
        <g fill="${DIO_PAL.mid1}">
          <rect x="228" y="96" width="150" height="78" rx="4"/>
          <path d="M214 100 L303 44 L392 100 Z"/>
        </g>
        <rect x="286" y="130" width="34" height="44" rx="3" fill="${DIO_PAL.pop2}"/>
        <rect x="242" y="112" width="26" height="24" rx="3" fill="${DIO_PAL.pop2}" opacity=".85"/>
        <rect x="340" y="112" width="26" height="24" rx="3" fill="${DIO_PAL.pop2}" opacity=".85"/>
        <g transform="translate(${112 + rnd() * 26} 174)">
          <rect x="-8" y="-58" width="16" height="58" rx="4" fill="${DIO_PAL.mid2}"/>
          <circle cx="0" cy="-74" r="46" fill="${DIO_PAL.leaf}"/>
          <circle cx="-30" cy="-58" r="30" fill="${DIO_PAL.leaf}"/>
          <circle cx="30" cy="-58" r="30" fill="${DIO_PAL.leaf}"/>
        </g>
        <g transform="translate(${476 + rnd() * 20} 174)">
          <rect x="-6" y="-42" width="12" height="42" rx="3" fill="${DIO_PAL.mid2}"/>
          <circle cx="0" cy="-54" r="32" fill="${DIO_PAL.leaf}"/>
        </g>
      `, 200);
    },
  },
  {
    /* city rooftops at golden hour */
    name: "city",
    mid(rnd) {
      const bars = Array.from({ length: 9 }, (_, i) => {
        const x = 30 + i * 64, h = 52 + rnd() * 86, w = 46 + rnd() * 14;
        const win = Array.from({ length: Math.floor(h / 22) }, (_, r2) =>
          `<rect x="${x + 9}" y="${174 - h + 12 + r2 * 20}" width="${w - 22}" height="9" rx="2"
                 fill="${DIO_PAL.pop2}" opacity="${0.45 + rnd() * 0.5}"/>`).join("");
        return `<rect x="${x}" y="${174 - h}" width="${w}" height="${h}" rx="3"
                  fill="${i % 2 ? DIO_PAL.mid1 : DIO_PAL.mid2}"/>${win}`;
      }).join("");
      return svgWrap(bars, 200);
    },
  },
  {
    /* seaside: boat on a calm bay */
    name: "sea",
    mid(rnd) {
      return svgWrap(`
        <path d="M0 128 Q150 116 300 128 T600 126 L600 200 L0 200 Z" fill="#9ec5c9" opacity=".92"/>
        <path d="M0 150 Q160 140 320 152 T600 148 L600 200 L0 200 Z" fill="#7fadb4"/>
        <g transform="translate(${250 + rnd() * 90} 138)">
          <path d="M-46 0 L46 0 L32 22 L-32 22 Z" fill="${DIO_PAL.mid2}"/>
          <rect x="-2" y="-54" width="5" height="54" fill="${DIO_PAL.mid1}"/>
          <path d="M4 -50 L40 -8 L4 -8 Z" fill="#fffaf0"/>
          <path d="M-6 -42 L-34 -8 L-6 -8 Z" fill="#ffe6c9"/>
        </g>
        ${Array.from({ length: 5 }, () =>
          `<ellipse cx="${rnd() * 600}" cy="${158 + rnd() * 30}" rx="${12 + rnd() * 20}" ry="2.4"
                    fill="#fffaf0" opacity=".55"/>`).join("")}
      `, 200);
    },
  },
  {
    /* a night of small lanterns */
    name: "lanterns",
    mid(rnd) {
      const lamps = Array.from({ length: 11 }, () => {
        const x = 30 + rnd() * 540, y = 24 + rnd() * 96, s = 0.55 + rnd() * 0.6;
        return `<g transform="translate(${x} ${y}) scale(${s})">
          <ellipse cx="0" cy="0" rx="13" ry="17" fill="${DIO_PAL.pop2}"/>
          <ellipse cx="0" cy="0" rx="22" ry="27" fill="${DIO_PAL.pop2}" opacity=".22"/>
          <rect x="-2" y="17" width="4" height="9" fill="${DIO_PAL.mid2}"/></g>`;
      }).join("");
      return svgWrap(`
        <path d="M0 150 Q120 132 250 148 T600 140 L600 200 L0 200 Z" fill="${DIO_PAL.mid2}"/>
        ${lamps}
      `, 200);
    },
  },
];

function dioChars(rnd) {
  /* two paper silhouettes, side by side, holding the middle of the page */
  const sway = rnd() * 6 - 3;
  return svgWrap(`
    <g transform="translate(300 176)">
      <g transform="translate(-34 0) rotate(${-sway})">
        <ellipse cx="0" cy="-72" r="1" rx="15" ry="16" fill="${DIO_PAL.near2}"/>
        <path d="M-16 -56 Q0 -64 16 -56 L20 0 L-20 0 Z" fill="${DIO_PAL.near1}"/>
        <path d="M-16 -56 Q-30 -30 -24 -6" stroke="${DIO_PAL.near1}" stroke-width="7" fill="none" stroke-linecap="round"/>
      </g>
      <g transform="translate(34 0) rotate(${sway})">
        <ellipse cx="0" cy="-70" rx="14" ry="15" fill="${DIO_PAL.near2}"/>
        <path d="M-24 -34 Q-14 -58 0 -54 Q14 -58 24 -34 L18 0 L-18 0 Z" fill="${DIO_PAL.near1}"/>
        <path d="M16 -54 Q30 -28 24 -6" stroke="${DIO_PAL.near1}" stroke-width="7" fill="none" stroke-linecap="round"/>
      </g>
      <g opacity=".95">
        <path d="M0 -84 C-7 -95 -20 -88 -14 -77 C-10 -70 0 -64 0 -64 C0 -64 10 -70 14 -77 C20 -88 7 -95 0 -84 Z"
              fill="${DIO_PAL.pop}"/>
      </g>
    </g>
  `, 200);
}

function dioForeground(rnd) {
  const blades = Array.from({ length: 46 }, () => {
    const x = rnd() * 600, h = 12 + rnd() * 26, lean = rnd() * 10 - 5;
    return `<path d="M${x} 200 Q${x + lean} ${200 - h * 0.6} ${x + lean * 2} ${200 - h}"
              stroke="${rnd() > 0.5 ? DIO_PAL.leaf : DIO_PAL.near1}" stroke-width="${2 + rnd() * 2}"
              fill="none" stroke-linecap="round"/>`;
  }).join("");
  const flowers = Array.from({ length: 12 }, () => {
    const x = rnd() * 600, y = 176 + rnd() * 16, c = rnd() > 0.5 ? DIO_PAL.pop : DIO_PAL.pop2;
    return `<g transform="translate(${x} ${y})">
      ${Array.from({ length: 5 }, (_, i) =>
        `<ellipse cx="${Math.cos(i * 1.257) * 4.4}" cy="${Math.sin(i * 1.257) * 4.4}" rx="3.4" ry="2.6" fill="${c}"/>`).join("")}
      <circle r="2.1" fill="#fff3c4"/></g>`;
  }).join("");
  return svgWrap(`
    <path d="M0 186 Q150 174 300 184 T600 180 L600 200 L0 200 Z" fill="${DIO_PAL.near1}" opacity=".92"/>
    ${blades}${flowers}
  `, 200);
}

/* ---------- state ---------- */
let dioIndex = 0;
let dioTimer = null;
let dioBusy = false;
const DIO_HOLD_MS = 7200;   // how long a page sits before it turns itself

function dioScreen() { return document.getElementById("screen-diorama"); }

function buildDiorama(i) {
  const m = MEMORIES[i];
  if (!m) return;
  const theme = DIO_THEMES[i % DIO_THEMES.length];
  const rnd = dioRand((m.id || i + 1) * 7 + 3);

  document.getElementById("dio-title").textContent = m.title || "";
  document.getElementById("dio-date").textContent = m.date || "";
  document.getElementById("dio-text").textContent = m.text || "";

  document.getElementById("dio-sky").innerHTML = dioSky(rnd);
  document.getElementById("dio-far").innerHTML = dioHills(rnd);
  document.getElementById("dio-mid").innerHTML = theme.mid(rnd);
  document.getElementById("dio-chars").innerHTML = dioChars(rnd);
  document.getElementById("dio-near").innerHTML = dioForeground(rnd);

  const photo = document.getElementById("dio-photo");
  photo.innerHTML = m.photo ? `<img src="${m.photo}" alt="${m.title || "memory"}">` : (m.icon || "📷");

  /* sparkle accents, scattered but stable for this page */
  const sp = document.getElementById("dio-sparkles");
  sp.innerHTML = "";
  for (let k = 0; k < 9; k++) {
    const d = document.createElement("div");
    d.className = "dio-spark";
    d.style.left = (8 + rnd() * 84) + "%";
    d.style.top = (10 + rnd() * 62) + "%";
    d.style.animationDelay = (rnd() * 3.2).toFixed(2) + "s";
    sp.appendChild(d);
  }

  /* dots + arrows */
  const dots = document.getElementById("dio-dots");
  dots.innerHTML = "";
  MEMORIES.forEach((_, k) => {
    const b = document.createElement("button");
    b.className = "dio-dot" + (k === i ? " on" : "");
    b.setAttribute("aria-label", "Memory " + (k + 1));
    b.addEventListener("click", (e) => { e.stopPropagation(); dioGo(k); });
    dots.appendChild(b);
  });
  document.getElementById("dio-prev").disabled = i === 0;
  document.getElementById("dio-next").disabled = i >= MEMORIES.length - 1;
}

function dioPopOpen() {
  const scr = dioScreen();
  scr.classList.remove("dio-open", "dio-closing");
  void scr.offsetWidth;
  scr.classList.add("dio-open");
  clearTimeout(dioTimer);
  if (MEMORIES.length > 1) {
    dioTimer = setTimeout(() => { if (dioIndex < MEMORIES.length - 1) dioGo(dioIndex + 1); }, DIO_HOLD_MS);
  }
}

function dioGo(i) {
  if (dioBusy || i === dioIndex || i < 0 || i >= MEMORIES.length) return;
  dioBusy = true;
  clearTimeout(dioTimer);
  const scr = dioScreen();
  scr.classList.remove("dio-open");
  scr.classList.add("dio-closing");
  setTimeout(() => {
    dioIndex = i;
    buildDiorama(dioIndex);
    scr.classList.remove("dio-closing");
    dioPopOpen();
    dioBusy = false;
  }, 330);
}

function startDioramas() {
  dioIndex = 0;
  buildDiorama(0);
  dioPopOpen();
}

/* ---------- parallax: layers drift apart as the page is tilted ---------- */
(function dioParallax() {
  const DEPTH = { "dio-sky": 3, "dio-far": 7, "dio-mid": 13, "dio-chars": 19, "dio-near": 27 };
  let px = 0, py = 0, tx = 0, ty = 0, raf = null;

  function apply() {
    px += (tx - px) * 0.08;
    py += (ty - py) * 0.08;
    for (const id in DEPTH) {
      const el = document.getElementById(id);
      if (!el) continue;
      const d = DEPTH[id];
      el.style.setProperty("--px", (px * d).toFixed(2) + "px");
      el.style.setProperty("--py", (py * d * 0.4).toFixed(2) + "px");
      /* keep the pop-up transform intact — parallax rides on the child svg */
      const svg = el.firstElementChild;
      if (svg) svg.style.translate = (px * d).toFixed(2) + "px " + (py * d * 0.4).toFixed(2) + "px";
    }
    if (Math.abs(tx - px) > 0.001 || Math.abs(ty - py) > 0.001) raf = requestAnimationFrame(apply);
    else raf = null;
  }
  function kick() { if (!raf) raf = requestAnimationFrame(apply); }

  window.addEventListener("pointermove", (e) => {
    const scr = document.getElementById("screen-diorama");
    if (!scr || !scr.classList.contains("active")) return;
    tx = (e.clientX / window.innerWidth - 0.5) * 2;
    ty = (e.clientY / window.innerHeight - 0.5) * 2;
    kick();
  }, { passive: true });

  window.addEventListener("deviceorientation", (e) => {
    const scr = document.getElementById("screen-diorama");
    if (!scr || !scr.classList.contains("active")) return;
    tx = Math.max(-1, Math.min(1, (e.gamma || 0) / 28));
    ty = Math.max(-1, Math.min(1, ((e.beta || 0) - 45) / 34));
    kick();
  }, { passive: true });
})();

/* ---------- wiring ---------- */
document.getElementById("letter-continue")
  .addEventListener("click", () => pageTurn("diorama", startDioramas));
document.getElementById("dio-next").addEventListener("click", (e) => { e.stopPropagation(); dioGo(dioIndex + 1); });
document.getElementById("dio-prev").addEventListener("click", (e) => { e.stopPropagation(); dioGo(dioIndex - 1); });
document.getElementById("dio-stage").addEventListener("click", () => {
  if (dioIndex < MEMORIES.length - 1) dioGo(dioIndex + 1);
});
document.getElementById("dio-continue").addEventListener("click", () => {
  clearTimeout(dioTimer);
  pageTurn("hello");   // becomes the hub screen in the next pass
});
