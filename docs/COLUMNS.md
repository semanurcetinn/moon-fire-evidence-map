# Column guide (English)

Columns of the dashboard dataset (`web/data/app_data.json → experiments[]`), which are also the columns of the dashboard's **Download CSV** button. The full source table `data/experiments.csv` is described in Turkish in `data/data_dictionary.csv` and `docs/DATA_CARD.md`.

| Column | Meaning |
|---|---|
| `psi` | PSI investigation id (e.g. PSI-159) |
| `test` | Test id from the source table; **not unique** – the unique key is `psi + test + src + row` |
| `fuel` | Fuel or material, as written in the source |
| `phase` | `solid`, `liquid` or `gas` |
| `o2_min`, `o2_max` | Oxygen, % (effective value: raw cells "3400%"/"2100%" in PSI-20 are read as 34 % / 21 % per the BRE final report; the raw value is kept in `data/experiments.csv`) |
| `p` | Pressure used on the map, atm: the measured table value, otherwise the assumed or report-mapped value |
| `p_max` | Highest measured pressure, atm |
| `p_assumed` | `true` when the pressure is assumed (PSI-25: 1 atm) or mapped from a report (PSI-20), not measured |
| `flow_min`, `flow_max` | Flow speed, cm/s |
| `outcome` | `extinguished` · `sustained` · `blowoff` · `no_ignition` · `cool_flame` · `no_hot_ignition` · `droplet_disruption` · `unknown` (= not recorded in the source) |
| `conf` | Outcome confidence: `high` (outcome column in the source) or `low` (parsed from free text or reviewed by hand); empty when not recorded |
| `grade` | Evidence grade: **A** clean test-level row · **B** oxygen is the burner oxidizer fraction · **C** approximate (summary row, assumed or report-mapped pressure, derived oxygen or anomaly) · **D** oxygen or pressure missing |
| `o2_basis` | `ambient`, `oxidizer_stream` (inverse flames) or `derived` |
| `box` | `in_box` (O₂ ≥ 30 % and measured p ≤ 0.694 atm) · `edge` (O₂ ≥ 30 %, 0.694 < p ≤ 0.75 atm) · `near_miss` · `none` |
| `plottable` | `true` when oxygen and pressure are both present (row can be placed on the map) |
| `dup` | `true` for the second and later copies of an identical row in the source file (kept, flagged) |
| `flags` | Quality flags, separated by `;` (details per row in `data/quality_log.csv`) |
| `src`, `row` | Source file name and row number (header = row 1) |
