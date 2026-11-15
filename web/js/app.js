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
    if (a == null) return round(b, 2) + unit;
    if (a === b || b == null) return round(a, 2) + unit;
    return round(a, 2) + "–" + round(b, 2) + unit;
  }

  // ---- filtering ----------------------------------------------------------------
  // Fuel matching mirrors js/rag.js so "Show on map" draws exactly the rows the question counted.
  var FUELS = {
    pmma: /\bpmma\b|acrylic|plexiglas/i, heptane: /\bheptane\b/i, methanol: /\bmethanol\b/i,
    ethanol: /\bethanol\b/i, ethylene: /\bethylene\b|\bc2h4\b/i, butane: /\bbutane\b/i,
    ethane: /\bethane\b/i, propane: /\bpropane\b|\bc3h8\b/i, methane: /\bmethane\b|\bch4\b/i,
    propylene: /\bpropylene\b/i, sibal: /\bsibal\b/i, silicone: /\bsilicone\b/i, cotton: /\bcotton\b/i,
    fiberglass: /fiberglass/i, dodecane: /dodecane|\bc12h26\b/i, octane: /octane/i, decane: /\bdecane\b/i,
    nomex: /\bnomex\b/i, kapton: /\bkapton\b/i, delrin: /\bdelrin\b/i, ultem: /\bultem\b/i
  };
  var P_EPS = 5e-4; // 10.2 psi = 0.69407 atm must include rows stored as 0.694 (same as rag.js)
  function fuelRegex(f) {
    var m = /^(\d+(?:\.\d+)?)% (\w+)$/.exec(f);
    if (m) return new RegExp("(?:^|[^0-9.])" + m[1].replace(".", "\\.") + "\\s*%\\s*" + m[2] + "\\b", "i");
    if (FUELS[f]) return FUELS[f];
    return new RegExp("\\b" + String(f).replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b", "i");
  }
  function passes(r, f) {
    if (f.phase.length && f.phase.indexOf(r.phase) < 0) return false;
    if (f.psi.length && f.psi.indexOf(r.psi) < 0) return false;
    if (f.outcome.length && f.outcome.indexOf(r.outcome) < 0) return false;
    if (f.grade.length && f.grade.indexOf(r.grade) < 0) return false;
    if (f.hideB && r.grade === "B") return false;
    if (f.recordedOnly && r.outcome === "unknown") return false;
    if (f.box === "box_edge") { if (r.box !== "in_box" && r.box !== "edge") return false; }
    else if (f.box && r.box !== f.box) return false;
    if (f.fuel && !(r.fuel && fuelRegex(f.fuel).test(r.fuel))) return false;
    if (f.o2_min != null && !(r.o2_max != null && r.o2_max >= f.o2_min)) return false;
    if (f.o2_max != null && !(r.o2_min != null && r.o2_min <= f.o2_max)) return false;
    if (f.p_min_atm != null && !(r.p != null && r.p >= f.p_min_atm - P_EPS)) return false;
    if (f.p_max_atm != null && !(r.p != null && r.p <= f.p_max_atm + P_EPS)) return false;
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

  // The frozen data keeps one ETL note in Turkish (PSI-10 inverse rows); show it in English on screen.
  function displayFuel(f) {
    return f ? String(f).replace("(turetilmis: XC2H4 kolonu)", "(derived from the XC2H4 column)") : f;
  }
  function hoverText(r) {
    var pTxt = r.p == null ? "n/a" : (round(r.p, 3) + " atm (" + round(r.p * 14.696, 1) + " psi)") +
      (r.p_assumed ? " – assumed / report-mapped" : "") + (r.p === 0 ? " – recorded as 0, flagged" : "");
    return "<b>" + esc(r.psi) + " · test " + esc(r.test) + "</b><br>" +
      "Fuel: " + esc(displayFuel(r.fuel) || "n/a") + " (" + esc(PHASE[r.phase].label.toLowerCase()) + ")<br>" +
      "O₂: " + rangeTxt(r.o2_min, r.o2_max, " %") + (r.o2_basis === "oxidizer_stream" ? " (oxidizer stream)" : "") + "<br>" +
      "Pressure: " + pTxt + "<br>" +
      (r.flow_min != null || r.flow_max != null ? "Flow: " + rangeTxt(r.flow_min, r.flow_max, " cm/s") + "<br>" : "") +
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
    $("download").addEventListener("click", downloadCsv);
    $("query-chip").addEventListener("click", function () {
      state.fuel = null; state.o2_min = state.o2_max = state.p_min_atm = state.p_max_atm = null;
      if (state.box !== "box_edge") state.box = null;
      update();
    });
  }
  function queryChipText() {
    var parts = [];
    if (state.fuel) parts.push("fuel: " + state.fuel);
    if (state.o2_min != null) parts.push("O₂ ≥ " + state.o2_min + " %");
    if (state.o2_max != null) parts.push("O₂ ≤ " + state.o2_max + " %");
    if (state.p_min_atm != null) parts.push("p ≥ " + state.p_min_atm + " atm");
    if (state.p_max_atm != null) parts.push("p ≤ " + state.p_max_atm + " atm");
    if (state.box && state.box !== "box_edge") parts.push({ in_box: "Moon box", edge: "edge", near_miss: "near miss", none: "outside box" }[state.box] || state.box);
    return parts.join(" · ");
  }
  function update() {
    var n = state.psi.filter(function (x) { return x !== "__none__"; }).length;
    $("f-psi-summary").textContent = !state.psi.length ? "All investigations" : (n ? n + " selected" : "None selected");
    Array.prototype.forEach.call(document.querySelectorAll("#rank-table tbody tr"), function (tr) {
      tr.classList.toggle("active", state.psi.length === 1 && state.psi[0] === tr.dataset.psi);
    });
    var chip = queryChipText();
    $("query-chip").hidden = !chip;
    $("query-chip").textContent = chip ? "Query: " + chip : "";
    $("query-chip").title = "Clear the conditions set from a question";
    var nAll = rows.filter(function (r) { return passes(r, state); }).length;
    $("download-note").textContent = "CSV: " + fmtInt(nAll) + " rows pass these filters, including rows that cannot be placed on the map.";
    renderPlot();
  }

  // ---- public API for the "Ask the evidence" box (field names = S4B `parsed`) -----
  var FILTER_KEYS = ["phase", "psi", "outcome", "grade", "box", "fuel", "o2_min", "o2_max", "p_min_atm", "p_max_atm"];
  function applyFilter(filter) {
    state = emptyFilter();
    FILTER_KEYS.forEach(function (k) {
      var v = filter && filter[k];
      if (v == null) return;
      state[k] = Array.isArray(v) ? v.slice() : v;
    });
    syncToUI(); update();
    return plotted.filter(function (r) { return passes(r, state); }).length;
  }
  function countPlotted(filter) {
    var f = emptyFilter();
    FILTER_KEYS.forEach(function (k) { if (filter && filter[k] != null) f[k] = filter[k]; });
    return plotted.filter(function (r) { return passes(r, f); }).length;
  }

  // ---- CSV download (all rows passing the current filters) ------------------------
  var CSV_COLS = ["psi", "test", "fuel", "phase", "o2_min", "o2_max", "p", "p_max", "p_assumed", "flow_min", "flow_max",
    "outcome", "conf", "grade", "o2_basis", "box", "plottable", "dup", "flags", "src", "row"];
  function csvCell(v) {
    if (v == null) return "";
    if (Array.isArray(v)) v = v.join(";");
    v = String(v);
    return /[",\n;]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
  }
  function downloadCsv() {
    var sel = rows.filter(function (r) { return passes(r, state); });
    var lines = [CSV_COLS.join(",")].concat(sel.map(function (r) { return CSV_COLS.map(function (c) { return csvCell(r[c]); }).join(","); }));
    var blob = new Blob(["﻿" + lines.join("\r\n") + "\r\n"], { type: "text/csv;charset=utf-8" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "moon-fire-evidence-rows-" + app.meta.data_version + ".csv";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  }

  // ---- "Where the evidence stops" (S3 §5) ---------------------------------------
  function renderStops() {
    var f = app.facts, mb = f.moon_box, g = mb.by_grade;
    var boxes = [
      ["Inside the box: " + fmtInt(mb.in_box) + " rows",
       fmtInt(g.A || 0) + " clean (A), " + fmtInt(g.B || 0) + " oxidizer-stream (B), " + fmtInt(g.C || 0) + " approximate (C)." +
       (f.solid.in_box === 0 ? " All gas or liquid." : "")],
      ["Solid fuels: " + fmtInt(f.solid.rows) + " rows", "None above " + f.solid.max_o2_pct + " % O₂."],
      ["Outcome recorded for " + fmtInt(f.known_outcomes) + " of " + fmtInt(f.rows) + " rows", "'Not recorded' does not mean 'kept burning'."]
    ];
    $("stops").innerHTML = boxes.map(function (b) {
      return '<div class="card"><b class="big">' + esc(b[0]) + "</b><p>" + esc(b[1]) + "</p></div>";
    }).join("");
  }

  // ---- AI insights (S4 data, S3 §6) ---------------------------------------------
  var insights = null, invById = {};
  function badge(ev) { return '<span class="badge ' + esc(ev) + '" title="Evidence grade relied on">Evidence ' + esc(ev) + "</span>"; }
  function sourcesHtml(list) {
    return '<p class="sources">Sources: ' + (list || []).map(function (id) {
      var v = invById[id];
      return v ? '<a href="' + esc(v.doi_url) + '" target="_blank" rel="noopener" title="' + esc(v.title) + '">' + esc(id) + "</a>" : esc(id);
    }).join(", ") + "</p>";
  }
  function renderInsights() {
    $("global-cards").innerHTML = (insights.global || []).map(function (g) {
      return '<article class="card" id="insight-' + esc(g.id) + '"><h4>' + esc(g.title) + badge(g.evidence) + "</h4><p>" + esc(g.text) + "</p>" + sourcesHtml(g.sources) + "</article>";
    }).join("");
    $("qa-list").innerHTML = (insights.qa || []).map(function (q) {
      return "<details><summary>" + esc(q.q) + "</summary><p>" + esc(q.a) + " " + badge(q.evidence) + "</p>" + sourcesHtml(q.sources) + "</details>";
    }).join("");
    $("ai-section").hidden = false;
  }
  function renderInvCard(id) {
    var card = $("inv-card");
    var e = insights && insights.investigations && insights.investigations[id];
    if (!id || !e) { card.hidden = true; card.innerHTML = ""; return; }
    var v = invById[id] || {};
    card.innerHTML = "<h3>" + esc(v.acronym || id) + ' <span class="psi muted">' + esc(id) + "</span></h3>" +
      '<p class="ai-label">AI-generated from the frozen dataset · numbers machine-checked · reviewed by the team</p>' +
      "<dl><dt>What it measured</dt><dd>" + esc(e.summary) + "</dd>" +
      "<dt>Fire-safety relevance</dt><dd>" + esc(e.fire_safety_relevance) + "</dd>" +
      "<dt>Limits of this table</dt><dd>" + esc(e.limits) + "</dd></dl>" +
      '<p class="sources"><a href="' + esc(v.doi_url) + '" target="_blank" rel="noopener">Dataset DOI</a></p>';
    card.hidden = false;
  }
  function loadInsights() {
    return fetch("data/insights.json").then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    }).then(function (d) {
      if (!d || !Array.isArray(d.global)) throw new Error("unexpected format");
      insights = d; renderInsights();
    }).catch(function (e) {
      insights = null;
      $("card-hint").hidden = true;
      if (typeof console !== "undefined") console.warn("[app] AI insights not shown:", e.message);
    });
  }

  // ---- "Ask the evidence" hook (S4B; logic in js/rag.js) -------------------------
  var ASK_EXAMPLES = ["clean tests in the Moon habitat box", "solid fuel tests above 30% oxygen",
    "FLEX tests at 30% oxygen or more", "what does not recorded mean"];
  function initAsk() {
    var sec = $("ask-evidence");
    if (sec.dataset.enabled !== "true") return;
    var s = document.createElement("script");
    s.src = "js/rag.js";
    s.onload = function () {
      fetch("data/rag_corpus.json").then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
        .then(function (corpus) {
          if (!window.RAG) throw new Error("RAG missing");
          return Promise.resolve(window.RAG.init(app, corpus)).then(function (ok) {
            if (ok === false) throw new Error("RAG.init failed");
            ASK_EXAMPLES.forEach(function (t) {
              var b = document.createElement("button"); b.type = "button"; b.className = "btn"; b.textContent = t;
              b.addEventListener("click", function () { $("ask-input").value = t; ask(t); });
              $("ask-examples").appendChild(b);
            });
            $("ask-form").addEventListener("submit", function (e) { e.preventDefault(); ask($("ask-input").value); });
            sec.hidden = false; $("ai-section").hidden = false;
          });
        }).catch(function (e) { console.warn("[app] Ask the evidence disabled:", e.message); });
    };
    s.onerror = function () { console.warn("[app] Ask the evidence disabled: js/rag.js not found"); };
    document.body.appendChild(s);
  }
  function ask(q) {
    if (!q || !q.trim()) return;
    var res;
    try { res = window.RAG.ask(q); } catch (e) { console.warn("[app] RAG.ask failed:", e.message); return; }
    var rb = $("ask-rows"), pb = $("ask-passages"), nb = $("ask-notes");
    if (res.rows && res.rows.count != null) {
      var outs = Object.keys(res.rows.by_outcome || {}).sort(function (a, b) { return res.rows.by_outcome[b] - res.rows.by_outcome[a]; })
        .map(function (k) { return '<span class="item"><span class="swatch" style="background:' + (OUT[k] ? OUT[k].color : "#999") + '"></span>' + esc(OUT[k] ? OUT[k].label : k) + " " + res.rows.by_outcome[k] + "</span>"; }).join("");
      var onMap = countPlotted(res.filter);
      rb.innerHTML = "<h4>Matching tests: " + fmtInt(res.rows.count) + "</h4>" + '<div class="legend">' + outs + "</div>" +
        '<p class="muted small">' + fmtInt(onMap) + " of them can be placed on the map.</p>" +
        (res.rows.count ? '<button type="button" class="btn" id="ask-show">Show on map</button>' : "");
      rb.hidden = false;
      var btn = $("ask-show");
      if (btn) btn.addEventListener("click", function () { applyFilter(res.filter); $("map-section").scrollIntoView({ behavior: "smooth", block: "start" }); });
    } else { rb.hidden = true; rb.innerHTML = ""; }
    var ps = res.passages || [];
    pb.innerHTML = ps.length ? "<h4>Related findings</h4>" + ps.map(function (p) {
      return "<p><b>" + esc(p.title) + "</b>" + badge(p.evidence) + "<br>" + esc(p.text) + "</p>";
    }).join("") : "";
    pb.hidden = !ps.length;
    var ns = res.notes || [];
    nb.innerHTML = ns.map(function (n) { return '<div class="note-item">' + esc(n) + "</div>"; }).join("");
    nb.hidden = !ns.length;
  }

  // ---- footer (S3 §7) -------------------------------------------------------------
  function renderFooter() {
    $("footer").innerHTML =
      "<p>Data: NASA Physical Sciences Informatics (PSI); dataset DOIs are linked in the ranking table. CC0-1.0 except PSI-10, whose license is not stated.</p>" +
      "<p>Data version " + esc(app.meta.data_version) + " · source sha256 " + esc(String(app.meta.source_sha256).slice(0, 12)) +
      ' · <a href="' + REPO_URL + '" target="_blank" rel="noopener">Code and data on GitHub</a></p>' +
      "<p><b>Not an official NASA product. Not a safety assessment.</b></p>";
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
      renderInvCard(same ? null : id);
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
    app.investigations.forEach(function (v) { invById[v.psi_id] = v; });
    computeDisplayPositions();
    renderCounters();
    buildFilters();
    renderLegend();
    renderRanking();
    renderStops();
    renderFooter();
    window.App = { applyFilter: applyFilter, countPlotted: countPlotted, getState: function () { return JSON.parse(JSON.stringify(state)); } };
    loadInsights().then(initAsk);
    if (typeof Plotly === "undefined") return fail("The chart library could not be loaded. Check your connection and reload.");
    update();
    if (window.matchMedia) window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", renderPlot);
  }).catch(function (e) { fail("Data could not be loaded (" + e.message + "). Open this page through a web server, not as a local file."); });
})();
