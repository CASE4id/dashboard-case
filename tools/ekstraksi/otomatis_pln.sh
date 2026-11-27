#!/usr/bin/env bash
# One new Statistik PLN year, from PDF to the dashboard file + review report.
# Used by .github/workflows/tambah-data-pln.yml; can also be run locally:
#   tools/ekstraksi/otomatis_pln.sh 2026 https://…/Statistik2026.pdf     (or a local path to the PDF)
# Results:
#   data/listrik/statistik-pln-<YEAR>.xlsx      dashboard file
#   tools/ekstraksi/pln/config.json             <YEAR> entry added if it was missing
#   tools/ekstraksi/work/laporan.md             review report (pull-request description)
#   tools/ekstraksi/work/status                 "ok" or "review"
set -euo pipefail
YEAR="${1:-}"; SRC="${2:-}"
if ! [[ "$YEAR" =~ ^20[0-9]{2}$ ]]; then echo "Tahun tidak valid: '$YEAR' (contoh: 2026)"; exit 2; fi
cd "$(dirname "$0")"
ROOT="$(cd ../.. && pwd)"
DASH="$ROOT/data/listrik"
PREV=$(ls "$DASH"/statistik-pln-*.xlsx | sed -E 's/.*statistik-pln-([0-9]{4})\.xlsx/\1/' | awk -v y="$YEAR" '$1 < y' | sort -n | tail -1)
if [ -z "$PREV" ]; then echo "Tidak ada file tahun sebelumnya di data/listrik/"; exit 2; fi
mkdir -p input/pln work
PDF="input/pln/Statistik${YEAR}.pdf"

echo "== 1. PDF"
if [ -n "$SRC" ] && [ -f "$SRC" ]; then
  cp "$SRC" "$PDF"
elif [[ "$SRC" =~ ^https?:// ]]; then
  curl -fsSL --retry 3 -o "$PDF" "$SRC"
elif [ ! -f "$PDF" ]; then
  echo "PDF tidak ditemukan: isi tautan PDF, atau letakkan file di tools/ekstraksi/$PDF"; exit 2
fi
if [ "$(head -c 4 "$PDF")" != "%PDF" ]; then
  echo "File yang diunduh bukan PDF. Pastikan tautannya langsung ke file PDF (bukan halaman web)."; exit 2
fi
pdfinfo "$PDF" | grep -E "^Pages" || true

echo "== 2. Pengaturan halaman & kolom"
python3 pln/build_name_map.py >/dev/null
AUTO_MD="-"
if python3 -c "import json,sys; sys.exit(0 if '$YEAR' in json.load(open('pln/config.json')) else 1)"; then
  AUTO_STATUS=existing; echo "memakai pengaturan $YEAR yang sudah ada di pln/config.json"
else
  AUTO_MD=work/auto_config.md
  set +e
  PLN_DASHBOARD_DIR="$DASH" python3 pln/auto_config.py "$PDF" "$YEAR" pln/config.json --write --report "$AUTO_MD"
  rc=$?; set -e
  case $rc in 0) AUTO_STATUS=ok ;; 1) AUTO_STATUS=review ;; *) AUTO_STATUS=fail ;; esac
  if [ "$AUTO_STATUS" = fail ]; then echo "Pengaturan otomatis gagal: tabel tidak ditemukan di PDF."; cat "$AUTO_MD" || true; exit 1; fi
fi

echo "== 3. Ekstraksi & pemeriksaan"
OUTDIR="work/pln/$YEAR"; mkdir -p "$OUTDIR"
NEW="work/statistik-pln-${YEAR}.xlsx"; rm -f "$NEW"   # built here; copied to data/listrik only if everything succeeds
: > work/validate.txt; : > work/labels.txt; : > work/error.txt
data_ok=1
{
  python3 pln/extract.py "$PDF" "$OUTDIR" "$YEAR" pln/config.json | tail -1 &&
  python3 pln/validate.py "$OUTDIR/.wide.pkl" > work/validate.txt &&
  python3 pln/check_labels.py "$OUTDIR" > work/labels.txt &&
  echo "== 4. File dashboard" &&
  python3 pln/combine.py "output/pln_statistics_${YEAR}_${YEAR}" "$YEAR" "$OUTDIR" >/dev/null &&
  python3 pln/to_dashboard.py "output/pln_statistics_${YEAR}_${YEAR}/pln_statistics_${YEAR}_${YEAR}.xlsx" "$YEAR" "$NEW" "$DASH/statistik-pln-${PREV}.xlsx"
} 2> work/error.txt || data_ok=0
grep -E "MISMATCH|COL |NO REGION|max diff" work/validate.txt | grep -v net_production || true
cat work/labels.txt
if [ $data_ok = 0 ]; then
  echo "Ekstraksi tidak selesai (biasanya karena tata letak tabel berubah):"; tail -5 work/error.txt
  NEW="-"; AUTO_STATUS=review
else
  cp "$NEW" "$DASH/statistik-pln-${YEAR}.xlsx"
fi

echo "== 5. Laporan"
STATUS=$(python3 pln/laporan.py "$YEAR" "$NEW" "$DASH/statistik-pln-${PREV}.xlsx" \
  work/validate.txt work/labels.txt "$AUTO_MD" "$AUTO_STATUS" "$(basename "${SRC:-$PDF}")" work/laporan.md)
echo "$STATUS" > work/status
echo "status: $STATUS (laporan: tools/ekstraksi/work/laporan.md)"
