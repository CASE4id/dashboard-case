#!/usr/bin/env bash
# PLN Statistics pipeline: extract -> validate -> combine.
# Put the reports in input/pln/ named Statistik<YEAR>.pdf (e.g. Statistik2024.pdf).
# Usage: ./run_pln.sh                 # all years that have both a PDF and a config entry
#        ./run_pln.sh 2023 2024       # selected years only
set -euo pipefail
cd "$(dirname "$0")"
YEARS=("$@")
if [ ${#YEARS[@]} -eq 0 ]; then
  YEARS=($(python3 -c "import json; print(' '.join(sorted(k for k in json.load(open('pln/config.json')))))"))
fi
python3 pln/build_name_map.py
DONE=(); DIRS=()
for Y in "${YEARS[@]}"; do
  PDF="input/pln/Statistik${Y}.pdf"
  if [ ! -f "$PDF" ]; then echo "skip $Y (no $PDF)"; continue; fi
  OUTDIR="work/pln/$Y"; mkdir -p "$OUTDIR"
  echo "== extract $Y"
  python3 pln/extract.py "$PDF" "$OUTDIR" "$Y" pln/config.json | tail -1
  echo "== validate $Y (any MISMATCH/COL line below is a discrepancy to review)"
  python3 pln/validate.py "$OUTDIR/.wide.pkl" | grep -E "MISMATCH|COL |NO REGION|max diff" | grep -v net_production || true
  DONE+=("$Y"); DIRS+=("$OUTDIR")
done
echo "== cross-table label check"; python3 pln/check_labels.py "${DIRS[@]}"
[ ${#DONE[@]} -eq 0 ] && { echo "nothing to combine"; exit 1; }
# newest year first
ORDER=$(for i in "${!DONE[@]}"; do echo "${DONE[$i]} ${DIRS[$i]}"; done | sort -r)
YS=$(echo "$ORDER" | awk '{print $1}' | paste -sd,); DS=$(echo "$ORDER" | awk '{print $2}' | paste -sd,)
MIN=$(echo "$ORDER" | tail -1 | awk '{print $1}'); MAX=$(echo "$ORDER" | head -1 | awk '{print $1}')
OUT="output/pln_statistics_${MIN}_${MAX}"
echo "== combine $YS -> $OUT"
python3 pln/combine.py "$OUT" "$YS" "$DS"
python3 pln/check_trends.py "$OUT/pln_statistics_long.csv"
(cd "$OUT" && rm -f ../pln_statistics_${MIN}_${MAX}_data.zip && zip -qr ../pln_statistics_${MIN}_${MAX}_data.zip .)
echo "done: $OUT and output/pln_statistics_${MIN}_${MAX}_data.zip"
