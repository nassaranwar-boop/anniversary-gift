/* =========================================================================
   BOOK-SCENE.JS — a real 3D cinematic intro built with Three.js.
   No external image files: every material is a procedurally generated
   THREE.CanvasTexture, drawn live in the browser. Self-contained.

   Public hooks used by script.js:
     window.skipBookIntro()   — stops the render loop immediately
     window.finishBookIntro() — defined in script.js; called once the
                                 climax flash begins, to hand off to the
                                 rest of the site (passcode gate).
   ========================================================================= */
(function () {
  "use strict";

  const canvas = document.getElementById("book-canvas");
  const loadingEl = document.getElementById("book-loading");
  const promptEl = document.getElementById("book-click-prompt");

  if (typeof THREE === "undefined") {
    // Three.js failed to load (offline CDN, blocked script, etc.) — don't
    // strand the user on a blank screen, just continue into the site.
    if (loadingEl) loadingEl.textContent = "Continuing…";
    setTimeout(() => { if (window.finishBookIntro) window.finishBookIntro(); }, 700);
    return;
  }

  try {
    runScene();
  } catch (err) {
    console.error("Book scene failed:", err);
    setTimeout(() => { if (window.finishBookIntro) window.finishBookIntro(); }, 300);
  }

  function runScene() {
    /* ---------------------------------------------------------------
       CONFIG
       --------------------------------------------------------------- */
    const BOOK_W = 0.86;          // spine-to-free-edge width
    const BOOK_H = 1.18;          // page height (depth on the ground)
    const COVER_THICK = 0.026;
    const PAGE_GAP = 0.0095;      // vertical thickness per paper page — thick enough to read individually
    const PAGE_COUNT = 15;        // fewer, clearly-legible pages beat 46 that blur into one slab
    const SPINE_X = -BOOK_W / 2;  // pivot line — fixed, world space

    const OPEN_DURATION = 1.3;         // cover swinging open, unhurried
    const FLIP_DURATION = 0.85;        // each individual page's own turn — deliberate, weighty
    const FLIP_STAGGER = 0.62;         // next page begins just before the last settles — sequential, not a blur
    const CLIMAX_DURATION = 2.3;

    /* ---------------------------------------------------------------
       RENDERER / SCENE / CAMERA
       --------------------------------------------------------------- */
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x070a04, 0.11);

    const camera = new THREE.PerspectiveCamera(34, window.innerWidth / window.innerHeight, 0.05, 30);
    const baseCameraPos = new THREE.Vector3(1.05, 0.72, 1.5);
    camera.position.copy(baseCameraPos);
    camera.lookAt(0, 0.14, 0);

    const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.setClearColor(0x050803, 1);

    const clock = new THREE.Clock();

    /* ---------------------------------------------------------------
       PROCEDURAL TEXTURES (canvas-drawn, no external files)
       --------------------------------------------------------------- */
    function makeCanvas(draw, w, h) {
      const c = document.createElement("canvas");
      c.width = w; c.height = h;
      draw(c.getContext("2d"), w, h);
      const tex = new THREE.CanvasTexture(c);
      tex.encoding = THREE.sRGBEncoding;
      return tex;
    }

    function speckle(ctx, w, h, count, rgbFn) {
      for (let i = 0; i < count; i++) {
        const x = Math.random() * w, y = Math.random() * h;
        ctx.fillStyle = rgbFn();
        ctx.fillRect(x, y, 1 + Math.random(), 1 + Math.random());
      }
    }

    function scribbleBlock(ctx, w, h, color, margin) {
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.8;
      let y = margin;
      while (y < h - margin * 0.8) {
        let x = margin * 0.9 + (Math.random() < 0.2 ? 22 : 0);
        const target = x + (w - margin * 1.8) * (0.5 + Math.random() * 0.36);
        while (x < target) {
          const seg = 13 + Math.random() * 19;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.quadraticCurveTo(x + seg * 0.5, y + (Math.random() * 9 - 4.5), x + seg, y + (Math.random() * 7 - 3.5));
          ctx.stroke();
          x += seg + 4 + Math.random() * 6;
        }
        y += 20 + (Math.random() < 0.16 ? 13 : 0);
      }
    }

    const leatherTexture = makeCanvas((ctx, w, h) => {
      ctx.fillStyle = "#432210"; ctx.fillRect(0, 0, w, h);
      speckle(ctx, w, h, 5000, () => {
        const s = (Math.random() - 0.5) * 34;
        return `rgba(${67 + s},${34 + s * 0.6},${16 + s * 0.4},0.5)`;
      });
      ctx.strokeStyle = "rgba(205,165,95,0.55)"; ctx.lineWidth = 6;
      ctx.strokeRect(30, 30, w - 60, h - 60);
      ctx.lineWidth = 2;
      ctx.strokeRect(46, 46, w - 92, h - 92);
      // corner flourish swirls
      function swirl(cx, cy, r) {
        ctx.beginPath();
        for (let t = 0; t < 14; t += 0.15) {
          const rad = r * (0.1 + t / 14 * 0.9);
          const x = cx + rad * Math.cos(t), y = cy + rad * Math.sin(t) * 0.7;
          if (t === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      ctx.strokeStyle = "rgba(205,165,95,0.4)"; ctx.lineWidth = 2;
      swirl(90, 90, 46); swirl(w - 90, 90, 46); swirl(90, h - 90, 46); swirl(w - 90, h - 90, 46);
    }, 640, 880);

    function makePageTexture(tint) {
      return makeCanvas((ctx, w, h) => {
        ctx.fillStyle = tint; ctx.fillRect(0, 0, w, h);
        speckle(ctx, w, h, 4000, () => {
          const s = (Math.random() - 0.5) * 16;
          return `rgba(${222 + s},${198 + s},${152 + s},0.4)`;
        });
        for (let i = 0; i < 5; i++) {
          const cx = Math.random() * w, cy = Math.random() * h, r = 44 + Math.random() * 90;
          const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
          g.addColorStop(0, "rgba(120,90,50,0.22)");
          g.addColorStop(1, "rgba(120,90,50,0)");
          ctx.fillStyle = g;
          ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
        }
        scribbleBlock(ctx, w, h, "rgba(54,38,22,0.75)", 60);
      }, 640, 880);
    }
    const pageTextureA = makePageTexture("#ddc79a");
    const pageTextureB = makePageTexture("#d5bd8e");

    function makeGlowScriptTexture() {
      return makeCanvas((ctx, w, h) => {
        ctx.fillStyle = "#000000"; ctx.fillRect(0, 0, w, h);
        scribbleBlock(ctx, w, h, "rgba(255,214,140,0.95)", 60);
      }, 640, 880);
    }
    const glowScriptTexture = makeGlowScriptTexture();

    const pageEdgeTexture = makeCanvas((ctx, w, h) => {
      ctx.fillStyle = "#cbb27e"; ctx.fillRect(0, 0, w, h);
      for (let y = 0; y < h; y += 2) {
        ctx.strokeStyle = `rgba(${90 + Math.random() * 45},${70 + Math.random() * 35},${30 + Math.random() * 20},0.55)`;
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
      }
    }, 48, 640);

    const mossTexture = makeCanvas((ctx, w, h) => {
      ctx.fillStyle = "#16260d"; ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 260; i++) {
        const x = Math.random() * w, y = Math.random() * h;
        const r = 8 + Math.random() * 24;
        const shade = Math.random() * 30;
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, `rgba(${40 + shade * 0.4},${80 + shade},${28 + shade * 0.3},0.38)`);
        g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      }
      speckle(ctx, w, h, 5000, () => {
        const s = Math.random() * 22;
        return `rgba(${45 + s * 0.4},${85 + s},${30 + s * 0.3},${0.06 + Math.random() * 0.12})`;
      });
    }, 512, 512);
    mossTexture.wrapS = mossTexture.wrapT = THREE.RepeatWrapping;
    mossTexture.repeat.set(6, 6);

    function makeGlowSpriteTexture() {
      return makeCanvas((ctx, w, h) => {
        const g = ctx.createRadialGradient(w/2, h/2, 0, w/2, h/2, w/2);
        g.addColorStop(0, "rgba(255,255,255,1)");
        g.addColorStop(0.35, "rgba(255,225,170,0.85)");
        g.addColorStop(1, "rgba(255,190,110,0)");
        ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      }, 128, 128);
    }
    const glowSpriteTexture = makeGlowSpriteTexture();

    const goldMaterial = new THREE.MeshStandardMaterial({ color: 0xcf9f52, metalness: 0.85, roughness: 0.32 });

    /* ---------------------------------------------------------------
       LIGHTS
       --------------------------------------------------------------- */
    scene.add(new THREE.AmbientLight(0x1c2a12, 0.5));

    const sun = new THREE.DirectionalLight(0xffd9a0, 1.5);
    sun.position.set(2.4, 4.6, 1.6);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 10;
    sun.shadow.camera.left = -2; sun.shadow.camera.right = 2;
    sun.shadow.camera.top = 2; sun.shadow.camera.bottom = -2;
    sun.shadow.bias = -0.0015;
    scene.add(sun);

    const rim = new THREE.PointLight(0xffb060, 0.55, 6);
    rim.position.set(-1.4, 1.1, -0.8);
    scene.add(rim);

    const spineLight = new THREE.PointLight(0xffcf80, 0, 5, 1.5);
    spineLight.position.set(0, 0.32, 0);
    scene.add(spineLight);

    /* ---------------------------------------------------------------
       GROUND + LEAVES
       --------------------------------------------------------------- */
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(20, 20),
      new THREE.MeshStandardMaterial({ map: mossTexture, roughness: 1 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    const leafShape = new THREE.Shape();
    leafShape.moveTo(0, -0.042);
    leafShape.quadraticCurveTo(0.03, -0.018, 0.032, 0.016);
    leafShape.quadraticCurveTo(0.024, 0.044, 0, 0.056);
    leafShape.quadraticCurveTo(-0.024, 0.044, -0.032, 0.016);
    leafShape.quadraticCurveTo(-0.03, -0.018, 0, -0.042);
    const leafGeo = new THREE.ShapeGeometry(leafShape);
    for (let i = 0; i < 20; i++) {
      const hue = 0.03 + Math.random() * 0.07;
      const mat = new THREE.MeshStandardMaterial({
        color: new THREE.Color().setHSL(hue, 0.62, 0.26 + Math.random() * 0.14),
        roughness: 0.92, side: THREE.DoubleSide
      });
      const leaf = new THREE.Mesh(leafGeo, mat);
      const ang = Math.random() * Math.PI * 2;
      const r = 0.5 + Math.random() * 1.1;
      leaf.position.set(Math.cos(ang) * r, 0.004 + Math.random() * 0.005, Math.sin(ang) * r);
      leaf.rotation.x = -Math.PI / 2;
      leaf.rotation.z = Math.random() * Math.PI * 2;
      leaf.scale.setScalar(0.55 + Math.random() * 0.55);
      leaf.receiveShadow = true;
      scene.add(leaf);
    }

    /* ---------------------------------------------------------------
       PARTICLES — drifting gold dust / embers
       --------------------------------------------------------------- */
    const PARTICLE_COUNT = 130;
    const particlePositions = new Float32Array(PARTICLE_COUNT * 3);
    const particleSpeeds = new Float32Array(PARTICLE_COUNT);
    function randomParticleSpot() {
      const ang = Math.random() * Math.PI * 2;
      const r = Math.random() * Math.random() * 1.3; // weighted toward center
      return { x: Math.cos(ang) * r, z: Math.sin(ang) * r };
    }
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const spot = randomParticleSpot();
      particlePositions[i * 3] = spot.x;
      particlePositions[i * 3 + 1] = Math.random() * 1.05;
      particlePositions[i * 3 + 2] = spot.z;
      particleSpeeds[i] = 0.04 + Math.random() * 0.06;
    }
    const particleGeo = new THREE.BufferGeometry();
    particleGeo.setAttribute("position", new THREE.BufferAttribute(particlePositions, 3));
    const particleMat = new THREE.PointsMaterial({
      size: 0.024, map: glowSpriteTexture, transparent: true, opacity: 0.8,
      blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
      color: 0xffd9a0
    });
    const particles = new THREE.Points(particleGeo, particleMat);
    scene.add(particles);

    function updateParticles(delta) {
      const pos = particleGeo.attributes.position;
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        let y = pos.getY(i) + particleSpeeds[i] * delta;
        let x = pos.getX(i) + Math.sin(clock.elapsedTime * 0.5 + i) * 0.0005;
        if (y > 1.1) {
          y = 0;
          const spot = randomParticleSpot();
          x = spot.x;
          pos.setZ(i, spot.z);
        }
        pos.setX(i, x);
        pos.setY(i, y);
      }
      pos.needsUpdate = true;
    }

    /* ---------------------------------------------------------------
       THE BOOK
       --------------------------------------------------------------- */
    const bookGroup = new THREE.Group();
    scene.add(bookGroup);

    let stackY = 0.008;

    // back cover (static base)
    const backCoverGeo = new THREE.BoxGeometry(BOOK_W, COVER_THICK, BOOK_H);
    backCoverGeo.translate(BOOK_W / 2, 0, 0);
    const backCover = new THREE.Mesh(backCoverGeo, new THREE.MeshStandardMaterial({ map: leatherTexture, roughness: 0.65, metalness: 0.05 }));
    backCover.position.set(SPINE_X, stackY + COVER_THICK / 2, 0);
    backCover.castShadow = true; backCover.receiveShadow = true;
    bookGroup.add(backCover);
    stackY += COVER_THICK;

    // visible page-block edge (right side, facing +X, away from spine)
    const edgeGeo = new THREE.BoxGeometry(0.02, PAGE_COUNT * PAGE_GAP, BOOK_H * 0.97);
    const pageBlock = new THREE.Mesh(edgeGeo, new THREE.MeshStandardMaterial({ map: pageEdgeTexture, roughness: 0.85 }));
    pageBlock.position.set(SPINE_X + BOOK_W + 0.005, stackY + (PAGE_COUNT * PAGE_GAP) / 2, 0);
    pageBlock.castShadow = true; pageBlock.receiveShadow = true;
    bookGroup.add(pageBlock);

    // paper pages
    const pages = [];
    for (let i = 0; i < PAGE_COUNT; i++) {
      const pivot = new THREE.Group();
      pivot.position.set(SPINE_X, stackY + PAGE_GAP / 2, 0);

      const geo = new THREE.PlaneGeometry(BOOK_W, BOOK_H * 0.985, 16, 1);
      geo.rotateX(-Math.PI / 2);
      geo.translate(BOOK_W / 2, 0, 0);
      const baseline = geo.attributes.position.array.slice();

      const mat = new THREE.MeshStandardMaterial({
        map: i % 2 === 0 ? pageTextureA : pageTextureB,
        roughness: 0.95, side: THREE.DoubleSide,
        emissive: 0xffcf80, emissiveMap: glowScriptTexture, emissiveIntensity: 0
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = true; mesh.receiveShadow = true;
      pivot.add(mesh);
      bookGroup.add(pivot);

      pages.push({ pivot: pivot, mesh: mesh, geo: geo, baseline: baseline, mat: mat, done: false });
      stackY += PAGE_GAP;
    }

    // front cover, with ornaments + clasp
    const coverPivot = new THREE.Group();
    coverPivot.position.set(SPINE_X, stackY + COVER_THICK / 2, 0);
    const coverGeo = new THREE.BoxGeometry(BOOK_W, COVER_THICK, BOOK_H);
    coverGeo.translate(BOOK_W / 2, 0, 0);
    const coverMesh = new THREE.Mesh(coverGeo, new THREE.MeshStandardMaterial({ map: leatherTexture, roughness: 0.6, metalness: 0.05 }));
    coverMesh.castShadow = true; coverMesh.receiveShadow = true;
    coverPivot.add(coverMesh);

    // corner ornaments (flat gold triangles, one texture reused + rotated per corner)
    const cornerTex = makeCanvas((ctx, w, h) => {
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = "#cf9f52";
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(w, 0); ctx.lineTo(0, h); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = "rgba(60,40,10,0.8)"; ctx.lineWidth = 3; ctx.stroke();
      ctx.strokeStyle = "rgba(255,235,190,0.7)"; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(w * 0.32, h * 0.32, w * 0.22, 0, Math.PI * 1.6); ctx.stroke();
    }, 128, 128);
    const cornerMat = new THREE.MeshStandardMaterial({ map: cornerTex, transparent: true, metalness: 0.8, roughness: 0.35 });
    const cornerSize = 0.1;
    const cornerGeo = new THREE.PlaneGeometry(cornerSize, cornerSize);
    cornerGeo.rotateX(-Math.PI / 2);
    const cornerMargin = 0.05;
    const cornerSpecs = [
      { x: cornerMargin, z: -BOOK_H / 2 + cornerMargin, rot: 0 },
      { x: BOOK_W - cornerMargin, z: -BOOK_H / 2 + cornerMargin, rot: Math.PI / 2 },
      { x: BOOK_W - cornerMargin, z: BOOK_H / 2 - cornerMargin, rot: Math.PI },
      { x: cornerMargin, z: BOOK_H / 2 - cornerMargin, rot: -Math.PI / 2 },
    ];
    cornerSpecs.forEach((c) => {
      const corner = new THREE.Mesh(cornerGeo, cornerMat);
      corner.position.set(c.x, COVER_THICK / 2 + 0.001, c.z);
      corner.rotation.y = c.rot;
      corner.castShadow = true;
      coverPivot.add(corner);
    });

    // center emblem (embossed ring)
    const emblemGeo = new THREE.RingGeometry(0.055, 0.07, 24);
    emblemGeo.rotateX(-Math.PI / 2);
    const emblem = new THREE.Mesh(emblemGeo, goldMaterial);
    emblem.position.set(BOOK_W / 2, COVER_THICK / 2 + 0.001, 0);
    coverPivot.add(emblem);
    const emblemInner = new THREE.Mesh(new THREE.RingGeometry(0.028, 0.04, 20).rotateX(-Math.PI / 2), goldMaterial);
    emblemInner.position.set(BOOK_W / 2, COVER_THICK / 2 + 0.001, 0);
    coverPivot.add(emblemInner);

    // clasp + strap on the free edge (opposite the spine)
    const strap = new THREE.Mesh(
      new THREE.BoxGeometry(0.16, 0.01, 0.09),
      new THREE.MeshStandardMaterial({ color: 0x3a2410, roughness: 0.8 })
    );
    strap.position.set(BOOK_W - 0.08, COVER_THICK / 2 + 0.006, 0);
    coverPivot.add(strap);

    const claspPivot = new THREE.Group();
    claspPivot.position.set(BOOK_W - 0.005, COVER_THICK / 2 + 0.006, 0);
    const clasp = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.018, 0.09), goldMaterial);
    clasp.position.x = 0.022;
    clasp.castShadow = true;
    claspPivot.add(clasp);
    coverPivot.add(claspPivot);

    bookGroup.add(coverPivot);

    // soft contact shadow blob under the book (in addition to real shadow map, for extra grounding)
    const contactShadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.62, 24),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35 })
    );
    contactShadow.rotation.x = -Math.PI / 2;
    contactShadow.position.y = 0.002;
    scene.add(contactShadow);

    // climax glow sprite (billboard) at the spine
    const glowSprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowSpriteTexture, blending: THREE.AdditiveBlending, transparent: true,
      depthWrite: false, color: 0xffd9a0, opacity: 0
    }));
    glowSprite.position.set(0, 0.2, 0);
    glowSprite.scale.set(0.15, 0.15, 1);
    scene.add(glowSprite);

    /* ---------------------------------------------------------------
       ANIMATION STATE MACHINE
       --------------------------------------------------------------- */
    let phase = "idle"; // idle -> opening -> flipping -> climax -> done
    const climaxCameraTarget = new THREE.Vector3(0.55, 0.55, 0.9);
    let openStart = 0;
    let flipPhaseStart = 0;
    let climaxStart = 0;
    let whiteCutFired = false;
    let running = true;

    function easeInOutCubic(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }

    function applyBend(page, t) {
      const bendPeak = Math.sin(Math.min(1, Math.max(0, t)) * Math.PI) * 0.09;
      const pos = page.geo.attributes.position;
      const base = page.baseline;
      for (let i = 0; i < pos.count; i++) {
        const lx = base[i * 3];               // local X: 0 at spine .. BOOK_W at free edge
        const xt = lx / BOOK_W;
        const lift = Math.sin(xt * Math.PI * 0.5) * bendPeak;
        pos.setY(i, base[i * 3 + 1] + lift);
      }
      pos.needsUpdate = true;
    }

    function onBegin() {
      if (phase !== "idle") return;
      phase = "opening";
      openStart = clock.elapsedTime;
      if (promptEl) promptEl.classList.add("hidden");
    }
    canvas.addEventListener("click", onBegin);
    canvas.addEventListener("touchstart", (e) => { e.preventDefault(); onBegin(); }, { passive: false });

    window.skipBookIntro = function () {
      running = false;
      if (rafId) cancelAnimationFrame(rafId);
    };

    /* ---------------------------------------------------------------
       RENDER LOOP
       --------------------------------------------------------------- */
    let rafId = null;
    function animate() {
      if (!running) return;
      rafId = requestAnimationFrame(animate);
      const delta = Math.min(0.05, clock.getDelta());
      const elapsed = clock.elapsedTime;

      updateParticles(delta);
      bookGroup.position.y = Math.sin(elapsed * 0.55) * 0.005;

      if (phase !== "climax" && phase !== "done") {
        camera.position.set(
          baseCameraPos.x + Math.sin(elapsed * 0.15) * 0.045,
          baseCameraPos.y + Math.sin(elapsed * 0.11) * 0.02,
          baseCameraPos.z
        );
        camera.lookAt(0, 0.14, 0);
      }

      if (phase === "opening") {
        const t = Math.min(1, (elapsed - openStart) / OPEN_DURATION);
        coverPivot.rotation.y = -easeInOutCubic(t) * Math.PI * 0.95;
        if (t >= 1) {
          phase = "flipping";
          flipPhaseStart = elapsed;
        }
      } else if (phase === "flipping") {
        const tSince = elapsed - flipPhaseStart;
        let allDone = true;
        for (let i = 0; i < pages.length; i++) {
          const page = pages[i];
          if (page.done) continue;
          const localT = (tSince - i * FLIP_STAGGER) / FLIP_DURATION;
          if (localT < 0) { allDone = false; continue; }
          const clamped = Math.min(1, localT);
          if (clamped < 1) allDone = false;
          const eased = easeInOutCubic(clamped);
          page.pivot.rotation.y = -eased * Math.PI * 0.97;
          applyBend(page, clamped);
          page.mat.emissiveIntensity = Math.sin(clamped * Math.PI) * 1.8;
          if (clamped >= 1) { page.done = true; page.mat.emissiveIntensity = 0; }
        }
        if (allDone) {
          phase = "climax";
          climaxStart = elapsed;
        }
      } else if (phase === "climax") {
        const tc = Math.min(1, (elapsed - climaxStart) / CLIMAX_DURATION);
        const build = tc * tc * tc; // slow, accelerating build — a crescendo, not a sudden flash
        spineLight.intensity = build * 4.5;
        glowSprite.material.opacity = Math.min(1, build * 1.2);
        glowSprite.scale.setScalar(0.15 + build * 16);
        camera.position.lerp(climaxCameraTarget, delta * 0.5);
        camera.lookAt(0, 0.2, 0);

        if (tc >= 0.62 && !whiteCutFired) {
          whiteCutFired = true;
          if (window.finishBookIntro) window.finishBookIntro();
        }
        if (tc >= 1) {
          phase = "done";
          running = false;
        }
      }

      renderer.render(scene, camera);
    }

    function onResize() {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    }
    window.addEventListener("resize", onResize);

    if (loadingEl) loadingEl.classList.add("hidden");
    animate();
  }
})();
