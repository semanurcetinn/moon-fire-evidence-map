# Submission text (copy into the Space Apps project form)

## Project Name
Moon Fire Evidence Map

## High-Level Project Summary
Moon Fire Evidence Map turns NASA's scattered microgravity combustion data into one evidence map for fire safety in crewed habitats. We harmonized 12 Physical Sciences Informatics (PSI) investigations into one table of 1,805 test rows without correcting any value, graded every row by evidence quality, and placed it by oxygen and pressure. An Atmosphere Journey walks from Earth's air to the expected Moon habitat (oxygen at or above 30 %, at most 10.2 psi) to a spacesuit and counts the recorded tests near each. The finding: 87 rows lie in the Moon box, only 20 of them clean, and no solid-fuel test in the PSI tables goes above 22.7 % oxygen.

## Link to Project Demo
https://semanurcetinn.github.io/moon-fire-evidence-map/demo/MoonFireEvidenceMap_demo.pdf

## Link to Final Project
https://github.com/semanurcetinn/moon-fire-evidence-map
(Live dashboard: https://semanurcetinn.github.io/moon-fire-evidence-map/)

## Detailed Project Description
**What it does.** A web dashboard that summarizes, ranks and interprets NASA's microgravity combustion investigations for fire safety in spacecraft, space stations, a Moon base and pressurized rovers. The Evidence Map places every harmonized test row by oxygen and pressure, marks the Moon habitat box, colours each test by its outcome and fades it by its evidence grade; a line marks 22.7 %, the highest oxygen in any solid-fuel test in the PSI tables.

**How it works.** We reviewed 25 PSI combustion-related investigations and harmonized the 12 that publish test-level tables into 1,805 rows. No source value was corrected: suspect values are flagged, and every row traces back to its NASA source file and row. Each row gets an evidence grade: A clean, B oxygen is the burner oxidizer fraction, C approximate, D oxygen or pressure missing. A transparent score (35 × Moon-box coverage + 25 × evidence quality + 20 × recorded outcomes + 20 × material type) ranks the investigations; it measures data coverage, not scientific merit, and the order does not change with equal weights. Each investigation card lists what was varied, what was held constant and what the table lacks.

**Impact.** In one minute an engineer sees which investigations matter for a Moon-habitat atmosphere (ACME CFI-G first, then FLEX), which rows are clean enough for predictive modelling, and where the gaps are. Any filtered selection downloads as CSV. The map links the data to fire-safety equipment: FLEX on suppression by diluting the atmosphere, BASS and SAFFIRE on how cabin materials burn, SPICE on soot and smoke.

**Creativity.** The Atmosphere Journey moves a probe from Earth to the Moon habitat box to a spacesuit; everything that moves is a recorded test, an outcome share or an evidence grade, never a flame model.

**Validity.** Summary texts were prepared once with an SI assistant from the frozen dataset and reviewed by the team; a script checks every number in the published texts against the data, and a card on the page shows the result. The "Ask the evidence" box counts matching tests in the browser and retrieves the most relevant reviewed texts.

**Relevance.** The work follows the challenge: oxygen and pressure of the planned Moon base, flammability of solid materials, suppression, detection, and what this research gives back on Earth (water-mist extinguishers, smoke detection, firefighter gear).

**Presentation.** One page, English, phone-ready, colour-blind-friendly palette, and a short guided judge tour (add `#tour` to the URL).

**Limits.** All evidence inside the Moon box comes from gas flames and liquid droplets; no solid fuel was burned above 22.7 % oxygen in the PSI tables. Only 668 of 1,805 rows record an outcome, and "not recorded" does not mean the flame kept burning. Grade B oxygen values are burner oxidizer fractions; PSI-20 pressures are mapped from its final report. PSI has no partial-gravity combustion data yet (LUCI and FM2 are expected to add it). The tool reports what was tested; it is not a safety assessment.

## NASA Data
NASA Physical Sciences Informatics (PSI), https://psi.nasa.gov

Harmonized investigations (12):
- PSI-10 – Advanced Combustion via Microgravity Experiments / Flame Design (ACME Flame Design) – https://doi.org/10.60555/w4zy-bt45 (license not specified)
- PSI-20 – Advanced Combustion via Microgravity Experiments – Burning Rate Emulator (ACME BRE) – https://doi.org/10.60555/vb93-3y72
- PSI-25 – Burning and Suppression of Solids – II (BASS-II) – https://doi.org/10.60555/4qc4-de67
- PSI-26 – Burning and Suppression of Solids (BASS) – https://doi.org/10.60555/58h4-dy80
- PSI-39 – Cool Flames Investigation (CFI) – https://doi.org/10.60555/m6pj-a914
- PSI-68 – Flame Extinguishment Experiment – 2 (FLEX-2) – https://doi.org/10.60555/byp8-h018
- PSI-69 – Flame Extinguishment Experiment (FLEX) – https://doi.org/10.60555/mbq8-0451
- PSI-98 – Spacecraft Fire Safety Experiment-I (SAFFIRE-I) – https://doi.org/10.60555/0t15-1z43
- PSI-99 – Spacecraft Fire Experiment-II (SAFFIRE-II) – https://doi.org/10.60555/2chp-m469
- PSI-100 – Spacecraft Fire Experiment-III (SAFFIRE-III) – https://doi.org/10.60555/040q-4h36
- PSI-107 – Smoke Point In Co-flow Experiment (SPICE) – https://doi.org/10.60555/9kbh-e962
- PSI-159 – Advanced Combustion via Microgravity Experiments / Cool Flames Investigation with Gases (ACME CFI-G) – https://doi.org/10.60555/cyt1-kh64

Also reviewed, not harmonized (13): PSI-21, PSI-22, PSI-23, PSI-47, PSI-60, PSI-62, PSI-101, PSI-102, PSI-106, PSI-115, PSI-117, PSI-142, PSI-179 (DOIs in `data/investigations.csv`).

Supporting NASA reports: NASA/TP-2015-216046 (FLEX); ACME Burning Rate Emulator final report; ACME CFI-G final report; BASS-II summary report (NASA TM-20210011385); SAFFIRE publication NTRS 20180005168.

## Space Agency Partner & Other Data
None. Open-source software: Python, pandas, PyYAML, openpyxl, Plotly.js; hosting on GitHub Pages.

## References
- NASA Space Apps Challenge 2026, Flame in Freefall challenge description: https://www.spaceappschallenge.org/2026/challenges/flame-in-freefall/
- NASA Physical Sciences Informatics: https://psi.nasa.gov and the 25 investigation DOIs above
- Supporting NASA reports listed under NASA Data
- Software: Python, pandas, PyYAML, openpyxl, Plotly.js, GitHub Pages

## Demo slide text
(Visible text of the 7 demo slides, kept here so that scripts/check_numbers.py also checks the slides. Not a form field.)

1. Moon Fire Evidence Map · Where NASA's microgravity fire data stops for a Moon habitat · Space Chillers · Muğla Sıtkı Koçman University · NASA Space Apps 2026 · Flame in Freefall · Şehr-i Sena Demirbaş · Sema Nur Çetin · Esra Ceren Saçmaz · Müberra Çoban · Fatma Susam · Mehmet Doğukan Özer · semanurcetinn.github.io/moon-fire-evidence-map
2. The question · ≥ 30 % O₂ · ≤ 10.2 psi · Expected Moon base and rover air · Apollo 1, 1967 · Fire in an oxygen-filled spacecraft · Mir, 1997 · Fire from an oxygen generator failure · What does NASA's PSI data actually say about fire there? · 2
3. What we built · 25 · PSI investigations reviewed · 12 · harmonized · 1,805 · test rows, one table · A–D · evidence grade per row · No value corrected · every row traced to its source file and row · 3
4. Every test, placed by oxygen and pressure · Earth → Moon habitat box → spacesuit · dashed line: highest solid-fuel O₂, 22.7 % · 4
5. What the data says · 87 · rows in the Moon habitat box · 20 · clean, all gas flames: 13 extinguished, 4 sustained, 2 cool flames · 0 · solid-fuel tests ≥ 30 % O₂; max 22.7 % in PSI · 668 · of 1,805 rows record an outcome; "not recorded" ≠ "did not extinguish" · 5
6. Ranking + SI layer · Transparent score: data coverage, not scientific merit · Ask the evidence: counts computed from the data · Every number machine-checked · 6
7. Limits and what comes next · No solid fuel ≥ 30 % O₂ in PSI · Grade B O₂ is burner oxidizer · PSI-20 pressures report-mapped · No partial-gravity data yet (LUCI, FM2) · On Earth · Water-mist extinguishers, smoke detection, firefighter gear · Not a safety assessment · github.com/semanurcetinn/moon-fire-evidence-map · 7
