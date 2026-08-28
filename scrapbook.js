/* =========================================================================
   SCRAPBOOK.JS — the memory book

   A real book you open and turn through: a painted candle opening, a
   crumpled teal cover, then spreads of collaged paper — polaroids,
   disco balls, vinyl, film strips, pressed flowers, an instant camera,
   a lovers-club card, a letter under a paperclip — and a back cover.

   A round button sits bottom-right. It opens a drawer down the left with
   the bouquet, the song, the memory map of Marrakech, the voice note,
   and the music video.

   Every texture here is drawn procedurally onto a canvas at runtime, so
   the book carries no image files of its own. The only things that come
   from outside are her photos, the song, and the voice note — all of
   them optional, all of them marked below.

   Public API used by script.js:
     Scrapbook.start()   build and show from the beginning
     Scrapbook.stop()    pause its animations
   ========================================================================= */
window.Scrapbook = (function () {
  "use strict";

  /* =======================================================================
     ✏️  CUSTOMISE ME — everything you are likely to want to change
     ======================================================================= */
  var SB = {

    /* ---- the song that plays from the drawer -------------------------
       Drop the file in as assets/song.mp3. `startAt` is where playback
       begins, in seconds — set it to the moment of the line you want it
       to open on, and nudge it by a second or two until it lands. ---- */
    song: {
      title:  "Mirage",
      artist: "Bouss",
      src:    "assets/song.mp3",
      startAt: 74,          // ← seconds. adjust until it starts on your line
    },

    /* ---- the music video in the drawer, and on the last right page ---- */
    video: {
      title:     "Printemps",
      artist:    "Bouss",
      youtubeId: "hnd84Ru1dgA",
    },

    /* ---- the voice note. Record it, save it as assets/voice.m4a ---- */
    voice: {
      src:   "assets/voice.m4a",
      label: "A note just for you",
      hint:  "tap to listen",
    },

    /* ---- the map. Pins are placed in % of the map card ---- */
    map: {
      city: "Marrakech",
      pins: [
        { x: 50, y: 50, date: "the first evening",  title: "Jemaa el-Fna",     place: "the big square, at dusk" },
        { x: 30, y: 66, date: "the blue morning",   title: "Jardin Majorelle", place: "Marrakech" },
        { x: 70, y: 40, date: "the long afternoon", title: "The souks",        place: "the old medina" },
        { x: 58, y: 78, date: "the quiet one",      title: "Menara gardens",   place: "under the olive trees" },
      ],
    },

    /* ---- the note behind "tap here to view more" ---- */
    letter: {
      from: "You",
      to:   "My Love",
      lead: "My love,",
      body: "I built this little world for you — photos of us, a song, a voice, and flowers. Open every piece slowly. I am in the intro, in the pages, in the music.",
      signOff: "Always,",
      signature: "Anwar",
    },

    /* ---- small bits of handwriting scattered through the book ---- */
    hand: {
      s1note:  "From now on, let's feel light for the rest of the summer",
      s1small: "can't stop remembering…",
      s3note:  "I still have a lot of time to make you exactly what you want.",
      vinyl:   "i am a lucky girl",
    },
  };

  var api = {};
  var pageIndex = 0;        // index into PAGES
  var built = false;
  var turning = false;
  var perView = 2;          // 2 pages on a wide screen, 1 on a phone

  /* =======================================================================
     TEXTURE HELPERS
     ======================================================================= */
  function tex(w, h, draw) {
    var c = document.createElement("canvas");
    c.width = w; c.height = h;
    draw(c.getContext("2d"), w, h);
    return c.toDataURL();
  }

  function rnd(seed) {
    var x = Math.sin(seed * 7919 + 4013) * 65536;
    return function () { x = Math.sin(x * 7919 + 4013) * 65536; return x - Math.floor(x); };
  }

  /* Crumpled paper: broad triangular facets of light and shade, hard
     crease lines where they meet, and a vignette so the sheet has body. */
  function crumpled(base, hi, lo, seed, w, h) {
    return tex(w || 480, h || 340, function (ctx, W, H) {
      var r = rnd(seed);
      ctx.fillStyle = base; ctx.fillRect(0, 0, W, H);

      var COLS = 11, ROWS = 8, grid = [];
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
          [[p00, p10, p11], [p00, p11, p01]].forEach(function (tri) {
            ctx.fillStyle = r() > 0.5 ? hi : lo;
            ctx.globalAlpha = 0.07 + r() * 0.13;
            ctx.beginPath();
            ctx.moveTo(tri[0][0], tri[0][1]);
            ctx.lineTo(tri[1][0], tri[1][1]);
            ctx.lineTo(tri[2][0], tri[2][1]);
            ctx.closePath(); ctx.fill();
          });
          ctx.globalAlpha = 0.22; ctx.lineWidth = 0.9;
          ctx.strokeStyle = hi;
          ctx.beginPath(); ctx.moveTo(p00[0], p00[1]); ctx.lineTo(p11[0], p11[1]); ctx.stroke();
          ctx.globalAlpha = 0.16;
          ctx.strokeStyle = lo;
          ctx.beginPath(); ctx.moveTo(p00[0] + 1, p00[1] + 1); ctx.lineTo(p11[0] + 1, p11[1] + 1); ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;

      for (var g = 0; g < W * 3; g++) {
        ctx.fillStyle = r() > 0.5 ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)";
        ctx.fillRect(r() * W, r() * H, 1 + r() * 2, 1);
      }

      var v = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.2, W / 2, H / 2, Math.max(W, H) * 0.72);
      v.addColorStop(0, "rgba(0,0,0,0)");
      v.addColorStop(1, "rgba(0,0,0,0.22)");
      ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
    });
  }

  /* Torn newsprint: grey column rules and illegible type, so it reads as
     newspaper without pretending to be readable. */
  function newsprint(seed) {
    return tex(300, 400, function (ctx, W, H) {
      var r = rnd(seed);
      ctx.fillStyle = "#e9e4d8"; ctx.fillRect(0, 0, W, H);
      for (var s = 0; s < 2200; s++) {
        ctx.fillStyle = "rgba(120,110,95," + (0.05 + r() * 0.08) + ")";
        ctx.fillRect(r() * W, r() * H, 1, 1);
      }
      var cols = 3, gut = 9, col = (W - 16 - gut * (cols - 1)) / cols;
      for (var c = 0; c < cols; c++) {
        var y = 10 + r() * 12;
        while (y < H - 8) {
          /* the odd heavier line reads as a headline */
          var head = r() > 0.94;
          var wid = col * (head ? 0.9 : 0.5 + r() * 0.5);
          ctx.fillStyle = "rgba(64,58,50," + (head ? 0.34 : 0.13 + r() * 0.12) + ")";
          ctx.fillRect(8 + c * (col + gut), y, wid, head ? 2.6 : 1.2);
          y += head ? 7 : 3.4;
          if (r() > 0.95) y += 5;
        }
      }
    });
  }

  /* Faint grid / ledger paper. */
  function gridPaper(seed) {
    return tex(300, 380, function (ctx, W, H) {
      var r = rnd(seed);
      ctx.fillStyle = "#f6f3ea"; ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = "rgba(120,140,150,0.30)"; ctx.lineWidth = 1;
      for (var x = 0; x < W; x += 15) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
      for (var y = 0; y < H; y += 15) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
      for (var s = 0; s < 900; s++) {
        ctx.fillStyle = "rgba(150,140,120,0.06)";
        ctx.fillRect(r() * W, r() * H, 1, 1);
      }
    });
  }

  /* Denim: woven twill with a faint diagonal. */
  function denimCloth(seed) {
    return tex(260, 320, function (ctx, W, H) {
      var r = rnd(seed);
      ctx.fillStyle = "#4a6b8a"; ctx.fillRect(0, 0, W, H);
      for (var i = 0; i < 5200; i++) {
        var v = r();
        ctx.fillStyle = v > 0.55 ? "rgba(230,242,252,0.16)" : "rgba(10,26,44,0.18)";
        ctx.fillRect(r() * W, r() * H, 2, 1);
      }
      ctx.strokeStyle = "rgba(255,255,255,0.06)"; ctx.lineWidth = 1;
      for (var d = -H; d < W; d += 5) {
        ctx.beginPath(); ctx.moveTo(d, 0); ctx.lineTo(d + H, H); ctx.stroke();
      }
    });
  }

  var PAPER = {};

  /* =======================================================================
     STICKER ART — drawn once, reused everywhere
     ======================================================================= */
  var STICK = {};

  function discoBall(size) {
    return tex(size, size, function (ctx, W) {
      var R = W / 2, cx = R, cy = R, cell = W / 22;
      ctx.save();
      ctx.beginPath(); ctx.arc(cx, cy, R * 0.98, 0, 6.29); ctx.clip();
      for (var y = -R; y < R; y += cell) {
        for (var x = -R; x < R; x += cell) {
          var d2 = (x * x + y * y) / (R * R);
          if (d2 > 1) continue;
          /* shade each tile as if it were on a sphere lit from upper left */
          var z = Math.sqrt(Math.max(0, 1 - d2));
          var lit = (-x / R) * 0.42 + (-y / R) * 0.52 + z * 0.42;
          var v = 74 + lit * 132;
          /* a scatter of tiles catch the light outright */
          var spark = Math.random();
          if (spark > 0.93) v = 248;
          else if (spark > 0.86) v += 34;
          v = Math.max(26, Math.min(255, v));
          ctx.fillStyle = "rgb(" + (v | 0) + "," + Math.min(255, (v + 6) | 0) + "," + Math.min(255, (v + 16) | 0) + ")";
          ctx.fillRect(cx + x, cy + y, cell - 0.9, cell - 0.9);
        }
      }
      /* the sphere's own shading over the top of the tiles */
      var sh = ctx.createRadialGradient(cx - R * 0.34, cy - R * 0.38, R * 0.05, cx, cy, R);
      sh.addColorStop(0, "rgba(255,255,255,0.42)");
      sh.addColorStop(0.45, "rgba(255,255,255,0)");
      sh.addColorStop(0.82, "rgba(18,26,36,0.20)");
      sh.addColorStop(1, "rgba(10,16,24,0.52)");
      ctx.fillStyle = sh;
      ctx.fillRect(0, 0, W, W);
      ctx.restore();
      /* rim */
      ctx.strokeStyle = "rgba(240,248,255,0.35)";
      ctx.lineWidth = W * 0.012;
      ctx.beginPath(); ctx.arc(cx, cy, R * 0.97, 0, 6.29); ctx.stroke();
    });
  }

  /* A record. `label` is the paper centre; pass a colour for coloured vinyl. */
  function vinyl(size, opts) {
    opts = opts || {};
    var body = opts.body || "#141414";
    var lab = opts.label || "#f2f2f2";
    return tex(size, size, function (ctx, W) {
      var r = W / 2;
      ctx.fillStyle = body;
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
      ctx.fillStyle = lab;
      ctx.beginPath(); ctx.arc(r, r, r * 0.32, 0, 6.29); ctx.fill();
      if (opts.text) {
        ctx.fillStyle = opts.textColour || "#111";
        ctx.font = (opts.textFont || ("bold " + (r * 0.4) + "px Georgia, serif"));
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(opts.text, r, r + 1);
      }
      ctx.fillStyle = "rgba(0,0,0,0.7)";
      ctx.beginPath(); ctx.arc(r, r, r * 0.05, 0, 6.29); ctx.fill();
    });
  }

  function chromeLips(w) {
    return tex(w, w * 0.66, function (ctx, W, Hh) {
      function lipPath() {
        ctx.beginPath();
        /* upper lip: two arcs meeting at the cupid's bow */
        ctx.moveTo(W * 0.5, Hh * 0.30);
        ctx.bezierCurveTo(W * 0.42, Hh * 0.02, W * 0.20, Hh * 0.00, W * 0.10, Hh * 0.20);
        ctx.bezierCurveTo(W * 0.03, Hh * 0.32, W * 0.00, Hh * 0.40, W * 0.02, Hh * 0.46);
        /* lower lip, fuller */
        ctx.bezierCurveTo(W * 0.10, Hh * 0.82, W * 0.32, Hh * 1.00, W * 0.5, Hh * 1.00);
        ctx.bezierCurveTo(W * 0.68, Hh * 1.00, W * 0.90, Hh * 0.82, W * 0.98, Hh * 0.46);
        ctx.bezierCurveTo(W * 1.00, Hh * 0.40, W * 0.97, Hh * 0.32, W * 0.90, Hh * 0.20);
        ctx.bezierCurveTo(W * 0.80, Hh * 0.00, W * 0.58, Hh * 0.02, W * 0.5, Hh * 0.30);
        ctx.closePath();
      }
      var g = ctx.createLinearGradient(0, 0, W * 0.35, Hh);
      g.addColorStop(0, "#f2f7fb"); g.addColorStop(0.30, "#a8bccb");
      g.addColorStop(0.52, "#5a7183"); g.addColorStop(0.72, "#8ea4b6");
      g.addColorStop(1, "#dbe7f0");
      ctx.fillStyle = g;
      lipPath(); ctx.fill();

      /* the parting: a dark seam with a lit edge under it */
      ctx.save();
      lipPath(); ctx.clip();
      ctx.strokeStyle = "rgba(18,28,38,0.72)";
      ctx.lineWidth = Hh * 0.055;
      ctx.beginPath();
      ctx.moveTo(W * 0.01, Hh * 0.46);
      ctx.bezierCurveTo(W * 0.26, Hh * 0.40, W * 0.36, Hh * 0.50, W * 0.5, Hh * 0.50);
      ctx.bezierCurveTo(W * 0.64, Hh * 0.50, W * 0.74, Hh * 0.40, W * 0.99, Hh * 0.46);
      ctx.stroke();
      ctx.strokeStyle = "rgba(255,255,255,0.4)";
      ctx.lineWidth = Hh * 0.022;
      ctx.beginPath();
      ctx.moveTo(W * 0.06, Hh * 0.53);
      ctx.bezierCurveTo(W * 0.28, Hh * 0.48, W * 0.38, Hh * 0.57, W * 0.5, Hh * 0.57);
      ctx.bezierCurveTo(W * 0.62, Hh * 0.57, W * 0.72, Hh * 0.48, W * 0.94, Hh * 0.53);
      ctx.stroke();
      /* highlights on the lower lip */
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.beginPath();
      ctx.ellipse(W * 0.34, Hh * 0.76, W * 0.13, Hh * 0.10, -0.25, 0, 6.29);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.32)";
      ctx.beginPath();
      ctx.ellipse(W * 0.68, Hh * 0.22, W * 0.10, Hh * 0.06, 0.3, 0, 6.29);
      ctx.fill();
      ctx.restore();
      ctx.strokeStyle = "rgba(30,44,58,0.42)";
      ctx.lineWidth = Math.max(1, W * 0.012);
      lipPath(); ctx.stroke();
    });
  }

  /* An inky lip print, stamped rather than chromed. */
  function lipStamp(w, colour) {
    return tex(w, w * 0.66, function (ctx, W, H) {
      ctx.fillStyle = colour;
      ctx.beginPath();
      ctx.moveTo(W * 0.5, H * 0.32);
      ctx.bezierCurveTo(W * 0.34, H * 0.0, W * 0.0, H * 0.2, W * 0.05, H * 0.42);
      ctx.bezierCurveTo(W * 0.15, H * 0.92, W * 0.42, H * 1.0, W * 0.5, H * 0.99);
      ctx.bezierCurveTo(W * 0.58, H * 1.0, W * 0.85, H * 0.92, W * 0.95, H * 0.42);
      ctx.bezierCurveTo(W * 1.0, H * 0.2, W * 0.66, H * 0.0, W * 0.5, H * 0.32);
      ctx.fill();
      /* lift ink out in fine vertical creases so it reads as a print */
      ctx.globalCompositeOperation = "destination-out";
      for (var i = 0; i < 46; i++) {
        var x = W * (0.05 + Math.random() * 0.9);
        ctx.fillStyle = "rgba(0,0,0," + (0.25 + Math.random() * 0.45) + ")";
        ctx.fillRect(x, H * (0.02 + Math.random() * 0.5), 1.6, H * (0.14 + Math.random() * 0.4));
      }
      ctx.fillStyle = "rgba(0,0,0,0.9)";
      ctx.fillRect(0, H * 0.44, W, H * 0.05);
      ctx.globalCompositeOperation = "source-over";
    });
  }

  /* A chrome rose, seen from above: petals coiled around a bud, each
     one shaded on its own so the whole thing reads as poured metal. */
  function chromeRose(w) {
    return tex(w, w, function (ctx, W) {
      var cx = W / 2, cy = W / 2;
      /* the outer petals first, working inward */
      for (var ring = 0; ring < 4; ring++) {
        var rr = W * (0.46 - ring * 0.095);
        var count = 7 - ring;
        for (var i = 0; i < count; i++) {
          var a2 = (i / count) * 6.283 + ring * 0.55;
          var px = cx + Math.cos(a2) * rr * 0.42;
          var py = cy + Math.sin(a2) * rr * 0.42;
          var g = ctx.createLinearGradient(
            px - rr * 0.5, py - rr * 0.5, px + rr * 0.5, py + rr * 0.5);
          function ch(v) { return Math.max(24, Math.min(246, Math.round(v))); }
          var base = 96 + ring * 14;
          g.addColorStop(0,    "rgb(" + ch(base + 96) + "," + ch(base + 104) + "," + ch(base + 112) + ")");
          g.addColorStop(0.42, "rgb(" + ch(base + 8)  + "," + ch(base + 18)  + "," + ch(base + 30)  + ")");
          g.addColorStop(1,    "rgb(" + ch(base - 56) + "," + ch(base - 44) + "," + ch(base - 28) + ")");
          ctx.fillStyle = g;
          ctx.save();
          ctx.translate(px, py);
          ctx.rotate(a2 + 1.2);
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.bezierCurveTo(rr * 0.62, -rr * 0.44, rr * 0.86, rr * 0.26, 0, rr * 0.62);
          ctx.bezierCurveTo(-rr * 0.50, rr * 0.30, -rr * 0.40, -rr * 0.26, 0, 0);
          ctx.fill();
          ctx.strokeStyle = "rgba(28,40,54,0.34)";
          ctx.lineWidth = W * 0.008;
          ctx.stroke();
          ctx.restore();
        }
      }
      /* the bud at the centre */
      var bg = ctx.createRadialGradient(cx - W * 0.03, cy - W * 0.035, 1, cx, cy, W * 0.10);
      bg.addColorStop(0, "#fdfeff"); bg.addColorStop(0.55, "#aebecb"); bg.addColorStop(1, "#5d6f7d");
      ctx.fillStyle = bg;
      ctx.beginPath(); ctx.arc(cx, cy, W * 0.095, 0, 6.29); ctx.fill();
      ctx.strokeStyle = "rgba(28,40,54,0.4)"; ctx.lineWidth = W * 0.008; ctx.stroke();
    });
  }

  /* Pressed flowers, loose — the ones scattered flat on the pages.
     Petals are layered in two passes with a darker underside, which is
     what stops them reading as clip-art daisies. */
  function pressedFlowers(w) {
    return tex(w, w, function (ctx, W) {
      var r = rnd(5);

      ctx.strokeStyle = "rgba(104,132,72,0.85)";
      for (var s2 = 0; s2 < 6; s2++) {
        ctx.lineWidth = W * (0.008 + r() * 0.008);
        ctx.beginPath();
        ctx.moveTo(W * 0.5, W * 0.98);
        ctx.quadraticCurveTo(W * (0.3 + r() * 0.4), W * 0.62, W * (0.16 + r() * 0.68), W * (0.18 + r() * 0.3));
        ctx.stroke();
      }
      for (var l = 0; l < 8; l++) {
        ctx.save();
        ctx.fillStyle = ["rgba(126,164,78,0.9)", "rgba(95,132,56,0.9)", "rgba(147,184,98,0.85)"][(r() * 3) | 0];
        ctx.translate(W * (0.18 + r() * 0.64), W * (0.42 + r() * 0.44));
        ctx.rotate(r() * 6.28);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(W * 0.05, -W * 0.03, W * 0.11, 0);
        ctx.quadraticCurveTo(W * 0.05, W * 0.03, 0, 0);
        ctx.fill();
        ctx.restore();
      }

      var pal = [
        ["#f9b9cd", "#eb8fac", "#d4708f"],
        ["#c7a4e6", "#a880d0", "#8c63b6"],
        ["#fdf1f4", "#ecd6dd", "#d4b6c0"],
        ["#f7d9a6", "#e8bd76", "#cb9c50"],
      ];
      for (var b2 = 0; b2 < 8; b2++) {
        var cx = W * (0.14 + r() * 0.7), cy = W * (0.12 + r() * 0.5);
        var p = pal[(r() * pal.length) | 0], rr = W * (0.045 + r() * 0.055);
        var petals = 5 + ((r() * 3) | 0);
        var spin = r() * 6.28;
        /* the underside layer, offset and darker */
        for (var k = 0; k < petals; k++) {
          var a2 = spin + (k / petals) * 6.28;
          ctx.fillStyle = p[2];
          ctx.beginPath();
          ctx.ellipse(cx + Math.cos(a2) * rr * 0.78, cy + Math.sin(a2) * rr * 0.78,
                      rr * 0.60, rr * 0.40, a2, 0, 6.29);
          ctx.fill();
        }
        /* the face */
        for (var k2 = 0; k2 < petals; k2++) {
          var a3 = spin + 0.24 + (k2 / petals) * 6.28;
          ctx.fillStyle = p[0];
          ctx.beginPath();
          ctx.ellipse(cx + Math.cos(a3) * rr * 0.66, cy + Math.sin(a3) * rr * 0.66,
                      rr * 0.54, rr * 0.34, a3, 0, 6.29);
          ctx.fill();
          ctx.fillStyle = p[1];
          ctx.beginPath();
          ctx.ellipse(cx + Math.cos(a3) * rr * 0.44, cy + Math.sin(a3) * rr * 0.44,
                      rr * 0.26, rr * 0.17, a3, 0, 6.29);
          ctx.fill();
        }
        ctx.fillStyle = "rgba(212,166,84,0.92)";
        ctx.beginPath(); ctx.arc(cx, cy, rr * 0.28, 0, 6.29); ctx.fill();
        ctx.fillStyle = "rgba(150,110,44,0.5)";
        for (var d = 0; d < 6; d++) {
          var ad = (d / 6) * 6.28;
          ctx.beginPath();
          ctx.arc(cx + Math.cos(ad) * rr * 0.15, cy + Math.sin(ad) * rr * 0.15, rr * 0.055, 0, 6.29);
          ctx.fill();
        }
      }
    });
  }

  /* ---------------------------------------------------------------
     THE BOUQUET — kraft cone, twine, and a full head of flowers.
     `grow` from 0..1 opens it, so the drawer can bloom it on entry.
     --------------------------------------------------------------- */
  function bouquet(w, h) {
    return tex(w, h, function (ctx, W, Hh) {
      var r = rnd(77);
      var coneTop = Hh * 0.52, coneBot = Hh * 0.99, cx = W * 0.5;
      var halfTop = W * 0.30, halfBot = W * 0.075;

      /* greenery first, fanned out behind the blooms */
      for (var g = 0; g < 16; g++) {
        var ga = -Math.PI / 2 + (r() - 0.5) * 2.5;
        var glen = Hh * (0.16 + r() * 0.22);
        ctx.strokeStyle = ["rgba(108,138,72,0.9)", "rgba(86,116,54,0.9)"][(r() * 2) | 0];
        ctx.lineWidth = W * (0.008 + r() * 0.008);
        ctx.beginPath();
        ctx.moveTo(cx + (r() - 0.5) * W * 0.10, coneTop);
        ctx.quadraticCurveTo(cx + Math.cos(ga) * glen * 0.7, coneTop + Math.sin(ga) * glen * 0.5,
                             cx + Math.cos(ga) * glen * 1.5, coneTop + Math.sin(ga) * glen);
        ctx.stroke();
      }
      for (var l = 0; l < 16; l++) {
        ctx.save();
        ctx.fillStyle = ["rgba(126,164,78,0.92)", "rgba(95,132,56,0.92)", "rgba(150,186,102,0.85)"][(r() * 3) | 0];
        ctx.translate(cx + (r() - 0.5) * W * 0.86, coneTop - Hh * (0.02 + r() * 0.30));
        ctx.rotate((r() - 0.5) * 3.0);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(W * 0.05, -W * 0.035, W * 0.13, 0);
        ctx.quadraticCurveTo(W * 0.05, W * 0.035, 0, 0);
        ctx.fill();
        ctx.restore();
      }

      /* a bloom with a darker underside and a lit face */
      function bloom(x, y, rr, pal, petals) {
        var spin = r() * 6.28;
        for (var k = 0; k < petals; k++) {
          var a2 = spin + (k / petals) * 6.28;
          ctx.fillStyle = pal[2];
          ctx.beginPath();
          ctx.ellipse(x + Math.cos(a2) * rr * 0.80, y + Math.sin(a2) * rr * 0.80,
                      rr * 0.62, rr * 0.46, a2, 0, 6.29);
          ctx.fill();
        }
        for (var k2 = 0; k2 < petals; k2++) {
          var a3 = spin + 0.3 + (k2 / petals) * 6.28;
          ctx.fillStyle = pal[0];
          ctx.beginPath();
          ctx.ellipse(x + Math.cos(a3) * rr * 0.62, y + Math.sin(a3) * rr * 0.62,
                      rr * 0.56, rr * 0.40, a3, 0, 6.29);
          ctx.fill();
          ctx.fillStyle = pal[1];
          ctx.beginPath();
          ctx.ellipse(x + Math.cos(a3) * rr * 0.40, y + Math.sin(a3) * rr * 0.40,
                      rr * 0.30, rr * 0.20, a3, 0, 6.29);
          ctx.fill();
        }
        ctx.fillStyle = pal[1];
        ctx.beginPath(); ctx.arc(x, y, rr * 0.24, 0, 6.29); ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.4)";
        ctx.beginPath(); ctx.arc(x - rr * 0.09, y - rr * 0.09, rr * 0.10, 0, 6.29); ctx.fill();
      }
      function cluster(x, y, rr, c1, c2) {
        for (var k = 0; k < 30; k++) {
          var a = r() * 6.28, d = r() * rr;
          ctx.fillStyle = r() > 0.5 ? c1 : c2;
          ctx.beginPath();
          ctx.arc(x + Math.cos(a) * d, y + Math.sin(a) * d * 0.85, rr * 0.19, 0, 6.29);
          ctx.fill();
        }
      }
      function tulip(x, y, rr, c, cd) {
        ctx.fillStyle = cd;
        ctx.beginPath();
        ctx.moveTo(x, y - rr * 1.05);
        ctx.bezierCurveTo(x + rr * 0.95, y - rr * 0.65, x + rr * 0.72, y + rr * 0.7, x, y + rr * 0.82);
        ctx.bezierCurveTo(x - rr * 0.72, y + rr * 0.7, x - rr * 0.95, y - rr * 0.65, x, y - rr * 1.05);
        ctx.fill();
        ctx.fillStyle = c;
        ctx.beginPath();
        ctx.moveTo(x, y - rr);
        ctx.bezierCurveTo(x + rr * 0.52, y - rr * 0.5, x + rr * 0.40, y + rr * 0.5, x, y + rr * 0.7);
        ctx.bezierCurveTo(x - rr * 0.40, y + rr * 0.5, x - rr * 0.52, y - rr * 0.5, x, y - rr);
        ctx.fill();
      }

      /* the head, arranged as a dome above the wrap */
      var PINK  = ["#f9b6cb", "#e0819f", "#c96b8b"];
      var ROSE  = ["#fbd0dc", "#efa2b8", "#dd8ba4"];
      var CREAM = ["#fdf6f0", "#eddbcf", "#d9c3b6"];
      cluster(cx - W * 0.24, coneTop - Hh * 0.15, W * 0.15, "#ab8bdc", "#8f6cc4");
      cluster(cx + W * 0.25, coneTop - Hh * 0.12, W * 0.13, "#b79ae0", "#9a7ccd");
      tulip(cx - W * 0.33, coneTop - Hh * 0.26, W * 0.085, "#fefaf6", "#e6d6cb");
      tulip(cx + W * 0.32, coneTop - Hh * 0.22, W * 0.075, "#fdf3f6", "#e8cdd6");
      bloom(cx - W * 0.10, coneTop - Hh * 0.16, W * 0.155, PINK, 7);
      bloom(cx + W * 0.14, coneTop - Hh * 0.20, W * 0.145, ROSE, 8);
      bloom(cx + W * 0.01, coneTop - Hh * 0.31, W * 0.125, PINK, 7);
      bloom(cx - W * 0.22, coneTop - Hh * 0.28, W * 0.095, CREAM, 6);
      bloom(cx + W * 0.24, coneTop - Hh * 0.31, W * 0.085, ROSE, 6);

      /* the kraft wrap, over the stems */
      var kg = ctx.createLinearGradient(cx - halfTop, 0, cx + halfTop, 0);
      kg.addColorStop(0, "#b8945f"); kg.addColorStop(0.30, "#dcbe8e");
      kg.addColorStop(0.52, "#f0dcba"); kg.addColorStop(0.78, "#d3b382");
      kg.addColorStop(1, "#a98554");
      ctx.fillStyle = kg;
      ctx.beginPath();
      ctx.moveTo(cx - halfTop, coneTop);
      ctx.lineTo(cx + halfTop, coneTop);
      ctx.lineTo(cx + halfBot, coneBot);
      ctx.quadraticCurveTo(cx, coneBot + Hh * 0.012, cx - halfBot, coneBot);
      ctx.closePath(); ctx.fill();

      /* the folded flap across the top of the wrap */
      ctx.fillStyle = "rgba(255,250,238,0.28)";
      ctx.beginPath();
      ctx.moveTo(cx - halfTop, coneTop);
      ctx.lineTo(cx + halfTop, coneTop);
      ctx.lineTo(cx + halfTop * 0.74, coneTop + Hh * 0.05);
      ctx.lineTo(cx - halfTop * 0.74, coneTop + Hh * 0.05);
      ctx.closePath(); ctx.fill();

      /* creases */
      ctx.strokeStyle = "rgba(122,90,50,0.28)"; ctx.lineWidth = Math.max(1, W * 0.006);
      [-0.7, -0.34, 0.06, 0.4, 0.72].forEach(function (o) {
        ctx.beginPath();
        ctx.moveTo(cx + halfTop * o, coneTop);
        ctx.lineTo(cx + halfBot * o, coneBot - Hh * 0.01);
        ctx.stroke();
      });

      /* twine and a small bow */
      ctx.strokeStyle = "#a8834f"; ctx.lineWidth = W * 0.016; ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(cx - halfTop * 0.62, coneTop + Hh * 0.17);
      ctx.quadraticCurveTo(cx, coneTop + Hh * 0.21, cx + halfTop * 0.62, coneTop + Hh * 0.17);
      ctx.stroke();
      ctx.lineWidth = W * 0.012;
      [-1, 1].forEach(function (side) {
        ctx.beginPath();
        ctx.ellipse(cx + side * W * 0.045, coneTop + Hh * 0.185,
                    W * 0.040, W * 0.026, side * 0.45, 0, 6.29);
        ctx.stroke();
      });
      ctx.lineCap = "butt";
    });
  }

  /* A star sticker: silver, gold or denim. */
  function starArt(w, kind) {
    return tex(w, w, function (ctx, W) {
      var cx = W / 2, cy = W / 2, R = W * 0.47, r2 = R * 0.42;
      ctx.beginPath();
      for (var i = 0; i < 10; i++) {
        var a = -Math.PI / 2 + i * Math.PI / 5;
        var rr = i % 2 ? r2 : R;
        var x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr;
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.closePath();
      var g = ctx.createLinearGradient(0, 0, W, W);
      if (kind === "gold") {
        g.addColorStop(0, "#fff3c4"); g.addColorStop(0.4, "#d9a83c");
        g.addColorStop(0.7, "#a97c1e"); g.addColorStop(1, "#f2d689");
      } else if (kind === "denim") {
        g.addColorStop(0, "#7d9cba"); g.addColorStop(0.5, "#3d5f82"); g.addColorStop(1, "#6c8dab");
      } else {
        g.addColorStop(0, "#ffffff"); g.addColorStop(0.4, "#c2d0da");
        g.addColorStop(0.7, "#7b8b98"); g.addColorStop(1, "#e6eef4");
      }
      ctx.fillStyle = g; ctx.fill();
      if (kind === "denim") {
        ctx.save(); ctx.clip();
        for (var d = 0; d < 900; d++) {
          ctx.fillStyle = Math.random() > 0.5 ? "rgba(230,242,252,0.2)" : "rgba(10,26,44,0.2)";
          ctx.fillRect(Math.random() * W, Math.random() * W, 2, 1);
        }
        ctx.restore();
        ctx.strokeStyle = "rgba(250,250,240,0.75)"; ctx.lineWidth = 1.4;
        ctx.setLineDash([4, 3]); ctx.stroke(); ctx.setLineDash([]);
      } else {
        ctx.strokeStyle = "rgba(40,50,60,0.35)"; ctx.lineWidth = 1; ctx.stroke();
      }
    });
  }

  /* A clock face, printed pale on the page. */
  function clockFace(w) {
    return tex(w, w, function (ctx, W) {
      var c = W / 2, R = W * 0.46;
      ctx.fillStyle = "#efe6cf";
      ctx.beginPath(); ctx.arc(c, c, R, 0, 6.29); ctx.fill();
      ctx.strokeStyle = "rgba(90,70,44,0.5)"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(c, c, R, 0, 6.29); ctx.stroke();
      ctx.beginPath(); ctx.arc(c, c, R * 0.88, 0, 6.29); ctx.stroke();
      ctx.fillStyle = "rgba(70,54,34,0.72)";
      ctx.font = "600 " + (W * 0.09) + "px Georgia, serif";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      for (var n = 1; n <= 12; n++) {
        var a = (n / 12) * 6.283 - Math.PI / 2;
        ctx.fillText(String(n), c + Math.cos(a) * R * 0.72, c + Math.sin(a) * R * 0.72);
      }
      ctx.strokeStyle = "rgba(60,44,26,0.8)"; ctx.lineWidth = W * 0.02;
      ctx.beginPath(); ctx.moveTo(c, c); ctx.lineTo(c + R * 0.34, c - R * 0.30); ctx.stroke();
      ctx.lineWidth = W * 0.013;
      ctx.beginPath(); ctx.moveTo(c, c); ctx.lineTo(c - R * 0.16, c - R * 0.58); ctx.stroke();
    });
  }

  /* ---------------------------------------------------------------
     THE CAMERAS
     Both are drawn with a hole where the photo goes, so a real photo
     slot can be positioned over the window in CSS.
     --------------------------------------------------------------- */
  function instantCam(w) {
    var h = w * 0.92;
    return tex(w, h, function (ctx, W, H) {
      function round(x, y, ww, hh, rr) {
        ctx.beginPath();
        ctx.moveTo(x + rr, y);
        ctx.arcTo(x + ww, y, x + ww, y + hh, rr);
        ctx.arcTo(x + ww, y + hh, x, y + hh, rr);
        ctx.arcTo(x, y + hh, x, y, rr);
        ctx.arcTo(x, y, x + ww, y, rr);
        ctx.closePath();
      }
      var g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, "#e2eef0"); g.addColorStop(0.45, "#c3dade");
      g.addColorStop(1, "#9dbcc2");
      ctx.fillStyle = g;
      round(W * 0.03, H * 0.05, W * 0.94, H * 0.9, W * 0.09); ctx.fill();
      ctx.strokeStyle = "rgba(60,90,98,0.4)"; ctx.lineWidth = 2; ctx.stroke();

      /* the photo window — left empty, a slot sits over it */
      ctx.fillStyle = "#2a3436";
      round(W * 0.10, H * 0.18, W * 0.44, H * 0.55, W * 0.03); ctx.fill();

      /* lens */
      ctx.fillStyle = "#6d8f97";
      ctx.beginPath(); ctx.arc(W * 0.33, H * 0.115, W * 0.045, 0, 6.29); ctx.fill();
      ctx.fillStyle = "#1d282b";
      ctx.beginPath(); ctx.arc(W * 0.33, H * 0.115, W * 0.026, 0, 6.29); ctx.fill();

      /* the ribbed strip along the top right */
      ctx.fillStyle = "#eef6f7";
      round(W * 0.60, H * 0.09, W * 0.32, H * 0.07, W * 0.014); ctx.fill();
      ctx.strokeStyle = "rgba(70,100,108,0.45)"; ctx.lineWidth = 1.4;
      for (var i = 1; i < 4; i++) {
        ctx.beginPath();
        ctx.moveTo(W * (0.60 + i * 0.08), H * 0.09);
        ctx.lineTo(W * (0.60 + i * 0.08), H * 0.16);
        ctx.stroke();
      }

      /* the round pad on the right */
      ctx.fillStyle = "#b3cfd4";
      ctx.beginPath(); ctx.arc(W * 0.755, H * 0.50, W * 0.135, 0, 6.29); ctx.fill();
      ctx.strokeStyle = "rgba(50,80,88,0.35)"; ctx.stroke();
      ctx.fillStyle = "#e6f1f3";
      ctx.beginPath(); ctx.arc(W * 0.755, H * 0.50, W * 0.058, 0, 6.29); ctx.fill();
      ctx.fillStyle = "#7fa3ab";
      [[0, -0.095], [0, 0.095], [-0.095, 0], [0.095, 0]].forEach(function (d) {
        ctx.beginPath();
        ctx.arc(W * (0.755 + d[0]), H * (0.50 + d[1] * (W / H)), W * 0.017, 0, 6.29);
        ctx.fill();
      });

      /* small buttons */
      ctx.fillStyle = "#dceaec";
      round(W * 0.63, H * 0.235, W * 0.10, H * 0.075, W * 0.02); ctx.fill();
      round(W * 0.79, H * 0.235, W * 0.10, H * 0.075, W * 0.02); ctx.fill();
      round(W * 0.63, H * 0.755, W * 0.11, H * 0.08, W * 0.02); ctx.fill();
      round(W * 0.79, H * 0.755, W * 0.11, H * 0.08, W * 0.02); ctx.fill();

      /* speaker dots */
      ctx.fillStyle = "rgba(70,100,108,0.5)";
      for (var dy = 0; dy < 3; dy++) {
        for (var dx = 0; dx < 3; dx++) {
          ctx.beginPath();
          ctx.arc(W * (0.83 + dx * 0.035), H * (0.335 + dy * 0.036), W * 0.009, 0, 6.29);
          ctx.fill();
        }
      }
    });
  }

  function filmCam(w) {
    var h = w * 0.72;
    return tex(w, h, function (ctx, W, H) {
      var g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, "#dfe7ea"); g.addColorStop(0.5, "#a9b8bf"); g.addColorStop(1, "#78888f");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(W * 0.04, H * 0.30);
      ctx.lineTo(W * 0.28, H * 0.30);
      ctx.lineTo(W * 0.34, H * 0.16);
      ctx.lineTo(W * 0.66, H * 0.16);
      ctx.lineTo(W * 0.72, H * 0.30);
      ctx.lineTo(W * 0.96, H * 0.30);
      ctx.lineTo(W * 0.96, H * 0.92);
      ctx.lineTo(W * 0.04, H * 0.92);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = "rgba(40,55,62,0.45)"; ctx.lineWidth = 2; ctx.stroke();

      /* lens barrel */
      ctx.fillStyle = "#5c6d75";
      ctx.beginPath(); ctx.arc(W * 0.5, H * 0.60, W * 0.20, 0, 6.29); ctx.fill();
      ctx.fillStyle = "#2b363b";
      ctx.beginPath(); ctx.arc(W * 0.5, H * 0.60, W * 0.14, 0, 6.29); ctx.fill();
      var lg = ctx.createRadialGradient(W * 0.45, H * 0.53, 1, W * 0.5, H * 0.60, W * 0.14);
      lg.addColorStop(0, "rgba(180,230,240,0.55)"); lg.addColorStop(1, "rgba(20,40,50,0)");
      ctx.fillStyle = lg;
      ctx.beginPath(); ctx.arc(W * 0.5, H * 0.60, W * 0.14, 0, 6.29); ctx.fill();

      /* shutter + dial */
      ctx.fillStyle = "#8fa0a8";
      ctx.beginPath(); ctx.arc(W * 0.17, H * 0.24, W * 0.045, 0, 6.29); ctx.fill();
      ctx.fillStyle = "#c8d4d9";
      ctx.fillRect(W * 0.74, H * 0.18, W * 0.14, H * 0.10);

      ctx.fillStyle = "rgba(30,42,48,0.8)";
      ctx.font = "600 " + (W * 0.058) + "px Georgia, serif";
      ctx.textAlign = "left";
      ctx.fillText("Canon", W * 0.09, H * 0.47);
    });
  }

  /* ---------------------------------------------------------------
     THE MAP — Morocco, with Marrakech at the heart of it.
     Drawn as a flat vector map so it sits happily next to the rest of
     the paper, rather than pulling in a tile service.
     --------------------------------------------------------------- */
  function moroccoMap(w, h) {
    return tex(w, h, function (ctx, W, H) {
      /* sea */
      ctx.fillStyle = "#dfe6e4"; ctx.fillRect(0, 0, W, H);

      /* land: a soft, recognisable Morocco */
      var pts = [
        [0.02, 0.30], [0.14, 0.20], [0.30, 0.12], [0.46, 0.07], [0.62, 0.06],
        [0.78, 0.10], [0.92, 0.18], [0.98, 0.30], [0.96, 0.46], [0.88, 0.60],
        [0.80, 0.74], [0.70, 0.86], [0.56, 0.94], [0.40, 0.97], [0.26, 0.92],
        [0.16, 0.80], [0.09, 0.64], [0.04, 0.47],
      ];
      ctx.beginPath();
      pts.forEach(function (p, i) {
        var x = p[0] * W, y = p[1] * H;
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      });
      ctx.closePath();
      ctx.fillStyle = "#eceae3"; ctx.fill();
      ctx.strokeStyle = "rgba(120,125,120,0.5)"; ctx.lineWidth = 1.2; ctx.stroke();

      /* the Atlas range, as a band of hatching */
      ctx.save();
      ctx.strokeStyle = "rgba(150,140,120,0.55)"; ctx.lineWidth = 1.4;
      for (var i2 = 0; i2 < 26; i2++) {
        var t = i2 / 26;
        var x0 = W * (0.20 + t * 0.62), y0 = H * (0.66 - t * 0.20);
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x0 + W * 0.022, y0 - H * 0.035);
        ctx.lineTo(x0 + W * 0.044, y0);
        ctx.stroke();
      }
      ctx.restore();

      /* roads out of the city */
      ctx.strokeStyle = "rgba(190,175,150,0.85)"; ctx.lineWidth = 2;
      [[0.20, 0.18], [0.86, 0.30], [0.62, 0.88], [0.12, 0.62]].forEach(function (e) {
        ctx.beginPath();
        ctx.moveTo(W * 0.46, H * 0.46);
        ctx.quadraticCurveTo(W * (0.46 + e[0]) / 2, H * (0.46 + e[1]) / 2 + H * 0.04, W * e[0], H * e[1]);
        ctx.stroke();
      });

      /* place names */
      ctx.fillStyle = "rgba(70,72,68,0.9)";
      ctx.textAlign = "center";
      ctx.font = "600 " + Math.round(W * 0.045) + "px 'Poppins', system-ui, sans-serif";
      ctx.fillText("Marrakech", W * 0.44, H * 0.36);
      ctx.font = "500 " + Math.round(W * 0.032) + "px 'Poppins', system-ui, sans-serif";
      ctx.fillStyle = "rgba(110,112,106,0.85)";
      ctx.fillText("مراكش", W * 0.44, H * 0.305);
      ctx.font = "500 " + Math.round(W * 0.033) + "px 'Poppins', system-ui, sans-serif";
      ctx.fillStyle = "rgba(120,122,116,0.8)";
      ctx.fillText("Casablanca", W * 0.24, H * 0.19);
      ctx.fillText("Essaouira", W * 0.11, H * 0.60);
      ctx.fillText("Agadir", W * 0.20, H * 0.86);
      ctx.fillText("Ouarzazate", W * 0.80, H * 0.66);
      ctx.fillStyle = "rgba(150,152,146,0.75)";
      ctx.font = "500 " + Math.round(W * 0.030) + "px 'Poppins', system-ui, sans-serif";
      ctx.fillText("Morocco", W * 0.80, H * 0.16);

      /* city dots */
      ctx.fillStyle = "rgba(90,92,88,0.7)";
      [[0.24, 0.215], [0.11, 0.625], [0.20, 0.885], [0.80, 0.685]].forEach(function (d) {
        ctx.beginPath(); ctx.arc(W * d[0], H * d[1], W * 0.008, 0, 6.29); ctx.fill();
      });
    });
  }

  /* =======================================================================
     THE PAGES

     One entry per page. Everything is positioned in percentages of the
     page, so a spread holds together whether it is on a laptop or half a
     phone screen. `n:` numbers a photo slot — those stay empty until
     real photos are added to MEMORIES in script.js.
     ======================================================================= */
  var H = SB.hand;

  var PAGES = [
    /* ---- 0 · disco ---------------------------------------------- */
    { paper: "teal", pieces: [
      { k: "sticker", art: "disco",   left: -6, top:  2, w: 30, rot: 0 },
      { k: "sticker", art: "rose",    left: -2, top: 22, w: 24, rot: -8 },
      { k: "sticker", art: "lips",    left:  6, top: 36, w: 20, rot: -12 },
      { k: "sticker", art: "flowers", left: -4, top: 46, w: 30, rot: -6 },
      { k: "sticker", art: "disco",   left: -2, top: 72, w: 26, rot: 0 },
      { k: "sticker", art: "disco",   left: 30, top: 80, w: 24, rot: 0 },
      { k: "bigtype", text: "love you", left: 64, top: 6, size: 15, vertical: true, colour: "rgba(255,255,255,.24)" },
      { k: "photo", n: 0, style: "polaroid", left: 34, top:  4, w: 34, rot: -6, tape: "top" },
      { k: "photo", n: 1, style: "polaroid", left: 22, top: 26, w: 38, rot:  3, tape: "corner" },
      { k: "photo", n: 2, style: "polaroid", left: 32, top: 50, w: 34, rot: -3, tape: "none" },
      { k: "photo", n: 3, style: "polaroid", left: 12, top: 68, w: 34, rot:  2, tape: "top" },
      { k: "sticker", art: "lips",    left: 62, top: 78, w: 18, rot: 14 },
      { k: "sticker", art: "vinyl8",  left: 70, top: 76, w: 26, rot: 0 },
      { k: "burst", left: 66, top: 52, w: 9 },
    ]},

    /* ---- 1 · memories -------------------------------------------- */
    { paper: "teal", pieces: [
      { k: "note", left: 6, top: 6, w: 56, rot: -1.5, text: H.s1note },
      { k: "letters", text: "MEMORIES", left: 62, top: 4 },
      { k: "photo", n: 4, style: "plain", left: 74, top: 16, w: 24, rot: 2 },
      { k: "photo", n: 5, style: "plain", left:  4, top: 40, w: 32, rot: -2, caption: H.s1small },
      { k: "sticker", art: "vinyl8", left: 32, top: 36, w: 22, rot: 0 },
      { k: "sticker", art: "flowers", left: 28, top: 50, w: 20, rot: 8 },
      { k: "photo", n: 6,  style: "polaroid", left: 40, top: 42, w: 27, rot: 0 },
      { k: "photo", n: 7,  style: "polaroid", left: 70, top: 42, w: 27, rot: 0 },
      { k: "photo", n: 8,  style: "polaroid", left:  8, top: 70, w: 27, rot: 0 },
      { k: "photo", n: 9,  style: "polaroid", left: 39, top: 70, w: 27, rot: 0 },
      { k: "photo", n: 10, style: "polaroid", left: 70, top: 70, w: 27, rot: 0 },
    ]},

    /* ---- 2 · the camera ------------------------------------------ */
    { paper: "teal2", pieces: [
      { k: "typecol", text: "The", left: -1, top: 2, w: 20 },
      { k: "bigtype", text: "C", left: 16, top: 2, size: 34, rot: 0, colour: "rgba(226,240,244,.30)" },
      { k: "patch", paper: "grid", left: 12, top: 1, w: 46, h: 26, rot: -3 },
      { k: "instantcam", n: 11, left: 22, top: 8, w: 62, rot: 1 },
      { k: "img", src: "assets/key.png", left: 30, top: 55, w: 9, rot: 12 },
      { k: "script", text: "from the midwest princess", left: 56, top: 55, w: 36, rot: -7, size: 3.6 },
      { k: "idcard", n: 12, left: 8, top: 62, w: 66, rot: -2 },
    ]},

    /* ---- 3 · the letter ------------------------------------------ */
    { paper: "ivory", pieces: [
      { k: "patch", paper: "news", left: -6, top: 2, w: 34, h: 96, rot: 1.5 },
      { k: "patch", paper: "teal", left: 62, top: -2, w: 44, h: 30, rot: -4 },
      { k: "sticker", art: "starD", left: 4, top: 20, w: 20, rot: -10 },
      { k: "voicepill", left: 16, top: 13, w: 78 },
      { k: "letterpage", left: 12, top: 26, w: 82, rot: 0.6 },
      { k: "sticker", art: "vinylTeal", left: 0, top: 74, w: 40, rot: 0 },
      { k: "script", text: "the place where the confetti falls", left: 60, top: 84, w: 34, rot: -6, size: 3.2, dark: true },
    ]},

    /* ---- 4 · the map --------------------------------------------- */
    { paper: "teal", pieces: [
      { k: "typecol", text: "Th", left: -1, top: 4, w: 14 },
      { k: "sticker", art: "vinylTeal", left: 0, top: 30, w: 54, rot: 0 },
      { k: "sticker", art: "clock", left: 4, top: 36, w: 26, rot: 0 },
      { k: "curvetext", text: H.vinyl, left: 2, top: 32, w: 50 },
      { k: "mapcard", left: 26, top: 3, w: 68 },
      { k: "sticker", art: "lipInk", left: 4, top: 3, w: 20, rot: -8 },
      { k: "sticker", art: "lipInk", left: 78, top: 40, w: 20, rot: 12 },
      { k: "photo", n: 13, style: "framed", left: 44, top: 44, w: 50, rot: -4 },
      { k: "photo", n: 14, style: "framed", left: 30, top: 70, w: 46, rot: 3 },
      { k: "sticker", art: "flowers", left: -4, top: 70, w: 28, rot: -8 },
    ]},

    /* ---- 5 · cold hands ------------------------------------------ */
    { paper: "ivory", pieces: [
      { k: "patch", paper: "news", left: 50, top: -2, w: 56, h: 30, rot: 4 },
      { k: "patch", paper: "teal", left: -6, top: 52, w: 32, h: 54, rot: -3 },
      { k: "photo", n: 15, style: "polaroid", left:  6, top:  6, w: 32, rot: -3 },
      { k: "photo", n: 16, style: "polaroid", left: 58, top:  8, w: 30, rot:  4 },
      { k: "script", text: H.s3note, left: 2, top: 34, w: 30, rot: -3, size: 3.4, dark: true },
      { k: "photo", n: 17, style: "polaroid", left: 34, top: 30, w: 28, rot: -2 },
      { k: "photo", n: 18, style: "plain",    left: 66, top: 34, w: 24, rot:  2 },
      { k: "photobooth", n: 19, cells: 3, left: 4, top: 54, w: 20, rot: 5 },
      { k: "photo", n: 20, style: "polaroid", left: 36, top: 58, w: 30, rot: -3 },
      { k: "sticker", art: "starD", left: 66, top: 56, w: 18, rot: -14 },
      { k: "label", text: "COLD HANDS,\nWARM HEARTS", left: 60, top: 74, w: 36, rot: -4 },
      { k: "sticker", art: "flowers", left: 30, top: 84, w: 26, rot: 6 },
    ]},

    /* ---- 6 · the film strip -------------------------------------- */
    { paper: "ivory", pieces: [
      { k: "script", text: "the time we spent, and every hour after", left: 14, top: 3, w: 44, rot: 0, size: 3.4, faint: true },
      { k: "sticker", art: "starS", left: 2, top: 8, w: 20, rot: 16 },
      { k: "filmcam", left: 4, top: 16, w: 50, rot: -8 },
      { k: "sticker", art: "vinylTeal", left: -8, top: 52, w: 44, rot: 0 },
      { k: "sticker", art: "clock", left: 34, top: 76, w: 24, rot: 0 },
      { k: "bouquet", left: 6, top: 40, w: 36, rot: -4 },
      { k: "filmstrip", cells: [21, 22, 23, 24], left: 56, top: -2, w: 42 },
    ]},

    /* ---- 7 · the prints ------------------------------------------ */
    { paper: "denim", pieces: [
      { k: "patch", paper: "denimCloth", left: 56, top: -2, w: 50, h: 42, rot: 6 },
      { k: "patch", paper: "denimCloth", left: -6, top: 58, w: 48, h: 48, rot: -5 },
      { k: "sticker", art: "vinylLtd", left: 64, top: 22, w: 42, rot: 0 },
      { k: "photo", n: 25, style: "washed", left: -2, top:  4, w: 62, rot: -7 },
      { k: "photo", n: 26, style: "washed", left: 26, top: 34, w: 64, rot:  4 },
      { k: "photo", n: 27, style: "washed", left:  2, top: 66, w: 56, rot: -3 },
      { k: "sticker", art: "starD", left: 66, top: 62, w: 20, rot: -20 },
      { k: "sticker", art: "lips", left: 74, top: 82, w: 20, rot: 12 },
    ]},

    /* ---- 8 · these memories -------------------------------------- */
    { paper: "grid", pieces: [
      { k: "patch", paper: "teal", left: 44, top: 10, w: 34, h: 52, rot: 2 },
      { k: "photo", n: 40, style: "washed", left: 12, top: -2, w: 42, rot: 1 },
      { k: "label2", text: "THESE\nMEMORIES\nMAKE ME SMILE", left: 56, top: 4, w: 34, rot: -3 },
      { k: "sticker", art: "starG", left: 84, top: 2, w: 14, rot: 12 },
      { k: "sticker", art: "starG", left: 66, top: 44, w: 11, rot: -8 },
      { k: "photobooth", n: 28, cells: 3, left: 6, top: 30, w: 24, rot: -4 },
      { k: "photo", n: 29, style: "washed", left: 8, top: 52, w: 40, rot: 2 },
      { k: "photo", n: 30, style: "washed", left: 6, top: 76, w: 40, rot: -1 },
      { k: "patch", paper: "blush", left: 48, top: 66, w: 46, h: 36, rot: 3 },
      { k: "sticker", art: "flowers", left: 60, top: 68, w: 36, rot: 4 },
      { k: "sticker", art: "starG", left: 52, top: 72, w: 12, rot: 20 },
    ]},

    /* ---- 9 · the video ------------------------------------------- */
    { paper: "ivory", pieces: [
      { k: "patch", paper: "denimCloth", left: 76, top: 26, w: 30, h: 46, rot: -4 },
      { k: "photo", n: 31, style: "washed", left: 10, top: 2, w: 76, rot: 0.5 },
      { k: "script", text: "and every one of them, again", left: 8, top: 34, w: 30, rot: -2, size: 3.2, dark: true },
      { k: "videocard", left: 14, top: 44, w: 72 },
      { k: "filmstrip", cells: [32, 33, 34], left: 8, top: 80, w: 84, horizontal: true },
    ]},
  ];

  /* the back cover is its own thing, not a page of collage */
  var BACK = { title: "the end.", line1: "until next time,", line2: "— love, always •", line3: "xoxo" };

  /* Anything still wrapped in [square brackets] is scaffolding, not
     content — it should never make it onto a page. */
  function real(v) {
    if (!v) return "";
    var t = String(v).trim();
    return (t.charAt(0) === "[" && t.charAt(t.length - 1) === "]") ? "" : t;
  }

  function photoAt(i) {
    var m = (typeof MEMORIES !== "undefined" && MEMORIES[i]) ? MEMORIES[i] : null;
    return {
      src:   m && m.photo ? m.photo : null,
      title: real(m && m.title),
      date:  real(m && m.date),
      text:  real(m && m.text),
      idx: i,
    };
  }

  /* =======================================================================
     BUILDING A PAGE
     ======================================================================= */
  function el(cls, tag) {
    var e = document.createElement(tag || "div");
    if (cls) e.className = cls;
    return e;
  }

  function place(e, p) {
    e.style.left = p.left + "%";
    e.style.top = p.top + "%";
    if (p.w != null) e.style.width = p.w + "%";
    if (p.h != null) e.style.height = p.h + "%";
    if (p.rot) e.style.setProperty("--rot", p.rot + "deg");
    return e;
  }

  /* a photo slot. Empty until a real photo is set in MEMORIES. */
  function makePhoto(p) {
    var mem = photoAt(p.n);
    var wrap = place(el("sb-photo sb-photo-" + (p.style || "polaroid")), p);
    var inner = el("sb-photo-inner");
    if (mem.src) {
      var img = el("", "img");
      img.src = mem.src;
      img.alt = mem.title || "a memory";
      img.loading = "lazy";
      inner.appendChild(img);
    } else {
      var ph = el("sb-photo-empty");
      ph.innerHTML = "<span>photo</span>";
      inner.appendChild(ph);
    }
    wrap.appendChild(inner);
    if (p.caption) {
      var cap = el("sb-photo-hand");
      cap.textContent = p.caption;
      wrap.appendChild(cap);
    } else if (mem.title) {
      var cap2 = el("sb-photo-cap");
      cap2.textContent = mem.title;
      wrap.appendChild(cap2);
    }
    if (p.tape && p.tape !== "none") wrap.appendChild(el("sb-tape sb-tape-" + p.tape));
    wrap.addEventListener("click", function (ev) {
      ev.stopPropagation();
      openLightbox(mem);
    });
    return wrap;
  }

  function makeSticker(p) {
    var e = place(el("sb-sticker"), p);
    var img = el("", "img");
    img.src = STICK[p.art];
    img.alt = "";
    e.appendChild(img);
    return e;
  }

  function makeImg(p) {
    var e = place(el("sb-sticker"), p);
    var img = el("", "img");
    img.src = p.src; img.alt = "";
    e.appendChild(img);
    return e;
  }

  function makePatch(p) {
    var e = place(el("sb-patch"), p);
    e.style.backgroundImage = "url(" + PAPER[p.paper] + ")";
    return e;
  }

  function makeNote(p) {
    var e = place(el("sb-note"), p);
    e.style.backgroundImage = "url(" + PAPER.note + ")";
    e.appendChild(el("sb-tape sb-tape-top"));
    var t = el("sb-note-text");
    t.textContent = p.text;
    e.appendChild(t);
    return e;
  }

  function makeBigType(p) {
    var e = place(el("sb-big" + (p.vertical ? " vertical" : "")), p);
    e.textContent = p.text;
    if (p.size) e.style.fontSize = p.size + "cqw";
    e.style.color = p.colour;
    if (p.rot) e.style.setProperty("--rot", p.rot + "deg");
    return e;
  }

  function makeScript(p) {
    var cls = "sb-script";
    if (p.faint) cls += " faint";
    if (p.dark) cls += " dark";
    var e = place(el(cls), p);
    e.textContent = p.text;
    if (p.size) e.style.fontSize = p.size + "cqw";
    return e;
  }

  /* the stacked sticker letters, each cut from a different magazine */
  function makeLetters(p) {
    var e = place(el("sb-letters"), p);
    p.text.split("").forEach(function (ch, i) {
      var s = el("sb-letter sb-letter-" + (i % 4));
      s.textContent = ch;
      s.style.setProperty("--r", (((i % 3) - 1) * 6) + "deg");
      e.appendChild(s);
    });
    return e;
  }

  /* the repeated word running down the outer edge of a page */
  function makeTypeCol(p) {
    var e = place(el("sb-typecol"), p);
    for (var i = 0; i < 7; i++) {
      var s = el("sb-typecol-word");
      s.textContent = p.text;
      e.appendChild(s);
    }
    return e;
  }

  function makeCurveText(p) {
    var e = place(el("sb-curve"), p);
    var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 200 200");
    var path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    var id = "sbcurve" + Math.random().toString(36).slice(2, 8);
    path.setAttribute("id", id);
    path.setAttribute("fill", "none");
    path.setAttribute("d", "M 22,100 A 78,78 0 0 1 178,100");
    var txt = document.createElementNS("http://www.w3.org/2000/svg", "text");
    var tp = document.createElementNS("http://www.w3.org/2000/svg", "textPath");
    tp.setAttributeNS("http://www.w3.org/1999/xlink", "xlink:href", "#" + id);
    tp.setAttribute("href", "#" + id);
    tp.setAttribute("startOffset", "50%");
    tp.setAttribute("text-anchor", "middle");
    tp.textContent = p.text;
    txt.setAttribute("font-size", "15");
    txt.appendChild(tp);
    svg.appendChild(path); svg.appendChild(txt);
    e.appendChild(svg);
    return e;
  }

  function makeBurst(p) {
    var e = place(el("sb-burst"), p);
    e.innerHTML = '<svg viewBox="0 0 100 100"><path d="M50 2 L60 34 L92 26 L68 50 L92 74 L60 66 L50 98 L40 66 L8 74 L32 50 L8 26 L40 34 Z"/></svg>';
    return e;
  }

  function makeLabel(p) {
    var e = place(el("sb-label"), p);
    e.textContent = p.text;
    return e;
  }

  function makeLabel2(p) {
    var e = place(el("sb-label2"), p);
    p.text.split("\n").forEach(function (line, i) {
      var s = el("sb-label2-line l" + i);
      s.textContent = line;
      e.appendChild(s);
    });
    return e;
  }

  /* the instant camera, with a photo slot over its window */
  function makeInstantCam(p) {
    var e = place(el("sb-cam"), p);
    var img = el("", "img");
    img.src = STICK.instantCam; img.alt = "";
    e.appendChild(img);
    var slot = makePhoto({ n: p.n, style: "window", left: 10, top: 18, w: 44 });
    slot.style.height = "55%";
    e.appendChild(slot);
    return e;
  }

  function makeFilmCam(p) {
    var e = place(el("sb-sticker"), p);
    var img = el("", "img");
    img.src = STICK.filmCam; img.alt = "";
    e.appendChild(img);
    return e;
  }

  function makeBouquetPiece(p) {
    var e = place(el("sb-sticker sb-bouquet-piece"), p);
    var img = el("", "img");
    img.src = STICK.bouquet; img.alt = "a bouquet";
    e.appendChild(img);
    return e;
  }

  /* 35mm film, vertical by default */
  function makeFilmStrip(p) {
    var e = place(el("sb-film" + (p.horizontal ? " horiz" : "")), p);
    var holesA = el("sb-film-holes a"), holesB = el("sb-film-holes b");
    for (var i = 0; i < 14; i++) { holesA.appendChild(el("i")); holesB.appendChild(el("i")); }
    e.appendChild(holesA); e.appendChild(holesB);
    var cells = el("sb-film-cells");
    p.cells.forEach(function (n) {
      var c = el("sb-film-cell");
      c.appendChild(makePhoto({ n: n, style: "cell", left: 0, top: 0, w: 100 }));
      cells.appendChild(c);
    });
    e.appendChild(cells);
    return e;
  }

  /* a photobooth strip: four small frames on card */
  function makePhotobooth(p) {
    var e = place(el("sb-booth"), p);
    var count = p.cells || 4;
    for (var i = 0; i < count; i++) {
      var c = el("sb-booth-cell");
      c.appendChild(makePhoto({ n: p.n, style: "cell", left: 0, top: 0, w: 100 }));
      e.appendChild(c);
    }
    return e;
  }

  /* the LOVERS CLUB card */
  function makeIdCard(p) {
    var e = place(el("sb-id"), p);
    e.innerHTML =
      '<div class="sb-id-frame">' +
        '<div class="sb-id-photo"></div>' +
        '<div class="sb-id-body">' +
          '<p class="sb-id-title">LOVERS CLUB</p>' +
          '<p class="sb-id-sub">official — one of a kind</p>' +
          '<p class="sb-id-row"><span>Issued to</span><i></i></p>' +
          '<p class="sb-id-row"><span>Date of issue</span><i></i></p>' +
          '<p class="sb-id-row"><span>Place of issue</span><i></i></p>' +
          '<p class="sb-id-fine">licence to be loved, indefinitely, without review</p>' +
          '<span class="sb-id-stamp">CERTIFIED</span>' +
        '</div>' +
      '</div>';
    var slot = makePhoto({ n: p.n, style: "cell", left: 0, top: 0, w: 100 });
    slot.style.height = "100%";
    e.querySelector(".sb-id-photo").appendChild(slot);
    return e;
  }

  /* the letter under a paperclip, with the button that opens the note */
  function makeLetterPage(p) {
    var L = SB.letter;
    var e = place(el("sb-letterpage"), p);
    e.innerHTML =
      '<span class="sb-clip" aria-hidden="true"></span>' +
      '<p class="sb-lp-from"><span>FROM</span> ' + L.from + '</p>' +
      '<p class="sb-lp-to"><span>FOR</span> ' + L.to + '</p>' +
      '<p class="sb-lp-lead">' + L.lead + '</p>' +
      '<p class="sb-lp-body">' + L.body + '</p>';
    var btn = el("sb-lp-btn", "button");
    btn.textContent = "Tap here to view more";
    btn.addEventListener("click", function (ev) { ev.stopPropagation(); openNote(); });
    e.appendChild(btn);
    return e;
  }

  /* the voice note pill */
  function makeVoicePill(p) {
    var e = place(el("sb-voice"), p);
    e.appendChild(buildVoicePill());
    return e;
  }

  /* the memory-map card sitting on the page */
  function makeMapCard(p) {
    var e = place(el("sb-mapcard"), p);
    e.appendChild(buildMapCard(false));
    return e;
  }

  /* the music-video card */
  function makeVideoCard(p) {
    var e = place(el("sb-videoslot"), p);
    e.appendChild(buildVideoCard());
    return e;
  }

  var MAKERS = {
    photo: makePhoto, sticker: makeSticker, img: makeImg, patch: makePatch,
    note: makeNote, bigtype: makeBigType, script: makeScript, letters: makeLetters,
    typecol: makeTypeCol, curvetext: makeCurveText, burst: makeBurst,
    label: makeLabel, label2: makeLabel2, instantcam: makeInstantCam,
    filmcam: makeFilmCam, bouquet: makeBouquetPiece, filmstrip: makeFilmStrip,
    photobooth: makePhotobooth, idcard: makeIdCard, letterpage: makeLetterPage,
    voicepill: makeVoicePill, mapcard: makeMapCard, videocard: makeVideoCard,
  };

  function buildPage(def, i) {
    var page = el("sb-page");
    page.dataset.index = i;
    page.style.backgroundImage = "url(" + PAPER[def.paper] + ")";
    def.pieces.forEach(function (p) {
      var make = MAKERS[p.k];
      if (make) page.appendChild(make(p));
    });
    return page;
  }

  function buildBackCover() {
    var page = el("sb-page sb-page-back");
    page.style.backgroundImage = "url(" + PAPER.teal + ")";
    var card = el("sb-back-card");
    card.innerHTML =
      '<h2>' + BACK.title + '</h2>' +
      '<p class="l1">' + BACK.line1 + '</p>' +
      '<p class="l2">' + BACK.line2 + '</p>' +
      '<p class="l3">' + BACK.line3 + '</p>';
    page.appendChild(card);
    var s = el("sb-sticker sb-back-star");
    var si = el("", "img"); si.src = STICK.starS; s.appendChild(si);
    page.appendChild(s);
    return page;
  }

  /* =======================================================================
     THE DRAWER — bouquet, song, map, voice note, video

     These five are built as standalone widgets because two of them also
     appear on the pages themselves (the map on page 4, the video on
     page 9), and both places should behave identically.
     ======================================================================= */

  /* ---- shared: quiet the ambient pad while something else plays ---- */
  function duckAmbient() {
    try { if (window.musicOn && typeof window.setMusic === "function") window.setMusic(false); }
    catch (e) { /* the pad is optional; never let it break playback */ }
  }

  var songAudio = null, voiceAudio = null;

  function stopAllAudio(except) {
    if (songAudio && except !== "song") { songAudio.pause(); }
    if (voiceAudio && except !== "voice") { voiceAudio.pause(); }
  }

  /* ---- the bouquet card ---- */
  function buildBouquetCard() {
    var c = el("sb-w sb-w-bouquet");
    c.innerHTML =
      '<p class="sb-w-title">My Love’s bouquet</p>' +
      '<p class="sb-w-kicker">FROM YOU</p>' +
      '<div class="sb-bq-stage"><img class="sb-bq" alt="a bouquet of flowers" /></div>';
    c.querySelector(".sb-bq").src = STICK.bouquet;
    return c;
  }

  /* ---- the song ---- */
  function buildSongCard() {
    var S = SB.song;
    var c = el("sb-w sb-w-song");
    c.innerHTML =
      '<div class="sb-song-art"><span>♪</span></div>' +
      '<div class="sb-song-meta">' +
        '<strong>' + S.title + '</strong>' +
        '<span>' + S.artist + '</span>' +
        '<div class="sb-song-bar"><i></i></div>' +
      '</div>' +
      '<button class="sb-song-play" aria-label="Play the song">▶</button>';

    var btn = c.querySelector(".sb-song-play");
    var bar = c.querySelector(".sb-song-bar i");

    btn.addEventListener("click", function () {
      if (!songAudio) {
        songAudio = new Audio(S.src);
        songAudio.preload = "none";
        songAudio.addEventListener("timeupdate", function () {
          if (!songAudio.duration) return;
          bar.style.width = ((songAudio.currentTime / songAudio.duration) * 100) + "%";
        });
        songAudio.addEventListener("play", function () { btn.textContent = "❘❘"; });
        songAudio.addEventListener("pause", function () { btn.textContent = "▶"; });
        songAudio.addEventListener("ended", function () { btn.textContent = "▶"; });
        songAudio.addEventListener("error", function () {
          c.classList.add("missing");
          btn.textContent = "▶";
        });
        /* start at the moment set in SB.song.startAt */
        songAudio.addEventListener("loadedmetadata", function () {
          if (S.startAt && songAudio.currentTime < 0.2) {
            try { songAudio.currentTime = Math.min(S.startAt, Math.max(0, songAudio.duration - 1)); }
            catch (e) {}
          }
        });
      }
      if (songAudio.paused) {
        duckAmbient();
        stopAllAudio("song");
        if (songAudio.readyState === 0 && S.startAt) {
          songAudio.load();
        }
        var p = songAudio.play();
        if (p && p.catch) p.catch(function () { c.classList.add("missing"); });
      } else {
        songAudio.pause();
      }
    });
    return c;
  }

  /* ---- the voice note ---- */
  function buildVoicePill() {
    var V = SB.voice;
    var c = el("sb-w sb-w-voice");
    var bars = "";
    for (var i = 0; i < 34; i++) {
      bars += '<span style="height:' + (18 + Math.round(Math.abs(Math.sin(i * 1.7)) * 62)) + '%"></span>';
    }
    c.innerHTML =
      '<button class="sb-play" aria-label="Play the voice note">▶</button>' +
      '<div class="sb-voice-meta">' +
        '<strong>' + V.label + '</strong>' +
        '<em>' + V.hint + '</em>' +
      '</div>' +
      '<div class="sb-wave">' + bars + "</div>" +
      '<span class="sb-time">0:00</span>';

    var btn = c.querySelector(".sb-play");
    var time = c.querySelector(".sb-time");
    var wave = c.querySelector(".sb-wave");

    function fmt(t) {
      t = Math.max(0, Math.floor(t || 0));
      return Math.floor(t / 60) + ":" + ("0" + (t % 60)).slice(-2);
    }

    btn.addEventListener("click", function () {
      if (!voiceAudio) {
        voiceAudio = new Audio(V.src);
        voiceAudio.preload = "none";
        voiceAudio.addEventListener("timeupdate", function () {
          time.textContent = fmt(voiceAudio.currentTime);
          var pct = voiceAudio.duration ? voiceAudio.currentTime / voiceAudio.duration : 0;
          wave.style.setProperty("--played", (pct * 100) + "%");
        });
        voiceAudio.addEventListener("play", function () { btn.textContent = "❘❘"; c.classList.add("playing"); });
        voiceAudio.addEventListener("pause", function () { btn.textContent = "▶"; c.classList.remove("playing"); });
        voiceAudio.addEventListener("ended", function () { btn.textContent = "▶"; c.classList.remove("playing"); });
        voiceAudio.addEventListener("error", function () { c.classList.add("missing"); });
      }
      if (voiceAudio.paused) {
        duckAmbient();
        stopAllAudio("voice");
        var p = voiceAudio.play();
        if (p && p.catch) p.catch(function () { c.classList.add("missing"); });
      } else {
        voiceAudio.pause();
      }
    });
    return c;
  }

  /* ---- the memory map ---- */
  var MAP_TEX = null;
  function buildMapCard(big) {
    if (!MAP_TEX) MAP_TEX = moroccoMap(560, 420);
    var c = el("sb-w sb-w-map" + (big ? " big" : ""));
    c.innerHTML =
      '<div class="sb-map-head">' +
        '<div><p class="sb-map-kicker">MEMORY MAP</p><p class="sb-map-name">Memory map</p></div>' +
        '<div class="sb-map-zoom"><button class="sb-zo" aria-label="Zoom out">−</button>' +
        '<button class="sb-zi" aria-label="Zoom in">+</button></div>' +
      "</div>" +
      '<div class="sb-map-body"><div class="sb-map-inner"><img class="sb-map-img" alt="a map of Marrakech" /></div>' +
      '<p class="sb-map-hint">tap a pin to open it</p></div>';
    c.querySelector(".sb-map-img").src = MAP_TEX;

    var inner = c.querySelector(".sb-map-inner");
    var zoom = 1;
    function applyZoom() { inner.style.transform = "scale(" + zoom + ")"; }
    c.querySelector(".sb-zi").addEventListener("click", function (e) {
      e.stopPropagation(); zoom = Math.min(2.2, zoom + 0.25); applyZoom();
    });
    c.querySelector(".sb-zo").addEventListener("click", function (e) {
      e.stopPropagation(); zoom = Math.max(1, zoom - 0.25); applyZoom();
    });

    SB.map.pins.forEach(function (pin, i) {
      var b = el("sb-map-pin", "button");
      b.style.left = pin.x + "%";
      b.style.top = pin.y + "%";
      b.style.animationDelay = (i * 0.45) + "s";
      b.setAttribute("aria-label", pin.title);
      var mem = photoAt(35 + i);
      b.innerHTML = mem.src
        ? '<img src="' + mem.src + '" alt="">'
        : '<span class="sb-map-pin-empty"></span>';
      b.addEventListener("click", function (e) {
        e.stopPropagation();
        openPin(pin, mem);
      });
      inner.appendChild(b);
    });
    return c;
  }

  /* ---- the music video ---- */
  function buildVideoCard() {
    var V = SB.video;
    var c = el("sb-w sb-w-video");
    c.innerHTML =
      '<div class="sb-video-frame">' +
        '<div class="sb-video-poster">' +
          '<span class="sb-video-ring"></span>' +
          '<span class="sb-video-label">LOADING VIDEO</span>' +
        "</div>" +
      "</div>" +
      '<p class="sb-video-cap">' + V.title + " · " + V.artist + "</p>";

    var frame = c.querySelector(".sb-video-frame");
    frame.addEventListener("click", function () {
      if (frame.querySelector("iframe")) return;
      duckAmbient();
      stopAllAudio(null);
      var f = document.createElement("iframe");
      f.src = "https://www.youtube-nocookie.com/embed/" + V.youtubeId +
              "?autoplay=1&rel=0&modestbranding=1&playsinline=1";
      f.title = V.title + " — " + V.artist;
      f.allow = "accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture";
      f.setAttribute("allowfullscreen", "");
      f.loading = "lazy";
      frame.innerHTML = "";
      frame.appendChild(f);
    });
    return c;
  }

  /* ---- assembling the drawer ---- */
  var drawerBuilt = false;
  function buildDrawer() {
    var d = document.getElementById("sb-drawer");
    if (!d || drawerBuilt) return;
    if (!STICK.bouquet) buildNow();
    drawerBuilt = true;
    d.appendChild(buildBouquetCard());
    d.appendChild(buildSongCard());
    d.appendChild(buildMapCard(true));
    d.appendChild(buildVoicePill());
    d.appendChild(buildVideoCard());
  }

  function toggleDrawer(force) {
    var screen = document.getElementById("screen-scrapbook");
    var d = document.getElementById("sb-drawer");
    if (!screen || !d) return;
    buildDrawer();
    var open = force != null ? force : !screen.classList.contains("sb-drawer-on");
    screen.classList.toggle("sb-drawer-on", open);
    d.setAttribute("aria-hidden", open ? "false" : "true");
    var btn = document.getElementById("sb-extras-btn");
    if (btn) btn.classList.toggle("on", open);
    if (!open) stopAllAudio(null);
  }

  /* =======================================================================
     OVERLAYS
     ======================================================================= */
  function openNote() {
    var L = SB.letter;
    var body = document.getElementById("sb-note-body");
    if (body) {
      body.innerHTML =
        "<p>" + L.lead + "</p>" +
        "<p>" + L.body + "</p>" +
        "<p>" + L.signOff + "<br>" + L.signature + "</p>";
    }
    var m = document.getElementById("sb-note-modal");
    if (m) { m.classList.add("on"); m.setAttribute("aria-hidden", "false"); }
  }
  function closeNote() {
    var m = document.getElementById("sb-note-modal");
    if (m) { m.classList.remove("on"); m.setAttribute("aria-hidden", "true"); }
  }

  function openPin(pin, mem) {
    var photo = document.getElementById("sb-pin-photo");
    if (photo) {
      photo.innerHTML = mem && mem.src
        ? '<img src="' + mem.src + '" alt="">'
        : '<span class="sb-photo-empty"><span>photo</span></span>';
    }
    var d = document.getElementById("sb-pin-date");
    var t = document.getElementById("sb-pin-title");
    var pl = document.getElementById("sb-pin-place");
    if (d) d.textContent = pin.date;
    if (t) t.textContent = pin.title;
    if (pl) pl.textContent = pin.place;
    var m = document.getElementById("sb-pin-modal");
    if (m) { m.classList.add("on"); m.setAttribute("aria-hidden", "false"); }
  }
  function closePin() {
    var m = document.getElementById("sb-pin-modal");
    if (m) { m.classList.remove("on"); m.setAttribute("aria-hidden", "true"); }
  }

  function openLightbox(mem) {
    var box = document.getElementById("sb-lightbox");
    if (!box) return;
    var frame = box.querySelector(".sb-lb-frame");
    frame.innerHTML = mem.src
      ? '<img src="' + mem.src + '" alt="' + (mem.title || "") + '">'
      : '<div class="sb-lb-empty"><span>photo</span></div>';
    box.querySelector(".sb-lb-title").textContent = mem.title || "a photo of us";
    box.querySelector(".sb-lb-date").textContent = mem.date || "";
    box.querySelector(".sb-lb-text").textContent =
      mem.text || "This frame is waiting for a photo of the two of you.";
    box.classList.add("on");
  }
  function closeLightbox() {
    var box = document.getElementById("sb-lightbox");
    if (box) box.classList.remove("on");
  }

  /* =======================================================================
     THE OPENING — a painted candle, and butterflies around the flame

     Everything is brushed onto one canvas: a linen ground, a deep plum
     oval, a candle, and pink butterflies that circle the flame. After a
     few seconds it dissolves and hands over to the cover.
     ======================================================================= */
  var introCv = null, introCtx = null, introRaf = null, introT0 = 0, introDone = false;
  var flies = [];
  var LINEN = null;

  function linenTex() {
    if (LINEN) return LINEN;
    LINEN = tex(220, 220, function (ctx, W, Hh) {
      var r = rnd(91);
      ctx.fillStyle = "#f3e3d2"; ctx.fillRect(0, 0, W, Hh);
      /* woven threads, warp then weft */
      for (var x = 0; x < W; x += 3) {
        ctx.fillStyle = "rgba(255,255,255," + (0.05 + r() * 0.12) + ")";
        ctx.fillRect(x, 0, 1.4, Hh);
        ctx.fillStyle = "rgba(160,120,92," + (0.03 + r() * 0.07) + ")";
        ctx.fillRect(x + 1.6, 0, 1.2, Hh);
      }
      for (var y = 0; y < Hh; y += 3) {
        ctx.fillStyle = "rgba(255,255,255," + (0.03 + r() * 0.08) + ")";
        ctx.fillRect(0, y, W, 1.2);
        ctx.fillStyle = "rgba(150,112,86," + (0.02 + r() * 0.05) + ")";
        ctx.fillRect(0, y + 1.5, W, 1);
      }
      for (var s = 0; s < 900; s++) {
        ctx.fillStyle = "rgba(120,88,64,0.05)";
        ctx.fillRect(r() * W, r() * Hh, 1, 1);
      }
    });
    return LINEN;
  }

  var linenImg = null;
  function ensureLinen(cb) {
    if (linenImg) { cb(); return; }
    linenImg = new Image();
    linenImg.onload = cb;
    linenImg.onerror = cb;
    linenImg.src = linenTex();
  }

  /* The screen animates in as this starts, so a single measurement lands
     mid-transform — or, if the box has not been laid out yet, at zero,
     which paints nothing at all. Re-measure whenever the size actually
     changes instead. */
  var introW = 0, introH = 0;

  function introResize() {
    if (!introCv) return false;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = introCv.clientWidth || introCv.offsetWidth;
    var h = introCv.clientHeight || introCv.offsetHeight;
    if (!w || !h) {
      /* not laid out yet — fall back to the viewport so we always paint */
      w = window.innerWidth; h = window.innerHeight;
    }
    if (w === introW && h === introH) return false;
    introW = w; introH = h;
    introCv.width = Math.max(1, Math.round(w * dpr));
    introCv.height = Math.max(1, Math.round(h * dpr));
    introCtx = introCv.getContext("2d");
    introCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return true;
  }

  /* one butterfly, painted in loose strokes */
  function paintFly(ctx, x, y, s, flap, tilt, alpha) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(tilt);
    ctx.globalAlpha = alpha;
    var open = 0.36 + Math.abs(Math.sin(flap)) * 0.64;

    [-1, 1].forEach(function (side) {
      ctx.save();
      ctx.scale(side * open, 1);
      /* upper wing */
      var g = ctx.createLinearGradient(0, -s * 0.7, s * 1.15, s * 0.2);
      g.addColorStop(0, "rgba(233,150,186,0.95)");
      g.addColorStop(0.55, "rgba(214,120,164,0.9)");
      g.addColorStop(1, "rgba(186,96,142,0.85)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.bezierCurveTo(s * 0.30, -s * 0.95, s * 1.15, -s * 0.80, s * 1.12, -s * 0.20);
      ctx.bezierCurveTo(s * 1.08, s * 0.12, s * 0.42, s * 0.16, 0, 0);
      ctx.fill();
      /* lower wing */
      ctx.fillStyle = "rgba(224,136,176,0.82)";
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.bezierCurveTo(s * 0.32, s * 0.30, s * 0.80, s * 0.46, s * 0.72, s * 0.66);
      ctx.bezierCurveTo(s * 0.60, s * 0.84, s * 0.14, s * 0.36, 0, 0);
      ctx.fill();
      /* the veins, brushed on */
      ctx.strokeStyle = "rgba(150,70,112,0.42)";
      ctx.lineWidth = Math.max(0.6, s * 0.028);
      for (var v = 0; v < 4; v++) {
        ctx.beginPath();
        ctx.moveTo(s * 0.06, -s * 0.02);
        ctx.quadraticCurveTo(s * 0.55, -s * (0.62 - v * 0.20), s * (1.02 - v * 0.10), -s * (0.34 - v * 0.16));
        ctx.stroke();
      }
      ctx.restore();
    });

    /* body and antennae */
    ctx.fillStyle = "rgba(96,54,74,0.9)";
    ctx.beginPath();
    ctx.ellipse(0, s * 0.06, s * 0.075, s * 0.36, 0, 0, 6.29);
    ctx.fill();
    ctx.strokeStyle = "rgba(96,54,74,0.75)";
    ctx.lineWidth = Math.max(0.6, s * 0.030);
    [-1, 1].forEach(function (side) {
      ctx.beginPath();
      ctx.moveTo(0, -s * 0.28);
      ctx.quadraticCurveTo(side * s * 0.22, -s * 0.60, side * s * 0.34, -s * 0.54);
      ctx.stroke();
    });
    ctx.restore();
  }

  function introFrame(now) {
    if (introDone) return;
    introResize();
    if (!introCtx) { introRaf = requestAnimationFrame(introFrame); return; }
    if (!introT0) introT0 = now;
    var t = (now - introT0) / 1000;
    var W = introW, Hh = introH;
    var ctx = introCtx;

    /* linen ground */
    if (linenImg && linenImg.complete && linenImg.naturalWidth) {
      var pat = ctx.createPattern(linenImg, "repeat");
      ctx.fillStyle = pat;
    } else {
      ctx.fillStyle = "#f3e3d2";
    }
    ctx.fillRect(0, 0, W, Hh);

    /* the plum oval, brushed. It is a tall, narrow ellipse with linen
       showing either side of it, the way the reference painting sits. */
    var cx = W / 2, cy = Hh * 0.5;
    /* the oval keeps its own proportion rather than stretching with the
       viewport, so it reads the same on a phone as on a laptop */
    var oh = Math.min(Hh * 0.46, W * 0.62);
    var ow = oh / 1.72;
    var br = rnd(17);
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(cx, cy, ow, oh, 0, 0, 6.29);
    ctx.fillStyle = "#4d2140";
    ctx.fill();
    ctx.clip();
    /* loose strokes inside, at a slight angle and never evenly spaced,
       so the fill reads as paint rather than as banding */
    for (var b = 0; b < 90; b++) {
      var bt = br();
      var y0 = cy - oh + br() * oh * 2;
      var lean = (br() - 0.5) * oh * 0.10;
      ctx.strokeStyle = "rgba(" + Math.round(96 + bt * 52) + "," +
                        Math.round(36 + bt * 26) + "," +
                        Math.round(76 + bt * 34) + "," + (0.09 + bt * 0.13) + ")";
      ctx.lineWidth = 5 + bt * 16;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(cx - ow * 1.1, y0);
      ctx.bezierCurveTo(cx - ow * 0.4, y0 + lean, cx + ow * 0.4, y0 - lean, cx + ow * 1.1, y0);
      ctx.stroke();
    }
    /* a second pass, near-vertical, to break up the horizontal grain */
    for (var b2 = 0; b2 < 34; b2++) {
      var vt = br();
      var x0 = cx - ow + br() * ow * 2;
      ctx.strokeStyle = "rgba(" + Math.round(88 + vt * 46) + "," +
                        Math.round(32 + vt * 22) + "," +
                        Math.round(70 + vt * 30) + "," + (0.04 + vt * 0.07) + ")";
      ctx.lineWidth = 8 + vt * 26;
      ctx.beginPath();
      ctx.moveTo(x0, cy - oh * 1.1);
      ctx.bezierCurveTo(x0 + (br() - 0.5) * ow * 0.3, cy - oh * 0.3,
                        x0 + (br() - 0.5) * ow * 0.3, cy + oh * 0.3,
                        x0, cy + oh * 1.1);
      ctx.stroke();
    }

    /* a warmer pool of light where the flame sits */
    var lp = ctx.createRadialGradient(cx, cy + oh * 0.10, 2, cx, cy + oh * 0.10, oh * 0.62);
    lp.addColorStop(0, "rgba(168,86,74,0.34)");
    lp.addColorStop(1, "rgba(168,86,74,0)");
    ctx.fillStyle = lp;
    ctx.fillRect(cx - ow, cy - oh, ow * 2, oh * 2);
    ctx.restore();
    /* the painted edge: soft, and darker than the fill */
    ctx.save();
    ctx.strokeStyle = "rgba(52,18,42,0.45)";
    ctx.lineWidth = Math.max(3, ow * 0.045);
    ctx.beginPath(); ctx.ellipse(cx, cy, ow, oh, 0, 0, 6.29); ctx.stroke();
    ctx.restore();

    /* the candle — slim, and rising out of the bottom of the frame */
    var candleW = ow * 0.42, candleTop = cy + oh * 0.24;
    var cg = ctx.createLinearGradient(cx - candleW / 2, 0, cx + candleW / 2, 0);
    cg.addColorStop(0, "#cdb99b"); cg.addColorStop(0.28, "#f2e6cd");
    cg.addColorStop(0.55, "#faf1de"); cg.addColorStop(0.8, "#e6d5b8");
    cg.addColorStop(1, "#bda98c");
    ctx.fillStyle = cg;
    ctx.beginPath();
    ctx.moveTo(cx - candleW / 2, candleTop);
    ctx.quadraticCurveTo(cx, candleTop - candleW * 0.20, cx + candleW / 2, candleTop);
    ctx.lineTo(cx + candleW / 2, Hh + 20);
    ctx.lineTo(cx - candleW / 2, Hh + 20);
    ctx.closePath(); ctx.fill();
    /* brushed streaks down the wax */
    ctx.save();
    ctx.beginPath();
    ctx.rect(cx - candleW / 2, candleTop, candleW, Hh);
    ctx.clip();
    for (var k = 0; k < 16; k++) {
      var kt = br();
      ctx.strokeStyle = "rgba(" + (kt > 0.5 ? "255,250,236," : "168,146,116,") + (0.06 + kt * 0.13) + ")";
      ctx.lineWidth = 1 + kt * 3;
      var kx = cx - candleW / 2 + kt * candleW;
      ctx.beginPath();
      ctx.moveTo(kx, candleTop + candleW * 0.1);
      ctx.lineTo(kx + (br() - 0.5) * 4, Hh);
      ctx.stroke();
    }
    ctx.restore();

    /* wick */
    ctx.strokeStyle = "#2b1a20";
    ctx.lineWidth = Math.max(1.6, candleW * 0.055);
    ctx.beginPath();
    ctx.moveTo(cx, candleTop - candleW * 0.02);
    ctx.lineTo(cx + Math.sin(t * 2.1) * candleW * 0.04, candleTop - candleW * 0.30);
    ctx.stroke();

    /* the flame — tall, and drifting */
    var drift = Math.sin(t * 2.1) * candleW * 0.07;
    var fh = candleW * (1.55 + Math.sin(t * 3.3) * 0.09);
    var fw = candleW * 0.52;
    var fx = cx + drift, fy = candleTop - candleW * 0.26;
    var glow = ctx.createRadialGradient(fx, fy - fh * 0.45, 1, fx, fy - fh * 0.45, fh * 2.2);
    glow.addColorStop(0, "rgba(255,196,110,0.34)");
    glow.addColorStop(1, "rgba(255,170,90,0)");
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(fx, fy - fh * 0.45, fh * 2.2, 0, 6.29); ctx.fill();

    var fg = ctx.createLinearGradient(0, fy - fh, 0, fy);
    fg.addColorStop(0, "#fff6da"); fg.addColorStop(0.30, "#f8c96e");
    fg.addColorStop(0.68, "#e29a3c"); fg.addColorStop(1, "#b4641d");
    ctx.fillStyle = fg;
    ctx.beginPath();
    ctx.moveTo(fx, fy - fh);
    ctx.bezierCurveTo(fx + fw * 0.86, fy - fh * 0.50, fx + fw * 0.62, fy - fh * 0.04, fx, fy);
    ctx.bezierCurveTo(fx - fw * 0.62, fy - fh * 0.04, fx - fw * 0.86, fy - fh * 0.50, fx, fy - fh);
    ctx.fill();
    /* the darker heart of the flame */
    ctx.fillStyle = "rgba(122,52,18,0.42)";
    ctx.beginPath();
    ctx.moveTo(fx, fy - fh * 0.46);
    ctx.bezierCurveTo(fx + fw * 0.30, fy - fh * 0.24, fx + fw * 0.20, fy - fh * 0.02, fx, fy - fh * 0.01);
    ctx.bezierCurveTo(fx - fw * 0.20, fy - fh * 0.02, fx - fw * 0.30, fy - fh * 0.24, fx, fy - fh * 0.46);
    ctx.fill();

    /* the butterflies, circling the flame */
    flies.forEach(function (f) {
      var a = f.a0 + t * f.spd;
      var x = fx + Math.cos(a) * ow * f.rx;
      var y = fy - fh * 1.15 + Math.sin(a * f.wob) * oh * f.ry;
      var s = ow * f.s * (0.86 + Math.sin(a) * 0.14);
      paintFly(ctx, x, y, s, t * f.flap + f.ph, Math.sin(a * 0.8) * 0.5, 0.92);
    });

    /* a slow vignette so the frame feels lit by the candle */
    var vg = ctx.createRadialGradient(cx, cy, Math.min(W, Hh) * 0.22, cx, cy, Math.max(W, Hh) * 0.75);
    vg.addColorStop(0, "rgba(0,0,0,0)");
    vg.addColorStop(1, "rgba(70,40,26,0.20)");
    ctx.fillStyle = vg; ctx.fillRect(0, 0, W, Hh);

    introRaf = requestAnimationFrame(introFrame);
  }

  function startIntro() {
    introCv = document.getElementById("sb-intro-canvas");
    if (!introCv) { endIntro(true); return; }
    introDone = false;
    introT0 = 0;
    flies = [];
    for (var i = 0; i < 3; i++) {
      flies.push({
        a0: i * 2.2, spd: 0.42 + i * 0.13, rx: 0.62 + i * 0.30, ry: 0.16 + i * 0.07,
        wob: 1.5 + i * 0.45, s: 0.40 - i * 0.075, flap: 5.2 + i * 1.2, ph: i * 1.9,
      });
    }
    introResize();
    ensureLinen(function () {
      if (introRaf) cancelAnimationFrame(introRaf);
      introRaf = requestAnimationFrame(introFrame);
    });
    window.addEventListener("resize", introResize);

    /* it plays itself out, but a tap moves it along */
    clearTimeout(introTimer);
    introTimer = setTimeout(function () { endIntro(false); }, 5200);
  }

  var introTimer = null;

  function endIntro(immediate) {
    if (introDone) return;
    introDone = true;
    clearTimeout(introTimer);
    var screen = document.getElementById("screen-scrapbook");
    if (screen) screen.classList.add("sb-intro-out");
    setTimeout(function () {
      if (introRaf) { cancelAnimationFrame(introRaf); introRaf = null; }
      window.removeEventListener("resize", introResize);
      if (screen) screen.classList.add("sb-cover-on");
    }, immediate ? 0 : 900);
  }

  function stopIntro() {
    introDone = true;
    clearTimeout(introTimer);
    if (introRaf) { cancelAnimationFrame(introRaf); introRaf = null; }
    window.removeEventListener("resize", introResize);
  }

  /* =======================================================================
     THE BOOK

     On a wide screen the book shows a spread — two pages at once. On a
     phone it shows one page, and the arrows step a page at a time, so
     nothing is ever shrunk down to the point of being unreadable.
     ======================================================================= */
  var pageEls = [];

  function pagesPerView() {
    return (window.matchMedia && window.matchMedia("(min-width: 760px) and (orientation: landscape)").matches) ? 2 : 1;
  }

  function buildBook() {
    var spread = document.getElementById("sb-spread");
    if (!spread) return;
    spread.innerHTML = "";
    pageEls = PAGES.map(function (def, i) { return buildPage(def, i); });
    pageEls.push(buildBackCover());
    pageEls.forEach(function (p) { spread.appendChild(p); });
  }

  function totalPages() { return pageEls.length; }

  /* the first page of the view that `i` belongs to */
  function viewStart(i) {
    return perView === 2 ? Math.floor(i / 2) * 2 : i;
  }

  function renderView() {
    var start = viewStart(pageIndex);
    var outer = document.getElementById("sb-book-outer");
    if (outer) outer.classList.toggle("single", perView === 1);
    /* the last view can hold a single page — the back cover. Rather than
       leave a blank leaf beside it, let it take the whole spread. */
    var lonely = perView === 2 && start + 1 >= totalPages();
    pageEls.forEach(function (p, i) {
      var on = i >= start && i < start + perView;
      p.classList.toggle("on", on);
      p.classList.toggle("leftpage", on && perView === 2 && !lonely && (i - start) === 0);
      p.classList.toggle("rightpage", on && perView === 2 && (i - start) === 1);
      p.classList.toggle("solo", on && (perView === 1 || lonely));
    });
    var spine = document.querySelector("#screen-scrapbook .sb-spine");
    if (spine) spine.style.opacity = lonely ? "0" : "";
    buildDots();
    var prev = document.getElementById("sb-prev");
    var next = document.getElementById("sb-next");
    if (prev) prev.disabled = start <= 0;
    if (next) next.disabled = start + perView >= totalPages();
  }

  function buildDots() {
    var wrap = document.getElementById("sb-dots");
    if (!wrap) return;
    var views = Math.ceil(totalPages() / perView);
    var here = Math.floor(viewStart(pageIndex) / perView);
    if (wrap.childElementCount !== views) {
      wrap.innerHTML = "";
      for (var i = 0; i < views; i++) {
        var b = el("sb-dot-btn", "button");
        b.setAttribute("aria-label", "Page " + (i + 1));
        (function (idx) {
          b.addEventListener("click", function () { goTo(idx * perView); });
        })(i);
        wrap.appendChild(b);
      }
    }
    Array.prototype.forEach.call(wrap.children, function (b, i) {
      b.classList.toggle("on", i === here);
    });
  }

  /* the leaf that sweeps over as the page turns */
  function sweep(dir, then) {
    if (turning) return;
    turning = true;
    var leaf = document.getElementById("sb-turnleaf");
    if (leaf) {
      leaf.classList.remove("go-fwd", "go-back");
      void leaf.offsetWidth;
      leaf.classList.add(dir > 0 ? "go-fwd" : "go-back");
    }
    setTimeout(function () {
      then();
      setTimeout(function () {
        turning = false;
        if (leaf) leaf.classList.remove("go-fwd", "go-back");
      }, 320);
    }, 210);
  }

  function goTo(i) {
    i = Math.max(0, Math.min(totalPages() - 1, i));
    var target = viewStart(i);
    if (target === viewStart(pageIndex)) return;
    var dir = target > viewStart(pageIndex) ? 1 : -1;
    sweep(dir, function () {
      pageIndex = target;
      renderView();
    });
  }

  function next() { goTo(viewStart(pageIndex) + perView); }
  function prev() { goTo(viewStart(pageIndex) - perView); }

  /* =======================================================================
     THE COVER, AND GETTING IN
     ======================================================================= */

  /* the cover is crumpled teal, with lips and a couple of stars on it */
  function dressCover() {
    var card = document.getElementById("sb-cover-card");
    if (!card || card.dataset.dressed) return;
    card.dataset.dressed = "1";
    card.style.backgroundImage = "url(" + PAPER.teal + ")";

    [{ art: "lips", left: 72, top: 8,  w: 24, rot: 14 },
     { art: "lips", left: 66, top: 76, w: 26, rot: -8 }].forEach(function (p) {
      var e = el("sb-cover-sticker");
      e.style.left = p.left + "%"; e.style.top = p.top + "%";
      e.style.width = p.w + "%";
      e.style.setProperty("--rot", p.rot + "deg");
      var img = el("", "img"); img.src = STICK[p.art]; img.alt = "";
      e.appendChild(img);
      card.appendChild(e);
    });

    [{ left: 84, top: 4, s: 9 }, { left: 8, top: 84, s: 7 }].forEach(function (p) {
      var st = el("sb-cover-star");
      st.style.left = p.left + "%"; st.style.top = p.top + "%";
      st.style.fontSize = p.s + "px";
      st.textContent = "✦";
      card.appendChild(st);
    });
  }

  function openBook() {
    var screen = document.getElementById("screen-scrapbook");
    if (!screen) return;
    if (!built) buildNow();
    screen.classList.add("sb-open");
    pageIndex = 0;
    perView = pagesPerView();
    renderView();
  }

  function onResize() {
    var want = pagesPerView();
    if (want !== perView) {
      perView = want;
      pageIndex = viewStart(pageIndex);
      renderView();
    }
  }

  /* =======================================================================
     PUBLIC API + WIRING
     ======================================================================= */
  /* Building every paper and sticker means a few dozen canvas draws and
     as many toDataURL calls. Done in one go on the transition into the
     book that locks the main thread for seconds on a phone — the screen
     just sits there, blank, until it finishes. So the work is cut into
     jobs and spread across frames, with the opening painting first and
     the rest arriving while she watches the candle. */
  var buildQueue = null;

  function buildJobs() {
    var jobs = [];
    function job(fn) { jobs.push(fn); }

    job(function () { PAPER.teal   = crumpled("#2f6b76", "rgba(190,235,240,0.30)", "rgba(0,26,34,0.34)", 3); });
    job(function () { PAPER.teal2  = crumpled("#2a616e", "rgba(180,228,236,0.26)", "rgba(0,22,30,0.36)", 31); });
    job(function () { dressCover(); });          /* the cover only needs teal + lips */
    job(function () { PAPER.denim  = crumpled("#40607c", "rgba(198,224,244,0.28)", "rgba(0,16,34,0.36)", 11); });
    job(function () { PAPER.cream  = crumpled("#efe1c6", "rgba(255,252,242,0.62)", "rgba(150,118,74,0.24)", 7); });
    job(function () { PAPER.ivory  = crumpled("#f4ecdc", "rgba(255,255,250,0.7)",  "rgba(150,125,85,0.18)", 41); });
    job(function () { PAPER.blush  = crumpled("#eed3cc", "rgba(255,250,246,0.55)", "rgba(150,96,88,0.26)", 19); });
    job(function () { PAPER.note   = crumpled("#fbf3e0", "rgba(255,255,255,0.7)",  "rgba(150,125,85,0.18)", 23, 320, 220); });
    job(function () { PAPER.news   = newsprint(13); });
    job(function () { PAPER.grid   = gridPaper(29); });
    job(function () { PAPER.denimCloth = denimCloth(37); });

    job(function () { STICK.disco    = discoBall(140); });
    job(function () { STICK.vinyl8   = vinyl(190, { text: "8" }); });
    job(function () { STICK.vinylTeal= vinyl(230, { body: "#1d4650", label: "#e8dcc0", text: "" }); });
    job(function () { STICK.vinylLtd = vinyl(200, { body: "#20343a", label: "#f0e6cc", text: "" }); });
    job(function () { STICK.lipInk   = lipStamp(120, "#2c5866"); });
    job(function () { STICK.rose     = chromeRose(150); });
    job(function () { STICK.flowers  = pressedFlowers(200); });
    job(function () { STICK.bouquet  = bouquet(260, 380); });
    job(function () { STICK.starS    = starArt(90, "silver"); });
    job(function () { STICK.starG    = starArt(70, "gold"); });
    job(function () { STICK.starD    = starArt(100, "denim"); });
    job(function () { STICK.clock    = clockFace(200); });
    job(function () { STICK.instantCam = instantCam(320); });
    job(function () { STICK.filmCam  = filmCam(300); });

    job(function () { buildBook(); built = true; renderView(); });
    return jobs;
  }

  /* the two the cover cannot wait for */
  function buildCoverEssentials() {
    if (!STICK.lips) STICK.lips = chromeLips(110);
  }

  function scheduleBuild() {
    if (built || buildQueue) return;
    buildCoverEssentials();
    wire();
    buildQueue = buildJobs();
    stepBuild();
  }

  function stepBuild() {
    if (!buildQueue) return;
    var jobsThisFrame = 1;
    while (jobsThisFrame-- && buildQueue.length) buildQueue.shift()();
    if (!buildQueue.length) { buildQueue = null; return; }
    /* a frame to paint, then a task, so the opening keeps animating */
    requestAnimationFrame(function () { setTimeout(stepBuild, 0); });
  }

  /* if she gets to the book before the queue drains, finish it now */
  function buildNow() {
    buildCoverEssentials();
    wire();
    if (!buildQueue) buildQueue = buildJobs();
    while (buildQueue.length) buildQueue.shift()();
    buildQueue = null;
  }

  var wired = false;
  function wire() {
    if (wired) return;
    wired = true;

    var intro = document.getElementById("sb-intro");
    if (intro) intro.addEventListener("click", function () { endIntro(false); });

    var extras = document.getElementById("sb-extras-btn");
    if (extras) extras.addEventListener("click", function () { toggleDrawer(); });

    var noteDone = document.getElementById("sb-note-done");
    if (noteDone) noteDone.addEventListener("click", closeNote);
    var noteModal = document.getElementById("sb-note-modal");
    if (noteModal) noteModal.addEventListener("click", function (e) {
      if (e.target === noteModal) closeNote();
    });

    var pinClose = document.getElementById("sb-pin-close");
    if (pinClose) pinClose.addEventListener("click", closePin);
    var pinModal = document.getElementById("sb-pin-modal");
    if (pinModal) pinModal.addEventListener("click", function (e) {
      if (e.target === pinModal) closePin();
    });

    window.addEventListener("resize", onResize);

    /* swipe through the pages on a phone */
    var spread = document.getElementById("sb-spread");
    if (spread) {
      var x0 = null, y0 = null;
      spread.addEventListener("touchstart", function (e) {
        x0 = e.touches[0].clientX; y0 = e.touches[0].clientY;
      }, { passive: true });
      spread.addEventListener("touchend", function (e) {
        if (x0 == null) return;
        var dx = e.changedTouches[0].clientX - x0;
        var dy = e.changedTouches[0].clientY - y0;
        if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.4) {
          dx < 0 ? next() : prev();
        }
        x0 = y0 = null;
      }, { passive: true });
    }
  }

  function start() {
    var screen = document.getElementById("screen-scrapbook");
    if (screen) {
      screen.classList.remove("sb-open", "sb-intro-out", "sb-cover-on", "sb-drawer-on");
    }
    closeNote(); closePin(); closeLightbox();
    toggleDrawer(false);
    pageIndex = 0;
    perView = pagesPerView();
    startIntro();          /* on screen immediately */
    scheduleBuild();       /* everything else, spread across frames */
  }

  function stop() {
    stopIntro();
    stopAllAudio(null);
    /* pull the video out so it stops playing when she leaves the book */
    var frames = document.querySelectorAll("#screen-scrapbook .sb-video-frame iframe");
    Array.prototype.forEach.call(frames, function (f) {
      var host = f.parentElement;
      f.remove();
      if (host) {
        host.innerHTML =
          '<div class="sb-video-poster"><span class="sb-video-ring"></span>' +
          '<span class="sb-video-label">LOADING VIDEO</span></div>';
      }
    });
    toggleDrawer(false);
  }

  api.start = start;
  api.stop = stop;
  api.next = next;
  api.prev = prev;
  api.openBook = openBook;
  api.closeLightbox = closeLightbox;
  api.skipIntro = function () { endIntro(false); };
  return api;
})();
