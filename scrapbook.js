/* =========================================================================
   SCRAPBOOK.JS — the book of us

   A digital scrapbook: crumpled paper spreads, taped polaroids, sticker
   letters, pressed flowers, a memory map, a voice note and a song. You
   turn the pages; tapping a photo lifts it out with its caption.

   Everything is drawn procedurally — the paper, the tape, the stickers,
   the flowers — so there are no image files to manage. The only things
   that come from outside are your photos, the map, and the song, and
   those are marked as placeholders until you supply them.

   Public API used by script.js:
     Scrapbook.start()   build and show from the beginning
     Scrapbook.stop()    pause its animations
   ========================================================================= */
window.Scrapbook = (function () {
  "use strict";

  var api = {};
  var spreadIndex = 0;
  var built = false;
  var turning = false;

  /* ---------------------------------------------------------------
     PAPER + STICKER TEXTURES
     --------------------------------------------------------------- */
  function tex(w, h, draw) {
    var c = document.createElement("canvas");
    c.width = w; c.height = h;
    var ctx = c.getContext("2d");
    draw(ctx, w, h);
    return c.toDataURL();
  }

  function rnd(seed) {
    var x = Math.sin(seed * 7919 + 4013) * 65536;
    return function () { x = Math.sin(x * 7919 + 4013) * 65536; return x - Math.floor(x); };
  }

  /* Crumpled paper. The first version was far too gentle and read as
     flat card, so the folds are now proper facets: broad triangular
     planes of light and shade, hard crease lines where they meet, and a
     vignette so the sheet has a body. */
  function crumpled(base, hi, lo, seed, w, h) {
    return tex(w || 480, h || 340, function (ctx, W, H) {
      var r = rnd(seed);
      ctx.fillStyle = base; ctx.fillRect(0, 0, W, H);

      /* Facets from a jittered grid, joined only to their neighbours.
         Picking random point pairs from anywhere drew creases clean
         across the sheet, which reads as scratches rather than folds. */
      var COLS = 7, ROWS = 5, grid = [];
      for (var gy = 0; gy <= ROWS; gy++) {
        grid[gy] = [];
        for (var gx = 0; gx <= COLS; gx++) {
          grid[gy][gx] = [
            (gx / COLS) * W + (r() - 0.5) * (W / COLS) * 0.75,
            (gy / ROWS) * H + (r() - 0.5) * (H / ROWS) * 0.75,
          ];
        }
      }
      for (var cy = 0; cy < ROWS; cy++) {
        for (var cx = 0; cx < COLS; cx++) {
          var p00 = grid[cy][cx], p10 = grid[cy][cx + 1];
          var p01 = grid[cy + 1][cx], p11 = grid[cy + 1][cx + 1];
          /* each cell splits into two facets, each its own shade */
          [[p00, p10, p11], [p00, p11, p01]].forEach(function (tri) {
            ctx.fillStyle = r() > 0.5 ? hi : lo;
            ctx.globalAlpha = 0.18 + r() * 0.42;
            ctx.beginPath();
            ctx.moveTo(tri[0][0], tri[0][1]);
            ctx.lineTo(tri[1][0], tri[1][1]);
            ctx.lineTo(tri[2][0], tri[2][1]);
            ctx.closePath(); ctx.fill();
          });
          /* the crease where the two facets meet, lit on one side */
          ctx.globalAlpha = 0.5; ctx.lineWidth = 1.1;
          ctx.strokeStyle = hi;
          ctx.beginPath(); ctx.moveTo(p00[0], p00[1]); ctx.lineTo(p11[0], p11[1]); ctx.stroke();
          ctx.globalAlpha = 0.4;
          ctx.strokeStyle = lo;
          ctx.beginPath(); ctx.moveTo(p00[0] + 1.2, p00[1] + 1.2); ctx.lineTo(p11[0] + 1.2, p11[1] + 1.2); ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;

      /* fibre grain */
      for (var g = 0; g < W * 3; g++) {
        ctx.fillStyle = r() > 0.5 ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)";
        ctx.fillRect(r() * W, r() * H, 1 + r() * 2, 1);
      }

      /* a soft vignette so the sheet has weight */
      var v = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.2, W / 2, H / 2, Math.max(W, H) * 0.72);
      v.addColorStop(0, "rgba(0,0,0,0)");
      v.addColorStop(1, "rgba(0,0,0,0.22)");
      ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
    });
  }

  var PAPER = {};
  function buildPapers() {
    if (PAPER.teal) return;
    PAPER.teal  = crumpled("#2f6b76", "rgba(190,235,240,0.30)", "rgba(0,26,34,0.34)", 3);
    PAPER.denim = crumpled("#40607c", "rgba(198,224,244,0.28)", "rgba(0,16,34,0.36)", 11);
    PAPER.cream = crumpled("#efe1c6", "rgba(255,252,242,0.62)", "rgba(150,118,74,0.24)", 7);
    PAPER.blush = crumpled("#eed3cc", "rgba(255,250,246,0.55)", "rgba(150,96,88,0.26)", 19);
    PAPER.note  = crumpled("#fbf3e0", "rgba(255,255,255,0.7)", "rgba(150,125,85,0.18)", 23, 320, 220);
  }

  /* ---------- stickers, drawn once and reused ---------- */
  var STICK = {};

  function discoBall(size) {
    return tex(size, size, function (ctx, W) {
      var r = W / 2, cx = r, cy = r;
      for (var y = -r; y < r; y += W / 14) {
        for (var x = -r; x < r; x += W / 14) {
          if (x * x + y * y > r * r) continue;
          var lit = (-x * 0.5 - y * 0.6) / r;
          var v = 120 + lit * 120 + Math.random() * 40;
          ctx.fillStyle = "rgb(" + (v | 0) + "," + ((v + 8) | 0) + "," + ((v + 20) | 0) + ")";
          ctx.fillRect(cx + x, cy + y, W / 14 - 1, W / 14 - 1);
        }
      }
      var g = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.35, 0, cx, cy, r);
      g.addColorStop(0, "rgba(255,255,255,0.55)");
      g.addColorStop(0.5, "rgba(255,255,255,0)");
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, 6.29); ctx.fill();
    });
  }

  function vinyl(size) {
    return tex(size, size, function (ctx, W) {
      var r = W / 2;
      ctx.fillStyle = "#141414";
      ctx.beginPath(); ctx.arc(r, r, r, 0, 6.29); ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.06)";
      for (var i = r * 0.34; i < r; i += 2.5) {
        ctx.beginPath(); ctx.arc(r, r, i, 0, 6.29); ctx.stroke();
      }
      var g = ctx.createLinearGradient(0, 0, W, W);
      g.addColorStop(0, "rgba(255,255,255,0.16)");
      g.addColorStop(0.45, "rgba(255,255,255,0)");
      g.addColorStop(0.75, "rgba(255,255,255,0.10)");
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(r, r, r, 0, 6.29); ctx.fill();
      ctx.fillStyle = "#f2f2f2";
      ctx.beginPath(); ctx.arc(r, r, r * 0.32, 0, 6.29); ctx.fill();
      ctx.fillStyle = "#111";
      ctx.font = "bold " + (r * 0.42) + "px Georgia, serif";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText("8", r, r + 1);
      ctx.fillStyle = "#2a2a2a";
      ctx.beginPath(); ctx.arc(r, r, r * 0.05, 0, 6.29); ctx.fill();
    });
  }

  function chromeLips(w) {
    return tex(w, w * 0.62, function (ctx, W, H) {
      var g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, "#e8eef4"); g.addColorStop(0.42, "#8fa2b4");
      g.addColorStop(0.55, "#54677a"); g.addColorStop(1, "#c3d2de");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(W * 0.5, H * 0.34);
      ctx.bezierCurveTo(W * 0.36, H * 0.02, W * 0.02, H * 0.22, W * 0.06, H * 0.42);
      ctx.bezierCurveTo(W * 0.16, H * 0.9, W * 0.42, H * 1.0, W * 0.5, H * 0.98);
      ctx.bezierCurveTo(W * 0.58, H * 1.0, W * 0.84, H * 0.9, W * 0.94, H * 0.42);
      ctx.bezierCurveTo(W * 0.98, H * 0.22, W * 0.64, H * 0.02, W * 0.5, H * 0.34);
      ctx.fill();
      ctx.strokeStyle = "rgba(20,30,40,0.5)"; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(W * 0.08, H * 0.44);
      ctx.bezierCurveTo(W * 0.3, H * 0.56, W * 0.7, H * 0.56, W * 0.92, H * 0.44);
      ctx.stroke();
    });
  }

  function pressedFlowers(w) {
    return tex(w, w, function (ctx, W) {
      var r = rnd(5);
      // stems
      ctx.strokeStyle = "#6f8f4a"; ctx.lineWidth = 2;
      for (var s = 0; s < 5; s++) {
        ctx.beginPath();
        ctx.moveTo(W * 0.5, W * 0.95);
        ctx.quadraticCurveTo(W * (0.3 + r() * 0.4), W * 0.6, W * (0.15 + r() * 0.7), W * (0.2 + r() * 0.3));
        ctx.stroke();
      }
      // leaves
      for (var l = 0; l < 5; l++) {
        ctx.fillStyle = r() > 0.5 ? "#7fa04a" : "#5d7a35";
        ctx.save();
        ctx.translate(W * (0.2 + r() * 0.6), W * (0.45 + r() * 0.4));
        ctx.rotate(r() * 6.28);
        ctx.beginPath(); ctx.ellipse(0, 0, W * 0.09, W * 0.035, 0, 0, 6.29); ctx.fill();
        ctx.restore();
      }
      // blooms
      var pal = [["#f7a8c4", "#e07a9e"], ["#c9a0e8", "#a878c8"], ["#fff0f4", "#e8ccd6"], ["#ffd166", "#e0a92f"]];
      for (var b = 0; b < 7; b++) {
        var cx = W * (0.16 + r() * 0.68), cy = W * (0.16 + r() * 0.42);
        var p = pal[(r() * pal.length) | 0], rr = W * (0.05 + r() * 0.05);
        for (var k = 0; k < 6; k++) {
          var a = (k / 6) * 6.28;
          ctx.fillStyle = p[0];
          ctx.beginPath();
          ctx.ellipse(cx + Math.cos(a) * rr * 0.75, cy + Math.sin(a) * rr * 0.75, rr * 0.62, rr * 0.48, a, 0, 6.29);
          ctx.fill();
        }
        ctx.fillStyle = p[1];
        ctx.beginPath(); ctx.arc(cx, cy, rr * 0.42, 0, 6.29); ctx.fill();
      }
    });
  }

  function buildStickers() {
    if (STICK.disco) return;
    STICK.disco = discoBall(120);
    STICK.vinyl = vinyl(150);
    STICK.lips = chromeLips(90);
    STICK.flowers = pressedFlowers(180);
  }

  /* ---------------------------------------------------------------
     THE SPREADS
     Each is a list of pieces placed in percentages of the page, so the
     collage holds together at any size.
     --------------------------------------------------------------- */
  function photoAt(i) {
    var m = (typeof MEMORIES !== "undefined" && MEMORIES[i]) ? MEMORIES[i] : null;
    return {
      src: m && m.photo ? m.photo : null,
      title: m && m.title ? m.title : "",
      date: m && m.date ? m.date : "",
      text: m && m.text ? m.text : "",
      idx: i,
    };
  }

  var SPREADS = [
    {
      paper: "teal",
      big: { text: "love you", left: 30, top: 12, size: 46, rot: 90, colour: "rgba(255,255,255,.20)" },
      letters: { text: "MEMORIES", left: 63, top: 4 },
      pieces: [
        { k: "photo", n: 0, left: 6,  top: 10, w: 30, rot: -6, tape: "top" },
        { k: "photo", n: 1, left: 4,  top: 40, w: 32, rot: 4,  tape: "corner" },
        { k: "photo", n: 2, left: 12, top: 68, w: 28, rot: -3, tape: "top" },
        { k: "note",  left: 52, top: 8, w: 40, rot: -2,
          text: "From now on, let's feel light for the rest of the summer" },
        { k: "photo", n: 3, left: 74, top: 30, w: 24, rot: 3,  tape: "corner" },
        { k: "photo", n: 4, left: 50, top: 44, w: 22, rot: -2, tape: "none" },
        { k: "photo", n: 5, left: 74, top: 56, w: 22, rot: 2,  tape: "none" },
        { k: "sticker", art: "disco", left: 0,  top: 2,  w: 15, rot: 0 },
        { k: "sticker", art: "disco", left: 18, top: 76, w: 12, rot: 0 },
        { k: "sticker", art: "vinyl", left: 44, top: 62, w: 17, rot: 12 },
        { k: "sticker", art: "lips",  left: 2,  top: 30, w: 11, rot: -14 },
        { k: "sticker", art: "flowers", left: 0, top: 44, w: 20, rot: -6 },
        { k: "star", left: 42, top: 34, w: 7 },
        { k: "star", left: 66, top: 76, w: 5 },
      ],
    },
    {
      paper: "denim",
      big: { text: "us", left: 6, top: 60, size: 58, rot: 0, colour: "rgba(255,255,255,.16)" },
      letters: { text: "ALWAYS", left: 58, top: 3 },
      pieces: [
        { k: "note", left: 4, top: 6, w: 42, rot: 1,
          text: "To You, My Love — I hope this little world of yours makes you smile, today and every day." },
        { k: "photo", n: 6, left: 52, top: 8,  w: 40, rot: -4, tape: "top" },
        { k: "photo", n: 7, left: 8,  top: 42, w: 30, rot: 3,  tape: "corner" },
        { k: "photo", n: 8, left: 44, top: 50, w: 26, rot: -2, tape: "none" },
        { k: "photo", n: 9, left: 72, top: 56, w: 24, rot: 5,  tape: "corner" },
        { k: "sticker", art: "vinyl", left: 74, top: 22, w: 20, rot: -8 },
        { k: "sticker", art: "flowers", left: 0, top: 62, w: 22, rot: 8 },
        { k: "sticker", art: "lips", left: 40, top: 34, w: 10, rot: 10 },
        { k: "star", left: 30, top: 30, w: 6 },
        { k: "star", left: 88, top: 44, w: 5 },
      ],
    },
    {
      paper: "blush",
      big: { text: "always", left: 52, top: 74, size: 40, rot: 0, colour: "rgba(180,110,120,.20)" },
      letters: { text: "OURS", left: 6, top: 4 },
      pieces: [
        { k: "photo", n: 10, left: 6,  top: 16, w: 34, rot: -5, tape: "top" },
        { k: "photo", n: 11, left: 44, top: 8,  w: 26, rot: 4,  tape: "corner" },
        { k: "photo", n: 12, left: 72, top: 14, w: 24, rot: -3, tape: "none" },
        { k: "photo", n: 13, left: 10, top: 56, w: 28, rot: 2,  tape: "corner" },
        { k: "note", left: 44, top: 40, w: 38, rot: -1,
          text: "…and I still can't stop remembering." },
        { k: "film", left: 42, top: 62, w: 52, rot: 2 },
        { k: "sticker", art: "flowers", left: 0, top: 66, w: 20, rot: -10 },
        { k: "star", left: 38, top: 34, w: 6 },
      ],
    },
    {
      paper: "teal",
      kind: "map",
      letters: { text: "WHERE", left: 60, top: 3 },
      pieces: [
        { k: "map", left: 4, top: 10, w: 44 },
        { k: "voice", left: 4, top: 62, w: 44 },
        { k: "song", left: 54, top: 20, w: 42 },
        { k: "photo", n: 14, left: 56, top: 56, w: 24, rot: -4, tape: "corner" },
        { k: "photo", n: 15, left: 78, top: 58, w: 20, rot: 3, tape: "none" },
        { k: "sticker", art: "flowers", left: 52, top: 74, w: 18, rot: 6 },
        { k: "star", left: 90, top: 12, w: 6 },
      ],
    },
  ];

  /* ---------------------------------------------------------------
     BUILDING THE DOM
     --------------------------------------------------------------- */
  function el(cls, tag) {
    var e = document.createElement(tag || "div");
    if (cls) e.className = cls;
    return e;
  }

  function makeTape(kind) {
    var t = el("sb-tape sb-tape-" + kind);
    return t;
  }

  function makePhoto(p, spreadEl) {
    var wrap = el("sb-photo");
    wrap.style.left = p.left + "%";
    wrap.style.top = p.top + "%";
    wrap.style.width = p.w + "%";
    wrap.style.setProperty("--rot", p.rot + "deg");

    var inner = el("sb-photo-inner");
    var mem = photoAt(p.n);
    if (mem.src) {
      var img = el("", "img");
      img.src = mem.src; img.alt = mem.title || "a memory";
      inner.appendChild(img);
    } else {
      var ph = el("sb-photo-empty");
      ph.innerHTML = '<span>photo</span>';
      inner.appendChild(ph);
    }
    wrap.appendChild(inner);
    if (mem.title) {
      var cap = el("sb-photo-cap");
      cap.textContent = mem.title;
      wrap.appendChild(cap);
    }
    if (p.tape && p.tape !== "none") wrap.appendChild(makeTape(p.tape));

    wrap.addEventListener("click", function (e) {
      e.stopPropagation();
      openLightbox(mem);
    });
    return wrap;
  }

  function makeNote(p) {
    var n = el("sb-note");
    n.style.left = p.left + "%"; n.style.top = p.top + "%";
    n.style.width = p.w + "%";
    n.style.setProperty("--rot", p.rot + "deg");
    n.style.backgroundImage = "url(" + PAPER.note + ")";
    var t = el("sb-note-text");
    t.textContent = p.text;
    n.appendChild(t);
    n.appendChild(makeTape("top"));
    return n;
  }

  function makeSticker(p) {
    var s = el("sb-sticker");
    s.style.left = p.left + "%"; s.style.top = p.top + "%";
    s.style.width = p.w + "%";
    s.style.setProperty("--rot", p.rot + "deg");
    var img = el("", "img");
    img.src = STICK[p.art];
    img.alt = "";
    s.appendChild(img);
    return s;
  }

  function makeStar(p) {
    var s = el("sb-star");
    s.style.left = p.left + "%"; s.style.top = p.top + "%";
    s.style.width = p.w + "%";
    s.innerHTML = '<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M20 0 C22 14 26 18 40 20 C26 22 22 26 20 40 C18 26 14 22 0 20 C14 18 18 14 20 0 Z" fill="#141414"/></svg>';
    return s;
  }

  function makeFilm(p) {
    var f = el("sb-film");
    f.style.left = p.left + "%"; f.style.top = p.top + "%";
    f.style.width = p.w + "%";
    f.style.setProperty("--rot", p.rot + "deg");
    var strip = el("sb-film-strip");
    for (var i = 0; i < 4; i++) {
      var cell = el("sb-film-cell");
      cell.innerHTML = "<span>photo</span>";
      strip.appendChild(cell);
    }
    f.appendChild(strip);
    return f;
  }

  /* the three placeholder cards: map, voice note, song */
  function makeMap(p) {
    var m = el("sb-card sb-map");
    m.style.left = p.left + "%"; m.style.top = p.top + "%"; m.style.width = p.w + "%";
    m.innerHTML =
      '<div class="sb-card-head"><span class="sb-dot"></span><span>our memory map</span></div>' +
      '<div class="sb-map-body">' +
        '<div class="sb-map-grid"></div>' +
        '<div class="sb-map-pin" style="left:28%;top:36%"></div>' +
        '<div class="sb-map-pin" style="left:58%;top:56%"></div>' +
        '<div class="sb-map-pin" style="left:72%;top:26%"></div>' +
        '<p class="sb-placeholder">[ your map goes here ]</p>' +
      "</div>";
    return m;
  }

  function makeVoice(p) {
    var v = el("sb-card sb-voice");
    v.style.left = p.left + "%"; v.style.top = p.top + "%"; v.style.width = p.w + "%";
    var bars = "";
    for (var i = 0; i < 34; i++) {
      bars += '<span style="height:' + (18 + Math.round(Math.abs(Math.sin(i * 1.7)) * 62)) + '%"></span>';
    }
    v.innerHTML =
      '<button class="sb-play" aria-label="Play the voice note">▶</button>' +
      '<div class="sb-wave">' + bars + "</div>" +
      '<span class="sb-time">0:00</span>' +
      '<p class="sb-placeholder sb-placeholder-sm">[ your voice note goes here ]</p>';
    return v;
  }

  function makeSong(p) {
    var s = el("sb-card sb-song");
    s.style.left = p.left + "%"; s.style.top = p.top + "%"; s.style.width = p.w + "%";
    s.innerHTML =
      '<div class="sb-song-art"><span>♪</span></div>' +
      '<div class="sb-song-meta">' +
        '<strong>[ our song ]</strong>' +
        '<span>[ artist ]</span>' +
        '<div class="sb-song-bar"><i></i></div>' +
      "</div>" +
      '<button class="sb-play sb-play-sm" aria-label="Play the song">▶</button>';
    return s;
  }

  function buildSpread(def, i) {
    var page = el("sb-page");
    page.dataset.index = i;
    page.style.backgroundImage = "url(" + PAPER[def.paper] + ")";

    if (def.big) {
      var b = el("sb-big");
      b.textContent = def.big.text;
      b.style.left = def.big.left + "%"; b.style.top = def.big.top + "%";
      b.style.fontSize = def.big.size / 10 + "em";
      b.style.color = def.big.colour;
      b.style.setProperty("--rot", def.big.rot + "deg");
      page.appendChild(b);
    }
    if (def.letters) {
      var L = el("sb-letters");
      L.style.left = def.letters.left + "%"; L.style.top = def.letters.top + "%";
      def.letters.text.split("").forEach(function (ch, k) {
        var s = el("sb-letter");
        s.textContent = ch;
        s.style.setProperty("--r", ((k % 3) - 1) * 7 + "deg");
        s.classList.add("sb-letter-" + (k % 4));
        L.appendChild(s);
      });
      page.appendChild(L);
    }

    def.pieces.forEach(function (p) {
      var node = null;
      if (p.k === "photo") node = makePhoto(p, page);
      else if (p.k === "note") node = makeNote(p);
      else if (p.k === "sticker") node = makeSticker(p);
      else if (p.k === "star") node = makeStar(p);
      else if (p.k === "film") node = makeFilm(p);
      else if (p.k === "map") node = makeMap(p);
      else if (p.k === "voice") node = makeVoice(p);
      else if (p.k === "song") node = makeSong(p);
      if (node) page.appendChild(node);
    });
    return page;
  }

  /* ---------------------------------------------------------------
     LIGHTBOX — lifting a photo out of the page
     --------------------------------------------------------------- */
  function openLightbox(mem) {
    var lb = document.getElementById("sb-lightbox");
    if (!lb) return;
    var frame = lb.querySelector(".sb-lb-frame");
    frame.innerHTML = "";
    if (mem.src) {
      var img = document.createElement("img");
      img.src = mem.src; img.alt = mem.title || "";
      frame.appendChild(img);
    } else {
      var ph = el("sb-photo-empty");
      ph.innerHTML = "<span>photo</span>";
      frame.appendChild(ph);
    }
    lb.querySelector(".sb-lb-title").textContent = mem.title || "";
    lb.querySelector(".sb-lb-date").textContent = mem.date || "";
    lb.querySelector(".sb-lb-text").textContent = mem.text || "";
    lb.classList.add("on");
  }
  function closeLightbox() {
    var lb = document.getElementById("sb-lightbox");
    if (lb) lb.classList.remove("on");
  }

  /* ---------------------------------------------------------------
     PAGE TURNS
     --------------------------------------------------------------- */
  function showSpread(i, dir) {
    var stack = document.getElementById("sb-stack");
    if (!stack || turning) return;
    i = Math.max(0, Math.min(SPREADS.length - 1, i));
    if (i === spreadIndex && stack.childElementCount) return;

    var pages = stack.querySelectorAll(".sb-page");
    var outgoing = pages[spreadIndex];
    spreadIndex = i;

    turning = true;
    pages.forEach(function (p, k) {
      p.classList.toggle("current", k === i);
      p.classList.remove("turn-out-l", "turn-out-r", "turn-in-l", "turn-in-r");
    });
    if (outgoing && outgoing !== pages[i]) {
      outgoing.classList.add(dir === "back" ? "turn-out-r" : "turn-out-l");
    }
    pages[i].classList.add(dir === "back" ? "turn-in-l" : "turn-in-r");
    setTimeout(function () { turning = false; }, 620);

    var dots = document.getElementById("sb-dots");
    if (dots) {
      Array.prototype.forEach.call(dots.children, function (d, k) {
        d.classList.toggle("on", k === i);
      });
    }
    document.getElementById("sb-prev").disabled = i === 0;
    document.getElementById("sb-next").disabled = i >= SPREADS.length - 1;
  }

  /* ---------------------------------------------------------------
     COVER + BUILD
     --------------------------------------------------------------- */
  function build() {
    if (built) return;
    buildPapers(); buildStickers();

    var stack = document.getElementById("sb-stack");
    stack.innerHTML = "";
    SPREADS.forEach(function (def, i) {
      var page = buildSpread(def, i);
      if (i === 0) page.classList.add("current");
      stack.appendChild(page);
    });

    var dots = document.getElementById("sb-dots");
    dots.innerHTML = "";
    SPREADS.forEach(function (_, i) {
      var d = el("sb-dot-btn" + (i === 0 ? " on" : ""), "button");
      d.setAttribute("aria-label", "Page " + (i + 1));
      d.addEventListener("click", function () { showSpread(i, i > spreadIndex ? "fwd" : "back"); });
      dots.appendChild(d);
    });

    document.getElementById("sb-cover-paper").style.backgroundImage = "url(" + PAPER.cream + ")";
    document.getElementById("sb-cover-card").style.backgroundImage = "url(" + PAPER.note + ")";

    built = true;
  }

  function start() {
    build();
    spreadIndex = 0;
    var screen = document.getElementById("screen-scrapbook");
    screen.classList.remove("sb-open");
    var pages = document.querySelectorAll("#sb-stack .sb-page");
    pages.forEach(function (p, k) {
      p.classList.toggle("current", k === 0);
      p.classList.remove("turn-out-l", "turn-out-r", "turn-in-l", "turn-in-r");
    });
    showSpread(0, "fwd");
    startButterflies();
  }

  function openBook() {
    document.getElementById("screen-scrapbook").classList.add("sb-open");
  }

  /* ---------------------------------------------------------------
     BUTTERFLIES over the cover — the opening of the reference
     --------------------------------------------------------------- */
  var flyRaf = null, flies = [], flyCanvas = null, flyCtx = null, flyT0 = 0;

  function startButterflies() {
    flyCanvas = document.getElementById("sb-flies");
    if (!flyCanvas) return;
    flyCtx = flyCanvas.getContext("2d");
    if (!flies.length) {
      for (var i = 0; i < 7; i++) {
        flies.push({
          x: Math.random(), y: 0.2 + Math.random() * 0.6,
          sp: 0.02 + Math.random() * 0.05, ph: Math.random() * 6.28,
          amp: 0.05 + Math.random() * 0.12, size: 10 + Math.random() * 9,
          flap: 6 + Math.random() * 5,
        });
      }
    }
    if (!flyRaf) { flyT0 = 0; flyRaf = requestAnimationFrame(flyFrame); }
  }

  function flyFrame(now) {
    flyRaf = requestAnimationFrame(flyFrame);
    var screen = document.getElementById("screen-scrapbook");
    if (!screen || !screen.classList.contains("active") || screen.classList.contains("sb-open")) return;
    if (!flyT0) flyT0 = now;
    var t = (now - flyT0) / 1000;

    var W = flyCanvas.width = flyCanvas.clientWidth;
    var H = flyCanvas.height = flyCanvas.clientHeight;
    flyCtx.clearRect(0, 0, W, H);

    flies.forEach(function (f) {
      var x = ((f.x + t * f.sp) % 1.2 - 0.1) * W;
      var y = (f.y + Math.sin(t * 0.8 + f.ph) * f.amp) * H;
      /* wings open and close, and the body tilts into the turn — a
         butterfly that only slides sideways reads as a sticker */
      var flap = Math.abs(Math.sin(t * f.flap + f.ph));
      var tilt = Math.cos(t * 0.8 + f.ph) * 0.35;
      drawFly(flyCtx, x, y, f.size, flap, tilt);
    });
  }

  function drawFly(ctx, x, y, s, flap, tilt) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(tilt);
    var w = s * (0.35 + flap * 0.65);
    var g = ctx.createLinearGradient(-w, -s * 0.6, w, s * 0.6);
    g.addColorStop(0, "#f7a8c4"); g.addColorStop(0.5, "#ef7fae"); g.addColorStop(1, "#d95f95");
    ctx.fillStyle = g;
    // upper wings
    ctx.beginPath(); ctx.ellipse(-w * 0.6, -s * 0.18, w * 0.62, s * 0.44, -0.4, 0, 6.29); ctx.fill();
    ctx.beginPath(); ctx.ellipse(w * 0.6, -s * 0.18, w * 0.62, s * 0.44, 0.4, 0, 6.29); ctx.fill();
    // lower wings
    ctx.globalAlpha = 0.9;
    ctx.beginPath(); ctx.ellipse(-w * 0.45, s * 0.3, w * 0.44, s * 0.3, 0.3, 0, 6.29); ctx.fill();
    ctx.beginPath(); ctx.ellipse(w * 0.45, s * 0.3, w * 0.44, s * 0.3, -0.3, 0, 6.29); ctx.fill();
    ctx.globalAlpha = 1;
    // body
    ctx.fillStyle = "#5c3a4a";
    ctx.beginPath(); ctx.ellipse(0, s * 0.06, s * 0.07, s * 0.42, 0, 0, 6.29); ctx.fill();
    ctx.restore();
  }

  function stop() {
    if (flyRaf) cancelAnimationFrame(flyRaf);
    flyRaf = null;
  }

  /* ---------------------------------------------------------------
     WIRING
     --------------------------------------------------------------- */
  api.start = start;
  api.stop = stop;
  api.openBook = openBook;
  api.next = function () { showSpread(spreadIndex + 1, "fwd"); };
  api.prev = function () { showSpread(spreadIndex - 1, "back"); };
  api.closeLightbox = closeLightbox;
  api.spreadCount = function () { return SPREADS.length; };
  api.currentSpread = function () { return spreadIndex; };
  return api;
})();
