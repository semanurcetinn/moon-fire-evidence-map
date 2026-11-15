# How the Moon-relevance evidence score is computed

**This score measures data coverage for the Moon-habitat question, not scientific merit.**
It ranks the 12 harmonized investigations by how much test-level evidence they give about fire in the expected Moon-habitat atmosphere: oxygen ≥ 30 % and pressure ≤ 10.2 psi (0.694 atm). The other 13 reviewed investigations are not ranked (see below).

## Formula

```
score = 35·moon + 25·quality + 20·outcome + 20·material        (0–100)
```

| Component | Definition | Range |
|---|---|---|
| `moon` | Rows inside the Moon habitat box, weighted by evidence grade (A 1, B 0.5, C 0.25) plus 0.25 for each row in the edge zone (O₂ ≥ 30 %, 0.694 < p ≤ 0.75 atm), divided by 20 and capped at 1. Box membership uses only pressure recorded in the source table. | 0–1 |
| `quality` | Mean evidence-grade weight of all rows (A 1, B 0.66, C 0.33, D 0). | 0–1 |
| `outcome` | Share of rows with a recorded outcome; high-confidence outcomes count 1, low-confidence (parsed from free text) count 0.5. | 0–1 |
| `material` | Fuel phase: solid 1.0, liquid 0.6, gas 0.4. **Editorial choice**: solids are closest to crew-cabin materials. | 0.4–1 |

Evidence grades: **A** test-level row, ambient O₂, measured pressure, no anomaly · **B** measured, but O₂ is the burner oxidizer fraction, not cabin air · **C** summary row, assumed or report-mapped pressure, derived O₂ or anomaly · **D** O₂ or pressure missing.

**Worked example – PSI-159 (ACME CFI-G), rank 1.** 48 rows in the box (A 20, B 28) give `moon` = 1.0; `quality` = 0.843; `outcome` = 0.997; `material` = 0.4 (gas). Score = 35 × 1.0 + 25 × 0.843 + 20 × 0.997 + 20 × 0.4 = **84.0**.

Scores are produced by `scripts/build_dashboard_data.py` from `data/experiments_dashboard.csv` and published in `web/data/investigation_ranking.csv`. The scores of PSI-159, PSI-69 and PSI-20 were recomputed by hand from the source rows and match.

## Sensitivity

With equal weights (25 each) the order of all 12 investigations is unchanged; PSI-159, PSI-69 and PSI-26 stay the top three. The ranking is therefore not an artefact of the 35/25/20/20 weighting. The weights were not changed after this test.

## Known weaknesses

1. **`material` is an editorial choice.** It rewards solid fuels because cabin fires involve solid materials; a different choice would move the solid-fuel investigations.
2. **SAFFIRE I–III (PSI-98, PSI-99, PSI-100) rank low** because their tables have no pressure, so every row is grade D and only the `material` component scores. This says nothing about the importance of these large-scale fire experiments, only that their published tables cannot be placed in the oxygen–pressure plane.
3. **SPICE (PSI-107) ranks last** although it has 469 rows, because its table has neither oxygen nor pressure.
4. **13 catalog-only investigations are not ranked.** They were reviewed but have no test table with oxygen and pressure (ground modelling studies, smoke and aerosol measurements, tables without conditions). The reason for each is listed in the dashboard and in `web/data/app_data.json` (`note`).

Data: NASA Physical Sciences Informatics (PSI), frozen package v3.1 (`docs/FREEZE.md`). No source value was corrected; every row traces back to its NASA source file and row.
