import os as _os
HERE = _os.path.dirname(_os.path.abspath(__file__))
import csv, re
k = lambda s: re.sub(r"[^a-z0-9]", "", re.sub(r"&|\b(and|dan)\b", " ", s.lower()))
M = {}
def add(canon, *variants):
    for v in variants: M[k(v)] = canon
# ---- distribution / regional units -> 2025 canonical names (same service area)
add("UID Aceh", "Region of Aceh", "UIW Aceh")
add("UID Sumatera Utara", "Region of North Sumatera", "UIW North Sumatera")
add("UID Sumatera Barat", "Region of West Sumatera", "UIW West Sumatera")
add("UID Riau dan Kepulauan Riau", "Region of Riau", "UIW Riau and Riau Archipelago", "UIW Riau")
add("UID Sumatera Selatan, Jambi dan Bengkulu", "Region of South Sumatera Jambi Bengkulu", "Region South Sumatera Jambi",
    "Region South Sumatera Jambi Bengkulu", "Region of South Sumatera Jambi", "UIW South Sumatera, Jambi and Bengkulu", "UIW South Sumatera, Jambi and")
add("UIW Bangka Belitung", "Region of Bangka Belitung", "UIW Bangka Belitung")
add("UID Lampung", "Distribution of Lampung", "UID Lampung")
add("UID Kalimantan Barat", "Region of West Kalimantan", "UIW West Kalimantan")
add("UID Kalimantan Selatan dan Tengah", "Region of S C Kalimantan", "UIW S and C Kalimantan", "UIW S dan C Kalimantan",
    "UIW South and Central Kalimantan", "UIW South and Cental Kalimantan", "UIW South and Central")
add("UID Kalimantan Timur dan Utara", "Region of East Kalimantan North", "UIW East Kalimantan and North", "UIW East Kalimantan dan North",
    "UIW East and North Kalimantan")
add("UID Sulawesi Utara, Tengah dan Gorontalo", "Region of N C Sulawesi Gorontalo", "UIW N, C Sulawesi and Gorontalo",
    "UIW N, C Sulawesi dan Gorontalo", "UIW N, C Sulawesi, and Gorontalo", "UIW North, Central Sulawesi and Gorontalo",
    "UIW North, Central Sulawesi, and Gorontalo", "UIW North, Central Sulawesi and", "UIW N, C Sulawesi and")
add("UID Sulawesi Selatan, Tenggara dan Barat", "Region of S SE W Sulawesi", "UIW S, SE and W Sulawesi", "UIW S, SE dan W Sulawesi",
    "UIW of S, SE and W Sulawesi", "UIW South, Southeast and West Sulawesi", "UIW South, Southeast and West")
add("UIW Maluku dan Maluku Utara", "Region of Maluku North Maluku", "UIW Maluku and North Maluku", "UIW Maluku dan North Maluku")
add("UIW Papua dan Papua Barat", "Region of Papua West Papua", "Region of Papua", "UIW Papua and West Papua", "UIW Papua and West of Papua",
    "UIW Papua dan Papua Barat")
add("UIW Nusa Tenggara Barat", "Region of West Nusa Tenggara", "UIW West Nusa Tenggara")
add("UIW Nusa Tenggara Timur", "Region of East Nusa Tenggara", "UIW East Nusa Tenggara")
add("UID Bali", "Distribution of Bali", "UID Bali")
add("UID Jawa Timur", "Dist. of East Java", "Dist, East Java", "UID East Java")
add("UID Jawa Tengah dan Yogyakarta", "Dist of Central Java Yogyakarta", "UID Central Java and Yogyakarta", "UID of Central Java and Yogyakarta")
add("UID Jawa Barat", "Dist. of West Java", "Dist, Jawa Barat", "UID West Java")
add("UID Banten", "Dist. of Banten", "Dist, Banten", "UID Banten")
add("UID Jakarta Raya", "Dist. of Jakarta Raya", "Dist, Jakarta Raya", "UID Jakarta Raya")
# ---- transmission / dispatch
add("UIP3B Sumatera", "Sumatera Trans. and Control Center", "Sumatera Trans, and Control Center", "Sumatera Trans Control Center", "UIP3B Sumatera")
add("UIP2B", "Distribution and Load Control Center (P2B)", "Distribution and Load Control Center", "UIP2B")
add("UIT Jawa Bagian Barat", "Transmission of Western Part of Java", "UIT Western Part of Java")
add("UIT Jawa Bagian Tengah", "Transmission of Central Part of Java", "UIT Central Part of Java")
add("UIT Jawa Bagian Timur dan Bali", "Transmission of Eastern Part of Java", "Transmission of Eastern Part of Java Bali",
    "UIT Eastern Part of Java and Bali", "UIT Eastern Part of Java dan Bali")
# ---- generation units (Sumatera units continue as the 2023+ 'Kit' rows)
add("Kit Sumbagut", "Generation of Northern Part of Sumatera", "Generation of Norhtern Part of Sumatera",
    "UIK Northern Part of Sumatera", "UIK Norhtern Part of Sumatera")
add("Kit Sumbagsel", "Generation of Southern Part of Sumatera", "UIK Southern Part of Sumatera")
add("UIK Jawa Bagian Barat", "Generation of Western Part of Java", "UIK Western Part of Java")
add("UIK Jawa Bagian Tengah", "Generation of Central Part of Java", "UIK Central Part of Java")
add("UIK Jawa Bagian Timur, Bali dan Nusa Tenggara", "Generation of Eastern Part of Java Bali", "Generation of Eastern Part of Java Bali Nusra",
    "Generation of Eastern Part of Java Bali Nursa", "UIK Eastern Part of Java, Bali and Nusra", "UIK Eastern Part of Java, Bali and Nursa",
    "UIK Eastern Part of Java, Bali and Nusa", "UIK Eastern Part of Java, Bali and Nusa Tenggara")
add("UIK Tanjung Jati B", "Generation of Tanjung Jati B", "UIK Tanjung Jati B")
add("UIKL Kalimantan", "Generation Transmission of Kalimantan", "Generation Transmission of", "UIKL Kalimantan", "UIKL Central Kalimantan")
add("UIKL Sulawesi", "Generation Transmission of Sulawesi", "UIKL Sulawesi")
# ---- generation subsidiaries (pre-2023 companies; successors noted in units.csv)
add("PT Indonesia Power", "PT Indonesia Power")
add("PT PJB", "PT Java Bali Genco", "PT PJB")
add("PT PJB Sulawesi", "PJB Sulawesi", "PT PJB Sulawesi")
add("PT PLN Batam", "PT PLN Batam"); add("PT PLN Tarakan", "PT PLN Tarakan")
# ---- construction units (Unit Induk Pembangunan)
add("UIP Jawa Bagian Barat", "UIP West of Java", "UIP Western Part of Java")
add("UIP Jawa Bagian Tengah I", "UIP Central Part of Java I")
add("UIP Jawa Bagian Timur I", "UIP Eastern Part of Java I")
add("UIP Jawa Bagian Timur dan Bali II", "UIP East of Java and Bali II", "UIP East of Java Bali II", "UIP Eastern Part of Java and Bali II")
add("UIP Kalimantan Bagian Barat", "UIP West of Kalimantan", "UIP Western Part of Kalimantan")
add("UIP Kalimantan Bagian Tengah", "UIP Central Part of Kalimantan")
add("UIP Kalimantan Bagian Timur", "UIP East of Kalimantan", "UIP East of Kalimamtan", "UIP Eastern Part of Kalimantan")
add("UIP Sulawesi Bagian Utara", "UIP Northern Part of Sulawesi", "UIP Nortern Part of Sulawesi")
add("UIP Sulawesi Bagian Selatan", "UIP Southern Part of Sulawesi")
add("UIP Sulawesi", "UIP Sulawesi")
add("UIP Sumatera Bagian Utara", "UIP Northern Part of Sumatera")
add("UIP Pembangkit Sumatera", "UIP Generation of Sumatera")
add("UIP Sumatera", "UIP Sumatera")
add("UIP Nusa Tenggara", "UIP NUSRA", "UIP Nusra", "UIP Nusa Tenggara")
add("Proyek Pembangkitan", "Generation Project", "Generation Projects")

# ---- 2014-2017 report generation
add("UID Lampung", "Distriibution of Lampung", "Region of Lampung")
add("UID Riau dan Kepulauan Riau", "Region of Riiau")
add("UID Kalimantan Timur dan Utara", "Region of East Kalimantan")
add("UID Sumatera Selatan, Jambi dan Bengkulu", "Wilayah South Sumatera, Jambi and Bengkulu", "Region South Sumatera, Jambi and Bengkulu")
add("UID Jakarta Raya", "Dist. of Jakarta Raya and Tangerang", "Dist. of Jakarta Raya Tangerang")
add("UID Jawa Barat dan Banten", "Dist. of West Java and Banten", "Dist. of West Java Banten")
add("P3B Jawa Bali", "Java Bali Trans. and Control Center", "Java Bali. and Control Center")
add("UIP2B", "Distribution and Load Control Center (P2B) Java Bali", "Distributin and Load Control Center (P2B)")
add("P2B Jawa Bagian Barat", "P2B of Western Part of Java")
add("P2B Jawa Bagian Tengah", "P2B of Central Part of Java")
add("P2B Jawa Bagian Timur dan Bali", "P2B of Eastern Part of Java and Bali")
add("Kit Jawa Bali", "Generation Unit of Java Bali")
add("Kit Sumbagut", "Generation of Northerm Part of Sumatera")
add("Kit Sumbagsel", "Generation of Southerm Part of Sumatera")
add("PT PJB", "mq Java Bali Genco", "PT Java Bali Genco *)")
for r in ["I", "VIII", "IX", "X", "XI"]:
    add("UIP " + r, "Construction Unit " + r, "PLN Construction Unit " + r, "Power Plant Development Unit (UIP) " + r)
add("UIP Kalimantan Bagian Tengah", "Power Plant Development Unit (UIP) of Central Kalimantan", "Power Plant Development Unit (UIP) of Central of Kalimantan")
add("UIP Kalimantan Bagian Timur", "Power Plant Development Unit (UIP) of East Kalimantan", "Power Plant Development Unit (UIP) of East of Kalimantan")
add("UIP Pembangkit Sumatera", "Power Plant Development Unit (UIP) of Sumatera Power Plant")
add("UIP Kalimantan Bagian Barat", "Power Plant Development Unit (UIP) of West Kalimantan")
add("UIP Jawa Bagian Tengah", "Power Plant Development Unit (UIP) of Central Java")
add("UIP Jawa Bagian Timur dan Bali", "Power Plant Development Unit (UIP) of East Java and Bali")
add("UIP Sulawesi Bagian Selatan", "Power Plant Development Unit (UIP) South of Sulawesi", "Power Plant Development Unit (UIP) of South of Sulawesi")
# ---- provinces (English -> Indonesian)
for e, i in [("Central Java","Jawa Tengah"),("Central Kalimantan","Kalimantan Tengah"),("Central Papua","Papua Tengah"),
             ("Central Sulawesi","Sulawesi Tengah"),("Mountain Papua","Papua Pegunungan"),("Highland Papua","Papua Pegunungan"),
             ("North Maluku","Maluku Utara"),("North Sulawesi","Sulawesi Utara"),("Riau Archipelago","Kepulauan Riau"),
             ("South Kalimantan","Kalimantan Selatan"),("South Papua","Papua Selatan"),("South Sulawesi","Sulawesi Selatan"),
             ("South Sumatera","Sumatera Selatan"),("Southeast Sulawesi","Sulawesi Tenggara"),("Southwest Papua","Papua Barat Daya"),
             ("West Papua","Papua Barat"),("West Sulawesi","Sulawesi Barat"),("DI Yogyakarta","Daerah Istimewa Yogyakarta")]:
    add("- " + i, "- " + e)
with open(_os.path.join(HERE, "unit_name_map.csv"), "w", newline="", encoding="utf-8") as f:
    w = csv.writer(f); w.writerow(["key", "canonical_name"])
    for key, c in sorted(M.items()): w.writerow([key, c])
print(len(M), "variants ->", len(set(M.values())), "canonical units")
