#!/usr/bin/env bash
# BPS gas (transmission) and air transport (aerospace) pipeline.
# Put the publications in input/bps/: statistik_gas.pdf and statistik_transportasi_udara.pdf
set -euo pipefail
cd "$(dirname "$0")"
export BPS_WORK="work/bps"; mkdir -p "$BPS_WORK/json" output
AIR="input/bps/statistik_transportasi_udara.pdf"
echo "== gas tables (transcribed values, validated against published totals)"
python3 bps/bps_gas.py
python3 bps/bps_build_gas.py
echo "== airport appendices (page ranges are for the 2024 edition)"
python3 bps/bps_airport.py "$AIR" 159 169 2 "$BPS_WORK/json/app06_dom_aircraft.json"
python3 bps/bps_airport.py "$AIR" 170 181 3 "$BPS_WORK/json/app07_dom_passengers.json"
python3 bps/bps_airport.py "$AIR" 193 204 2 "$BPS_WORK/json/app09_dom_cargo.json"
python3 bps/bps_airport.py "$AIR" 217 220 2 "$BPS_WORK/json/app11_intl_aircraft.json"
python3 bps/bps_airport.py "$AIR" 221 223 3 "$BPS_WORK/json/app12_intl_passengers.json"
python3 bps/bps_airport.py "$AIR" 228 231 2 "$BPS_WORK/json/app14_intl_cargo.json"
echo "== aviation national tables + airport/province tables"
python3 bps/bps_build_air.py
python3 bps/bps_build_air2.py > "$BPS_WORK/air2_log.txt"; head -3 "$BPS_WORK/air2_log.txt"
python3 bps/bps_package.py
for D in transmission_gas aerospace_air_transport; do
  rm -rf "output/$D"; cp -r "$BPS_WORK/$D" "output/$D"
done
(cd output/transmission_gas && rm -f ../transmission_gas_data.zip && zip -qr ../transmission_gas_data.zip . -x "*.xlsx")
(cd output/aerospace_air_transport && rm -f ../aerospace_air_transport_data.zip && zip -qr ../aerospace_air_transport_data.zip . -x "*.xlsx")
echo "done: output/transmission_gas, output/aerospace_air_transport"
