/* Aktepe — sayfa etkileşimleri */
(function () {
  "use strict";

  // ==== AYARLAR: numarayı buradan güncelleyin (ülke koduyla, boşluksuz) ====
  var WHATSAPP = "905362300806";

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var STONES = window.Stones.list;
  var fine = window.matchMedia("(pointer: fine)").matches;

  function waLink(text) { return "https://wa.me/" + WHATSAPP + "?text=" + encodeURIComponent(text); }
  function toast(msg) {
    var t = $("#toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toast.h);
    toast.h = setTimeout(function () { t.classList.remove("show"); }, 2600);
  }

  // WhatsApp bağlantıları
  $$("[data-wa]").forEach(function (a) {
    a.href = waLink(a.getAttribute("data-wa") || "Merhaba, tezgah için fiyat teklifi almak istiyorum.");
    a.target = "_blank";
    a.rel = "noopener";
  });
  $$("[data-year]").forEach(function (el) { el.textContent = new Date().getFullYear(); });

  // ---------- Ön yükleme: taş dokularını sırayla hazırla ----------
  var thumbs = {};
  function preload(done) {
    var i = 0, bar = $("#loader-bar"), pct = $("#loader-pct");
    (function next() {
      if (i >= STONES.length) return done();
      var id = STONES[i].id;
      if (i === 0) window.Stones.draw(id, 1024);
      thumbs[id] = window.Stones.draw(id, 384).toDataURL("image/jpeg", 0.85);
      i++;
      var p = Math.round(i / STONES.length * 100);
      bar.style.width = p + "%";
      pct.textContent = p + "%";
      setTimeout(next, 16);
    })();
  }

  // ---------- 3D sahneler ----------
  var hero = null, studio = null;
  function webglOK() {
    try {
      var c = document.createElement("canvas");
      return !!(window.THREE && (c.getContext("webgl2") || c.getContext("webgl")));
    } catch (e) { return false; }
  }

  function watch(el, scene) {
    if (!scene) return;
    new IntersectionObserver(function (es) {
      es.forEach(function (e) { e.isIntersecting ? scene.start() : scene.stop(); });
    }, { rootMargin: "100px" }).observe(el);
  }

  // ---------- Hero taş seçici ----------
  var heroIdx = 0, heroAuto = true;
  function setHeroStone(i, fromUser) {
    heroIdx = (i + STONES.length) % STONES.length;
    var st = STONES[heroIdx];
    if (hero) hero.setStone(st.id);
    $("#hero-name").textContent = st.name;
    $("#hero-type").textContent = st.type;
    $("#hero-idx").textContent = ("0" + (heroIdx + 1)).slice(-2);
    $$("#hero-swatches .sw").forEach(function (b, j) { b.classList.toggle("on", j === heroIdx); });
    if (fromUser) heroAuto = false;
  }

  // ---------- Stüdyo durumu ----------
  var design = { stone: "calacatta", thick: 3, cab: "Antrasit", island: true, theme: "night" };
  function updateSummary() {
    var st = window.Stones.get(design.stone);
    $("#p-stone").textContent = st.name;
    $("#hud-stone").textContent = st.name;
    $("#p-thick").textContent = design.thick + " cm";
    $("#p-cab").textContent = design.cab;
    $("#p-island").textContent = design.island ? "Şelale kenarlı" : "Yok";
    $("#hud-dims").innerHTML = (design.island ? "Ada 260 × 105 cm<br>" : "") + "Tezgah 390 × 64 cm";
    $("#summary").innerHTML =
      "<div><span>Taş</span><b>" + st.name + " (" + st.type + ")</b></div>" +
      "<div><span>Kalınlık</span><b>" + design.thick + " cm</b></div>" +
      "<div><span>Dolap</span><b>" + design.cab + "</b></div>" +
      "<div><span>Ada</span><b>" + (design.island ? "Şelale kenarlı" : "Yok") + "</b></div>";
    $("#send-design").href = waLink(
      "Merhaba, web sitenizdeki 3D stüdyoda bir tasarım hazırladım:\n" +
      "• Taş: " + st.name + " (" + st.type + ")\n" +
      "• Kalınlık: " + design.thick + " cm\n" +
      "• Dolap rengi: " + design.cab + "\n" +
      "• Ada: " + (design.island ? "Şelale kenarlı ada" : "Ada yok") + "\n" +
      "Bu tasarım için fiyat teklifi ve keşif randevusu almak istiyorum."
    );
    $("#send-design").target = "_blank";
    $("#send-design").rel = "noopener";
  }
  function setStudioStone(id) {
    design.stone = id;
    if (studio) studio.setStone(id);
    $$("#stone-grid button").forEach(function (b) { b.classList.toggle("on", b.dataset.id === id); });
    updateSummary();
  }
  function seg(el, fn) {
    $$("button", el).forEach(function (b) {
      b.addEventListener("click", function () {
        $$("button", el).forEach(function (x) { x.classList.toggle("on", x === b); });
        fn(b.dataset.v, b);
      });
    });
  }

  function buildUI() {
    // hero örnekleri
    var hs = $("#hero-swatches");
    STONES.forEach(function (st, i) {
      var b = document.createElement("button");
      b.className = "sw";
      b.style.backgroundImage = "url(" + thumbs[st.id] + ")";
      b.setAttribute("aria-label", st.name);
      b.innerHTML = '<span class="tip">' + st.name + "</span>";
      b.addEventListener("click", function () { setHeroStone(i, true); });
      hs.appendChild(b);
    });

    // malzeme kartları
    var cards = $("#cards");
    var labels = ["Leke", "Isı", "Çizik", "Bakım"];
    STONES.forEach(function (st, i) {
      var c = document.createElement("button");
      c.type = "button";
      c.className = "card reveal" + (i % 4 ? " d" + (i % 4) : "");
      var bars = st.props.map(function (v, k) {
        return "<span>" + labels[k] + '</span><span class="bar"><i style="width:' + v * 20 + '%"></i></span>';
      }).join("");
      c.innerHTML =
        '<span class="tex" style="background-image:url(' + thumbs[st.id] + ')"></span>' +
        '<span class="glare"></span><span class="shade"></span>' +
        '<span class="num">' + ("0" + (i + 1)).slice(-2) + "</span>" +
        '<span class="go"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg></span>' +
        '<span class="info"><span class="type">' + st.type + "</span><h3>" + st.name + '</h3><span class="bars">' + bars + "</span></span>";
      c.setAttribute("aria-label", st.name + " — 3D stüdyoda dene");
      c.addEventListener("click", function () {
        setStudioStone(st.id);
        $("#studyo").scrollIntoView({ behavior: "smooth" });
        toast(st.name + " stüdyoya yerleştirildi");
      });
      if (fine) tilt(c);
      cards.appendChild(c);
    });

    // stüdyo taş ızgarası
    var grid = $("#stone-grid");
    STONES.forEach(function (st) {
      var b = document.createElement("button");
      b.dataset.id = st.id;
      b.title = st.name;
      b.setAttribute("aria-label", st.name);
      b.style.backgroundImage = "url(" + thumbs[st.id] + ")";
      b.addEventListener("click", function () { setStudioStone(st.id); });
      grid.appendChild(b);
    });

    seg($("#seg-thick"), function (v) { design.thick = +v; if (studio) studio.setThickness(+v); updateSummary(); });
    seg($("#seg-island"), function (v) { design.island = v === "1"; if (studio) studio.setIsland(design.island); updateSummary(); });
    seg($("#seg-theme"), function (v) { design.theme = v; if (studio) studio.setTheme(v); });
    $$("#cab-colors button").forEach(function (b) {
      b.addEventListener("click", function () {
        $$("#cab-colors button").forEach(function (x) { x.classList.toggle("on", x === b); });
        design.cab = b.dataset.n;
        if (studio) studio.setCabinet(b.dataset.c);
        updateSummary();
      });
    });
    $$("#views button").forEach(function (b) {
      b.addEventListener("click", function () {
        $$("#views button").forEach(function (x) { x.classList.toggle("on", x === b); });
        if (studio) studio.setView(b.dataset.view);
        hideHint();
      });
    });
    $("#save-design").addEventListener("click", function () {
      if (!studio) return;
      var a = document.createElement("a");
      a.href = studio.snapshot();
      a.download = "aktepe-tasarim-" + design.stone + ".png";
      document.body.appendChild(a);
      a.click();
      a.remove();
      toast("Tasarım görseli indirildi");
    });
    setStudioStone(design.stone);
  }

  function hideHint() { $("#drag-hint").classList.add("gone"); }

  // ---------- 3D kart eğimi ----------
  function tilt(card) {
    card.addEventListener("pointermove", function (e) {
      var r = card.getBoundingClientRect();
      var x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      card.classList.add("tilting");
      card.style.setProperty("--ry", ((x - 0.5) * 18).toFixed(2) + "deg");
      card.style.setProperty("--rx", ((0.5 - y) * 14).toFixed(2) + "deg");
      card.style.setProperty("--gx", (x * 100).toFixed(1) + "%");
      card.style.setProperty("--gy", (y * 100).toFixed(1) + "%");
    });
    card.addEventListener("pointerleave", function () {
      card.classList.remove("tilting");
      card.style.setProperty("--rx", "0deg");
      card.style.setProperty("--ry", "0deg");
    });
  }

  // ---------- İmleç ----------
  function cursor() {
    if (!fine) return;
    var c = $("#cursor"), d = $("#cursor-dot");
    var x = innerWidth / 2, y = innerHeight / 2, cx = x, cy = y;
    addEventListener("pointermove", function (e) { x = e.clientX; y = e.clientY; d.style.transform = "translate(" + x + "px," + y + "px)"; }, { passive: true });
    (function loop() {
      cx += (x - cx) * 0.18; cy += (y - cy) * 0.18;
      c.style.transform = "translate(" + cx + "px," + cy + "px)";
      requestAnimationFrame(loop);
    })();
    document.addEventListener("pointerover", function (e) {
      var t = e.target;
      var hov = t.closest && t.closest("a, button");
      var vp = t.closest && t.closest("#studio-canvas");
      c.classList.toggle("hover", !!hov && !t.closest(".card"));
      c.classList.toggle("drag", !!vp);
    });
  }

  // ---------- Kaydırma efektleri ----------
  function scrollFx() {
    var header = $("#header"), lastY = 0;
    var words = [];
    var m = $("#manifesto");
    var gold = ["milyonlarca", "milimetrik", "kalbine"];
    m.innerHTML = m.textContent.split(" ").map(function (w) {
      var g = gold.some(function (k) { return w.toLocaleLowerCase("tr").indexOf(k) === 0; });
      return '<span class="w' + (g ? " g" : "") + '">' + w + "</span>";
    }).join(" ");
    words = $$(".w", m);
    var steps = $$("#steps .step"), line = $("#steps-line"), stepsBox = $("#steps");
    var heroEl = $("#hero");

    function onScroll() {
      var y = scrollY, vh = innerHeight;
      header.classList.toggle("solid", y > 40);
      header.classList.toggle("hide", y > lastY && y > vh * 0.9 && !document.body.classList.contains("menu-open"));
      lastY = y;
      if (hero) hero.setScroll(Math.min(1, y / heroEl.offsetHeight));
      // manifesto
      var r = m.getBoundingClientRect();
      var k = Math.min(1, Math.max(0, (vh * 0.85 - r.top) / (r.height + vh * 0.35)));
      var n = Math.floor(k * words.length);
      words.forEach(function (w, i) { w.classList.toggle("lit", i < n); });
      // süreç çizgisi
      var sr = stepsBox.getBoundingClientRect();
      var sk = Math.min(1, Math.max(0, (vh * 0.75 - sr.top) / (sr.height * 0.9)));
      line.style.width = sk * 100 + "%";
      steps.forEach(function (s, i) { s.classList.toggle("lit", sk >= i / steps.length + 0.02 || (sk > 0 && i === 0)); });
    }
    addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } });
    }, { threshold: 0.12 });
    $$(".reveal").forEach(function (el) { io.observe(el); });
  }

  // ---------- Mobil menü ----------
  $("#burger").addEventListener("click", function () { document.body.classList.toggle("menu-open"); });
  $$("#mobile-menu a").forEach(function (a) { a.addEventListener("click", function () { document.body.classList.remove("menu-open"); }); });

  // ---------- Başlat ----------
  preload(function () {
    buildUI();
    if (webglOK()) {
      try {
        hero = window.Kitchen.create($("#hero-canvas"), { mode: "hero" });
        studio = window.Kitchen.create($("#studio-canvas"), { mode: "full" });
        hero.setStone(STONES[0].id, true);
        studio.setStone(design.stone, true);
        watch($("#hero"), hero);
        watch($("#viewport"), studio);
        $("#studio-canvas").addEventListener("pointerdown", hideHint);
        $("#studio-canvas").addEventListener("wheel", hideHint, { passive: true });
        new ResizeObserver(function () { studio.resize(); }).observe($("#viewport"));
      } catch (e) {
        console.warn("3D başlatılamadı", e);
        hero = studio = null;
      }
    }
    if (!studio) {
      // WebGL yoksa: statik doku yedeği
      $("#hero-canvas").style.background = "url(" + thumbs.calacatta + ") center/cover";
      $("#hero-canvas").style.opacity = ".35";
      $("#studio-canvas").style.background = "url(" + thumbs.calacatta + ") center/cover";
      $("#drag-hint").classList.add("gone");
    }
    setHeroStone(0);
    scrollFx();
    cursor();
    setTimeout(function () {
      $("#loader").classList.add("done");
      document.body.classList.remove("loading");
      document.body.classList.add("ready");
    }, 250);
    // kalan büyük dokuları boşta hazırla
    var warm = STONES.slice(1).map(function (s) { return s.id; });
    (function idle() {
      if (!warm.length) return;
      setTimeout(function () { window.Stones.draw(warm.shift(), 1024); idle(); }, 180);
    })();
    // hero taşlarını kullanıcı dokunana kadar otomatik değiştir
    setInterval(function () { if (heroAuto && !document.hidden && scrollY < innerHeight) setHeroStone(heroIdx + 1); }, 5200);
  });
})();
