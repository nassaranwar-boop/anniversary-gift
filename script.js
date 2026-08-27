
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
   ========================================================= */

const HV_SCENES = {

  /* 1. cherry-blossom park — the title screen and the first choice */
  sakura(ctx, rnd) {
    ditherSky(ctx, 0, 0, PXW, PXH, [
      { p: 0.00, c: "#bfe4f2" }, { p: 0.30, c: "#dbeef7" },
      { p: 0.52, c: "#f6e6ee" }, { p: 0.70, c: "#fbe8ef" }, { p: 1.00, c: "#ffeef4" },
    ]);
    cloudRow(ctx, PXW, 26, 4, ["#ffffff", "#f4f6fb", "#e2e8f2", "#cfd8e8"], rnd, 1.1);

    // distant blossom haze
    for (let i = 0; i < 14; i++) {
      blob(ctx, rnd() * PXW, 74 + rnd() * 12, 20 + rnd() * 14, 10 + rnd() * 7,
        ["#ffd7e6", "#f8c3d8", "#eeb0ca", "#e2a0bd"]);
    }
    // grass
    ditherSky(ctx, 0, 104, PXW, PXH - 104, [
      { p: 0.00, c: "#a9cf7a" }, { p: 0.35, c: "#93c065" }, { p: 1.00, c: "#79a851" },
    ]);
    // path
    for (let y = 116; y < PXH; y++) {
      const t = (y - 116) / (PXH - 116);
      const cx = Math.round(PXW * 0.5 + Math.sin(t * 1.6) * 26);
      const w = Math.round(12 + t * 58);
      px(ctx, cx - (w >> 1), y, w, 1, t > 0.4 ? "#e8d3ab" : "#dcc59b");
      px(ctx, cx - (w >> 1), y, 2, 1, "#f2e2c2");
    }

    // sakura trees
    const sak = ["#ffd9e8", "#f9bed6", "#eda6c3", "#d98cae"];
    [[34, 118, 26], [PXW - 40, 116, 30], [110, 108, 18], [PXW - 116, 110, 20]].forEach(([x, gy, r]) => {
      trunk(ctx, x, gy, Math.round(r * 1.5), Math.max(3, Math.round(r * 0.28)), ["#a8794f", "#8a6039", "#6b4526"]);
      canopy(ctx, x, gy - r * 1.6, r, sak, rnd, "#fff0f6");
    });
    grassTufts(ctx, PXW, 128, 90, ["#8fc063", "#7ba84f", "#a4d178"], rnd);
    flowerDots(ctx, PXW, 122, 44, 26, ["#ffffff", "#ffe6f0", "#ffd166"], rnd);
    // petals in the air
    for (let i = 0; i < 40; i++) {
      const x = rnd() * PXW, y = rnd() * 130;
      px(ctx, x, y, 2, 1, rnd() > 0.5 ? "#ffc9dd" : "#ffdce9");
    }
  },

  /* 2. deep forest — the secret path */
  forest(ctx, rnd) {
    ditherSky(ctx, 0, 0, PXW, PXH, [
      { p: 0.00, c: "#9fd6e8" }, { p: 0.26, c: "#bfe2ea" },
      { p: 0.48, c: "#d9ecdb" }, { p: 1.00, c: "#c6e0b6" },
    ]);
    sunRays(ctx, PXW * 0.34, -12, PXW, PXH, "#fff8d8", rnd, 6);

    // far canopy wall
    for (let i = 0; i < 22; i++) {
      blob(ctx, rnd() * PXW, 16 + rnd() * 34, 26 + rnd() * 18, 14 + rnd() * 10,
        ["#a8cc72", "#87b055", "#67903f", "#4d722e"]);
    }
    // ground
    ditherSky(ctx, 0, 108, PXW, PXH - 108, [
      { p: 0.00, c: "#84b356" }, { p: 0.4, c: "#6d9a45" }, { p: 1.00, c: "#557a34" },
    ]);
    // dirt trail
    for (let y = 118; y < PXH; y++) {
      const t = (y - 118) / (PXH - 118);
      const cx = Math.round(PXW * 0.5 + Math.sin(t * 2.1 + 1) * 30);
      const w = Math.round(10 + t * 62);
      px(ctx, cx - (w >> 1), y, w, 1, "#b99a68");
      px(ctx, cx - (w >> 1) + 1, y, Math.max(1, w - 2), 1, t > 0.35 ? "#c9aa79" : "#b99a68");
    }
    // big foreground trunks framing the shot
    const bark = ["#9c7448", "#7d5a34", "#5e4223"];
    [[16, 0.9], [PXW - 22, 1.0], [64, 0.55], [PXW - 74, 0.6]].forEach(([x, s]) => {
      trunk(ctx, x, PXH, Math.round(PXH * s), Math.round(14 * s), bark);
      canopy(ctx, x, PXH - PXH * s + 6, 26 * s, ["#9ec86a", "#7fab4e", "#5f8639", "#476628"], rnd, "#c8e79a");
    });
    grassTufts(ctx, PXW, 126, 110, ["#7fab4e", "#93bd5e", "#6a9440"], rnd);
    motes(ctx, PXW, PXH, 26, "#fff6c8", rnd, 30, 120);
  },

  /* 3. mushroom hollow — where the fox is */
  hollow(ctx, rnd) {
    ditherSky(ctx, 0, 0, PXW, PXH, [
      { p: 0.00, c: "#8fc9de" }, { p: 0.30, c: "#b4dbdf" },
      { p: 0.55, c: "#cfe4c8" }, { p: 1.00, c: "#b9d3a4" },
    ]);
    sunRays(ctx, PXW * 0.6, -10, PXW, PXH, "#fffbe0", rnd, 5);
    for (let i = 0; i < 18; i++) {
      blob(ctx, rnd() * PXW, 14 + rnd() * 30, 24 + rnd() * 16, 13 + rnd() * 9,
        ["#9ec06c", "#7ea24f", "#5f813a", "#48642b"]);
    }
    // pale birch trunks
    [[40, 0.95], [96, 0.8], [PXW - 54, 0.9], [PXW - 110, 0.75]].forEach(([x, s]) => {
      trunk(ctx, x, PXH - 40, Math.round(130 * s), Math.round(11 * s), ["#e8e0cf", "#cfc4ac", "#a89b82"]);
      for (let k = 0; k < 5; k++) px(ctx, x - 4, PXH - 60 - k * 22 - rnd() * 8, 6, 1, "#8d8570");
    });
    ditherSky(ctx, 0, 118, PXW, PXH - 118, [
      { p: 0.00, c: "#7fa84e" }, { p: 0.45, c: "#688f3e" }, { p: 1.00, c: "#517031" },
    ]);
    // red-capped mushrooms
    [[86, 142, 1.5], [118, 150, 1.1], [PXW - 96, 146, 1.7], [PXW - 66, 154, 1.0]].forEach(([x, y, s]) => {
      px(ctx, x - Math.round(3 * s), y, Math.round(6 * s), Math.round(11 * s), "#f2e8d2");
      px(ctx, x - Math.round(3 * s), y, Math.round(2 * s), Math.round(11 * s), "#fffaf0");
      blob(ctx, x, y - Math.round(2 * s), Math.round(11 * s), Math.round(6 * s),
        ["#f0674f", "#d94a37", "#b53827", "#8f2a1d"]);
      for (let k = 0; k < 4; k++) px(ctx, x - 7 * s + rnd() * 14 * s, y - 4 * s + rnd() * 4 * s, 2, 1, "#fff3e0");
    });
    grassTufts(ctx, PXW, 134, 120, ["#7fab4e", "#93bd5e", "#5f8639"], rnd);
    flowerDots(ctx, PXW, 132, 40, 18, ["#ff8fa8", "#ffd166", "#ffffff"], rnd);
    motes(ctx, PXW, PXH, 30, "#fff2b8", rnd, 40, 130);
  },

  /* 4. golden meadow — "it's getting dark" */
  meadow(ctx, rnd) {
    ditherSky(ctx, 0, 0, PXW, PXH, [
      { p: 0.00, c: "#8ec2e0" }, { p: 0.22, c: "#bcd9e6" },
      { p: 0.44, c: "#f0dfae" }, { p: 0.62, c: "#f7cf8e" }, { p: 1.00, c: "#e9b878" },
    ]);
    sunDisc(ctx, Math.round(PXW * 0.66), 62, 13, "#fffdf0", "#ffeeb8");
    sunRays(ctx, PXW * 0.66, 62, PXW, PXH, "#fff3c8", rnd, 7);
    hillBand(ctx, PXW, 96, 5, 0.021, ["#c9c47a", "#a8a25e", "#8a8449"], rnd);
    hillBand(ctx, PXW, 112, 4, 0.03, ["#b8b264", "#98924f", "#7b763c"], rnd);
    ditherSky(ctx, 0, 126, PXW, PXH - 126, [
      { p: 0.00, c: "#c2b45e" }, { p: 0.5, c: "#a89a4a" }, { p: 1.00, c: "#8b7f39" },
    ]);
    // backlit trees, dark against the sun
    [[46, 1.0], [PXW - 60, 0.85], [140, 0.6]].forEach(([x, s]) => {
      trunk(ctx, x, 132, Math.round(46 * s), Math.round(6 * s), ["#7a6a3c", "#5e5230", "#463c22"]);
      canopy(ctx, x, 132 - 46 * s, 20 * s, ["#c9c47a", "#93924e", "#6d6c39", "#54542b"], rnd, "#ffeeb0");
    });
    grassTufts(ctx, PXW, 140, 150, ["#c9bb62", "#b0a352", "#d6c974"], rnd);
    motes(ctx, PXW, PXH, 40, "#fff6cc", rnd, 60, 150);
  },

  /* 5. sunset lake — the ask */
  sunset(ctx, rnd) {
    ditherSky(ctx, 0, 0, PXW, PXH, [
      { p: 0.00, c: "#3d3a72" }, { p: 0.18, c: "#5b4d8e" },
      { p: 0.36, c: "#8a5f9e" }, { p: 0.50, c: "#c97a8a" },
      { p: 0.62, c: "#f0a072" }, { p: 0.72, c: "#7fa8d8" }, { p: 1.00, c: "#4a6ea8" },
    ]);
    // the signature banded clouds
    const cl = ["#ffd08a", "#f6996f", "#e0765f", "#b95a58"];
    for (let i = 0; i < 5; i++) {
      const y = 28 + i * 12 + rnd() * 5;
      for (let k = 0; k < 3; k++) {
        blob(ctx, rnd() * PXW, y, 30 + rnd() * 26, 4 + rnd() * 3, cl);
      }
    }
    for (let i = 0; i < 60; i++) px(ctx, rnd() * PXW, rnd() * 26, 1, 1, "#fff3d0");

    // mountain silhouettes, two ranges
    hillBand(ctx, PXW, 88, 12, 0.017, ["#5a6ea0", "#4a5c89", "#3d4d74"], rnd, 2);
    hillBand(ctx, PXW, 100, 8, 0.026, ["#3f5580", "#34486d", "#2b3c5b"], rnd, 5);
    // pine treeline
    pineRow(ctx, PXW, 122, 44, ["#2b4a52", "#1f3840", "#16292f"], rnd, 1.0);
    // the lake
    ditherSky(ctx, 0, 122, PXW, 20, [
      { p: 0.00, c: "#6d94c4" }, { p: 0.5, c: "#54789f" }, { p: 1.00, c: "#3f5d80" },
    ]);
    for (let i = 0; i < 40; i++) px(ctx, rnd() * PXW, 123 + rnd() * 18, 2 + rnd() * 4, 1, "#9dbde0");
    // sun glitter on the water
    for (let i = 0; i < 16; i++) px(ctx, PXW * 0.42 + rnd() * 40, 124 + rnd() * 15, 1 + rnd() * 3, 1, "#ffd9a0");
    // far bank + flowered foreground
    px(ctx, 0, 142, PXW, 8, "#3a4a3a");
    ditherSky(ctx, 0, 148, PXW, PXH - 148, [
      { p: 0.00, c: "#4a5c46" }, { p: 0.5, c: "#3c4d3a" }, { p: 1.00, c: "#2e3c2d" },
    ]);
    grassTufts(ctx, PXW, 156, 130, ["#5c7050", "#4a5c42", "#6b8159"], rnd);
    flowerDots(ctx, PXW, 152, 26, 44, ["#ff9ec4", "#ffd166", "#c9a0ff", "#ffffff"], rnd);
    motes(ctx, PXW, PXH, 34, "#ffe9a8", rnd, 100, 176);
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

/* ---------- painting ---------- */
function hvPaint() {
  const n = HV[hvNode];
  const canvas = document.getElementById("hv-canvas");
  if (!canvas || !n) return;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, PXW, PXH);

  const rnd = hvSeed(n.scene + hvNode);
  (HV_SCENES[n.scene] || HV_SCENES.sakura)(ctx, rnd);

  const put = (sp, x, y, s) => {
    s = s || 1;
    ctx.drawImage(sp, 0, 0, sp.width, sp.height, x | 0, y | 0, (sp.width * s) | 0, (sp.height * s) | 0);
  };

  if (n.title) {
    put(drawNyan(), PXW - 62, 12, 1);
    const logo = drawLogo("HEARTVENTURE");
    put(logo, Math.round((PXW - logo.width * 0.62) / 2), 44, 0.62);
  }

  if (n.butterflies) {
    put(drawFlowerCard(), PXW / 2 - 27, 76, 1.95);
    put(drawButterfly("blue"), 62, 52, 1.7);
    put(drawButterfly("red"), PXW - 96, 44, 1.7);
  }

  if (n.fox) put(drawFox(), PXW - 116, 116, 1.5);

  if (n.envelope) {
    const e = drawEnvelope(n.envelope === "open");
    put(e, PXW / 2 - 33, n.envelope === "open" ? 34 : 40, 1.5);
    for (let i = 0; i < 12; i++) px(ctx, PXW / 2 - 40 + rnd() * 80, 30 + rnd() * 50, 1, 1, "#ffe9a8");
  }

  if (n.isAsk) {
    // the letter, held open and filling the frame
    const cardW = 132, cardH = 104, cx = (PXW - cardW) / 2, cy = 26;
    px(ctx, cx + 3, cy + 4, cardW, cardH, "rgba(60,30,50,.35)");
    px(ctx, cx, cy, cardW, cardH, "#fffaf0");
    px(ctx, cx, cy, cardW, 2, "#ffffff");
    px(ctx, cx, cy + cardH - 2, cardW, 2, "#e6d8bf");
    for (let i = 0; i < 9; i++) drawHeartInto(ctx, cx + 8 + rnd() * (cardW - 16), cy + 8 + rnd() * (cardH - 16), 1, "#ffc2d8");
    const kitty = drawCat("idle");
    put(kitty, cx + cardW / 2 - 30, cy + cardH - 62, 1.5);
    drawHeartInto(ctx, cx + cardW - 16, cy + 16, 2, "#ef5f83");
    drawHeartInto(ctx, cx + 14, cy + cardH - 18, 2, "#ff9fb6");
  }

  if (n.hearts) {
    for (let i = 0; i < 14; i++) {
      drawHeartInto(ctx, 20 + rnd() * (PXW - 40), 20 + rnd() * 90, 1 + Math.round(rnd()), "#ff8fb0");
    }
  }

  // the cat, bottom-left, unless the letter is doing the talking
  if (n.cat && n.cat !== "hide") {
    const scale = n.bigCat ? 2.8 : 2.0;
    const sp = drawCat(n.cat);
    put(sp, n.bigCat ? PXW / 2 - sp.width * scale / 2 : 6,
        n.bigCat ? 34 : PXH - sp.height * scale - 4, scale);
  }
}

function hvPaintFail() {
  const canvas = document.getElementById("hv-fail-canvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const rnd = hvSeed("bear");
  HV_SCENES.forest(ctx, rnd);
  ctx.save(); ctx.globalAlpha = 0.45; px(ctx, 0, 0, PXW, PXH, "#2a1408"); ctx.restore();
  const bear = drawBear();
  ctx.drawImage(bear, 0, 0, bear.width, bear.height,
    PXW / 2 - bear.width * 1.7 / 2, 26, bear.width * 1.7, bear.height * 1.7);
}

/* ---------- rendering the DOM layer ---------- */
function hvRender() {
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
  hvPaint();

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

  if (n.isEnd) hvCompleted = true;
}

let hvCompleted = false;

function hvChoose(ch) {
  if (ch.to === "__exit") {
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
  hvRender();
}

function hvRetry() {
  document.getElementById("hv-fail").classList.remove("on");
  if (hvFailReturn) hvNode = hvFailReturn;   // back to the choice, not the start
  hvFailReturn = null;
  hvRender();
}

function hvBack() {
  if (!hvHistory.length) return;
  hvNode = hvHistory.pop();
  hvRender();
}

function startQuest() {
  hvNode = "title";
  hvHistory = [];
  hvFailReturn = null;
  document.getElementById("hv-fail").classList.remove("on");
  hvRender();
}

document.getElementById("hv-retry").addEventListener("click", hvRetry);
document.getElementById("hv-back").addEventListener("click", hvBack);
document.getElementById("hv-quit").addEventListener("click", () => pageTurn("hub", startHub));
