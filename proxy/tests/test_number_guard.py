"""Run: python proxy/tests/test_number_guard.py (from the repo root)."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from number_guard import guard  # noqa: E402

CTX = {"counts": {"count": 87, "by_grade": {"A": 20, "B": 46, "C": 21}, "total_considered": 1805},
       "notes": ["Highest O2 among solid-fuel tests is 22.7 %."],
       "passages": [{"id": "limit-solid-o2", "text": "No solid-fuel test in PSI reaches 30 % oxygen."}]}


def test_keeps_context_numbers():
    clean, ok, removed = guard("87 rows lie in the box, 20 of them grade A [PSI-159]. Solid fuels stop at 22.7 % [limit-solid-o2].", CTX)
    assert ok and not removed and "87" in clean and "22.7" in clean


def test_drops_invented_numbers():
    clean, ok, removed = guard("87 rows lie in the box [PSI-159]. About 45 % of them would burn.", CTX)
    assert not ok and len(removed) == 1 and "45" not in clean and clean.startswith("87")


def test_thousands_separator_and_ids():
    clean, ok, _ = guard("Of 1,805 rows, 87 are in the box [PSI-159] [PSI-10].", CTX)
    assert ok and "1,805" in clean


def test_all_removed_means_empty():
    clean, ok, removed = guard("There are 999 tests.", CTX)
    assert clean == "" and not ok and removed


if __name__ == "__main__":
    for name, fn in list(globals().items()):
        if name.startswith("test_"):
            fn()
            print("PASS", name)
