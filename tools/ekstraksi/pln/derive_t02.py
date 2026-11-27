import pandas as pd
GWH = ["purchased_gwh","project_gwh","received_other_unit_gwh","own_production_gwh","leased_gwh","own_use_power_plant_gwh","transformer_losses_gwh",
       "net_production_gwh","own_use_substation_gwh","transmission_losses_gwh","transfer_other_unit_gwh","transfer_non_pln_gwh","transfer_distribution_gwh",
       "own_use_distr_substation_gwh","distribution_losses_gwh","energy_losses_gwh","energy_losses_own_use_gwh","energy_consumption_gwh"]
def derive(df):
    lj = df[df.unit_id=="luar_jawa"].iloc[0]; jw = df[df.unit_id=="jawa"].iloc[0]
    r = {c: (None if pd.isna(lj[c]) and pd.isna(jw[c]) else (0 if pd.isna(lj[c]) else lj[c]) + (0 if pd.isna(jw[c]) else jw[c])) for c in GWH}
    net = r["net_production_gwh"]; gen = (r["own_production_gwh"] or 0) + (r["leased_gwh"] or 0)
    pct = lambda a, b: None if a is None or not b else round(100 * a / b, 2)
    r.update(own_use_power_plant_pct=pct(r["own_use_power_plant_gwh"], gen), transformer_losses_pct=pct(r["transformer_losses_gwh"], gen),
             own_use_substation_pct=pct(r["own_use_substation_gwh"], net), transmission_losses_pct=pct(r["transmission_losses_gwh"], net),
             own_use_distr_substation_pct=pct(r["own_use_distr_substation_gwh"], net), distribution_losses_pct=pct(r["distribution_losses_gwh"], r["transfer_distribution_gwh"]),
             energy_losses_pct=pct(r["energy_losses_gwh"], net), energy_losses_own_use_pct=pct(r["energy_losses_own_use_gwh"], net),
             energy_consumption_pct=pct(r["energy_consumption_gwh"], net))
    return r
if __name__ == "__main__":
    import sys
    for d in sys.argv[1:]:
        y = d[-2:]
        df = pd.read_pickle(f"{d}/.wide.pkl")["t02"]; d = derive(df); ind = df[df.unit_id=="indonesia"].iloc[0]
        bad = {k: (round(v,2), ind[k]) for k, v in d.items() if v is not None and not pd.isna(ind[k]) and abs(v - ind[k]) > (0.015 if k.endswith("pct") else 0.05)
               and k not in ("received_other_unit_gwh","transfer_other_unit_gwh")}
        print("20"+y, "mismatches vs published Indonesia:", bad)
