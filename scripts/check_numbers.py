"""Number check for public texts (S2-D1).

Extracts every number from the given files and lists those that are not found in
web/data/app_data.json (`facts`, `investigations[]`, `meta`) or in the allowed
constants. An empty list means every number is traceable to the frozen dataset.

Usage (from the repo root):
  python scripts/check_numbers.py                      # default: web/data/insights.json
  python scripts/check_numbers.py README.md docs/METHOD_RANKING.md docs/SUBMISSION_TEXT.md

For .json files only string values are checked (field names and model metadata are skipped).
Exit code 0 = empty list, 1 = numbers to review, 2 = file error.
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# Contract: Moon box limits, years, PSI numbers (PSI ids are stripped below).
ALLOWED_CONSTANTS = {"30", "10.2", "0.694", "0.75"}
# Numbers quoted from the challenge description (Earth 21 % / 14.7 psi, spacesuit 100 % / 4.3 psi,
# "more than a 40 % increase", Artemis II "80,000 miles", Researcher's Guide 2015) and the two raw
# PSI-20 cell values ("3400%"/"2100%") that docs/COLUMNS.md quotes verbatim.
ALLOWED_CONSTANTS |= {"21", "14.7", "100", "4.3", "40", "80000", "2015", "3.6", "50", "3400", "2100"}
SKIP_JSON_KEYS = {"id", "generated_with", "reviewed_by", "sources", "evidence", "doi", "doi_url", "psi"}

# Tokens that contain digits but are identifiers, not quantities.
IDENTIFIER_PATTERNS = [
    r"https?://\S+",                     # URLs
    r"\b10\.\d{4,9}/\S+",                # DOIs
    r"\bPSI-\d+\b",                      # investigation ids
    r"\b[0-9a-f]{7,64}\b",               # hashes
    r"\bv\d+(?:\.\d+)*\b",               # versions (v3.1)
    # report ids must be stripped BEFORE years, otherwise "TP-2015-216046" loses its year and leaves 216046
    r"\b(?:NASA/)?TP-\d{4}-\d+\b", r"\b(?:NASA\s+)?TM-\d+\b", r"\bNTRS\s*\d+\b", r"\bSAE\s*\d{4}-\d{2}-\d{4}\b",
    r"\b(?:19|20)\d0s\b",                # decades (1970s)
    r"\b(?:19|20)\d\d\b",                # years
    r"\b(?:SAFFIRE|FLEX|BASS|DAFT|SAME|CFI)-(?:\d+|I{1,3}|R|G)\b",
    r"\b(?:[A-Z][a-z]?\d*)*[A-Z][a-z]?\d+(?:[A-Z][a-z]?\d*)*\b",   # chemical formulas: O2, CO2, C2H4, C12H26
    r"O₂|CO₂|N₂",
    r"\b\d+(?:st|nd|rd|th)\b",           # ordinals
    r"\b\d+\s*[×x]\s*\d+\b",             # screen sizes like 1366×768
]


def number_forms(v):
    """All textual forms under which a numeric value may legitimately appear."""
    out = set()
    if isinstance(v, bool) or not isinstance(v, (int, float)):
        return out
    f = float(v)
    # Integer rounding of a non-integer value is NOT accepted (45.1 must not allow "45").
    for nd in range(1, 4):
        s = f"{f:.{nd}f}"
        out.add(s)
        if "." in s:
            out.add(s.rstrip("0").rstrip("."))
    if f.is_integer():
        out.add(str(int(f)))
    return out


def collect(obj, acc):
    if isinstance(obj, dict):
        for v in obj.values():
            collect(v, acc)
    elif isinstance(obj, list):
        for v in obj:
            collect(v, acc)
    else:
        acc |= number_forms(obj)


def allowed_numbers():
    app = json.loads((ROOT / "web/data/app_data.json").read_text(encoding="utf-8"))
    acc = set(ALLOWED_CONSTANTS)
    collect(app["facts"], acc)
    collect(app["investigations"], acc)
    collect(app["meta"]["moon_box"], acc)
    collect(app["meta"]["ranking"], acc)
    # numbers that appear inside investigation strings (e.g. "50% butane", "12 rows")
    for inv in app["investigations"]:
        geo = (inv.get("variables") or {}).get("geometry_values") or []
        for s in [inv.get("note") or ""] + list(inv.get("fuels") or []) + list(geo):
            acc |= set(re.findall(r"\d+(?:\.\d+)?", s))
    return acc


def texts_from(path):
    """Yield (location, text) pairs."""
    if path.suffix == ".json":
        data = json.loads(path.read_text(encoding="utf-8"))

        def walk(o, loc):
            if isinstance(o, dict):
                for k, v in o.items():
                    if k in SKIP_JSON_KEYS:
                        continue
                    yield from walk(v, f"{loc}.{k}" if loc else k)
            elif isinstance(o, list):
                for i, v in enumerate(o):
                    yield from walk(v, f"{loc}[{i}]")
            elif isinstance(o, str):
                yield loc, o
        yield from walk(data, "")
    else:
        for i, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
            yield f"line {i}", line


def numbers_in(text):
    t = text
    for pat in IDENTIFIER_PATTERNS:
        t = re.sub(pat, " ", t)
    found = []
    for m in re.finditer(r"(?<![\w.])\d{1,3}(?:,\d{3})+(?:\.\d+)?|(?<![\w.])\d+(?:\.\d+)?", t):
        found.append(m.group().replace(",", ""))
    return found


def write_summary(files, checked, issues):
    """--write-summary: web/data/checks.json, read by the dashboard's visible checker card."""
    import datetime
    import subprocess
    facts_ok = subprocess.run([sys.executable, str(ROOT / "scripts/verify_facts.py")], capture_output=True, text=True).returncode == 0
    out = {"run_utc": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
           "texts_checked": [f.name for f in files], "numbers_checked": checked,
           "mismatches": len(issues), "facts_ok": facts_ok}
    (ROOT / "web/data/checks.json").write_text(json.dumps(out, indent=1) + "\n", encoding="utf-8")
    print(f"wrote web/data/checks.json: {checked} numbers, {len(issues)} mismatches, facts_ok={facts_ok}")


def main(argv):
    summary = "--write-summary" in argv
    argv = [a for a in argv if a != "--write-summary"]
    files = [Path(a) for a in argv] or [ROOT / "web/data/insights.json"]
    allowed = allowed_numbers()
    issues = []
    checked = 0
    for f in files:
        p = f if f.is_absolute() else (Path.cwd() / f)
        if not p.exists():
            print(f"ERROR: {f} not found")
            return 2
        for loc, text in texts_from(p):
            for n in numbers_in(text):
                checked += 1
                if n not in allowed:
                    issues.append((str(f), loc, n, text.strip()[:110]))
    if summary:
        write_summary(files, checked, issues)
    if issues:
        print(f"{len(issues)} number(s) not found in app_data.json or allowed constants:")
        for f, loc, n, ctx in issues:
            print(f"  {f} [{loc}] {n!r}: {ctx}")
        return 1
    print("[]  every number is traceable to app_data.json or an allowed constant")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
