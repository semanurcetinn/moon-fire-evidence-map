# Submission text (copy into the Space Apps project form)

## Project Name
Moon Fire Evidence Map

## High-Level Project Summary
Moon Fire Evidence Map turns NASA's scattered microgravity combustion data into one evidence map for fire safety in the next crewed habitats. We harmonized 12 Physical Sciences Informatics (PSI) investigations into a single table of 1,805 test rows without correcting any value, graded every row by evidence quality, and placed it by oxygen and pressure next to the Moon habitat box (oxygen at or above 30 %, pressure at or below 10.2 psi). The dashboard ranks investigations by how much they tell us about that atmosphere and shows where the evidence stops: 87 rows lie in the box, only 20 of them clean, and no solid-fuel test in PSI goes above 22.7 % oxygen. Researchers see at once what is known and what still needs testing.

## Link to Project Demo
DEMO_LINK

## Link to Final Project
https://github.com/semanurcetinn/moon-fire-evidence-map
(Live dashboard: https://semanurcetinn.github.io/moon-fire-evidence-map/)

## Detailed Project Description
**What it does.** Moon Fire Evidence Map is a web dashboard that summarizes, ranks and interprets NASA's microgravity combustion investigations for fire safety in crewed environments: spacecraft, space stations, a Moon base and pressurized rovers. Its central view, the Evidence Map, places every harmonized test row by oxygen and pressure and marks the Moon habitat box expected for Artemis-era habitats (oxygen at or above 30 %, pressure at or below 10.2 psi). Colour shows the outcome of each test, opacity shows how trustworthy the row is, and a vertical line marks 22.7 %, the highest oxygen in any solid-fuel test in PSI.

**How it works.** We reviewed 25 PSI combustion-related investigations and harmonized the 12 that publish test-level tables into one table of 1,805 rows. No source value was corrected: suspect values are kept and flagged, and every row traces back to its NASA source file and row. Each row receives an evidence grade: A for clean test-level rows, B when oxygen is the burner oxidizer fraction rather than cabin air, C for approximate rows, D when oxygen or pressure is missing. A transparent score (35 × Moon-box coverage + 25 × evidence quality + 20 × recorded outcomes + 20 × material type) ranks the investigations; it measures data coverage, not scientific merit, and the order does not change when all weights are equal. An AI layer adds plain-language summaries for each investigation and for the main findings. These texts were written once from the frozen dataset, every number in them is checked by a script against the data, and the team reviewed them. An "Ask the evidence" box answers questions such as "solid fuel tests above 30% oxygen" by filtering and counting the data live and retrieving the most relevant reviewed texts; it does not generate text at query time. Any filtered selection can be downloaded as CSV for modelling.

**Benefits.** Engineers and researchers see in one minute which investigations matter for a Moon-habitat atmosphere (ACME CFI-G first, then FLEX), which test rows are clean enough for predictive modelling, and where the gaps are. The dashboard also points to the research behind fire-safety equipment: FLEX on suppression by diluting the atmosphere, BASS and SAFFIRE on how cabin materials burn, SPICE on soot and smoke.

**What we learned and the limits.** The clearest finding is a gap: all evidence inside the Moon habitat box comes from gas flames and liquid droplets, and no solid fuel was burned above 22.7 % oxygen. Only 668 of 1,805 rows record an outcome, and "not recorded" does not mean the flame kept burning. Grade B oxygen values are burner oxidizer fractions, and PSI-20 pressures are mapped from its final report. PSI has no partial-gravity combustion data yet, so microgravity and normal-gravity results can only bound lunar conditions. The tool reports what was tested; it is not a safety assessment.

**Tools.** Python and pandas for the data pipeline and checks, Plotly.js for the charts, plain HTML, CSS and JavaScript, GitHub Pages for hosting.

## NASA Data
NASA Physical Sciences Informatics (PSI), https://psi.hq.nasa.gov

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
