/* Moon Fire Evidence Map – dashboard (S3). No build step; Plotly from CDN.
 * All headline numbers come from data/app_data.json (facts / meta / investigations).
 * Labels and colours follow contract §7. */
(function () {
  "use strict";

  var REPO_URL = "https://github.com/semanurcetinn/moon-fire-evidence-map";

  // ---- contract §7 vocabulary ---------------------------------------------------
  var OUTCOMES = [
    ["extinguished", "Extinguished", "#0072B2", "Flame went out"],
    ["sustained", "Sustained", "#D55E00", "Flame kept burning / burned to completion"],
    ["blowoff", "Blowoff", "#56B4E9", "Flame was blown out by the flow"],
    ["no_ignition", "No ignition", "#009E73", "Sample did not ignite"],
    ["cool_flame", "Cool flame", "#CC79A7", "A cool flame ignited directly, no hot flame"],
    ["no_hot_ignition", "No hot ignition", "#F0E442", "Hot flame did not ignite"],
    ["droplet_disruption", "Droplet disruption", "#E69F00", "Droplet broke apart before extinction"],
    ["unknown", "Not recorded", "#999999", "Source table records no outcome"]
  ];
  var OUT = {}; OUTCOMES.forEach(function (o) { OUT[o[0]] = { label: o[1], color: o[2], desc: o[3] }; });
  var GRADES = {
    A: { label: "A · Clean", opacity: 1.0, desc: "Test-level row, ambient O₂, measured pressure, no anomaly" },
    B: { label: "B · Oxidizer-stream O₂", opacity: 0.7, desc: "Measured, but O₂ is the burner oxidizer fraction, not cabin air" },
    C: { label: "C · Approximate", opacity: 0.45, desc: "Summary row, assumed/report-mapped pressure, derived O₂ or anomaly" },
    D: { label: "D · Incomplete", opacity: 0, desc: "O₂ or pressure missing" }
  };
  var PHASES = [["gas", "Gas", "circle"], ["liquid", "Liquid", "square"], ["solid", "Solid", "triangle-up"]];
  var PHASE = {}; PHASES.forEach(function (p) { PHASE[p[0]] = { label: p[1], symbol: p[2] }; });
  var BOX_COLOR = "#2E7D32";
  var COMP = [["moon", "Moon box", "#2E7D32"], ["quality", "Quality", "#4C72B0"],
              ["outcome", "Outcome recorded", "#8C6BB1"], ["material", "Material", "#B07D48"]];

  // ---- axis limits (S3 spec §2) -------------------------------------------------
  var X_RANGE = [10, 90], Y_MIN = 0.3, Y_MAX = 6;

  var app = null, rows = [], plotted = [], tier1 = [];
  var state = emptyFilter();

  function emptyFilter() {
    return { phase: [], psi: [], outcome: [], grade: [], box: null, fuel: null,
      o2_min: null, o2_max: null, p_min_atm: null, p_max_atm: null,
      recordedOnly: false, hideB: false };
  }

  // ---- helpers ------------------------------------------------------------------
  var $ = function (id) { return document.getElementById(id); };
  var fmtInt = function (n) { return Number(n).toLocaleString("en-US"); };
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function cssVar(n) { return getComputedStyle(document.documentElement).getPropertyValue(n).trim(); }
  function round(x, n) { var p = Math.pow(10, n); return Math.round(x * p) / p; }
  function rangeTxt(a, b, unit) {
    if (a == null && b == null) return "n/a";
    if (a === b || b == null) return round(a, 2) + unit;
    return round(a, 2) + "–" + round(b, 2) + unit;
  }

  // ---- filtering ----------------------------------------------------------------
  function passes(r, f) {
    if (f.phase.length && f.phase.indexOf(r.phase) < 0) return false;
    if (f.psi.length && f.psi.indexOf(r.psi) < 0) return false;
    if (f.outcome.length && f.outcome.indexOf(r.outcome) < 0) return false;
    if (f.grade.length && f.grade.indexOf(r.grade) < 0) return false;
    if (f.hideB && r.grade === "B") return false;
    if (f.recordedOnly && r.outcome === "unknown") return false;
    if (f.box === "box_edge") { if (r.box !== "in_box" && r.box !== "edge") return false; }
    else if (f.box && r.box !== f.box) return false;
    if (f.fuel && !(r.fuel && r.fuel.toLowerCase().indexOf(String(f.fuel).toLowerCase()) >= 0)) return false;
    if (f.o2_min != null && !(r.o2_max != null && r.o2_max >= f.o2_min)) return false;
    if (f.o2_max != null && !(r.o2_min != null && r.o2_min <= f.o2_max)) return false;
    if (f.p_min_atm != null && !(r.p != null && r.p >= f.p_min_atm)) return false;
    if (f.p_max_atm != null && !(r.p != null && r.p <= f.p_max_atm)) return false;
    return true;
  }

  // Deterministic spread of rows that share the exact same (O₂, p) position.
  function computeDisplayPositions() {
    var groups = {};
    plotted.forEach(function (r) { var k = r.o2_max + "|" + r.p; (groups[k] = groups[k] || []).push(r); });
    Object.keys(groups).forEach(function (k) {
      var g = groups[k];
      g.sort(function (a, b) { return a.psi < b.psi ? -1 : a.psi > b.psi ? 1 : (a.row - b.row); });
      g.forEach(function (r, i) {
        var p = r.p > 0 ? r.p : Y_MIN * 1.04;            // 0 atm cannot sit on a log axis: pin to the floor
        if (g.length === 1 || i === 0) { r._x = r.o2_max; r._y = p; return; }
        var rad = 0.12 * Math.sqrt(i), th = i * 2.39996;  // sunflower layout
        r._x = r.o2_max + rad * Math.cos(th);
        r._y = p * Math.pow(10, rad * Math.sin(th) * 0.015);
      });
    });
  }

  function hoverText(r) {
    var pTxt = r.p == null ? "n/a" : (round(r.p, 3) + " atm (" + round(r.p * 14.696, 1) + " psi)") +
      (r.p_assumed ? " – assumed / report-mapped" : "") + (r.p === 0 ? " – recorded as 0, flagged" : "");
    return "<b>" + esc(r.psi) + " · test " + esc(r.test) + "</b><br>" +
      "Fuel: " + esc(r.fuel || "n/a") + " (" + esc(PHASE[r.phase].label.toLowerCase()) + ")<br>" +
      "O₂: " + rangeTxt(r.o2_min, r.o2_max, " %") + (r.o2_basis === "oxidizer_stream" ? " (oxidizer stream)" : "") + "<br>" +
      "Pressure: " + pTxt + "<br>" +
      "Outcome: " + esc(OUT[r.outcome].label) + (r.conf ? " (" + r.conf + " confidence)" : "") + "<br>" +
      "Grade: " + esc(GRADES[r.grade].label) + "<br>" +
      "<span style='font-size:11px'>Source: " + esc(r.src) + ", row " + r.row + "</span>";
  }

  // ---- plot ---------------------------------------------------------------------
  function staticTraces() {
    var mb = app.meta.moon_box, solidMax = app.facts.solid.max_o2_pct;
    var fg = cssVar("--fg") || "#1b1d21";
    return [
      { x: [mb.o2_min_pct, X_RANGE[1], X_RANGE[1], mb.o2_min_pct, mb.o2_min_pct], y: [Y_MIN, Y_MIN, mb.p_max_atm, mb.p_max_atm, Y_MIN],
        mode: "lines", fill: "toself", fillcolor: "rgba(46,125,50,0.10)", line: { color: BOX_COLOR, width: 1.5, dash: "dash" },
        hoverinfo: "skip", showlegend: false, name: "Moon habitat box" },
      { x: [mb.o2_min_pct, X_RANGE[1], X_RANGE[1], mb.o2_min_pct, mb.o2_min_pct], y: [mb.p_max_atm, mb.p_max_atm, mb.edge_p_max_atm, mb.edge_p_max_atm, mb.p_max_atm],
        mode: "lines", fill: "toself", fillcolor: "rgba(46,125,50,0.05)", line: { color: BOX_COLOR, width: 0.8, dash: "dot" },
        hoverinfo: "skip", showlegend: false, name: "Edge" },
      { x: [solidMax, solidMax], y: [Y_MIN, Y_MAX], mode: "lines", line: { color: fg, width: 1.5, dash: "dash" },
        hoverinfo: "skip", showlegend: false, name: "Solid-fuel ceiling" },
      { x: [null], y: [null], yaxis: "y2", hoverinfo: "skip", showlegend: false } // activates the psi axis
    ];
  }

  function dataTraces(sel) {
    var bg = cssVar("--bg") || "#fff";
    return OUTCOMES.map(function (o) {
      var pts = sel.filter(function (r) { return r.outcome === o[0]; });
      return {
        type: "scatter", mode: "markers", name: o[1], x: pts.map(function (r) { return r._x; }), y: pts.map(function (r) { return r._y; }),
        text: pts.map(hoverText), hovertemplate: "%{text}<extra></extra>",
        marker: {
          color: o[2], size: 8,
          symbol: pts.map(function (r) { return PHASE[r.phase].symbol + (r.p_assumed ? "-open" : ""); }),
          opacity: pts.map(function (r) { return GRADES[r.grade].opacity; }),
          line: { width: pts.map(function (r) { return r.p_assumed ? 1.6 : 0.5; }),
                  color: pts.map(function (r) { return r.p_assumed ? o[2] : bg; }) }
        },
        showlegend: false
      };
    });
  }

  function layout() {
    var mb = app.meta.moon_box, solidMax = app.facts.solid.max_o2_pct;
    var fg = cssVar("--fg"), muted = cssVar("--muted"), grid = cssVar("--plot-grid");
    var L = Math.log10;
    return {
      margin: { l: 58, r: 58, t: 10, b: 46 }, paper_bgcolor: "rgba(0,0,0,0)", plot_bgcolor: "rgba(0,0,0,0)",
      font: { family: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif", size: 12, color: fg },
      hovermode: "closest", hoverlabel: { align: "left" }, dragmode: "zoom",
      xaxis: { title: { text: "Oxygen, % (effective)" }, range: X_RANGE, gridcolor: grid, zeroline: false, ticksuffix: "", dtick: 10 },
      yaxis: { title: { text: "Pressure, atm (log)" }, type: "log", range: [L(Y_MIN), L(Y_MAX)], gridcolor: grid,
               tickvals: [0.5, 0.694, 1, 2, 3, 5], ticktext: ["0.5", "0.694", "1", "2", "3", "5"] },
      yaxis2: { title: { text: "psi" }, type: "log", overlaying: "y", side: "right", range: [L(Y_MIN * 14.696), L(Y_MAX * 14.696)],
                tickvals: [5, 7.35, 10.2, 14.7, 30, 44, 73.5], ticktext: ["5", "7.35", "10.2", "14.7", "30", "44", "73.5"], showgrid: false },
      annotations: [
        { x: mb.o2_min_pct + 0.8, y: L(mb.p_max_atm * 0.93), xanchor: "left", yanchor: "top", showarrow: false,
          text: "<b>Moon habitat box</b> · O₂ ≥ " + mb.o2_min_pct + " %, ≤ " + mb.p_max_psi + " psi", font: { color: BOX_COLOR, size: 12 } },
        { x: X_RANGE[1] - 0.5, y: L(Math.sqrt(mb.p_max_atm * mb.edge_p_max_atm)), xanchor: "right", yanchor: "middle", showarrow: false,
          text: "edge ≤ " + mb.edge_p_max_atm + " atm", font: { color: BOX_COLOR, size: 10 } },
        { x: solidMax, y: L(Y_MAX * 0.93), xanchor: "left", yanchor: "top", showarrow: false, xshift: 4,
          text: "<b>Highest O₂ in any solid-fuel test: " + solidMax + " %</b>", font: { color: fg, size: 12 },
          bgcolor: cssVar("--bg"), opacity: 0.9 }
      ],
      showlegend: false
    };
  }

  function renderPlot() {
    var sel = plotted.filter(function (r) { return passes(r, state); });
    $("plot-count").textContent = "showing " + fmtInt(sel.length) + " of " + fmtInt(app.facts.plottable);
    var data = staticTraces().concat(dataTraces(sel));
    Plotly.react("plot", data, layout(), { responsive: true, displaylogo: false,
      modeBarButtonsToRemove: ["lasso2d", "select2d", "autoScale2d"], toImageButtonOptions: { filename: "moon-fire-evidence-map" } });
  }

  // ---- header -------------------------------------------------------------------
  function renderCounters() {
    var f = app.facts, mb = app.meta.moon_box;
    var solidAbove = rows.filter(function (r) { return r.phase === "solid" && r.o2_max != null && r.o2_max >= mb.o2_min_pct; }).length;
    var items = [
      [fmtInt(f.investigations_total), "investigations reviewed", ""],
      [fmtInt(f.rows), "test rows harmonized", ""],
      [fmtInt(f.moon_box.in_box), "rows in the Moon habitat box", ""],
      [fmtInt(solidAbove), "solid-fuel tests at ≥ " + mb.o2_min_pct + " % O₂", "key"]
    ];
    $("counters").innerHTML = items.map(function (c) {
      return '<div class="counter ' + c[2] + '"><b>' + c[0] + "</b><span>" + esc(c[1]) + "</span></div>";
    }).join("");
  }

  // ---- legend + notes -----------------------------------------------------------
  function shapeSvg(symbol, open, opacity, color) {
    color = color || cssVar("--fg");
    var fill = open ? "none" : color, st = 'stroke="' + color + '" stroke-width="1.4" fill="' + fill + '" fill-opacity="' + opacity + '" stroke-opacity="' + (open ? 1 : opacity) + '"';
    var shape = symbol === "square" ? '<rect x="2.5" y="2.5" width="9" height="9" ' + st + "/>"
      : symbol === "triangle-up" ? '<polygon points="7,2 12.5,12 1.5,12" ' + st + "/>"
      : '<circle cx="7" cy="7" r="5" ' + st + "/>";
    return '<svg width="14" height="14" aria-hidden="true">' + shape + "</svg>";
  }
  function renderLegend() {
    var parts = [];
    OUTCOMES.forEach(function (o) { parts.push('<span class="item"><span class="swatch" style="background:' + o[2] + '"></span>' + esc(o[1]) + "</span>"); });
    $("legend").innerHTML = parts.join("") +
      '<span class="item" style="flex-basis:100%;height:0"></span>' +
      PHASES.map(function (p) { return '<span class="item">' + shapeSvg(p[2], false, 1) + esc(p[1]) + "</span>"; }).join("") +
      ["A", "B", "C"].map(function (g) { return '<span class="item" title="' + esc(GRADES[g].desc) + '">' + shapeSvg("circle", false, GRADES[g].opacity) + esc(GRADES[g].label) + "</span>"; }).join("") +
      '<span class="item">' + shapeSvg("circle", true, 1) + "Hollow = pressure assumed or report-mapped</span>" +
      '<span class="item"><span class="swatch" style="background:rgba(46,125,50,0.25);border:1px dashed ' + BOX_COLOR + '"></span>Moon habitat box</span>';
    var nUn = app.facts.not_plottable;
    $("note-unplotted").textContent = fmtInt(nUn) + " rows have no O₂ or pressure in the source table and cannot be placed on the map (grade D · Incomplete).";
    var zero = plotted.filter(function (r) { return !(r.p > 0); });
    $("note-axis").textContent = "Overlapping points are spread slightly; hover shows exact values." +
      (zero.length ? " " + zero.length + (zero.length === 1 ? " row (" + zero[0].psi + " test " + zero[0].test + ") records" : " rows record") +
        " 0 atm pressure (flagged in the source) and " + (zero.length === 1 ? "is" : "are") + " pinned to the bottom edge." : "");
  }

  // ---- filters ------------------------------------------------------------------
  function checkbox(container, value, label, swatch, title) {
    var id = container + "-" + value.replace(/[^a-z0-9]/gi, "_");
    var el = document.createElement("label");
    if (title) el.title = title;
    el.innerHTML = '<input type="checkbox" checked value="' + esc(value) + '" id="' + id + '">' + (swatch || "") + "<span>" + label + "</span>";
    $(container).appendChild(el);
  }
  function readGroup(container) {
    var boxes = Array.prototype.slice.call($(container).querySelectorAll("input"));
    var on = boxes.filter(function (b) { return b.checked; }).map(function (b) { return b.value; });
    if (on.length === boxes.length) return [];        // all checked = no restriction
    return on.length ? on : ["__none__"];
  }
  function writeGroup(container, values) {
    Array.prototype.forEach.call($(container).querySelectorAll("input"), function (b) {
      b.checked = !values.length || values.indexOf(b.value) >= 0;
    });
  }
  function syncFromUI() {
    state.phase = readGroup("f-phase");
    state.grade = readGroup("f-grade");
    state.outcome = readGroup("f-outcome");
    state.psi = readGroup("f-psi");
    state.recordedOnly = $("t-recorded").checked;
    state.hideB = $("t-hideb").checked;
    state.box = $("t-box").checked ? "box_edge" : (state.box === "box_edge" ? null : state.box);
    update();
  }
  function syncToUI() {
    writeGroup("f-phase", state.phase); writeGroup("f-grade", state.grade);
    writeGroup("f-outcome", state.outcome); writeGroup("f-psi", state.psi);
    $("t-recorded").checked = state.recordedOnly; $("t-hideb").checked = state.hideB;
    $("t-box").checked = state.box === "box_edge";
  }
  function buildFilters() {
    PHASES.forEach(function (p) { checkbox("f-phase", p[0], esc(p[1]), shapeSvg(p[2], false, 1)); });
    ["A", "B", "C"].forEach(function (g) { checkbox("f-grade", g, esc(GRADES[g].label), shapeSvg("circle", false, GRADES[g].opacity), GRADES[g].desc); });
    OUTCOMES.forEach(function (o) { checkbox("f-outcome", o[0], esc(o[1]), '<span class="swatch" style="background:' + o[2] + '"></span>', o[3]); });
    tier1.forEach(function (v) { checkbox("f-psi", v.psi_id, esc((v.acronym || v.psi_id)) + ' <span class="muted">' + esc(v.psi_id) + "</span>"); });
    $("filters").addEventListener("change", syncFromUI);
    $("reset").addEventListener("click", function () { state = emptyFilter(); syncToUI(); update(); });
  }
  function update() {
    var n = state.psi.filter(function (x) { return x !== "__none__"; }).length;
    $("f-psi-summary").textContent = !state.psi.length ? "All investigations" : (n ? n + " selected" : "None selected");
    Array.prototype.forEach.call(document.querySelectorAll("#rank-table tbody tr"), function (tr) {
      tr.classList.toggle("active", state.psi.length === 1 && state.psi[0] === tr.dataset.psi);
    });
    renderPlot();
  }

  // ---- ranking ------------------------------------------------------------------
  function renderRanking() {
    var W = app.meta.ranking.weights, total = 0;
    COMP.forEach(function (c) { total += W[c[0]]; });
    var tb = document.querySelector("#rank-table tbody");
    tb.innerHTML = tier1.map(function (v) {
      var bar = COMP.map(function (c) {
        var w = (W[c[0]] * v.components[c[0]]) / total * 100;
        return '<span style="width:' + w.toFixed(2) + "%;background:" + c[2] + '" title="' + esc(c[1]) + ": " +
          v.components[c[0]].toFixed(2) + " × " + W[c[0]] + " = " + (W[c[0]] * v.components[c[0]]).toFixed(1) + '"></span>';
      }).join("");
      return '<tr data-psi="' + esc(v.psi_id) + '" tabindex="0">' +
        "<td>" + v.rank + "</td>" +
        "<td><b>" + esc(v.acronym || v.psi_id) + '</b> <span class="psi">' + esc(v.psi_id) + '</span> · <a href="' + esc(v.doi_url) + '" target="_blank" rel="noopener">DOI</a></td>' +
        "<td>" + esc(PHASE[v.fuel_phase].label) + "</td>" +
        '<td class="num">' + fmtInt(v.rows) + "</td>" +
        '<td class="num">' + fmtInt(v.in_box) + "</td>" +
        '<td class="num"><b>' + v.score.toFixed(1) + "</b></td>" +
        '<td><div class="bar" aria-label="score components">' + bar + "</div></td></tr>";
    }).join("");
    function pick(tr) {
      var id = tr.dataset.psi;
      var same = state.psi.length === 1 && state.psi[0] === id;
      state.psi = same ? [] : [id];
      syncToUI(); update();
      if (!same) $("map-section").scrollIntoView({ behavior: "smooth", block: "start" });
    }
    tb.addEventListener("click", function (e) { if (e.target.tagName === "A") return; var tr = e.target.closest("tr"); if (tr) pick(tr); });
    tb.addEventListener("keydown", function (e) { if (e.key === "Enter") { var tr = e.target.closest("tr"); if (tr) pick(tr); } });
    $("bar-legend").innerHTML = COMP.map(function (c) {
      return '<span class="item"><span class="swatch" style="background:' + c[2] + '"></span>' + esc(c[1]) + " (×" + W[c[0]] + ")</span>";
    }).join("");
    var cat = app.investigations.filter(function (v) { return v.tier !== "tier1"; });
    $("catalog-summary").textContent = cat.length + " investigations reviewed but not harmonized";
    $("catalog-list").innerHTML = cat.map(function (v) {
      return "<li><b>" + esc(v.acronym || v.title) + '</b> <span class="muted">' + esc(v.psi_id) + "</span> – " + esc(v.note || "") +
        ' <a href="' + esc(v.doi_url) + '" target="_blank" rel="noopener">DOI</a></li>';
    }).join("");
    $("method-link").href = REPO_URL + "/blob/main/docs/METHOD_RANKING.md";
  }

  // ---- boot ---------------------------------------------------------------------
  function fail(msg) {
    $("plot").innerHTML = '<p class="note">' + esc(msg) + "</p>";
    if (typeof console !== "undefined") console.error("[app]", msg);
  }
  fetch("data/app_data.json").then(function (r) {
    if (!r.ok) throw new Error("HTTP " + r.status);
    return r.json();
  }).then(function (data) {
    app = data;
    rows = app.experiments;
    plotted = rows.filter(function (r) { return r.plottable; });
    tier1 = app.investigations.filter(function (v) { return v.rank != null; }).sort(function (a, b) { return a.rank - b.rank; });
    computeDisplayPositions();
    renderCounters();
    buildFilters();
    renderLegend();
    renderRanking();
    if (typeof Plotly === "undefined") return fail("The chart library could not be loaded. Check your connection and reload.");
    update();
    if (window.matchMedia) window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", renderPlot);
  }).catch(function (e) { fail("Data could not be loaded (" + e.message + "). Open this page through a web server, not as a local file."); });
})();
