"""Build web/data/app_data.json + web/data/investigation_ranking.csv from the FROZEN v3.1 CSVs.
Read-only on data/. Usage:  python scripts/build_dashboard_data.py <data_dir> <out_dir>
AI disclosure: this script was drafted with an AI assistant (Claude) and reviewed by the team."""
import sys, json, hashlib, datetime
import pandas as pd

DATA, OUT = sys.argv[1], sys.argv[2]
O2_MIN, P_MAX, EDGE_P = 30.0, 0.694, 0.75
W = {"moon": 35, "quality": 25, "outcome": 20, "material": 20}          # ranking weights (sum 100)
GRADE_W = {"A": 1.0, "B": 0.66, "C": 0.33, "D": 0.0}
BOX_W = {"A": 1.0, "B": 0.5, "C": 0.25, "D": 0.0}                       # points per in-box row
EDGE_PTS, BOX_SATURATION = 0.25, 20.0
PHASE_W = {"solid": 1.0, "liquid": 0.6, "gas": 0.4}                     # editorial: closeness to crew-cabin materials
NOTE_EN = {
 "PSI-21": "Table has no O2 or pressure columns.", "PSI-22": "Table has no O2 column.",
 "PSI-23": "Has an 'Atmosphere' column that needs manual reading.", "PSI-47": "Only 2 rows (aerosol feasibility test).",
 "PSI-101": "Smoke aerosol study; no O2 in table.", "PSI-102": "Smoke aerosol study; no O2 in table.",
 "PSI-106": "12 rows, only test date and fuel type.", "PSI-142": "Table is a data description, not test data.",
 "PSI-60": "Ground modelling; no experimental table.", "PSI-62": "Ground modelling; no experimental table.",
 "PSI-115": "No experimental table.", "PSI-117": "Ground CFD study.", "PSI-179": "Cabin aerosol sampling; not a combustion test."}

e = pd.read_csv(f"{DATA}/experiments_dashboard.csv", encoding="utf-8-sig", dtype={"test_id": str})
inv = pd.read_csv(f"{DATA}/investigations.csv", encoding="utf-8-sig")
sha = hashlib.sha256(open(f"{DATA}/experiments_dashboard.csv", "rb").read()).hexdigest()

o2, p = e.o2_pct_max_effective, e.pressure_atm_min
e["box"] = "none"
e.loc[(o2 >= 25) | (p <= 1.0), "box"] = "near_miss"
e.loc[(o2 >= O2_MIN) & (p > P_MAX) & (p <= EDGE_P), "box"] = "edge"
e.loc[(o2 >= O2_MIN) & (p <= P_MAX), "box"] = "in_box"
e["p_plot"] = e.pressure_atm_min.where(e.pressure_atm_min.notna(), e.pressure_atm_assumed)
e["plottable"] = o2.notna() & e.p_plot.notna()

def r(x, n=4):
    return None if pd.isna(x) else round(float(x), n)

rows = []
for psi, d in e.groupby("psi_id"):
    g = d.evidence_grade.value_counts()
    b = d[d.box == "in_box"]; bg = b.evidence_grade.value_counts()
    box_pts = sum(BOX_W[k] * v for k, v in bg.items()) + EDGE_PTS * int((d.box == "edge").sum())
    c_moon = min(1.0, box_pts / BOX_SATURATION)
    c_qual = sum(GRADE_W[k] * v for k, v in g.items()) / len(d)
    c_out = ((d.outcome_confidence == "high").sum() + 0.5 * (d.outcome_confidence == "low").sum()) / len(d)
    phase = d.fuel_phase.iloc[0]; c_mat = PHASE_W[phase]
    comp = {"moon": c_moon, "quality": c_qual, "outcome": c_out, "material": c_mat}
    rows.append({"psi_id": psi, "fuel_phase": phase, "rows": len(d),
        "grades": {k: int(g.get(k, 0)) for k in "ABCD"},
        "outcomes": {k: int(v) for k, v in d.outcome.value_counts().items()},
        "known_outcomes": int((d.outcome != "unknown").sum()),
        "in_box": int(len(b)), "in_box_grades": {k: int(bg.get(k, 0)) for k in "ABC"}, "edge": int((d.box == "edge").sum()),
        "o2_range": [r(d.o2_pct_min_effective.min(), 2), r(d.o2_pct_max_effective.max(), 2)],
        "p_range_atm": [r(d.p_plot.min(), 3), r(d.p_plot.max(), 3)],
        "fuels": sorted(d.fuel_or_material.dropna().unique().tolist())[:12],
        "components": {k: round(v, 3) for k, v in comp.items()},
        "score": round(sum(W[k] * v for k, v in comp.items()), 1)})
rk = pd.DataFrame(rows).sort_values(["score", "psi_id"], ascending=[False, True]).reset_index(drop=True)
rk["rank"] = rk.index + 1

investigations = []
for m in inv.itertuples():
    base = {"psi_id": m.psi_id, "title": m.baslik, "acronym": None if pd.isna(m.acronym) else m.acronym, "doi": m.doi,
            "doi_url": f"https://doi.org/{m.doi}", "family": m.aile, "tier": m.tier,
            "license": None if pd.isna(m.license) else m.license, "hardware": None if pd.isna(m.hardware) else m.hardware}
    hit = rk[rk.psi_id == m.psi_id]
    if len(hit):
        base.update({k: v for k, v in hit.iloc[0].to_dict().items() if k != "psi_id"}); base["rank"] = int(base["rank"])
    else:
        base.update({"rank": None, "score": None, "rows": 0, "note": NOTE_EN.get(m.psi_id, "Not harmonized.")})
    investigations.append(base)
investigations.sort(key=lambda x: (x["rank"] is None, x["rank"] or 0, int(x["psi_id"].split("-")[1])))

exps = [{"psi": t.psi_id, "test": t.test_id, "fuel": None if pd.isna(t.fuel_or_material) else t.fuel_or_material, "phase": t.fuel_phase,
         "o2_min": r(t.o2_pct_min_effective, 2), "o2_max": r(t.o2_pct_max_effective, 2),
         "p": r(t.p_plot), "p_max": r(t.pressure_atm_max), "p_assumed": bool(t.pressure_is_assumed),
         "flow_min": r(t.flow_cm_s_min, 2), "flow_max": r(t.flow_cm_s_max, 2),
         "outcome": t.outcome, "conf": None if pd.isna(t.outcome_confidence) else t.outcome_confidence,
         "grade": t.evidence_grade, "o2_basis": None if pd.isna(t.o2_basis) else t.o2_basis,
         "box": t.box, "plottable": bool(t.plottable), "dup": bool(t.is_duplicate),
         "flags": [] if pd.isna(t.quality_flag) else t.quality_flag.split(";"),
         "src": t.source_file, "row": int(t.source_row)} for t in e.itertuples()]

inb = e[e.box == "in_box"]
facts = {"rows": len(e), "investigations_total": len(inv), "investigations_harmonized": int(e.psi_id.nunique()),
         "grades": {k: int(v) for k, v in e.evidence_grade.value_counts().items()},
         "outcomes": {k: int(v) for k, v in e.outcome.value_counts().items()},
         "known_outcomes": int((e.outcome != "unknown").sum()),
         "confidence": {"high": int((e.outcome_confidence == "high").sum()), "low": int((e.outcome_confidence == "low").sum())},
         "plottable": int(e.plottable.sum()), "not_plottable": int((~e.plottable).sum()),
         "moon_box": {"in_box": len(inb), "by_grade": {k: int(v) for k, v in inb.evidence_grade.value_counts().items()},
                      "by_phase": {k: int(v) for k, v in inb.fuel_phase.value_counts().items()},
                      "grade_A_outcomes": {k: int(v) for k, v in inb[inb.evidence_grade == "A"].outcome.value_counts().items()},
                      "edge": int((e.box == "edge").sum()),
                      "edge_outcomes": {k: int(v) for k, v in e[e.box == "edge"].outcome.value_counts().items()}},
         "solid": {"rows": int((e.fuel_phase == "solid").sum()), "max_o2_pct": r(e[e.fuel_phase == "solid"].o2_pct_max_effective.max(), 1),
                   "in_box": int(((e.fuel_phase == "solid") & (e.box == "in_box")).sum())},
         "phases": {k: int(v) for k, v in e.fuel_phase.value_counts().items()}}

app = {"meta": {"data_version": "v3.1", "generated_utc": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
                "source_sha256": sha, "moon_box": {"o2_min_pct": O2_MIN, "p_max_atm": P_MAX, "p_max_psi": 10.2, "edge_p_max_atm": EDGE_P},
                "ranking": {"weights": W, "grade_weights": GRADE_W, "box_points": BOX_W, "edge_points": EDGE_PTS,
                            "box_saturation": BOX_SATURATION, "phase_weights": PHASE_W}},
       "facts": facts, "investigations": investigations, "experiments": exps}
json.dump(app, open(f"{OUT}/app_data.json", "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
flat = rk[["rank", "psi_id", "score", "fuel_phase", "rows", "in_box", "edge", "known_outcomes"]].copy()
for k in W: flat[f"c_{k}"] = rk.components.map(lambda c: c[k])
flat.to_csv(f"{OUT}/investigation_ranking.csv", index=False)
print(flat.to_string(index=False)); print(json.dumps(facts, indent=1))
