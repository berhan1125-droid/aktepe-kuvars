/* Aktepe — 3D mutfak sahnesi (three.js)
   mode: "hero"  → sadece şelale kenarlı ada, dramatik ışık
         "full"  → tezgah hattı, ada, dolaplar; döndürülebilir tasarlayıcı */
(function () {
  "use strict";
  var T = window.THREE;
  var TILE = 1.7; // bir doku tekrarı kaç metre

  // Kutu geometrisinin UV'lerini gerçek ölçüye göre ayarlar → doku esnemez
  function boxGeo(w, h, d, seed) {
    var g = new T.BoxGeometry(w, h, d);
    var uv = g.attributes.uv;
    var dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
    var ox = ((seed || 0) * 0.37) % 1, oy = ((seed || 0) * 0.61) % 1;
    for (var f = 0; f < 6; f++) {
      for (var i = 0; i < 4; i++) {
        var k = f * 4 + i;
        uv.setXY(k, uv.getX(k) * dims[f][0] / TILE + ox, uv.getY(k) * dims[f][1] / TILE + oy);
      }
    }
    return g;
  }

  function stoneTexture(id, renderer) {
    var tex = new T.CanvasTexture(window.Stones.draw(id, 1024));
    tex.colorSpace = T.SRGBColorSpace;
    tex.wrapS = tex.wrapT = T.RepeatWrapping;
    tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    return tex;
  }

  // Taş malzemesi: iki doku arasında ışıklı bir "tarama" geçişi yapar
  function stoneMaterial() {
    var uniforms = { uPrev: { value: null }, uProg: { value: 1 } };
    var mat = new T.MeshPhysicalMaterial({ roughness: 0.16, clearcoat: 0.7, clearcoatRoughness: 0.08, metalness: 0 });
    mat.onBeforeCompile = function (sh) {
      sh.uniforms.uPrev = uniforms.uPrev;
      sh.uniforms.uProg = uniforms.uProg;
      sh.vertexShader = sh.vertexShader
        .replace("#include <common>", "#include <common>\nvarying vec3 vWPos;")
        .replace("#include <project_vertex>", "#include <project_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;");
      sh.fragmentShader = sh.fragmentShader
        .replace("#include <common>", "#include <common>\nuniform sampler2D uPrev;\nuniform float uProg;\nvarying vec3 vWPos;")
        .replace("#include <map_fragment>", [
          "float wEdge = mix(-4.5, 4.5, uProg) + sin(vWPos.z * 5.0 + vWPos.y * 3.0) * 0.12;",
          "float wGlow = (1.0 - smoothstep(0.0, 0.09, abs(vWPos.x - wEdge))) * step(0.001, uProg) * step(uProg, 0.999);",
          "#ifdef USE_MAP",
          "  vec4 texNew = texture2D(map, vMapUv);",
          "  vec4 texOld = texture2D(uPrev, vMapUv);",
          "  float wm = smoothstep(wEdge - 0.015, wEdge + 0.015, vWPos.x);",
          "  diffuseColor *= mix(texNew, texOld, wm * step(uProg, 0.999));",
          "#endif"
        ].join("\n"))
        .replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\ntotalEmissiveRadiance += vec3(1.0, 0.78, 0.45) * wGlow * 6.0;");
    };
    mat.userData.uniforms = uniforms;
    return mat;
  }

  function ease(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }

  var THEMES = {
    night: { wall: 0x2b2926, floor: 0x1b1a19, bg: 0x111110, hemi: 0.35, sun: 1.6, pend: 6, exposure: 1.0 },
    day: { wall: 0xe4dfd7, floor: 0xb9b3a9, bg: 0xeae6df, hemi: 0.9, sun: 3.2, pend: 1.5, exposure: 1.05 }
  };

  function create(canvas, opts) {
    opts = opts || {};
    var hero = opts.mode === "hero";
    var renderer = new T.WebGLRenderer({ canvas: canvas, antialias: true, alpha: hero, preserveDrawingBuffer: !hero });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = hero ? 1.1 : 1.0;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = T.PCFSoftShadowMap;

    var scene = new T.Scene();
    var pmrem = new T.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new T.RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = hero ? 0.7 : 0.8;

    var camera = new T.PerspectiveCamera(hero ? 32 : 40, 1, 0.05, 60);

    // Işıklar
    var hemi = new T.HemisphereLight(0xfff5e8, 0x3a332c, 0.4);
    scene.add(hemi);
    var sun = new T.DirectionalLight(0xfff1de, 2);
    sun.position.set(3.5, 6, 4);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -4; sun.shadow.camera.right = 4;
    sun.shadow.camera.top = 4; sun.shadow.camera.bottom = -4;
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.02;
    scene.add(sun);
    var rim = new T.DirectionalLight(0xc9d8ff, hero ? 1.6 : 0.4);
    rim.position.set(-5, 3, -4);
    scene.add(rim);

    // Malzemeler
    var stoneMat = stoneMaterial();
    var cabMat = new T.MeshStandardMaterial({ color: hero ? 0x18181a : 0x3c4140, roughness: 0.55, metalness: 0.05 });
    var darkMat = new T.MeshStandardMaterial({ color: 0x141414, roughness: 0.6 });
    var steelMat = new T.MeshStandardMaterial({ color: 0xb9bcbe, roughness: 0.22, metalness: 1 });
    var glassMat = new T.MeshPhysicalMaterial({ color: 0x050505, roughness: 0.05, clearcoat: 1, metalness: 0.2 });
    var brassMat = new T.MeshStandardMaterial({ color: 0xb8925a, roughness: 0.3, metalness: 1 });
    var wallMat = new T.MeshStandardMaterial({ color: 0x2b2926, roughness: 0.95 });
    var floorMat = hero ? new T.ShadowMaterial({ opacity: 0.55 }) : new T.MeshStandardMaterial({ color: 0x1b1a19, roughness: 0.75 });

    function mesh(geo, mat, x, y, z, parent) {
      var m = new T.Mesh(geo, mat);
      m.position.set(x, y, z);
      m.castShadow = true;
      m.receiveShadow = true;
      (parent || scene).add(m);
      return m;
    }

    // Zemin
    var floor = new T.Mesh(new T.PlaneGeometry(30, 30), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    var state = { t: 0.03, island: true };
    var stoneGroup = new T.Group();
    var islandGroup = new T.Group();
    var runGroup = new T.Group();
    scene.add(islandGroup);
    scene.add(stoneGroup);

    var IL = 2.6, ID = 1.05, IH = 0.92, IZ = hero ? 0 : 0.75;
    var RUN_L = 3.9, RUN_D = 0.64, WALL_Z = -1.55;

    // Ada gövdesi (dolaplar) — taş dışı parçalar
    function buildIslandBody(t) {
      while (islandGroup.children.length) islandGroup.remove(islandGroup.children[0]);
      var bodyW = IL - 2 * t - 0.04, bodyD = ID - 0.3, bodyH = IH - t - 0.1;
      mesh(new T.BoxGeometry(bodyW, 0.1, bodyD - 0.06), darkMat, 0, 0.05, IZ - 0.15, islandGroup);
      var n = 4, gap = 0.006, fw = (bodyW - gap * (n - 1)) / n;
      for (var i = 0; i < n; i++) {
        var x = -bodyW / 2 + fw / 2 + i * (fw + gap);
        mesh(new T.BoxGeometry(fw, bodyH, 0.02), cabMat, x, 0.1 + bodyH / 2, IZ - 0.15 - bodyD / 2 + 0.01, islandGroup);
        // ince pirinç kulp
        mesh(new T.BoxGeometry(fw * 0.45, 0.012, 0.018), brassMat, x, 0.1 + bodyH - 0.06, IZ - 0.15 - bodyD / 2 - 0.006, islandGroup);
      }
      mesh(new T.BoxGeometry(bodyW, bodyH, bodyD - 0.02), cabMat, 0, 0.1 + bodyH / 2, IZ - 0.15 + 0.01, islandGroup);
      // ocak
      mesh(new T.BoxGeometry(0.78, 0.006, 0.5), glassMat, 0.35, IH + 0.003, IZ - 0.05, islandGroup);
      for (var c = 0; c < 4; c++) {
        var ring = new T.Mesh(new T.RingGeometry(0.07, 0.075, 48), new T.MeshBasicMaterial({ color: 0x555555 }));
        ring.rotation.x = -Math.PI / 2;
        ring.position.set(0.35 + (c % 2 ? 0.18 : -0.18), IH + 0.0065, IZ - 0.05 + (c < 2 ? 0.12 : -0.12));
        islandGroup.add(ring);
      }
      // bar tabureleri
      if (!hero) {
        for (var s = -1; s <= 1; s++) {
          var sx = s * 0.75;
          mesh(new T.CylinderGeometry(0.19, 0.19, 0.05, 32), cabMat, sx, 0.68, IZ + ID / 2 + 0.38, islandGroup);
          mesh(new T.CylinderGeometry(0.018, 0.018, 0.66, 12), brassMat, sx, 0.33, IZ + ID / 2 + 0.38, islandGroup);
          mesh(new T.CylinderGeometry(0.17, 0.17, 0.012, 32), brassMat, sx, 0.006, IZ + ID / 2 + 0.38, islandGroup);
        }
      }
    }

    // Tezgah hattı: dolaplar, üst dolap, boy dolabı, eviye
    function buildRun(t) {
      while (runGroup.children.length) runGroup.remove(runGroup.children[0]);
      var z0 = WALL_Z + RUN_D / 2, bodyH = IH - t - 0.1;
      mesh(new T.BoxGeometry(RUN_L, 0.1, RUN_D - 0.08), darkMat, 0, 0.05, z0 - 0.03, runGroup);
      mesh(new T.BoxGeometry(RUN_L, bodyH, RUN_D - 0.06), cabMat, 0, 0.1 + bodyH / 2, z0 - 0.03, runGroup);
      var n = 6, gap = 0.006, fw = (RUN_L - gap * (n - 1)) / n;
      for (var i = 0; i < n; i++) {
        var x = -RUN_L / 2 + fw / 2 + i * (fw + gap);
        mesh(new T.BoxGeometry(fw, bodyH, 0.02), cabMat, x, 0.1 + bodyH / 2, z0 + RUN_D / 2 - 0.04, runGroup);
        mesh(new T.BoxGeometry(fw * 0.45, 0.012, 0.018), brassMat, x, 0.1 + bodyH - 0.06, z0 + RUN_D / 2 - 0.022, runGroup);
      }
      // üst dolaplar
      var uy = IH + 0.75 + 0.35;
      mesh(new T.BoxGeometry(RUN_L - 0.9, 0.7, 0.36), cabMat, -0.45, uy, WALL_Z + 0.18, runGroup);
      // raf + led
      var shelf = mesh(new T.BoxGeometry(0.85, 0.04, 0.3), brassMat, RUN_L / 2 - 0.45, IH + 0.85, WALL_Z + 0.15, runGroup);
      shelf.castShadow = false;
      var led = new T.Mesh(new T.BoxGeometry(RUN_L - 0.9, 0.01, 0.02), new T.MeshBasicMaterial({ color: 0xffe2b0 }));
      led.position.set(-0.45, uy - 0.355, WALL_Z + 0.3);
      runGroup.add(led);
      // boy dolabı + fırın
      mesh(new T.BoxGeometry(0.7, 2.3, RUN_D), cabMat, RUN_L / 2 + 0.36, 1.15, z0, runGroup);
      mesh(new T.BoxGeometry(0.58, 0.58, 0.02), glassMat, RUN_L / 2 + 0.36, 1.12, z0 + RUN_D / 2 + 0.005, runGroup);
      mesh(new T.BoxGeometry(0.5, 0.015, 0.03), steelMat, RUN_L / 2 + 0.36, 1.45, z0 + RUN_D / 2 + 0.02, runGroup);
      // eviye + batarya
      mesh(new T.BoxGeometry(0.72, 0.004, 0.42), new T.MeshStandardMaterial({ color: 0x2c2c2c, roughness: 0.35, metalness: 0.6 }), -0.7, IH + 0.002, z0 + 0.04, runGroup);
      mesh(new T.CylinderGeometry(0.018, 0.022, 0.32, 16), steelMat, -0.7, IH + 0.16, z0 - 0.2, runGroup);
      var spout = new T.Mesh(new T.TorusGeometry(0.11, 0.014, 12, 32, Math.PI), steelMat);
      spout.position.set(-0.7, IH + 0.32, z0 - 0.09);
      spout.rotation.y = Math.PI / 2;
      spout.castShadow = true;
      runGroup.add(spout);
      // duvarlar
      var wall = new T.Mesh(new T.PlaneGeometry(14, 3.2), wallMat);
      wall.position.set(0, 1.6, WALL_Z);
      wall.receiveShadow = true;
      runGroup.add(wall);
      var side = new T.Mesh(new T.PlaneGeometry(8, 3.2), wallMat);
      side.position.set(-3.6, 1.6, 2.4);
      side.rotation.y = Math.PI / 2;
      side.receiveShadow = true;
      runGroup.add(side);
    }

    // Taş parçaları (tezgahlar, şelale kenarlar, tezgah arası)
    function buildStone(t) {
      stoneGroup.children.forEach(function (m) { m.geometry.dispose(); });
      while (stoneGroup.children.length) stoneGroup.remove(stoneGroup.children[0]);
      var islandVisible = state.island || hero;
      if (islandVisible) {
        mesh(boxGeo(IL, t, ID, 1), stoneMat, 0, IH - t / 2, IZ, stoneGroup);
        mesh(boxGeo(t, IH - t, ID, 2), stoneMat, -IL / 2 + t / 2, (IH - t) / 2, IZ, stoneGroup);
        mesh(boxGeo(t, IH - t, ID, 3), stoneMat, IL / 2 - t / 2, (IH - t) / 2, IZ, stoneGroup);
      }
      if (!hero) {
        var z0 = WALL_Z + RUN_D / 2;
        mesh(boxGeo(RUN_L, t, RUN_D, 4), stoneMat, 0, IH - t / 2, z0, stoneGroup);
        // tezgah arası (backsplash) — aynı taş, tek parça
        mesh(boxGeo(RUN_L, 0.75, 0.015, 5), stoneMat, 0, IH + 0.375, WALL_Z + 0.008, stoneGroup);
      }
    }

    // Sarkıt aydınlatmalar
    var pendants = [];
    (function () {
      var y = hero ? 1.75 : 1.85;
      for (var i = -1; i <= 1; i++) {
        var g = new T.Group();
        var shade = new T.Mesh(new T.CylinderGeometry(0.05, 0.13, 0.22, 32, 1, true), new T.MeshStandardMaterial({ color: 0x111111, roughness: 0.4, metalness: 0.6, side: T.DoubleSide }));
        var bulb = new T.Mesh(new T.SphereGeometry(0.045, 16, 16), new T.MeshBasicMaterial({ color: 0xffd9a0 }));
        bulb.position.y = -0.08;
        var cord = new T.Mesh(new T.CylinderGeometry(0.004, 0.004, 1.5, 6), darkMat);
        cord.position.y = 0.86;
        var pl = new T.PointLight(0xffc98a, 4, 3.2, 1.6);
        pl.position.y = -0.14;
        g.add(shade, bulb, cord, pl);
        g.position.set(i * 0.8, y, IZ);
        scene.add(g);
        pendants.push(pl);
      }
    })();

    function rebuild() {
      buildStone(state.t);
      buildIslandBody(state.t);
      if (!hero) buildRun(state.t);
      islandGroup.visible = state.island || hero;
    }
    if (!hero) scene.add(runGroup);
    rebuild();

    // Kamera ve kontroller
    var controls = null;
    var VIEWS = {
      genel: { pos: [4.4, 2.7, 5.6], target: [0, 0.75, -0.2] },
      on: { pos: [0, 1.7, 6.2], target: [0, 0.95, -0.4] },
      ust: { pos: [0.01, 7.4, 1.4], target: [0, 0.6, -0.1] },
      ada: { pos: [2.9, 1.75, 3.6], target: [0, 0.8, IZ] },
      detay: { pos: [-2.25, 1.3, IZ + 1.75], target: [-1.25, 0.7, IZ + 0.45] }
    };
    var heroDist = 1;
    if (hero) {
      camera.position.set(4.6, 2.3, 4.8);
      camera.lookAt(0, 0.5, 0);
    } else {
      camera.position.fromArray(VIEWS.genel.pos);
      controls = new T.OrbitControls(camera, canvas);
      controls.target.fromArray(VIEWS.genel.target);
      controls.enableDamping = true;
      controls.dampingFactor = 0.07;
      controls.minDistance = 1.2;
      controls.maxDistance = 9;
      controls.maxPolarAngle = Math.PI / 2 - 0.04;
      controls.enablePan = false;
      controls.update();
    }

    // Animasyonlar
    var tweens = [];
    function tween(dur, fn, done) { tweens.push({ s: performance.now(), d: dur, fn: fn, done: done }); }

    var currentStone = null, textures = {};
    function setStone(id, instant) {
      if (id === currentStone) return;
      var st = window.Stones.get(id);
      if (!textures[id]) textures[id] = stoneTexture(id, renderer);
      var u = stoneMat.userData.uniforms;
      var prev = stoneMat.map;
      stoneMat.map = textures[id];
      var mat = st.id === "beton" ? 0.55 : st.speck ? 0.3 : 0.16;
      stoneMat.roughness = mat;
      stoneMat.clearcoat = st.id === "beton" ? 0 : 0.7;
      stoneMat.needsUpdate = true;
      currentStone = id;
      if (!prev || instant) { u.uPrev.value = textures[id]; u.uProg.value = 1; return; }
      u.uPrev.value = prev;
      u.uProg.value = 0;
      tween(1300, function (k) { u.uProg.value = ease(k); });
    }

    function setThickness(cm) {
      state.t = cm / 100;
      rebuild();
    }

    var cabColor = new T.Color();
    function setCabinet(hex) {
      var from = cabMat.color.clone();
      cabColor.set(hex);
      tween(600, function (k) { cabMat.color.copy(from).lerp(cabColor, ease(k)); });
    }

    function setIsland(on) {
      state.island = on;
      rebuild();
      if (on) {
        islandGroup.scale.set(1, 0.001, 1);
        stoneGroup.children.slice(0, 3).forEach(function (m) { m.scale.y = 0.001; });
        tween(700, function (k) {
          var e = ease(k);
          islandGroup.scale.y = Math.max(0.001, e);
          stoneGroup.children.slice(0, 3).forEach(function (m) { m.scale.y = Math.max(0.001, e); });
        });
      }
      pendants.forEach(function (p) { p.parent.visible = on; });
    }

    function setTheme(name) {
      var th = THEMES[name];
      var fw = wallMat.color.clone(), ff = floorMat.color ? floorMat.color.clone() : null;
      var tw = new T.Color(th.wall), tf = new T.Color(th.floor);
      var bg0 = scene.background ? scene.background.clone() : new T.Color(th.bg), tb = new T.Color(th.bg);
      if (!scene.background) scene.background = new T.Color(th.bg);
      var h0 = hemi.intensity, s0 = sun.intensity, p0 = pendants[0].intensity, e0 = renderer.toneMappingExposure, en0 = scene.environmentIntensity;
      var en1 = name === "day" ? 1.0 : 0.55;
      tween(900, function (k) {
        var e = ease(k);
        wallMat.color.copy(fw).lerp(tw, e);
        if (ff) floorMat.color.copy(ff).lerp(tf, e);
        scene.background.copy(bg0).lerp(tb, e);
        hemi.intensity = h0 + (th.hemi - h0) * e;
        sun.intensity = s0 + (th.sun - s0) * e;
        renderer.toneMappingExposure = e0 + (th.exposure - e0) * e;
        scene.environmentIntensity = en0 + (en1 - en0) * e;
        pendants.forEach(function (p) { p.intensity = p0 + (th.pend - p0) * e; });
      });
    }

    function setView(name) {
      if (!controls) return;
      var v = VIEWS[name];
      var p0 = camera.position.clone(), t0 = controls.target.clone();
      var p1 = new T.Vector3().fromArray(v.pos), t1 = new T.Vector3().fromArray(v.target);
      tween(1100, function (k) {
        var e = ease(k);
        camera.position.lerpVectors(p0, p1, e);
        controls.target.lerpVectors(t0, t1, e);
      });
    }

    function snapshot() {
      render();
      return canvas.toDataURL("image/png");
    }

    // Boyut
    function resize() {
      var w = canvas.clientWidth, h = canvas.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      if (hero) {
        // geniş ekranda adayı sağa kaydır, dar ekranda aşağıda tut
        if (camera.aspect > 1.1) camera.setViewOffset(w, h, -w * 0.2, -h * 0.02, w, h);
        else camera.setViewOffset(w, h, 0, -h * 0.2, w, h);
      }
      camera.updateProjectionMatrix();
    }
    window.addEventListener("resize", resize);
    resize();

    // Hero: fare paralaksı ve kaydırmaya bağlı dönüş
    var pointer = { x: 0, y: 0, sx: 0, sy: 0 };
    var scrollK = 0;
    if (hero) {
      window.addEventListener("pointermove", function (e) {
        pointer.x = e.clientX / window.innerWidth * 2 - 1;
        pointer.y = e.clientY / window.innerHeight * 2 - 1;
      }, { passive: true });
    }
    var spinGroup = [stoneGroup, islandGroup];

    var running = false, last = 0, clockStart = performance.now();
    function render() { renderer.render(scene, camera); }
    function loop(now) {
      if (!running) return;
      requestAnimationFrame(loop);
      for (var i = tweens.length - 1; i >= 0; i--) {
        var tw = tweens[i], k = Math.min(1, (now - tw.s) / tw.d);
        tw.fn(k);
        if (k >= 1) { tweens.splice(i, 1); if (tw.done) tw.done(); }
      }
      if (hero) {
        var tt = (now - clockStart) / 1000;
        pointer.sx += (pointer.x - pointer.sx) * 0.05;
        pointer.sy += (pointer.y - pointer.sy) * 0.05;
        var ry = Math.sin(tt * 0.25) * 0.35 + pointer.sx * 0.35 + scrollK * 1.4 - 0.25;
        spinGroup.forEach(function (g) { g.rotation.y = ry; });
        pendants.forEach(function (p, j) {
          var g = p.parent;
          var a = ry, r = (j - 1) * 0.8;
          g.position.x = Math.cos(a) * r;
          g.position.z = -Math.sin(a) * r;
        });
        heroDist = camera.aspect > 1.1 ? 1.12 : Math.max(1.1, 1.0 / camera.aspect);
        camera.position.set(4.6 * heroDist, 2.3 * heroDist - pointer.sy * 0.35 + scrollK * 1.2, 4.8 * heroDist);
        camera.lookAt(0, 0.5 + scrollK * 0.2, 0);
      }
      if (controls) controls.update();
      render();
    }
    function start() { if (!running) { running = true; requestAnimationFrame(loop); } }
    function stop() { running = false; }

    if (!hero) setTheme("night");
    else { hemi.intensity = 0.25; sun.intensity = 2.4; pendants.forEach(function (p) { p.intensity = 5; }); }

    return {
      setStone: setStone, setThickness: setThickness, setCabinet: setCabinet, setIsland: setIsland,
      setTheme: setTheme, setView: setView, snapshot: snapshot, start: start, stop: stop, resize: resize,
      setScroll: function (k) { scrollK = k; }, renderOnce: render
    };
  }

  window.Kitchen = { create: create };
})();
