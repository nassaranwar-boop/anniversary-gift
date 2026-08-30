
/* =========================================================
   ✏️  CUSTOMIZE ME
   ========================================================= */
const CONFIG = {
  babyName: "My Baby!",
  reward: "A sweet kiss",
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
  blackBody:"assets/black_body.png", blackTail:"assets/black_tail.png",
  whiteBody:"assets/white_body.png", whiteTail:"assets/white_tail.png",
  monster:"assets/monster.png", shooter:"assets/shooter.png", tree:"assets/tree.png", med:"assets/med.png",
  heartFull:"assets/heart_full.png", heartHalf:"assets/heart_half.png", heartEmpty:"assets/heart_empty.png",
  key:"assets/key.png",
};
const PLAYER_ASPECT = 395/220;

document.getElementById("baby-name").textContent = CONFIG.babyName;
document.getElementById("reward-text").textContent = CONFIG.reward;
/* Every one of these now ships its src in the markup, so the sprite is on
   screen from the first paint and stays there even if this script never
   runs. This pass only keeps ASSETS as the one place a path is written: it
   re-points each <img> at the same file, and a missing element is skipped
   rather than throwing and taking the rest of the wiring down with it —
   which is how the key, the two maze tokens and the note avatar all ended
   up sourceless at once. */
[["target-token", ASSETS.guy],
 ["player-token", ASSETS.girl],
 ["dialogue-avatar-img", ASSETS.guy],
 ["cat-black-body", ASSETS.blackBody],
 ["cat-black-tail", ASSETS.blackTail],
 ["cat-white-body", ASSETS.whiteBody],
 ["cat-white-tail", ASSETS.whiteTail],
 ["key-badge-img", ASSETS.key]].forEach(function (pair) {
  const el = document.getElementById(pair[0]);
  if (el && pair[1]) el.src = pair[1];
});

/* ---------- best time (localStorage) ---------- */
try {
  const best = localStorage.getItem("fal_best_time");
  if (best) document.getElementById("best-time-line").textContent = "Best time — " + best;
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

/* ---------------------------------------------------------
   THE REAL HEIGHT OF THE VIEWPORT

   dvh handles this on its own in a modern browser, but it is not
   everywhere yet and it rounds; this measures the visible area and
   writes it into --app-h, which the stylesheet uses for every
   full-height box. That is what closes the blank strip you could swipe
   down into.

   innerHeight, not visualViewport.height: the visual viewport shrinks
   when the on-screen keyboard opens, and re-laying the whole site out
   around the keyboard is worse than the gap ever was. The focus guard
   below is the belt to that braces.
   --------------------------------------------------------- */
/* dvh is the browser's own answer to this and it is correct at every zoom
   level, which a measured pixel value is not: written too large the fixed
   screens overflow and the content reads as cropped from the top; written
   too small, or left stale after a zoom, the body shows through underneath
   as a band of empty space. Both of those were the same stale number.

   So where dvh exists, CSS owns the height and JS does not touch it. The
   measurement below is only for browsers old enough to lack dvh. */
const HAS_DVH = typeof CSS !== "undefined" && CSS.supports &&
                CSS.supports("height", "100dvh");

function fitViewport() {
  if (HAS_DVH) return;                      // the stylesheet already has it right
  const ae = document.activeElement;
  if (ae && /^(input|textarea|select)$/i.test(ae.tagName)) return;
  const h = window.innerHeight;
  if (h > 0) document.documentElement.style.setProperty("--app-h", h + "px");
}

if (!HAS_DVH) {
  fitViewport();
  /* A ResizeObserver on the root element, not just the resize event: some
     mobile browsers change the viewport as the URL bar slides away without
     ever firing resize, and at least one scene here stops the event
     reaching us at all. The observer watches the box itself. */
  if (window.ResizeObserver) {
    try { new ResizeObserver(fitViewport).observe(document.documentElement); } catch (e) {}
  }
  addEventListener("resize", fitViewport);
  addEventListener("orientationchange", () => setTimeout(fitViewport, 120));
  addEventListener("pageshow", fitViewport);
  if (window.visualViewport) window.visualViewport.addEventListener("resize", fitViewport);
  addEventListener("scroll", () => requestAnimationFrame(fitViewport), { passive: true });
  document.addEventListener("focusout", () => setTimeout(fitViewport, 60));
}

/* ---------- ambient particles ---------- */
/* The drifting decorations used to be emoji, which meant they were a
   different picture on every device, at a different weight, in colours
   that had nothing to do with the palette. These are drawn, and they take
   a tint, so a field of them reads as one thing. */
const PARTICLE_SHAPES = {
  heart: "M12 20.2C2.6 13.4 3.4 6.4 8.2 6.4c2 0 3.3 1.2 3.8 2.3.5-1.1 1.8-2.3 3.8-2.3 4.8 0 5.6 7-3.8 13.8z",
  spark: "M12 2.4l2.1 6.3 6.3 2.1-6.3 2.1-2.1 6.3-2.1-6.3L3.6 10.8l6.3-2.1z",
  petal: "M12 3.2c3.4 2.4 5.2 5.4 5.2 8.5a5.2 5.2 0 1 1-10.4 0c0-3.1 1.8-6.1 5.2-8.5z",
  bud:   "M12 4c2.7 0 4.7 2.1 4.7 4.6 0 3.1-2.3 5.8-4.7 7.7-2.4-1.9-4.7-4.6-4.7-7.7C7.3 6.1 9.3 4 12 4z",
  leaf:  "M4.5 19.5C4.5 11 10 5.5 19.5 4.5c1 9.5-4.5 15-15 15z",
};

function startParticles(containerId, opts) {
  const el = document.getElementById(containerId);
  if (!el || el.dataset.running) return;
  el.dataset.running = "1";
  const { shapes, tints, max = 10, interval = 700 } = opts;
  let alive = 0;
  setInterval(() => {
    if (el.offsetParent === null) return;          // the screen is not showing
    if (alive >= max) return;
    const kind = shapes[Math.floor(Math.random() * shapes.length)];
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", "particle");
    svg.setAttribute("viewBox", "0 0 24 24");
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", PARTICLE_SHAPES[kind]);
    path.setAttribute("fill", tints[Math.floor(Math.random() * tints.length)]);
    svg.appendChild(path);
    const size = 11 + Math.random() * 13;
    svg.style.left = Math.random() * 100 + "%";
    svg.style.width = size + "px";
    svg.style.height = size + "px";
    svg.style.animationDuration = (6 + Math.random() * 5) + "s";
    alive++;
    svg.addEventListener("animationend", () => { svg.remove(); alive--; });
    el.appendChild(svg);
  }, interval);
}
const TINT_WARM = ["rgba(255,150,190,.75)","rgba(255,190,150,.6)","rgba(255,220,180,.6)","rgba(240,130,170,.6)"];
const TINT_NIGHT = ["rgba(255,169,216,.6)","rgba(255,214,168,.45)","rgba(214,150,220,.5)"];
startParticles("pf-hello",   { shapes:["heart","spark","petal"], tints:TINT_WARM,  max:9, interval:750 });
startParticles("pf-details", { shapes:["heart","bud","leaf"],    tints:TINT_WARM,  max:6, interval:900 });
startParticles("pf-l2intro", { shapes:["heart","spark","bud"],   tints:TINT_NIGHT, max:5, interval:1000 });

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
   MAZE ART + JUICE

   The maze was flat purple CSS gradients, which clashed with the warm
   theme everywhere else and read as a spreadsheet with rounded corners.
   Tiles are now drawn procedurally onto small canvases and handed to the
   cells as background images, so they share the pixel language of the
   adventure. On top of that: a trail of where she has been, dust when
   she moves, sparkles when she picks something up, a torch-lit fog that
   breathes, and sound.
   ========================================================= */

const MZ = {
  wall1: "#6b4a2a", wall2: "#523618", wall3: "#3d2a17",
  floor1: "#e6cfa0", floor2: "#d8bd88", floor3: "#c9aa74",
  moss: "#7c9a45", mossDark: "#5d7a35",
  glow: "#ffd98a",
};

const TILE = 32;

function mzTile(draw) {
  const c = document.createElement("canvas");
  c.width = TILE; c.height = TILE;
  const ctx = c.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  draw(ctx, TILE);
  return c.toDataURL();
}

function mzRnd(seed) {
  let x = Math.sin(seed * 3571 + 1013) * 65536;
  return () => { x = Math.sin(x * 3571 + 1013) * 65536; return x - Math.floor(x); };
}

/* stone wall: a lit top face, a darker body, mortar lines, and moss */
function mzWallTile(seed) {
  return mzTile((ctx, S) => {
    const rnd = mzRnd(seed);
    ctx.fillStyle = MZ.wall3; ctx.fillRect(0, 0, S, S);
    // body blocks
    for (let row = 0; row < 4; row++) {
      const off = (row % 2) * 8;
      for (let col = -1; col < 4; col++) {
        const x = col * 16 + off, y = row * 8;
        const v = rnd();
        ctx.fillStyle = v > 0.66 ? MZ.wall1 : v > 0.33 ? MZ.wall2 : "#5e4224";
        ctx.fillRect(x + 1, y + 1, 14, 6);
        ctx.fillStyle = "rgba(255,220,170,0.16)";
        ctx.fillRect(x + 1, y + 1, 14, 1);
        ctx.fillStyle = "rgba(0,0,0,0.22)";
        ctx.fillRect(x + 1, y + 6, 14, 1);
      }
    }
    // lit top edge — reads as height
    ctx.fillStyle = "rgba(255,226,170,0.30)"; ctx.fillRect(0, 0, S, 2);
    ctx.fillStyle = "rgba(0,0,0,0.35)"; ctx.fillRect(0, S - 3, S, 3);
    // moss creeping over
    for (let i = 0; i < 14; i++) {
      const mx = rnd() * S, my = rnd() * S;
      ctx.fillStyle = rnd() > 0.5 ? MZ.moss : MZ.mossDark;
      ctx.fillRect(mx, my, 2, 2);
    }
  });
}

/* warm flagstones with grit and the odd tuft */
function mzFloorTile(seed) {
  return mzTile((ctx, S) => {
    const rnd = mzRnd(seed);
    ctx.fillStyle = MZ.floor2; ctx.fillRect(0, 0, S, S);
    for (let i = 0; i < 3; i++) {
      const x = rnd() * S, y = rnd() * S, w = 8 + rnd() * 12, h = 6 + rnd() * 8;
      ctx.fillStyle = rnd() > 0.5 ? MZ.floor1 : MZ.floor3;
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = "rgba(255,245,215,0.25)";
      ctx.fillRect(x, y, w, 1);
    }
    for (let i = 0; i < 26; i++) {
      ctx.fillStyle = rnd() > 0.5 ? "rgba(140,105,60,0.28)" : "rgba(255,240,205,0.22)";
      ctx.fillRect(rnd() * S, rnd() * S, 1, 1);
    }
    if (rnd() > 0.55) {
      const gx = rnd() * S, gy = rnd() * S;
      ctx.fillStyle = MZ.moss;
      for (let k = 0; k < 4; k++) ctx.fillRect(gx + k, gy - (k % 2), 1, 3);
    }
  });
}

let MZ_WALLS = [], MZ_FLOORS = [];
function mzBuildTiles() {
  if (MZ_WALLS.length) return;
  for (let i = 0; i < 4; i++) MZ_WALLS.push(mzWallTile(i * 17 + 3));
  for (let i = 0; i < 4; i++) MZ_FLOORS.push(mzFloorTile(i * 23 + 7));
}

/* ---------- particles over the maze ---------- */
let mzFx = [];
let mzFxCanvas = null, mzFxCtx = null, mzFxRaf = null, mzFxLast = 0;

function mzEnsureFx() {
  if (mzFxCanvas) return;
  const stage = document.getElementById("maze-stage");
  if (!stage) return;
  mzFxCanvas = document.createElement("canvas");
  mzFxCanvas.className = "maze-fx";
  stage.appendChild(mzFxCanvas);
  mzFxCtx = mzFxCanvas.getContext("2d");
}

function mzResizeFx() {
  if (!mzFxCanvas) return;
  const stage = document.getElementById("maze-stage");
  mzFxCanvas.width = stage.clientWidth;
  mzFxCanvas.height = stage.clientHeight;
}

function mzSpawn(x, y, n, colour, spread, up) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    mzFx.push({
      x: x, y: y,
      vx: Math.cos(a) * (spread || 40) * (0.4 + Math.random()),
      vy: Math.sin(a) * (spread || 40) * (0.4 + Math.random()) - (up || 0),
      life: 0, max: 0.45 + Math.random() * 0.4,
      c: colour, s: 2 + Math.random() * 2,
    });
  }
  mzStartFx();
}

function mzFxFrame(now) {
  mzFxRaf = requestAnimationFrame(mzFxFrame);
  const dt = Math.min(0.05, (now - (mzFxLast || now)) / 1000);
  mzFxLast = now;
  if (!mzFxCtx) return;
  mzFxCtx.clearRect(0, 0, mzFxCanvas.width, mzFxCanvas.height);
  for (let i = mzFx.length - 1; i >= 0; i--) {
    const p = mzFx[i];
    p.life += dt;
    if (p.life >= p.max) { mzFx.splice(i, 1); continue; }
    const t = p.life / p.max;
    const x = p.x + p.vx * p.life;
    const y = p.y + p.vy * p.life + 90 * p.life * p.life;
    mzFxCtx.globalAlpha = 1 - t;
    mzFxCtx.fillStyle = p.c;
    const s = p.s * (1 - t * 0.5);
    mzFxCtx.fillRect(x, y, s, s);
  }
  mzFxCtx.globalAlpha = 1;
  if (!mzFx.length) { cancelAnimationFrame(mzFxRaf); mzFxRaf = null; }
}
function mzStartFx() { if (!mzFxRaf) { mzFxLast = 0; mzFxRaf = requestAnimationFrame(mzFxFrame); } }

/* ---------- sound ---------- */
function mzSfx(kind) {
  if (typeof hvSfx === "function") {
    hvSfx({ step: "step", heart: "collect", hurt: "bad", win: "yay", key: "key",
            spot: "spot", shot: "shot", phial: "phial", locked: "locked",
            respawn: "respawn" }[kind] || "pick");
  }
}

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

  markVisited(playerPos.r, playerPos.c);
  startFogFlicker();

  if (timerInterval) clearInterval(timerInterval);
  timerInterval = setInterval(() => { if (!gameWon) { elapsedSec++; updateHud(); } }, 1000);
}

let mazeCells = [];
function buildStaticGrid() {
  mzBuildTiles();
  const grid = document.getElementById("maze-grid");
  grid.innerHTML = "";
  grid.style.gridTemplateColumns = `repeat(${dim}, 1fr)`;
  grid.style.gridTemplateRows = `repeat(${dim}, 1fr)`;
  mazeCells = [];
  for (let r=0;r<dim;r++) {
    mazeCells[r] = [];
    for (let c=0;c<dim;c++) {
      const isPath = !!mazeData[r][c];
      const cell = document.createElement("div");
      cell.className = "cell " + (isPath ? "path" : "wall");
      /* a stable variant per cell so the stonework never reshuffles */
      const v = (r * 7 + c * 13) % 4;
      cell.style.backgroundImage = "url(" + (isPath ? MZ_FLOORS[v] : MZ_WALLS[v]) + ")";
      grid.appendChild(cell);
      mazeCells[r][c] = cell;
    }
  }
  mzEnsureFx();
  mzResizeFx();
}

/* mark where she has already walked — in a fog maze, seeing your own
   trail is the difference between exploring and going in circles */
function markVisited(r, c) {
  const cell = mazeCells[r] && mazeCells[r][c];
  if (cell && !cell.classList.contains("visited")) cell.classList.add("visited");
}

function buildHearts() {
  const layer = document.getElementById("hearts-layer");
  layer.innerHTML = "";
  heartCells.forEach((hc) => {
    const el = document.createElement("div");
    el.className = "heart-collect";
    el.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="' +
      PARTICLE_SHAPES.heart + '"/></svg>';
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
    el.style.width = size+"px"; el.style.height = size+"px";   // it holds an SVG, not a glyph
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
let fogFlickerRaf = null;
function updateFog(flick) {
  const fog = document.getElementById("fog-layer");
  if (!fog) return;
  const cx = playerPos.c*CS + CS/2, cy = playerPos.r*CS + CS/2;
  const f = flick === undefined ? 1 : flick;
  const r1 = CS*1.35*f, r2 = CS*2.6*f, r3 = CS*4.0*f, r4 = CS*5.6*f;
  /* warm lantern light instead of the old purple murk, so the maze
     belongs to the same world as everything else */
  fog.style.background = `radial-gradient(circle at ${cx}px ${cy}px,
    rgba(255,238,196,.20) 0px,
    rgba(255,206,140,.10) ${r1}px,
    rgba(74,44,18,.46) ${r2}px,
    rgba(40,22,10,.74) ${r3}px,
    rgba(20,10,5,.94) ${r4}px)`;
}

/* the lantern breathes a little, which makes the dark feel alive */
function startFogFlicker() {
  if (fogFlickerRaf) return;
  const tick = (now) => {
    fogFlickerRaf = requestAnimationFrame(tick);
    if (!document.getElementById("screen-maze").classList.contains("active")) return;
    const t = now / 1000;
    updateFog(1 + Math.sin(t * 2.3) * 0.02 + Math.sin(t * 5.7) * 0.012);
  };
  fogFlickerRaf = requestAnimationFrame(tick);
}
function stopFogFlicker() {
  if (fogFlickerRaf) cancelAnimationFrame(fogFlickerRaf);
  fogFlickerRaf = null;
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
  /* canStep, not just the wall between: the old test checked the gap and
     took the destination on trust. The border happens to be solid so it
     never bit, but it is one carve away from walking her off the grid. */
  if (canStep(playerPos.r, playerPos.c, mdr, mdc)) {
    const fromR = playerPos.r, fromC = playerPos.c;
    playerPos = { r: playerPos.r+dr, c: playerPos.c+dc };
    stepCount++;
    const tok = document.getElementById("player-token");
    tok.classList.toggle("face-left", lastFacing==="left");
    placeToken(tok, playerPos, false);

    /* a puff of dust off the trailing foot, and the trail behind her */
    mzSpawn(fromC*CS + CS/2, fromR*CS + CS*0.85, 4, "rgba(226,200,150,0.9)", 26, 6);
    markVisited(fromR, fromC);
    markVisited(midR, midC);
    markVisited(playerPos.r, playerPos.c);
    tok.classList.remove("stepping"); void tok.offsetWidth; tok.classList.add("stepping");
    mzSfx("step");

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
    popText(el.style.left, el.style.top, "+1", "#ff5b98");
    mzSpawn(playerPos.c*CS + CS/2, playerPos.r*CS + CS/2, 16, "#ff8fb8", 70, 30);
    mzSpawn(playerPos.c*CS + CS/2, playerPos.r*CS + CS/2, 10, "#ffe08a", 50, 20);
    mzSfx("heart");
    const hud = document.querySelector(".hud-hearts-l1");
    if (hud) { hud.classList.remove("pop"); void hud.offsetWidth; hud.classList.add("pop"); }
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
      showToast("The way through is locked — find the key");
      mzSfx("locked");
      const stage = document.getElementById("maze-stage");
      stage.classList.remove("locked-shake"); void stage.offsetWidth; stage.classList.add("locked-shake");
      return;
    }
    gameWon = true;
    stopLevel2Systems();
    mzSfx("win");
    for (let b = 0; b < 4; b++) {
      setTimeout(() => mzSpawn(targetPos.c*CS + CS/2, targetPos.r*CS + CS/2, 18,
        b % 2 ? "#ff8fb8" : "#ffe08a", 110, 60), b * 110);
    }
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
  /* The watchers run on their own, much faster clock: a bolt that only
     moved every 800ms would be something you watch rather than dodge. */
  startWatchers();
}

function stopLevel2Systems() {
  if (level2Tick) { clearInterval(level2Tick); level2Tick = null; }
  stopWatchers();
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
    alert.className = "shooter-alert"; alert.dataset.i = i;
    alert.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true">' +
      '<path d="M12 2.6 22 20.4H2z"/>' +
      '<path class="bang" d="M12 9v4.6"/><circle class="bang" cx="12" cy="16.8" r="1.1"/></svg>';
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
    mzSfx("phial");
    showToast("A phial — half a heart back");
  }

  if (keyPos && !hasKey && playerPos.r===keyPos.r && playerPos.c===keyPos.c) {
    hasKey = true;
    layoutLevel2Entities();
    mzSfx("key");
    document.getElementById("key-badge").classList.add("show");
    document.getElementById("target-token").classList.remove("locked");
    document.getElementById("beacon-glow").classList.remove("locked");
    showToast("The key is yours");
  }

  checkMonsterContact();
}

function checkMonsterContact() {
  if (isHidden) return;
  if (Date.now() < invulnUntil) return;
  const hit = monsters.some(m => m.r===playerPos.r && m.c===playerPos.c);
  if (hit) applyDamage("A wisp caught you");
}

function applyDamage(msg) {
  /* The invulnerability window used to be checked by the caller, and only
     one of the two callers did it: a monster could not touch you twice in
     a row but a watcher could, so bolts chewed through the i-frames a
     monster respected. Whether a hit lands is decided here now, once, for
     every source. */
  if (Date.now() < invulnUntil) return;
  hp = Math.max(0, hp-2);
  invulnUntil = Date.now() + 1800;
  renderHeartsHud();
  if (hp > 0) showToast(msg);
  const flash = document.getElementById("damage-flash");
  flash.classList.remove("hit"); void flash.offsetWidth; flash.classList.add("hit");
  const stage = document.getElementById("maze-stage");
  stage.classList.remove("shake"); void stage.offsetWidth; stage.classList.add("shake");
  mzSpawn(playerPos.c*CS + CS/2, playerPos.r*CS + CS/2, 14, "#ff6b6b", 80, 24);
  mzSfx("hurt");
  if (hp <= 0) respawnLevel2();
}

function respawnLevel2() {
  showToast("Caught. Let's try that again.");
  mzSfx("respawn");
  /* anything already in the air belongs to the run that just ended */
  clearBolts();
  hideAllBeams();
  shooters.forEach((s) => { s.state = "idle"; s.until = 0; });
  document.querySelectorAll(".shooter-alert.show").forEach(el => el.classList.remove("show"));
  playerPos = { r:1, c:1 };
  hp = HP_START;
  invulnUntil = Date.now() + 900;   // a breath to get your bearings
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

/* =========================================================
   THE WATCHERS

   These used to be called shooters and never shot anything: after a one
   second warning they simply took a heart off you, from any distance,
   with nothing travelling between the two of you. There was no way to
   read it, no way to dodge it, and being hit from eleven cells away felt
   arbitrary — which is exactly why it did not make sense.

   Now a watcher does three things you can see. It spots you and takes a
   moment to aim, drawing a beam down the corridor so you know which one
   has you and from where. It fires a bolt that travels cell by cell, so
   you can step out of the line, put a thicket between you, or simply be
   quicker than it. Then it has to reload before it can do it again.

   The bolt is independent once it leaves: it does not track you, and it
   is stopped by a wall or a thicket. Everything is on its own clock, so
   the aim never fires late because a slower tick was busy.
   ========================================================= */
const WATCH = {
  range:    11,     // grid steps, so about five cells
  aim:      850,    // the telegraph you get before it fires
  cooldown: 2400,   // how long until that one can aim at you again
  step:     120,    // ms per grid step the bolt travels
};
let bolts = [], watchTick = null;

function startWatchers() {
  stopWatchers();
  watchTick = setInterval(watchTickFn, WATCH.step);
}
function stopWatchers() {
  if (watchTick) { clearInterval(watchTick); watchTick = null; }
  clearBolts();
  shooters.forEach((s) => { s.state = "idle"; s.until = 0; });
  document.querySelectorAll(".shooter-alert.show").forEach(el => el.classList.remove("show"));
  hideAllBeams();
}
function clearBolts() {
  bolts.forEach(b => b.el && b.el.remove());
  bolts = [];
}

/* how far a shot can travel from here before something stops it */
function beamEnd(r, c, dr, dc) {
  let er = r, ec = c, n = 0;
  while (n < WATCH.range) {
    const nr = er + dr, nc = ec + dc;          // the wall between cells
    const tr = er + dr * 2, tc = ec + dc * 2;  // the next cell
    if (!cellOpen(nr, nc) || !cellOpen(tr, tc)) break;
    er = tr; ec = tc; n += 2;
    if (treeSet.has(er + "," + ec)) break;     // a thicket stops it
  }
  return { r: er, c: ec, steps: n };
}

function watchTickFn() {
  if (level !== 2 || gameWon) return;
  const now = Date.now();

  shooters.forEach((s, i) => {
    if (!s.state) s.state = "idle";
    const alertEl = document.querySelector('.shooter-alert[data-i="' + i + '"]');

    if (s.state === "cool") {
      if (now >= s.until) s.state = "idle";
      return;
    }

    if (s.state === "aim") {
      /* Losing sight of it cancels the shot — ducking behind a corner in
         time should actually save you, or the telegraph is a lie. */
      if (!watcherSees(s)) {
        s.state = "idle";
        if (alertEl) alertEl.classList.remove("show");
        hideBeam(i);
        return;
      }
      if (now >= s.until) {
        fireBolt(s);
        s.state = "cool"; s.until = now + WATCH.cooldown;
        if (alertEl) alertEl.classList.remove("show");
        hideBeam(i);
      }
      return;
    }

    if (watcherSees(s)) {
      s.dr = Math.sign(playerPos.r - s.r);
      s.dc = Math.sign(playerPos.c - s.c);
      s.state = "aim"; s.until = now + WATCH.aim;
      if (alertEl) alertEl.classList.add("show");
      showBeam(i, s);
      mzSfx("spot");
    }
  });

  stepBolts();
}

function watcherSees(s) {
  if (isHidden) return false;
  if (s.r !== playerPos.r && s.c !== playerPos.c) return false;
  if (Math.abs(s.r - playerPos.r) + Math.abs(s.c - playerPos.c) > WATCH.range) return false;
  return hasClearLine(s.r, s.c, playerPos.r, playerPos.c);
}

function fireBolt(s) {
  const layer = document.getElementById("bolts-layer");
  if (!layer) return;
  const el = document.createElement("div");
  el.className = "mz-bolt";
  el.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 1.5 18 12l-6 10.5L6 12z"/></svg>';
  layer.appendChild(el);
  /* fresh: skip the first step. fireBolt runs earlier in the same tick
     than stepBolts, so without this the bolt is created and immediately
     advanced — it never appears at the muzzle, and a watcher standing one
     cell away hits you before anything is drawn, which is unduckable. */
  const b = { r: s.r, c: s.c, dr: s.dr, dc: s.dc, dist: 0, el: el, fresh: true };
  bolts.push(b);
  placeBolt(b);
  mzSfx("shot");
}

function stepBolts() {
  for (let i = bolts.length - 1; i >= 0; i--) {
    const b = bolts[i];
    if (b.fresh) { b.fresh = false; continue; }      // it gets its muzzle frame
    const wr = b.r + b.dr, wc = b.c + b.dc;          // the wall between
    const nr = b.r + b.dr * 2, nc = b.c + b.dc * 2;  // the next cell
    if (b.dist >= WATCH.range || !cellOpen(wr, wc) || !cellOpen(nr, nc)) { killBolt(i); continue; }
    b.r = nr; b.c = nc; b.dist += 2;
    placeBolt(b);
    if (treeSet.has(b.r + "," + b.c)) { killBolt(i); continue; }   // stopped by a thicket
    if (b.r === playerPos.r && b.c === playerPos.c) {
      killBolt(i);
      if (!isHidden) applyDamage("A watcher caught you");
    }
  }
}

function killBolt(i) {
  const b = bolts[i];
  if (b.el) {
    b.el.classList.add("gone");
    const el = b.el;
    setTimeout(() => el.remove(), 180);
  }
  bolts.splice(i, 1);
}

function placeBolt(b) {
  if (!b.el) return;
  const size = CS * 0.46;
  b.el.style.width = size + "px";
  b.el.style.height = size + "px";
  b.el.style.left = (b.c * CS + CS / 2 - size / 2) + "px";
  b.el.style.top = (b.r * CS + CS / 2 - size / 2) + "px";
}

/* the corridor it is about to shoot down */
function showBeam(i, s) {
  const layer = document.getElementById("bolts-layer");
  if (!layer) return;
  let el = layer.querySelector('.mz-beam[data-i="' + i + '"]');
  if (!el) {
    el = document.createElement("div");
    el.className = "mz-beam"; el.dataset.i = i;
    layer.appendChild(el);
  }
  const end = beamEnd(s.r, s.c, s.dr, s.dc);
  const x1 = s.c * CS + CS / 2, y1 = s.r * CS + CS / 2;
  const x2 = end.c * CS + CS / 2, y2 = end.r * CS + CS / 2;
  const thin = Math.max(3, CS * 0.16);
  el.style.left = (Math.min(x1, x2) - (s.dc ? 0 : thin / 2)) + "px";
  el.style.top  = (Math.min(y1, y2) - (s.dr ? 0 : thin / 2)) + "px";
  el.style.width  = (s.dc ? Math.abs(x2 - x1) : thin) + "px";
  el.style.height = (s.dr ? Math.abs(y2 - y1) : thin) + "px";
  el.classList.add("on");
}
function hideBeam(i) {
  const el = document.querySelector('.mz-beam[data-i="' + i + '"]');
  if (el) el.classList.remove("on");
}
function hideAllBeams() {
  document.querySelectorAll(".mz-beam").forEach(el => el.classList.remove("on"));
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
  startParticles("pf-dialogue", { shapes:["heart","spark","petal"], tints:TINT_WARM, max:7, interval:600 });
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

/* =========================================================
   THE ENDING — a painted rooftop night

   The old ending was a flat CSS gradient, a row of plain divs for the
   skyline and two blocks for the roof. It is now painted with the same
   pixel engine as the adventure, so the last thing she sees belongs to
   the same world as everything before it: a dithered night sky, a moon
   with real craters and a halo, three depths of city with windows that
   blink, a rooftop with aerials and a water tower and string lights,
   and the two cats sitting on the ledge under all of it.
   ========================================================= */

const NIGHT_W = 320, NIGHT_H = 180;
let nightCanvas = null, nightCtx = null, nightBase = null, nightBaseCtx = null;
let nightRaf = null, nightT0 = 0, nightWindows = [], nightShoot = null;

function nightEnsure() {
  if (nightCanvas) return true;
  const inner = document.getElementById("night-sky-inner");
  if (!inner) return false;
  nightCanvas = document.createElement("canvas");
  nightCanvas.id = "night-canvas";
  nightCanvas.width = NIGHT_W; nightCanvas.height = NIGHT_H;
  inner.insertBefore(nightCanvas, inner.firstChild);
  nightCtx = nightCanvas.getContext("2d");
  nightCtx.imageSmoothingEnabled = false;

  nightBase = document.createElement("canvas");
  nightBase.width = NIGHT_W; nightBase.height = NIGHT_H;
  nightBaseCtx = nightBase.getContext("2d");
  nightBaseCtx.imageSmoothingEnabled = false;
  return true;
}

/* one building, with a lit window grid we can blink later */
function nightBuilding(ctx, x, w, topY, tones, rnd, depth, collect) {
  const baseY = NIGHT_H;
  px(ctx, x, topY, w, baseY - topY, tones[1]);
  px(ctx, x, topY, w, 1, tones[0]);                    // moonlit parapet
  px(ctx, x + w - 1, topY, 1, baseY - topY, tones[2]); // shaded side

  // roof furniture on the nearer blocks
  if (depth > 1 && rnd() > 0.55) {
    const tw = 3 + Math.floor(rnd() * 4);
    px(ctx, x + Math.floor(w / 2), topY - 5, tw, 5, tones[2]);
  }

  const cols = Math.max(1, Math.floor(w / 6));
  const rows = Math.max(1, Math.floor((baseY - topY) / 8));
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (rnd() > (depth === 1 ? 0.72 : 0.55)) continue;
      const wx = x + 2 + c * 6, wy = topY + 4 + r * 8;
      if (wy > baseY - 4) continue;
      const lit = rnd() > 0.35;
      px(ctx, wx, wy, 3, 4, lit ? "#ffd98a" : "#2b3550");
      if (lit && collect && rnd() > 0.6) collect.push({ x: wx, y: wy, ph: rnd() * 6.28 });
    }
  }
}

function nightPaintBase() {
  const ctx = nightBaseCtx;
  const rnd = mzRnd(9137);
  ctx.clearRect(0, 0, NIGHT_W, NIGHT_H);
  nightWindows = [];

  /* sky: deep blue at the top warming toward the horizon glow */
  ditherSky(ctx, 0, 0, NIGHT_W, NIGHT_H, [
    { p: 0.00, c: "#0e1030" }, { p: 0.22, c: "#1a1b47" },
    { p: 0.46, c: "#2c2358" }, { p: 0.66, c: "#4a2f63" },
    { p: 0.80, c: "#7a4560" }, { p: 1.00, c: "#a35c56" },
  ]);

  // stars, denser high up
  for (let i = 0; i < 150; i++) {
    const y = Math.pow(rnd(), 1.6) * NIGHT_H * 0.72;
    const x = rnd() * NIGHT_W;
    const b = rnd();
    px(ctx, x, y, 1, 1, b > 0.85 ? "#ffffff" : b > 0.5 ? "#dfe4ff" : "#a8b0d8");
  }

  /* the moon: halo, disc, craters, and a terminator */
  const mx = 244, my = 38, mr = 15;
  for (let ry = -mr * 3; ry <= mr * 3; ry++) {
    for (let rx = -mr * 3; rx <= mr * 3; rx++) {
      const d = Math.sqrt(rx * rx + ry * ry);
      if (d > mr && d < mr * 3) {
        const a = 1 - (d - mr) / (mr * 2);
        if (((BAYER4[(my + ry) & 3][(mx + rx) & 3] + 0.5) / 16) < a * 0.5) {
          px(ctx, mx + rx, my + ry, 1, 1, "#4a4a86");
        }
      }
    }
  }
  for (let ry = -mr; ry <= mr; ry++) {
    for (let rx = -mr; rx <= mr; rx++) {
      if (rx * rx + ry * ry > mr * mr) continue;
      const lit = (rx * -0.4 + ry * -0.5) / mr;
      px(ctx, mx + rx, my + ry, 1, 1, lit > 0.15 ? "#fffdf2" : lit > -0.25 ? "#f0ecd8" : "#d8d2bc");
    }
  }
  [[-5, -3, 3], [4, 2, 4], [-2, 6, 2], [7, -6, 2]].forEach(function (c) {
    blob(ctx, mx + c[0], my + c[1], c[2], c[2] * 0.85, ["#e8e2cc", "#d6cfb6", "#c2baa0", "#b0a890"]);
  });

  /* three depths of city */
  let x = -6;
  while (x < NIGHT_W + 6) {
    const w = 10 + Math.floor(rnd() * 14);
    nightBuilding(ctx, x, w, 96 + Math.floor(rnd() * 18), ["#3a3560", "#2b2749", "#211d3a"], rnd, 1, null);
    x += w + 1;
  }
  x = -8;
  while (x < NIGHT_W + 8) {
    const w = 14 + Math.floor(rnd() * 18);
    nightBuilding(ctx, x, w, 112 + Math.floor(rnd() * 16), ["#2e2a4e", "#221f3d", "#19172d"], rnd, 2, nightWindows);
    x += w + 2;
  }
  x = -10;
  while (x < NIGHT_W + 10) {
    const w = 20 + Math.floor(rnd() * 22);
    nightBuilding(ctx, x, w, 128 + Math.floor(rnd() * 14), ["#221f3a", "#18162c", "#100f20"], rnd, 3, nightWindows);
    x += w + 3;
  }

  /* the rooftop she is standing on */
  const roofY = 150;
  px(ctx, 0, roofY, NIGHT_W, NIGHT_H - roofY, "#191527");
  px(ctx, 0, roofY, NIGHT_W, 4, "#3b3354");
  px(ctx, 0, roofY, NIGHT_W, 1, "#6b5c8a");         // moonlit lip
  for (let i = 0; i < 90; i++) {
    px(ctx, rnd() * NIGHT_W, roofY + 5 + rnd() * (NIGHT_H - roofY - 5), 1, 1,
      rnd() > 0.5 ? "#221d33" : "#12101f");
  }
  // aerials and a water tower on the parapet
  [[28, 12], [206, 9], [268, 14]].forEach(function (a) {
    px(ctx, a[0], roofY - a[1], 1, a[1], "#3b3354");
    px(ctx, a[0] - 3, roofY - a[1], 7, 1, "#3b3354");
    px(ctx, a[0] - 2, roofY - a[1] + 3, 5, 1, "#3b3354");
  });
  px(ctx, 60, roofY - 16, 16, 12, "#2b2542");
  px(ctx, 60, roofY - 16, 16, 1, "#5b4f7e");
  px(ctx, 63, roofY - 4, 2, 4, "#2b2542"); px(ctx, 71, roofY - 4, 2, 4, "#2b2542");

  /* string lights across the roofline */
  for (let i = 0; i < 26; i++) {
    const lx = 6 + i * 12;
    const sag = Math.sin((i / 26) * Math.PI) * 5;
    px(ctx, lx, roofY - 20 + sag, 1, 1, "#3b3354");
    if (i % 2 === 0) nightWindows.push({ x: lx, y: roofY - 19 + sag, ph: rnd() * 6.28, bulb: true });
  }
}

function nightFrame(now) {
  nightRaf = requestAnimationFrame(nightFrame);
  const screen = document.getElementById("screen-end");
  if (!screen || !screen.classList.contains("active")) return;
  if (!nightT0) nightT0 = now;
  const t = (now - nightT0) / 1000;

  nightCtx.clearRect(0, 0, NIGHT_W, NIGHT_H);
  nightCtx.drawImage(nightBase, 0, 0);

  // windows and bulbs breathing
  for (let i = 0; i < nightWindows.length; i++) {
    const w = nightWindows[i];
    const v = Math.sin(t * (w.bulb ? 1.6 : 0.5) + w.ph);
    if (w.bulb) {
      const g = 0.5 + 0.5 * v;
      px(nightCtx, w.x, w.y, 1, 1, g > 0.5 ? "#ffe9a8" : "#c9a86a");
      if (g > 0.8) { px(nightCtx, w.x - 1, w.y, 1, 1, "#7a6a3a"); px(nightCtx, w.x + 1, w.y, 1, 1, "#7a6a3a"); }
    } else if (v > 0.93) {
      px(nightCtx, w.x, w.y, 3, 4, "#2b3550");     // someone turns in for the night
    }
  }

  // drifting clouds, lit underneath by the city
  for (let c = 0; c < 4; c++) {
    const cw = 34 + c * 9;
    const cx = ((t * (5 + c * 2) + c * 90) % (NIGHT_W + 120)) - 60;
    const cy = 34 + c * 13;
    blob(nightCtx, cx, cy, cw, 5 + c, ["#3a3566", "#302b57", "#272248", "#1e1a39"]);
    px(nightCtx, cx - cw, cy + 5 + c, cw * 2, 1, "#4a3f6b");
  }

  // a shooting star now and then
  if (!nightShoot && Math.random() < 0.004) {
    nightShoot = { x: -20 + Math.random() * 120, y: 10 + Math.random() * 40, t: 0 };
  }
  if (nightShoot) {
    nightShoot.t += 0.016;
    const sx = nightShoot.x + nightShoot.t * 260;
    const sy = nightShoot.y + nightShoot.t * 90;
    for (let k = 0; k < 12; k++) {
      px(nightCtx, sx - k * 3, sy - k * 1, 1, 1, k < 3 ? "#ffffff" : "#b9c2f0");
    }
    if (nightShoot.t > 0.9) nightShoot = null;
  }

  // twinkle pass over the star field
  for (let i = 0; i < 26; i++) {
    const sx = (i * 97) % NIGHT_W, sy = (i * 53) % 90;
    if (Math.sin(t * 2 + i) > 0.86) px(nightCtx, sx, sy, 1, 1, "#ffffff");
  }

  // fireflies rising off the roof once the camera has pushed in
  if (document.getElementById("night-sky").classList.contains("scene-3")) {
    for (let i = 0; i < 14; i++) {
      const fy = 176 - ((t * 9 + i * 13) % 60);
      const fx = 20 + ((i * 37) % (NIGHT_W - 40)) + Math.sin(t + i) * 4;
      if (Math.sin(t * 3 + i) > 0.1) px(nightCtx, fx, fy, 1, 1, "#ffe9a8");
    }
  }
}

function startNightScene() {
  if (!nightEnsure()) return;
  nightPaintBase();
  if (!nightRaf) { nightT0 = 0; nightRaf = requestAnimationFrame(nightFrame); }
}
function stopNightScene() {
  if (nightRaf) cancelAnimationFrame(nightRaf);
  nightRaf = null;
}

function activateEndingScene() {
  startNightScene();
  spawnNightStars(); buildEndHearts();
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
function buildEndHearts() {
  const field = document.getElementById("end-hearts");
  if (field.childElementCount) return;
  const shapes = ["heart", "petal", "spark", "bud"];
  const tints = ["#ff9ac0", "#ffc9a8", "#ffe3b0", "#f08bb0"];
  for (let i=0;i<7;i++){
    const s = document.createElement("span");
    s.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="' +
      tints[i % tints.length] + '" d="' + PARTICLE_SHAPES[shapes[i % shapes.length]] + '"/></svg>';
    s.style.left = (35 + Math.random()*30) + "%";
    s.style.top = (55 + Math.random()*20) + "%";
    s.style.animationDelay = (Math.random()*3)+"s";
    field.appendChild(s);
  }
}

/* =========================================================
   THE GATE — passcode, and the handoff into the memory book
   ========================================================= */

/* ---------- book intro integration ----------
   The actual 3D scene (Three.js) lives in book-scene.js and runs
   independently. It calls window.finishBookIntro() when the climax
   flash completes. There is no longer a Skip button — the intro is the
   thing she opens the site to see, and it is short. window.skipBookIntro
   still exists in book-scene.js as its teardown, and is used there. */
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

/* ---------- passcode gate ----------
   No text field. She taps her own keypad, so the phone keyboard never
   appears and never covers the thing she is typing into. A hardware
   keyboard still works on a laptop, because refusing it would be rude.
   gateCode is the single source of truth; paintGate is the only thing
   that writes to the cells. */
let gateCode = "";

function paintGate() {
  const row = document.getElementById("gate-code");
  if (!row) return;
  row.querySelectorAll(".gate-dot").forEach((d, i) => {
    /* Only toggle on a real change. Re-adding the class every keypress
       restarts the pop on all four dots and the row flickers. */
    const want = i < gateCode.length;
    if (d.classList.contains("filled") !== want) d.classList.toggle("filled", want);
  });
}

function gateType(d) {
  if (gateCode.length >= 4) return;
  gateCode += d;
  document.getElementById("gate-error").textContent = "";
  document.getElementById("gate-code").classList.remove("bad");
  paintGate();
  gateClick(1);
  /* four digits is the whole code, so there is nothing left to wait for.
     The pause lets the last dot land before it is judged. */
  if (gateCode.length === 4) setTimeout(checkGateCode, 300);
}
function gateBack()  { if (!gateCode) return; gateCode = gateCode.slice(0, -1); paintGate(); gateClick(0); }
function gateClear() { if (!gateCode) return; gateCode = ""; paintGate(); gateClick(0); }

/* A short wooden click with a breath of paper rustle over it, so the
   keypad answers back. Synthesised, like every other sound on the site —
   there is not an audio file in the repo and there should not be one. */
function gateClick(up) {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const c = window.__gateAudio || (window.__gateAudio = new AC());
    if (c.state !== "running") { if (window.wakeAudio) window.wakeAudio(c); else c.resume(); }
    const t = c.currentTime;

    // the click: a quick body-resonance blip
    const o = c.createOscillator(), g = c.createGain();
    o.type = "triangle";
    o.frequency.setValueAtTime(up ? 760 : 420, t);
    o.frequency.exponentialRampToValueAtTime(up ? 320 : 200, t + 0.06);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.055, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
    o.connect(g); g.connect(c.destination);
    o.start(t); o.stop(t + 0.11);

    // the rustle: a very short band-passed noise burst
    const len = Math.floor(c.sampleRate * 0.05);
    const buf = c.createBuffer(1, len, c.sampleRate);
    const ch = buf.getChannelData(0);
    for (let i = 0; i < len; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = c.createBufferSource(); src.buffer = buf;
    const bp = c.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 2600; bp.Q.value = 0.9;
    const ng = c.createGain(); ng.gain.value = 0.045;
    src.connect(bp); bp.connect(ng); ng.connect(c.destination);
    src.start(t);
  } catch (e) {}
}

function checkGateCode() {
  const row = document.getElementById("gate-code");
  const card = document.getElementById("gate-card");
  if (gateCode === GATE_CODE) {
    if (card) card.classList.add("ok");        // the sheet takes the light
    bloomSeal();                                // and the wax gives way
    setTimeout(() => { pageTurn("scrapbook", startDioramas); }, 1100);
  } else {
    document.getElementById("gate-error").textContent = "That isn't it — try again.";
    /* Show her the wrong code flashing before it clears, rather than
       wiping it out from under her the instant the fourth dot lands. */
    if (row) row.classList.add("bad");
    if (card) { card.classList.remove("shake"); void card.offsetWidth; card.classList.add("shake"); }
    gateThud();
    setTimeout(() => {
      gateCode = "";
      if (row) row.classList.remove("bad");
      paintGate();
    }, 620);
  }
}

/* the sound of a lock not turning */
function gateThud() {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const c = window.__gateAudio || (window.__gateAudio = new AC());
    if (c.state !== "running") { if (window.wakeAudio) window.wakeAudio(c); else c.resume(); }
    const t = c.currentTime, o = c.createOscillator(), g = c.createGain();
    o.type = "sawtooth";
    o.frequency.setValueAtTime(190, t);
    o.frequency.exponentialRampToValueAtTime(70, t + 0.22);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.07, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    o.connect(g); g.connect(c.destination);
    o.start(t); o.stop(t + 0.32);
  } catch (e) {}
}

/* Unlock flourish: the wax seal used to crack. Now it blooms — petals
   unfurl outward and a warm glow swells through as the seal dissolves. */
function bloomSeal() {
  const seal = document.getElementById("gate-seal");
  const wrap = seal ? seal.parentElement : null;
  if (seal) seal.classList.add("crack");     // the wax swells, turns and goes
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

(function wireGate() {
  const pad = document.getElementById("gate-pad");
  if (!pad) return;

  /* pointerdown, not click: the key should answer the moment she touches
     it. The .down class is cleared on release anywhere, so dragging off
     a key never leaves it stuck looking pressed. */
  pad.addEventListener("pointerdown", (e) => {
    const btn = e.target.closest("[data-gate-key]");
    if (!btn) return;
    e.preventDefault();
    btn.classList.add("down");
    const k = btn.getAttribute("data-gate-key");
    if (k === "back") gateBack();
    else if (k === "clear") gateClear();
    else gateType(k);
    if (navigator.vibrate) { try { navigator.vibrate(8); } catch (e) {} }
  });
  const unlock = document.getElementById("gate-submit");
  if (unlock) {
    unlock.addEventListener("pointerdown", (e) => { e.preventDefault(); unlock.classList.add("down"); });
    unlock.addEventListener("click", () => {
      /* Only judge a complete code. Pressing Unlock on two digits and
         being told it is wrong is just rude. */
      if (gateCode.length === 4) checkGateCode();
      else document.getElementById("gate-error").textContent = "four numbers first.";
    });
  }
  const release = () => {
    document.querySelectorAll(".gate-key.down,.gate-unlock.down")
      .forEach((b) => b.classList.remove("down"));
  };
  addEventListener("pointerup", release);
  addEventListener("pointercancel", release);

  /* a real keyboard, for whoever is on a laptop */
  addEventListener("keydown", (e) => {
    const g = document.getElementById("screen-gate");
    if (!g || !g.classList.contains("active")) return;
    if (e.key >= "0" && e.key <= "9") { gateType(e.key); e.preventDefault(); }
    else if (e.key === "Backspace") { gateBack(); e.preventDefault(); }
    else if (e.key === "Escape") { gateClear(); }
    else if (e.key === "Enter" && gateCode.length === 4) checkGateCode();
  });

  paintGate();
})();

/* =========================================================
   THE SCRAPBOOK
   The page logic lives in scrapbook.js; this half only owns the
   navigation between screens.
   ========================================================= */
function startDioramas() {           // kept as the name script.js calls
  if (window.Scrapbook) Scrapbook.start();
}
function stopDioramas() {
  if (window.Scrapbook) Scrapbook.stop();
}

/* ---------- wiring ---------- */
document.getElementById("sb-lb-close").addEventListener("click", () => Scrapbook.closeLightbox());
document.getElementById("sb-lightbox").addEventListener("click", (e) => {
  if (e.target.id === "sb-lightbox") Scrapbook.closeLightbox();
});
/* the book has no controls on it at all — the way out is the button on
   its back cover, which calls this */
window.leaveScrapbook = () => {
  stopDioramas();
  pageTurn("hub", startHub);
};
document.addEventListener("keydown", (e) => {
  if (!document.getElementById("screen-scrapbook").classList.contains("active")) return;
  if (e.key === "ArrowRight") Scrapbook.next();
  if (e.key === "ArrowLeft") Scrapbook.prev();
  if (e.key === "Escape") Scrapbook.closeLightbox();
});

/* =========================================================
   SUPER OUISSY
   The platformer lives entirely in super-ouissy.js. This half only
   owns getting in and out of it, exactly as the scrapbook does.
   Finishing it is remembered, but it is a bonus chapter: the keepsake
   still unlocks on the maze and the adventure alone, so nothing she has
   already finished can re-lock itself.
   ========================================================= */
function startSuperOuissy() {
  if (window.SuperOuissy) SuperOuissy.start();
}
function stopSuperOuissy() {
  if (window.SuperOuissy) SuperOuissy.stop();
}
window.leaveSuperOuissy = () => {
  stopSuperOuissy();
  pageTurn("hub", startHub);
};
window.markSuperOuissyDone = () => markChapterDone("ouissy");

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

  [["maze", d.maze], ["quest", d.quest], ["ouissy", d.ouissy]].forEach(([name, done]) => {
    const card = document.getElementById("hub-card-" + name);
    if (card) card.classList.toggle("done", !!done);
  });

  /* Three cards, so the line has to count three — it still said "two
     chapters" for as long as Super Ouissy has been on this board. The
     keepsake itself is still gated on the two story chapters; that is
     deliberate and unchanged. */
  const sub = document.getElementById("hub-sub");
  const count = (d.maze ? 1 : 0) + (d.quest ? 1 : 0) + (d.ouissy ? 1 : 0);
  if (both && count === 3) sub.textContent = "— all three done. the keepsake is yours —";
  else if (both) sub.textContent = "— both chapters done. the keepsake is yours —";
  else if (count) sub.textContent = "— " + count + " of three done, any order —";
  else sub.textContent = "— three ways in, any order —";

  document.getElementById("hub-keepsake").classList.toggle("on", both);
}

document.getElementById("hub-card-maze").addEventListener("click", () => {
  level = 1;
  pageTurn("details");
});
document.getElementById("hub-card-quest").addEventListener("click", () => {
  pageTurn("quest", startQuest);
});
document.getElementById("hub-card-ouissy").addEventListener("click", () => {
  pageTurn("ouissy", startSuperOuissy);
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
  if (chaptersDone().ouissy) badges.push({ icon: "👑", cap: "Super Ouissy" });
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
  pageTurn("scrapbook", startDioramas);
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

/* ---------------------------------------------------------
   KEEPING AUDIO ALIVE

   Every "the music just stopped and the toggle won't bring it back"
   report came down to the same two mistakes, so the recovery lives in
   one place and both the pad and the platformer go through it.

   1. Only "suspended" was treated as recoverable. iOS Safari does not
      use "suspended" when the system takes the audio session away — a
      call, the lock screen, another app, switching tabs — it uses
      "interrupted", which is not in the spec and which the old check
      silently ignored. So the sound died and stayed dead, and toggling
      it off and on could not help, because the toggle ran that same
      faulty check.

   2. resume() is asynchronous. The old code fired it and then scheduled
      a gain ramp against ctx.currentTime in the same breath — but a
      suspended context has a FROZEN clock, so by the time it really
      resumed, the whole ramp was already in the past. Silence, with
      every node reporting itself perfectly healthy.

   So: anything that is not "running" is treated as recoverable, work
   that depends on the clock waits for the resume to actually land, and
   a watchdog retries on the events that follow an interruption. A
   context in state "closed" can never be resumed at all — the only
   cure there is to build a new one, which the callers do.
   --------------------------------------------------------- */
const audioClients = [];

/* a getter, not a context: the caller may rebuild theirs at any point */
window.registerAudio = function (get) { audioClients.push(get); };

window.wakeAudio = function (ctx, then) {
  if (!ctx || ctx.state === "closed") return;
  if (ctx.state === "running") { if (then) then(); return; }

  let fired = false;
  const fire = () => { if (!fired) { fired = true; if (then) then(); } };
  const tryResume = () => {
    try {
      const p = ctx.resume();
      if (p && p.then) p.then(fire, () => {});
      else fire();
    } catch (e) {}
  };
  tryResume();

  /* Safari can resolve resume() while still sitting in "interrupted".
     One delayed retry costs nothing and covers exactly that case. */
  setTimeout(() => {
    if (ctx.state === "running") fire();
    else if (ctx.state !== "closed") tryResume();
  }, 350);
};

function pokeAllAudio() {
  audioClients.forEach((get) => { try { window.wakeAudio(get()); } catch (e) {} });
}
/* The four moments an interrupted context can legally come back. */
document.addEventListener("visibilitychange", () => { if (!document.hidden) pokeAllAudio(); });
window.addEventListener("focus", pokeAllAudio);
window.addEventListener("pageshow", pokeAllAudio);
document.addEventListener("pointerdown", pokeAllAudio, true);

/* Off unless something explicitly asks for it. This pad is a continuous
   drone, and when the floating toggle was removed as a dead control I
   defaulted it ON — which left a noise starting on the first tap of the
   intro and running for the rest of the visit with nothing anywhere to
   stop it. The games bring their own music and effects; the site itself
   is quiet. */
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

  /* This used to return without rescheduling when the music was off,
     which quietly ended the chain for good: one bell landing during a
     silent stretch and there were never any bells again, even after she
     turned the music back on. startBells() owns restarting it now. */
  function bell() {
    bellTimer = null;
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

  return { ctx, master, voices, sweep, filter, bell };
}

function setMusic(on) {
  musicOn = on;
  try { localStorage.setItem(MUSIC_KEY, on ? "1" : "0"); } catch (e) {}

  if (on) {
    /* A closed context is unrecoverable, so throw the stale graph away
       and let buildMusic start clean rather than ramping nodes that
       belong to a context that no longer exists. */
    if (audioCtx && audioCtx.state === "closed") { audioCtx = null; musicNodes = null; }
    if (!musicNodes) musicNodes = buildMusic();
    if (!musicNodes) return;

    window.wakeAudio(musicNodes.ctx, () => {
      if (!musicOn || !musicNodes) return;       // she changed her mind while it woke
      rampMaster(0.24, 1.6);
      startBells();
    });
  } else if (musicNodes) {
    rampMaster(0.0001, 0.7);
    clearTimeout(bellTimer); bellTimer = null;
  }
}

/* Ramps are only ever scheduled on a running clock — see wakeAudio. */
function rampMaster(to, secs) {
  if (!musicNodes || musicNodes.ctx.state !== "running") return;
  const g = musicNodes.master.gain, t = musicNodes.ctx.currentTime;
  g.cancelScheduledValues(t);
  g.setValueAtTime(Math.max(0.0001, g.value), t);
  g.exponentialRampToValueAtTime(Math.max(0.0001, to), t + secs);
}

function startBells() {
  clearTimeout(bellTimer);
  if (musicNodes && musicNodes.bell) {
    bellTimer = setTimeout(musicNodes.bell, 3500 + Math.random() * 4000);
  }
}

/* A scene with music of its own (the platformer) turns the pad down while
   it plays and puts it back afterwards. It deliberately does NOT touch the
   saved preference, so her toggle still means what she set it to. */
window.duckAmbient = function (on) {
  if (!musicNodes || !musicOn) return;
  rampMaster(on ? 0.02 : 0.24, 0.6);
};

/* Read-only hooks for tools/audio.js. They report; they never drive. */
window.__audioProbe = () => ({
  on: musicOn,
  ctx: musicNodes ? musicNodes.ctx.state : "none",
  gain: musicNodes ? musicNodes.master.gain.value : 0,
  bell: bellTimer !== null,
});
window.__audioSuspend = () => { if (musicNodes) musicNodes.ctx.suspend(); };

(function initMusic() {
  window.registerAudio(() => (musicNodes ? musicNodes.ctx : null));

  /* Nothing starts on its own. setMusic(true) still works and everything
     below it is intact, so a real control can switch the pad back on the
     day there is one to switch — but a drone that begins by itself and
     cannot be stopped is not something to ship. */
  if (!musicPreferred()) return;
  const kick = () => setMusic(true);
  document.addEventListener("pointerdown", kick, { once: true });
  document.addEventListener("keydown", kick, { once: true });
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

/* A butterfly with its wings at a given openness. 0 is edge-on (wings
   together above the back), 1 is fully spread. Sliding a fixed sprite
   sideways reads as a sticker; the wings have to actually beat. */
/* The bear in the orchard, side on with its head down in the windfalls.
   drawBear() is the arms-flung-wide, mouth-open, straight-at-you pose,
   which was built for a jumpscare — using it here would have contradicted
   the line above it ("it has not looked up yet") in the same frame. This
   one is not looking at you and cannot be made to: it is an obstacle in a
   scene, and the whole beat is getting round it while it is busy. */
function drawBearGrazing() {
  const { c, ctx } = spriteCanvas(58, 38);
  const T = ["#7a5232", "#5e3e26", "#452c1a", "#2f1d11"];   // lit → shadow
  const M = "#8a6a48";

  // hind quarters, then the shoulder hump bears actually have
  blob(ctx, 17, 19, 14, 11, T);
  blob(ctx, 33, 16, 13, 11, T);
  // the neck coming down off the hump, and the head at the bottom of it
  blob(ctx, 43, 22, 8, 8, T);
  blob(ctx, 48, 27, 7, 6, T);
  px(ctx, 51, 27, 6, 4, M);                 // muzzle, down in the grass
  px(ctx, 55, 28, 2, 2, "#241609");         // nose
  blob(ctx, 45, 20, 3.5, 3, T);             // ear, on the head and not the hump
  px(ctx, 47, 25, 2, 2, "#241609");         // the one eye you can see
  px(ctx, 47, 25, 1, 1, "#8f6440");         // and the glint that makes it read
  px(ctx, 3, 15, 5, 3, T[1]);               // tail

  // four legs, the far pair a tone darker so the body reads as solid
  px(ctx, 10, 27, 6, 11, T[2]); px(ctx, 36, 25, 6, 13, T[2]);
  px(ctx, 18, 28, 7, 10, T[1]); px(ctx, 29, 26, 7, 12, T[1]);
  px(ctx, 18, 35, 7, 3, T[3]);  px(ctx, 29, 35, 7, 3, T[3]);

  // moonlight along the spine
  px(ctx, 22, 9, 20, 1, "#8f6440");
  px(ctx, 30, 8, 10, 1, "#a07a52");
  return c;
}

/* The bear, flooded to one flat dark tone.
   Drawing the painted bear at low opacity gave a washed-out tan shape
   that read as a shed in the middle distance. A silhouette is the point:
   she should be able to tell it is big and not be able to tell what it
   is, which is the whole of that beat. */
function drawBearShadow() {
  const { c, ctx } = spriteCanvas(64, 56);
  const b = drawBear();
  ctx.drawImage(b, 0, 0);
  ctx.globalCompositeOperation = "source-atop";
  ctx.fillStyle = "#20301c";
  ctx.fillRect(0, 0, 64, 56);
  ctx.globalCompositeOperation = "source-over";
  return c;
}

function drawButterfly(colour, open) {
  const spread = open === undefined ? 1 : Math.max(0.12, open);
  const { c, ctx } = spriteCanvas(22, 16);
  const A = colour === "blue" ? "#6fb4ee" : "#f4685a";
  const B = colour === "blue" ? "#3f82c6" : "#c8402f";
  const D = colour === "blue" ? "#2b5f96" : "#982c20";
  const E = colour === "blue" ? "#cfe8ff" : "#ffdcb0";
  const cx = 11;

  /* wing width collapses toward the body as they close, and the far
     wing sits a touch higher so there is a sense of turn */
  const w1 = 5.4 * spread, w2 = 3.8 * spread;
  blob(ctx, cx - w1 * 0.95, 5, w1, 4.2, [E, A, B, D]);
  blob(ctx, cx + w1 * 0.95, 5 - (1 - spread) * 1.2, w1, 4.2, [E, A, B, D]);
  blob(ctx, cx - w2 * 0.9, 10, w2, 3.2, [A, B, D, D]);
  blob(ctx, cx + w2 * 0.9, 10 - (1 - spread) * 1, w2, 3.2, [A, B, D, D]);

  if (spread > 0.55) {
    px(ctx, cx - w1 * 1.4, 4, 2, 1, E);
    px(ctx, cx + w1 * 0.9, 4, 2, 1, E);
  }
  px(ctx, cx - 1, 3, 2, 10, "#3b2a1a");
  px(ctx, cx - 1, 12, 2, 2, "#5a4230");
  px(ctx, cx - 3, 0, 1, 3, "#3b2a1a"); px(ctx, cx + 2, 0, 1, 3, "#3b2a1a");
  px(ctx, cx - 4, 0, 1, 1, "#3b2a1a"); px(ctx, cx + 3, 0, 1, 1, "#3b2a1a");
  return c;
}

/* The fox, alive: ears twitch, the tail sweeps, and it blinks. */
function drawFoxAlive(t) {
  const { c, ctx } = spriteCanvas(40, 28);
  const O = "#f08b3c", O2 = "#d46f26", W = "#fff3e2", I = "#3b2a1a";
  const sweep = Math.sin(t * 1.5) * 3;
  const earTwitch = (t % 3.4) > 3.2 ? -1 : 0;
  const blink = (t % 4.8) > 4.62;
  const breathe = Math.sin(t * 1.9) > 0 ? 0 : 1;

  // tail, sweeping behind
  px(ctx, 2, 13 + sweep * 0.4, 15, 6, O2);
  px(ctx, 0, 9 + sweep, 8, 7, O);
  px(ctx, 0, 9 + sweep, 5, 4, W);

  px(ctx, 15, 11 + breathe, 16, 11, O);
  px(ctx, 17, 19, 12, 4, O2);
  px(ctx, 25, 5, 12, 11, O);                       // head
  px(ctx, 25, 3 + earTwitch, 5, 6, O2);
  px(ctx, 33, 3, 5, 6, O2);
  px(ctx, 26, 4 + earTwitch, 3, 4, "#f7c4a0");
  px(ctx, 34, 4, 3, 4, "#f7c4a0");
  px(ctx, 28, 11, 9, 5, W);
  if (blink) { px(ctx, 28, 9, 2, 1, I); px(ctx, 34, 9, 2, 1, I); }
  else { px(ctx, 28, 8, 2, 3, I); px(ctx, 34, 8, 2, 3, I); }
  px(ctx, 35, 12, 3, 2, I);
  px(ctx, 17, 22, 5, 4, O2); px(ctx, 25, 22, 5, 4, O2);
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

/* ---------- trees ----------
   A tree is a trunk that flares at the root, leans a little, splits into
   branches, and carries a canopy that OVERLAPS the top of the trunk so
   the join is hidden. Drawing a straight pole with a ball floating above
   it is what made the first version look wrong. */

function trunkCurve(ctx, x, groundY, h, w, tones, lean, rnd) {
  /* returns the top-centre point so branches and canopy can attach */
  var topX = x + (lean || 0) * h * 0.16;
  for (var i = 0; i < h; i++) {
    var t = i / h;                                  // 0 at root, 1 at top
    var y = groundY - i;
    var cx = x + (lean || 0) * h * 0.16 * (t * t);  // lean grows with height
    // taper, with a flare in the bottom eighth
    var flare = t < 0.12 ? (1 + (0.12 - t) * 5.2) : 1;
    var ww = Math.max(2, Math.round(w * (1 - t * 0.42) * flare));
    var half = ww >> 1;
    px(ctx, cx - half, y, ww, 1, tones[1]);
    // lit edge, fading out toward the top
    px(ctx, cx - half, y, Math.max(1, Math.round(ww * 0.28)), 1, tones[0]);
    // shadow edge
    px(ctx, cx + half - 1, y, 1, 1, tones[2]);
    // bark grain: short broken vertical marks, not a continuous stripe
    if (rnd && ww > 3 && rnd() > 0.72) {
      px(ctx, cx - half + 1 + Math.floor(rnd() * (ww - 2)), y, 1, 1, tones[2]);
    }
  }
  // roots spreading into the ground
  if (rnd) {
    for (var r = 0; r < 3; r++) {
      var dir = r === 1 ? 0 : (r === 0 ? -1 : 1);
      var rl = 2 + Math.floor(rnd() * 3);
      for (var k = 0; k < rl; k++) {
        px(ctx, x + dir * (w * 0.5 + k), groundY + Math.floor(k * 0.5), 2, 1, tones[2]);
      }
    }
  }
  return topX;
}

function branchArm(ctx, x, y, len, ang, w, tones) {
  for (var i = 0; i < len; i++) {
    var bx = x + Math.cos(ang) * i;
    var by = y + Math.sin(ang) * i;
    var ww = Math.max(1, Math.round(w * (1 - i / len * 0.7)));
    px(ctx, bx, by, ww, ww, tones[1]);
    if (i < len * 0.4) px(ctx, bx, by, 1, 1, tones[0]);
  }
  return [x + Math.cos(ang) * len, y + Math.sin(ang) * len];
}

/* A full tree: trunk, branches, and a canopy that sits over the join. */
function treeFull(ctx, x, groundY, h, barkTones, leafTones, rnd, opts) {
  opts = opts || {};
  var w = opts.w || Math.max(3, Math.round(h * 0.10));
  var lean = opts.lean !== undefined ? opts.lean : (rnd() - 0.5) * 0.7;
  var topX = trunkCurve(ctx, x, groundY, h, w, barkTones, lean, rnd);
  var topY = groundY - h;

  // branches fanning out just below the crown
  var arms = opts.arms === undefined ? 3 : opts.arms;
  var tips = [];
  for (var i = 0; i < arms; i++) {
    var a = -Math.PI / 2 + (i - (arms - 1) / 2) * (0.55 + rnd() * 0.2);
    var bl = h * (0.16 + rnd() * 0.12);
    tips.push(branchArm(ctx, topX, topY + h * 0.14, bl, a, Math.max(1, w * 0.4), barkTones));
  }

  // canopy: a mass of overlapping puffs centred over the trunk top, sized
  // so it always covers where trunk and branches end
  var r = opts.r || h * 0.52;
  var cy = topY + r * 0.16;
  canopy(ctx, topX, cy, r, leafTones, rnd, opts.speckle);
  tips.forEach(function (tp) {
    blob(ctx, tp[0], tp[1] - r * 0.18, r * 0.46, r * 0.36, leafTones);
  });
  // a few leaves catching light on top
  if (opts.speckle) {
    for (var k = 0; k < r * 0.9; k++) {
      var aa = rnd() * Math.PI * 2, rr = rnd() * r * 0.8;
      px(ctx, topX + Math.cos(aa) * rr, cy + Math.sin(aa) * rr * 0.7 - r * 0.15, 1, 1, opts.speckle);
    }
  }
  return { x: topX, y: cy, r: r };
}

/* Overhead canopy: boughs reaching in from the top of the frame, each
   with a visible limb and clusters of leaves hanging off it, shaded
   darker underneath. Free-floating ellipses in the sky read as green
   clouds — a canopy has to be attached to something. */
function overheadCanopy(ctx, W, rnd, tones, barkTones, count, reach) {
  var boughs = count || 5;
  for (var i = 0; i < boughs; i++) {
    var rootX = Math.round((i + 0.5) / boughs * W + (rnd() - 0.5) * 24);
    var dir = rootX < W / 2 ? 1 : -1;
    var len = (reach || 44) * (0.7 + rnd() * 0.6);
    var ang = (dir > 0 ? 0.55 : Math.PI - 0.55) + (rnd() - 0.5) * 0.4;

    // the limb itself, thinning as it reaches in
    var lx = rootX, ly = -3;
    for (var k = 0; k < len; k++) {
      var t = k / len;
      var w = Math.max(1, Math.round(4 * (1 - t * 0.65)));
      lx += Math.cos(ang) * 1;
      ly += Math.sin(ang) * 1;
      px(ctx, lx, ly, w, w, barkTones[1]);
      if (k % 9 === 0) px(ctx, lx, ly, 1, 1, barkTones[0]);
      // side twigs
      if (k > len * 0.3 && k % 11 === 0) {
        var ta = ang + (rnd() > 0.5 ? 0.9 : -0.9);
        for (var m = 0; m < 7; m++) px(ctx, lx + Math.cos(ta) * m, ly + Math.sin(ta) * m, 1, 1, barkTones[2]);
      }
    }

    // leaf clusters hanging along the limb
    var clusters = 3 + Math.floor(rnd() * 3);
    for (var c = 0; c < clusters; c++) {
      var ct = 0.18 + (c / clusters) * 0.85;
      var cx = rootX + Math.cos(ang) * len * ct;
      var cy = -3 + Math.sin(ang) * len * ct;
      var r = 10 + rnd() * 8;
      canopy(ctx, cx, cy, r, tones, rnd, "#cbe89c");
      // shaded underside so the mass has weight
      for (var u = -r; u < r; u += 1) {
        if (rnd() > 0.55) px(ctx, cx + u, cy + r * 0.52 + rnd() * 3, 1, 1, tones[3] || tones[2]);
      }
    }
  }
}

/* A birch: pale, slender, gently curved, with irregular bark scars and a
   canopy of its own so it is never a pole disappearing into a green band. */
function birch(ctx, x, groundY, h, rnd, opts) {
  opts = opts || {};
  var w = opts.w || Math.max(3, Math.round(h * 0.075));
  var bark = ["#f6f1e6", "#ddd3bf", "#b6ab93"];
  var lean = opts.lean !== undefined ? opts.lean : (rnd() - 0.5) * 0.5;
  var topX = trunkCurve(ctx, x, groundY, h, w, bark, lean, rnd);
  var topY = groundY - h;

  // scars: irregular length, irregular spacing, some doubled
  var y = groundY - 6;
  while (y > topY + h * 0.18) {
    var sw = 2 + Math.floor(rnd() * (w + 1));
    var sx = x + (rnd() - 0.5) * (w * 0.5);
    px(ctx, sx - (sw >> 1), y, sw, 1, "#6f6858");
    if (rnd() > 0.7) px(ctx, sx - (sw >> 1) + 1, y - 1, Math.max(1, sw - 2), 1, "#8d8570");
    y -= 8 + Math.floor(rnd() * 14);
  }

  var leaves = opts.leaves || ["#a8cc72", "#87b055", "#67903f", "#4d722e"];
  var r = opts.r || h * 0.34;
  for (var i = 0; i < 2; i++) {
    var a = -Math.PI / 2 + (i ? 0.7 : -0.7);
    branchArm(ctx, topX, topY + h * 0.12, h * 0.12, a, 2, bark);
  }
  canopy(ctx, topX, topY + r * 0.2, r, leaves, rnd, "#c8e79a");
  return { x: topX, y: topY, r: r };
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

/* A paper lantern on a wire: the light source the whole right-hand path
   is lit by, so it is one function rather than eight copies. */
function lanternAt(ctx, x, y) {
  /* The glow first, in rings, so the light falls off instead of being a
     flat rectangle over the paper — this is the only light source on the
     whole right-hand path and it has to look like one. */
  var rings = [[16, 0.05], [12, 0.08], [9, 0.12], [6, 0.18]];
  for (var i = 0; i < rings.length; i++) {
    blob(ctx, x, y + 3, rings[i][0], rings[i][0] * 0.9,
         ["rgba(255,208,132," + rings[i][1] + ")"]);
  }
  px(ctx, x, y - 5, 1, 2, "#3a2a1e");                 // the hook
  blob(ctx, x, y + 3, 5, 6, ["#ffd98a", "#f0a95e", "#c87a44"]);
  px(ctx, x - 1, y - 1, 3, 1, "#fff2c8");             // the flame inside
  px(ctx, x - 3, y + 9, 7, 1, "#8a5a38");             // the tassel
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

    /* open sky overhead — the trees stand in the scene, nothing hangs */
    cloudRow(ctx, PXW, 20, 4, ["#ffffff", "#f4f8fc", "#e2e9f2", "#cfd8e6"], rnd, 1.15);
    cloudRow(ctx, PXW, 40, 3, ["#fdfeff", "#eef4fa", "#dce5f0", "#c9d4e4"], rnd, 0.8);

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
    var leaf = ["#a3c96e", "#84ac52", "#65873b", "#4b6729"];

    /* Mid-distance trees: full crowns, grounded on the bank behind the path.
       Sized so the canopy is always wider than the trunk is tall-looking. */
    [[54, 116, 46], [252, 114, 42], [104, 110, 34]].forEach(function (t) {
      treeFull(ctx, t[0], t[1], t[2], bark, leaf, rnd, { speckle: "#cbe89c" });
    });

    /* Framing trees at the very edges. Their trunks stop well below the top
       of the frame and the crown spills off the corner, so the trunk never
       runs the whole height with a clipped ball stuck on the end. */
    [[10, 118, -0.5], [PXW - 14, 122, 0.5]].forEach(function (t) {
      var h = t[1];
      var topX = trunkCurve(ctx, t[0], PXH, h, 15, bark, t[2], rnd);
      var topY = PXH - h;
      branchArm(ctx, topX, topY + 16, 22, -Math.PI / 2 + (t[2] > 0 ? -0.75 : 0.75), 5, bark);
      canopy(ctx, topX + (t[2] > 0 ? -10 : 10), topY - 4, 40, leaf, rnd, "#cbe89c");
      canopy(ctx, topX + (t[2] > 0 ? -34 : 34), topY + 10, 26, leaf, rnd, "#cbe89c");
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
    cloudRow(ctx, PXW, 22, 4, ["#ffffff", "#f3f8fb", "#e0e9f0", "#ccd7e2"], rnd, 1.05);
    cloudRow(ctx, PXW, 44, 2, ["#fdfeff", "#edf4f8", "#d9e4ec", "#c5d2de"], rnd, 0.75);

    ditherSky(ctx, 0, 116, PXW, PXH - 116, [
      { p: 0.00, c: "#7aa54c" }, { p: 0.42, c: "#658c3c" }, { p: 1.00, c: "#4e6d2f" },
    ]);
    pathTo(ctx, PXW, 122, PXH, 1.2, 12, 66, "#c2a473", "#ae9163", "#997d52");

    /* Birches, each carrying its own crown. Previously these were
       untapered poles that ran up into a canopy band they were not
       attached to, which read as fence posts. */
    [[34, 152, 118, -0.4], [88, 148, 96, 0.25], [PXW - 46, 154, 112, 0.35],
     [PXW - 104, 146, 88, -0.2], [162, 142, 72, 0.15]].forEach(function (t) {
      birch(ctx, t[0], t[1], t[2], rnd, { lean: t[3],
        leaves: ["#a8cc72", "#87b055", "#67903f", "#4d722e"] });
    });

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
  /* ===================================================================
     THE WAY BACK — the right-hand path.

     Same valley, a year on, after dark. Where the spring side is open
     and bright and full of everything you have not done yet, this one is
     warm and close and lit by things somebody had to hang up: lanterns,
     windows, a fire. It is the difference between finding each other and
     staying, and it should feel like it.
     =================================================================== */

  /* 5. the lantern path — where the right-hand journey begins */
  lantern(ctx, rnd) {
    ditherSky(ctx, 0, 0, PXW, PXH, [
      { p: 0.00, c: "#171a3a" }, { p: 0.22, c: "#22254e" },
      { p: 0.44, c: "#3a3160" }, { p: 0.62, c: "#5d3f65" },
      { p: 0.78, c: "#8a5560" }, { p: 1.00, c: "#b87a63" },
    ]);
    for (var i = 0; i < 70; i++) {
      var sy = rnd() * 60;
      px(ctx, rnd() * PXW, sy, 1, 1, sy < 26 ? "#fff6d8" : "#e8dcc0");
    }
    /* a low moon, sitting in the last of the light */
    sunDisc(ctx, PXW - 54, 34, 9, "#fdf3d0", "rgba(255,240,200,0.16)");

    hillBand(ctx, PXW, 92, 11, 0.019, ["#3b3358", "#2f2a48", "#251f38"], rnd, 3);
    hillBand(ctx, PXW, 106, 8, 0.03, ["#2b2742", "#221e35", "#1a1729"], rnd, 7);
    pineRow(ctx, PXW, 122, 46, ["#1d2a30", "#162126", "#101a1e"], rnd, 1.0);

    /* the ground, and the path home through it */
    px(ctx, 0, 120, PXW, PXH - 120, "#2a2b34");
    ditherSky(ctx, 0, 120, PXW, PXH - 120, [
      { p: 0.00, c: "#33323f" }, { p: 1.00, c: "#22222c" },
    ]);
    pathTo(ctx, PXW, 122, PXH, 0.04, 12, 62, "#6b5a48", "#54473a", "#3d342c");
    grassTufts(ctx, PXW, 126, 40, ["#2f3a2e", "#26301f", "#1d2618"], rnd);
    stones(ctx, PXW, 150, 9, ["#4a4650", "#3a3742", "#2c2a33"], rnd);

    /* the lanterns themselves, strung along the path */
    for (var L = 0; L < 5; L++) {
      var lx = 26 + L * 62 + rnd() * 10, ly = 74 + rnd() * 8;
      px(ctx, lx, 0, 1, ly - 6, "#171a2c");           // the wire up into the dark
      /* the pool it throws on the path below it */
      blob(ctx, lx, 138 + rnd() * 8, 22, 5, ["rgba(255,198,120,0.10)"]);
      blob(ctx, lx, 138 + rnd() * 8, 13, 3, ["rgba(255,208,140,0.13)"]);
      lanternAt(ctx, lx, ly);
    }
    /* fireflies, because a warm night should have some */
    for (var f = 0; f < 22; f++) {
      var fx = rnd() * PXW, fy = 96 + rnd() * 56;
      px(ctx, fx, fy, 1, 1, rnd() > 0.5 ? "#ffe9a0" : "#ffd06a");
      px(ctx, fx - 1, fy, 3, 1, "rgba(255,220,140,0.16)");
    }
  },

  /* 6. the ridge — the blue butterfly's way, high and open and cold */
  ridge(ctx, rnd) {
    ditherSky(ctx, 0, 0, PXW, PXH, [
      { p: 0.00, c: "#0d1230" }, { p: 0.34, c: "#182046" },
      { p: 0.66, c: "#2b2f5c" }, { p: 1.00, c: "#46406e" },
    ]);
    for (var i = 0; i < 150; i++) {
      var sy = rnd() * 96, b = rnd();
      px(ctx, rnd() * PXW, sy, 1, 1, b > 0.86 ? "#ffffff" : b > 0.5 ? "#dfe6ff" : "#9aa6d8");
    }
    /* the one bright one, low over the ridge */
    px(ctx, 214, 30, 1, 1, "#ffffff");
    px(ctx, 213, 30, 3, 1, "rgba(255,255,255,0.5)");
    px(ctx, 214, 29, 1, 3, "rgba(255,255,255,0.5)");

    hillBand(ctx, PXW, 74, 16, 0.013, ["#2a2f58", "#222648", "#1a1d38"], rnd, 1);
    hillBand(ctx, PXW, 96, 12, 0.022, ["#1f2342", "#191c34", "#131627"], rnd, 6);
    pineRow(ctx, PXW, 116, 30, ["#141d24", "#0f161c", "#0a1014"], rnd, 0.9);

    /* the ridge line she is standing on, bare rock and thin grass */
    px(ctx, 0, 116, PXW, PXH - 116, "#1c2029");
    ditherSky(ctx, 0, 116, PXW, PXH - 116, [
      { p: 0.00, c: "#242835" }, { p: 1.00, c: "#161922" },
    ]);
    stones(ctx, PXW, 132, 14, ["#3d4250", "#2f3340", "#232630"], rnd);
    stones(ctx, PXW, 158, 10, ["#343946", "#282c37", "#1d2029"], rnd);
    grassTufts(ctx, PXW, 122, 26, ["#243026", "#1d271e", "#161e17"], rnd);
  },

  /* 7. the night orchard — the red butterfly's way, low and close and warm */
  orchard(ctx, rnd) {
    ditherSky(ctx, 0, 0, PXW, PXH, [
      { p: 0.00, c: "#1a1636" }, { p: 0.36, c: "#2a2048" },
      { p: 0.68, c: "#452a4e" }, { p: 1.00, c: "#6b3a48" },
    ]);
    for (var i = 0; i < 60; i++) px(ctx, rnd() * PXW, rnd() * 54, 1, 1, "#efe4c4");
    sunDisc(ctx, 42, 28, 7, "#f6ecc8", "rgba(246,236,200,0.13)");

    hillBand(ctx, PXW, 98, 8, 0.026, ["#33254a", "#291d3b", "#20172e"], rnd, 4);

    px(ctx, 0, 116, PXW, PXH - 116, "#2c2733");
    ditherSky(ctx, 0, 116, PXW, PXH - 116, [
      { p: 0.00, c: "#37303c", }, { p: 1.00, c: "#241f2b" },
    ]);

    /* rows of fruit trees, each with a lantern hung in it */
    var bark = ["#4a3428", "#3a2820", "#2b1e18"];
    var leaf = ["#2f4436", "#26382c", "#1c2a21"];
    for (var r = 0; r < 5; r++) {
      var tx = 18 + r * 66 + rnd() * 12;
      treeFull(ctx, tx, 120 + (r % 2) * 4, 44 + rnd() * 10, bark, leaf, rnd, { speckle: 10 });
      if (r % 2 === 0) lanternAt(ctx, tx + 12, 84 + rnd() * 6);
    }
    grassTufts(ctx, PXW, 124, 34, ["#2b3a2c", "#22301f", "#192518"], rnd);
    flowerDots(ctx, PXW, 138, 26, 22, ["#c88aa0", "#a86e8a", "#e0a8b8"], rnd);
  },

  /* 8. the rope bridge — one at a time, or not at all */
  bridge(ctx, rnd) {
    ditherSky(ctx, 0, 0, PXW, PXH, [
      { p: 0.00, c: "#121736" }, { p: 0.40, c: "#1e2448" },
      { p: 0.72, c: "#33305c" }, { p: 1.00, c: "#4d3a5e" },
    ]);
    for (var i = 0; i < 110; i++) px(ctx, rnd() * PXW, rnd() * 80, 1, 1, "#d8dcf0");

    hillBand(ctx, PXW, 70, 14, 0.016, ["#262b50", "#1e2240", "#171a31"], rnd, 2);
    pineRow(ctx, PXW, 96, 26, ["#111a20", "#0c1318", "#080d11"], rnd, 0.8);

    /* the gorge: dark all the way down, with water a long way below */
    px(ctx, 0, 96, PXW, PXH - 96, "#0b0e16");
    ditherSky(ctx, 0, 150, PXW, PXH - 150, [
      { p: 0.00, c: "#1b2740" }, { p: 1.00, c: "#101a2c" },
    ]);
    for (var w = 0; w < 26; w++) {
      var wx = rnd() * PXW, wy = 152 + rnd() * 24;
      px(ctx, wx, wy, 2 + rnd() * 4, 1, "rgba(150,180,220,0.28)");
    }

    /* the near and far banks */
    px(ctx, 0, 96, 54, PXH - 96, "#231f2b");
    px(ctx, PXW - 58, 96, 58, PXH - 96, "#231f2b");
    stones(ctx, 54, 104, 6, ["#3b3644", "#2e2a36", "#221f29"], rnd);

    /* the bridge itself — two ropes and a lot of trust */
    var y0 = 106, sag = 16;
    for (var x = 54; x < PXW - 58; x++) {
      var k = (x - 54) / (PXW - 112);
      var y = y0 + Math.sin(k * Math.PI) * sag;
      px(ctx, x, y, 1, 1, "#7a6248");
      px(ctx, x, y - 13, 1, 1, "#5e4b38");
      if ((x - 54) % 7 === 0) {
        px(ctx, x, y - 13, 1, 13, "#4a3b2c");        // a hanger
        px(ctx, x - 1, y + 1, 4, 2, "#6b5540");      // and a plank
      }
    }
    lanternAt(ctx, 50, 88);
    lanternAt(ctx, PXW - 54, 88);
  },

  /* 9. the stream bank — the red butterfly's way there.
     Same spring world as the meadow route and deliberately not the same
     ground: down at the water instead of up in the open. The stream runs
     across the frame rather than toward you, so the seven stones read as
     a crossing you can see all of, and everything sits above the note. */
  stream(ctx, rnd) {
    ditherSky(ctx, 0, 0, PXW, PXH, [
      { p: 0.00, c: "#8ecdea" }, { p: 0.22, c: "#b4e0f0" },
      { p: 0.44, c: "#d6ecea" }, { p: 1.00, c: "#cfe6c2" },
    ]);
    cloudRow(ctx, PXW, 16, 4, ["#ffffff", "#f4f9fd", "#e2ebf4", "#cfdae8"], rnd, 1.1);
    cloudRow(ctx, PXW, 36, 3, ["#fdfeff", "#eef5fb", "#dbe6f0", "#c8d5e4"], rnd, 0.7);
    sunRays(ctx, PXW * 0.22, -14, PXW, PXH, "#fffbdc", rnd, 6);

    hillBand(ctx, PXW, 72, 7, 0.018, ["#c2dcb8", "#aec9a4", "#9ab490"], rnd, 1.4);
    hillBand(ctx, PXW, 84, 5, 0.027, ["#a8cc96", "#93b781", "#7fa16e"], rnd, 3.8);

    /* the far bank, sloping down to the water, and the wood standing on it */
    ditherSky(ctx, 0, 88, PXW, 22, [
      { p: 0.00, c: "#84b060" }, { p: 0.55, c: "#719c4e", }, { p: 1.00, c: "#5c8440" },
    ]);
    var bark = ["#9c7248", "#7d5734", "#5e3f22"];
    var leaf = ["#9cc468", "#7ea84e", "#628a38", "#496a28"];
    [[40, 108, 40], [178, 106, 34], [292, 108, 38]].forEach(function (t) {
      treeFull(ctx, t[0], t[1], t[2], bark, leaf, rnd, { speckle: "#c6e69a" });
    });
    bush(ctx, 108, 106, 9, ["#7aa64c", "#659040", "#517631", "#3f5c25"], rnd);
    bush(ctx, 240, 108, 8, ["#7aa64c", "#659040", "#517631", "#3f5c25"], rnd);

    /* the water. Dithered into the bank at both edges rather than cut,
       which is what stopped the first version reading as a pond. */
    var wTop = 108, wBot = 148;
    ditherSky(ctx, 0, wTop, PXW, wBot - wTop, [
      { p: 0.00, c: "#6f9e8e" }, { p: 0.18, c: "#4f86a8" },
      { p: 0.58, c: "#3f76a0" }, { p: 1.00, c: "#5d8f9a" },
    ]);
    // the shallow lip where it meets each bank
    for (var e = 0; e < PXW; e++) {
      var wob = Math.sin(e * 0.09) * 1.6 + Math.sin(e * 0.31) * 0.8;
      px(ctx, e, wTop + wob, 1, 2, "#8fc0c4");
      px(ctx, e, wBot - 2 + wob * 0.6, 1, 2, "#7fb0ae");
    }
    // the current: short dashes, faster and brighter down the middle
    for (var w = 0; w < 150; w++) {
      var wy = wTop + 3 + rnd() * (wBot - wTop - 6);
      var mid = 1 - Math.abs((wy - (wTop + wBot) / 2) / ((wBot - wTop) / 2));
      px(ctx, rnd() * PXW, wy, 2 + rnd() * (3 + mid * 5), 1,
        rnd() > 0.62 ? "#a8d2e6" : rnd() > 0.4 ? "#6fa0c0" : "#37698e");
    }
    // reeds standing out of the far edge
    for (var r3 = 0; r3 < 34; r3++) {
      var rx = rnd() * PXW, rh = 5 + rnd() * 9;
      for (var yy = 0; yy < rh; yy++) px(ctx, rx + (yy > rh / 2 ? 1 : 0), wTop - yy, 1, 1, "#5f8a44");
    }
    // the fallen trunk, half in the water, because banks always have one
    px(ctx, 196, wTop + 4, 74, 4, "#7d5734");
    px(ctx, 196, wTop + 4, 74, 1, "#a1794f");
    for (var kn = 0; kn < 8; kn++) px(ctx, 202 + kn * 9, wTop + 1, 1, 3, "#6b4a2c");
    px(ctx, 196, wTop + 8, 74, 1, "rgba(160,200,220,0.4)");   // its reflection

    /* the near bank: gravel first, then the grass you are standing on */
    ditherSky(ctx, 0, wBot - 2, PXW, 16, [
      { p: 0.00, c: "#b9ae92" }, { p: 1.00, c: "#8f8670" },
    ]);
    stones(ctx, PXW, wBot + 4, 22, ["#d6c9ab", "#bfb094", "#a2937a"], rnd);
    ditherSky(ctx, 0, wBot + 14, PXW, PXH - wBot - 14, [
      { p: 0.00, c: "#7fae56" }, { p: 0.5, c: "#6d9a46" }, { p: 1.00, c: "#5a8038" },
    ]);

    /* the seven stones, walked from the near bank up to the far one, laid
       across the current so all of them are above the speech note */
    for (var k = 0; k < 7; k++) {
      var sx = 52 + k * 34 + Math.sin(k * 1.3) * 5;
      var sy = wBot - 5 - k * 5;
      blob(ctx, sx, sy, 8, 4, ["#e2d8bd", "#c8bba0", "#a89b83", "#877c68"]);
      px(ctx, sx - 8, sy + 3, 16, 1, "#9fcbd8");        // the water breaking round it
      px(ctx, sx - 6, sy + 4, 12, 1, "rgba(255,255,255,0.35)");
    }

    grassTufts(ctx, PXW, wBot + 20, 34, ["#7fae52", "#93bd5e", "#6a9440"], rnd);
    flowerDots(ctx, PXW, wBot + 22, 26, 24, ["#ffffff", "#ffd166", "#ffc2da"], rnd);
  },

  /* 10. the door — where the way back ends.
     The one interior-ish scene in the game: the valley has gone dark
     behind you and all the light in the frame is light somebody left on.
     Deliberately the warmest palette here, against the sunset's pink. */
  home(ctx, rnd) {
    ditherSky(ctx, 0, 0, PXW, PXH, [
      { p: 0.00, c: "#0e1130" }, { p: 0.30, c: "#171a3c" },
      { p: 0.60, c: "#241f44" }, { p: 1.00, c: "#332544" },
    ]);
    for (var i = 0; i < 90; i++) {
      var sy = rnd() * 78, b = rnd();
      px(ctx, rnd() * PXW, sy, 1, 1, b > 0.85 ? "#ffffff" : b > 0.5 ? "#dde3ff" : "#9aa2cc");
    }
    sunDisc(ctx, 40, 26, 8, "#f4ecd0", "rgba(244,236,208,0.12)");

    /* the valley, already behind you and already dark */
    hillBand(ctx, PXW, 84, 12, 0.017, ["#241f3e", "#1c1832", "#151228"], rnd, 2);
    hillBand(ctx, PXW, 98, 8, 0.028, ["#1a1730", "#141126", "#0f0d1d"], rnd, 6);
    pineRow(ctx, PXW, 112, 34, ["#12161e", "#0d1017", "#090b11"], rnd, 0.85);
    // two lanterns still burning back down the path
    lanternAt(ctx, 22, 92);
    lanternAt(ctx, 74, 96);

    /* the ground, and the last of the path arriving at the step */
    px(ctx, 0, 112, PXW, PXH - 112, "#221e2a");
    ditherSky(ctx, 0, 112, PXW, PXH - 112, [
      { p: 0.00, c: "#2b2632" }, { p: 1.00, c: "#1a1720" },
    ]);
    pathTo(ctx, PXW, 114, PXH, -0.6, 10, 46, "#5e4d3c", "#4a3d30", "#372e24");

    /* the house, filling the right of the frame. It gets a real corner —
       a lit return edge and an eaves line that oversails it — because a
       flat panel butted against the sky reads as a wall, not a building. */
    var wallX = 176;
    px(ctx, wallX, 34, PXW - wallX, PXH - 34, "#2e2430");
    ditherSky(ctx, wallX, 34, PXW - wallX, PXH - 34, [
      { p: 0.00, c: "#3a2d38" }, { p: 1.00, c: "#241c26" },
    ]);
    // clapboard, picked out by the doorlight
    for (var b2 = 0; b2 < 22; b2++) px(ctx, wallX, 40 + b2 * 7, PXW - wallX, 1, "#453648");
    // the corner: a narrow return catching the moon, then the shadow of it
    px(ctx, wallX, 34, 4, PXH - 34, "#4a3a4c");
    px(ctx, wallX, 34, 2, PXH - 34, "#5f4a60");
    px(ctx, wallX + 4, 34, 2, PXH - 34, "#241c26");
    // the eaves, oversailing the corner so the roof reads as a roof
    px(ctx, wallX - 7, 28, PXW - wallX + 7, 6, "#3a2d38");
    px(ctx, wallX - 7, 28, PXW - wallX + 7, 2, "#57445a");
    px(ctx, wallX - 7, 34, PXW - wallX + 7, 1, "#1b1520");
    for (var rf = 0; rf < 5; rf++) px(ctx, wallX + 8 + rf * 28, 34, 2, 4, "#2b2130");   // rafter ends

    /* the lit window. Kept left of where the side choice buttons land, so
       a label never has to sit on top of the brightest thing in frame. */
    var wx = 230, wy = 48, ww = 32, wh = 24;
    px(ctx, wx - 3, wy - 3, ww + 6, wh + 6, "#54415a");
    px(ctx, wx - 3, wy - 3, ww + 6, 2, "#6b5470");
    px(ctx, wx - 4, wy + wh + 3, ww + 8, 3, "#5f4a60");    // the sill
    ditherSky(ctx, wx, wy, ww, wh, [{ p: 0, c: "#fff0bc" }, { p: 1, c: "#ffbe6a" }]);
    px(ctx, wx + ww / 2 - 1, wy, 2, wh, "#54415a");
    px(ctx, wx, wy + wh / 2 - 1, ww, 2, "#54415a");
    blob(ctx, wx + ww / 2, 138, 42, 8, ["rgba(255,200,120,0.10)"]);

    /* the door, open, with the whole point of the scene coming out of it */
    var dx = 196, dy = 88, dw = 34, dh = PXH - 88;
    px(ctx, dx - 4, dy - 5, dw + 8, dh + 5, "#4a3a4c");
    px(ctx, dx - 4, dy - 5, dw + 8, 3, "#6b5470");         // the lintel
    ditherSky(ctx, dx, dy, dw, dh, [
      { p: 0.00, c: "#fff2c8" }, { p: 0.55, c: "#ffc978" }, { p: 1.00, c: "#f0a955" },
    ]);
    px(ctx, dx, dy, 2, dh, "#e09a4e");                     // the jambs, in shadow
    px(ctx, dx + dw - 2, dy, 2, dh, "#e09a4e");
    px(ctx, dx + 4, PXH - 22, dw - 8, 6, "#e8a95c");       // a strip of floor inside
    // the light spilling out across the ground, softening as it goes
    for (var g = 0; g < 44; g++) {
      var gy = 140 + rnd() * 38;
      var spread = (gy - 138) * 2.6;
      px(ctx, dx - spread * rnd(), gy, 2 + rnd() * 6, 1, "rgba(255,198,120,0.13)");
    }
    px(ctx, dx - 4, PXH - 10, dw + 12, 4, "#5a4756");     // the step
    px(ctx, dx - 4, PXH - 10, dw + 12, 1, "#7a6274");
    // the lamp over the door
    lanternAt(ctx, dx + dw / 2, 76);

    /* a pot by the step, because a door needs something lived-in on it */
    blob(ctx, 168, 168, 8, 6, ["#7a5340", "#63432f", "#4c3324", "#3a2619"]);
    bush(ctx, 168, 160, 7, ["#3e5a3a", "#32492e", "#263822", "#1c2a19"], rnd);

    grassTufts(ctx, 170, 128, 22, ["#2b3a2c", "#22301f", "#192518"], rnd);
  },

};

/* =========================================================
   ✏️  THE ADVENTURE — CUSTOMIZE ME

   One closing question per path, because the two paths are not asking
   the same thing. The way there asks it for the first time. The way
   back asks it again, a year on, which is the harder question and the
   better one. The nudge and its two answers are shared: whichever
   question she is looking at, saying no gets the same crying cat.
   ========================================================= */
const QUEST_FINAL = {
  question:     "Will you be my Valentine?",                            // the way there
  questionBack: "Same valley, a year on. Would you do it all again?",   // the way back
  nudge: "You sure about that?",
  nudgeYes: "I changed my mind",
  nudgeNo: "Yup",
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
/* =========================================================
   THE LONG WAY ROUND

   Two paths, and they are not two versions of the same walk.

   The way there is the spring side: bright, open, everything still
   ahead of you, and its obstacles are all obstacles of not knowing —
   a wrong turn, a bear that turns out to be nerves, a fog that lifts.

   The way back is the same valley a year on, after dark, lit by things
   somebody had to hang up. Its obstacles are quieter and harder: weather
   you shelter through, a climb, a bridge that only holds one at a time.

   Within each path the two butterflies take genuinely different routes —
   different scenes, different beats — and arrive at the same place,
   because on that path you were always going to. Neither is a trap.
   ========================================================= */
const HV = {
  title: {
    scene: "sakura", cat: "happy", title: true, tagline: "Ready for a little adventure?",
    say: "",
    choices: [{ label: "BEGIN", to: "pick", pos: "centre", style: "start" }],
  },

  /* The first of the three forks. It decides nothing about where you go —
     both cards lead to the same next screen — but it is remembered for the
     whole walk, and it is what you are still holding at the end. */
  pick: {
    scene: "sakura", cat: "idle",
    say: "Pick a heart or a flower?",
    cards: [
      { art: "heart", to: "ways", keepsake: "heart" },
      { art: "flower", to: "ways", keepsake: "flower" },
    ],
  },

  ways: {
    scene: "meadow", cat: "idle",
    say: "Two ways through the valley. Which one are we walking?",
    choices: [
      { label: "THE WAY THERE", to: "there", pos: "left" },
      { label: "THE WAY BACK", to: "back_dusk", pos: "right" },
    ],
  },

  /* ---------------- LEFT: the way there ---------------- */
  there: {
    scene: "sakura", cat: "idle", butterflies: true,
    say: "Spring, and neither of us knows anything yet. A butterfly goes on ahead — which one do we follow?",
    choices: [
      { label: "BLUE", to: "there_meadow", pos: "left", style: "blue" },
      { label: "RED", to: "there_stream", pos: "right", style: "red" },
    ],
  },

  /* ---- blue: the high meadow. Everything here is about not knowing:
          two tracks that go nowhere, a shape in the trees that turns out
          to be nothing at all, and weather you cannot see through. Not
          one of them can hurt you. ---- */
  there_meadow: {
    scene: "meadow", cat: "idle",
    say: "The blue one takes the long way up, over the open grass, where you can see the whole valley and be seen from every part of it.",
    choices: [{ label: "KEEP UP", to: "there_wrong", pos: "centre" }],
  },
  there_wrong: {
    scene: "meadow", cat: "idle",
    say: "Twice the track you pick turns out to be a sheep path that stops in the gorse. Twice you walk back to where the butterfly is waiting, which it is, both times, without making anything of it.",
    choices: [{ label: "TRY THE OTHER WAY", to: "there_rustle", pos: "centre" }],
  },
  there_rustle: {
    scene: "forest", cat: "shock", bear: "shadow",
    say: "Something big moves in the trees to the left of the path, and then does not move again.",
    choices: [
      { label: "HOLD VERY STILL", to: "there_nobear", pos: "left" },
      { label: "BACK AWAY SLOWLY", to: "there_nobear", pos: "right" },
    ],
  },
  there_nobear: {
    scene: "forest", cat: "happy",
    say: "A deer. An enormous, appalled deer, gone before you have finished being frightened by it. You both laugh far too loudly for how quiet it was a second ago.",
    choices: [{ label: "ON UP", to: "there_fog", pos: "centre" }],
  },
  there_fog: {
    scene: "meadow", cat: "idle", fog: true,
    say: "Then the cloud comes down on the top of the hill and there is no valley, no gate, no anything past about an arm's length. So you wait. It lifts, the way it always does, and the gate is right there.",
    choices: [{ label: "GO ON", to: "there_join", pos: "centre" }],
  },

  /* ---- red: the stream bank. Same hopefulness, different texture —
          following something instead of searching for it. ---- */
  there_stream: {
    scene: "stream", cat: "idle", fox: true,
    say: "The red one drops to the water instead and goes downstream, and a fox on the far bank works very hard at not having seen you.",
    choices: [{ label: "ALONG THE BANK", to: "there_stones", pos: "centre" }],
  },
  there_stones: {
    scene: "stream", cat: "idle",
    say: "The stream widens where the stones are. Seven of them, and not one is flat.",
    choices: [
      { label: "ONE AT A TIME", to: "there_dry", pos: "left" },
      { label: "ALL IN A RUSH", to: "there_wet", pos: "right" },
    ],
  },
  there_dry: {
    scene: "stream", cat: "happy",
    say: "One at a time, then, testing each stone with a toe before you trust it. You get over with dry feet and slightly less dignity than you started with.",
    choices: [{ label: "DOWNSTREAM", to: "there_current", pos: "centre" }],
  },
  there_wet: {
    scene: "stream", cat: "happy",
    say: "All in a rush, then — and the fourth stone rolls, and you go in to the ankle, and it is so cold that it is funny. You are laughing before you are out of it.",
    choices: [{ label: "DOWNSTREAM", to: "there_current", pos: "centre" }],
  },
  there_current: {
    scene: "stream", cat: "idle",
    say: "After the stones you just follow the current. It knows where it is going and you do not have to, and that turns out to be its own kind of relief.",
    choices: [{ label: "WHERE IT COMES OUT", to: "there_petals", pos: "centre" }],
  },
  there_petals: {
    scene: "sakura", cat: "love",
    say: "It comes out under the blossom, the slow way round, and something lands in your hair and you leave it there.",
    choices: [{ label: "GO ON", to: "there_join", pos: "centre" }],
  },

  there_join: {
    scene: "meadow", cat: "love", callback: true,
    say: "Both ways come out at the same gate at the top of the meadow. However you got here, here is where it was always going to be.",
    choices: [{ label: "OVER THE GATE", to: "dark", pos: "centre" }],
  },

  /* ---------------- RIGHT: the way back ---------------- */
  back_dusk: {
    scene: "lantern", cat: "idle",
    say: "Same valley, a year on. Evening instead of morning, and somebody has been up here already and hung lanterns the whole way. Same place. Completely different light.",
    choices: [{ label: "GO ON", to: "back", pos: "centre" }],
  },
  back: {
    scene: "lantern", cat: "idle", butterflies: true,
    say: "A butterfly is still awake, which they are not supposed to be at this hour. Which one?",
    choices: [
      { label: "BLUE", to: "back_ridge", pos: "left", style: "blue" },
      { label: "RED", to: "back_orchard", pos: "right", style: "red" },
    ],
  },

  /* ---- blue: the ridge. Effortful and steady — the deliberate work of
          staying. The bridge takes one section at a time and says so. ---- */
  back_ridge: {
    scene: "ridge", cat: "idle",
    say: "The blue one goes up. It is colder than either of you dressed for and the whole sky is out, and neither of you suggests turning round.",
    choices: [{ label: "KEEP CLIMBING", to: "back_climb", pos: "centre" }],
  },
  back_climb: {
    scene: "ridge", cat: "happy",
    say: "It is an hour of the same thing: put a foot down, put the other one down, do not think about how much is left. Nobody says much for a long stretch and nothing at all is wrong.",
    choices: [{ label: "OVER THE TOP", to: "back_bridge1", pos: "centre" }],
  },
  back_bridge1: {
    scene: "bridge", cat: "idle", plank: 0,
    say: "Then the rope bridge over the gorge, which holds one person and one plank at a time, and is honest with you about it.",
    choices: [{ label: "FIRST SECTION, SLOWLY", to: "back_bridge2", pos: "centre" }],
  },
  back_bridge2: {
    scene: "bridge", cat: "shock", plank: 1,
    say: "The middle, where the sag is deepest and the whole span moves with you. The trick, it turns out, is to stop trying to hurry.",
    choices: [{ label: "STEADY. KEEP GOING", to: "back_bridge3", pos: "centre" }],
  },
  back_bridge3: {
    scene: "bridge", cat: "happy", plank: 2,
    say: "The last few planks, the far post, solid ground. You wait on the other side while he comes across, and you do not once tell him to hurry up.",
    choices: [{ label: "DOWN THE FAR SIDE", to: "back_join", pos: "centre" }],
  },

  /* ---- red: the orchard at dusk, and the bear.
          The only place in the whole game with anything to get wrong, and
          getting it wrong costs you three trees and nothing else. There is
          no game over here and there is no way to lose the route. ---- */
  back_orchard: {
    scene: "orchard", cat: "idle",
    say: "The red one takes the orchard, where the lanterns hang in the trees and the windfalls have been coming down for a week.",
    choices: [{ label: "DOWN THE ROW", to: "back_bear", pos: "centre" }],
  },
  back_bear: {
    scene: "orchard", cat: "shock", bear: "real",
    say: "There is a bear in the orchard. It is four trees down, working through the windfalls, and it has not looked up yet.",
    choices: [
      { label: "WAIT FOR IT TO MOVE", to: "back_bear_wait", pos: "left" },
      { label: "TAKE THE QUIET ROW", to: "back_bear_quiet", pos: "right" },
      { label: "STRAIGHT PAST IT", to: "back_bear_seen", pos: "centre" },
    ],
  },
  /* The one soft landing in the game. It is a nudge backwards in the same
     scene, with the same furniture and the same buttons — no overlay, no
     restart, and nothing that reads as an ending. */
  back_bear_seen: {
    scene: "orchard", cat: "shock", bear: "real", nudged: true,
    say: "It looks up. That is the whole of it — it looks up, with its mouth full, entirely unbothered by either of you — but you are already walking backwards, and now you are three trees further back than you started.",
    choices: [{ label: "TRY IT AGAIN, QUIETLY", to: "back_bear", pos: "centre" }],
  },
  back_bear_wait: {
    scene: "orchard", cat: "idle",
    say: "So you wait. Ten minutes of standing perfectly still under a lantern with his hand flat between your shoulders, until it finishes the tree it is on and goes off towards the river.",
    choices: [{ label: "ON THROUGH", to: "back_windfall", pos: "centre" }],
  },
  back_bear_quiet: {
    scene: "orchard", cat: "idle",
    say: "You take the far row instead, the one the lanterns do not reach, walking on grass rather than windfalls so that nothing cracks underfoot. It never knows you were there at all.",
    choices: [{ label: "ON THROUGH", to: "back_windfall", pos: "centre" }],
  },
  back_windfall: {
    scene: "orchard", cat: "happy", fox: true,
    say: "At the end of the rows the fox from last spring is asleep in the long grass, very much bigger now, and cannot be made to care about any of it.",
    choices: [{ label: "ON TO THE PATH", to: "back_join", pos: "centre" }],
  },

  back_join: {
    scene: "lantern", cat: "love", callback: true,
    say: "Both ways come back down to the bottom of the path, to the first lantern on it. Whichever way round you went, this is where it comes out.",
    choices: [{ label: "HOME", to: "back_lanterns", pos: "centre" }],
  },

  /* =========================================================
     THE ENDING — LEFT. The way there ends the way it began: outside,
     in the open, with the light going and a letter that arrives from
     nowhere, because that year everything did.
     ========================================================= */
  dark: {
    scene: "sunset", cat: "shock",
    say: "It's getting dark!",
    choices: [{ label: "already?", to: "sunset", pos: "centre" }],
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
    scene: "sunset", cat: "hide", isAsk: true, ask: "there",
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
      { label: QUEST_FINAL.nudgeYes, to: "ask", pos: "left", style: "yes" },
      { label: QUEST_FINAL.nudgeNo, to: "reallysure", pos: "right" },
    ],
  },
  reallysure: {
    scene: "sunset", cat: "cry", bigCat: true,
    say: "…the cat is going to sit here until you change your mind.",
    choices: [
      { label: QUEST_FINAL.nudgeYes, to: "ask", pos: "left", style: "yes" },
      { label: QUEST_FINAL.nudgeNo, to: "reallysure", pos: "right" },
    ],
  },
  yay: {
    scene: "sunset", cat: "love", bigCat: true, hearts: true, isEnd: true, big: true,
    say: "YAYYY, I LOVE YOU!", tally: true,
    choices: [{ label: "close the book 💛", to: "__exit", pos: "left", style: "yes" }],
  },

  /* =========================================================
     THE ENDING — RIGHT. The way back ends indoors, or as near as makes
     no difference: at a door, in the light somebody left on. The letter
     is not a surprise here. It has been in his coat since this morning.
     ========================================================= */
  back_lanterns: {
    scene: "lantern", cat: "idle", lighting: true,
    say: "You walk it in the dark and the lanterns come on as you reach them — one, and then the next, and then the next, the whole way down. Somebody had to come up here and hang every single one of these.",
    choices: [{ label: "KEEP GOING", to: "back_home", pos: "centre" }],
  },
  back_home: {
    scene: "home", cat: "love",
    say: "And then the last one is the light over our own door, which was on before we got here, because one of us always leaves it on for the other.",
    choices: [{ label: "inside?", to: "back_letter", pos: "centre" }],
  },
  back_letter: {
    scene: "home", cat: "idle", envelope: "closed",
    say: "Not yet. He takes an envelope out of his coat. It has been in there the whole walk. It has been in there since this morning.",
    choices: [{ label: "open it", to: "back_closer", pos: "left" }],
  },
  back_closer: {
    scene: "home", cat: "idle", envelope: "open",
    say: "Same paper as last year. Same red seal. Read it here, in the light of the doorway.",
    choices: [{ label: "lean in", to: "back_ask", pos: "left" }],
  },
  back_ask: {
    scene: "home", cat: "hide", isAsk: true, ask: "back",
    say: "",
    choices: [
      { label: "YES!", to: "back_yay", pos: "left", style: "yes" },
      { label: "No…", to: "back_nudge", pos: "right" },
    ],
  },
  back_nudge: {
    scene: "home", cat: "cry", bigCat: true,
    say: QUEST_FINAL.nudge,
    choices: [
      { label: QUEST_FINAL.nudgeYes, to: "back_ask", pos: "left", style: "yes" },
      { label: QUEST_FINAL.nudgeNo, to: "back_reallysure", pos: "right" },
    ],
  },
  back_reallysure: {
    scene: "home", cat: "cry", bigCat: true,
    say: "…the cat is going to sit on this doorstep until you change your mind.",
    choices: [
      { label: QUEST_FINAL.nudgeYes, to: "back_ask", pos: "left", style: "yes" },
      { label: QUEST_FINAL.nudgeNo, to: "back_reallysure", pos: "right" },
    ],
  },
  back_yay: {
    scene: "home", cat: "love", bigCat: true, hearts: true, isEnd: true, big: true,
    say: "YES. Again, and next year, and the year after that.", tally: true,
    choices: [{ label: "close the book 💛", to: "__exit", pos: "left", style: "yes" }],
  },
};

/* =========================================================
   THINGS TO FIND, THINGS REMEMBERED, AND SOUND

   Three additions that give the walk more to do than pick a button:

   1. Small things hidden in some scenes. Tap one and it is yours; the
      ending counts them, so there is a reason to look around and a
      reason to come back and find the ones you missed.
   2. The very first choice - heart or flower - is remembered, and comes
      back later in what the cat says and in what you are carrying at
      the end.
   3. Little sounds on every choice, collect and stumble, sharing the
      audio context the music toggle already owns.
   ========================================================= */

/* ---------- sound ---------- */
/* =========================================================
   SOUND FOR THE TWO STORY GAMES

   One oscillator with a frequency sweep was the whole engine, and four
   voices was the whole vocabulary — so most of what happened in these two
   games happened in silence. This is still synthesis, still no audio file
   in the repo, but a voice can now layer a second oscillator a set number
   of semitones away and a short filtered-noise burst, which is the
   difference between a beep and a footstep or a page turning.
   ========================================================= */
const HV_VOICES = {
  /* the originals, unchanged in character */
  pick:    { type:"square",   f:620,  to:880,  d:0.10, v:0.05 },
  collect: { type:"triangle", f:880,  to:1560, d:0.20, v:0.07, harm:7,  hv:0.03 },
  bad:     { type:"sawtooth", f:220,  to:90,   d:0.28, v:0.05 },
  yay:     { type:"triangle", f:520,  to:1040, d:0.42, v:0.08, harm:12, hv:0.04 },
  spot:    { type:"square",   f:300,  to:620,  d:0.16, v:0.05 },
  shot:    { type:"sawtooth", f:900,  to:260,  d:0.12, v:0.05 },

  /* a footfall: almost no tone, mostly a dry knock */
  step:    { type:"sine",     f:160,  to:110,  d:0.07, v:0.022, noise:0.03, nf:1600, nq:1.1, nd:0.05 },
  /* the key: two bright notes, a fifth apart */
  key:     { type:"triangle", f:784,  to:1175, d:0.34, v:0.06, harm:7,  hv:0.045 },
  /* a phial: glassy, short */
  phial:   { type:"sine",     f:1040, to:1560, d:0.22, v:0.05, harm:12, hv:0.025 },
  /* a locked door: dull, no ring */
  locked:  { type:"sine",     f:150,  to:78,   d:0.22, v:0.06, noise:0.045, nf:420, nq:.7, nd:0.12 },
  /* coming back after losing a life: a low swell */
  respawn: { type:"triangle", f:180,  to:420,  d:0.5,  v:0.05, harm:7,  hv:0.02 },
  /* arriving somewhere new */
  arrive:  { type:"sine",     f:660,  to:990,  d:0.5,  v:0.045, harm:5, hv:0.025 },
  /* a page: no tone at all, just paper */
  page:    { type:"sine",     f:220,  to:180,  d:0.04, v:0.012, noise:0.05, nf:2700, nq:.8, nd:0.16 },
  /* the smallest tick, for a button taking focus */
  hover:   { type:"square",   f:1200, to:1400, d:0.04, v:0.018 },
};

function hvSfx(kind) {
  try {
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    if (audioCtx && audioCtx.state === "closed") audioCtx = null;
    if (!audioCtx) audioCtx = new AC();
    /* not just "suspended" — see wakeAudio; iOS uses "interrupted", and
       the old check let these two games go silent for the whole visit */
    if (audioCtx.state !== "running") {
      if (window.wakeAudio) window.wakeAudio(audioCtx); else audioCtx.resume();
    }
    /* and never schedule into a frozen clock: the notes would all land at
       the same instant, already in the past, and never be heard */
    if (audioCtx.state !== "running") return;

    var c = audioCtx, t = c.currentTime;
    var spec = HV_VOICES[kind] || HV_VOICES.pick;

    var o = c.createOscillator(), g = c.createGain();
    o.type = spec.type;
    o.frequency.setValueAtTime(spec.f, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, spec.to), t + spec.d);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(spec.v, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + spec.d);
    o.connect(g); g.connect(c.destination);
    o.start(t); o.stop(t + spec.d + 0.02);

    /* a second voice a set number of semitones up, for the ones that
       should ring rather than beep */
    if (spec.harm) {
      var r = Math.pow(2, spec.harm / 12);
      var o2 = c.createOscillator(), g2 = c.createGain();
      o2.type = spec.type;
      o2.frequency.setValueAtTime(spec.f * r, t);
      o2.frequency.exponentialRampToValueAtTime(Math.max(20, spec.to * r), t + spec.d);
      g2.gain.setValueAtTime(0.0001, t);
      g2.gain.exponentialRampToValueAtTime(spec.hv || spec.v * 0.5, t + 0.02);
      g2.gain.exponentialRampToValueAtTime(0.0001, t + spec.d);
      o2.connect(g2); g2.connect(c.destination);
      o2.start(t); o2.stop(t + spec.d + 0.02);
    }

    /* and a band-passed noise burst, which is what makes a step sound like
       a foot and a page sound like paper rather than another beep */
    if (spec.noise) {
      var nd = spec.nd || 0.06;
      var len = Math.max(1, Math.floor(c.sampleRate * nd));
      var buf = c.createBuffer(1, len, c.sampleRate);
      var ch = buf.getChannelData(0);
      for (var i = 0; i < len; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / len);
      var src = c.createBufferSource(); src.buffer = buf;
      var bp = c.createBiquadFilter();
      bp.type = "bandpass"; bp.frequency.value = spec.nf || 1800; bp.Q.value = spec.nq || 1;
      var ng = c.createGain(); ng.gain.value = spec.noise;
      src.connect(bp); bp.connect(ng); ng.connect(c.destination);
      src.start(t);
    }
  } catch (e) { /* sound is a bonus, never a blocker */ }
}


/* ---------- the things you can find ---------- */
const HV_TOKENS = {
  shell:   { name: "a striped shell",   icon: "🐚" },
  feather: { name: "a soft feather",    icon: "🪶" },
  acorn:   { name: "a small acorn",     icon: "🌰" },
  ribbon:  { name: "a lost ribbon",     icon: "🎀" },
};
let hvFound = {};
let hvKeepsake = null;      // heart or flower, from the very first choice
let hvBursts = [];          // little sparkle pops when something is collected

function hvDrawToken(kind) {
  const { c, ctx } = spriteCanvas(14, 14);
  if (kind === "shell") {
    blob(ctx, 7, 8, 6, 5, ["#ffe8d0", "#f5c9a8", "#e0a883", "#c08664"]);
    for (var i = 0; i < 5; i++) px(ctx, 3 + i * 2, 5 + (i % 2), 1, 6, "#c08664");
  } else if (kind === "feather") {
    px(ctx, 7, 2, 1, 10, "#c9b48e");
    for (var k = 0; k < 8; k++) {
      var w = 4 - Math.abs(k - 3) * 0.6;
      px(ctx, 7 - w, 3 + k, w, 1, "#f2e6cf");
      px(ctx, 8, 3 + k, w, 1, "#e2d2b4");
    }
  } else if (kind === "acorn") {
    blob(ctx, 7, 9, 4, 4, ["#e0b070", "#c8904e", "#a87238", "#875828"]);
    px(ctx, 3, 3, 8, 4, "#7a5230");
    px(ctx, 6, 1, 2, 3, "#5e3f22");
  } else { /* ribbon */
    px(ctx, 6, 5, 3, 3, "#e0567f");
    blob(ctx, 3, 6, 3.4, 2.6, ["#ffc2d8", "#f7a0bd", "#e0789c", "#c45d80"]);
    blob(ctx, 11, 6, 3.4, 2.6, ["#ffc2d8", "#f7a0bd", "#e0789c", "#c45d80"]);
    px(ctx, 5, 8, 2, 5, "#e0789c"); px(ctx, 8, 8, 2, 5, "#e0789c");
  }
  return c;
}

function hvBurst(x, y, colour) {
  for (var i = 0; i < 12; i++) {
    var a = (i / 12) * Math.PI * 2;
    hvBursts.push({ x: x, y: y, vx: Math.cos(a) * (14 + Math.random() * 16),
      vy: Math.sin(a) * (14 + Math.random() * 16) - 8, life: 0, max: 0.6,
      c: colour || "#ffe9a8" });
  }
}

function hvDrawBursts(ctx, dt) {
  for (var i = hvBursts.length - 1; i >= 0; i--) {
    var b = hvBursts[i];
    b.life += dt;
    if (b.life >= b.max) { hvBursts.splice(i, 1); continue; }
    var t = b.life / b.max;
    var x = b.x + b.vx * b.life;
    var y = b.y + b.vy * b.life + 40 * b.life * b.life;
    if (t < 0.75 || Math.sin(b.life * 40) > 0) px(ctx, x, y, t < 0.5 ? 2 : 1, t < 0.5 ? 2 : 1, b.c);
  }
}

/* Where each findable thing hides, in scene pixels. Deliberately tucked
   against scenery so they take a moment to spot. */
/* Kept clear of the furniture: the top bar, the side buttons around
   38-48% height, and the speech note which covers the bottom band from
   roughly 12% to 76% across. Anything hidden under those can never be
   tapped. */
/* These are keyed by NODE, not by scene, and three of the four used to
   name nodes that had never existed — so only the shell was ever findable.
   One per route now, so each of the four journeys has something of its
   own to spot and none of them can be picked up twice. */
const HV_HIDDEN = {
  there_nobear:    { id: "acorn",   x: 248, y: 112, r: 14 },   // left-blue
  there_current:   { id: "feather", x: 262, y: 128, r: 14 },   // left-red
  back_climb:      { id: "ribbon",  x: 74,  y: 150, r: 14 },   // right-blue
  back_windfall:   { id: "shell",   x: 252, y: 106, r: 14 },   // right-red
};

function hvHiddenHere() {
  var n = HV[hvNode];
  if (!n) return null;
  var spot = HV_HIDDEN[hvNode];
  if (!spot || hvFound[spot.id]) return null;
  return spot;
}

/* canvas taps: collecting, and poking the cat */
function hvCanvasTap(ev) {
  var canvas = document.getElementById("hv-canvas");
  if (!canvas) return;
  var r = canvas.getBoundingClientRect();
  var sx = ((ev.clientX - r.left) / r.width) * PXW;
  var sy = ((ev.clientY - r.top) / r.height) * PXH;

  var spot = hvHiddenHere();
  if (spot && Math.abs(sx - spot.x) < spot.r && Math.abs(sy - spot.y) < spot.r) {
    hvFound[spot.id] = true;
    hvBurst(spot.x, spot.y, "#fff0b0");
    hvSfx("collect");
    hvUpdateFoundStrip();
    return;
  }

  // poking the cat gets a reaction
  var n = HV[hvNode];
  if (n && n.cat && n.cat !== "hide" && !n.bigCat && sx < 90 && sy > PXH - 88) {
    hvPoke = 1.2;
    hvBurst(40, PXH - 60, "#ffb3cd");
    hvSfx("pick");
  }
}
let hvPoke = 0;

function hvUpdateFoundStrip() {
  var strip = document.getElementById("hv-found");
  if (!strip) return;
  var ids = Object.keys(HV_TOKENS).filter(function (k) { return hvFound[k]; });
  strip.innerHTML = ids.map(function (k) {
    return '<span class="hv-token" title="' + HV_TOKENS[k].name + '">' + HV_TOKENS[k].icon + "</span>";
  }).join("");
  strip.classList.toggle("on", ids.length > 0);
}

function hvFoundList() {
  var ids = Object.keys(HV_TOKENS).filter(function (k) { return hvFound[k]; });
  if (!ids.length) return "";
  if (ids.length === 1) return "You found " + HV_TOKENS[ids[0]].name + " along the way.";
  var names = ids.map(function (k) { return HV_TOKENS[k].name; });
  return "You found " + names.slice(0, -1).join(", ") + " and " + names[names.length - 1] + " along the way.";
}

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
  if (scene === "stream") {
    for (var st = 0; st < 20; st++) {
      a.push({ k: "shimmer", x: 40 + rnd() * (PXW - 80), y: 116 + rnd() * 60,
        w: 2 + rnd() * 4, ph: rnd() * 6.28 });
    }
    for (var sp2 = 0; sp2 < 14; sp2++) {
      a.push({ k: "mote", x: rnd() * PXW, y: 40 + rnd() * 80, r: 0.7 + rnd() * 1.3,
        sp: 2 + rnd() * 4, ph: rnd() * 6.28, c: "#fff8d0" });
    }
    a.push({ k: "bird", x: -20, y: 22 + rnd() * 14, sp: 10 + rnd() * 5, ph: rnd() * 6.28 });
  }
  if (scene === "home") {
    for (var hs = 0; hs < 22; hs++) {
      a.push({ k: "star", x: rnd() * PXW * 0.55, y: rnd() * 70, ph: rnd() * 6.28 });
    }
    for (var hf = 0; hf < 12; hf++) {
      a.push({ k: "fly", x: 20 + rnd() * 150, y: 120 + rnd() * 46, r: 5 + rnd() * 10,
        sp: 0.4 + rnd() * 0.7, ph: rnd() * 6.28, c: "#ffdc9a" });
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
  if (!canvas || !n) return;
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
    /* Real flight: a looping figure-of-eight around a home point, wings
       beating fast, and the beat easing off at the top of each rise the
       way a butterfly glides. */
    [["blue", 52, 56, 0], ["red", PXW - 78, 50, 2.1]].forEach(function (b) {
      var ph = t * 1.15 + b[3];
      var fx = b[1] + Math.sin(ph) * 13;
      var fy = b[2] + Math.sin(ph * 2) * 7 + Math.sin(t * 0.7 + b[3]) * 3;
      var glide = Math.max(0, Math.sin(ph * 2 + 1));
      var beat = Math.abs(Math.sin(t * (9 - glide * 4) + b[3]));
      put(drawButterfly(b[0], 0.25 + beat * 0.75), fx, fy, 1.8);
    });
  }

  if (n.fox) put(drawFoxAlive(t), PXW - 122, 112 + Math.sin(t * 0.7) * 1, 1.6);

  /* ---- the bear ----
     It used to be a full-screen jumpscare on its own overlay with a
     Restart button under it. It is a thing standing in the scene now, in
     the same frame as everything else, and there are two of it: a shape
     among the trees on the way there that turns out to be a deer, and a
     real one four trees down the orchard, chewing, which is a problem to
     get round rather than a way to lose. */
  if (n.bear === "shadow") {
    /* Standing in the treeline left of the path, feet on the same ground
       as the trees, with foliage drawn back over its lower half so it is
       partly behind the wood rather than pasted on top of it. */
    var sb = drawBearShadow();
    var swayS = Math.sin(t * 0.5) * 1.2;
    var bw = 52, bh = 45, bx = 104 + swayS, by = 134 - bh;
    ctx.save();
    ctx.globalAlpha = 0.72;
    ctx.drawImage(sb, 0, 0, sb.width, sb.height, bx | 0, by | 0, bw, bh);
    ctx.restore();
    /* leaves back over the top of it and undergrowth across its feet, so
       what she gets is a piece of something big rather than a clean
       cut-out of a bear. She is not supposed to be able to tell. */
    var brnd = hvSeed("rustlefg");
    var lf = ["#8bb057", "#739642", "#5c7c33", "#476226"];
    canopy(ctx, bx + 14, by + 2, 21, lf, brnd, "#cbe89c");
    canopy(ctx, bx + 44, by + 9, 16, lf, brnd, "#cbe89c");
    bush(ctx, bx + 4, 140, 12, ["#5c7c33", "#4b6829", "#3b5220", "#2c3d18"], brnd);
    bush(ctx, bx + 40, 138, 11, ["#5c7c33", "#4b6829", "#3b5220", "#2c3d18"], brnd);
    // and leaves still coming down where it moved
    for (var lv = 0; lv < 12; lv++) {
      var la = t * 1.4 + lv;
      if (Math.sin(la) > 0.1) {
        px(ctx, bx + ((lv * 23) % 58), 84 + ((lv * 19) % 44) + Math.sin(la) * 4, 2, 1, "#5d7a3c");
      }
    }
  } else if (n.bear === "real") {
    var rb = drawBearGrazing();
    /* Four trees down, in the row, working through the windfalls: it
       shoulders forward, dips to the grass, comes up chewing, and never
       once looks over. Sized and placed to sit back in the row rather
       than fill the frame — it is something to get past, not a scare. */
    var dip = Math.max(0, Math.sin(t * 0.5)) * 3;
    var shove = Math.sin(t * 0.28) * 3;
    var bw2 = 64, bh2 = 42, bx2 = 198 + shove, by2 = 96 + dip;
    px(ctx, bx2 + 4, by2 + bh2 - 1, bw2 - 8, 3, "rgba(12,8,18,0.42)");
    ctx.drawImage(rb, 0, 0, rb.width, rb.height, bx2 | 0, by2 | 0, bw2, bh2);
    // the lantern above it just catching its back
    ctx.save();
    ctx.globalAlpha = 0.16;
    blob(ctx, bx2 + 34, by2 + 6, 22, 7, ["#ffd28a"]);
    ctx.restore();
    // windfalls in the grass, some of them already gone
    [[182, 150], [214, 156], [244, 148], [262, 158], [196, 162], [230, 166]].forEach(function (w3) {
      blob(ctx, w3[0], w3[1], 2.6, 2.2, ["#a4553a", "#82412c", "#63301f", "#4a2417"]);
    });
    // long grass in front of its feet, so it is standing in the orchard
    var ornd = hvSeed("orchardfg");
    grassTufts(ctx, PXW, by2 + bh2 + 2, 16, ["#2b3a2c", "#22301f", "#192518"], ornd);
  }

  /* ---- the crossing, one section at a time ----
     The three bridge nodes are the same span from three places on it, so
     the lantern she is carrying moves along it and the planks behind her
     read as walked. Without this the careful-step beat is three
     paragraphs over an identical picture. */
  if (typeof n.plank === "number") {
    var k0 = 0.16 + n.plank * 0.34;
    var bx0 = 54, bw0 = PXW - 112, sag0 = 16, by0 = 106;
    var cxp = bx0 + bw0 * k0;
    var cyp = by0 + Math.sin(k0 * Math.PI) * sag0;
    // the planks already behind her, picked out warm
    for (var pk = 0; pk < 30; pk++) {
      var kk = pk / 29;
      if (kk > k0) break;
      var pxx = bx0 + bw0 * kk;
      px(ctx, pxx - 1, by0 + Math.sin(kk * Math.PI) * sag0 + 1, 4, 2, "#8a6f4e");
    }
    // her lantern, and the small pool it puts on the planks
    blob(ctx, cxp, cyp + 1, 13, 5, ["rgba(255,206,130,0.20)"]);
    blob(ctx, cxp, cyp - 5, 6, 5, ["rgba(255,226,160,0.34)"]);
    lanternAt(ctx, cxp, cyp - 15 + Math.sin(t * 1.6) * 1);
    // the span swinging a little more the further out she is
    var swing = Math.sin(t * 1.1) * Math.sin(k0 * Math.PI) * 1.6;
    px(ctx, cxp - 1, cyp + swing, 3, 2, "#a08256");
  }

  /* ---- the fog on the top of the hill ----
     Three bands at different speeds and different heights. It never
     clears completely while you are standing in it; the scene after this
     one is the same hill without it, which is what "it lifted" means. */
  if (n.fog) {
    for (var fb = 0; fb < 3; fb++) {
      var fy = 74 + fb * 26;
      var fh = 22 + fb * 7;
      var drift = ((t * (5 + fb * 3) + fb * 130) % (PXW + 200)) - 100;
      ctx.save();
      ctx.globalAlpha = 0.3 + fb * 0.13 + 0.04 * Math.sin(t * 0.6 + fb);
      for (var fx2 = 0; fx2 < 5; fx2++) {
        blob(ctx, drift + fx2 * 74, fy + Math.sin(t * 0.4 + fx2 + fb) * 2, 52, fh * 0.5,
          ["#f2f4f6", "#e2e6ea", "#d0d6dc", "#bfc6ce"]);
      }
      ctx.restore();
    }
    ctx.save();
    ctx.globalAlpha = 0.22;
    px(ctx, 0, 60, PXW, PXH - 60, "#e6eaee");
    ctx.restore();
  }

  /* ---- the lanterns coming on, one and then the next ----
     The left path watches a sunset happen to it. This is the same beat
     from the other side of the year: light that arrives because somebody
     put it there, in the order you walk past it. */
  if (n.lighting) {
    for (var Ln = 0; Ln < 5; Ln++) {
      var onAt = 0.5 + Ln * 0.85;
      if (t < onAt) continue;
      var age = Math.min(1, (t - onAt) / 0.5);
      var lx2 = 26 + Ln * 62 + (Ln * 7) % 11;
      var flick = 0.86 + 0.14 * Math.sin(t * 6 + Ln * 2);
      ctx.save();
      ctx.globalAlpha = age * flick;
      blob(ctx, lx2, 80, 15, 12, ["rgba(255,214,140,0.30)"]);
      blob(ctx, lx2, 80, 9, 7, ["rgba(255,232,180,0.42)"]);
      blob(ctx, lx2, 142, 26, 6, ["rgba(255,198,120,0.16)"]);
      ctx.restore();
      if (age < 1) {
        for (var sp3 = 0; sp3 < 6; sp3++) {
          px(ctx, lx2 - 6 + ((sp3 * 5) % 13), 80 - age * 16 - sp3 * 2, 1, 1, "#ffe9a8");
        }
      }
    }
  }

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

  /* something small hidden in the scenery, if this page has one */
  var spot = hvHiddenHere();
  if (spot) {
    var tok = hvDrawToken(spot.id);
    var glint = 0.5 + 0.5 * Math.sin(t * 2.1);
    ctx.drawImage(tok, 0, 0, tok.width, tok.height,
      spot.x - tok.width / 2, spot.y - tok.height / 2 + Math.sin(t * 1.1) * 1,
      tok.width, tok.height);
    if (glint > 0.82) px(ctx, spot.x + 6, spot.y - 6, 1, 1, "#fff6d0");
  }

  if (n.cat && n.cat !== "hide") {
    /* a blink every few seconds, and a slow breath */
    var blink = (t % 4.4) > 4.2;
    var mood = blink && (n.cat === "idle" || n.cat === "happy") ? "happy" : n.cat;
    if (hvPoke > 0) { mood = "love"; hvPoke -= 0.016; }
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
  if (canvas) hvDrawBursts(canvas.getContext("2d"), dt);
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


/* ---------- rendering the DOM layer ---------- */
let hvLastSounded = null;

function hvRender(withTransition) {
  const n = HV[hvNode];
  if (!n) return;

  if (withTransition) { hvStartTransition(); hvSfx("page"); }
  hvPaintBase(n);
  hvStartLoop();
  /* arriving somewhere new deserves a note of its own — until now every
     scene in this game opened in silence */
  if (hvNode !== hvLastSounded) { hvLastSounded = hvNode; setTimeout(function(){ hvSfx("arrive"); }, 140); }

  const note = document.getElementById("hv-note");
  let say = n.isAsk
    ? (n.ask === "back" ? QUEST_FINAL.questionBack : QUEST_FINAL.question)
    : n.say;
  if (n.callback && hvKeepsake) {
    say += hvKeepsake === "flower"
      ? " …you are still carrying that flower, by the way."
      : " …you are still holding that little heart, by the way.";
  }
  if (n.tally) {
    const found = hvFoundList();
    if (found) say += " " + found;
  }
  note.textContent = say;
  note.classList.toggle("hidden", !say);
  note.classList.toggle("hv-note-ask", !!n.isAsk);

  const tag = document.getElementById("hv-tagline");
  tag.textContent = n.tagline || "";
  tag.classList.toggle("hidden", !n.tagline);

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
    /* the smallest tick as a choice comes under the finger */
    b.addEventListener("pointerenter", () => hvSfx("hover"));
    b.addEventListener("focus", () => hvSfx("hover"));
    (ch.pos === "left" ? left : ch.pos === "right" ? right : centre).appendChild(b);
  });

  /* the butterfly page pairs each button with its butterfly, so put the
     buttons where the butterflies actually are */
  document.getElementById("screen-quest").classList.toggle("hv-pair", !!n.butterflies);

  if (n.isEnd) hvCompleted = true;
}

let hvCompleted = false;

function hvChoose(ch) {
  if (ch.keepsake) hvKeepsake = ch.keepsake;      // heart or flower, remembered
  const target = HV[ch.to];
  /* The bear is the one place you can be sent backwards, and it gets the
     low note rather than the bright one. It is still an ordinary move to
     an ordinary scene — there is no fail state left in this game. */
  hvSfx(target && target.nudged ? "bad" : (target && target.isEnd ? "yay" : "pick"));
  if (ch.to === "__exit") {
    hvStopLoop();
    markChapterDone("quest");
    pageTurn("hub", startHub);
    return;
  }
  hvHistory.push(hvNode);
  hvNode = ch.to;
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
  hvBursts = [];
  hvPoke = 0;
  hvUpdateFoundStrip();
  hvRender(false);
}

(function () {
  var c = document.getElementById("hv-canvas");
  if (c) c.addEventListener("click", hvCanvasTap);
})();
document.getElementById("hv-back").addEventListener("click", hvBack);
document.getElementById("hv-quit").addEventListener("click", () => { hvStopLoop(); pageTurn("hub", startHub); });
