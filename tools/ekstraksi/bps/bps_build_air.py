import os as _os
HERE = _os.path.dirname(_os.path.abspath(__file__))
WORK = _os.environ.get("BPS_WORK", "work/bps")
_os.makedirs(WORK, exist_ok=True)
import json, os, re, shutil, pandas as pd
OUT = f"{WORK}/aerospace_air_transport"; shutil.rmtree(OUT, ignore_errors=True); os.makedirs(f"{OUT}/csv")
SRC = "BPS, Statistik Transportasi Udara 2024 (data: PT Angkasa Pura Indonesia; Ministry of Transportation, DGCA)"
Y = [2020, 2021, 2022, 2023, 2024]
# ---------- Tables 3.1–3.4: national traffic ----------
T31 = {  # (flight_type, direction): rows of [aircraft, passengers, cargo_t, baggage_t, mail_t]
 ("domestic", "arrival"):   [[523960, 35164959, 525554, 189034, 619], [485290, 33995847, 622202, 234335, 429], [598378, 57030816, 577454, 450471, 686],
                             [667624, 67477098, 580940, 522989, 519], [668928, 67307609, 689252, 531040, 432]],
 ("domestic", "departure"): [[526761, 33513741, 544147, 188342, 496], [484574, 30697923, 602107, 229688, 470], [604238, 52783838, 642730, 435756, 502],
                             [717788, 62683931, 601763, 506994, 343], [672239, 63211433, 674732, 519186, 404]],
 ("international", "arrival"):   [[34069, 3529923, 171053, 44068, 608], [17263, 749484, 217500, 6863, 38], [47098, 6773129, 200806, 75844, 359],
                                  [98044, 15348654, 182466, 166979, 768], [112061, 18921468, 224458, 257228, 75]],
 ("international", "departure"): [[34018, 3612521, 156846, 35693, 785], [17457, 631502, 217148, 3686, 6], [47073, 7108207, 179082, 62456, 622],
                                  [98637, 15636537, 155037, 146628, 980], [112227, 19035655, 189043, 217321, 171]]}
TABNO = {("domestic", "arrival"): "3.1", ("domestic", "departure"): "3.2", ("international", "arrival"): "3.3", ("international", "departure"): "3.4"}
a01 = [dict(year=y, flight_type=ft, direction=d, aircraft=r[0], passengers=r[1], cargo_ton=r[2], baggage_ton=r[3], mail_ton=r[4], source_table=TABNO[(ft, d)])
       for (ft, d), rows in T31.items() for y, r in zip(Y, rows)]
a01 = pd.DataFrame(a01).sort_values(["year", "flight_type", "direction"])
# ---------- Tables 3.5–3.6: major airports, departures 2023–2024 ----------
AP = ["Kualanamu", "Soekarno-Hatta", "Juanda", "Hasanuddin", "I Gusti Ngurah Rai", "Others", "Total"]
T35 = {"domestic": [(21805, 17955), (133105, 132921), (41676, 40415), (40285, 35602), (36396, 34791), (444521, 410550), (717788, 672234)],
       "international": [(7652, 8654), (41017, 48405), (6546, 6963), (1107, 867), (31791, 36297), (10524, 11041), (98637, 112227)]}
T36 = {"domestic": [(2543261, 2320210), (18538674, 18216922), (5206746, 5254396), (2782499, 2804077), (4721143, 4719108), (28891608, 29896572), (62683931, 63211285)],
       "international": [(924956, 1116215), (6783267, 8331605), (1061808, 1126644), (190792, 169239), (5712885, 7042090), (962829, 1249862), (15636537, 19035655)]}
a02 = []
for ft in ("domestic", "international"):
    for i, ap in enumerate(AP):
        for k, y in enumerate((2023, 2024)):
            a02.append(dict(year=y, flight_type=ft, airport=ap, airport_role="total" if ap == "Total" else ("others" if ap == "Others" else "major_airport"),
                            aircraft_departures=T35[ft][i][k], passenger_departures=T36[ft][i][k]))
a02 = pd.DataFrame(a02)
# ---------- Tables 3.7–3.8: scheduled airline production ----------
IND = [("aircraft_km", "Aircraft-km", "Km-pesawat", "thousand km"), ("aircraft_hours", "Aircraft hours flown", "Jam terbang pesawat", "hours"),
       ("passenger_km", "Passenger-km performed", "Km-penumpang terpakai", "million pkm"), ("seat_km", "Available seat-km", "Km-tempat duduk tersedia", "million askm"),
       ("passenger_load_factor", "Passenger load factor", "Faktor muatan penumpang", "%"), ("ton_km_performed", "Ton-km performed", "Ton-km terpakai", "million tkm"),
       ("ton_km_available", "Available ton-km", "Ton-km tersedia", "million tkm"), ("weight_load_factor", "Weight load factor", "Faktor muatan barang", "%")]
P = {"domestic": [[326586, 322506, 403386, 476686, 483062], [597704, 548390, 757188, 858810, 831502], [31667, 34827, 54927, 65728, 68715],
                  [54107, 54315, 69667, 82266, 83372], [58.53, 64.12, 78.84, 79.90, 82.42], [2949, 3327, 4845, 5521, 5856], [6058, 6408, 7731, 9032, 9121],
                  [48.69, 51.91, 62.67, 61.13, 64.20]],
     "international": [[173660, 95574, 222042, 458257, 540212], [241929, 132141, 548822, 673602, 787208], [24678, 7037, 44626, 91791, 112645],
                       [43527, 23497, 57041, 114680, 136420], [56.70, 29.95, 78.24, 80.04, 82.57], [3413, 2143, 5056, 9022, 11263],
                       [7068, 5330, 10420, 18085, 21230], [48.29, 40.20, 48.52, 49.89, 53.05]]}
a03 = [dict(year=y, flight_type=ft, indicator=k, indicator_label_en=e, indicator_label_id=i, value=v, unit=u,
            corrected=(ft == "domestic" and k == "seat_km" and y == 2020), source_table="3.7" if ft == "domestic" else "3.8")
       for ft, rows in P.items() for (k, e, i, u), vals in zip(IND, rows) for y, v in zip(Y, vals)]
a03 = pd.DataFrame(a03)
# ---------- Table 3.9: fleet ----------
a04 = pd.DataFrame([dict(year=y, aoc_121=a, aoc_135=b, oc91_aoc137_psc141_fasi=c, total=t) for y, (a, b, c, t) in
                    zip(Y, [(631, 316, 245, 1192), (569, 303, 242, 1114), (570, 296, 230, 1096), (594, 299, 214, 1107), (583, 295, 205, 1085)])])
# ---------- validation of national tables ----------
prob = []
for ft in ("domestic", "international"):
    for k in range(2):
        for col, src in ((0, T35), (1, T36)):
            rows = src[ft]; s = sum(r[k] for r in rows[:6])
            if s != rows[6][k]: prob.append(("3.5/3.6 sum", ft, k, s, rows[6][k]))
d = a01.set_index(["year", "flight_type", "direction"])
for ft in ("domestic", "international"):
    for y, k in ((2023, 0), (2024, 1)):
        tot_ac, tot_px = T35[ft][6][k], T36[ft][6][k]
        ac, px = d.loc[(y, ft, "departure"), "aircraft"], d.loc[(y, ft, "departure"), "passengers"]
        if (tot_ac, tot_px) != (ac, px): prob.append(("3.5/3.6 vs 3.2/3.4", ft, y, (tot_ac, tot_px), (ac, px)))
for ft in P:
    r = P[ft]
    for i, y in enumerate(Y):
        plf = round(100 * r[2][i] / r[3][i], 2); wlf = round(100 * r[5][i] / r[6][i], 2)
        if abs(plf - r[4][i]) > 0.06 or abs(wlf - r[7][i]) > 0.06: prob.append(("load factor", ft, y, plf, r[4][i], wlf, r[7][i]))
print("national checks:", prob)
pd.to_pickle(dict(a01=a01, a02=a02, a03=a03, a04=a04), f"{WORK}/air_national.pkl")
