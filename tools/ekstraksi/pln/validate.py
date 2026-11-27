import pandas as pd, sys
w = pd.read_pickle(sys.argv[1])
for _t, _df in w.items():                                  # a unit_id must appear only once per table
    _d = _df[_df.unit_id.duplicated(keep=False)]
    if len(_d): print("  MISMATCH duplicate unit_id", _t, _d[["row_order", "unit_id", "unit_name_reported"]].values.tolist())

def chk(tid, cols, total, tol=0.6):
    cols = [c for c in cols if w[tid][c].notna().any()]
    if w[tid][total].isna().all(): print(tid, "skip", total); return
    df = w[tid][w[tid][total].notna()].fillna(0); bad = 0
    for _, r in df.iterrows():
        s = sum(r[c] for c in cols); 
        if abs(s - r[total]) > tol: bad += 1; print("  MISMATCH", tid, r.unit_name, round(s,2), r[total])
    print(tid, "row-sum check", total, "bad:", bad)
def colsum(tid, cols):
    df = w[tid].fillna(0); bad=0
    if not (df.unit_name=="Luar Jawa").any() or not (df.unit_name=="Jawa").any(): print(tid,"NO REGION ROWS"); return
    units = df[df.row_type.isin(["regional_total"])==False]
    for c in cols:
        lj = df[(df.region=="Luar Jawa") & ~df.row_type.isin(["province","regional_total"])][c].sum()
        jw = df[(df.region=="Jawa") & ~df.row_type.isin(["province","regional_total"])][c].sum()
        LJ = df[df.unit_name=="Luar Jawa"][c].iloc[0]; JW = df[df.unit_name=="Jawa"][c].iloc[0]
        if abs(lj-LJ)>1 or abs(jw-JW)>1: bad+=1; print("  COL", tid, c, round(lj,2), LJ, round(jw,2), JW)
    print(tid, "column-sum check bad:", bad)
t21 = w["t21"]; own = [c for c in t21.columns if c.endswith("_mw") and not c.startswith(("pln_owned","leased","ipp","total"))]
chk("t21", own, "pln_owned_subtotal_mw"); chk("t21", ["pln_owned_subtotal_mw","leased_mw","ipp_mw"], "total_mw")
t23 = w["t23"]; og = [c for c in t23.columns if c.startswith(("own_","leased_")) and not c.startswith("own_and")]
chk("t23", og, "own_and_leased_subtotal_gwh"); chk("t23", ["own_and_leased_subtotal_gwh","purchased_and_project_gwh"], "total_gwh")
chk("t28", ["kv_25_30_kms","kv_70_kms","kv_150_kms","kv_275_kms","kv_500_kms"], "total_kms")
chk("t30", [f"kv_{k}_mva" for k in ["500","275","150","70","lt30"]], "kv_total_mva")
chk("t30", [f"kv_{k}_units" for k in ["500","275","150","70","lt30"]], "kv_total_units")

for tid, cols in [("t01",["installed_capacity_mw","peak_load_mw"]),("t21",["total_mw","solar_mw"]),("t23",["total_gwh"]),
                  ("t28",["total_kms"]),("t29",["lv_kms","mv_15_20kv_kms"]),("t30",["kv_total_mva"]),("t02",["net_production_gwh","energy_consumption_gwh"]),
                  ("t19",["households_thousand","household_customers"])]:
    colsum(tid, cols)
# cross-table: t01 installed == t21 total
a = w["t01"].set_index("unit_id").installed_capacity_mw; b = w["t21"].set_index("unit_id").total_mw
d = (a-b).abs().dropna(); print("t01 vs t21 installed max diff", d.max(), "n", len(d))
print(w["t02"][["unit_name","own_production_gwh","transfer_other_unit_gwh","energy_consumption_gwh"]].tail(4))
print(w["t30"][w["t30"].unit_name.str.contains("Bengkulu|Gorontalo|Barat")][["unit_name","row_type","parent_unit_id"]])
