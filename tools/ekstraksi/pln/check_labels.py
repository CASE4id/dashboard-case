"""Cross-table label check: a unit's generation in Table 2 should match its generation in Table 23.
If a unit's Table 2 value equals a DIFFERENT unit's Table 23 value, the row labels are probably shifted.
Usage: python3 pln/check_labels.py work/pln/2014 work/pln/2015 ..."""
import sys, pandas as pd
total = 0
for d in sys.argv[1:]:
    w = pd.read_pickle(f"{d}/.wide.pkl")
    a = w["t02"].set_index("unit_id")[["own_production_gwh", "leased_gwh"]].fillna(0).sum(axis=1)
    t = w["t23"].groupby("unit_id").first()
    own_only = t[[c for c in t.columns if c.startswith("own_") and c.endswith("_gwh") and not c.startswith("own_and")]].sum(axis=1, min_count=1)
    lut = {}
    for s in (t.own_and_leased_subtotal_gwh, own_only):
        lut.update({round(v, 2): k for k, v in s.items() if pd.notna(v) and v > 50})
    own_match = lambda u, v: any(u in s.index and pd.notna(s[u]) and abs(s[u] - v) < 0.02 for s in (t.own_and_leased_subtotal_gwh, own_only))
    shifts = [(u, lut[round(v, 2)]) for u, v in a.items() if round(v, 2) in lut and lut[round(v, 2)] != u
              and not own_match(u, v) and not u.startswith(("prov_", "proj_"))]
    total += len(shifts)
    if shifts: print("  MISMATCH label shift?", d, shifts)
print("label-shift suspects:", total)
