"""Every number in a written answer must appear in the context the browser sent.

Sentences with any other number are removed; if nothing is left the answer is withdrawn.
"""
import json
import re

NUM_RE = re.compile(r"\d[\d,]*(?:\.\d+)?")
SENT_RE = re.compile(r"(?<=[.!?])\s+")
# Identifiers that contain digits but are not quantities.
ID_RE = re.compile(r"PSI-\d+|\[[^\]]*\]|\b10\.\d{4,9}/\S+|\bO2\b|O₂|CO2|C2H4|C3H8|CH4|C12H26|FM2|SAFFIRE-\w+|FLEX-\d")
# Constants quoted from the challenge description (Moon box, Earth air, spacesuit).
ALLOWED = {"30", "10.2", "0.694", "0.75", "21", "14.7", "100", "4.3"}


def _forms(value):
    out = set()
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return out
    f = float(value)
    if f.is_integer():
        out.add(str(int(f)))
    for nd in (1, 2, 3):
        s = f"{f:.{nd}f}"
        out.add(s)
        out.add(s.rstrip("0").rstrip("."))
    return out


def context_numbers(context):
    nums = set(ALLOWED)

    def walk(o):
        if isinstance(o, dict):
            for v in o.values():
                walk(v)
        elif isinstance(o, list):
            for v in o:
                walk(v)
        elif isinstance(o, str):
            nums.update(n.replace(",", "") for n in NUM_RE.findall(ID_RE.sub(" ", o)))
        else:
            nums.update(_forms(o))

    walk(context)
    return nums


def numbers_in(text):
    return [n.replace(",", "").rstrip(".") for n in NUM_RE.findall(ID_RE.sub(" ", text))]


def guard(answer, context):
    """Return (clean_answer, checked, removed_sentences)."""
    allowed = context_numbers(context)
    kept, removed = [], []
    for sentence in SENT_RE.split((answer or "").strip()):
        if not sentence:
            continue
        bad = [n for n in numbers_in(sentence) if n not in allowed]
        (removed if bad else kept).append(sentence)
    return " ".join(kept), not removed, removed


if __name__ == "__main__":
    ctx = {"counts": {"count": 87, "by_grade": {"A": 20}}, "passages": [{"text": "highest is 22.7 %"}]}
    print(json.dumps(guard("87 rows lie in the box [PSI-159]. About 45 % would burn.", ctx)))
