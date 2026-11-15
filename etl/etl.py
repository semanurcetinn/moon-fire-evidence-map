"""ETL – YAMA v2. Config önceliği: column_map.final.yaml > column_map.verified.yaml > column_map.yaml (common.config_path).
Değer düzeltme/tahmin YOK; ham değer raw_json'da aynen; yalnız bayrak/not/türetilmiş kolon eklenir.
Yeni investigation = yaml'a yeni blok. Önceki sürüm: ETL/backup/etl.py.20261114
v2 değişiklikleri: birim-önce ayrıştırma (1.1), kolon takma adları (1.2), o2_not_in_table (1.3), is_duplicate (1.4),
genişletilmiş outcome kuralları (2.x), bileşik join + tarih normalizasyonu (3.1), O2 açılımı + rapor basınç eşlemesi (3.2),
row_flags / special_tokens / geometry_note_suffix (3.3–3.6), evidence_grade (4), yeni Moon box raporu (5).
"""
import sys, re, json, sqlite3, datetime, warnings
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
import pandas as pd
from common import *
warnings.filterwarnings("ignore")

CFG = load_config()
HF = CFG["harmonized_fields"]
EXTRA = CFG.get("extra_fields") or ["o2_basis", "pressure_atm_assumed", "variant", "investigation_doi", "license"]
QLOG = []   # (psi_id, test_id, source_file, source_row, flag, detail)
OUTCOMES = {"extinguished", "blowoff", "sustained", "no_ignition", "cool_flame", "no_hot_ignition", "droplet_disruption", "unknown"}

# ---------------------------------------------------------------- hücre ayrıştırma
NUMTOK = re.compile(r"(?<![A-Za-z])[+-]?(?:\d+\.\d*|\.\d+|\d+)(?:[eE][+-]?\d+)?")
UNIT_RE = re.compile(r"(?i)(?<![A-Za-z])(cm/s|mm/s|vol\s*%|mmhg|torr|psia|psig|psi|kpa|bar|atm)(?![A-Za-z])")   # v2 1.1
SEP_WORDS = {"to", "or", "and", "-", "–", ";", ",", "/", "->", "→", "etc", "etc."}
UNIT_WORDS = {"%", "mm", "s", "sec"}
TEXT_OK_FLOW = {"down", "ext", "max", "blowoff", "approaching", "low", "incr", "up", "then"}  # PSI-25/26 akış taraması kelimeleri

def parse_cell(v, allow_words=(), special=None):
    """Döner (sayılar, bayraklar). v2: birimler token'lara bölünmeden ÖNCE ayıklanır; '3-4' gibi aralıklar negatif sayı sayılmaz."""
    s = "" if v is None else str(v).strip()
    flags = set()
    if s == "" or s.lower() in ("nan", "none"):
        return [], flags
    if special and s.strip().upper() in {k.upper() for k in special}:
        return [], {next(f for k, f in special.items() if k.upper() == s.strip().upper())}
    t = s.replace("−", "-")
    if "~" in t or "≈" in t: flags.add("approx"); t = t.replace("~", " ").replace("≈", " ")
    if re.search(r"<\s*\d", t): flags.add("censored_lt")
    t2 = re.sub(r"\b(pot|p\.)\s*[\d.]+", " ", t, flags=re.I)
    if t2 != t: flags.add("pot_setting_ignored"); t = t2
    t = re.sub(r"<\s*[\d.]+", " ", t)
    t = UNIT_RE.sub(" ", t)                                   # v2 1.1: 'cm/s' gibi birimleri önce sil
    t = re.sub(r"(?<=\d)\s*[-–]\s*(?=\d)", " - ", t)          # v2 1.1: '3-4' -> '3 - 4' (aralık; negatif sayı değil)
    nums = [float(x) for x in NUMTOK.findall(t)]
    rest = NUMTOK.sub(" ", t)
    words = [w for w in re.split(r"[\s;,/]+|(?<=\s)-(?=\s)", rest.lower()) if w and w not in SEP_WORDS and w not in UNIT_WORDS and w not in ("(", ")")]
    words = [w.strip("()") for w in words if w.strip("()")]
    bad = [w for w in words if w not in allow_words]
    if bad or not nums:
        flags.add("non_numeric"); return [], flags
    if words: flags.add("parsed_from_text")
    if len(nums) > 1: flags.add("multivalue")
    return nums, flags

PRESS = {"atm": 1.0, "mmhg": 1 / 760, "torr": 1 / 760, "psia": 1 / 14.696, "psi": 1 / 14.696, "bar": 1 / 1.01325, "kpa": 1 / 101.325}

def conv_o2(nums, unit):
    u = str(unit).lower()
    if u.startswith("fraction") or u.startswith("excel_percent"): return [x * 100 for x in nums]
    if u.startswith("percent"): return nums
    raise ValueError(f"bilinmeyen O2 birimi: {unit}")

def conv_p(nums, unit, raw=""):
    u = str(unit).lower()
    if u == "atm_in_cell":
        m = re.search(r"(atm|mmhg|torr|psia|psi|bar|kpa)", str(raw).lower())
        u = m.group(1) if m else None
        if not u: raise ValueError("hücrede basınç birimi yok")
    if u not in PRESS: raise ValueError(f"bilinmeyen basınç birimi: {unit}")
    return [x * PRESS[u] for x in nums]

def conv_flow(nums, unit):
    if str(unit).lower() in ("cm_s", "cm_s_in_cell"): return nums
    raise ValueError(f"bilinmeyen akış birimi: {unit}")

# ---------------------------------------------------------------- yardımcılar
def clean_str(v):
    if v is None: return ""
    if isinstance(v, float) and pd.isna(v): return ""
    if isinstance(v, (datetime.datetime, datetime.date)): return v.isoformat()
    return str(v)

def first_col(df_or_cols, *names):
    cols = list(df_or_cols.columns) if hasattr(df_or_cols, "columns") else list(df_or_cols)
    for n in names:
        if not n: continue
        r, _ = resolve(n, cols)
        if r: return r
    return None

_COLS = {}
def col_of(row, name):
    key = (tuple(row.keys()), json.dumps(name))
    if key not in _COLS:
        _COLS[key] = resolve(name, list(row.keys()))[0]
    return _COLS[key]

def o2_spec_for(spec, variant):
    o = spec.get("o2") or {}
    if variant and variant in o: return o[variant]
    if "col" in o or "cols" in o: return o
    return None

def unverified(x):
    return "VERIFY" in json.dumps(x, ensure_ascii=False) if x is not None else False

def mismatch_files():
    p = OUT / "readiness_status.csv"
    if not p.exists(): return {}
    d = pd.read_csv(p, dtype=str, keep_default_na=False, encoding="utf-8-sig")
    return {r.psi_id: set(filter(None, r.column_mismatch_dosyalari.split(";"))) for r in d.itertuples()}

def investigation_meta(psi):
    d = inv_dir(INV, psi)
    if not d: return {}
    p = d / f"{psi}_metadata_api.json"
    return json.loads(p.read_text(encoding="utf-8")) if p.exists() else {}

def norm_key(v, date_norm):
    s = clean_str(v).strip()
    if re.fullmatch(r"\d+\.0", s): s = s[:-2]
    if date_norm:
        for fmt in ("%Y-%m-%dT%H:%M:%S", "%Y-%m-%d", "%m/%d/%Y", "%m/%d/%y"):
            try: return datetime.datetime.strptime(s, fmt).date().isoformat()
            except ValueError: pass
    return s

# ---------------------------------------------------------------- outcome kuralları
def cond_ok(row, c):
    col = col_of(row, c["col"])
    if col is None: return False
    v = clean_str(row.get(col, "")).strip()
    if "in" in c: return v in c["in"]
    if "contains" in c: return c["contains"].lower() in v.lower()
    if "startswith" in c: return v.lower().startswith(c["startswith"].lower())
    if "values" in c: return v in c["values"]
    return False

LAST_EVIDENCE = ["", ""]   # v3: son parsed_text çağrısının (metin, kanıt) çifti – inceleme CSV'si için
REVIEW = []
NEG = re.compile(r"(\bnot\b|\bno\b|n't\b|\bnever\b|\bwithout\b)[^.;!]*$", re.I)

def outcome_of(row, spec, flags, crow=None):
    o = spec.get("outcome") or {}
    if not o: return "unknown", None
    if o.get("source") == "parsed_text":
        if o.get("outcome_from") == "conditions":
            if crow is None: return "unknown", None
            c = first_col(list(crow.keys()), spec.get("conditions_outcome_col"))
            txt = clean_str(crow.get(c, "")) if c else ""
        else:
            txt = " ".join(clean_str(row.get(col_of(row, c), "")) for c in o.get("parse_from", []))
        low = txt.lower(); hits = set(); pos, neg, ev = {}, {}, []
        if o.get("patterns"):
            for cat, pats in o["patterns"].items():
                for p in pats:
                    for m in re.finditer(p, low):
                        negated = bool(o.get("negation_guard") and NEG.search(low[max(0, m.start() - 30):m.start()]))
                        (neg if negated else pos).setdefault(cat, []).append((m.start(), m.end(), p))
                        ev.append(f"{cat}{'(olumsuz)' if negated else ''}: /{p}/ → '{low[m.start():m.end()]}'")
        # v3: sertleştirilmiş belirsizlik kuralları (yaml: outcome.ambiguity_rules)
        ambiguous = False
        for ar in o.get("ambiguity_rules") or []:
            cat = ar["category"]
            for m in re.finditer(ar["pattern"], low):
                if ar.get("excludes_hit") and cat in pos:   # bu yapı tek başına kategori sayılmaz
                    pos[cat] = [h for h in pos[cat] if not (h[0] < m.end() and m.start() < h[1])]
                    if not pos[cat]: del pos[cat]
                    ev.append(f"{cat}: '{low[m.start():m.end()]}' tek başına sayılmaz ({ar.get('why','')})")
                    pc = [q for q in ar.get("positive_context", []) for mm in re.finditer(q, low) if not NEG.search(low[max(0, mm.start() - 30):mm.start()])]
                    if pc: ambiguous = True; ev.append(f"olumlu bağlam: {sorted(set(pc))} → ambiguous")
                elif ar.get("makes_ambiguous") and cat in pos:
                    ambiguous = True; ev.append(f"{cat}: '{low[m.start():m.end()]}' kısmi/olumsuz ifade → ambiguous")
        if o.get("pos_neg_conflict"):
            for cat in set(pos) & set(neg):
                ambiguous = True; ev.append(f"{cat}: hem olumlu hem olumsuz eşleşme → ambiguous")
        hits = set(pos)
        for cat, kws in (o.get("keywords") or {}).items():
            for kw in kws:
                if re.search(r"(?<![a-z])" + re.escape(kw.lower()) + r"(?![a-z])", low): hits.add(cat); ev.append(f"{cat}: '{kw}'")
        LAST_EVIDENCE[:] = [txt, "; ".join(ev)]
        if ambiguous or len(hits) > 1: flags.add("outcome_ambiguous"); return "unknown", "parsed_text"
        if len(hits) == 1: return hits.pop(), "parsed_text"
        return "unknown", None
    rules = list(o.get("rules") or [])
    if o.get("outcome_col") and o.get("map"): rules.append({"col": o["outcome_col"], "values": o["map"]})
    for r in rules:
        if "when" in r and not cond_ok(row, r["when"]): continue
        if "any" in r and not any(cond_ok(row, c) for c in r["any"]): continue
        if "values" in r:
            c = col_of(row, r["col"])
            if c is None: continue
            v = clean_str(row.get(c, "")).strip()
            if v not in r["values"]: continue
            val = r["values"][v]
        elif "value" in r:
            val = r["value"]
        else:
            continue
        if r.get("flag"): flags.add(r["flag"])
        assert val in OUTCOMES, f"bilinmeyen outcome {val}"
        return val, "column"
    return "unknown", None

# ---------------------------------------------------------------- ana dönüşüm
def process(psi, spec, mm, meta):
    rows_out, counts = [], {"raw": 0, "blank": 0, "non_test": 0, "source_test_rows": 0, "out": 0, "exploded_extra": 0}
    files = primary_files(spec)
    nt_pat = re.compile(spec["non_test_row_pattern"], re.I) if spec.get("non_test_row_pattern") else None
    known = {}
    for k in spec.get("known_quality_issues") or []:
        if isinstance(k, dict):
            for t in k.get("tests", []): known.setdefault(str(t), []).append(k.get("issue", ""))
    special = spec.get("special_tokens") or None
    cond, jk = None, spec.get("conditions_join_key") or {}
    if spec.get("conditions_file"):
        cp = find_file(psi, spec["conditions_file"])
        sheets = sheet_frames(cp)
        cdf = sheets[spec.get("conditions_sheet") or next(iter(sheets))]
        cdf = cdf[~blank_mask(cdf.astype(object).where(cdf.notna(), ""))]
        ck = jk.get("conditions"); ck = ck if isinstance(ck, list) else [ck]
        ccols = [first_col(cdf, c) for c in ck]
        cond = {}
        for i, r in cdf.iterrows():
            key = tuple(norm_key(r[c], jk.get("date_normalize")) for c in ccols)
            if all(key):
                cond.setdefault(key, []).append((i + cdf.attrs.get("header_row", 1) + 1, {c: clean_str(v) for c, v in r.items() if not str(c).startswith("_col")}))
    for fname in files:
        fp = find_file(psi, fname)
        df, enc = read_csv_any(fp)
        variant = file_variant(fname)
        counts["raw"] += len(df)
        bm = blank_mask(df); counts["blank"] += int(bm.sum())
        cols = list(df.columns)
        c_test = first_col(df, spec.get("test_id"), "Test #", "Test", "Sample Number", "Flex Number", "FLEX Test #", "Sample #")
        c_mat = first_col(df, spec.get("material"), spec.get("fuel"), "Fuel")
        o2s = o2_spec_for(spec, variant)
        o2names = []
        if o2s:
            o2names = o2s.get("cols") or [o2s.get("col")]
            if o2s.get("use") == "initial": o2names = o2names[:1]
        ps = spec.get("pressure") if isinstance(spec.get("pressure"), dict) else None
        pnames = (ps.get("cols") or [ps.get("col")]) if ps else []
        fs = spec.get("flow") if isinstance(spec.get("flow"), dict) and spec["flow"].get("col") else None
        fcol = first_col(df, fs["col"]) if fs else first_col(df, spec.get("flow_col"))
        funit = fs["unit"] if fs else spec.get("flow_unit")
        geo = [first_col(df, g) for g in (spec.get("geometry") or [])]
        table_note = ""   # v3 (3): dosya düzeyindeki not (ör. PSI-20 Notes hücresi) tüm satırlara
        tn = spec.get("table_note_from")
        if tn:
            nc = first_col(df, tn["col"])
            hit = [v for v in (df[nc] if nc else []) if tn["contains"].lower() in str(v).lower()]
            table_note = hit[0].strip() if hit else ""
        fuel_const = None   # v3 (1): yaml fuel_from_column_name (yalnız kanıt kontrolü geçtiyse yaml'a konur)
        fd = (spec.get("fuel_derived") or {}).get(variant or "all")
        fd_col = first_col(df, fd["requires_col"]) if fd else None   # v3.1: satır bazında kontrol (aşağıda)
        tk = jk.get("table"); tk = tk if isinstance(tk, list) else [tk]
        tcols = [first_col(df, c) for c in tk] if cond is not None else []
        for i, r in df.iterrows():
            src_row = i + 2
            if bm.iloc[i]: continue
            row = {c: clean_str(v) for c, v in r.items()}
            tid = row.get(c_test, "").strip() if c_test else ""
            if nt_pat and nt_pat.match(row[cols[0]]):
                counts["non_test"] += 1
                QLOG.append([psi, tid, fname, src_row, "non_test_row", f"test-dışı satır – experiments'a alınmadı: {row[cols[0]][:60]}"]); continue
            counts["source_test_rows"] += 1
            if not tid: tid = f"{psi}-r{src_row}"
            flags = set(); detail = {}   # v3 (4): bayrak -> kendi detay mesajları
            raw = {"table": row} if cond is not None else row
            crow = None
            if cond is not None:
                key = tuple(norm_key(row.get(c, ""), jk.get("date_normalize")) for c in tcols)
                m = cond.get(key, [])
                if len(m) == 1:
                    crow = m[0][1]; raw["conditions"] = {"sheet": spec.get("conditions_sheet"), "row": m[0][0], **crow}
                elif len(m) > 1:   # v2: "ilk eşleşmeyi al" YOK
                    flags.add("join_multiple"); detail.setdefault("join_multiple", []).append(f"bileşik anahtar {key} koşul sayfasında {len(m)} kez → koşullar BOŞ")
                else:
                    flags.add("join_unmatched"); detail.setdefault("join_unmatched", []).append(f"bileşik anahtar {key} koşul sayfasında yok → koşullar BOŞ")
            src = crow if cond is not None else row
            src = src or {}
            # ---- O2
            o2_levels, basis, o2_raw_cells = [], None, []
            if o2s:
                basis = o2s.get("meaning") or ("derived" if o2s.get("derived") else "ambient")
                for n in o2names:
                    c = first_col(list(src.keys()), n) if src else None
                    if not c: continue
                    o2_raw_cells.append(src.get(c, ""))
                    nums, fl = parse_cell(src.get(c, ""), special=special)
                    if "non_numeric" in fl: flags.add("non_numeric:o2"); detail.setdefault("non_numeric:o2", []).append(f"O2 '{src.get(c)}' sayısal değil → null")
                    flags |= {(x if x in (special or {}).values() else f"{x}:o2") for x in fl if x != "non_numeric"}
                    try: o2_levels += conv_o2(nums, o2s.get("unit"))
                    except ValueError as e: flags.add("unit_error:o2"); detail.setdefault("unit_error:o2", []).append(str(e))
                if unverified(o2s): flags.add("unverified_unit:o2")
                if basis == "oxidizer_stream": flags.add("o2_oxidizer_stream")
                if basis == "derived": flags.add("o2_derived")
            elif isinstance(spec.get("o2"), dict):
                flags.add("o2_not_in_table")   # v2 1.3: tabloda O2 kolonu hiç yok
            # ---- basınç
            pv = []
            if ps:
                for n in pnames:
                    c = first_col(list(src.keys()), n) if src else None
                    if not c: continue
                    nums, fl = parse_cell(src.get(c, ""), special=special)
                    if "non_numeric" in fl: flags.add("non_numeric:pressure"); detail.setdefault("non_numeric:pressure", []).append(f"basınç '{src.get(c)}' sayısal değil → null")
                    flags |= {(x if x in (special or {}).values() else f"{x}:pressure") for x in fl if x != "non_numeric"}
                    try: pv += conv_p(nums, ps.get("unit"), src.get(c, ""))
                    except ValueError as e: flags.add("unit_error:pressure"); detail.setdefault("unit_error:pressure", []).append(str(e))
                if unverified(ps): flags.add("unverified_unit:pressure")
            p_assumed = spec.get("pressure_assumed_atm")
            if p_assumed is not None:
                flags.add("pressure_assumed")
                if unverified(spec.get("pressure_assumed")): flags.add("unverified_unit:pressure")
            # ---- akış
            fv = []
            fsrc, fc = (src, first_col(list(src.keys()), spec.get("conditions_flow_col"))) if spec.get("conditions_flow_col") else (row, fcol)
            if fc:
                nums, fl = parse_cell(fsrc.get(fc, ""), allow_words=TEXT_OK_FLOW if not fs else (), special=special)
                if "non_numeric" in fl: flags.add("non_numeric:flow"); detail.setdefault("non_numeric:flow", []).append(f"akış '{fsrc.get(fc)}' sayısal değil → null")
                flags |= {(x if x in (special or {}).values() else f"{x}:flow") for x in fl if x != "non_numeric"}
                try: fv = conv_flow(nums, funit)
                except ValueError as e: flags.add("unit_error:flow"); detail.setdefault("unit_error:flow", []).append(str(e))
                if unverified(fs) or str(funit).startswith("VERIFY"): flags.add("unverified_unit:flow")
            for name, vals, lo, hi in (("pressure", pv, 0, 10), ("flow", fv, 0, 200)):
                bad = [x for x in vals if not (lo <= x <= hi)]
                if bad: flags.add(f"out_of_range:{name}"); detail.setdefault(f"out_of_range:{name}", []).append(f"{name} aralık dışı ({lo}-{hi}): {bad}")
            if any(x == 0 for x in pv): flags.add("zero_value:pressure"); detail.setdefault("zero_value:pressure", []).append("basınç kaynakta 0 (değiştirilmedi)")
            if spec.get("row_level") == "summary": flags.add("summary_row")
            for rf in spec.get("row_flags") or []: flags.add(rf)
            for fr in spec.get("flag_rules") or (spec.get("outcome") or {}).get("flag_rules") or []:
                if cond_ok(row, fr): flags.add(fr["flag"])
            if tid in known: flags.add("known_issue"); detail.setdefault("known_issue", []).append("; ".join(known[tid]))
            if fname in mm.get(psi, set()): flags.add("column_mismatch")
            LAST_EVIDENCE[:] = ["", ""]
            outcome, osrc = outcome_of(row, spec, flags, crow)
            if osrc == "parsed_text":
                flags.add("outcome_parsed_text")   # v3 (2)
                if spec.get("outcome_review"):
                    REVIEW.append({"psi_id": psi, "test_id": tid, "source_row": src_row, "outcome": outcome, "outcome_source": osrc, "override_nedeni": "", "ambiguous": "outcome_ambiguous" in flags,
                                   "gozlem_metni_tam": LAST_EVIDENCE[0], "eslesen_regexler": LAST_EVIDENCE[1]})
            ov = next((x for x in (spec.get("outcome_overrides") or []) if int(x["source_row"]) == src_row and str(x.get("test_id", tid)) == tid), None)
            if ov:   # v3.1: elle onay, kurallardan SONRA
                outcome, osrc = ov["outcome"], "manual_review"; flags.add("outcome_manual_review")
                detail.setdefault("outcome_manual_review", []).append(f"elle onay → {ov['outcome']}: {ov['reason']} | metin: {ov['quote']}")
                for rv in REVIEW:
                    if rv["psi_id"] == psi and rv["source_row"] == src_row:
                        rv.update({"outcome": outcome, "outcome_source": "manual_review", "override_nedeni": ov["reason"]})
            assert outcome in OUTCOMES
            o_conf = "" if outcome == "unknown" else ("high" if osrc == "column" else "low")   # v3.1: low = parsed_text VE manual_review
            labels = spec.get("geometry_labels") or {}
            geo_note = "; ".join(f"{labels.get(g, g)}={row.get(g,'')}" for g in geo if g and row.get(g, "").strip())
            if table_note:
                geo_note = (geo_note + " | " if geo_note else "") + "Tablo notu: " + table_note
                if spec.get("table_note_flag"): flags.add(spec["table_note_flag"])
            fuel_const = fd["value"] if (fd_col and str(row.get(fd_col, "")).strip()) else None   # v3.1: yalnız 'requires_col' doluysa
            if fuel_const and not (row.get(c_mat, "").strip() if c_mat else ""):
                flags.add("fuel_derived_from_column")
            else:
                fuel_const = None
            if spec.get("geometry_note_suffix"): geo_note = (geo_note + " | " if geo_note else "") + spec["geometry_note_suffix"]
            # ---- O2 açılımı (v2 3.2) ya da tek satır
            o2_report = None
            for cell in o2_raw_cells:
                if cell.strip() in (spec.get("o2_report_values") or {}):
                    o2_report = float(spec["o2_report_values"][cell.strip()]); flags.add("o2_value_from_report")
                    detail.setdefault("o2_value_from_report", []).append(f"hücre '{cell.strip()}' = rapor Tablo 1'de %{o2_report:g} (o2_pct_report)")
            explode = spec.get("explode_multivalue") == "o2" and len(o2_levels) > 0
            variants = [[x] for x in o2_levels] if explode else [o2_levels]
            if explode and len(o2_levels) > 1: counts["exploded_extra"] += len(o2_levels) - 1
            for n, lv in enumerate(variants, start=1):
                f2 = set(flags); d2 = {k: list(v) for k, v in detail.items()}
                if explode:
                    f2.discard("multivalue:o2")
                    if len(o2_levels) > 1: f2.add("exploded_from_multivalue")
                pv_eff, p_ass_eff = list(pv), p_assumed
                if spec.get("pressure_map_from_o2") and lv:
                    key_val = o2_report if (o2_report is not None and len(variants) == 1) else lv[0]
                    mp = {float(k): v for k, v in spec["pressure_map_from_o2"].items()}
                    if key_val in mp:
                        pv_eff = [mp[key_val]]; p_ass_eff = mp[key_val]; f2.add("pressure_assumed_from_report")
                        d2.setdefault("pressure_assumed_from_report", []).append(f"basınç rapor eşlemesinden: %{key_val:g} O2 → {mp[key_val]} atm")
                    else:
                        f2.add("pressure_unmapped_level"); d2.setdefault("pressure_unmapped_level", []).append(f"%{key_val:g} O2 için raporda basınç eşlemesi yok → boş")
                bad = [x for x in lv if not (0 <= x <= 100)]
                if bad: f2.add("out_of_range:o2"); d2.setdefault("out_of_range:o2", []).append(f"o2 aralık dışı (0-100): {bad}")
                rec = {"psi_id": psi, "test_id": f"{psi}-r{src_row}-{n}" if explode else tid,
                       "fuel_or_material": (row.get(c_mat, "").strip() if c_mat else "") or (fuel_const or ""), "fuel_phase": spec.get("fuel_phase"),
                       "o2_pct_min": min(lv) if lv else None, "o2_pct_max": max(lv) if lv else None,
                       "pressure_atm_min": min(pv_eff) if pv_eff else None, "pressure_atm_max": max(pv_eff) if pv_eff else None,
                       "flow_cm_s_min": min(fv) if fv else None, "flow_cm_s_max": max(fv) if fv else None,
                       "outcome": outcome, "outcome_source": osrc, "geometry_note": geo_note,
                       "quality_flag": ";".join(sorted(f2)), "source_file": fname, "source_row": src_row,
                       "raw_json": json.dumps(raw, ensure_ascii=False),
                       "o2_basis": basis, "pressure_atm_assumed": p_ass_eff, "pressure_is_assumed": p_ass_eff is not None,
                       "o2_pct_report": o2_report, "is_duplicate": False, "evidence_grade": None, "outcome_confidence": o_conf,
                       "variant": variant, "investigation_doi": meta.get("doi"), "license": meta.get("licenseIdentifier")}
                rows_out.append(rec)
                for f in sorted(f2):
                    QLOG.append([psi, rec["test_id"], fname, src_row, f, " | ".join(d2.get(f, []))[:500]])
    counts["out"] = len(rows_out)
    return rows_out, counts

ANOMALY = re.compile(r"out_of_range:|zero_value:|known_issue|unverified_unit:|join_unmatched|join_multiple|exact_duplicate_source|column_mismatch|unit_error:")

def evidence_grade(r):
    """D < C < B < A; çakışmada en düşük. Basınç 'var' = ölçülen (min) ya da varsayılan (assumed) değer."""
    f = r["quality_flag"] or ""
    has_o2 = pd.notna(r["o2_pct_max"])
    has_p = pd.notna(r["pressure_atm_min"]) or pd.notna(r["pressure_atm_assumed"])
    if not has_o2 or not has_p: return "D"
    if "summary_row" in f or r["pressure_is_assumed"] or "o2_derived" in f or "pressure_assumed" in f: return "C"
    if ANOMALY.search(f): return "C"
    if r["o2_basis"] == "oxidizer_stream": return "B"
    return "A"

def family(meta, psi):
    a = (meta.get("investigationAcronym") or "").strip()
    if a: return re.split(r"[\s/_-]", a)[0].upper()
    return "Ground/Model (" + (meta.get("subResearchArea") or meta.get("researchArea") or "?") + ")"

def main():
    print("config:", CFG["_path"])
    mm = mismatch_files()
    all_rows, counts = [], {}
    for psi, spec in CFG["investigations"].items():
        meta = investigation_meta(psi)
        r, c = process(psi, spec, mm, meta)
        all_rows += r; counts[psi] = c
        print(f"{psi}: {c}")
    exp = pd.DataFrame(all_rows, columns=HF + EXTRA)
    # v2 1.4: birebir tekrar (aynı dosya, aynı raw_json, farklı kaynak satırı) – satır SİLİNMEZ
    first = {}
    for i, r in exp.iterrows():
        k = (r.psi_id, r.source_file, r.raw_json)
        if k not in first: first[k] = r.source_row
        elif r.source_row != first[k]:
            exp.at[i, "is_duplicate"] = True
            exp.at[i, "quality_flag"] = ";".join(sorted(set(filter(None, (r.quality_flag or "").split(";"))) | {"exact_duplicate_source"}))
            QLOG.append([r.psi_id, r.test_id, r.source_file, r.source_row, "exact_duplicate_source", f"raw_json kaynak satırı {first[k]} ile birebir aynı (satır silinmedi)"])
    exp["evidence_grade"] = exp.apply(evidence_grade, axis=1)
    # v3 (3): etkin O2 – o2_pct_report doluysa o, değilse ham o2_pct_min/max (ham kolonlar DEĞİŞMEZ)
    exp["o2_pct_min_effective"] = exp.o2_pct_report.where(exp.o2_pct_report.notna(), exp.o2_pct_min)
    exp["o2_pct_max_effective"] = exp.o2_pct_report.where(exp.o2_pct_report.notna(), exp.o2_pct_max)
    if REVIEW:
        pd.DataFrame(REVIEW).to_csv(OUT / "psi26_outcome_review.csv", index=False, encoding="utf-8-sig")
    OUT.mkdir(exist_ok=True)
    exp.to_csv(OUT / "experiments.csv", index=False, encoding="utf-8-sig")
    try:
        exp.to_parquet(OUT / "experiments.parquet", index=False); pq = True
    except Exception as e:
        pq = False; print("parquet atlandı:", e)
    ql = pd.DataFrame(QLOG, columns=["psi_id", "test_id", "source_file", "source_row", "flag", "detail"])
    ql.to_csv(OUT / "quality_log.csv", index=False, encoding="utf-8-sig")
    inv_rows = []
    for d in sorted(INV.iterdir(), key=lambda x: int(re.match(r"PSI-(\d+)", x.name).group(1)) if re.match(r"PSI-\d+", x.name) else 0):
        m = re.match(r"(PSI-\d+)", d.name)
        if not m or not d.is_dir(): continue
        psi = m.group(1); meta = investigation_meta(psi)
        tier = "tier1" if psi in CFG["investigations"] else ("catalog_only" if psi in CFG.get("catalog_only", {}) else "yaml_disi")
        inv_rows.append({"psi_id": psi, "baslik": meta.get("title"), "acronym": meta.get("investigationAcronym"), "doi": meta.get("doi"),
                         "aile": family(meta, psi), "tier": tier, "sub_research_area": meta.get("subResearchArea"), "project_type": meta.get("projectType"),
                         "hardware": meta.get("experimentHardware"), "license": meta.get("licenseIdentifier"), "version": meta.get("version"),
                         "catalog_note": CFG.get("catalog_only", {}).get(psi, ""), "experiments_rows": int((exp.psi_id == psi).sum())})
    inv = pd.DataFrame(inv_rows); inv.to_csv(OUT / "investigations.csv", index=False, encoding="utf-8-sig")
    db = OUT / "experiments.sqlite"
    if db.exists(): db.unlink()
    with sqlite3.connect(db) as con:
        inv.to_sql("investigations", con, index=False); exp.to_sql("experiments", con, index=False); ql.to_sql("quality_log", con, index=False)
    json.dump({"counts": counts, "parquet": pq, "config": CFG["_path"], "version": "v2", "run": datetime.datetime.now().isoformat(timespec="seconds")},
              open(OUT / "_etl_run.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    moon_box(exp)
    exports(exp)
    print("experiments:", len(exp), "| quality_log:", len(ql), "| parquet:", pq)

DICT = {   # v3 (6): veri sözlüğü – açıklama ve olası değerler
 "psi_id": ("PSI investigation kimliği", ""), "test_id": ("Test kimliği (kaynak); yoksa PSI-XX-r<satır>; PSI-20: PSI-20-r<satır>-<n>. TEKİL DEĞİL – tekil anahtar: psi_id+source_file+source_row+test_id", ""),
 "fuel_or_material": ("Yakıt / malzeme (kaynak metni)", ""), "fuel_phase": ("Yakıt fazı", "solid | liquid | gas"),
 "o2_pct_min": ("O2 % – HAM (birim çevrilmiş, değer düzeltmesi yok)", ""), "o2_pct_max": ("O2 % – HAM", ""),
 "o2_pct_min_effective": ("O2 % – ETKİN: o2_pct_report doluysa o, değilse o2_pct_min. Filtre/grafik için bunu kullanın", ""),
 "o2_pct_max_effective": ("O2 % – ETKİN (bkz. o2_pct_min_effective)", ""),
 "pressure_atm_min": ("Basınç atm (ölçülen/tablo; PSI-20 rapor eşlemesi)", ""), "pressure_atm_max": ("Basınç atm", ""),
 "flow_cm_s_min": ("Akış hızı cm/s", ""), "flow_cm_s_max": ("Akış hızı cm/s", ""),
 "outcome": ("Sonuç", "extinguished | blowoff | sustained | no_ignition | cool_flame | no_hot_ignition | droplet_disruption | unknown"),
 "outcome_source": ("Sonucun kaynağı", "column | parsed_text | manual_review | boş"), "outcome_confidence": ("Sonuç güveni", "high (kaynak kolon) | low (parsed_text veya manual_review) | boş (unknown)"),
 "geometry_note": ("Geometri / tablo notları (metin)", ""), "quality_flag": ("';' ile ayrılmış bayraklar (bkz. quality_log.csv)", ""),
 "source_file": ("Kaynak dosya", ""), "source_row": ("Kaynak dosyada satır no (başlık=1)", ""), "raw_json": ("Orijinal satırın tüm kolonları (yalnız experiments.csv'de)", ""),
 "o2_basis": ("O2'nin anlamı", "ambient | oxidizer_stream | derived | boş"), "pressure_atm_assumed": ("Varsayılan/eşlenen basınç (atm)", ""),
 "pressure_is_assumed": ("Basınç varsayım mı", "True | False"), "o2_pct_report": ("Rapordan türetilmiş O2 % (PSI-20)", ""),
 "is_duplicate": ("Aynı dosyada birebir kopyanın 2.+ örneği", "True | False"), "evidence_grade": ("Kanıt sınıfı (D<C<B<A)", "A | B | C | D"),
 "variant": ("Dosya varyantı", "inverse | normal | boş"), "investigation_doi": ("Investigation DOI", ""), "license": ("Lisans (PSI-10 boş)", "CC0-1.0 | boş")}

def exports(exp):
    dash = exp.drop(columns=["raw_json"])
    dash.to_csv(OUT / "experiments_dashboard.csv", index=False, encoding="utf-8-sig")
    rows = [{"kolon": c, "tip": str(exp[c].dtype), "aciklama": DICT.get(c, ("", ""))[0], "olasi_degerler": DICT.get(c, ("", ""))[1]} for c in exp.columns]
    pd.DataFrame(rows).to_csv(OUT / "data_dictionary.csv", index=False, encoding="utf-8-sig")
    mb = CFG["moon_box"]; O, P = mb["o2_pct_min"], mb["pressure_atm_max"]
    e = dash.copy()
    o2 = e.o2_pct_max_effective
    inb = (o2 >= O) & (e.pressure_atm_min <= P); edge = (o2 >= O) & (e.pressure_atm_min > P) & (e.pressure_atm_min <= 0.75)
    near = ~inb & ~edge & ((o2 >= 25) | (e.pressure_atm_min <= 1.0))
    e["box_section"] = None
    e.loc[near, "box_section"] = "near_miss"; e.loc[edge, "box_section"] = "edge"; e.loc[inb, "box_section"] = "in_box"
    e["pressure_psi_min"] = e.pressure_atm_min * 14.696
    e[e.box_section.notna()].sort_values(["box_section", "psi_id", "source_file", "source_row"]).to_csv(OUT / "moon_box_final.csv", index=False, encoding="utf-8-sig")
    raw_in = (e.o2_pct_max >= O) & (e.pressure_atm_min <= P)
    diff = e[raw_in != inb]
    json.dump({"in_box_raw": int(raw_in.sum()), "in_box_effective": int(inb.sum()), "edge_effective": int(edge.sum()), "near_effective": int(near.sum()),
               "fark_satirlari": diff[["psi_id", "test_id", "o2_pct_max", "o2_pct_max_effective", "pressure_atm_min"]].to_dict("records")},
              open(OUT / "_moon_box_effective_diff.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1, default=str)

def fmt(x, n=4):
    return "—" if x is None or (isinstance(x, float) and pd.isna(x)) else f"{x:.{n}g}"

def moon_box(exp):
    mb = CFG["moon_box"]; O, P = mb["o2_pct_min"], mb["pressure_atm_max"]
    e = exp.copy(); e["quality_flag"] = e.quality_flag.fillna("")
    in_box = (e.o2_pct_max >= O) & (e.pressure_atm_min <= P)
    edge = (e.o2_pct_max >= O) & (e.pressure_atm_min > P) & (e.pressure_atm_min <= 0.75)
    near = ~in_box & ~edge & ((e.o2_pct_max >= 25) | (e.pressure_atm_min <= 1.0))
    e["box_section"] = ""
    e.loc[near, "box_section"] = "near_miss"; e.loc[edge, "box_section"] = "edge"; e.loc[in_box, "box_section"] = "in_box"
    e["pressure_psi_min"] = e.pressure_atm_min * 14.696
    cols = ["box_section", "psi_id", "test_id", "fuel_phase", "fuel_or_material", "o2_pct_min", "o2_pct_max", "o2_pct_report", "pressure_atm_min", "pressure_atm_max", "pressure_psi_min",
            "pressure_is_assumed", "o2_basis", "evidence_grade", "outcome", "quality_flag", "source_file", "source_row"]
    e.loc[in_box | edge | near, cols].sort_values(["box_section", "psi_id", "source_file", "source_row"]).to_csv(OUT / "moon_box_coverage.csv", index=False, encoding="utf-8-sig")
    b = e[in_box]
    L = ["# Moon box kapsaması (YAMA v2)", "",
         f"Kutu: **o2_pct_max ≥ {O}** VE **pressure_atm_min ≤ {P} atm** (10.2 psi). `evidence_grade`: A = test düzeyi + ortam O2 + ölçülmüş basınç + anomalisiz; "
         "B = oksitleyici akışı; C = özet / varsayılan ya da rapordan eşlenmiş basınç / türetilmiş O2 / anomali; D = O2 ya da basınç eksik.", "",
         "## 1. Özet: investigation × evidence_grade × outcome", "", "| psi_id | faz | satır | A | B | C | D | outcome kırılımı |", "|---|---|---|---|---|---|---|---|"]
    for psi, d in b.groupby("psi_id"):
        g = d.evidence_grade.value_counts()
        L.append(f"| {psi} | {d.fuel_phase.iloc[0]} | {len(d)} | {g.get('A',0)} | {g.get('B',0)} | {g.get('C',0)} | {g.get('D',0)} | {', '.join(f'{k} {v}' for k, v in d.outcome.value_counts().items())} |")
    L += ["", f"Toplam kutuda **{len(b)}** satır; A: **{int((b.evidence_grade=='A').sum())}**, B: {int((b.evidence_grade=='B').sum())}, C: {int((b.evidence_grade=='C').sum())}, D: {int((b.evidence_grade=='D').sum())}", "",
          "## 2. Temiz (A) satırlar", "", "| psi_id | test_id | yakıt | O2 % (min–max) | basınç atm | outcome | bayraklar |", "|---|---|---|---|---|---|---|"]
    for r in b[b.evidence_grade == "A"].itertuples():
        L.append(f"| {r.psi_id} | {r.test_id} | {r.fuel_or_material} | {fmt(r.o2_pct_min)}–{fmt(r.o2_pct_max)} | {fmt(r.pressure_atm_min)} | {r.outcome} | {r.quality_flag or '—'} |")
    L += ["", "## 3. B sınıfı – O2 oksitleyici akışı (ortam DEĞİL)", "", "> O2 değeri brülörden akan oksitleyicinin O2 oranı; hazne ortamı N2 + yakıt. Ortam atmosferi analizine katılmamalı.", "",
          "| psi_id | satır | O2 aralığı | basınç aralığı (atm) | outcome |", "|---|---|---|---|---|"]
    for psi, d in b[b.evidence_grade == "B"].groupby("psi_id"):
        L.append(f"| {psi} | {len(d)} | {fmt(d.o2_pct_min.min())}–{fmt(d.o2_pct_max.max())} | {fmt(d.pressure_atm_min.min())}–{fmt(d.pressure_atm_max.max())} | {', '.join(f'{k} {v}' for k, v in d.outcome.value_counts().items())} |")
    s68 = b[(b.psi_id == "PSI-68")]
    L += ["", "## 4. PSI-68 FLEX-2 özet satırları (summary_row)", "", f"{len(s68)} satır; her satır bir yakıt için test **aralığı** (O2 0.17–0.30, p 0.5–3 atm). O2 max ile p min aynı testte birlikte oluşmamış olabilir → C sınıfı.", ""]
    for r in s68.itertuples():
        L.append(f"- {r.test_id} · {r.fuel_or_material} · O2 {fmt(r.o2_pct_min)}–{fmt(r.o2_pct_max)} · p {fmt(r.pressure_atm_min)}–{fmt(r.pressure_atm_max)} atm")
    ed = e[edge]
    L += ["", "## 5. KENAR: o2_pct_max ≥ 30 ve 0.694 < pressure_atm_min ≤ 0.75 atm", "", f"{len(ed)} satır.", "", "| psi_id | test_id | yakıt | O2 % | basınç atm | psi | outcome | sınıf |", "|---|---|---|---|---|---|---|---|"]
    for r in ed.sort_values(["psi_id", "source_row"]).itertuples():
        L.append(f"| {r.psi_id} | {r.test_id} | {r.fuel_or_material} | {fmt(r.o2_pct_max)} | {fmt(r.pressure_atm_min)} | {fmt(r.pressure_psi_min)} | {r.outcome} | {r.evidence_grade} |")
    if len(ed): L += ["", "Kenar outcome dağılımı: " + ", ".join(f"{k} {v}" for k, v in ed.outcome.value_counts().items())]
    p20 = e[(e.psi_id == "PSI-20")]
    L += ["", "## 6. PSI-20 BRE – rapor eşlemeli basınç (pressure_assumed_from_report)", "",
          "Gün düzeyi tablo; çok değerli O2 hücreleri seviye başına ayrı satıra açıldı. Basınç BRE Final Report eşlemesinden: %21 → 1.0 atm, %26.5 → 0.694 atm, %34 → 0.558 atm; %25 / %40 için eşleme yok (boş).", "",
          "| test_id | yakıt | O2 % | o2_pct_report | basınç atm (rapor) | kutuda | sınıf | bayrak notu |", "|---|---|---|---|---|---|---|---|"]
    for r in p20.sort_values(["source_row", "test_id"]).itertuples():
        hl = "**" if r.pressure_atm_min in (0.558, 0.694) else ""
        L.append(f"| {hl}{r.test_id}{hl} | {r.fuel_or_material} | {fmt(r.o2_pct_max)} | {fmt(r.o2_pct_report)} | {hl}{fmt(r.pressure_atm_min)}{hl} | {'evet' if (r.o2_pct_max >= O and r.pressure_atm_min <= P) else 'hayır'} | {r.evidence_grade} | {'o2_value_from_report' if 'o2_value_from_report' in r.quality_flag else ''} |")
    s = e[e.fuel_phase == "solid"]
    sb = s[in_box.loc[s.index]]
    L += ["", "## 7. Katı yakıt", "",
          f"**Moon box'ta katı yakıt: {'VAR' if len(sb) else 'YOK'}.** Katı yakıt satırı {len(s)}; en yüksek O2 (o2_pct_max) = {fmt(s.o2_pct_max.max(), 5)} % ({s.loc[s.o2_pct_max.idxmax(), 'psi_id']}). "
          "PSI'da ≥ %30 O2'li katı yakıt testi yok (PSI-25'teki 39.1 / 40.4 'final O2' kolonu; bilinen hata, kullanılmadı)."]
    (OUT / "moon_box_coverage.md").write_text("\n".join(L) + "\n", encoding="utf-8")

if __name__ == "__main__":
    main()
