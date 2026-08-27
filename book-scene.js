/* =========================================================================
   BOOK-SCENE.JS — the 3D cinematic intro.

   An ancient leather tome on a dark forest floor. Idle with drifting
   embers, then: clasp releases, cover swings open, pages fan over in an
   arc, and golden light erupts from the spine and fills the frame.

   Everything here is procedural. No external image files are used by the
   3D scene — every map is a CanvasTexture drawn at runtime.

   Requires vendor/three.bundle.js (three r180 + postprocessing addons,
   exposed as window.THREE).

   Public hooks used by script.js:
     window.skipBookIntro()   — stops the render loop and frees GPU memory
     window.finishBookIntro() — defined in script.js; called once the
                                climax flash begins, to hand off to the
                                rest of the site (passcode gate).
   ========================================================================= */
(function () {
  "use strict";

  var canvas = document.getElementById("book-canvas");
  var loadingEl = document.getElementById("book-loading");
  var promptEl = document.getElementById("book-click-prompt");

  /* Bail out gracefully to the rest of the site if 3D isn't possible. */
  function bail(reason) {
    if (reason) console.warn("Book intro skipped:", reason);
    if (loadingEl) loadingEl.textContent = "Continuing…";
    window.skipBookIntro = function () {};
    setTimeout(function () {
      if (window.finishBookIntro) window.finishBookIntro();
    }, 600);
  }

  if (typeof THREE === "undefined" || !canvas) { bail("three.js not loaded"); return; }
  try {
    var probe = document.createElement("canvas");
    if (!(probe.getContext("webgl2") || probe.getContext("webgl"))) { bail("no WebGL"); return; }
  } catch (e) { bail("no WebGL"); return; }

  try { runScene(); }
  catch (err) { console.error("Book scene failed:", err); bail(null); }

  /* ======================================================================
     SCENE
     ====================================================================== */
  function runScene() {

    /* --------------------------------------------------------------------
       QUALITY TIERS
       Post-processing is the expensive part. Rather than drop frames on a
       phone, we drop features — in the order that costs the least look.
       -------------------------------------------------------------------- */
    var isCoarse = window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
    var smallScreen = Math.min(window.innerWidth, window.innerHeight) < 520;
    var lowCores = (navigator.hardwareConcurrency || 8) <= 4;
    var reducedMotion = window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    var TIER = (isCoarse && (smallScreen || lowCores)) ? "low" : (isCoarse ? "mid" : "high");

    var Q = ({
      high: { dpr: 2.0, tex: 1024, shadow: 2048, msaa: 4, bloom: true, dof: true,
              shafts: 7, embers: 220, heroPages: 7, envSize: 256, groundDetail: 220 },
      mid:  { dpr: 1.75, tex: 768, shadow: 1024, msaa: 0, bloom: true, dof: false,
              shafts: 5, embers: 140, heroPages: 6, envSize: 128, groundDetail: 140 },
      low:  { dpr: 1.4, tex: 512, shadow: 512, msaa: 0, bloom: true, dof: false,
              shafts: 4, embers: 90, heroPages: 5, envSize: 128, groundDetail: 80 },
    })[TIER];

    /* --------------------------------------------------------------------
       BOOK DIMENSIONS
       The spine is a line running along Z at x = SPINE_X. Covers and pages
       hinge about that line — i.e. they rotate about the Z axis, which
       swings them up and over. (Rotating about Y would only spin them flat
       against the ground, which is not what opening a book looks like.)
       -------------------------------------------------------------------- */
    var BOOK_W = 0.86;          // spine to free edge
    var BOOK_H = 1.16;          // page height, laid out along Z
    var COVER_THICK = 0.028;
    var PAGE_BLOCK = 0.115;     // total thickness of the paper block
    var SPINE_X = -BOOK_W / 2;

    /* --------------------------------------------------------------------
       RENDERER — ACES Filmic + correct color space.
       This is the single biggest change from the old scene, which had no
       tone mapping at all: every highlight clipped flat to paper-white.
       -------------------------------------------------------------------- */
    var renderer = new THREE.WebGLRenderer({
      canvas: canvas,
      antialias: false,             // the composer handles AA (MSAA target / SMAA)
      powerPreference: "high-performance",
      stencil: false,
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, Q.dpr));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setClearColor(0x000000, 1);

    var maxAniso = renderer.capabilities.getMaxAnisotropy();
    var bootT0 = performance.now();
    var bootMarks = {};
    function mark(name) { bootMarks[name] = +(performance.now() - bootT0).toFixed(1); }

    var scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x0a0f0d, 0.155);

    var camera = new THREE.PerspectiveCamera(30, window.innerWidth / window.innerHeight, 0.05, 40);

    var disposables = [];
    function track(x) { disposables.push(x); return x; }

    /* ====================================================================
       PROCEDURAL TEXTURES
       ==================================================================== */
    function makeCanvas(w, h, draw) {
      var c = document.createElement("canvas");
      c.width = w; c.height = h;
      draw(c.getContext("2d"), w, h);
      return c;
    }

    function texFrom(c, colorSpace) {
      var t = new THREE.CanvasTexture(c);
      if (colorSpace) t.colorSpace = colorSpace;
      t.anisotropy = Math.min(maxAniso, 8);
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      return track(t);
    }

    /* Sobel a greyscale height canvas into a tangent-space normal map.
       This is what gives leather its grain and parchment its fibre — the
       old scene had no normal maps at all, which is most of why everything
       read as plastic. */
    function heightToNormal(srcCanvas, strength) {
      var w = srcCanvas.width, h = srcCanvas.height;
      var src = srcCanvas.getContext("2d").getImageData(0, 0, w, h).data;
      var out = makeCanvas(w, h, function () {});
      var octx = out.getContext("2d");
      var img = octx.createImageData(w, h);
      var d = img.data;
      function lum(x, y) {
        x = (x + w) % w; y = (y + h) % h;
        var i = (y * w + x) * 4;
        return (src[i] * 0.299 + src[i + 1] * 0.587 + src[i + 2] * 0.114) / 255;
      }
      for (var y = 0; y < h; y++) {
        for (var x = 0; x < w; x++) {
          var tl = lum(x - 1, y - 1), t = lum(x, y - 1), tr = lum(x + 1, y - 1);
          var l = lum(x - 1, y), r = lum(x + 1, y);
          var bl = lum(x - 1, y + 1), b = lum(x, y + 1), br = lum(x + 1, y + 1);
          var dx = (tr + 2 * r + br) - (tl + 2 * l + bl);
          var dy = (bl + 2 * b + br) - (tl + 2 * t + tr);
          var nx = -dx * strength, ny = -dy * strength, nz = 1.0;
          var len = Math.sqrt(nx * nx + ny * ny + nz * nz);
          var i2 = (y * w + x) * 4;
          d[i2] = ((nx / len) * 0.5 + 0.5) * 255;
          d[i2 + 1] = ((ny / len) * 0.5 + 0.5) * 255;
          d[i2 + 2] = ((nz / len) * 0.5 + 0.5) * 255;
          d[i2 + 3] = 255;
        }
      }
      octx.putImageData(img, 0, 0);
      return out;
    }

    /* Value-noise fBm. Each octave is rendered tiny on an offscreen canvas
       and scaled up with bilinear smoothing — smooth and fast. (Setting
       ctx.filter="blur()" and drawing thousands of rects instead triggers a
       full-surface blur per rect and locks up the main thread for minutes.) */
    var _noiseScratch = document.createElement("canvas");
    function fbmNoise(ctx, w, h, octaves, baseCell, alpha) {
      var sc = _noiseScratch, sctx = sc.getContext("2d");
      ctx.save();
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      for (var o = 0; o < octaves; o++) {
        var cell = Math.max(2, baseCell / Math.pow(2, o));
        var cw = Math.max(2, Math.ceil(w / cell)), ch = Math.max(2, Math.ceil(h / cell));
        sc.width = cw; sc.height = ch;
        var img = sctx.createImageData(cw, ch), d = img.data;
        for (var i = 0; i < cw * ch; i++) {
          var v = (Math.random() * 255) | 0;
          d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = v;
          d[i * 4 + 3] = 255;
        }
        sctx.putImageData(img, 0, 0);
        ctx.globalAlpha = alpha / Math.pow(1.8, o);
        ctx.drawImage(sc, 0, 0, cw, ch, 0, 0, w, h);
      }
      ctx.restore();
    }

    function speckle(ctx, w, h, count, fn) {
      for (var i = 0; i < count; i++) {
        var x = Math.random() * w, y = Math.random() * h;
        ctx.fillStyle = fn();
        ctx.fillRect(x, y, 1 + Math.random() * 1.5, 1 + Math.random() * 1.5);
      }
    }

    var T = Q.tex;

    /* ---------- leather: colour + height(→normal) + roughness ---------- */
    function drawLeatherHeight(ctx, w, h) {
      ctx.fillStyle = "#808080"; ctx.fillRect(0, 0, w, h);
      // pebbled grain — overlapping soft cells
      var cells = Math.round(w * 0.55);
      for (var i = 0; i < cells; i++) {
        var x = Math.random() * w, y = Math.random() * h;
        var r = w * (0.006 + Math.random() * 0.016);
        var g = ctx.createRadialGradient(x, y, 0, x, y, r);
        var v = 128 + (Math.random() * 90 - 45);
        g.addColorStop(0, "rgba(" + (v | 0) + "," + (v | 0) + "," + (v | 0) + ",0.55)");
        g.addColorStop(1, "rgba(128,128,128,0)");
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      }
      // creases
      ctx.strokeStyle = "rgba(70,70,70,0.30)";
      for (var k = 0; k < 26; k++) {
        ctx.lineWidth = w * (0.001 + Math.random() * 0.003);
        ctx.beginPath();
        var px = Math.random() * w, py = Math.random() * h;
        ctx.moveTo(px, py);
        for (var s = 0; s < 5; s++) {
          px += (Math.random() - 0.5) * w * 0.22;
          py += (Math.random() - 0.5) * h * 0.22;
          ctx.lineTo(px, py);
        }
        ctx.stroke();
      }
      // raised border frame + tooling
      ctx.strokeStyle = "rgba(200,200,200,0.85)";
      ctx.lineWidth = w * 0.012; ctx.strokeRect(w * 0.06, h * 0.05, w * 0.88, h * 0.90);
      ctx.lineWidth = w * 0.005; ctx.strokeRect(w * 0.09, h * 0.075, w * 0.82, h * 0.85);
      ctx.strokeStyle = "rgba(190,190,190,0.7)"; ctx.lineWidth = w * 0.006;
      for (var c2 = 0; c2 < 4; c2++) {
        var cx = c2 % 2 ? w * 0.855 : w * 0.145;
        var cy = c2 < 2 ? h * 0.135 : h * 0.865;
        ctx.beginPath();
        for (var a2 = 0; a2 < 12; a2 += 0.12) {
          var rr = w * 0.055 * (0.12 + a2 / 12 * 0.88);
          var xx = cx + rr * Math.cos(a2), yy = cy + rr * Math.sin(a2) * 0.75;
          if (a2 === 0) ctx.moveTo(xx, yy); else ctx.lineTo(xx, yy);
        }
        ctx.stroke();
      }
    }

    var leatherHeightCanvas = makeCanvas(T, Math.round(T * 1.35), drawLeatherHeight);
    var leatherNormalTex = texFrom(heightToNormal(leatherHeightCanvas, 2.6));

    var leatherColorTex = texFrom(makeCanvas(T, Math.round(T * 1.35), function (ctx, w, h) {
      ctx.fillStyle = "#291609"; ctx.fillRect(0, 0, w, h);
      speckle(ctx, w, h, Math.round(w * 6), function () {
        var s = (Math.random() - 0.5) * 26;
        return "rgba(" + ((46 + s) | 0) + "," + ((26 + s * 0.6) | 0) + "," + ((15 + s * 0.4) | 0) + ",0.5)";
      });
      // sun-bleached wear toward the edges
      var g = ctx.createRadialGradient(w * 0.5, h * 0.5, w * 0.2, w * 0.5, h * 0.5, w * 0.85);
      g.addColorStop(0, "rgba(0,0,0,0)");
      g.addColorStop(1, "rgba(120,80,40,0.10)");
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      // gilt tooling, tarnished
      ctx.strokeStyle = "rgba(168,126,58,0.75)";
      ctx.lineWidth = w * 0.012; ctx.strokeRect(w * 0.06, h * 0.05, w * 0.88, h * 0.90);
      ctx.lineWidth = w * 0.005; ctx.strokeRect(w * 0.09, h * 0.075, w * 0.82, h * 0.85);
    }, undefined), THREE.SRGBColorSpace);

    var leatherRoughTex = texFrom(makeCanvas(Math.round(T / 2), Math.round(T * 0.68), function (ctx, w, h) {
      ctx.fillStyle = "#b4b4b4"; ctx.fillRect(0, 0, w, h);
      fbmNoise(ctx, w, h, 4, 48, 0.30);
      // worn high spots are smoother (darker = less rough)
      for (var i = 0; i < 40; i++) {
        var x = Math.random() * w, y = Math.random() * h, r = w * (0.03 + Math.random() * 0.09);
        var g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, "rgba(90,90,90,0.5)"); g.addColorStop(1, "rgba(90,90,90,0)");
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      }
    }));

    /* ---------- parchment ---------- */
    function scribbleBlock(ctx, w, h, color, margin, lineH) {
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(1, w * 0.0026);
      var y = margin;
      while (y < h - margin * 0.8) {
        var x = margin * 0.95 + (Math.random() < 0.18 ? w * 0.04 : 0);
        var target = x + (w - margin * 1.9) * (0.55 + Math.random() * 0.35);
        while (x < target) {
          var seg = w * (0.018 + Math.random() * 0.028);
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.quadraticCurveTo(x + seg * 0.5, y + (Math.random() * 10 - 5), x + seg, y + (Math.random() * 8 - 4));
          ctx.stroke();
          x += seg + w * (0.006 + Math.random() * 0.008);
        }
        y += lineH * (1 + (Math.random() < 0.14 ? 0.7 : 0));
      }
    }

    function drawParchmentHeight(ctx, w, h) {
      ctx.fillStyle = "#8a8a8a"; ctx.fillRect(0, 0, w, h);
      fbmNoise(ctx, w, h, 3, 32, 0.22);
      // laid-paper fibre lines
      ctx.globalAlpha = 0.20;
      for (var y = 0; y < h; y += 3 + Math.random() * 4) {
        ctx.strokeStyle = Math.random() < 0.5 ? "#a8a8a8" : "#6e6e6e";
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y + (Math.random() - 0.5) * 3); ctx.stroke();
      }
      ctx.globalAlpha = 1;
      // soft cockling / waviness
      for (var i = 0; i < 26; i++) {
        var cx = Math.random() * w, cy = Math.random() * h, r = w * (0.08 + Math.random() * 0.2);
        var g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
        var v = Math.random() < 0.5 ? 150 : 118;
        g.addColorStop(0, "rgba(" + v + "," + v + "," + v + ",0.32)");
        g.addColorStop(1, "rgba(138,138,138,0)");
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
      }
    }
    var parchNormalTex = texFrom(heightToNormal(makeCanvas(T, T, drawParchmentHeight), 1.5));

    function makePageColorTex(base, inked) {
      return texFrom(makeCanvas(T, T, function (ctx, w, h) {
        ctx.fillStyle = base; ctx.fillRect(0, 0, w, h);
        speckle(ctx, w, h, Math.round(w * 4), function () {
          var s = (Math.random() - 0.5) * 18;
          return "rgba(" + ((198 + s) | 0) + "," + ((176 + s) | 0) + "," + ((136 + s) | 0) + ",0.35)";
        });
        // foxing / age stains
        for (var i = 0; i < 9; i++) {
          var cx = Math.random() * w, cy = Math.random() * h, r = w * (0.05 + Math.random() * 0.14);
          var g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
          g.addColorStop(0, "rgba(118,84,44,0.20)");
          g.addColorStop(0.6, "rgba(118,84,44,0.07)");
          g.addColorStop(1, "rgba(118,84,44,0)");
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
        }
        // darkened edges where hands have touched
        var eg = ctx.createLinearGradient(0, 0, w, 0);
        eg.addColorStop(0, "rgba(74,52,26,0.22)");
        eg.addColorStop(0.30, "rgba(74,52,26,0.04)");
        eg.addColorStop(0.85, "rgba(74,52,26,0.10)");
        eg.addColorStop(1, "rgba(74,52,26,0.38)");
        ctx.fillStyle = eg; ctx.fillRect(0, 0, w, h);
        if (inked) scribbleBlock(ctx, w, h, "rgba(48,32,18,0.72)", w * 0.13, h * 0.036);
      }), THREE.SRGBColorSpace);
    }
    var pageTexA = makePageColorTex("#ab9670", true);
    var pageTexB = makePageColorTex("#a58f6a", true);

    /* the same handwriting, as an emissive mask, so script glows on the
       turning pages at the climax */
    var glowScriptTex = texFrom(makeCanvas(Math.round(T * 0.75), Math.round(T * 0.75), function (ctx, w, h) {
      ctx.fillStyle = "#000"; ctx.fillRect(0, 0, w, h);
      scribbleBlock(ctx, w, h, "rgba(255,208,132,1)", w * 0.13, h * 0.036);
    }));

    /* ---------- page-block edge (the fore-edge of the paper stack) ---------- */
    var pageEdgeTex = texFrom(makeCanvas(64, 512, function (ctx, w, h) {
      ctx.fillStyle = "#7d6944"; ctx.fillRect(0, 0, w, h);
      for (var y = 0; y < h; y += 1) {
        var v = Math.random();
        ctx.strokeStyle = "rgba(" + ((42 + v * 74) | 0) + "," + ((33 + v * 58) | 0) + "," + ((16 + v * 32) | 0) + "," + (0.45 + v * 0.5) + ")";
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y + (Math.random() - 0.5) * 2); ctx.stroke();
      }
      var g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, "rgba(18,12,5,0.85)");
      g.addColorStop(0.42, "rgba(18,12,5,0.10)");
      g.addColorStop(0.58, "rgba(18,12,5,0.10)");
      g.addColorStop(1, "rgba(18,12,5,0.85)");
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      // a thin remnant of gilding along the top of the fore-edge
      var gg = ctx.createLinearGradient(0, 0, w, 0);
      gg.addColorStop(0, "rgba(196,152,74,0.0)");
      gg.addColorStop(0.5, "rgba(196,152,74,0.30)");
      gg.addColorStop(1, "rgba(196,152,74,0.0)");
      ctx.fillStyle = gg; ctx.fillRect(0, 0, w, h * 0.05);
    }), THREE.SRGBColorSpace);

    /* ---------- forest floor ---------- */
    var GD = Q.groundDetail;
    function drawGroundHeight(ctx, w, h) {
      ctx.fillStyle = "#7a7a7a"; ctx.fillRect(0, 0, w, h);
      fbmNoise(ctx, w, h, 4, 64, 0.35);
      for (var i = 0; i < GD * 3; i++) {
        var x = Math.random() * w, y = Math.random() * h, r = w * (0.004 + Math.random() * 0.02);
        var v = 100 + Math.random() * 110;
        var g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, "rgba(" + (v | 0) + "," + (v | 0) + "," + (v | 0) + ",0.6)");
        g.addColorStop(1, "rgba(122,122,122,0)");
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      }
    }
    var groundNormalTex = texFrom(heightToNormal(makeCanvas(512, 512, drawGroundHeight), 0.9));
    groundNormalTex.repeat.set(3, 3);

    var groundColorTex = texFrom(makeCanvas(512, 512, function (ctx, w, h) {
      ctx.fillStyle = "#0a1109"; ctx.fillRect(0, 0, w, h);
      for (var i = 0; i < GD; i++) {
        var x = Math.random() * w, y = Math.random() * h, r = 6 + Math.random() * 18;
        var sh = Math.random() * 34;
        var g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, "rgba(" + ((28 + sh * 0.6) | 0) + "," + ((42 + sh * 0.8) | 0) + "," + ((22 + sh * 0.35) | 0) + ",0.38)");
        g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      }
      // dead leaf litter
      for (var k = 0; k < GD * 2.5; k++) {
        var lx = Math.random() * w, ly = Math.random() * h;
        ctx.save(); ctx.translate(lx, ly); ctx.rotate(Math.random() * Math.PI * 2);
        ctx.fillStyle = "rgba(" + ((48 + Math.random() * 30) | 0) + "," + ((32 + Math.random() * 18) | 0) + ",16," + (0.18 + Math.random() * 0.22) + ")";
        ctx.beginPath(); ctx.ellipse(0, 0, 1.6 + Math.random() * 3.4, 0.9 + Math.random() * 1.6, 0, 0, Math.PI * 2);
        ctx.fill(); ctx.restore();
      }
      speckle(ctx, w, h, GD * 12, function () {
        var s = Math.random() * 24;
        return "rgba(" + ((34 + s * 0.6) | 0) + "," + ((46 + s * 0.8) | 0) + "," + ((24 + s * 0.3) | 0) + "," + (0.05 + Math.random() * 0.12) + ")";
      });
    }), THREE.SRGBColorSpace);
    groundColorTex.repeat.set(3, 3);

    /* ---------- radial glow sprite ---------- */
    mark("materials_textures");
    var glowTex = texFrom(makeCanvas(128, 128, function (ctx, w, h) {
      var g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
      g.addColorStop(0, "rgba(255,255,255,1)");
      g.addColorStop(0.28, "rgba(255,226,168,0.75)");
      g.addColorStop(0.6, "rgba(255,180,90,0.22)");
      g.addColorStop(1, "rgba(255,160,70,0)");
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    }));

    /* ====================================================================
       ENVIRONMENT MAP (IBL)
       A tiny procedural "forest clearing" scene, prefiltered through
       PMREMGenerator. Without this, metal has nothing to reflect and gold
       reads as flat orange plastic.
       ==================================================================== */
    var pmrem = new THREE.PMREMGenerator(renderer);
    pmrem.compileEquirectangularShader();

    var envScene = new THREE.Scene();
    (function buildEnv() {
      // sky dome: dark canopy above, warm break in the trees on one side
      var domeTex = texFrom(makeCanvas(256, 128, function (ctx, w, h) {
        var g = ctx.createLinearGradient(0, 0, 0, h);
        g.addColorStop(0.00, "#05080a");   // canopy, almost black
        g.addColorStop(0.40, "#0d1512");
        g.addColorStop(0.56, "#1b2620");
        g.addColorStop(1.00, "#060807");   // forest floor bounce
        ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
        // the warm gap the key light comes through
        var wg = ctx.createRadialGradient(w * 0.30, h * 0.24, 0, w * 0.30, h * 0.24, w * 0.20);
        wg.addColorStop(0, "rgba(255,206,146,0.85)");
        wg.addColorStop(0.30, "rgba(198,138,74,0.26)");
        wg.addColorStop(1, "rgba(110,80,44,0)");
        ctx.fillStyle = wg; ctx.fillRect(0, 0, w, h);
        // scattered canopy breaks for reflection interest
        for (var i = 0; i < 34; i++) {
          var x = Math.random() * w, y = Math.random() * h * 0.5;
          var r = 2 + Math.random() * 9;
          var sg = ctx.createRadialGradient(x, y, 0, x, y, r);
          sg.addColorStop(0, "rgba(170,186,150,0.32)");
          sg.addColorStop(1, "rgba(170,186,150,0)");
          ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
        }
      }), THREE.SRGBColorSpace);
      domeTex.mapping = THREE.EquirectangularReflectionMapping;
      envScene.background = domeTex;

      var dome = new THREE.Mesh(
        track(new THREE.SphereGeometry(8, 24, 16)),
        track(new THREE.MeshBasicMaterial({ map: domeTex, side: THREE.BackSide }))
      );
      envScene.add(dome);
    })();

    mark("before_pmrem");
    /* Sky/backdrop: without this the ground fades into fog while the sky
       stays pure black, and the horizon reads as a hard cut. */
    var skyTex = texFrom(makeCanvas(64, 256, function (ctx, w, h) {
      var g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0.00, "#010203");
      g.addColorStop(0.44, "#050809");
      g.addColorStop(0.56, "#0c1210");
      g.addColorStop(0.66, "#101614");
      g.addColorStop(1.00, "#050706");
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    }), THREE.SRGBColorSpace);
    skyTex.mapping = THREE.EquirectangularReflectionMapping;
    scene.background = skyTex;

    var envRT = pmrem.fromScene(envScene, 0.04);
    scene.environment = envRT.texture;
    scene.environmentIntensity = 0.55;
    pmrem.dispose();
    mark("pmrem");

    /* ====================================================================
       MATERIALS
       ==================================================================== */
    var leatherMat = track(new THREE.MeshPhysicalMaterial({
      map: leatherColorTex,
      normalMap: leatherNormalTex,
      normalScale: new THREE.Vector2(1.0, 1.0),
      roughnessMap: leatherRoughTex,
      roughness: 0.78,
      metalness: 0.0,
      clearcoat: 0.0,
      clearcoatRoughness: 0.74,
      envMapIntensity: 0.7,
    }));

    var goldMat = track(new THREE.MeshStandardMaterial({
      color: 0xd7a44f,
      metalness: 1.0,
      roughness: 0.28,
      envMapIntensity: 1.6,
    }));

    var pageMatA = track(new THREE.MeshStandardMaterial({
      map: pageTexA, normalMap: parchNormalTex,
      normalScale: new THREE.Vector2(0.5, 0.5),
      roughness: 0.94, metalness: 0.0, side: THREE.DoubleSide,
      emissive: 0xffc978, emissiveMap: glowScriptTex, emissiveIntensity: 0.0,
      envMapIntensity: 0.38,
    }));
    var pageMatB = track(pageMatA.clone());
    pageMatB.map = pageTexB;

    /* ====================================================================
       LIGHTING
       Key from the canopy gap behind-left (motivated by the env map's warm
       break), a cool fill from the opposite side for silhouette separation,
       and a warm practical at the spine that only wakes up at the climax.
       ==================================================================== */
    scene.add(track(new THREE.HemisphereLight(0x33465a, 0x0a0a08, 0.30)));

    var key = new THREE.DirectionalLight(0xffc98a, 3.0);
    key.position.set(-1.8, 2.9, 1.9);
    key.target.position.set(0.05, 0.1, 0.05);
    key.castShadow = true;
    key.shadow.mapSize.set(Q.shadow, Q.shadow);
    key.shadow.camera.near = 0.5;
    key.shadow.camera.far = 12;
    key.shadow.camera.left = -1.6; key.shadow.camera.right = 1.6;
    key.shadow.camera.top = 1.6; key.shadow.camera.bottom = -1.6;
    key.shadow.bias = -0.0009;
    key.shadow.normalBias = 0.018;
    key.shadow.radius = 3;
    scene.add(key); scene.add(key.target);

    // cool rim from camera-right/behind — separates the book from the dark
    var rim = new THREE.DirectionalLight(0x8ab4e0, 1.5);
    rim.position.set(3.0, 1.15, -2.2);
    scene.add(track(rim));

    // low warm bounce off the forest floor, keeps shadows from going dead
    var bounce = new THREE.PointLight(0xff8a3a, 0.40, 3.6, 2.0);
    bounce.position.set(0.9, 0.18, 1.1);
    scene.add(track(bounce));

    // the spine practical — 0 until the climax
    var spineLight = new THREE.PointLight(0xffc870, 0, 6, 1.6);
    scene.add(track(spineLight));

    /* ====================================================================
       GROUND
       ==================================================================== */
    var ground = new THREE.Mesh(
      track(new THREE.PlaneGeometry(24, 24, 1, 1)),
      track(new THREE.MeshStandardMaterial({
        map: groundColorTex, normalMap: groundNormalTex,
        normalScale: new THREE.Vector2(0.7, 0.7),
        roughness: 0.97, metalness: 0.0, envMapIntensity: 0.5,
      }))
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    /* ====================================================================
       THE BOOK
       ==================================================================== */
    var bookGroup = new THREE.Group();
    scene.add(bookGroup);

    var groundY = 0.0;
    var backCoverY = groundY + COVER_THICK / 2;

    function coverGeo() {
      var g = new THREE.BoxGeometry(BOOK_W, COVER_THICK, BOOK_H, 1, 1, 1);
      g.translate(BOOK_W / 2, 0, 0);   // hinge at local x = 0
      return track(g);
    }

    // --- back cover (static) ---
    var backCover = new THREE.Mesh(coverGeo(), leatherMat);
    backCover.position.set(SPINE_X, backCoverY, 0);
    backCover.castShadow = true; backCover.receiveShadow = true;
    bookGroup.add(backCover);

    // --- the paper block, as a single solid whose top face is the page ---
    var blockBottom = groundY + COVER_THICK;
    var pageBlock = new THREE.Mesh(
      track(new THREE.BoxGeometry(BOOK_W * 0.985, PAGE_BLOCK, BOOK_H * 0.97)),
      (function () {
        var edge = function () {
          return track(new THREE.MeshStandardMaterial({
            map: pageEdgeTex, roughness: 0.95, metalness: 0.0, envMapIntensity: 0.22,
          }));
        };
        var dark = function (c) {
          return track(new THREE.MeshStandardMaterial({ color: c, roughness: 0.98, envMapIntensity: 0.1 }));
        };
        // +X fore-edge, -X spine, +Y top, -Y underside, +Z head, -Z tail
        return [edge(), dark(0x3a2f1c), pageMatA, dark(0x1a1409), edge(), edge()];
      })()
    );
    pageBlock.position.set(SPINE_X + BOOK_W * 0.985 / 2 + 0.004, blockBottom + PAGE_BLOCK / 2, 0);
    pageBlock.castShadow = true; pageBlock.receiveShadow = true;
    bookGroup.add(pageBlock);

    // --- front cover, hinged at the spine ---
    var coverPivot = new THREE.Group();
    coverPivot.position.set(SPINE_X, blockBottom + PAGE_BLOCK + COVER_THICK / 2, 0);
    bookGroup.add(coverPivot);

    var frontCover = new THREE.Mesh(coverGeo(), leatherMat);
    frontCover.castShadow = true; frontCover.receiveShadow = true;
    coverPivot.add(frontCover);

    // spine wrap — the rounded leather hinge
    var spineR = (PAGE_BLOCK + COVER_THICK * 2) / 2;
    var spineY = spineR;   // sits exactly between the ground and the front cover
    var spineWrap = new THREE.Mesh(
      track(new THREE.CylinderGeometry(spineR, spineR, BOOK_H, 24, 1, false)),
      leatherMat
    );
    spineWrap.rotation.x = Math.PI / 2;
    spineWrap.position.set(SPINE_X, spineY, 0);
    spineWrap.castShadow = true; spineWrap.receiveShadow = true;
    bookGroup.add(spineWrap);

    // raised binding bands across the spine — the giveaway detail on a
    // hand-bound tome, and they catch the key light nicely
    var bandGeo = track(new THREE.TorusGeometry(spineR + 0.004, 0.009, 8, 24));
    [-0.34, -0.11, 0.12, 0.35].forEach(function (z) {
      var band = new THREE.Mesh(bandGeo, leatherMat);
      band.rotation.y = Math.PI / 2;
      band.position.set(SPINE_X, spineY, z * BOOK_H);
      band.castShadow = true; band.receiveShadow = true;
      bookGroup.add(band);
    });

    // --- cover furniture: corner bosses, centre emblem, clasp ---
    var coverTopY = COVER_THICK / 2;

    var cornerGeo = track(new THREE.BoxGeometry(0.088, 0.005, 0.088));
    var studGeo = track(new THREE.SphereGeometry(0.010, 12, 10));
    [[0.075, -BOOK_H / 2 + 0.075], [BOOK_W - 0.075, -BOOK_H / 2 + 0.075],
     [0.075, BOOK_H / 2 - 0.075], [BOOK_W - 0.075, BOOK_H / 2 - 0.075]].forEach(function (c) {
      var m = new THREE.Mesh(cornerGeo, goldMat);
      m.position.set(c[0], coverTopY + 0.002, c[1]);
      m.castShadow = true;
      coverPivot.add(m);
      var stud = new THREE.Mesh(studGeo, goldMat);
      stud.position.set(c[0], coverTopY + 0.006, c[1]);
      stud.castShadow = true;
      coverPivot.add(stud);
    });

    var emblem = new THREE.Mesh(track(new THREE.TorusGeometry(0.085, 0.0085, 10, 40)), goldMat);
    emblem.rotation.x = Math.PI / 2;
    emblem.position.set(BOOK_W / 2, coverTopY + 0.003, 0);
    emblem.castShadow = true;
    coverPivot.add(emblem);

    var emblemInner = new THREE.Mesh(track(new THREE.TorusGeometry(0.042, 0.006, 10, 30)), goldMat);
    emblemInner.rotation.x = Math.PI / 2;
    emblemInner.position.set(BOOK_W / 2, coverTopY + 0.003, 0);
    emblemInner.castShadow = true;
    coverPivot.add(emblemInner);

    var emblemStud = new THREE.Mesh(track(new THREE.SphereGeometry(0.017, 14, 12)), goldMat);
    emblemStud.position.set(BOOK_W / 2, coverTopY + 0.008, 0);
    emblemStud.castShadow = true;
    coverPivot.add(emblemStud);

    // clasp strap on the fore-edge
    var strap = new THREE.Mesh(
      track(new THREE.BoxGeometry(0.14, 0.008, 0.085)),
      track(new THREE.MeshStandardMaterial({ color: 0x241408, roughness: 0.85, metalness: 0.0 }))
    );
    strap.position.set(BOOK_W - 0.07, coverTopY + 0.004, 0);
    strap.castShadow = true;
    coverPivot.add(strap);

    // the strap turns down over the fore-edge and the clasp hooks under it
    var strapLip = new THREE.Mesh(
      track(new THREE.BoxGeometry(0.010, PAGE_BLOCK * 0.92, 0.085)),
      track(new THREE.MeshStandardMaterial({ color: 0x241408, roughness: 0.85 }))
    );
    strapLip.position.set(BOOK_W + 0.003, coverTopY - PAGE_BLOCK * 0.46, 0);
    strapLip.castShadow = true;
    coverPivot.add(strapLip);

    var claspPivot = new THREE.Group();
    claspPivot.position.set(BOOK_W + 0.004, coverTopY - COVER_THICK * 0.5, 0);
    coverPivot.add(claspPivot);
    var clasp = new THREE.Mesh(track(new THREE.BoxGeometry(0.05, 0.014, 0.10)), goldMat);
    clasp.position.set(-0.012, -PAGE_BLOCK * 0.45, 0);
    clasp.castShadow = true;
    claspPivot.add(clasp);

    /* ====================================================================
       EMBERS
       Motion is analytic (a pure function of time) rather than integrated,
       so any frame can be reproduced exactly for screenshot review.
       ==================================================================== */
    var EMBERS = Q.embers;
    var emberGeo = track(new THREE.BufferGeometry());
    var emberPos = new Float32Array(EMBERS * 3);
    var emberSeed = [];
    for (var i = 0; i < EMBERS; i++) {
      var ang = Math.random() * Math.PI * 2;
      var rad = 0.25 + Math.random() * Math.random() * 2.0;
      emberSeed.push({
        x: Math.cos(ang) * rad, z: Math.sin(ang) * rad,
        y0: Math.random(), speed: 0.035 + Math.random() * 0.055,
        sway: 0.02 + Math.random() * 0.05, phase: Math.random() * Math.PI * 2,
        top: 1.1 + Math.random() * 0.9,
      });
    }
    emberGeo.setAttribute("position", new THREE.BufferAttribute(emberPos, 3));
    var emberMat = track(new THREE.PointsMaterial({
      size: 0.021, map: glowTex, transparent: true, opacity: 0.85,
      blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
      color: 0xffc98a,
    }));
    var embers = new THREE.Points(emberGeo, emberMat);
    scene.add(embers);

    function updateEmbers(t) {
      var p = emberGeo.attributes.position;
      for (var i = 0; i < EMBERS; i++) {
        var s = emberSeed[i];
        var y = ((s.y0 + t * s.speed) % 1) * s.top;
        var rise = y / s.top;
        p.setXYZ(i,
          s.x + Math.sin(t * 0.6 + s.phase) * s.sway * (0.3 + rise),
          0.02 + y,
          s.z + Math.cos(t * 0.47 + s.phase * 1.3) * s.sway * (0.3 + rise));
      }
      p.needsUpdate = true;
    }

    /* ====================================================================
       POST-PROCESSING

       Ordering matters. RenderPass draws into a half-float target, and
       three only applies tone mapping when writing to the default
       framebuffer — so the chain stays linear HDR all the way through
       bloom, and OutputPass does ACES + sRGB last. Bloom on a tone-mapped
       image would have nothing above 1.0 left to bleed.
       ==================================================================== */
    var composer = null, bloomPass = null, bokehPass = null;
    var _dbSize = new THREE.Vector2();

    function buildComposer() {
      renderer.getDrawingBufferSize(_dbSize);
      var rt = new THREE.WebGLRenderTarget(_dbSize.x, _dbSize.y, {
        type: THREE.HalfFloatType,
        samples: Q.msaa,            // real MSAA where we can afford it
      });
      composer = new THREE.EffectComposer(renderer, rt);
      composer.setSize(window.innerWidth, window.innerHeight);
      composer.setPixelRatio(renderer.getPixelRatio());

      composer.addPass(new THREE.RenderPass(scene, camera));

      if (Q.dof) {
        bokehPass = new THREE.BokehPass(scene, camera, {
          focus: 2.35, aperture: 0.009, maxblur: 0.016,
        });
        composer.addPass(bokehPass);
      }

      if (Q.bloom) {
        bloomPass = new THREE.UnrealBloomPass(
          new THREE.Vector2(window.innerWidth, window.innerHeight),
          BLOOM_IDLE, 0.62, 0.72);   // strength, radius, threshold
        composer.addPass(bloomPass);
      }

      if (Q.msaa === 0 && TIER === "mid") {
        composer.addPass(new THREE.SMAAPass(window.innerWidth, window.innerHeight));
      }

      composer.addPass(new THREE.OutputPass());
    }

    var BLOOM_IDLE = 0.48;
    var BLOOM_CLIMAX = 1.85;
    buildComposer();

    /* Keep focus pinned to the book as the camera pushes in, so the
       background falls out of focus but the tome never does. */
    var _focusTarget = new THREE.Vector3(0, 0.12, 0);
    function updateDof() {
      if (!bokehPass) return;
      bokehPass.uniforms["focus"].value = camera.position.distanceTo(_focusTarget);
    }

    /* ====================================================================
       CAMERA RIG
       ==================================================================== */
    var camRig = {
      idle:   { pos: new THREE.Vector3(1.58, 0.78, 1.70), look: new THREE.Vector3(0.00, 0.13, -0.02) },
      climax: { pos: new THREE.Vector3(0.94, 0.36, 0.99), look: new THREE.Vector3(-0.12, 0.20, 0.0) },
    };
    var _camPos = new THREE.Vector3(), _camLook = new THREE.Vector3();

    var camOverride = null;   // set by the screenshot harness for inspection

    function updateCamera(t, climaxT) {
      if (camOverride) {
        camera.position.copy(camOverride.pos);
        camera.lookAt(camOverride.look);
        return;
      }
      var k = climaxT;
      _camPos.copy(camRig.idle.pos).lerp(camRig.climax.pos, k);
      _camLook.copy(camRig.idle.look).lerp(camRig.climax.look, k);
      // handheld drift — three detuned sines so it never obviously repeats
      var amp = 0.030 * (1 - k * 0.55);
      _camPos.x += (Math.sin(t * 0.31) * 0.6 + Math.sin(t * 0.73 + 1.1) * 0.4) * amp;
      _camPos.y += (Math.sin(t * 0.24 + 2.0) * 0.5 + Math.sin(t * 0.61) * 0.5) * amp * 0.7;
      _camPos.z += Math.sin(t * 0.19 + 0.6) * amp * 0.5;
      camera.position.copy(_camPos);
      camera.lookAt(_camLook);
      camera.rotation.z += Math.sin(t * 0.27 + 1.4) * 0.006 * (1 - k * 0.5);
    }

    /* ====================================================================
       TIMELINE
       All motion is a pure function of absolute scene time, so the whole
       intro can be scrubbed and screenshotted frame-exactly.
       ==================================================================== */
    var TL = {
      claspDur: 0.55,
      coverDur: 1.55,
      pageStagger: 0.20,
      pageDur: 1.15,
      climaxDur: 2.4,
      handoffAt: 0.55,   // fraction of the climax at which we cut to the site
    };
    var HERO_PAGES = Q.heroPages;
    TL.flipDur = TL.pageStagger * (HERO_PAGES - 1) + TL.pageDur;
    TL.openStart = TL.claspDur * 0.6;
    TL.flipStart = TL.openStart + TL.coverDur * 0.62;
    TL.climaxStart = TL.flipStart + TL.flipDur * 0.92;
    TL.total = TL.climaxStart + TL.climaxDur;

    function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
    function easeInOutCubic(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
    function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }
    function easeInCubic(t) { return t * t * t; }
    /* a settle with a little weight to it — overshoots slightly, then lands */
    function easeOutBackSoft(t) {
      var c1 = 1.10, c3 = c1 + 1;
      return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
    }

    var state = { triggered: false, triggerTime: 0, handedOff: false };

    /* ====================================================================
       FRAME — pure function of time
       ==================================================================== */
    function updateScene(now) {
      updateEmbers(now);
      bookGroup.position.y = Math.sin(now * 0.5) * 0.002;

      var climaxT = 0;

      if (!state.triggered) {
        // idle: the clasp breathes very slightly, nothing else moves
        claspPivot.rotation.z = Math.sin(now * 0.8) * 0.012;
        coverPivot.rotation.z = 0;
        updateCamera(now, 0);
        return;
      }

      var s = now - state.triggerTime;

      // --- clasp releases ---
      var ct = clamp01(s / TL.claspDur);
      claspPivot.rotation.z = -easeOutBackSoft(ct) * 1.55;

      // --- cover swings open about the spine ---
      var ot = clamp01((s - TL.openStart) / TL.coverDur);
      coverPivot.rotation.z = easeInOutCubic(ot) * Math.PI * 0.985;

      // --- climax ---
      if (s >= TL.climaxStart) {
        climaxT = clamp01((s - TL.climaxStart) / TL.climaxDur);
        var build = easeInCubic(climaxT);
        spineLight.position.set(SPINE_X + 0.02, blockBottom + PAGE_BLOCK * 0.6, 0);
        spineLight.intensity = build * 26;
        if (bloomPass) bloomPass.strength = BLOOM_IDLE + (BLOOM_CLIMAX - BLOOM_IDLE) * build;
        pageMatA.emissiveIntensity = build * 2.4;
        pageMatB.emissiveIntensity = build * 2.4;
        if (climaxT >= TL.handoffAt && !state.handedOff) {
          state.handedOff = true;
          if (window.finishBookIntro) window.finishBookIntro();
        }
      }

      updateCamera(now, climaxT);
    }

    /* ====================================================================
       RENDER LOOP + CAPTURE HOOK
       ==================================================================== */
    var running = true;
    var rafId = null;
    var startTime = performance.now() / 1000;
    var frameTimes = [];

    renderer.info.autoReset = false;
    function renderFrame(now) {
      renderer.info.reset();
      updateScene(now);
      updateDof();
      if (composer) composer.render(); else renderer.render(scene, camera);
    }

    var lastFrameAt = 0;
    function loop() {
      if (!running) return;
      rafId = requestAnimationFrame(loop);
      var t0 = performance.now();
      if (lastFrameAt && frameTimes.length < 600) frameTimes.push(t0 - lastFrameAt);
      lastFrameAt = t0;
      renderFrame(t0 / 1000 - startTime);
    }

    function begin() {
      if (state.triggered) return;
      state.triggered = true;
      state.triggerTime = performance.now() / 1000 - startTime;
      if (promptEl) promptEl.classList.add("hidden");
    }
    canvas.addEventListener("click", begin);
    canvas.addEventListener("touchstart", function (e) { e.preventDefault(); begin(); }, { passive: false });

    function onResize() {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
      if (composer) {
        composer.setSize(window.innerWidth, window.innerHeight);
        composer.setPixelRatio(renderer.getPixelRatio());
      }
      if (bloomPass) bloomPass.resolution.set(window.innerWidth, window.innerHeight);
    }
    window.addEventListener("resize", onResize);

    function dispose() {
      running = false;
      if (rafId) cancelAnimationFrame(rafId);
      window.removeEventListener("resize", onResize);
      disposables.forEach(function (d) { if (d && d.dispose) d.dispose(); });
      if (envRT) envRT.dispose();
      if (composer) {
        composer.passes.forEach(function (ps) { if (ps.dispose) ps.dispose(); });
        composer.renderTarget1.dispose();
        composer.renderTarget2.dispose();
      }
      renderer.dispose();
    }
    window.skipBookIntro = dispose;

    /* Deterministic frame access, used by the screenshot harness. */
    window.__bookCapture = {
      ready: true,
      tier: TIER,
      boot: bootMarks,
      timeline: TL,
      frame: function (t) {
        // Stop the live loop first, or it will immediately overwrite the
        // requested frame with a wall-clock one and the screenshot lies.
        running = false;
        if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
        if (!state.triggered) { state.triggered = true; state.triggerTime = 2.0; }
        state.handedOff = true;              // don't hand off during capture
        return new Promise(function (r) {
          requestAnimationFrame(function () { renderFrame(t); requestAnimationFrame(r); });
        });
      },
      cam: function (px, py, pz, lx, ly, lz) {
        camOverride = (px === null) ? null : {
          pos: new THREE.Vector3(px, py, pz),
          look: new THREE.Vector3(lx || 0, ly || 0, lz || 0),
        };
      },
      tweak: function (o) {
        if (o.keyPos) key.position.set(o.keyPos[0], o.keyPos[1], o.keyPos[2]);
        if (o.keyInt !== undefined) key.intensity = o.keyInt;
        if (o.rimPos) rim.position.set(o.rimPos[0], o.rimPos[1], o.rimPos[2]);
        if (o.rimInt !== undefined) rim.intensity = o.rimInt;
        if (o.exposure !== undefined) renderer.toneMappingExposure = o.exposure;
        if (o.clearcoat !== undefined) leatherMat.clearcoat = o.clearcoat;
        if (o.rough !== undefined) leatherMat.roughness = o.rough;
        if (o.bloomStrength !== undefined && bloomPass) bloomPass.strength = o.bloomStrength;
        if (o.bloomRadius !== undefined && bloomPass) bloomPass.radius = o.bloomRadius;
        if (o.bloomThreshold !== undefined && bloomPass) bloomPass.threshold = o.bloomThreshold;
        if (o.aperture !== undefined && bokehPass) bokehPass.uniforms["aperture"].value = o.aperture;
        if (o.maxblur !== undefined && bokehPass) bokehPass.uniforms["maxblur"].value = o.maxblur;
        leatherMat.needsUpdate = true;
      },
      /* Resume the live loop for a while and report real frame pacing.
         frame() pauses the loop, so the plain profile() below only ever
         sees warm-up frames. */
      profileLive: function (ms, atTime) {
        frameTimes.length = 0;
        if (atTime !== undefined) { state.triggered = true; state.triggerTime = -atTime; }
        state.handedOff = true;
        running = true;
        startTime = performance.now() / 1000;
        lastFrameAt = 0;
        loop();
        return new Promise(function (res) {
          setTimeout(function () {
            running = false;
            if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
            var a = frameTimes.slice(3).sort(function (x, y) { return x - y; });
            res({
              tier: TIER, frames: a.length,
              medianMs: a.length ? +a[a.length >> 1].toFixed(2) : null,
              p95Ms: a.length ? +a[Math.floor(a.length * 0.95)].toFixed(2) : null,
              fps: a.length ? +(1000 / a[a.length >> 1]).toFixed(1) : null,
              passes: composer ? composer.passes.length : 0,
              drawCalls: renderer.info.render.calls,
              triangles: renderer.info.render.triangles,
              programs: renderer.info.programs ? renderer.info.programs.length : null,
              textures: renderer.info.memory.textures,
              geometries: renderer.info.memory.geometries,
              dpr: renderer.getPixelRatio(),
            });
          }, ms);
        });
      },
      profile: function () {
        if (!frameTimes.length) return null;
        var a = frameTimes.slice().sort(function (x, y) { return x - y; });
        return { tier: TIER, n: a.length,
                 median: +a[a.length >> 1].toFixed(2),
                 p95: +a[Math.floor(a.length * 0.95)].toFixed(2),
                 max: +a[a.length - 1].toFixed(2) };
      },
    };

    mark("scene_built");
    if (loadingEl) loadingEl.classList.add("hidden");
    if (reducedMotion) { /* still renders, just without the handheld drift */ }
    loop();
  }
})();
