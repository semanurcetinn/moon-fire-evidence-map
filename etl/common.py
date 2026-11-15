"""ETL ortak yardımcıları: yollar, config okuma, dosya bulma, tablo okuma, kolon eşleme."""
from pathlib import Path
import re, json
import pandas as pd
import yaml

ROOT = Path(__file__).resolve().parents[2]
ETL = ROOT / "ETL"
PV = ROOT / "PROJE_VERI"
INV = ROOT / "PSI_INVESTIGATIONS"
OUT = ETL / "out"

NON_COL_KEYS = {"note", "unit", "source", "calibration", "keywords", "primary_file", "primary_files", "better_source_for_multivalue",
                "conditions_file", "known_quality_issues", "expected_rows", "fuel_phase", "pressure_assumed", "use", "multivalue",
                "calibration_txt", "verified", "evidence", "o2_sheet", "conditions_sheet", "conditions_join_key", "unit_status",
                "pressure_assumed_atm", "join_key_conditions", "non_test_row_pattern",
                "explode_multivalue", "pressure_map_from_o2", "o2_report_values", "row_flags", "special_tokens", "geometry_note_suffix",
                "flow_source", "flow_unit", "conditions_flow_col", "conditions_outcome_col", "patterns", "negation_guard", "flag_rules", "rules", "outcome_from", "extra_fields", "map", "outcome_col",
                "outcome_review", "geometry_labels", "table_note_from", "table_note_flag", "fuel_derived", "ambiguity_rules", "pos_neg_conflict", "outcome_overrides"}  # v3 / v3.1

def config_path():
    """Öncelik: column_map.final.yaml (v2) > column_map.verified.yaml > column_map.yaml"""
    for n in ("column_map.final.yaml", "column_map.verified.yaml"):
        v = ETL / "config" / n
        if v.exists(): return v
    return ETL / "config" / "column_map.yaml"

def load_config(path=None):
    p = Path(path) if path else config_path()
    cfg = yaml.safe_load(p.read_text(encoding="utf-8"))
    cfg["_path"] = str(p)
    # yorumlardaki "NNN satir" ifadesinden beklenen satır sayısı (expected_rows yoksa)
    raw = p.read_text(encoding="utf-8")
    exp = {}
    for m in re.finditer(r"^\s{2}(PSI-\d+):\s*#\s*(.*)$", raw, re.M):
        n = re.search(r"(\d+)\s*satir", m.group(2))
        if n: exp[m.group(1)] = int(n.group(1))
    cfg["_comment_rows"] = exp
    return cfg

def inv_dir(root, psi):
    return next((d for d in root.iterdir() if d.is_dir() and d.name.startswith(psi + "_")), None)

def find_file(psi, name):
    """Önce PROJE_VERI/<psi>/01_tables, sonra PROJE_VERI/<psi> altı, sonra PSI_INVESTIGATIONS/<psi> altı."""
    for base in (inv_dir(PV, psi), inv_dir(INV, psi)):
        if not base: continue
        direct = base / "01_tables" / name
        if direct.exists(): return direct
        hits = sorted(base.rglob(name))
        if hits: return hits[0]
    return None

def norm(s):
    """v2: boşluk sayısı, büyük/küçük harf ve tire çevresindeki boşluk farkı yok sayılır ('Self -ext' == 'Self-ext')."""
    t = re.sub(r"\s+", " ", str(s)).strip().lower()
    return re.sub(r"\s*-\s*", "-", t)

def read_csv_any(p):
    for enc in ("utf-8-sig", "cp1252", "latin-1"):
        try:
            return pd.read_csv(p, dtype=str, keep_default_na=False, encoding=enc), enc
        except UnicodeDecodeError:
            continue
    raise RuntimeError(f"okunamadı: {p}")

def fuzzy(s):
    return re.sub(r"[^a-z0-9]", "", str(s).lower())

def resolve(col, columns):
    """Yaml kolon adını gerçek kolona eşle. Döner: (gerçek_ad|None, 'exact'|'normalized'|'fuzzy'|None)
    normalized = boşluk/büyük-küçük harf farkı; fuzzy = yalnız harf+rakam aynı (ör. 'Self -ext' ~ 'Self-ext')."""
    if isinstance(col, (list, tuple)):   # v2: takma ad listesi -> ilk bulunan
        for c in col:
            r = resolve(c, columns)
            if r[0]: return r
        return None, None
    if col in columns: return col, "exact"
    n = norm(col)
    for c in columns:
        if norm(c) == n: return c, "normalized"
    f = fuzzy(col)
    for c in columns:
        if fuzzy(c) == f and f: return c, "fuzzy"
    return None, None

def blank_mask(df):
    """Tamamen boş satırlar (tüm hücreler boş/boşluk)."""
    return df.apply(lambda r: all(str(v).strip() == "" for v in r), axis=1)

def sheet_frames(p, data_only=True):
    """xlsx: her sayfa için başlık = ilk 12 satır içinde en çok dolu metin hücresi olan satır."""
    import openpyxl
    wb = openpyxl.load_workbook(p, read_only=True, data_only=data_only)
    out = {}
    for ws in wb.worksheets:
        rows = [list(r) for r in ws.iter_rows(values_only=True)]
        if not rows: continue
        score = [(sum(isinstance(v, str) and v.strip() != "" for v in r), -i) for i, r in enumerate(rows[:12])]
        best, negi = max(score)
        if best < 2: continue
        hi = -negi
        h = [("" if v is None else str(v).strip()) for v in rows[hi]]
        data = []
        for j, r in enumerate(rows[hi + 1:]):
            r = list(r) + [None] * (len(h) - len(r))
            data.append(r[:len(h)])
        df = pd.DataFrame(data, columns=[c if c else f"_col{k}" for k, c in enumerate(h)])
        df.attrs["header_row"] = hi + 1
        out[ws.title] = df
    wb.close(); return out

def collect_cols(spec, path=""):
    """Spec içinden kolon adı referanslarını (anahtar_yolu, kolon) olarak toplar."""
    out = []
    if isinstance(spec, dict):
        for k, v in spec.items():
            if k in NON_COL_KEYS: continue
            if k in ("col",) and isinstance(v, (str, list)): out.append((path or k, v))
            elif k in ("cols", "parse_from", "geometry", "diluents") and isinstance(v, list): out += [(f"{path}.{k}" if path else k, c) for c in v if isinstance(c, (str, list))]
            elif k in ("test_id", "material", "fuel", "join_key", "flow_col") and isinstance(v, str): out.append((k, v.split("#  ")[0].strip() if "  #" in v else v))
            elif isinstance(v, dict): out += collect_cols(v, f"{path}.{k}" if path else k)
    return out

def primary_files(spec):
    return spec.get("primary_files") or ([spec["primary_file"]] if spec.get("primary_file") else [])

def file_variant(fname):
    f = fname.lower()
    return "inverse" if "inverse" in f else "normal" if "normal" in f else None
