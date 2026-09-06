/* =========================================================================
   SCRAPBOOK.JS — the memory book

   A real book you open and turn through: a painted candle opening, a
   crumpled teal cover, then spreads of collaged paper — polaroids,
   disco balls, vinyl, film strips, pressed flowers, an instant camera,
   a lovers-club card, a letter under a paperclip — and a back cover.

   A round button sits bottom-right. It opens a drawer down the left with
   the bouquet, the song, the memory map of Marrakech and the music
   video.

   Every texture here is drawn procedurally onto a canvas at runtime, so
   the book carries no image files of its own. The only things that come
   from outside are her photos, the song and your own video — all of
   them optional, all of them marked below.

   Public API used by script.js:
     Scrapbook.start()   build and show from the beginning
     Scrapbook.stop()    pause its animations
   ========================================================================= */
window.Scrapbook = (function () {
  "use strict";

  /* =======================================================================
     CUSTOMISE ME — everything you are likely to want to change
     ======================================================================= */
  var SB = {

    /* ---- the song that plays from the drawer -------------------------
       Drop the file in as assets/song.mp3. `startAt` is where playback
       begins, in seconds — set it to the moment of the line you want it
       to open on, and nudge it by a second or two until it lands. ---- */
    song: {
      title:  "Nous deux",
      artist: "SDM",
      src:    "assets/song.mp3",
      startAt: 0,           // ← seconds into the track to begin at
    },

    /* ---- what an empty photo frame says when she opens it ------------
       Each frame used to explain the file-naming scheme — "save this one
       as assets/photo-4.jpg" — which is a note to me, not to her. Every
       slot has its own line instead, so tapping an empty frame still
       gives her something worth having found. A MEMORIES entry with real
       text always wins over these; they are only the stand-in.

       The keys are the frame numbers actually used in the book. Anything
       not listed falls back to the list underneath. ---- */
    slotNotes: {
      1:  "Some days I still can't quite believe you said yes.",
      2:  "You laugh with your whole face. I have never got tired of it.",
      3:  "Anywhere at all, as long as it is the two of us and a bit of time.",
      4:  "I would pick you again. Every version of this, every time.",
      5:  "You make ordinary afternoons feel like something worth keeping.",
      6:  "The best thing I ever did was pay attention that day.",
      7:  "Half the story is what happened. The other half is that you were there.",
      10: "There is nobody I would rather be quiet with.",
      11: "I love the way you say my name when you are half asleep.",
      12: "You are the part of the day I look forward to.",
      13: "Whatever we were doing here, I remember being happy.",
      14: "Loving you has never once felt like work.",
      15: "I keep finding new reasons. I stopped counting a long time ago.",
      16: "You walked in and everything got warmer.",
      23: "If I could keep one thing, I think it would be this one.",
      24: "Even the waiting is good, when it is for you.",
      25: "Nothing about you has ever needed fixing.",
      29: "Home turned out to be a person.",
      30: "I would live this one again exactly as it was.",
    },
    slotNoteFallback: [
      "This one is still waiting for its photograph. The day happened anyway.",
      "Somewhere in here is a day I did not want to end.",
      "Not every good thing got photographed. I remember it regardless.",
    ],

    /* ---- the music video in the drawer, and on the last right page ---- */
    video: {
      title:     "Raindance",
      artist:    "Dave ft. Tems",
      youtubeId: "SOJpE1KMUbo",
    },

    /* ---- the video on the last page: one of the two of you.
       Save it as assets/our-video.mp4 (a poster frame at
       assets/our-video.jpg is used if it is there) ---- */
    ourVideo: {
      src:    "assets/our-video.mp4",
      /* A real frame of the two of you, lifted out of the video itself at
         24.33s and warmed to sit in the book -- not the video's first
         frame, which is a dark blur of somebody's sleeve. Written by
         tools/img/poster.py, so it can be re-cut from a different second
         without anybody having to open an editor. */
      poster: "assets/our-video.jpg",
      caption: "the long way home",
    },

    /* ---- the map. Pins are placed in % of the map card ---- */
    map: {
      city: "Marrakech",
      pins: [
        /* `note` marks a place that carries words instead of a photo */
        { x: 21, y: 31, title: "AVS", place: "Daoudiate",
          date: "where it all started",
          note: "This is where everything started. Where we first met, " +
                "and where every single thing after it began." },
        { x: 52, y: 55, date: "the first evening",  title: "Jemaa el-Fna", place: "the big square, at dusk" },
        { x: 66, y: 35, date: "the long afternoon", title: "The souks",    place: "inside the medina walls" },
        { x: 35, y: 67, date: "a whole afternoon",  title: "Megarama",     place: "the cinema, back row" },
      ],
    },

    /* ---- the note behind "tap here to view more" ---- */
    /* The letter used to describe the website: "I built this little world
       for you — photos of us, a song, and flowers. Open every piece slowly.
       I am in the intro, in the pages, in the music." It was about the
       thing rather than about her, and it read like a label on a box.

       A letter is the one place in here that should sound like a person
       who was there. So it names what is actually in the book -- the red
       room on page one, the ride home on the last page, her cold hands --
       and says the plain thing rather than the clever one. */
    letter: {
      from: "You",
      to:   "My Love",
      lead: "My love,",
      body: "I am not good at saying this out loud, so I built it instead. " +
            "Every photograph in here is one I could not stand to lose — " +
            "the red room, the long way home, your cold hands in mine on a " +
            "warm night. I would not trade a single one of those evenings. " +
            "Take your time with it. I am on every page.",
      signOff: "Yours, always —",
      signature: "Anwar",
    },

    /* ---- small bits of handwriting scattered through the book ---- */
    /* ===================================================================
       EVERY WORD IN THE BOOK, IN ONE PLACE

       These were scattered through the layout, which meant changing a line
       meant hunting for it among coordinates. They are all here now, page
       by page, with what is actually in the photographs written beside
       them -- so a line can be rewritten in ten seconds without touching
       anything else.

       They were also generic. "From now on, let's feel light for the rest
       of the summer" sat over a page of a red-lit bar at midnight, and
       "the place where the confetti falls" over the two of you at home on
       a sofa. They answer to their own photographs now.

       Anything here is yours to overwrite -- these are a starting point,
       not a decision.
       =================================================================== */
    words: {
      /* p1 · her in a headscarf, a room lit entirely red */
      p1big:    "love you",
      p1script: "you, and a room full of red light",

      /* p2 · him across a red table, the mirror selfie, that whole night */
      p2note:   "Everything in that room was red — the walls, the light, " +
                "the way you looked at me across the table. I would sit " +
                "there again tonight.",
      p2small:  "I never once looked away",

      /* p3 · green sheets, you on your phone, an afternoon indoors */
      p3script: "green sheets, no plans, all afternoon",

      /* p4 · the two of you at home, you leaning into me */
      p4script: "the quietest hour we ever spent, and my favourite one",

      /* p5 · dancing badly, the mirror, the bar with the pink lights */
      p5vinyl:  "i am a lucky girl",
      p5script: "we danced badly, and stayed anyway",

      /* p6 · the terrace with the bamboo and the lanterns, all evening */
      p6label:  "COLD HANDS,\nWARM HEARTS",
      p6note:   "I still have a lot of time to make you exactly what you want.",

      /* p7 · you under the string lights, the neon sign behind you */
      p7script: "lights strung over the whole evening, and you underneath them",

      /* p8 · one close-up of you, one of me, the same night */
      p8script: "one of you, one of me, one night",

      /* p9 · the purple room, and the faces we were pulling in it */
      p9label:  "THE FACES\nWE ONLY MAKE\nAT EACH OTHER",

      /* p10 · the ride home, and the clip of it */
      p10script: "and every one of them, again",
    },
  };

  var api = {};
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

  /* Crumpled paper.

     Facets alone read as low-poly plastic, so the sheet is built in
     layers: broad soft pools of light and shade for the body of the
     crumple, faceting at low contrast over the top, then fine creases,
     fibre grain, a stain or two, and darkening into the edges. */
  function crumpled(base, hi, lo, seed, w, h, opts) {
    opts = opts || {};
    return tex(w || 520, h || 380, function (ctx, W, H) {
      var r = rnd(seed);
      ctx.fillStyle = base; ctx.fillRect(0, 0, W, H);

      /* 1 — the soft body: big overlapping pools, no hard edges */
      for (var p = 0; p < 26; p++) {
        var px = r() * W, py = r() * H, pr = Math.max(W, H) * (0.10 + r() * 0.26);
        var g = ctx.createRadialGradient(px, py, 0, px, py, pr);
        var light = r() > 0.5;
        g.addColorStop(0, light ? hi : lo);
        g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.globalAlpha = 0.20 + r() * 0.26;
        ctx.fillStyle = g;
        ctx.fillRect(px - pr, py - pr, pr * 2, pr * 2);
      }
      ctx.globalAlpha = 1;

      /* 2 — faceting, kept quiet so it reads as structure not polygons */
      var COLS = 13, ROWS = 9, grid = [];
      for (var gy = 0; gy <= ROWS; gy++) {
        grid[gy] = [];
        for (var gx = 0; gx <= COLS; gx++) {
          grid[gy][gx] = [
            (gx / COLS) * W + (r() - 0.5) * (W / COLS) * 0.8,
            (gy / ROWS) * H + (r() - 0.5) * (H / ROWS) * 0.8,
          ];
        }
      }
      for (var cy = 0; cy < ROWS; cy++) {
        for (var cx = 0; cx < COLS; cx++) {
          var p00 = grid[cy][cx], p10 = grid[cy][cx + 1];
          var p01 = grid[cy + 1][cx], p11 = grid[cy + 1][cx + 1];
          [[p00, p10, p11], [p00, p11, p01]].forEach(function (tri) {
            ctx.fillStyle = r() > 0.5 ? hi : lo;
            ctx.globalAlpha = 0.05 + r() * 0.10;
            ctx.beginPath();
            ctx.moveTo(tri[0][0], tri[0][1]);
            ctx.lineTo(tri[1][0], tri[1][1]);
            ctx.lineTo(tri[2][0], tri[2][1]);
            ctx.closePath(); ctx.fill();
          });
        }
      }
      ctx.globalAlpha = 1;

      /* 3 — creases: long, slightly kinked lines, lit on one side */
      for (var c2 = 0; c2 < 26; c2++) {
        var x0 = r() * W, y0 = r() * H;
        var ang = r() * 6.28, len = Math.max(W, H) * (0.16 + r() * 0.4);
        var kink = (r() - 0.5) * 40;
        ctx.lineWidth = 0.8 + r() * 0.8;
        ctx.globalAlpha = 0.16 + r() * 0.16;
        ctx.strokeStyle = hi;
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.quadraticCurveTo(x0 + Math.cos(ang) * len * 0.5 + kink,
                             y0 + Math.sin(ang) * len * 0.5 - kink,
                             x0 + Math.cos(ang) * len, y0 + Math.sin(ang) * len);
        ctx.stroke();
        ctx.globalAlpha = 0.13 + r() * 0.12;
        ctx.strokeStyle = lo;
        ctx.beginPath();
        ctx.moveTo(x0 + 1.4, y0 + 1.4);
        ctx.quadraticCurveTo(x0 + Math.cos(ang) * len * 0.5 + kink + 1.4,
                             y0 + Math.sin(ang) * len * 0.5 - kink + 1.4,
                             x0 + Math.cos(ang) * len + 1.4, y0 + Math.sin(ang) * len + 1.4);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      /* 4 — an optional printed motif, under the wear */
      if (opts.print) opts.print(ctx, W, H, r);

      /* 5 — fibre */
      for (var g2 = 0; g2 < W * 4; g2++) {
        ctx.fillStyle = r() > 0.5 ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)";
        ctx.fillRect(r() * W, r() * H, 1 + r() * 2.4, 1);
      }

      /* 6 — a couple of soft stains, so no two sheets look printed */
      for (var st = 0; st < 3; st++) {
        var sx = r() * W, sy = r() * H, sr = Math.min(W, H) * (0.06 + r() * 0.14);
        var sg = ctx.createRadialGradient(sx, sy, sr * 0.2, sx, sy, sr);
        sg.addColorStop(0, "rgba(96,66,34,0.07)");
        sg.addColorStop(0.7, "rgba(96,66,34,0.035)");
        sg.addColorStop(1, "rgba(96,66,34,0)");
        ctx.fillStyle = sg;
        ctx.fillRect(sx - sr, sy - sr, sr * 2, sr * 2);
      }

      /* 7 — the sheet darkens into its edges and lifts in the middle */
      var v = ctx.createRadialGradient(W * 0.46, H * 0.42, Math.min(W, H) * 0.16,
                                       W / 2, H / 2, Math.max(W, H) * 0.76);
      v.addColorStop(0, "rgba(255,255,255,0.07)");
      v.addColorStop(0.55, "rgba(0,0,0,0)");
      v.addColorStop(1, "rgba(0,0,0,0.26)");
      ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);

      var edge = 26;
      [["top", 0, 0, W, edge, 0, 0, 0, edge],
       ["bot", 0, H - edge, W, edge, 0, H, 0, H - edge],
       ["lft", 0, 0, edge, H, 0, 0, edge, 0],
       ["rgt", W - edge, 0, edge, H, W, 0, W - edge, 0]].forEach(function (e) {
        var eg = ctx.createLinearGradient(e[5], e[6], e[7], e[8]);
        eg.addColorStop(0, "rgba(0,0,0,0.18)");
        eg.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = eg;
        ctx.fillRect(e[1], e[2], e[3], e[4]);
      });
    });
  }

  /* ---- printed motifs, passed into crumpled() ---- */

  /* a tiny scattered floral, the kind on old wrapping paper */
  function ditsyFloral(colour) {
    return function (ctx, W, H, r) {
      ctx.save();
      ctx.globalAlpha = 0.16;
      for (var i = 0; i < 90; i++) {
        var x = r() * W, y = r() * H, s = 3 + r() * 4;
        ctx.fillStyle = colour;
        for (var k = 0; k < 5; k++) {
          var a = (k / 5) * 6.28;
          ctx.beginPath();
          ctx.ellipse(x + Math.cos(a) * s * 0.7, y + Math.sin(a) * s * 0.7, s * 0.5, s * 0.34, a, 0, 6.29);
          ctx.fill();
        }
      }
      ctx.restore();
    };
  }

  /* mattress ticking — narrow stripes in pairs */
  function ticking(colour) {
    return function (ctx, W, H, r) {
      ctx.save();
      ctx.globalAlpha = 0.13;
      ctx.fillStyle = colour;
      for (var x = 0; x < W; x += 26) {
        ctx.fillRect(x, 0, 3, H);
        ctx.fillRect(x + 6, 0, 1.4, H);
      }
      ctx.restore();
    };
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
  function gridPaper(seed, base, line) {
    return tex(300, 380, function (ctx, W, H) {
      var r = rnd(seed);
      ctx.fillStyle = base || "#f6f3ea"; ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = line || "rgba(120,140,150,0.30)"; ctx.lineWidth = 1;
      for (var x = 0; x < W; x += 15) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
      for (var y = 0; y < H; y += 15) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
      for (var s = 0; s < 900; s++) {
        ctx.fillStyle = "rgba(150,140,120,0.06)";
        ctx.fillRect(r() * W, r() * H, 1, 1);
      }
    });
  }

  /* Marbled endpaper — the sheet pasted inside the boards. Combed
     bands of colour pulled through a bath, which is what makes a bound
     book look bound rather than printed. */
  function marbled(seed) {
    return tex(420, 520, function (ctx, W, H) {
      var r = rnd(seed);
      ctx.fillStyle = "#f7ece5"; ctx.fillRect(0, 0, W, H);

      var tones = ["#c98a95", "#a86c78", "#e0b3b4", "#f8f0e8", "#b87f8e", "#eed4cc"];
      /* bands laid down wet, each one pushed about by the one before */
      for (var band = 0; band < 70; band++) {
        var y0 = -30 + (band / 70) * (H + 60);
        var amp = 6 + r() * 16;
        var freq = 0.006 + r() * 0.012;
        var ph = r() * 6.28;
        var th = 3 + r() * 9;
        ctx.beginPath();
        ctx.moveTo(-10, y0);
        for (var x = -10; x <= W + 10; x += 5) {
          ctx.lineTo(x, y0 + Math.sin(x * freq + ph) * amp
                        + Math.sin(x * freq * 2.7 + ph * 1.7) * amp * 0.35);
        }
        for (var x2 = W + 10; x2 >= -10; x2 -= 5) {
          ctx.lineTo(x2, y0 + th + Math.sin(x2 * freq + ph) * amp
                             + Math.sin(x2 * freq * 2.7 + ph * 1.7) * amp * 0.35);
        }
        ctx.closePath();
        ctx.fillStyle = tones[(r() * tones.length) | 0];
        ctx.globalAlpha = 0.10 + r() * 0.15;
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      /* the comb drawn through, pulling the bands into peaks */
      for (var c = 0; c < 60; c++) {
        var cx = (c / 60) * W + (r() - 0.5) * 6;
        ctx.strokeStyle = c % 2 ? "rgba(255,248,242,0.09)" : "rgba(96,48,60,0.07)";
        ctx.lineWidth = 1.4 + r() * 2.6;
        ctx.beginPath();
        ctx.moveTo(cx, -10);
        for (var y = -10; y <= H + 10; y += 12) {
          ctx.lineTo(cx + Math.sin(y * 0.05 + c) * 9, y);
        }
        ctx.stroke();
      }

      /* veining, and the grain of the paper under it */
      for (var v = 0; v < 900; v++) {
        ctx.fillStyle = r() > 0.5 ? "rgba(255,250,246,0.05)" : "rgba(60,20,34,0.05)";
        ctx.fillRect(r() * W, r() * H, 1 + r() * 2, 1);
      }
      var g = ctx.createRadialGradient(W / 2, H * 0.45, Math.min(W, H) * 0.3,
                                       W / 2, H / 2, Math.max(W, H) * 0.7);
      g.addColorStop(0, "rgba(0,0,0,0)");
      g.addColorStop(1, "rgba(92,44,58,0.20)");
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    });
  }

  /* Bookcloth. A fine linen weave with the slub and mottling of a real
     bound cover, so the book reads as an object rather than a colour. */
  function bookCloth(seed, base, warp, weft) {
    return tex(360, 460, function (ctx, W, H) {
      var r = rnd(seed);
      ctx.fillStyle = base; ctx.fillRect(0, 0, W, H);
      /* the weave */
      for (var x = 0; x < W; x += 3) {
        ctx.fillStyle = warp;
        ctx.fillRect(x, 0, 1.5, H);
      }
      for (var y = 0; y < H; y += 3) {
        ctx.fillStyle = weft;
        ctx.fillRect(0, y, W, 1.5);
      }
      /* Slub — the odd thicker thread. Gold-cream rather than cool pink:
         every light accent in here used to lean blue, which is what made
         the cover the one surface in the whole book where blue outranked
         green while the blush, the parchment and the gold all run warm.
         Next to a cream page it read as dusty and slightly grey. */
      for (var i = 0; i < 260; i++) {
        ctx.fillStyle = r() > 0.5 ? "rgba(255,235,205,0.11)" : "rgba(52,16,28,0.12)";
        if (r() > 0.5) ctx.fillRect(r() * W, r() * H, 1.6, 6 + r() * 26);
        else ctx.fillRect(r() * W, r() * H, 6 + r() * 26, 1.6);
      }
      /* mottling, so the dye is not perfectly even */
      for (var m = 0; m < 22; m++) {
        var mx = r() * W, my = r() * H, mr = 40 + r() * 130;
        var g = ctx.createRadialGradient(mx, my, 0, mx, my, mr);
        g.addColorStop(0, r() > 0.5 ? "rgba(255,228,190,0.08)" : "rgba(58,18,32,0.09)");
        g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = g; ctx.fillRect(mx - mr, my - mr, mr * 2, mr * 2);
      }
      /* worn a little at the edges, the way a used cover is */
      var v = ctx.createRadialGradient(W / 2, H * 0.45, Math.min(W, H) * 0.22,
                                       W / 2, H / 2, Math.max(W, H) * 0.72);
      v.addColorStop(0, "rgba(255,240,214,0.06)");
      v.addColorStop(0.6, "rgba(0,0,0,0)");
      v.addColorStop(1, "rgba(40,10,22,0.30)");
      ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
    });
  }

  /* Denim: woven twill with a faint diagonal. */
  function denimCloth(seed, base, hi, lo) {
    return tex(260, 320, function (ctx, W, H) {
      var r = rnd(seed);
      ctx.fillStyle = base || "#8a6079"; ctx.fillRect(0, 0, W, H);
      for (var i = 0; i < 5200; i++) {
        var v = r();
        ctx.fillStyle = v > 0.55 ? (hi || "rgba(252,232,244,0.16)") : (lo || "rgba(40,12,30,0.18)");
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
     THE COLOUR OF THE PAPER ITSELF

     The first attempt at matching the pages to their photographs laid a
     pale wash over a fixed sheet, and he was right about what that did:
     "the new colors you done in the book are not vivid, which steals a bit
     from the vibe the old book had." A translucent veil over a texture can
     only ever mute it -- it lowers contrast and drains saturation, and the
     old rose paper (#b9707f, a proper 34% saturated rose) had neither
     problem.

     So the paper is not washed any more, it is DYED: each page's sheet is
     drawn from scratch in its own hue, at the full richness the original
     papers had. The crumple, the pooling and the faceting all happen in
     that colour, so the depth survives.

     Each page keeps the WEIGHT of the paper it had -- a dark rose page
     stays dark, an ivory page stays pale -- because that alternation is
     the book's rhythm and losing it would flatten the whole thing. Only
     the hue and the richness come from the photographs.
     ======================================================================= */
  function hsl(h, s, l, a) {
    return a == null || a >= 1
      ? "hsl(" + h + "," + s + "%," + l + "%)"
      : "hsla(" + h + "," + s + "%," + l + "%," + a + ")";
  }

  /* WHICH COLOUR A PHOTOGRAPH IS ALLOWED TO MAKE THE PAPER.

     Taking the photographs' hue literally turns the warm pages to
     terracotta, because these photos are lamplight and lamplight is amber
     -- 11 to 26 degrees. That is not this book. Look at what the original
     papers actually were: the rich sheets are rose and mauve (347, 342,
     313) and the pale ones are warm cream (39). The dark-rose-then-cream
     alternation IS the book; losing it for a row of brown pages is exactly
     the "steals the vibe" he was pointing at.

     So a photograph does not choose the colour, it chooses where in the
     book's own range that page sits. Warm photographs push a rich page
     toward the coral end of the rose band and a pale page toward honey;
     the violet ones push a rich page to mauve and a pale page to a soft
     lavender. Nothing lands outside the two families the book is made of,
     and no two pages come out identical because the hue still moves with
     the photos on them. */
  function bandedHue(photoHue, heavy) {
    /* the photos are cleanly of two kinds -- amber, or club violet */
    var violet = (photoHue > 240 && photoHue < 340);
    if (violet) {
      /* No purple. It was 288, a blue-violet; then orchid at 304-316, which
         was closer but still the odd pair at the end of a rose book -- and
         he was right both times.

         The mistake was treating "the photographs are violet" as if it
         settled what colour the paper has to be. It does not. Those two
         pages are club light, magenta and violet, and the thing that
         actually flatters club light is warm pink: the photographs stand
         off it instead of sinking into something the same temperature as
         they are. Rendered side by side against blush, sand, wine and
         mauve, blush was not a compromise -- it was the best of the five to
         look at.

         So they come home into the book's own rose band, and the book ends
         where it opened. The two still take slightly different places in
         it so the ending is not a flat repeat. */
      var v = Math.max(0, Math.min(1, (photoHue - 270) / 15));
      return heavy ? (344 + v * 6) : (348 + v * 6);
    }
    /* 6deg is the reddest of them, 30 the most golden */
    var warmth = Math.max(0, Math.min(1, (photoHue - 6) / 24));
    return heavy ? (358 - warmth * 20)      /* coral rose -> deeper rose */
                 : (38 - warmth * 11);      /* warm sand  -> honey      */
  }
  var HEAVY = { rose: 1, rose2: 1, mauve: 1 };

  /* base saturation and lightness, then the highlight and shadow that get
     pooled and faceted over it. Every one of them carries the page's hue,
     so nothing greys out. */
  var PAPER_RECIPE = {
    rose:   { s: 46, l: 57, hi: [34, 94, .34], lo: [58, 17, .36] },
    rose2:  { s: 44, l: 52, hi: [30, 92, .30], lo: [56, 15, .38] },
    mauve:  { s: 38, l: 50, hi: [28, 91, .28], lo: [52, 13, .38] },
    /* The pale sheets used to sit at 85-92% lightness -- practically white
       -- with rose pages at 57% on either side of them. That is a jump of
       thirty points of value every time the book crosses from one to the
       other, and it is most of what he meant by "it feels weird passing
       from color to color". They are warm sand and blush now rather than
       paper white: still clearly the light half of the book's rhythm, but
       close enough in tone that turning onto one is a change of key rather
       than a light being switched on. */
    cream:  { s: 50, l: 81, hi: [40, 98, .55], lo: [44, 40, .28] },
    ivory:  { s: 52, l: 84, hi: [40, 98, .58], lo: [42, 42, .24] },
    blush:  { s: 56, l: 82, hi: [42, 98, .50], lo: [46, 38, .28] },
    grid:   { s: 46, l: 87, hi: [32, 98, .46], lo: [40, 45, .22] },
  };

  /* the patch — the coloured rectangle laid on the page — sits a couple of
     steps darker and a little more saturated than its page, which is what
     makes it read as a second sheet rather than a stain */
  function patchColours(photoHue, s, heavyPage) {
    /* A patch is the rich sheet laid on the page, so it takes the heavy
       band whatever the page is -- but not at the same strength on both.

       On a rich page it can be nearly as strong as the page, because there
       is already colour all around it. On a PALE page it is the only
       saturated thing in sight, and at full strength it reads as neon: the
       violet page came out hot magenta against its lavender grid, shouting
       over the very photographs it was there to frame. So a patch on a
       pale page is a mid-tone, sat well back.

       And violet is pulled down further again. It is a much louder colour
       than rose at the same numbers -- the same 55% lightness that gives a
       soft dusty rose gives a fluorescent pink at 316 degrees. */
    var h = Math.round(bandedHue(photoHue, 1));
    var violet = h > 240 && h < 340;
    var sat = Math.min(56, Math.round(s * 0.9) + 12);
    var lig = 55;
    if (!heavyPage) { sat = Math.round(sat * 0.62); lig = 62; }
    if (violet)     { sat = Math.round(sat * 0.72); lig -= 4; }
    return {
      h: h,
      base: hsl(h, sat, lig),
      hi:   hsl(h, 40, 93, 0.18),
      lo:   hsl(h, 54, 16, 0.22),
    };
  }

  var PAGE_PAPER = [];      /* one dyed sheet per page */
  var PAGE_PATCH = [];      /* and one cloth to match it */

  function buildPagePapers(job) {
    PAGES.forEach(function (def, i) {
      job(function () {
        var t = PAGE_TINT[i + 1] || [26, 30];
        var kind = def.paper;
        var R = PAPER_RECIPE[kind];
        if (!R) { PAGE_PAPER[i] = PAPER[kind]; return; }
        var h = Math.round(bandedHue(t[0], HEAVY[kind])), sat = t[1];
        /* Some pages come out louder than their neighbours even at the same
           numbers: page 8 is the mauve recipe, which sits at 50% lightness,
           and a mid-tone reads far more saturated than the 57% roses either
           side of it. `tone` on the page def trims that back by hand where
           the arithmetic is right but the eye disagrees. */
        if (def.tone) sat = sat * def.tone;
        /* the photographs say how saturated, the recipe says how far it is
           allowed to go -- a page never gets louder than its weight allows */
        var s = Math.round(R.s * (0.55 + Math.min(1, sat / 40) * 0.55));
        var base = hsl(h, s, R.l);
        var hi = hsl(h, R.hi[0], R.hi[1], R.hi[2]);
        var lo = hsl(h, R.lo[0], R.lo[1], R.lo[2]);
        var seed = 17 + i * 13;
        if (kind === "grid") {
          PAGE_PAPER[i] = gridPaper(seed, base, hsl(h, 30, 52, 0.26));
        } else {
          var opts = {};
          if (kind === "cream") opts.print = ticking(hsl(h, 34, 44));
          if (kind === "blush") opts.print = ditsyFloral(hsl(h, 44, 58));
          PAGE_PAPER[i] = crumpled(base, hi, lo, seed, 0, 0, opts);
        }
      });
      job(function () {
        var t = PAGE_TINT[i + 1] || [26, 30];
        var c = patchColours(t[0], t[1] * (def.tone || 1), HEAVY[def.paper]);
        PAGE_PATCH[i] = denimCloth(101 + i * 7, c.base, c.hi, c.lo);
      });
    });
  }


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
          /* Warm, not chrome. Every tile used to be rgb(v, v+6, v+16) --
             sixteen points more blue than red -- and two of these hang on
             a rose page as the coldest thing in the book. The same mirror
             lit by the same warm room: red leads, blue trails. */
          ctx.fillStyle = "rgb(" + Math.min(255, (v + 14) | 0) + "," + Math.min(255, (v + 2) | 0) + "," + Math.max(0, (v - 12) | 0) + ")";
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

  /* Chrome lips. Upper and lower are drawn as separate shapes so the
     cupid's bow and the parting are real geometry rather than a line
     scratched across a blob. */
  function chromeLips(w) {
    var h = w * 0.54;
    return tex(w, h, function (ctx, W, Hh) {
      var mid = Hh * 0.42;

      function upper() {
        /* two lobes meeting in a sharp cupid's bow */
        ctx.beginPath();
        ctx.moveTo(W * 0.02, mid);
        ctx.bezierCurveTo(W * 0.08, Hh * 0.18, W * 0.19, Hh * 0.00, W * 0.29, Hh * 0.03);
        ctx.bezierCurveTo(W * 0.38, Hh * 0.06, W * 0.44, Hh * 0.26, W * 0.50, Hh * 0.26);
        ctx.bezierCurveTo(W * 0.56, Hh * 0.26, W * 0.62, Hh * 0.06, W * 0.71, Hh * 0.03);
        ctx.bezierCurveTo(W * 0.81, Hh * 0.00, W * 0.92, Hh * 0.18, W * 0.98, mid);
        ctx.bezierCurveTo(W * 0.74, Hh * 0.36, W * 0.26, Hh * 0.36, W * 0.02, mid);
        ctx.closePath();
      }
      function lower() {
        ctx.beginPath();
        ctx.moveTo(W * 0.02, mid);
        ctx.bezierCurveTo(W * 0.26, Hh * 0.56, W * 0.74, Hh * 0.56, W * 0.98, mid);
        ctx.bezierCurveTo(W * 0.93, Hh * 0.84, W * 0.71, Hh * 1.00, W * 0.50, Hh * 1.00);
        ctx.bezierCurveTo(W * 0.29, Hh * 1.00, W * 0.07, Hh * 0.84, W * 0.02, mid);
        ctx.closePath();
      }

      /* upper lip sits in shadow, lower lip catches the light */
      var gu = ctx.createLinearGradient(0, 0, W * 0.4, Hh * 0.5);
      gu.addColorStop(0, "#fbe0d4"); gu.addColorStop(0.30, "#e0ab98");
      gu.addColorStop(0.60, "#a86a5c"); gu.addColorStop(1, "#eebfa9");
      ctx.fillStyle = gu; upper(); ctx.fill();

      var gl = ctx.createLinearGradient(W * 0.2, Hh * 0.45, W * 0.75, Hh);
      gl.addColorStop(0, "#fffaf6"); gl.addColorStop(0.24, "#f6d6c4");
      gl.addColorStop(0.56, "#c98d78"); gl.addColorStop(0.80, "#eec1ab");
      gl.addColorStop(1, "#fff2e9");
      ctx.fillStyle = gl; lower(); ctx.fill();

      /* the specular streaks that make it read as metal */
      ctx.save();
      lower(); ctx.clip();
      ctx.fillStyle = "rgba(255,255,255,0.80)";
      ctx.beginPath();
      ctx.ellipse(W * 0.32, Hh * 0.68, W * 0.19, Hh * 0.055, -0.14, 0, 6.29);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.40)";
      ctx.beginPath();
      ctx.ellipse(W * 0.68, Hh * 0.64, W * 0.11, Hh * 0.035, 0.14, 0, 6.29);
      ctx.fill();
      ctx.fillStyle = "rgba(20,32,44,0.30)";
      ctx.beginPath();
      ctx.ellipse(W * 0.50, Hh * 0.98, W * 0.34, Hh * 0.10, 0, 0, 6.29);
      ctx.fill();
      ctx.restore();

      ctx.save();
      upper(); ctx.clip();
      ctx.fillStyle = "rgba(255,255,255,0.52)";
      ctx.beginPath();
      ctx.ellipse(W * 0.27, Hh * 0.13, W * 0.13, Hh * 0.035, -0.16, 0, 6.29);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.32)";
      ctx.beginPath();
      ctx.ellipse(W * 0.73, Hh * 0.13, W * 0.10, Hh * 0.028, 0.16, 0, 6.29);
      ctx.fill();
      ctx.restore();

      /* the parting, dark and thin */
      ctx.strokeStyle = "rgba(58,24,22,0.85)";
      ctx.lineWidth = Math.max(1.2, Hh * 0.032);
      ctx.beginPath();
      ctx.moveTo(W * 0.03, mid);
      ctx.bezierCurveTo(W * 0.26, Hh * 0.41, W * 0.74, Hh * 0.41, W * 0.97, mid);
      ctx.stroke();

      ctx.strokeStyle = "rgba(70,32,28,0.42)";
      ctx.lineWidth = Math.max(0.8, W * 0.008);
      upper(); ctx.stroke();
      lower(); ctx.stroke();
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
          function ch(v) { return Math.max(20, Math.min(238, Math.round(v))); }
          var base = 74 + ring * 13;
          /* Warm pearl. Same fault as the disco ball and the pale star:
             the petals ran cooler as they got lighter, so the highlight
             was the bluest part of the flower and it sat on the page like
             something borrowed from another book. */
          g.addColorStop(0,    "rgb(" + ch(base + 116) + "," + ch(base + 100) + "," + ch(base + 88) + ")");
          g.addColorStop(0.42, "rgb(" + ch(base + 30)  + "," + ch(base + 16)  + "," + ch(base + 8)  + ")");
          g.addColorStop(1,    "rgb(" + ch(base - 24) + "," + ch(base - 44) + "," + ch(base - 58) + ")");
          ctx.fillStyle = g;
          ctx.save();
          ctx.translate(px, py);
          ctx.rotate(a2 + 1.2);
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.bezierCurveTo(rr * 0.62, -rr * 0.44, rr * 0.86, rr * 0.26, 0, rr * 0.62);
          ctx.bezierCurveTo(-rr * 0.50, rr * 0.30, -rr * 0.40, -rr * 0.26, 0, 0);
          ctx.fill();
          ctx.strokeStyle = "rgba(18,28,40,0.5)";
          ctx.lineWidth = W * 0.010;
          ctx.stroke();
          ctx.restore();
        }
      }
      /* the bud at the centre */
      var bg = ctx.createRadialGradient(cx - W * 0.03, cy - W * 0.035, 1, cx, cy, W * 0.10);
      /* the bead at the centre: warm pearl, not a blue one */
      bg.addColorStop(0, "#fffdfa"); bg.addColorStop(0.55, "#e0c3b6"); bg.addColorStop(1, "#8a6357");
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

      /* A bloom, built in three rings. Each petal is shaded along its
         own length, which is what stops the head reading as a flat
         rosette of ellipses. */
      function petal(x, y, rr, ang, pal, depth) {
        var ex = x + Math.cos(ang) * rr * depth;
        var ey = y + Math.sin(ang) * rr * depth;
        var g = ctx.createLinearGradient(x, y, ex + Math.cos(ang) * rr * 0.5,
                                                ey + Math.sin(ang) * rr * 0.5);
        g.addColorStop(0, pal[1]);
        g.addColorStop(0.55, pal[0]);
        g.addColorStop(1, pal[2]);
        ctx.fillStyle = g;
        ctx.save();
        ctx.translate(ex, ey);
        ctx.rotate(ang);
        ctx.beginPath();
        ctx.moveTo(-rr * 0.42, 0);
        ctx.bezierCurveTo(-rr * 0.20, -rr * 0.40, rr * 0.34, -rr * 0.34, rr * 0.52, 0);
        ctx.bezierCurveTo(rr * 0.34, rr * 0.34, -rr * 0.20, rr * 0.40, -rr * 0.42, 0);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = "rgba(150,80,104,0.14)";
        ctx.lineWidth = rr * 0.03;
        ctx.stroke();
        ctx.restore();
      }
      function bloom(x, y, rr, pal, petals) {
        var spin = r() * 6.28;
        var dark = [pal[2], pal[2], pal[2]];
        for (var k = 0; k < petals; k++)
          petal(x, y, rr * 1.02, spin + (k / petals) * 6.28, dark, 0.80);
        for (var k2 = 0; k2 < petals; k2++)
          petal(x, y, rr * 0.92, spin + 0.34 + (k2 / petals) * 6.28, pal, 0.60);
        for (var k3 = 0; k3 < Math.max(4, petals - 2); k3++)
          petal(x, y, rr * 0.62, spin + 0.7 + (k3 / (petals - 2)) * 6.28, pal, 0.34);
        var cg2 = ctx.createRadialGradient(x - rr * 0.06, y - rr * 0.06, 1, x, y, rr * 0.3);
        cg2.addColorStop(0, "rgba(255,244,214,0.95)");
        cg2.addColorStop(1, pal[1]);
        ctx.fillStyle = cg2;
        ctx.beginPath(); ctx.arc(x, y, rr * 0.22, 0, 6.29); ctx.fill();
      }
      /* gypsophila — the tiny white filler between the big heads */
      function gyp(x, y, rr) {
        for (var k = 0; k < 26; k++) {
          var a = r() * 6.28, d = r() * rr;
          ctx.fillStyle = "rgba(255,252,246," + (0.5 + r() * 0.45).toFixed(2) + ")";
          ctx.beginPath();
          ctx.arc(x + Math.cos(a) * d, y + Math.sin(a) * d * 0.8, rr * 0.10, 0, 6.29);
          ctx.fill();
        }
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
      gyp(cx - W * 0.30, coneTop - Hh * 0.11, W * 0.10);
      gyp(cx + W * 0.31, coneTop - Hh * 0.16, W * 0.09);
      gyp(cx - W * 0.12, coneTop - Hh * 0.36, W * 0.08);
      gyp(cx + W * 0.12, coneTop - Hh * 0.38, W * 0.075);

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

      /* the mouth of the cone, in shadow */
      ctx.fillStyle = "rgba(92,66,36,0.34)";
      ctx.beginPath();
      ctx.ellipse(cx, coneTop, halfTop, Hh * 0.026, 0, 0, 6.29);
      ctx.fill();

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
      } else if (kind === "rose") {
        g.addColorStop(0, "#c98fa0"); g.addColorStop(0.5, "#8d4a5e"); g.addColorStop(1, "#b87e90");
      } else {
        /* The pale star. It was silver -- #c2d0da into #7b8b98, a blue
           steel -- and it turns up on five pages of a book whose every
           other colour is rose, cream or gold. It is a pearl now: the
           same job, the light one of the three stars, in the book's own
           warmth. */
        g.addColorStop(0, "#fffaf3"); g.addColorStop(0.4, "#f0dacf");
        g.addColorStop(0.7, "#c0968e"); g.addColorStop(1, "#fdf0e6");
      }
      ctx.fillStyle = g; ctx.fill();
      if (kind === "rose") {
        ctx.save(); ctx.clip();
        for (var d = 0; d < 900; d++) {
          ctx.fillStyle = Math.random() > 0.5 ? "rgba(252,232,240,0.2)" : "rgba(44,12,26,0.2)";
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
      g.addColorStop(0, "#f6e3e4"); g.addColorStop(0.45, "#e8c8ca");
      g.addColorStop(1, "#c79ba1");
      ctx.fillStyle = g;
      round(W * 0.03, H * 0.05, W * 0.94, H * 0.9, W * 0.09); ctx.fill();
      ctx.strokeStyle = "rgba(110,62,72,0.4)"; ctx.lineWidth = 2; ctx.stroke();

      /* the photo window — left empty, a slot sits over it. It showed the
         picture at 44% of the camera's width, which is what made the one
         photograph on that page too small to look at. */
      ctx.fillStyle = "#32262a";
      round(W * 0.08, H * 0.15, W * 0.54, H * 0.64, W * 0.03); ctx.fill();

      /* lens */
      ctx.fillStyle = "#a9767f";
      ctx.beginPath(); ctx.arc(W * 0.33, H * 0.115, W * 0.045, 0, 6.29); ctx.fill();
      ctx.fillStyle = "#1d282b";
      ctx.beginPath(); ctx.arc(W * 0.33, H * 0.115, W * 0.026, 0, 6.29); ctx.fill();

      /* the ribbed strip along the top right */
      ctx.fillStyle = "#fbeeee";
      round(W * 0.60, H * 0.09, W * 0.32, H * 0.07, W * 0.014); ctx.fill();
      ctx.strokeStyle = "rgba(120,70,80,0.45)"; ctx.lineWidth = 1.4;
      for (var i = 1; i < 4; i++) {
        ctx.beginPath();
        ctx.moveTo(W * (0.60 + i * 0.08), H * 0.09);
        ctx.lineTo(W * (0.60 + i * 0.08), H * 0.16);
        ctx.stroke();
      }

      /* the round pad on the right */
      ctx.fillStyle = "#dfb4ba";
      ctx.beginPath(); ctx.arc(W * 0.755, H * 0.50, W * 0.135, 0, 6.29); ctx.fill();
      ctx.strokeStyle = "rgba(100,56,66,0.35)"; ctx.stroke();
      ctx.fillStyle = "#fbf0f0";
      ctx.beginPath(); ctx.arc(W * 0.755, H * 0.50, W * 0.058, 0, 6.29); ctx.fill();
      ctx.fillStyle = "#bd8b94";
      [[0, -0.095], [0, 0.095], [-0.095, 0], [0.095, 0]].forEach(function (d) {
        ctx.beginPath();
        ctx.arc(W * (0.755 + d[0]), H * (0.50 + d[1] * (W / H)), W * 0.017, 0, 6.29);
        ctx.fill();
      });

      /* small buttons */
      ctx.fillStyle = "#f4e2e3";
      round(W * 0.63, H * 0.235, W * 0.10, H * 0.075, W * 0.02); ctx.fill();
      round(W * 0.79, H * 0.235, W * 0.10, H * 0.075, W * 0.02); ctx.fill();
      round(W * 0.63, H * 0.755, W * 0.11, H * 0.08, W * 0.02); ctx.fill();
      round(W * 0.79, H * 0.755, W * 0.11, H * 0.08, W * 0.02); ctx.fill();

      /* speaker dots */
      ctx.fillStyle = "rgba(120,70,80,0.5)";
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
      /* The biggest cool object in the book, and it took most of a page.
         Blue-grey #dfe7ea/#a9b8bf/#78888f becomes a warm pewter-rose --
         still obviously a metal camera body, no longer the one thing on
         the spread that belongs to a different palette. */
      g.addColorStop(0, "#efe0d6"); g.addColorStop(0.5, "#bfa093"); g.addColorStop(1, "#8e6d63");
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
      ctx.fillStyle = "#6d5a55";
      ctx.beginPath(); ctx.arc(W * 0.5, H * 0.60, W * 0.20, 0, 6.29); ctx.fill();
      ctx.fillStyle = "#33262a";
      ctx.beginPath(); ctx.arc(W * 0.5, H * 0.60, W * 0.14, 0, 6.29); ctx.fill();
      var lg = ctx.createRadialGradient(W * 0.45, H * 0.53, 1, W * 0.5, H * 0.60, W * 0.14);
      lg.addColorStop(0, "rgba(180,230,240,0.55)"); lg.addColorStop(1, "rgba(20,40,50,0)");
      ctx.fillStyle = lg;
      ctx.beginPath(); ctx.arc(W * 0.5, H * 0.60, W * 0.14, 0, 6.29); ctx.fill();

      /* shutter + dial */
      ctx.fillStyle = "#a08d84";
      ctx.beginPath(); ctx.arc(W * 0.17, H * 0.24, W * 0.045, 0, 6.29); ctx.fill();
      ctx.fillStyle = "#dccbc2";
      ctx.fillRect(W * 0.74, H * 0.18, W * 0.14, H * 0.10);

      ctx.fillStyle = "rgba(30,42,48,0.8)";
      ctx.font = "600 " + (W * 0.058) + "px Georgia, serif";
      ctx.textAlign = "left";
      ctx.fillText("Canon", W * 0.09, H * 0.47);
    });
  }

  /* ---------------------------------------------------------------
     THE MAP — Marrakech itself, not the country it sits in.

     Drawn as a city map: the walled medina with its tangle of lanes,
     the grid of Guéliz beside it, the gardens in green, the palm grove
     to the north-east, and the main avenues running between them. All
     vector, so it belongs to the book rather than to a tile server.
     --------------------------------------------------------------- */
  function marrakechMap(w, h) {
    return tex(w, h, function (ctx, W, H) {
      var r = rnd(404);
      function P(x, y) { return [x * W, y * H]; }
      function poly(pts, fill, stroke, lw) {
        ctx.beginPath();
        pts.forEach(function (p, i) {
          var q = P(p[0], p[1]);
          i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]);
        });
        ctx.closePath();
        if (fill) { ctx.fillStyle = fill; ctx.fill(); }
        if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 1; ctx.stroke(); }
      }

      /* the ground */
      ctx.fillStyle = "#f0e7d6"; ctx.fillRect(0, 0, W, H);
      for (var n = 0; n < 2600; n++) {
        ctx.fillStyle = "rgba(196,176,144,0.10)";
        ctx.fillRect(r() * W, r() * H, 1, 1);
      }

      /* the palm grove, north-east */
      poly([[0.62,0.02],[0.99,0.03],[1.0,0.30],[0.74,0.30],[0.62,0.16]], "#dfe6cd");
      for (var pg = 0; pg < 150; pg++) {
        var px = 0.63 + r() * 0.36, py = 0.03 + r() * 0.25;
        if (px < 0.72 && py > 0.20) continue;
        ctx.fillStyle = "rgba(122,150,92,0.5)";
        ctx.beginPath();
        ctx.arc(px * W, py * H, W * 0.005, 0, 6.29);
        ctx.fill();
      }

      /* the gardens */
      poly([[0.06,0.66],[0.30,0.62],[0.34,0.86],[0.10,0.92]], "#cfdcbb");   /* Menara */
      poly([[0.52,0.86],[0.80,0.82],[0.84,0.99],[0.56,1.0]], "#cfdcbb");    /* Agdal */
      poly([[0.30,0.10],[0.42,0.08],[0.44,0.20],[0.32,0.22]], "#cfdcbb");   /* Majorelle */

      /* the Menara basin */
      poly([[0.13,0.72],[0.24,0.70],[0.25,0.79],[0.14,0.81]], "#b9cfd6");

      /* the medina — a walled, denser quarter */
      var medina = [[0.44,0.24],[0.62,0.21],[0.76,0.32],[0.80,0.52],[0.70,0.70],
                    [0.52,0.74],[0.40,0.64],[0.37,0.42]];
      poly(medina, "#e8d7bb");

      /* its lanes: short, tangled segments, clipped to the walls */
      ctx.save();
      ctx.beginPath();
      medina.forEach(function (p, i) {
        var q = P(p[0], p[1]);
        i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]);
      });
      ctx.closePath(); ctx.clip();
      ctx.strokeStyle = "rgba(250,244,232,0.9)";
      for (var ln = 0; ln < 320; ln++) {
        var x0 = (0.36 + r() * 0.46) * W, y0 = (0.20 + r() * 0.56) * H;
        var ang = r() * 6.28, len = W * (0.012 + r() * 0.045);
        ctx.lineWidth = 0.8 + r() * 1.4;
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x0 + Math.cos(ang) * len, y0 + Math.sin(ang) * len);
        ctx.stroke();
      }
      /* a few blocks of shadow so it reads as built-up */
      for (var bl = 0; bl < 90; bl++) {
        ctx.fillStyle = "rgba(176,146,104,0.16)";
        ctx.fillRect((0.36 + r() * 0.44) * W, (0.20 + r() * 0.54) * H,
                     W * (0.008 + r() * 0.022), H * (0.008 + r() * 0.022));
      }
      ctx.restore();
      poly(medina, null, "rgba(158,110,66,0.75)", Math.max(1.6, W * 0.004));

      /* Guéliz — the new town, on a grid */
      ctx.save();
      poly([[0.10,0.26],[0.36,0.22],[0.38,0.50],[0.12,0.54]], "#eee3ce");
      ctx.beginPath();
      [[0.10,0.26],[0.36,0.22],[0.38,0.50],[0.12,0.54]].forEach(function (p, i) {
        var q = P(p[0], p[1]);
        i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]);
      });
      ctx.closePath(); ctx.clip();
      ctx.strokeStyle = "rgba(252,247,238,0.95)";
      ctx.lineWidth = Math.max(1.2, W * 0.0032);
      for (var gx = 0.10; gx < 0.40; gx += 0.045) {
        ctx.beginPath();
        ctx.moveTo(gx * W, 0.20 * H);
        ctx.lineTo((gx + 0.02) * W, 0.56 * H);
        ctx.stroke();
      }
      for (var gy = 0.23; gy < 0.55; gy += 0.05) {
        ctx.beginPath();
        ctx.moveTo(0.09 * W, gy * H);
        ctx.lineTo(0.39 * W, (gy - 0.03) * H);
        ctx.stroke();
      }
      ctx.restore();

      /* the main avenues, with a casing under them */
      var roads = [
        [[0.00,0.44],[0.20,0.40],[0.40,0.44],[0.56,0.48],[0.74,0.44],[1.00,0.38]],
        [[0.24,0.00],[0.28,0.20],[0.34,0.44],[0.40,0.72],[0.44,1.00]],
        [[0.62,0.02],[0.60,0.24],[0.64,0.52],[0.70,0.78],[0.72,1.00]],
        [[0.02,0.72],[0.26,0.66],[0.50,0.70],[0.78,0.62],[1.00,0.58]],
      ];
      [["rgba(196,168,124,0.85)", W * 0.011], ["rgba(253,248,238,0.96)", W * 0.0065]]
        .forEach(function (pass) {
          ctx.strokeStyle = pass[0];
          ctx.lineWidth = pass[1];
          ctx.lineJoin = "round"; ctx.lineCap = "round";
          roads.forEach(function (rd) {
            ctx.beginPath();
            rd.forEach(function (p, i) {
              var q = P(p[0], p[1]);
              i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]);
            });
            ctx.stroke();
          });
        });

      /* the Koutoubia, marked the way a landmark is */
      var k = P(0.47, 0.52);
      ctx.fillStyle = "rgba(150,104,58,0.9)";
      ctx.fillRect(k[0] - W * 0.006, k[1] - H * 0.030, W * 0.012, H * 0.030);
      ctx.beginPath();
      ctx.moveTo(k[0] - W * 0.008, k[1] - H * 0.030);
      ctx.lineTo(k[0], k[1] - H * 0.048);
      ctx.lineTo(k[0] + W * 0.008, k[1] - H * 0.030);
      ctx.closePath(); ctx.fill();

      /* names */
      ctx.textAlign = "center";
      function label(t, x, y, size, colour, spacing) {
        ctx.fillStyle = colour;
        ctx.font = "600 " + Math.round(W * size) + "px 'Poppins', system-ui, sans-serif";
        if (spacing && ctx.letterSpacing !== undefined) ctx.letterSpacing = spacing;
        ctx.fillText(t, x * W, y * H);
        if (ctx.letterSpacing !== undefined) ctx.letterSpacing = "0px";
      }
      label("MARRAKECH", 0.5, 0.115, 0.042, "rgba(88,68,44,0.9)", "3px");
      label("مراكش", 0.5, 0.165, 0.034, "rgba(122,98,70,0.8)");
      label("MEDINA", 0.60, 0.62, 0.030, "rgba(140,96,52,0.85)", "2px");
      label("DAOUDIATE", 0.19, 0.175, 0.024, "rgba(130,110,80,0.8)", "1px");
      label("GUÉLIZ", 0.24, 0.44, 0.026, "rgba(130,110,80,0.8)", "2px");
      label("HIVERNAGE", 0.17, 0.58, 0.021, "rgba(130,110,80,0.75)", "1px");
      label("PALMERAIE", 0.83, 0.15, 0.024, "rgba(110,132,86,0.85)", "1px");
      label("Menara", 0.19, 0.885, 0.024, "rgba(104,126,82,0.85)");
      label("Agdal", 0.68, 0.945, 0.024, "rgba(104,126,82,0.85)");

      /* the paper the map is printed on */
      var v = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.72);
      v.addColorStop(0, "rgba(0,0,0,0)");
      v.addColorStop(1, "rgba(90,66,34,0.14)");
      ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
    });
  }

  /* =======================================================================
     THE PAGES

     One entry per page. Everything is positioned in percentages of the
     page, so a spread holds together whether it is on a laptop or half a
     phone screen. `n:` numbers a photo slot — those stay empty until
     real photos are added to MEMORIES in script.js.
     ======================================================================= */
  var W = SB.words;

  var PAGES = [
    /* ---- 1 · disco ---------------------------------------------- */
    { paper: "rose", pieces: [
      /* All four of these hung off the left edge, so the page weighed 13
         points to that side and the right column below the title was bare
         paper from a third of the way down to the foot. The chrome rose
         crosses over to hold that side; the rest stay where they were. */
      { k: "sticker", art: "disco",   left: -9, top:  2, w: 34, rot: 0 },
      { k: "sticker", art: "flowers", left: -7, top: 54, w: 32, rot: -6 },
      { k: "sticker", art: "disco",   left: -5, top: 78, w: 26, rot: 0 },
      { k: "bigtype", text: W.p1big, left: 68, top: 6, size: 16, vertical: true, colour: "rgba(255,255,255,.22)" },
      { k: "photo", n: 1, style: "polaroid", left: 26, top:  5, w: 36.1, rot: -6, tape: "top" },
      { k: "photo", n: 2, style: "snapshot", left: 14, top: 44, w: 37.7, rot:  4, tape: "corner" },
      { k: "photo", n: 3, style: "corners",  left: 38, top: 66, w: 38, rot: -3 },
      { k: "sticker", art: "rose",    left: 73, top: 54, w: 24, rot: -8 },
      { k: "sticker", art: "lips",    left: 60, top: 44, w: 19, rot: 14 },
      { k: "sticker", art: "vinyl8",  left: 70, top: 82, w: 26, rot: 0 },
      { k: "burst", left: 72, top: 38, w: 9 },
      { k: "sticker", art: "starG", left: 84, top: 18, w: 13, rot: -12 },
      /* the opening page carried a two-word bigtype and nothing else */
      { k: "script", text: W.p1script, left: 24, top: 92, w: 44, rot: -2, size: 3.1 },
    ]},

    /* ---- 2 · memories -------------------------------------------- */
    { paper: "rose", pieces: [
      /* THE NOTE COULD NOT BE READ.

         It sat at top:5 running to about 42% of the page, and photographs
         4 and 5 both started at top:30 -- so the last three lines went
         under them and the sentence stopped at "the way you looked at".
         The note is the first thing on the page and the reason the rest of
         it is here; it gets the top third to itself now, and the two rows
         of photographs start below where it ends. */
      /* The note had the whole top third and the photographs were pushed to
         the foot of the page to clear it, which read as a caption with a
         pile underneath rather than a page. It is smaller and set on a
         proper angle now -- a note laid on the page, not a column of it --
         and the two rows come up to meet it. */
      { k: "note", left: 5, top: 4, w: 52, rot: -4, text: W.p2note },
      { k: "letters", text: "MEMORIES", left: 84, top: 4 },
      /* this was a second "8" record, directly across the gutter from the
         one on the facing page and the same size -- the eye went straight
         to the pair of them. A plain wine pressing instead. */
      { k: "sticker", art: "vinylLtd", left: 60, top: 16, w: 24, rot: 0 },
      { k: "sticker", art: "starD",   left: 85, top: 40, w: 15, rot: 8 },
      { k: "photo", n: 4, style: "deckle",   left:  3, top: 41, w: 35, rot: -4, caption: W.p2small },
      { k: "photo", n: 5, style: "polaroid", left: 47, top: 38, w: 36, rot:  3 },
      { k: "photo", n: 6, style: "matted",   left:  5, top: 68, w: 33, rot:  2 },
      { k: "photo", n: 7, style: "snapshot", left: 50, top: 70, w: 37, rot: -4 },
      { k: "sticker", art: "flowers", left: 39, top: 56, w: 22, rot: 8 },
      { k: "sticker", art: "rose",    left: 78, top: 70, w: 24, rot: -6 },
      { k: "sticker", art: "lipInk",  left: 38, top: 90, w: 22, rot: -12 },
    ]},

    /* ---- 3 · the camera ------------------------------------------ */
    /* WHY THIS PAGE FELT EMPTY, AND WHAT IT IS NOT.

       Both of its pictures live inside props -- a window in the camera and
       a stamp on the club card -- and both were tiny: the window showed the
       photograph at 44% of the camera's width, the card at 34% of its own.
       That is the whole of it, and it is fixed where it was caused (see
       instantCam and .sb-id-photo).

       I had also put a spare photograph on this page. That was not mine to
       decide: which photographs go in this book is his call, not a hole in
       a layout for me to plug. The room it leaves is filled with things I
       am allowed to make -- a record, flowers, a star. */
    { paper: "rose2", pieces: [
      { k: "typecol", text: "The", left: -1, top: 2, w: 20 },
      { k: "bigtype", text: "C", left: 15, top: 1, size: 34, colour: "rgba(226,240,244,.26)" },
      { k: "patch", paper: "grid", left: 10, top: 0, w: 48, h: 27, rot: -3 },
      { k: "instantcam", n: 8, left: 24, top: 3, w: 64, rot: 1 },
      { k: "sticker", art: "vinylRose", left: -4, top: 20, w: 32, rot: 0 },
      { k: "sticker", art: "starG", left: 86, top: 13, w: 13, rot: 10 },
      { k: "sticker", art: "starD", left: 85, top: 44, w: 12, rot: -16 },
      { k: "sticker", art: "flowers", left: 1, top: 52, w: 27, rot: 7 },
      { k: "img", src: "assets/key.png", left: 34, top: 56, w: 9, rot: 12 },
      { k: "script", text: W.p3script, left: 46, top: 50, w: 42, rot: -7, size: 3.4 },
      { k: "sticker", art: "lipInk", left: 74, top: 60, w: 23, rot: -10 },
      { k: "sticker", art: "starS",   left: 80, top: 90, w: 15, rot: -14 },
      { k: "idcard", n: 9, left: 8, top: 64, w: 76, rot: -2 },
    ]},

    /* ---- 4 · the letter ------------------------------------------ */
    { paper: "ivory", pieces: [
      { k: "patch", paper: "news", left: -6, top: 2, w: 34, h: 96, rot: 1.5 },
      { k: "patch", paper: "rose", left: 58, top: -3, w: 50, h: 24, rot: -4 },
      { k: "sticker", art: "starD", left: 2, top: 14, w: 20, rot: -10 },
      { k: "letterpage", left: 16, top: 5, w: 76, rot: -2.6 },
      /* was w:27.9, which left a hand's width of bare paper under the
         letter and made the whole page feel like it was waiting for
         something. It is the only photograph on this page -- it should
         carry it. */
      /* ON the letter, not under it and not beside it. It sat below with a
         band of bare paper between, which read as two things stacked.
         Now it lies across the letter's bottom-left corner the way a
         photograph actually ends up on a letter -- and it clears the
         signature and the button, both of which are set to the right for
         exactly this reason. */
      { k: "photo", n: 10, style: "corners", left: 3, top: 51, w: 49, rot: -6, z: 6 },
      { k: "sticker", art: "vinylRose", left: 66, top: 78, w: 30, rot: 0 },
      { k: "sticker", art: "flowers", left: 6, top: 84, w: 26, rot: -7 },
      { k: "sticker", art: "flowers",   left: 82, top: 40, w: 26, rot: 9 },
      { k: "sticker", art: "starS",     left: 88, top: 26, w: 15, rot: 16 },
      { k: "script", text: W.p4script, left: 62, top: 72, w: 35, rot: -4, size: 2.9, dark: true },
    ]},

    /* ---- 5 · the record ------------------------------------------ */
    { paper: "rose", pieces: [
      { k: "typecol", text: "Th", left: -1, top: 3, w: 14 },
      /* A 56-wide record hanging off the left edge with the clock on top of
         it put this page's weight fifteen points to that side -- the most
         lopsided page in the book by a factor of three. The record is the
         size of the others now. */
      { k: "sticker", art: "vinylRose", left: -6, top: 12, w: 46, rot: 0 },
      { k: "sticker", art: "clock", left: 2, top: 18, w: 24, rot: 0 },
      /* "i am a lucky girl" runs round the record, and a third of it was
         under photograph 11 and another eighth under photograph 12. The
         curve is shorter now and the big photograph starts to the right of
         where it ends. */
      { k: "curvetext", text: W.p5vinyl, left: -6, top: 12, w: 40 },
      { k: "sticker", art: "lipInk", left: 68, top: 2, w: 20, rot: -8 },
      { k: "photo", n: 11, style: "washed",   left: 36, top:  6, w: 48, rot: -5, tape: "top" },
      { k: "photo", n: 12, style: "matted",   left:  8, top: 46, w: 38, rot:  3 },
      { k: "photo", n: 13, style: "polaroid", left: 56, top: 48, w: 42, rot: -3 },
      /* the page leaned hard left -- its weight sat 21 points off centre.
         A star and a record's worth of ink on the right answer it. */
      { k: "sticker", art: "starG", left: 83, top: 40, w: 14, rot: 12 },
      { k: "sticker", art: "flowers", left: -6, top: 78, w: 28, rot: -8 },
      { k: "sticker", art: "rose", left: 73, top: 78, w: 24, rot: 8 },
      { k: "sticker", art: "lipInk", left: 34, top: 90, w: 18, rot: 12 },
    ]},

    /* ---- 6 · cold hands ------------------------------------------ */
    { paper: "ivory", pieces: [
      { k: "patch", paper: "news", left: 48, top: -3, w: 58, h: 28, rot: 4 },
      { k: "patch", paper: "rose", left: -8, top: 54, w: 34, h: 54, rot: -3 },
      /* The emptiest page in the book at 51% covered, with the smallest
         photographs in it -- four prints all under 38% of the page width
         while the facing spread ran to 62%. They are the size of the rest
         of the book now, and the label has the corner to itself instead
         of a quarter of it under a spray of flowers. */
      { k: "photo", n: 14, style: "polaroid", left:  3, top:  3, w: 38, rot: -4, tape: "corner" },
      { k: "photo", n: 15, style: "snapshot", left: 50, top:  6, w: 41, rot:  4 },
      { k: "script", text: W.p6note, left: 3, top: 42, w: 32, rot: -3, size: 3.4, dark: true },
      { k: "photo", n: 16, style: "deckle",   left: 46, top: 40, w: 37, rot: -2 },
      { k: "photobooth", cells: [17, 18, 19], left: 5, top: 56, w: 26, rot: 5 },
      { k: "sticker", art: "starD", left: 86, top: 30, w: 15, rot: -14 },
      { k: "sticker", art: "flowers", left: 34, top: 84, w: 22, rot: 6 },
      { k: "sticker", art: "lipInk", left: 84, top: 62, w: 20, rot: 10 },
      { k: "label", text: W.p6label, left: 56, top: 82, w: 40, rot: -4 },
    ]},

    /* ---- 7 · the film strip -------------------------------------- */
    { paper: "ivory", pieces: [
      { k: "script", text: W.p7script, left: 10, top: 2, w: 46, rot: 0, size: 3.4, faint: true },
      /* it was sitting on the last line of the caption above it */
      { k: "sticker", art: "starS", left: -2, top: 24, w: 19, rot: 16 },
      { k: "filmcam", left: 2, top: 15, w: 52, rot: -8 },
      { k: "sticker", art: "vinylRose", left: -12, top: 50, w: 46, rot: 0 },
      { k: "sticker", art: "clock", left: 30, top: 80, w: 22, rot: 0 },
      { k: "bouquet", left: 2, top: 38, w: 38, rot: -4 },
      /* At 39 wide the three frames -- now that they actually fill the card
         instead of a third of it -- ran two thirds of the way down the page
         and the print below disappeared under them. This is the width that
         puts all three on the paper with the polaroid clear beneath. */
      { k: "filmstrip", cells: [20, 21, 22], left: 60, top: 3, w: 32, rot: 2 },
      /* The long frame under the strip. The right half of this page below
         the film was bare paper, which is the emptiest the book gets, and a
         tall print is what the shape of that gap wants. It is slot "025",
         not 25 -- 25 is already on the page after this one -- so the file
         to drop in is assets/photo-025.jpg and nothing else has to change. */
      { k: "photo", n: "025", style: "portrait", left: 55, top: 54, w: 40,
        rot: 2, tape: "top" },
    ]},

    /* ---- 8 · the prints ------------------------------------------ */
    { paper: "mauve", tone: 0.72, pieces: [
      { k: "patch", paper: "mauveCloth", left: 52, top: -3, w: 56, h: 46, rot: 6 },
      { k: "patch", paper: "mauveCloth", left: -8, top: 58, w: 52, h: 50, rot: -5 },
      { k: "sticker", art: "vinylLtd", left: 62, top: 14, w: 44, rot: 0 },
      /* These two were 57 and 59 wide against a book that otherwise runs
         31 to 45 -- big enough that turning onto this spread felt like a
         change of scale rather than a change of page. They are still the
         largest prints in the book, and now by a hand rather than by half
         again. */
      { k: "photo", n: 23, style: "washed", left: 4, top:  6, w: 50, rot: -7 },
      { k: "photo", n: 24, style: "washed", left: 22, top: 46, w: 51, rot:  4 },
      { k: "sticker", art: "starD", left: 4, top: 78, w: 22, rot: -20 },
      { k: "sticker", art: "lips", left: 70, top: 84, w: 24, rot: 12 },
      { k: "sticker", art: "flowers", left: 46, top: 84, w: 24, rot: 6 },
      /* this page had no words on it at all, and two of the best portraits
         in the book sitting on it saying nothing */
      { k: "script", text: W.p8script, left: 7, top: 90, w: 50, rot: -2, size: 3.0 },
      { k: "sticker", art: "flowers", left: 1, top: 30, w: 30, rot: -8 },
      { k: "sticker", art: "starG",   left: 86, top: 60, w: 17, rot: 14 },
    ]},

    /* ---- 9 · these memories -------------------------------------- */
    { paper: "grid", pieces: [
      { k: "patch", paper: "rose", left: 40, top: 6, w: 38, h: 52, rot: 2 },
      { k: "photo", n: 25, style: "washed", left: 4, top: -2, w: 44, rot: 1, tape: "top" },
      { k: "label2", text: W.p9label, left: 58, top: 2, w: 36, rot: -3 },
      { k: "sticker", art: "starG", left: 85, top: 22, w: 12, rot: 12 },
      /* The top right corner of this page was the emptiest quadrant in the
         book -- 32% filled, a label and then bare grid down to the middle.
         The print that was marooned in the centre moves up into it, and
         the photobooth strip grows: at 22 it was the smallest thing in the
         book by half. */
      { k: "photo", n: 29, style: "corners", left: 54, top: 22, w: 42, rot: -3 },
      { k: "photobooth", cells: [26, 27, 28], left: 4, top: 38, w: 28, rot: -4 },
      { k: "patch", paper: "blush", left: 50, top: 74, w: 50, h: 32, rot: 3 },
      { k: "sticker", art: "flowers", left: 60, top: 66, w: 36, rot: 4 },
      { k: "sticker", art: "starG", left: 50, top: 82, w: 11, rot: 20 },
      { k: "sticker", art: "lipInk", left: 77, top: 88, w: 20, rot: -12 },
      /* the club night: a record, a kiss, and a scatter of small stars.
         The grid ran empty down the left below the photobooth strip. */
      { k: "sticker", art: "vinylLtd", left: -12, top: 62, w: 34, rot: 0 },
      { k: "sticker", art: "lipInk",   left: 2,  top: 88, w: 22, rot: 12 },
      { k: "sticker", art: "starD",    left: 30, top: 26, w: 13, rot: -18 },
      { k: "sticker", art: "starS",    left: 40, top: 62, w: 14, rot: 10 },
    ]},

    /* ---- 10 · a video of us -------------------------------------- */
    { paper: "ivory", pieces: [
      { k: "patch", paper: "mauveCloth", left: 72, top: 20, w: 36, h: 52, rot: -4 },
      { k: "photo", n: 30, style: "washed", left: 8, top: 2, w: 50.8, rot: 0.5, tape: "top" },
      { k: "script", text: W.p10script, left: 6, top: 34, w: 32, rot: -2, size: 3.2, dark: true },
      { k: "videocard", left: 10, top: 44, w: 80 },
      { k: "sticker", art: "starG",   left: 2.5, top: 16, w: 20, rot: -10 },
      { k: "sticker", art: "starS",   left: 88, top: 76, w: 18, rot: 12 },
      { k: "sticker", art: "rose",    left: 1, top: 74, w: 26, rot: 6 },
      /* the closing page. Flowers over the top corner and a last kiss under
         the clip, so the book ends dressed rather than trailing off. */
      { k: "sticker", art: "flowers", left: 68, top: 2, w: 28, rot: 8 },
      /* the band between the flowers and the video card was bare cloth --
         a record for the song the clip is set to */
      { k: "sticker", art: "vinylRose", left: 70, top: 22, w: 30, rot: 0 },
      { k: "sticker", art: "lipInk",  left: 74, top: 90, w: 22, rot: -10 },
      { k: "sticker", art: "starD",   left: 6,  top: 4,  w: 14, rot: 16 },
    ]},
  ];

  /* =======================================================================
     THE COLOUR OF EACH PAGE

     His note: "upgrade the book's pages so every page matches the vibe of
     the photos in it so the colors difference between them wont look
     weird."

     He is right, and it was worst where a page of warm amber photographs
     was mounted on pink or mauve paper -- page 8 especially, which is two
     lamplit prints on a purple sheet. So each page now carries the colour
     of the photographs on it, as a hue and a saturation, and the paper
     wears a wash in that colour under everything else.

     The numbers are measured, not guessed: tools/img/tints.py reads the
     photos and writes them. Two rules make them usable as paper.

     One, only two families of colour count -- the warm amber end and the
     plum-to-rose end -- because those are the two this book is made of.
     A green lawn or a teal shopfront in the corner of one photo gets no
     vote. Averaging everything is what turned page 3 (one warm photo, one
     teal one) into hue 66, a yellow-green that matched neither of them and
     would have looked ill on paper.

     Two, saturation is scaled well down and capped, so the page is tinted
     rather than painted -- the crumpled paper texture underneath has to
     stay visible or it stops being paper.

     Rerun tools/img/tints.py after changing the photos. Page N is the Nth
     entry in PAGES.
     ======================================================================= */
  var PAGE_TINT = {
    1: [17, 40], 2: [11, 40], 3: [18, 30], 4: [20, 25],  5: [24, 40],
    6: [19, 37], 7: [25, 40], 8: [26, 40], 9: [282, 40], 10: [279, 36],
  };

  /* And the same for each photo on its own, which tints only the mount it
     is sitting in -- a warm print gets a warm cream card, a plum one gets
     a cooler card, so a frame belongs to its picture instead of every
     frame in the book being the same white. */
  var PHOTO_TINT = {
    1:[14,34], 2:[19,34], 3:[22,34], 4:[10,34], 5:[9,34], 6:[28,26],
    7:[19,25], 8:[18,27], 9:[20,21], 10:[20,21], 11:[30,23], 12:[32,34],
    13:[18,34], 14:[18,29], 15:[17,34], 16:[16,30], 17:[25,27], 18:[19,34],
    19:[23,27], 20:[24,34], 21:[26,34], 22:[27,34], 23:[21,31], 24:[33,34],
    25:[282,34], 26:[281,31], 27:[282,34], 28:[278,34], 29:[32,22], 30:[279,30],
    32:[32,19], 33:[28,34], 34:[351,34],
  };

  /* the back cover is its own thing, not a page of collage */
  var BACK = { title: "the end.", line1: "until next time,", line2: "— love, always •", line3: "xoxo" };

  /* Anything still wrapped in [square brackets] is scaffolding, not
     content — it should never make it onto a page. */
  function real(v) {
    if (!v) return "";
    var t = String(v).trim();
    return (t.charAt(0) === "[" && t.charAt(t.length - 1) === "]") ? "" : t;
  }

  /* Every frame in the book is numbered, and the empty ones say their
     number out loud. Drop `assets/photo-7.jpg` in and it lands in the
     frame marked "photo 7" — no config to edit. An entry in MEMORIES
     still wins if you would rather name the file something else, or add
     a caption to go with it. */
  /* Every photo in assets/ is written twice: a WebP and a JPEG of the same
     picture. WebP is roughly a third of the size at a quality difference no
     eye resolves, so it is asked for first wherever the browser takes it —
     which is everything since Safari 14. The JPEG stays as the fallback, so
     a photo dropped into assets/ as a plain .jpg still works with nothing
     else done to it; it just costs one failed request first.

     The support test is the canvas one: a browser that cannot encode WebP
     hands back a PNG data URL instead, and that is the whole check. It runs
     once, here, rather than per photo. */
  var PHOTO_EXT = (function () {
    var ok = false;
    try {
      var c = document.createElement("canvas");
      c.width = c.height = 1;
      ok = c.toDataURL("image/webp").indexOf("data:image/webp") === 0;
    } catch (e) { ok = false; }
    return ok ? ["webp", "jpg", "png"] : ["jpg", "png"];
  })();

  function photoAt(n) {
    /* A slot is usually a plain number and lines up with MEMORIES, but it
       does not have to be: "025" names assets/photo-025.jpg and belongs to
       no entry in that list. Only index MEMORIES for real slot numbers, or
       "025" would quietly borrow slot 25's title and caption. */
    var isSlot = (typeof n === "number") || /^[1-9][0-9]*$/.test(String(n));
    var m = (isSlot && typeof MEMORIES !== "undefined" && MEMORIES[n - 1]) ? MEMORIES[n - 1] : null;
    return {
      n: n,
      src:   m && m.photo ? m.photo : null,
      title: real(m && m.title),
      date:  real(m && m.date),
      text:  real(m && m.text),
    };
  }

  /* Try assets/photo-n.jpg, then the other extensions, then give up and
     leave the numbered frame showing. */
  function loadPhotoInto(host, mem, onEmpty) {
    var img = document.createElement("img");
    img.alt = mem.title || ("photo " + mem.n);
    img.loading = "lazy";
    img.decoding = "async";

    if (mem.src) {
      img.onerror = function () { img.remove(); onEmpty(); };
      img.src = mem.src;
      host.appendChild(img);
      return;
    }

    var i = 0;
    img.onerror = function () {
      i++;
      if (i < PHOTO_EXT.length) { img.src = "assets/photo-" + mem.n + "." + PHOTO_EXT[i]; }
      else { img.remove(); onEmpty(); }
    };
    img.src = "assets/photo-" + mem.n + "." + PHOTO_EXT[0];
    host.appendChild(img);
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
    /* Order in the list is not enough on its own: the kinds of piece carry
       their own z-index (a photograph sits at 3, a letter at 5), so a
       photograph listed after a letter still went under it. `z` lets one
       piece say it lies on top of another. */
    if (p.z != null) e.style.zIndex = p.z;
    return e;
  }

  /* A photo slot. Numbered, and empty until the matching file exists.

     The mount is a separate, statically-positioned child: percentage
     padding on an absolutely-positioned box resolves against the page,
     not against the box, which is what made every frame a wide border
     around a stamp-sized picture. */
  function makePhoto(p) {
    var mem = photoAt(p.n);
    var wrap = place(el("sb-photo sb-photo-" + (p.style || "polaroid")), p);
    /* the card this print is mounted on, tinted towards the print itself */
    var pt = PHOTO_TINT[mem.n];
    if (pt) {
      wrap.style.setProperty("--ph-h", pt[0]);
      wrap.style.setProperty("--ph-s", pt[1] + "%");
    }
    var mount = el("sb-photo-mount");
    var inner = el("sb-photo-inner");

    function showEmpty() {
      var ph = el("sb-photo-empty");
      ph.innerHTML = '<span class="sb-slot-no">' + mem.n + '</span>' +
                     '<span class="sb-slot-word">photo</span>';
      inner.appendChild(ph);
    }
    loadPhotoInto(inner, mem, showEmpty);

    mount.appendChild(inner);
    wrap.appendChild(mount);

    /* the caption band of a polaroid is part of the mount */
    if (p.style === "polaroid" && (p.caption || mem.title)) {
      var band = el("sb-photo-band");
      band.textContent = p.caption || mem.title;
      mount.appendChild(band);
    }

    if (p.style === "corners") {
      ["tl", "tr", "bl", "br"].forEach(function (c) {
        wrap.appendChild(el("sb-corner sb-corner-" + c));
      });
    }
    if (p.caption && p.style !== "polaroid") {
      var cap = el("sb-photo-hand");
      cap.textContent = p.caption;
      wrap.appendChild(cap);
    }
    if (p.tape) String(p.tape).split(" ").forEach(function (t) {
      if (t && t !== "none") wrap.appendChild(el("sb-tape sb-tape-" + t));
    });

    wrap.addEventListener("click", function (ev) {
      ev.stopPropagation();
      openLightbox(mem);
    });
    return wrap;
  }

  function svgEl(name, attrs) {
    var e = document.createElementNS("http://www.w3.org/2000/svg", name);
    for (var k in attrs) if (attrs.hasOwnProperty(k)) e.setAttribute(k, attrs[k]);
    return e;
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

  function makePatch(p, pageIndex) {
    var e = place(el("sb-patch"), p);
    /* the cloth is dyed to the page it lies on, so the two coloured areas
       agree instead of arguing -- two lamplit prints on a purple sheet was
       the worst of it */
    var dyed = (pageIndex != null) ? PAGE_PATCH[pageIndex] : null;
    e.style.backgroundImage = "url(" + (dyed || PAPER[p.paper]) + ")";
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
    var slot = makePhoto({ n: p.n, style: "window", left: 8, top: 15, w: 54 });
    slot.style.height = "64%";
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
    (p.cells || []).forEach(function (n) {
      var c = el("sb-booth-cell");
      c.appendChild(makePhoto({ n: n, style: "cell", left: 0, top: 0, w: 100 }));
      e.appendChild(c);
    });
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
      '<p class="sb-lp-body">' + L.body + '</p>' +
      '<p class="sb-lp-sign">' + L.signOff +
        '<span class="sb-lp-name">' + L.signature + '</span></p>';
    var btn = el("sb-lp-btn", "button");
    btn.textContent = "Tap here to view more";
    btn.addEventListener("click", function (ev) { ev.stopPropagation(); openNote(); });
    e.appendChild(btn);
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
    e.appendChild(buildOurVideoCard());
    return e;
  }

  var MAKERS = {
    photo: makePhoto, sticker: makeSticker, img: makeImg, patch: makePatch,
    note: makeNote, bigtype: makeBigType, script: makeScript, letters: makeLetters,
    typecol: makeTypeCol, curvetext: makeCurveText, burst: makeBurst,
    label: makeLabel, label2: makeLabel2, instantcam: makeInstantCam,
    filmcam: makeFilmCam, bouquet: makeBouquetPiece, filmstrip: makeFilmStrip,
    photobooth: makePhotobooth, idcard: makeIdCard, letterpage: makeLetterPage,
    mapcard: makeMapCard, videocard: makeVideoCard,
  };

  function buildPage(def, i) {
    var page = el("sb-page");
    page.dataset.index = i;
    page.style.backgroundImage = "url(" + (PAGE_PAPER[i] || PAPER[def.paper]) + ")";
    /* the hue is still published to CSS: the ink, the tapes and the shadows
       on this page pick their colour from it so nothing is a stray grey */
    var t = PAGE_TINT[i + 1];
    if (t) {
      page.style.setProperty("--pg-h", Math.round(bandedHue(t[0], HEAVY[def.paper])));
      page.style.setProperty("--pg-s", t[1] + "%");
    }
    def.pieces.forEach(function (p) {
      var make = MAKERS[p.k];
      if (make) page.appendChild(make(p, i));
    });
    return page;
  }

  function buildBackCover() {
    var page = el("sb-page sb-page-back");
    page.style.backgroundImage = "url(" + PAPER.cover + ")";
    var card = el("sb-back-card");
    card.innerHTML =
      '<h2>' + BACK.title + '</h2>' +
      '<p class="l1">' + BACK.line1 + '</p>' +
      '<p class="l2">' + BACK.line2 + '</p>' +
      '<p class="l3">' + BACK.line3 + '</p>';
    /* the way on, once the book is finished */
    var go = el("sb-back-go", "button");
    go.innerHTML = '<span>now come and play</span>' +
                   '<span class="sb-back-go-arrow" aria-hidden="true">›</span>';
    go.addEventListener("click", function (ev) {
      ev.stopPropagation();
      if (typeof window.leaveScrapbook === "function") window.leaveScrapbook();
    });
    card.appendChild(go);

    page.appendChild(card);
    var st = el("sb-sticker sb-back-star");
    var si = el("", "img"); si.src = STICK.starS; st.appendChild(si);
    page.appendChild(st);
    return page;
  }

  /* =======================================================================
     THE DRAWER — bouquet, song, map, music video

     These five are built as standalone widgets because two of them also
     appear on the pages themselves (the map on page 4, the video on
     page 9), and both places should behave identically.
     ======================================================================= */

  /* ---- shared: quiet the ambient pad while something else plays ---- */
  function duckAmbient() {
    try { if (window.musicOn && typeof window.setMusic === "function") window.setMusic(false); }
    catch (e) { /* the pad is optional; never let it break playback */ }
  }

  var songAudio = null;

  function stopAllAudio(except) {
    if (songAudio && except !== "song") songAudio.pause();
    var vids = document.querySelectorAll("#screen-scrapbook video");
    Array.prototype.forEach.call(vids, function (v) { if (except !== "video") v.pause(); });
  }

  /* ---- the bouquet ---------------------------------------------
     The one thing in here that is meant to be looked at rather than
     used, so it is built as SVG and it moves: the whole bunch breathes,
     every bloom opens and closes on its own count, the foliage drifts
     against it, the ribbon tails swing, and now and then a petal comes
     loose and falls. Seeded, so nothing beats in time with anything
     else. ---- */
  var BQ = {
    peony:  ["#fbc4d4", "#f2a0bb", "#dd7c9c", "#c2607f"],
    rose:   ["#f7aec2", "#e88aa6", "#cf6a89", "#b4506e"],
    cream:  ["#fffaf4", "#f6e5da", "#e5cdc0", "#cdb0a2"],
    apricot:["#f9d3ac", "#efb885", "#d99a64", "#bd7e4c"],
    lilac:  ["#d8c2ee", "#bda1e0", "#a184cb", "#8467b0"],
  };

  function bqBloom(host, cx, cy, r0, pal, petals, rnd_) {
    var g = svgEl("g", { transform: "translate(" + cx + "," + cy + ")" });
    var inner = svgEl("g", { class: "bq-bloom" });
    inner.style.setProperty("--d", (-rnd_() * 8).toFixed(2) + "s");
    inner.style.setProperty("--dur", (5.5 + rnd_() * 4).toFixed(2) + "s");
    inner.style.setProperty("--tw", (2 + rnd_() * 3).toFixed(1) + "deg");

    /* three rings of petals, the outer ones darker and turned away */
    [[1.00, pal[3], 0.86], [0.78, pal[2], 0.62], [0.56, pal[1], 0.38]]
      .forEach(function (ring, ri) {
        var n = Math.max(4, petals - ri);
        var spin = rnd_() * 360;
        for (var k = 0; k < n; k++) {
          var pg = svgEl("g", { transform: "rotate(" + (spin + (k / n) * 360).toFixed(1) + ")" });
          pg.appendChild(svgEl("path", {
            d: "M0,0 C " + (-r0 * ring[0] * 0.5) + "," + (-r0 * ring[0] * 0.72) +
               " " + (-r0 * ring[0] * 0.30) + "," + (-r0 * ring[0] * 1.18) +
               " 0," + (-r0 * ring[0] * 1.22) +
               " C " + (r0 * ring[0] * 0.30) + "," + (-r0 * ring[0] * 1.18) +
               " " + (r0 * ring[0] * 0.5) + "," + (-r0 * ring[0] * 0.72) + " 0,0 Z",
            fill: ring[1], opacity: "0.97",
          }));
          inner.appendChild(pg);
        }
      });
    /* the heart of the flower */
    inner.appendChild(svgEl("circle", { cx: 0, cy: 0, r: r0 * 0.30, fill: pal[2], opacity: ".8" }));
    inner.appendChild(svgEl("circle", { cx: 0, cy: 0, r: r0 * 0.20, fill: pal[0] }));
    for (var t = 0; t < 7; t++) {
      var ta = (t / 7) * 6.283;
      inner.appendChild(svgEl("circle", {
        cx: (Math.cos(ta) * r0 * 0.12).toFixed(2),
        cy: (Math.sin(ta) * r0 * 0.12).toFixed(2),
        r: (r0 * 0.045).toFixed(2), fill: "#f6d68a",
      }));
    }
    g.appendChild(inner);
    host.appendChild(g);
  }

  function bqCluster(host, cx, cy, r0, c1, c2, rnd_) {
    var g = svgEl("g", { transform: "translate(" + cx + "," + cy + ")" });
    var inner = svgEl("g", { class: "bq-bloom" });
    inner.style.setProperty("--d", (-rnd_() * 8).toFixed(2) + "s");
    inner.style.setProperty("--dur", (6 + rnd_() * 4).toFixed(2) + "s");
    inner.style.setProperty("--tw", "2deg");
    for (var i = 0; i < 26; i++) {
      var a = rnd_() * 6.283, d = rnd_() * r0;
      var fx = Math.cos(a) * d, fy = Math.sin(a) * d * 0.82;
      var fr = r0 * (0.15 + rnd_() * 0.09);
      var fg = svgEl("g", { transform: "translate(" + fx.toFixed(1) + "," + fy.toFixed(1) + ")" });
      for (var k = 0; k < 4; k++) {
        fg.appendChild(svgEl("ellipse", {
          cx: (Math.cos(k * 1.571) * fr * 0.62).toFixed(2),
          cy: (Math.sin(k * 1.571) * fr * 0.62).toFixed(2),
          rx: (fr * 0.55).toFixed(2), ry: (fr * 0.48).toFixed(2),
          fill: rnd_() > 0.5 ? c1 : c2,
        }));
      }
      fg.appendChild(svgEl("circle", { cx: 0, cy: 0, r: (fr * 0.22).toFixed(2), fill: "#fdf0c8" }));
      inner.appendChild(fg);
    }
    g.appendChild(inner);
    host.appendChild(g);
  }

  function bqLeaf(host, x, y, len, rot, tone, rnd_) {
    var g = svgEl("g", { transform: "translate(" + x + "," + y + ") rotate(" + rot + ")" });
    var inner = svgEl("g", { class: "bq-leaf" });
    inner.style.setProperty("--d", (-rnd_() * 7).toFixed(2) + "s");
    inner.style.setProperty("--dur", (5 + rnd_() * 4).toFixed(2) + "s");
    inner.appendChild(svgEl("path", {
      d: "M0,0 Q" + (len * 0.5) + "," + (-len * 0.26) + " " + len + ",0 " +
         "Q" + (len * 0.5) + "," + (len * 0.26) + " 0,0 Z",
      fill: tone,
    }));
    inner.appendChild(svgEl("path", {
      d: "M0,0 L" + len + ",0", stroke: "rgba(255,255,255,.28)", "stroke-width": "1", fill: "none",
    }));
    g.appendChild(inner);
    host.appendChild(g);
  }

  /* a stem of small bells, for the lavender */
  function bqLavender(host, x, y, len, rot, rnd_) {
    var g = svgEl("g", { transform: "translate(" + x + "," + y + ") rotate(" + rot + ")" });
    var inner = svgEl("g", { class: "bq-leaf" });
    inner.style.setProperty("--d", (-rnd_() * 6).toFixed(2) + "s");
    inner.style.setProperty("--dur", (4.5 + rnd_() * 3).toFixed(2) + "s");
    inner.appendChild(svgEl("path", {
      d: "M0,0 L0," + (-len), stroke: "#7f9a52", "stroke-width": "2", "stroke-linecap": "round",
    }));
    for (var i = 0; i < 10; i++) {
      inner.appendChild(svgEl("ellipse", {
        cx: ((i % 2 ? 1 : -1) * 2.4).toFixed(1), cy: (-len * 0.24 - (i / 10) * len * 0.74).toFixed(1),
        rx: "2.9", ry: "3.6",
        fill: i % 2 ? "#b394e0" : "#9a76c9",
      }));
    }
    g.appendChild(inner);
    host.appendChild(g);
  }

  function buildBouquetSVG() {
    var r = rnd(97);
    var svg = svgEl("svg", { viewBox: "0 0 200 300", class: "sb-bq", "aria-label": "a bouquet of flowers" });

    var defs = svgEl("defs", {});
    var kraft = svgEl("linearGradient", { id: "bqKraft", x1: "0", y1: "0", x2: "1", y2: "0" });
    [["0", "#8e6a37"], [".18", "#c3a069"], [".44", "#e8ceA0".replace("A","a")], [".72", "#c9a468"], ["1", "#87642f"]]
      .forEach(function (st) {
        kraft.appendChild(svgEl("stop", { offset: st[0], "stop-color": st[1] }));
      });
    defs.appendChild(kraft);
    var ribbon = svgEl("linearGradient", { id: "bqRibbon", x1: "0", y1: "0", x2: "0", y2: "1" });
    [["0", "#f0b9c8"], [".5", "#d98da3"], ["1", "#b96b83"]].forEach(function (st) {
      ribbon.appendChild(svgEl("stop", { offset: st[0], "stop-color": st[1] }));
    });
    defs.appendChild(ribbon);
    svg.appendChild(defs);

    /* everything above the wrap breathes together */
    var head = svgEl("g", { class: "bq-sway" });

    /* stems, fanning up out of the cone */
    for (var i = 0; i < 11; i++) {
      var t = i / 10;
      var tx = 34 + t * 132 + (r() - 0.5) * 10;
      var ty = 92 + r() * 74;
      head.appendChild(svgEl("path", {
        d: "M100,206 Q" + (100 + (tx - 100) * 0.42).toFixed(1) + "," + (166 - r() * 18).toFixed(1) +
           " " + tx.toFixed(1) + "," + ty.toFixed(1),
        stroke: ["#6f8f4a", "#5d7a35", "#87a75c"][(r() * 3) | 0],
        "stroke-width": (2 + r() * 1.2).toFixed(1), fill: "none", "stroke-linecap": "round",
      }));
    }

    /* foliage behind the blooms */
    bqLeaf(head, 36, 172, 38, -150, "#5d7a35", r);
    bqLeaf(head, 164, 166, 40, -30, "#5d7a35", r);
    bqLeaf(head, 48, 140, 32, -166, "#7fa04a", r);
    bqLeaf(head, 152, 134, 34, -14, "#7fa04a", r);
    bqLeaf(head, 66, 108, 27, -196, "#93b862", r);
    bqLeaf(head, 136, 102, 28, 16, "#93b862", r);
    bqLavender(head, 28, 168, 56, -17, r);
    bqLavender(head, 172, 162, 52, 16, r);
    bqLavender(head, 44, 142, 46, -10, r);
    bqLavender(head, 158, 136, 44, 10, r);

    /* the clusters sit between the big heads and fill the gaps */
    bqCluster(head, 50, 152, 24, "#c3a4e6", "#a884d2", r);
    bqCluster(head, 152, 146, 22, "#cbb0ea", "#af8ed8", r);
    bqCluster(head, 100, 84, 19, "#fdf3ee", "#eeddd4", r);
    bqCluster(head, 72, 190, 17, "#f6dce6", "#e6c2d2", r);

    /* the big heads, front to back */
    bqBloom(head, 66, 176, 25, BQ.peony,  8, r);
    bqBloom(head, 134, 170, 24, BQ.rose,   8, r);
    bqBloom(head, 100, 144, 29, BQ.peony,  9, r);
    bqBloom(head, 40,  122, 19, BQ.cream,  7, r);
    bqBloom(head, 162, 116, 18, BQ.apricot,7, r);
    bqBloom(head, 72,  104, 18, BQ.rose,   7, r);
    bqBloom(head, 130, 96,  17, BQ.lilac,  7, r);
    bqBloom(head, 100, 186, 15, BQ.cream,  6, r);
    bqBloom(head, 100, 68,  16, BQ.rose,   7, r);

    svg.appendChild(head);

    /* the wrap, over the stems */
    var cone = svgEl("g", {});
    cone.appendChild(svgEl("path", {
      d: "M36,202 L164,202 L118,290 Q100,298 82,290 Z", fill: "url(#bqKraft)",
    }));
    /* the folded edge along the top */
    cone.appendChild(svgEl("path", {
      d: "M36,202 L164,202 L156,215 L44,215 Z", fill: "rgba(255,248,232,.28)",
    }));
    /* the mouth of it, in shadow */
    cone.appendChild(svgEl("ellipse", {
      cx: "100", cy: "202", rx: "64", ry: "6.5", fill: "rgba(72,48,22,.45)",
    }));
    /* creases */
    [-0.80, -0.46, -0.14, 0.18, 0.5, 0.82].forEach(function (o) {
      cone.appendChild(svgEl("path", {
        d: "M" + (100 + 64 * o).toFixed(1) + ",204 L" + (100 + 17 * o).toFixed(1) + ",290",
        stroke: "rgba(112,80,38,.24)", "stroke-width": "1", fill: "none",
      }));
    });
    /* the wrap darkens where the head shades it */
    cone.appendChild(svgEl("path", {
      d: "M36,202 L164,202 L156,226 L44,226 Z", fill: "rgba(70,42,18,.20)",
    }));
    svg.appendChild(cone);

    /* the ribbon, with tails that swing */
    var bow = svgEl("g", {});
    bow.appendChild(svgEl("path", {
      d: "M60,238 Q100,248 140,238", stroke: "url(#bqRibbon)", "stroke-width": "7",
      fill: "none", "stroke-linecap": "round",
    }));
    [[-1, "bq-tail-l"], [1, "bq-tail-r"]].forEach(function (sd) {
      var g = svgEl("g", { transform: "translate(100,242)" });
      var inner = svgEl("g", { class: "bq-tail " + sd[1] });
      inner.appendChild(svgEl("path", {
        d: "M0,0 Q" + (sd[0] * 16) + ",18 " + (sd[0] * 10) + ",40 L" +
           (sd[0] * 22) + ",34 Q" + (sd[0] * 24) + ",14 0,2 Z",
        fill: "url(#bqRibbon)",
      }));
      g.appendChild(inner);
      bow.appendChild(g);
    });
    /* the two loops, folded rather than drawn as rings */
    [-1, 1].forEach(function (sd) {
      bow.appendChild(svgEl("path", {
        d: "M100,236 C " + (100 + sd * 12) + ",220 " + (100 + sd * 34) + ",224 " +
           (100 + sd * 30) + ",238 C " + (100 + sd * 27) + ",250 " +
           (100 + sd * 10) + ",246 100,240 Z",
        fill: "url(#bqRibbon)",
      }));
      /* the shaded inside of the fold */
      bow.appendChild(svgEl("path", {
        d: "M100,237 C " + (100 + sd * 11) + ",228 " + (100 + sd * 24) + ",230 " +
           (100 + sd * 22) + ",239 C " + (100 + sd * 20) + ",245 " +
           (100 + sd * 9) + ",243 100,239 Z",
        fill: "rgba(122,50,72,.30)",
      }));
    });
    /* the knot */
    bow.appendChild(svgEl("ellipse", {
      cx: "100", cy: "238", rx: "6.5", ry: "5.5", fill: "url(#bqRibbon)",
    }));
    bow.appendChild(svgEl("ellipse", {
      cx: "98.4", cy: "236.4", rx: "3", ry: "2.2", fill: "rgba(255,225,234,.5)",
    }));
    svg.appendChild(bow);

    /* a petal comes loose now and then */
    for (var f = 0; f < 3; f++) {
      var fall = svgEl("ellipse", {
        cx: (60 + r() * 80).toFixed(0), cy: (140 + r() * 40).toFixed(0),
        rx: "5", ry: "3.4", fill: [BQ.peony[1], BQ.rose[1], BQ.cream[1]][f],
        class: "bq-fall",
      });
      fall.style.setProperty("--d", (-r() * 12).toFixed(1) + "s");
      fall.style.setProperty("--dur", (9 + r() * 5).toFixed(1) + "s");
      fall.style.setProperty("--dx", ((r() - 0.5) * 46).toFixed(0) + "px");
      svg.appendChild(fall);
    }

    /* and a little light on it */
    for (var sp = 0; sp < 5; sp++) {
      var star = svgEl("circle", {
        cx: (36 + r() * 128).toFixed(0), cy: (70 + r() * 116).toFixed(0),
        r: (1 + r()).toFixed(1), fill: "#fff6e2", class: "bq-spark",
      });
      star.style.setProperty("--d", (-r() * 7).toFixed(1) + "s");
      star.style.setProperty("--dur", (3.5 + r() * 3).toFixed(1) + "s");
      svg.appendChild(star);
    }
    return svg;
  }

  function buildBouquetCard() {
    var c = el("sb-w sb-w-bouquet");
    c.innerHTML =
      '<p class="sb-w-title">My Love’s bouquet</p>' +
      '<p class="sb-w-kicker">FROM YOU</p>' +
      '<div class="sb-bq-stage"></div>';
    c.querySelector(".sb-bq-stage").appendChild(buildBouquetSVG());
    return c;
  }

  /* ---- the song ------------------------------------------------
     A record that turns while it plays, a scrubber you can drag, and
     the time either side of it. ---- */
  function buildSongCard() {
    var S = SB.song;
    var c = el("sb-w sb-w-song");
    /* The extra elements here are decoration only — the halo behind the
       record, the tonearm, the little caption. Every class the player
       logic below queries is unchanged. */
    c.innerHTML =
      '<span class="sb-song-halo" aria-hidden="true"></span>' +
      '<div class="sb-song-deck">' +
        '<span class="sb-song-arm" aria-hidden="true"></span>' +
        '<img class="sb-song-disc" alt="" />' +
        '<span class="sb-song-spindle"></span>' +
      "</div>" +
      '<div class="sb-song-body">' +
        '<p class="sb-song-kicker">our song</p>' +
        '<p class="sb-song-title">' + S.title + "</p>" +
        '<p class="sb-song-artist">' + S.artist + "</p>" +
        '<div class="sb-song-scrub" role="slider" tabindex="0" aria-label="Seek">' +
          '<div class="sb-song-track"><i class="sb-song-fill"></i><b class="sb-song-knob"></b></div>' +
        "</div>" +
        '<div class="sb-song-times"><span class="sb-song-at">0:00</span>' +
        '<span class="sb-song-of">—:—</span></div>' +
      "</div>" +
      '<button class="sb-song-play" aria-label="Play the song">' +
        '<span class="sb-ico-play"></span></button>';

    c.querySelector(".sb-song-disc").src = STICK.vinylRose;

    var btn   = c.querySelector(".sb-song-play");
    var fill  = c.querySelector(".sb-song-fill");
    var knob  = c.querySelector(".sb-song-knob");
    var scrub = c.querySelector(".sb-song-scrub");
    var atEl  = c.querySelector(".sb-song-at");
    var ofEl  = c.querySelector(".sb-song-of");

    function fmt(t) {
      if (!isFinite(t) || t < 0) return "0:00";
      t = Math.floor(t);
      return Math.floor(t / 60) + ":" + ("0" + (t % 60)).slice(-2);
    }
    function paint() {
      if (!songAudio || !songAudio.duration) return;
      var pct = (songAudio.currentTime / songAudio.duration) * 100;
      fill.style.width = pct + "%";
      knob.style.left = pct + "%";
      atEl.textContent = fmt(songAudio.currentTime);
      ofEl.textContent = fmt(songAudio.duration);
    }

    function ensure() {
      if (songAudio) return;
      songAudio = new Audio(S.src);
      songAudio.preload = "metadata";
      songAudio.addEventListener("timeupdate", paint);
      songAudio.addEventListener("durationchange", paint);
      songAudio.addEventListener("loadedmetadata", function () {
        /* open on the moment set in SB.song.startAt */
        if (S.startAt && !songAudio.dataset_seeded) {
          songAudio.dataset_seeded = 1;
          try { songAudio.currentTime = Math.min(S.startAt, Math.max(0, songAudio.duration - 1)); }
          catch (e) {}
        }
        paint();
      });
      songAudio.addEventListener("play",  function () { c.classList.add("playing"); });
      songAudio.addEventListener("pause", function () { c.classList.remove("playing"); });
      songAudio.addEventListener("ended", function () { c.classList.remove("playing"); });
      songAudio.addEventListener("error", function () { c.classList.add("missing"); });
    }

    btn.addEventListener("click", function () {
      ensure();
      if (songAudio.paused) {
        duckAmbient();
        stopAllAudio("song");
        var pr = songAudio.play();
        if (pr && pr.catch) pr.catch(function () { c.classList.add("missing"); });
      } else {
        songAudio.pause();
      }
    });

    /* dragging the scrubber */
    var scrubbing = false;
    function seekTo(clientX) {
      ensure();
      var r = scrub.getBoundingClientRect();
      var k = Math.max(0, Math.min(1, (clientX - r.left) / r.width));
      if (songAudio.duration) { songAudio.currentTime = k * songAudio.duration; paint(); }
    }
    scrub.addEventListener("pointerdown", function (e) {
      scrubbing = true; scrub.setPointerCapture(e.pointerId); seekTo(e.clientX);
      e.stopPropagation();
    });
    scrub.addEventListener("pointermove", function (e) {
      if (scrubbing) { seekTo(e.clientX); e.stopPropagation(); }
    });
    scrub.addEventListener("pointerup", function (e) {
      scrubbing = false; e.stopPropagation();
    });
    return c;
  }

  /* ---- the memory map ---- */
  var MAP_SLOT = 31;          /* the map pins use slots 31..34 */
  var MAP_TEX = null;
  function buildMapCard(big) {
    if (!MAP_TEX) MAP_TEX = marrakechMap(800, 600);
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
      var mem = photoAt(MAP_SLOT + i);
      b.innerHTML = "";
      if (pin.note) {
        b.classList.add("is-note");
        b.innerHTML = '<span class="sb-map-pin-note"><svg class="gl gl-pin" aria-hidden="true"><use href="#ic-px-star"/></svg></span>';
      } else {
        (function (host, m) {
          loadPhotoInto(host, m, function () {
            host.innerHTML = '<span class="sb-map-pin-empty">' + m.n + "</span>";
          });
        })(b, mem);
      }
      b.addEventListener("click", function (e) {
        e.stopPropagation();
        openPin(pin, mem);
      });
      inner.appendChild(b);
    });
    return c;
  }

  /* ---- the video on the last page: one of the two of you --------
     A real <video>, with a poster if there is one. Until the file
     exists it shows a film slate rather than a blank green rectangle. */
  function buildOurVideoCard() {
    var V = SB.ourVideo;
    var c = el("sb-w sb-w-ourvideo");
    /* A print in the book, not a player dropped on top of one. The same
       cream mount every photo on these pages sits in, with the sprocket
       edges the film cells use, so it reads as a strip of film someone
       taped down rather than a black rectangle waiting for a video. */
    c.innerHTML =
      '<div class="sb-ov-mount">' +
        '<div class="sb-ov-holes a"><i></i><i></i><i></i><i></i><i></i><i></i></div>' +
        '<div class="sb-vid-frame">' +
          '<div class="sb-ov-poster"></div>' +
          '<div class="sb-ov-veil"></div>' +
          '<div class="sb-vid-empty">' +
            '<div class="sb-slate">' +
              '<div class="sb-slate-bar"></div>' +
              '<p class="sb-slate-title">a video of us</p>' +
              '<p class="sb-slate-file">assets/our-video.mp4</p>' +
            "</div>" +
          "</div>" +
        "</div>" +
        '<div class="sb-ov-holes b"><i></i><i></i><i></i><i></i><i></i><i></i></div>' +
      "</div>" +
      '<p class="sb-vid-cap">' + V.caption + "</p>";

    var frame = c.querySelector(".sb-vid-frame");
    var poster = c.querySelector(".sb-ov-poster");

    var v = document.createElement("video");
    v.preload = "metadata";
    v.playsInline = true;
    v.setAttribute("playsinline", "");
    v.setAttribute("webkit-playsinline", "");
    v.controls = false;
    v.src = V.src;

    /* The play button is built now, not inside a load handler.
       iOS in Low Power Mode downgrades preload="metadata" to "none",
       so `loadeddata` can never fire and the control that only existed
       inside that handler never existed at all -- the slate stayed up
       over a perfectly good file. The button is always here; the first
       tap is the gesture that loads the video if nothing else has. */
    var btn = el("sb-vid-play", "button");
    btn.setAttribute("aria-label", "Play our video");
    btn.innerHTML =
      '<span class="sb-ov-ring" aria-hidden="true">' +
        '<span class="sb-ov-pulse"></span>' +
        '<span class="sb-ov-disc"><span class="sb-ico-play"></span></span>' +
      "</span>" +
      '<span class="sb-ov-word">play</span>';
    frame.appendChild(btn);

    /* THE TRANSPORT.

       A single play button and nothing else is not a player -- once the
       clip was running there was no way to pause it, find a moment again,
       or turn the sound off, and on a touch screen the control only came
       back on hover, which a finger does not have. So there is a proper
       set of controls, made of the same things the rest of the book is
       made of: a brass disc, a strip of film for a scrubber, the serif the
       captions use. It lies over the bottom of the frame while the clip
       runs and gets out of the way when nothing is happening. */
    var bar = el("sb-ov-bar");
    bar.innerHTML =
      '<button class="sb-ov-pp" type="button" aria-label="Pause">' +
        '<span class="sb-ico-play"></span></button>' +
      '<div class="sb-ov-track" role="slider" tabindex="0" aria-label="Seek"' +
        ' aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">' +
        '<span class="sb-ov-buf"></span>' +
        '<span class="sb-ov-fill"></span>' +
        '<span class="sb-ov-knob"></span>' +
      "</div>" +
      '<span class="sb-ov-time"><b>0:00</b><i>/</i><s>0:00</s></span>' +
      '<button class="sb-ov-mute" type="button" aria-label="Mute">' +
        '<svg class="sb-ico-spk" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
          '<path class="cone" d="M3.5 9.2h3.9L12 5.2v13.6L7.4 14.8H3.5z"/>' +
          '<path class="wave" d="M15.1 9.4a3.9 3.9 0 0 1 0 5.2"/>' +
          '<path class="wave" d="M17.5 7.2a7.3 7.3 0 0 1 0 9.6"/>' +
          '<path class="slash" d="M15.4 8.6l6 6.8"/>' +
        "</svg></button>";
    frame.appendChild(bar);

    var pp    = bar.querySelector(".sb-ov-pp");
    var track = bar.querySelector(".sb-ov-track");
    var fill  = bar.querySelector(".sb-ov-fill");
    var buf   = bar.querySelector(".sb-ov-buf");
    var knob  = bar.querySelector(".sb-ov-knob");
    var tNow  = bar.querySelector(".sb-ov-time b");
    var tAll  = bar.querySelector(".sb-ov-time s");
    var mute  = bar.querySelector(".sb-ov-mute");

    function clock(t) {
      if (!isFinite(t) || t < 0) t = 0;
      var m = Math.floor(t / 60), sec = Math.floor(t % 60);
      return m + ":" + (sec < 10 ? "0" : "") + sec;
    }
    function paintTime() {
      var d = v.duration;
      var k = (isFinite(d) && d > 0) ? Math.max(0, Math.min(1, v.currentTime / d)) : 0;
      fill.style.width = (k * 100).toFixed(2) + "%";
      knob.style.left  = (k * 100).toFixed(2) + "%";
      track.setAttribute("aria-valuenow", Math.round(k * 100));
      tNow.textContent = clock(v.currentTime);
      tAll.textContent = isFinite(d) ? clock(d) : "0:00";
      try {
        if (v.buffered && v.buffered.length && isFinite(d) && d > 0) {
          buf.style.width = (v.buffered.end(v.buffered.length - 1) / d * 100).toFixed(2) + "%";
        }
      } catch (err) { /* buffered throws on some states; it is only a hint */ }
    }
    v.addEventListener("timeupdate", paintTime);
    v.addEventListener("durationchange", paintTime);
    v.addEventListener("progress", paintTime);
    v.addEventListener("seeked", paintTime);

    /* The controls fade out while the clip runs and nobody is doing
       anything, and come back on any touch or movement over the frame --
       not on hover, which is a thing only a mouse has. */
    var idle = null;
    function wake() {
      c.classList.add("showing");
      clearTimeout(idle);
      idle = setTimeout(function () {
        if (!v.paused) c.classList.remove("showing");
      }, 2600);
    }
    frame.addEventListener("pointermove", wake);
    frame.addEventListener("pointerdown", wake);

    function seekAt(clientX) {
      var r = track.getBoundingClientRect();
      if (!r.width || !isFinite(v.duration)) return;
      var k = Math.max(0, Math.min(1, (clientX - r.left) / r.width));
      try { v.currentTime = k * v.duration; } catch (err) {}
      paintTime();
    }
    var scrubbing = false;
    /* Every one of these stops here. The book turns its pages on a
       horizontal drag anywhere over it, and dragging a scrubber is exactly
       that gesture -- without this, finding a moment in the clip flips the
       page out from under it. */
    track.addEventListener("pointerdown", function (e) {
      scrubbing = true;
      try { track.setPointerCapture(e.pointerId); } catch (err) {}
      seekAt(e.clientX); wake(); e.stopPropagation(); e.preventDefault();
    });
    track.addEventListener("pointermove", function (e) {
      if (!scrubbing) return;
      seekAt(e.clientX); e.stopPropagation();
    });
    function endScrub(e) { scrubbing = false; if (e) e.stopPropagation(); wake(); }
    track.addEventListener("pointerup", endScrub);
    track.addEventListener("pointercancel", endScrub);
    track.addEventListener("keydown", function (e) {
      var step = e.shiftKey ? 10 : 5;
      if (e.key === "ArrowRight") { v.currentTime = Math.min(v.duration || 0, v.currentTime + step); }
      else if (e.key === "ArrowLeft") { v.currentTime = Math.max(0, v.currentTime - step); }
      else return;
      e.preventDefault(); e.stopPropagation(); paintTime(); wake();
    });

    mute.addEventListener("click", function (e) {
      e.stopPropagation();
      v.muted = !v.muted;
      c.classList.toggle("muted", v.muted);
      mute.setAttribute("aria-label", v.muted ? "Unmute" : "Mute");
      wake();
    });

    var failed = false;
    function ready() {
      if (failed) return;
      c.classList.add("ready");
    }
    /* readyState 1 (metadata) is enough. Listen wide: whichever of these
       a browser sends first, we are ready. */
    ["loadedmetadata", "loadeddata", "canplay", "canplaythrough", "playing"]
      .forEach(function (ev) { v.addEventListener(ev, ready); });
    if (v.readyState >= 1) ready();

    function toggle(e) {
      if (e) e.stopPropagation();
      if (v.paused) {
        duckAmbient(); stopAllAudio("video");
        if (v.error) { retry(); return; }
        if (v.readyState === 0) { try { v.load(); } catch (err) {} }
        var pr = v.play();
        if (pr && pr.catch) pr.catch(function () { c.classList.remove("playing"); });
      } else v.pause();
    }
    btn.addEventListener("click", toggle);
    pp.addEventListener("click", function (e) { e.stopPropagation(); toggle(); wake(); });
    v.addEventListener("click", toggle);
    v.addEventListener("play",  function () {
      ready(); c.classList.add("playing", "started");
      pp.setAttribute("aria-label", "Pause"); wake();
    });
    v.addEventListener("pause", function () {
      c.classList.remove("playing"); c.classList.add("showing");
      clearTimeout(idle);
      pp.setAttribute("aria-label", "Play");
    });
    v.addEventListener("ended", function () {
      /* back to the photograph and the big control: the card is a picture
         again, not a stopped player */
      c.classList.remove("playing", "showing", "started");
      clearTimeout(idle);
      paintTime();
      /* back to the poster, so the page is the picture again rather than
         whatever black frame the clip happened to end on */
      try { v.currentTime = 0; } catch (err) {}
    });
    /* An error is not necessarily the end. A dropped connection mid-load
       raises exactly the same event as a file that cannot be decoded at
       all, and the first one is fixed by asking again -- so the control
       stays put and a tap retries. Only after it has genuinely failed
       twice does the card give up and put the slate back, which at least
       names the file that is missing. */
    var tries = 0;
    v.addEventListener("error", function () {
      c.classList.remove("ready", "playing");
      tries++;
      if (tries >= 3) {
        failed = true;
        btn.style.display = "none";
        bar.style.display = "none";
        c.classList.remove("hasposter");
      }
    });
    function retry() {
      if (failed) return false;
      if (!v.error) return false;
      try { v.load(); } catch (e) {}
      return true;
    }

    /* The poster is a background image rather than the video's own poster
       attribute: that way the still stays put underneath while the clip
       plays and fades back in when it ends, and a browser that decides
       not to honour poster= cannot leave a black hole in the page. WebP
       where it is taken, the JPEG beside it otherwise. */
    if (V.poster) {
      (function (src) {
        var webp = src.replace(/\.jpg$/, ".webp");
        var probe = new Image();
        probe.onload = function () {
          poster.style.backgroundImage = "url(" + probe.src + ")";
          c.classList.add("hasposter");
        };
        probe.onerror = function () {
          if (probe.src.indexOf(".webp") > -1) { probe.src = src; return; }
        };
        probe.src = (PHOTO_EXT[0] === "webp") ? webp : src;
      })(V.poster);
    }

    frame.insertBefore(v, frame.firstChild);
    return c;
  }

  /* ---- the music video in the drawer ---------------------------
     The real thumbnail stands in for the video, so the card looks
     like the song rather than like something still loading. The
     player only loads once she asks for it. */
  function buildMusicVideoCard() {
    var V = SB.video;
    var c = el("sb-w sb-w-video");
    c.innerHTML =
      '<div class="sb-vid-frame">' +
        '<img class="sb-vid-thumb" alt="" />' +
        '<div class="sb-vid-veil"></div>' +
        '<div class="sb-vid-meta">' +
          '<p class="sb-vid-kicker">MUSIC VIDEO</p>' +
          '<p class="sb-vid-title">' + V.title + "</p>" +
          '<p class="sb-vid-artist">' + V.artist + "</p>" +
        "</div>" +
        '<button class="sb-vid-play" aria-label="Play the music video">' +
          '<span class="sb-ico-play"></span></button>' +
      "</div>";

    var thumb = c.querySelector(".sb-vid-thumb");
    thumb.onerror = function () { c.classList.add("nothumb"); };
    thumb.src = "https://img.youtube.com/vi/" + V.youtubeId + "/hqdefault.jpg";

    var frame = c.querySelector(".sb-vid-frame");
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
    d.appendChild(buildMusicVideoCard());
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
    var card = document.querySelector("#sb-pin-modal .sb-pin-card");
    if (card) card.classList.toggle("note-only", !!pin.note);
    var photo = document.getElementById("sb-pin-photo");
    if (photo) {
      photo.innerHTML = "";
      if (pin.note) {
        var n = el("sb-pin-note");
        n.innerHTML = '<span class="sb-pin-note-mark"><svg class="gl gl-pin" aria-hidden="true"><use href="#ic-px-star"/></svg></span><p>' + pin.note + "</p>";
        photo.appendChild(n);
      } else {
        loadPhotoInto(photo, mem, function () {
          photo.innerHTML = '<span class="sb-photo-empty">' +
            '<span class="sb-slot-no">' + mem.n + '</span>' +
            '<span class="sb-slot-word">photo</span></span>';
        });
      }
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

  /* Her line for an empty frame — see SB.slotNotes. Never the file name. */
  function noteFor(n) {
    if (SB.slotNotes && SB.slotNotes[n]) return SB.slotNotes[n];
    var f = SB.slotNoteFallback || [];
    return f.length ? f[(n - 1) % f.length] : "";
  }

  function openLightbox(mem) {
    var box = document.getElementById("sb-lightbox");
    if (!box) return;
    var frame = box.querySelector(".sb-lb-frame");
    frame.innerHTML = "";
    loadPhotoInto(frame, mem, function () {
      frame.innerHTML = '<div class="sb-lb-empty"><span class="sb-slot-no">' +
        mem.n + '</span><span class="sb-slot-word">photo</span></div>';
    });
    box.querySelector(".sb-lb-title").textContent = mem.title || ("Photo " + mem.n);
    box.querySelector(".sb-lb-date").textContent = mem.date || "";
    box.querySelector(".sb-lb-text").textContent = mem.text || noteFor(mem.n);
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

  /* One butterfly. The wings are scalloped rather than smooth, carry
     spots and veining, and sit over a soft shadow so they read as
     painted rather than cut out. */
  function paintFly(ctx, x, y, s, flap, tilt, alpha) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(tilt);
    ctx.globalAlpha = alpha;
    var open = 0.34 + Math.abs(Math.sin(flap)) * 0.66;

    function wingPath(side) {
      /* upper wing, with a scalloped outer edge */
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.bezierCurveTo(s * 0.26, -s * 0.98, s * 0.92, -s * 0.92, s * 1.10, -s * 0.36);
      ctx.quadraticCurveTo(s * 1.14, -s * 0.22, s * 1.02, -s * 0.18);
      ctx.quadraticCurveTo(s * 1.10, -s * 0.06, s * 0.94, -s * 0.02);
      ctx.quadraticCurveTo(s * 1.00, s * 0.10, s * 0.82, s * 0.12);
      ctx.bezierCurveTo(s * 0.44, s * 0.18, s * 0.14, s * 0.08, 0, 0);
      ctx.closePath();
    }
    function lowerPath() {
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.bezierCurveTo(s * 0.34, s * 0.28, s * 0.84, s * 0.40, s * 0.78, s * 0.64);
      ctx.quadraticCurveTo(s * 0.72, s * 0.78, s * 0.58, s * 0.70);
      ctx.quadraticCurveTo(s * 0.56, s * 0.84, s * 0.42, s * 0.72);
      ctx.bezierCurveTo(s * 0.24, s * 0.56, s * 0.10, s * 0.28, 0, 0);
      ctx.closePath();
    }

    [-1, 1].forEach(function (side) {
      ctx.save();
      ctx.scale(side * open, 1);

      var g = ctx.createLinearGradient(0, -s * 0.8, s * 1.1, s * 0.2);
      g.addColorStop(0, "rgba(246,182,208,0.97)");
      g.addColorStop(0.38, "rgba(228,140,180,0.95)");
      g.addColorStop(0.72, "rgba(198,104,152,0.92)");
      g.addColorStop(1, "rgba(162,78,124,0.88)");
      ctx.fillStyle = g;
      wingPath(side); ctx.fill();

      var g2 = ctx.createLinearGradient(0, 0, s * 0.8, s * 0.7);
      g2.addColorStop(0, "rgba(232,150,186,0.92)");
      g2.addColorStop(1, "rgba(184,92,140,0.86)");
      ctx.fillStyle = g2;
      lowerPath(); ctx.fill();

      /* veins */
      ctx.strokeStyle = "rgba(140,62,104,0.38)";
      ctx.lineWidth = Math.max(0.5, s * 0.022);
      for (var v = 0; v < 5; v++) {
        ctx.beginPath();
        ctx.moveTo(s * 0.05, -s * 0.01);
        ctx.quadraticCurveTo(s * 0.52, -s * (0.66 - v * 0.17),
                             s * (1.00 - v * 0.09), -s * (0.36 - v * 0.13));
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.moveTo(s * 0.05, s * 0.02);
      ctx.quadraticCurveTo(s * 0.42, s * 0.34, s * 0.70, s * 0.60);
      ctx.stroke();

      /* the pale band and the eye spots */
      ctx.fillStyle = "rgba(255,232,242,0.55)";
      ctx.beginPath();
      ctx.ellipse(s * 0.74, -s * 0.42, s * 0.20, s * 0.09, -0.5, 0, 6.29);
      ctx.fill();
      ctx.fillStyle = "rgba(96,44,78,0.42)";
      [[0.86, -0.30, 0.055], [0.62, -0.58, 0.045], [0.60, 0.44, 0.04]].forEach(function (d) {
        ctx.beginPath();
        ctx.arc(s * d[0], s * d[1], s * d[2], 0, 6.29);
        ctx.fill();
      });

      ctx.strokeStyle = "rgba(120,52,92,0.3)";
      ctx.lineWidth = Math.max(0.5, s * 0.018);
      wingPath(side); ctx.stroke();
      lowerPath(); ctx.stroke();
      ctx.restore();
    });

    /* body: segmented, with a soft sheen */
    var bg = ctx.createLinearGradient(-s * 0.08, 0, s * 0.08, 0);
    bg.addColorStop(0, "rgba(72,38,56,0.95)");
    bg.addColorStop(0.45, "rgba(118,66,92,0.95)");
    bg.addColorStop(1, "rgba(66,34,52,0.95)");
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.ellipse(0, s * 0.06, s * 0.072, s * 0.38, 0, 0, 6.29);
    ctx.fill();
    ctx.fillStyle = "rgba(52,26,42,0.6)";
    for (var seg = 1; seg < 5; seg++) {
      ctx.beginPath();
      ctx.ellipse(0, s * (-0.16 + seg * 0.13), s * 0.062, s * 0.022, 0, 0, 6.29);
      ctx.fill();
    }
    ctx.fillStyle = "rgba(84,44,66,0.95)";
    ctx.beginPath(); ctx.arc(0, -s * 0.30, s * 0.075, 0, 6.29); ctx.fill();

    /* antennae, with clubbed tips */
    ctx.strokeStyle = "rgba(88,46,70,0.8)";
    ctx.lineWidth = Math.max(0.5, s * 0.026);
    [-1, 1].forEach(function (side) {
      ctx.beginPath();
      ctx.moveTo(0, -s * 0.32);
      ctx.quadraticCurveTo(side * s * 0.24, -s * 0.64, side * s * 0.36, -s * 0.58);
      ctx.stroke();
      ctx.fillStyle = "rgba(88,46,70,0.85)";
      ctx.beginPath(); ctx.arc(side * s * 0.36, -s * 0.58, s * 0.035, 0, 6.29); ctx.fill();
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
    for (var b = 0; b < 40; b++) {
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
    for (var b2 = 0; b2 < 78; b2++) {
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

    /* the candle — slim, with a melted rim and wax running down it */
    var candleW = ow * 0.42, candleTop = cy + oh * 0.24;
    var cg = ctx.createLinearGradient(cx - candleW / 2, 0, cx + candleW / 2, 0);
    cg.addColorStop(0, "#b9a382"); cg.addColorStop(0.20, "#e6d6b8");
    cg.addColorStop(0.46, "#fbf3e0"); cg.addColorStop(0.72, "#eadcbe");
    cg.addColorStop(1, "#ad9673");
    ctx.fillStyle = cg;
    ctx.beginPath();
    ctx.moveTo(cx - candleW / 2, candleTop);
    ctx.lineTo(cx + candleW / 2, candleTop);
    ctx.lineTo(cx + candleW / 2, Hh + 20);
    ctx.lineTo(cx - candleW / 2, Hh + 20);
    ctx.closePath(); ctx.fill();

    /* light thrown onto the wax by the flame above it */
    var lit = ctx.createRadialGradient(cx, candleTop, 1, cx, candleTop, candleW * 2.2);
    lit.addColorStop(0, "rgba(255,196,110,0.42)");
    lit.addColorStop(1, "rgba(255,180,90,0)");
    ctx.save();
    ctx.beginPath();
    ctx.rect(cx - candleW / 2, candleTop, candleW, Hh);
    ctx.clip();
    ctx.fillStyle = lit; ctx.fillRect(cx - candleW * 2, candleTop, candleW * 4, Hh);

    /* brushed streaks down the wax */
    for (var k = 0; k < 18; k++) {
      var kt = br();
      ctx.strokeStyle = "rgba(" + (kt > 0.5 ? "255,250,236," : "160,136,104,") + (0.05 + kt * 0.12) + ")";
      ctx.lineWidth = 1 + kt * 3;
      var kx = cx - candleW / 2 + kt * candleW;
      ctx.beginPath();
      ctx.moveTo(kx, candleTop + candleW * 0.1);
      ctx.lineTo(kx + (br() - 0.5) * 5, Hh);
      ctx.stroke();
    }
    ctx.restore();

    /* the melted rim, and drips over the edge */
    ctx.fillStyle = "#fdf7e6";
    ctx.beginPath();
    ctx.ellipse(cx, candleTop, candleW / 2, candleW * 0.15, 0, 0, 6.29);
    ctx.fill();
    ctx.fillStyle = "rgba(196,168,120,0.5)";
    ctx.beginPath();
    ctx.ellipse(cx, candleTop + candleW * 0.02, candleW * 0.30, candleW * 0.075, 0, 0, 6.29);
    ctx.fill();
    ctx.fillStyle = "#f8efd9";
    [[-0.30, 0.34], [0.24, 0.52], [0.38, 0.26]].forEach(function (d) {
      var dx = cx + candleW * d[0], dy = candleTop + candleW * 0.06;
      ctx.beginPath();
      ctx.moveTo(dx - candleW * 0.07, dy);
      ctx.quadraticCurveTo(dx - candleW * 0.09, dy + candleW * d[1] * 0.8,
                           dx, dy + candleW * d[1]);
      ctx.quadraticCurveTo(dx + candleW * 0.09, dy + candleW * d[1] * 0.8,
                           dx + candleW * 0.07, dy);
      ctx.closePath(); ctx.fill();
    });

    /* wick, leaning with the flame */
    var drift = Math.sin(t * 2.1) * candleW * 0.07 + Math.sin(t * 5.3) * candleW * 0.02;
    ctx.strokeStyle = "#3a2118";
    ctx.lineWidth = Math.max(1.6, candleW * 0.05);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(cx, candleTop - candleW * 0.02);
    ctx.quadraticCurveTo(cx + drift * 0.4, candleTop - candleW * 0.20,
                         cx + drift, candleTop - candleW * 0.32);
    ctx.stroke();
    ctx.lineCap = "butt";

    /* the flame, in layers: halo, body, cool base, hot core */
    var fh = candleW * (2.15 + Math.sin(t * 3.3) * 0.10 + Math.sin(t * 7.9) * 0.04);
    var fw = candleW * 0.46;
    var fx = cx + drift, fy = candleTop - candleW * 0.28;

    var halo = ctx.createRadialGradient(fx, fy - fh * 0.44, 1, fx, fy - fh * 0.44, fh * 2.9);
    halo.addColorStop(0, "rgba(255,206,124,0.40)");
    halo.addColorStop(0.42, "rgba(255,168,84,0.14)");
    halo.addColorStop(1, "rgba(255,150,70,0)");
    ctx.fillStyle = halo;
    ctx.beginPath(); ctx.arc(fx, fy - fh * 0.44, fh * 2.9, 0, 6.29); ctx.fill();

    function flameShape(sw, sh, oy) {
      ctx.beginPath();
      ctx.moveTo(fx, fy - sh + oy);
      ctx.bezierCurveTo(fx + sw * 0.88, fy - sh * 0.52 + oy,
                        fx + sw * 0.60, fy - sh * 0.04 + oy, fx, fy + oy);
      ctx.bezierCurveTo(fx - sw * 0.60, fy - sh * 0.04 + oy,
                        fx - sw * 0.88, fy - sh * 0.52 + oy, fx, fy - sh + oy);
      ctx.closePath();
    }

    var outer = ctx.createLinearGradient(0, fy - fh, 0, fy);
    outer.addColorStop(0, "rgba(255,244,206,0.95)");
    outer.addColorStop(0.26, "rgba(250,202,110,0.95)");
    outer.addColorStop(0.62, "rgba(230,150,58,0.9)");
    outer.addColorStop(1, "rgba(176,92,30,0.7)");
    ctx.fillStyle = outer;
    flameShape(fw, fh, 0); ctx.fill();

    /* the cool blue foot at the wick */
    var base = ctx.createRadialGradient(fx, fy - fh * 0.06, 1, fx, fy - fh * 0.06, fw * 0.7);
    base.addColorStop(0, "rgba(126,168,222,0.55)");
    base.addColorStop(1, "rgba(126,168,222,0)");
    ctx.fillStyle = base;
    ctx.beginPath(); ctx.arc(fx, fy - fh * 0.06, fw * 0.7, 0, 6.29); ctx.fill();

    /* the dark heart, then the bright core inside it */
    ctx.fillStyle = "rgba(178,96,32,0.20)";
    flameShape(fw * 0.60, fh * 0.50, -fh * 0.04); ctx.fill();
    var core = ctx.createLinearGradient(0, fy - fh * 0.86, 0, fy - fh * 0.04);
    core.addColorStop(0, "rgba(255,253,240,0.98)");
    core.addColorStop(0.45, "rgba(255,238,190,0.85)");
    core.addColorStop(1, "rgba(255,214,132,0.30)");
    ctx.fillStyle = core;
    flameShape(fw * 0.52, fh * 0.80, -fh * 0.05); ctx.fill();

    /* a thread of smoke lifting off the tip */
    for (var sm = 0; sm < 4; sm++) {
      var so = (sm - 1.5) * candleW * 0.06;
      ctx.strokeStyle = "rgba(214,196,190," + (0.055 - sm * 0.010).toFixed(3) + ")";
      ctx.lineWidth = candleW * (0.16 + sm * 0.10);
      ctx.beginPath();
      ctx.moveTo(fx + so * 0.2, fy - fh);
      ctx.bezierCurveTo(fx + so + Math.sin(t * 1.1 + sm) * candleW * 0.34, fy - fh * 1.5,
                        fx + so - Math.sin(t * 0.8 + sm) * candleW * 0.44, fy - fh * 2.0,
                        fx + so + Math.sin(t * 0.6 + sm) * candleW * 0.26, fy - fh * 2.6);
      ctx.stroke();
    }

    /* embers, drifting up out of the flame */
    for (var em = 0; em < 7; em++) {
      var ph = (t * (0.28 + em * 0.045) + em * 0.37) % 1;
      var ey = fy - fh * 0.8 - ph * oh * 0.62;
      var ex = fx + Math.sin(ph * 7 + em) * candleW * (0.28 + ph * 0.7);
      var er = candleW * 0.035 * (1 - ph * 0.7);
      ctx.fillStyle = "rgba(255," + Math.round(190 - ph * 60) + ",110," + (0.75 * (1 - ph)).toFixed(3) + ")";
      ctx.beginPath(); ctx.arc(ex, ey, Math.max(0.4, er), 0, 6.29); ctx.fill();
    }

    /* the butterflies, circling the flame */
    flies.forEach(function (f) {
      var a = f.a0 + t * f.spd;
      var x = fx + Math.cos(a) * ow * f.rx;
      var y = fy - fh * 1.34 + Math.sin(a * f.wob) * oh * f.ry;
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
        a0: i * 2.2, spd: 0.42 + i * 0.13, rx: 0.78 + i * 0.34, ry: 0.13 + i * 0.06,
        wob: 1.5 + i * 0.45, s: 0.40 - i * 0.075, flap: 5.2 + i * 1.2, ph: i * 1.9,
      });
    }
    introResize();
    ensureLinen(function () {
      if (introRaf) cancelAnimationFrame(introRaf);
      introRaf = requestAnimationFrame(introFrame);
    });
    window.addEventListener("resize", introResize);

    /* it stays lit until she touches it */
  }

  function endIntro(immediate) {
    if (introDone) return;
    introDone = true;
    var screen = document.getElementById("screen-scrapbook");
    if (screen) screen.classList.add("sb-intro-out");
    if (!built) buildNow();
    if (screen) screen.classList.add("sb-open");
    renderView();
    setTimeout(function () {
      if (introRaf) { cancelAnimationFrame(introRaf); introRaf = null; }
      window.removeEventListener("resize", introResize);
    }, immediate ? 0 : 900);
  }

  function stopIntro() {
    introDone = true;
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
  var views = [];             /* each view is the page indexes it shows */
  var viewIndex = 0;

  function pagesPerView() {
    return (window.matchMedia && window.matchMedia("(min-width: 760px) and (orientation: landscape)").matches) ? 2 : 1;
  }

  /* ---------------------------------------------------------------
     THE FRONT COVER — the first page of the book, not a screen you
     click past. Turning it is how you get in.
     --------------------------------------------------------------- */
  function buildFrontCover() {
    var page = el("sb-page sb-page-cover");
    page.style.backgroundImage = "url(" + PAPER.cover + ")";
    page.appendChild(el("sb-cover-rule"));

    var label = el("sb-cover-label");
    label.innerHTML =
      '<p class="sb-cover-kicker">— a love letter —</p>' +
      '<h1 class="sb-cover-title">for you,</h1>' +
      '<p class="sb-cover-sub">with love</p>';
    page.appendChild(label);

    [{ art: "lips", left: 68, top: 9,  w: 22, rot: 14 },
     { art: "lips", left: 10, top: 74, w: 24, rot: -8 }].forEach(function (p) {
      var e = el("sb-cover-sticker");
      e.style.left = p.left + "%"; e.style.top = p.top + "%";
      e.style.width = p.w + "%";
      e.style.setProperty("--rot", p.rot + "deg");
      var img = el("", "img"); img.src = STICK[p.art]; img.alt = "";
      e.appendChild(img);
      page.appendChild(e);
    });

    [{ left: 84, top: 5, s: 2.4 }, { left: 12, top: 90, s: 1.9 },
     { left: 22, top: 18, s: 1.5 }].forEach(function (p) {
      var st = el("sb-cover-star");
      st.style.left = p.left + "%"; st.style.top = p.top + "%";
      st.style.fontSize = p.s + "cqw";
      st.innerHTML = '<svg class="gl gl-pin" aria-hidden="true"><use href="#ic-px-star"/></svg>';
      page.appendChild(st);
    });

    var hint = el("sb-cover-hint");
    hint.innerHTML = '<span class="sb-cover-hint-corner" aria-hidden="true"></span>' +
      '<span>take the corner and pull it across</span>';
    page.appendChild(hint);
    return page;
  }

  function buildBook() {
    var spread = document.getElementById("sb-spread");
    if (!spread) return;
    spread.innerHTML = "";
    pageEls = [buildFrontCover()]
      .concat(PAGES.map(function (def, i) { return buildPage(def, i); }));
    pageEls.push(buildBackCover());
    pageEls.forEach(function (p) { spread.appendChild(p); });
    buildViews();
  }

  function totalPages() { return pageEls.length; }

  /* A real book: the cover on its own, then spreads, then the back
     cover on its own. On a phone every page stands alone. */
  function buildViews() {
    var n = totalPages();
    views = [];
    if (!n) return;
    if (perView === 1) {
      for (var i = 0; i < n; i++) views.push([i]);
      return;
    }
    views.push([0]);
    for (var j = 1; j < n - 1; j += 2) {
      views.push(j + 1 < n - 1 ? [j, j + 1] : [j]);
    }
    views.push([n - 1]);
  }

  function viewOf(pageIdx) {
    for (var i = 0; i < views.length; i++) {
      if (views[i].indexOf(pageIdx) !== -1) return i;
    }
    return 0;
  }

  function isClosed() { return views[viewIndex] && views[viewIndex].length === 1 && viewIndex === 0; }
  function canGo(dir) { return viewIndex + dir >= 0 && viewIndex + dir < views.length; }

  function setSlot(p, slot) {
    p.classList.remove("leftpage", "rightpage", "solo", "in-leaf");
    if (slot) p.classList.add(slot);
  }

  /* ---------------------------------------------------------------
     SIZE

     The book is measured here rather than in CSS, because it changes
     shape: closed it is one page wide, open it is two. Both states
     transition, so opening the cover widens the book as the cover
     swings over.
     --------------------------------------------------------------- */
  var pageH = 0, pageW = 0;

  function measure() {
    var host = document.getElementById("sb-book");
    var vw = host ? host.clientWidth : window.innerWidth;
    var vh = host ? host.clientHeight : window.innerHeight;
    if (perView === 2) {
      /* it should sit on the page, not fill it */
      pageH = Math.min(vh * 0.84, (vw * 0.74) / 1.5, 560);
    } else {
      pageH = Math.min(vh * 0.78, (vw * 0.86) / 0.75, 660);
    }
    pageW = pageH * 0.75;
  }

  /* where the spine sits, relative to the middle of the book */
  function spineOffset(idx) {
    if (perView === 1 || !views[idx]) return 0;
    if (views[idx].length === 2) return 0;
    return idx === 0 ? -pageW / 2 : pageW / 2;
  }

  function applySize() {
    var outer = document.getElementById("sb-book-outer");
    if (!outer) return;
    measure();
    var open = !(views[viewIndex] && views[viewIndex].length === 1) || perView === 1;
    var wide = perView === 2 && views[viewIndex] && views[viewIndex].length === 2;
    outer.style.height = pageH + "px";
    outer.style.width = (wide ? pageW * 2 : pageW) + "px";
    outer.style.setProperty("--page-w", pageW + "px");
    outer.style.setProperty("--book-shift", "0px");
    outer.classList.toggle("single", perView === 1 || !wide);
  }

  function renderView() {
    if (!views.length) buildViews();
    viewIndex = Math.max(0, Math.min(views.length - 1, viewIndex));
    var shown = views[viewIndex] || [0];
    var outer = document.getElementById("sb-book-outer");

    pageEls.forEach(function (p, i) {
      var at = shown.indexOf(i);
      p.classList.toggle("on", at !== -1);
      if (at === -1) { setSlot(p, null); return; }
      if (shown.length === 1) setSlot(p, "solo");
      else setSlot(p, at === 0 ? "leftpage" : "rightpage");
    });

    if (outer) {
      outer.classList.toggle("closed", shown.length === 1);
      outer.classList.toggle("at-back", viewIndex === views.length - 1 && views.length > 1);
    }
    var spine = document.querySelector("#screen-scrapbook .sb-spine");
    if (spine) spine.style.opacity = shown.length === 2 ? "" : "0";
    /* the cover carries its own note, so the corner hint waits until
       she is inside the book */
    var curl = document.getElementById("sb-curl");
    if (curl) curl.classList.toggle("off", !canGo(1) || viewIndex === 0);
    applySize();
    schedulePreTurn();
  }

  /* =======================================================================
     TURNING A PAGE

     The leaf carries the real page nodes on its two faces. Rotation
     alone reads as a rigid board, so the sheet also bends: it skews and
     leans as it passes the upright, its trailing edge curls, and a
     cylindrical highlight travels across it. --flip-p is the progress,
     --flip-lift peaks halfway, --flip-bend is signed for the lean.
     ======================================================================= */
  var flip = { on: false, dir: 0, from: 0, to: 0, p: 0, nodes: null };
  var dragState = null;
  var dragMoved = false;

  function els() {
    return {
      outer: document.getElementById("sb-book-outer"),
      a:     document.getElementById("sb-leaf-a"),
      b:     document.getElementById("sb-leaf-b"),
      spread: document.getElementById("sb-spread"),
    };
  }

  /* =======================================================================
     THE SHEET

     A page does not turn like a board on a hinge. It bends: the part by
     the spine has already swung over while the free edge is still
     trailing, so the sheet reads as a cylinder sweeping across the book.

     So each leaf is cut into vertical strips and every strip is placed on
     that cylinder. Walking out from the spine by arc length s, the sheet's
     tangent angle is

         α(s) = A − κ·s

     with A the angle at the spine and κ the curvature. Integrating gives
     the position of each strip:

         x(s) = ( sin A − sin(A − κs) ) / κ
         z(s) = ( cos(A − κs) − cos A ) / κ

     κ is zero at rest and peaks halfway through, which is exactly when the
     sheet is standing up and bent the most.
     ======================================================================= */
  var STRIPS = 0;

  /* How finely the sheet is cut. More strips is a smoother curve and more
     for the browser to draw, and what a given phone or laptop can afford
     is not knowable up front — so the turn measures its own frame pacing
     and settles on a number, the same way the 3D opening does. */
  var stripPref = null;

  function stripCount() {
    if (stripPref === null) {
      var small = window.matchMedia && window.matchMedia("(max-width: 760px)").matches;
      /* Higher than it was, for two reasons. The strips now span 144% of
         the page rather than 100%, so the same count would be a coarser
         cut; and he said the turn still reads as sliding panels, which is
         what too few strips looks like -- every joint is a visible kink,
         and the fewer of them there are the more each one shows. The
         tuner below still takes them away on a device that cannot afford
         them. */
      stripPref = small ? 13 : 18;
    }
    return stripPref;
  }

  function tuneStrips(avgFrameMs) {
    if (avgFrameMs > 28 && stripPref > 7) stripPref -= 2;
    else if (avgFrameMs < 15 && stripPref < 22) stripPref += 2;
  }

  /* Cut a page into strips, each one a window onto the same page.

     This is the expensive part of a turn — a page cloned once per strip —
     so it is done ahead of time, while she is looking at the spread, and
     the turn itself only has to adopt the result. */
  /* THE BLEED, AND WHY THE STICKERS USED TO VANISH MID-TURN.

     His words: "some parts of stickers or even photos have a bit of them
     in common with the one next to it, so when turning the page, that part
     starts lagging and disappears until the page returns to its state
     form."

     Fourteen pieces in this book are placed deliberately over the edge of
     their page -- a disco ball at left:-9, the vinyl rose at -12 -- because
     that overhang is what makes a scrapbook look stuck together by hand
     rather than laid out on a grid. At rest you see them. But the strips
     that carry the page through a turn were windows onto exactly 0..100%
     of it, so anything outside that box had no strip to ride on: it
     disappeared the instant the turn began and came back when it ended.

     So the strips cover more than the page now. They start BEFORE its
     leading edge and finish after it, and everything hanging over either
     side rides round with the sheet it is stuck to, which is what it does
     on a real page. */
  /* WHERE THE TURNING PAGE GETS CUT.

     At rest the pages live inside .sb-spread, which is inset:5px 6px with
     overflow:hidden -- so anything hanging over an edge is cut at the
     book's own boundary. The leaves are siblings of that spread, outside
     its clip entirely, which is why a sticker that is trimmed at rest came
     back whole the moment the page began to turn. His words: "the stickers
     showing their original size when flipping rather than the cut off size
     that fits in the page."

     So the strips are cut where the book cuts -- on all four sides, which
     means no bleed anywhere.

     I kept fifteen percent of it on the spine side for a while, reasoning
     that a piece crossing the gutter is stuck to this sheet and should
     travel with it. It should, in a real book. In this one it cannot,
     because nothing crosses the gutter at rest either: the pages are
     siblings and the neighbouring one is opaque, so whatever the right
     page spills past its left edge is simply covered by the left page.
     Carrying that spill round on the turn does not restore something the
     book lost -- it uncovers something the book never shows, and you get
     pieces of the page behind appearing in the middle of the book the
     moment a page starts to move. He photographed exactly that.

     Nothing hangs over any edge of a page in this book. So the sheet is
     the page, edge to edge, and nothing else. */
  var BLEED = 0;           /* the page and nothing but the page */

  /* Vertically there is no bleed at all, and that is deliberate.

     I gave it nine percent once, to stop the corner sticker on page six
     from being clipped as the sheet went over. It cured the wrong illness.
     The book cuts that corner at rest too -- .sb-spread does it -- so
     carrying it round on the turn did not restore something that had been
     lost, it revealed something that is meant to be trimmed, and the
     sticker grew a piece it does not have when the page is lying flat.

     The rule is simply: the turning sheet is cut wherever the resting page
     is cut. Top and bottom, that is the spread's own edge. */
  var VBLEED = 0;        /* none: the spread's top and bottom cut at rest */

  function buildStripFragment(pageNode, hingeRight) {
    if (!pageNode) return null;
    var frag = document.createDocumentFragment();
    STRIPS = stripCount();
    var span = 100 + BLEED;                /* the page, plus the gutter side */
    var vspan = 100 + VBLEED * 2;
    var d = span / STRIPS;                 /* strip width, in page-% */
    /* The bleed goes past the hinge and nowhere else. Both the window
       positions here and the arc in layoutLeaf are measured FROM the hinge
       -- which side of the screen that is has already been dealt with, by
       anchoring the strips to the right instead of the left and mirroring
       the arc. So a hinge-side bleed is the same negative number either
       way; making it conditional gave the two halves of one turn different
       shapes, the sheet bleeding over the gutter on the way up and cut off
       at it on the way down. */
    var first = -BLEED;

    /* THE PHOTOS WENT BLANK THE MOMENT A PAGE LIFTED.

       The page's own images are lazy: they wait until they are in view.
       That is right for a page lying in the book, and wrong for a copy of
       it sitting inside a strip -- a strip is a small, clipped, 3D-
       transformed box, and the browser is under no obligation to call
       anything inside it visible. So the clones sat there undecided and
       the sheet turned over with empty frames on it, filling back in only
       once the page came to rest. That is the photos "disappearing" on the
       turn. Every copy that rides on a turning sheet is eager, and decodes
       there and then -- the bytes are already in the cache, the original
       loaded them. */
    var master = pageNode.cloneNode(true);
    master.classList.add("in-leaf", "on");
    var mImgs = master.getElementsByTagName("img");
    for (var q = 0; q < mImgs.length; q++) {
      mImgs[q].loading = "eager";
      mImgs[q].decoding = "sync";
    }

    for (var i = 0; i < STRIPS; i++) {
      var startPct = first + i * d;        /* where this strip begins */
      var strip = el("sb-strip");
      /* the page's own height (VBLEED is nought), so the sheet is trimmed
         top and bottom exactly where the book trims it at rest */
      strip.style.top = -VBLEED + "%";
      strip.style.height = (100 + VBLEED * 2) + "%";
      /* The overlap has to cover the kink at every joint, and how big that
         kink is depends on how hard the sheet is bent. Without it the
         joins open into gaps you can see the page through and the sheet
         reads as a venetian blind instead of paper. */
      var sw = d * 1.06 + 0.4;             /* what the strip is really wide */
      strip.style.width = sw + "%";
      if (hingeRight) { strip.style.right = "0"; strip.style.transformOrigin = "right center"; }
      else            { strip.style.left  = "0"; strip.style.transformOrigin = "left center"; }

      var inner = el("sb-strip-inner");
      /* The inner is the whole page, shifted so this strip is a window onto
         its own slice of it. Both numbers are percentages OF THE STRIP, so
         they have to divide by the strip's real width -- dividing by d, the
         width a strip would be without the overlap, drew every page in the
         book 12% too wide and slid it sideways the moment it lifted. That
         is what made a trimmed sticker jump back to its full size on the
         turn: it was not the crop coming off, it was the whole page
         changing size under it. */
      inner.style.width = (100 / sw * 100).toFixed(3) + "%";
      inner.style[hingeRight ? "right" : "left"] = (-startPct / sw * 100).toFixed(3) + "%";
      /* and centre the page in the strip, for whatever vertical bleed
         there is -- none, as it stands */
      inner.style.top = (VBLEED / vspan * 100).toFixed(3) + "%";
      inner.style.height = (100 / vspan * 100).toFixed(3) + "%";

      inner.appendChild(master.cloneNode(true));
      strip.appendChild(inner);
      /* THE SHADE HAS TO STOP AT THE PAGE.

         inset:0 on this was the grey striped slab he photographed. A strip
         reaches past the page on the spine side, so the piece of a sticker
         that crosses the gutter has something to ride on -- and the shading
         layer was painting its light-and-dark gradient across every bit of
         that, including the empty margin where there is no paper at all.
         A row of translucent grey panels hanging off the book in mid-turn:
         it stopped looking like a page and started looking like glass.

         So the shade is sized to where the paper actually is inside this
         strip, and nowhere else. For the strips in the middle that is the
         whole strip; for the two on the ends it is the part that overlaps
         the page. */
      var shade = el("sb-strip-shade");
      var sL = Math.max(0, (0 - startPct) / sw * 100);
      var sR = Math.min(100, (100 - startPct) / sw * 100);
      shade.style.left = sL.toFixed(3) + "%";
      shade.style.width = Math.max(0, sR - sL).toFixed(3) + "%";
      shade.style.top = (VBLEED / vspan * 100).toFixed(3) + "%";
      shade.style.height = (100 / vspan * 100).toFixed(3) + "%";
      /* the lit cut edge is drawn from these too -- it was running the full
         height of the strip, which put a bright hairline in the air above
         and below the book */
      strip.style.setProperty("--pt", (VBLEED / vspan * 100).toFixed(3) + "%");
      strip.style.setProperty("--ph", (100 / vspan * 100).toFixed(3) + "%");
      strip.appendChild(shade);
      /* The light on this strip is written here, not on the strip. Custom
         properties inherit, and a strip's subtree is an entire copy of the
         page -- so setting the four light values on the strip, sixty times
         a second, told the browser to restyle a couple of hundred nodes
         per strip per frame for four numbers that only one childless
         element ever reads. */
      strip._shade = shade;
      frag.appendChild(strip);
    }
    return frag;
  }

  function fillLeaf(leaf, frag) {
    leaf.innerHTML = "";
    if (!frag) { leaf.dataset.empty = "1"; return; }
    delete leaf.dataset.empty;
    leaf.appendChild(frag);
  }

  /* what the next turn will need, built during the quiet in between */
  var preTurn = null, preTimer = null;

  function pagesForTurn(dir) {
    if (!views.length || !canGo(dir)) return null;
    var from = views[viewIndex], to = views[viewIndex + dir];
    if (perView === 1) return { lift: pageEls[from[0]], back: null, aR: false, bR: dir > 0 };
    if (dir > 0) return {
      lift: pageEls[from[from.length - 1]], back: pageEls[to[0]], aR: false, bR: true };
    return { lift: pageEls[from[0]], back: pageEls[to[to.length - 1]], aR: true, bR: false };
  }

  /* THE PAGE THAT COMES OUT FROM UNDER THE SHEET.

     Its photographs are lazy, and a lazy image starts loading when it
     comes into view -- which is the exact moment the sheet lifts off it.
     So the page it uncovered spent the turn showing empty frames and
     filled in afterwards, which is the photos "disappearing" on the turn
     seen from the other side. Waking them while the book is sitting still
     costs nothing anybody can feel and the page is ready before it is
     ever seen. */
  function warmView(i) {
    var v = views[i];
    if (!v) return;
    v.forEach(function (pi) {
      var pg = pageEls[pi];
      if (!pg || pg.dataset.warm) return;
      pg.dataset.warm = "1";
      var imgs = pg.getElementsByTagName("img");
      for (var k = 0; k < imgs.length; k++) {
        var im = imgs[k];
        im.loading = "eager";
        /* Loaded is not the same as ready to show. Decoding is asynchronous
           by default, so an image can be fully downloaded and still take a
           frame or two to turn into pixels -- which is long enough to see a
           blank frame where a photograph should be. Decoding it now means
           it is already a bitmap by the time the sheet lifts off it. */
        if (im.decode) { try { im.decode().catch(function () {}); } catch (e) {} }
      }
    });
  }

  function schedulePreTurn() {
    clearTimeout(preTimer);
    preTurn = null;
    preTimer = setTimeout(function () {
      if (flip.on || turning) return;
      warmView(viewIndex);
      warmView(viewIndex + 1);
      warmView(viewIndex - 1);
      var w = pagesForTurn(1);
      if (!w) return;
      preTurn = {
        at: viewIndex,
        a: buildStripFragment(w.lift, w.aR),
        b: buildStripFragment(w.back, w.bR),
      };
    }, 260);
  }

  /* HOW A TURNING SHEET IS LIT.

     (The gradients themselves live in the stylesheet and only these
     numbers change per frame: building a gradient string in script would
     have the browser reparse it sixty times a second.)

     Two layers ride on every strip: how much light it has lost by facing
     away from us, and the highlight that slides along the curl. They used
     to peak at the same place -- both hit their maximum at ninety degrees,
     so the steepest part of the sheet took two thirds of a dark wash AND
     half a white one on top of it, and came out a flat grey that read as
     tracing paper rather than a page. Paper does not do that. It goes
     darker as it turns away, and the highlight is a glancing thing that
     happens on the way and is gone before the sheet is edge on. */
  function shadeAt(a) {
    return Math.max(0, Math.min(0.72, 0.58 * (1 - Math.cos(a))));
  }
  function sheenAt(a) {
    var sn = Math.max(0, Math.sin(a));
    /* a narrow band around 62 degrees -- the angle at which a sheet of
       paper actually catches the light and throws it back at you */
    var t = (a - 1.08) / 0.34;
    var crest = 0.15 * Math.exp(-t * t);
    /* and a whisper of it over the rest of the curl, so the crest has
       something to sit on rather than appearing out of flat shade */
    var body = 0.05 * sn * sn * sn;
    return crest + body;
  }

  /* place every strip on the cylinder, and light it by how it faces us */
  function layoutLeaf(leaf, A, kappa, W, hingeRight) {
    if (!leaf || leaf.dataset.empty) return;
    var strips = leaf.children, n = strips.length;
    if (!n) return;
    var span = 1 + BLEED / 100;
    var d = (W * span) / n;
    var s0 = -W * (BLEED / 100);          /* measured from the hinge, both ways */
    var sign = hingeRight ? -1 : 1;
    for (var i = 0; i < n; i++) {
      var s = s0 + i * d;
      var aTan, x, z;
      if (s < 0) {
        /* Behind the leading edge -- the part hanging over the gutter. The
           sheet is not bent back there, it lies flat along the spine, so
           these strips run straight off the first one's tangent. Curving
           them backwards would fold the overhang the wrong way. */
        aTan = A;
        x = s * Math.cos(A);
        z = s * Math.sin(A);
      } else if (Math.abs(kappa) < 1e-6) {
        aTan = A; x = s * Math.cos(A); z = s * Math.sin(A);
      } else {
        aTan = A - kappa * s;
        x = (Math.sin(A) - Math.sin(A - kappa * s)) / kappa;
        z = (Math.cos(A - kappa * s) - Math.cos(A)) / kappa;
      }
      var st = strips[i];
      st.style.transform =
        "translate3d(" + (sign * x).toFixed(2) + "px,0," + z.toFixed(2) + "px)" +
        " rotateY(" + (sign * -aTan * 180 / Math.PI).toFixed(2) + "deg)";

      /* A surface turned away from us loses light. Shading each strip
         flat would band the sheet, so every strip runs from its own angle
         to the next one's — the joins then match and the light reads as
         one continuous curve. */
      var sEnd = s + d;
      var aEnd = sEnd <= 0 ? A : A - kappa * sEnd;
      var st2 = (st._shade || st).style;
      st2.setProperty("--d0", shadeAt(aTan).toFixed(3));
      st2.setProperty("--d1", shadeAt(aEnd).toFixed(3));
      st2.setProperty("--s0", sheenAt(aTan).toFixed(3));
      st2.setProperty("--s1", sheenAt(aEnd).toFixed(3));
      /* the cut edge, on the outermost strip only: brightest when the
         sheet is side-on to us, which is when you would really see it,
         and gone by the time the page is flat either way */
      if (i === n - 1) {
        /* this one is read by the strip's own ::after, so it does belong
           on the strip -- and it is one strip, once a frame */
        st.style.setProperty("--edge", Math.max(0, Math.sin(aEnd)).toFixed(3));
      }
    }
  }

  function setFlipProgress(p) {
    var e = els();
    if (!e.a || !e.outer) return;
    flip.p = p;

    var half = p < 0.5;
    /* The width of the sheet itself, not of the book's half. The boards
       overhang the text block, so the leaf is narrower than pageW by that
       overhang -- and the strips are placed in real pixels, so getting
       this wrong slides the whole page sideways as it lifts. */
    var W = flip.W || pageW || 1;
    /* The sheet is straight at either end and bent in between -- but not
       symmetrically. A page resists at first, held by the spine and its
       own stiffness, and then gives: the flop comes late, not halfway. So
       the curvature peaks past the middle rather than at it, and it goes a
       little deeper than it used to now that the crest highlight has
       something to run along. */
    var bend = Math.sin(Math.PI * Math.pow(p, 0.82));
    /* 0.95 was the original depth and it is as far as this construction
       goes cleanly: the sheet is cut into flat strips, so every joint is a
       kink, and past about this curvature the kinks open into seams you
       can see the page through however much the strips overlap. The flop
       coming late (the power above) is what buys the paper feel here, not
       bending it harder. */
    var kappa = (0.97 / W) * bend;

    var hasB = !!(e.b && !e.b.dataset.empty);
    e.a.classList.toggle("on", half);
    e.b.classList.toggle("on", !half && hasB);

    if (half) {
      layoutLeaf(e.a, Math.PI * p, kappa, W, flip.aHingeRight);
    } else if (hasB) {
      layoutLeaf(e.b, Math.PI * (1 - p), kappa, W, flip.bHingeRight);
    }

    e.outer.style.setProperty("--flip-p", p.toFixed(4));
    e.outer.style.setProperty("--flip-lift", Math.sin(Math.PI * p).toFixed(4));
    if (flip.shift) {
      e.outer.style.setProperty("--book-shift",
        (flip.shift * (1 - p)).toFixed(2) + "px");
    }
  }

  function beginTurn(dir) {
    if (flip.on || turning) return false;
    if (!canGo(dir)) return false;
    var e = els();
    if (!e.a || !e.b) return false;

    var from = views[viewIndex], to = views[viewIndex + dir];

    var lifting, backside, staying, stayingSlot, revealed, revealedSlot;
    if (perView === 1) {
      lifting = pageEls[from[0]];
      backside = null;
      staying = null; revealed = pageEls[to[0]]; revealedSlot = "solo";
    } else if (dir > 0) {
      lifting  = pageEls[from[from.length - 1]];
      backside = pageEls[to[0]];
      staying  = from.length === 2 ? pageEls[from[0]] : null;
      stayingSlot = "leftpage";
      revealed = to.length === 2 ? pageEls[to[1]] : null;
      revealedSlot = "rightpage";
    } else {
      lifting  = pageEls[from[0]];
      backside = pageEls[to[to.length - 1]];
      staying  = from.length === 2 ? pageEls[from[1]] : null;
      stayingSlot = "rightpage";
      revealed = to.length === 2 ? pageEls[to[0]] : null;
      revealedSlot = "leftpage";
    }

    /* which edge each sheet is hinged on — always the spine */
    flip.aHingeRight = (dir < 0 && perView === 2);
    flip.bHingeRight = (dir > 0);

    if (dir > 0 && preTurn && preTurn.at === viewIndex) {
      fillLeaf(e.a, preTurn.a);
      fillLeaf(e.b, preTurn.b);
    } else {
      fillLeaf(e.a, buildStripFragment(lifting, flip.aHingeRight));
      fillLeaf(e.b, buildStripFragment(backside, flip.bHingeRight));
    }
    preTurn = null;

    pageEls.forEach(function (p) {
      if (p === staying)  { p.classList.add("on"); setSlot(p, perView === 1 ? "solo" : stayingSlot); }
      else if (p === revealed) { p.classList.add("on"); setSlot(p, perView === 1 ? "solo" : revealedSlot); }
      else { p.classList.remove("on"); setSlot(p, null); }
    });

    flip.on = true; flip.dir = dir; flip.from = viewIndex; flip.to = viewIndex + dir;
    var scr = document.getElementById("screen-scrapbook");
    if (scr) scr.classList.add("sb-turning");
    e.outer.classList.add("flipping");
    e.outer.classList.toggle("flip-back", dir < 0);
    /* The book takes its new width at once, and slides so the spine
       stays exactly where it was — otherwise opening the cover drags the
       whole book sideways under the turning sheet. */
    var toWide = perView === 2 && views[flip.to].length === 2;
    flip.shift = spineOffset(flip.from) - spineOffset(flip.to);
    /* the board overhang holds still for the whole turn -- renderView is
       what changes it, and that runs once the turn is over */
    flip.W = Math.max(1, pageW -
      (parseFloat(getComputedStyle(e.outer).getPropertyValue("--board-x")) || 0));
    e.outer.style.setProperty("--page-w", pageW + "px");
    e.outer.style.width = (toWide ? pageW * 2 : pageW) + "px";
    e.outer.classList.toggle("single", perView === 1 || !toWide);
    setFlipProgress(0);
    return true;
  }

  function endTurn(complete) {
    var e = els();
    if (!flip.on) return;
    if (e.a) { e.a.innerHTML = ""; e.a.classList.remove("on"); delete e.a.dataset.empty; }
    if (e.b) { e.b.innerHTML = ""; e.b.classList.remove("on"); delete e.b.dataset.empty; }
    if (e.outer) {
      e.outer.classList.remove("flipping", "flip-back");
      ["--flip-p", "--flip-lift"].forEach(function (v) { e.outer.style.removeProperty(v); });
    }
    var scr = document.getElementById("screen-scrapbook");
    if (scr) scr.classList.remove("sb-turning");
    if (complete) viewIndex = flip.to;
    flip.on = false; flip.shift = 0;
    renderView();
  }

  function settle(to, done) {
    var from = flip.p;
    var dist = Math.abs(to - from);
    var dur = Math.max(280, Math.min(640, dist * 620));
    var t0 = null, frames = 0;
    turning = true;
    (function step(now) {
      if (t0 === null) t0 = now;
      frames++;
      var k = Math.min(1, (now - t0) / dur);
      /* paper does not snap — it decelerates long and settles */
      var eased = k < 0.5
        ? 4 * k * k * k
        : 1 - Math.pow(-2 * k + 2, 3) / 2;
      setFlipProgress(from + (to - from) * eased);
      if (k < 1) requestAnimationFrame(step);
      else {
        turning = false;
        /* a long settle is a fair sample of what this device can do */
        if (dist > 0.5 && frames > 3) tuneStrips((now - t0) / frames);
        done();
      }
    })(performance.now());
  }

  function animateTurn(dir) {
    if (!beginTurn(dir)) return;
    settle(1, function () { endTurn(true); });
  }

  function next() { animateTurn(1); }
  function prev() { animateTurn(-1); }

  function goTo(i) {
    var target = Math.max(0, Math.min(views.length - 1, i));
    if (target === viewIndex) return;
    animateTurn(target > viewIndex ? 1 : -1);
  }

  /* ---- dragging ---- */
  function bookRect() {
    var o = document.getElementById("sb-book-outer");
    return o ? o.getBoundingClientRect() : null;
  }

  function onDown(ev) {
    if (flip.on || turning) return;
    var r = bookRect();
    if (!r) return;
    var x = ev.clientX, y = ev.clientY;
    if (x < r.left || x > r.right || y < r.top || y > r.bottom) return;
    dragMoved = false;
    dragState = { x0: x, y0: y, t0: performance.now(), r: r, dir: 0, active: false };
  }

  function onMove(ev) {
    if (!dragState) return;
    var dx = ev.clientX - dragState.x0;
    var dy = ev.clientY - dragState.y0;
    if (!dragState.active) {
      if (Math.abs(dx) < 10 || Math.abs(dx) < Math.abs(dy)) return;
      var dir = dx < 0 ? 1 : -1;
      if (!beginTurn(dir)) { dragState = null; return; }
      dragState.active = true;
      dragState.dir = dir;
      dragMoved = true;
    }
    var span = dragState.r.width * (dragState.r.width > pageW * 1.4 ? 0.5 : 1);
    var travel = dragState.dir > 0 ? -dx : dx;
    setFlipProgress(Math.max(0, Math.min(1, travel / span)));
    if (ev.cancelable) ev.preventDefault();
  }

  function onUp(ev) {
    if (!dragState) return;
    var st = dragState;
    dragState = null;
    /* the page only turns if it was actually pulled */
    if (!st.active) return;
    var speed = Math.abs(ev.clientX - st.x0) / Math.max(1, performance.now() - st.t0);
    var go = flip.p > 0.32 || speed > 0.5;
    settle(go ? 1 : 0, function () { endTurn(go); });
    setTimeout(function () { dragMoved = false; }, 60);
  }

  function onResize() {
    var want = pagesPerView();
    if (want !== perView) {
      perView = want;
      var page = (views[viewIndex] || [0])[0];
      buildViews();
      viewIndex = viewOf(page);
    }
    renderView();
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

    job(function () { PAPER.rose   = crumpled("#b9707f", "rgba(255,226,232,0.32)", "rgba(76,20,36,0.34)", 3); });
    job(function () { PAPER.rose2  = crumpled("#a96274", "rgba(252,220,228,0.28)", "rgba(66,16,32,0.36)", 31); });
    job(function () { PAPER.mauve  = crumpled("#8d6480", "rgba(240,220,238,0.26)", "rgba(46,14,38,0.36)", 11); });
    job(function () { PAPER.cream  = crumpled("#efe1c6", "rgba(255,252,242,0.62)", "rgba(150,118,74,0.24)", 7, 0, 0, { print: ticking("#8a6a44") }); });
    job(function () { PAPER.ivory  = crumpled("#f4ecdc", "rgba(255,255,250,0.7)",  "rgba(150,125,85,0.18)", 41); });
    job(function () { PAPER.blush  = crumpled("#f0d6d4", "rgba(255,252,250,0.55)", "rgba(158,100,96,0.24)", 19, 0, 0, { print: ditsyFloral("#b4707e") }); });
    job(function () { PAPER.note   = crumpled("#fbf3e0", "rgba(255,255,255,0.7)",  "rgba(150,125,85,0.18)", 23, 340, 240); });
    job(function () { PAPER.news   = newsprint(13); });
    job(function () { PAPER.grid   = gridPaper(29); });
    job(function () { PAPER.mauveCloth = denimCloth(37); });
    /* and one dyed sheet per page, in that page's own colour */
    buildPagePapers(job);
    /* The cover was #b06a7c: a dusty mid mauve that came out at 37%
       saturation with a purple lean, and next to the cream pages and the
       gold it read as the one dull thing in the book. This is the same
       cloth dyed properly — a rose-wine that sits between --rose-deep and
       the gate's wine, with gold-cream threads instead of pink ones. The
       cover text is on its own paper label, so going deeper costs no
       contrast and the label and the little stars gain some. */
    /* THE COVER WAS BRICK, AND THE PAGES ARE ROSE.

       Measured rather than argued: every paper in the book renders between
       hue 349 and 359 -- the pink side of red. The cover rendered at hue
       1.7, the orange side, and that few degrees is the whole difference
       between rose-wine and dusty brick. Two things put it there. The dye
       #9c4750 is itself at hue 6, and the thread lit through it was a
       gold-cream at hue 38, which dragged the whole cloth further round.

       So: the dye moves to the rose side of red, and the thread is a warm
       blush rather than a gold one. It is still a deep, rich cloth against
       cream pages -- it is now the same red as the book it holds. */
    job(function () { PAPER.cover = bookCloth(53, "#a3395a", "rgba(255,214,206,0.13)", "rgba(52,12,26,0.17)"); });
    job(function () {
      PAPER.endpaper = marbled(71);
      var ep = document.getElementById("sb-endpaper");
      if (ep) ep.style.backgroundImage = "url(" + PAPER.endpaper + ")";
    });

    job(function () { STICK.disco    = discoBall(140); });
    /* This one took the default #141414 -- a pure black disc, and the two
       pages it sits on are rose. It was the heaviest, coldest thing left in
       the book once the chrome had been warmed. The other two records are
       already wine; this is the same family, kept darkest of the three so
       the "8" still reads. */
    job(function () { STICK.vinyl8   = vinyl(190, { body: "#2a1119", label: "#f6e7dc", text: "8" }); });
    job(function () { STICK.vinylRose= vinyl(230, { body: "#5b2434", label: "#f2ddd2", text: "" }); });
    job(function () { STICK.vinylLtd = vinyl(200, { body: "#3a1d28", label: "#f2e4d6", text: "" }); });
    job(function () { STICK.lipInk   = lipStamp(120, "#8e3b50"); });
    job(function () { STICK.rose     = chromeRose(150); });
    job(function () { STICK.flowers  = pressedFlowers(200); });
    job(function () { STICK.bouquet  = bouquet(260, 380); });
    job(function () { STICK.starS    = starArt(90, "silver"); });
    job(function () { STICK.starG    = starArt(70, "gold"); });
    job(function () { STICK.starD    = starArt(100, "rose"); });
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

    /* dragging a page. Pointer events cover mouse, pen and touch alike,
       so there is only one path to get right. */
    var outer = document.getElementById("sb-book-outer");
    if (outer) {
      outer.addEventListener("pointerdown", onDown);
      window.addEventListener("pointermove", onMove, { passive: false });
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", function () {
        if (dragState && dragState.active) settle(0, function () { endTurn(false); });
        dragState = null;
      });
      /* a drag must never register as a tap on a photo */
      outer.addEventListener("click", function (e) {
        if (dragMoved) { e.stopPropagation(); e.preventDefault(); }
      }, true);
    }
  }

  function start() {
    var screen = document.getElementById("screen-scrapbook");
    if (screen) {
      screen.classList.remove("sb-open", "sb-intro-out", "sb-drawer-on");
    }
    closeNote(); closePin(); closeLightbox();
    toggleDrawer(false);
    viewIndex = 0;
    perView = pagesPerView();
    buildViews();
    startIntro();          /* on screen immediately */
    scheduleBuild();       /* everything else, spread across frames */
  }

  function stop() {
    stopIntro();
    stopAllAudio(null);
    /* the embedded player keeps going unless it is taken out */
    var frames = document.querySelectorAll("#screen-scrapbook .sb-vid-frame iframe");
    Array.prototype.forEach.call(frames, function (f) { f.remove(); });
    drawerBuilt = false;
    var d = document.getElementById("sb-drawer");
    if (d) d.innerHTML = "";
    toggleDrawer(false);
  }

  api.start = start;
  api.stop = stop;
  api.next = next;
  api.prev = prev;
  api.closeLightbox = closeLightbox;
  api.skipIntro = function () { endIntro(false); };
  /* a hatch for tools/turnshot.js: hold a turn open at a fixed progress so
     the bend and the light on it can be looked at rather than guessed at.
     Nothing in the page calls it. */
  api.__holdTurn = function (dir, p) {
    if (!flip.on && !beginTurn(dir)) return false;
    setFlipProgress(p);
    return true;
  };
  api.__releaseTurn = function () { if (flip.on) endTurn(false); };
  return api;
})();
