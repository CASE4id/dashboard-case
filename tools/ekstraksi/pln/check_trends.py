"""Year-on-year review list: flags values that jump >35% and reverse the next year (spike/dip).
A label swap or misaligned row produces exactly this pattern, so every flag should be checked against the PDF once.
Usage: python3 pln/check_trends.py output/pln_statistics_<first>_<last>/pln_statistics_long.csv  -> writes trend_review.csv next to it"""
import sys, os, pandas as pd
L = pd.read_csv(sys.argv[1])
U = L[L.row_type.isin(["distribution_unit", "regional_unit", "subsidiary", "generation_subsidiary", "national_total", "regional_total"])]
flags = []
for (t, c), g in U.groupby(["table_id", "indicator"]):
    if c.endswith("_pct") or c.endswith("_share_pct"):
        continue
    s = g.pivot_table(index="unit_id", columns="year", values="value", aggfunc="first")
    for u, r in s.iterrows():
        ys = [y for y in r.index if pd.notna(r[y]) and r[y] > 0]
        for a, b, cc in zip(ys, ys[1:], ys[2:]):
            if b - a == 1 and cc - b == 1:
                up, down = r[b] / r[a], r[cc] / r[b]
                if max(r[a], r[b], r[cc]) >= 50 and ((up > 1.35 and down < 0.74) or (up < 0.74 and down > 1.35)):
                    flags.append(dict(table_id=t, indicator=c, unit_id=u, year=b, previous=r[a], value=r[b], next=r[cc],
                                      checked_against_pdf="", outcome=""))
F = pd.DataFrame(flags).sort_values(["table_id", "indicator", "year"])
out = os.path.join(os.path.dirname(sys.argv[1]), "trend_review.csv")
F.to_csv(out, index=False)
print(f"trend review: {len(F)} spike/dip flags written to {out}")
