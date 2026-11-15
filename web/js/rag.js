/* rag.js – "Ask the evidence" hybrid retrieval (S4B), Space Chillers.
 *
 * Hybrid = (1) rule-based structured parse of the question -> exact filter + counts over
 * experiments[], plus (2) BM25 keyword search over reviewed text chunks.
 * Runs fully in the browser. No server, no API key, no text generation at query time.
 *
 *   await RAG.init(appData, corpus)   // once
 *   const res = RAG.ask("solid fuel tests above 25% oxygen")   // sync, never throws
 *
 * Also loadable in Node (module.exports) for the evaluation script.
 */
(function (root) {
  "use strict";

  var PSI_TO_ATM = 1 / 14.696;
  var UNIT_TO_ATM = { psi: PSI_TO_ATM, atm: 1, kpa: 1 / 101.325, bar: 1 / 1.01325, mmhg: 1 / 760, torr: 1 / 760 };
  var EPS = 5e-4; // 10.2 psi = 0.69407 atm must include rows stored as 0.694
  var NUM = "(\\d+(?:\\.\\d+)?)";
  var GT = "(?:above|over|more than|greater than|higher than|exceeding|at least|>=|≥|>)";
  var LT = "(?:below|under|less than|lower than|at most|up to|<=|≤|<)";
  var O2W = "(?:oxygen|o2|o₂)";
  var UNIT = "(psi|atm|kpa|bar|mmhg|torr)";

  var state = { ready: false, rows: [], chunks: [], invs: [], aliases: [], idf: {}, avgdl: 1, solidMaxO2: null };

  // ---------------------------------------------------------------- vocab
  var OUTCOME_RULES = [ // order matters: specific first; matched text is removed
    ["no_hot_ignition", /\bno hot (?:flame )?ignition\b|\bhot flame (?:did not|didn't|failed to) ignite\b/],
    ["no_ignition", /\b(?:did not|didn't|failed to|not) ignite\b|\bno ignition\b|\bnever ignited\b/],
    ["cool_flame", /\bcool[- ]flames?\b/],
    ["droplet_disruption", /\bdisrupt(?:ion|ions|ed|s)?\b|\bbroke apart\b/],
    ["blowoff", /\bblow(?:n|s)?[- ]?(?:off|out)\b|\bblew (?:off|out)\b|\bblowoffs?\b/],
    ["extinguished", /\bextinguish(?:ed|es)?\b|\bwent out\b|\bflame ?out\b|\bself[- ]extinguish\w*/],
    ["sustained", /\bsustain(?:ed|s)?\b|\bkept burning\b|\bburn(?:ed|t)? to completion\b|\bkeep burning\b/],
    ["unknown", /\b(?:outcome )?not recorded\b|\bunknown outcomes?\b|\bno (?:recorded )?outcome\b/]
  ];
  var PHASE_RULES = [
    ["solid", /\bsolids?\b|\bsolid[- ]fuels?\b/],
    ["liquid", /\bliquids?\b|\bdroplets?\b/],
    ["gas", /\bgas(?:es|eous)?\b/]
  ];
  // fuel term -> regex tested against the row's fuel string (word boundaries avoid ethane ⊂ methane)
  var FUELS = {
    pmma: /\bpmma\b|acrylic|plexiglas/i, heptane: /\bheptane\b/i, methanol: /\bmethanol\b/i,
    ethanol: /\bethanol\b/i, ethylene: /\bethylene\b|\bc2h4\b/i, butane: /\bbutane\b/i,
    ethane: /\bethane\b/i, propane: /\bpropane\b|\bc3h8\b/i, methane: /\bmethane\b|\bch4\b/i,
    propylene: /\bpropylene\b/i, sibal: /\bsibal\b/i, silicone: /\bsilicone\b/i, cotton: /\bcotton\b/i,
    fiberglass: /fiberglass/i, dodecane: /dodecane|\bc12h26\b/i, octane: /octane/i, decane: /\bdecane\b/i,
    nomex: /\bnomex\b/i, kapton: /\bkapton\b/i, delrin: /\bdelrin\b/i, ultem: /\bultem\b/i
  };
  var FUEL_QUERY = { // query words -> fuel term
    pmma: "pmma", acrylic: "pmma", plexiglas: "pmma", plexiglass: "pmma", heptane: "heptane",
    methanol: "methanol", ethanol: "ethanol", ethylene: "ethylene", c2h4: "ethylene", butane: "butane",
    ethane: "ethane", propane: "propane", c3h8: "propane", methane: "methane", ch4: "methane",
    propylene: "propylene", sibal: "sibal", silicone: "silicone", cotton: "cotton", fiberglass: "fiberglass",
    dodecane: "dodecane", octane: "octane", isooctane: "octane", decane: "decane", nomex: "nomex",
    kapton: "kapton", delrin: "delrin", ultem: "ultem"
  };
  var SAFETY_RE = /\bsafe(?:ly|r|st)?\b|\bdanger(?:ous)?\b|\bhazard(?:ous)?\b|\bshould (?:we|i|they)\b|\bwill (?:it|they)\b|\bwould (?:it|they)\b|\bpredict\w*\b|\brisky?\b/;
  var EXPLAIN_RE = /^\s*(?:why|how (?:is|are|was|were|does|do)|explain)\b|\bwhat (?:does|do) .+ mean\b|\bmeaning of\b|\bdefin(?:e|ition)\b|\bwhat is (?:the |a )?(?:grade|evidence grade|score|moon (?:habitat )?box)\b/;

  var STOP = ("a an the of in on at to for from by with and or is are was were be been do does did " +
    "what which who how why that this these those it its as any all there their than then into about " +
    "show me list give find tests test rows row data").split(" ");
  var STOPSET = {}; STOP.forEach(function (w) { STOPSET[w] = 1; });
  var SYN = { oxygen: ["o2"], o2: ["oxygen"], moon: ["lunar", "habitat"], lunar: ["moon", "habitat"],
    habitat: ["moon", "lunar"], material: ["solid"], droplet: ["liquid"], liquid: ["droplet"],
    solid: ["material"], artemi: ["moon"] };

  // ---------------------------------------------------------------- helpers
  function num(x) { return x === null || x === undefined || isNaN(x) ? null : Number(x); }
  function uniq(a) { return a.filter(function (x, i) { return a.indexOf(x) === i; }); }
  function esc(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
  function round(x, n) { var p = Math.pow(10, n || 1); return Math.round(x * p) / p; }
  function countBy(rows, key) {
    var o = {}; rows.forEach(function (r) { var k = r[key] == null ? "null" : r[key]; o[k] = (o[k] || 0) + 1; }); return o;
  }
  function emptyParsed() {
    return { phase: [], o2_min: null, o2_max: null, p_max_atm: null, p_min_atm: null,
      psi: [], outcome: [], grade: [], box: null, fuel: null };
  }

  function stem(w) {
    if (w.length > 5 && /ing$/.test(w)) return w.slice(0, -3);
    if (w.length > 4 && /ed$/.test(w)) return w.slice(0, -2);
    if (w.length > 3 && /s$/.test(w) && !/(ss|us|is)$/.test(w)) return w.slice(0, -1);
    return w;
  }
  function tokens(text) {
    var t = String(text).toLowerCase().replace(/o₂/g, "o2").replace(/'/g, "").split(/[^a-z0-9]+/);
    var out = [];
    t.forEach(function (w) { if (w && !STOPSET[w]) out.push(stem(w)); });
    return out;
  }

  // Acronym / id aliases, longest first, so "FLEX-2" wins over "FLEX" and "CFI-G" over "CFI".
  function buildAliases(invs) {
    var al = [];
    function add(name, ids, cs) { al.push({ name: name, ids: ids, re: new RegExp("(?:^|[^a-z0-9-])(" + esc(name) + ")(?![a-z0-9]|-[a-z0-9])", cs ? "" : "i"), cs: cs }); }
    var families = {};
    invs.forEach(function (v) {
      var id = v.psi_id;
      add(id, [id], false);
      add(id.replace("-", " "), [id], false);
      if (v.acronym) {
        v.acronym.split(/\s*\/\s*/).forEach(function (part) {
          part = part.trim();
          if (!part) return;
          var cs = /^(SAME|ASE|SLICE|SAME-R)$/.test(part); // ordinary English words
          add(part, [id], cs);
          var words = part.split(/\s+/);
          if (words.length > 1 && words[0] === "ACME") add(words.slice(1).join(" "), [id], /^(SAME|ASE|SLICE)$/.test(words.slice(1).join(" ")));
        });
      }
      if (v.family && v.tier === "tier1") (families[v.family] = families[v.family] || []).push(id);
    });
    Object.keys(families).forEach(function (f) { if (families[f].length > 1) add(f, families[f], false); });
    // Roman / digit variants for SAFFIRE
    [["SAFFIRE-1", "PSI-98"], ["SAFFIRE-2", "PSI-99"], ["SAFFIRE-3", "PSI-100"], ["SAFFIRE 1", "PSI-98"],
     ["SAFFIRE 2", "PSI-99"], ["SAFFIRE 3", "PSI-100"], ["BASS 2", "PSI-25"], ["FLEX 2", "PSI-68"],
     ["Cool Flames Investigation with Gases", "PSI-159"], ["Cool Flames Investigation", "PSI-39"],
     ["Burning Rate Emulator", "PSI-20"], ["Flame Design", "PSI-10"]].forEach(function (x) {
      if (invs.some(function (v) { return v.psi_id === x[1]; })) add(x[0], [x[1]], false);
    });
    al.sort(function (a, b) { return b.name.length - a.name.length; });
    return al;
  }

  // ---------------------------------------------------------------- parser
  function parse(question) {
    var p = emptyParsed();
    var raw = " " + String(question || "") + " ";
    var q = raw.toLowerCase().replace(/o₂/g, "o2").replace(/\s+/g, " ");
    var origCase = raw.replace(/\s+/g, " ");

    // 1. investigations (consume matched text so "FLEX" is not also read as something else)
    state.aliases.forEach(function (a) {
      var src = a.cs ? origCase : q;
      var m = src.match(a.re);
      if (m) {
        a.ids.forEach(function (id) { if (p.psi.indexOf(id) < 0) p.psi.push(id); });
        var re = new RegExp(esc(m[1]), a.cs ? "g" : "gi");
        q = q.replace(re, " ");
        origCase = origCase.replace(re, " ");
      }
    });

    // 2. pressure (number + unit), before oxygen so "10.2 psi" is never read as O2
    var mm;
    var reRange = new RegExp("between " + NUM + "\\s*(?:" + UNIT + ")?\\s*(?:and|-|to)\\s*" + NUM + "\\s*" + UNIT, "g");
    while ((mm = reRange.exec(q))) {
      var u = UNIT_TO_ATM[mm[4]];
      p.p_min_atm = round(Number(mm[1]) * UNIT_TO_ATM[mm[2] || mm[4]], 4);
      p.p_max_atm = round(Number(mm[3]) * u, 4);
    }
    q = q.replace(reRange, " ");
    var reP = new RegExp("(" + GT + "|" + LT + "|at|of|=)?\\s*" + NUM + "\\s*" + UNIT + "\\b(\\s*or (?:more|higher|above|less|lower|below))?", "g");
    q = q.replace(reP, function (all, cmp, n, unit, tail) {
      var v = round(Number(n) * UNIT_TO_ATM[unit], 4);
      cmp = (cmp || "").trim(); tail = (tail || "").trim();
      if (new RegExp("^" + GT + "$").test(cmp) || /more|higher|above/.test(tail)) p.p_min_atm = v;
      else if (new RegExp("^" + LT + "$").test(cmp) || /less|lower|below/.test(tail)) p.p_max_atm = v;
      else { p.p_min_atm = round(v * 0.95, 4); p.p_max_atm = round(v * 1.05, 4); }
      return " ";
    });

    // 2b. fuel mixture percentage ("50% butane") – consumed so it is not read as oxygen
    q = q.replace(/(\d+(?:\.\d+)?)\s*%\s*([a-z0-9]+)/g, function (all, n, w) {
      if (!FUEL_QUERY[w]) return all;
      p.fuel = n + "% " + FUEL_QUERY[w];
      return " ";
    });

    // 3. oxygen
    var o2Patterns = [
      [new RegExp("between " + NUM + "\\s*%?\\s*(?:and|-|to)\\s*" + NUM + "\\s*%?\\s*" + O2W + "?", "g"), "range"],
      [new RegExp(O2W + "\\s*(?:of|at|is|level|concentration)?\\s*" + GT + "\\s*" + NUM + "\\s*%?", "g"), "min"],
      [new RegExp(O2W + "\\s*(?:of|at|is|level|concentration)?\\s*" + LT + "\\s*" + NUM + "\\s*%?", "g"), "max"],
      [new RegExp(NUM + "\\s*%?\\s*" + O2W + "?\\s*(?:or (?:more|higher|above|greater)|and (?:above|up|higher)|\\+)", "g"), "min"],
      [new RegExp(NUM + "\\s*%?\\s*" + O2W + "?\\s*(?:or (?:less|lower|below)|and (?:below|under))", "g"), "max"],
      [new RegExp(GT + "\\s*" + NUM + "\\s*(?:%\\s*" + O2W + "?|" + O2W + ")", "g"), "min"],
      [new RegExp(LT + "\\s*" + NUM + "\\s*(?:%\\s*" + O2W + "?|" + O2W + ")", "g"), "max"],
      [new RegExp("(?:at|with|of)?\\s*" + NUM + "\\s*%\\s*" + O2W, "g"), "at"],
      [new RegExp(O2W + "\\s*(?:of|at|=|is)?\\s*" + NUM + "\\s*%?", "g"), "at"]
    ];
    o2Patterns.forEach(function (pat) {
      q = q.replace(pat[0], function (all, a, b) {
        if (pat[1] === "range") { p.o2_min = Number(a); p.o2_max = Number(b); }
        else if (pat[1] === "min") p.o2_min = Number(a);
        else if (pat[1] === "max") p.o2_max = Number(a);
        else { p.o2_min = Number(a) - 0.5; p.o2_max = Number(a) + 0.5; }
        return " ";
      });
    });

    // 4. outcomes ("Cool Flames Investigation" already consumed as PSI-39 above)
    OUTCOME_RULES.forEach(function (r) {
      if (r[1].test(q)) { p.outcome.push(r[0]); q = q.replace(r[1], " "); }
    });
    // 5. phase
    PHASE_RULES.forEach(function (r) { if (r[1].test(q)) p.phase.push(r[0]); });
    if (p.outcome.indexOf("droplet_disruption") >= 0 && p.phase.length === 0) { /* implied liquid; no extra filter needed */ }
    // 6. grade
    var g = q.match(/\b(?:grade|class|evidence)\s+([abcd])\b/g);
    if (g) g.forEach(function (x) { var c = x.slice(-1).toUpperCase(); if (p.grade.indexOf(c) < 0) p.grade.push(c); });
    if (/\bclean(?:est)?\b|\bbest evidence\b|\bhighest quality\b/.test(q) && p.grade.indexOf("A") < 0) p.grade.push("A");
    // 7. Moon box
    if (/\bmoon\b|\blunar\b|\bhabitat\b|\bartemis\b|\bmoon ?base\b/.test(q)) p.box = /\bedge\b/.test(q) ? "edge" : "in_box";
    else if (/\bnear[- ]miss/.test(q)) p.box = "near_miss";
    // 8. fuel
    var words = q.split(/[^a-z0-9]+/);
    for (var i = 0; !p.fuel && i < words.length; i++) { if (FUEL_QUERY[words[i]]) p.fuel = FUEL_QUERY[words[i]]; }
    return p;
  }

  function fuelRegex(f) {
    var m = /^(\d+(?:\.\d+)?)% (\w+)$/.exec(f);
    if (m) return new RegExp("(?:^|[^0-9.])" + esc(m[1]) + "\\s*%\\s*" + esc(m[2]) + "\\b", "i");
    return FUELS[f];
  }

  function hasFilter(p) {
    return p.phase.length || p.psi.length || p.outcome.length || p.grade.length || p.box || p.fuel ||
      p.o2_min !== null || p.o2_max !== null || p.p_min_atm !== null || p.p_max_atm !== null;
  }

  // ---------------------------------------------------------------- filtering
  function matchCategorical(r, p) {
    if (p.phase.length && p.phase.indexOf(r.phase) < 0) return false;
    if (p.psi.length && p.psi.indexOf(r.psi) < 0) return false;
    if (p.fuel && !(r.fuel && fuelRegex(p.fuel).test(r.fuel))) return false;
    return true;
  }
  function matchO2(r, p) {
    if (p.o2_min === null && p.o2_max === null) return true;
    if (r.o2_max === null || r.o2_min === null) return false;
    if (p.o2_min !== null && !(r.o2_max >= p.o2_min)) return false;
    if (p.o2_max !== null && !(r.o2_min <= p.o2_max)) return false;
    return true;
  }
  function matchP(r, p) {
    if (p.p_min_atm === null && p.p_max_atm === null) return true;
    if (r.p === null) return false;
    if (p.p_min_atm !== null && !(r.p >= p.p_min_atm - EPS)) return false;
    if (p.p_max_atm !== null && !(r.p <= p.p_max_atm + EPS)) return false;
    return true;
  }
  function matchRest(r, p) {
    if (p.outcome.length && p.outcome.indexOf(r.outcome) < 0) return false;
    if (p.grade.length && p.grade.indexOf(r.grade) < 0) return false;
    if (p.box && r.box !== p.box) return false;
    return true;
  }
  function filterRows(p, skip) {
    skip = skip || {};
    return state.rows.filter(function (r) {
      return matchCategorical(r, p) && (skip.o2 || matchO2(r, p)) && (skip.p || matchP(r, p)) && (skip.rest || matchRest(r, p));
    });
  }

  function describe(p) {
    var parts = [];
    if (p.phase.length) parts.push(p.phase.join("/") + "-fuel");
    if (p.fuel) parts.push(p.fuel);
    if (p.psi.length) parts.push(p.psi.join(", "));
    return parts.length ? parts.join(" ") + " tests" : "tests";
  }

  // ---------------------------------------------------------------- notes (honesty rules)
  function buildNotes(p, rows, question, forced) {
    var notes = [];
    var M = rows.length;
    var catalog = p.psi.filter(function (id) {
      return state.invs.some(function (v) { return v.psi_id === id && v.tier !== "tier1"; });
    });
    if (catalog.length) {
      notes.push(catalog.join(", ") + (catalog.length > 1 ? " are" : " is") + " catalogued but not in the harmonized test table, so no rows are counted.");
      catalog.forEach(function (id) { forced.push("cat-" + id); });
    }
    if (M === 0 && catalog.length === p.psi.length && catalog.length) {
      // already explained above
    } else if (M === 0) {
      if (p.o2_min !== null) {
        var pool = filterRows(p, { o2: true }).filter(function (r) { return r.o2_max !== null; });
        if (pool.length) {
          var mx = Math.max.apply(null, pool.map(function (r) { return r.o2_max; }));
          notes.push("No rows match. Highest O2 among " + describe(p) + " is " + round(mx, 1) + " %.");
        } else notes.push("No rows match. No " + describe(p) + " have a recorded oxygen value under the other conditions.");
      } else if (p.p_max_atm !== null) {
        var poolp = filterRows(p, { p: true }).filter(function (r) { return r.p !== null; });
        if (poolp.length) {
          var mn = Math.min.apply(null, poolp.map(function (r) { return r.p; }));
          notes.push("No rows match. Lowest pressure among " + describe(p) + " is " + round(mn, 3) + " atm (" + round(mn / PSI_TO_ATM, 1) + " psi).");
        } else notes.push("No rows match. No " + describe(p) + " have a recorded pressure under the other conditions.");
      } else if (p.fuel && !state.rows.some(function (r) { return r.fuel && fuelRegex(p.fuel).test(r.fuel); })) {
        notes.push("No rows match. No harmonized PSI test lists " + p.fuel + " as fuel or material.");
      } else {
        notes.push("No rows match these conditions.");
      }
      if (p.phase.indexOf("solid") >= 0 && (p.o2_min !== null || p.box)) forced.push("limit-solid-o2");
    }
    var nB = rows.filter(function (r) { return r.grade === "B"; }).length;
    if (nB) { notes.push(nB + " of " + M + " rows are grade B: oxygen is the burner oxidizer fraction, not cabin air."); forced.push("limit-oxidizer"); }
    var pa = rows.filter(function (r) { return r.p_assumed; });
    if (pa.length) {
      notes.push(pa.length + " of " + M + " rows use an assumed or report-mapped pressure, not a measured one.");
      var psis = uniq(pa.map(function (r) { return r.psi; }));
      if (psis.indexOf("PSI-20") >= 0) forced.push("limit-psi20");
      if (psis.indexOf("PSI-25") >= 0) forced.push("limit-psi25");
    }
    var nU = rows.filter(function (r) { return r.outcome === "unknown"; }).length;
    if (M && nU / M > 0.5) { notes.push("Outcome not recorded for " + nU + " of " + M + " rows."); forced.push("limit-not-recorded"); }
    var nLow = rows.filter(function (r) { return r.conf === "low"; }).length;
    if (nLow) notes.push(nLow + " of " + M + " outcomes are low confidence (parsed from free text or reviewed by hand).");
    var nDup = rows.filter(function (r) { return r.dup; }).length;
    if (nDup) notes.push(nDup + " of " + M + " rows are exact duplicates in the source file (kept, flagged).");
    if (rows.some(function (r) { return r.psi === "PSI-10"; })) notes.push("PSI-10 has no stated license; cite DOI 10.60555/w4zy-bt45.");
    return notes;
  }

  // ---------------------------------------------------------------- BM25
  var K1 = 1.5, B = 0.75;
  function indexChunks(chunks) {
    var df = {}, total = 0;
    chunks.forEach(function (c) {
      c._tok = tokens(c.title + " " + c.text + " " + (c.psi || []).join(" "));
      c._tf = {};
      c._tok.forEach(function (t) { c._tf[t] = (c._tf[t] || 0) + 1; });
      Object.keys(c._tf).forEach(function (t) { df[t] = (df[t] || 0) + 1; });
      total += c._tok.length;
    });
    var N = chunks.length;
    state.idf = {};
    Object.keys(df).forEach(function (t) { state.idf[t] = Math.log(1 + (N - df[t] + 0.5) / (df[t] + 0.5)); });
    state.avgdl = total / Math.max(1, N);
  }
  function bm25(qTok, c) {
    var s = 0, dl = c._tok.length;
    qTok.forEach(function (t) {
      var f = c._tf[t]; if (!f) return;
      s += state.idf[t] * (f * (K1 + 1)) / (f + K1 * (1 - B + B * dl / state.avgdl));
    });
    return s;
  }
  function expand(question) {
    var q = String(question).toLowerCase().replace(/went out/g, "went out extinguished").replace(/kept burning/g, "kept burning sustained");
    var t = tokens(q), out = t.slice();
    t.forEach(function (w) { (SYN[w] || []).forEach(function (s) { out.push(stem(s)); }); });
    return uniq(out);
  }
  function search(question, p, forced, rowPsi, priority) {
    var qTok = expand(question);
    rowPsi = rowPsi || [];
    var scored = state.chunks.map(function (c) {
      var s = bm25(qTok, c);
      if (s > 0 && p.psi.length && (c.psi || []).some(function (x) { return p.psi.indexOf(x) >= 0; })) s *= 1.5;
      if (s > 0 && rowPsi.length && (c.psi || []).some(function (x) { return rowPsi.indexOf(x) >= 0; })) s *= 1.3;
      if (s > 0 && p.box && c.type === "global") s *= 1.3;
      return { c: c, s: s };
    }).sort(function (a, b) { return b.s - a.s; });
    var top = scored.length ? scored[0].s : 0;
    var thr = Math.max(0.5, 0.3 * top);
    var out = [], seen = {};
    function push(c, s, isForced) {
      if (seen[c.id] || out.length >= 3) return;
      seen[c.id] = 1;
      out.push({ id: c.id, title: c.title, text: c.text, evidence: c.evidence, psi: c.psi || [], type: c.type,
        score: round(s, 3), forced: !!isForced });
    }
    // Forced limit chunks first, but leave room for the best BM25 hit.
    var byId = {}; state.chunks.forEach(function (c) { byId[c.id] = c; });
    var bestBm = scored.length && scored[0].s >= thr ? scored[0] : null;
    if (priority && byId[priority]) push(byId[priority], 0, true);   // safety disclaimer always first
    if (bestBm) push(bestBm.c, bestBm.s, false);                      // then the best text match
    uniq(forced).forEach(function (id) { if (byId[id] && out.length < 2 + (bestBm ? 0 : 1)) push(byId[id], 0, true); });
    scored.forEach(function (x) { if (x.s >= thr) push(x.c, x.s, false); });
    return out;
  }

  // ---------------------------------------------------------------- public API
  function sampleRows(rows) {
    var order = { A: 0, B: 1, C: 2, D: 3 };
    return rows.slice().sort(function (a, b) {
      return (order[a.grade] - order[b.grade]) || (a.psi < b.psi ? -1 : a.psi > b.psi ? 1 : 0) || a.row - b.row;
    }).slice(0, 10);
  }

  function ask(question) {
    var res = { parsed: emptyParsed(), rows: { count: null, total_considered: null, by_outcome: {}, by_grade: {}, by_psi: {}, sample: [] },
      passages: [], notes: [], filter: emptyParsed() };
    try {
      if (!state.ready) { res.notes.push("Search is not ready yet."); return res; }
      question = String(question || "").slice(0, 500);
      var p = parse(question);
      res.parsed = p;
      res.filter = JSON.parse(JSON.stringify(p));
      var forced = [], rowPsi = [], priority = null;
      var explain = EXPLAIN_RE.test(question.toLowerCase());
      if (hasFilter(p) && !explain) {
        var rows = filterRows(p);
        res.rows = {
          count: rows.length,
          total_considered: state.rows.filter(function (r) { return matchCategorical(r, p); }).length,
          by_outcome: countBy(rows, "outcome"), by_grade: countBy(rows, "grade"), by_psi: countBy(rows, "psi"),
          sample: sampleRows(rows)
        };
        rowPsi = Object.keys(res.rows.by_psi);
        res.notes = buildNotes(p, rows, question, forced);
      }
      if (SAFETY_RE.test(question.toLowerCase())) {
        res.notes.unshift("This tool reports what was tested; it does not assess safety or predict untested conditions.");
        priority = "limit-scope";
      }
      res.passages = search(question, p, forced, rowPsi, priority);
    } catch (e) {
      res.notes.push("The question could not be processed.");
      if (typeof console !== "undefined") console.warn("[RAG]", e);
    }
    return res;
  }

  function init(appData, corpus) {
    try {
      state.invs = appData.investigations || [];
      state.rows = (appData.experiments || []).map(function (r) {
        return Object.assign({}, r, { o2_min: num(r.o2_min), o2_max: num(r.o2_max), p: num(r.p) });
      });
      state.aliases = buildAliases(state.invs);
      SOLID_MAX = appData.facts && appData.facts.solid ? appData.facts.solid.max_o2_pct : null;
      state.chunks = (corpus && corpus.chunks || []).map(function (c) { return Object.assign({}, c); });
      indexChunks(state.chunks);
      state.ready = true;
    } catch (e) {
      state.ready = false;
      if (typeof console !== "undefined") console.warn("[RAG] init failed", e);
    }
    return Promise.resolve(state.ready);
  }

  // ---------------------------------------------------------------- nearest tests ("what-if", not a simulation)
  // Distance = |ΔO₂|/5 + |log10(p/p_row)|/0.15 (5 O₂ points ≈ 0.15 decades), plottable rows only.
  // "exact" = rows within ±2 % O₂ and ±1 psi (same window as js/journey.js). Never predicts anything.
  var WIN_O2 = 2, WIN_PSI = 1, PSI_ATM = 14.696, SOLID_MAX = null;
  function nearest(opts) {
    var res = { exact: 0, nearest: [], outcome_counts: {}, grade_counts: {}, phase_counts: {}, by_psi: {},
      nearest_distance: null, notes: [] };
    try {
      opts = opts || {};
      var o2 = num(opts.o2), p = num(opts.p_atm), k = Math.max(1, Math.min(200, opts.k || 25));
      if (o2 === null || p === null || p <= 0) { res.notes.push("Give an oxygen percentage and a pressure above 0 atm."); return res; }
      var phase = opts.phase || null;
      var pool = state.rows.filter(function (r) {
        return r.plottable && r.o2_max !== null && r.o2_min !== null && r.p !== null && (!phase || r.phase === phase);
      });
      var lo = o2 - WIN_O2, hi = o2 + WIN_O2, pLo = p - WIN_PSI / PSI_ATM, pHi = p + WIN_PSI / PSI_ATM;
      var win = pool.filter(function (r) { return r.o2_max >= lo && r.o2_min <= hi && r.p >= pLo - EPS && r.p <= pHi + EPS; });
      res.exact = win.length;
      var scored = pool.map(function (r) {
        var d = Math.abs(r.o2_max - o2) / 5 + Math.abs(Math.log10(Math.max(r.p, 0.01) / p)) / 0.15;
        return { r: r, d: d };
      }).sort(function (a, b) { return a.d - b.d; }).slice(0, k);
      res.nearest = scored.map(function (x) { return Object.assign({ distance: round(x.d, 3) }, x.r); });
      res.nearest_distance = scored.length ? round(scored[0].d, 3) : null;
      var basis = win.length ? win : res.nearest;
      res.outcome_counts = countBy(basis, "outcome"); res.grade_counts = countBy(basis, "grade");
      res.phase_counts = countBy(basis, "phase"); res.by_psi = countBy(basis, "psi");
      if (win.length) {
        res.notes.push(win.length + " tests within ±" + WIN_O2 + " % O₂ and ±" + WIN_PSI + " psi of this point.");
      } else if (scored.length) {
        var n = scored[0].r;
        res.notes.push("No PSI test within ±" + WIN_O2 + " % O₂ and ±" + WIN_PSI + " psi of this point. Nearest: " + n.psi +
          " test " + n.test + " at " + round(n.o2_max, 1) + " % O₂ / " + round(n.p * PSI_ATM, 1) + " psi (grade " + n.grade +
          ", outcome " + n.outcome + ").");
      }
      if (basis.some(function (r) { return r.p_assumed; })) res.notes.push("Some of these rows use an assumed or report-mapped pressure.");
      if (phase === "solid" && SOLID_MAX !== null && o2 > SOLID_MAX) res.notes.push("No solid-fuel test above " + SOLID_MAX + " % O₂ in the PSI tables.");
    } catch (e) {
      res.notes.push("The point could not be processed.");
    }
    return res;
  }

  var RAG = { init: init, ask: ask, nearest: nearest, _parse: function (q) { return parse(q); } };
  if (typeof module !== "undefined" && module.exports) module.exports = RAG;
  root.RAG = RAG;
})(typeof window !== "undefined" ? window : globalThis);
