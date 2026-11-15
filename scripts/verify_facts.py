"""Independent check of the headline numbers (S2-A4).

Recomputes six facts from the frozen CSV with pandas, WITHOUT using
build_dashboard_data.py, and compares them with (1) contract §8 and
(2) the `facts` block of web/data/app_data.json.
Prints OK and exits 0 when everything matches; otherwise lists the
differences and exits 1.

Usage: python scripts/verify_facts.py            (from the repo root)
"""
import json
import sys
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
O2_MIN, P_MAX, EDGE_P = 30.0, 0.694, 0.75  # Moon habitat box, contract §7

# Contract §8 (the single source of numbers)
EXPECTED = {
    "rows": 1805,
    "grades": {"A": 859, "B": 263, "C": 173, "D": 510},
    "in_box": 87,
    "in_box_grades": {"A": 20, "B": 46, "C": 21},
    "edge": 17,
    "solid_max_o2": 22.7,
    "plottable": 1295,
}

e = pd.read_csv(ROOT / "data/experiments_dashboard.csv", encoding="utf-8-sig", dtype={"test_id": str})
o2 = e["o2_pct_max_effective"]
p_measured = e["pressure_atm_min"]                       # box uses table pressure only
p_plot = p_measured.fillna(e["pressure_atm_assumed"])    # plot pressure falls back to assumed
in_box = (o2 >= O2_MIN) & (p_measured <= P_MAX)
edge = (o2 >= O2_MIN) & (p_measured > P_MAX) & (p_measured <= EDGE_P)

computed = {
    "rows": len(e),
    "grades": {g: int((e["evidence_grade"] == g).sum()) for g in "ABCD"},
    "in_box": int(in_box.sum()),
    "in_box_grades": {g: int((e.loc[in_box, "evidence_grade"] == g).sum()) for g in "ABC"},
    "edge": int(edge.sum()),
    "solid_max_o2": round(float(o2[e["fuel_phase"] == "solid"].max()), 1),
    "plottable": int((o2.notna() & p_plot.notna()).sum()),
}

f = json.loads((ROOT / "web/data/app_data.json").read_text(encoding="utf-8"))["facts"]
from_json = {
    "rows": f["rows"],
    "grades": {g: f["grades"][g] for g in "ABCD"},
    "in_box": f["moon_box"]["in_box"],
    "in_box_grades": {g: f["moon_box"]["by_grade"].get(g, 0) for g in "ABC"},
    "edge": f["moon_box"]["edge"],
    "solid_max_o2": f["solid"]["max_o2_pct"],
    "plottable": f["plottable"],
}

problems = []
for key, want in EXPECTED.items():
    for label, got in (("pandas", computed[key]), ("app_data.facts", from_json[key])):
        if got != want:
            problems.append(f"{key}: contract {want} != {label} {got}")

if problems:
    print("MISMATCH")
    print("\n".join(problems))
    sys.exit(1)
print("OK")
