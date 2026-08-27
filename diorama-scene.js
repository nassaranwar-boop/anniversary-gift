/* =========================================================================
   DIORAMA-SCENE.JS — the magic book

   Each memory is a miniature world standing on the pages of an open book,
   with golden light spiralling up around it, dust and fireflies in the
   air, and heavy bloom. Real 3D, procedural: no external image files.

   Requires vendor/three.bundle.js (three r180 + postprocessing).

   Public API, used by script.js:
     Diorama.mount()            build the renderer and scene (idempotent)
     Diorama.show(memoryIndex)  raise the world for that memory
     Diorama.hide()             sink it back down
     Diorama.dispose()          free everything
     Diorama.ok                 false if 3D is unavailable
   ========================================================================= */
window.Diorama = (function () {
  "use strict";

  var api = { ok: false, ready: false };
  var canvas, renderer, scene, camera, composer, bloomPass;
  var clock, rafId = null, running = false;
  var worldGroup, ribbonGroup, motePoints, fireflyPoints, bookGroup;
  var disposables = [];
  var currentIndex = -1;
  var riseT = 0, riseTarget = 0;
  var TIER = "high", Q;
  var pointer = { x: 0, y: 0, tx: 0, ty: 0 };

  function track(x) { disposables.push(x); return x; }

  /* ------------------------------------------------------------------ */
  function mount() {
    if (api.ready) return true;
    canvas = document.getElementById("dio3d");
    if (!canvas || typeof THREE === "undefined") return false;
    try {
      var probe = document.createElement("canvas");
      if (!(probe.getContext("webgl2") || probe.getContext("webgl"))) return false;
    } catch (e) { return false; }

    var coarse = window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
    var small = Math.min(window.innerWidth, window.innerHeight) < 520;
    TIER = !coarse ? "high" : (small ? "low" : "mid");
    Q = ({
      high: { dpr: 2.0, bloom: true, motes: 260, flies: 22, ribbonSeg: 220, shadow: 1024 },
      mid:  { dpr: 1.7, bloom: true, motes: 160, flies: 14, ribbonSeg: 150, shadow: 512 },
      low:  { dpr: 1.4, bloom: true, motes: 100, flies: 10, ribbonSeg: 100, shadow: 0 },
    })[TIER];

    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: false, alpha: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, Q.dpr));
    renderer.setSize(canvas.clientWidth || 640, canvas.clientHeight || 360);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    if (Q.shadow) { renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; }
    renderer.setClearColor(0x000000, 0);

    scene = new THREE.Scene();
    clock = new THREE.Clock();
    camera = new THREE.PerspectiveCamera(34, 16 / 9, 0.05, 60);

    buildEnvironment();
    buildBook();
    buildRibbons();
    buildParticles();

    worldGroup = new THREE.Group();
    worldGroup.position.set(0, 0.30, 0);
    scene.add(worldGroup);

    buildComposer();
    resize();
    window.addEventListener("resize", resize);
    canvas.addEventListener("pointermove", onPointer, { passive: true });

    api.ok = true; api.ready = true;
    return true;
  }

  /* ---------------- lighting + backdrop ---------------- */
  function buildEnvironment() {
    scene.add(track(new THREE.HemisphereLight(0xffe0b0, 0x2a1a10, 0.35)));

    var key = new THREE.DirectionalLight(0xffd9a0, 1.5);
    key.position.set(-2.0, 3.0, 2.2);
    if (Q.shadow) {
      key.castShadow = true;
      key.shadow.mapSize.set(Q.shadow, Q.shadow);
      key.shadow.camera.near = 0.5; key.shadow.camera.far = 12;
      key.shadow.camera.left = -1.4; key.shadow.camera.right = 1.4;
      key.shadow.camera.top = 1.4; key.shadow.camera.bottom = -1.4;
      key.shadow.bias = -0.0012; key.shadow.normalBias = 0.02;
    }
    scene.add(track(key));

    var rim = new THREE.DirectionalLight(0xffb070, 0.85);
    rim.position.set(2.6, 1.4, -2.2);
    scene.add(track(rim));

    /* the glow that lives in the gutter and lights the world from below —
       this is what sells "the light is coming out of the book" */
    var gutter = new THREE.PointLight(0xffcf85, 1.6, 2.2, 2.0);
    gutter.position.set(0, 0.16, 0);
    scene.add(track(gutter));
    api._gutter = gutter;
  }

  /* ---------------- the open book ---------------- */
  function makeCanvasTex(w, h, draw, srgb) {
    var c = document.createElement("canvas");
    c.width = w; c.height = h;
    draw(c.getContext("2d"), w, h);
    var t = new THREE.CanvasTexture(c);
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);
    return track(t);
  }

  function buildBook() {
    bookGroup = new THREE.Group();
    scene.add(bookGroup);

    var paperTex = makeCanvasTex(512, 512, function (ctx, w, h) {
      ctx.fillStyle = "#efdcb4"; ctx.fillRect(0, 0, w, h);
      for (var i = 0; i < 3000; i++) {
        var s = (Math.random() - 0.5) * 22;
        ctx.fillStyle = "rgba(" + ((228 + s) | 0) + "," + ((208 + s) | 0) + "," + ((168 + s) | 0) + ",0.5)";
        ctx.fillRect(Math.random() * w, Math.random() * h, 1.5, 1.5);
      }
      for (var k = 0; k < 7; k++) {
        var cx = Math.random() * w, cy = Math.random() * h, r = 40 + Math.random() * 90;
        var g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
        g.addColorStop(0, "rgba(150,110,60,0.14)"); g.addColorStop(1, "rgba(150,110,60,0)");
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
      }
      // faint lines of writing on the visible pages
      ctx.strokeStyle = "rgba(80,58,30,0.30)"; ctx.lineWidth = 2;
      for (var y = 70; y < h - 60; y += 26) {
        var x = 60, end = w - 60 - Math.random() * 90;
        while (x < end) {
          var seg = 14 + Math.random() * 26;
          ctx.beginPath(); ctx.moveTo(x, y);
          ctx.quadraticCurveTo(x + seg * 0.5, y + (Math.random() * 5 - 2.5), x + seg, y);
          ctx.stroke();
          x += seg + 6 + Math.random() * 8;
        }
      }
    }, true);

    var paperMat = track(new THREE.MeshStandardMaterial({ map: paperTex, roughness: 0.94, metalness: 0 }));
    var edgeMat = track(new THREE.MeshStandardMaterial({ color: 0xcbb185, roughness: 0.9 }));
    var leatherMat = track(new THREE.MeshStandardMaterial({ color: 0x6b3f1c, roughness: 0.78 }));

    /* two page slabs, tilted up slightly like a real open spread */
    [-1, 1].forEach(function (side) {
      var pageGeo = track(new THREE.BoxGeometry(0.86, 0.05, 1.12, 1, 1, 1));
      var page = new THREE.Mesh(pageGeo, [edgeMat, edgeMat, paperMat, edgeMat, edgeMat, edgeMat]);
      page.position.set(side * 0.44, 0.055, 0);
      page.rotation.z = side * -0.055;
      page.receiveShadow = !!Q.shadow;
      page.castShadow = !!Q.shadow;
      bookGroup.add(page);
    });

    var spine = new THREE.Mesh(
      track(new THREE.CylinderGeometry(0.055, 0.055, 1.14, 18, 1, false, 0, Math.PI)),
      leatherMat
    );
    spine.rotation.x = Math.PI / 2;
    spine.rotation.y = Math.PI;
    spine.position.set(0, 0.03, 0);
    bookGroup.add(spine);

    var cover = new THREE.Mesh(track(new THREE.BoxGeometry(1.86, 0.045, 1.2)), leatherMat);
    cover.position.set(0, 0.012, 0);
    cover.receiveShadow = !!Q.shadow;
    bookGroup.add(cover);

    /* the table the book rests on, fading out into the dark */
    var tableTex = makeCanvasTex(256, 256, function (ctx, w, h) {
      var g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
      g.addColorStop(0, "#4a2a16"); g.addColorStop(0.55, "#2e1a0e"); g.addColorStop(1, "#140a06");
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    }, true);
    var table = new THREE.Mesh(
      track(new THREE.CircleGeometry(6, 40)),
      track(new THREE.MeshStandardMaterial({ map: tableTex, roughness: 1 }))
    );
    table.rotation.x = -Math.PI / 2;
    table.position.y = -0.012;
    table.receiveShadow = !!Q.shadow;
    scene.add(table);
  }

  /* ---------------- the golden ribbons ----------------
     A helix swept into a tube, drawn additively. Two of them, counter
     wound, with the whole group turning slowly. This is the signature
     of the effect — the light has to *move* around the world. */
  function buildRibbons() {
    ribbonGroup = new THREE.Group();
    scene.add(ribbonGroup);

    function helix(turns, radius, height, phase, squash) {
      var pts = [];
      var steps = Q.ribbonSeg;
      for (var i = 0; i <= steps; i++) {
        var t = i / steps;
        var a = t * Math.PI * 2 * turns + phase;
        var r = radius * (0.34 + Math.sin(t * Math.PI) * 0.9) * (squash || 1);
        pts.push(new THREE.Vector3(Math.cos(a) * r, t * height, Math.sin(a) * r));
      }
      return new THREE.CatmullRomCurve3(pts);
    }

    var ribbonMat = track(new THREE.MeshBasicMaterial({
      color: 0xffc46a, transparent: true, opacity: 0.6,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    }));

    [[2.4, 0.40, 1.02, 0.0, 1.0], [1.8, 0.32, 0.86, 2.4, 1.12]].forEach(function (spec, i) {
      var curve = helix(spec[0], spec[1], spec[2], spec[3], spec[4]);
      var geo = track(new THREE.TubeGeometry(curve, Q.ribbonSeg, 0.012 - i * 0.003, 6, false));
      var mesh = new THREE.Mesh(geo, ribbonMat);
      mesh.renderOrder = 4;
      ribbonGroup.add(mesh);
    });

    /* a soft column of light straight out of the gutter */
    var beamTex = makeCanvasTex(64, 128, function (ctx, w, h) {
      var g = ctx.createLinearGradient(0, h, 0, 0);
      g.addColorStop(0, "rgba(255,214,150,0.6)");
      g.addColorStop(0.45, "rgba(255,196,120,0.28)");
      g.addColorStop(1, "rgba(255,180,100,0)");
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      var s = ctx.createLinearGradient(0, 0, w, 0);
      s.addColorStop(0, "rgba(0,0,0,0)"); s.addColorStop(0.5, "rgba(255,255,255,1)"); s.addColorStop(1, "rgba(0,0,0,0)");
      ctx.globalCompositeOperation = "destination-in";
      ctx.fillStyle = s; ctx.fillRect(0, 0, w, h);
    });
    var beam = new THREE.Mesh(
      track(new THREE.PlaneGeometry(0.5, 1.3)),
      track(new THREE.MeshBasicMaterial({
        map: beamTex, transparent: true, opacity: 0.55,
        blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
      }))
    );
    beam.position.set(0, 0.68, 0);
    beam.renderOrder = 3;
    ribbonGroup.add(beam);
    api._beam = beam;
  }

  /* ---------------- dust + fireflies ---------------- */
  function glowSprite(inner, outer) {
    return makeCanvasTex(64, 64, function (ctx, w, h) {
      var g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
      g.addColorStop(0, inner); g.addColorStop(0.3, outer); g.addColorStop(1, "rgba(255,180,90,0)");
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    });
  }

  var moteSeed = [], flySeed = [];
  function buildParticles() {
    var mg = track(new THREE.BufferGeometry());
    var mp = new Float32Array(Q.motes * 3);
    for (var i = 0; i < Q.motes; i++) {
      var a = Math.random() * Math.PI * 2, r = 0.12 + Math.random() * Math.random() * 1.5;
      moteSeed.push({ x: Math.cos(a) * r, z: Math.sin(a) * r, y0: Math.random(),
        speed: 0.02 + Math.random() * 0.05, top: 0.9 + Math.random() * 1.3,
        sway: 0.02 + Math.random() * 0.07, ph: Math.random() * 6.28 });
    }
    mg.setAttribute("position", new THREE.BufferAttribute(mp, 3));
    motePoints = new THREE.Points(mg, track(new THREE.PointsMaterial({
      size: 0.017, map: glowSprite("rgba(255,255,255,1)", "rgba(255,226,160,0.8)"),
      transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending,
      depthWrite: false, sizeAttenuation: true, color: 0xffe0a8,
    })));
    scene.add(motePoints);

    var fg = track(new THREE.BufferGeometry());
    var fp = new Float32Array(Q.flies * 3);
    for (var k = 0; k < Q.flies; k++) {
      flySeed.push({ r: 0.4 + Math.random() * 0.7, y: 0.25 + Math.random() * 0.85,
        sp: 0.16 + Math.random() * 0.34, ph: Math.random() * 6.28,
        bob: 0.06 + Math.random() * 0.14, bs: 0.5 + Math.random() });
    }
    fg.setAttribute("position", new THREE.BufferAttribute(fp, 3));
    fireflyPoints = new THREE.Points(fg, track(new THREE.PointsMaterial({
      size: 0.075, map: glowSprite("rgba(255,255,245,1)", "rgba(255,232,140,0.95)"),
      transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending,
      depthWrite: false, sizeAttenuation: true, color: 0xfff0b0,
    })));
    scene.add(fireflyPoints);
  }

  /* ---------------- post ---------------- */
  function buildComposer() {
    var size = renderer.getDrawingBufferSize(new THREE.Vector2());
    var rt = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: TIER === "high" ? 4 : 0 });
    composer = new THREE.EffectComposer(renderer, rt);
    composer.addPass(new THREE.RenderPass(scene, camera));
    if (Q.bloom) {
      bloomPass = new THREE.UnrealBloomPass(new THREE.Vector2(size.x, size.y), 0.55, 0.6, 0.86);
      composer.addPass(bloomPass);
    }
    composer.addPass(new THREE.OutputPass());
  }

  /* ====================================================================
     THE MINIATURE WORLDS
     Low-poly, stylised, warm — they read as models sitting on the page,
     not as attempts at realism.
     ==================================================================== */
  var MAT = {};
  function mats() {
    if (MAT.stone) return MAT;
    var mk = function (c, r, m) { return track(new THREE.MeshStandardMaterial({ color: c, roughness: r === undefined ? 0.8 : r, metalness: m || 0 })); };
    MAT.stone = mk(0xd8cdb8, 0.85);
    MAT.stone2 = mk(0xbcae95, 0.9);
    MAT.roof = mk(0x4a6ba8, 0.6);
    MAT.roofWarm = mk(0xa8542f, 0.7);
    MAT.wood = mk(0x8a5a30, 0.85);
    MAT.grass = mk(0x6f9a44, 0.95);
    MAT.grassDark = mk(0x547a33, 0.95);
    MAT.water = track(new THREE.MeshStandardMaterial({ color: 0x5fa8c4, roughness: 0.15, metalness: 0.2 }));
    MAT.gold = mk(0xffcf7a, 0.3, 0.9);
    MAT.glow = track(new THREE.MeshBasicMaterial({ color: 0xffd98a }));
    MAT.leaf = mk(0x5f8c3a, 0.95);
    MAT.trunk = mk(0x6b4526, 0.9);
    return MAT;
  }

  function baseIsland(g, r) {
    var M = mats();
    var rock = new THREE.Mesh(track(new THREE.CylinderGeometry(r, r * 0.72, 0.10, 14)), M.stone2);
    rock.position.y = -0.05;
    rock.castShadow = !!Q.shadow; rock.receiveShadow = !!Q.shadow;
    g.add(rock);
    var top = new THREE.Mesh(track(new THREE.CylinderGeometry(r * 1.02, r, 0.045, 14)), M.grass);
    top.position.y = 0.012;
    top.castShadow = !!Q.shadow; top.receiveShadow = !!Q.shadow;
    g.add(top);
  }

  function tinyTree(g, x, z, s) {
    var M = mats();
    var t = new THREE.Mesh(track(new THREE.CylinderGeometry(0.012 * s, 0.016 * s, 0.09 * s, 6)), M.trunk);
    t.position.set(x, 0.06 * s, z);
    g.add(t);
    var c = new THREE.Mesh(track(new THREE.IcosahedronGeometry(0.055 * s, 0)), M.leaf);
    c.position.set(x, 0.13 * s, z);
    c.castShadow = !!Q.shadow;
    g.add(c);
  }

  var WORLDS = [
    /* 0 — the castle, closest to the reference */
    function castle(g) {
      var M = mats();
      baseIsland(g, 0.34);
      function tower(x, z, r, h, roofColour) {
        var t = new THREE.Mesh(track(new THREE.CylinderGeometry(r, r * 1.08, h, 10)), M.stone);
        t.position.set(x, 0.03 + h / 2, z);
        t.castShadow = !!Q.shadow; t.receiveShadow = !!Q.shadow;
        g.add(t);
        var roof = new THREE.Mesh(track(new THREE.ConeGeometry(r * 1.5, h * 0.55, 10)), roofColour);
        roof.position.set(x, 0.03 + h + h * 0.26, z);
        roof.castShadow = !!Q.shadow;
        g.add(roof);
        // lit windows
        for (var i = 0; i < 3; i++) {
          var w = new THREE.Mesh(track(new THREE.BoxGeometry(r * 0.34, r * 0.5, 0.006)), M.glow);
          var a = i * 2.1;
          w.position.set(x + Math.cos(a) * r * 1.01, 0.06 + h * (0.3 + i * 0.22), z + Math.sin(a) * r * 1.01);
          w.lookAt(x + Math.cos(a) * r * 3, w.position.y, z + Math.sin(a) * r * 3);
          g.add(w);
        }
      }
      // keep
      var keep = new THREE.Mesh(track(new THREE.BoxGeometry(0.20, 0.24, 0.18)), M.stone);
      keep.position.set(0, 0.15, 0);
      keep.castShadow = !!Q.shadow; keep.receiveShadow = !!Q.shadow;
      g.add(keep);
      var keepRoof = new THREE.Mesh(track(new THREE.ConeGeometry(0.17, 0.14, 4)), M.roof);
      keepRoof.position.set(0, 0.34, 0); keepRoof.rotation.y = Math.PI / 4;
      keepRoof.castShadow = !!Q.shadow;
      g.add(keepRoof);
      tower(-0.15, 0.13, 0.05, 0.26, M.roof);
      tower(0.16, 0.12, 0.045, 0.22, M.roof);
      tower(-0.13, -0.14, 0.04, 0.19, M.roof);
      tower(0.15, -0.13, 0.055, 0.30, M.roof);
      // gatehouse + steps
      var gate = new THREE.Mesh(track(new THREE.BoxGeometry(0.09, 0.10, 0.04)), M.stone2);
      gate.position.set(0, 0.08, 0.13); g.add(gate);
      var door = new THREE.Mesh(track(new THREE.BoxGeometry(0.045, 0.06, 0.01)), M.glow);
      door.position.set(0, 0.06, 0.153); g.add(door);
      for (var s = 0; s < 3; s++) {
        var st = new THREE.Mesh(track(new THREE.BoxGeometry(0.10 - s * 0.012, 0.012, 0.02)), M.stone2);
        st.position.set(0, 0.028 - s * 0.012, 0.17 + s * 0.02);
        g.add(st);
      }
      tinyTree(g, -0.25, 0.05, 0.9); tinyTree(g, 0.26, -0.04, 0.8); tinyTree(g, 0.05, 0.24, 0.7);
    },

    /* 1 — a cottage under a big tree */
    function cottage(g) {
      var M = mats();
      baseIsland(g, 0.32);
      var body = new THREE.Mesh(track(new THREE.BoxGeometry(0.22, 0.14, 0.18)), M.stone);
      body.position.set(-0.02, 0.10, 0);
      body.castShadow = !!Q.shadow; body.receiveShadow = !!Q.shadow;
      g.add(body);
      var roof = new THREE.Mesh(track(new THREE.ConeGeometry(0.19, 0.13, 4)), M.roofWarm);
      roof.position.set(-0.02, 0.235, 0); roof.rotation.y = Math.PI / 4;
      roof.castShadow = !!Q.shadow;
      g.add(roof);
      var chim = new THREE.Mesh(track(new THREE.BoxGeometry(0.03, 0.08, 0.03)), M.stone2);
      chim.position.set(0.06, 0.27, -0.04); g.add(chim);
      [[-0.08, 0.11, 0.091], [0.05, 0.11, 0.091]].forEach(function (p) {
        var w = new THREE.Mesh(track(new THREE.BoxGeometry(0.05, 0.05, 0.008)), M.glow);
        w.position.set(p[0], p[1], p[2]); g.add(w);
      });
      var d = new THREE.Mesh(track(new THREE.BoxGeometry(0.045, 0.075, 0.008)), M.wood);
      d.position.set(-0.02, 0.072, 0.091); g.add(d);
      // the big tree
      var trunk = new THREE.Mesh(track(new THREE.CylinderGeometry(0.022, 0.03, 0.20, 7)), M.trunk);
      trunk.position.set(0.21, 0.12, 0.02);
      trunk.castShadow = !!Q.shadow; g.add(trunk);
      [[0.21, 0.27, 0.02, 0.10], [0.16, 0.24, 0.04, 0.065], [0.26, 0.235, -0.01, 0.06]].forEach(function (c) {
        var m = new THREE.Mesh(track(new THREE.IcosahedronGeometry(c[3], 0)), M.leaf);
        m.position.set(c[0], c[1], c[2]);
        m.castShadow = !!Q.shadow; g.add(m);
      });
      tinyTree(g, -0.24, 0.10, 0.8); tinyTree(g, -0.20, -0.16, 0.7);
      // a little fence
      for (var i = 0; i < 7; i++) {
        var f = new THREE.Mesh(track(new THREE.BoxGeometry(0.012, 0.05, 0.012)), M.wood);
        f.position.set(-0.28 + i * 0.055, 0.045, 0.24); g.add(f);
      }
    },

    /* 2 — a boat on a small bay */
    function bay(g) {
      var M = mats();
      baseIsland(g, 0.34);
      var water = new THREE.Mesh(track(new THREE.CylinderGeometry(0.26, 0.26, 0.03, 20)), M.water);
      water.position.y = 0.028; g.add(water);
      var boat = new THREE.Group();
      var hull = new THREE.Mesh(track(new THREE.BoxGeometry(0.16, 0.045, 0.07)), M.wood);
      hull.castShadow = !!Q.shadow; boat.add(hull);
      var prow = new THREE.Mesh(track(new THREE.ConeGeometry(0.036, 0.07, 4)), M.wood);
      prow.rotation.z = -Math.PI / 2; prow.position.set(0.10, 0, 0); boat.add(prow);
      var mast = new THREE.Mesh(track(new THREE.CylinderGeometry(0.005, 0.005, 0.20, 5)), M.trunk);
      mast.position.set(-0.01, 0.11, 0); boat.add(mast);
      var sail = new THREE.Mesh(track(new THREE.PlaneGeometry(0.11, 0.15)),
        track(new THREE.MeshStandardMaterial({ color: 0xfff2d8, roughness: 0.9, side: THREE.DoubleSide })));
      sail.position.set(0.035, 0.12, 0); sail.rotation.y = Math.PI / 2;
      sail.castShadow = !!Q.shadow; boat.add(sail);
      var lamp = new THREE.Mesh(track(new THREE.SphereGeometry(0.014, 8, 8)), M.glow);
      lamp.position.set(-0.07, 0.05, 0); boat.add(lamp);
      boat.position.set(0.02, 0.052, 0.01);
      boat.rotation.y = 0.4;
      g.add(boat);
      api._boat = boat;
      // rocks + a lighthouse stub
      for (var i = 0; i < 5; i++) {
        var a = i * 1.3;
        var r = new THREE.Mesh(track(new THREE.IcosahedronGeometry(0.02 + Math.random() * 0.02, 0)), M.stone2);
        r.position.set(Math.cos(a) * 0.25, 0.03, Math.sin(a) * 0.25); g.add(r);
      }
      tinyTree(g, -0.27, 0.09, 0.75); tinyTree(g, 0.26, 0.16, 0.65);
    },

    /* 3 — a lantern grove */
    function lanterns(g) {
      var M = mats();
      baseIsland(g, 0.33);
      for (var i = 0; i < 6; i++) {
        var a = (i / 6) * Math.PI * 2 + 0.4;
        var r = 0.14 + (i % 2) * 0.10;
        tinyTree(g, Math.cos(a) * (r + 0.10), Math.sin(a) * (r + 0.10), 0.75 + (i % 3) * 0.2);
      }
      var arch = new THREE.Mesh(track(new THREE.TorusGeometry(0.10, 0.010, 6, 18, Math.PI)), M.wood);
      arch.position.set(0, 0.03, 0.02); arch.rotation.y = 0.3;
      g.add(arch);
      api._lanterns = [];
      for (var k = 0; k < 9; k++) {
        var la = Math.random() * Math.PI * 2, lr = 0.06 + Math.random() * 0.24;
        var lamp = new THREE.Mesh(track(new THREE.SphereGeometry(0.016, 8, 8)), M.glow);
        lamp.position.set(Math.cos(la) * lr, 0.10 + Math.random() * 0.30, Math.sin(la) * lr);
        lamp.userData = { y0: lamp.position.y, ph: Math.random() * 6.28 };
        g.add(lamp);
        api._lanterns.push(lamp);
      }
      var bench = new THREE.Mesh(track(new THREE.BoxGeometry(0.11, 0.012, 0.035)), M.wood);
      bench.position.set(0, 0.055, 0.16); g.add(bench);
    },
  ];

  /* ---------------- show / hide ---------------- */
  function show(index) {
    if (!api.ready && !mount()) return;
    var i = ((index % WORLDS.length) + WORLDS.length) % WORLDS.length;
    if (i !== currentIndex) {
      currentIndex = i;
      while (worldGroup.children.length) worldGroup.remove(worldGroup.children[0]);
      var g = new THREE.Group();
      WORLDS[i](g);
      worldGroup.add(g);
    }
    riseTarget = 1;
    start();
  }
  function hide() { riseTarget = 0; }

  /* ---------------- loop ---------------- */
  function onPointer(e) {
    var r = canvas.getBoundingClientRect();
    pointer.tx = ((e.clientX - r.left) / r.width - 0.5) * 2;
    pointer.ty = ((e.clientY - r.top) / r.height - 0.5) * 2;
  }

  function frame(t) {
    riseT += (riseTarget - riseT) * 0.055;
    var e = riseT < 0.5 ? 4 * riseT * riseT * riseT : 1 - Math.pow(-2 * riseT + 2, 3) / 2;

    worldGroup.position.y = 0.07 + e * 0.13;
    worldGroup.scale.setScalar(0.26 + e * 0.92);
    worldGroup.rotation.y = t * 0.10;
    worldGroup.visible = riseT > 0.01;

    ribbonGroup.rotation.y = -t * 0.30;
    ribbonGroup.position.y = 0.06;
    ribbonGroup.scale.setScalar(0.5 + e * 0.24);
    ribbonGroup.children.forEach(function (m, i) {
      if (m.material && m.material.opacity !== undefined && m !== api._beam) {
        m.material.opacity = 0.20 + e * 0.38;
      }
    });
    if (api._beam) { api._beam.material.opacity = e * 0.14; api._beam.lookAt(camera.position.x, api._beam.position.y, camera.position.z); }
    if (api._gutter) api._gutter.intensity = 0.35 + e * 0.85;
    if (bloomPass) bloomPass.strength = 0.30 + e * 0.34;

    // dust
    var mp = motePoints.geometry.attributes.position;
    for (var i = 0; i < moteSeed.length; i++) {
      var s = moteSeed[i];
      var y = ((s.y0 + t * s.speed) % 1) * s.top;
      mp.setXYZ(i, s.x + Math.sin(t * 0.5 + s.ph) * s.sway, 0.03 + y, s.z + Math.cos(t * 0.42 + s.ph) * s.sway);
    }
    mp.needsUpdate = true;

    // fireflies orbit the world
    var fp = fireflyPoints.geometry.attributes.position;
    for (var k = 0; k < flySeed.length; k++) {
      var f = flySeed[k];
      var a = t * f.sp + f.ph;
      fp.setXYZ(k, Math.cos(a) * f.r * (0.5 + e * 0.7),
        (f.y * (0.4 + e * 0.8)) + Math.sin(t * f.bs + f.ph) * f.bob,
        Math.sin(a) * f.r * (0.5 + e * 0.7));
    }
    fp.needsUpdate = true;
    fireflyPoints.material.opacity = 0.3 + e * 0.68;

    if (api._boat) { api._boat.position.y = 0.052 + Math.sin(t * 1.1) * 0.006; api._boat.rotation.z = Math.sin(t * 0.9) * 0.05; }
    if (api._lanterns) api._lanterns.forEach(function (l) { l.position.y = l.userData.y0 + Math.sin(t * 0.8 + l.userData.ph) * 0.03; });

    // camera: slow drift, plus a little parallax from the pointer
    pointer.x += (pointer.tx - pointer.x) * 0.05;
    pointer.y += (pointer.ty - pointer.y) * 0.05;
    var camR = 2.12 - e * 0.16;
    camera.position.set(
      Math.sin(t * 0.09) * 0.16 + pointer.x * 0.24,
      0.80 + Math.sin(t * 0.13) * 0.03 - pointer.y * 0.12 + e * 0.06,
      camR
    );
    camera.lookAt(0, 0.20 + e * 0.14, 0);
  }

  function loop() {
    if (!running) return;
    rafId = requestAnimationFrame(loop);
    frame(clock.getElapsedTime());
    if (composer) composer.render(); else renderer.render(scene, camera);
  }
  function start() { if (running) return; running = true; clock.start(); loop(); }
  function stop() { running = false; if (rafId) cancelAnimationFrame(rafId); rafId = null; }

  function resize() {
    if (!renderer || !canvas) return;
    var w = canvas.clientWidth || canvas.parentElement.clientWidth || 640;
    var h = canvas.clientHeight || Math.round(w * 9 / 16);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    if (composer) composer.setSize(w, h);
    if (bloomPass) bloomPass.resolution.set(w, h);
  }

  function dispose() {
    stop();
    window.removeEventListener("resize", resize);
    disposables.forEach(function (d) { if (d && d.dispose) d.dispose(); });
    if (composer) {
      composer.passes.forEach(function (p) { if (p.dispose) p.dispose(); });
      composer.renderTarget1.dispose(); composer.renderTarget2.dispose();
    }
    if (renderer) renderer.dispose();
    api.ready = false; api.ok = false;
  }

  api.mount = mount;
  api.show = show;
  api.hide = hide;
  api.stop = stop;
  api.start = start;
  api.dispose = dispose;
  api.resize = resize;
  api.worldCount = function () { return WORLDS.length; };
  return api;
})();
