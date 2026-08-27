
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
  level = 1;
  if (bothChaptersDone()) pageTurn("keepsake", startKeepsake);
  else pageTurn("hub", startHub);
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
  markChapterDone("maze");
  document.getElementById("btn-replay").textContent =
    bothChaptersDone() ? "Open the keepsake 💛" : "Choose another chapter 💕";
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
   MEMORY DIORAMAS

   Each memory is a miniature world that rises out of an open book,
   wrapped in golden light. The 3D scene itself lives in
   diorama-scene.js; this half owns the page: which memory is showing,
   the caption, navigation, and what to do when 3D is unavailable.
   ========================================================= */

let dioIndex = 0;
let dioTimer = null;
let dioBusy = false;
const DIO_HOLD_MS = 9000;   // how long a page sits before it turns itself

function dioScreen() { return document.getElementById("screen-diorama"); }

function buildDiorama(i) {
  const m = MEMORIES[i];
  if (!m) return;

  document.getElementById("dio-title").textContent = m.title || "";
  document.getElementById("dio-date").textContent = m.date || "";
  document.getElementById("dio-text").textContent = m.text || "";

  const photo = document.getElementById("dio-photo");
  photo.innerHTML = m.photo ? `<img src="${m.photo}" alt="${m.title || "memory"}">` : (m.icon || "📷");

  /* Each memory gets a world. They cycle, so adding memories never
     leaves one without a scene. */
  if (window.Diorama && Diorama.mount()) {
    document.getElementById("dio-fallback").hidden = true;
    /* The photo, when there is one, stands up on the pages as the
       centrepiece and the miniature world arranges itself around it. */
    Diorama.show(i, m.photo || null);
  } else {
    const fb = document.getElementById("dio-fallback");
    fb.hidden = false;
    fb.textContent = m.title || "A memory";
  }

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
  if (window.Diorama && Diorama.ok) Diorama.hide();   // sink the old world first
  setTimeout(() => {
    dioIndex = i;
    buildDiorama(dioIndex);
    scr.classList.remove("dio-closing");
    dioPopOpen();
    dioBusy = false;
  }, 480);
}

function startDioramas() {
  dioIndex = 0;
  buildDiorama(0);
  dioPopOpen();
  if (window.Diorama && Diorama.ok) { Diorama.resize(); Diorama.start(); }
}

function stopDioramas() {
  clearTimeout(dioTimer);
  if (window.Diorama && Diorama.ok) { Diorama.hide(); Diorama.stop(); }
}

/* ---------- wiring ---------- */
document.getElementById("letter-continue")
  .addEventListener("click", () => pageTurn("diorama", startDioramas));
document.getElementById("dio-next").addEventListener("click", (e) => { e.stopPropagation(); dioGo(dioIndex + 1); });
document.getElementById("dio-prev").addEventListener("click", (e) => { e.stopPropagation(); dioGo(dioIndex - 1); });
document.getElementById("dio-stage").addEventListener("click", () => {
  if (dioIndex < MEMORIES.length - 1) dioGo(dioIndex + 1);
});
document.getElementById("dio-continue").addEventListener("click", () => {
  stopDioramas();
  pageTurn("hub", startHub);
});

/* =========================================================
   HUB — choose your adventure
   Two chapters, either order. Completion is remembered so she can
   put the phone down and come back to it.
   ========================================================= */
const CHAPTER_KEY = "fal_chapters_done";

function chaptersDone() {
  try { return JSON.parse(localStorage.getItem(CHAPTER_KEY) || "{}") || {}; }
  catch (e) { return {}; }
}
function markChapterDone(name) {
  try {
    const d = chaptersDone();
    d[name] = true;
    localStorage.setItem(CHAPTER_KEY, JSON.stringify(d));
  } catch (e) { /* private mode — the session still works, it just won't persist */ }
}
function bothChaptersDone() {
  const d = chaptersDone();
  return !!(d.maze && d.quest);
}

function startHub() {
  const d = chaptersDone();
  const both = bothChaptersDone();

  [["maze", d.maze], ["quest", d.quest]].forEach(([name, done]) => {
    const card = document.getElementById("hub-card-" + name);
    if (card) card.classList.toggle("done", !!done);
  });

  const sub = document.getElementById("hub-sub");
  if (both) sub.textContent = "— you finished both. the keepsake is yours —";
  else if (d.maze || d.quest) sub.textContent = "— one down. the other is still waiting —";
  else sub.textContent = "— two chapters, either order —";

  document.getElementById("hub-keepsake").classList.toggle("on", both);
}

document.getElementById("hub-card-maze").addEventListener("click", () => {
  level = 1;
  pageTurn("details");
});
document.getElementById("hub-card-quest").addEventListener("click", () => {
  pageTurn("quest", startQuest);
});
document.getElementById("hub-keepsake").addEventListener("click", () => {
  pageTurn("keepsake", startKeepsake);
});

/* =========================================================
   KEEPSAKE — scrapbook recap
   ========================================================= */
const KEEPSAKE_CLOSING =
  "[Replace this with your closing line — the last thing she reads.]";

function startKeepsake() {
  const board = document.getElementById("ks-board");
  board.innerHTML = "";

  MEMORIES.forEach((m, i) => {
    const card = document.createElement("div");
    card.className = "ks-card";
    card.style.setProperty("--r", ((i % 2 ? 1 : -1) * (1.5 + (i % 3))) + "deg");
    card.innerHTML = `
      <span class="ks-tape"></span>
      <div class="ks-img">${m.photo ? `<img src="${m.photo}" alt="${m.title || ""}" style="width:100%;height:100%;object-fit:cover">` : (m.icon || "📷")}</div>
      <div class="ks-cap">${m.title || ""}</div>`;
    board.appendChild(card);
  });

  /* the two chapters get a card each, so the board reflects the whole visit */
  const badges = [
    { icon: "🗝️", cap: "The Maze" },
    { icon: "🦊", cap: "The Long Way Round" },
  ];
  badges.forEach((b, i) => {
    const card = document.createElement("div");
    card.className = "ks-card";
    card.style.setProperty("--r", ((i ? -1 : 1) * 2.5) + "deg");
    card.innerHTML = `
      <span class="ks-tape"></span>
      <div class="ks-img">${b.icon}</div>
      <div class="ks-cap">${b.cap}</div>`;
    board.appendChild(card);
  });

  let best = "";
  try { best = localStorage.getItem("fal_best_time") || ""; } catch (e) {}
  document.getElementById("ks-sub").textContent =
    best ? "every page, start to finish · best maze time " + best : "every page, start to finish";
  document.getElementById("ks-closing").textContent = KEEPSAKE_CLOSING;
}

document.getElementById("ks-memories").addEventListener("click", () => {
  pageTurn("diorama", startDioramas);
});
document.getElementById("ks-replay").addEventListener("click", () => {
  pageTurn("hub", startHub);
});

/* =========================================================
   AMBIENT MUSIC
   No audio file was supplied, so the pad is synthesised with Web
   Audio: a few detuned sine voices drifting through a slow filter,
   plus an occasional soft bell. Preference is remembered.
   ========================================================= */
const MUSIC_KEY = "fal_music_on";
let audioCtx = null, musicNodes = null, musicOn = false, bellTimer = null;

function musicPreferred() {
  try { return localStorage.getItem(MUSIC_KEY) === "1"; } catch (e) { return false; }
}

function buildMusic() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  const ctx = audioCtx || (audioCtx = new AC());

  const master = ctx.createGain();
  master.gain.value = 0.0001;
  master.connect(ctx.destination);

  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 900;
  filter.Q.value = 0.6;
  filter.connect(master);

  /* a warm open chord, each voice slightly detuned so it breathes */
  const freqs = [146.83, 220.0, 293.66, 369.99];  // D3 A3 D4 F#4
  const voices = freqs.map((f, i) => {
    const o = ctx.createOscillator();
    o.type = i % 2 ? "sine" : "triangle";
    o.frequency.value = f;
    o.detune.value = (i - 1.5) * 5;
    const g = ctx.createGain();
    g.gain.value = 0.16 / (i + 1);
    o.connect(g); g.connect(filter);
    o.start();

    /* slow drift so the pad never sits perfectly still */
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.03 + i * 0.017;
    const lg = ctx.createGain();
    lg.gain.value = 2.4;
    lfo.connect(lg); lg.connect(o.detune);
    lfo.start();
    return { o, g, lfo };
  });

  /* filter sweep */
  const sweep = ctx.createOscillator();
  sweep.frequency.value = 0.021;
  const sg = ctx.createGain();
  sg.gain.value = 320;
  sweep.connect(sg); sg.connect(filter.frequency);
  sweep.start();

  function bell() {
    if (!musicOn) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.value = [587.33, 659.25, 880.0, 987.77][Math.floor(Math.random() * 4)];
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.055, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 3.4);
    o.connect(g); g.connect(filter);
    o.start(t); o.stop(t + 3.6);
    bellTimer = setTimeout(bell, 6000 + Math.random() * 9000);
  }
  bellTimer = setTimeout(bell, 3500);

  return { ctx, master, voices, sweep, filter };
}

function setMusic(on) {
  musicOn = on;
  const btn = document.getElementById("music-toggle");
  if (btn) {
    btn.classList.toggle("off", !on);
    btn.textContent = on ? "🎵" : "🔇";
    btn.setAttribute("aria-label", on ? "Turn music off" : "Turn music on");
  }
  try { localStorage.setItem(MUSIC_KEY, on ? "1" : "0"); } catch (e) {}

  if (on) {
    if (!musicNodes) musicNodes = buildMusic();
    if (!musicNodes) return;
    if (musicNodes.ctx.state === "suspended") musicNodes.ctx.resume();
    const t = musicNodes.ctx.currentTime;
    musicNodes.master.gain.cancelScheduledValues(t);
    musicNodes.master.gain.setValueAtTime(Math.max(0.0001, musicNodes.master.gain.value), t);
    musicNodes.master.gain.exponentialRampToValueAtTime(0.24, t + 1.6);
  } else if (musicNodes) {
    const t = musicNodes.ctx.currentTime;
    musicNodes.master.gain.cancelScheduledValues(t);
    musicNodes.master.gain.setValueAtTime(Math.max(0.0001, musicNodes.master.gain.value), t);
    musicNodes.master.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
    clearTimeout(bellTimer);
  }
}

(function initMusic() {
  const btn = document.getElementById("music-toggle");
  if (!btn) return;
  const want = musicPreferred();
  musicOn = false;
  btn.classList.toggle("off", !want);
  btn.textContent = want ? "🎵" : "🔇";

  btn.addEventListener("click", () => setMusic(!musicOn));

  /* Browsers will not start audio without a gesture, so if she had it on
     last time, wait for her first tap anywhere and start it then. */
  if (want) {
    const kick = () => {
      document.removeEventListener("pointerdown", kick);
      setMusic(true);
    };
    document.addEventListener("pointerdown", kick, { once: true });
  }
})();

/* =========================================================
   PIXEL-ART ENGINE

   Everything the adventure draws goes through here. Scenes are
   painted onto a 320x180 canvas and scaled up with
   image-rendering:pixelated, so the pixel grid stays honest.

   The thing that separates flat pixel art from the good kind is
   tone count and dithering: skies get ordered-dither transitions
   instead of smooth gradients, and every solid form (canopy, hill,
   cloud) is built from at least three tones with a lit edge.
   ========================================================= */

const PXW = 320, PXH = 180;

/* 4x4 Bayer matrix — ordered dithering, the classic pixel-art gradient */
const BAYER4 = [
  [0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5],
];

function px(ctx, x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(x | 0, y | 0, Math.max(1, w | 0), Math.max(1, h | 0)); }

/* Vertical dithered gradient through an arbitrary list of colour stops. */
function ditherSky(ctx, x0, y0, w, h, stops) {
  for (let y = 0; y < h; y++) {
    const t = y / (h - 1 || 1);
    // find the pair of stops we sit between
    let i = 0;
    while (i < stops.length - 2 && t > stops[i + 1].p) i++;
    const a = stops[i], b = stops[i + 1];
    const lt = (t - a.p) / ((b.p - a.p) || 1);
    for (let x = 0; x < w; x++) {
      const threshold = (BAYER4[y & 3][x & 3] + 0.5) / 16;
      ctx.fillStyle = lt > threshold ? b.c : a.c;
      ctx.fillRect(x0 + x, y0 + y, 1, 1);
    }
  }
}

/* A soft shaded blob — the building block of canopies and clouds. */
function blob(ctx, cx, cy, rx, ry, tones, lightFrom) {
  const lx = lightFrom ? lightFrom[0] : -0.5, ly = lightFrom ? lightFrom[1] : -0.6;
  for (let y = -ry; y <= ry; y++) {
    for (let x = -rx; x <= rx; x++) {
      const d = (x * x) / (rx * rx) + (y * y) / (ry * ry);
      if (d > 1) continue;
      // shade by how far the pixel is from the lit side
      const lit = (x / rx) * lx + (y / ry) * ly;
      let idx = lit > 0.34 ? 0 : lit > -0.05 ? 1 : lit > -0.5 ? 2 : 3;
      idx = Math.min(idx, tones.length - 1);
      ctx.fillStyle = tones[idx];
      ctx.fillRect((cx + x) | 0, (cy + y) | 0, 1, 1);
    }
  }
}

/* Layered leafy canopy: several overlapping blobs, then lit speckles. */
function canopy(ctx, cx, cy, r, tones, rnd, speckle) {
  const puffs = 5 + Math.floor(rnd() * 3);
  for (let i = 0; i < puffs; i++) {
    const a = (i / puffs) * Math.PI * 2 + rnd() * 0.6;
    const dx = Math.cos(a) * r * 0.46, dy = Math.sin(a) * r * 0.32;
    blob(ctx, cx + dx, cy + dy, r * (0.52 + rnd() * 0.2), r * (0.42 + rnd() * 0.16), tones);
  }
  blob(ctx, cx, cy, r * 0.78, r * 0.6, tones);
  if (speckle) {
    for (let i = 0; i < r * 2.2; i++) {
      const a = rnd() * Math.PI * 2, rr = rnd() * r * 0.85;
      px(ctx, cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.72, 1, 1, speckle);
    }
  }
}

function trunk(ctx, x, groundY, h, w, tones) {
  for (let y = 0; y < h; y++) {
    const yy = groundY - y;
    const taper = Math.max(1, Math.round(w * (1 - y / h * 0.32)));
    px(ctx, x - (taper >> 1), yy, taper, 1, tones[1]);
    px(ctx, x - (taper >> 1), yy, Math.max(1, taper >> 2), 1, tones[0]); // lit edge
    px(ctx, x + (taper >> 1) - 1, yy, 1, 1, tones[2]);                    // shadow edge
  }
}

/* rolling hill band with a lit crest */
function hillBand(ctx, W, baseY, amp, freq, tones, rnd, phase) {
  const ph = phase || rnd() * 10;
  for (let x = 0; x < W; x++) {
    const y = Math.round(baseY
      + Math.sin(x * freq + ph) * amp
      + Math.sin(x * freq * 2.3 + ph * 1.7) * amp * 0.35);
    px(ctx, x, y, 1, PXH - y, tones[1]);
    px(ctx, x, y, 1, 2, tones[0]);                 // sunlit crest
    px(ctx, x, y + 8, 1, PXH - y - 8, tones[2] || tones[1]);
  }
}

/* pixel clouds: three tones, flat bottom, puffy top */
function cloudRow(ctx, W, y, count, tones, rnd, scale) {
  for (let i = 0; i < count; i++) {
    const cx = rnd() * W, s = (0.7 + rnd() * 0.8) * (scale || 1);
    const w = Math.round(22 * s), h = Math.round(7 * s);
    const yy = y + Math.round((rnd() - 0.5) * 14);
    blob(ctx, cx, yy, w, h, tones);
    blob(ctx, cx - w * 0.5, yy + h * 0.3, w * 0.55, h * 0.7, tones);
    blob(ctx, cx + w * 0.55, yy + h * 0.25, w * 0.6, h * 0.75, tones);
    // flat lit underside
    px(ctx, cx - w, yy + h - 1, w * 2, 1, tones[0]);
  }
}

function pineRow(ctx, W, groundY, count, tones, rnd, scale) {
  for (let i = 0; i < count; i++) {
    const x = Math.round(rnd() * W), s = (0.7 + rnd() * 0.7) * (scale || 1);
    const h = Math.round(20 * s), w = Math.round(9 * s);
    for (let y = 0; y < h; y++) {
      const t = y / h;
      const ww = Math.round(w * t);
      px(ctx, x - ww, groundY - h + y, ww * 2 + 1, 1, t > 0.55 ? tones[1] : tones[0]);
    }
    px(ctx, x - 1, groundY - 2, 2, 3, tones[2] || tones[1]);
  }
}

function sunRays(ctx, cx, cy, W, H, colour, rnd, count) {
  ctx.save();
  ctx.globalAlpha = 0.16;
  for (let i = 0; i < (count || 5); i++) {
    const a = -1.35 + rnd() * 0.85;
    const len = H * (0.8 + rnd() * 0.5);
    const wdt = 3 + rnd() * 7;
    ctx.fillStyle = colour;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(a) * len - wdt, cy + Math.sin(a + 1.57) * len);
    ctx.lineTo(cx + Math.cos(a) * len + wdt, cy + Math.sin(a + 1.57) * len);
    ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}

function grassTufts(ctx, W, groundY, count, tones, rnd) {
  for (let i = 0; i < count; i++) {
    const x = Math.round(rnd() * W), h = 2 + Math.round(rnd() * 4);
    const c = tones[Math.floor(rnd() * tones.length)];
    for (let y = 0; y < h; y++) px(ctx, x + (y > h / 2 ? 1 : 0), groundY - y, 1, 1, c);
  }
}

function flowerDots(ctx, W, groundY, spread, count, colours, rnd) {
  for (let i = 0; i < count; i++) {
    const x = Math.round(rnd() * W), y = groundY + Math.round(rnd() * spread);
    const c = colours[Math.floor(rnd() * colours.length)];
    px(ctx, x, y, 1, 1, c);
    px(ctx, x - 1, y, 1, 1, c); px(ctx, x + 1, y, 1, 1, c);
    px(ctx, x, y - 1, 1, 1, c); px(ctx, x, y + 1, 1, 1, c);
    px(ctx, x, y, 1, 1, "#fff3c4");
  }
}

function sunDisc(ctx, cx, cy, r, core, halo) {
  for (let y = -r * 2; y <= r * 2; y++) {
    for (let x = -r * 2; x <= r * 2; x++) {
      const d = Math.sqrt(x * x + y * y);
      if (d <= r) px(ctx, cx + x, cy + y, 1, 1, core);
      else if (d <= r * 1.9 && ((BAYER4[(cy + y) & 3][(cx + x) & 3] + 0.5) / 16) < (1 - (d - r) / (r * 0.9)))
        px(ctx, cx + x, cy + y, 1, 1, halo);
    }
  }
}

/* sparkles / fireflies scattered through a scene */
function motes(ctx, W, H, count, colour, rnd, yMin, yMax) {
  for (let i = 0; i < count; i++) {
    const x = Math.round(rnd() * W);
    const y = Math.round((yMin || 0) + rnd() * ((yMax || H) - (yMin || 0)));
    px(ctx, x, y, 1, 1, colour);
    if (rnd() > 0.7) { px(ctx, x - 1, y, 1, 1, colour); px(ctx, x + 1, y, 1, 1, colour); px(ctx, x, y - 1, 1, 1, colour); px(ctx, x, y + 1, 1, 1, colour); }
  }
}

/* =========================================================
   SPRITES — every character drawn pixel by pixel
   Each returns its own canvas so it can be composited into a
   scene or shown on its own, always on the same pixel grid.
   ========================================================= */

function spriteCanvas(w, h) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const ctx = c.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  return { c, ctx };
}

/* ---------- the cat: our narrator ---------- */
const CAT = { fur: "#fdfaf2", fur2: "#ece5d6", fur3: "#d6cdba", ink: "#3b3128", blush: "#ffb3c4" };

function drawCat(mood) {
  const { c, ctx } = spriteCanvas(40, 36);
  const F = CAT.fur, F2 = CAT.fur2, F3 = CAT.fur3, I = CAT.ink, B = CAT.blush;

  // tail curls round the right side
  px(ctx, 30, 26, 6, 3, F2); px(ctx, 34, 22, 3, 5, F2); px(ctx, 33, 20, 4, 2, F);

  // body
  px(ctx, 10, 18, 20, 15, F);
  px(ctx, 10, 29, 20, 4, F2);
  px(ctx, 11, 31, 18, 2, F3);

  // ears
  px(ctx, 10, 6, 5, 6, F); px(ctx, 25, 6, 5, 6, F);
  px(ctx, 11, 8, 3, 3, "#f2c9d4"); px(ctx, 26, 8, 3, 3, "#f2c9d4");

  // head
  px(ctx, 8, 9, 24, 14, F);
  px(ctx, 8, 20, 24, 3, F2);

  // paws
  px(ctx, 12, 30, 5, 3, F); px(ctx, 23, 30, 5, 3, F);

  if (mood === "cry") {
    // big teary eyes
    px(ctx, 12, 12, 7, 8, I); px(ctx, 21, 12, 7, 8, I);
    px(ctx, 13, 13, 3, 3, "#fff"); px(ctx, 22, 13, 3, 3, "#fff");
    px(ctx, 14, 17, 2, 2, "#fff"); px(ctx, 23, 17, 2, 2, "#fff");
    px(ctx, 13, 20, 3, 5, "#8fd0ee"); px(ctx, 23, 20, 3, 6, "#8fd0ee");
    px(ctx, 13, 24, 3, 3, "#b3e2f7"); px(ctx, 23, 25, 3, 3, "#b3e2f7");
    px(ctx, 18, 21, 4, 2, I);
  } else if (mood === "happy") {
    px(ctx, 13, 14, 4, 2, I); px(ctx, 23, 14, 4, 2, I);     // ^ ^ eyes
    px(ctx, 12, 15, 2, 2, I); px(ctx, 16, 15, 2, 2, I);
    px(ctx, 22, 15, 2, 2, I); px(ctx, 26, 15, 2, 2, I);
    px(ctx, 18, 18, 4, 2, "#e79aa8");
    px(ctx, 17, 20, 6, 2, I);
    px(ctx, 9, 16, 3, 3, B); px(ctx, 28, 16, 3, 3, B);
  } else if (mood === "shock") {
    px(ctx, 12, 12, 6, 7, "#fff"); px(ctx, 22, 12, 6, 7, "#fff");
    px(ctx, 14, 14, 3, 4, I); px(ctx, 24, 14, 3, 4, I);
    px(ctx, 17, 20, 6, 4, I);
  } else if (mood === "love") {
    px(ctx, 12, 13, 2, 2, "#ff5f8d"); px(ctx, 15, 13, 2, 2, "#ff5f8d");
    px(ctx, 12, 15, 5, 2, "#ff5f8d"); px(ctx, 13, 17, 3, 1, "#ff5f8d");
    px(ctx, 23, 13, 2, 2, "#ff5f8d"); px(ctx, 26, 13, 2, 2, "#ff5f8d");
    px(ctx, 23, 15, 5, 2, "#ff5f8d"); px(ctx, 24, 17, 3, 1, "#ff5f8d");
    px(ctx, 18, 19, 4, 2, "#e79aa8");
    px(ctx, 17, 21, 6, 1, I);
    px(ctx, 9, 16, 3, 3, B); px(ctx, 28, 16, 3, 3, B);
  } else { /* idle */
    px(ctx, 13, 13, 4, 5, I); px(ctx, 23, 13, 4, 5, I);
    px(ctx, 14, 14, 2, 2, "#fff"); px(ctx, 24, 14, 2, 2, "#fff");
    px(ctx, 18, 19, 4, 2, "#e79aa8");
    px(ctx, 17, 21, 6, 1, I);
    px(ctx, 9, 16, 3, 3, B); px(ctx, 28, 16, 3, 3, B);
  }
  // whiskers
  px(ctx, 4, 17, 4, 1, F3); px(ctx, 32, 17, 4, 1, F3);
  return c;
}

/* ---------- the bear: the jumpscare ---------- */
function drawBear() {
  const { c, ctx } = spriteCanvas(64, 56);
  const B1 = "#b5793f", B2 = "#96602f", B3 = "#754825", M = "#e8b98c";
  // arms flung wide
  px(ctx, 2, 12, 10, 8, B2); px(ctx, 0, 8, 8, 8, B1);
  px(ctx, 52, 12, 10, 8, B2); px(ctx, 56, 8, 8, 8, B1);
  px(ctx, 1, 6, 6, 4, B3); px(ctx, 57, 6, 6, 4, B3);   // claws
  // body
  px(ctx, 16, 20, 32, 30, B1);
  px(ctx, 20, 30, 24, 20, M);
  px(ctx, 16, 44, 32, 6, B2);
  // legs
  px(ctx, 18, 48, 11, 8, B2); px(ctx, 35, 48, 11, 8, B2);
  // ears
  px(ctx, 15, 2, 10, 9, B1); px(ctx, 39, 2, 10, 9, B1);
  px(ctx, 17, 4, 6, 5, B3); px(ctx, 41, 4, 6, 5, B3);
  // head
  px(ctx, 14, 6, 36, 22, B1);
  px(ctx, 22, 18, 20, 12, M);
  // eyes, furious
  px(ctx, 21, 12, 6, 5, "#fff"); px(ctx, 37, 12, 6, 5, "#fff");
  px(ctx, 23, 13, 3, 4, "#2a1a10"); px(ctx, 39, 13, 3, 4, "#2a1a10");
  px(ctx, 20, 9, 8, 2, B3); px(ctx, 36, 9, 8, 2, B3);
  // snout + roaring mouth
  px(ctx, 28, 19, 8, 4, B3);
  px(ctx, 25, 23, 14, 9, "#7a2a2a");
  px(ctx, 27, 23, 10, 3, "#fff");
  px(ctx, 28, 29, 8, 3, "#e0576b");
  return c;
}

/* ---------- fox, butterflies, letter ---------- */
function drawFox() {
  const { c, ctx } = spriteCanvas(38, 26);
  const O = "#f08b3c", O2 = "#d46f26", W = "#fff3e2", I = "#3b2a1a";
  px(ctx, 2, 12, 16, 6, O2); px(ctx, 0, 8, 8, 7, O); px(ctx, 0, 8, 5, 4, W);  // tail
  px(ctx, 14, 10, 16, 11, O);
  px(ctx, 16, 18, 12, 4, O2);
  px(ctx, 24, 4, 12, 11, O);            // head
  px(ctx, 24, 2, 5, 6, O2); px(ctx, 32, 2, 5, 6, O2);
  px(ctx, 25, 3, 3, 4, "#f7c4a0"); px(ctx, 33, 3, 3, 4, "#f7c4a0");
  px(ctx, 27, 10, 9, 5, W);
  px(ctx, 27, 7, 2, 3, I); px(ctx, 33, 7, 2, 3, I);
  px(ctx, 34, 11, 3, 2, I);
  px(ctx, 16, 21, 5, 4, O2); px(ctx, 24, 21, 5, 4, O2);
  return c;
}

function drawButterfly(colour) {
  const { c, ctx } = spriteCanvas(20, 16);
  const A = colour === "blue" ? "#6fb4ee" : "#f4685a";
  const B = colour === "blue" ? "#3f82c6" : "#c8402f";
  const D = colour === "blue" ? "#2b5f96" : "#982c20";
  const E = colour === "blue" ? "#cfe8ff" : "#ffdcb0";
  // upper wings: teardrops sweeping up and out from the body
  blob(ctx, 6, 5, 5, 4, [E, A, B, D]);
  blob(ctx, 14, 5, 5, 4, [E, A, B, D]);
  // lower wings, smaller and rounder
  blob(ctx, 7, 10, 3.6, 3.2, [A, B, D, D]);
  blob(ctx, 13, 10, 3.6, 3.2, [A, B, D, D]);
  // wing markings
  px(ctx, 4, 4, 2, 1, E); px(ctx, 14, 4, 2, 1, E);
  px(ctx, 6, 11, 1, 1, "#fff3d0"); px(ctx, 13, 11, 1, 1, "#fff3d0");
  // body + antennae
  px(ctx, 9, 3, 2, 10, "#3b2a1a");
  px(ctx, 9, 12, 2, 2, "#5a4230");
  px(ctx, 7, 0, 1, 3, "#3b2a1a"); px(ctx, 12, 0, 1, 3, "#3b2a1a");
  px(ctx, 6, 0, 1, 1, "#3b2a1a"); px(ctx, 13, 0, 1, 1, "#3b2a1a");
  return c;
}

function drawEnvelope(open) {
  const { c, ctx } = spriteCanvas(44, 32);
  const P = "#fffaf0", P2 = "#efe3cd", L = "#d8c9ad";
  px(ctx, 2, 6, 40, 24, P);
  px(ctx, 2, 6, 40, 1, L); px(ctx, 2, 29, 40, 1, L);
  px(ctx, 2, 6, 1, 24, L); px(ctx, 41, 6, 1, 24, L);
  if (open) {
    px(ctx, 4, 0, 36, 8, P2);
    for (let i = 0; i < 18; i++) { px(ctx, 4 + i, 8 - Math.floor(i / 2.4), 1, 1, L); px(ctx, 39 - i, 8 - Math.floor(i / 2.4), 1, 1, L); }
    px(ctx, 8, 12, 28, 2, "#e6d8bf"); px(ctx, 8, 17, 22, 2, "#e6d8bf"); px(ctx, 8, 22, 25, 2, "#e6d8bf");
  } else {
    for (let i = 0; i < 20; i++) { px(ctx, 2 + i, 6 + Math.floor(i * 0.62), 1, 1, L); px(ctx, 41 - i, 6 + Math.floor(i * 0.62), 1, 1, L); }
    drawHeartInto(ctx, 22, 17, 1, "#e8617f");
  }
  return c;
}

function drawHeartInto(ctx, cx, cy, s, colour) {
  const rows = [
    "0110110", "1111111", "1111111", "0111110", "0011100", "0001000",
  ];
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      if (row[x] === "1") px(ctx, cx - 3 * s + x * s, cy - 3 * s + y * s, s, s, colour);
    }
  });
}

function drawHeartCard() {
  const { c, ctx } = spriteCanvas(28, 28);
  drawHeartInto(ctx, 14, 13, 3, "#ef5f83");
  drawHeartInto(ctx, 13, 12, 1, "#ff9fb6");
  return c;
}

function drawFlowerCard() {
  const { c, ctx } = spriteCanvas(28, 28);
  const P1 = "#f582b0", P2 = "#e0699a", P3 = "#ffc2da";
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    blob(ctx, 14 + Math.cos(a) * 7, 12 + Math.sin(a) * 5, 4.5, 3.4, [P3, P1, P2, P2]);
  }
  blob(ctx, 14, 12, 4, 3, ["#ffe9a0", "#ffd166", "#e0a92f", "#c08c22"]);
  px(ctx, 13, 16, 2, 9, "#4f8a3a");
  px(ctx, 8, 20, 6, 3, "#5ea347"); px(ctx, 15, 22, 6, 3, "#5ea347");
  return c;
}

function drawNyan() {
  const { c, ctx } = spriteCanvas(46, 16);
  const bands = ["#ff4d4d", "#ff9d3c", "#ffe14d", "#5fd35f", "#4da6ff", "#a45fff"];
  bands.forEach((b, i) => px(ctx, 0, 2 + i * 2, 26, 2, b));
  px(ctx, 24, 3, 14, 10, "#f7d0dd");     // pop-tart body
  px(ctx, 26, 5, 10, 6, "#ffb3c9");
  for (let i = 0; i < 6; i++) px(ctx, 27 + (i % 3) * 3, 6 + Math.floor(i / 3) * 3, 1, 1, "#e8617f");
  px(ctx, 36, 2, 9, 9, "#b8b8b8");       // head
  px(ctx, 36, 1, 3, 3, "#b8b8b8"); px(ctx, 42, 1, 3, 3, "#b8b8b8");
  px(ctx, 38, 5, 2, 2, "#2a2a2a"); px(ctx, 42, 5, 2, 2, "#2a2a2a");
  px(ctx, 39, 8, 3, 1, "#2a2a2a");
  return c;
}

/* ---------- the title logo, drawn as pixel letters ---------- */
const HV_FONT = {
  H: ["101", "101", "111", "101", "101"], E: ["111", "100", "111", "100", "111"],
  A: ["111", "101", "111", "101", "101"], R: ["111", "101", "111", "110", "101"],
  T: ["111", "010", "010", "010", "010"], V: ["101", "101", "101", "101", "010"],
  N: ["101", "111", "111", "111", "101"], U: ["101", "101", "101", "101", "111"],
};
function drawLogo(text) {
  const cw = 3, ch = 5, gap = 1, s = 3;
  const { c, ctx } = spriteCanvas(text.length * (cw + gap) * s, ch * s + 2 * s);
  text.split("").forEach((ch2, i) => {
    const g = HV_FONT[ch2];
    if (!g) return;
    for (let y = 0; y < ch; y++) {
      for (let x = 0; x < cw; x++) {
        if (g[y][x] !== "1") continue;
        const dx = i * (cw + gap) * s + x * s, dy = y * s + s;
        px(ctx, dx, dy + s, s, s, "#b8365f");        // drop shadow
        px(ctx, dx, dy, s, s, "#ff5f8d");            // face
        px(ctx, dx, dy, s, Math.max(1, s / 3), "#ffa8c0");  // top light
      }
    }
  });
  return c;
}

/* =========================================================
   SCENES — the backgrounds the adventure walks through

   Built in depth order: sky, far range, mid band, near band,
   foreground. Each band is a different tone family and a different
   density of detail, which is what gives a flat pixel scene the
   feeling of distance.
   ========================================================= */

/* a winding path that narrows toward the horizon, with kerb stones */
function pathTo(ctx, W, yTop, yBot, curve, wTop, wBot, cTop, cMid, cEdge) {
  for (var y = yTop; y < yBot; y++) {
    var t = (y - yTop) / (yBot - yTop);
    var cx = Math.round(W * 0.5 + Math.sin(t * curve) * (26 + t * 14));
    var w = Math.round(wTop + t * (wBot - wTop));
    px(ctx, cx - (w >> 1), y, w, 1, t > 0.45 ? cMid : cTop);
    px(ctx, cx - (w >> 1), y, 2, 1, cEdge);
    px(ctx, cx + (w >> 1) - 2, y, 2, 1, cEdge);
    // worn ruts
    if ((y & 3) === 0) px(ctx, cx - (w >> 3), y, Math.max(1, w >> 3), 1, cTop);
  }
}

function bush(ctx, x, y, r, tones, rnd) {
  blob(ctx, x, y, r, r * 0.68, tones);
  blob(ctx, x - r * 0.6, y + r * 0.2, r * 0.6, r * 0.46, tones);
  blob(ctx, x + r * 0.62, y + r * 0.18, r * 0.62, r * 0.48, tones);
  for (var i = 0; i < r; i++) px(ctx, x - r + rnd() * r * 2, y - r * 0.5 + rnd() * r, 1, 1, tones[0]);
}

function stones(ctx, W, y, count, tones, rnd) {
  for (var i = 0; i < count; i++) {
    var x = rnd() * W, s = 1 + rnd() * 2.5;
    blob(ctx, x, y + rnd() * 10, s * 1.6, s, tones);
  }
}

const HV_SCENES = {

  /* 1. cherry-blossom park — the title screen and the first choice */
  sakura(ctx, rnd) {
    ditherSky(ctx, 0, 0, PXW, PXH, [
      { p: 0.00, c: "#a9dcf2" }, { p: 0.24, c: "#c6e6f5" },
      { p: 0.46, c: "#e6eff5" }, { p: 0.64, c: "#f8e6ee" }, { p: 1.00, c: "#ffeef4" },
    ]);
    cloudRow(ctx, PXW, 22, 5, ["#ffffff", "#f6f8fc", "#e4eaf4", "#d0d9e9"], rnd, 1.15);
    cloudRow(ctx, PXW, 44, 3, ["#fdfeff", "#eff4fa", "#dde5f0", "#cbd5e6"], rnd, 0.75);

    /* far hills, hazed toward the sky so they sit back */
    hillBand(ctx, PXW, 84, 5, 0.016, ["#cfe0c6", "#bcd3b4", "#a9c4a2"], rnd, 1.2);
    hillBand(ctx, PXW, 92, 4, 0.024, ["#bcd6b0", "#a7c69c", "#94b489"], rnd, 3.4);

    /* a distant blossom line — small, pale, low contrast */
    for (var i = 0; i < 16; i++) {
      var bx = rnd() * PXW;
      blob(ctx, bx, 88 + rnd() * 6, 11 + rnd() * 8, 6 + rnd() * 4,
        ["#ffe3ee", "#f9cfe0", "#efbdd2", "#e3adc4"]);
      px(ctx, bx, 94, 2, 6, "#b99a8a");
    }

    /* grass, blending out of the hill line rather than cutting */
    ditherSky(ctx, 0, 98, PXW, PXH - 98, [
      { p: 0.00, c: "#9ecb72" }, { p: 0.22, c: "#8fc064" },
      { p: 0.6, c: "#7fb056" }, { p: 1.00, c: "#6b9a46" },
    ]);

    pathTo(ctx, PXW, 112, PXH, 1.5, 11, 74, "#eddcb8", "#e0cba1", "#cdb689");
    stones(ctx, PXW, 150, 14, ["#d6c9ab", "#bfb094", "#a2937a"], rnd);

    /* mid blossom trees — varied heights so the canopy is not a band */
    var sak = ["#ffdcea", "#f9c2d8", "#eda9c5", "#d98fb0"];
    var midTrees = [[26, 116, 21], [82, 110, 15], [148, 118, 24], [210, 112, 17], [268, 116, 20], [304, 108, 14]];
    midTrees.forEach(function (t) {
      trunk(ctx, t[0], t[1], Math.round(t[2] * 1.5), Math.max(3, Math.round(t[2] * 0.26)),
        ["#a8794f", "#8a6039", "#6b4526"]);
      canopy(ctx, t[0], t[1] - t[2] * 1.62, t[2], sak, rnd, "#fff2f7");
    });

    /* near trees, bigger and darker, framing the edges */
    [[8, 140, 30], [PXW - 12, 136, 33]].forEach(function (t) {
      trunk(ctx, t[0], t[1], Math.round(t[2] * 1.7), Math.round(t[2] * 0.3),
        ["#9c6f46", "#7d5432", "#5e3d22"]);
      canopy(ctx, t[0], t[1] - t[2] * 1.75, t[2], ["#ffd2e4", "#f2b3ce", "#e09bba", "#c8809f"], rnd, "#fff6fa");
    });

    bush(ctx, 44, 148, 8, ["#8fc064", "#7aa94f", "#63903c", "#4e7530"], rnd);
    bush(ctx, PXW - 52, 152, 9, ["#8fc064", "#7aa94f", "#63903c", "#4e7530"], rnd);
    bush(ctx, 118, 168, 7, ["#96c86b", "#7fae52", "#67953e", "#517a31"], rnd);

    grassTufts(ctx, PXW, 126, 150, ["#8fc063", "#7ba84f", "#a4d178"], rnd);
    flowerDots(ctx, PXW, 122, 52, 40, ["#ffffff", "#ffe6f0", "#ffd166", "#ffc2da"], rnd);
    // fallen petals collecting on the grass
    for (var k = 0; k < 60; k++) px(ctx, rnd() * PXW, 118 + rnd() * 60, 2, 1, "#ffcfe0");
  },

  /* 2. deep forest — the secret path */
  forest(ctx, rnd) {
    ditherSky(ctx, 0, 0, PXW, PXH, [
      { p: 0.00, c: "#8fcfe4" }, { p: 0.22, c: "#b2dfe8" },
      { p: 0.44, c: "#d2ead9" }, { p: 1.00, c: "#bcd9a8" },
    ]);
    sunRays(ctx, PXW * 0.32, -14, PXW, PXH, "#fff8d8", rnd, 7);

    /* three canopy depths, darkening toward the viewer */
    for (var d = 0; d < 3; d++) {
      var tone = [["#bcd98a", "#a3c46e", "#89aa56", "#6f8f42"],
                  ["#a8cc72", "#8bb057", "#6f9440", "#57782e"],
                  ["#8fb85e", "#749b45", "#5a7d33", "#436024"]][d];
      var n = [10, 9, 8][d];
      for (var i = 0; i < n; i++) {
        blob(ctx, rnd() * PXW, 10 + d * 16 + rnd() * 20, 24 + rnd() * 18, 12 + rnd() * 9, tone);
      }
    }

    ditherSky(ctx, 0, 104, PXW, PXH - 104, [
      { p: 0.00, c: "#7fae54" }, { p: 0.35, c: "#6b9945" }, { p: 1.00, c: "#527a34" },
    ]);
    pathTo(ctx, PXW, 112, PXH, 2.1, 10, 78, "#c9aa79", "#b99a68", "#a4855a");

    /* the fork the story talks about — a second track peeling left */
    for (var y = 126; y < 168; y++) {
      var t = (y - 126) / 42;
      var fx = Math.round(PXW * 0.5 - 30 - t * 62);
      px(ctx, fx, y, Math.round(6 + t * 16), 1, "#bda06f");
    }

    stones(ctx, PXW, 140, 18, ["#a89b82", "#8d8170", "#6f6558"], rnd);

    var bark = ["#a37a4c", "#836039", "#644727"];
    [[14, 1.0], [PXW - 18, 1.0], [58, 0.62], [PXW - 68, 0.66], [104, 0.42]].forEach(function (t) {
      trunk(ctx, t[0], PXH, Math.round(PXH * t[1]), Math.round(15 * t[1]), bark);
      canopy(ctx, t[0], PXH - PXH * t[1] + 8, 27 * t[1],
        ["#a3c96e", "#84ac52", "#65873b", "#4b6729"], rnd, "#cbe89c");
      // moss on the lit side
      for (var m = 0; m < 12 * t[1]; m++) px(ctx, t[0] - 7 * t[1] + rnd() * 4, PXH - rnd() * 60 * t[1], 2, 1, "#6f9440");
    });

    bush(ctx, 74, 156, 10, ["#8bb057", "#739642", "#5c7c33", "#476226"], rnd);
    bush(ctx, PXW - 84, 162, 11, ["#8bb057", "#739642", "#5c7c33", "#476226"], rnd);
    // ferns
    for (var f = 0; f < 16; f++) {
      var fx2 = rnd() * PXW, fy = 140 + rnd() * 36;
      for (var b2 = 0; b2 < 5; b2++) {
        var a2 = -1.2 + b2 * 0.6;
        px(ctx, fx2 + Math.cos(a2) * 5, fy + Math.sin(a2) * 4 - 3, 2, 1, "#6f9440");
      }
    }
    grassTufts(ctx, PXW, 124, 140, ["#7fab4e", "#93bd5e", "#6a9440"], rnd);
    flowerDots(ctx, PXW, 138, 34, 16, ["#ffffff", "#ffd166", "#c9a0ff"], rnd);
  },

  /* 3. mushroom hollow — where the fox is */
  hollow(ctx, rnd) {
    ditherSky(ctx, 0, 0, PXW, PXH, [
      { p: 0.00, c: "#7fc2dc" }, { p: 0.28, c: "#a8d5dd" },
      { p: 0.54, c: "#c9e2c6" }, { p: 1.00, c: "#b2cf9c" },
    ]);
    sunRays(ctx, PXW * 0.62, -10, PXW, PXH, "#fffbe0", rnd, 6);
    for (var i = 0; i < 20; i++) {
      blob(ctx, rnd() * PXW, 12 + rnd() * 34, 24 + rnd() * 18, 13 + rnd() * 10,
        ["#a3c470", "#83a653", "#63853c", "#4a662c"]);
    }

    /* pale birch trunks with real bark marks */
    [[36, 0.98], [92, 0.82], [PXW - 50, 0.92], [PXW - 108, 0.76], [160, 0.6]].forEach(function (t) {
      var h = Math.round(140 * t[1]);
      trunk(ctx, t[0], PXH - 34, h, Math.round(11 * t[1]), ["#f2ece0", "#d8ccb6", "#b0a48c"]);
      for (var k = 0; k < 6; k++) {
        px(ctx, t[0] - 4 * t[1], PXH - 50 - k * 20 - rnd() * 10, Math.round(6 * t[1]), 1, "#7d7460");
      }
    });

    ditherSky(ctx, 0, 116, PXW, PXH - 116, [
      { p: 0.00, c: "#7aa54c" }, { p: 0.42, c: "#658c3c" }, { p: 1.00, c: "#4e6d2f" },
    ]);
    pathTo(ctx, PXW, 122, PXH, 1.2, 12, 66, "#c2a473", "#ae9163", "#997d52");

    /* red-capped mushrooms, in a cluster like the reference */
    [[70, 144, 1.7], [96, 152, 1.15], [110, 143, 0.85], [PXW - 92, 148, 1.8],
     [PXW - 62, 156, 1.05], [PXW - 118, 158, 0.9]].forEach(function (m) {
      var x = m[0], y = m[1], s = m[2];
      px(ctx, x - Math.round(3 * s), y, Math.round(6 * s), Math.round(12 * s), "#f2e8d2");
      px(ctx, x - Math.round(3 * s), y, Math.round(2 * s), Math.round(12 * s), "#fffaf0");
      blob(ctx, x, y - Math.round(2 * s), Math.round(11 * s), Math.round(6.5 * s),
        ["#f7715a", "#dd4f3a", "#b83a28", "#8f2a1d"]);
      for (var k2 = 0; k2 < 5; k2++) {
        px(ctx, x - 7 * s + rnd() * 14 * s, y - 5 * s + rnd() * 5 * s, 2, 1, "#fff3e0");
      }
      // a little glow under the cap
      px(ctx, x - Math.round(4 * s), y - 1, Math.round(8 * s), 1, "#ffb99a");
    });

    bush(ctx, 138, 168, 9, ["#83a653", "#6b8b41", "#557032", "#425826"], rnd);
    bush(ctx, PXW - 146, 172, 8, ["#83a653", "#6b8b41", "#557032", "#425826"], rnd);
    stones(ctx, PXW, 150, 16, ["#a89b82", "#8d8170", "#6f6558"], rnd);
    grassTufts(ctx, PXW, 132, 150, ["#7fab4e", "#93bd5e", "#5f8639"], rnd);
    flowerDots(ctx, PXW, 130, 46, 26, ["#ff8fa8", "#ffd166", "#ffffff", "#c9a0ff"], rnd);
  },

  /* 4. golden meadow — "it's getting dark" */
  meadow(ctx, rnd) {
    ditherSky(ctx, 0, 0, PXW, PXH, [
      { p: 0.00, c: "#7fb8dc" }, { p: 0.20, c: "#b0d4e4" },
      { p: 0.40, c: "#ecdcae" }, { p: 0.58, c: "#f8cf8c" },
      { p: 0.76, c: "#f0b878" }, { p: 1.00, c: "#dda668" },
    ]);
    cloudRow(ctx, PXW, 30, 4, ["#fff3d6", "#f7dcae", "#e8c088", "#d0a068"], rnd, 1.2);
    sunDisc(ctx, Math.round(PXW * 0.66), 60, 14, "#fffdf0", "#ffeeb8");
    sunRays(ctx, PXW * 0.66, 60, PXW, PXH, "#fff3c8", rnd, 8);

    hillBand(ctx, PXW, 92, 6, 0.018, ["#d6cf86", "#b6ae66", "#968f4f"], rnd, 0.5);
    hillBand(ctx, PXW, 104, 5, 0.026, ["#c6bd72", "#a49b56", "#867e43"], rnd, 2.6);
    hillBand(ctx, PXW, 118, 4, 0.034, ["#b8ae64", "#98904c", "#7a733a"], rnd, 4.8);

    ditherSky(ctx, 0, 130, PXW, PXH - 130, [
      { p: 0.00, c: "#c6b85e" }, { p: 0.5, c: "#aa9c4a" }, { p: 1.00, c: "#8b7f39" },
    ]);
    pathTo(ctx, PXW, 134, PXH, 1.0, 10, 60, "#e0cd8e", "#cbb87b", "#b4a268");

    /* backlit trees — dark shapes with a hot rim on the sun side */
    [[42, 1.05], [PXW - 56, 0.9], [136, 0.62], [212, 0.5]].forEach(function (t) {
      trunk(ctx, t[0], 136, Math.round(48 * t[1]), Math.round(6 * t[1]), ["#7a6a3c", "#5e5230", "#463c22"]);
      canopy(ctx, t[0], 136 - 48 * t[1], 21 * t[1],
        ["#d6cf86", "#9c9a52", "#73723a", "#56562c"], rnd, "#fff0b8");
    });
    // fence posts leading off toward the light
    for (var f = 0; f < 8; f++) {
      var fx = 30 + f * 36, fy = 142 + f * 2;
      px(ctx, fx, fy - 12, 2, 12, "#8a7a48");
      if (f) px(ctx, fx - 34, fy - 9, 34, 1, "#8a7a48");
    }
    grassTufts(ctx, PXW, 142, 190, ["#d2c46a", "#b8ab58", "#e0d27c"], rnd);
    flowerDots(ctx, PXW, 146, 30, 22, ["#fff3c4", "#ffd166", "#ffffff"], rnd);
  },

  /* 5. sunset lake — the ask */
  sunset(ctx, rnd) {
    ditherSky(ctx, 0, 0, PXW, PXH, [
      { p: 0.00, c: "#33306a" }, { p: 0.16, c: "#514585" },
      { p: 0.32, c: "#7d5798" }, { p: 0.46, c: "#bf7290" },
      { p: 0.58, c: "#ee9a72" }, { p: 0.66, c: "#f5b982" },
      { p: 0.74, c: "#7fa8d8" }, { p: 1.00, c: "#42639c" },
    ]);
    for (var i = 0; i < 90; i++) {
      var sy = rnd() * 34;
      px(ctx, rnd() * PXW, sy, 1, 1, sy < 16 ? "#fff8e0" : "#ffe9c0");
    }

    /* the banded clouds, lit underneath */
    var cl = ["#ffd8a0", "#f7a278", "#e07a62", "#b45a5c"];
    for (var b = 0; b < 6; b++) {
      var y = 24 + b * 11 + rnd() * 4;
      var n = 2 + Math.floor(rnd() * 3);
      for (var k = 0; k < n; k++) {
        var cx = rnd() * PXW, w = 26 + rnd() * 34, h = 3 + rnd() * 3;
        blob(ctx, cx, y, w, h, cl);
        px(ctx, cx - w, y + h - 1, w * 2, 1, "#ffe3b0");
      }
    }

    hillBand(ctx, PXW, 84, 13, 0.015, ["#5f74a8", "#4c5f8e", "#3e5078"], rnd, 2);
    hillBand(ctx, PXW, 96, 9, 0.024, ["#42588a", "#364a70", "#2c3d5e"], rnd, 5);
    hillBand(ctx, PXW, 108, 6, 0.033, ["#33475e", "#293a4e", "#20303f"], rnd, 8);

    pineRow(ctx, PXW, 124, 52, ["#2d4c54", "#203a42", "#172a30"], rnd, 1.05);

    /* the lake, with a sun road down the middle */
    ditherSky(ctx, 0, 124, PXW, 22, [
      { p: 0.00, c: "#7fa2ce" }, { p: 0.45, c: "#5b81a8" }, { p: 1.00, c: "#43608a" },
    ]);
    for (var w2 = 0; w2 < 54; w2++) px(ctx, rnd() * PXW, 125 + rnd() * 20, 2 + rnd() * 5, 1, "#a4c2e4");
    for (var g = 0; g < 26; g++) {
      px(ctx, PXW * 0.44 + rnd() * 44, 125 + rnd() * 19, 1 + rnd() * 4, 1, rnd() > 0.5 ? "#ffdca8" : "#ffc482");
    }

    px(ctx, 0, 144, PXW, 6, "#31402f");
    ditherSky(ctx, 0, 149, PXW, PXH - 149, [
      { p: 0.00, c: "#4c5f46" }, { p: 0.45, c: "#3d4f3a" }, { p: 1.00, c: "#2c3a2b" },
    ]);
    // reeds along the bank
    for (var r3 = 0; r3 < 30; r3++) {
      var rx = rnd() * PXW, rh = 5 + rnd() * 9;
      for (var y2 = 0; y2 < rh; y2++) px(ctx, rx + (y2 > rh / 2 ? 1 : 0), 149 - y2, 1, 1, "#54684a");
    }
    grassTufts(ctx, PXW, 158, 150, ["#5c7050", "#4a5c42", "#6b8159"], rnd);
    flowerDots(ctx, PXW, 154, 30, 54, ["#ff9ec4", "#ffd166", "#c9a0ff", "#ffffff"], rnd);
  },
};

/* =========================================================
   ✏️  THE ADVENTURE — CUSTOMIZE ME

   The closing question and its answers are placeholders, same as
   LETTER_TEXT. Replace them with what you actually want to ask.
   ========================================================= */
const QUEST_FINAL = {
  question: "[Replace this with your closing question — the one you actually want to ask her.]",
  yes: "[Her answer — yes]",
  no: "[Her other answer]",
  nudge: "You sure about that?",
  nudgeYes: "I changed my mind",
  nudgeNo: "Yup",
  reply: "[And what you say back when she says yes. Replace this too.]",
};

/* =========================================================
   THE ADVENTURE — a branching pixel-art story

   Scenes are painted to a 320x180 canvas (see pixart.js / scenes.js)
   and scaled up with image-rendering:pixelated. Characters are
   composited into that same canvas so everything shares one pixel
   grid; only text stays as DOM so it renders crisply.
   ========================================================= */

let hvNode = "title";
let hvHistory = [];
let hvFailReturn = null;
let hvRnd = null;
let hvAnimTimer = null;

function hvSeed(name) {
  let x = Math.sin(name.length * 977 + name.charCodeAt(0) * 31) * 65536;
  return () => { x = Math.sin(x * 4321 + 8761) * 65536; return x - Math.floor(x); };
}

/* ---------- the story ----------
   Every node paints a scene, sets what the cat says, and offers
   choices. `pos` places a choice button; `fail` sends her to the
   bear, which returns to this same node. */
const HV = {
  title: {
    scene: "sakura", cat: "happy", title: true,
    say: "Ready for a little adventure?",
    choices: [{ label: "START", to: "pick", style: "start" }],
  },

  pick: {
    scene: "sakura", cat: "idle",
    say: "Pick a heart or a flower?",
    cards: [
      { art: "heart", to: "forest" },
      { art: "flower", to: "forest" },
    ],
  },

  forest: {
    scene: "forest", cat: "idle",
    say: "You found a secret path! Pick left or right?",
    choices: [
      { label: "Go Left", to: "butterfly", pos: "left" },
      { label: "Go Right", to: "bear", pos: "right", fail: true },
    ],
  },

  bear: {
    isFail: true,
    say: "Oops! A bear appeared and ate all your snacks. Try again!",
    back: "forest",
  },

  butterfly: {
    scene: "sakura", cat: "idle", butterflies: true,
    say: "A butterfly appears! Pick red or blue?",
    choices: [
      { label: "BLUE", to: "hollow", pos: "left" },
      { label: "RED", to: "bear2", pos: "right", fail: true },
    ],
  },

  bear2: {
    isFail: true,
    say: "The red one was a decoy. The bear is back and it remembers you.",
    back: "butterfly",
  },

  hollow: {
    scene: "hollow", cat: "happy", fox: true,
    say: "The blue butterfly led you to a shortcut!",
    choices: [
      { label: "keep going", to: "meadow", pos: "left" },
      { label: "Pet me", to: "pet", pos: "right" },
    ],
  },

  pet: {
    scene: "hollow", cat: "love", fox: true,
    say: "The fox accepts exactly one (1) head pat and then pretends it did not happen.",
    choices: [{ label: "keep going", to: "meadow", pos: "left" }],
  },

  meadow: {
    scene: "meadow", cat: "idle",
    say: "It's getting dark!",
    choices: [{ label: "keep going", to: "sunset", pos: "left" }],
  },

  sunset: {
    scene: "sunset", cat: "love",
    say: "What a beautiful sunset! Isn't it?",
    choices: [
      { label: "Where am I?", to: "youllsee", pos: "left" },
      { label: "Mhm!", to: "letter", pos: "right" },
    ],
  },

  youllsee: {
    scene: "sunset", cat: "happy",
    say: "You'll see…",
    choices: [{ label: "okay…", to: "letter", pos: "left" }],
  },

  letter: {
    scene: "sunset", cat: "shock", envelope: "closed",
    say: "Oh look! A letter pops out of nowhere!",
    choices: [{ label: "open it", to: "closer", pos: "left" }],
  },

  closer: {
    scene: "sunset", cat: "idle", envelope: "open",
    say: "Hmmm… the text is too small. Let's take a closer look.",
    choices: [{ label: "lean in", to: "ask", pos: "left" }],
  },

  ask: {
    scene: "sunset", cat: "hide", isAsk: true,
    say: "",
    choices: [
      { label: "YES!", to: "yay", pos: "left", style: "yes" },
      { label: "No…", to: "nudge", pos: "right" },
    ],
  },

  nudge: {
    scene: "sunset", cat: "cry", bigCat: true,
    say: QUEST_FINAL.nudge,
    choices: [
      { label: QUEST_FINAL.nudgeYes, to: "yay", pos: "left", style: "yes" },
      { label: QUEST_FINAL.nudgeNo, to: "reallysure", pos: "right" },
    ],
  },

  reallysure: {
    scene: "sunset", cat: "cry", bigCat: true,
    say: "…the cat is going to sit here until you change your mind.",
    choices: [
      { label: QUEST_FINAL.nudgeYes, to: "yay", pos: "left", style: "yes" },
      { label: "Yup", to: "reallysure", pos: "right" },
    ],
  },

  yay: {
    scene: "sunset", cat: "love", bigCat: true, hearts: true, isEnd: true,
    say: "YAYYY, I love you!",
    choices: [{ label: "close the book 💛", to: "__exit", pos: "left", style: "yes" }],
  },
};

/* ---------- painting ----------
   The background is expensive, so it is painted once into an offscreen
   buffer per node. Every frame then blits that buffer and draws only the
   things that move — petals, butterflies, fireflies, water shimmer, the
   cat's blink. Cheap, and it is what makes the scene feel alive rather
   than like a still image with buttons on top. */

var hvBase = null, hvBaseCtx = null;
var hvActors = [];
var hvLoopId = null, hvT0 = 0;
var hvTrans = null;          // pixel-dissolve state

function hvEnsureBuffers() {
  if (!hvBase) {
    hvBase = document.createElement("canvas");
    hvBase.width = PXW; hvBase.height = PXH;
    hvBaseCtx = hvBase.getContext("2d");
    hvBaseCtx.imageSmoothingEnabled = false;
  }
}

/* Build the moving cast for a scene. Positions are seeded so a scene
   always starts the same way, but they drift with time. */
function hvBuildActors(n, rnd) {
  var a = [];
  var scene = n.scene;

  if (scene === "sakura") {
    for (var i = 0; i < 34; i++) {
      a.push({ k: "petal", x: rnd() * PXW, y: rnd() * PXH, sp: 5 + rnd() * 9,
        sw: 8 + rnd() * 16, ph: rnd() * 6.28, c: rnd() > 0.5 ? "#ffc9dd" : "#ffe3ee", w: 2 });
    }
    a.push({ k: "bird", x: -20, y: 26 + rnd() * 16, sp: 11 + rnd() * 5, ph: rnd() * 6.28 });
  }
  if (scene === "forest") {
    for (var j = 0; j < 22; j++) {
      a.push({ k: "mote", x: rnd() * PXW, y: 30 + rnd() * 90, r: 0.6 + rnd() * 1.4,
        sp: 2 + rnd() * 4, ph: rnd() * 6.28, c: "#fff6c8" });
    }
    for (var l = 0; l < 8; l++) {
      a.push({ k: "petal", x: rnd() * PXW, y: rnd() * PXH, sp: 6 + rnd() * 7,
        sw: 10 + rnd() * 14, ph: rnd() * 6.28, c: "#a8cc72", w: 2 });
    }
  }
  if (scene === "hollow") {
    for (var m = 0; m < 20; m++) {
      a.push({ k: "fly", x: rnd() * PXW, y: 60 + rnd() * 80, r: 6 + rnd() * 14,
        sp: 0.5 + rnd() * 0.9, ph: rnd() * 6.28, c: "#fff2a8" });
    }
  }
  if (scene === "meadow") {
    for (var p = 0; p < 30; p++) {
      a.push({ k: "mote", x: rnd() * PXW, y: 60 + rnd() * 100, r: 0.8 + rnd() * 1.8,
        sp: 2 + rnd() * 5, ph: rnd() * 6.28, c: "#fff6cc" });
    }
  }
  if (scene === "sunset") {
    for (var q = 0; q < 26; q++) {
      a.push({ k: "star", x: rnd() * PXW, y: rnd() * 26, ph: rnd() * 6.28 });
    }
    for (var r2 = 0; r2 < 18; r2++) {
      a.push({ k: "shimmer", x: rnd() * PXW, y: 123 + rnd() * 17, w: 2 + rnd() * 4, ph: rnd() * 6.28 });
    }
    for (var s2 = 0; s2 < 14; s2++) {
      a.push({ k: "fly", x: rnd() * PXW, y: 140 + rnd() * 34, r: 5 + rnd() * 10,
        sp: 0.4 + rnd() * 0.7, ph: rnd() * 6.28, c: "#ffe9a8" });
    }
  }
  return a;
}

function hvDrawActors(ctx, t) {
  for (var i = 0; i < hvActors.length; i++) {
    var a = hvActors[i];
    if (a.k === "petal") {
      var y = (a.y + t * a.sp) % (PXH + 12) - 6;
      var x = a.x + Math.sin(t * 0.9 + a.ph) * a.sw * 0.35;
      px(ctx, x, y, a.w, 1, a.c);
      if (Math.sin(t * 3 + a.ph) > 0) px(ctx, x + 1, y - 1, 1, 1, a.c);
    } else if (a.k === "mote") {
      var my = a.y - ((t * a.sp) % 120);
      if (my < 10) my += 120;
      var mx = a.x + Math.sin(t * 0.6 + a.ph) * 5;
      var tw = 0.55 + 0.45 * Math.sin(t * 2.2 + a.ph);
      if (tw > 0.5) px(ctx, mx, my, Math.max(1, a.r | 0), Math.max(1, a.r | 0), a.c);
    } else if (a.k === "fly") {
      var fa = t * a.sp + a.ph;
      var fx = a.x + Math.cos(fa) * a.r;
      var fy = a.y + Math.sin(fa * 1.3) * a.r * 0.5;
      var pulse = 0.5 + 0.5 * Math.sin(t * 3.1 + a.ph);
      if (pulse > 0.35) {
        px(ctx, fx, fy, 1, 1, a.c);
        if (pulse > 0.75) { px(ctx, fx - 1, fy, 1, 1, a.c); px(ctx, fx + 1, fy, 1, 1, a.c); px(ctx, fx, fy - 1, 1, 1, a.c); px(ctx, fx, fy + 1, 1, 1, a.c); }
      }
    } else if (a.k === "star") {
      var st = 0.5 + 0.5 * Math.sin(t * 1.7 + a.ph);
      if (st > 0.45) px(ctx, a.x, a.y, 1, 1, st > 0.8 ? "#ffffff" : "#fff3d0");
    } else if (a.k === "shimmer") {
      var sh = Math.sin(t * 1.4 + a.ph);
      if (sh > 0) px(ctx, a.x + sh * 3, a.y, a.w, 1, sh > 0.7 ? "#ffe9c0" : "#9dbde0");
    } else if (a.k === "bird") {
      var bx = (a.x + t * a.sp) % (PXW + 40) - 20;
      var by = a.y + Math.sin(t * 0.8 + a.ph) * 4;
      var flap = Math.sin(t * 7 + a.ph) > 0 ? 1 : -1;
      px(ctx, bx, by, 2, 1, "#5a4a3a");
      px(ctx, bx - 2, by - flap, 2, 1, "#5a4a3a");
      px(ctx, bx + 2, by - flap, 2, 1, "#5a4a3a");
    }
  }
}

function hvPaintBase(n) {
  hvEnsureBuffers();
  var ctx = hvBaseCtx;
  ctx.clearRect(0, 0, PXW, PXH);
  var rnd = hvSeed(n.scene + hvNode);
  (HV_SCENES[n.scene] || HV_SCENES.sakura)(ctx, rnd);
  hvActors = hvBuildActors(n, hvSeed(n.scene + "actors"));
}

/* the per-frame pass: background, moving cast, then characters */
function hvPaintFrame(t) {
  var n = HV[hvNode];
  var canvas = document.getElementById("hv-canvas");
  if (!canvas || !n || n.isFail) return;
  var ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;

  ctx.clearRect(0, 0, PXW, PXH);
  ctx.drawImage(hvBase, 0, 0);
  hvDrawActors(ctx, t);

  var rnd = hvSeed(n.scene + hvNode + "fg");
  var put = function (sp, x, y, s) {
    s = s || 1;
    ctx.drawImage(sp, 0, 0, sp.width, sp.height, x | 0, y | 0, (sp.width * s) | 0, (sp.height * s) | 0);
  };

  if (n.title) {
    put(drawNyan(), PXW - 66, 12 + Math.sin(t * 1.4) * 2, 1);
    var logo = drawLogo("HEARTVENTURE");
    put(logo, Math.round((PXW - logo.width * 0.62) / 2), 42 + Math.sin(t * 0.9) * 1.5, 0.62);
  }

  if (n.butterflies) {
    put(drawFlowerCard(), PXW / 2 - 30, 78 + Math.sin(t * 0.8) * 1.5, 2.2);
    /* the butterflies sit close to their buttons so the pairing is obvious */
    put(drawButterfly("blue"), 48 + Math.sin(t * 0.9) * 4, 54 + Math.sin(t * 1.5) * 5, 1.8);
    put(drawButterfly("red"), PXW - 84 + Math.sin(t * 0.8 + 2) * 4, 50 + Math.sin(t * 1.3 + 1) * 5, 1.8);
  }

  if (n.fox) put(drawFox(), PXW - 118, 114 + Math.sin(t * 0.7) * 1, 1.6);

  if (n.envelope) {
    var e = drawEnvelope(n.envelope === "open");
    put(e, PXW / 2 - 33, (n.envelope === "open" ? 32 : 38) + Math.sin(t * 0.9) * 3, 1.5);
    for (var i = 0; i < 14; i++) {
      var sa = t * 1.6 + i;
      if (Math.sin(sa) > 0.2) px(ctx, PXW / 2 - 44 + ((i * 37) % 88), 26 + ((i * 23) % 54) + Math.sin(sa) * 3, 1, 1, "#ffe9a8");
    }
  }

  if (n.isAsk) {
    var cardW = 132, cardH = 104, cx = (PXW - cardW) / 2, cy = 24 + Math.sin(t * 0.7) * 2;
    px(ctx, cx + 3, cy + 4, cardW, cardH, "rgba(60,30,50,.35)");
    px(ctx, cx, cy, cardW, cardH, "#fffaf0");
    px(ctx, cx, cy, cardW, 2, "#ffffff");
    px(ctx, cx, cy + cardH - 2, cardW, 2, "#e6d8bf");
    for (var h = 0; h < 9; h++) {
      drawHeartInto(ctx, cx + 10 + ((h * 41) % (cardW - 20)), cy + 10 + ((h * 29) % (cardH - 20)), 1, "#ffc2d8");
    }
    var kitty = drawCat("idle");
    put(kitty, cx + cardW / 2 - 30, cy + cardH - 62, 1.5);
    drawHeartInto(ctx, cx + cardW - 16, cy + 16, 2, "#ef5f83");
    drawHeartInto(ctx, cx + 14, cy + cardH - 18, 2, "#ff9fb6");
  }

  if (n.hearts) {
    for (var k = 0; k < 14; k++) {
      var hy = 108 - ((t * 12 + k * 19) % 110);
      var hx = 24 + ((k * 47) % (PXW - 48)) + Math.sin(t * 1.1 + k) * 5;
      drawHeartInto(ctx, hx, hy, 1 + (k % 2), "#ff8fb0");
    }
  }

  if (n.cat && n.cat !== "hide") {
    /* a blink every few seconds, and a slow breath */
    var blink = (t % 4.4) > 4.2;
    var mood = blink && (n.cat === "idle" || n.cat === "happy") ? "happy" : n.cat;
    var scale = n.bigCat ? 2.8 : 2.0;
    var sp = drawCat(mood);
    var bob = Math.sin(t * 1.2) * 1.2;
    put(sp, n.bigCat ? PXW / 2 - sp.width * scale / 2 : 6,
        (n.bigCat ? 34 : PXH - sp.height * scale - 4) + bob, scale);
  }
}

/* ---------- pixel dissolve between scenes ----------
   Blocks of the incoming frame appear in a shuffled order. It is the
   transition this kind of game has always used, and it hides the fact
   that the whole background is being repainted. */
function hvStartTransition() {
  var canvas = document.getElementById("hv-canvas");
  if (!canvas) return;
  var prev = document.createElement("canvas");
  prev.width = PXW; prev.height = PXH;
  prev.getContext("2d").drawImage(canvas, 0, 0);

  var B = 8;                                  // block size, in scene pixels
  var cols = Math.ceil(PXW / B), rows = Math.ceil(PXH / B);
  var order = [];
  for (var i = 0; i < cols * rows; i++) order.push(i);
  for (var j = order.length - 1; j > 0; j--) {
    var k = (Math.random() * (j + 1)) | 0;
    var tmp = order[j]; order[j] = order[k]; order[k] = tmp;
  }
  hvTrans = { prev: prev, order: order, cols: cols, rows: rows, B: B, t: 0, dur: 0.42 };
}

function hvDrawTransition(ctx, dt) {
  if (!hvTrans) return false;
  hvTrans.t += dt;
  var p = Math.min(1, hvTrans.t / hvTrans.dur);
  var shown = Math.floor(p * hvTrans.order.length);

  /* everything not yet revealed still shows the outgoing frame */
  var buf = document.createElement("canvas");
  buf.width = PXW; buf.height = PXH;
  var bctx = buf.getContext("2d");
  bctx.imageSmoothingEnabled = false;
  bctx.drawImage(hvTrans.prev, 0, 0);
  bctx.save();
  bctx.beginPath();
  for (var i = 0; i < shown; i++) {
    var idx = hvTrans.order[i];
    var bx = (idx % hvTrans.cols) * hvTrans.B, by = ((idx / hvTrans.cols) | 0) * hvTrans.B;
    bctx.rect(bx, by, hvTrans.B, hvTrans.B);
  }
  bctx.clip();
  bctx.clearRect(0, 0, PXW, PXH);
  bctx.restore();

  ctx.drawImage(buf, 0, 0);
  if (p >= 1) { hvTrans = null; return false; }
  return true;
}

function hvLoop(now) {
  hvLoopId = requestAnimationFrame(hvLoop);
  if (!hvT0) hvT0 = now;
  var t = (now - hvT0) / 1000;
  var dt = Math.min(0.05, t - (hvLoop._last || t));
  hvLoop._last = t;

  var scr = document.getElementById("screen-quest");
  if (!scr || !scr.classList.contains("active")) return;

  hvPaintFrame(t);
  var canvas = document.getElementById("hv-canvas");
  if (canvas && hvTrans) hvDrawTransition(canvas.getContext("2d"), dt);
}

function hvStartLoop() {
  if (hvLoopId) return;
  hvT0 = 0; hvLoop._last = 0;
  hvLoopId = requestAnimationFrame(hvLoop);
}
function hvStopLoop() {
  if (hvLoopId) cancelAnimationFrame(hvLoopId);
  hvLoopId = null;
}

function hvPaintFail() {
  var canvas = document.getElementById("hv-fail-canvas");
  if (!canvas) return;
  var ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  var rnd = hvSeed("bear");
  HV_SCENES.forest(ctx, rnd);
  ctx.save(); ctx.globalAlpha = 0.45; px(ctx, 0, 0, PXW, PXH, "#2a1408"); ctx.restore();
  var bear = drawBear();
  ctx.drawImage(bear, 0, 0, bear.width, bear.height,
    PXW / 2 - bear.width * 1.7 / 2, 26, bear.width * 1.7, bear.height * 1.7);
}

/* ---------- rendering the DOM layer ---------- */
function hvRender(withTransition) {
  const n = HV[hvNode];
  if (!n) return;

  if (n.isFail) {
    hvFailReturn = n.back;
    hvPaintFail();
    document.getElementById("hv-fail-text").textContent = n.say;
    document.getElementById("hv-fail").classList.add("on");
    return;
  }

  /* Any non-fail node clears the bear. Without this, going back while
     the overlay is up leaves it stuck over every later screen. */
  document.getElementById("hv-fail").classList.remove("on");

  if (withTransition) hvStartTransition();
  hvPaintBase(n);
  hvStartLoop();

  const note = document.getElementById("hv-note");
  const say = n.isAsk ? QUEST_FINAL.question : n.say;
  note.textContent = say;
  note.classList.toggle("hidden", !say);
  note.classList.toggle("hv-note-ask", !!n.isAsk);

  document.getElementById("hv-back").disabled = hvHistory.length === 0;

  const left = document.getElementById("hv-left");
  const right = document.getElementById("hv-right");
  const centre = document.getElementById("hv-centre");
  const cards = document.getElementById("hv-cards");
  [left, right, centre, cards].forEach((el) => { el.innerHTML = ""; });

  if (n.cards) {
    n.cards.forEach((cd) => {
      const b = document.createElement("button");
      b.className = "hv-card";
      const art = cd.art === "heart" ? drawHeartCard() : drawFlowerCard();
      art.className = "hv-card-art";
      b.appendChild(art);
      b.addEventListener("click", () => hvChoose(cd));
      cards.appendChild(b);
    });
  }

  (n.choices || []).forEach((ch) => {
    const b = document.createElement("button");
    b.className = "hv-btn" + (ch.style ? " hv-btn-" + ch.style : "");
    b.textContent = ch.label;
    b.addEventListener("click", () => hvChoose(ch));
    (ch.pos === "left" ? left : ch.pos === "right" ? right : centre).appendChild(b);
  });

  /* the butterfly page pairs each button with its butterfly, so put the
     buttons where the butterflies actually are */
  document.getElementById("screen-quest").classList.toggle("hv-pair", !!n.butterflies);

  if (n.isEnd) hvCompleted = true;
}

let hvCompleted = false;

function hvChoose(ch) {
  if (ch.to === "__exit") {
    hvStopLoop();
    markChapterDone("quest");
    pageTurn("hub", startHub);
    return;
  }
  const target = HV[ch.to];
  if (target && target.isFail) {
    hvNode = ch.to;
    hvRender();
    return;
  }
  hvHistory.push(hvNode);
  hvNode = ch.to;
  hvRender(true);
}

function hvRetry() {
  document.getElementById("hv-fail").classList.remove("on");
  if (hvFailReturn) hvNode = hvFailReturn;   // back to the choice, not the start
  hvFailReturn = null;
  hvRender(true);
}

function hvBack() {
  if (!hvHistory.length) return;
  hvNode = hvHistory.pop();
  hvRender(true);
}

function startQuest() {
  hvNode = "title";
  hvHistory = [];
  hvFailReturn = null;
  document.getElementById("hv-fail").classList.remove("on");
  hvRender(false);
}

document.getElementById("hv-retry").addEventListener("click", hvRetry);
document.getElementById("hv-back").addEventListener("click", hvBack);
document.getElementById("hv-quit").addEventListener("click", () => { hvStopLoop(); pageTurn("hub", startHub); });
