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
    var reducedMotion = window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    /* Only a coarse starting guess — screen size, nothing else. Deliberately
       not navigator.hardwareConcurrency: browsers clamp and spoof it, and it
       says nothing about the GPU, which is what actually costs us here. How
       fast the device really is gets measured at runtime; see adaptQuality. */
    var TIER = !isCoarse ? "high" : (smallScreen ? "low" : "mid");

    var Q = ({
      high: { dpr: 2.0, tex: 1024, shadow: 2048, msaa: 4, bloom: true, dof: true,
              dofCapable: true, shafts: 7, embers: 220, heroPages: 7, groundDetail: 220 },
      // tablets start without depth of field and earn it back at runtime
      mid:  { dpr: 1.75, tex: 768, shadow: 1024, msaa: 0, bloom: true, dof: false,
              dofCapable: true, shafts: 5, embers: 140, heroPages: 6, groundDetail: 140 },
      low:  { dpr: 1.4, tex: 512, shadow: 512, msaa: 0, bloom: true, dof: false,
              dofCapable: false, shafts: 4, embers: 90, heroPages: 5, groundDetail: 80 },
    })[TIER];

    var HERO_PAGES = Q.heroPages;

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

    /* The shot is composed for a wide frame. On a phone held upright the
       horizontal field of view collapses and the book runs off both edges,
       so match the *horizontal* coverage instead of the vertical: widen the
       lens up to a limit, then dolly back for whatever is still missing. */
    var FIT_TAN_H = Math.tan((30 * Math.PI / 180) / 2) * (16 / 9);
    var MAX_TAN_V = Math.tan((46 * Math.PI / 180) / 2);
    var fitFov = 30, fitDist = 1;

    function updateFraming() {
      var aspect = window.innerWidth / Math.max(1, window.innerHeight);
      var needTanV = FIT_TAN_H / Math.max(0.01, aspect);
      var tanV = Math.min(needTanV, MAX_TAN_V);
      fitFov = (2 * Math.atan(tanV)) * 180 / Math.PI;
      fitDist = needTanV / tanV;          // > 1 means "pull the camera back"
      camera.aspect = aspect;
      camera.fov = fitFov;
      camera.updateProjectionMatrix();
    }
    updateFraming();

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

    var key = new THREE.DirectionalLight(0xffc98a, 3.3);
    key.position.set(-1.5, 2.6, 1.4);
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
    var rim = new THREE.DirectionalLight(0x9ab8d8, 1.0);
    rim.position.set(3.0, 1.15, -2.2);
    scene.add(track(rim));

    // low warm bounce off the forest floor, keeps shadows from going dead
    var bounce = new THREE.PointLight(0xffb070, 0.95, 3.0, 2.0);
    bounce.position.set(0.18, 0.34, 0.85);
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

    /* --- the paper block ---------------------------------------------
       Two settled stacks either side of the spine, plus a handful of
       "hero" pages that actually fly between them. The stacks carry the
       bulk so we only ever deform a few pages; the hero pages carry the
       motion. A single rigid slab (as before) can't fan, and 40 real
       pages would be pure waste — nobody can see past the top few.
       ------------------------------------------------------------------ */
    var blockBottom = groundY + COVER_THICK;
    var LEFT_MIN = 0.005;                 // the left side is never quite flat
    var FLIP_FRACTION = 0.46;             // how much of the block turns over

    function edgeMat() {
      return track(new THREE.MeshStandardMaterial({
        map: pageEdgeTex.clone(), roughness: 0.95, metalness: 0.0, envMapIntensity: 0.22,
      }));
    }
    function darkMat(c) {
      return track(new THREE.MeshStandardMaterial({ color: c, roughness: 0.98, envMapIntensity: 0.1 }));
    }

    /* Unit-height box so thickness is just a scale; +Y face is parchment. */
    function makeStack(topMat) {
      var geo = track(new THREE.BoxGeometry(BOOK_W * 0.985, 1, BOOK_H * 0.97));
      geo.translate(0, 0.5, 0);           // grow upward from its base
      var m = new THREE.Mesh(geo, [
        edgeMat(), darkMat(0x3a2f1c), topMat, darkMat(0x140f08), edgeMat(), edgeMat(),
      ]);
      m.castShadow = true; m.receiveShadow = true;
      bookGroup.add(m);
      return m;
    }

    var halfW = BOOK_W * 0.985 / 2;
    var rightStack = makeStack(pageMatA);
    rightStack.position.set(SPINE_X + halfW + 0.004, blockBottom, 0);
    var leftStack = makeStack(pageMatB);
    leftStack.position.set(SPINE_X - halfW - 0.004, blockBottom, 0);

    function stackThickness(progress) {
      var moved = PAGE_BLOCK * FLIP_FRACTION * progress;
      return { right: PAGE_BLOCK - moved, left: LEFT_MIN + moved };
    }
    function applyStacks(progress) {
      var th = stackThickness(progress);
      rightStack.scale.y = Math.max(0.001, th.right);
      leftStack.scale.y = Math.max(0.001, th.left);
      // keep the fore-edge striations at a constant density as stacks grow
      rightStack.material[0].map.repeat.set(1, Math.max(0.05, th.right / PAGE_BLOCK));
      leftStack.material[0].map.repeat.set(1, Math.max(0.05, th.left / PAGE_BLOCK));
      return th;
    }
    applyStacks(0);
    leftStack.visible = false;   // nothing on the left until the cover opens

    /* --- hero pages: segmented, deformed per-vertex every frame -------- */
    var PAGE_SEG_X = TIER === "low" ? 12 : 20;
    var PAGE_SEG_Z = TIER === "low" ? 3 : 6;
    var CURL_MAX = 1.10;        // total bend angle across the page, mid-turn
    var DROOP = 0.05;           // how much the free corners sag

    var heroPages = [];
    for (var pi = 0; pi < HERO_PAGES; pi++) {
      var pivot = new THREE.Group();
      pivot.position.set(SPINE_X, blockBottom + PAGE_BLOCK, 0);
      bookGroup.add(pivot);

      var pgeo = new THREE.PlaneGeometry(BOOK_W * 0.98, BOOK_H * 0.96, PAGE_SEG_X, PAGE_SEG_Z);
      pgeo.rotateX(-Math.PI / 2);                 // lie flat in XZ
      pgeo.translate(BOOK_W * 0.98 / 2, 0, 0);    // hinge at local x = 0
      track(pgeo);

      var mesh = new THREE.Mesh(pgeo, pi % 2 ? pageMatB : pageMatA);
      mesh.castShadow = true; mesh.receiveShadow = true;
      mesh.visible = false;
      pivot.add(mesh);

      heroPages.push({
        pivot: pivot, mesh: mesh, geo: pgeo,
        baseline: pgeo.attributes.position.array.slice(),
        seed: Math.random() * Math.PI * 2,
      });
    }

    var PAGE_W = BOOK_W * 0.98;
    var PAGE_HALF_H = BOOK_H * 0.96 * 0.5;

    /* Bend the page into an arc about the spine-parallel axis. The old
       scene lifted a flat plane by 0.09 units and called that a bend; you
       could not see it. This walks the page along a real circular arc, so
       mid-turn it reads as a curved sheet rather than a rotating card. */
    function shapePage(page, t, curlSign) {
      var pos = page.geo.attributes.position;
      var base = page.baseline;
      var curl = Math.sin(Math.PI * Math.min(1, Math.max(0, t)));
      var phi = CURL_MAX * curl * curlSign;
      var flat = 1 - curl;                  // 1 when settled, 0 mid-turn
      var R = Math.abs(phi) > 1e-3 ? PAGE_W / phi : 0;

      for (var i = 0; i < pos.count; i++) {
        var x0 = base[i * 3], z0 = base[i * 3 + 2];
        var u = x0 / PAGE_W;
        var x, y;
        if (R) {
          var th = u * phi;
          x = R * Math.sin(th);
          y = R * (1 - Math.cos(th));
        } else {
          x = x0; y = 0;
        }
        // free corners sag under their own weight, most when nearly settled
        var v = z0 / PAGE_HALF_H;
        y -= DROOP * u * u * v * v * (0.3 + 0.7 * flat);
        // a little life across the sheet so it is never perfectly ruled
        y += Math.sin(u * 3.1 + page.seed) * 0.004 * curl;
        pos.setXYZ(i, x, y, z0);
      }
      pos.needsUpdate = true;
      page.geo.computeVertexNormals();
    }
    var CURL_SIGN = -1;   // pages curl trailing-edge-back, so their lit
                          // undersides face the camera as they fan over

    // --- spine: the rounded leather hinge the covers pivot around ---
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

    /* --- front cover ---------------------------------------------------
       It hinges about the centre of the spine, not the top of the block.
       That is what lets it end up flat on the ground when open, with the
       pages turning over onto it. Pivoting at the top instead leaves the
       open cover hovering above the left-hand stack, hiding every page
       that lands there.
       ------------------------------------------------------------------ */
    var coverPivot = new THREE.Group();
    coverPivot.position.set(SPINE_X, spineY, 0);
    bookGroup.add(coverPivot);

    var coverLocalY = PAGE_BLOCK / 2 + COVER_THICK / 2;
    var coverBody = new THREE.Group();
    coverBody.position.y = coverLocalY;
    coverPivot.add(coverBody);

    var frontCover = new THREE.Mesh(coverGeo(), leatherMat);
    frontCover.castShadow = true; frontCover.receiveShadow = true;
    coverBody.add(frontCover);

    // marbled endpaper pasted inside the front cover
    var endpaperTex = texFrom(makeCanvas(Math.round(T * 0.6), Math.round(T * 0.6), function (ctx, w, h) {
      ctx.fillStyle = "#7d5c39"; ctx.fillRect(0, 0, w, h);
      fbmNoise(ctx, w, h, 4, 40, 0.30);
      ctx.globalCompositeOperation = "overlay";
      for (var i = 0; i < 90; i++) {
        var cx = Math.random() * w, cy = Math.random() * h;
        var r = w * (0.02 + Math.random() * 0.10);
        var g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
        var warm = Math.random() < 0.5;
        g.addColorStop(0, warm ? "rgba(168,104,48,0.55)" : "rgba(58,34,18,0.5)");
        g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalCompositeOperation = "source-over";
      // a plain border where the pastedown meets the turned-in leather
      ctx.strokeStyle = "rgba(38,22,10,0.85)";
      ctx.lineWidth = w * 0.045;
      ctx.strokeRect(w * 0.022, h * 0.022, w * 0.956, h * 0.956);
    }), THREE.SRGBColorSpace);

    var endpaperGeo = track(new THREE.PlaneGeometry(BOOK_W * 0.94, BOOK_H * 0.95));
    endpaperGeo.rotateX(Math.PI / 2);              // face -Y (the cover's inside)
    endpaperGeo.translate(BOOK_W / 2, 0, 0);
    var endpaper = new THREE.Mesh(endpaperGeo, track(new THREE.MeshStandardMaterial({
      map: endpaperTex, normalMap: parchNormalTex,
      normalScale: new THREE.Vector2(0.35, 0.35),
      roughness: 0.92, metalness: 0.0, envMapIntensity: 0.35,
    })));
    endpaper.position.set(0, -COVER_THICK / 2 - 0.0012, 0);
    endpaper.receiveShadow = true;
    coverBody.add(endpaper);

    // --- cover furniture: corner bosses, centre emblem, clasp ---
    var coverTopY = COVER_THICK / 2;

    var cornerGeo = track(new THREE.BoxGeometry(0.088, 0.005, 0.088));
    var studGeo = track(new THREE.SphereGeometry(0.010, 12, 10));
    [[0.075, -BOOK_H / 2 + 0.075], [BOOK_W - 0.075, -BOOK_H / 2 + 0.075],
     [0.075, BOOK_H / 2 - 0.075], [BOOK_W - 0.075, BOOK_H / 2 - 0.075]].forEach(function (c) {
      var m = new THREE.Mesh(cornerGeo, goldMat);
      m.position.set(c[0], coverTopY + 0.002, c[1]);
      m.castShadow = true;
      coverBody.add(m);
      var stud = new THREE.Mesh(studGeo, goldMat);
      stud.position.set(c[0], coverTopY + 0.006, c[1]);
      stud.castShadow = true;
      coverBody.add(stud);
    });

    var emblem = new THREE.Mesh(track(new THREE.TorusGeometry(0.085, 0.0085, 10, 40)), goldMat);
    emblem.rotation.x = Math.PI / 2;
    emblem.position.set(BOOK_W / 2, coverTopY + 0.003, 0);
    emblem.castShadow = true;
    coverBody.add(emblem);

    var emblemInner = new THREE.Mesh(track(new THREE.TorusGeometry(0.042, 0.006, 10, 30)), goldMat);
    emblemInner.rotation.x = Math.PI / 2;
    emblemInner.position.set(BOOK_W / 2, coverTopY + 0.003, 0);
    emblemInner.castShadow = true;
    coverBody.add(emblemInner);

    var emblemStud = new THREE.Mesh(track(new THREE.SphereGeometry(0.017, 14, 12)), goldMat);
    emblemStud.position.set(BOOK_W / 2, coverTopY + 0.008, 0);
    emblemStud.castShadow = true;
    coverBody.add(emblemStud);

    // clasp strap on the fore-edge
    var strap = new THREE.Mesh(
      track(new THREE.BoxGeometry(0.14, 0.008, 0.085)),
      track(new THREE.MeshStandardMaterial({ color: 0x241408, roughness: 0.85, metalness: 0.0 }))
    );
    strap.position.set(BOOK_W - 0.07, coverTopY + 0.004, 0);
    strap.castShadow = true;
    coverBody.add(strap);

    // the strap turns down over the fore-edge and the clasp hooks under it
    var strapLip = new THREE.Mesh(
      track(new THREE.BoxGeometry(0.010, PAGE_BLOCK * 0.92, 0.085)),
      track(new THREE.MeshStandardMaterial({ color: 0x241408, roughness: 0.85 }))
    );
    strapLip.position.set(BOOK_W + 0.003, coverTopY - PAGE_BLOCK * 0.46, 0);
    strapLip.castShadow = true;
    coverBody.add(strapLip);

    var claspPivot = new THREE.Group();
    claspPivot.position.set(BOOK_W + 0.004, coverTopY - COVER_THICK * 0.5, 0);
    coverBody.add(claspPivot);
    var clasp = new THREE.Mesh(track(new THREE.BoxGeometry(0.05, 0.014, 0.10)), goldMat);
    clasp.position.set(-0.012, -PAGE_BLOCK * 0.45, 0);
    clasp.castShadow = true;
    claspPivot.add(clasp);

    /* --- the light that erupts from the spine at the climax ----------- */
    var spineGlow = new THREE.Sprite(track(new THREE.SpriteMaterial({
      map: glowTex, blending: THREE.AdditiveBlending, transparent: true,
      depthWrite: false, depthTest: false, color: 0xffd9a4, opacity: 0,
    })));
    spineGlow.position.set(SPINE_X + 0.02, spineR * 1.1, 0);
    spineGlow.scale.set(0.1, 0.1, 1);
    spineGlow.renderOrder = 6;
    scene.add(spineGlow);

    // a slim emissive bar sitting in the gutter, so the light has a source
    // with actual shape rather than just a billboard
    var gutterBar = new THREE.Mesh(
      track(new THREE.PlaneGeometry(0.05, BOOK_H * 0.88)),
      track(new THREE.MeshBasicMaterial({
        color: 0xffe6bd, transparent: true, opacity: 0,
        blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
      }))
    );
    gutterBar.rotation.x = -Math.PI / 2;
    gutterBar.position.set(SPINE_X + 0.02, spineR * 1.02, 0);
    gutterBar.renderOrder = 5;
    scene.add(gutterBar);

    /* ====================================================================
       VOLUMETRIC LIGHT SHAFTS

       Real geometry, not an overlay: tapered cones aligned with the key
       light, drawn additively with no depth write. Brightness comes from
       how side-on the surface is to the viewer, so each cone reads as a
       solid column of lit air rather than a visible cone. A scrolling
       noise term makes the dust inside it drift.
       ==================================================================== */
    var shaftUniforms = {
      uTime:      { value: 0 },
      uIntensity: { value: 0.085 },
      uColor:     { value: new THREE.Color(0xffd7a0) },
      uNoise:     { value: null },
      uPower:     { value: 4.5 },
    };

    var shaftNoiseTex = texFrom(makeCanvas(128, 128, function (ctx, w, h) {
      ctx.fillStyle = "#808080"; ctx.fillRect(0, 0, w, h);
      fbmNoise(ctx, w, h, 4, 48, 0.55);
    }));
    shaftNoiseTex.wrapS = shaftNoiseTex.wrapT = THREE.RepeatWrapping;
    shaftUniforms.uNoise.value = shaftNoiseTex;

    var shaftMat = track(new THREE.ShaderMaterial({
      uniforms: shaftUniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      vertexShader: [
        "varying vec2 vUv;",
        "varying vec3 vNormalW;",
        "varying vec3 vViewW;",
        "void main() {",
        "  vUv = uv;",
        "  vec4 wp = modelMatrix * vec4(position, 1.0);",
        "  vNormalW = normalize(mat3(modelMatrix) * normal);",
        "  vViewW = normalize(cameraPosition - wp.xyz);",
        "  gl_Position = projectionMatrix * viewMatrix * wp;",
        "}",
      ].join("\n"),
      fragmentShader: [
        "uniform float uTime;",
        "uniform float uIntensity;",
        "uniform vec3  uColor;",
        "uniform sampler2D uNoise;",
        "uniform float uPower;",
        "varying vec2 vUv;",
        "varying vec3 vNormalW;",
        "varying vec3 vViewW;",
        "void main() {",
        // face-on to the viewer = looking down the depth of the column
        "  float facing = abs(dot(normalize(vNormalW), normalize(vViewW)));",
        "  float body = pow(facing, uPower);",
        // fade in under the canopy and out before it reaches the floor
        "  float top = smoothstep(0.0, 0.30, vUv.y);",
        "  float bot = 1.0 - smoothstep(0.55, 1.0, vUv.y);",
        // drifting motes
        "  vec2 n1 = vec2(vUv.x * 1.7, vUv.y * 0.5 - uTime * 0.012);",
        "  vec2 n2 = vec2(vUv.x * 2.9 + 0.37, vUv.y * 0.8 - uTime * 0.021);",
        "  float dust = texture2D(uNoise, n1).r * 0.65 + texture2D(uNoise, n2).r * 0.55;",
        "  float a = body * top * bot * uIntensity * (0.22 + dust * 0.95);",
        "  if (a <= 0.001) discard;",
        "  gl_FragColor = vec4(uColor * a, a);",
        "}",
      ].join("\n"),
    }));

    var shaftGroup = new THREE.Group();
    scene.add(shaftGroup);
    (function buildShafts() {
      // aim the columns along the key light's direction
      var dir = key.position.clone().normalize();
      for (var i = 0; i < Q.shafts; i++) {
        var len = 2.6 + Math.random() * 1.4;
        var rTop = 0.05 + Math.random() * 0.10;
        var geo = track(new THREE.CylinderGeometry(rTop, rTop * (2.2 + Math.random()), len, 14, 1, true));
        var m = new THREE.Mesh(geo, shaftMat);
        // spread them around the book, biased to the key-light side
        var ang = (i / Q.shafts) * Math.PI * 2 + Math.random() * 0.7;
        var rad = 0.35 + Math.random() * 1.5;
        m.position.set(
          Math.cos(ang) * rad - dir.x * 0.5,
          len * 0.5 - 0.35,
          Math.sin(ang) * rad - dir.z * 0.5
        );
        // lean each column along the light, with a little scatter
        m.rotation.z = Math.atan2(dir.x, dir.y) + (Math.random() - 0.5) * 0.12;
        m.rotation.x = -Math.atan2(dir.z, dir.y) + (Math.random() - 0.5) * 0.12;
        m.renderOrder = 3;
        shaftGroup.add(m);
      }
    })();

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
        var y = ((s.y0 + t * s.speed * (1 + emberBoost * 3.0)) % 1) * s.top;
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

      if (Q.dofCapable) {
        bokehPass = new THREE.BokehPass(scene, camera, {
          focus: 2.35, aperture: 0.009, maxblur: 0.016,
        });
        bokehPass.enabled = Q.dof;   // may be switched on later, see adaptQuality
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
    var BLOOM_CLIMAX = 1.35;
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
      // wider and higher while the pages fan, or the arc leaves the frame
      flip:   { pos: new THREE.Vector3(2.02, 1.18, 2.22), look: new THREE.Vector3(-0.02, 0.20, -0.02) },
      climax: { pos: new THREE.Vector3(0.94, 0.36, 0.99), look: new THREE.Vector3(-0.12, 0.20, 0.0) },
    };
    var _camPos = new THREE.Vector3(), _camLook = new THREE.Vector3();

    var camOverride = null;   // set by the screenshot harness for inspection

    function updateCamera(t, climaxT, wideT) {
      if (camOverride) {
        camera.position.copy(camOverride.pos);
        camera.lookAt(camOverride.look);
        return;
      }
      var k = easeInOutCubic(climaxT), w = wideT || 0;
      _camPos.copy(camRig.idle.pos).lerp(camRig.flip.pos, w).lerp(camRig.climax.pos, k);
      _camLook.copy(camRig.idle.look).lerp(camRig.flip.look, w).lerp(camRig.climax.look, k);
      // handheld drift — three detuned sines so it never obviously repeats
      var amp = 0.030 * (1 - k * 0.55);
      _camPos.x += (Math.sin(t * 0.31) * 0.6 + Math.sin(t * 0.73 + 1.1) * 0.4) * amp;
      _camPos.y += (Math.sin(t * 0.24 + 2.0) * 0.5 + Math.sin(t * 0.61) * 0.5) * amp * 0.7;
      _camPos.z += Math.sin(t * 0.19 + 0.6) * amp * 0.5;
      // dolly out by whatever the lens cap could not cover
      if (fitDist !== 1) _camPos.sub(_camLook).multiplyScalar(fitDist).add(_camLook);
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
      handoffAt: 0.70,   // hand off once the gold actually fills frame   // fraction of the climax at which we cut to the site
    };
    TL.flipDur = TL.pageStagger * (HERO_PAGES - 1) + TL.pageDur;
    TL.openStart = TL.claspDur * 0.6;
    TL.flipStart = TL.openStart + TL.coverDur * 0.62;
    TL.climaxStart = TL.flipStart + TL.flipDur * 0.92;
    TL.total = TL.climaxStart + TL.climaxDur;

    function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
    function easeInOutCubic(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
    function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }
    function easeInCubic(t) { return t * t * t; }
    function easeInQuart(t) { return t * t * t * t; }
    /* a settle with a little weight to it — overshoots slightly, then lands */
    function easeOutBackSoft(t) {
      var c1 = 1.10, c3 = c1 + 1;
      return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
    }

    var state = { triggered: false, triggerTime: 0, handedOff: false };
    var SHAFT_IDLE = 0.085;
    var emberBoost = 0;

    /* ====================================================================
       FRAME — pure function of time
       ==================================================================== */
    function updateScene(now) {
      updateEmbers(now);
      shaftUniforms.uTime.value = now;
      bookGroup.position.y = Math.sin(now * 0.5) * 0.002;

      var climaxT = 0;
      var wideT = 0;

      if (!state.triggered) {
        // idle: the clasp breathes very slightly, nothing else moves
        claspPivot.rotation.z = Math.sin(now * 0.8) * 0.012;
        coverPivot.rotation.z = 0;
        leftStack.visible = false;
        shaftUniforms.uIntensity.value = SHAFT_IDLE;
        emberBoost = 0;
        updateCamera(now, 0, 0);
        return;
      }

      var s = now - state.triggerTime;

      // --- clasp releases ---
      var ct = clamp01(s / TL.claspDur);
      claspPivot.rotation.z = -easeOutBackSoft(ct) * 1.55;

      // --- cover swings open about the spine ---
      var ot = clamp01((s - TL.openStart) / TL.coverDur);
      var oe = easeInOutCubic(ot);
      // slightly past flat, so the open cover leans down onto the floor
      // instead of hanging in the air at hinge height
      coverPivot.rotation.z = oe * Math.PI;
      leftStack.visible = oe > 0.32;

      // --- pages fan across ---
      var ft = s - TL.flipStart;
      var landed = 0;
      for (var pi = 0; pi < heroPages.length; pi++) {
        var page = heroPages[pi];
        var lt = (ft - pi * TL.pageStagger) / TL.pageDur;
        if (lt <= 0) {
          // still waiting its turn: parked in the right-hand stack
          page.mesh.visible = false;
          continue;
        }
        var tc = clamp01(lt);
        landed += tc;
        page.mesh.visible = true;
        // ease out of the lift, ease into the landing, with a touch of
        // overshoot so it flutters down rather than snapping flat
        var e = tc < 1 ? easeInOutCubic(tc) : 1;
        page.pivot.rotation.z = e * Math.PI;
        shapePage(page, tc, CURL_SIGN);
      }

      // hold the wide framing from the moment the cover starts lifting
      wideT = easeInOutCubic(clamp01((s - TL.openStart) / (TL.coverDur * 0.85)));

      var flipProgress = heroPages.length ? landed / heroPages.length : 0;
      var th = applyStacks(flipProgress);

      // hinge rides from the top of the shrinking stack to the growing one
      for (var pj = 0; pj < heroPages.length; pj++) {
        var pg = heroPages[pj];
        var ltj = clamp01((ft - pj * TL.pageStagger) / TL.pageDur);
        var ej = easeInOutCubic(ltj);
        pg.pivot.position.y = blockBottom
          + (th.right * (1 - ej) + th.left * ej)
          + pj * 0.0016 + 0.001;
      }

      // --- climax ---
      if (s >= TL.climaxStart) {
        climaxT = clamp01((s - TL.climaxStart) / TL.climaxDur);
        /* Two curves, not one. The glow builds slowly then runs away
           (a crescendo), while the camera move is eased at both ends so
           the push-in feels authored rather than mechanical. */
        var build = easeInQuart(climaxT);
        var flare = easeInCubic(climaxT);

        spineLight.position.set(SPINE_X + 0.02, spineR * 1.05, 0);
        spineLight.intensity = build * 24;

        spineGlow.material.opacity = Math.min(1, flare * 1.35);
        spineGlow.scale.setScalar(0.12 + build * 6.5);

        gutterBar.material.opacity = Math.min(1, flare * 1.4);

        if (bloomPass) bloomPass.strength = BLOOM_IDLE + (BLOOM_CLIMAX - BLOOM_IDLE) * build;
        pageMatA.emissiveIntensity = flare * 2.8;
        pageMatB.emissiveIntensity = flare * 2.8;

        // the shafts catch the new light too
        shaftUniforms.uIntensity.value = SHAFT_IDLE + build * 0.55;

        // embers get swept upward and brighten
        emberBoost = build;
        emberMat.opacity = 0.85 + flare * 0.15;

        // a touch of lens compression as we push in
        var fov = fitFov - easeInOutCubic(climaxT) * 4.0;
        if (Math.abs(camera.fov - fov) > 0.01) {
          camera.fov = fov;
          camera.updateProjectionMatrix();
        }

        if (climaxT >= TL.handoffAt && !state.handedOff) {
          state.handedOff = true;
          if (window.finishBookIntro) window.finishBookIntro();
        }
      }

      updateCamera(now, climaxT, wideT);
    }

    /* ====================================================================
       ADAPTIVE QUALITY

       The tier above is a guess made from the user agent, which is a poor
       proxy for how fast a device actually is — an iPad and a budget
       Android phone both look like "coarse pointer". So treat it as a
       starting point and then measure. Frame pacing is sampled over short
       windows; if the device is comfortably ahead we give back depth of
       field, and if it falls behind we shed work in a fixed order.

       Levels, richest first:
         0  depth of field on, full pixel ratio
         1  depth of field off
         2  + pixel ratio capped at 1.25
         3  + bloom off, pixel ratio 1.0    (last resort)
       ==================================================================== */
    var qLevel = (TIER === "high") ? 0 : (TIER === "mid" ? 1 : 2);
    var qFloor = qLevel;              // never upgrade past the tier's start...
    var qCeiling = Q.dofCapable ? 0 : 1;   // ...except to earn back DOF
    var qDowngrades = 0;
    var qSamples = [];
    var qLastCheck = 0;

    function applyQualityLevel() {
      if (bokehPass) bokehPass.enabled = (qLevel <= 0);
      if (bloomPass) bloomPass.enabled = (qLevel <= 2);
      var cap = qLevel >= 3 ? 1.0 : (qLevel >= 2 ? 1.25 : Q.dpr);
      var want = Math.min(window.devicePixelRatio || 1, cap);
      if (Math.abs(renderer.getPixelRatio() - want) > 0.01) {
        renderer.setPixelRatio(want);
        renderer.setSize(window.innerWidth, window.innerHeight);
        if (composer) {
          composer.setPixelRatio(want);
          composer.setSize(window.innerWidth, window.innerHeight);
        }
      }
    }
    applyQualityLevel();

    function adaptQuality(nowMs, dtMs) {
      // ignore the very first frames and anything that looks like a stall
      if (dtMs <= 0 || dtMs > 500) return;
      qSamples.push(dtMs);
      if (nowMs - qLastCheck < 1500) return;
      qLastCheck = nowMs;
      if (qSamples.length < 20) { qSamples.length = 0; return; }

      var a = qSamples.slice().sort(function (x, y) { return x - y; });
      var median = a[a.length >> 1];
      qSamples.length = 0;

      if (median > 24 && qLevel < 3) {              // below ~42fps: shed work
        qLevel++; qDowngrades++;
        applyQualityLevel();
      } else if (median < 15.0 && qLevel > qCeiling && qDowngrades === 0 && !state.triggered) {
        /* Only upgrade while still idle, and only with real headroom
           (~67fps+). Idle is the cheapest part of the scene — the page fan
           and the climax cost noticeably more — so a device that is merely
           scraping 60 here would drop frames exactly where it matters. */
        qLevel--;
        applyQualityLevel();
      }
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
      if (lastFrameAt) {
        var dt = t0 - lastFrameAt;
        if (frameTimes.length < 600) frameTimes.push(dt);
        adaptQuality(t0, dt);
      }
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
      updateFraming();
      renderer.setSize(window.innerWidth, window.innerHeight);
      if (composer) {
        composer.setSize(window.innerWidth, window.innerHeight);
        composer.setPixelRatio(renderer.getPixelRatio());
      }
      if (bloomPass) bloomPass.resolution.set(window.innerWidth, window.innerHeight);
      applyQualityLevel();
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
        if (o.shaft !== undefined) { SHAFT_IDLE = o.shaft; shaftUniforms.uIntensity.value = o.shaft; }
        if (o.shaftPower !== undefined) shaftUniforms.uPower.value = o.shaftPower;
        if (o.curlMax !== undefined) CURL_MAX = o.curlMax;
        if (o.curlSign !== undefined) CURL_SIGN = o.curlSign;
        if (o.droop !== undefined) DROOP = o.droop;
        leatherMat.needsUpdate = true;
      },
      /* Resume the live loop for a while and report real frame pacing.
         frame() pauses the loop, so the plain profile() below only ever
         sees warm-up frames. */
      quality: function () {
        return {
          tier: TIER, level: qLevel, floor: qFloor, ceiling: qCeiling,
          downgrades: qDowngrades,
          dof: !!(bokehPass && bokehPass.enabled),
          bloom: !!(bloomPass && bloomPass.enabled),
          dpr: +renderer.getPixelRatio().toFixed(2),
          passes: composer ? composer.passes.length : 0,
        };
      },
      setLevel: function (n) { qLevel = n; applyQualityLevel(); },
      /* Feed synthetic frame pacing so the ladder can be exercised without
         hardware that actually hits those rates. */
      simulateFrames: function (dtMs, n) {
        running = false;
        if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
        qSamples.length = 0;
        var t = qLastCheck + 1;
        for (var i = 0; i < n; i++) adaptQuality(t++, dtMs);  // accumulate
        adaptQuality(qLastCheck + 2000, dtMs);                // force the check
        return qLevel;
      },
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
