import os as _os
HERE = _os.path.dirname(_os.path.abspath(__file__))
WORK = _os.environ.get("BPS_WORK", "work/bps")
_os.makedirs(WORK, exist_ok=True)
import json, re, collections, pandas as pd
J = lambda f: json.load(open(f"{WORK}/json/{f}.json"))
dom = {"aircraft": (J("app06_dom_aircraft"), ["arrivals", "departures"]), "passengers": (J("app07_dom_passengers"), ["arrivals", "departures", "transit"]),
       "cargo_kg": (J("app09_dom_cargo"), ["unloaded", "loaded"])}
intl = {"aircraft": (J("app11_intl_aircraft"), ["arrivals", "departures"]), "passengers": (J("app12_intl_passengers"), ["arrivals", "departures", "transit"]),
        "cargo_kg": (J("app14_intl_cargo"), ["unloaded", "loaded"])}
def clean(n):
    n = re.sub(r"\s+", " ", n).strip(" –-")
    return n
def split(n):
    parts = [p.strip() for p in re.split(r" – ", n) if p.strip()]
    if len(parts) >= 2: return " – ".join(parts[:-1]), parts[-1]
    return n, None
# consensus names per domestic index
names = collections.defaultdict(list); prov = {}
for recs, _ in dom.values():
    for r in recs:
        if r["kind"] == "airport": names[r["idx"]].append(clean(r["name"])); prov[r["idx"]] = r["province"]
def best(ns):
    c = collections.Counter(ns).most_common()
    top = [n for n, k in c if k == c[0][1]]
    return min(top, key=len) if len(top) > 1 else top[0]
rows = []
for idx in sorted(names):
    full = best(names[idx]); ap, reg = split(full)
    rows.append(dict(airport_no=idx, airport_id=f"apt_{idx:03d}", airport_name=ap, regency_city=reg, airport_label_full=full, province=prov[idx]))
apt = pd.DataFrame(rows)
def add(df, src, prefix):
    for metric, (recs, cols) in src.items():
        m = {r["idx"]: r["vals"] for r in recs if r["kind"] == "airport"}
        for j, c in enumerate(cols):
            df[f"{prefix}_{metric}_{c}".replace("cargo_kg_", "cargo_kg_")] = df["airport_no"].map(lambda i: (m.get(i) or [None] * 3)[j] if i in m else None)
add(apt, dom, "dom")
# international: match by airport name to domestic list
key = lambda s: re.sub(r"[^a-z]", "", s.lower().split("–")[0])
k2no = {key(r.airport_label_full): r.airport_no for r in apt.itertuples()}
k2no.update({key(r.airport_name): r.airport_no for r in apt.itertuples()})
intl_map, unmatched = {}, []
for recs, _ in intl.values():
    for r in recs:
        if r["kind"] != "airport": continue
        k = key(clean(r["name"])); no = k2no.get(k)
        if no is None:
            cand = [n for kk, n in k2no.items() if kk and (kk.startswith(k[:10]) or k.startswith(kk[:10]))]
            no = cand[0] if len(set(cand)) == 1 else None
        if no is None:   # listed by city: match on regency/city within the same province
            c = [x.airport_no for x in apt.itertuples() if x.province == r["province"] and x.regency_city and
                 re.sub(r"[^a-z]", "", x.regency_city.lower()) == re.sub(r"[^a-z]", "", clean(r["name"]).lower())]
            no = c[0] if len(c) == 1 else None
        if no is None: unmatched.append((r["idx"], r["name"], r["province"]))
        intl_map[(r["idx"])] = no
for metric, (recs, cols) in intl.items():
    m = {intl_map[r["idx"]]: r["vals"] for r in recs if r["kind"] == "airport" and intl_map.get(r["idx"])}
    for j, c in enumerate(cols):
        apt[f"intl_{metric}_{c}"] = apt["airport_no"].map(lambda i: m[i][j] if i in m else None)
apt["has_international_traffic"] = apt[[c for c in apt.columns if c.startswith("intl_")]].notna().any(axis=1)
print("intl unmatched:", unmatched, "| intl airports matched:", int(apt.has_international_traffic.sum()), "| distinct targets:", len(set(v for v in intl_map.values() if v)), "of", len(intl_map))
print(apt[apt.has_international_traffic][["airport_no","airport_name","regency_city","province","intl_passengers_arrivals"]].to_string())
# provinces
pv = {}
for src, prefix in ((dom, "dom"), (intl, "intl")):
    for metric, (recs, cols) in src.items():
        for r in recs:
            if r["kind"] == "province":
                d = pv.setdefault(r["name"], {"province": r["name"]})
                for j, c in enumerate(cols): d[f"{prefix}_{metric}_{c}"] = r["vals"][j]
prv = pd.DataFrame(pv.values())
nat = prv[prv.province == "Indonesia"]; prv = prv[prv.province != "Indonesia"].copy()
ap_count = apt.groupby("province").size(); prv.insert(1, "airports_listed", prv.province.map(ap_count).fillna(0).astype(int))
prv = pd.concat([prv, nat.assign(airports_listed=len(apt))], ignore_index=True)
prv.insert(1, "row_type", ["province"] * (len(prv) - 1) + ["national_total"])
# checks: province sums vs national; airport sums vs province
num = [c for c in prv.columns if c.startswith(("dom_", "intl_"))]
s = prv[prv.row_type == "province"][num].fillna(0).sum(); n = prv[prv.row_type == "national_total"][num].fillna(0).iloc[0]
print("provinces vs national:", {c: (s[c], n[c]) for c in num if s[c] != n[c]})
a = apt.groupby("province")[num].sum(min_count=1).fillna(0); p = prv.set_index("province").loc[a.index, num].fillna(0)
diff = (a - p); bad = diff[(diff != 0).any(axis=1)]
print("airports vs provinces mismatches:\n", bad.loc[:, (bad != 0).any()].to_string() if len(bad) else "none")
apt.insert(0, "year", 2024); prv.insert(0, "year", 2024)
pd.to_pickle(dict(apt=apt, prv=prv), f"{WORK}/air_airports.pkl")
print(apt.head(3).T.to_string()); print(len(apt), len(prv))
