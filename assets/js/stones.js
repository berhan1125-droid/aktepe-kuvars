/* Aktepe — taş dokusu üretici
   Her taş, tarayıcıda canvas üzerinde çizilir; görsel dosyası gerekmez. */
(function () {
  "use strict";

  // Tekrarlanabilir rastgele sayı üretici
  function rng(seed) {
    var s = seed >>> 0;
    return function () {
      s = (s + 0x6d2b79f5) >>> 0;
      var t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function gauss(r) { return (r() + r() + r() + r() - 2) * 0.9; }

  var STONES = [
    { id: "calacatta", name: "Calacatta Oro", type: "Kuvars", bg: ["#f7f4ee", "#efe9df"], veins: ["#b08d5f", "#9c8a76", "#c9ab7c"], main: 5, width: [2, 7], soft: 0.5, seed: 21,
      desc: "Sıcak altın damarlı beyaz zemin. Ada tezgahlarda en çok tercih edilen desen.", props: [5, 3, 4, 5] },
    { id: "carrara", name: "Carrara Bianco", type: "Mermer", bg: ["#f2f1ee", "#e6e5e1"], veins: ["#8e8f93", "#a5a6aa", "#7b7c80"], main: 9, width: [0.8, 3], soft: 0.8, seed: 7,
      desc: "İnce gri damarlarıyla klasik İtalyan mermeri. Zamansız, aydınlık ve doğal.", props: [2, 3, 2, 2] },
    { id: "nero", name: "Nero Marquina", type: "Mermer", bg: ["#141416", "#1d1d21"], veins: ["#e9e4da", "#cfc8bb", "#ffffff"], main: 6, width: [0.8, 3.5], soft: 0.5, seed: 4,
      desc: "Derin siyah zemin, keskin beyaz damarlar. Cesur ve lüks bir mutfak için.", props: [2, 3, 2, 2] },
    { id: "statuario", name: "Statuario Kuvars", type: "Kuvars", bg: ["#fbfbfa", "#f0efec"], veins: ["#6e6f73", "#8b8c90", "#55565a"], main: 4, width: [3, 10], soft: 0.65, seed: 33,
      desc: "Kalın, dramatik gri damarlar. Şelale kenarlı adalarda nefes kesici durur.", props: [5, 3, 4, 5] },
    { id: "emperador", name: "Emperador Kahve", type: "Mermer", bg: ["#5a4232", "#4a3426"], veins: ["#d8c3a5", "#b89a78", "#efe2cc"], main: 12, width: [0.5, 2.2], soft: 0.6, seed: 15,
      desc: "Sıcak kahve tonları ve ağ gibi açık damarlar. Ahşap mutfaklarla mükemmel uyum.", props: [2, 3, 2, 2] },
    { id: "beton", name: "Beton Gri", type: "Kuvars", bg: ["#9a9893", "#8c8a85"], speck: [["#7d7b77", 0.5], ["#b5b3ae", 0.35], ["#5f5d5a", 0.12]], seed: 9,
      desc: "Mat beton görünümü, endüstriyel ve minimal mutfakların favorisi.", props: [5, 3, 4, 5] },
    { id: "granit", name: "Absolute Granit", type: "Granit", bg: ["#2a2827", "#232120"], speck: [["#4a4643", 0.6], ["#77716b", 0.25], ["#9a948c", 0.08], ["#121111", 0.4]], seed: 3,
      desc: "Isıya ve çizilmeye en dayanıklı doğal taşlardan. Yoğun mutfaklar için.", props: [4, 5, 5, 4] },
    { id: "kar", name: "Kar Beyazı", type: "Kuvars", bg: ["#f4f2ec", "#eeebe4"], speck: [["#d9d4c9", 0.35], ["#c6bfb1", 0.1], ["#ffffff", 0.3]], seed: 12,
      desc: "Saf, düz beyaz yüzey. Leke tutmaz, her mutfağa uyum sağlar.", props: [5, 3, 4, 5] }
  ];

  function background(ctx, size, st, r) {
    var g = ctx.createLinearGradient(0, 0, size, size);
    g.addColorStop(0, st.bg[0]);
    g.addColorStop(1, st.bg[1]);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    // Yumuşak bulut lekeleri
    for (var i = 0; i < 26; i++) {
      var x = r() * size, y = r() * size, rad = size * (0.08 + r() * 0.25);
      var rg = ctx.createRadialGradient(x, y, 0, x, y, rad);
      var c = r() > 0.5 ? st.bg[1] : st.bg[0];
      rg.addColorStop(0, hexA(c, 0.55));
      rg.addColorStop(1, hexA(c, 0));
      ctx.fillStyle = rg;
      ctx.fillRect(0, 0, size, size);
    }
  }

  function hexA(hex, a) {
    var n = parseInt(hex.slice(1), 16);
    return "rgba(" + (n >> 16) + "," + ((n >> 8) & 255) + "," + (n & 255) + "," + a + ")";
  }

  function walk(r, x, y, ang, len, step, curl) {
    var pts = [[x, y]];
    for (var i = 0; i < len / step; i++) {
      ang += gauss(r) * curl;
      x += Math.cos(ang) * step;
      y += Math.sin(ang) * step;
      pts.push([x, y]);
    }
    return pts;
  }

  function stroke(ctx, pts) {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (var i = 1; i < pts.length - 1; i++) {
      var mx = (pts[i][0] + pts[i + 1][0]) / 2, my = (pts[i][1] + pts[i + 1][1]) / 2;
      ctx.quadraticCurveTo(pts[i][0], pts[i][1], mx, my);
    }
    ctx.stroke();
  }

  function veins(ctx, size, st, r) {
    var k = size / 1024;
    // Önce tüm damar yollarını üret, sonra katman katman çiz
    var mains = [], branches = [], hairs = [];
    for (var m = 0; m < st.main; m++) {
      var x = -size * 0.2 + r() * size * 0.5, y = r() * size * 1.2 - size * 0.1;
      var ang = -0.7 + r() * 0.55;
      var pts = walk(r, x, y, ang, size * (1 + r() * 0.8), 12 * k, 0.16);
      var col = st.veins[Math.floor(r() * st.veins.length)];
      var w = (st.width[0] + r() * (st.width[1] - st.width[0])) * k;
      mains.push({ pts: pts, col: col, w: w });
      var nb = 2 + Math.floor(r() * 5);
      for (var b = 0; b < nb; b++) {
        var p = pts[2 + Math.floor(r() * (pts.length - 4))];
        branches.push({
          pts: walk(r, p[0], p[1], ang + (r() > 0.5 ? 1 : -1) * (0.4 + r() * 0.9), size * (0.05 + r() * 0.3), 8 * k, 0.3),
          col: col, a: 0.4 + r() * 0.35, w: Math.max(0.5, w * (0.2 + r() * 0.4))
        });
      }
    }
    for (var h = 0; h < st.main * 5; h++) {
      hairs.push({ pts: walk(r, r() * size, r() * size, -0.9 + r() * 0.9, size * (0.05 + r() * 0.25), 7 * k, 0.35), a: 0.12 + r() * 0.2, w: 0.6 * k + r() * 0.6 });
    }

    // Bulanık haleler düşük çözünürlükte çizilip büyütülür (çok daha hızlı)
    function soft(scale, blur, widthMul, alpha) {
      var c = document.createElement("canvas");
      c.width = c.height = Math.round(size * scale);
      var x = c.getContext("2d");
      x.lineCap = x.lineJoin = "round";
      x.setTransform(scale, 0, 0, scale, 0, 0);
      mains.forEach(function (v) {
        x.strokeStyle = hexA(v.col, alpha);
        x.lineWidth = v.w * widthMul;
        stroke(x, v.pts);
      });
      ctx.save();
      ctx.filter = "blur(" + Math.max(1, Math.round(blur * k)) + "px)";
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(c, 0, 0, size, size);
      ctx.restore();
    }
    soft(0.25, 10, 7, 0.22 * st.soft);
    soft(0.5, 1.5, 1.8, 0.45);

    ctx.lineCap = ctx.lineJoin = "round";
    mains.forEach(function (v) {
      ctx.strokeStyle = hexA(v.col, 0.85);
      ctx.lineWidth = Math.max(0.6, v.w * 0.6);
      stroke(ctx, v.pts);
    });
    branches.forEach(function (v) {
      ctx.strokeStyle = hexA(v.col, v.a);
      ctx.lineWidth = v.w;
      stroke(ctx, v.pts);
    });
    hairs.forEach(function (v) {
      ctx.strokeStyle = hexA(st.veins[0], v.a);
      ctx.lineWidth = v.w;
      stroke(ctx, v.pts);
    });
  }

  function speckle(ctx, size, st, r) {
    var img = ctx.getImageData(0, 0, size, size), d = img.data;
    var cols = st.speck.map(function (s) {
      var n = parseInt(s[0].slice(1), 16);
      return [n >> 16, (n >> 8) & 255, n & 255, s[1]];
    });
    for (var i = 0; i < d.length; i += 4) {
      var v = r();
      for (var c = 0; c < cols.length; c++) {
        if (v < cols[c][3] * 0.5) {
          var a = 0.35 + r() * 0.65;
          d[i] = d[i] * (1 - a) + cols[c][0] * a;
          d[i + 1] = d[i + 1] * (1 - a) + cols[c][1] * a;
          d[i + 2] = d[i + 2] * (1 - a) + cols[c][2] * a;
          break;
        }
        v -= cols[c][3] * 0.5;
      }
    }
    ctx.putImageData(img, 0, 0);
    // iri taneler
    for (var j = 0; j < size * 1.6; j++) {
      var cc = st.speck[Math.floor(r() * st.speck.length)][0];
      ctx.fillStyle = hexA(cc, 0.5 + r() * 0.5);
      var s = (1 + r() * 2.6) * size / 1024;
      ctx.beginPath();
      ctx.arc(r() * size, r() * size, s, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  var cache = {};
  function draw(id, size) {
    size = size || 1024;
    var key = id + ":" + size;
    if (cache[key]) return cache[key];
    var st = STONES.filter(function (s) { return s.id === id; })[0];
    var c = document.createElement("canvas");
    c.width = c.height = size;
    var ctx = c.getContext("2d");
    var r = rng(st.seed * 1000 + 17);
    background(ctx, size, st, r);
    if (st.speck) speckle(ctx, size, st, r);
    else veins(ctx, size, st, r);
    cache[key] = c;
    return c;
  }

  window.Stones = { list: STONES, draw: draw, get: function (id) { return STONES.filter(function (s) { return s.id === id; })[0]; } };
})();
