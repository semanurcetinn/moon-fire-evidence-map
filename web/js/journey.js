/* Atmosphere Journey – a schematic walk through three atmospheres in the oxygen–pressure plane.
 *
 * Everything that moves on screen is a recorded test row, an outcome share or an evidence grade.
 * No flame model, no prediction: the "Evidence Flame" only restates the outcomes of the tests
 * inside the current window. Data: web/data/app_data.json (same file as the dashboard).
 * Station values (Earth, Moon habitat box, spacesuit) come from the challenge description.
 * Pure canvas 2D, no extra library, no build step.
 */
(function () {
  "use strict";

  // ---- station values: NASA Space Apps challenge description ---------------------------
  var PSI_PER_ATM = 14.696;
  var STATIONS = [
    { id: "earth", t: 0, o2: 21, psi: 14.7, name: "Earth, sea level",
      note: "Earth's pressure at sea level is 14.7 psi (challenge description)." },
    { id: "moon", t: 0.5, o2: 30, psi: 10.2, name: "Moon habitat box",
      note: "Expected Moon base / pressurized rover atmosphere: 30 % O₂ or more at 10.2 psi or less (challenge description)." },
    { id: "suit", t: 1, o2: 100, psi: 4.3, name: "Spacesuit",
      note: "Spacesuits hold 100 % oxygen at only 4.3 psi (challenge description)." }
  ];
  var WIN_O2 = 2, WIN_PSI = 1;            // window: ±2 % O₂ and ±1 psi
  var P_EPS = 5e-4;                       // same tolerance as the dashboard filter
  var X_MIN = 10, X_MAX = 100, Y_MIN = 0.22, Y_MAX = 6;

  var OUT = {
    extinguished: ["Extinguished", "#0072B2"], sustained: ["Sustained", "#D55E00"], blowoff: ["Blowoff", "#56B4E9"],
    no_ignition: ["No ignition", "#009E73"], cool_flame: ["Cool flame", "#CC79A7"], no_hot_ignition: ["No hot ignition", "#F0E442"],
    droplet_disruption: ["Droplet disruption", "#E69F00"], unknown: ["Not recorded", "#999999"]
  };
  var OUT_ORDER = ["extinguished", "sustained", "blowoff", "no_ignition", "cool_flame", "no_hot_ignition", "droplet_disruption", "unknown"];
  var GRADE_ALPHA = { A: 1, B: 0.7, C: 0.45, D: 0.3 };
  var GRADE_W = { A: 1, B: 0.66, C: 0.33, D: 0 };

  var root = document.getElementById("journey");
  if (!root) return;
  var $ = function (id) { return document.getElementById(id); };
  var cv = $("jr-canvas"), fl = $("jr-flame");
  if (!cv || !cv.getContext || !fl) return;
  var ctx = cv.getContext("2d"), fctx = fl.getContext("2d");
  var reduce = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);

  var rows = [], pts = [], W = 0, H = 0, dpr = 1, pad = { l: 78, r: 14, t: 14, b: 30 };
  var pos = { t: 0 }, stats = null, visible = true, playToken = 0, stars = [];

  // ---- helpers ------------------------------------------------------------------------
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function fmt(n) { return Number(n).toLocaleString("en-US"); }
  function r1(x) { return Math.round(x * 10) / 10; }
  function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }
  function ease(x) { return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2; }
  function atm(psi) { return psi / PSI_PER_ATM; }
  function toX(o2) { return pad.l + (o2 - X_MIN) / (X_MAX - X_MIN) * (W - pad.l - pad.r); }
  function toY(p) {
    var q = p > 0 ? p : Y_MIN * 1.04;
    return pad.t + (1 - (Math.log(q) - Math.log(Y_MIN)) / (Math.log(Y_MAX) - Math.log(Y_MIN))) * (H - pad.t - pad.b);
  }
  function cssTxt() { var s = getComputedStyle(document.documentElement); return s.getPropertyValue("--fg").trim() || "#1b1d21"; }

  // position of the probe along Earth → Moon box corner → spacesuit (linear in O₂, log in pressure)
  function pathAt(t) {
    var a = t <= 0.5 ? STATIONS[0] : STATIONS[1], b = t <= 0.5 ? STATIONS[1] : STATIONS[2];
    var u = t <= 0.5 ? t / 0.5 : (t - 0.5) / 0.5;
    var pa = atm(a.psi), pb = atm(b.psi);
    return { o2: a.o2 + (b.o2 - a.o2) * u, p: Math.exp(Math.log(pa) + (Math.log(pb) - Math.log(pa)) * u) };
  }

  // ---- window statistics (same overlap rules as the dashboard filter) ------------------
  function inWindow(r, o2, p) {
    var lo = o2 - WIN_O2, hi = o2 + WIN_O2, pLo = p - WIN_PSI / PSI_PER_ATM, pHi = p + WIN_PSI / PSI_PER_ATM;
    return r.o2_max >= lo && r.o2_min <= hi && r.p >= pLo - P_EPS && r.p <= pHi + P_EPS;
  }
  function tally(list) {
    var s = { n: list.length, out: {}, grade: { A: 0, B: 0, C: 0, D: 0 }, phase: { gas: 0, liquid: 0, solid: 0 }, psi: {} };
    list.forEach(function (r) {
      s.out[r.outcome] = (s.out[r.outcome] || 0) + 1; s.grade[r.grade]++; s.phase[r.phase]++; s.psi[r.psi] = 1;
    });
    return s;
  }
  function nearest(o2, p) {
    var best = null, bd = 1e9;
    pts.forEach(function (r) {
      var d = Math.abs(r.o2_max - o2) / 5 + Math.abs(Math.log10(Math.max(r.p, 0.01) / p)) / 0.15;
      if (d < bd) { bd = d; best = r; }
    });
    return best;
  }
  function compute(t) {
    var P = pathAt(t), st = null;
    STATIONS.forEach(function (s) { if (Math.abs(t - s.t) < 0.012) st = s; });
    var res = { t: t, o2: P.o2, p: P.p, station: st, mode: "window" };
    if (st && st.id === "moon") {
      res.mode = "box";
      res.list = pts.filter(function (r) { return r.box === "in_box"; });
    } else {
      res.list = pts.filter(function (r) { return inWindow(r, P.o2, P.p); });
    }
    res.s = tally(res.list);
    if (!res.s.n) res.near = nearest(P.o2, P.p);
    res.maxO2 = Math.max.apply(null, pts.map(function (r) { return r.o2_max; }));
    return res;
  }

  // ---- text panel ----------------------------------------------------------------------
  function renderPanel() {
    var s = stats, st = s.station, psi = s.p * PSI_PER_ATM;
    var title = st ? st.name : "Custom point on the path";
    var h = "<h3>" + esc(title) + "</h3><p class=\"jr-coords\">" + r1(s.o2) + " % O₂ · " + r1(psi) + " psi (" + (Math.round(s.p * 100) / 100) + " atm)</p>";
    if (s.mode === "box") {
      h += "<p><b>" + fmt(s.s.n) + " test rows</b> lie inside the box (O₂ ≥ 30 %, pressure ≤ 10.2 psi): " +
        s.s.grade.A + " clean (A), " + s.s.grade.B + " oxidizer-stream (B), " + s.s.grade.C + " approximate (C). " +
        "Phases: " + s.s.phase.gas + " gas, " + s.s.phase.liquid + " liquid, <b>" + s.s.phase.solid + " solid</b>.</p>";
    } else if (s.s.n) {
      h += "<p><b>" + fmt(s.s.n) + " test rows</b> within ±" + WIN_O2 + " % O₂ and ±" + WIN_PSI + " psi of this point. Grades: " +
        s.s.grade.A + " A · " + s.s.grade.B + " B · " + s.s.grade.C + " C. Phases: " +
        s.s.phase.gas + " gas, " + s.s.phase.liquid + " liquid, " + s.s.phase.solid + " solid.</p>";
    } else {
      var n = s.near;
      h += "<p class=\"jr-empty\"><b>No PSI test</b> within ±" + WIN_O2 + " % O₂ and ±" + WIN_PSI + " psi of this point." +
        (n ? " Nearest recorded test: " + esc(n.psi) + " test " + esc(n.test) + " at " + r1(n.o2_max) + " % O₂ and " +
          r1(n.p * PSI_PER_ATM) + " psi (grade " + esc(n.grade) + ", outcome: " + esc(OUT[n.outcome][0].toLowerCase()) + ")." : "") + "</p>";
      if (s.o2 > s.maxO2) h += "<p class=\"muted small\">The highest oxygen in any PSI test row is " + r1(s.maxO2) + " %.</p>";
    }
    var chips = OUT_ORDER.filter(function (k) { return s.s.out[k]; }).map(function (k) {
      return "<span class=\"jr-chip\"><span class=\"swatch\" style=\"background:" + OUT[k][1] + "\"></span>" + esc(OUT[k][0]) + " " + s.s.out[k] + "</span>";
    }).join("");
    if (chips) h += "<div class=\"jr-chips\">" + chips + "</div>";
    if (st) h += "<p class=\"muted small\">" + esc(st.note) + "</p>";
    if (s.s.n) h += "<button type=\"button\" class=\"btn\" id=\"jr-show\">Show these rows on the map</button>";
    $("jr-text").innerHTML = h;
    var b = $("jr-show");
    if (b) b.addEventListener("click", showOnMap);
    $("jr-slider").setAttribute("aria-valuetext", title + ": " + r1(s.o2) + " % oxygen, " + r1(psi) + " psi, " + s.s.n + " test rows");
  }
  function showOnMap() {
    if (!window.App || !window.App.applyFilter) return;
    var s = stats;
    if (s.mode === "box") window.App.applyFilter({ box: "in_box" });
    else window.App.applyFilter({ o2_min: s.o2 - WIN_O2, o2_max: s.o2 + WIN_O2,
      p_min_atm: s.p - WIN_PSI / PSI_PER_ATM, p_max_atm: s.p + WIN_PSI / PSI_PER_ATM });
    var m = $("map-section"); if (m) m.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  }

  // ---- layout / points -------------------------------------------------------------------
  function layoutPoints() {
    var groups = {};
    pts.forEach(function (r) { var k = r.o2_max + "|" + r.p; (groups[k] = groups[k] || []).push(r); });
    Object.keys(groups).forEach(function (k) {
      var g = groups[k];
      g.forEach(function (r, i) {
        var rad = i === 0 ? 0 : Math.min(9, 2.2 * Math.sqrt(i)), th = i * 2.39996;
        r._dx = rad * Math.cos(th); r._dy = rad * Math.sin(th);
        r._s = 0.4;
      });
    });
    pts.forEach(function (r) { r._x = toX(r.o2_max); r._y = toY(r.p); });
  }
  function resize() {
    var w = cv.parentNode.clientWidth;
    if (!w) return;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = w; H = w < 560 ? 280 : 340;
    pad.l = w < 560 ? 54 : 78;
    cv.width = W * dpr; cv.height = H * dpr; cv.style.height = H + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    stars = [];
    for (var i = 0; i < 70; i++) stars.push([((i * 9301 + 49297) % 233280) / 233280 * W, ((i * 7919 + 1231) % 104729) / 104729 * H, 0.4 + (i % 3) * 0.3, 0.15 + (i % 5) * 0.08]);
    layoutPoints();
  }

  // ---- drawing ---------------------------------------------------------------------------
  function drawScene(time) {
    var g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#0a0f1e"); g.addColorStop(1, "#151c36");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    stars.forEach(function (s) { ctx.fillStyle = "rgba(255,255,255," + (s[3] + (reduce ? 0 : 0.08 * Math.sin(time / 900 + s[0])) ) + ")"; ctx.fillRect(s[0], s[1], s[2], s[2]); });

    var plotL = pad.l, plotR = W - pad.r, plotT = pad.t, plotB = H - pad.b;
    ctx.font = "11px system-ui, sans-serif"; ctx.textBaseline = "middle";
    // grid + ticks
    ctx.strokeStyle = "rgba(255,255,255,0.08)"; ctx.fillStyle = "#9aa4b5"; ctx.lineWidth = 1;
    ctx.textAlign = "right";
    [0.3, 0.5, 1, 2, 5].forEach(function (p) {
      var y = toY(p); ctx.beginPath(); ctx.moveTo(plotL, y); ctx.lineTo(plotR, y); ctx.stroke();
      ctx.fillText(p + " atm", plotL - 6, y - 5);
      ctx.fillStyle = "#6f7a8f"; ctx.fillText(r1(p * PSI_PER_ATM) + " psi", plotL - 6, y + 6); ctx.fillStyle = "#9aa4b5";
    });
    ctx.textAlign = "center"; ctx.textBaseline = "top";
    [20, 30, 40, 50, 60, 70, 80, 90, 100].forEach(function (o) {
      var x = toX(o); ctx.beginPath(); ctx.moveTo(x, plotT); ctx.lineTo(x, plotB); ctx.stroke(); ctx.fillText(o + " %", x, plotB + 6);
    });
    // Moon habitat box + edge band (definition from the challenge: ≥ 30 % O₂, ≤ 10.2 psi; edge ≤ 0.75 atm is our own band)
    var bx = toX(30), by = toY(atm(10.2)), ey = toY(0.75);
    ctx.fillStyle = "rgba(46,125,50,0.22)"; ctx.fillRect(bx, by, plotR - bx, plotB - by);
    ctx.fillStyle = "rgba(46,125,50,0.08)"; ctx.fillRect(bx, ey, plotR - bx, by - ey);
    ctx.strokeStyle = "rgba(102,187,106,0.9)"; ctx.setLineDash([]); ctx.strokeRect(bx, by, plotR - bx, plotB - by);
    ctx.textAlign = "right"; ctx.textBaseline = "top"; ctx.fillStyle = "#8fd194";
    ctx.fillText("Moon habitat box · O₂ ≥ 30 %, ≤ 10.2 psi", plotR - 6, by + 4);
    // solid-fuel ceiling
    var sx = toX(stats.maxSolid);
    ctx.strokeStyle = "rgba(255,255,255,0.45)"; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(sx, plotT); ctx.lineTo(sx, plotB); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = "#c9d1de"; ctx.textAlign = "left"; ctx.textBaseline = "top"; ctx.fillText((W < 560 ? "solids ≤ " : "highest solid-fuel O₂: ") + r1(stats.maxSolid) + " %", sx + 5, plotT + 2);
    // path
    ctx.strokeStyle = "rgba(255,255,255,0.35)"; ctx.setLineDash([2, 5]); ctx.beginPath();
    for (var i = 0; i <= 80; i++) { var q = pathAt(i / 80); (i ? ctx.lineTo : ctx.moveTo).call(ctx, toX(q.o2), toY(q.p)); }
    ctx.stroke(); ctx.setLineDash([]);
    // window (or box highlight)
    var P = pathAt(stats.t);
    if (stats.mode === "window") {
      var x1 = toX(P.o2 - WIN_O2), x2 = toX(P.o2 + WIN_O2), y1 = toY(P.p + WIN_PSI / PSI_PER_ATM), y2 = toY(P.p - WIN_PSI / PSI_PER_ATM);
      ctx.fillStyle = "rgba(255,255,255,0.07)"; ctx.fillRect(x1, y1, x2 - x1, y2 - y1);
      ctx.strokeStyle = "rgba(255,255,255,0.55)"; ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
    }
    // points: rows inside the window are lifted and lit
    var inSet = {};
    stats.list.forEach(function (r) { inSet[r.psi + "|" + r.test + "|" + r.row] = 1; });
    pts.forEach(function (r) {
      var on = !!inSet[r.psi + "|" + r.test + "|" + r.row];
      r._s += ((on ? 1 : 0.4) - r._s) * (reduce ? 1 : 0.18);
      var a = GRADE_ALPHA[r.grade] * (0.28 + 0.72 * (r._s - 0.4) / 0.6);
      var rad = 1.6 + 2.6 * (r._s - 0.4) / 0.6;
      var x = r._x + r._dx, y = r._y + r._dy;
      if (r._s > 0.55) { ctx.fillStyle = OUT[r.outcome][1]; ctx.globalAlpha = 0.18 * a; ctx.beginPath(); ctx.arc(x, y, rad + 4, 0, 6.2832); ctx.fill(); }
      ctx.globalAlpha = a; ctx.fillStyle = OUT[r.outcome][1]; ctx.beginPath(); ctx.arc(x, y, rad, 0, 6.2832); ctx.fill();
    });
    ctx.globalAlpha = 1;
    // stations
    STATIONS.forEach(function (s) {
      var q = pathAt(s.t), x = toX(q.o2), y = toY(q.p);
      ctx.strokeStyle = "rgba(255,255,255,0.8)"; ctx.fillStyle = "#0a0f1e"; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(x, y, 5, 0, 6.2832); ctx.fill(); ctx.stroke(); ctx.lineWidth = 1;
      ctx.fillStyle = "#e8eaed"; ctx.textBaseline = "bottom"; ctx.textAlign = s.id === "suit" ? "right" : "left";
      ctx.fillText(s.name.split(",")[0], x + (s.id === "suit" ? -9 : 9), y - 6);
    });
    // probe with glow
    var px = toX(P.o2), py = toY(P.p);
    var gr = ctx.createRadialGradient(px, py, 0, px, py, 22);
    gr.addColorStop(0, "rgba(255,214,102,0.95)"); gr.addColorStop(0.25, "rgba(255,170,60,0.55)"); gr.addColorStop(1, "rgba(255,150,40,0)");
    ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(px, py, 22 + (reduce ? 0 : 2 * Math.sin(time / 300)), 0, 6.2832); ctx.fill();
    ctx.fillStyle = "#fff6d6"; ctx.beginPath(); ctx.arc(px, py, 4.5, 0, 6.2832); ctx.fill();
    // axis titles
    ctx.fillStyle = "#9aa4b5"; ctx.textAlign = "center"; ctx.textBaseline = "bottom"; ctx.fillText("Oxygen, % of the atmosphere", (plotL + plotR) / 2, H - 1);
  }

  // Evidence Flame: restates the outcomes of the rows in the window. Fixed size; no flame model.
  var particles = [];
  for (var pi = 0; pi < 64; pi++) particles.push({ a: pi / 64 * 6.2832, r: 0.78 + ((pi * 37) % 10) / 100, v: 0.2 + ((pi * 13) % 10) / 40 });
  function drawFlame(time) {
    var S = 160, c = fctx;
    if (fl.width !== S * dpr) { fl.width = S * dpr; fl.height = S * dpr; fl.style.width = S + "px"; fl.style.height = S + "px"; }
    c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, S, S);
    var cx = S / 2, cy = S / 2, R = 58, s = stats.s;
    if (!s.n) {
      c.strokeStyle = "rgba(160,170,190,0.7)"; c.setLineDash([5, 5]); c.lineWidth = 1.5; c.beginPath(); c.arc(cx, cy, R, 0, 6.2832); c.stroke(); c.setLineDash([]);
      c.fillStyle = "#9aa4b5"; c.font = "12px system-ui, sans-serif"; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText("no test here", cx, cy);
      return;
    }
    var recorded = 1 - (s.out.unknown || 0) / s.n;
    var q = (s.grade.A * GRADE_W.A + s.grade.B * GRADE_W.B + s.grade.C * GRADE_W.C) / s.n;
    var core = c.createRadialGradient(cx, cy, 0, cx, cy, R);
    core.addColorStop(0, "rgba(140,190,255," + (0.15 + 0.55 * recorded) + ")"); core.addColorStop(1, "rgba(60,110,220,0)");
    c.fillStyle = core; c.beginPath(); c.arc(cx, cy, R, 0, 6.2832); c.fill();
    // outcome-coloured ring: particle colours follow the outcome shares
    var seq = [];
    OUT_ORDER.forEach(function (k) { var m = Math.round((s.out[k] || 0) / s.n * particles.length); for (var j = 0; j < m; j++) seq.push(k); });
    while (seq.length < particles.length) seq.push("unknown");
    var blur = 1 + 13 * (1 - q);
    particles.forEach(function (p, i) {
      if (!reduce) p.a += p.v * 0.01;
      var rr = R * (p.r + (reduce ? 0 : 0.05 * Math.sin(time / 700 + i)));
      var x = cx + rr * Math.cos(p.a), y = cy + rr * Math.sin(p.a);
      c.shadowColor = OUT[seq[i]][1]; c.shadowBlur = blur; c.fillStyle = OUT[seq[i]][1];
      c.globalAlpha = 0.35 + 0.65 * recorded * (seq[i] === "unknown" ? 0.5 : 1);
      c.beginPath(); c.arc(x, y, 2.6, 0, 6.2832); c.fill();
    });
    c.shadowBlur = 0; c.globalAlpha = 1;
  }

  var raf = 0, last = 0;
  function frame(time) {
    raf = 0;
    if (!stats) return;
    drawScene(time); drawFlame(time);
    if (visible && (!reduce || needsStill)) raf = requestAnimationFrame(frame);
    needsStill = false;
  }
  var needsStill = false;
  function kick() { needsStill = true; if (!raf) raf = requestAnimationFrame(frame); }

  // ---- control -----------------------------------------------------------------------------
  function setT(t, silent) {
    pos.t = clamp(t, 0, 1);
    $("jr-slider").value = Math.round(pos.t * 1000);
    stats = compute(pos.t); stats.maxSolid = solidMax;
    if (!silent) renderPanel();
    kick();
  }
  function tween(to, ms) {
    var token = playToken, from = pos.t, t0 = performance.now();
    return new Promise(function (res) {
      if (reduce || ms <= 0) { setT(to); return res(); }
      (function step(now) {
        if (token !== playToken) return res();
        var u = clamp((now - t0) / ms, 0, 1);
        setT(from + (to - from) * ease(u), u < 1);
        if (u < 1) requestAnimationFrame(step); else res();
      })(t0);
    });
  }
  function wait(ms) { var token = playToken; return new Promise(function (r) { setTimeout(function () { r(token === playToken); }, ms); }); }
  function stop() { playToken++; $("jr-play").textContent = "▶ Play the journey"; $("jr-play").setAttribute("aria-pressed", "false"); }
  function play() {
    stop(); var token = playToken; $("jr-play").textContent = "❚❚ Pause"; $("jr-play").setAttribute("aria-pressed", "true");
    (async function () {
      await tween(0, 600); if (!(await wait(2200))) return;
      await tween(0.5, 3200); if (token !== playToken) return; if (!(await wait(3200))) return;
      await tween(1, 3200); if (token !== playToken) return; await wait(2200);
      if (token === playToken) stop();
    })();
  }
  function goto(id) {
    stop();
    var s = STATIONS.filter(function (x) { return x.id === id; })[0];
    tween(s.t, 900);
  }

  // ---- judge tour (90 s) ----------------------------------------------------------------------
  var tourTimer = 0, tourStep = -1;
  var TOUR = [
    ["journey", "1 / 4 · The Atmosphere Journey. Move the probe: every dot is a recorded test row, and the window shows how many tests exist near each atmosphere."],
    ["map-section", "2 / 4 · The Evidence Map. The green box is the expected Moon habitat atmosphere. Colour is the outcome, opacity is how clean the row is."],
    ["ranking-section", "3 / 4 · The ranking. Investigations scored by how much test-level evidence they give for that atmosphere. Coverage, not scientific merit."],
    ["stops-section", "4 / 4 · Where the evidence stops. No solid-fuel test reaches 30 % O₂, and most rows record no outcome."]
  ];
  function tourShow(i) {
    clearTimeout(tourTimer);
    var box = $("tour-box");
    document.querySelectorAll(".tour-focus").forEach(function (e) { e.classList.remove("tour-focus"); });
    if (i >= TOUR.length) { box.hidden = true; tourStep = -1; return; }
    tourStep = i;
    var el = $(TOUR[i][0]);
    if (el) { el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" }); el.classList.add("tour-focus"); }
    $("tour-text").textContent = TOUR[i][1];
    box.hidden = false;
    $("tour-next").textContent = i === TOUR.length - 1 ? "Finish" : "Next";
    tourTimer = setTimeout(function () { tourShow(i + 1); }, 22000);
  }
  function tourStart() { tourShow(0); if (!reduce) play(); }

  // ---- boot -----------------------------------------------------------------------------------
  var solidMax = 0;
  fetch("data/app_data.json").then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); }).then(function (d) {
    rows = d.experiments;
    pts = rows.filter(function (r) { return r.plottable && r.o2_max != null && r.p != null; });
    solidMax = d.facts && d.facts.solid ? d.facts.solid.max_o2_pct : 0;
    resize();
    setT(0);
    var ro = window.ResizeObserver ? new ResizeObserver(function () { resize(); kick(); }) : null;
    if (ro) ro.observe(cv.parentNode); else window.addEventListener("resize", function () { resize(); kick(); });
    if (window.IntersectionObserver) new IntersectionObserver(function (e) { visible = e[0].isIntersecting; if (visible) kick(); }).observe(root);
    $("jr-play").addEventListener("click", function () { if ($("jr-play").getAttribute("aria-pressed") === "true") stop(); else play(); });
    $("jr-slider").addEventListener("input", function (e) { stop(); setT(e.target.value / 1000); });
    STATIONS.forEach(function (s) { var b = $("jr-go-" + s.id); if (b) b.addEventListener("click", function () { goto(s.id); }); });
    // click or drag on the canvas moves the probe to the nearest point of the path
    var dragging = false;
    function pick(e) {
      var rc = cv.getBoundingClientRect(), x = e.clientX - rc.left, y = e.clientY - rc.top, bt = 0, bd = 1e9;
      for (var i = 0; i <= 200; i++) { var q = pathAt(i / 200), dx = toX(q.o2) - x, dy = toY(q.p) - y, dd = dx * dx + dy * dy; if (dd < bd) { bd = dd; bt = i / 200; } }
      stop(); setT(bt);
    }
    cv.addEventListener("pointerdown", function (e) { dragging = true; cv.setPointerCapture(e.pointerId); pick(e); });
    cv.addEventListener("pointermove", function (e) { if (dragging) pick(e); });
    cv.addEventListener("pointerup", function () { dragging = false; });
    $("tour-start").addEventListener("click", tourStart);
    $("tour-next").addEventListener("click", function () { tourShow(tourStep + 1); });
    $("tour-close").addEventListener("click", function () { tourShow(99); });
    if (location.hash === "#tour") setTimeout(tourStart, 600);
    window.Journey = { goto: goto, setT: setT, stats: function () { return stats; } };
  }).catch(function (e) {
    $("jr-text").textContent = "The journey could not be loaded (" + e.message + "). Open this page through a web server.";
  });
})();
